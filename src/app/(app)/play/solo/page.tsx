import type { Metadata } from "next";
import { listGenerators } from "@/lib/engine/generators/registry";
import { STRANDS } from "@/lib/game/strands";
import { getMyProfile } from "@/lib/profile/server";
import { createClient } from "@/lib/supabase/server";
import { SoloSetupForm } from "./SoloSetupForm";

export const metadata: Metadata = { title: "Solo practice · Past Paper Game" };

export default async function SoloSetupPage() {
  const { profile } = await getMyProfile();
  const available = new Set(
    listGenerators({ tier: profile?.tier ?? undefined, board: profile?.board?.slug }).map(
      (g) => g.topicSlug,
    ),
  );

  const supabase = await createClient();
  const { data: topics } = await supabase
    .from("topics")
    .select("slug, name, strand, sort_order, subjects!inner(slug)")
    .eq("subjects.slug", "maths")
    .order("sort_order");

  const groups = STRANDS.map((s) => ({
    ...s,
    topics: (topics ?? [])
      .filter((t) => t.strand === s.slug && available.has(t.slug))
      .map((t) => ({ slug: t.slug, name: t.name })),
  })).filter((g) => g.topics.length > 0);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Solo practice</h1>
        <p className="text-muted">
          Choose topics, or leave them all unticked for a mix of everything.
        </p>
      </div>
      <SoloSetupForm groups={groups} />
    </>
  );
}
