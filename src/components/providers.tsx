"use client";

import * as React from "react";
import { Provider as JotaiProvider } from "jotai";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { TooltipProvider } from "./ui/tooltip";
import { ThemeWrapper } from "./Theme/theme-wrapper";
import {
  Bar,
  Progress,
  AppProgressProvider as ProgressProvider,
} from "@bprogress/next";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <JotaiProvider>
      <NextThemesProvider {...props}>
        <ThemeWrapper>
          <ProgressProvider
            height="3px"
            options={{ showSpinner: false, template: null }}
            shallowRouting
          >
            <Progress>
              <Bar className="bg-primary!" />
            </Progress>
            <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
          </ProgressProvider>
        </ThemeWrapper>
      </NextThemesProvider>
    </JotaiProvider>
  );
}
