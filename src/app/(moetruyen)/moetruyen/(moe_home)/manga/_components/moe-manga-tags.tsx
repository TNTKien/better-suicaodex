import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export function MoeNormalTag(props: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "flex w-fit items-center gap-1 rounded-sm bg-accent px-1.5 py-0 text-[0.625rem] font-bold",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

type StatusKey = "ongoing" | "completed" | "hiatus" | "cancelled" | "unknown";

const statusStyles: Record<
  StatusKey,
  { text: string; outline: string; bg: string }
> = {
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
  unknown: {
    text: "text-gray-500 dark:text-gray-400",
    outline: "outline-gray-500 dark:outline-gray-400",
    bg: "bg-gray-500 dark:bg-gray-400",
  },
};

export function MoeStatusTag({ status }: { status: string }) {
  const style = statusStyles[status as StatusKey] ?? statusStyles.unknown;

  return (
    <MoeNormalTag
      className={cn(
        "-outline-offset-2 bg-transparent uppercase outline-2 outline-solid",
        style.text,
        style.outline,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", style.bg)} />
      {status}
    </MoeNormalTag>
  );
}
