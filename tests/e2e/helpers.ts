import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** Service-role client for test-only lookups of hidden answers. Never used by the app's browser code. */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("E2E tests need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const uniqueUsername = () =>
  `e2e_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(0, 20);

/** Quick-play sign-up and onboarding through the UI. */
export async function signUp(
  page: Page,
  opts: { board?: string; tier?: "Foundation" | "Higher" } = {},
) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Play now" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  const username = uniqueUsername();
  await page.getByLabel("Username").fill(username);
  await page.getByRole("radio", { name: "Avatar 🐼" }).check({ force: true });
  await page.getByLabel("Exam board").selectOption(opts.board ?? "aqa");
  await page.getByRole("radio", { name: opts.tier ?? "Higher" }).check();
  await page.getByRole("button", { name: "Save and start" }).click();
  await expect(page).toHaveURL(/\/play$/);
  return username;
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow, "page scrolls horizontally").toBe(false);
}

/** The hidden answer for a question instance, as the player would type or pick it. */
export async function correctAnswerFor(
  instanceId: string,
): Promise<{ mcqIndex?: number; text?: string }> {
  const { data, error } = await adminClient()
    .from("question_secrets")
    .select("answer_spec, solution")
    .eq("instance_id", instanceId)
    .single();
  if (error) throw error;
  const spec = data.answer_spec as { kind: string; correctIndex?: number };
  if (spec.kind === "mcq") return { mcqIndex: spec.correctIndex };
  return { text: (data.solution as { final: string }).final };
}
