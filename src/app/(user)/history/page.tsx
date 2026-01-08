import { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import History from "@/components/Pages/History";


export function generateMetadata(): Metadata {
  return {
    title: "Lịch sử đọc truyện - SuicaoDex",
    description: "Lịch sử đọc truyện",
    keywords: ["Lịch sử", "History", "SuicaoDex"],
  };
}
export default function Page() {
  return (
    <>
      <div>
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Lịch sử đọc</h1>
      </div>

      <Alert className="mt-4 rounded-sm bg-secondary">
        <Terminal size={18} />
        <AlertTitle>Có thể bạn cần biết:</AlertTitle>
        <AlertDescription>
          Lịch sử đọc được lưu trên chính thiết bị của bạn, nên nếu bạn xóa dữ
          liệu trình duyệt, lịch sử cũng sẽ bị xóa theo.
        </AlertDescription>
      </Alert>

      <div className="mt-4">
        <History />
      </div>
    </>
  );
}
