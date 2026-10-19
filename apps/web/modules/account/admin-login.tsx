"use client"

import Link from "next/link"
import { useMutation } from "@tanstack/react-query"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { siteConfig } from "@/config/site"
import { useAccount } from "./provider"

export function AdminLogin() {
  const { client, retry } = useAccount()
  const signIn = useMutation({
    networkMode: "always",
    mutationFn: async ({
      email,
      password,
    }: {
      email: string
      password: string
    }) => {
      const result = await client.signIn.email({ email, password })
      if (result.error) throw new Error("INVALID_CREDENTIALS")
      await retry()
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl font-bold">Đăng nhập quản trị</h1>
        </CardTitle>
        <CardDescription>
          Sử dụng tài khoản quản trị của {siteConfig.shortName}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            signIn.mutate({
              email: String(data.get("email")),
              password: String(data.get("password")),
            })
          }}
        >
          {signIn.isError && (
            <Alert variant="destructive">
              <AlertTitle>Không thể đăng nhập quản trị</AlertTitle>
              <AlertDescription>
                Email hoặc mật khẩu không đúng.
              </AlertDescription>
            </Alert>
          )}

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="admin-email">Email</FieldLabel>
              <Input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                disabled={signIn.isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="admin-password">Mật khẩu</FieldLabel>
              <Input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={signIn.isPending}
              />
            </Field>
          </FieldGroup>

          <Button className="h-11" type="submit" disabled={signIn.isPending}>
            {signIn.isPending && <Spinner data-icon="inline-start" />}
            Đăng nhập
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <Link
          className="text-sm text-muted-foreground underline underline-offset-4"
          href="/"
        >
          Quay lại trang chủ
        </Link>
      </CardFooter>
    </Card>
  )
}
