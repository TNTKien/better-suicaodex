import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
// import { cloudflare } from "@cloudflare/vite-plugin";
import { serwist } from "@serwist/vite";
import vinext from "vinext";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { nitro } from "nitro/vite";

const SOURCEMAP_REPORTING_WARNING =
  "Error when using sourcemap for reporting an error";

function createSerwistPlugins(enablePwa: boolean): Plugin[] {
  const buildStartedAt = Date.now();
  let hasGeneratedServiceWorker = false;

  const variants = [
    {
      globDirectory: "dist/client",
      assetsDir: "dist/client/assets",
    },
    {
      globDirectory: ".output/public",
      assetsDir: ".output/public/assets",
    },
  ];

  return variants.flatMap(({ globDirectory, assetsDir }) => {
    const plugins = serwist({
      disable: !enablePwa,
      swSrc: "src/sw.ts",
      swDest: "sw.js",
      globDirectory,
      rollupFormat: "iife",
    });

    const serwistBuildPlugin = plugins.find(
      (plugin) => plugin.name === "@serwist/vite:build",
    );

    if (
      serwistBuildPlugin &&
      serwistBuildPlugin.closeBundle &&
      typeof serwistBuildPlugin.closeBundle === "object" &&
      "handler" in serwistBuildPlugin.closeBundle &&
      typeof serwistBuildPlugin.closeBundle.handler === "function"
    ) {
      const originalHandler = serwistBuildPlugin.closeBundle.handler;

      serwistBuildPlugin.closeBundle = {
        ...serwistBuildPlugin.closeBundle,
        async handler(...args) {
          if (hasGeneratedServiceWorker) return;

          const clientAssetsDir = resolve(process.cwd(), assetsDir);
          const hasFreshClientBundle =
            existsSync(clientAssetsDir) &&
            readdirSync(clientAssetsDir)
              .filter((file) => file.endsWith(".js"))
              .some(
                (file) =>
                  statSync(resolve(clientAssetsDir, file)).mtimeMs >=
                  buildStartedAt,
              );

          if (!hasFreshClientBundle) return;

          hasGeneratedServiceWorker = true;
          await originalHandler.apply(this, args);

          const generatedSw = resolve(process.cwd(), "dist/sw.js");
          const finalSw = resolve(process.cwd(), assetsDir, "..", "sw.js");

          if (existsSync(generatedSw)) {
            copyFileSync(generatedSw, finalSw);
          }
        },
      };
    }

    return plugins;
  });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const enablePwa = env.NEXT_PUBLIC_ENABLE_PWA === "true";

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
      ...createSerwistPlugins(enablePwa),
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
