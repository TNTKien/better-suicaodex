import { getManga } from "@/lib/weebdex/hooks/manga/manga";
import { generateSlug } from "@/lib/utils";

const XML_CONTENT_TYPE = "application/xml; charset=utf-8";
const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=900";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ page: string }> },
) {
  void request;
  const params = await context.params;
  const page = parseInt(params.page) + 1;
  const res = await getManga({
    limit: 100,
    page,
    availableTranslatedLang: ["vi"],
  });
  const siteUrl =
    process.env.SITEMAP_URL ?? process.env.SITE_URL ?? "https://vinext.suicaodex.com";

  const mangas = res.status === 200 ? (res.data.data ?? []) : [];
  const now = new Date().toISOString();

  const siteMap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${mangas
  .map((manga) => {
    const loc = `${siteUrl}/manga/${manga.id}/${generateSlug(manga.title ?? "")}`;
    return [
      "  <url>",
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <lastmod>${now}</lastmod>`,
      "    <changefreq>daily</changefreq>",
      "    <priority>0.9</priority>",
      "  </url>",
    ].join("\n");
  })
  .join("\n")}
</urlset>`;

  return new Response(siteMap, {
    headers: {
      "Content-Type": XML_CONTENT_TYPE,
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
