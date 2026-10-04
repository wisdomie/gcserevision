"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { clockOffset, type ClockSample } from "@/lib/game/clock";
import type { RoomReveal, RoomState } from "@/lib/game/room-types";
import { createClient } from "@/lib/supabase/client";
import { Finished, Lobby, QuestionView, RevealView } from "./RoomViews";

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, body.error ?? "Something went wrong.");
  return body as T;
}

const post = <T,>(url: string, body?: object) =>
  api<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

/** A fallback refresh in case a realtime update is missed. */
const POLL_MS = 3000;
/** Wait a little past the deadline: the server accepts answers for 500 ms after it. */
const CLOSE_DELAY_MS = 800;

async function measureOffset(): Promise<number> {
  const samples: ClockSample[] = [];
  for (let i = 0; i < 3; i++) {
    const sentAt = Date.now();
    const { now } = await api<{ now: number }>("/api/time");
    samples.push({ sentAt, serverNow: now, receivedAt: Date.now() });
  }
  return clockOffset(samples);
}

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "not-member" }
  | { kind: "ready"; room: RoomState };

export function RoomGame({ code }: { code: string }) {
  const router = useRouter();
  const base = `/api/rooms/${code}`;
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [offset, setOffset] = useState(0);
  const [reveal, setReveal] = useState<RoomReveal | null>(null);
  // An error belongs to the step it happened in and clears when the game moves on
  const [error, setError] = useState<{ message: string; step: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fetching = useRef(false);
  const again = useRef(false);

  // One request at a time; a refresh asked for meanwhile runs straight after
  const refresh = useCallback(async () => {
    if (fetching.current) {
      again.current = true;
      return;
    }
    fetching.current = true;
    try {
      do {
        again.current = false;
        try {
          const room = await api<RoomState>(base);
          setLoad({ kind: "ready", room });
        } catch (e) {
          const err = e as HttpError;
          if (err.status === 403) setLoad({ kind: "not-member" });
          else if (err.status === 404) setLoad({ kind: "error", message: err.message });
          // Other failures: keep the last state and try again on the next tick
        }
      } while (again.current);
    } finally {
      fetching.current = false;
    }
  }, [base]);

  const room = load.kind === "ready" ? load.room : null;
  const roomId = room?.roomId;
  const status = room?.status;
  const index = room?.currentIndex ?? -1;

  useEffect(() => {
    void refresh();
    measureOffset().then(setOffset, () => {});
  }, [refresh]);

  // Live updates: any change to the room or its players triggers a refresh
  useEffect(() => {
    if (!roomId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, refresh]);

  useEffect(() => {
    if (status === "finished" || load.kind !== "ready") return;
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [status, load.kind, refresh]);

  // Any player moves the game on when it is due, so nobody's tab is essential
  const endsAt = room?.questionEndsAt;
  const revealAt = room?.revealStartedAt;
  const revealMs = room?.revealMs ?? 0;
  useEffect(() => {
    let due: number | null = null;
    let action: "advance" | "next" | null = null;
    if (status === "question" && endsAt) {
      due = endsAt + CLOSE_DELAY_MS;
      action = "advance";
    } else if (status === "reveal" && revealAt) {
      due = revealAt + revealMs + 100;
      action = "next";
    }
    if (due === null || action === null) return;
    // Spread players out a little so they don't all call at the same instant
    const wait = Math.max(0, due - (Date.now() + offset)) + Math.random() * 300;
    const id = setTimeout(() => {
      post(`${base}/${action}`, { fromIndex: index })
        .catch(() => {})
        .finally(() => void refresh());
    }, wait);
    return () => clearTimeout(id);
  }, [status, index, endsAt, revealAt, revealMs, offset, base, refresh]);

  // Load the answers once a question closes
  useEffect(() => {
    if ((status !== "reveal" && status !== "finished") || index < 0) return;
    if (reveal?.index === index) return;
    api<RoomReveal>(`${base}/reveal?idx=${index}`).then(setReveal, () => {});
  }, [status, index, reveal?.index, base]);

  const step = `${load.kind}:${status}:${index}`;
  const shownError = error?.step === step ? error.message : null;

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError({ message: (e as Error).message, step });
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  const join = () => act(() => post(`/api/rooms/join`, { code }));
  const start = () => act(() => post(`${base}/start`));
  const answer = (instanceId: string, raw: string) =>
    act(() => post(`${base}/answer`, { instanceId, raw }));
  async function leave() {
    setBusy(true);
    await post(`${base}/leave`).catch(() => {});
    router.push("/play");
  }

  if (load.kind === "loading") return <p role="status">Finding the room…</p>;
  if (load.kind === "error") {
    return (
      <div className="flex flex-col gap-4">
        <Alert>{load.message}</Alert>
        <ButtonLink href="/play" variant="secondary">
          Back to the hub
        </ButtonLink>
      </div>
    );
  }
  if (load.kind === "not-member") {
    return (
      <Card className="flex flex-col gap-3 text-center">
        <h1 className="text-2xl font-bold">Join room {code}</h1>
        {shownError && <Alert>{shownError}</Alert>}
        <Button onClick={join} disabled={busy}>
          {busy ? "Joining…" : "Join this room"}
        </Button>
        <ButtonLink href="/play" variant="secondary">
          Back to the hub
        </ButtonLink>
      </Card>
    );
  }

  const r = load.room;
  return (
    <div className="flex flex-col gap-4">
      {shownError && <Alert>{shownError}</Alert>}
      {r.status === "lobby" && <Lobby room={r} busy={busy} onStart={start} onLeave={leave} />}
      {r.status === "question" && r.question && (
        <QuestionView
          key={r.question.instanceId}
          room={r}
          question={r.question}
          offsetMs={offset}
          busy={busy}
          onAnswer={answer}
        />
      )}
      {r.status === "reveal" && (
        <RevealView room={r} reveal={reveal?.index === r.currentIndex ? reveal : null} />
      )}
      {r.status === "finished" && <Finished room={r} />}
      {r.status !== "lobby" && r.status !== "finished" && (
        <Button variant="ghost" onClick={leave} disabled={busy} className="self-center text-sm">
          Leave the game
        </Button>
      )}
    </div>
  );
}
