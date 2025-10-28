import { getServerSideSitemapIndex } from "next-sitemap";
import { getTotalMangas } from "@/lib/mangadex/manga";

export async function GET(req: Request) {
	const count = await getTotalMangas();

	const context = Array.from(Array(Math.ceil(count / 100)).keys()).map(
		(_, index) => `${process.env.NEXTAUTH_URL}/manga-sitemap-${index}.xml`,
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
