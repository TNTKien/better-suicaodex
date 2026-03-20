"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CircleUser, CloudOff } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import {
  LIBRARY_STORAGE_OPTIONS,
  type LibraryStorage,
} from "../searchParams";

interface LibraryStorageTabsProps {
  localContent: React.ReactNode;
  cloudContent: React.ReactNode;
}

export default function LibraryStorageTabs({
  localContent,
  cloudContent,
}: LibraryStorageTabsProps) {
  const [storage, setStorage] = useQueryState(
    "storage",
    parseAsStringLiteral(LIBRARY_STORAGE_OPTIONS).withDefault("local"),
  );

  return (
    <Tabs
      value={storage}
      onValueChange={(v) => setStorage(v as LibraryStorage)}
      className="mt-4 px-4 md:px-8 lg:px-12"
    >
      <TabsList className="w-full">
        <TabsTrigger className="w-full flex items-center" value="local">
          <CloudOff size={16} className="mr-1" />
          Từ thiết bị
        </TabsTrigger>
        <TabsTrigger className="w-full flex items-center" value="cloud">
          <CircleUser size={16} className="mr-1" />
          Từ tài khoản
        </TabsTrigger>
      </TabsList>
      <TabsContent value="local">{localContent}</TabsContent>
      <TabsContent value="cloud">{cloudContent}</TabsContent>
    </Tabs>
  );
}
