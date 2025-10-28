"use client"; // Error boundaries must be Client Components

import type { Metadata } from "next";
import { useEffect } from "react";
import ErrorPage from "@/components/error-page";

export const metadata: Metadata = {
	title: "Lỗi mất rồi 😭",
};

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log the error to an error reporting service
		console.error(error);
	}, [error]);

	return (
		<ErrorPage
			error={error}
			reset={reset}
			statusCode={500}
			title="Oops! Đã xảy ra lỗi"
			message="Đã có lỗi xảy ra khi hiển thị trang này. Hãy lấy cái lỗi bên dưới mà đấm vào mồm thằng dev!"
		/>
	);
}
