import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Cat, getCatImageUrl } from "@/lib/cat";
import { LazyLoadImage } from "react-lazy-load-image-component";

interface CatCardProps {
  cat: Cat;
}

export function CatCard({ cat }: CatCardProps) {
  return (
    <Card className="relative rounded-sm shadow-none transition-colors duration-200 w-full h-full border-none bg-background">
      <CardContent className="relative p-0 rounded-sm">
        <LazyLoadImage
          wrapperClassName="block! rounded-sm object-cover w-full h-full"
          placeholderSrc="/images/place-doro.webp"
          className="h-auto w-full rounded-sm block object-cover aspect-5/7"
          src={getCatImageUrl(cat.id, { width: 400, height: 400 })}
          alt={`Ảnh bìa ${cat.id}`}
          onError={(e) => {
            e.currentTarget.src = "/images/xidoco.webp";
          }}
        />
      </CardContent>

      <CardFooter className="py-2 px-0 flex flex-wrap gap-1">
        {cat.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} className="rounded-sm lowercase" variant="secondary">{tag}</Badge>
        ))}
      </CardFooter>
    </Card>
  );
}
