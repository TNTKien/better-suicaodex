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
      <div className="px-4 md:px-8 lg:px-12">
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
                Ngoài ra, mỗi mục chỉ lưu tối đa 500 truyện, khi lưu thêm
                sẽ tự động xóa truyện cũ nhất.
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
                Nếu bạn thấy truyện nào tựa chỉ có ID, không có bìa, hãy thử bấm nút ↺ ở góc trái của truyện để đồng bộ lại dữ liệu nhé. <br/>
                Còn nếu ID là 1 chuỗi dài (uuid của MangaDex, vd: 56958579-6d1b-4db0-be4f-dd17b828fcf7), thì thôi bấm xóa đi cho nhanh 🐧
              </AlertDescription>
            </Alert>

            <AccountLibraryList />
          </>
        }
      />
    </>
  );
}
