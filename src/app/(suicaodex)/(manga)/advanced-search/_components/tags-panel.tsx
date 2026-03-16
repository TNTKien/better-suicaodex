"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ── Group metadata ────────────────────────────────────────────────────────────

const GROUP_LABELS: Record<string, string> = {
  content: "Nội dung",
  format: "Định dạng",
  genre: "Thể loại",
  theme: "Chủ đề",
  tag: "Tag",
  author: "Tác giả",
};

const GROUP_ORDER = ["format", "genre", "theme", "content", "tag", "author"];

// ── Component ─────────────────────────────────────────────────────────────────

export type TagState = "none" | "include" | "exclude";
export type TagStates = Record<string, TagState>;
export interface TagOption {
  id: string;
  name: string;
  group: string;
}

interface TagsPanelProps {
  tags: TagOption[];
  tagStates: TagStates;
  onTagStatesChange: (states: TagStates) => void;
  isLoading?: boolean;
}

function cycleState(
  cur: "none" | "include" | "exclude",
): "none" | "include" | "exclude" {
  if (cur === "none") return "include";
  if (cur === "include") return "exclude";
  return "none";
}

export default function TagsPanel({
  tags,
  tagStates,
  onTagStatesChange,
  isLoading,
}: TagsPanelProps) {
  // Group tags by category
  const grouped = React.useMemo(() => {
    const map: Record<string, TagOption[]> = {};
    tags.forEach((tag) => {
      const g = tag.group || "tag";
      if (!map[g]) map[g] = [];
      map[g].push(tag);
    });
    // Sort each group alphabetically
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.name.localeCompare(b.name)),
    );
    return map;
  }, [tags]);

  const orderedGroups = React.useMemo(() => {
    const keys = Object.keys(grouped);
    const ordered = GROUP_ORDER.filter((g) => keys.includes(g));
    const rest = keys.filter((g) => !GROUP_ORDER.includes(g));
    return [...ordered, ...rest];
  }, [grouped]);

  const cycle = React.useCallback(
    (id: string) => {
      const cur = tagStates[id] ?? "none";
      const next = cycleState(cur);
      const next_states = { ...tagStates };
      if (next === "none") {
        delete next_states[id];
      } else {
        next_states[id] = next;
      }
      onTagStatesChange(next_states);
    },
    [tagStates, onTagStatesChange],
  );

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 20 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" />
        ))}
      </div>
    );
  }

  if (tags.length === 0) return null;

  return (
    <div className="space-y-4">
      {orderedGroups.map((group) => {
        const groupTags = grouped[group];
        if (!groupTags?.length) return null;

        const includedCount = groupTags.filter(
          (t) => tagStates[t.id] === "include",
        ).length;
        const excludedCount = groupTags.filter(
          (t) => tagStates[t.id] === "exclude",
        ).length;

        return (
          <div key={group} className="space-y-1.5">
            {/* Group header */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {GROUP_LABELS[group] ?? group}
              </span>
              {includedCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs text-primary font-medium">
                  <Plus className="size-3" />
                  {includedCount}
                </span>
              )}
              {excludedCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs text-destructive font-medium">
                  <Minus className="size-3" />
                  {excludedCount}
                </span>
              )}
            </div>

            {/* Tag pills */}
            <div className="flex flex-wrap gap-1.5">
              {groupTags.map((tag) => {
                const state = tagStates[tag.id] ?? "none";
                return (
                  <TagPill
                    key={tag.id}
                    name={tag.name}
                    state={state}
                    onClick={() => cycle(tag.id)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tag pill ─────────────────────────────────────────────────────────────────

interface TagPillProps {
  name: string;
  state: "none" | "include" | "exclude";
  onClick: () => void;
}

function TagPill({ name, state, onClick }: TagPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all duration-150 select-none cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        state === "none" &&
          "bg-secondary border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
        state === "include" &&
          "bg-green-500/15 border-green-500/40 text-green-600 hover:bg-green-500/25 dark:text-green-400",
        state === "exclude" &&
          "bg-red-500/15 border-red-500/40 text-red-600 hover:bg-red-500/25 dark:text-red-400",
      )}
    >
      {state === "include" && <Plus className="size-3 shrink-0" />}
      {state === "exclude" && <Minus className="size-3 shrink-0" />}
      {name}
    </button>
  );
}
