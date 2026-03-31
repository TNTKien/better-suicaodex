import { defineConfig } from "orval";

export default defineConfig({
  weebdex: {
    output: {
      baseUrl: process.env.API_URL || "https://wd.memaydex.online",
      mode: "tags-split",
      target: "./src/lib/weebdex/hooks",
      schemas: "./src/lib/weebdex/model",
      client: "react-query",
      clean: true,
      prettier: true,
    },
    input: {
      target: "./src/lib/weebdex/docs/weebdex-api-docs-v3.json",
    },
  },
  moetruyen: {
    output: {
      baseUrl: process.env.MOETRUYEN_API_URL || "https://moe.suicaodex.com",
      mode: "tags-split",
      target: "./src/lib/moetruyen/hooks",
      schemas: "./src/lib/moetruyen/model",
      client: "react-query",
      clean: true,
      prettier: true,
    },
    input: {
      target: "./src/lib/moetruyen/docs/moetruyen-docs-0.2.0.json",
    },
  },
});
