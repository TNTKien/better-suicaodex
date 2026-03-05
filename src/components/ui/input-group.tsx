import * as React from "react";

import { cn } from "@/lib/utils";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn("relative", className)}
      {...props}
    />
  );
}

function InputGroupAddon({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn("absolute inset-y-0 right-1 flex items-center", className)}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon };
