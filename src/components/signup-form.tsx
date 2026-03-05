"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { signUp } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const SignUpSchema = z
  .object({
    name: z.string().min(2, "Tên hiển thị phải có ít nhất 2 ký tự"),
    email: z.string().email("Email không hợp lệ"),
    password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Mật khẩu nhập lại không khớp",
    path: ["confirmPassword"],
  });

type SignUpValues = z.infer<typeof SignUpSchema>;

interface SignupFormProps extends React.HTMLAttributes<HTMLDivElement> {
  callback: string;
}

export function SignupForm({ className, callback, ...props }: SignupFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const form = useForm<SignUpValues>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: SignUpValues) => {
    const { name, email, password } = values;

    const { error } = await signUp.email({
      name,
      email,
      password,
      callbackURL: callback,
    });

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
      <Form {...form}>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên hiển thị</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    autoComplete="name"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mật khẩu</FormLabel>
                <FormControl>
                  <InputGroup>
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className="pr-11"
                      disabled={isLoading}
                      {...field}
                    />
                    <InputGroupAddon>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={
                          showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                        }
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </InputGroupAddon>
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nhập lại mật khẩu</FormLabel>
                <FormControl>
                  <InputGroup>
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className="pr-11"
                      disabled={isLoading}
                      {...field}
                    />
                    <InputGroupAddon>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setShowConfirmPassword((current) => !current)
                        }
                        aria-label={
                          showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                        }
                      >
                        {showConfirmPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </InputGroupAddon>
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
          </Button>
        </form>
      </Form>
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
