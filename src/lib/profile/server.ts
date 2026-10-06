import "server-only";
import type { BoardSlug, Tier } from "@/lib/engine/types";
import { getUserId } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type ScienceCourse = "combined" | "separate";

/** Science settings, shared by all sciences; null until the player sets them. */
export interface ScienceSettings {
  tier: Tier;
  board: { slug: BoardSlug; name: string };
  course: ScienceCourse;
}

export interface MyProfile {
  username: string;
  avatar: string | null;
  /** Maths tier and board */
  tier: Tier | null;
  board: { slug: BoardSlug; name: string } | null;
  science: ScienceSettings | null;
  xp: number;
}

type BoardRow = { slug: string; name: string } | null;
const toBoard = (b: BoardRow) => (b ? { slug: b.slug as BoardSlug, name: b.name } : null);

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
    .select(
      "username, avatar, tier, xp, science_tier, science_course, " +
        "board:exam_boards!profiles_exam_board_id_fkey(slug, name), " +
        "science_board:exam_boards!profiles_science_board_id_fkey(slug, name)",
    )
    .eq("id", userId)
    .maybeSingle();
  if (!data) return { userId, profile: null };
  const row = data as unknown as {
    username: string;
    avatar: string | null;
    tier: string | null;
    xp: number;
    science_tier: string | null;
    science_course: string | null;
    board: BoardRow;
    science_board: BoardRow;
  };
  const scienceBoard = toBoard(row.science_board);
  return {
    userId,
    profile: {
      username: row.username,
      avatar: row.avatar,
      tier: (row.tier as Tier | null) ?? null,
      board: toBoard(row.board),
      science:
        row.science_tier && row.science_course && scienceBoard
          ? {
              tier: row.science_tier as Tier,
              board: scienceBoard,
              course: row.science_course as ScienceCourse,
            }
          : null,
      xp: row.xp,
    },
  };
}

export const isProfileComplete = (p: MyProfile | null): p is MyProfile & { tier: Tier } =>
  !!p && !!p.tier && !!p.board;

/**
 * The tier, board and course a player uses for a subject: maths has its own;
 * the sciences share the science settings. Null if they haven't been set.
 */
export function settingsFor(
  profile: MyProfile | null,
  subject: string,
): { tier: Tier; board: { slug: BoardSlug; name: string } | null; course: ScienceCourse } | null {
  if (!profile) return null;
  if (subject === "maths")
    return profile.tier ? { tier: profile.tier, board: profile.board, course: "combined" } : null;
  return profile.science;
}

/** Exam boards for settings forms, in name order. */
export async function listBoards(): Promise<{ slug: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("exam_boards").select("slug, name").order("name");
  return data ?? [];
}
