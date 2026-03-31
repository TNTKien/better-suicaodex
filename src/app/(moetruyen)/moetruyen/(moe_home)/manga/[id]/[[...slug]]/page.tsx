import ErrorPage from "@/components/error-page";
import { siteConfig } from "@/config/site";
import {
  getV2MangaById,
  type getV2MangaByIdResponse,
} from "@/lib/moetruyen/hooks/manga/manga";
import type { Metadata } from "next";
import { cache } from "react";

import MoeMangaPage from "../../_components/moe-manga-page";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{
    id: string;
    slug?: string[];
  }>;
}

const getCachedMangaData = cache(async (id: number) => {
  return await getV2MangaById(id, {
    include: "stats,genres",
  });
});

function parseMangaId(id: string) {
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return null;
  }

  return parsedId;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id, slug = [] } = await params;
  const mangaId = parseMangaId(id);

  if (mangaId === null) {
    return { title: "404 Not Found" };
  }

  const path = `/moetruyen/manga/${mangaId}${slug.length ? `/${slug.join("/")}` : ""}`;
  const { data: mangaResponse, status } = await getCachedMangaData(mangaId);

  if (status !== 200) {
    return { title: "Ehe! 🤪" };
  }

  const manga = mangaResponse.data;
  const title = manga.title;
  const description = manga.description ?? `Đọc truyện ${title}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: path,
      siteName: siteConfig.name,
      images: manga.coverUrl
        ? [
            {
              url: manga.coverUrl,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: manga.coverUrl ? [manga.coverUrl] : undefined,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const mangaId = parseMangaId(id);

  if (mangaId === null) {
    return <ErrorPage statusCode={404} />;
  }

  const res = await getCachedMangaData(mangaId);

  if (res.status !== 200) {
    return <ErrorPage statusCode={res.status} />;
  }

  return <MoeMangaPage id={mangaId} initData={res as getV2MangaByIdResponse} />;
}
