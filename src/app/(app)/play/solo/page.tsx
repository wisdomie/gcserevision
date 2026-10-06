import type { Metadata } from "next";
import Link from "next/link";
import { SubjectTabs } from "@/components/game/SubjectTabs";
import { ScienceSetup } from "@/components/profile/ScienceSetup";
import { COURSES } from "@/lib/profile/science";
import { subjectFromParam } from "@/lib/game/subjects";
import { topicGroups } from "@/lib/game/topic-groups";
import { getMyProfile, settingsFor } from "@/lib/profile/server";
import { SoloSetupForm } from "./SoloSetupForm";

export const metadata: Metadata = { title: "Solo practice · Past Paper Game" };

export default async function SoloSetupPage({ searchParams }: PageProps<"/play/solo">) {
  const { topics: requested, subject: subjectParam } = await searchParams;
  const subject = subjectFromParam(subjectParam);
  const { profile } = await getMyProfile();
  const settings = settingsFor(profile, subject);
  const groups = settings
    ? await topicGroups(
        { tier: settings.tier, board: settings.board?.slug },
        subject,
        settings.course,
      )
    : [];

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Solo practice</h1>
        <p className="text-muted">
          Choose topics, or leave them all unticked for a mix of everything.
        </p>
      </div>
      <SubjectTabs current={subject} path="/play/solo" />
      {subject !== "maths" && settings && (
        <p className="text-muted text-sm">
          {COURSES.find((c) => c.value === settings.course)?.label} · {settings.board?.name} ·{" "}
          {settings.tier === "higher" ? "Higher" : "Foundation"} ·{" "}
          <Link href="/profile#science" className="text-accent underline">
            Change
          </Link>
        </p>
      )}
      {!settings && subject !== "maths" ? (
        <ScienceSetup />
      ) : (
        <SoloSetupForm
          key={subject}
          subject={subject}
          groups={groups}
          initialTopics={String(requested ?? "")
            .split(",")
            .filter((slug) => groups.some((g) => g.topics.some((t) => t.slug === slug)))}
        />
      )}
    </>
  );
}
