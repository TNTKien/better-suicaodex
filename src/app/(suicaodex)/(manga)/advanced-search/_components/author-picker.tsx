"use client";

import * as React from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { Check, Eraser, Loader2, Search, UserRound, X } from "lucide-react";

import { getAuthor } from "@/lib/weebdex/hooks/author/author";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AuthorOption {
  value: string;
  label: string;
}

interface AuthorPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

function mergeIntoCache(
  current: Map<string, AuthorOption>,
  options: AuthorOption[],
) {
  const next = new Map(current);

  options.forEach((option) => {
    next.set(option.value, option);
  });

  return next;
}

function toAuthorOptions(data: unknown): AuthorOption[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.reduce<AuthorOption[]>((options, item) => {
    if (typeof item !== "object" || item === null) {
      return options;
    }

    const record = item as Record<string, unknown>;
    const id = record.id;
    const name = record.name;

    if (typeof id === "string" && typeof name === "string") {
      options.push({ value: id, label: name });
    }

    return options;
  }, []);
}

export function AuthorPicker({
  value,
  onChange,
  placeholder = "Ai cũng được",
  className,
}: AuthorPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<AuthorOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [cache, setCache] = React.useState<Map<string, AuthorOption>>(
    new Map(),
  );
  const [debouncedSearch] = useDebouncedValue(search, 300);

  const valueKey = React.useMemo(() => value.join("|"), [value]);

  React.useEffect(() => {
    const missingIds = value.filter((id) => !cache.has(id));

    if (missingIds.length === 0) {
      return;
    }

    let cancelled = false;

    const loadSelectedAuthors = async () => {
      try {
        const response = await getAuthor({
          id: missingIds,
          limit: Math.min(missingIds.length, 100),
        });

        if (cancelled || response.status !== 200) {
          return;
        }

        const hydratedOptions = toAuthorOptions(response.data.data);
        setCache((current) => mergeIntoCache(current, hydratedOptions));
      } catch {
        return;
      }
    };

    void loadSelectedAuthors();

    return () => {
      cancelled = true;
    };
  }, [cache, value, valueKey]);

  React.useEffect(() => {
    const query = debouncedSearch.trim();

    if (query.length === 0) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const loadResults = async () => {
      try {
        const response = await getAuthor({ name: query, limit: 10 });

        if (cancelled || response.status !== 200) {
          return;
        }

        const nextResults = toAuthorOptions(response.data.data);
        setCache((current) => mergeIntoCache(current, nextResults));
        setResults(nextResults);
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadResults();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const selectedAuthors = React.useMemo(
    () =>
      value
        .map((id) => cache.get(id) ?? { value: id, label: id })
        .filter(Boolean),
    [cache, value],
  );

  const selectedSet = React.useMemo(() => new Set(value), [value]);

  const toggleAuthor = React.useCallback(
    (id: string) => {
      if (selectedSet.has(id)) {
        onChange(value.filter((item) => item !== id));
        return;
      }

      onChange([...value, id]);
    },
    [onChange, selectedSet, value],
  );

  const removeAuthor = React.useCallback(
    (id: string) => {
      onChange(value.filter((item) => item !== id));
    },
    [onChange, value],
  );

  const clearAuthors = React.useCallback(() => {
    onChange([]);
  }, [onChange]);

  const triggerLabel =
    selectedAuthors.length === 0
      ? placeholder
      : selectedAuthors.length === 1
        ? (selectedAuthors[0]?.label ?? placeholder)
        : `${selectedAuthors[0]?.label ?? "Tác giả"} +${selectedAuthors.length - 1}`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {selectedAuthors.length > 0 ? (
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="size-[22px]! rounded-sm"
              onClick={clearAuthors}
            >
              <Eraser className="size-3.5" />
            </Button>
            {selectedAuthors.map((author) => (
              <Badge
                key={author.value}
                variant="secondary"
                className="gap-1 rounded-sm pr-1"
              >
                <UserRound className="size-3" />
                <span className="max-w-40 truncate">{author.label}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 transition-colors hover:bg-foreground/10"
                  onClick={() => removeAuthor(author.value)}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-10 w-full justify-between border-none bg-secondary px-3 text-left shadow-none hover:bg-secondary/80"
          >
            <span className="truncate text-sm text-muted-foreground">
              {triggerLabel}
            </span>
            <Search className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={5}
          className="w-[min(var(--radix-popover-trigger-width),28rem)] p-0"
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Nhập tên tác giả để tìm kiếm"
            />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Đang tìm...
                </div>
              ) : null}

              {!isLoading && debouncedSearch.trim().length === 0 ? (
                <CommandEmpty>Nhập tên tác giả để tìm kiếm</CommandEmpty>
              ) : null}

              {!isLoading &&
              debouncedSearch.trim().length >= 1 &&
              results.length === 0 ? (
                <CommandEmpty>Không có kết quả.</CommandEmpty>
              ) : null}

              {results.length > 0 ? (
                <CommandGroup heading="Kết quả">
                  {results.map((author) => {
                    const isSelected = selectedSet.has(author.value);

                    return (
                      <CommandItem
                        key={author.value}
                        value={author.label}
                        onSelect={() => toggleAuthor(author.value)}
                        className="cursor-pointer gap-2"
                      >
                        <span className="flex size-4 items-center justify-center rounded-sm border border-primary">
                          {isSelected ? (
                            <Check className="size-3 text-primary" />
                          ) : null}
                        </span>
                        <span className="truncate">{author.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
