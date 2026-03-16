"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuthor } from "@/lib/weebdex/hooks/author/author";
import { AsyncMultiSelect } from "@/components/ui/async-multi-select";
import { cn } from "@/lib/utils";

interface AuthorOption {
  value: string;
  label: string;
}

interface AuthorsSelectorProps {
  defaultValue?: string[];
  onValueChange: (ids: string[]) => void;
  className?: string;
  placeholder?: string;
}

export function AuthorsSelector({
  defaultValue = [],
  onValueChange,
  className,
  placeholder = "Tìm tác giả...",
}: AuthorsSelectorProps) {
  const [cache, setCache] = useState<Map<string, AuthorOption>>(new Map());
  const [ready, setReady] = useState(false);

  // On mount: hydrate cache with the pre-selected authors (by ID)
  useEffect(() => {
    const load = async () => {
      if (defaultValue.length > 0) {
        try {
          const res = await getAuthor({
            id: defaultValue,
            limit: Math.min(defaultValue.length, 100),
          });
          if (res.status === 200) {
            setCache((prev) => {
              const next = new Map(prev);
              (res.data.data ?? []).forEach((a) => {
                if (a.id && a.name) next.set(a.id, { value: a.id, label: a.name });
              });
              return next;
            });
          }
        } catch {
          // silent — component still renders without prefilled labels
        }
      }
      setReady(true);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOptions = useCallback(
    async (query: string): Promise<AuthorOption[]> => {
      const cached = Array.from(cache.values());
      if (!query.trim()) return cached;

      try {
        const res = await getAuthor({ name: query, limit: 10 });
        if (res.status !== 200) return cached;

        const results = (res.data.data ?? [])
          .filter((a): a is typeof a & { id: string; name: string } =>
            Boolean(a.id && a.name),
          )
          .map((a) => ({ value: a.id, label: a.name }));

        setCache((prev) => {
          const next = new Map(prev);
          results.forEach((r) => next.set(r.value, r));
          return next;
        });

        return results;
      } catch {
        return cached;
      }
    },
    [cache],
  );

  if (!ready) return null;

  return (
    <AsyncMultiSelect
      loadOptions={loadOptions}
      onValueChange={onValueChange}
      defaultValue={defaultValue}
      preloadedOptions={Array.from(cache.values())}
      className={cn("shadow-none", className)}
      isCompact
      disableFooter
      placeholder={placeholder}
      noResultsMessage="Không có kết quả"
      loadingMessage="Đang tìm..."
    />
  );
}
