"use client";
import { usePathname } from "next/navigation";
import { MainNav } from "@/components/Navbar/main-nav";
import { useConfig } from "@/hooks/use-config";
import useScrollOffset from "@/hooks/use-scroll-offset";
import { cn } from "@/lib/utils";
import QuickSearch from "../Search/quick-search";
import { SidebarTrigger } from "../ui/sidebar";
import { ModeSwitcher } from "./mode-switcher";

export function SiteHeader() {
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
					"bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
			)}
		>
			<div className="container-wrapper">
				<div className="flex h-12 items-center justify-between">
					<MainNav />
					{/* <MobileNav /> */}
					<div className="flex flex-grow items-center gap-2 justify-end">
						<QuickSearch />

						<nav className="flex items-center gap-2">
							<ModeSwitcher />
							<SidebarTrigger className="w-8 h-8 bg-muted/50 shadow-sm" />
						</nav>
					</div>
				</div>
			</div>
		</header>
	);
}
