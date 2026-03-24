import { useQuery } from "@tanstack/react-query";

import { getMoetruyenRandomManga, MOETRUYEN_RANDOM_HOME_LIMIT } from "./client";

export function useMoetruyenRandomMangaQuery(
  limit = MOETRUYEN_RANDOM_HOME_LIMIT,
  enabled = true,
) {
  return useQuery({
    enabled,
    queryKey: ["moetruyen", "manga", "random", limit],
    queryFn: () => getMoetruyenRandomManga(limit),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}
