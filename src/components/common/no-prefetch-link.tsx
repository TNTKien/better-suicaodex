import Link from "next/link";
import { ComponentProps } from "react";

export default function NoPrefetchLink(props: ComponentProps<typeof Link>) {
  return (
    <Link {...props} prefetch={props.prefetch ?? false}>
      {props.children}
    </Link>
  );
}
