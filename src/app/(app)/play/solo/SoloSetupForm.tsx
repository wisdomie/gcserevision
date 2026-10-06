"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TopicPicker, toggleTopics } from "@/components/game/TopicPicker";
import { SOLO_COUNTS } from "@/lib/game/solo";
import type { SubjectSlug } from "@/lib/game/subjects";
import type { TopicGroup } from "@/lib/game/topic-groups";

export function SoloSetupForm({
  subject,
  groups,
  initialTopics,
}: {
  subject: SubjectSlug;
  groups: TopicGroup[];
  initialTopics: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialTopics));
  const [count, setCount] = useState<number>(10);
  const [timed, setTimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const toggle = (slugs: string[], on: boolean) =>
    setSelected((prev) => toggleTopics(prev, slugs, on));

  async function start() {
    setStarting(true);
    setError(null);
    const res = await fetch("/api/solo/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, topicSlugs: [...selected], count, timed }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Something went wrong. Please try again.");
      setStarting(false);
      return;
    }
    router.push(`/play/solo/${body.sessionId}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void start();
      }}
      className="flex flex-col gap-4"
    >
      {error && <Alert>{error}</Alert>}

      <TopicPicker groups={groups} selected={selected} onToggle={toggle} />

      <Card className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 font-semibold">Number of questions</legend>
          <div className="grid grid-cols-3 gap-2">
            {SOLO_COUNTS.map((n) => (
              <label
                key={n}
                className="border-border has-[:checked]:border-accent has-[:checked]:bg-accent/15 has-[:checked]:ring-accent has-[:focus-visible]:outline-accent flex min-h-11 cursor-pointer items-center justify-center rounded-xl border has-[:checked]:ring-2 has-[:focus-visible]:outline-3"
              >
                <input
                  type="radio"
                  name="count"
                  value={n}
                  checked={count === n}
                  onChange={() => setCount(n)}
                  className="sr-only"
                />
                {n}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="size-5"
            checked={timed}
            onChange={(e) => setTimed(e.target.checked)}
          />
          <span>
            Timed <span className="text-muted text-sm">(faster answers score more)</span>
          </span>
        </label>
      </Card>

      <Button type="submit" disabled={starting}>
        {starting
          ? "Starting…"
          : selected.size
            ? `Start (${selected.size} topic${selected.size > 1 ? "s" : ""})`
            : "Start (all topics)"}
      </Button>
    </form>
  );
}
