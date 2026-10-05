import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { JoinRoomForm } from "@/components/game/JoinRoomForm";
import { dailyDate } from "@/lib/game/daily";
import { getMyProfile } from "@/lib/profile/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Play · Past Paper Game" };

export default async function PlayHub() {
  const { profile } = await getMyProfile();
  const supabase = await createClient();
  const [{ data: streak }, { data: today }] = await Promise.all([
    supabase.rpc("my_daily_streak"),
    supabase
      .from("solo_sessions")
      .select("finished_at")
      .eq("settings->>mode", "daily")
      .eq("settings->>date", dailyDate())
      .maybeSingle(),
  ]);
  const doneToday = Boolean(today?.finished_at);
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

      <Card className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">Daily challenge</h2>
          {(streak ?? 0) > 0 && (
            <p
              className="text-sm font-medium"
              aria-label={`Daily streak: ${streak} day${streak === 1 ? "" : "s"}`}
            >
              🔥 {streak}
            </p>
          )}
        </div>
        <p className="text-muted text-sm">
          {doneToday
            ? "Done for today. A new one arrives at midnight."
            : "Five questions, the same for everyone today. Compare with your friends."}
        </p>
        <ButtonLink href="/play/daily" variant={doneToday ? "secondary" : "primary"}>
          {doneToday ? "See today's results" : today ? "Carry on" : "Play today's challenge"}
        </ButtonLink>
      </Card>
    </>
  );
}
