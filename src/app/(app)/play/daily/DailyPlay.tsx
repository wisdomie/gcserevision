"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { dailyShareText, formatDailyDate } from "@/lib/game/daily";
import type { DailyOverview } from "@/lib/game/daily-types";
import { SoloGame } from "../solo/[sessionId]/SoloGame";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
  return body as T;
}

export function DailyPlay() {
  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(() => {
    api<DailyOverview>("/api/daily")
      .then((o) => {
        setOverview(o);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      await api<{ sessionId: string }>("/api/daily/start", { method: "POST" });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  if (error && !overview) return <Alert>{error}</Alert>;
  if (!overview) return <p role="status">Loading today&apos;s challenge…</p>;

  const { attempt } = overview;
  if (attempt && !attempt.finished) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">Daily challenge · {formatDailyDate(overview.date)}</h1>
        <SoloGame sessionId={attempt.sessionId} onFinished={load} backHref="/play" />
      </div>
    );
  }
  if (attempt) return <DailyResults overview={overview} />;

  return (
    <Card className="flex flex-col gap-3 text-center">
      <h1 className="text-2xl font-bold">Daily challenge</h1>
      <p className="text-muted">{formatDailyDate(overview.date)}</p>
      <p>
        {overview.questionCount} questions, the same for everyone today. You get one go, with a
        worked solution after each question.
      </p>
      {overview.streak > 0 && (
        <p className="font-medium">
          🔥 You&apos;re on a {overview.streak}-day streak. Play today to keep it going.
        </p>
      )}
      {error && <Alert>{error}</Alert>}
      <Button onClick={() => void start()} disabled={starting}>
        {starting ? "Getting your questions…" : "Start today's challenge"}
      </Button>
    </Card>
  );
}

function DailyResults({ overview }: { overview: DailyOverview }) {
  const attempt = overview.attempt!;
  const correct = attempt.results.filter(Boolean).length;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const share = dailyShareText({
    date: overview.date,
    results: attempt.results,
    score: attempt.score,
    streak: overview.streak,
  });

  useEffect(() => headingRef.current?.focus(), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(share);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="motion-safe:animate-pop-in flex flex-col gap-2 text-center">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold focus:outline-none">
          Today&apos;s results
        </h1>
        <p className="text-muted">{formatDailyDate(overview.date)}</p>
        <p className="text-4xl font-bold tabular-nums">
          {correct} / {attempt.results.length}
        </p>
        <p className="text-muted">
          {correct === attempt.results.length
            ? "A perfect day. Brilliant!"
            : "Nice one. A new challenge arrives at midnight."}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div className="border-border rounded-xl border p-2">
            <dt className="text-muted">Points (XP)</dt>
            <dd className="text-lg font-semibold">{attempt.score}</dd>
          </div>
          <div className="border-border rounded-xl border p-2">
            <dt className="text-muted">Daily streak</dt>
            <dd className="text-lg font-semibold">
              {overview.streak} {overview.streak === 1 ? "day" : "days"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Share your result</h2>
        <pre
          aria-label="Your result card"
          className="bg-background border-border rounded-xl border p-3 font-sans text-sm whitespace-pre-wrap"
        >
          {share}
        </pre>
        <p className="text-muted text-sm">It shows how you did, not the questions or answers.</p>
        <Button variant="secondary" onClick={() => void copy()}>
          Copy result
        </Button>
        <p role="status" className="text-sm">
          {copied === "copied"
            ? "Copied. Paste it to your friends!"
            : copied === "failed"
              ? "Couldn't copy. Select the text above instead."
              : ""}
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">You and your friends today</h2>
        {overview.board && overview.board.length > 1 ? (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Today&apos;s daily challenge scores</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="w-12 py-1 font-medium">
                  Rank
                </th>
                <th scope="col" className="py-1 font-medium">
                  Player
                </th>
                <th scope="col" className="py-1 pl-3 text-right font-medium">
                  Correct
                </th>
                <th scope="col" className="py-1 pl-3 text-right font-medium">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {overview.board.map((r) => (
                <tr
                  key={r.username}
                  className={`border-border border-t ${r.isMe ? "bg-accent/10 font-semibold" : ""}`}
                >
                  <td className="py-2 tabular-nums">{r.rank}</td>
                  <td className="py-2">
                    <span aria-hidden="true" className="mr-2">
                      {r.avatar}
                    </span>
                    {r.username}
                    {r.isMe && <span className="text-muted font-normal"> (you)</span>}
                    {r.streak >= 2 && (
                      <span className="text-muted ml-1 font-normal" title="Daily streak">
                        · 🔥 {r.streak}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pl-3 text-right whitespace-nowrap tabular-nums">
                    {r.correct}/{r.total}
                  </td>
                  <td className="py-2 pl-3 text-right whitespace-nowrap tabular-nums">
                    {r.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted text-sm">
            None of your friends have finished today&apos;s challenge yet. Share your result to
            challenge them! Friends are people you&apos;ve played a live room or duel with.
          </p>
        )}
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        <ButtonLink href="/play/solo">Practise more</ButtonLink>
        <ButtonLink href="/play" variant="secondary">
          Back to the hub
        </ButtonLink>
      </div>
    </div>
  );
}
