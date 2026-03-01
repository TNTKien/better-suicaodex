"use client";

import { useGetMangaIdCovers } from "@/lib/weebdex/hooks/cover/cover";
import { siteConfig } from "@/config/site";
import { BugIcon, Expand, ImageOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface MangaCoversTabProps {
  id: string;
}

export default function MangaCoversTab({ id }: MangaCoversTabProps) {
  const { data, error, isLoading } = useGetMangaIdCovers(id, {
    query: {
      queryKey: ["weebdex-manga-covers", id],
      refetchInterval: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
    },
  });

  const covers = data?.status === 200 ? data.data : [];
  const [loaded, setLoaded] = useState(false);

  if (isLoading)
    return (
      <div className="flex justify-center items-center w-full h-16">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );

  if (error || data?.status !== 200) {
    return (
      <Empty className="bg-muted/30 h-full mt-2">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BugIcon />
          </EmptyMedia>
          <EmptyTitle>Lỗi mất rồi 🤪</EmptyTitle>
          <EmptyDescription className="max-w-xs text-pretty">
            Có lỗi xảy ra, thử F5 xem sao nhé
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!covers || covers.length === 0) {
    return (
      <Empty className="bg-muted/30 h-full mt-2">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ImageOff />
          </EmptyMedia>
          <EmptyTitle>Không có kết quả</EmptyTitle>
          <EmptyDescription className="max-w-xs text-pretty">
            Truyện mà không có ảnh bìa, lạ vậy ta?
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {covers.map((cover) => {
        const coverExt = cover.ext || ".webp";
        const cover_thumbnail = `${siteConfig.weebdex.proxyURL}/covers/${id}/${cover.id}.512.webp`;
        const cover_full = `${siteConfig.weebdex.proxyURL}/covers/${id}/${cover.id}${coverExt}`;

        return (
          <Card
            key={cover.id}
            className="relative rounded-sm shadow-md drop-shadow-md transition-colors duration-200 w-full border-none"
          >
            <Dialog>
              <DialogTrigger className="z-10 flex opacity-0 hover:opacity-100 transition-opacity items-center justify-center absolute inset-0 bg-black/50 rounded-sm cursor-pointer">
                <Expand size={45} color="white" />
              </DialogTrigger>

              <DialogContent className="[&>button]:hidden bg-transparent border-none border-0 shadow-none p-0 w-full sm:max-w-full h-auto rounded-none! justify-center ring-0!">
                <DialogTitle className="hidden"></DialogTitle>
                <DialogDescription className="hidden"></DialogDescription>

                <DialogClose className="fixed inset-0 z-0 block! cursor-default" />
                <div className="max-w-[90vw] md:max-w-screen max-h-[90vh] lg:max-h-screen flex justify-center items-center relative z-10">
                  <div className="absolute bg-secondary p-5 rounded-sm">
                    <Loader2 className="animate-spin" size={50} />
                  </div>
                  <img
                    src={cover_full}
                    alt={`Ảnh bìa ${cover.volume}`}
                    className="max-h-full max-w-full object-cover z-20"
                    fetchPriority="high"
                    onError={(e) => {
                      e.currentTarget.src = "/images/xidoco.webp";
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>

            <CardContent className="p-0 w-full">
              <LazyLoadImage
                wrapperClassName={cn(
                  "block! rounded-sm object-cover w-full",
                  !loaded && "aspect-5/7",
                )}
                placeholderSrc="/images/place-doro.webp"
                className={cn(
                  "w-full rounded-sm block object-cover aspect-5/7",
                )}
                src={cover_thumbnail}
                alt={`Ảnh bìa tập ${cover.volume}`}
                onLoad={() => setLoaded(true)}
                onError={(e) => {
                  e.currentTarget.src = "/images/xidoco.webp";
                }}
              />
            </CardContent>
            <CardFooter className="absolute bottom-0 p-2 bg-linear-to-t from-black w-full rounded-b-sm dark:rounded-b-none max-h-full items-end">
              <p className="text-base font-semibold line-clamp-1 break-all hover:line-clamp-none text-white drop-shadow-xs">
                {cover.volume ? `Volume ${cover.volume}` : "No Volume"}
              </p>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
