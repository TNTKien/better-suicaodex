"use client";
import { MainNav } from "@/components/Navbar/main-nav";
import { cn } from "@/lib/utils";
import useScrollOffset from "@/hooks/use-scroll-offset";
import { usePathname } from "next/navigation";
import { useConfig } from "@/hooks/use-config";
import QuickSearch from "@/components/Search/quick-search";
import { ModeSwitcher } from "@/components/Navbar/mode-switcher";

export function ReaderHeader() {
  const { isAtTop } = useScrollOffset();
  const pathname = usePathname();
  const [config] = useConfig();
  return (
    <header
      className={cn(
        "top-0 z-50 w-full transform transition-all duration-300",
        !pathname.includes("/chapter") && "sticky",
        !!pathname.includes("/chapter") && !!config.reader.header && "sticky",
        "px-4 md:px-8 lg:px-12",
        isAtTop && "bg-transparent",
        !isAtTop &&
          "bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60",
      )}
    >
      <div className="container-wrapper">
        <div className="flex h-12 items-center justify-between">
          <MainNav />
          <div className="flex grow items-center gap-2 justify-end">
            <QuickSearch />
            <ModeSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
