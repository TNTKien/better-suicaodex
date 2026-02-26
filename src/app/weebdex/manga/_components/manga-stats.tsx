import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";
import { Bookmark, EyeIcon, StarIcon } from "lucide-react";

interface MangaStatsProps {
  views: number;
  follows: number;
  size?: "sm" | "lg";
}

export default function MangaStats({
  views,
  follows,
  size = "sm",
}: MangaStatsProps) {
  const isLg = size === "lg";
  const textClass = isLg ? "text-base" : "text-sm";
  const iconClass = isLg ? "size-4.5!" : "size-4!";

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="ghost" className={cn("p-0 opacity-50", textClass)}>
        <StarIcon data-icon="inline-start" className={iconClass} />
        N/A
      </Badge>
      <Badge variant="ghost" className={cn("p-0", textClass)}>
        <EyeIcon data-icon="inline-start" className={iconClass} />
        {formatNumber(views)}
      </Badge>
      <Badge variant="ghost" className={cn("p-0", textClass)}>
        <Bookmark data-icon="inline-start" className={iconClass} />
        {formatNumber(follows)}
      </Badge>
    </div>
  );
}
