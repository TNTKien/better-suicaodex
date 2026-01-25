"use client";

import { useLocalNotification } from "@/hooks/use-local-notification";
import { generateSlug } from "@/lib/utils";
import { Chapter } from "@/types/types";
import { Users } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

interface ChapterInfoProps {
  chapter: Chapter;
}

export default function ChapterInfo({ chapter }: ChapterInfoProps) {
  const { markAsRead, isUnread } = useLocalNotification();
  
  // Move the state update to an effect hook
  useEffect(() => {
    if (isUnread(chapter.id)) {
      markAsRead(chapter.id);
    }
  }, [chapter.id, isUnread, markAsRead]);

  return (
    <div className="grid grid-cols-1 gap-0.5 pb-2">
      <h1 className="text-xl">{ChapterTitle(chapter)}</h1>

      <Link
        href={`/manga/${chapter.manga.id}/${generateSlug(chapter.manga.title || "")}`}
        className="text-primary font-semibold"
      >
        {chapter.manga.title}
      </Link>

      <div className="flex flex-wrap gap-0.5 items-center">
        <Users size={20} className="shrink-0" />
        {chapter.group.length === 0 ? (
          <span className="px-1">No Group</span>
        ) : (
          chapter.group.map((group) => (
            <Link
              key={group.id}
              href={`/group/${group.id}/${generateSlug(group.name)}`}
              className="hover:bg-secondary hover:text-primary rounded-sm px-1 line-clamp-1 break-all"
              prefetch={false}
            >
              {group.name}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

export function ChapterTitle(chapter: Chapter) {
  if (!chapter.chapter) {
    return "Oneshot";
  }
  return chapter.title
    ? `Ch. ${chapter.chapter} - ${chapter.title}`
    : `Ch. ${chapter.chapter}`;
}
