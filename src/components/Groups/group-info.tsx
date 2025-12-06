"use client";

import { getGroup } from "@/lib/mangadex/group";
import Image from "next/image";
import useSWR from "swr";
import { Button } from "../ui/button";
import { Archive, Ban, Bookmark, Globe, Mail, ShieldUser } from "lucide-react";
import { toast } from "sonner";
import GroupStats from "./group-stats";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn, isFacebookUrl } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "../ui/label";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import { SiDiscord, SiFacebook, SiX } from "@icons-pack/react-simple-icons";
import { CN, GB, JP, KR, VN } from "country-flag-icons/react/3x2";
import GroupTitles from "./GroupTitles";

interface GroupInfoProps {
  id: string;
}

export default function GroupInfo({ id }: GroupInfoProps) {
  const isMobile = useIsMobile();
  const { data, isLoading, error } = useSWR(
    ["group", id],
    ([, id]) => getGroup(id),
    {
      refreshInterval: 1000 * 60 * 10,
      revalidateOnFocus: false,
    }
  );

  const displayLanguage = [
    { iso: "en", name: "Tiếng Anh", icon: GB },
    { iso: "vi", name: "Tiếng Việt", icon: VN },
    { iso: "ja", name: "Tiếng Nhật", icon: JP },
    { iso: "ko", name: "Tiếng Hàn", icon: KR },
    { iso: "zh", name: "Tiếng Trung", icon: CN },
  ];

  if (isLoading)
    return (
      <div className="absolute h-50 md:h-64 z-[-2] w-auto left-0 right-0 top-0 block bg-gray-300 ease-in-out">
        <div
          className={cn(
            "absolute h-50 md:h-64 w-full",
            "transition-[width] duration-150 ease-in-out",
            "bg-no-repeat bg-cover bg-position-[center_top_25%]"
          )}
          // style={{ backgroundImage: `url('/images/frieren.webp')` }}
        ></div>
        <div
          className={cn(
            "absolute h-50 md:h-64 w-auto inset-0 pointer-events-none",
            // "backdrop-blur-none md:backdrop-blur-xs",
            "bg-linear-to-r from-black/25 to-transparent"
          )}
        ></div>
      </div>
    );
  if (error || !data) return <div>Lỗi mất rồi 😭</div>;

  // console.log(data);
  return (
    <>
      <div className="absolute h-50 md:h-64 z-[-2] w-auto left-0 right-0 top-0 block">
        <div
          className={cn(
            "absolute h-50 md:h-64 w-full",
            "transition-[width] duration-150 ease-in-out",
            "bg-no-repeat bg-cover bg-position-[center_top_25%]"
          )}
          style={{ backgroundImage: `url('/images/frieren.webp')` }}
        ></div>
        <div
          className={cn(
            "absolute h-50 md:h-64 w-auto inset-0 pointer-events-none",
            // "backdrop-blur-none md:backdrop-blur-xs",
            "bg-linear-to-r from-black/25 to-transparent"
          )}
        ></div>

        {/* <div
          className={cn(
            "md:hidden",
            "absolute h-50 md:h-64 w-auto inset-0 pointer-events-none backdrop-blur-[2px]"
          )}
          style={{
            background:
              "linear-gradient(to top, hsl(var(--background) / .6) 0%, hsl(var(--background)) 100%)",
          }}
        ></div> */}
      </div>
      <div className="flex flex-col md:flex-row gap-4 mt-16 md:mt-20">
        <div className="flex flex-row md:flex-col gap-2 md:shrink-0 items-end">
          <Image
            src="/images/doro_think.webp"
            alt={data.name}
            width={isMobile ? 120 : 200}
            height={isMobile ? 120 : 200}
            className="rounded border-4 border-primary object-cover shrink-0"
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
                href={`${siteConfig.mangadexAPI.webURL}/group/${id}`}
                target="_blank"
              >
                <Archive />
                {!isMobile && "MangaDex"}
              </Link>
            </Button>
            <Button
              size={isMobile ? "icon" : "default"}
              className={cn(isMobile && "shrink-0")}
              variant="secondary"
              onClick={() => toast.info("Chức năng đang phát triển!")}
            >
              <Ban />
              {!isMobile && "Chặn"}
            </Button>
          </div>
        </div>

        <div className="md:mt-[120px] flex flex-col gap-2 w-full">
          <p className="text-4xl md:text-5xl font-bold">{data.name}</p>
          <GroupStats id={id} />

          <Tabs defaultValue="info">
            <TabsList className="rounded-md">
              <TabsTrigger className="rounded-md" value="info">
                Thông tin
              </TabsTrigger>
              <TabsTrigger className="rounded-md" value="title">
                Truyện đã đăng
              </TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="flex flex-col gap-4">
              {!!data.description && (
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
                    {data.description}
                  </ReactMarkdown>
                </div>
              )}

              {(!!data.website ||
                !!data.discord ||
                !!data.email ||
                !!data.twitter) && (
                <div className="flex flex-col gap-2">
                  <Label className="text-lg font-bold">Liên hệ</Label>
                  <div className=" flex flex-col md:flex-row gap-2 items-center">
                    {!!data.website && (
                      <Button
                        asChild
                        className="w-full md:w-auto justify-start"
                        variant="secondary"
                      >
                        <Link href={data.website} target="_blank">
                          {isFacebookUrl(data.website) ? (
                            <>
                              <SiFacebook />
                              Facebook
                            </>
                          ) : (
                            <>
                              <Globe />
                              Website
                            </>
                          )}
                        </Link>
                      </Button>
                    )}
                    {!!data.discord && (
                      <Button
                        asChild
                        className="w-full md:w-auto justify-start"
                        variant="secondary"
                      >
                        <Link
                          href={`https://discord.gg/${data.discord}`}
                          target="_blank"
                        >
                          <SiDiscord />
                          Discord
                        </Link>
                      </Button>
                    )}
                    {!!data.email && (
                      <Button
                        asChild
                        className="w-full md:w-auto justify-start"
                        variant="secondary"
                      >
                        <Link href={`mailto:${data.email}`} target="_blank">
                          <Mail />
                          Email
                        </Link>
                      </Button>
                    )}
                    {!!data.twitter && (
                      <Button
                        asChild
                        className="w-full md:w-auto justify-start"
                        variant="secondary"
                      >
                        <Link href={data.twitter} target="_blank">
                          <SiX />@
                          {data.twitter.replace("https://twitter.com/", "")}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {!!data.leader && (
                <div className="flex flex-col gap-2">
                  <Label className="text-lg font-bold">Trưởng nhóm</Label>
                  <Button
                    asChild
                    variant="secondary"
                    className="w-full md:w-fit justify-start md:justify-center"
                  >
                    <Link
                      href={`${siteConfig.mangadexAPI.webURL}/user/${data.leader.id}`}
                      target="_blank"
                    >
                      <ShieldUser />
                      {data.leader.username}
                    </Link>
                  </Button>
                </div>
              )}

              {data.language.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label className="text-lg font-bold">Ngôn ngữ</Label>
                  <div className="flex flex-col md:flex-row gap-2 items-center">
                    {(() => {
                      // Filter known languages
                      const knownLangs = data.language.filter((lang) =>
                        displayLanguage.some((l) => l.iso === lang)
                      );

                      // Filter unknown languages
                      const unknownLangs = data.language.filter(
                        (lang) => !displayLanguage.some((l) => l.iso === lang)
                      );

                      // Create buttons for known languages
                      const knownButtons = knownLangs.map((lang) => {
                        const langInfo = displayLanguage.find(
                          (l) => l.iso === lang
                        );
                        const LangIcon = langInfo?.icon;
                        return (
                          <Button
                            key={lang}
                            className="w-full md:w-auto justify-start"
                            variant="secondary"
                          >
                            {LangIcon && <LangIcon />}
                            {langInfo?.name}
                          </Button>
                        );
                      });

                      // Create button for unknown languages if any
                      const unknownButton =
                        unknownLangs.length > 0 ? (
                          <Button
                            key="other"
                            className="w-full md:w-auto justify-start"
                            variant="secondary"
                          >
                            <Globe />
                            Khác{" "}
                            {unknownLangs.length > 0 &&
                              `(+${unknownLangs.length})`}
                          </Button>
                        ) : null;

                      return [...knownButtons, unknownButton];
                    })()}
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="title">
              <GroupTitles id={id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
