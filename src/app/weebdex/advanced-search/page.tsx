import WeebdexAdvancedSearch from "./_components/advanced-search";
import { Metadata } from "next";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const p = await searchParams;
  const page = Math.max(1, parseInt(p["page"] ?? "1") || 1);
  return {
    title:
      page === 1
        ? "Tìm kiếm nâng cao - WeebDex"
        : `Trang ${page} - Tìm kiếm nâng cao - WeebDex`,
    description: "Công cụ tìm kiếm nâng cao WeebDex",
  };
}

export default function Page() {
  return <WeebdexAdvancedSearch />;
}
