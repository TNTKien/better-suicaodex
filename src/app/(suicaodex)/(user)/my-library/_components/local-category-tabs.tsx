"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LocalLibraryCategory } from "@/hooks/use-local-library-v2";
import { Album, BookmarkCheck, ListCheck, NotebookPen } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { LIBRARY_TAB_OPTIONS, type LibraryTab } from "../searchParams";
import LibraryList from "./library-list";

const TAB_VALUES: { value: LibraryTab; icon: React.ReactNode }[] = [
  { value: "following", icon: <BookmarkCheck /> },
  { value: "reading", icon: <Album /> },
  { value: "plan", icon: <NotebookPen /> },
  { value: "completed", icon: <ListCheck /> },
];

export default function LocalCategoryTabs() {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(LIBRARY_TAB_OPTIONS).withDefault("following"),
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as LibraryTab)}
      className="mt-2"
    >
      <TabsList className="rounded-sm gap-1 h-10">
        {TAB_VALUES.map((t) => (
          <TabsTrigger key={t.value} className="rounded-sm" value={t.value}>
            {t.icon}
          </TabsTrigger>
        ))}
      </TabsList>
      {TAB_VALUES.map((t) => (
        <TabsContent key={t.value} value={t.value} className="w-full">
          <LibraryList category={t.value as LocalLibraryCategory} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
