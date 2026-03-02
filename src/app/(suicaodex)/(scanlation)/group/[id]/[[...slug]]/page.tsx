import {
  getGroupId,
  getGroupIdResponseSuccess,
} from "@/lib/weebdex/hooks/scanlation-group/scanlation-group";
import { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { loadSearchParams } from "./searchParams";
import { cache } from "react";
import GroupPage from "./_components";
import ErrorPage from "@/components/error-page";
import { validate as isValidUUID } from "uuid";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}

const getCachedGroup = cache(async (id: string) => {
  const res = await getGroupId(id);
  if (res.status !== 200) return null;
  return (res as getGroupIdResponseSuccess).data ?? null;
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
    const group = await getCachedGroup(id);
    if (!group) return { title: "404 Not Found" };
    const title =
      page > 1 ? `Trang ${page} - ${group.name}` : `${group.name}`;
    return {
      title,
      description: group.description
        ? group.description.slice(0, 160)
        : `Nhóm dịch ${group.name} trên WeebDex`,
      keywords: ["Nhóm dịch", "Scanlation", group.name ?? "", "WeebDex"],
    };
  } catch {
    return { title: "Lỗi mất rồi 😭" };
  }
}

export default async function Page({ params, searchParams }: PageProps) {
  const { id } = await params;
  if (isValidUUID(id)) {
    return <ErrorPage statusCode={404} message="Có vẻ bạn đang dùng link chứa uuid của MangaDex (không còn hỗ trợ nữa)" />;
  }
  let { page } = await loadSearchParams(searchParams);
  if (page < 1 || isNaN(page)) page = 1;

  return <GroupPage id={id} page={page} />;
}
