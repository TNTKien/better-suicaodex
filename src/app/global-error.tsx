"use client";

import * as Sentry from "@sentry/nextjs";
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
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="vi">
      <body>
        <ErrorPage
          error={error}
          reset={reset}
          statusCode={500}
          title="Oops! Đã xảy ra lỗi nghiêm trọng"
          message="Bugsink đã ghi nhận lỗi này. Hãy thử tải lại trang hoặc quay lại sau."
        />
      </body>
    </html>
  );
}
