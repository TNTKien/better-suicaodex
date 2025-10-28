import type { Metadata } from "next";
import GroupInfo from "@/components/Groups/group-info";
import { siteConfig } from "@/config/site";
import { getGroup } from "@/lib/mangadex/group";

interface PageProps {
	params: Promise<{
		id: string;
	}>;
}
export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { id } = await params;
	try {
		const group = await getGroup(id);
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
		return { title: "Lỗi mất rồi 😭" };
	}
}

export default async function Page({ params }: PageProps) {
	const { id } = await params;
	return <GroupInfo id={id} />;
}
