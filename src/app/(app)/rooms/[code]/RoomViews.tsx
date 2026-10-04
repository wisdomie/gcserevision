"use client";

import { useEffect, useRef, useState } from "react";
import { AnswerInput } from "@/components/game/AnswerInput";
import { Timer } from "@/components/game/Timer";
import { MathInline, MathText } from "@/components/math/MathText";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PublicQuestion } from "@/lib/engine/types";
import type { RoomPlayer, RoomReveal, RoomState } from "@/lib/game/room-types";

function Avatar({ avatar }: { avatar: string | null }) {
  return (
    <span aria-hidden="true" className="text-xl">
      {avatar ?? "🙂"}
    </span>
  );
}

const pill = "border-border rounded-full border px-2 py-0.5";

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

export function Lobby({
  room,
  busy,
  onStart,
  onLeave,
}: {
  room: RoomState;
  busy: boolean;
  onStart: () => void;
  onLeave: () => void;
}) {
  const duel = room.mode === "duel";
  const enough = room.players.length >= 2;
  return (
    <>
      <Card className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-lg font-semibold">{duel ? "Duel" : "Live room"}</h1>
        <p className="text-muted text-sm">Share this code with your friends:</p>
        <p
          className="font-mono text-4xl font-bold tracking-[0.3em] sm:text-5xl"
          aria-label={`Room code ${room.code.split("").join(" ")}`}
          data-testid="room-code"
        >
          {room.code}
        </p>
        <p className="text-muted text-sm">
          {room.questionCount} questions · {room.secondsPerQuestion} seconds each
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">
          Players ({room.players.length}/{room.maxPlayers})
        </h2>
        <ul className="flex flex-col gap-1" aria-live="polite">
          {[...room.players]
            .sort((a, b) => Number(b.isHost) - Number(a.isHost))
            .map((p) => (
              <li key={p.userId} className="flex min-h-11 items-center gap-2">
                <Avatar avatar={p.avatar} />
                <span className="font-medium">{p.username}</span>
                {p.userId === room.me && <span className="text-muted text-sm">(you)</span>}
                {p.isHost && <span className={`${pill} text-muted ml-auto text-xs`}>Host</span>}
              </li>
            ))}
        </ul>
      </Card>

      {duel ? (
        <p role="status" className="text-muted text-center">
          Waiting for an opponent. The duel starts as soon as they join.
        </p>
      ) : room.isHost || !room.players.some((p) => p.isHost) ? (
        <Button onClick={onStart} disabled={busy || !enough}>
          {enough ? "Start the game" : "Waiting for players to join…"}
        </Button>
      ) : (
        <p role="status" className="text-muted text-center">
          Waiting for the host to start the game…
        </p>
      )}
      <Button variant="secondary" onClick={onLeave} disabled={busy}>
        Leave room
      </Button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export function QuestionView({
  room,
  question: q,
  offsetMs,
  busy,
  onAnswer,
}: {
  room: RoomState;
  question: PublicQuestion;
  offsetMs: number;
  busy: boolean;
  onAnswer: (instanceId: string, raw: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [timeUp, setTimeUp] = useState(false);
  const locked = room.answered;
  const answeredCount = room.players.filter((p) => p.answered).length;

  useEffect(() => {
    if (!room.questionEndsAt) return;
    const wait = room.questionEndsAt - (Date.now() + offsetMs);
    const id = setTimeout(() => setTimeUp(true), Math.max(0, wait));
    return () => clearTimeout(id);
  }, [room.questionEndsAt, offsetMs]);

  const submit = (raw = answer) => {
    if (!raw.trim() || locked || busy || timeUp) return;
    onAnswer(q.instanceId, raw);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium">
          Question {room.currentIndex + 1} of {room.questionCount}
        </p>
        {room.questionEndsAt && (
          <Timer
            seconds={room.secondsPerQuestion}
            endsAt={room.questionEndsAt}
            offsetMs={offsetMs}
          />
        )}
      </div>

      <Card className="flex flex-col gap-4" data-instance-id={q.instanceId}>
        <div className="text-muted flex flex-wrap gap-2 text-xs font-medium">
          <span className={pill}>{q.topicName}</span>
          <span className={pill}>
            {q.marks} mark{q.marks > 1 ? "s" : ""}
          </span>
        </div>
        <MathText text={q.promptMd} className="text-lg" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-3"
        >
          <AnswerInput
            inputType={q.inputType}
            options={q.options}
            value={answer}
            onChange={setAnswer}
            onEnter={(raw) => submit(raw)}
            disabled={locked || busy || timeUp}
          />
          {locked ? (
            <p role="status" className="font-medium">
              <span aria-hidden="true">🔒 </span>Answer locked in. Waiting for the others…
            </p>
          ) : timeUp ? (
            <p role="status" className="font-medium">
              Time&apos;s up!
            </p>
          ) : (
            <Button type="submit" disabled={!answer.trim() || busy}>
              {busy ? "Sending…" : "Lock in answer"}
            </Button>
          )}
        </form>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold">
          Locked in: {answeredCount} of {room.players.length}
        </h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {room.players.map((p) => (
            <li
              key={p.userId}
              className={`${pill} flex items-center gap-1 ${p.answered ? "border-accent" : "opacity-60"}`}
            >
              <Avatar avatar={p.avatar} />
              {p.username}
              <span className="sr-only">{p.answered ? "has answered" : "is still thinking"}</span>
              {p.answered && <span aria-hidden="true">🔒</span>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Reveal and scoreboard
// ---------------------------------------------------------------------------

function Scoreboard({ players, me }: { players: RoomPlayer[]; me: string }) {
  return (
    <table className="w-full text-left text-sm" aria-label="Scoreboard">
      <thead>
        <tr className="text-muted">
          <th scope="col" className="py-1 font-medium">
            #
          </th>
          <th scope="col" className="py-1 font-medium">
            Player
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            Score
          </th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr
            key={p.userId}
            className={`border-border border-t ${p.userId === me ? "font-semibold" : ""}`}
          >
            <td className="py-2 tabular-nums">{p.rank}</td>
            <td className="py-2">
              <Avatar avatar={p.avatar} /> {p.username}
              {p.userId === me && <span className="text-muted"> (you)</span>}
            </td>
            <td className="py-2 text-right tabular-nums">{p.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RevealView({ room, reveal }: { room: RoomState; reveal: RoomReveal | null }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mine = reveal?.results.find((r) => r.userId === room.me);
  useEffect(() => {
    headingRef.current?.focus();
  }, [reveal?.index]);

  const last = room.currentIndex + 1 >= room.questionCount;
  return (
    <>
      <p className="text-sm font-medium">
        Question {room.currentIndex + 1} of {room.questionCount}
      </p>
      {room.question && (
        <Card>
          <MathText text={room.question.promptMd} className="text-lg" />
        </Card>
      )}
      <Card
        className={`flex flex-col gap-3 border-2 ${mine?.correct ? "border-success" : "border-danger"}`}
      >
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold focus:outline-none">
          {!reveal ? (
            "Time's up!"
          ) : !mine?.answered ? (
            <>
              <span aria-hidden="true">⏱️ </span>No answer this time
            </>
          ) : mine.correct ? (
            <>
              <span aria-hidden="true">✅ </span>Correct! +{mine.points} points
            </>
          ) : mine.points > 0 ? (
            <>
              <span aria-hidden="true">🟡 </span>Partly right. +{mine.points} points
            </>
          ) : (
            <>
              <span aria-hidden="true">❌ </span>Not quite
            </>
          )}
        </h2>
        {reveal && (
          <>
            {reveal.myAnswer !== null && (
              <p className="text-sm">
                <span className="text-muted">You answered: </span>
                {reveal.myAnswer}
              </p>
            )}
            <p>
              <span className="font-semibold">Answer: </span>
              <MathInline text={reveal.solution.final} />
            </p>
            {reveal.solution.steps.length > 0 && (
              <details>
                <summary className="min-h-11 cursor-pointer content-center font-medium">
                  How to work it out
                </summary>
                <ol className="mt-2 list-decimal space-y-2 pl-5">
                  {reveal.solution.steps.map((step, i) => (
                    <li key={i}>
                      <MathInline text={step} />
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </>
        )}
      </Card>

      {reveal && (
        <Card>
          <h2 className="mb-2 font-semibold">This question</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {reveal.results.map((r) => (
              <li key={r.userId} className="flex min-h-8 items-center gap-2">
                <Avatar avatar={r.avatar} />
                <span>{r.username}</span>
                <span className="ml-auto">
                  {!r.answered
                    ? "No answer"
                    : r.correct
                      ? "✅ Right"
                      : r.points
                        ? "🟡 Partly"
                        : "❌ Wrong"}
                </span>
                <span className="w-16 text-right tabular-nums">+{r.points}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-semibold">Scoreboard</h2>
        <Scoreboard players={room.players} me={room.me} />
        <p role="status" className="text-muted mt-3 text-sm">
          {last ? "Final results coming up…" : "Next question coming up…"}
        </p>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Finished: podium
// ---------------------------------------------------------------------------

const MEDALS = ["🥇", "🥈", "🥉"];

export function Finished({ room }: { room: RoomState }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  const top = room.players.filter((p) => p.rank <= 3);
  const winners = room.players.filter((p) => p.rank === 1);
  const iWon = winners.some((p) => p.userId === room.me);
  // A tie on points was settled on time when the top two have different ranks
  const [first, second] = room.players;
  const tieBroken = first && second && first.score === second.score && first.rank !== second.rank;

  return (
    <>
      <Card className="flex flex-col items-center gap-3 text-center">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold break-words focus:outline-none"
        >
          {winners.length > 1
            ? "It's a draw!"
            : iWon
              ? "You win! 🎉"
              : `${winners[0]?.username ?? "Nobody"} wins!`}
        </h1>
        {tieBroken && (
          <p className="text-muted text-sm">
            Level on points, so the quicker total time on correct answers wins.
          </p>
        )}
        <ol className="flex w-full items-end justify-center gap-2" aria-label="Podium">
          {top.map((p) => (
            <li
              key={p.userId}
              className="border-border bg-background flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border p-3"
            >
              <span aria-hidden="true" className="text-3xl">
                {MEDALS[p.rank - 1]}
              </span>
              <span className="sr-only">Position {p.rank}:</span>
              <Avatar avatar={p.avatar} />
              <span className="max-w-full truncate font-semibold">{p.username}</span>
              <span className="tabular-nums">{p.score}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Final scores</h2>
        <Scoreboard players={room.players} me={room.me} />
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        <ButtonLink href="/rooms/new">Play again</ButtonLink>
        <ButtonLink href="/play" variant="secondary">
          Back to the hub
        </ButtonLink>
      </div>
    </>
  );
}
