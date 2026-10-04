import "server-only";
import type { BoardSlug, Tier } from "@/lib/engine/types";
import { getUserId } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export interface MyProfile {
  username: string;
  avatar: string | null;
  tier: Tier | null;
  board: { slug: BoardSlug; name: string } | null;
  xp: number;
}

/** The signed-in player's own profile (read through RLS), or null if they haven't made one. */
export async function getMyProfile(): Promise<{
  userId: string | null;
  profile: MyProfile | null;
}> {
  const userId = await getUserId();
  if (!userId) return { userId: null, profile: null };
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username, avatar, tier, xp, exam_boards(slug, name)")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return { userId, profile: null };
  return {
    userId,
    profile: {
      username: data.username,
      avatar: data.avatar,
      tier: (data.tier as Tier | null) ?? null,
      board: data.exam_boards
        ? { slug: data.exam_boards.slug as BoardSlug, name: data.exam_boards.name }
        : null,
      xp: data.xp,
    },
  };
}

export const isProfileComplete = (p: MyProfile | null): p is MyProfile & { tier: Tier } =>
  !!p && !!p.tier && !!p.board;
