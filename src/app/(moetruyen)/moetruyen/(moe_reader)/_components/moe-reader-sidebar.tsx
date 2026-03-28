"use client";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar-2-reader";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import NoPrefetchLink from "@/components/common/no-prefetch-link";
import { cn } from "@/lib/utils";
import type { GetV1ChaptersById200Data } from "@/lib/moetruyen/model/getV1ChaptersById200Data";
import type { GetV1MangaByIdChapters200DataChaptersItem } from "@/lib/moetruyen/model/getV1MangaByIdChapters200DataChaptersItem";
import {
  HomeIcon,
  MessageSquareTextIcon,
  NotebookTextIcon,
  PanelRightClose,
  SwatchBookIcon,
  UsersIcon,
  UserXIcon,
} from "lucide-react";

import MoeChapterComments from "./moe-chapter-comments";
import MoeChapterNavSidebar from "./moe-chapter-nav-sidebar";
import { formatMoeChapterTitle, getMoeMangaHref } from "./moe-reader-utils";

interface MoeReaderSidebarProps extends React.ComponentProps<typeof Sidebar> {
  chapter: GetV1ChaptersById200Data;
  chapterList?: GetV1MangaByIdChapters200DataChaptersItem[];
  isChapterListLoading?: boolean;
}

export default function MoeReaderSidebar({
  chapter,
  chapterList,
  isChapterListLoading,
  ...props
}: MoeReaderSidebarProps) {
  const { state, isMobile, toggleSidebar } = useSidebar();
  const groupName = chapter.chapter.groupName?.trim();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex gap-2">
            <SidebarMenuButton asChild tooltip="Đóng/mở sidebar">
              <Button
                onClick={toggleSidebar}
                className="size-8"
                size="icon"
                variant="ghost"
              >
                <PanelRightClose />
              </Button>
            </SidebarMenuButton>

            <Button
              className={cn("size-8", state === "expanded" && "-ml-2")}
              size="icon"
              variant="outline"
              asChild
            >
              <NoPrefetchLink href="/moetruyen">
                <HomeIcon />
              </NoPrefetchLink>
            </Button>

            <MoeChapterNavSidebar
              chapterData={chapter}
              chapterList={chapterList}
              isChapterListLoading={isChapterListLoading}
            />
          </SidebarMenuItem>

          <Collapsible asChild defaultOpen className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={chapter.manga.title}>
                  <NotebookTextIcon />
                  <span>Đang đọc</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub className="mr-0">
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      asChild
                      className="h-auto text-pretty text-primary hover:bg-transparent hover:text-primary hover:underline"
                    >
                      <NoPrefetchLink href={getMoeMangaHref(chapter.manga)}>
                        {chapter.manga.title}
                      </NoPrefetchLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={formatMoeChapterTitle(chapter.chapter)}
              className="h-auto"
            >
              <SwatchBookIcon />
              <span className="whitespace-normal!">
                {formatMoeChapterTitle(chapter.chapter)}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <Collapsible asChild defaultOpen className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Nhóm dịch" disabled={!groupName}>
                  {groupName ? (
                    <>
                      <UsersIcon />
                      <span>Nhóm dịch</span>
                    </>
                  ) : (
                    <>
                      <UserXIcon />
                      <span>No Group</span>
                    </>
                  )}
                </SidebarMenuButton>
              </CollapsibleTrigger>

              {groupName ? (
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton className="h-auto w-fit whitespace-normal! text-primary hover:bg-transparent hover:text-primary hover:underline">
                        {groupName}
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              ) : null}
            </SidebarMenuItem>
          </Collapsible>

          <SidebarMenuButton tooltip="Bình luận">
            <MessageSquareTextIcon />
            <span>Bình luận</span>
          </SidebarMenuButton>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent
        className={cn(state === "collapsed" && !isMobile && "hidden")}
      >
        <SidebarGroup className="py-0">
          <SidebarGroupContent>
            <MoeChapterComments chapterId={chapter.chapter.id} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter
        className={cn(state === "collapsed" && !isMobile && "hidden")}
      />
      <SidebarRail />
    </Sidebar>
  );
}
