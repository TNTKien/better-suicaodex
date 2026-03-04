import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createMigratingStorage } from "@/lib/zustand-migrate-storage";

type LocalNotification = {
  ids: string[];
  shown: string[];
  unread: string[];
};

const MAX_ITEMS = 500;
const MAX_SHOWN_ITEMS = 100;

const limitArraySize = <T>(array: T[], maxSize: number = MAX_ITEMS): T[] => {
  if (array.length > maxSize) {
    return array.slice(-maxSize); // bỏ id cũ nhất
  }
  return array;
};

const useLocalNotificationStore = create<LocalNotification>()(
  persist(
    (): LocalNotification => ({ ids: [], shown: [], unread: [] }),
    {
      name: "local-notification",
      storage: createMigratingStorage<LocalNotification>(),
      // Giới hạn kích thước mảng sau mỗi lần persist
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        useLocalNotificationStore.setState({
          ids: limitArraySize(state.ids || []),
          shown: limitArraySize(state.shown || [], MAX_SHOWN_ITEMS),
          unread: limitArraySize(state.unread || []),
        });
      },
    },
  ),
);

const setState = useLocalNotificationStore.setState;

export function useLocalNotification() {
  const localNotification = useLocalNotificationStore();

  // Thêm ID vào danh sách thông báo
  const addToLocalNotification = (id: string) => {
    setState(current => {
      if (current.ids.includes(id)) return current;
      return {
        ...current,
        ids: [...current.ids, id],
        // Không thêm manga ID vào unread list nữa
      };
    });
  };

  // Xóa ID khỏi danh sách thông báo
  const removeFromLocalNotification = (id: string) => {
    setState(current => ({
      ...current,
      ids: current.ids.filter(notificationId => notificationId !== id),
      // Giữ nguyên unread list vì ID trong unread list là chapter ID, không phải manga ID
    }));
  };

  // Đánh dấu ID là đã xem
  const markAsShown = (id: string) => {
    setState(current => {
      if (current.shown.includes(id)) return current;
      return {
        ...current,
        shown: [...current.shown, id],
      };
    });
  };

  // Đánh dấu ID là đã đọc (bỏ khỏi unread)
  const markAsRead = (id: string) => {
    setState(current => ({
      ...current,
      unread: current.unread.filter(notificationId => notificationId !== id),
    }));
  };

  // Đánh dấu ID là chưa đọc (thêm vào unread)
  const markAsUnread = (id: string) => {
    setState(current => {
      if (current.unread.includes(id)) return current;
      return {
        ...current,
        unread: [...current.unread, id],
      };
    });
  };

  // Kiểm tra ID đã được xem chưa
  const isShown = (id: string): boolean => {
    return localNotification.shown.includes(id);
  };

  // Kiểm tra ID có trong danh sách thông báo không
  const isInLocalNotification = (id: string): boolean => {
    return localNotification.ids.includes(id);
  };

  // Kiểm tra ID có chưa đọc không
  const isUnread = (id: string): boolean => {
    return localNotification.unread.includes(id);
  };

  // Xóa tất cả thông báo
  const clearAllLocalNotifications = () => {
    setState({ ids: [], shown: [], unread: [] });
  };

  // Xóa tất cả trạng thái đã xem
  const clearAllShownStatus = () => {
    setState(current => ({
      ...current,
      shown: [],
    }));
  };

  // Đánh dấu tất cả thông báo là đã đọc
  const markAllAsRead = () => {
    setState(current => ({
      ...current,
      unread: [],
    }));
  };

  return {
    localNotification,
    addToLocalNotification,
    removeFromLocalNotification,
    markAsShown,
    markAsRead,
    markAsUnread,
    isShown,
    isUnread,
    isInLocalNotification,
    clearAllLocalNotifications,
    clearAllShownStatus,
    markAllAsRead,
    rawSetLocalNotification: setState
  };
}
