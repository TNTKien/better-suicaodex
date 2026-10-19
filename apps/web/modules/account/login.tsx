"use client"

import Link from "next/link"
import { useRouter } from "@bprogress/next/app"
import { useLogin } from "@workspace/account/login"
import SiDiscord from "@icons-pack/react-simple-icons/icons/SiDiscord"
import SiGoogle from "@icons-pack/react-simple-icons/icons/SiGoogle"
import SiGithub from "@icons-pack/react-simple-icons/icons/SiGithub"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardFooter,
} from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { siteConfig } from "@/config/site"
import { useAccount } from "./provider"

const providers = [
  { id: "discord", name: "Discord", icon: SiDiscord },
  { id: "google", name: "Google", icon: SiGoogle },
  { id: "github", name: "GitHub", icon: SiGithub },
] as const

export function Login() {
  const { client, status, retry } = useAccount()
  const router = useRouter()
  const { params, returnTo, complete, signIn } = useLogin({
    client,
    status,
    router,
  })

  if (status === "authenticated") return null

  if (complete && status === "loading") {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 py-8"
      >
        <Spinner aria-hidden="true" />
        Đang xác nhận đăng nhập…
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <h1 className="text-2xl font-bold">Đăng nhập</h1>
        <CardDescription>
          Sử dụng tài khoản của bạn để tiếp tục với {siteConfig.shortName}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(params.has("error") ||
          signIn.isError ||
          (complete && status === "guest")) && (
          <Alert variant="destructive">
            <AlertTitle>Đăng nhập chưa hoàn tất</AlertTitle>
            <AlertDescription>
              {complete
                ? "Chưa xác nhận được phiên đăng nhập. Kiểm tra cookie và thử lại."
                : "Bạn có thể đã hủy đăng nhập hoặc phiên xác thực đã hết hạn. Vui lòng thử lại."}
            </AlertDescription>
          </Alert>
        )}
        {status === "error" && (
          <Alert variant="destructive">
            <AlertTitle>Chưa kiểm tra được phiên đăng nhập</AlertTitle>
            <AlertDescription>Kiểm tra kết nối tới máy chủ.</AlertDescription>
            <Button
              className="mt-3 w-fit"
              variant="outline"
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
              className="h-11"
              variant="outline"
              disabled={
                signIn.isPending || status === "loading" || status === "error"
              }
              onClick={() => signIn.mutate(id)}
            >
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Icon aria-hidden="true" data-icon="inline-start" />
              )}
              {pending ? "Đang chuyển đến" : "Tiếp tục với"} {name}
            </Button>
          )
        })}
      </CardContent>
      <CardFooter>
        <Link
          className="text-sm text-muted-foreground underline underline-offset-4"
          href={returnTo}
        >
          Quay lại
        </Link>
      </CardFooter>
    </Card>
  )
}
