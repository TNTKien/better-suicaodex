"use client";

import {
  Status,
  StatusIndicator,
  StatusLabel,
} from "@/components/kibo-ui/status";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { BugIcon, HomeIcon } from "lucide-react";
import Link from "next/link";
import { Pixelify_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const pixelify = Pixelify_Sans({ subsets: ["latin"] });

export default function NotFoundPage() {
  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Backdrop: gradient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 opacity-70 dark:opacity-60"
      >
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,theme(colors.blue.400),transparent)] blur-2xl" />
        <div className="absolute -bottom-16 -right-16 h-96 w-96 rounded-full bg-[radial-gradient(closest-side,theme(colors.purple.500),transparent)] blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,theme(colors.teal.400),transparent)] blur-2xl" />
      </div>

      {/* Backdrop: animated grid using conic gradient mask */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(120,120,120,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,120,120,0.12)_1px,transparent_1px)] bg-[size:40px_40px] [animation:grid-pan_16s_linear_infinite]" />
      </div>

      {/* Backdrop: subtle film grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.045]"
        style={{
          backgroundImage:
            'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2"/></filter><rect width="100%" height="100%" filter="url(%23n)"/></svg>\')',
          backgroundSize: "120px 120px",
          mixBlendMode: "overlay",
        }}
      />

      <section className="relative h-svh mx-auto flex max-w-7xl flex-col items-center justify-center px-6 py-24 sm:py-28 lg:py-32">
        <div className="mx-auto w-full max-w-2xl rounded-3xl border border-zinc-200/60 bg-white/70 p-6 md:p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-900/60">
          <div
            className={cn(
              "flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400",
              pixelify.className
            )}
          >
            <Status status="offline" className="rounded-full">
              <StatusIndicator />
              <StatusLabel>Error 404</StatusLabel>
            </Status>
            <span className="select-none">This page has wandered off</span>
          </div>

          <h1
            className={cn(
              "mt-5 bg-gradient-to-br from-blue-600 via-purple-600 to-teal-500 bg-clip-text text-6xl font-bold tracking-tight text-transparent sm:text-7xl",
              pixelify.className
            )}
          >
            Not found
          </h1>
          <p className="mt-4 max-w-prose text-balance text-base text-zinc-600 dark:text-zinc-300">
            Trang bạn tìm không tồn tại, đã bị di chuyển hoặc đang phát triển.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/">
                <HomeIcon /> Về trang chủ
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={siteConfig.links.facebook} target="_blank">
                <BugIcon />
                Báo lỗi
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Keyframes */}
      <style jsx>{`
        @keyframes grid-pan {
          to {
            transform: translateY(-40px);
          }
        }
      `}</style>
    </section>
  );
}
