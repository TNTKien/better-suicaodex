import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

export default function useLocalStorage<T>(
	key: string,
	defaultValue: T,
): [T, Dispatch<SetStateAction<T>>] {
	const [value, setValue] = useState<T>(() => {
		// Kiểm tra nếu đang chạy trên client
		if (typeof window !== "undefined") {
			const item = window.localStorage.getItem(key);
			return item ? JSON.parse(item) : defaultValue;
		}
		return defaultValue; // Giá trị mặc định khi SSR
	});

	useEffect(() => {
		if (typeof window !== "undefined") {
			try {
				const item = window.localStorage.getItem(key);
				if (item) {
					setValue(JSON.parse(item));
				}
			} catch (e) {
				console.error(e);
			}
		}
	}, [key]);

	useEffect(() => {
		if (typeof window !== "undefined") {
			try {
				window.localStorage.setItem(key, JSON.stringify(value));
			} catch (e) {
				console.error(e);
			}
		}
	}, [key, value]);

	return [value, setValue];
}
