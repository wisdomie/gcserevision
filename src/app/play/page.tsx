import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { getMyProfile } from "@/lib/profile/server";

export const metadata: Metadata = { title: "Play · Past Paper Game" };

const COMING_SOON = [
  { title: "Create a room", text: "Play live with up to 20 friends." },
  { title: "Join a room", text: "Got a code from a friend? Jump in." },
  { title: "Daily challenge", text: "Five questions a day, same for everyone." },
];

export default async function PlayHub() {
  const { profile } = await getMyProfile();
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Hi {profile?.username} 👋</h1>
        <p className="text-muted">
          {profile?.board?.name} · {profile?.tier === "higher" ? "Higher" : "Foundation"} tier
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Solo practice</h2>
        <p className="text-muted text-sm">
          Pick your topics and get a worked solution after every question.
        </p>
        <ButtonLink href="/play/solo">Start practising</ButtonLink>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {COMING_SOON.map((m) => (
          <Card key={m.title} className="flex flex-col gap-1 opacity-70">
            <h2 className="font-semibold">{m.title}</h2>
            <p className="text-muted text-sm">{m.text}</p>
            <p className="text-muted mt-1 text-xs font-medium tracking-wide uppercase">
              Coming soon
            </p>
          </Card>
        ))}
      </div>

      <form action="/auth/signout" method="post">
        <button type="submit" className="text-muted min-h-11 text-sm underline">
          Sign out
        </button>
      </form>
    </>
  );
}
