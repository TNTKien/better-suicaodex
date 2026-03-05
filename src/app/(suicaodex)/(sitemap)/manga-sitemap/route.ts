import { getManga } from "@/lib/weebdex/hooks/manga/manga";

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

export async function GET() {
  const res = await getManga({
    limit: 1,
    page: 1,
    availableTranslatedLang: ["vi"],
  });

  const siteUrl =
    process.env.SITEMAP_URL ?? process.env.SITE_URL ?? "https://vinext.suicaodex.com";
  const count = res.status === 200 ? (res.data.total ?? 0) : 0;

  const urls = Array.from(Array(Math.ceil(count / 100)).keys()).map(
    (_, index) => `${siteUrl}/manga-sitemap-${index}.xml`,
  );

  const siteMap = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <sitemap><loc>${escapeXml(url)}</loc></sitemap>`).join("\n")}
</sitemapindex>`;

  return new Response(siteMap, {
    headers: {
      "Content-Type": XML_CONTENT_TYPE,
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
