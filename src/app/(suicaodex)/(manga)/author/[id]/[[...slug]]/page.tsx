import {
  getAuthorId,
  getAuthorIdResponseSuccess,
} from "@/lib/weebdex/hooks/author/author";
import { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { loadSearchParams } from "./searchParams";
import { cache } from "react";
import AuthorPage from "./_components";
import ErrorPage from "@/components/error-page";
import { validate as isValidUUID } from "uuid";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}

const getOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const getCachedAuthor = cache(async (id: string) => {
  const res = await getAuthorId(id);
  if (res.status !== 200) return null;
  return (res as getAuthorIdResponseSuccess).data ?? null;
});

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
    const author = await getCachedAuthor(id);
    if (!author) return { title: "404 Not Found" };
    const description = getOptionalString(
      (author as Record<string, unknown>).description,
    );
    const title =
      page > 1 ? `Trang ${page} - ${author.name}` : `${author.name}`;
    return {
      title,
      description:
        description?.slice(0, 160) ?? `Tác giả ${author.name} trên WeebDex`,
      keywords: ["Tác giả", "Author", author.name ?? "", "WeebDex"],
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

  return <AuthorPage id={id} page={page} />;
}
