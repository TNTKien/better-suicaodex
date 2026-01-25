import ChapterPage from "@/components/Pages/Chapter/chapter";
import { siteConfig } from "@/config/site";
import { getChapterDetail } from "@/lib/mangadex/chapter";
import { Metadata } from "next";
import { cache } from "react";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

//TODO: slug

const getCachedChapterData = cache(async (id: string) => {
  return await getChapterDetail(id);
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const res = await getCachedChapterData(id);

    const chapterInx = res.chapter ? `Ch. ${res.chapter}` : "Oneshot";
    const title = [res.manga?.title, chapterInx, res.title, "SuicaoDex"]
      .filter((x) => x)
      .join(" - ");

    return {
      title: title,
      description: `Đọc ngay ${title}`,
      openGraph: {
        title: title,
        siteName: "SuicaoDex",
        description: `Đọc ngay ${title}`,
        images: `${siteConfig.mangadexAPI.ogURL}/chapter/${id}`,
      },
    };
  } catch (error: any) {
    return {
      title: "SuicaoDex",
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
