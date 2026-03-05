import { resolve } from "node:path";
// import { cloudflare } from "@cloudflare/vite-plugin";
import { serwist } from "@serwist/vite";
import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";
import { nitro } from "nitro/vite";

const SOURCEMAP_REPORTING_WARNING =
  "Error when using sourcemap for reporting an error";

function createSerwistPlugins(): Plugin[] {
  return serwist({
    swSrc: "src/sw.ts",
    swDest: "sw.js",
    globDirectory: ".output/public",
    rollupFormat: "iife",
    integration: {
      beforeBuildServiceWorker(options) {
        const publicDir = resolve(process.cwd(), ".output/public");
        options.injectManifest.globDirectory = publicDir;
        options.injectManifest.swDest = resolve(publicDir, "sw.js");
      },
    },
  });
}

export default defineConfig(() => {
  return {
    plugins: [
      vinext(),
      // cloudflare({
      //   viteEnvironment: {
      //     name: "rsc",
      //     childEnvironments: ["ssr"],
      //   },
      // }),
      nitro(),
      ...createSerwistPlugins(),
    ],
    optimizeDeps: {
      exclude: ["@tanstack/react-query", "@tanstack/query-core"],
    },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.message?.includes(SOURCEMAP_REPORTING_WARNING)) {
            return;
          }

          warn(warning);
        },
      },
    },
  };
});
