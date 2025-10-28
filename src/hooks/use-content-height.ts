import { useCallback, useEffect, useRef, useState } from "react";

interface UseContentHeightOptions {
	/**
	 * Initial delay to measure content height after component mount (in ms)
	 * @default 100
	 */
	initialDelay?: number;
	/**
	 * Whether the content is expanded or not
	 * @default false
	 */
	expanded?: boolean;
	/**
	 * Dependencies array to trigger height recalculation
	 * @default []
	 */
	dependencies?: any[];
}

/**
 * Hook to measure and update content height on window resize
 * @param options Configuration options
 * @returns Object containing ref, fullHeight, and updateFullHeight function
 */
export function useContentHeight(options: UseContentHeightOptions = {}) {
	const { initialDelay = 100, expanded = false, dependencies = [] } = options;

	const [fullHeight, setFullHeight] = useState(0);
	const contentRef = useRef<HTMLDivElement>(null);

	const updateFullHeight = useCallback(() => {
		if (contentRef.current) {
			setFullHeight(contentRef.current.scrollHeight || 0);
		}
	}, []);

	useEffect(() => {
		// Use ResizeObserver to detect content size changes
		const observer = new ResizeObserver(() => {
			updateFullHeight();
		});

		if (contentRef.current) {
			observer.observe(contentRef.current);
		}

		// Handle window resize events
		const handleResize = () => {
			updateFullHeight();
		};

		window.addEventListener("resize", handleResize);

		// Initial measurement with a small delay
		const timer = setTimeout(updateFullHeight, initialDelay);

		return () => {
			observer.disconnect();
			window.removeEventListener("resize", handleResize);
			clearTimeout(timer);
		};
	}, [initialDelay, expanded, updateFullHeight, ...dependencies]);

	return {
		contentRef,
		fullHeight,
		updateFullHeight,
	};
}

export default useContentHeight;
