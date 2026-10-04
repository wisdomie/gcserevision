import type { Metadata } from "next";
import { SoloGame } from "./SoloGame";

export const metadata: Metadata = { title: "Solo practice · Past Paper Game" };

export default async function SoloSessionPage({ params }: PageProps<"/play/solo/[sessionId]">) {
  const { sessionId } = await params;
  return <SoloGame sessionId={sessionId} />;
}
