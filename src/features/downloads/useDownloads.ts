import { useState, useEffect, useCallback } from 'react';
import { DownloadManager, DownloadEvent, DownloadEventCallback } from './downloadManager';
import { ChapterRecord, DownloadQueueItem } from '@/lib/storage/indexedDb';
import { AppSettings } from '@/lib/storage/indexedDb';
import { ImageCache } from '@/lib/storage/cache';

export interface UseDownloadsState {
  downloads: ChapterRecord[];
  queue: DownloadQueueItem[];
  isLoading: boolean;
  storageQuota: { used: number; quota: number; };
  cacheStats: {
    entryCount: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  };
}

export interface UseDownloadsActions {
  downloadChapter: (chapterId: string, priority?: number) => Promise<void>;
  pauseDownload: (chapterId: string) => Promise<void>;
  resumeDownload: (chapterId: string) => Promise<void>;
  cancelDownload: (chapterId: string) => Promise<void>;
  deleteChapter: (chapterId: string) => Promise<void>;
  clearAllDownloads: () => Promise<void>;
  refreshData: () => Promise<void>;
  getChapterStatus: (chapterId: string) => ChapterRecord | undefined;
}

export interface UseDownloadsReturn extends UseDownloadsState, UseDownloadsActions {}

export function useDownloads(): UseDownloadsReturn {
  const [state, setState] = useState<UseDownloadsState>({
    downloads: [],
    queue: [],
    isLoading: true,
    storageQuota: { used: 0, quota: 0 },
    cacheStats: {
      entryCount: 0,
      totalSize: 0,
      oldestEntry: null,
      newestEntry: null,
    },
  });

  const refreshData = useCallback(async () => {
    try {
      const [downloads, queue, storageQuota, cacheStats] = await Promise.all([
        DownloadManager.getAllDownloadedChapters(),
        DownloadManager.getDownloadQueue(),
        AppSettings.getStorageQuota(),
        ImageCache.getCacheStats(),
      ]);

      setState(prev => ({
        ...prev,
        downloads,
        queue,
        storageQuota,
        cacheStats,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to refresh download data:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const downloadChapter = useCallback(async (chapterId: string, priority: number = 0) => {
    try {
      await DownloadManager.queueChapterDownload(chapterId, priority);
      await refreshData();
    } catch (error) {
      console.error('Failed to download chapter:', error);
      throw error;
    }
  }, [refreshData]);

  const pauseDownload = useCallback(async (chapterId: string) => {
    try {
      await DownloadManager.pauseDownload(chapterId);
      await refreshData();
    } catch (error) {
      console.error('Failed to pause download:', error);
      throw error;
    }
  }, [refreshData]);

  const resumeDownload = useCallback(async (chapterId: string) => {
    try {
      await DownloadManager.resumeDownload(chapterId);
      await refreshData();
    } catch (error) {
      console.error('Failed to resume download:', error);
      throw error;
    }
  }, [refreshData]);

  const cancelDownload = useCallback(async (chapterId: string) => {
    try {
      await DownloadManager.cancelDownload(chapterId);
      await refreshData();
    } catch (error) {
      console.error('Failed to cancel download:', error);
      throw error;
    }
  }, [refreshData]);

  const deleteChapter = useCallback(async (chapterId: string) => {
    try {
      await DownloadManager.deleteChapter(chapterId);
      await refreshData();
    } catch (error) {
      console.error('Failed to delete chapter:', error);
      throw error;
    }
  }, [refreshData]);

  const clearAllDownloads = useCallback(async () => {
    try {
      await DownloadManager.clearAllDownloads();
      await refreshData();
    } catch (error) {
      console.error('Failed to clear all downloads:', error);
      throw error;
    }
  }, [refreshData]);

  const getChapterStatus = useCallback((chapterId: string) => {
    return state.downloads.find(d => d.id === chapterId);
  }, [state.downloads]);

  // Set up event listeners
  useEffect(() => {
    const handleDownloadEvent: DownloadEventCallback = (event: DownloadEvent) => {
      // Update specific chapter status in real-time
      setState(prev => {
        const downloads = prev.downloads.map(chapter => {
          if (chapter.id === event.chapterId) {
            const updates: Partial<ChapterRecord> = {};
            
            if (event.progress !== undefined) {
              updates.progress = event.progress;
            }
            
            switch (event.type) {
              case 'started':
                updates.status = 'downloading';
                break;
              case 'completed':
                updates.status = 'downloaded';
                updates.progress = 1;
                break;
              case 'error':
                updates.status = 'error';
                break;
              case 'paused':
                updates.status = 'paused';
                break;
              case 'queued':
                updates.status = 'queued';
                break;
            }

            if (event.totalSize !== undefined) {
              updates.sizeBytes = event.totalSize;
            }

            return { ...chapter, ...updates };
          }
          return chapter;
        });

        return { ...prev, downloads };
      });

      // For completed downloads or major status changes, refresh all data
      if (event.type === 'completed' || event.type === 'error') {
        refreshData();
      }
    };

    const removeListener = DownloadManager.addEventListener(handleDownloadEvent);
    
    return removeListener;
  }, [refreshData]);

  // Initial data load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    ...state,
    downloadChapter,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteChapter,
    clearAllDownloads,
    refreshData,
    getChapterStatus,
  };
}

// Hook for individual chapter download status
export function useChapterDownload(chapterId: string) {
  const [status, setStatus] = useState<ChapterRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    try {
      const chapterStatus = await DownloadManager.getChapterStatus(chapterId);
      setStatus(chapterStatus);
    } catch (error) {
      console.error('Failed to get chapter status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [chapterId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const handleDownloadEvent: DownloadEventCallback = (event: DownloadEvent) => {
      if (event.chapterId === chapterId) {
        refreshStatus();
      }
    };

    const removeListener = DownloadManager.addEventListener(handleDownloadEvent);
    return removeListener;
  }, [chapterId, refreshStatus]);

  const downloadChapter = useCallback(async (priority: number = 0) => {
    try {
      await DownloadManager.queueChapterDownload(chapterId, priority);
    } catch (error) {
      console.error('Failed to download chapter:', error);
      throw error;
    }
  }, [chapterId]);

  const pauseDownload = useCallback(async () => {
    try {
      await DownloadManager.pauseDownload(chapterId);
    } catch (error) {
      console.error('Failed to pause download:', error);
      throw error;
    }
  }, [chapterId]);

  const resumeDownload = useCallback(async () => {
    try {
      await DownloadManager.resumeDownload(chapterId);
    } catch (error) {
      console.error('Failed to resume download:', error);
      throw error;
    }
  }, [chapterId]);

  const cancelDownload = useCallback(async () => {
    try {
      await DownloadManager.cancelDownload(chapterId);
    } catch (error) {
      console.error('Failed to cancel download:', error);
      throw error;
    }
  }, [chapterId]);

  const deleteChapter = useCallback(async () => {
    try {
      await DownloadManager.deleteChapter(chapterId);
    } catch (error) {
      console.error('Failed to delete chapter:', error);
      throw error;
    }
  }, [chapterId]);

  return {
    status,
    isLoading,
    downloadChapter,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteChapter,
    refreshStatus,
  };
}