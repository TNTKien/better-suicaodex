"use client";

import { Button } from "@/components/ui/button";
import useContentHeight from "@/hooks/use-content-height";
import { cn } from "@/lib/utils";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";

import MoeMangaSubInfo, { type MoeMangaSubInfoData } from "./moe-manga-subinfo";

interface MoeMangaDescriptionProps {
  content: string;
  maxHeight: number;
  subInfo?: MoeMangaSubInfoData;
}

export default function MoeMangaDescription({
  content,
  maxHeight,
  subInfo,
}: MoeMangaDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const { contentRef, fullHeight } = useContentHeight({ expanded });

  return (
    <div className="relative flex flex-col gap-1">
      <div
        className="h-auto overflow-hidden text-sm transition-[max-height,height]"
        style={{
          maxHeight: expanded ? fullHeight : maxHeight,
          maskImage:
            expanded || fullHeight <= maxHeight
              ? "none"
              : "linear-gradient(black 0%, black 60%, transparent 100%)",
        }}
      >
        <div ref={contentRef}>
          <Streamdown controls={{ table: false }} className="text-pretty">
            {content}
          </Streamdown>

          {subInfo ? (
            <div className={cn("pb-2 pt-4 xl:hidden")}>
              <MoeMangaSubInfo data={subInfo} />
            </div>
          ) : null}
        </div>
      </div>

      {fullHeight > maxHeight ? (
        <div
          className={cn(
            "flex w-full justify-center border-t transition-[border-color]",
            expanded ? "border-transparent" : "border-primary",
          )}
        >
          <Button
            size="sm"
            className="h-4 px-1! text-xs rounded-t-none"
            onClick={() => setExpanded((prev) => !prev)}
            variant={expanded ? "secondary" : "default"}
          >
            {expanded ? (
              <>
                <ChevronsUp />
                thu gọn
                <ChevronsUp />
              </>
            ) : (
              <>
                <ChevronsDown />
                xem thêm
                <ChevronsDown />
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
