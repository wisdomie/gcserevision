import type { Metadata } from "next";
import { SubjectTabs } from "@/components/game/SubjectTabs";
import { ScienceSetup } from "@/components/profile/ScienceSetup";
import { subjectFromParam } from "@/lib/game/subjects";
import { topicGroups } from "@/lib/game/topic-groups";
import { getMyProfile, settingsFor } from "@/lib/profile/server";
import { RoomSetupForm } from "./RoomSetupForm";

export const metadata: Metadata = { title: "Create a room · Past Paper Game" };

export default async function NewRoomPage({ searchParams }: PageProps<"/rooms/new">) {
  const subject = subjectFromParam((await searchParams).subject);
  const { profile } = await getMyProfile();
  const settings = settingsFor(profile, subject);
  const tier = settings?.tier ?? "foundation";
  const course = settings?.course ?? "combined";
  const [boardGroups, mixedGroups] = await Promise.all([
    topicGroups({ tier, board: settings?.board?.slug }, subject, course),
    topicGroups({ tier, board: null }, subject, course),
  ]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Create a room</h1>
        <p className="text-muted">
          Everyone gets the same question at the same time. Faster correct answers score more.
        </p>
      </div>
      <SubjectTabs current={subject} path="/rooms/new" />
      {!settings && subject !== "maths" ? (
        <ScienceSetup />
      ) : (
        <RoomSetupForm
          key={subject}
          subject={subject}
          course={course}
          tier={tier}
          board={settings?.board ?? null}
          boardGroups={boardGroups}
          mixedGroups={mixedGroups}
        />
      )}
    </>
  );
}
