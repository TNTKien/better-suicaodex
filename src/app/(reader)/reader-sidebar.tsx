import { Chapter } from "@/types/types";
import {
  HomeIcon,
  MessageSquareTextIcon,
  NotebookTextIcon,
  PanelRightClose,
  SwatchBookIcon,
  UsersIcon,
  UserXIcon,
} from "lucide-react";

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
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import { cn, formatChapterTitle, generateSlug } from "@/lib/utils";
import { ChapterTitle } from "@/components/Chapter/ChapterReader/chapter-info";
import CommentList from "@/components/Comment/comment-list";
import CommentFormSimple from "@/components/Comment/comment-form-simple";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import ChapterNav from "./chapter-nav";

interface ReaderSidebarProps extends React.ComponentProps<typeof Sidebar> {
  chapter: Chapter;
}

export function ReaderSidebar({ chapter, ...props }: ReaderSidebarProps) {
  const { state, isMobile, toggleSidebar } = useSidebar();

  const commentListRef = useRef<{ mutate: () => void } | null>(null);
  const handleCommentPosted = () => {
    if (commentListRef.current) {
      commentListRef.current.mutate();
    }
  };

  return (
    <Sidebar
      //   className="md:w-[calc(var(--spacing)*80)]! lg:w-[calc(var(--spacing)*100)]!"
      collapsible="icon"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex gap-2">
            <Button
              onClick={toggleSidebar}
              className="size-8"
              size="icon"
              variant="ghost"
            >
              <PanelRightClose />
            </Button>

            <Button className={cn("size-8", state === "expanded" && "-ml-2")} size="icon" variant="outline" asChild>
              <NoPrefetchLink href="/">
                <HomeIcon />
              </NoPrefetchLink>
            </Button>

            <ChapterNav chapter={chapter} />
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
                      <NoPrefetchLink
                        href={`/manga/${chapter.manga.id}/${generateSlug(chapter.manga.title || "")}`}
                      >
                        {chapter.manga.title}
                      </NoPrefetchLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          <SidebarMenuItem>
            <SidebarMenuButton tooltip={ChapterTitle(chapter)} className="">
              <SwatchBookIcon />
              <span>{ChapterTitle(chapter)}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <Collapsible asChild defaultOpen className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  tooltip={chapter.manga.title}
                  disabled={chapter.group.length === 0}
                >
                  {chapter.group.length === 0 ? (
                    <>
                      <UserXIcon />
                      <span>No Group</span>
                    </>
                  ) : (
                    <>
                      <UsersIcon />
                      <span>Nhóm dịch</span>
                    </>
                  )}
                </SidebarMenuButton>
              </CollapsibleTrigger>
              {chapter.group.length > 0 && (
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {chapter.group.map((gr) => (
                      <SidebarMenuSubItem key={gr.id}>
                        <SidebarMenuSubButton
                          asChild
                          className="w-fit h-auto line-clamp-1 whitespace-normal! text-primary hover:bg-transparent hover:text-primary hover:underline"
                        >
                          <NoPrefetchLink
                            href={`/group/${gr.id}/${generateSlug(gr.name)}`}
                          >
                            {gr.name}
                          </NoPrefetchLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              )}
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
            <CommentList id={chapter.id} type="chapter" ref={commentListRef} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter
        className={cn(state === "collapsed" && !isMobile && "hidden")}
      >
        <CommentFormSimple
          id={chapter.id}
          title={chapter.manga.title || ""}
          type="chapter"
          onCommentPosted={handleCommentPosted}
          chapterNumber={formatChapterTitle(chapter, false)}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
