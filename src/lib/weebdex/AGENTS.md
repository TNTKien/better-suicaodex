# AGENTS.md

## Scope

- This directory contains the WeebDex API client surface used by the app.
- It mixes generated code with a small amount of handwritten glue.

## Generated vs Handwritten

- `model/**` is generated.
- `hooks/**` is generated output and then patched by `scripts/patch-orval.mjs`.
- `docs/weebdex-api-docs-v3.json` is the OpenAPI input.
- `utils.ts` and `manga-links.ts` are handwritten helpers.

## Hard Rule

- Do not hand-edit generated files under `model/**` or `hooks/**` for normal feature work.
- Those files contain `Do not edit manually.` markers; respect them.

## Regeneration Workflow

```bash
bun run gen:api
```

- `gen:api` runs Orval with `orval.config.ts` and then runs `scripts/patch-orval.mjs`.
- Do not run raw Orval alone for committed output; the patch step is required for correct array query serialization.
- If generation is wrong, fix one of these sources instead:
  - `orval.config.ts`
  - `scripts/patch-orval.mjs`
  - handwritten wrappers/helpers outside generated regions

## What The Patch Does

- `scripts/patch-orval.mjs` rewrites generated URL builders so array params serialize as repeated query params.
- That behavior is required by the WeebDex API; comma-joined arrays are not the intended output here.

## Editing Guidance

- Add app-specific parsing, link building, or transformation logic in handwritten helpers, not generated models.
- If you need a safer facade around generated hooks, create it nearby in handwritten code rather than forking generated files.
- Preserve file/directory naming because imports across the app assume the current Orval layout.

## Review Checklist

- Did you avoid direct edits to generated outputs?
- If you changed generation inputs, did you rerun `bun run gen:api`?
- If generated output changed, did the patch script still apply cleanly?
- Did you keep docs and helper code aligned with the current WeebDex schema source?
