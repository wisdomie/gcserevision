import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Leaderboard · Past Paper Game" };

const TABS = [
  { scope: "everyone", label: "Everyone" },
  { scope: "friends", label: "Friends" },
] as const;

export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  const params = await searchParams;
  const scope = params.scope === "friends" ? "friends" : "everyone";
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("weekly_leaderboard", { p_scope: scope, p_limit: 20 });

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">This week&apos;s leaderboard</h1>
        <p className="text-muted">XP earned since Monday. It starts again every Monday morning.</p>
      </div>

      <nav aria-label="Leaderboard" className="grid grid-cols-2 gap-2">
        {TABS.map((t) => (
          <Link
            key={t.scope}
            href={t.scope === "everyone" ? "/leaderboard" : "/leaderboard?scope=friends"}
            aria-current={scope === t.scope ? "page" : undefined}
            className="border-border aria-[current=page]:border-accent aria-[current=page]:bg-accent/15 aria-[current=page]:ring-accent flex min-h-11 items-center justify-center rounded-xl border font-medium aria-[current=page]:ring-2"
          >
            {t.label}
          </Link>
        ))}
      </nav>

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
                <th scope="col" className="py-2 text-right font-medium">
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
                  <td className="py-2 text-right tabular-nums">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">
            {scope === "friends"
              ? "Your friends are people you've played live rooms with. Live rooms are coming soon!"
              : "Nobody has earned XP this week yet. Be the first!"}{" "}
            <Link href="/play/solo" className="text-accent font-medium underline">
              Start practising
            </Link>
          </p>
        )}
      </Card>
    </>
  );
}
