import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const targetFile = join(__dirname, "..", "prisma", "generated", "client.ts");

const pattern =
  /globalThis\[['"]__dirname['"]\]\s*=\s*path\.dirname\(fileURLToPath\(import\.meta\.url\)\)\s*;?/;

const replacement = `const __prismaDirname =
  typeof import.meta !== "undefined" &&
  typeof import.meta.url === "string" &&
  import.meta.url.length > 0
    ? path.dirname(fileURLToPath(import.meta.url))
    : "/";
globalThis["__dirname"] = __prismaDirname;
`;

const source = readFileSync(targetFile, "utf8");

if (!pattern.test(source)) {
  console.log("[patch-prisma-generated] Skip: pattern not found");
  process.exit(0);
}

const patched = source.replace(pattern, replacement);
writeFileSync(targetFile, patched);

console.log("[patch-prisma-generated] Patched prisma/generated/client.ts");
