import { Suspense } from "react";
import type { Metadata } from "next";
import AdvancedSearchPage from "./_components/advanced-search";

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
        ? "Tìm kiếm nâng cao"
        : `Trang ${page} - Tìm kiếm nâng cao`,
    description: "Công cụ tìm kiếm nâng cao",
  };
}

export default function Page() {
  return (
    <Suspense>
      <AdvancedSearchPage />
    </Suspense>
  );
}
