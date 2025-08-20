const CACHE_NAME = 'chapters-images';
const MAX_CACHE_SIZE = 1000; // Maximum number of images to cache
const MAX_CACHE_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export class ImageCache {
  private static cache: Cache | null = null;

  static async getCache(): Promise<Cache> {
    if (!this.cache) {
      this.cache = await caches.open(CACHE_NAME);
    }
    return this.cache;
  }

  /**
   * Generate a stable cache key for an image URL
   */
  static generateCacheKey(url: string, chapterId: string): string {
    // Extract filename from URL for readability
    const urlObj = new URL(url);
    const filename = urlObj.pathname.split('/').pop() || 'image';
    return `chapter-${chapterId}-${filename}`;
  }

  /**
   * Store an image in the cache
   */
  static async storeImage(url: string, chapterId: string): Promise<string> {
    try {
      const cache = await this.getCache();
      const cacheKey = this.generateCacheKey(url, chapterId);
      
      // Check if already cached
      const existing = await cache.match(cacheKey);
      if (existing) {
        return cacheKey;
      }

      // Fetch and cache the image
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      // Add timestamp header for cache management
      const clonedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'x-cached-at': Date.now().toString(),
          'x-original-url': url,
        },
      });

      await cache.put(cacheKey, clonedResponse);
      
      // Clean up old entries if needed
      await this.cleanupOldEntries();
      
      return cacheKey;
    } catch (error) {
      console.error('Failed to store image:', error);
      throw error;
    }
  }

  /**
   * Retrieve an image from the cache
   */
  static async getImage(cacheKey: string): Promise<Response | null> {
    try {
      const cache = await this.getCache();
      const response = await cache.match(cacheKey);
      
      if (response) {
        // Check if the cached item is still valid
        const cachedAt = response.headers.get('x-cached-at');
        if (cachedAt) {
          const age = Date.now() - parseInt(cachedAt);
          if (age > MAX_CACHE_AGE) {
            // Remove expired entry
            await cache.delete(cacheKey);
            return null;
          }
        }
      }
      
      return response;
    } catch (error) {
      console.error('Failed to get cached image:', error);
      return null;
    }
  }

  /**
   * Get an image either from cache or fetch from network
   */
  static async getImageUrl(url: string, chapterId: string): Promise<string> {
    const cacheKey = this.generateCacheKey(url, chapterId);
    const cached = await this.getImage(cacheKey);
    
    if (cached) {
      return URL.createObjectURL(await cached.blob());
    }
    
    // Fallback to original URL if not cached
    return url;
  }

  /**
   * Remove all images for a specific chapter
   */
  static async removeChapterImages(cacheKeys: string[]): Promise<void> {
    try {
      const cache = await this.getCache();
      await Promise.all(cacheKeys.map(key => cache.delete(key)));
    } catch (error) {
      console.error('Failed to remove chapter images:', error);
    }
  }

  /**
   * Get the size of cached images for a chapter
   */
  static async getChapterCacheSize(cacheKeys: string[]): Promise<number> {
    try {
      const cache = await this.getCache();
      let totalSize = 0;

      for (const key of cacheKeys) {
        const response = await cache.match(key);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to calculate cache size:', error);
      return 0;
    }
  }

  /**
   * Clean up old cache entries based on age and count
   */
  static async cleanupOldEntries(): Promise<void> {
    try {
      const cache = await this.getCache();
      const keys = await cache.keys();
      
      // Remove entries older than MAX_CACHE_AGE
      const now = Date.now();
      const entriesToCheck = [];

      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const cachedAt = response.headers.get('x-cached-at');
          if (cachedAt) {
            const age = now - parseInt(cachedAt);
            if (age > MAX_CACHE_AGE) {
              await cache.delete(request);
            } else {
              entriesToCheck.push({ request, cachedAt: parseInt(cachedAt) });
            }
          }
        }
      }

      // If still over the limit, remove oldest entries
      if (entriesToCheck.length > MAX_CACHE_SIZE) {
        entriesToCheck.sort((a, b) => a.cachedAt - b.cachedAt);
        const toRemove = entriesToCheck.slice(0, entriesToCheck.length - MAX_CACHE_SIZE);
        
        for (const entry of toRemove) {
          await cache.delete(entry.request);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    entryCount: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    try {
      const cache = await this.getCache();
      const keys = await cache.keys();
      
      let totalSize = 0;
      let oldestEntry: number | null = null;
      let newestEntry: number | null = null;

      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
          
          const cachedAt = response.headers.get('x-cached-at');
          if (cachedAt) {
            const timestamp = parseInt(cachedAt);
            if (oldestEntry === null || timestamp < oldestEntry) {
              oldestEntry = timestamp;
            }
            if (newestEntry === null || timestamp > newestEntry) {
              newestEntry = timestamp;
            }
          }
        }
      }

      return {
        entryCount: keys.length,
        totalSize,
        oldestEntry,
        newestEntry,
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        entryCount: 0,
        totalSize: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  /**
   * Clear all cached images
   */
  static async clearAll(): Promise<void> {
    try {
      await caches.delete(CACHE_NAME);
      this.cache = null;
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
}