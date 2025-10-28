import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export default function NormalTag(props: ComponentProps<"div">) {
	return (
		<div
			{...props}
			className={cn(
				"flex items-center gap-1 px-[0.375rem] py-0 bg-accent font-bold rounded-[0.25rem] text-[0.625rem] w-fit",
				props.className,
			)}
		>
			{props.children}
		</div>
	);
}
