"use client";

import * as React from "react";
import {
  Check,
  MonitorCog,
  Moon,
  Palette,
  Repeat,
  Square,
  SquareCheckBigIcon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
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
import { baseColors } from "@/config/base-colors";
import { SidebarMenuButton } from "../ui/sidebar";
import { presetThemes } from "@/config/preset-themes";

export function ThemeCustomizer() {
  // const [config, setConfig] = useConfig();
  // const { resolvedTheme: mode } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Drawer>
        <DrawerTrigger asChild>
          <SidebarMenuButton asChild tooltip="Giao diện" className="md:hidden">
            <div>
              <Palette />
              <span>Giao diện</span>
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
              tooltip="Giao diện"
              className="cursor-pointer"
            >
              <div>
                <Palette />
                <span>Giao diện</span>
              </div>
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="z-40 w-[380px] rounded-xl bg-white p-6 dark:bg-zinc-950 mr-2"
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
  const {
    setTheme: setMode,
    resolvedTheme: mode,
    theme: unResolvedTheme,
  } = useTheme();
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
            Tuỳ chỉnh giao diện
          </div>
          <div className="text-xs text-muted-foreground">
            Cứ chọn màu bạn thích nha!
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto rounded-[0.5rem]"
          onClick={() => {
            setConfig({
              ...config,
              theme: "zinc",
              radius: 0.5,
            });
          }}
        >
          <Repeat />
          <span className="sr-only">Reset</span>
        </Button>
      </div>
      <div className="flex flex-1 flex-col space-y-4 md:space-y-6">
        <div className="space-y-1.5">
          <Label className="font-semibold">Màu sắc</Label>
          <div className="grid grid-cols-3 gap-2">
            {baseColors
              .filter(
                (theme) => !["stone", "gray", "neutral"].includes(theme.name)
              )
              .map((theme) => {
                const isActive = config.theme === theme.name;

                return mounted ? (
                  <Button
                    variant={"outline"}
                    size="sm"
                    key={theme.name}
                    onClick={() => {
                      setConfig({
                        ...config,
                        theme: theme.name,
                      });
                    }}
                    className={cn(
                      "justify-start",
                      isActive && "border-2 border-primary!"
                    )}
                    style={
                      {
                        "--theme-primary": `hsl(${
                          theme?.activeColor[mode === "dark" ? "dark" : "light"]
                        })`,
                      } as React.CSSProperties
                    }
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 -translate-x-1 items-center justify-center rounded-full bg-(--theme-primary)"
                      )}
                    >
                      {isActive && <Check className="size-3 text-white" />}
                    </span>
                    {theme.label}
                  </Button>
                ) : (
                  <Skeleton className="h-8 w-full" key={theme.name} />
                );
              })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="font-semibold">Test</Label>
          <div className="grid grid-cols-3 gap-2">
            {presetThemes.map((theme) => {
              const isActive = config.theme === theme.name;
              return mounted ? (
                <Button
                  key={theme.name}
                  variant={"outline"}
                  size="sm"
                  onClick={() => {
                    setConfig({
                      ...config,
                      theme: theme.name,
                    });
                  }}
                  className={cn(
                    "justify-start",
                    isActive && "border-2 border-primary!"
                  )}
                  style={
                    {
                      "--theme-primary": `hsl(${
                        theme?.activeColor[mode === "dark" ? "dark" : "light"]
                      })`,
                    } as React.CSSProperties
                  }
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 -translate-x-1 items-center justify-center rounded-full bg-(--theme-primary)"
                    )}
                  >
                    {isActive && <Check className="size-3 text-white" />}
                  </span>
                  {theme.label}
                </Button>
              ) : (
                <Skeleton className="h-8 w-full" key={theme.name} />
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="font-semibold">Chế độ</Label>
          <div className="grid grid-cols-3 gap-2">
            {mounted ? (
              <>
                <Button
                  variant={"outline"}
                  size="sm"
                  onClick={() => setMode("light")}
                  className={cn(
                    unResolvedTheme === "light" && "border-2 border-primary!"
                  )}
                >
                  <Sun />
                  Sáng
                </Button>
                <Button
                  variant={"outline"}
                  size="sm"
                  onClick={() => setMode("dark")}
                  className={cn(
                    unResolvedTheme === "dark" && "border-2 border-primary!"
                  )}
                >
                  <Moon />
                  Tối
                </Button>
                <Button
                  variant={"outline"}
                  size="sm"
                  onClick={() => setMode("system")}
                  className={cn(
                    unResolvedTheme === "system" && "border-2 border-primary!"
                  )}
                >
                  <MonitorCog />
                  Hệ thống
                </Button>
              </>
            ) : (
              <>
                <Skeleton className="h-8 w-full" />
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

// const BASE_STYLES_WITH_VARIABLES = `
// @layer base {
//   :root {
//     --background: <%- colors.light["background"] %>;
//     --foreground: <%- colors.light["foreground"] %>;
//     --card: <%- colors.light["card"] %>;
//     --card-foreground: <%- colors.light["card-foreground"] %>;
//     --popover: <%- colors.light["popover"] %>;
//     --popover-foreground: <%- colors.light["popover-foreground"] %>;
//     --primary: <%- colors.light["primary"] %>;
//     --primary-foreground: <%- colors.light["primary-foreground"] %>;
//     --secondary: <%- colors.light["secondary"] %>;
//     --secondary-foreground: <%- colors.light["secondary-foreground"] %>;
//     --muted: <%- colors.light["muted"] %>;
//     --muted-foreground: <%- colors.light["muted-foreground"] %>;
//     --accent: <%- colors.light["accent"] %>;
//     --accent-foreground: <%- colors.light["accent-foreground"] %>;
//     --destructive: <%- colors.light["destructive"] %>;
//     --destructive-foreground: <%- colors.light["destructive-foreground"] %>;
//     --border: <%- colors.light["border"] %>;
//     --input: <%- colors.light["input"] %>;
//     --ring: <%- colors.light["ring-3"] %>;
//     --radius: <%- radius %>rem;
//     --chart-1: <%- colors.light["chart-1"] %>;
//     --chart-2: <%- colors.light["chart-2"] %>;
//     --chart-3: <%- colors.light["chart-3"] %>;
//     --chart-4: <%- colors.light["chart-4"] %>;
//     --chart-5: <%- colors.light["chart-5"] %>;
//   }

//   .dark {
//     --background: <%- colors.dark["background"] %>;
//     --foreground: <%- colors.dark["foreground"] %>;
//     --card: <%- colors.dark["card"] %>;
//     --card-foreground: <%- colors.dark["card-foreground"] %>;
//     --popover: <%- colors.dark["popover"] %>;
//     --popover-foreground: <%- colors.dark["popover-foreground"] %>;
//     --primary: <%- colors.dark["primary"] %>;
//     --primary-foreground: <%- colors.dark["primary-foreground"] %>;
//     --secondary: <%- colors.dark["secondary"] %>;
//     --secondary-foreground: <%- colors.dark["secondary-foreground"] %>;
//     --muted: <%- colors.dark["muted"] %>;
//     --muted-foreground: <%- colors.dark["muted-foreground"] %>;
//     --accent: <%- colors.dark["accent"] %>;
//     --accent-foreground: <%- colors.dark["accent-foreground"] %>;
//     --destructive: <%- colors.dark["destructive"] %>;
//     --destructive-foreground: <%- colors.dark["destructive-foreground"] %>;
//     --border: <%- colors.dark["border"] %>;
//     --input: <%- colors.dark["input"] %>;
//     --ring: <%- colors.dark["ring-3"] %>;
//     --chart-1: <%- colors.dark["chart-1"] %>;
//     --chart-2: <%- colors.dark["chart-2"] %>;
//     --chart-3: <%- colors.dark["chart-3"] %>;
//     --chart-4: <%- colors.dark["chart-4"] %>;
//     --chart-5: <%- colors.dark["chart-5"] %>;
//   }
// }
// `;
