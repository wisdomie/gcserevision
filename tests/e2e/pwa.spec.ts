import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

// PLAN.md M8: installable, with an offline page instead of the browser's error.
test("the app has a manifest with working icons", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest).toMatchObject({
    name: "Past Paper Game",
    display: "standalone",
    start_url: "/play",
  });
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) {
    const img = await request.get(icon.src);
    expect(img.status(), icon.src).toBe(200);
    expect(img.headers()["content-type"]).toBe("image/png");
  }
});

test("pages show a friendly offline screen without a connection", async ({ page, context }) => {
  await page.goto("/login");
  // Wait for the service worker to take control of the page
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }),
      );
  });

  await context.setOffline(true);
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  // It has its own address and remembers where to go back to
  await expect(page).toHaveURL(/\/offline\?from=%2Fprivacy$/);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  await context.setOffline(false);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible();
});

test("a signed-in page that was prefetched still shows the offline screen", async ({
  page,
  context,
}) => {
  await signUp(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }),
      );
  });
  // The header's leaderboard link has been prefetched by now
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();

  await context.setOffline(false);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/leaderboard$/);
  await expect(page.getByRole("heading", { name: "This week's leaderboard" })).toBeVisible();
});
