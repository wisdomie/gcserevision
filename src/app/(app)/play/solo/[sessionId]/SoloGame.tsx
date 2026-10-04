"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnswerInput } from "@/components/game/AnswerInput";
import { Timer } from "@/components/game/Timer";
import { MathInline, MathText } from "@/components/math/MathText";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type {
  SoloAnswerResult,
  SoloCurrentQuestion,
  SoloState,
  SoloSummary,
} from "@/lib/game/solo-types";

type View =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "question"; current: SoloCurrentQuestion }
  | { kind: "feedback"; current: SoloCurrentQuestion; answer: string; result: SoloAnswerResult }
  | { kind: "finished"; summary: SoloSummary };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
  return body as T;
}

export function SoloGame({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<SoloState | null>(null);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    api<SoloState>(`/api/solo/${sessionId}`)
      .then((s) => {
        setState(s);
        if (s.summary) setView({ kind: "finished", summary: s.summary });
        else if (s.current) setView({ kind: "question", current: s.current });
        else setView({ kind: "error", message: "This session has no questions." });
      })
      .catch((e: Error) => setView({ kind: "error", message: e.message }));
  }, [sessionId]);

  useEffect(() => {
    if (view.kind === "feedback" || view.kind === "finished") headingRef.current?.focus();
  }, [view.kind]);

  // XP in the header comes from the server: refresh it once the session ends
  const router = useRouter();
  useEffect(() => {
    if (view.kind === "finished") router.refresh();
  }, [view.kind, router]);

  async function submit(raw = answer) {
    if (view.kind !== "question" || !raw.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api<SoloAnswerResult>("/api/solo/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          instanceId: view.current.question.instanceId,
          raw,
        }),
      });
      setState((s) => (s ? { ...s, score: result.score, answered: s.answered + 1 } : s));
      setAnswer(raw);
      setView({ kind: "feedback", current: view.current, answer: raw, result });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const next = () => {
    if (view.kind !== "feedback") return;
    setAnswer("");
    setError(null);
    if (view.result.next) setView({ kind: "question", current: view.result.next });
    else if (view.result.summary) setView({ kind: "finished", summary: view.result.summary });
  };

  if (view.kind === "loading") return <p role="status">Loading your questions…</p>;
  if (view.kind === "error") {
    return (
      <div className="flex flex-col gap-4">
        <Alert>{view.message}</Alert>
        <ButtonLink href="/play/solo" variant="secondary">
          Back to solo practice
        </ButtonLink>
      </div>
    );
  }
  if (view.kind === "finished") return <Results summary={view.summary} headingRef={headingRef} />;

  const { current } = view;
  const q = current.question;
  const total = state?.count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium">
          Question {current.index + 1} of {total}
        </p>
        <p aria-live="polite">
          Score: <strong>{state?.score ?? 0}</strong>
        </p>
        {state?.timed && view.kind === "question" && (
          <Timer key={q.instanceId} seconds={state.secondsPerQuestion} />
        )}
      </div>

      <Card className="flex flex-col gap-4" data-instance-id={q.instanceId}>
        <div className="text-muted flex flex-wrap gap-2 text-xs font-medium">
          <span className="border-border rounded-full border px-2 py-0.5">{q.topicName}</span>
          <span className="border-border rounded-full border px-2 py-0.5">
            {q.marks} mark{q.marks > 1 ? "s" : ""}
          </span>
          <span className="border-border rounded-full border px-2 py-0.5">
            {q.calculator === "non-calc"
              ? "Non-calculator"
              : q.calculator === "calc"
                ? "Calculator"
                : "Calculator allowed"}
          </span>
        </div>

        <MathText text={q.promptMd} className="text-lg" />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-3"
        >
          <AnswerInput
            inputType={q.inputType}
            options={q.options}
            value={view.kind === "feedback" ? view.answer : answer}
            onChange={setAnswer}
            onEnter={(raw) => void submit(raw)}
            disabled={view.kind === "feedback" || submitting}
          />
          {error && <Alert>{error}</Alert>}
          {view.kind === "question" && (
            <Button type="submit" disabled={!answer.trim() || submitting}>
              {submitting ? "Checking…" : "Check answer"}
            </Button>
          )}
        </form>
      </Card>

      {view.kind === "feedback" && (
        <Feedback result={view.result} headingRef={headingRef} onNext={next} />
      )}
    </div>
  );
}

function Feedback({
  result,
  headingRef,
  onNext,
}: {
  result: SoloAnswerResult;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onNext: () => void;
}) {
  return (
    <Card
      className={`flex flex-col gap-3 border-2 ${result.correct ? "border-success" : "border-danger"}`}
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="flex items-center gap-2 text-xl font-bold focus:outline-none"
      >
        <span aria-hidden="true">{result.correct ? "✅" : "❌"}</span>
        {result.correct ? "Correct!" : result.marksAwarded > 0 ? "Partly right" : "Not quite"}
      </h2>
      {result.feedback && <p className="font-medium">{result.feedback}</p>}
      <p className="text-sm">
        {result.points > 0 ? `+${result.points} points` : "No points this time"}
        {result.streak >= 3 && ` · ${result.streak} in a row 🔥`}
      </p>

      <div>
        <h3 className="font-semibold">Worked solution</h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          {result.solution.steps.map((step, i) => (
            <li key={i}>
              <MathInline text={step} />
            </li>
          ))}
        </ol>
        <p className="mt-3">
          <span className="font-semibold">Answer: </span>
          <MathInline text={result.solution.final} />
        </p>
      </div>

      <Button onClick={onNext} autoFocus>
        {result.next ? "Next question" : "See results"}
      </Button>
    </Card>
  );
}

function Results({
  summary,
  headingRef,
}: {
  summary: SoloSummary;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const message =
    summary.correct === summary.total
      ? "A perfect round. Brilliant work!"
      : summary.correct >= summary.total / 2
        ? "Nice work. Keep it up!"
        : "Every question you try helps. Have a look at the topics below.";
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2 text-center">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold focus:outline-none">
          Your results
        </h1>
        <p className="text-4xl font-bold tabular-nums">
          {summary.correct} / {summary.total}
        </p>
        <p className="text-muted">{message}</p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div className="border-border rounded-xl border p-2">
            <dt className="text-muted">Points (XP)</dt>
            <dd className="text-lg font-semibold">{summary.score}</dd>
          </div>
          <div className="border-border rounded-xl border p-2">
            <dt className="text-muted">Best streak</dt>
            <dd className="text-lg font-semibold">{summary.bestStreak}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">By topic</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-muted">
              <th scope="col" className="py-1 font-medium">
                Topic
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Correct
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.topics.map((t) => (
              <tr key={t.topicName} className="border-border border-t">
                <td className="py-2">{t.topicName}</td>
                <td className="py-2 text-right tabular-nums">
                  {t.correct} / {t.attempted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        <ButtonLink href="/play/solo">Play again</ButtonLink>
        <ButtonLink href="/play" variant="secondary">
          Back to the hub
        </ButtonLink>
      </div>
    </div>
  );
}
