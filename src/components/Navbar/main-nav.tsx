"use client";

import Link from "next/link";
import useScrollOffset from "@/hooks/use-scroll-offset";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { logos } from "../logos";

export function MainNav() {
  const { isAtTop } = useScrollOffset();
  const pathname = usePathname();

  return (
    <Link
      href="/"
      className="mr-4 flex items-center gap-0.5 justify-start lg:mr-6"
    >
      <Image
        src={logos.gehenna}
        alt="SuicaoDex's logo"
        className={cn(
          "max-h-8 w-auto grayscale contrast-150 dark:invert",
          pathname.includes("/manga") && "invert",
          !isAtTop && "invert-0 md:invert-0"
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
          "max-h-[22px] w-auto drop-shadow-md dark:invert xs:hidden",
          pathname.includes("/manga") && "invert",
          // pathname.includes("/group/") && "md:invert",
          !isAtTop && "filter-none md:filter-none"
        )}
      />
      <Image
        src={logos.suicaodex}
        alt="SuicaoDex's logo"
        quality={100}
        priority
        className={cn(
          "max-h-[22px] w-auto drop-shadow-md dark:invert hidden xs:flex",
          pathname.includes("/manga") && "invert",
          // pathname.includes("/group/") && "md:invert",
          !isAtTop && "filter-none md:filter-none"
        )}
      />
    </Link>
  );
}
