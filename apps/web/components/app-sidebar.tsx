"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense, type ComponentProps, useState } from "react"
import {
  BookOpenIcon,
  BookmarkIcon,
  ChevronRightIcon,
  CompassIcon,
  FrameIcon,
  HouseIcon,
  ImagesIcon,
  LinkIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PinIcon,
  ScrollTextIcon,
  StoreIcon,
  TagsIcon,
  type LucideIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react"
import SiFacebook from "@icons-pack/react-simple-icons/icons/SiFacebook"
import SiDiscord from "@icons-pack/react-simple-icons/icons/SiDiscord"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { siteConfig } from "@/config/site"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarGroupLabel,
  useSidebar,
} from "@workspace/ui/components/sidebar"

const navigation = [
  {
    title: "Theo dõi",
    icon: BookmarkIcon,
    items: [
      { title: "Thư viện", url: "/my-library" },
      { title: "Lịch sử đọc", url: "/history" },
    ],
  },
  {
    title: "Khám phá",
    icon: CompassIcon,
    items: [
      { title: "Mới cập nhật", url: "/latest" },
      { title: "Tìm kiếm nâng cao", url: "/advanced-search" },
      { title: "Truyện ngẫu nhiên", url: "/random" },
      { title: "Thể loại", url: "/tags" },
      { title: "Nhóm dịch", url: "/groups" },
    ],
  },
  {
    title: siteConfig.shortName,
    icon: PinIcon,
    items: [
      { title: "Thông báo", url: "/system-notice" },
      { title: "Chính sách bảo mật", url: "/privacy-policy" },
      { title: "Điều khoản dịch vụ", url: "/terms-of-service" },
      { title: "Bản quyền", url: "/copyright" },
    ],
  },
  {
    title: "Liên kết",
    icon: LinkIcon,
    items: siteConfig.sidebarLinks.map((item) => ({
      ...item,
      external: true,
    })),
  },
]

const channels = [
  {
    title: "Facebook",
    url: siteConfig.links.facebook,
    icon: SiFacebook,
  },
  { title: "Discord", url: siteConfig.links.discord, icon: SiDiscord },
]

type WorkspaceNavigationItem = {
  title: string
  url: string
  icon: LucideIcon
  items?: { title: string; url: string }[]
}

const manageNavigation: WorkspaceNavigationItem[] = [
  { title: "Nhóm dịch", url: "/manage/group", icon: UsersIcon },
  {
    title: "Quản lý truyện",
    url: "/manage/manga",
    icon: BookOpenIcon,
    items: [
      { title: "Thêm truyện mới", url: "/manage/manga/new" },
      { title: "Truyện của nhóm", url: "/manage/group/mangas" },
    ],
  },
  { title: "Về trang chủ", url: "/", icon: HouseIcon },
]

const adminNavigation: WorkspaceNavigationItem[] = [
  { title: "Nhóm dịch", url: "/admin/groups", icon: UsersIcon },
  { title: "Người dùng", url: "/admin/users", icon: UserCogIcon },
  { title: "Khung avatar", url: "/admin/avatar-frames", icon: FrameIcon },
  { title: "SuicaoShop", url: "/admin/shop", icon: StoreIcon },
  { title: "Truyện", url: "/admin/mangas", icon: BookOpenIcon },
  { title: "Thể loại", url: "/admin/tags", icon: TagsIcon },
  {
    title: "Bình luận",
    url: "/admin/comments",
    icon: MessageSquareIcon,
    items: [
      { title: "Danh sách bình luận", url: "/admin/comments/list" },
      { title: "Từ cấm", url: "/admin/comments/forbidden-words" },
    ],
  },
  { title: "TikTok Server 2", url: "/admin/image-server2", icon: ImagesIcon },
  {
    title: "Thông báo hệ thống",
    url: "/admin/system-notice",
    icon: MegaphoneIcon,
  },
  { title: "Nhật ký quản trị", url: "/admin/audit", icon: ScrollTextIcon },
]

export type AppArea = "admin" | "manage" | "site"
type WorkspaceArea = Exclude<AppArea, "site">

