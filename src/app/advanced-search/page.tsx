import { AdvancedSearch } from "@/components/Pages/AdvancedSearch";
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
  const { page, limit, q, author, content, status, demos, include, exclude } =
    await getSearchParams({ searchParams });
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
    />
  );
}

const getSearchParams = async ({ searchParams }: pageProps) => {
  const params = await searchParams;

  const page = params["page"] ? parseInt(params["page"]) : 1;
  const limit = params["limit"] ? parseInt(params["limit"]) : 30;

  const author = params["author"] || "";
  const q = params["q"] || "";
  const content = params["content"] || "";
  const status = params["status"] || "";
  const demos = params["demos"] || "";
  const include = params["include"] || "";
  const exclude = params["exclude"] || "";

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
  };
};
