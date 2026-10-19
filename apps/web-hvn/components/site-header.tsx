import { primaryWebOrigin } from "@workspace/catalog/origins"
import Image from "next/image"
import Link from "next/link"

import { HeaderNavigation } from "@/components/header-navigation"
import { HeaderAccount } from "@/components/header-account"
import { QuickSearch } from "@/components/quick-search"
import { NotificationPopover } from "@/modules/notifications/notification-popover"

import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"

export function SiteHeader() {
  return (
    <header>
      <div className="md:hidden">
        <div className="hvn-mobile-gradient flex h-15 items-center justify-between px-2">
          <Link
            href="/"
            aria-label="SuicaoDex — Trang chủ"
            className="flex items-start"
          >
            <Image
              src="/brand/suicaodex-mobile.webp"
              alt="SuicaoDex"
              width={776}
              height={156}
              className="max-h-7 w-auto sm:max-h-10"
            />
          </Link>

          <div className="flex h-7 flex-1 flex-row-reverse items-center gap-3 p-1">
            <NotificationPopover />
            <Link
              href="/my-library"
              className={buttonVariants({
                size: "icon-xs",
                variant: "ghost",
                className: "hover:bg-transparent!",
              })}
            >
              <img
                src="/brand/icon-of-bookmark-list.webp"
                width={18}
                height={18}
              />
            </Link>
            <Button
              size="icon-xs"
              variant="ghost"
              className="hover:bg-transparent!"
            >
              <img src="/brand/mail.webp" width={18} height={18} />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              className="rounded-full! hover:bg-transparent!"
            >
              <img src="/brand/mes.webp" width={18} height={18} />
            </Button>
          </div>
        </div>

        <div className="hvn-mobile-gradient flex justify-center p-2">
          <Collapsible className="w-full">
            <div className="flex items-center justify-between gap-2">
              <QuickSearch mobile />
              <CollapsibleTrigger
                className={buttonVariants({
                  variant: "secondary",
                  size: "icon",
                  className: "hvn-mobile-button rounded-[6px]!",
                })}
                aria-label="Tùy chọn tài khoản"
              >
                <img src="/brand/setting-mobile.webp" width={24} height={24} />
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="mt-2 flex flex-col gap-1">
                <HeaderAccount mobile />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <HeaderNavigation mobile />
      </div>

      <div className="hidden px-4 pt-4 md:block md:px-20 lg:px-32">
        <div className="flex w-full items-start justify-between">
          <Link
            href="/"
            aria-label="SuicaoDex — Trang chủ"
            className="flex shrink-0 items-start"
          >
            <Image
              src="/brand/suicaodex.webp"
              alt="SuicaoDex"
              width={613}
              height={148}
              className="h-10 w-auto"
            />
            <Image
              src="/brand/ayame.webp"
              alt=""
              width={512}
              height={614}
              className="h-25 w-auto"
            />
          </Link>
          <div className="flex flex-col items-end">
            <QuickSearch />
            <a
              href={`${primaryWebOrigin}/advanced-search`}
              target="_blank"
              rel="noopener noreferrer"
              className="hvn-advanced-search mt-2 flex items-center gap-1 text-sm font-semibold"
            >
              <Image
                src="/brand/search-plus.webp"
                alt=""
                width={24}
                height={24}
                className="size-4"
              />
              Tìm kiếm nâng cao
            </a>
          </div>
        </div>

        <div className="hvn-utility-bar -mt-4 flex h-7 w-full flex-row-reverse items-center justify-start gap-4 p-1">
          <NotificationPopover />
          <Link
            href="/my-library"
            className={buttonVariants({
              size: "icon-xs",
              variant: "ghost",
            })}
          >
            <img
              src="/brand/icon-of-bookmark-list.webp"
              width={18}
              height={18}
            />
          </Link>
          <Button size="icon-xs" variant="ghost">
            <img src="/brand/mail.webp" width={18} height={18} />
          </Button>
          <Button size="icon-xs" variant="ghost">
            <img src="/brand/mes.webp" width={18} height={18} />
          </Button>
        </div>
        <HeaderNavigation />
      </div>
    </header>
  )
}
