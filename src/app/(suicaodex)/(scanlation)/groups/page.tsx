import { Metadata } from "next";
import { Suspense } from "react";
import GroupsSearch from "./_components";

export function generateMetadata(): Metadata {
  return {
    title: "Nhóm dịch",
    description: "Danh sách nhóm dịch trên WeebDex",
    keywords: ["Nhóm dịch", "Scanlation", "WeebDex"],
  };
}

export default function Page() {
  return (
    <>
      <div className="px-4 md:px-8 lg:px-12">
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Nhóm dịch</h1>
      </div>

      <div className="mt-4 px-4 md:px-8 lg:px-12">
        <Suspense>
          <GroupsSearch />
        </Suspense>
      </div>
    </>
  );
}
