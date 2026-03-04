"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { BugIcon } from "lucide-react";
import NoPrefetchLink from "@/components/common/no-prefetch-link";
import { generateSlug } from "@/lib/utils";
import {
  getMangaTag,
  getMangaTagResponseSuccess,
} from "@/lib/weebdex/hooks/tag/tag";
import { Group } from "@/lib/weebdex/model";
import type { Tag } from "@/lib/weebdex/model";
import { useQuery } from "@tanstack/react-query";

const GROUP_NAME_MAP: Record<string, string> = {
  [Group.NamespaceContent]: "Nội dung",
  [Group.NamespaceFormat]: "Định dạng",
  [Group.NamespaceGenre]: "Thể loại",
  [Group.NamespaceTheme]: "Chủ đề",
};

const GROUP_ORDER = [
  Group.NamespaceContent,
  Group.NamespaceFormat,
  Group.NamespaceGenre,
  Group.NamespaceTheme,
];

interface TagGroup {
  group: string;
  name: string;
  tags: Tag[];
}

function groupTags(tags: Tag[]): TagGroup[] {
  const groupMap = new Map<string, TagGroup>();

  for (const tag of tags) {
    const groupKey = tag.group ?? "";
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        group: groupKey,
        name: GROUP_NAME_MAP[groupKey] || groupKey,
        tags: [],
      });
    }
    groupMap.get(groupKey)!.tags.push(tag);
  }

  const result: TagGroup[] = [];
  for (const group of GROUP_ORDER) {
    if (groupMap.has(group)) {
      result.push(groupMap.get(group)!);
    }
  }
  for (const [key, value] of groupMap) {
    if (!GROUP_ORDER.includes(key as (typeof GROUP_ORDER)[number])) {
      result.push(value);
    }
  }

  return result;
}

export default function TagsPageWeebdex() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["weebdex", "tags"],
    queryFn: async () => {
      const res = await getMangaTag();
      if (res.status !== 200) throw new Error("Failed to fetch tags");
      return (res as getMangaTagResponseSuccess).data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[10, 6, 20, 15].map((count, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-[21px] w-24" />
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from({ length: count }).map((_, j) => (
                <Skeleton key={j} className="h-9 w-20 rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Empty className="bg-muted/30 h-full mt-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BugIcon />
          </EmptyMedia>
          <EmptyTitle>Lỗi mất rồi 🤪</EmptyTitle>
          <EmptyDescription className="max-w-xs text-pretty">
            Có lỗi xảy ra, thử F5 xem sao nhé
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const groupedTags = groupTags(data.data ?? []);

  return (
    <div className="space-y-4">
      {groupedTags.map((group) => (
        <div key={group.group} className="space-y-2">
          <Label className="font-bold text-lg">{group.name}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {group.tags.map((tag) => (
              <Button asChild key={tag.id} variant="secondary" size="sm">
                <NoPrefetchLink
                  href={`/tag/${tag.id}/${generateSlug(tag.name ?? "")}`}
                >
                  {tag.name}
                </NoPrefetchLink>
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
