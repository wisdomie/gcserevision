"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { AVATARS } from "@/lib/profile/avatars";
import { USERNAME_RULES } from "@/lib/profile/username";

interface Props {
  boards: { slug: string; name: string }[];
  initial: {
    username: string;
    avatar: string | null;
    board: string | null;
    tier: string | null;
  } | null;
  submitLabel: string;
  /** A path to go to after saving (onboarding), or "stay" to confirm in place (profile page). */
  afterSave: string;
}

const field = "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base";

export function ProfileForm({ boards, initial, submitLabel, afterSave }: Props) {
  const router = useRouter();
  const [avatar, setAvatar] = useState(initial?.avatar ?? AVATARS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(form: FormData) {
    setSaving(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.get("username"),
        avatar,
        board: form.get("board"),
        tier: form.get("tier"),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      setSaving(false);
      return;
    }
    if (afterSave !== "stay") {
      router.push(afterSave);
    } else {
      setSaving(false);
      setSaved(true);
    }
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

      <div className="flex flex-col gap-2">
        <label htmlFor="username" className="font-medium">
          Username
        </label>
        <input
          id="username"
          name="username"
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]{3,20}"
          defaultValue={initial?.username ?? ""}
          autoComplete="off"
          aria-describedby="username-help"
          className={field}
        />
        <p id="username-help" className="text-muted text-sm">
          {USERNAME_RULES}. Don&apos;t use your real name.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Avatar</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {AVATARS.map((a) => (
            <label
              key={a}
              className={`has-[:focus-visible]:outline-accent flex aspect-square min-h-11 cursor-pointer items-center justify-center rounded-xl border text-2xl has-[:focus-visible]:outline-3 ${
                avatar === a
                  ? "border-accent bg-accent/15 ring-accent ring-2"
                  : "border-border bg-surface"
              }`}
            >
              <input
                type="radio"
                name="avatar"
                value={a}
                checked={avatar === a}
                onChange={() => setAvatar(a)}
                className="sr-only"
              />
              <span aria-hidden="true">{a}</span>
              <span className="sr-only">Avatar {a}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="board" className="font-medium">
          Exam board
        </label>
        <select
          id="board"
          name="board"
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
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Tier</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "foundation", label: "Foundation" },
            { value: "higher", label: "Higher" },
          ].map((t) => (
            <label
              key={t.value}
              className="border-border bg-surface has-[:checked]:border-accent has-[:checked]:ring-accent flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 has-[:checked]:ring-2"
            >
              <input
                type="radio"
                name="tier"
                value={t.value}
                required
                defaultChecked={initial?.tier === t.value}
              />
              {t.label}
            </label>
          ))}
        </div>
        <p className="text-muted text-sm">
          Not sure? Ask your teacher which tier you&apos;re entered for.
        </p>
      </fieldset>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
