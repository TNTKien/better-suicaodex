import Image from "next/image"
import Link from "next/link"

export default function NotFound() {
  return (
    <section
      aria-labelledby="not-found-title"
      className="pb-1 text-center text-lg text-white"
    >
      <h1 id="not-found-title" className="text-3xl font-bold sm:text-4xl">
        Error 404 Not Found
      </h1>
      <Image
        src="/brand/ayame-404.webp"
        alt="Ayame không tìm thấy trang"
        width={190}
        height={234}
        loading="eager"
        className="mx-auto h-auto w-60 max-w-full"
        unoptimized
      />
      <p className="text-[#ff0000]">Không tìm thấy!</p>
      <p className="mt-1">
        Link không tồn tại hoặc đã bị xóa. Nhấp{" "}
        <Link href="/" className="font-bold text-[#00bfff] hover:underline">
          vào đây
        </Link>{" "}
        để trở về trang chủ nhé.
      </p>
    </section>
  )
}
