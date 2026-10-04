import { errorResponse, readJson, requireUserId } from "@/lib/api/handler";
import { RoomSettingsSchema } from "@/lib/game/room";
import { createRoom } from "@/lib/game/room-server";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const settings = await readJson(request, RoomSettingsSchema);
    return Response.json(await createRoom(userId, settings), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
