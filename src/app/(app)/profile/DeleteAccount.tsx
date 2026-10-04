"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

const CONFIRM_WORD = "DELETE";

export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: typed }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      setDeleting(false);
      return;
    }
    router.replace("/?deleted=1");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-danger min-h-11 self-start text-sm font-medium underline"
      >
        Delete my account and data
      </button>
    );
  }

  return (
    <div className="border-danger/50 flex flex-col gap-3 rounded-xl border-2 p-4">
      <h3 className="font-semibold">Delete your account?</h3>
      <p className="text-sm">
        This permanently deletes your profile, XP, answers and topic stats. It can&apos;t be undone.
      </p>
      {error && <Alert>{error}</Alert>}
      <label htmlFor="confirm-delete" className="text-sm font-medium">
        Type {CONFIRM_WORD} to confirm
      </label>
      <input
        id="confirm-delete"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        className="border-border bg-background min-h-11 rounded-xl border px-3 text-base"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          onClick={remove}
          disabled={typed !== CONFIRM_WORD || deleting}
          className="bg-danger text-white"
        >
          {deleting ? "Deleting…" : "Delete everything"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen(false)}
          disabled={deleting}
        >
          Keep my account
        </Button>
      </div>
    </div>
  );
}
