"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { siteConfig } from "@/config/site";
import { useIsMobile } from "@/hooks/use-mobile";
import { GetAuthor } from "@/lib/mangadex/author";
import { cn } from "@/lib/utils";
import { Archive, Bookmark, Globe } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import useSWR from "swr";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import { AuthorDetail } from "@/types/types";
import {
  SiNaver,
  SiNiconico,
  SiPixiv,
  SiSinaweibo,
  SiTumblr,
  SiX,
  SiYoutube,
} from "@icons-pack/react-simple-icons";
import { Icons } from "@/components/icons";
import { Card } from "@/components/ui/card";
import AuthorTitles from "./author-titles";

interface AuthorProps {
  id: string;
}

export default function Author({ id }: AuthorProps) {
  const isMobile = useIsMobile();
  const { data, isLoading, error } = useSWR(
    ["author", id],
    ([, id]) => GetAuthor(id),
    {
      refreshInterval: 1000 * 60 * 10,
      revalidateOnFocus: false,
    }
  );

  if (isLoading)
    return (
      <div className="absolute h-[12.5rem] md:h-[16rem] z-[-2] w-auto left-0 right-0 top-0 block bg-gray-300 ease-in-out">
        <div
          className={cn(
            "absolute h-[12.5rem] md:h-[16rem] w-full",
            "transition-[width] duration-150 ease-in-out",
            "bg-no-repeat bg-cover bg-center-25"
          )}
          // style={{ backgroundImage: `url('/images/frieren.webp')` }}
        ></div>
        <div
          className={cn(
            "absolute h-[12.5rem] md:h-[16rem] w-auto inset-0 pointer-events-none",
            // "backdrop-blur-none md:backdrop-blur-sm",
            "bg-gradient-to-r from-black/25 to-transparent"
          )}
        ></div>
      </div>
    );
  if (error || !data) return <div>Lỗi mất rồi 😭</div>;

  // console.log(data);

  const socialEntries = formatToArray(data);
  const socialIcons = {
    twitter: <SiX />,
    pixiv: <SiPixiv />,
    melonBook: <Icons.melonbook />,
    fanBox: <Icons.fanbox />,
    booth: <Icons.booth />,
    namicomi: <Icons.namicomi />,
    nicoVideo: <SiNiconico />,
    skeb: <Icons.skeb />,
    fantia: <Icons.fantia />,
    tumblr: <SiTumblr />,
    youtube: <SiYoutube />,
    naver: <SiNaver />,
    weibo: <SiSinaweibo />,
    website: <Globe />,
  };
  return (
    <>
      <div className="absolute h-[12.5rem] md:h-[16rem] z-[-2] w-auto left-0 right-0 top-0 block">
        <div
          className={cn(
            "absolute h-[12.5rem] md:h-[16rem] w-full",
            "transition-[width] duration-150 ease-in-out",
            "bg-no-repeat bg-cover bg-center-25"
          )}
          style={{ backgroundImage: `url('/images/frieren.webp')` }}
        ></div>
        <div
          className={cn(
            "absolute h-[12.5rem] md:h-[16rem] w-auto inset-0 pointer-events-none",
            // "backdrop-blur-none md:backdrop-blur-sm",
            "bg-gradient-to-r from-black/25 to-transparent"
          )}
        ></div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mt-16 md:mt-20">
        <div className="flex flex-row md:flex-col gap-2 md:shrink-0 items-end">
          <Image
            src={data.imageUrl || "/images/hoxilo.webp"}
            alt={data.name}
            width={isMobile ? 120 : 200}
            height={isMobile ? 120 : 200}
            className="rounded-full border-4 border-primary object-cover shrink-0 w-[120px] h-[120px] md:w-[200px] md:h-[200px]"
            unoptimized
          />
          <div className="flex flex-row md:flex-col gap-2 w-full overflow-auto scrollbar-hidden">
            <Button
              className="w-full"
              // size={isMobile ? "lg" : "default"}
              onClick={() => toast.info("Chức năng đang phát triển!")}
            >
              <Bookmark />
              Theo dõi
            </Button>

            <Button
              asChild
              size={isMobile ? "icon" : "default"}
              className={cn(isMobile && "shrink-0")}
            >
              <Link
                href={`${siteConfig.mangadexAPI.webURL}/author/${id}`}
                target="_blank"
              >
                <Archive />
                {!isMobile && "MangaDex"}
              </Link>
            </Button>
          </div>
        </div>

        <div className="md:mt-[120px] flex flex-col gap-3 w-full">
          <p className="text-4xl md:text-5xl font-bold">{data.name}</p>

          {!data.bio && socialEntries.length === 0 && (
            <Card className="rounded-sm justify-center items-center flex h-16 w-full">
              Hổng có thông tin gì hết trơn!
            </Card>
          )}

          {!!data.bio && (
            <div className="flex flex-col gap-2">
              <Label className="text-lg font-bold">Mô tả</Label>
              <ReactMarkdown
                className="flex flex-col gap-1"
                remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <table className="table-auto border-collapse border border-secondary rounded-md w-fit">
                      {children}
                    </table>
                  ),
                  thead: ({ children }) => (
                    <thead className="border-b border-secondary">
                      {children}
                    </thead>
                  ),
                  tr: ({ children }) => (
                    <tr className="even:bg-secondary">{children}</tr>
                  ),
                  th: ({ children }) => (
                    <th className="px-2 py-1 text-left">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-2 py-1">{children}</td>
                  ),
                }}
              >
                {data.bio}
              </ReactMarkdown>
            </div>
          )}

          {socialEntries.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label className="text-lg font-bold">Mạng xã hội</Label>
              <div className="flex flex-wrap gap-2">
                {socialEntries.map((item) => {
                  const icon =
                    socialIcons[item.name as keyof typeof socialIcons];
                  return (
                    <Button
                      key={item.name}
                      asChild
                      variant="secondary"
                      className="w-full md:w-auto justify-start hover:bg-primary/25"
                    >
                      <Link
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-row gap-2 items-center capitalize"
                      >
                        {icon}
                        {item.name}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          <AuthorTitles id={id} />
        </div>
      </div>
    </>
  );
}

function formatToArray(author: AuthorDetail) {
  const socialEntries = Object.entries(author.social);
  return socialEntries
    .filter(([_, url]) => url !== null)
    .map(([name, url]) => ({
      name,
      url: url as string,
    }));
}
