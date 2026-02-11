import MangaNotFound from "@/components/Manga/manga-notfound";
import MangaDetails from "@/components/Pages/MangaDetails/manga-details";
import { siteConfig } from "@/config/site";
import { fetchMangaDetail } from "@/lib/mangadex/manga";
import { Manga } from "@/types/types";
import { Metadata } from "next";
import { validate as isValidUUID } from "uuid";
import { cache } from "react";
import { generateSlug } from "@/lib/utils";

// Revalidate the page every 24 hours (86400 seconds)
export const revalidate = 86400;

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

const getCachedMangaData = cache(async (id: string) => {
  return await fetchMangaDetail(id);
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id, slug = [] } = (await params) as { id: string; slug?: string[] };
  if (!isValidUUID(id)) return { title: "Suicaodex" };

  const path = `/manga/${id}${
    Array.isArray(slug) && slug.length ? `/${slug.join("/")}` : ""
  }`;

  try {
    const manga = await getCachedMangaData(id);
    const description =
      manga.description.content || `Đọc truyện ${manga.title} - SuicaoDex`;

    return {
      title: `${manga.title} - SuicaoDex`,
      description,
      keywords: [`Manga`, manga.title, "SuicaoDex", manga.altTitle ?? ""],
      openGraph: {
        title: `${manga.title} - SuicaoDex`,
        url: path,
        siteName: "SuicaoDex",
        description,
        images: [
          {
            url: `${siteConfig.mangadexAPI.ogURL}/manga/${manga.id}`,
            width: 1200,
            height: 630,
            alt: "SuicaoDex",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${manga.title} - SuicaoDex`,
        description,
        images: [`${siteConfig.mangadexAPI.ogURL}/manga/${manga.id}`],
      },
    };
  } catch {
    return { title: "Suicaodex" };
  }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return <MangaNotFound />;
  }

  let manga: Awaited<ReturnType<typeof getCachedMangaData>> | undefined;
  try {
    manga = await getCachedMangaData(id);
  } catch (error: any) {
    console.log("Error loading manga", error);
  }

  return (
    <>
      {!!manga && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateJsonLd(manga)),
          }}
        ></script>
      )}
      <MangaDetails id={id} initialData={manga} />
    </>
  );
}

function generateJsonLd(
  manga: Pick<Manga, "id" | "title" | "cover" | "description">,
) {
  const description =
    manga.description.content || `Đọc truyện ${manga.title} - SuicaoDex`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: `${process.env.SITE_URL}/manga/${manga.id}/${generateSlug(
      manga.title,
    )}`,
    headline: `${manga.title}`,
    description: description,
    image: {
      "@type": "ImageObject",
      url: `${siteConfig.mangadexAPI.ogURL}/manga/${manga.id}`,
      width: 1280,
      height: 960,
    },
  };
}
