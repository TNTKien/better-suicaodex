import { Cover } from "@/types/types";
import { axiosWithProxyFallback } from "../axios";

export function CoverParser(data: any): Cover {
  return {
    id: data.id,
    description: data.attributes.description,
    volume: data.attributes.volume,
    fileName: data.attributes.fileName,
    locale: data.attributes.locale,
  };
}

export async function getCovers(m_ids: string[]): Promise<Cover[]> {
  if (m_ids.length === 0) return [];

  const LIMIT = 100;
  let offset = 0;
  let totalResults: Cover[] = [];
  let hasMore = true;

  while (hasMore) {
    // const data = await axiosWithProxyFallback.get(`/cover?`, {
    //   params: {
    //     limit: LIMIT,
    //     offset: offset,
    //     manga: m_ids,
    //     order: {
    //       volume: "asc",
    //     },
    //   },
    // });

    const data = await axiosWithProxyFallback({
      url: `/cover?`,
      method: "get",
      params: {
        limit: LIMIT,
        offset: offset,
        manga: m_ids,
        order: {
          volume: "asc",
        },
      },
    });
    
    const total = data.total;
    const currentResults = data.data.map((item: any) => CoverParser(item));
    totalResults = [...totalResults, ...currentResults];
    
    offset += LIMIT;
    // Kiểm tra xem đã lấy đủ dữ liệu chưa
    hasMore = offset < total;
  }

  return totalResults;
}
