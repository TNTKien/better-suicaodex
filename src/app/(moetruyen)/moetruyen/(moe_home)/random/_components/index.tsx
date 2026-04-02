"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import ErrorPage from "@/components/error-page";
import { getV2MangaRandom } from "@/lib/moetruyen/hooks/manga/manga";

import MoeMangaSkeleton from "../../manga/_components/moe-manga-skeleton";

class RandomMangaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RandomMangaError";
  }
}

export default function MoeRandomManga() {
  const router = useRouter();

  const { data, error } = useQuery({
    queryKey: ["moetruyen", "random-manga"],
    queryFn: async () => {
      const res = await getV2MangaRandom({ limit: 1 });

      if (res.status !== 200) {
        throw new RandomMangaError("Failed to fetch random manga", res.status);
      }

      const manga = res.data.data[0];

      if (!manga) {
        throw new RandomMangaError("Random manga not found", 404);
      }

      return manga;
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data?.id) {
      router.replace(`/moetruyen/manga/${data.id}/${data.slug}`);
    }
  }, [data, router]);

  if (error) {
    return (
      <ErrorPage
        error={error}
        statusCode={error instanceof RandomMangaError ? error.status : 500}
      />
    );
  }

  return <MoeMangaSkeleton />;
}
