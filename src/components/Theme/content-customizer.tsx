"use client";

import * as React from "react";
import { Eye, EyeOff, Globe, Repeat, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfig } from "@/hooks/use-config";
import "@/styles/mdx.css";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "../ui/drawer";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ThemeWrapper } from "./theme-wrapper";
import { Label } from "../ui/label";
import { Skeleton } from "../ui/skeleton";
import { SidebarMenuButton } from "../ui/sidebar";
import { GB, VN } from "country-flag-icons/react/3x2";

export function ContentCustomizer() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Drawer>
        <DrawerTrigger asChild>
          <SidebarMenuButton asChild tooltip="Nội dung" className="md:hidden">
            <div>
              <SlidersHorizontal />
              <span>Nội dung</span>
            </div>
          </SidebarMenuButton>
        </DrawerTrigger>
        <DrawerTitle className="hidden"></DrawerTitle>
        <DrawerDescription className="hidden"></DrawerDescription>
        <DrawerContent className="p-6 pt-0">
          <Customizer />
        </DrawerContent>
      </Drawer>
      <div className="hidden items-center md:flex grow">
        <Popover>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              asChild
              tooltip="Nội dung"
              className="cursor-pointer"
            >
              <div>
                <SlidersHorizontal />
                <span>Nội dung</span>
              </div>
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="z-40 w-[340px] rounded-xl bg-white p-6 dark:bg-zinc-950 mr-2"
          >
            <Customizer />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function Customizer() {
  const [mounted, setMounted] = React.useState(false);
  const [config, setConfig] = useConfig();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ThemeWrapper
      defaultTheme="zinc"
      className="flex flex-col space-y-4 md:space-y-6"
    >
      <div className="flex items-start pt-4 md:pt-0">
        <div className="space-y-1 pr-2">
          <div className="font-semibold leading-none tracking-tight">
            Tuỳ chỉnh nội dung
          </div>
          <div className="text-xs text-muted-foreground">
            Lọc truyện theo sở thích của bạn
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto rounded-[0.5rem]"
          onClick={() => {
            setConfig({
              ...config,
              translatedLanguage: ["vi"],
              r18: false,
            });
          }}
        >
          <Repeat />
          <span className="sr-only">Reset</span>
        </Button>
      </div>
      <div className="flex flex-1 flex-col space-y-4 md:space-y-6">
        <div className="space-y-1.5">
          <Label className="font-semibold">Ngôn ngữ bản dịch</Label>
          <div className="grid grid-cols-3 gap-2">
            {mounted ? (
              <>
                <Button
                  variant={"outline"}
                  size="sm"
                  onClick={() => {
                    setConfig({
                      ...config,
                      translatedLanguage: ["vi"],
                    });
                  }}
                  className={cn(
                    "justify-start",
                    JSON.stringify(config.translatedLanguage) ===
                      JSON.stringify(["vi"]) && "border-2 border-primary"
                  )}
                >
                  <VN className="h-5 w-5" />
                  T. Việt
                </Button>

                <Button
                  variant={"outline"}
                  size="sm"
                  onClick={() => {
                    setConfig({
                      ...config,
                      translatedLanguage: ["en"],
                    });
                  }}
                  className={cn(
                    "justify-start",
                    JSON.stringify(config.translatedLanguage) ===
                      JSON.stringify(["en"]) && "border-2 border-primary"
                  )}
                >
                  <GB className="h-5 w-5" />
                  T. Anh
                </Button>

                <Button
                  variant={"outline"}
                  size="sm"
                  onClick={() => {
                    setConfig({
                      ...config,
                      translatedLanguage: ["vi", "en"],
                    });
                  }}
                  className={cn(
                    "justify-start",
                    JSON.stringify(config.translatedLanguage) ===
                      JSON.stringify(["vi", "en"]) && "border-2 border-primary"
                  )}
                >
                  <Globe className="w-5 h-5" />
                  Cả 2
                </Button>
              </>
            ) : (
              <>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="font-semibold">R18 (Sếch)</Label>
          <div className="grid grid-cols-3 gap-2">
            {mounted ? (
              <>
                <Button
                  variant={"outline"}
                  size="sm"
                  onClick={() =>
                    setConfig({
                      ...config,
                      r18: true,
                    })
                  }
                  className={cn(config.r18 && "border-2 border-primary")}
                >
                  <Eye className="mr-1 -translate-x-1" />
                  Hiện
                </Button>
                <Button
                  variant={"outline"}
                  size="sm"
                  onClick={() =>
                    setConfig({
                      ...config,
                      r18: false,
                    })
                  }
                  className={cn(!config.r18 && "border-2 border-primary")}
                >
                  <EyeOff className="mr-1 -translate-x-1" />
                  Ẩn
                </Button>
              </>
            ) : (
              <>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </>
            )}
          </div>
        </div>
      </div>
    </ThemeWrapper>
  );
}
