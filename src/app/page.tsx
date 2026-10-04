import { ButtonLink } from "@/components/ui/Button";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { deleted } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      {deleted === "1" && (
        <p
          role="status"
          className="border-border bg-surface w-full rounded-xl border px-4 py-3 text-sm"
        >
          Your account and all your data have been deleted.
        </p>
      )}
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Past Paper Game</h1>
      <p className="text-muted text-lg">
        Practise GCSE Maths exam-style questions for your exam board and tier, get instant worked
        solutions, and compete with friends.
      </p>
      <ButtonLink href="/play" className="w-full max-w-xs">
        Play now
      </ButtonLink>
      <p className="text-muted text-sm">Live rooms with friends are coming soon.</p>
    </main>
  );
}
