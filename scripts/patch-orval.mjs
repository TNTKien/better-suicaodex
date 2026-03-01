/**
 * Patch orval-generated fetch URL builders to correctly serialize array params.
 * Orval uses `value.toString()` on arrays which produces "a,b,c" instead of
 * appending each value separately (required for APIs expecting ?foo=a&foo=b&foo=c).
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = join(__dirname, "..", "src", "lib", "weebdex", "hooks");

// Pattern 1: fresh orval output — single-line append
const OLD = `normalizedParams.append(key, value === null ? "null" : value.toString());`;
const NEW = `if (Array.isArray(value)) {
        value.forEach((v) =>
          normalizedParams.append(key, v === null ? "null" : String(v)),
        );
      } else {
        normalizedParams.append(
          key,
          value === null ? "null" : String(value as unknown),
        );
      }`;

// Pattern 2: already-patched files from old version still using value.toString() in else
const OLD2 = `      } else {
        normalizedParams.append(
          key,
          value === null ? "null" : value.toString(),
        );
      }`;
const NEW2 = `      } else {
        normalizedParams.append(
          key,
          value === null ? "null" : String(value as unknown),
        );
      }`;

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      let content = readFileSync(full, "utf8");
      let changed = false;
      if (content.includes(OLD)) {
        content = content.replaceAll(OLD, NEW);
        changed = true;
      }
      if (content.includes(OLD2)) {
        content = content.replaceAll(OLD2, NEW2);
        changed = true;
      }
      if (changed) {
        writeFileSync(full, content);
        console.log(`[patch-orval] Patched: ${full}`);
      }
    }
  }
}

walk(HOOKS_DIR);
console.log("[patch-orval] Done.");
