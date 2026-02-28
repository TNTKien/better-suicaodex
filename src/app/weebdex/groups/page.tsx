import { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { loadSearchParams } from "./searchParams";
import GroupsSearch from "./_components";

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export function generateMetadata(): Metadata {
  return {
    title: "Nhóm dịch",
    description: "Danh sách nhóm dịch trên WeebDex",
    keywords: ["Nhóm dịch", "Scanlation", "WeebDex"],
  };
}

export default async function Page({ searchParams }: PageProps) {
  let { page, q } = await loadSearchParams(searchParams);
  if (page < 1 || isNaN(page)) page = 1;

  return (
    <>
      <div>
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Nhóm dịch</h1>
      </div>

      <div className="mt-4">
        <GroupsSearch page={page} q={q} />
      </div>
    </>
  );
}
