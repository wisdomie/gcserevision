import { Card } from "@/components/ui/Card";
import { listBoards } from "@/lib/profile/server";
import { ScienceForm } from "./ScienceForm";

/** Asks for science settings before a player's first science game. */
export async function ScienceSetup() {
  const boards = await listBoards();
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Set up your science</h2>
        <p className="text-muted text-sm">
          So your questions match your course. You only need to do this once, and you can change it
          on your profile.
        </p>
      </div>
      <ScienceForm boards={boards} initial={null} submitLabel="Save and choose topics" />
    </Card>
  );
}
