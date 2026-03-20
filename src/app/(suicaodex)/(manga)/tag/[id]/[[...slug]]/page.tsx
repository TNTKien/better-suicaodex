import {
  getMangaTag,
  getMangaTagResponseSuccess,
} from "@/lib/weebdex/hooks/tag/tag";
import { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { loadSearchParams } from "./searchParams";
import { cache } from "react";
import ErrorPage from "@/components/error-page";
import TagMangaPage from "./_components";
import { validate as isValidUUID } from "uuid";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}

const getCachedTags = cache(async () => {
  const res = await getMangaTag();
  if (res.status !== 200) return null;
  return (res as getMangaTagResponseSuccess).data.data ?? [];
});

const getTagById = async (id: string) => {
  const tags = await getCachedTags();
  return tags?.find((t) => t.id === id) ?? null;
};

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  if (isValidUUID(id)) {
    return { title: "404 Not Found" };
  }
  const { page } = await loadSearchParams(searchParams);
  try {
    const tag = await getTagById(id);
    if (!tag) return { title: "404 Not Found" };
    return {
      title: page > 1 ? `Trang ${page} - ${tag.name}` : `${tag.name}`,
      description: `Manga thuộc thể loại ${tag.name}`,
      keywords: ["Thể loại", "Genre", tag.name ?? "", "WeebDex"],
    };
  } catch {
    return { title: "Lỗi mất rồi 😭" };
  }
}

export default async function Page({ params, searchParams }: PageProps) {
  const { id } = await params;
  if (isValidUUID(id)) {
    return (
      <ErrorPage
        statusCode={404}
        message="Có vẻ bạn đang dùng link chứa uuid của MangaDex (không còn hỗ trợ nữa)"
      />
    );
  }
  let { page } = await loadSearchParams(searchParams);
  if (page < 1 || isNaN(page)) page = 1;

  const tag = await getTagById(id);
  if (!tag) return <ErrorPage statusCode={404} />;

  return (
    <>
      <div className="px-4 md:px-8 lg:px-12">
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">{tag.name}</h1>
      </div>

      <div className="px-4 md:px-8 lg:px-12">
        <TagMangaPage id={id} page={page} />
      </div>
    </>
  );
}
