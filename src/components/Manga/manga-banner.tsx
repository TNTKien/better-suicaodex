import { cn, getCoverImageUrl } from "@/lib/utils";

interface BannerProps {
  id?: string;
  src: string;
}

export default function Banner({ id, src }: BannerProps) {
  const coverURL = id ? getCoverImageUrl(id, src, "256") : src;

  return (
    <>
      {/* <div
        className="fixed top-0 left-0 z-[-2] w-full h-[640px] blur-xl bg-background"
        style={{
          backgroundImage: `url('${coverURL}')`,
          backgroundPosition: "center 35%",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      ></div> */}

      {/* <div className="absolute top-70 left-0 z-[-1] w-full min-h-screen bg-background"></div> */}

      <div className="absolute h-70 z-[-2] w-auto left-0 right-0 top-0 block">
        <div
          className={cn(
            "absolute h-70 w-full",
            "transition-[width] duration-150 ease-in-out",
            "bg-no-repeat bg-cover bg-position-[center_top_33%] bg-fixed"
          )}
          style={{ backgroundImage: `url('${coverURL}')` }}
        ></div>
        <div
          className={cn(
            "absolute h-70 w-auto inset-0 pointer-events-none",
            "backdrop-blur-none md:backdrop-blur-xs",
            "bg-linear-to-r from-black/65 to-transparent"
          )}
        ></div>

        <div
          className={cn(
            "md:hidden",
            "absolute h-70 w-auto inset-0 pointer-events-none backdrop-blur-[2px]",
            "bg-linear-to-b from-background/5 to-background backdrop-blur-[1px]"
          )}
        ></div>
      </div>
    </>
  );
}
