"use client";

import ErrorPage from "@/components/error-page";
import useSWR from "swr";
import MangaDetailsSkeleton from "./manga-details-skeleton";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getRandomManga } from "@/lib/mangadex/random";

export default function RandomManga() {
  const router = useRouter();
  const { data, isLoading, error } = useSWR(
    ["random-manga"],
    ([]) => getRandomManga(true),
    {
      refreshInterval: 1000 * 60 * 10,
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    if (data) {
      router.replace(`/manga/${data.id}`);
    }
  }, [data, router]);

  if (error) return <ErrorPage error={error} statusCode={error.status} />;

  if (isLoading || !data) return <MangaDetailsSkeleton />;

  return <MangaDetailsSkeleton />;
}
