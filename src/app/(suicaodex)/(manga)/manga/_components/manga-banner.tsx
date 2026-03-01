import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { Cover } from "@/lib/weebdex/model";
import { MANGA_COVER_EXT } from "@/types/types";

interface MangaBannerProps {
  manga_id: string;
  cover?: Cover;
  ext?: (typeof MANGA_COVER_EXT)[number];
}

export default function MangaBanner({
  manga_id,
  cover,
  ext,
}: MangaBannerProps) {
  const cover_ext = ext ? `.${ext}` : cover?.ext || ".webp";
  const cover_url = cover
    ? `${siteConfig.weebdex.proxyURL}/covers/${manga_id}/${cover.id}${cover_ext}`
    : "/images/shutup.webp";

  return (
    <div className="absolute h-70 z-[-2] w-auto left-0 right-0 top-0 block">
      <div
        className={cn(
          "absolute h-70 w-full",
          "transition-[width] duration-150 ease-in-out",
          "bg-no-repeat bg-cover bg-position-[center_top_33%] md:bg-fixed",
        )}
        style={{ backgroundImage: `url('${cover_url}')` }}
      ></div>
      <div
        className={cn(
          "absolute h-70 w-auto inset-0 pointer-events-none",
          "backdrop-blur-none md:backdrop-blur-xs",
          "bg-linear-to-r from-background/65 to-transparent",
        )}
      ></div>

      <div
        className={cn(
          "md:hidden",
          "absolute h-70 w-auto inset-0 pointer-events-none backdrop-blur-[1px]",
          "bg-linear-to-b from-background/5 to-background",
        )}
      ></div>
    </div>
  );
}
