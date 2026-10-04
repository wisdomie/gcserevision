import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { normaliseRoomCode } from "@/lib/game/room";
import { RoomGame } from "./RoomGame";

export const metadata: Metadata = { title: "Live room · Past Paper Game" };

export default async function RoomPage({ params }: PageProps<"/rooms/[code]">) {
  const { code: raw } = await params;
  const code = normaliseRoomCode(raw);
  if (!code) notFound();
  return <RoomGame code={code} />;
}
