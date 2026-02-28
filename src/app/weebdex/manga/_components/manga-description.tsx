"use client";

import useContentHeight from "@/hooks/use-content-height";
import { Manga } from "@/lib/weebdex/model";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ChevronsDown, ChevronsUp, Undo2 } from "lucide-react";
import { SiGoogletranslate } from "@icons-pack/react-simple-icons";
import { useQuery } from "@tanstack/react-query";
import MangaSubInfo from "./manga-subinfo";

interface MangaDescriptionProps {
  content: string;
  maxHeight: number;
  manga?: Manga;
}

export default function MangaDescription({
  content,
  maxHeight,
  manga,
}: MangaDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const [translated, setTranslated] = useState(false);
  const [shouldFetch, setShouldFetch] = useState(false);

  const { data: translatedDesc, isFetching } = useQuery({
    queryKey: ["translate", content],
    queryFn: async () => {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&q=${encodeURIComponent(
          content,
        )}`,
      );
      const data = await response.json();
      return data[0].map((part: any) => part[0]).join("") as string;
    },
    enabled: shouldFetch,
    staleTime: Infinity,
  });

  const { contentRef, fullHeight } = useContentHeight({
    expanded,
    dependencies: [translated, translatedDesc],
  });

  const handleTranslate = () => {
    if (translatedDesc) {
      setTranslated((prev) => !prev);
      return;
    }
    setShouldFetch(true);
    setTranslated(true);
  };

  const handleExpand = () => {
    setExpanded((prev) => !prev);
  };

  return (
    <div className="relative flex flex-col gap-1">
      <div
        className="overflow-hidden transition-[max-height,height] text-sm h-auto"
        style={{
          maxHeight: expanded ? fullHeight : maxHeight,
          maskImage:
            expanded || fullHeight <= maxHeight
              ? "none"
              : "linear-gradient(black 0%, black 60%, transparent 100%)",
        }}
      >
        <div ref={contentRef}>
          {!!content && (
            <Streamdown
              controls={{ table: false }}
              className="flex flex-col gap-3 text-pretty"
            >
              {translated && translatedDesc ? translatedDesc : content}
            </Streamdown>
          )}

          <Button
            size="sm"
            className="opacity-50 hover:opacity-100 mt-2"
            onClick={handleTranslate}
            variant="ghost"
          >
            {isFetching ? (
              <Spinner />
            ) : translated ? (
              <Undo2 />
            ) : (
              <SiGoogletranslate />
            )}
            {translated ? "Xem bản gốc" : "Dịch sang tiếng Việt"}
          </Button>

          {!!manga && (
            <div className={cn("xl:hidden", !!content ? "py-4" : "pb-2")}>
              <MangaSubInfo manga={manga} />
            </div>
          )}
        </div>
      </div>

      {fullHeight > maxHeight && (
        <div
          className={cn(
            "flex justify-center w-full border-t transition-[border-color]",
            expanded ? "border-transparent" : "border-primary",
          )}
        >
          <Button
            size="sm"
            className="rounded-t-none h-4 px-1! text-xs"
            onClick={handleExpand}
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
      )}
    </div>
  );
}
