import type { SearchParams } from "nuqs/server";
import type { Metadata } from "next";

import MoeLatestUpdate from "../_components/moe_latest-update";
import { loadSearchParams } from "./searchParams";

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  let { page } = await loadSearchParams(searchParams);

  if (page < 1 || Number.isNaN(page)) {
    page = 1;
  }

  return {
    title: page === 1 ? "Mới cập nhật" : `Trang ${page} - Mới cập nhật`,
    description: "Truyện MoeTruyen mới cập nhật",
    keywords: ["Mới cập nhật", "MoeTruyen"],
  };
}

export default async function Page({ searchParams }: PageProps) {
  let { page } = await loadSearchParams(searchParams);

  if (page < 1 || Number.isNaN(page)) {
    page = 1;
  }

  return (
    <>
      <div className="px-4 md:px-8 lg:px-12">
        <hr className="h-1 w-9 border-none bg-primary" />
        <h1 className="text-2xl font-black uppercase">mới cập nhật</h1>
      </div>

      <div className="px-4 md:px-8 lg:px-12">
        <MoeLatestUpdate
          page={page}
          showHeader={false}
          showExternalLink={false}
          showPagination
        />
      </div>
    </>
  );
}
