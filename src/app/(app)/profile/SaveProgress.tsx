"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

/** Lets a quick-play (anonymous) player add an email so they can sign in again later. */
export function SaveProgress() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function addEmail(form: FormData) {
    const email = String(form.get("email") ?? "").trim();
    setState("sending");
    setError(null);
    const { error } = await createClient().auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=/profile` },
    );
    if (error) {
      setError("We couldn't add that email. It may already be used by another account.");
      setState("idle");
    } else {
      setState("sent");
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Keep your progress</h2>
      {state === "sent" ? (
        <p role="status">Check your inbox and click the link to confirm your email.</p>
      ) : (
        <>
          <p className="text-muted text-sm">
            You&apos;re playing as a guest. Add an email so you can sign in on another device and
            keep your XP and stats. We only use it to sign you in.
          </p>
          {error && <Alert>{error}</Alert>}
          <form action={addEmail} className="flex flex-col gap-2">
            <label htmlFor="save-email" className="text-sm font-medium">
              Email address
            </label>
            <input
              id="save-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="border-border bg-background min-h-11 rounded-xl border px-3 text-base"
            />
            <Button type="submit" variant="secondary" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Add email"}
            </Button>
          </form>
        </>
      )}
    </Card>
  );
}
