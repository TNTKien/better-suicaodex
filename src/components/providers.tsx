"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { TooltipProvider } from "./ui/tooltip";
import {
  Bar,
  Progress,
  AppProgressProvider as ProgressProvider,
} from "@bprogress/next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeWrapper } from "./theme/theme-wrapper";
import { RuntimeErrorReporter } from "./runtime-error-reporter";

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
    <QueryClientProvider client={queryClient}>
      <RuntimeErrorReporter />
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
    </QueryClientProvider>
  );
}
