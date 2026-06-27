import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 shadow-xs transition-colors outline-none placeholder:text-slate-500",
        "focus-visible:border-[#f97316]/55 focus-visible:ring-[3px] focus-visible:ring-[#f97316]/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
