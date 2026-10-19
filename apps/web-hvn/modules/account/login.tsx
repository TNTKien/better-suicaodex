"use client"

import { useRouter } from "next/navigation"
import { useLogin } from "@workspace/account/login"
import SiDiscord from "@icons-pack/react-simple-icons/icons/SiDiscord"
import SiGithub from "@icons-pack/react-simple-icons/icons/SiGithub"
import SiGoogle from "@icons-pack/react-simple-icons/icons/SiGoogle"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import type { SocialProvider } from "./client"
import { useAccount } from "./provider"

const providers = [
  { id: "discord", name: "Discord", icon: SiDiscord },
  { id: "github", name: "GitHub", icon: SiGithub },
  { id: "google", name: "Google", icon: SiGoogle },
] satisfies { id: SocialProvider; name: string; icon: typeof SiDiscord }[]

export function Login() {
  const { client, status, retry } = useAccount()
  const router = useRouter()
  const { params, complete, signIn } = useLogin({ client, status, router })

  if (status === "authenticated") {
    return (
      <p role="status" className="p-6 text-center">
        Đang chuyển trang…
      </p>
    )
  }

  if (complete && status === "loading") {
    return (
      <p role="status" className="flex items-center justify-center gap-2 p-6">
        <Spinner aria-hidden="true" />
        Đang xác nhận đăng nhập…
      </p>
    )
  }

  return (
    <div
      className="mx-auto flex w-full max-w-sm flex-col gap-3 px-4 py-6 sm:px-0"
      aria-busy={status === "loading" || signIn.isPending}
    >
      {(params.has("error") ||
        signIn.isError ||
        (complete && status === "guest")) && (
        <Alert variant="destructive">
          <AlertTitle>Đăng nhập chưa hoàn tất</AlertTitle>
          <AlertDescription>
            {complete
              ? "Chưa xác nhận được phiên đăng nhập. Vui lòng thử lại."
              : "Không thể đăng nhập. Bạn có thể đã hủy thao tác, vui lòng thử lại."}
          </AlertDescription>
        </Alert>
      )}
      {status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Không thể kiểm tra phiên đăng nhập</AlertTitle>
          <AlertDescription>
            Vui lòng kiểm tra kết nối và thử lại.
          </AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-fit"
            onClick={() => void retry()}
          >
            Thử lại
          </Button>
        </Alert>
      )}
      {providers.map(({ id, name, icon: Icon }) => {
        const pending = signIn.isPending && signIn.variables === id
        return (
          <Button
            key={id}
            className="hvn-button hvn-placeholder h-10 w-full"
            disabled={
              signIn.isPending || status === "loading" || status === "error"
            }
            onClick={() => signIn.mutate(id)}
          >
            {pending ? (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            ) : (
              <Icon data-icon="inline-start" aria-hidden="true" />
            )}
            {pending ? "Đang chuyển đến" : "Đăng nhập bằng"} {name}
          </Button>
        )
      })}
    </div>
  )
}
