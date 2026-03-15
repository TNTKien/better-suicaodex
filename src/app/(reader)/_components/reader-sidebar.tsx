import { Chapter } from "@/lib/weebdex/model";
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
import NoPrefetchLink from "@/components/common/no-prefetch-link";
import { cn, formatChapterTitle, generateSlug } from "@/lib/utils";
import CommentList from "@/components/comment/comment-list";
import CommentFormSimple from "@/components/comment/comment-form-simple";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import ChapterNavSidebar from "./chapter-nav-sidebar";

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
              <NoPrefetchLink href="/">
                <HomeIcon />
              </NoPrefetchLink>
            </Button>

            <ChapterNavSidebar chapter={chapter} />
          </SidebarMenuItem>

          <Collapsible asChild defaultOpen className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={chapter.relationships?.manga?.title ?? ""}>
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
                        href={`/manga/${chapter.relationships?.manga?.id}/${generateSlug(chapter.relationships?.manga?.title || "")}`}
                      >
                        {chapter.relationships?.manga?.title}
                      </NoPrefetchLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={ChapterTitle(chapter)}
              className="h-auto"
            >
              <SwatchBookIcon />
              <span className="whitespace-normal!">
                {ChapterTitle(chapter)}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <Collapsible asChild defaultOpen className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  tooltip="Nhóm dịch"
                  disabled={(chapter.relationships?.groups?.length ?? 0) === 0}
                >
                  {(chapter.relationships?.groups?.length ?? 0) === 0 ? (
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
              {(chapter.relationships?.groups?.length ?? 0) > 0 && (
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {(chapter.relationships?.groups ?? []).map((gr) => (
                      <SidebarMenuSubItem key={gr.id}>
                        <SidebarMenuSubButton
                          asChild
                          className="w-fit h-auto line-clamp-1 whitespace-normal! text-primary hover:bg-transparent hover:text-primary hover:underline"
                        >
                          <NoPrefetchLink
                            href={`/group/${gr.id}/${generateSlug(gr.name ?? "")}`}
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
            <CommentList id={chapter.id ?? ""} type="chapter" ref={commentListRef} inSidebar/>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter
        className={cn(state === "collapsed" && !isMobile && "hidden")}
      >
        <CommentFormSimple
          id={chapter.id ?? ""}
          title={chapter.relationships?.manga?.title || ""}
          type="chapter"
          onCommentPosted={handleCommentPosted}
          chapterNumber={formatChapterTitle(chapter, false)}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ChapterTitle(chapter: {
  chapter?: string | null;
  title?: string | null;
}) {
  if (!chapter.chapter) return "Oneshot";
  return chapter.title
    ? `Ch. ${chapter.chapter} - ${chapter.title}`
    : `Ch. ${chapter.chapter}`;
}
