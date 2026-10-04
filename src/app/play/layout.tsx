import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyProfile, isProfileComplete } from "@/lib/profile/server";

export default async function PlayLayout({ children }: LayoutProps<"/play">) {
  const { userId, profile } = await getMyProfile();
  if (!userId) redirect("/login");
  if (!isProfileComplete(profile)) redirect("/onboarding");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-border bg-surface border-b">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/play" className="min-h-11 content-center font-bold whitespace-nowrap">
            Past Paper Game
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/onboarding"
              className="hover:bg-border/40 flex min-h-11 items-center gap-1 rounded-xl px-2"
              aria-label={`Profile: ${profile.username}, ${profile.xp} XP`}
            >
              <span aria-hidden="true" className="text-xl">
                {profile.avatar}
              </span>
              <span className="hidden max-w-32 truncate font-medium sm:inline">
                {profile.username}
              </span>
              <span className="text-muted whitespace-nowrap">{profile.xp} XP</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
