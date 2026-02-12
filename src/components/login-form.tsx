"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SiDiscord, SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";
import { signIn } from "next-auth/react";

interface LoginFormProps extends React.HTMLAttributes<HTMLDivElement> {
  callback: string;
}

export function LoginForm({ className, callback, ...props }: LoginFormProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Đăng nhập bằng:</h1>
      </div>
      <div className="grid gap-4">
        <Button
          className="bg-[#5865F2] text-white hover:bg-[#5865F2]/80"
          onClick={() =>
            void signIn("discord", {
              redirectTo: callback,
            })
          }
        >
          <SiDiscord /> Discord
        </Button>

        <Button
          className="text-white bg-stone-800  hover:bg-stone-800/80"
          onClick={() =>
            void signIn("google", {
              redirectTo: callback,
            })
          }
        >
          <SiGoogle /> Google
        </Button>

        <Button
          className="bg-slate-700  text-white hover:bg-slate-700/80"
          onClick={() =>
            void signIn("github", {
              redirectTo: callback,
            })
          }
        >
          <SiGithub /> Github
        </Button>
      </div>
      <span className="text-center text-sm">
        Chưa có tài khoản? Cứ bấm đi là có.
      </span>
    </div>
  );
}
