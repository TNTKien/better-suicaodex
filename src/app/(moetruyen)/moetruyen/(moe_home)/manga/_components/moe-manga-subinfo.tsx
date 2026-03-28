import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { siteConfig } from "@/config/site";
import Link from "next/link";
import { LazyLoadImage } from "react-lazy-load-image-component";

interface MoeGenre {
  id: number;
  name: string;
}

export interface MoeMangaSubInfoData {
  author: string | null;
  genres: MoeGenre[];
  slug: string;
}

export default function MoeMangaSubInfo({
  data,
}: {
  data: MoeMangaSubInfoData;
}) {
  return (
    <div className="flex flex-wrap gap-4">
      {data.author ? (
        <div className="flex flex-col gap-2">
          <Label className="text-base font-bold">Tác giả</Label>
          <div className="flex flex-wrap gap-2">
            {data.author.split(",").map((author) => (
              <Button variant="secondary" size="sm" key={author}>
                {author}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {data.genres.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label className="text-base font-bold">Thể loại</Label>
          <div className="flex flex-wrap gap-2">
            {data.genres.map((genre) => (
              <Button key={genre.id} variant="secondary" size="sm">
                {genre.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label className="text-base font-bold">Các nguồn liên quan</Label>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link
              href={`${siteConfig.moetruyen.domain}/manga/${data.slug}`}
              target="_blank"
            >
              <LazyLoadImage
                src="https://www.google.com/s2/favicons?sz=64&domain_url=https://moetruyen.net"
                alt="MoeTruyen Favicon"
                className="h-4 w-4 rounded-full"
                wrapperClassName="block!"
                visibleByDefault
              />
              MoeTruyen
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
