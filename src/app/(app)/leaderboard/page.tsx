import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Leaderboard · Past Paper Game" };

const TABS = [
  { scope: "everyone", label: "Everyone" },
  { scope: "friends", label: "Friends" },
  { scope: "daily", label: "Today" },
] as const;

const HREF = {
  everyone: "/leaderboard",
  friends: "/leaderboard?scope=friends",
  daily: "/leaderboard?scope=daily",
} as const;

export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  const params = await searchParams;
  const scope = params.scope === "friends" || params.scope === "daily" ? params.scope : "everyone";
  const supabase = await createClient();

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">
          {scope === "daily" ? "Today's daily challenge" : "This week's leaderboard"}
        </h1>
        <p className="text-muted">
          {scope === "daily"
            ? "Points from today's five questions. A new challenge arrives at midnight."
            : "XP earned since Monday. It starts again every Monday morning."}
        </p>
      </div>

      <nav aria-label="Leaderboard" className="grid grid-cols-3 gap-2">
        {TABS.map((t) => (
          <Link
            key={t.scope}
            href={HREF[t.scope]}
            aria-current={scope === t.scope ? "page" : undefined}
            className="border-border aria-[current=page]:border-accent aria-[current=page]:bg-accent/15 aria-[current=page]:ring-accent flex min-h-11 items-center justify-center rounded-xl border font-medium aria-[current=page]:ring-2"
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {scope === "daily" ? (
        <DailyBoard supabase={supabase} />
      ) : (
        <WeeklyBoard supabase={supabase} scope={scope} />
      )}
    </>
  );
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function WeeklyBoard({
  supabase,
  scope,
}: {
  supabase: Supabase;
  scope: "everyone" | "friends";
}) {
  const { data: rows } = await supabase.rpc("weekly_leaderboard", { p_scope: scope, p_limit: 20 });
  return (
    <Card>
      {rows && rows.length > 0 ? (
        <table className="w-full text-left">
          <caption className="sr-only">
            {scope === "friends" ? "You and people you've played with" : "All players"}, ranked by
            XP this week
          </caption>
          <thead>
            <tr className="text-muted text-sm">
              <th scope="col" className="w-12 py-2 font-medium">
                Rank
              </th>
              <th scope="col" className="py-2 font-medium">
                Player
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                XP
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-border border-t ${r.is_me ? "bg-accent/10 font-semibold" : ""}`}
              >
                <td className="py-2 tabular-nums">{r.rank}</td>
                <td className="py-2">
                  <span aria-hidden="true" className="mr-2">
                    {r.avatar}
                  </span>
                  {r.username}
                  {r.is_me && <span className="text-muted text-sm font-normal"> (you)</span>}
                </td>
                <td className="py-2 pl-3 text-right whitespace-nowrap tabular-nums">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted">
          {scope === "friends"
            ? "Your friends are people you've played a live room or duel with. Start one and invite them!"
            : "Nobody has earned XP this week yet. Be the first!"}{" "}
          <Link
            href={scope === "friends" ? "/rooms/new" : "/play/solo"}
            className="text-accent font-medium underline"
          >
            {scope === "friends" ? "Create a room" : "Start practising"}
          </Link>
        </p>
      )}
    </Card>
  );
}

async function DailyBoard({ supabase }: { supabase: Supabase }) {
  const { data: rows } = await supabase.rpc("daily_leaderboard", {});
  return (
    <Card>
      <p className="text-muted mb-2 text-sm">You and your friends who have finished it.</p>
      {rows && rows.length > 0 ? (
        <table className="w-full text-left">
          <caption className="sr-only">
            Today&apos;s daily challenge scores for you and people you&apos;ve played with
          </caption>
          <thead>
            <tr className="text-muted text-sm">
              <th scope="col" className="w-12 py-2 font-medium">
                Rank
              </th>
              <th scope="col" className="py-2 font-medium">
                Player
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                Streak
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-border border-t ${r.is_me ? "bg-accent/10 font-semibold" : ""}`}
              >
                <td className="py-2 tabular-nums">{r.rank}</td>
                <td className="py-2">
                  <span aria-hidden="true" className="mr-2">
                    {r.avatar}
                  </span>
                  {r.username}
                  {r.is_me && <span className="text-muted text-sm font-normal"> (you)</span>}
                </td>
                <td className="py-2 pl-3 text-right whitespace-nowrap tabular-nums">
                  {r.streak > 0 ? `🔥 ${r.streak}` : "–"}
                </td>
                <td className="py-2 pl-3 text-right whitespace-nowrap tabular-nums">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted">
          Nobody you know has finished today&apos;s challenge yet.{" "}
          <Link href="/play/daily" className="text-accent font-medium underline">
            Play it now
          </Link>
        </p>
      )}
    </Card>
  );
}
