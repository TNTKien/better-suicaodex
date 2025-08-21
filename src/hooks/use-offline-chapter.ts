"use client";

import { Chapter } from "@/types/types";
import { useEffect, useState } from "react";

// Định nghĩa kiểu dữ liệu cho chapter offline
interface OfflineChapter {
  id: string;
  data: Chapter;
  images: string[];
  savedAt: number;
}

// Tên database và object store
const DB_NAME = "suicaodex_offline";
const CHAPTER_STORE = "chapters";
const IMAGE_STORE = "images";

// Hook để sử dụng chức năng offline
export function useOfflineChapter() {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Khởi tạo IndexedDB
  useEffect(() => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
      setError(new Error("Không thể mở IndexedDB"));
      setIsLoading(false);
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      setDb(db);
      setIsLoading(false);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Tạo object store cho chapters
      if (!db.objectStoreNames.contains(CHAPTER_STORE)) {
        const chapterStore = db.createObjectStore(CHAPTER_STORE, { keyPath: "id" });
        chapterStore.createIndex("savedAt", "savedAt", { unique: false });
      }
      
      // Tạo object store cho images
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        const imageStore = db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
      }
    };

    return () => {
      if (db) db.close();
    };
  }, [db]);

  // Lưu chapter vào IndexedDB
  const saveChapter = async (chapterData: Chapter, images: string[]): Promise<boolean> => {
    if (!db) return false;
    
    try {
      // Tạo mảng các promises để tải ảnh
      const imagePromises = images.map(async (imageUrl, index) => {
        try {
          // Tạo một XMLHttpRequest để tải ảnh (tránh CORS)
          const blob = await new Promise<Blob>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', imageUrl, true);
            xhr.responseType = 'blob';
            
            xhr.onload = function() {
              if (this.status === 200) {
                resolve(this.response);
              } else {
                reject(new Error(`Failed to load image: ${this.statusText}`));
              }
            };
            
            xhr.onerror = function() {
              console.error(`Network error for ${imageUrl}`);
              // Trả về blob rỗng nếu có lỗi
              resolve(new Blob([''], { type: 'image/png' }));
            };
            
            xhr.send();
          });
          
          return { index, blob };
        } catch (error) {
          console.error(`Error fetching image ${imageUrl}:`, error);
          return { index, blob: new Blob([''], { type: 'image/png' }) };
        }
      });
      
      // Đợi tất cả các ảnh được tải xong
      const imageResults = await Promise.all(imagePromises);
      
      // Sắp xếp lại kết quả theo thứ tự ban đầu
      const imageBlobs = imageResults
        .sort((a, b) => a.index - b.index)
        .map(result => result.blob);
      
      // Lưu chapter data
      const offlineChapter: OfflineChapter = {
        id: chapterData.id,
        data: chapterData,
        images: images,
        savedAt: Date.now(),
      };
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHAPTER_STORE, IMAGE_STORE], "readwrite");
        
        transaction.onerror = (event) => {
          console.error("Transaction error:", event);
          reject(new Error("Lỗi khi lưu chapter"));
        };
        
        // Lưu thông tin chapter
        const chapterStore = transaction.objectStore(CHAPTER_STORE);
        chapterStore.put(offlineChapter);
        
        // Lưu từng hình ảnh
        const imageStore = transaction.objectStore(IMAGE_STORE);
        images.forEach((url, index) => {
          const imageId = `${chapterData.id}_${index}`;
          imageStore.put({
            id: imageId,
            blob: imageBlobs[index],
            url: url
          });
        });
        
        transaction.oncomplete = () => {
          resolve(true);
        };
      });
    } catch (error) {
      console.error("Error saving chapter:", error);
      return false;
    }
  };

  // Kiểm tra chapter có tồn tại offline không
  const isChapterOffline = async (chapterId: string): Promise<boolean> => {
    if (!db) return false;
    
    return new Promise((resolve) => {
      const transaction = db.transaction(CHAPTER_STORE, "readonly");
      const store = transaction.objectStore(CHAPTER_STORE);
      const request = store.get(chapterId);
      
      request.onsuccess = () => {
        resolve(!!request.result);
      };
      
      request.onerror = () => {
        resolve(false);
      };
    });
  };

  // Lấy chapter từ IndexedDB
  const getOfflineChapter = async (chapterId: string): Promise<{ chapter: Chapter, images: string[] } | null> => {
    if (!db) return null;
    
    try {
      // Lấy thông tin chapter
      const chapterData: OfflineChapter = await new Promise((resolve, reject) => {
        const transaction = db.transaction(CHAPTER_STORE, "readonly");
        const store = transaction.objectStore(CHAPTER_STORE);
        const request = store.get(chapterId);
        
        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result);
          } else {
            reject(new Error("Chapter không tồn tại offline"));
          }
        };
        
        request.onerror = () => {
          reject(new Error("Lỗi khi lấy chapter"));
        };
      });
      
      // Lấy các blob hình ảnh và chuyển thành URL
      const imageUrls = await Promise.all(
        chapterData.images.map(async (_, index) => {
          const imageId = `${chapterId}_${index}`;
          return new Promise<string>((resolve, reject) => {
            const transaction = db.transaction(IMAGE_STORE, "readonly");
            const store = transaction.objectStore(IMAGE_STORE);
            const request = store.get(imageId);
            
            request.onsuccess = () => {
              if (request.result) {
                const url = URL.createObjectURL(request.result.blob);
                resolve(url);
              } else {
                reject(new Error(`Không tìm thấy ảnh ${imageId}`));
              }
            };
            
            request.onerror = () => {
              reject(new Error(`Lỗi khi lấy ảnh ${imageId}`));
            };
          });
        })
      );
      
      return {
        chapter: chapterData.data,
        images: imageUrls
      };
    } catch (error) {
      console.error("Error getting offline chapter:", error);
      return null;
    }
  };

  // Xóa chapter khỏi IndexedDB
  const deleteOfflineChapter = async (chapterId: string): Promise<boolean> => {
    if (!db) return false;
    
    try {
      // Lấy thông tin chapter để biết số lượng ảnh
      const chapterData: OfflineChapter = await new Promise((resolve, reject) => {
        const transaction = db.transaction(CHAPTER_STORE, "readonly");
        const store = transaction.objectStore(CHAPTER_STORE);
        const request = store.get(chapterId);
        
        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result);
          } else {
            reject(new Error("Chapter không tồn tại offline"));
          }
        };
        
        request.onerror = () => {
          reject(new Error("Lỗi khi lấy chapter"));
        };
      });
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHAPTER_STORE, IMAGE_STORE], "readwrite");
        
        // Xóa chapter
        const chapterStore = transaction.objectStore(CHAPTER_STORE);
        chapterStore.delete(chapterId);
        
        // Xóa tất cả ảnh của chapter
        const imageStore = transaction.objectStore(IMAGE_STORE);
        for (let i = 0; i < chapterData.images.length; i++) {
          const imageId = `${chapterId}_${i}`;
          imageStore.delete(imageId);
        }
        
        transaction.oncomplete = () => {
          resolve(true);
        };
        
        transaction.onerror = () => {
          reject(new Error("Lỗi khi xóa chapter"));
        };
      });
    } catch (error) {
      console.error("Error deleting offline chapter:", error);
      return false;
    }
  };

  // Lấy danh sách tất cả chapter offline
  const getAllOfflineChapters = async (): Promise<OfflineChapter[]> => {
    if (!db) return [];
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CHAPTER_STORE, "readonly");
      const store = transaction.objectStore(CHAPTER_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new Error("Lỗi khi lấy danh sách chapter"));
      };
    });
  };

  return {
    isLoading,
    error,
    saveChapter,
    isChapterOffline,
    getOfflineChapter,
    deleteOfflineChapter,
    getAllOfflineChapters,
  };
}
