"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense, useState } from "react"
import {
  ChevronRightIcon,
  HomeIcon,
  StoreIcon,
  UploadIcon,
  type LucideIcon,
} from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"

type NavMainProps = {
  items: {
    title: string
    icon: LucideIcon
    items: { title: string; url: string; external?: boolean }[]
  }[]
}

export function NavMain({ items }: NavMainProps) {
  return (
    <Suspense fallback={<Navigation items={items} pathname={null} />}>
      <ActiveNavigation items={items} />
    </Suspense>
  )
}

function ActiveNavigation({ items }: NavMainProps) {
  return <Navigation items={items} pathname={usePathname()} />
}

function Navigation({
  items,
  pathname,
}: NavMainProps & { pathname: string | null }) {
  const { isMobile, state, setOpen, setOpenMobile } = useSidebar()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const collapsed = !isMobile && state === "collapsed"
  const closeMobile = () => setOpenMobile(false)

  return (
    <nav aria-label="Điều hướng chính">
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              aria-current={pathname === "/" ? "page" : undefined}
              isActive={pathname === "/"}
              render={<Link href="/" onNavigate={closeMobile} />}
              tooltip={{ children: "Trang chủ", side: "left" }}
            >
              <HomeIcon aria-hidden="true" />
              <span>Trang chủ</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              aria-current={pathname === "/manage/group" ? "page" : undefined}
              isActive={pathname === "/manage/group"}
              render={
                <Link
                  href="/manage/group"
                  onNavigate={closeMobile}
                  prefetch={false}
                />
              }
              tooltip={{ children: "Đăng truyện", side: "left" }}
            >
              <UploadIcon aria-hidden="true" />
              <span>Đăng truyện</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              aria-current={pathname === "/shop" ? "page" : undefined}
              isActive={pathname === "/shop"}
              render={
                <Link href="/shop" onNavigate={closeMobile} />
              }
              tooltip={{ children: "Cửa hàng", side: "left" }}
            >
              <StoreIcon aria-hidden="true" />
              <span>Cửa hàng</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {items.map((item) => (
            <Collapsible
              className="group/collapsible"
              key={item.title}
              onOpenChange={(open) => {
                setOpenGroups((groups) => ({ ...groups, [item.title]: open }))
                if (collapsed && open) setOpen(true)
              }}
              open={!collapsed && (openGroups[item.title] ?? true)}
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    isActive={item.items.some(({ url }) => pathname === url)}
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
                  {item.items.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.url}>
                      <SidebarMenuSubButton
                        aria-current={
                          !subItem.external && pathname === subItem.url
                            ? "page"
                            : undefined
                        }
                        isActive={!subItem.external && pathname === subItem.url}
                        render={
                          subItem.external ? (
                            <a
                              aria-label={`${subItem.title} (mở tab mới)`}
                              href={subItem.url}
                              onClick={closeMobile}
                              rel="noopener noreferrer"
                              target="_blank"
                            />
                          ) : (
                            <Link
                              href={subItem.url}
                              onNavigate={closeMobile}
                              prefetch={subItem.url === "/random" ? false : "auto"}
                            />
                          )
                        }
                      >
                        <span>{subItem.title}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </nav>
  )
}
