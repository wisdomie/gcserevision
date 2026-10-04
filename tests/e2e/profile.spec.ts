import { expect, test } from "@playwright/test";
import { adminClient, playSessionViaApi, signUp } from "./helpers";

// PLAN.md M4 "done when": a user can see their strongest and weakest topics
// and delete their account and data.
test.use({ viewport: { width: 360, height: 740 } });

test("profile shows strongest and weakest topics, edits settings, and deletes the account", async ({
  page,
}) => {
  const username = await signUp(page, { board: "aqa", tier: "Higher" });
  const strongScore = await playSessionViaApi(page, "fractions", 5, true);
  await playSessionViaApi(page, "ratio", 5, false);

  // Strongest and weakest topics. (A fresh load: the sessions above were played
  // through the API, so this tab's header hasn't seen the new XP yet.)
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1, name: username })).toBeVisible();
  const strongest = page.locator("section", {
    has: page.getByRole("heading", { name: "Strongest" }),
  });
  await expect(strongest.getByText("Fractions")).toBeVisible();
  await expect(strongest.getByText("100% correct · 5 of 5")).toBeVisible();
  await expect(page.getByText("Ratio")).toBeVisible();
  await expect(page.getByText("0% correct · 0 of 5")).toBeVisible();
  await expect(page.getByRole("link", { name: /Your profile: .*, \d+ XP/ })).toHaveAccessibleName(
    new RegExp(`${strongScore} XP`),
  );

  // "Practise" goes to solo setup with the topic ticked
  await page.getByRole("link", { name: "Practise" }).click();
  await expect(page).toHaveURL(/\/play\/solo\?topics=ratio$/);
  await expect(page.getByRole("checkbox", { name: "Ratio", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Start (1 topic)" })).toBeVisible();

  // The leaderboard shows this player's XP for the week
  await page.getByRole("link", { name: "Leaderboard" }).click();
  const me = page.getByRole("row", { name: new RegExp(`${username} \\(you\\)`) });
  await expect(me).toContainText(String(strongScore));
  await page.getByRole("link", { name: "Friends" }).click();
  await expect(page.getByRole("row", { name: new RegExp(username) })).toBeVisible();

  // Edit settings
  await page.goto("/profile");
  await page.getByRole("radio", { name: "Foundation" }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await expect(page.getByText(/· Foundation$/)).toBeVisible();

  // Delete the account
  const { data: profile } = await adminClient()
    .from("profiles")
    .select("id")
    .eq("username", username)
    .single();
  const userId = profile!.id;
  await page.getByRole("button", { name: "Delete my account and data" }).click();
  const confirm = page.getByRole("button", { name: "Delete everything" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await confirm.click();
  await expect(page).toHaveURL(/\/\?deleted=1$/);
  await expect(page.getByText("Your account and all your data have been deleted.")).toBeVisible();

  // Everything is gone, and the browser is signed out
  const admin = adminClient();
  const { data: user } = await admin.auth.admin.getUserById(userId);
  expect(user.user).toBeNull();
  for (const table of ["profiles", "answers", "topic_stats", "solo_sessions"] as const) {
    const column = table === "profiles" ? "id" : "user_id";
    const { count } = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(column, userId);
    expect(count, table).toBe(0);
  }
  await page.goto("/play");
  await expect(page).toHaveURL(/\/login$/);
});

test("the privacy notice is reachable from every page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible();
});
