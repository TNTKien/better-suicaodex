"use client";

import { CloudOff } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ThemeCustomizer } from "../Theme/theme-customizer";
import { ContentCustomizer } from "../Theme/content-customizer";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function NavSettings() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="gap-2">
        <span>Tuỳ chỉnh</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <CloudOff size={18} className="cursor-pointer" />
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Những tuỳ chỉnh này chỉ có hiệu lực trên thiết bị hiện tại, không
              đồng bộ theo tài khoản!
            </p>
          </TooltipContent>
        </Tooltip>
      </SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <ThemeCustomizer />
        </SidebarMenuItem>

        <SidebarMenuItem>
          <ContentCustomizer />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
