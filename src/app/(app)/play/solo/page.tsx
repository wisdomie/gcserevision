import type { Metadata } from "next";
import { SubjectTabs } from "@/components/game/SubjectTabs";
import { subjectFromParam } from "@/lib/game/subjects";
import { topicGroups } from "@/lib/game/topic-groups";
import { getMyProfile } from "@/lib/profile/server";
import { SoloSetupForm } from "./SoloSetupForm";

export const metadata: Metadata = { title: "Solo practice · Past Paper Game" };

export default async function SoloSetupPage({ searchParams }: PageProps<"/play/solo">) {
  const { topics: requested, subject: subjectParam } = await searchParams;
  const subject = subjectFromParam(subjectParam);
  const { profile } = await getMyProfile();
  const groups = await topicGroups(
    { tier: profile?.tier ?? undefined, board: profile?.board?.slug },
    subject,
  );

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Solo practice</h1>
        <p className="text-muted">
          Choose topics, or leave them all unticked for a mix of everything.
        </p>
      </div>
      <SubjectTabs current={subject} path="/play/solo" />
      <SoloSetupForm
        key={subject}
        subject={subject}
        groups={groups}
        initialTopics={String(requested ?? "")
          .split(",")
          .filter((slug) => groups.some((g) => g.topics.some((t) => t.slug === slug)))}
      />
    </>
  );
}
