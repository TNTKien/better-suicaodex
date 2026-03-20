import type { SearchParams } from "nuqs/server";
import { loadSearchParams } from "./searchParams";
import { Metadata } from "next";
import Latest from "./_components";

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  let { page } = await loadSearchParams(searchParams);
  if (page < 1 || isNaN(page)) page = 1;

  return {
    title: page === 1 ? "Mới cập nhật" : `Trang ${page} - Mới cập nhật`,
    description: "Manga mới cập nhật",
    keywords: ["Mới cập nhật", "Manga"],
  };
}

export default async function Page({ searchParams }: PageProps) {
  let { page } = await loadSearchParams(searchParams);
  if (page < 1 || isNaN(page)) page = 1;

  return (
    <>
      <div className="px-4 md:px-8 lg:px-12">
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">mới cập nhật</h1>
      </div>
      <div className="mt-4 px-4 md:px-8 lg:px-12">
        <Latest page={page} />
      </div>
    </>
  );
}
