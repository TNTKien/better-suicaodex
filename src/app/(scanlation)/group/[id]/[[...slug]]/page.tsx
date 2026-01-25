import GroupInfo from "@/components/Groups/group-info";
import { siteConfig } from "@/config/site";
import { getGroup } from "@/lib/mangadex/group";
import { Metadata } from "next";
import { cache } from "react";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

const getCachedGroupData = cache(async (id: string) => {
  return await getGroup(id);
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const group = await getCachedGroupData(id);
    return {
      title: `${group.name} - SuicaoDex`,
      description: group.description
        ? group.description
        : `Thông tin nhóm dịch ${group.name} - SuicaoDex`,
      keywords: [`Manga`, `${group.name}`, "SuicaoDex"],

      openGraph: {
        title: `${group.name} - SuicaoDex`,
        siteName: "SuicaoDex",
        description: group.description
          ? group.description
          : `Thông tin nhóm dịch ${group.name} - SuicaoDex`,
        images: `${siteConfig.mangadexAPI.ogURL}/group/${group.id}`,
      },
    };
  } catch (error) {
    return { title: "SuicaoDex" };
  }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  try {
    const initialData = await getCachedGroupData(id);
    return <GroupInfo id={id} initialData={initialData} />;
  } catch (error) {
    console.log("Error loading group", error);
    return <GroupInfo id={id} />;
  }
}
