import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { serwist } from "@serwist/vite";
import vinext from "vinext";
import { defineConfig, loadEnv, type Plugin } from "vite";

const SOURCEMAP_REPORTING_WARNING =
  "Error when using sourcemap for reporting an error";

function createSerwistPlugins(enablePwa: boolean): Plugin[] {
  const buildStartedAt = Date.now();
  const plugins = serwist({
    disable: !enablePwa,
    swSrc: "src/sw.ts",
    swDest: "client/sw.js",
    globDirectory: "dist/client",
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
    let hasGeneratedServiceWorker = false;

    serwistBuildPlugin.closeBundle = {
      ...serwistBuildPlugin.closeBundle,
      async handler(...args) {
        if (hasGeneratedServiceWorker) return;

        const environmentName = (this as { environment?: { name?: string } })
          .environment?.name;
        const isSsrPhase = environmentName === "ssr";
        const clientAssetsDir = resolve(process.cwd(), "dist/client/assets");
        const hasFreshClientBundle =
          existsSync(clientAssetsDir) &&
          readdirSync(clientAssetsDir)
            .filter((file) => file.endsWith(".js"))
            .some(
              (file) =>
                statSync(resolve(clientAssetsDir, file)).mtimeMs >=
                buildStartedAt,
            );

        if (!isSsrPhase || !hasFreshClientBundle) return;

        hasGeneratedServiceWorker = true;
        await originalHandler.apply(this, args);
      },
    };
  }

  return plugins;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const enablePwa = env.NEXT_PUBLIC_ENABLE_PWA === "true";

  return {
    plugins: [vinext(), ...createSerwistPlugins(enablePwa)],
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
