import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";
import { BookmarkIcon, Eye, Star } from "lucide-react";

interface MoeMangaStatsProps {
  totalViews: number;
  bookmarkCount: number;
  size?: "sm" | "lg";
}

export default function MoeMangaStats({
  totalViews,
  bookmarkCount,
  size = "sm",
}: MoeMangaStatsProps) {
  const isLg = size === "lg";
  const textClass = isLg ? "text-base" : "text-sm";
  const iconClass = isLg ? "size-4.5!" : "size-4!";

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="ghost" className={cn("p-0 opacity-50", textClass)}>
        <Star data-icon="inline-start" className={iconClass} />
        N/A
      </Badge>
      <Badge variant="ghost" className={cn("p-0", textClass)}>
        <Eye data-icon="inline-start" className={iconClass} />
        {formatNumber(totalViews)}
      </Badge>
      <Badge variant="ghost" className={cn("p-0", textClass)}>
        <BookmarkIcon data-icon="inline-start" className={iconClass} />
        {formatNumber(bookmarkCount)}
      </Badge>
    </div>
  );
}
