import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BaseColor } from "@/config/base-colors";
import { PresetTheme } from "@/config/preset-themes";
import { createMigratingStorage } from "@/lib/zustand-migrate-storage";

type Config = {
  style: "new-york";
  theme: BaseColor["name"] | PresetTheme["name"];
  radius: number;
  packageManager: "npm" | "yarn" | "pnpm" | "bun";
  translatedLanguage: ("vi" | "en")[];
  r18: boolean;
};

const defaultConfig: Config = {
  style: "new-york",
  theme: "zinc",
  radius: 0.5,
  packageManager: "bun",
  translatedLanguage: ["vi"],
  r18: false,
};

interface ConfigStore extends Config {
  setConfig: (config: Config) => void;
}

const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      ...defaultConfig,
      setConfig: (config: Config) => set(config),
    }),
    {
      name: "config",
      storage: createMigratingStorage<Config>(),
      // Không persist phương thức setConfig
      partialize: ({ setConfig: _, ...config }) => config,
    },
  ),
);

export function useConfig(): [Config, (config: Config) => void] {
  const { setConfig, ...config } = useConfigStore();
  return [config as Config, setConfig];
}
