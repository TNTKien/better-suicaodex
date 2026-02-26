"use client";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { Cover } from "@/lib/weebdex/model";
import { MANGA_COVER_EXT } from "@/types/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { Expand, Loader2 } from "lucide-react";
import { useState } from "react";

interface MangaCoverProps {
  manga_id: string;
  cover?: Cover;
  ext?: (typeof MANGA_COVER_EXT)[number];
  isExpandable?: boolean;
  alt: string;
  placeholder?: string;
  wrapper?: string;
  className?: string;
  preload?: boolean;
}

export default function MangaCover({
  manga_id,
  cover,
  ext,
  alt,
  placeholder,
  wrapper,
  className,
  isExpandable = false,
  preload = false,
}: MangaCoverProps) {
  const [loaded, setLoaded] = useState(false);
  if (!cover) {
    return (
      <div
        className={cn(
          "relative block rounded-sm object-cover aspect-5/7 overflow-hidden",
          wrapper,
        )}
      >
        <img
          src="/images/xidoco.webp"
          className={cn("h-auto w-full rounded-sm block", className)}
        />
      </div>
    );
  }

  const cover_ext = ext ? `.${ext}` : cover.ext || ".webp";
  const cover_url = `${siteConfig.weebdex.proxyURL}/covers/${manga_id}/${cover.id}${cover_ext}`;
  const cover_full = `${siteConfig.weebdex.proxyURL}/covers/${manga_id}/${cover.id}${cover.ext}`;

  return (
    <div className="relative">
      {isExpandable && (
        <Dialog>
          <DialogTrigger className="z-10 flex opacity-0 hover:opacity-100 transition-opacity items-center justify-center absolute inset-0 bg-black/50 rounded-sm cursor-pointer">
            <Expand size={50} color="white" />
          </DialogTrigger>

          <DialogContent className="[&>button]:hidden bg-transparent border-none border-0 shadow-none p-0 w-full h-auto rounded-none! justify-center sm:max-w-full">
            <DialogTitle className="hidden"></DialogTitle>
            <DialogDescription className="hidden"></DialogDescription>

            <DialogClose className="fixed inset-0 z-0 block! cursor-default" />
            <div className="max-w-[90vw] md:max-w-screen max-h-[90vh] lg:max-h-screen flex justify-center items-center relative z-10">
              <div className="absolute bg-secondary p-5 rounded-sm">
                <Loader2 className="animate-spin" size={50} />
              </div>
              <img
                src={cover_full}
                alt={`Ảnh bìa ${alt}`}
                className="max-h-full max-w-full object-cover z-20"
                fetchPriority="high"
                onError={(e) => {
                  e.currentTarget.src = "/images/xidoco.webp";
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <LazyLoadImage
        wrapperClassName={cn(
          "block! rounded-sm object-cover",
          !loaded && "aspect-5/7",
          wrapper,
        )}
        placeholderSrc={placeholder}
        className={cn("h-auto w-full rounded-sm block", className)}
        src={cover_url}
        alt={`Ảnh bìa ${alt}`}
        onLoad={() => setLoaded(true)}
        visibleByDefault={preload}
        onError={(e) => {
          e.currentTarget.src = "/images/xidoco.webp";
        }}
      />
    </div>
  );
}
