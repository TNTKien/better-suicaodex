"use client";

import {
	SiDiscord,
	SiFacebook,
	SiGithub,
} from "@icons-pack/react-simple-icons";
import { Bookmark, BookOpen, Gamepad2, Users } from "lucide-react";
import type * as React from "react";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import { siteConfig } from "@/config/site";
import { NavMain } from "./nav-main";
import { NavSettings } from "./nav-settings";
import { NavSupports } from "./nav-supports";
import { NavUser } from "./nav-user";

// import { signOut, useSession } from "next-auth/react";

// This is sample data.
const data = {
	user: {
		name: "Dorothy",
		email: "doro@suicaodex.com",
		image: "/avatars/doro_think.webp",
	},

	navMain: [
		{
			title: "Theo dõi",
			url: "#",
			icon: Bookmark,
			isActive: true,
			items: [
				{
					title: "Thư viện",
					url: "/my-library",
				},
				{
					title: "Lịch sử đọc",
					url: "/history",
				},
			],
		},
		{
			title: "Truyện",
			url: "#",
			icon: BookOpen,
			isActive: true,
			items: [
				{
					title: "Tìm kiếm nâng cao",
					url: "/advanced-search",
				},
				{
					title: "Mới cập nhật",
					url: "/latest",
				},
				{
					title: "Truyện mới",
					url: "/recent",
				},
				{
					title: "Thể loại",
					url: "/tag",
				},
				{
					title: "Truyện ngẫu nhiên",
					url: "/random",
				},
			],
		},
		{
			title: "Cộng đồng",
			url: "#",
			icon: Users,
			items: [
				{
					title: "Diễn đàn",
					url: "https://github.com/TNTKien/better-suicaodex/discussions/36",
				},
				{
					title: "Nhóm dịch",
					url: "/groups",
				},
			],
		},
		{
			title: "Giải trí",
			url: "#",
			icon: Gamepad2,
			items: [
				{
					title: "Gacha",
					url: "/gacha",
				},
				// {
				//   title: "Nhóm dịch",
				//   url: "/groups",
				// },
			],
		},
	],

	supports: [
		{
			name: "Facebook",
			url: siteConfig.links.facebook,
			icon: SiFacebook,
		},
		{
			name: "Discord",
			url: siteConfig.links.discord,
			icon: SiDiscord,
		},
		{
			name: "Github",
			url: siteConfig.links.github,
			icon: SiGithub,
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	// const { data: session } = useSession();
	// console.log("session", session);
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader className="h-12 items-center justify-center">
				<NavUser />
			</SidebarHeader>
			<SidebarSeparator />
			<SidebarContent>
				<NavMain items={data.navMain} />
				<NavSettings />
			</SidebarContent>
			<SidebarFooter className="p-0">
				<NavSupports supports={data.supports} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
