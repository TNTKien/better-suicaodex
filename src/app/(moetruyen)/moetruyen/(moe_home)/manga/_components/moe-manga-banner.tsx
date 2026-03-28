import { LightRays } from "@/components/ui/light-rays";
import { cn } from "@/lib/utils";

interface MoeMangaBannerProps {
  coverUrl: string;
}

export default function MoeMangaBanner({ coverUrl }: MoeMangaBannerProps) {
  return (
    <div className="-mt-16 col-start-1 row-start-1 grid w-auto">
      <div className="md:sticky md:top-0 col-start-1 row-start-1 grid z-[-2] w-auto h-70">
        <div
          className={cn(
            "col-start-1 row-start-1 w-full",
            "transition-[width] duration-150 ease-in-out",
            "bg-no-repeat bg-cover bg-position-[center_top_25%]",
          )}
          style={{ backgroundImage: `url('${coverUrl}')` }}
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
        {/* <LightRays className="mt-70 hidden h-full md:block" /> */}
      </div>
    </div>
  );
}
