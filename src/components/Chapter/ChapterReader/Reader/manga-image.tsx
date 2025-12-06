"use client";

import { useConfig } from "@/hooks/use-config";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";

interface MangaImageProps {
  src: string;
  alt: string;
  onLoaded: () => void;
  isPreloaded?: boolean;
}

export default function MangaImage({ src, alt, onLoaded, isPreloaded = false }: MangaImageProps) {
  const [config] = useConfig();
  const [loaded, setLoaded] = useState(false);
  
  return (
    <LazyLoadImage
      wrapperClassName={cn(
        "block! mx-auto h-auto w-auto object-contain",
        !loaded && "aspect-5/7",
        config.reader.imageFit === "height"
          ? "max-h-screen! "
          : "max-w-full min-w-0"
      )}
      placeholderSrc={"/images/place-doro.webp"}
      className={cn(
        "h-auto mx-auto w-auto object-contain",
        config.reader.imageFit === "height"
          ? "max-h-screen! "
          : "max-w-full min-w-0"
      )}
      onLoad={() => {
        setLoaded(true);
        onLoaded();
      }}
      onError={(e) => {
        e.currentTarget.src = "/images/xidoco.webp";
      }}
      src={src}
      alt={alt}
      visibleByDefault={isPreloaded} 
    />
  );
}