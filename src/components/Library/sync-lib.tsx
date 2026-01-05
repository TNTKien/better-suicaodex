"use client";

import { getMangasByIDs } from "@/lib/mangadex/history";
import { getUserLibrary } from "@/lib/suicaodex/db";
import { Manga } from "@/types/types";
import {
  Album,
  BookmarkCheck,
  ListCheck,
  Loader2,
  NotebookPen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import DetailsCard from "../Search/Result/details-card";
import Image from "next/image";
import DoroLoading from "#/images/doro-loading.gif";

interface SyncLibProps {
  session: any;
}

export default function SyncLib({ session }: SyncLibProps) {
  const tabValues = [
    { value: "following", icon: <BookmarkCheck /> },
    { value: "reading", icon: <Album /> },
    { value: "plan", icon: <NotebookPen /> },
    { value: "completed", icon: <ListCheck /> },
  ];

  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const [followingManga, setFollowingManga] = useState<Manga[]>([]);
  const [readingManga, setReadingManga] = useState<Manga[]>([]);
  const [planManga, setPlanManga] = useState<Manga[]>([]);
  const [completedManga, setCompletedManga] = useState<Manga[]>([]);

  useEffect(() => {
    if (!session) return;
    const fetchLib = async () => {
      setIsLoading(true);
      try {
        const lib = await getUserLibrary(session.user.id);
        const following = await getMangasByIDs(lib.FOLLOWING);
        const reading = await getMangasByIDs(lib.READING);
        const plan = await getMangasByIDs(lib.PLAN);
        const completed = await getMangasByIDs(lib.COMPLETED);

        setFollowingManga(following);
        setReadingManga(reading);
        setPlanManga(plan);
        setCompletedManga(completed);
      } catch (error) {
        console.error(error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLib();
  }, [session]);

  if (isLoading) {
    return (
      <Tabs defaultValue="following" className="mt-2">
        <TabsList className="rounded-sm gap-1 h-10">
          {tabValues.map((tab) => (
            <TabsTrigger
              key={tab.value}
              className="rounded-sm"
              value={tab.value}
            >
              {tab.icon}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabValues.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="w-full">
            <Alert className="rounded-sm border-none">
              <AlertDescription className="flex justify-center">
                <Image
                  src={DoroLoading}
                  alt="Loading..."
                  unoptimized
                  priority
                  className="w-20 h-auto"
                />
              </AlertDescription>
            </Alert>
          </TabsContent>
        ))}
      </Tabs>
    );
  }
  if (isError) {
    <Tabs defaultValue="following" className="mt-2">
      <TabsList className="rounded-sm gap-1 h-10">
        {tabValues.map((tab) => (
          <TabsTrigger key={tab.value} className="rounded-sm" value={tab.value}>
            {tab.icon}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabValues.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="w-full">
          <Alert className="rounded-sm bg-secondary">
            <AlertDescription className="flex justify-center">
              Lỗi mất rồi 😭
            </AlertDescription>
          </Alert>
        </TabsContent>
      ))}
    </Tabs>;
  }
  return (
    <Tabs defaultValue="following" className="mt-2">
      <TabsList className="rounded-sm gap-1 h-10">
        {tabValues.map((tab) => (
          <TabsTrigger key={tab.value} className="rounded-sm" value={tab.value}>
            {tab.icon}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabValues.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="w-full">
          <LibraryTabContent
            mangas={
              tab.value === "following"
                ? followingManga
                : tab.value === "reading"
                ? readingManga
                : tab.value === "plan"
                ? planManga
                : completedManga
            }
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

interface LibraryTabContentProps {
  //   category: string;
  mangas: Manga[];
}

function LibraryTabContent({ mangas }: LibraryTabContentProps) {
  if (mangas.length === 0) {
    return (
      <Alert className="rounded-sm justify-center text-center">
        <AlertTitle>
          Chưa có truyện nào!
        </AlertTitle>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {mangas.map((manga) => (
        <DetailsCard key={manga.id} manga={manga} />
      ))}
    </div>
  );
}