function WorkspaceNavigation({ area }: { area: WorkspaceArea }) {
  return (
    <Suspense fallback={<WorkspaceMenu area={area} pathname={null} />}>
      <ActiveWorkspaceMenu area={area} />
    </Suspense>
  )
}

function ActiveWorkspaceMenu({ area }: { area: WorkspaceArea }) {
  return <WorkspaceMenu area={area} pathname={usePathname()} />
}

function WorkspaceMenu({
  area,
  pathname,
}: {
  area: WorkspaceArea
  pathname: string | null
}) {
  const { isMobile, setOpen, setOpenMobile, state } = useSidebar()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const items = area === "admin" ? adminNavigation : manageNavigation
  const collapsed = !isMobile && state === "collapsed"
  const matches = (url: string) =>
    pathname === url ||
    pathname?.startsWith(`${url}/`) ||
    (url === "/admin/users" && pathname?.startsWith("/admin/user/"))
  const nestedActive = items.some((item) =>
    item.items?.some(({ url }) => matches(url))
  )

  return (
    <nav
      aria-label={
        area === "admin" ? "Điều hướng quản trị" : "Điều hướng quản lý"
      }
    >
      <SidebarGroup>
        <SidebarMenu>
          {items.map((item) => {
            const active =
              matches(item.url) ||
              Boolean(item.items?.some(({ url }) => matches(url)))

            if (item.items)
              return (
                <Collapsible
                  className="group/collapsible"
                  key={item.url}
                  onOpenChange={(open) => {
                    setOpenGroups((groups) => ({
                      ...groups,
                      [item.title]: open,
                    }))
                    if (collapsed && open) setOpen(true)
                  }}
                  open={!collapsed && (openGroups[item.title] ?? true)}
                  render={<SidebarMenuItem />}
                >
                  <CollapsibleTrigger
                    render={
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={{ children: item.title, side: "left" }}
                      />
                    }
                  >
                    <item.icon aria-hidden="true" />
                    <span>{item.title}</span>
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90 motion-reduce:transition-none"
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => {
                        const subActive = Boolean(matches(subItem.url))
                        return (
                          <SidebarMenuSubItem key={subItem.url}>
                            <SidebarMenuSubButton
                              aria-current={subActive ? "page" : undefined}
                              isActive={subActive}
                              render={
                                <Link
                                  href={subItem.url}
                                  onNavigate={() => setOpenMobile(false)}
                                  prefetch={false}
                                />
                              }
                            >
                              <span>{subItem.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              )

            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  aria-current={active && !nestedActive ? "page" : undefined}
                  isActive={active && !nestedActive}
                  render={
                    <Link
                      href={item.url}
                      onNavigate={() => setOpenMobile(false)}
                      prefetch={false}
                    />
                  }
                  tooltip={{ children: item.title, side: "left" }}
                >
                  <item.icon aria-hidden="true" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroup>
    </nav>
  )
}

export function AppSidebar({
  area = "site",
  ...props
}: ComponentProps<typeof Sidebar> & { area?: AppArea }) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-12 shrink-0 transition-[height] ease-linear md:h-16 md:group-data-[collapsible=icon]:h-12">
        <NavUser />
      </SidebarHeader>

      <SidebarContent className="mt-2 md:mt-0">
        {area === "site" ? (
          <NavMain items={navigation} />
        ) : (
          <WorkspaceNavigation area={area} />
        )}
      </SidebarContent>

      <SidebarFooter>
        <nav aria-label={`Cộng đồng ${siteConfig.shortName}`}>
          <SidebarGroupLabel>Góp ý/Báo lỗi</SidebarGroupLabel>
          <SidebarMenu>
            {channels.map((channel) => (
              <SidebarMenuItem key={channel.title}>
                <SidebarMenuButton
                  aria-label={`${channel.title} (mở tab mới)`}
                  render={
                    <Link
                      href={channel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                  tooltip={{ children: channel.title, side: "left" }}
                >
                  <channel.icon aria-hidden="true" />
                  <span>{channel.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </nav>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
