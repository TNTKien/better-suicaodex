import { ChevronsDown, ChevronsUp, Loader2, Undo2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";
import { SiGoogletranslate } from "@icons-pack/react-simple-icons";
import { Button } from "../ui/button";
import useContentHeight from "@/hooks/use-content-height";
import { Manga } from "@/types/types";
import MangaSubInfo from "./manga-subinfo";

interface MangaDescriptionProps {
  content: string;
  language: "en" | "vi";
  maxHeight: number;
  manga?: Manga;
}

const MangaDescription = ({
  content,
  language,
  maxHeight,
  manga,
}: MangaDescriptionProps) => {
  const [state, setState] = useState({
    expanded: false,
    translated: false,
    translatedDesc: null as string | null,
    isLoading: false,
  });

  // Use the new useContentHeight hook
  const { contentRef, fullHeight } = useContentHeight({
    expanded: state.expanded,
    dependencies: [state.translated, state.translatedDesc],
  });

  const handleTranslate = async () => {
    if (state.translatedDesc) {
      setState((prev) => ({ ...prev, translated: !prev.translated }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(
          content
        )}`
      );
      const data = await response.json();
      const translatedText = data[0].map((part: any) => part[0]).join("");
      setState((prev) => ({
        ...prev,
        translatedDesc: translatedText,
        translated: true,
      }));
    } catch (error) {
      console.error("Lỗi dịch thuật:", error);
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleExpand = () => {
    setState((prev) => ({ ...prev, expanded: !prev.expanded }));
  };

  return (
    <div className="relative flex flex-col gap-1">
      <div
        className="overflow-hidden transition-[max-height,height] text-sm h-auto"
        style={{
          maxHeight: state.expanded ? fullHeight : maxHeight,
          maskImage:
            state.expanded || fullHeight <= maxHeight
              ? "none"
              : "linear-gradient(black 0%, black 60%, transparent 100%)",
        }}
      >
        <div ref={contentRef}>
          {!!content && (
            <Streamdown className="flex flex-col gap-3">
              {state.translated && state.translatedDesc
                ? state.translatedDesc
                : content}
            </Streamdown>
          )}

          {language === "en" && (
            <Button
              size="sm"
              className="rounded-sm text-xs transition opacity-50 hover:opacity-100 mt-2"
              onClick={handleTranslate}
              variant="ghost"
            >
              {state.isLoading ? (
                <Loader2 className="animate-spin" />
              ) : state.translated ? (
                <Undo2 />
              ) : (
                <SiGoogletranslate size={18} />
              )}
              {state.translated ? "Xem bản gốc" : "Dịch sang tiếng Việt"}
            </Button>
          )}

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
            state.expanded ? "border-transparent" : "border-primary"
          )}
        >
          <Button
            size="sm"
            className="rounded-t-none h-4 px-1! text-xs"
            onClick={handleExpand}
            variant={state.expanded ? "secondary" : "default"}
          >
            {state.expanded ? (
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
};

export default MangaDescription;
