"use client";

import type React from "react";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Hover3DCardProps {
  imageSrc: string;
  alt?: string;
  className?: string;
}

export function Hover3DCard({
  imageSrc,
  alt = "3D Card",
  className,
}: Hover3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({});

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -15;
    const rotateY = ((x - centerX) / centerX) * 15;

    setTransform(
      `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`
    );

    // Glare effect
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    setGlareStyle({
      background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 40%, transparent 70%)`,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    setTransform(
      "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)"
    );
    setGlareStyle({ opacity: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-xl shadow-xl transition-all duration-200 ease-out",
        className
      )}
      style={{
        transform,
        transformStyle: "preserve-3d",
      }}
    >
      <img
        src={imageSrc || "/images/place-doro.webp"}
        alt={alt}
        className="block h-full w-full object-cover"
        draggable={false}
      />
      {/* Glare overlay */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={glareStyle}
      />
      {/* Holographic shimmer effect */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 mix-blend-overlay"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,0,150,0.1) 0%, rgba(0,255,255,0.1) 50%, rgba(255,255,0,0.1) 100%)",
          opacity: transform ? 0.5 : 0,
        }}
      />
    </div>
  );
}
