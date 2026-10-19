"use client"

import { ChevronDownIcon, FileTextIcon } from "lucide-react"
import { Streamdown } from "streamdown"

import { basicMarkdownElements } from "@/lib/markdown"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"

const mangaSubmissionRules = `1. **KHÔNG** được phép đăng

   - Truyện Hentai, hoặc truyện có yếu tố 18+ nặng.
   - Truyện có yếu tố chống phá, bôi nhọ Đảng và Nhà nước Việt Nam hoặc có yếu tố chính trị nhạy cảm.
   - Manhwa.

2. Tiêu chuẩn tối thiểu

   - Truyện được đăng phải là bản dịch tiếng Việt hoặc truyện Việt, không đăng bản raw (bản gốc) hay bất kỳ ngôn ngữ nào khác tiếng Việt.
   - Truyện phải bảo đảm được khả năng edit truyện mức tối thiểu trở lên (redraw, dùng font phù hợp...). **KHÔNG** đòi hỏi truyện phải hoàn hảo, nhưng ít nhất phải chấp nhận được.

3. Xử lý vi phạm

   - Truyện vi phạm/không đạt chuẩn sẽ bị xoá không báo trước.
   - Cân nhắc xử lý người đăng tuỳ theo mức độ/hành vi vi phạm.`

export function MangaSubmissionRules() {
  return (
    <Collapsible
      className="group/rules overflow-hidden rounded-xl border bg-card"
      defaultOpen={false}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-5">
        <FileTextIcon aria-hidden="true" className="size-5 text-primary" />
        <span className="min-w-0 flex-1 font-heading font-semibold">
          Nội quy đăng truyện
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className="size-5 shrink-0 transition-transform group-data-open/rules:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Streamdown
          allowedElements={basicMarkdownElements}
          className="border-t px-4 py-4 text-sm leading-6 text-foreground sm:px-5"
          controls={false}
          mode="static"
          skipHtml
        >
          {mangaSubmissionRules}
        </Streamdown>
      </CollapsibleContent>
    </Collapsible>
  )
}
