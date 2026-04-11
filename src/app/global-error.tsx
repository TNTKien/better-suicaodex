"use client";

import { useEffect } from "react";
import ErrorPage from "@/components/error-page";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="vi">
      <body>
        <ErrorPage
          error={error}
          reset={reset}
          statusCode={500}
          title="Oops! Đã xảy ra lỗi nghiêm trọng"
          message="Lỗi này đã được ghi nhận. Hãy thử tải lại trang hoặc quay lại sau."
        />
      </body>
    </html>
  );
}
