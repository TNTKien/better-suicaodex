import ErrorPage from "@/components/error-page";
import { siteConfig } from "@/config/site";
import { getV2ChaptersById } from "@/lib/moetruyen/hooks/chapters/chapters";
import type { Metadata } from "next";
import { cache } from "react";

import MoeChapterPage from "../../_components/moe-chapter-page";
import { formatMoeChapterTitle } from "../../_components/moe-reader-utils";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

const getCachedChapterData = cache(async (id: number) => {
  return await getV2ChaptersById(id);
});

function parseChapterId(id: string) {
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return null;
  }

  return parsedId;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const chapterId = parseChapterId(id);

  if (chapterId === null) {
    return { title: "404 Not Found" };
  }

  const response = await getCachedChapterData(chapterId);

  if (response.status !== 200) {
    return { title: "Ehe! 🤪" };
  }

  const payload = response.data.data;
  const chapterTitle = formatMoeChapterTitle(payload.chapter);
  const title = [payload.manga.title, chapterTitle, siteConfig.name].join(
    " - ",
  );

  return {
    title,
    description: `Đọc ngay ${title}`,
    openGraph: {
      title,
      siteName: siteConfig.name,
      description: `Đọc ngay ${title}`,
      url: getChapterPageUrl(chapterId),
    },
  };
}

function getChapterPageUrl(id: number) {
  return `${siteConfig.url}/moetruyen/chapter/${id}`;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const chapterId = parseChapterId(id);

  if (chapterId === null) {
    return <ErrorPage statusCode={404} />;
  }

  const response = await getCachedChapterData(chapterId);

  if (response.status === 404) {
    return <ErrorPage statusCode={404} />;
  }

  if (response.status === 403) {
    return (
      <ErrorPage
        statusCode={403}
        message="Chương này đang bị khoá hoặc cần mật khẩu để đọc."
      />
    );
  }

  if (response.status !== 200) {
    return <ErrorPage statusCode={500} />;
  }

  return <MoeChapterPage id={chapterId} initialData={response} />;
}

//TODO: moetruyen history, new reader mode (zenUI)