import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/supabase/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · Past Paper Game" };

export default async function LoginPage() {
  if (await getUserId()) redirect("/play");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Let&apos;s get you playing</h1>
      <LoginForm />
    </main>
  );
}
