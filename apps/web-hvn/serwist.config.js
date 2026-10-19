import { serwist } from "@serwist/next/config"
import process from "node:process"

export default serwist.withNextConfig(() => ({
  globPatterns: [],
  precachePrerendered: false,
  swDest: "public/sw.js",
  swSrc: "src/sw.ts",
  esbuildOptions: {
    define: {
      "process.env.NEXT_PUBLIC_ASSET_URL": JSON.stringify(
        process.env.NEXT_PUBLIC_ASSET_URL ?? "http://localhost:9000"
      ),
      "process.env.NEXT_PUBLIC_WEB_URL": JSON.stringify(
        process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"
      ),
    },
  },
}))
