"use client";

import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import type { MangaLibraryEntry } from "@/lib/suicaodex/db";
import { updateMangaCategory } from "@/lib/suicaodex/db";
import { generateSlug } from "@/lib/utils";
import { X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { toast } from "sonner";

interface AccountLibraryCardProps {
  entry: MangaLibraryEntry;
  onRemoved?: (mangaId: string) => void;
}

export default function AccountLibraryCard({
  entry,
  onRemoved,
}: AccountLibraryCardProps) {
  const { id, title, coverId } = entry;
  const displayTitle = title ?? id;
  const coverUrl = coverId
    ? `${siteConfig.weebdex.proxyURL}/covers/${id}/${coverId}.512.webp`
    : "/images/shutup.webp";
  const slug = generateSlug(displayTitle);
  const { data: session } = useSession();
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    setIsRemoving(true);
    try {
      const res = await updateMangaCategory(session.user.id, id, "NONE");
      if (res.status === 200) {
        toast.success("Đã xóa khỏi thư viện!");
        onRemoved?.(id);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="relative group rounded-sm overflow-hidden shadow-md">
      <NoPrefetchLink href={`/manga/${id}/${slug}`}>
        <div className="relative">
          <LazyLoadImage
            wrapperClassName="block! w-full aspect-5/7"
            placeholderSrc="/images/place-doro.webp"
            className="w-full h-auto aspect-5/7 object-cover rounded-sm"
            src={coverUrl}
            alt={`Ảnh bìa ${displayTitle}`}
            onError={(e) => {
              e.currentTarget.src = "/images/xidoco.webp";
            }}
          />
          {/* Gradient title overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-linear-to-t from-black rounded-b-sm flex items-end p-2">
            <p className="text-sm font-semibold line-clamp-2 text-white drop-shadow-xs">
              {displayTitle}
            </p>
          </div>
        </div>
      </NoPrefetchLink>

      {/* Remove button */}
      <Button
        variant="destructive"
        size="icon-sm"
        className="absolute top-1 right-1 size-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleRemove}
        disabled={isRemoving}
        aria-label="Xóa khỏi thư viện"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
