# AGENTS.md

## Scope

- This directory contains shared UI primitives and a few large UI composites used across the app.
- It is heavily shadcn/Radix-inspired, but some files are repo-specific extensions rather than stock boilerplate.

## Local Style Difference

- Many files here keep upstream shadcn formatting: double quotes, no semicolons, compact React typing.
- Preserve the existing style of the file you edit instead of reformatting the whole directory to match app/lib files.

## Composition Rules

- Reuse `cn` from `@/lib/utils` for class merging.
- Reuse `cva` variant patterns when a component already exposes variants.
- Preserve exported variant helpers such as `buttonVariants` when they already exist.
- Prefer composing existing primitives over creating one-off copies in feature folders.

## Client-Only Behavior

- Keep `"use client"` at the top of files that rely on hooks, context, browser APIs, or Radix client behavior.
- Do not remove client boundaries from components like `sidebar.tsx`, `form.tsx`, dialogs, drawers, or tooltips.

## Accessibility and Contracts

- Preserve `data-slot`, `data-sidebar`, ARIA, and keyboard behavior; feature code depends on these contracts.
- Keep form helpers wired through `FormField`, `useFormField`, and generated IDs.
- For sidebar components, preserve cookie persistence, keyboard shortcut behavior, mobile sheet behavior, and collapsed-state data attributes.

## Shadcn Context

- `components.json` uses style `new-york`, base color `zinc`, CSS variables, and aliases such as `@/components` and `@/lib/utils`.
- Registries include `@kibo-ui` and `@magicui`; if you add imported primitives, make them look native to the current directory rather than mixed-source patchwork.

## When Extending This Directory

- Add new primitives only if reuse across routes is likely.
- If a component is feature-specific, keep it outside `src/components/ui`.
- Avoid breaking public props for widely used primitives unless you update all call sites in the same change.
