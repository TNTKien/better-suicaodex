import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // webpackMemoryOptimizations: true,
  },
  // cacheComponents: true,
  images: {
    qualities: [25, 50, 75, 100],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.suicaodex.com",
        port: "",
        pathname: "/covers/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "api2.suicaodex.com",
        port: "",
        pathname: "/covers/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "clf.suicaodex.com",
        port: "",
        pathname: "/covers/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "cataas.com",
        port: "",
        pathname: "/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "moetruyen.net",
        port: "",
        pathname: "/uploads/covers/**",
      },
    ],
  },
  allowedDevOrigins: ["*.suicaodex.com", "suicaodex.com"],
  rewrites: () => [
    {
      source: "/manga-sitemap.xml",
      destination: "/manga-sitemap",
    },
    {
      source: "/manga-sitemap-:page.xml",
      destination: "/manga-sitemap/:page",
    },
  ],
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
      removeTracing: true,
      excludeReplayCompressionWorker: true,
      excludeReplayIframe: true,
      excludeReplayShadowDOM: true,
    },
  },
});
