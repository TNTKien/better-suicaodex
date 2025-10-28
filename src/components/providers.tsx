"use client";

import {
	Bar,
	Progress,
	AppProgressProvider as ProgressProvider,
} from "@bprogress/next";
import { Provider as JotaiProvider } from "jotai";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";
import { SWRConfig } from "swr";
import { NotificationProvider } from "./notification-provider";
import { ThemeWrapper } from "./Theme/theme-wrapper";
import { TooltipProvider } from "./ui/tooltip";

export function ThemeProvider({
	children,
	...props
}: React.ComponentProps<typeof NextThemesProvider>) {
	return (
		<JotaiProvider>
			<SWRConfig value={{ errorRetryCount: 3 }}>
				<NextThemesProvider {...props}>
					<ThemeWrapper>
						<ProgressProvider
							height="3px"
							options={{ showSpinner: false, template: null }}
							shallowRouting
						>
							<Progress>
								<Bar className="!bg-primary" />
							</Progress>
							<TooltipProvider delayDuration={0}>
								<SessionProvider>
									<NotificationProvider>{children}</NotificationProvider>
								</SessionProvider>
							</TooltipProvider>
						</ProgressProvider>
					</ThemeWrapper>
				</NextThemesProvider>
			</SWRConfig>
		</JotaiProvider>
	);
}
