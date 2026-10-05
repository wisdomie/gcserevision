"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TopicPicker, toggleTopics } from "@/components/game/TopicPicker";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { BoardSlug, Tier } from "@/lib/engine/types";
import type { RoomMode } from "@/lib/game/room";
import type { SubjectSlug } from "@/lib/game/subjects";
import type { TopicGroup } from "@/lib/game/topic-groups";

const COUNTS = [5, 10, 15, 20] as const;
const SECONDS = [20, 30, 45, 60] as const;

const choice =
  "border-border has-[:checked]:border-accent has-[:checked]:bg-accent/15 has-[:checked]:ring-accent has-[:focus-visible]:outline-accent flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-center has-[:checked]:ring-2 has-[:focus-visible]:outline-3";

function Choices<T extends string | number>({
  legend,
  name,
  options,
  value,
  onChange,
  label = String,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label?: (value: T) => string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-semibold">{legend}</legend>
      <div className={`grid gap-2 ${options.length > 2 ? "grid-cols-4" : "grid-cols-2"}`}>
        {options.map((o) => (
          <label key={o} className={choice}>
            <input
              type="radio"
              name={name}
              value={o}
              checked={value === o}
              onChange={() => onChange(o)}
              className="sr-only"
            />
            {label(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function RoomSetupForm({
  subject,
  course,
  tier: myTier,
  board,
  boardGroups,
  mixedGroups,
}: {
  subject: SubjectSlug;
  course: "combined" | "separate";
  tier: Tier;
  board: { slug: BoardSlug; name: string } | null;
  boardGroups: TopicGroup[];
  mixedGroups: TopicGroup[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<RoomMode>("room");
  const [boardChoice, setBoardChoice] = useState<"mine" | "mixed">(board ? "mine" : "mixed");
  const [tier, setTier] = useState<Tier>(myTier);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [count, setCount] = useState<number>(10);
  const [seconds, setSeconds] = useState<number>(30);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Topic lists are for the host's tier; the server checks the final choice
  const groups = boardChoice === "mine" ? boardGroups : mixedGroups;
  const available = new Set(groups.flatMap((g) => g.topics.map((t) => t.slug)));
  const topicSlugs = [...selected].filter((s) => available.has(s));

  async function create() {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        subject,
        course,
        board: boardChoice === "mine" ? board?.slug : null,
        tier,
        topicSlugs,
        questionCount: count,
        secondsPerQuestion: seconds,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Something went wrong. Please try again.");
      setCreating(false);
      return;
    }
    router.push(`/rooms/${body.code}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
      className="flex flex-col gap-4"
    >
      {error && <Alert>{error}</Alert>}

      <Card className="flex flex-col gap-4">
        <Choices
          legend="Game type"
          name="mode"
          options={["room", "duel"] as const}
          value={mode}
          onChange={setMode}
          label={(m) => (m === "room" ? "Room (up to 20)" : "Duel (1 v 1)")}
        />
        {board && (
          <Choices
            legend="Exam board"
            name="board"
            options={["mine", "mixed"] as const}
            value={boardChoice}
            onChange={setBoardChoice}
            label={(b) => (b === "mine" ? board.name : "Mixed boards")}
          />
        )}
        <Choices
          legend="Tier"
          name="tier"
          options={["foundation", "higher"] as const}
          value={tier}
          onChange={setTier}
          label={(t) => (t === "higher" ? "Higher" : "Foundation")}
        />
        <Choices
          legend="Number of questions"
          name="count"
          options={COUNTS}
          value={count as (typeof COUNTS)[number]}
          onChange={setCount}
        />
        <Choices
          legend="Seconds per question"
          name="seconds"
          options={SECONDS}
          value={seconds as (typeof SECONDS)[number]}
          onChange={setSeconds}
          label={(s) => `${s}s`}
        />
      </Card>

      <p className="text-muted">
        Choose topics, or leave them all unticked for a mix of everything.
      </p>
      <TopicPicker
        groups={groups}
        selected={selected}
        onToggle={(slugs, on) => setSelected((prev) => toggleTopics(prev, slugs, on))}
      />

      <Button type="submit" disabled={creating}>
        {creating ? "Creating…" : mode === "duel" ? "Create duel" : "Create room"}
      </Button>
    </form>
  );
}
