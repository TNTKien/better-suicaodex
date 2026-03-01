"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CircleHelp, Minus, Plus } from "lucide-react";

export default function AdvancedSearchGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="rounded-full" size="icon" variant="secondary">
          <CircleHelp />
        </Button>
      </DialogTrigger>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Hướng dẫn</DialogTitle>
          <DialogDescription>
            Lưu ý: Tìm kiếm nâng cao không bị ảnh hưởng bởi Tùy chỉnh nội dung
            của bạn.
          </DialogDescription>
        </DialogHeader>

        <Accordion type="multiple" className="w-full">
          <AccordionItem value="tags">
            <AccordionTrigger className="hover:no-underline py-2">
              <div className="flex flex-col">
                <span className="text-base">Thể loại</span>
                <span className="text-sm text-muted-foreground font-normal">
                  Mặc định: Tất cả
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex items-center gap-1">
                Click 1 lần để thêm
                <span className="flex items-center">
                  <Plus size={18} /> Tag
                </span>
              </div>
              <div className="flex items-center gap-1">
                Click 2 lần để loại trừ
                <span className="flex items-center text-destructive">
                  <Minus size={18} /> Tag
                </span>
              </div>
              <div className="flex items-center gap-1">
                Click 3 lần để reset
                <span className="text-muted-foreground">Tag</span>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="content">
            <AccordionTrigger className="hover:no-underline py-2">
              <div className="flex flex-col">
                <span className="text-base">Giới hạn nội dung</span>
                <span className="text-sm text-muted-foreground font-normal">
                  Mặc định: Safe → Erotica
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ol>
                <li>
                  <span className="text-green-500">Safe</span> - Lành mạnh
                </li>
                <li>
                  <span className="text-yellow-400">Suggestive</span> - Hơi hơi
                </li>
                <li>
                  <span className="text-red-400">Erotica</span> - Cũng tạm
                </li>
                <li>
                  <span className="text-red-600">Pornographic</span> - SEGGGGG!!!
                </li>
              </ol>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="other" className="border-none">
            <AccordionTrigger className="hover:no-underline py-2">
              <div className="flex flex-col">
                <span className="text-base">Còn lại</span>
                <span className="text-sm text-muted-foreground font-normal">
                  Mặc định: Tất cả
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              Mấy cái này nhìn là hiểu rồi, khỏi hướng dẫn.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}
