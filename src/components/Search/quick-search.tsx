"use client";

import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { ArrowRight, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem } from "../ui/form";
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

const formSchema = z.object({
  query: z.string().min(1),
});

export default function QuickSearch() {
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mangas, setMangas] = useState<Manga[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  //const toggleExpanded = () => setExpanded((prev) => !prev);
  const [config] = useConfig();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const { query } = values;

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
  }

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

  return (
    <>
      <div
        className={cn("hidden md:flex relative grow justify-end z-10")}
        ref={containerRef}
      >
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            onChange={form.handleSubmit(onSubmit)}
            className="w-full"
          >
            <FormField
              control={form.control}
              name="query"
              render={({ field }) => (
                <FormItem className="flex items-center w-full justify-end space-y-0">
                  <FormControl>
                    <Input
                      autoComplete="off"
                      placeholder="Tìm kiếm..."
                      className={cn(
                        "bg-muted/50 hover:bg-accent focus:bg-background border-none h-8 shadow-xs",
                        "transition-all sm:pr-12 md:w-40 lg:w-56 xl:w-64",
                        "placeholder:text-current",
                        expanded &&
                          "shadow-md! bg-background md:w-full! lg:w-2/3!"
                      )}
                      onFocus={() => setExpanded(true)}
                      {...field}
                    />
                  </FormControl>
                  <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4" />
                </FormItem>
              )}
            />
          </form>
        </Form>

        {expanded && (
          <div
            className={cn(
              "absolute top-full mt-1 md:w-full lg:w-2/3 bg-background p-2 rounded-lg shadow-md z-50",
              "transition-all animate-in fade-in slide-in-from-top-2"
            )}
          >
            {form.getValues("query").length === 0 ? (
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
                    size="icon"
                    variant="ghost"
                    className="[&_svg]:size-6"
                  >
                    <Link href={`/advanced-search`}>
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
                <div className="grid gap-2 max-h-[80vh] overflow-y-auto">
                  {mangas.map((manga) => (
                    <Link
                      key={manga.id}
                      href={`/manga/${manga.id}`}
                      onClick={() => setExpanded(false)}
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
            "w-full max-w-full border-none top-0 translate-y-0 px-4 py-2",
            `theme-${config.theme}`,
            "[&>button]:hidden"
          )}
        >
          <DialogHeader>
            <DialogTitle className="hidden">Tìm kiếm nhanh</DialogTitle>
            <DialogDescription className="hidden">Tìm kiếm</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              onChange={form.handleSubmit(onSubmit)}
              className="w-full"
            >
              <FormField
                control={form.control}
                name="query"
                render={({ field }) => (
                  <FormItem className="flex items-center w-full justify-end gap-1.5 space-y-0">
                    <FormControl>
                      <Input
                        autoComplete="off"
                        placeholder="Tìm kiếm..."
                        className={cn(
                          "bg-secondary border-none h-8 shadow-xs"

                          // "placeholder:text-current"
                        )}
                        {...field}
                      />
                    </FormControl>
                    <Search className="absolute right-16 transform h-4 w-4" />

                    <DialogClose asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <X />
                      </Button>
                    </DialogClose>
                  </FormItem>
                )}
              />
            </form>
          </Form>

          <DialogFooter>
            <div>
              {form.getValues("query").length === 0 ? (
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
                    <Button
                      asChild
                      size="icon"
                      variant="ghost"
                      className="[&_svg]:size-6"
                    >
                      <Link href={`/advanced-search`}>
                        <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-lvh overflow-y-scroll pb-2">
                    {mangas.map((manga) => (
                      <Link key={manga.id} href={`/manga/${manga.id}`}>
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
