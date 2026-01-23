import Chapter from "@/components/Pages/Chapter/chapter";
import { siteConfig } from "@/config/site";
import { getChapterDetail } from "@/lib/mangadex/chapter";
import { Metadata } from "next";

interface PageProps {
  params: Promise<{
    id: string;
    page: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const res = await getChapterDetail(id);

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
    if (error.status === 404) {
      return {
        title: "Truyện không tồn tại",
      };
    } else if (error.status === 503) {
      return {
        title: "Đang bảo trì...",
      };
    } else {
      return {
        title: "Lỗi mất rồi :(",
      };
    }
  }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <Chapter id={id} />;
}
