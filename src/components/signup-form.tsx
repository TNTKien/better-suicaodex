"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface SignupFormProps extends React.HTMLAttributes<HTMLDivElement> {
  callback: string;
}

export function SignupForm({ className, callback, ...props }: SignupFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    const { error } = await signUp.email({
      name,
      email,
      password,
      callbackURL: callback,
    });

    setIsLoading(false);

    if (error) {
      toast.error(error.message ?? "Đăng ký thất bại");
      return;
    }

    router.push(callback);
    router.refresh();
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Đăng ký</h1>
      </div>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="name">Tên hiển thị</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Mật khẩu</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
            disabled={isLoading}
          />
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
        </Button>
      </form>
      <span className="text-center text-sm">
        Đã có tài khoản?{" "}
        <Link
          href={`/auth/signin?callback=${encodeURIComponent(callback)}`}
          className="underline"
        >
          Đăng nhập
        </Link>
      </span>
    </div>
  );
}
