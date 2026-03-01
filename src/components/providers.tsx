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
import { SessionProvider } from "next-auth/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
    },
  },
});

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <JotaiProvider>
      <QueryClientProvider client={queryClient}>
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
              <TooltipProvider delayDuration={0}>
                <SessionProvider>
                  {children}
                </SessionProvider>
              </TooltipProvider>
            </ProgressProvider>
          </ThemeWrapper>
        </NextThemesProvider>
      </QueryClientProvider>
    </JotaiProvider>
  );
}
