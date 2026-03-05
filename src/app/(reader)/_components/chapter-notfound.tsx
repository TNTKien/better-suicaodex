import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ChapterNotFound() {
  return (
    <div className="flex flex-col md:flex-row items-center justify-center">
      <img
        src="/images/cat-books.svg"
        alt="CatBooks"
        className="w-[400px] h-auto"
        loading="eager"
        decoding="async"
      />
      <div className="flex flex-col gap-4">
        <p className="uppercase font-black text-xl md:text-3xl drop-shadow-lg text-center">
          Chương bạn đang tìm không tồn tại!
        </p>
        <Button asChild>
          <Link href="/">Quay lại trang chủ</Link>
        </Button>
      </div>
    </div>
  );
}
