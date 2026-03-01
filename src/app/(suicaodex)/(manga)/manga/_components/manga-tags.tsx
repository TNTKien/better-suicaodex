import { cn } from "@/lib/utils";
import { ComponentProps } from "react";

const ratingColor = {
  suggestive: "bg-yellow-500 dark:bg-yellow-400",
  erotica: "bg-red-500 dark:bg-red-400",
  pornographic: "bg-red-800 dark:bg-red-700",
} as const;

type RatingKey = keyof typeof ratingColor;

export function NormalTag(props: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "flex items-center gap-1 px-1.5 py-0 bg-accent font-bold rounded-sm text-[0.625rem] w-fit",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export function ContentRatingTag({
  rating,
  isLink = true,
}: {
  rating: RatingKey | string;
  isLink?: boolean;
}) {
  if (rating === "safe") return null;

  const colorClass =
    ratingColor[rating as RatingKey] ?? "bg-gray-500 dark:bg-gray-400";

  return (
    <NormalTag className={cn("uppercase text-white", colorClass)}>
      {isLink ? (
        <a
          href={`/advanced-search?content=${rating}`}
          className="hover:underline"
        >
          {rating}
        </a>
      ) : (
        rating
      )}
    </NormalTag>
  );
}

interface StatusTagProps {
  status: string;
  isLink?: boolean;
}

type StatusKey = "ongoing" | "completed" | "hiatus" | "cancelled";

const statusStyles: Record<StatusKey, { text: string; outline: string; bg: string }> = {
  ongoing: {
    text: "text-blue-500 dark:text-blue-400",
    outline: "outline-blue-500 dark:outline-blue-400",
    bg: "bg-blue-500 dark:bg-blue-400",
  },
  completed: {
    text: "text-green-500 dark:text-green-400",
    outline: "outline-green-500 dark:outline-green-400",
    bg: "bg-green-500 dark:bg-green-400",
  },
  hiatus: {
    text: "text-gray-500 dark:text-gray-400",
    outline: "outline-gray-500 dark:outline-gray-400",
    bg: "bg-gray-500 dark:bg-gray-400",
  },
  cancelled: {
    text: "text-red-500 dark:text-red-400",
    outline: "outline-red-500 dark:outline-red-400",
    bg: "bg-red-500 dark:bg-red-400",
  },
};

const defaultStatusStyle: (typeof statusStyles)[StatusKey] = {
  text: "text-gray-500 dark:text-gray-400",
  outline: "outline-gray-500 dark:outline-gray-400",
  bg: "bg-gray-500 dark:bg-gray-400",
};

export function StatusTag({ status, isLink = false }: StatusTagProps) {
  const { text, outline, bg } =
    statusStyles[status as StatusKey] ?? defaultStatusStyle;

  return (
    <NormalTag
      className={cn(
        "uppercase bg-transparent outline-solid outline-2 -outline-offset-2",
        text,
        outline,
      )}
    >
      <span className={cn("rounded-full w-2 h-2", bg)} />
      {isLink ? (
        <a
          href={`/advanced-search?status=${status}`}
          // className="hover:underline"
        >
          {status}
        </a>
      ) : (
        status
      )}
    </NormalTag>
  );
}
