import { getManga } from "@/lib/weebdex/hooks/manga/manga";
import { generateSlug } from "@/lib/utils";
import { getServerSideSitemap } from "next-sitemap";

export async function GET(
  req: Request,
  context: { params: Promise<{ page: string }> }
) {
  const params = await context.params;
  const page = parseInt(params.page) + 1; // sitemap pages are 0-indexed, weebdex is 1-indexed
  const res = await getManga({ limit: 100, page, availableTranslatedLang: ["vi"] });

  const mangas = res.status === 200 ? (res.data.data ?? []) : [];

  const siteMap = await (
    await getServerSideSitemap(
      mangas.map((manga) => ({
        loc: `${process.env.SITEMAP_URL}/manga/${manga.id}/${generateSlug(
          manga.title ?? ""
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
