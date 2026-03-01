"use client";

import { Manga } from "@/types/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, List, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import MangaCompletedCard from "@/components/Pages/Home/Swiper/Completed/manga-completed-card";
import DetailsCard from "@/components/Search/Result/details-card";

interface GroupTitleProps {
  isError: any;
  isLoading: any;
  mangas?: Manga[];
}

export default function GroupTitleTabs({
  mangas,
  isError,
  isLoading,
}: GroupTitleProps) {
  if (isLoading || !mangas) {
    return (
      <DefaultTabs>
        <div className="mt-20">
          <Loader2 className="animate-spin" size={40} />
        </div>
      </DefaultTabs>
    );
  }

  if (isError) {
    return (
      <DefaultTabs>
        <Card className="mt-4 rounded-sm justify-center items-center flex h-16 w-full">
          Lỗi mất rồi 😭
        </Card>
      </DefaultTabs>
    );
  }

  if (mangas.length === 0) {
    return (
      <DefaultTabs>
        <Card className="mt-4 rounded-sm justify-center items-center flex h-16 w-full">
          <p className="italic">Chưa có truyện nào!</p>
        </Card>
      </DefaultTabs>
    );
  }

  const detailView = (
    <div className="mt-4 flex flex-col gap-3 w-full">
      {mangas.map((manga) => (
        <DetailsCard key={manga.id} manga={manga} />
      ))}
    </div>
  );

  
  const coverView = (
    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
      {mangas.map((manga) => (
        <MangaCompletedCard key={manga.id} manga={manga} />
      ))}
    </div>
  );

  return (
    <DefaultTabs
      detailView={detailView}
      coverView={coverView}
    />
  );
}

interface DefaultTabsProps {
  children?: React.ReactNode;
  detailView?: React.ReactNode;
  coverView?: React.ReactNode;
}

function DefaultTabs({
  children,
  detailView,
  coverView,
}: DefaultTabsProps) {
  const tabValues = [
    { value: "detail", icon: <List /> },
    { value: "cover", icon: <LayoutGrid /> },
  ];

  return (
    <Tabs defaultValue="detail" className="w-full justify-items-end">
      <TabsList className="rounded-sm gap-1.5 h-10">
        {tabValues.map((tab) => (
          <TabsTrigger key={tab.value} className="rounded-sm" value={tab.value}>
            {tab.icon}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent className="w-full justify-items-center" value="detail">
        {detailView || children}
      </TabsContent>
      <TabsContent className="w-full justify-items-center" value="cover">
        {coverView || children}
      </TabsContent>
    </Tabs>
  );
}
