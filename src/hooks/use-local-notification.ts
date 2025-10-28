import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

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

const localNotificationAtom = atomWithStorage<LocalNotification>(
	"local-notification",
	{
		ids: [],
		shown: [],
		unread: [],
	},
	{
		getItem: (key, initialValue) => {
			const storedValue = localStorage.getItem(key);
			if (!storedValue) return initialValue;

			try {
				const parsedValue = JSON.parse(storedValue) as LocalNotification;
				// Giới hạn kích thước của mảng khi lấy từ storage
				return {
					ids: limitArraySize(parsedValue.ids || []),
					shown: limitArraySize(parsedValue.shown || [], MAX_SHOWN_ITEMS),
					unread: limitArraySize(parsedValue.unread || []),
				};
			} catch {
				return initialValue;
			}
		},
		setItem: (key, value) => {
			// Giới hạn kích thước của mảng trước khi lưu vào storage
			const limitedValue = {
				ids: limitArraySize(value.ids),
				shown: limitArraySize(value.shown, MAX_SHOWN_ITEMS),
				unread: limitArraySize(value.unread),
			};

			localStorage.setItem(key, JSON.stringify(limitedValue));
		},
		removeItem: (key) => localStorage.removeItem(key),
	},
);

export function useLocalNotification() {
	const [localNotification, setLocalNotification] = useAtom(
		localNotificationAtom,
	);

	// Thêm ID vào danh sách thông báo
	const addToLocalNotification = (id: string) => {
		setLocalNotification((current) => {
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
		setLocalNotification((current) => ({
			...current,
			ids: current.ids.filter((notificationId) => notificationId !== id),
			// Giữ nguyên unread list vì ID trong unread list là chapter ID, không phải manga ID
		}));
	};

	// Đánh dấu ID là đã xem
	const markAsShown = (id: string) => {
		setLocalNotification((current) => {
			if (current.shown.includes(id)) return current;
			return {
				...current,
				shown: [...current.shown, id],
			};
		});
	};

	// Đánh dấu ID là đã đọc (bỏ khỏi unread)
	const markAsRead = (id: string) => {
		setLocalNotification((current) => ({
			...current,
			unread: current.unread.filter((notificationId) => notificationId !== id),
		}));
	};

	// Đánh dấu ID là chưa đọc (thêm vào unread)
	const markAsUnread = (id: string) => {
		setLocalNotification((current) => {
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
		setLocalNotification({ ids: [], shown: [], unread: [] });
	};

	// Xóa tất cả trạng thái đã xem
	const clearAllShownStatus = () => {
		setLocalNotification((current) => ({
			...current,
			shown: [],
		}));
	};

	// Đánh dấu tất cả thông báo là đã đọc
	const markAllAsRead = () => {
		setLocalNotification((current) => ({
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
		rawSetLocalNotification: setLocalNotification,
	};
}
