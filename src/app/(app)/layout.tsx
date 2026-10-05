import Link from "next/link";
import { redirect } from "next/navigation";
import { SoundToggle } from "@/components/SoundToggle";
import { getMyProfile, isProfileComplete } from "@/lib/profile/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, profile } = await getMyProfile();
  if (!userId) redirect("/login");
  if (!isProfileComplete(profile)) redirect("/onboarding");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-border bg-surface border-b">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-2">
          <Link
            href="/play"
            aria-label="Past Paper Game: home"
            className="min-h-11 min-w-0 content-center truncate font-bold"
          >
            {/* A shorter name on narrow phones leaves room for the buttons */}
            <span className="sm:hidden">Paper Game</span>
            <span className="hidden sm:inline">Past Paper Game</span>
          </Link>
          <nav aria-label="Main" className="flex shrink-0 items-center gap-1 text-sm">
            <SoundToggle />
            <Link
              href="/leaderboard"
              className="hover:bg-border/40 flex min-h-11 items-center rounded-xl px-2 font-medium"
            >
              <span aria-hidden="true" className="sm:mr-1">
                🏆
              </span>
              <span className="sr-only sm:not-sr-only">Leaderboard</span>
            </Link>
            <Link
              href="/profile"
              className="hover:bg-border/40 flex min-h-11 items-center gap-1 rounded-xl px-2"
              aria-label={`Your profile: ${profile.username}, ${profile.xp} XP`}
            >
              <span aria-hidden="true" className="text-xl">
                {profile.avatar}
              </span>
              <span className="hidden max-w-32 truncate font-medium sm:inline">
                {profile.username}
              </span>
              <span className="text-muted whitespace-nowrap">{profile.xp} XP</span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
