import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy · Past Paper Game" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10 leading-relaxed">
      <h1 className="text-2xl font-bold">Privacy notice</h1>
      <p>
        Past Paper Game is for GCSE students, so we keep things simple and collect as little as we
        can. Here&apos;s what that means in plain English.
      </p>

      <h2 className="mt-2 text-lg font-semibold">What we keep</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>The username and avatar you choose (please don&apos;t use your real name).</li>
        <li>Your exam board and tier, so your questions match your course.</li>
        <li>
          Your answers, scores, XP and how you&apos;re doing in each topic, so we can show your
          progress.
        </li>
        <li>Your email address, only if you choose to add one so you can sign in again.</li>
      </ul>

      <h2 className="mt-2 text-lg font-semibold">What we don&apos;t do</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>No adverts and no tracking across other websites.</li>
        <li>No selling or sharing your data with anyone else.</li>
        <li>No chat or messages between players.</li>
        <li>No profile pictures or uploads.</li>
      </ul>

      <h2 className="mt-2 text-lg font-semibold">Who can see what</h2>
      <p>
        Other players can only see your username, avatar and the XP you&apos;ve earned this week on
        the leaderboard. Nobody else can see your answers, your email, or which topics you find
        tricky.
      </p>

      <h2 className="mt-2 text-lg font-semibold">Cookies</h2>
      <p>We only use the cookies needed to keep you signed in.</p>

      <h2 className="mt-2 text-lg font-semibold">Deleting your data</h2>
      <p>
        You can delete your account and everything linked to it at any time from your{" "}
        <Link href="/profile" className="text-accent font-medium underline">
          profile
        </Link>
        . It happens straight away and can&apos;t be undone.
      </p>

      <p className="mt-4">
        <Link href="/" className="text-accent font-medium underline">
          Back to the start
        </Link>
      </p>
    </main>
  );
}
