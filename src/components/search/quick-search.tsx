"use client";

import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Input } from "../ui/input";
import { useConfig } from "@/hooks/use-config";
import { Skeleton } from "../ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import useKeyDown from "@/hooks/use-keydown";
import { Badge } from "../ui/badge";
import { useDebouncedValue } from "@mantine/hooks";

const QuickSearchResults = dynamic(() => import("./quick-search-results"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-2">
      <Skeleton className="w-[69px] h-5 rounded-sm bg-gray-500 mb-2" />
      <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
      <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
      <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
    </div>
  ),
});

export default function QuickSearch() {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm] = useDebouncedValue(searchTerm, 500);
  const trimmedSearchTerm = searchTerm.trim();
  const trimmedDebouncedTerm = debouncedTerm.trim();
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const [config] = useConfig();

  useKeyDown({ key: "k", ctrlKey: true }, () => {
    setExpanded(true);
    inputRef.current?.focus();
  });

  useKeyDown("Escape", () => {
    setExpanded(false);
    inputRef.current?.blur();
  });

  const clearSearch = () => {
    setSearchTerm("");
    inputRef.current?.focus();
  };

  const clearMobileSearch = () => {
    setSearchTerm("");
    mobileInputRef.current?.focus();
  };

  const renderResults = (maxHeight: string, onClose?: () => void) => {
    if (trimmedSearchTerm.length === 0) {
      return (
        <p className="text-muted-foreground">
          Nhập từ khoá đi mới tìm được chứ...
        </p>
      );
    }

    return (
      <QuickSearchResults
        searchTerm={searchTerm}
        debouncedTerm={trimmedDebouncedTerm}
        maxHeight={maxHeight}
        r18Enabled={config.r18}
        onClose={onClose}
      />
    );
  };

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex relative grow justify-end z-10">
        <div className="w-full">
          <div className="flex items-center w-full justify-end">
            <Input
              autoComplete="off"
              placeholder="Tìm kiếm..."
              className={cn(
                "bg-muted/50! hover:bg-accent! focus:bg-background! border-none h-8 shadow-xs",
                "transition-all sm:pr-12 md:w-40 lg:w-56 xl:w-64",
                "placeholder:text-current",
                expanded && "shadow-md! bg-background md:w-full! lg:w-2/3!",
              )}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setExpanded(true)}
              ref={inputRef}
            />
            {searchTerm.length === 0 ? (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <div
                  className={cn("hidden lg:flex gap-1", expanded && "hidden!")}
                >
                  <Badge
                    variant="default"
                    className="px-1 py-0 bg-primary/40 hover:bg-primary/40 rounded-sm"
                  >
                    Ctrl
                  </Badge>
                  <Badge
                    variant="default"
                    className="px-1 py-0 bg-primary/40 hover:bg-primary/40 rounded-sm"
                  >
                    K
                  </Badge>
                </div>
                <Search className="h-4 w-4" />
              </div>
            ) : (
              <Button
                className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 bg-primary rounded-sm"
                size="icon"
                onClick={clearSearch}
                type="button"
              >
                <X />
              </Button>
            )}
          </div>
        </div>

        {expanded && (
          <div
            id="expanded"
            className="absolute top-full mt-1 md:w-full lg:w-2/3 bg-background p-2 rounded-lg shadow-md z-50 transition-all animate-in fade-in slide-in-from-top-2"
          >
            {renderResults("max-h-[80vh]", () => setExpanded(false))}
          </div>
        )}
      </div>

      {/* Overlay */}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/30 dark:bg-white/30 h-lvh z-5"
          onMouseDown={() => setExpanded(false)}
        />
      )}

      {/* Mobile */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 bg-muted/50 px-0 inline-flex shadow-xs md:hidden"
          >
            <Search />
            <span className="sr-only">Tìm kiếm</span>
          </Button>
        </DialogTrigger>
        <DialogContent
          className={cn(
            "w-full max-w-full! border-none top-0 translate-y-0 px-4 py-2 rounded-none",
            `theme-${config.theme}`,
            "[&>button]:hidden",
          )}
        >
          <DialogHeader>
            <DialogTitle className="hidden">Tìm kiếm nhanh</DialogTitle>
            <DialogDescription className="hidden">Tìm kiếm</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-1.5">
            <Input
              autoComplete="off"
              placeholder="Tìm kiếm..."
              className="bg-secondary border-none h-8 shadow-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              ref={mobileInputRef}
            />
            {searchTerm.length === 0 ? (
              <Search className="absolute right-6 h-4 w-4" />
            ) : (
              <Button
                className="absolute right-6 h-4 w-4 bg-primary rounded-sm"
                size="icon"
                onClick={clearMobileSearch}
                type="button"
              >
                <X />
              </Button>
            )}
          </div>

          <DialogFooter>
            <div className="w-full">
              {renderResults("max-h-[322px] pb-2", () => setMobileOpen(false))}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
