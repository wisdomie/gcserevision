import type { Metadata } from "next";
import { DailyPlay } from "./DailyPlay";

export const metadata: Metadata = { title: "Daily challenge · Past Paper Game" };

export default function DailyPage() {
  return <DailyPlay />;
}
