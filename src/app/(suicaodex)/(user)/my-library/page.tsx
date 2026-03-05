import { Metadata } from "next";
import { CircleHelp } from "lucide-react";
import LibraryStorageTabs from "./_components/library-storage-tabs";
import LocalCategoryTabs from "./_components/local-category-tabs";
import AccountLibraryList from "./_components/account-library-list";
import type { SearchParams } from "nuqs/server";
import { loadLibrarySearchParams } from "./searchParams";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function generateMetadata(): Metadata {
  return {
    title: "Thư viện",
  };
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function Page({ searchParams }: PageProps) {
  await loadLibrarySearchParams(searchParams); // warm-up for nuqs SSR

  return (
    <>
      <div>
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Thư viện</h1>
      </div>

      <LibraryStorageTabs
        localContent={
          <>
            <Alert>
              <CircleHelp strokeWidth={3} />
              <AlertTitle className="font-semibold">
                Có thể bạn cần biết:
              </AlertTitle>
              <AlertDescription>
                Đây là thư viện được lưu trên chính thiết bị của bạn, nó không
                đồng bộ với thư viện lưu trên tài khoản. Nếu bạn xóa dữ liệu
                trình duyệt, thư viện này cũng sẽ bị xóa theo.
                <br />
                Ngoài ra, mỗi mục chỉ lưu tối đa 500 truyện, khi lưu thêm sẽ tự
                động xóa truyện cũ nhất.
              </AlertDescription>
            </Alert>

            <LocalCategoryTabs />
          </>
        }
        cloudContent={
          <>
            <Alert>
              <CircleHelp strokeWidth={3} />
              <AlertTitle className="font-semibold">
                Có thể bạn cần biết:
              </AlertTitle>
              <AlertDescription className="text-pretty">
                Nếu bạn thấy truyện nào chỉ hiện ID và không có bìa, khả năng
                cao đó là dữ liệu cũ trước khi đồng bộ metadata. Bạn có thể xóa
                rồi thêm lại truyện để làm mới dữ liệu.
              </AlertDescription>
            </Alert>

            <AccountLibraryList />
          </>
        }
      />
    </>
  );
}
