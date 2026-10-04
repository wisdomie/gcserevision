import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"section">) {
  return (
    <section
      className={`border-border bg-surface rounded-2xl border p-4 sm:p-6 ${className}`}
      {...props}
    />
  );
}
