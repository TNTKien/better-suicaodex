import { Suspense } from "react"
import { io } from "next/cache"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"

import { getHomeCatalog } from "@/modules/home/api"
import { MangaSection } from "@/modules/home/manga-section"
import { TopView, TopViewSkeleton } from "@/modules/home/top-view"
import { TopGroups, TopGroupsSkeleton } from "@/modules/home/top-groups"
import { RecentComments } from "@/modules/home/recent-comments"
import { getApiBaseUrl } from "@/lib/api-url"

function HomeNotice() {
  return (
    <Alert role="note" aria-label="Thông báo" className="hvn-home-notice w-fit self-center py-2.5! px-3!">
      <AlertTitle className="hvn-home-notice-label">Thông báo</AlertTitle>
      <AlertDescription className="hvn-home-notice-text text-pretty">
        Hãy <span className="text-cyan-700">Bình luận</span> để ủng hộ các chủ thớt nhé!
      </AlertDescription>
    </Alert>
  )
}

async function HomeCatalog() {
  await io()
  const {
    featured,
    latest,
    recent,
    random,
    randomError,
    initialRanking,
    initialGroupRanking,
    comments,
    commentsError,
    featuredError,
    latestError,
    recentError,
  } = await getHomeCatalog()
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MangaSection kind="featured" manga={featured} error={featuredError} />
      <HomeNotice />
      <MangaSection kind="latest" manga={latest} error={latestError} />
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <MangaSection kind="recent" manga={recent} error={recentError} />
          <MangaSection kind="random" manga={random} error={randomError} />
        </div>
        <aside
          aria-label="Bảng xếp hạng và bình luận mới"
          className="flex min-w-0 flex-col gap-4"
        >
          <TopView
            apiBaseUrl={getApiBaseUrl()}
            initialRanking={initialRanking}
          />
          <TopGroups
            apiBaseUrl={getApiBaseUrl()}
            initialRanking={initialGroupRanking}
          />
          <RecentComments comments={comments} error={commentsError} />
        </aside>
      </div>
    </div>
  )
}

function HomeSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MangaSection kind="featured" manga={[]} loading />
      <HomeNotice />
      <MangaSection kind="latest" manga={[]} loading />
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <MangaSection kind="recent" manga={[]} loading />
          <MangaSection kind="random" manga={[]} loading />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <TopViewSkeleton />
          <TopGroupsSkeleton />
          <RecentComments comments={[]} loading />
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeCatalog />
    </Suspense>
  )
}
