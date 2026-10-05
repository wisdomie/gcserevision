import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { Card } from "@/components/ui/Card";
import { percent, topicReport, type RankedTopic } from "@/lib/game/stats";
import { getMyProfile } from "@/lib/profile/server";
import { getAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { DeleteAccount } from "./DeleteAccount";
import { SaveProgress } from "./SaveProgress";

export const metadata: Metadata = { title: "Your profile · Past Paper Game" };

function TopicList({ topics, tone }: { topics: RankedTopic[]; tone: "strong" | "weak" }) {
  return (
    <ul className="flex flex-col gap-2">
      {topics.map((t) => (
        <li
          key={t.slug}
          className="border-border flex items-center justify-between gap-3 rounded-xl border p-3"
        >
          <div className="min-w-0">
            <p className="font-medium">{t.name}</p>
            <p className="text-muted text-sm">
              {percent(t.accuracy)} correct · {t.correct} of {t.attempts}
            </p>
          </div>
          {tone === "weak" && (
            <Link
              href={
                t.subject && t.subject !== "maths"
                  ? `/play/solo?subject=${t.subject}&topics=${t.slug}`
                  : `/play/solo?topics=${t.slug}`
              }
              className="text-accent min-h-11 shrink-0 content-center rounded-xl px-3 text-sm font-semibold underline"
            >
              Practise
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function ProfilePage() {
  const [{ profile }, auth] = await Promise.all([getMyProfile(), getAuth()]);
  const supabase = await createClient();
  const [{ data: boards }, { data: stats }] = await Promise.all([
    supabase.from("exam_boards").select("slug, name").order("name"),
    supabase.from("topic_stats").select("attempts, correct, topics(slug, name, subjects(slug))"),
  ]);
  const report = topicReport(
    (stats ?? []).flatMap((s) =>
      s.topics
        ? [
            {
              slug: s.topics.slug,
              name: s.topics.name,
              subject: s.topics.subjects?.slug,
              attempts: s.attempts,
              correct: s.correct,
            },
          ]
        : [],
    ),
  );
  const judged = report.strongest.length + report.weakest.length > 0;

  return (
    <>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-5xl">
          {profile?.avatar}
        </span>
        <div>
          <h1 className="text-2xl font-bold">{profile?.username}</h1>
          <p className="text-muted">
            {profile?.xp} XP · {profile?.board?.name} ·{" "}
            {profile?.tier === "higher" ? "Higher" : "Foundation"}
          </p>
        </div>
      </div>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Your topics</h2>
        {judged ? (
          <>
            <div className="flex flex-col gap-2">
              <h3 className="font-medium">
                <span aria-hidden="true">💪 </span>Strongest
              </h3>
              <TopicList topics={report.strongest} tone="strong" />
            </div>
            {report.weakest.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="font-medium">
                  <span aria-hidden="true">🎯 </span>Worth practising
                </h3>
                <TopicList topics={report.weakest} tone="weak" />
              </div>
            )}
          </>
        ) : (
          <p className="text-muted">
            Answer at least 3 questions on a topic and we&apos;ll show your strongest topics and the
            ones worth practising.{" "}
            <Link href="/play/solo" className="text-accent font-medium underline">
              Start practising
            </Link>
          </p>
        )}
        {report.needMorePractice.length > 0 && (
          <p className="text-muted text-sm">
            Not enough answers yet to judge: {report.needMorePractice.map((t) => t.name).join(", ")}
            .
          </p>
        )}
      </Card>

      {auth?.isAnonymous && <SaveProgress />}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Settings</h2>
        <ProfileForm
          boards={(boards ?? []).map((b) => ({ slug: b.slug, name: b.name }))}
          initial={
            profile
              ? {
                  username: profile.username,
                  avatar: profile.avatar,
                  board: profile.board?.slug ?? null,
                  tier: profile.tier,
                }
              : null
          }
          submitLabel="Save changes"
          afterSave="stay"
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Your data</h2>
        <p className="text-muted text-sm">
          Read how we use your data in our{" "}
          <Link href="/privacy" className="text-accent font-medium underline">
            privacy notice
          </Link>
          .
        </p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="min-h-11 text-sm font-medium underline">
            Sign out
          </button>
        </form>
        <DeleteAccount />
      </Card>
    </>
  );
}
