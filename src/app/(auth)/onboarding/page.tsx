import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/profile/server";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const metadata: Metadata = { title: "Set up your profile · Past Paper Game" };

export default async function OnboardingPage() {
  const { userId, profile } = await getMyProfile();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: boards } = await supabase.from("exam_boards").select("slug, name").order("name");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Set up your profile</h1>
        <p className="text-muted mt-1">
          Pick your exam board and tier so your questions match your course. You can change these
          later.
        </p>
      </div>
      <ProfileForm
        submitLabel="Save and start"
        afterSave="play"
        boards={(boards ?? []).map((b) => ({ slug: b.slug, name: b.name }))}
        initial={
          profile
            ? {
                username: profile.username,
                avatar: profile.avatar,
                board: profile.board?.slug ?? null,
                tier: profile.tier,
              }
            : null
        }
      />
    </main>
  );
}
