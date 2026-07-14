import * as React from "react";
import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex w-full", className)}
      {...props}
    >
      <div className="flex-1 overflow-auto scrollbar-thin">{children}</div>
    </div>
  )
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };