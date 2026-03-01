"use client";

import ErrorPage from "@/components/error-page";
import { useConfig } from "@/hooks/use-config";
import {
  getMangaRandom,
  getMangaRandomResponseSuccess,
} from "@/lib/weebdex/hooks/manga/manga";
import { GetMangaRandomContentRatingItem } from "@/lib/weebdex/model";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import MangaSkeleton from "../../manga/_components/manga-skeleton";

export default function RandomManga() {
  const router = useRouter();
  const [config] = useConfig();
  const contentRating = config.r18
    ? Object.values(GetMangaRandomContentRatingItem)
    : undefined;

  const { data, error } = useQuery({
    queryKey: ["weebdex", "random-manga", config.r18],
    queryFn: async () => {
      const res = await getMangaRandom({ contentRating });
      if (res.status !== 200) throw new Error("Failed to fetch random manga");
      return (res as getMangaRandomResponseSuccess).data;
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data?.id) {
      router.replace(`/manga/${data.id}`);
    }
  }, [data, router]);

  if (error)
    return <ErrorPage error={error} statusCode={(error as any).status} />;

  return <MangaSkeleton />;
}
