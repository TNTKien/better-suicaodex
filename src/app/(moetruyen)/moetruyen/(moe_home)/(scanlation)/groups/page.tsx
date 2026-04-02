import type { Metadata } from "next";
import { Suspense } from "react";

import MoeGroupsSearch from "./_components";

export function generateMetadata(): Metadata {
  return {
    title: "Nhóm dịch",
    description: "Danh sách nhóm dịch trên MoeTruyen",
    keywords: ["Nhóm dịch", "MoeTruyen"],
  };
}

export default function Page() {
  return (
    <>
      <div className="px-4 md:px-8 lg:px-12">
        <hr className="h-1 w-9 border-none bg-primary" />
        <h1 className="text-2xl font-black uppercase">Nhóm dịch</h1>
      </div>

      <div className="mt-4 px-4 md:px-8 lg:px-12">
        <Suspense>
          <MoeGroupsSearch />
        </Suspense>
      </div>
    </>
  );
}
