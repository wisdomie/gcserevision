import type { Metadata } from "next";
import { topicGroups } from "@/lib/game/topic-groups";
import { getMyProfile } from "@/lib/profile/server";
import { SoloSetupForm } from "./SoloSetupForm";

export const metadata: Metadata = { title: "Solo practice · Past Paper Game" };

export default async function SoloSetupPage({ searchParams }: PageProps<"/play/solo">) {
  const { topics: requested } = await searchParams;
  const { profile } = await getMyProfile();
  const groups = await topicGroups({
    tier: profile?.tier ?? undefined,
    board: profile?.board?.slug,
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Solo practice</h1>
        <p className="text-muted">
          Choose topics, or leave them all unticked for a mix of everything.
        </p>
      </div>
      <SoloSetupForm
        groups={groups}
        initialTopics={String(requested ?? "")
          .split(",")
          .filter((slug) => groups.some((g) => g.topics.some((t) => t.slug === slug)))}
      />
    </>
  );
}
