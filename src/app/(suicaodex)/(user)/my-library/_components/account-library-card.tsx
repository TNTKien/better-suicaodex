"use client";

import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import type { MangaLibraryEntry } from "@/lib/suicaodex/db";
import { updateMangaCategory, refreshMangaMetadata } from "@/lib/suicaodex/db";
import { generateSlug } from "@/lib/utils";
import { RefreshCw, X } from "lucide-react";
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
  const { id } = entry;
  const [title, setTitle] = useState(entry.title);
  const [coverId, setCoverId] = useState(entry.coverId);

  const displayTitle = title ?? id;
  const coverUrl = coverId
    ? `${siteConfig.weebdex.proxyURL}/covers/${id}/${coverId}.512.webp`
    : "/images/no-cover.webp";
  const slug = generateSlug(displayTitle);
  const { data: session } = useSession();
  const [isRemoving, setIsRemoving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    setIsRefreshing(true);
    try {
      const res = await refreshMangaMetadata(session.user.id, id);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        setTitle(res.title);
        setCoverId(res.coverId);
        toast.success("Đã cập nhật thông tin truyện!");
      }
    } catch {
      toast.error("Đã có lỗi xảy ra!");
    } finally {
      setIsRefreshing(false);
    }
  };

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
            <p className="text-base font-semibold line-clamp-2 text-white drop-shadow-xs">
              {displayTitle}
            </p>
          </div>
        </div>
      </NoPrefetchLink>

      {/* Refresh button */}
      <Button
        variant="secondary"
        size="icon-sm"
        className="absolute top-1 left-1 size-6"
        onClick={handleRefresh}
        disabled={isRefreshing}
        aria-label="Cập nhật thông tin truyện"
      >
        <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
      </Button>

      {/* Remove button */}
      <Button
        variant="destructive"
        size="icon-sm"
        className="absolute top-1 right-1 size-6"
        onClick={handleRemove}
        disabled={isRemoving}
        aria-label="Xóa khỏi thư viện"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
