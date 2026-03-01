import { getManga } from "@/lib/weebdex/hooks/manga/manga";
import { getServerSideSitemapIndex } from "next-sitemap";

export async function GET(req: Request) {
  const res = await getManga({
    limit: 1,
    page: 1,
    availableTranslatedLang: ["vi"],
  });
  const count = res.status === 200 ? (res.data.total ?? 0) : 0;

  const context = Array.from(Array(Math.ceil(count / 100)).keys()).map(
    (_, index) => `${process.env.SITEMAP_URL}/manga-sitemap-${index}.xml`,
  );

  const siteMap = await (
    await getServerSideSitemapIndex(context, req.headers)
  ).text();

  return new Response(siteMap, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=900",
    },
  });
}
