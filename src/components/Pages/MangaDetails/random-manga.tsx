"use client";

import ErrorPage from "@/components/error-page";
import { useQuery } from "@tanstack/react-query";
import MangaDetailsSkeleton from "./manga-details-skeleton";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getRandomManga } from "@/lib/mangadex/random";

export default function RandomManga() {
  const router = useRouter();
  const { data, isLoading, error } = useQuery({
    queryKey: ["random-manga"],
    queryFn: () => getRandomManga(true),
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data) {
      router.replace(`/manga/${data.id}`);
    }
  }, [data, router]);

  if (error) return <ErrorPage error={error} statusCode={(error as any).status} />;

  if (isLoading || !data) return <MangaDetailsSkeleton />;

  return <MangaDetailsSkeleton />;
}
