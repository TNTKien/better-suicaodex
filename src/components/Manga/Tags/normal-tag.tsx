import { cn } from "@/lib/utils";
import { ComponentProps } from "react";

export default function NormalTag(props: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "flex items-center gap-1 px-1.5 py-0 bg-accent font-bold rounded text-[0.625rem] w-fit",
        props.className
      )}
    >
      {props.children}
    </div>
  );
}
