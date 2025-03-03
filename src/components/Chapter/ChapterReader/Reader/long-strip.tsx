"use client";

import { useConfig } from "@/hooks/use-config";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";

interface LongStripProps {
  images: string[];
}

export default function LongStrip({ images }: LongStripProps) {
  const [loaded, setLoaded] = useState(false);
  const [config] = useConfig();
  return (
    <div className="min-w-0 relative min-h-lvh mt-2">
      <div
        className={cn(
          "overflow-x-auto flex flex-col items-center h-full select-none bg-transparent"
        )}
        style={{
          gap: `${config.reader.imageGap}px`,
        }}
      >
        {images.map((image, index) => (
          <span
            key={index + 1}
            className={`block overflow-hidden ${
              loaded ? "min-h-0" : "min-h-[100vh]"
            }`}
          >
            <LazyLoadImage
              wrapperClassName="block!"
              placeholderSrc={"/images/place-doro.webp"}
              className={cn(
                "h-auto w-auto mx-auto",
                config.reader.imageFit === "height" && "max-h-screen!"
              )}
              onLoad={() => setLoaded(true)}
              onError={(e) => {
                e.currentTarget.src = "/images/xidoco.webp";
              }}
              src={image}
              alt={`Trang ${index + 1}`}
              visibleByDefault={true}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
