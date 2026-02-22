import MeoPage from "@/components/Pages/Meo";
import { TotalCatAlert } from "@/components/Pages/Meo/total-cat-alert";
import { Metadata } from "next";

interface pageProps {
  searchParams: Promise<{
    [key: string]: string | undefined;
  }>;
}

export async function generateMetadata({
  searchParams,
}: pageProps): Promise<Metadata> {
  const { page } = await getSearchParams({ searchParams });

  return {
    title:
      page === 1
        ? "Mồn lèo - SuicaoDex"
        : `Trang ${page} - Mồn lèo - SuicaoDex`,
    keywords: ["Mồn lèo", "Mèo", "Car", "SuicaoDex"],
  };
}

export default async function Page({ searchParams }: pageProps) {
  const { page, limit } = await getSearchParams({ searchParams });
  return (
    <div className="flex flex-col gap-4">
      <TotalCatAlert />
      <MeoPage page={page} limit={limit} />
    </div>
  );
}

const getSearchParams = async ({ searchParams }: pageProps) => {
  const params = await searchParams;

  let page = params["page"] ? parseInt(params["page"]) : 1;
  let limit = params["limit"] ? parseInt(params["limit"]) : 20;
  //Non-feed limit query param may not be >100
  if (limit > 100) limit = 100;
  if (page < 1) page = 1;

  return {
    page,
    limit,
  };
};
