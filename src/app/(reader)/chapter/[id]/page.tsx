import ChapterPage from "../../_components/chapter-page";
import { siteConfig } from "@/config/site";
import { getChapterId } from "@/lib/weebdex/hooks/chapter/chapter";
import { parseMangaTitle } from "@/lib/weebdex/utils";
import { Metadata } from "next";
import { cache } from "react";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

//TODO: slug

const getCachedChapterData = cache(async (id: string) => {
  const res = await getChapterId(id);
  if (res.status !== 200) throw new Error(`Chapter fetch failed: ${res.status}`);
  return res.data;
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const chapter = await getCachedChapterData(id);
    const manga = chapter.relationships?.manga;
    const mangaTitle = manga ? parseMangaTitle(manga).title : undefined;

    const chapterInx = chapter.chapter ? `Ch. ${chapter.chapter}` : "Oneshot";
    const title = [mangaTitle, chapterInx, chapter.title, "SuicaoDex"]
      .filter((x) => x)
      .join(" - ");

    return {
      title: title,
      description: `Đọc ngay ${title}`,
      openGraph: {
        title: title,
        siteName: "SuicaoDex",
        description: `Đọc ngay ${title}`,
        images: `${siteConfig.weebdex.ogURL}/og-image/chapter/${id}`,
      },
    };
  } catch (error: any) {
    return {
      title: "Ehe! 🤪",
    };
  }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  try {
    const initialData = await getCachedChapterData(id);
    return <ChapterPage id={id} initialData={initialData} />;
  } catch (error) {
    console.log("Error loading chapter", error);
    return <ChapterPage id={id} />;
  }
}

