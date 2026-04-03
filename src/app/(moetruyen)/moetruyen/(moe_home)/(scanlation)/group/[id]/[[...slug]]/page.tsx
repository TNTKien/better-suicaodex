import type { Metadata } from "next";
import { cache } from "react";

import ErrorPage from "@/components/error-page";
import { siteConfig } from "@/config/site";
import { getV2TeamsById } from "@/lib/moetruyen/hooks/teams/teams";

import { GroupDetail } from "./_components/group-detail";

interface PageProps {
  params: Promise<{ id: string; slug?: string[] }>;
}

export const revalidate = 86400;

const getCachedTeamData = cache(async (id: number) => {
  return await getV2TeamsById(id);
});

function parseTeamId(id: string) {
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return null;
  }

  return parsedId;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id, slug = [] } = await params;
  const teamId = parseTeamId(id);

  if (teamId === null) {
    return { title: "404 Not Found" };
  }

  const path = `/moetruyen/group/${teamId}${slug.length ? `/${slug.join("/")}` : ""}`;
  const { data: teamResponse, status } = await getCachedTeamData(teamId);

  if (status !== 200) {
    return { title: "Ehe! 🤪" };
  }

  const team = teamResponse.data;
  const title = team.name;
  const description = team.intro ?? `Khám phá truyện từ nhóm ${title}`;
  const socialImage = team.coverUrl ?? team.avatarUrl ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: path,
      siteName: siteConfig.name,
      images: socialImage
        ? [
            {
              url: socialImage,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  const teamId = parseTeamId(id);

  if (teamId === null) {
    return (
      <div className="px-4 md:px-8 lg:px-12">
        <ErrorPage
          statusCode={404}
          title="Không tìm thấy nhóm dịch"
          message="ID nhóm dịch không hợp lệ hoặc không tồn tại."
        />
      </div>
    );
  }

  const res = await getCachedTeamData(teamId);

  if (res.status !== 200) {
    return (
      <div className="px-4 md:px-8 lg:px-12">
        <ErrorPage
          statusCode={res.status}
          title="Không tải được thông tin nhóm dịch"
          message="Không thể tải dữ liệu nhóm dịch từ MoeTruyen."
        />
      </div>
    );
  }

  const team = res.data.data;

  return (
    <div className="flex flex-col gap-4 px-4 md:px-8 lg:px-12">
      <div>
        <hr className="h-1 w-9 border-none bg-primary" />
        <h1 className="text-2xl font-black uppercase">Nhóm dịch</h1>
      </div>

      <GroupDetail team={team} />
    </div>
  );
}
