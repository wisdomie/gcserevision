import "server-only";
import { listGenerators } from "@/lib/engine/generators/registry";
import type { BoardSlug, Tier } from "@/lib/engine/types";
import { createClient } from "@/lib/supabase/server";
import { STRANDS_BY_SUBJECT } from "./strands";
import type { SubjectSlug } from "./subjects";

export interface TopicGroup {
  slug: string;
  name: string;
  topics: { slug: string; name: string }[];
}

/**
 * A subject's topics that have questions for this tier and board, grouped by
 * strand: generated questions (maths) or published hand-written ones.
 */
export async function topicGroups(
  filter: {
    tier?: Tier;
    /** null = mixed boards (questions valid for every board) */
    board?: BoardSlug | null;
  },
  subject: SubjectSlug = "maths",
  /** Science only: Combined Science leaves out separate-only topics. */
  course: "combined" | "separate" = "combined",
): Promise<TopicGroup[]> {
  const supabase = await createClient();
  const [{ data: topics }, { data: banked }] = await Promise.all([
    supabase
      .from("topics")
      .select("slug, name, strand, sort_order, separate_only, subjects!inner(slug)")
      .eq("subjects.slug", subject)
      .order("sort_order"),
    supabase.rpc("topics_with_questions", {
      p_subject: subject,
      ...(filter.tier ? { p_tier: filter.tier } : {}),
      // undefined (any board) and null (mixed) both mean questions valid for every board
      ...(filter.board ? { p_board: filter.board } : {}),
      p_course: course,
    }),
  ]);
  const onCourse = (topics ?? []).filter((t) => !t.separate_only || course === "separate");
  const subjectTopics = new Set(onCourse.map((t) => t.slug));
  const available = new Set([
    ...listGenerators(filter)
      .map((g) => g.topicSlug)
      .filter((slug) => subjectTopics.has(slug)),
    ...(banked ?? []),
  ]);

  return STRANDS_BY_SUBJECT[subject]
    .map((s) => ({
      ...s,
      topics: onCourse
        .filter((t) => t.strand === s.slug && available.has(t.slug))
        .map((t) => ({ slug: t.slug, name: t.name })),
    }))
    .filter((g) => g.topics.length > 0);
}
