import Link from "next/link"

import { buttonVariants } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { siteConfig } from "@/config/site"
import { BugIcon, HomeIcon } from "lucide-react"

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-4 py-12 sm:px-6">
      <Empty className="border-3 border-dashed">
        <EmptyHeader>
          <EmptyTitle className="font-mono text-8xl">404</EmptyTitle>
          <EmptyDescription>
            Trang này không tồn tại hoặc đã bị xóa. Nếu bạn cho rằng đây là lỗi,
            hãy nhấn nút Báo lỗi bên dưới
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="grid grid-cols-1 justify-center gap-2 md:grid-cols-2">
          <Link className={buttonVariants()} href="/">
            <HomeIcon />
            Trang chủ
          </Link>
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
