import MeoPage from "./_components";
import { TotalCatAlert } from "./_components/total-cat-alert";
import { loadSearchParams } from "./searchParams";
import { Metadata } from "next";
import type { SearchParams } from "nuqs/server";

interface pageProps {
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({
  searchParams,
}: pageProps): Promise<Metadata> {
  const { page } = await loadSearchParams(searchParams);

  return {
    title:
      page === 1
        ? "Mồn lèo"
        : `Trang ${page} - Mồn lèo`,
    keywords: ["Mồn lèo", "Mèo", "Car", "SuicaoDex"],
  };
}

export default async function Page({ searchParams }: pageProps) {
  const { page, limit: rawLimit } = await loadSearchParams(searchParams);
  // Non-feed limit query param may not be >100
  const limit = rawLimit > 100 ? 100 : rawLimit;

  return (
    <div className="flex flex-col gap-4">
      <TotalCatAlert />
      <MeoPage page={page} limit={limit} />
    </div>
  );
}
