import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { JoinRoomForm } from "@/components/game/JoinRoomForm";
import { getMyProfile } from "@/lib/profile/server";

export const metadata: Metadata = { title: "Play · Past Paper Game" };

const COMING_SOON = [
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Play with friends</h2>
          <p className="text-muted text-sm">
            A live room for up to 20, or a 1 v 1 duel. Share the code to invite people.
          </p>
          <ButtonLink href="/rooms/new">Create a room</ButtonLink>
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Join a room</h2>
          <p className="text-muted text-sm">Got a code from a friend? Jump in.</p>
          <JoinRoomForm signedIn />
        </Card>
      </div>

      <div className="grid gap-3">
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
    </>
  );
}
