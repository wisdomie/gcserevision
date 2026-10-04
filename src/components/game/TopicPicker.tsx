"use client";

import { Card } from "@/components/ui/Card";

interface Group {
  slug: string;
  name: string;
  topics: { slug: string; name: string }[];
}

/** Topic checkboxes grouped by strand, with an "all" box per strand. */
export function TopicPicker({
  groups,
  selected,
  onToggle,
}: {
  groups: Group[];
  selected: ReadonlySet<string>;
  onToggle: (slugs: string[], on: boolean) => void;
}) {
  return groups.map((group) => {
    const slugs = group.topics.map((t) => t.slug);
    const all = slugs.every((s) => selected.has(s));
    return (
      <Card key={group.slug}>
        <fieldset className="flex flex-col gap-1">
          <legend className="flex w-full items-center justify-between gap-2">
            <span className="text-lg font-semibold">{group.name}</span>
          </legend>
          <label className="flex min-h-11 items-center gap-3 font-medium">
            <input
              type="checkbox"
              className="size-5"
              checked={all}
              onChange={(e) => onToggle(slugs, e.target.checked)}
            />
            All {group.name.split(",")[0].toLowerCase()} topics
          </label>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {group.topics.map((t) => (
              <label key={t.slug} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={selected.has(t.slug)}
                  onChange={(e) => onToggle([t.slug], e.target.checked)}
                />
                {t.name}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>
    );
  });
}

/** Set-state helper for TopicPicker's onToggle. */
export function toggleTopics(prev: ReadonlySet<string>, slugs: string[], on: boolean) {
  const next = new Set(prev);
  for (const s of slugs) {
    if (on) next.add(s);
    else next.delete(s);
  }
  return next;
}
