import { config } from "@workspace/eslint-config/base"

export default [
  ...config,
  { ignores: [".cache/**"] },
  {
    files: ["**/*.cjs"],
    languageOptions: { globals: { module: "readonly", __dirname: "readonly" } },
  },
]
