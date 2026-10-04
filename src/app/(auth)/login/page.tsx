import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/api/redirect";
import { getUserId } from "@/lib/supabase/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · Past Paper Game" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next: requested } = await searchParams;
  const next = safeRedirectPath(typeof requested === "string" ? requested : null);
  if (await getUserId()) redirect(next);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Let&apos;s get you playing</h1>
      <LoginForm next={next} />
    </main>
  );
}
