"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { normaliseRoomCode, ROOM_CODE_LENGTH } from "@/lib/game/room";

/**
 * A room-code box. Signed in, it joins straight away; signed out (`signedIn`
 * false) it opens the room page, which sends the player to sign in first.
 */
export function JoinRoomForm({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function join() {
    const code = normaliseRoomCode(value);
    if (!code) {
      setError(`Room codes are ${ROOM_CODE_LENGTH} letters and numbers.`);
      return;
    }
    setError(null);
    if (!signedIn) {
      router.push(`/rooms/${code}`);
      return;
    }
    setJoining(true);
    const res = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Something went wrong. Please try again.");
      setJoining(false);
      return;
    }
    router.push(`/rooms/${body.code}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void join();
      }}
      className="flex w-full flex-col gap-2"
    >
      <label htmlFor="room-code" className="text-sm font-medium">
        Room code
      </label>
      <div className="flex gap-2">
        <input
          id="room-code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={12}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="e.g. K7M2PQ"
          className="border-border bg-background min-h-11 w-full min-w-0 rounded-xl border px-3 font-mono text-lg tracking-widest uppercase"
        />
        <Button type="submit" variant="secondary" disabled={joining || !value.trim()}>
          {joining ? "Joining…" : "Join"}
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}
    </form>
  );
}
