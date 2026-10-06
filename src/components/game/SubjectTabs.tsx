import Link from "next/link";
import { SUBJECTS, type SubjectSlug } from "@/lib/game/subjects";

/** Switches a setup page between subjects (PLAN.md M9), keeping it a plain link. */
export function SubjectTabs({ current, path }: { current: SubjectSlug; path: string }) {
  return (
    <nav aria-label="Subject" className="border-border flex gap-1 rounded-xl border p-1">
      {SUBJECTS.map((s) => (
        <Link
          key={s.slug}
          href={s.slug === "maths" ? path : `${path}?subject=${s.slug}`}
          aria-current={s.slug === current ? "page" : undefined}
          className="aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground flex min-h-11 flex-1 items-center justify-center rounded-lg font-semibold"
        >
          {s.name}
        </Link>
      ))}
    </nav>
  );
}
