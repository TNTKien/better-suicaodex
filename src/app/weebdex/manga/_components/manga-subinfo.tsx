import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/config/site";
import { generateSlug } from "@/lib/utils";
import {
  generateFaviconURL,
  normalizeMangaLinks,
} from "@/lib/weebdex/manga-links";
import { Manga } from "@/lib/weebdex/model";
import { parseMangaTitle } from "@/lib/weebdex/utils";
import Link from "next/link";

interface MangaSubInfoProps {
  manga: Manga;
}

export default function MangaSubInfo({ manga }: MangaSubInfoProps) {
  if (!manga.relationships) return null;

  const { altTitles } = parseMangaTitle(manga);
  const links = normalizeMangaLinks(manga.relationships.links ?? {});

  return (
    <div className="flex flex-wrap gap-4">
      {!!manga.relationships.authors &&
        manga.relationships.authors.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label className="text-base font-bold">Tác giả</Label>
            <div className="flex flex-wrap gap-2">
              {manga.relationships.authors.map((a) => (
                <Button asChild key={a.id} variant="secondary" size="sm">
                  <Link
                    href={`/author/${a.id}/${generateSlug(a.name ?? "unknown")}`}
                    prefetch={false}
                  >
                    {a.name}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        )}

      {!!manga.relationships.artists &&
        manga.relationships.artists.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label className="text-base font-bold">Họa sĩ</Label>
            <div className="flex flex-wrap gap-2">
              {manga.relationships.artists.map((a) => (
                <Button asChild key={a.id} variant="secondary" size="sm">
                  <Link
                    href={`/author/${a.id}/${generateSlug(a.name ?? "unknown")}`}
                    prefetch={false}
                  >
                    {a.name}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        )}

      {!!manga.relationships.tags && manga.relationships.tags.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-base font-bold">Thể loại</Label>
          <div className="flex flex-wrap gap-2">
            {manga.relationships.tags.map((tag) => (
              <Button asChild key={tag.id} variant="secondary" size="sm">
                <Link
                  href={`/tag/${tag.id}/${generateSlug(tag.name ?? "unknown")}`}
                  prefetch={false}
                >
                  {tag.name}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label className="text-base font-bold">Các nguồn liên quan</Label>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link
              href={`${siteConfig.weebdex.domain}/title/${manga.id}`}
              target="_blank"
            >
              <img
                src={generateFaviconURL(siteConfig.weebdex.domain, 16)}
                width={16}
                height={16}
                alt="WeebDex Favicon"
              />
              WeebDex
            </Link>
          </Button>

          {links.length > 0 && (
            <>
              {links.map((link) => (
                <Button asChild key={link.key} variant="secondary" size="sm">
                  <Link href={link.url}>
                    {link.faviconUrl && (
                      <img
                        src={link.faviconUrl}
                        width={16}
                        height={16}
                        alt={`${link.siteName} Favicon`}
                      />
                    )}
                    {link.name}
                  </Link>
                </Button>
              ))}
            </>
          )}
        </div>
      </div>

      {altTitles.length > 0 && (
        <Collapsible className="w-full" defaultOpen={altTitles.length <= 5}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="group w-full pl-0! text-base font-bold justify-start"
            >
              Tên khác ({altTitles.length})
              {/* <ChevronDownIcon className="ml-auto group-data-[state=open]:rotate-180" /> */}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="flex flex-col items-start gap-2 pt-0 text-sm">
            {altTitles.map((name, index) => (
              <div className="grid grid-cols-1 w-full" key={`${name}-${index}`}>
                <span className="text-sm py-2 wrap-break-word">{name}</span>

                {index !== altTitles.length - 1 && (
                  <Separator className="w-full" />
                )}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
