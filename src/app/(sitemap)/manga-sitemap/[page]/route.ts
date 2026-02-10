import { getRecentlyMangas, getTotalMangas } from "@/lib/mangadex/manga";
import { generateSlug } from "@/lib/utils";
import { getServerSideSitemap } from "next-sitemap";

export async function GET(
  req: Request,
  context: { params: Promise<{ page: string }> }
) {
  const params = await context.params;
  const offset = parseInt(params.page) * 100;
  const res = await getRecentlyMangas(100, ["vi"], false, offset);

  const siteMap = await (
    await getServerSideSitemap(
      res.mangas.map((manga) => ({
        loc: `${process.env.SITEMAP_URL}/manga/${manga.id}/${generateSlug(
          manga.title
        )}`,
        lastmod: new Date().toISOString(),
        priority: 0.9,
        changefreq: "daily",
      })),
      req.headers
    )
  ).text();

  return new Response(siteMap, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=900",
    },
  });
}
