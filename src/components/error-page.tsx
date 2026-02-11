"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, RefreshCw, Bug, Check, Clipboard } from "lucide-react";
import {
  SiDiscord,
  SiFacebook,
  SiGithub,
} from "@icons-pack/react-simple-icons";
import { siteConfig } from "@/config/site";
import { toast } from "sonner";
import "@/styles/error-page.css";

interface ErrorPageProps {
  error?: Error;
  reset?: () => void;
  message?: string;
  title?: string;
  statusCode?: number;
}

export default function ErrorPage({
  error,
  reset,
  message = "Có vẻ như có lỗi đã xảy ra. Trang bạn đang tìm kiếm không tồn tại hoặc không thể truy cập.",
  title = "Oops! Có lỗi xảy ra",
  statusCode = 404,
}: ErrorPageProps) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const quotes = [
    "Trang này đã biến mất như anime season 2 mà bạn đang chờ đợi...",
    "404 - Không tìm thấy trang, giống như tìm một bộ manga đã hoàn thành vậy",
    "Trang này đã biến mất nhanh hơn cả một chapter mới của HxH",
    "Có vẻ như trang này đã isekai sang một thế giới khác",
    "Đừng lo, One Piece vẫn chưa kết thúc, nhưng trang này thì đã kết thúc rồi",
    "Trang này đã biến mất như tóc của Saitama",
    "Bạn đã tìm kiếm trang này nhưng chỉ nhận được MUDA MUDA MUDA MUDA!",
    "Trang này đã bay mất giống như tiền lương khi bạn mua figure anime",
    "Rất tiếc, không ai có thể tìm thấy trang này, kể cả Conan",
    "Trang này đang nghỉ phép, sẽ trở lại sau một hiatus dài như Berserk",
    "404 - Trang này đã bị Thanos búng tay bay mất rồi",
    "Trang này đã bị xóa khỏi Death Note",
    "Trang này đã biến mất như kỹ năng xã hội của một weeb sau khi binge-watch 50 tập anime",
    "Tôi sẽ trở thành Vua Hải Tặc... à không, trang bạn đang tìm kiếm đấy!",
    "Nani?! Trang này không tồn tại?!",
    "Dù có Sharingan bạn cũng không thể tìm thấy trang này đâu",
    "Omae wa mou shindeiru... và cả trang bạn đang tìm kiếm cũng vậy",
    "Đừng lo, đây chỉ là một filler arc, trang bạn cần sẽ xuất hiện ở season sau",
  ];

  const [randomQuote] = useState(() => {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    return quotes[randomIndex];
  });

  const handleRetry = () => {
    setIsRetrying(true);
    if (reset) {
      reset();
    } else {
      router.refresh();
    }
    setTimeout(() => setIsRetrying(false), 1000);
  };

  const handleCopyError = async () => {
    if (error) {
      await navigator.clipboard.writeText(error.message);
      setHasCopied(true);
      toast.success("Đã sao chép chi tiết lỗi vào clipboard");
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] w-full items-center justify-center p-4 opacity-0 animate-fadeIn">
      <Card className="max-w-2xl w-full shadow-lg overflow-hidden border-2 border-primary/10">
        <CardHeader className="bg-linear-to-r from-primary/10 to-secondary/10 pb-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-white/10 mask-[linear-gradient(0deg,transparent,rgba(255,255,255,0.5),transparent)] -z-10"></div>
          <div className="mx-auto mb-4 text-6xl font-bold text-primary">
            {statusCode}
          </div>
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative h-60 w-60 shrink-0 mx-auto md:mx-0 animate-gentle-pulse">
              <Image
                src="/images/doro_think.webp"
                alt="Error Illustration"
                fill
                className="object-contain drop-shadow-md hover:scale-105 transition-transform duration-300 rounded-md"
                priority
                unoptimized
              />
            </div>
            <div className="space-y-4 text-center md:text-left">
              <p className="text-muted-foreground">{message}</p>
              <p className="text-sm italic text-muted-foreground">
                {randomQuote}
              </p>
              {error && (
                <div className="mt-4 p-3 bg-destructive/10 rounded-md text-sm text-destructive border border-destructive/20 shadow-xs hover:bg-destructive/15 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold">Chi tiết lỗi:</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive transition-colors"
                      onClick={void handleCopyError}
                    >
                      {hasCopied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Clipboard className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="font-mono break-all">{error.message}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 justify-center pt-2 pb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="gap-1 hover:bg-primary/10 hover:-translate-x-1 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="gap-1 hover:shadow-md transition-all hover:bg-primary/90 group"
            disabled={isRetrying}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                isRetrying ? "animate-spin" : "group-hover:animate-spin"
              }`}
            />
            Thử lại
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 hover:bg-secondary/70 transition-colors"
              >
                <Bug className="h-4 w-4" />
                Báo lỗi
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="animate-fadeScale">
              <DropdownMenuItem asChild>
                <Link
                  href={siteConfig.links.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <SiFacebook className="h-4 w-4 text-blue-600" />
                  <span>Facebook</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={siteConfig.links.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  <SiDiscord className="h-4 w-4 text-indigo-600" />
                  <span>Discord</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={siteConfig.links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <SiGithub className="h-4 w-4" />
                  <span>GitHub</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardFooter>
      </Card>
    </div>
  );
}
