import { errorResponse, readJson, requireUserId } from "@/lib/api/handler";
import { JoinRoomSchema } from "@/lib/game/room";
import { joinRoom } from "@/lib/game/room-server";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const { code } = await readJson(request, JoinRoomSchema);
    return Response.json(await joinRoom(userId, code));
  } catch (error) {
    return errorResponse(error);
  }
}
