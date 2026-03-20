import { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import HistoryList from "./_components/history-list";

export function generateMetadata(): Metadata {
  return {
    title: "Lịch sử đọc truyện",
    description: "Lịch sử đọc truyện",
    keywords: ["Lịch sử", "History", "SuicaoDex"],
  };
}
export default function Page() {
  return (
    <>
      <div className="px-4 md:px-8 lg:px-12">
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Lịch sử đọc</h1>
      </div>

      <div className="mt-4 px-4 md:px-8 lg:px-12 space-y-4">
        <Alert className="rounded-sm">
          <Terminal size={18} />
          <AlertTitle>Có thể bạn cần biết:</AlertTitle>
          <AlertDescription>
            - Lịch sử đọc được lưu trên chính thiết bị của bạn, nên nếu bạn xóa
            dữ liệu trình duyệt, lịch sử cũng sẽ bị xóa theo.
            <br />- Nếu bị mất lịch sử đọc từ 02/03/2026 - 04/03/2026, hãy thử
            nhấn nút [Đồng bộ] bên dưới để khôi phục.
          </AlertDescription>
        </Alert>

        <HistoryList />
      </div>
    </>
  );
}
