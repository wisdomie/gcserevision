import type { ReactNode } from "react";

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="border-danger/40 bg-danger/10 text-foreground rounded-xl border px-4 py-3 text-sm"
    >
      {children}
    </p>
  );
}
