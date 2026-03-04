"use client";

import { SquareArrowOutUpRight, type LucideIcon } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavSupports({
  supports,
}: {
  supports: {
    name: string;
    url: string;
    icon: LucideIcon;
  }[];
}) {
  //   const { isMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Góp ý/Báo lỗi</SidebarGroupLabel>
      <SidebarMenu>
        {supports.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild tooltip={item.name}>
              <a href={item.url} target="_blank">
                <item.icon />
                <span>{item.name}</span>
              </a>
            </SidebarMenuButton>
            <SidebarMenuAction>
              <SquareArrowOutUpRight />
            </SidebarMenuAction>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
