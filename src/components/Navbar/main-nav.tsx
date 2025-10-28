"use client";

import Image from "next/image";
import Link from "next/link";
// import { useIsMobile } from "@/hooks/use-mobile";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import useScrollOffset from "@/hooks/use-scroll-offset";
import { cn } from "@/lib/utils";
import { getLogo, logos } from "../logos";

export function MainNav() {
	const { isAtTop } = useScrollOffset();
	// const isMobile = useIsMobile();
	const pathname = usePathname();
	const [logoSrc, setLogoSrc] = useState<any>(null);

	useEffect(() => {
		const logosName = [
			"gehenna",
			"redwinter",
			"shanhaijing",
			"srt",
			"trinity",
			"valkyrie",
			"abydos",
			"arius",
			"millennium",
		];
		const randomLogo = logosName[Math.floor(Math.random() * logosName.length)];
		setLogoSrc(getLogo(randomLogo));
	}, []);

	return (
		<Link
			href="/"
			className="mr-4 flex items-center gap-0.5 justify-start lg:mr-6"
		>
			<Image
				src={logoSrc || logos.gehenna}
				alt="SuicaoDex's logo"
				className={cn(
					"h-8 w-auto grayscale contrast-150 dark:invert",
					pathname.includes("/manga") && "md:invert",
					!isAtTop && "invert-0 md:invert-0",
				)}
				quality={100}
				priority
			/>
			<Image
				src={logos.scdex}
				alt="SuicaoDex's logo"
				quality={100}
				priority
				className={cn(
					"h-[22px] w-auto drop-shadow-md dark:invert xs:hidden",
					pathname.includes("/manga") && "md:invert",
					// pathname.includes("/group/") && "md:invert",
					!isAtTop && "filter-none md:filter-none",
				)}
			/>
			<Image
				src={logos.suicaodex}
				alt="SuicaoDex's logo"
				quality={100}
				priority
				className={cn(
					"h-[22px] w-auto drop-shadow-md dark:invert hidden xs:flex",
					pathname.includes("/manga") && "md:invert",
					// pathname.includes("/group/") && "md:invert",
					!isAtTop && "filter-none md:filter-none",
				)}
			/>
		</Link>
	);
}
