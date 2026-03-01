import Link from "next/link";
import { buttonVariants } from "../ui/button";
import Banner from "./manga-banner";
import { cn } from "@/lib/utils";
import ShutUp from "#/images/shutup.webp";
import Image from "next/image";

export default function MangaNotFound() {
  return (
    <>
      <Banner src="/images/maintain.webp" />
      <div className="flex flex-col gap-4">
        <div className="flex flex-row items-start gap-6">
          <Image
            src={ShutUp}
            alt="404"
            className="w-[130px] md:w-[200px] h-auto rounded-sm drop-shadow-md shadow-md"
            priority
            quality={100}
          />
        </div>

        <p className="uppercase font-black text-3xl drop-shadow-lg text-center">
          Truyện bạn đang tìm không tồn tại!
        </p>
        <Link
          href="/"
          className={cn(
            buttonVariants({ size: "lg", variant: "secondary" }),
            "text-base"
          )}
        >
          Quay lại trang chủ
        </Link>
      </div>
    </>
  );
}
