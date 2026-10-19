"use client"

import Link from "next/link"
import { BugIcon, Repeat2Icon } from "lucide-react"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { siteConfig } from "@/config/site"

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-4 py-12 sm:px-6">
      <Empty className="border-3 border-dashed border-destructive bg-destructive/10">
        <EmptyHeader>
          <EmptyTitle className="font-mono text-4xl text-destructive sm:text-7xl md:text-8xl">
            ERR0R
          </EmptyTitle>
          <EmptyDescription>
            Đã có lỗi xảy ra, vui lòng thử lại sau giây lát. Nếu vẫn tiếp diễn,
            hãy nhấn nút Báo lỗi bên dưới
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="grid grid-cols-1 justify-center gap-2 md:grid-cols-2">
          <Button onClick={reset}>
            <Repeat2Icon aria-hidden="true" data-icon="inline-start" />
            Thử lại
          </Button>
          <Link
            className={buttonVariants({ variant: "secondary" })}
            href={siteConfig.links.discord}
          >
            <BugIcon />
            Báo lỗi
          </Link>
        </EmptyContent>
      </Empty>
    </div>
  )
}
