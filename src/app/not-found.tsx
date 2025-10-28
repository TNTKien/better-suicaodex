import type { Metadata } from "next";
import ErrorPage from "@/components/error-page";

export const metadata: Metadata = {
	title: "Không tìm thấy trang",
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
