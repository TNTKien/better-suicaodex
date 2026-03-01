"use client";

import * as React from "react";
import {
  ChevronsUpDown,
  Minus,
  Plus,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { Tag } from "@/lib/weebdex/model";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TagState = "none" | "include" | "exclude";
export type TagStates = Record<string, TagState>;

export interface TagOption {
  id: string;
  name: string;
  group: string;
}

interface TagsFilterProps {
  tags: TagOption[];
  tagStates: TagStates;
  onTagStatesChange: (states: TagStates) => void;
  placeholder?: string;
  className?: string;
  resetKey?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function tagsFromTagList(tags: Tag[]): TagOption[] {
  return (tags ?? [])
    .filter((t) => t.id && t.name)
    .map((t) => ({ id: t.id!, name: t.name!, group: t.group ?? "tag" }));
}

export function getIncluded(states: TagStates): string[] {
  return Object.entries(states)
    .filter(([, s]) => s === "include")
    .map(([id]) => id);
}

export function getExcluded(states: TagStates): string[] {
  return Object.entries(states)
    .filter(([, s]) => s === "exclude")
    .map(([id]) => id);
}

export function buildTagStates(
  included: string[],
  excluded: string[],
): TagStates {
  const states: TagStates = {};
  included.forEach((id) => (states[id] = "include"));
  excluded.forEach((id) => (states[id] = "exclude"));
  return states;
}

function cycleState(current: TagState): TagState {
  if (current === "none") return "include";
  if (current === "include") return "exclude";
  return "none";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TagsFilter({
  tags,
  tagStates,
  onTagStatesChange,
  placeholder = "Gì cũng được",
  className,
}: TagsFilterProps) {
  const [open, setOpen] = React.useState(false);

  const included = React.useMemo(() => getIncluded(tagStates), [tagStates]);
  const excluded = React.useMemo(() => getExcluded(tagStates), [tagStates]);
  const selectedIds = React.useMemo(
    () => [...included, ...excluded],
    [included, excluded],
  );

  const cycle = (id: string) => {
    const cur = tagStates[id] ?? "none";
    const next = cycleState(cur);
    const next_states = { ...tagStates };
    if (next === "none") {
      delete next_states[id];
    } else {
      next_states[id] = next;
    }
    onTagStatesChange(next_states);
  };

  const removeTag = (id: string) => {
    const next = { ...tagStates };
    delete next[id];
    onTagStatesChange(next);
  };

  const clearAll = () => onTagStatesChange({});

  const MAX_BADGES = 4;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "flex w-full px-2 min-h-10 h-auto items-center justify-between bg-secondary border-none hover:bg-secondary/80 shadow-none",
            className,
          )}
        >
          {selectedIds.length > 0 ? (
            <div className="flex justify-between items-center w-full gap-2 min-w-0">
              {/* Badge display */}
              <div className="flex items-center gap-1 flex-wrap min-w-0 overflow-hidden">
                {selectedIds.slice(0, MAX_BADGES).map((id) => {
                  const tag = tags.find((t) => t.id === id);
                  const state = tagStates[id] ?? "none";
                  return (
                    <Badge
                      key={id}
                      className={cn(
                        "text-xs gap-0.5 pr-1 cursor-pointer select-none",
                        state === "include" &&
                          "bg-primary text-primary-foreground hover:bg-primary/80",
                        state === "exclude" &&
                          "bg-destructive text-destructive-foreground hover:bg-destructive/80",
                      )}
                    >
                      {state === "include" ? (
                        <Plus className="size-3" />
                      ) : (
                        <Minus className="size-3" />
                      )}
                      {tag?.name ?? id}
                      <XCircle
                        className="size-3 ml-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTag(id);
                        }}
                      />
                    </Badge>
                  );
                })}
                {selectedIds.length > MAX_BADGES && (
                  <span className="text-xs text-muted-foreground">
                    +{selectedIds.length - MAX_BADGES}
                  </span>
                )}
              </div>
              {/* Clear + chevron */}
              <div className="flex items-center gap-1 shrink-0">
                <X
                  className="size-4 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAll();
                  }}
                />
                <ChevronsUpDown className="size-4 text-muted-foreground shrink-0" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full px-1">
              <span className="text-sm text-muted-foreground">{placeholder}</span>
              <ChevronsUpDown className="size-4 text-muted-foreground" />
            </div>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0 w-72"
        align="start"
        sideOffset={5}
        style={{ width: "max(var(--radix-popover-trigger-width), 18rem)" }}
      >
        <Command>
          <CommandInput placeholder="Tìm thể loại..." />
          <CommandList className="max-h-72">
            <CommandEmpty>Không tìm thấy thể loại.</CommandEmpty>

            {/* Selected tags summary */}
            {selectedIds.length > 0 && (
              <CommandGroup>
                <div className="flex flex-wrap gap-1 px-2 pb-2 border-b">
                  {selectedIds.map((id) => {
                    const tag = tags.find((t) => t.id === id);
                    const state = tagStates[id];
                    return (
                      <Badge
                        key={id}
                        className={cn(
                          "text-xs gap-0.5 pr-1 cursor-pointer",
                          state === "include" &&
                            "bg-primary text-primary-foreground hover:bg-primary/80",
                          state === "exclude" &&
                            "bg-destructive text-destructive-foreground hover:bg-destructive/80",
                        )}
                        onClick={() => removeTag(id)}
                      >
                        {state === "include" ? (
                          <Plus className="size-3" />
                        ) : (
                          <Minus className="size-3" />
                        )}
                        {tag?.name ?? id}
                        <XCircle className="size-3 ml-1" />
                      </Badge>
                    );
                  })}
                </div>
              </CommandGroup>
            )}

            <CommandGroup>
              {tags.map((tag) => {
                const state = tagStates[tag.id] ?? "none";
                return (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() => cycle(tag.id)}
                    className="cursor-pointer gap-2"
                  >
                    <span className="flex size-4 items-center justify-center shrink-0">
                      {state === "include" && (
                        <Plus className="size-4 text-primary" />
                      )}
                      {state === "exclude" && (
                        <Minus className="size-4 text-destructive" />
                      )}
                      {state === "none" && (
                        <span className="size-4 rounded-sm border border-muted-foreground/30" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-sm",
                        state === "include" && "text-primary",
                        state === "exclude" && "text-destructive",
                        state === "none" && "text-muted-foreground",
                      )}
                    >
                      {tag.name}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {selectedIds.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={clearAll}
                    className="justify-center text-muted-foreground cursor-pointer"
                  >
                    Xóa tất cả
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
