import AdvancedSearch from "@/components/Pages/AdvancedSearch";
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
        ? "Tìm kiếm nâng cao - SuicaoDex"
        : `Trang ${page} - Tìm kiếm nâng cao - SuicaoDex`,
    description: "Công cụ tìm kiếm nâng cao",
    keywords: [
      "Tìm kiếm nâng cao",
      "Nâng cao",
      "Tìm kiếm",
      "Manga",
      "SuicaoDex",
    ],
  };
}

export default async function Page({ searchParams }: pageProps) {
  const {
    page,
    limit,
    q,
    author,
    content,
    status,
    demos,
    include,
    exclude,
    origin,
    availableChapter,
    translated,
    year,
  } = await getSearchParams({ searchParams });
  return (
    <AdvancedSearch
      limit={limit}
      page={page}
      q={q}
      author={author}
      content={content}
      status={status}
      demos={demos}
      include={include}
      exclude={exclude}
      origin={origin}
      availableChapter={availableChapter}
      translated={translated}
      year={year}
    />
  );
}

const getSearchParams = async ({ searchParams }: pageProps) => {
  const params = await searchParams;

  const page = params["page"] ? parseInt(params["page"]) : 1;
  let limit = params["limit"] ? parseInt(params["limit"]) : 30;
  
  //Non-feed limit query param may not be >100
  if (limit > 100) limit = 100;

  const author = params["author"] || "";
  const q = params["q"] || "";
  const content = params["content"] || "";
  const status = params["status"] || "";
  const demos = params["demos"] || "";
  const include = params["include"] || "";
  const exclude = params["exclude"] || "";
  const origin = params["origin"] || "";
  const availableChapter = params["availableChapter"] === "true";
  const translated = params["translated"] || "";
  const year = params["year"] || "";

  return {
    page,
    limit,
    q,
    author,
    content,
    status,
    demos,
    include,
    exclude,
    origin,
    availableChapter,
    translated,
    year,
  };
};
