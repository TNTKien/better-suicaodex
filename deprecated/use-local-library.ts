import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

type LocalLibrary = {
  following: string[];
  plan: string[];
  reading: string[];
  completed: string[];
};

// Library categories
type LocalLibraryCategory = keyof LocalLibrary;

// Số lượng phần tử tối đa cho mỗi mảng
const MAX_ITEMS = 500;

// Hàm giới hạn số lượng phần tử của mảng
const limitArraySize = <T>(array: T[]): T[] => {
  if (array.length > MAX_ITEMS) {
    return array.slice(-MAX_ITEMS); // bỏ id cũ nhất
  }
  return array;
};

// Hàm kiểm tra và đảm bảo ID chỉ xuất hiện trong một danh mục
const ensureLocalUniqueCategory = (localLibrary: LocalLibrary, id: string, targetCategory: LocalLibraryCategory): LocalLibrary => {
  // Tạo bản sao để tránh thay đổi trực tiếp
  const newLocalLibrary = { ...localLibrary };
  
  // Xóa ID khỏi tất cả các danh mục
  (Object.keys(newLocalLibrary) as LocalLibraryCategory[]).forEach(category => {
    newLocalLibrary[category] = newLocalLibrary[category].filter(mangaId => mangaId !== id);
  });
  
  // Thêm ID vào danh mục mục tiêu nếu chưa có
  if (!newLocalLibrary[targetCategory].includes(id)) {
    newLocalLibrary[targetCategory] = [...newLocalLibrary[targetCategory], id];
  }
  
  return newLocalLibrary;
};

const localLibraryAtom = atomWithStorage<LocalLibrary>(
  "local-library",
  {
    following: [],
    plan: [],
    reading: [],
    completed: [],
  },
  {
    getItem: (key, initialValue) => {
      const storedValue = localStorage.getItem(key);
      if (!storedValue) return initialValue;

      try {
        const parsedValue = JSON.parse(storedValue) as LocalLibrary;
        // Giới hạn kích thước của mỗi mảng khi lấy từ storage
        return {
          following: limitArraySize(parsedValue.following || []),
          plan: limitArraySize(parsedValue.plan || []),
          reading: limitArraySize(parsedValue.reading || []),
          completed: limitArraySize(parsedValue.completed || []),
        };
      } catch {
        return initialValue;
      }
    },
    setItem: (key, value) => {
      // Giới hạn kích thước của mỗi mảng trước khi lưu vào storage
      const limitedValue = {
        following: limitArraySize(value.following),
        plan: limitArraySize(value.plan),
        reading: limitArraySize(value.reading),
        completed: limitArraySize(value.completed),
      };

      localStorage.setItem(key, JSON.stringify(limitedValue));
    },
    removeItem: (key) => localStorage.removeItem(key),
  }
);

export function useLocalLibrary() {
  const [localLibrary, setLocalLibrary] = useAtom(localLibraryAtom);

  // Thêm ID vào một danh mục (đảm bảo ID chỉ xuất hiện trong một danh mục)
  const addToLocalCategory = (id: string, category: LocalLibraryCategory) => {
    setLocalLibrary(current => ensureLocalUniqueCategory(current, id, category));
  };

  // Xóa ID khỏi tất cả các danh mục
  const removeFromLocalLibrary = (id: string) => {
    setLocalLibrary(current => {
      const newLocalLibrary = { ...current };
      Object.keys(newLocalLibrary).forEach(category => {
        newLocalLibrary[category as LocalLibraryCategory] = newLocalLibrary[category as LocalLibraryCategory].filter(
          mangaId => mangaId !== id
        );
      });
      return newLocalLibrary;
    });
  };

  // Kiểm tra ID có trong danh mục nào không
  const getLocalCategoryOfId = (id: string): LocalLibraryCategory | null => {
    for (const category of Object.keys(localLibrary) as LocalLibraryCategory[]) {
      if (localLibrary[category].includes(id)) {
        return category;
      }
    }
    return null;
  };

  return {
    localLibrary,
    addToLocalCategory,
    removeFromLocalLibrary,
    getLocalCategoryOfId,
    rawSetLocalLibrary: setLocalLibrary
  };
}
