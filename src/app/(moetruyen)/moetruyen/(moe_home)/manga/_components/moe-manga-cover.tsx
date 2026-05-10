"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getMoetruyenThumbnailCoverUrl } from "@/lib/moetruyen/cover-url";
import { cn } from "@/lib/utils";
import { Expand, Loader2 } from "lucide-react";
import { useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";

interface MoeMangaCoverProps {
  src: string | null;
  alt: string;
  wrapper?: string;
  className?: string;
  placeholder?: string;
  isExpandable?: boolean;
}

export default function MoeMangaCover({
  src,
  alt,
  wrapper,
  className,
  placeholder = "/images/place-doro.webp",
  isExpandable = false,
}: MoeMangaCoverProps) {
  const [loaded, setLoaded] = useState(false);
  const coverUrl = src ?? "/images/no-cover.webp";
  const thumbnailCoverUrl = getMoetruyenThumbnailCoverUrl(coverUrl);

  return (
    <div className="relative">
      {isExpandable ? (
        <Dialog>
          <DialogTrigger className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center rounded-sm bg-black/50 opacity-0 transition-opacity hover:opacity-100">
            <Expand size={50} color="white" />
          </DialogTrigger>

          <DialogContent className="justify-center rounded-none! border-0 border-none bg-transparent p-0 shadow-none ring-0! [&>button]:hidden sm:max-w-full">
            <DialogTitle className="hidden"></DialogTitle>
            <DialogDescription className="hidden"></DialogDescription>
            <DialogClose className="fixed inset-0 z-0 block! cursor-default" />

            <div className="relative z-10 flex max-h-[90vh] max-w-[90vw] items-center justify-center md:max-w-screen lg:max-h-screen">
              <div className="absolute rounded-sm bg-secondary p-5">
                <Loader2 className="animate-spin" size={50} />
              </div>
              <LazyLoadImage
                src={coverUrl}
                alt={`Ảnh bìa ${alt}`}
                className="z-20 max-h-full max-w-full object-cover"
                visibleByDefault
                onError={(event) => {
                  event.currentTarget.src = "/images/xidoco.webp";
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      <LazyLoadImage
        wrapperClassName={cn(
          "block! rounded-sm object-cover",
          !loaded && "aspect-5/7",
          wrapper,
        )}
        placeholderSrc={placeholder}
        src={thumbnailCoverUrl}
        alt={`Ảnh bìa ${alt}`}
        className={cn("block h-auto w-full rounded-sm", className)}
        onLoad={() => setLoaded(true)}
        onError={(event) => {
          event.currentTarget.src = "/images/xidoco.webp";
        }}
      />
    </div>
  );
}
