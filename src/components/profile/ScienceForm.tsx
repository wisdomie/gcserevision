"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { COURSES } from "@/lib/profile/science";

interface Props {
  boards: { slug: string; name: string }[];
  initial: { board: string; tier: string; course: string } | null;
  submitLabel: string;
}

const field = "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base";
const choice =
  "border-border bg-surface has-[:checked]:border-accent has-[:checked]:ring-accent flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 has-[:checked]:ring-2";

/** Science exam board, tier and course, shared by all the sciences. */
export function ScienceForm({ boards, initial, submitLabel }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(form: FormData) {
    setSaving(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/profile/science", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        board: form.get("science-board"),
        tier: form.get("science-tier"),
        course: form.get("science-course"),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form action={save} className="flex flex-col gap-6">
      {error && <Alert>{error}</Alert>}
      {saved && (
        <p
          role="status"
          className="border-success/40 bg-success/10 rounded-xl border px-4 py-3 text-sm"
        >
          <span aria-hidden="true">✅ </span>Saved
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Science course</legend>
        {COURSES.map((c) => (
          <label key={c.value} className={choice}>
            <input
              type="radio"
              name="science-course"
              value={c.value}
              required
              defaultChecked={initial?.course === c.value}
            />
            <span>
              {c.label} <span className="text-muted block text-sm">{c.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="science-board" className="font-medium">
          Science exam board
        </label>
        <select
          id="science-board"
          name="science-board"
          required
          defaultValue={initial?.board ?? ""}
          className={field}
        >
          <option value="" disabled>
            Choose your exam board
          </option>
          {boards.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
        <p className="text-muted text-sm">This can be different from your maths board.</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Science tier</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "foundation", label: "Foundation" },
            { value: "higher", label: "Higher" },
          ].map((t) => (
            <label key={t.value} className={choice}>
              <input
                type="radio"
                name="science-tier"
                value={t.value}
                required
                defaultChecked={initial?.tier === t.value}
              />
              {t.label}
            </label>
          ))}
        </div>
        <p className="text-muted text-sm">
          Your science tier can be different from your maths tier. Not sure? Ask your teacher.
        </p>
      </fieldset>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
