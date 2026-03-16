import { Suspense } from "react";
import type { Metadata } from "next";

import WeebdexAdvancedSearch from "./_components/advanced-search";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  return {
    title:
      page === 1
        ? "Tìm kiếm nâng cao cũ (Deprecated) - WeebDex"
        : `Trang ${page} - Tìm kiếm nâng cao cũ (Deprecated) - WeebDex`,
    description: "Phiên bản tìm kiếm nâng cao cũ đã được deprecate.",
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function Page() {
  return (
    <Suspense>
      <WeebdexAdvancedSearch />
    </Suspense>
  );
}
