import "server-only";
import { listGenerators } from "@/lib/engine/generators/registry";
import type { BoardSlug, Tier } from "@/lib/engine/types";
import { createClient } from "@/lib/supabase/server";
import { STRANDS } from "./strands";

export interface TopicGroup {
  slug: string;
  name: string;
  topics: { slug: string; name: string }[];
}

/** Maths topics that have questions for this tier and board, grouped by strand. */
export async function topicGroups(filter: {
  tier?: Tier;
  /** null = mixed boards (questions valid for every board) */
  board?: BoardSlug | null;
}): Promise<TopicGroup[]> {
  const available = new Set(listGenerators(filter).map((g) => g.topicSlug));
  const supabase = await createClient();
  const { data: topics } = await supabase
    .from("topics")
    .select("slug, name, strand, sort_order, subjects!inner(slug)")
    .eq("subjects.slug", "maths")
    .order("sort_order");

  return STRANDS.map((s) => ({
    ...s,
    topics: (topics ?? [])
      .filter((t) => t.strand === s.slug && available.has(t.slug))
      .map((t) => ({ slug: t.slug, name: t.name })),
  })).filter((g) => g.topics.length > 0);
}
