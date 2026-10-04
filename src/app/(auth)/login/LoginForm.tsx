"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState<"quick" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function quickPlay() {
    setBusy("quick");
    setError(null);
    const { error } = await createClient().auth.signInAnonymously();
    if (error) {
      setError("We couldn't start a quick-play session. Please try again.");
      setBusy(null);
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  async function emailLink(form: FormData) {
    const email = String(form.get("email") ?? "").trim();
    setBusy("email");
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/play` },
    });
    setBusy(null);
    if (error) setError("We couldn't send the link. Check the email address and try again.");
    else setSentTo(email);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert>{error}</Alert>}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Quick play</h2>
        <p className="text-muted text-sm">
          Just pick a username. You can add an email later to keep your streaks and stats.
        </p>
        <Button onClick={quickPlay} disabled={busy !== null}>
          {busy === "quick" ? "Starting…" : "Play now"}
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Sign in with email</h2>
        {sentTo ? (
          <p className="text-sm" role="status">
            Check your inbox: we sent a sign-in link to <strong>{sentTo}</strong>.
          </p>
        ) : (
          <form action={emailLink} className="flex flex-col gap-3">
            <label htmlFor="email" className="text-sm font-medium">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="border-border bg-background min-h-11 rounded-xl border px-3 text-base"
            />
            <Button type="submit" variant="secondary" disabled={busy !== null}>
              {busy === "email" ? "Sending…" : "Email me a sign-in link"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
