import { Metadata } from "next";
import { CircleHelp } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import LibraryStorageTabs from "./_components/library-storage-tabs";
import LocalCategoryTabs from "./_components/local-category-tabs";
import AccountLibraryList from "./_components/account-library-list";
import type { SearchParams } from "nuqs/server";
import { loadLibrarySearchParams } from "./searchParams";

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
            <Accordion
              type="single"
              collapsible
              className="bg-secondary rounded-md px-2"
            >
              <AccordionItem value="item-1" className="border-none">
                <AccordionTrigger className="py-2">
                  <div className="flex items-center gap-1.5">
                    <CircleHelp size={18} /> Có thể bạn cần biết:
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  Đây là thư viện được lưu trên chính thiết bị của bạn, nó
                  không đồng bộ với thư viện lưu trên tài khoản. Nếu bạn xóa
                  dữ liệu trình duyệt, thư viện này cũng sẽ bị xóa theo.
                  <br />
                  Ngoài ra, mỗi danh mục chỉ lưu tối đa 500 truyện, khi lưu
                  thêm sẽ tự động xóa truyện cũ nhất.
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <LocalCategoryTabs />
          </>
        }
        cloudContent={<AccountLibraryList />}
      />
    </>
  );
}
