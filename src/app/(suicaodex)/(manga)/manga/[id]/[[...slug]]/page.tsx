import { siteConfig } from "@/config/site";
import { getMangaId } from "@/lib/weebdex/hooks/manga/manga";
import { parseMangaTitle } from "@/lib/weebdex/utils";
import { Metadata } from "next";
import { cache } from "react";
import ErrorPage from "@/components/error-page";
// import type { SearchParams } from "nuqs/server";
// import { loadSearchParams } from "./searchParams";
import MangaPage from "../../_components/manga-page";
import { validate as isValidUUID } from "uuid";
// Revalidate the page every 24 hours (86400 seconds)
export const revalidate = 86400;

interface PageProps {
  params: Promise<{
    id: string;
  }>;
  // searchParams: Promise<SearchParams>;
}

const getCachedMangaData = cache(async (id: string) => {
  return await getMangaId(id);
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id, slug = [] } = (await params) as { id: string; slug?: string[] };
  if (isValidUUID(id)) {
    return { title: "404 Not Found" };
  }
  const path = `/manga/${id}${
    Array.isArray(slug) && slug.length ? `/${slug.join("/")}` : ""
  }`;

  const { data: manga, status } = await getCachedMangaData(id);
  if (status !== 200 || !manga) return { title: "Ehe! 🤪" };

  const { title, altTitles } = parseMangaTitle(manga);
  const description = manga.description || `Đọc truyện ${title}`;
  const keywords = [`Manga`, title, "SuicaoDex", ...altTitles].join(", ");

  return {
    title: `${title}`,
    description,
    keywords,
    openGraph: {
      title: `${title}`,
      url: path,
      siteName: "SuicaoDex",
      description,
      images: [
        {
          url: `${siteConfig.weebdex.ogURL}/og-image/manga/${manga.id}`,
          width: 1200,
          height: 630,
          alt: "SuicaoDex",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title}`,
      description,
      images: [`${siteConfig.weebdex.ogURL}/og-image/manga/${manga.id}`],
    },
  };
}

export default async function Page({
  params,
  // , searchParams
}: PageProps) {
  const { id } = await params;
  if (isValidUUID(id)) {
    return (
      <ErrorPage
        statusCode={404}
        message="Có vẻ bạn đang dùng link chứa uuid của MangaDex (không còn hỗ trợ nữa)"
      />
    );
  }
  const res = await getCachedMangaData(id);
  // const { page, tab } = await loadSearchParams(searchParams);

  if (res.status !== 200) {
    return <ErrorPage statusCode={res.status} />;
  }

  return <MangaPage id={id} initData={res} />;
}
