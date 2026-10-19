import type { Metadata } from "next"
import { Suspense } from "react"

import { Login } from "@/modules/account/login"

export const metadata: Metadata = {
  title: "Đăng nhập",
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(16rem,1.05fr)]">
      <section
        className="hvn-login-panel min-w-0"
        aria-labelledby="login-title"
      >
        <h1
          id="login-title"
          className="hvn-login-heading hvn-login-heading-main"
        >
          Đăng nhập
        </h1>
        <Suspense
          fallback={
            <p role="status" className="p-6 text-center">
              Đang kiểm tra đăng nhập…
            </p>
          }
        >
          <Login />
        </Suspense>
      </section>
      <aside className="hvn-login-panel" aria-labelledby="login-info-title">
        <h2
          id="login-info-title"
          className="hvn-login-heading hvn-login-heading-info"
        >
          Thông tin
        </h2>
        <div className="px-6 py-3 text-sm sm:text-base">
          <p className="font-bold">Sau khi đăng nhập bạn có thể:</p>
          <ul className="list-inside list-disc">
            <li>
              Sử dụng tính năng theo dõi truyện, bạn sẽ được nhận thông báo khi
              có chương mới.
            </li>
            <li>Bình luận và trả lời bình luận.</li>
            <li>Upload truyện của bạn dịch lên SuicaoDex.</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
