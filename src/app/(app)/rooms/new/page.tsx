import type { Metadata } from "next";
import { topicGroups } from "@/lib/game/topic-groups";
import { getMyProfile } from "@/lib/profile/server";
import { RoomSetupForm } from "./RoomSetupForm";

export const metadata: Metadata = { title: "Create a room · Past Paper Game" };

export default async function NewRoomPage() {
  const { profile } = await getMyProfile();
  const tier = profile?.tier ?? "foundation";
  const [boardGroups, mixedGroups] = await Promise.all([
    topicGroups({ tier, board: profile?.board?.slug }),
    topicGroups({ tier, board: null }),
  ]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Create a room</h1>
        <p className="text-muted">
          Everyone gets the same question at the same time. Faster correct answers score more.
        </p>
      </div>
      <RoomSetupForm
        tier={tier}
        board={profile?.board ?? null}
        boardGroups={boardGroups}
        mixedGroups={mixedGroups}
      />
    </>
  );
}
