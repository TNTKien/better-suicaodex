import Link from "next/link"
import type { Metadata } from "next"
import { TagsIcon } from "lucide-react"
import { Suspense } from "react"

import { getTags } from "@/lib/api"
import { buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"

export const metadata: Metadata = {
  title: "Thể loại",
  alternates: { canonical: "/tags" },
}

const tagGroupLabels: Record<string, string> = {
  content: "Nội dung",
  format: "Định dạng",
  genre: "Thể loại",
  theme: "Chủ đề",
}

export async function TagList() {
  const { data: tags } = await getTags()
  const tagGroups = tags.reduce<Map<string, typeof tags>>((groups, tag) => {
    const group = groups.get(tag.group)
    if (group) {
      group.push(tag)
    } else {
      groups.set(tag.group, [tag])
    }
    return groups
  }, new Map())

  return (
    <>
      {tags.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagsIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Chưa có thể loại</EmptyTitle>
            <EmptyDescription>
              Danh sách thể loại hiện chưa có nội dung.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {[...tagGroups].map(([group, groupTags]) => (
            <section className="flex flex-col gap-3" key={group}>
              <h2 className="text-lg font-semibold">
                {tagGroupLabels[group] ?? group}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {groupTags.map((tag) => (
                  <li key={tag.id}>
                    <Link
                      prefetch={false}
                      href={`/tag/${encodeURIComponent(tag.id)}/${encodeURIComponent(tag.slug)}`}
                      className={buttonVariants({
                        variant: "secondary",
                        size: "sm",
                      })}
                    >
                      {tag.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

export default function TagsPage() {
  return (
    <section className="mx-auto max-w-480 w-full flex flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">Thể loại</h1>
      <Suspense fallback={<Spinner aria-label="Đang tải danh sách thể loại" />}>
        <TagList />
      </Suspense>
    </section>
  )
}
