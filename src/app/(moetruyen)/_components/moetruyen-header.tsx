"use client";

import { cn } from "@/lib/utils";
import useScrollOffset from "@/hooks/use-scroll-offset";
import QuickSearch from "@/components/search/quick-search";
import { usePathname } from "next/navigation";
import { useReaderStore } from "@/store/reader-store";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ModeSwitcher } from "@/components/layout/navbar/mode-switcher";
import Link from "next/link";
import Image from "next/image";
import { logos } from "@/components/logos";

export function MoetruyenHeader() {
  const { isAtTop } = useScrollOffset();
  const pathname = usePathname();
  const { header: readerHeader } = useReaderStore();
  return (
    <header
      className={cn(
        "top-0 z-50 w-full transform transition-all duration-300",
        !pathname.includes("/chapter") && "sticky",
        !!pathname.includes("/chapter") && !!readerHeader && "sticky",
        "px-4 md:px-8 lg:px-12",
        isAtTop && "bg-transparent",
        !isAtTop &&
          "bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60",
      )}
    >
      <div className="container-wrapper">
        <div className="flex h-12 items-center justify-between">
          <Link
            href="/moetruyen"
            className="mr-4 flex items-center gap-0.5 justify-start lg:mr-6"
          >
            <Image
              src={logos.gehenna}
              alt="SuicaoDex's logo"
              className={cn(
                "max-h-8 w-auto grayscale contrast-150 dark:invert",
                // pathname.includes("/manga") && "invert",
                !isAtTop && "invert-0 md:invert-0",
              )}
              quality={100}
              height={32}
              priority
            />
            <Image
              src={logos.scmoe}
              alt="SuicaoMoe's logo"
              quality={100}
              priority
              height={32}
              className={cn(
                "max-h-[22px] w-auto drop-shadow-md dark:invert xs:hidden",
                // pathname.includes("/manga") && "invert",
                // pathname.includes("/group/") && "md:invert",
                !isAtTop && "filter-none md:filter-none",
              )}
            />
            <Image
              src={logos.suicaomoe}
              alt="SuicaoMoe's logo"
              quality={100}
              priority
              className={cn(
                "max-h-[22px] w-auto drop-shadow-md dark:invert hidden xs:flex",
                // pathname.includes("/manga") && "invert",
                // pathname.includes("/group/") && "md:invert",
                !isAtTop && "filter-none md:filter-none",
              )}
            />
          </Link>
          {/* <MobileNav /> */}
          <div className="flex grow items-center gap-2 justify-end">
            <QuickSearch />

            <nav className="flex items-center gap-2">
              <ModeSwitcher />
              <SidebarTrigger className="w-8 h-8 bg-muted/50 shadow-xs" />
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
