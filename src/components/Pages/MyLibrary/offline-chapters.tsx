"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOfflineChapter } from "@/hooks/use-offline-chapter";
import { formatTimeToNow } from "@/lib/utils";
import { Download, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface OfflineChapter {
  id: string;
  data: any;
  images: string[];
  savedAt: number;
}

export default function OfflineChapters() {
  const { getAllOfflineChapters, deleteOfflineChapter, isLoading } = useOfflineChapter();
  const [chapters, setChapters] = useState<OfflineChapter[]>([]);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  const [loadingChapters, setLoadingChapters] = useState(true);

  // Lấy danh sách chapter offline
  useEffect(() => {
    const fetchOfflineChapters = async () => {
      if (!isLoading) {
        try {
          const offlineChapters = await getAllOfflineChapters();
          setChapters(offlineChapters);
        } catch (error) {
          console.error("Error fetching offline chapters:", error);
        } finally {
          setLoadingChapters(false);
        }
      }
    };

    fetchOfflineChapters();
  }, [getAllOfflineChapters, isLoading]);

  // Xóa chapter offline
  const handleDeleteChapter = async (chapterId: string) => {
    setIsDeleting(prev => ({ ...prev, [chapterId]: true }));
    
    try {
      const success = await deleteOfflineChapter(chapterId);
      if (success) {
        setChapters(prev => prev.filter(chapter => chapter.id !== chapterId));
      }
    } catch (error) {
      console.error("Error deleting offline chapter:", error);
    } finally {
      setIsDeleting(prev => ({ ...prev, [chapterId]: false }));
    }
  };

  // Nhóm chapters theo manga
  const chaptersByManga: Record<string, OfflineChapter[]> = {};
  chapters.forEach(chapter => {
    const mangaId = chapter.data.manga.id;
    if (!chaptersByManga[mangaId]) {
      chaptersByManga[mangaId] = [];
    }
    chaptersByManga[mangaId].push(chapter);
  });

  if (loadingChapters) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="animate-spin mr-2" />
        <span>Đang tải dữ liệu...</span>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="text-center py-12">
        <Download className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Chưa có chapter nào được lưu offline</h3>
        <p className="text-muted-foreground mt-2">
          Lưu chapter để đọc khi không có kết nối mạng
        </p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="by-manga" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="by-manga">Theo truyện</TabsTrigger>
        <TabsTrigger value="all-chapters">Tất cả chương</TabsTrigger>
      </TabsList>
      
      <TabsContent value="by-manga" className="space-y-6">
        {Object.entries(chaptersByManga).map(([mangaId, mangaChapters]) => {
          const mangaTitle = mangaChapters[0]?.data.manga.title || "Không có tiêu đề";
          
          return (
            <Card key={mangaId}>
              <CardHeader>
                <CardTitle>
                  <Link href={`/manga/${mangaId}`} className="hover:underline">
                    {mangaTitle}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mangaChapters
                    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
                    .map((chapter) => (
                      <ChapterCard
                        key={chapter.id}
                        chapter={chapter}
                        isDeleting={!!isDeleting[chapter.id]}
                        onDelete={() => handleDeleteChapter(chapter.id)}
                      />
                    ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>
      
      <TabsContent value="all-chapters">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chapters
            .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
            .map((chapter) => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                isDeleting={!!isDeleting[chapter.id]}
                onDelete={() => handleDeleteChapter(chapter.id)}
                showMangaTitle
              />
            ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}

interface ChapterCardProps {
  chapter: OfflineChapter;
  isDeleting: boolean;
  onDelete: () => void;
  showMangaTitle?: boolean;
}

function ChapterCard({ chapter, isDeleting, onDelete, showMangaTitle = false }: ChapterCardProps) {
  const chapterNumber = chapter.data.chapter
    ? `Ch. ${chapter.data.chapter}`
    : "Oneshot";
  
  return (
    <Card>
      <CardContent className="pt-4">
        {showMangaTitle && (
          <Link href={`/manga/${chapter.data.manga.id}`} className="block text-sm font-medium hover:underline mb-1">
            {chapter.data.manga.title}
          </Link>
        )}
        <h3 className="font-semibold">
          <Link href={`/chapter/${chapter.id}`} className="hover:underline">
            {chapterNumber} {chapter.data.title && `- ${chapter.data.title}`}
          </Link>
        </h3>
        <div className="text-sm text-muted-foreground mt-1">
          <p>Lưu {formatTimeToNow(new Date(chapter.savedAt))}</p>
          <p>
            {chapter.data.group && chapter.data.group.length > 0
              ? chapter.data.group.map((g: any) => g.name).join(", ")
              : "Không có nhóm dịch"}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-0">
        <Button asChild variant="outline" size="sm">
          <Link href={`/chapter/${chapter.id}`}>Đọc</Link>
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onDelete}
          disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </CardFooter>
    </Card>
  );
}
