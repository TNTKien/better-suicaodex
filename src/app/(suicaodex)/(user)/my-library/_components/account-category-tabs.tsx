"use client";

import type { MangaLibraryEntry } from "@/lib/suicaodex/db";
import { Album, BookmarkCheck, BookOpen, ListCheck, NotebookPen } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import AccountLibraryCard from "./account-library-card";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { LIBRARY_TAB_OPTIONS, type LibraryTab } from "../searchParams";

type Category = "FOLLOWING" | "READING" | "PLAN" | "COMPLETED";

const TAB_TO_CATEGORY: Record<LibraryTab, Category> = {
  following: "FOLLOWING",
  reading: "READING",
  plan: "PLAN",
  completed: "COMPLETED",
};

interface AccountCategoryTabsProps {
  initialLibrary: Record<Category, MangaLibraryEntry[]>;
}

const TAB_VALUES: { value: LibraryTab; icon: React.ReactNode }[] = [
  { value: "following", icon: <BookmarkCheck className="size-5"/> },
  { value: "reading", icon: <Album className="size-5" /> },
  { value: "plan", icon: <NotebookPen className="size-5" /> },
  { value: "completed", icon: <ListCheck className="size-5" /> },
];

export default function AccountCategoryTabs({
  initialLibrary,
}: AccountCategoryTabsProps) {
  const [library, setLibrary] = useState(initialLibrary);
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(LIBRARY_TAB_OPTIONS).withDefault("following"),
  );

  const handleRemoved = (category: Category, mangaId: string) => {
    setLibrary((prev) => ({
      ...prev,
      [category]: prev[category].filter((e) => e.id !== mangaId),
    }));
  };

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as LibraryTab)}
      className="mt-2"
    >
      <TabsList className="rounded-md gap-1">
        {TAB_VALUES.map((t) => (
          <TabsTrigger key={t.value} className="rounded-md" value={t.value}>
            {t.icon}
          </TabsTrigger>
        ))}
      </TabsList>

      {TAB_VALUES.map((t) => {
        const category = TAB_TO_CATEGORY[t.value];
        const entries = library[category];
        return (
          <TabsContent key={t.value} value={t.value} className="w-full">
            {entries.length === 0 ? (
              <Empty className="bg-muted/30 h-full mt-2">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BookOpen />
                  </EmptyMedia>
                  <EmptyTitle>Bạn chưa lưu truyện vào mục này</EmptyTitle>
                  <EmptyDescription className="max-w-xs text-pretty">
                    Thêm truyện từ trang truyện nhé!
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 mt-2">
                {entries.map((entry) => (
                  <AccountLibraryCard
                    key={entry.id}
                    entry={entry}
                    onRemoved={(id) => handleRemoved(category, id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
