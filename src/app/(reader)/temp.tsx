import {
  Calendar,
  Home,
  Inbox,
  MessageSquareTextIcon,
  MoreHorizontal,
  NotebookTextIcon,
  PanelRightClose,
  Search,
  Settings,
  SwatchBookIcon,
  UserIcon,
  UserXIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { Chapter } from "@/types/types";
import { ChapterTitle } from "../ChapterReader/chapter-info";
import { cn, formatChapterTitle, generateSlug } from "@/lib/utils";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import CommentFormSimple from "@/components/Comment/comment-form-simple";
import { toast } from "sonner";
import CommentList from "@/components/Comment/comment-list";
import { useRef } from "react";

interface WeebDexReaderProps {
  chapter: Chapter;
  children?: React.ReactNode;
}

export default function WeebDexReader({
  chapter,
  children,
}: WeebDexReaderProps) {
  const {
    state,
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    isMobile,
    toggleSidebar,
  } = useSidebar();
  console.log("WeebDexReader render", { isMobile, state, open, openMobile });

  const commentListRef = useRef<{ mutate: () => void } | null>(null);
  const handleCommentPosted = () => {
    if (commentListRef.current) {
      commentListRef.current.mutate();
    }
  };
  return (
    <SidebarProvider
      defaultOpen={true}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 100)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <Sidebar
        className="mt-12 h-[calc(100vh-var(--header-height))]"
        variant="inset"
        collapsible="icon"
      >
        <SidebarHeader>
          <SidebarMenu>
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
              <SidebarMenuButton tooltip={ChapterTitle(chapter)}>
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
                        <UserIcon />
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

            <SidebarMenuItem>
              <SidebarMenuButton onClick={toggleSidebar}>
                <PanelRightClose />
              </SidebarMenuButton>
              <SidebarMenuAction>
                <MoreHorizontal />
              </SidebarMenuAction>
            </SidebarMenuItem>

            <SidebarMenuButton tooltip="Bình luận">
              <MessageSquareTextIcon />
              <span>Bình luận</span>
            </SidebarMenuButton>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent
          className={cn(state === "collapsed" && !isMobile && "hidden")}
        >
          <SidebarGroup>
            <SidebarGroupContent>
              <CommentList
                id={chapter.id}
                type="chapter"
                ref={commentListRef}
              />
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
      </Sidebar>

      {children}
    </SidebarProvider>
  );
}
