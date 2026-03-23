import { LightRays } from "@/components/ui/light-rays";
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
    : "/images/no-cover.webp";

  return (
    <div className="-mt-16 col-start-1 row-start-1 grid w-auto">
      <div className="md:sticky md:top-0 col-start-1 row-start-1 grid z-[-2] w-auto h-70">
        <div
          className={cn(
            "col-start-1 row-start-1 w-full",
            "transition-[width] duration-150 ease-in-out",
            "bg-no-repeat bg-cover bg-position-[center_top_25%]",
          )}
          style={{ backgroundImage: `url('${cover_url}')` }}
        />
        <div
          className={cn(
            "col-start-1 row-start-1 w-auto inset-0 pointer-events-none",
            "backdrop-blur-none md:backdrop-blur-xs",
            "bg-linear-to-r from-background/65 to-transparent",
          )}
        />

        <div
          className={cn(
            "md:hidden",
            "col-start-1 row-start-1 w-auto inset-0 pointer-events-none backdrop-blur-[1px]",
            "bg-linear-to-b from-background/5 to-background",
          )}
        />
      </div>

      <div className="mt-70 bg-background col-start-1 row-start-1">
        <LightRays className="mt-70 hidden md:block"/>
      </div>
    </div>
  );
}
