import { openDB, IDBPDatabase } from 'idb';

export interface ChapterRecord {
  id: string;
  title: string;
  seriesId: string;
  pageUrls: string[];
  cachedRequests: string[];
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
  status: 'not-downloaded' | 'queued' | 'downloading' | 'paused' | 'downloaded' | 'error';
  progress: number;
  manga?: {
    id: string;
    title: string;
    cover?: string;
  };
  chapter?: string;
  vol?: string;
}

export interface DownloadQueueItem {
  id: string;
  chapterId: string;
  priority: number;
  retryCount: number;
  createdAt: number;
}

const DB_NAME = 'SuicaoDexOffline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;

export async function initDB(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Store for chapter metadata and download status
      if (!db.objectStoreNames.contains('chapters')) {
        const chaptersStore = db.createObjectStore('chapters', { keyPath: 'id' });
        chaptersStore.createIndex('seriesId', 'seriesId');
        chaptersStore.createIndex('status', 'status');
        chaptersStore.createIndex('createdAt', 'createdAt');
      }

      // Store for download queue
      if (!db.objectStoreNames.contains('downloadQueue')) {
        const queueStore = db.createObjectStore('downloadQueue', { keyPath: 'id' });
        queueStore.createIndex('chapterId', 'chapterId');
        queueStore.createIndex('priority', 'priority');
        queueStore.createIndex('createdAt', 'createdAt');
      }

      // Store for app settings
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

export class ChapterStorage {
  static async getChapter(id: string): Promise<ChapterRecord | undefined> {
    const db = await initDB();
    return db.get('chapters', id);
  }

  static async setChapter(chapter: ChapterRecord): Promise<void> {
    const db = await initDB();
    await db.put('chapters', chapter);
  }

  static async deleteChapter(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('chapters', id);
  }

  static async getAllChapters(): Promise<ChapterRecord[]> {
    const db = await initDB();
    return db.getAll('chapters');
  }

  static async getChaptersByStatus(status: ChapterRecord['status']): Promise<ChapterRecord[]> {
    const db = await initDB();
    return db.getAllFromIndex('chapters', 'status', status);
  }

  static async getChaptersBySeries(seriesId: string): Promise<ChapterRecord[]> {
    const db = await initDB();
    return db.getAllFromIndex('chapters', 'seriesId', seriesId);
  }

  static async updateChapterProgress(id: string, progress: number, status?: ChapterRecord['status']): Promise<void> {
    const db = await initDB();
    const chapter = await db.get('chapters', id);
    if (chapter) {
      chapter.progress = progress;
      chapter.updatedAt = Date.now();
      if (status) {
        chapter.status = status;
      }
      await db.put('chapters', chapter);
    }
  }

  static async getTotalStorageSize(): Promise<number> {
    const chapters = await this.getAllChapters();
    return chapters.reduce((total, chapter) => total + chapter.sizeBytes, 0);
  }
}

export class DownloadQueueStorage {
  static async addToQueue(item: DownloadQueueItem): Promise<void> {
    const db = await initDB();
    await db.put('downloadQueue', item);
  }

  static async removeFromQueue(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('downloadQueue', id);
  }

  static async getQueue(): Promise<DownloadQueueItem[]> {
    const db = await initDB();
    const items = await db.getAll('downloadQueue');
    return items.sort((a, b) => b.priority - a.priority);
  }

  static async clearQueue(): Promise<void> {
    const db = await initDB();
    await db.clear('downloadQueue');
  }
}

export class AppSettings {
  static async get(key: string): Promise<any> {
    const db = await initDB();
    const setting = await db.get('settings', key);
    return setting?.value;
  }

  static async set(key: string, value: any): Promise<void> {
    const db = await initDB();
    await db.put('settings', { key, value });
  }

  static async getStorageQuota(): Promise<{ used: number; quota: number; }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { used: 0, quota: 0 };
  }
}