import ErrorPage from "@/components/error-page";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 Not Found - SuicaoDex",
};

export default function NotFound() {
  return (
    <ErrorPage 
      statusCode={404}
      title="Không tìm thấy trang"
      message="Có vẻ như trang bạn đang tìm kiếm đã bị di chuyển, xóa hoặc không tồn tại. Hãy thử quay lại trang chủ hoặc tìm kiếm nội dung khác."
    />
  );
}
