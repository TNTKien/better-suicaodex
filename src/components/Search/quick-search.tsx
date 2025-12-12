"use client";

import { cn, generateSlug } from "@/lib/utils";
import { Button } from "../ui/button";
import { ArrowRight, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";
import { SearchManga } from "@/lib/mangadex/manga";
import { useConfig } from "@/hooks/use-config";
import { Manga } from "@/types/types";
import CompactCard from "./Result/compact-card";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import useKeyDown from "@/hooks/use-keydown";
import { Badge } from "../ui/badge";

export default function QuickSearch() {
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [config] = useConfig();

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

      try {
        setIsLoading(true);
        setError(false);

        const res = await SearchManga(query, config.r18);
        setMangas(res);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    },
    [config.r18]
  );

  const debouncedSearch = useCallback(
    (query: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (query && query.trim()) {
          handleSearch(query);
        }
      }, 500);
    },
    [handleSearch]
  );

  useEffect(() => {
    if (!searchTerm || searchTerm.length === 0) return;
    debouncedSearch(searchTerm);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchTerm, debouncedSearch]);

  useEffect(() => {
    if (expanded) {
      document.addEventListener("wheel", scrollLock, { passive: false });
    } else {
      document.removeEventListener("wheel", scrollLock);
    }
    return () => {
      document.removeEventListener("wheel", scrollLock);
    };
  }, [expanded]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useKeyDown({ key: "k", ctrlKey: true }, () => {
    setExpanded(true);
    if (inputRef.current) inputRef.current.focus();
  });

  useKeyDown("Escape", () => {
    setExpanded(false);
    if (inputRef.current) inputRef.current.blur();
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchTerm && searchTerm.trim()) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        handleSearch(searchTerm);
      }
    }
  };

  const handleMobileKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchTerm && searchTerm.trim()) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        handleSearch(searchTerm);
      }
    }
  };

  const clearSearch = (e: React.MouseEvent) => {
    e.preventDefault();
    setSearchTerm("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const clearMobileSearch = (e: React.MouseEvent) => {
    e.preventDefault();
    setSearchTerm("");
    if (mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  };

  return (
    <>
      <div
        className={cn("hidden md:flex relative grow justify-end z-10")}
        ref={containerRef}
      >
        <div className="w-full">
          <div className="flex items-center w-full justify-end space-y-0">
            <Input
              autoComplete="off"
              placeholder="Tìm kiếm..."
              className={cn(
                "bg-muted/50! hover:bg-accent! focus:bg-background! border-none h-8 shadow-xs",
                "transition-all sm:pr-12 md:w-40 lg:w-56 xl:w-64",
                "placeholder:text-current",
                expanded && "shadow-md! bg-background md:w-full! lg:w-2/3!"
              )}
              value={searchTerm}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setExpanded(true)}
              ref={inputRef}
            />
            {searchTerm.length === 0 ? (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-2 items-center">
                <div
                  className={cn(
                    "hidden lg:flex flex-row gap-1",
                    expanded && "hidden!"
                  )}
                >
                  <Badge
                    variant="default"
                    className="px-1 py-0 bg-primary/10 hover:bg-primary/10 text-secondary-foreground rounded-sm"
                  >
                    Ctrl
                  </Badge>
                  <Badge
                    variant="default"
                    className="px-1 py-0 bg-primary/10 hover:bg-primary/10 text-secondary-foreground rounded-sm"
                  >
                    K
                  </Badge>
                </div>
                <Search className="h-4 w-4" />
              </div>
            ) : (
              <Button
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 bg-primary rounded-sm"
                size="icon"
                onClick={clearSearch}
                type="button"
              >
                <X />
              </Button>
            )}
          </div>
        </div>

        {/* result popup */}
        {expanded && (
          <div
            id="expanded"
            className={cn(
              "absolute top-full mt-1 md:w-full lg:w-2/3 bg-background p-2 rounded-lg shadow-md z-50",
              "transition-all animate-in fade-in slide-in-from-top-2"
            )}
          >
            {searchTerm.length === 0 ? (
              <div className="text-gray-500">
                Nhập từ khoá đi mới tìm được chứ...
              </div>
            ) : isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="w-[69px] h-5 rounded-sm bg-gray-500 mb-2" />
                <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
                <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
                <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
              </div>
            ) : error ? (
              <div className="text-gray-500">Lỗi mất rồi 😭</div>
            ) : mangas.length > 0 ? (
              <>
                <div className="mb-2 flex justify-between items-center">
                  <p className="font-black text-xl">Manga</p>
                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="hover:text-primary hover:bg-transparent hover:underline"
                  >
                    <Link
                      href={`/advanced-search?q=${searchTerm}`}
                      onClick={() => setExpanded(false)}
                    >
                      Tìm kiếm nâng cao
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
                <div className="grid gap-2 max-h-[80vh] overflow-y-auto">
                  {mangas.map((manga) => (
                    <Link
                      key={manga.id}
                      href={`/manga/${manga.id}/${generateSlug(manga.title)}`}
                      onClick={() => setExpanded(false)}
                      prefetch={false}
                    >
                      <CompactCard manga={manga} />
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-gray-500">Không có kết quả</div>
            )}
          </div>
        )}
      </div>

      {/* overlay */}
      {expanded && (
        <div className="fixed inset-0 bg-black/30 dark:bg-white/30 h-lvh z-5" />
      )}

      <Dialog>
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
            "w-full max-w-full border-none top-0 translate-y-0 px-4 py-2 rounded-none",
            `theme-${config.theme}`,
            "[&>button]:hidden"
          )}
        >
          <DialogHeader>
            <DialogTitle className="hidden">Tìm kiếm nhanh</DialogTitle>
            <DialogDescription className="hidden">Tìm kiếm</DialogDescription>
          </DialogHeader>

          <div className="w-full">
            <div className="flex items-center w-full justify-end gap-1.5 space-y-0">
              <Input
                autoComplete="off"
                placeholder="Tìm kiếm..."
                className={cn("bg-secondary border-none h-8 shadow-xs")}
                value={searchTerm}
                onChange={handleInputChange}
                onKeyDown={handleMobileKeyDown}
                ref={mobileInputRef}
              />
              {searchTerm.length === 0 ? (
                <Search className="absolute right-6 transform h-4 w-4" />
              ) : (
                <Button
                  className="absolute right-6 transform h-4 w-4 bg-primary rounded-sm"
                  size="icon"
                  onClick={clearMobileSearch}
                  type="button"
                >
                  <X />
                </Button>
              )}

              {/* <DialogClose asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                >
                  <X />
                </Button>
              </DialogClose> */}
            </div>
          </div>

          <DialogFooter>
            <div>
              {searchTerm.length === 0 ? (
                <div className="text-gray-500">
                  Nhập từ khoá đi mới tìm được chứ...
                </div>
              ) : isLoading ? (
                <div className="flex flex-col gap-2 pb-2">
                  <Skeleton className="w-[69px] h-5 rounded-sm bg-gray-500 mb-2" />
                  <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
                  <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
                  <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
                </div>
              ) : error ? (
                <div className="text-gray-500">Lỗi mất rồi 😭</div>
              ) : mangas.length > 0 ? (
                <>
                  <div className="mb-2 flex justify-between items-center">
                    <p className="font-black text-xl">Manga</p>
                    <DialogClose asChild>
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="hover:text-primary hover:bg-transparent hover:underline"
                      >
                        <Link href={`/advanced-search?q=${searchTerm}`}>
                          Tìm kiếm nâng cao
                          <ArrowRight />
                        </Link>
                      </Button>
                    </DialogClose>
                  </div>
                  <div className="flex flex-col gap-2 max-h-[322px] overflow-y-auto pb-2">
                    {mangas.map((manga) => (
                      <Link
                        key={manga.id}
                        href={`/manga/${manga.id}/${generateSlug(manga.title)}`}
                        prefetch={false}
                      >
                        <DialogClose className="w-full text-start">
                          <CompactCard manga={manga} />
                        </DialogClose>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-gray-500">Không có kết quả</div>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function scrollLock(event: WheelEvent) {
  let target = event.target as Node;
  let isInResultPopup = false;

  while (target != null) {
    if (
      target.nodeName === "DIV" &&
      (target as HTMLElement).id === "expanded"
    ) {
      isInResultPopup = true;
      break;
    }
    target = target.parentNode as Node;
  }

  if (isInResultPopup) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
}
