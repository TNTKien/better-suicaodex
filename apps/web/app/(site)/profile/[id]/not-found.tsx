import Link from "next/link"
import { Button } from "@workspace/ui/components/button"

export default function ProfileNotFound() {
  return (
    <section className="mx-auto flex max-w-480 flex-col items-start gap-4 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Không tìm thấy trang cá nhân</h1>
      <p className="text-muted-foreground">
        Trang cá nhân này không tồn tại hoặc hiện không công khai.
      </p>
      <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
        Về trang chủ
      </Button>
    </section>
  )
}
