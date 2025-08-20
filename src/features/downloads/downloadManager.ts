import { ChapterStorage, DownloadQueueStorage, ChapterRecord, DownloadQueueItem } from '@/lib/storage/indexedDb';
import { ImageCache } from '@/lib/storage/cache';
import { getChapterDetail } from '@/lib/mangadex/chapter';

export type DownloadEventType = 
  | 'progress'
  | 'completed'
  | 'error'
  | 'paused'
  | 'resumed'
  | 'queued'
  | 'started';

export interface DownloadEvent {
  type: DownloadEventType;
  chapterId: string;
  progress?: number;
  error?: string;
  totalSize?: number;
  downloadedSize?: number;
}

export type DownloadEventCallback = (event: DownloadEvent) => void;

class DownloadManagerCore {
  private eventListeners: DownloadEventCallback[] = [];
  private activeDownloads = new Map<string, AbortController>();
  private isProcessing = false;
  private maxConcurrentDownloads = 3;
  private retryDelay = 5000; // 5 seconds
  private maxRetries = 3;

  /**
   * Add event listener for download events
   */
  addEventListener(callback: DownloadEventCallback): () => void {
    this.eventListeners.push(callback);
    return () => {
      const index = this.eventListeners.indexOf(callback);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(event: DownloadEvent): void {
    this.eventListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in download event listener:', error);
      }
    });
  }

  /**
   * Add a chapter to the download queue
   */
  async queueChapterDownload(chapterId: string, priority: number = 0): Promise<void> {
    try {
      // Check if already downloaded or in queue
      const existing = await ChapterStorage.getChapter(chapterId);
      if (existing && (existing.status === 'downloaded' || existing.status === 'downloading' || existing.status === 'queued')) {
        throw new Error('Chapter is already downloaded or in queue');
      }

      // Fetch chapter details
      const chapterData = await getChapterDetail(chapterId);
      if (!chapterData.pages || chapterData.pages.length === 0) {
        throw new Error('No pages found for this chapter');
      }

      // Create chapter record
      const chapterRecord: ChapterRecord = {
        id: chapterId,
        title: chapterData.title || 'Untitled',
        seriesId: chapterData.manga.id,
        pageUrls: chapterData.pages,
        cachedRequests: [],
        sizeBytes: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'queued',
        progress: 0,
        manga: chapterData.manga,
        chapter: chapterData.chapter,
        vol: chapterData.vol,
      };

      await ChapterStorage.setChapter(chapterRecord);

      // Add to download queue
      const queueItem: DownloadQueueItem = {
        id: `${chapterId}-${Date.now()}`,
        chapterId,
        priority,
        retryCount: 0,
        createdAt: Date.now(),
      };

      await DownloadQueueStorage.addToQueue(queueItem);

      this.emitEvent({
        type: 'queued',
        chapterId,
      });

      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    } catch (error) {
      console.error('Failed to queue chapter download:', error);
      this.emitEvent({
        type: 'error',
        chapterId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process the download queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (true) {
        const queue = await DownloadQueueStorage.getQueue();
        const pendingItems = queue.filter(item => !this.activeDownloads.has(item.chapterId));
        
        if (pendingItems.length === 0) {
          break;
        }

        // Start downloads up to the concurrent limit
        const availableSlots = this.maxConcurrentDownloads - this.activeDownloads.size;
        const itemsToProcess = pendingItems.slice(0, availableSlots);

        if (itemsToProcess.length === 0) {
          // Wait for current downloads to finish
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        await Promise.all(
          itemsToProcess.map(item => this.downloadChapter(item))
        );

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Download a single chapter
   */
  private async downloadChapter(queueItem: DownloadQueueItem): Promise<void> {
    const { chapterId } = queueItem;
    const abortController = new AbortController();
    this.activeDownloads.set(chapterId, abortController);

    try {
      const chapter = await ChapterStorage.getChapter(chapterId);
      if (!chapter) {
        throw new Error('Chapter not found in storage');
      }

      // Update status to downloading
      await ChapterStorage.updateChapterProgress(chapterId, 0, 'downloading');
      this.emitEvent({
        type: 'started',
        chapterId,
      });

      const { pageUrls } = chapter;
      const cachedRequests: string[] = [];
      let totalSize = 0;
      let downloadedSize = 0;

      // Estimate total size (rough estimate based on average image size)
      const estimatedSizePerImage = 1024 * 1024; // 1MB per image
      const estimatedTotalSize = pageUrls.length * estimatedSizePerImage;

      // Download images sequentially to avoid overwhelming the server
      for (let i = 0; i < pageUrls.length; i++) {
        if (abortController.signal.aborted) {
          throw new Error('Download cancelled');
        }

        const pageUrl = pageUrls[i];
        
        try {
          const cacheKey = await ImageCache.storeImage(pageUrl, chapterId);
          cachedRequests.push(cacheKey);

          // Get actual size of cached image
          const imageSize = await ImageCache.getChapterCacheSize([cacheKey]);
          totalSize += imageSize;
          downloadedSize += imageSize;

          // Update progress
          const progress = (i + 1) / pageUrls.length;
          await ChapterStorage.updateChapterProgress(chapterId, progress);
          
          this.emitEvent({
            type: 'progress',
            chapterId,
            progress,
            totalSize: estimatedTotalSize,
            downloadedSize,
          });

          // Small delay between images to be nice to the server
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (imageError) {
          console.error(`Failed to download image ${i + 1}/${pageUrls.length}:`, imageError);
          
          // If it's a network error and we haven't exceeded retries, we could retry
          if (queueItem.retryCount < this.maxRetries) {
            throw imageError; // This will trigger a retry
          }
          
          // Otherwise, continue with the next image
          // We'll mark the chapter as partially downloaded
        }
      }

      // Update chapter with final data
      const updatedChapter: ChapterRecord = {
        ...chapter,
        cachedRequests,
        sizeBytes: totalSize,
        progress: 1,
        status: 'downloaded',
        updatedAt: Date.now(),
      };

      await ChapterStorage.setChapter(updatedChapter);
      await DownloadQueueStorage.removeFromQueue(queueItem.id);

      this.emitEvent({
        type: 'completed',
        chapterId,
        progress: 1,
        totalSize,
      });

    } catch (error) {
      console.error(`Failed to download chapter ${chapterId}:`, error);

      // Handle retries
      if (queueItem.retryCount < this.maxRetries && !abortController.signal.aborted) {
        queueItem.retryCount++;
        await DownloadQueueStorage.addToQueue({
          ...queueItem,
          id: `${chapterId}-${Date.now()}`, // New ID for retry
        });
        
        // Schedule retry with backoff
        setTimeout(() => {
          if (!this.isProcessing) {
            this.processQueue();
          }
        }, this.retryDelay * Math.pow(2, queueItem.retryCount - 1));
      } else {
        // Max retries exceeded or cancelled
        await ChapterStorage.updateChapterProgress(chapterId, 0, 'error');
        await DownloadQueueStorage.removeFromQueue(queueItem.id);
      }

      this.emitEvent({
        type: 'error',
        chapterId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.activeDownloads.delete(chapterId);
    }
  }

  /**
   * Pause a download
   */
  async pauseDownload(chapterId: string): Promise<void> {
    const abortController = this.activeDownloads.get(chapterId);
    if (abortController) {
      abortController.abort();
      this.activeDownloads.delete(chapterId);
      await ChapterStorage.updateChapterProgress(chapterId, undefined, 'paused');
      this.emitEvent({
        type: 'paused',
        chapterId,
      });
    }
  }

  /**
   * Resume a paused download
   */
  async resumeDownload(chapterId: string): Promise<void> {
    const chapter = await ChapterStorage.getChapter(chapterId);
    if (chapter && chapter.status === 'paused') {
      await ChapterStorage.updateChapterProgress(chapterId, chapter.progress, 'queued');
      
      // Add back to queue
      const queueItem: DownloadQueueItem = {
        id: `${chapterId}-${Date.now()}`,
        chapterId,
        priority: 0,
        retryCount: 0,
        createdAt: Date.now(),
      };

      await DownloadQueueStorage.addToQueue(queueItem);
      
      this.emitEvent({
        type: 'resumed',
        chapterId,
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    }
  }

  /**
   * Cancel a download and remove from queue
   */
  async cancelDownload(chapterId: string): Promise<void> {
    // Abort active download
    const abortController = this.activeDownloads.get(chapterId);
    if (abortController) {
      abortController.abort();
      this.activeDownloads.delete(chapterId);
    }

    // Remove from queue
    const queue = await DownloadQueueStorage.getQueue();
    const queueItem = queue.find(item => item.chapterId === chapterId);
    if (queueItem) {
      await DownloadQueueStorage.removeFromQueue(queueItem.id);
    }

    // Clean up partial download
    const chapter = await ChapterStorage.getChapter(chapterId);
    if (chapter) {
      if (chapter.cachedRequests.length > 0) {
        await ImageCache.removeChapterImages(chapter.cachedRequests);
      }
      await ChapterStorage.deleteChapter(chapterId);
    }
  }

  /**
   * Delete a downloaded chapter
   */
  async deleteChapter(chapterId: string): Promise<void> {
    const chapter = await ChapterStorage.getChapter(chapterId);
    if (chapter) {
      // Remove cached images
      if (chapter.cachedRequests.length > 0) {
        await ImageCache.removeChapterImages(chapter.cachedRequests);
      }
      
      // Remove from storage
      await ChapterStorage.deleteChapter(chapterId);
    }
  }

  /**
   * Get download status for a chapter
   */
  async getChapterStatus(chapterId: string): Promise<ChapterRecord | null> {
    return ChapterStorage.getChapter(chapterId) || null;
  }

  /**
   * Get all downloaded chapters
   */
  async getAllDownloadedChapters(): Promise<ChapterRecord[]> {
    return ChapterStorage.getChaptersByStatus('downloaded');
  }

  /**
   * Get current download queue
   */
  async getDownloadQueue(): Promise<DownloadQueueItem[]> {
    return DownloadQueueStorage.getQueue();
  }

  /**
   * Clear all downloads and cache
   */
  async clearAllDownloads(): Promise<void> {
    // Abort all active downloads
    for (const [chapterId, controller] of this.activeDownloads) {
      controller.abort();
    }
    this.activeDownloads.clear();

    // Clear queue
    await DownloadQueueStorage.clearQueue();

    // Clear all chapter data
    const chapters = await ChapterStorage.getAllChapters();
    await Promise.all(chapters.map(chapter => ChapterStorage.deleteChapter(chapter.id)));

    // Clear image cache
    await ImageCache.clearAll();
  }
}

// Singleton instance
export const DownloadManager = new DownloadManagerCore();