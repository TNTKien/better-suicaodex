"use client"

import type { ReactNode } from "react"
import { ListIcon, MessagesSquareIcon, SproutIcon } from "lucide-react"
import { useQueryState } from "nuqs"

import { mangaTabParser, type MangaTab } from "@/lib/catalog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

export function MangaTabs({
  chapters,
  comments,
  recommendations,
}: {
  chapters: ReactNode
  comments: ReactNode
  recommendations: ReactNode
}) {
  const [tab, setTab] = useQueryState("tab", mangaTabParser)

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => void setTab(value as MangaTab)}
    >
      <TabsList
        aria-label="Nội dung truyện"
        className="grid w-full grid-cols-3 sm:flex sm:w-fit"
      >
        <TabsTrigger aria-label="Danh sách chương" value="chapters">
          <ListIcon aria-hidden="true" />
          <span className="hidden sm:inline">Danh sách chương</span>
          <span className="sm:hidden">Chương</span>
        </TabsTrigger>
        <TabsTrigger value="comments">
          <MessagesSquareIcon aria-hidden="true" />
          Bình luận
        </TabsTrigger>
        <TabsTrigger aria-label="Có thể bạn sẽ thích" value="recommendations">
          <SproutIcon aria-hidden="true" />
          <span className="hidden sm:inline">Có thể bạn sẽ thích</span>
          <span className="sm:hidden">Gợi ý</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="chapters">{chapters}</TabsContent>
      <TabsContent value="comments">{comments}</TabsContent>
      <TabsContent value="recommendations">{recommendations}</TabsContent>
    </Tabs>
  )
}
