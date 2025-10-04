"use client";

import { getCovers } from "@/lib/mangadex/cover";
import { Expand, Globe, Loader2 } from "lucide-react";
import useSWR from "swr";
import { Card, CardContent, CardFooter } from "../ui/card";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { cn, getCoverImageUrl } from "@/lib/utils";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "../ui/dialog";
import { GB, JP, VN } from "country-flag-icons/react/3x2";
import { MultiSelect } from "../ui/multi-select";
import { useIsMobile } from "@/hooks/use-mobile";
import { Cover } from "@/types/types";

interface MangaCoversTabProps {
  id: string;
}

export default function MangaCoversTab({ id }: MangaCoversTabProps) {
  const isMobile = useIsMobile();
  const { data, error, isLoading } = useSWR(
    ["manga-covers", [id]],
    ([, [id]]) => getCovers([id]),
    {
      refreshInterval: 1000 * 60 * 30,
      revalidateOnFocus: false,
    }
  );
  const [loaded, setLoaded] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState(["ja", "vi"]);

  if (isLoading)
    return (
      <div className="flex justify-center items-center w-full h-16">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );

  if (error) {
    return (
      <Card className="mt-4 rounded-sm justify-center items-center flex h-16 w-full">
        <p className="italic">Lỗi mất rồi 😭</p>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="mt-4 rounded-sm justify-center items-center flex h-16 w-full">
        <p className="italic">Không có kết quả!</p>
      </Card>
    );
  }

  // console.log(data);
  const localeList = [
    { value: "ja", label: "Tiếng Nhật", icon: JP },
    { value: "vi", label: "Tiếng Việt", icon: VN },
    { value: "en", label: "Tiếng Anh", icon: GB },
    { value: "other", label: "Khác", icon: Globe },
  ];

  // console.log("filtered: ", filterByLocale(selectedLocale, data));

  return (
    <>
      <MultiSelect
        className="w-full mt-4 shadow-sm"
        placeholder="Mặc định"
        disableFooter
        disableSearch
        onValueChange={setSelectedLocale}
        options={localeList}
        defaultValue={selectedLocale}
        maxCount={isMobile ? 1 : 4}
      />

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {filterByLocale(selectedLocale, data).map((cover) => (
          <Card
            key={cover.id}
            className="relative rounded-sm shadow-md drop-shadow-md transition-colors duration-200 w-full  border-none"
          >
            <Dialog>
              <DialogTrigger className="z-10 flex opacity-0 hover:opacity-100 transition-opacity items-center justify-center absolute inset-0 bg-black bg-opacity-50 rounded-sm cursor-pointer">
                <Expand size={45} color="white" />
              </DialogTrigger>

              <DialogContent className="[&>button]:hidden bg-transparent border-none border-0 shadow-none p-0 w-full h-auto !rounded-none justify-center">
                <DialogTitle className="hidden"></DialogTitle>
                <DialogDescription className="hidden"></DialogDescription>

                <DialogClose className="fixed inset-0 z-0 !block cursor-default" />
                <div className="max-w-[90vw] md:max-w-screen max-h-[90vh] lg:max-h-screen flex justify-center items-center relative z-10">
                  <div className="absolute bg-secondary p-5 rounded-sm">
                    <Loader2 className="animate-spin" size={50} />
                  </div>
                  <img
                    src={getCoverImageUrl(id, cover.fileName, "full")}
                    alt={`Ảnh bìa ${cover.volume}`}
                    className="max-h-full max-w-full object-cover z-20"
                    fetchPriority="high"
                    onError={(e) => {
                      e.currentTarget.src = "/images/xidoco.webp";
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>

            <CardContent className="p-0  w-full">
              <LazyLoadImage
                wrapperClassName={cn(
                  "!block rounded-sm object-cover w-full",
                  !loaded && "aspect-[5/7]"
                )}
                placeholderSrc="/images/place-doro.webp"
                className={cn(
                  "w-full rounded-sm block object-cover aspect-[5/7]"
                )}
                src={getCoverImageUrl(id, cover.fileName, "512")}
                alt={`Ảnh bìa tập ${cover.volume}`}
                onLoad={() => setLoaded(true)}
                onError={(e) => {
                  e.currentTarget.src = "/images/xidoco.webp";
                }}
                //visibleByDefault
              />
            </CardContent>
            <CardFooter className="absolute bottom-0 p-2 bg-gradient-to-t from-black w-full rounded-b-sm dark:rounded-b-none max-h-full items-end">
              <p className="text-base font-semibold line-clamp-1 break-all hover:line-clamp-none text-white drop-shadow-sm">
                {!!cover.volume ? `Volume ${cover.volume}` : "No Volume"}
              </p>
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  );
}

function filterByLocale(locales: string[], covers: Cover[]): Cover[] {
  if (locales.length === 0)
    return covers.filter((cover) => {
      const coverLocale = cover.locale;
      return ["ja", "vi"].includes(coverLocale);
    });

  if (locales.length === 1 && locales.includes("other"))
    return covers.filter((cover) => {
      const coverLocale = cover.locale;
      return !["ja", "vi", "en"].includes(coverLocale);
    });

  if (locales.length === 4 && locales.includes("other")) return covers;

  return covers.filter((cover) => {
    const coverLocale = cover.locale;
    return locales.includes(coverLocale);
  });
}
