import { expect, test, type Page } from "@playwright/test";
import { setHiddenAnswer, signUp } from "./helpers";

// PLAN.md M3 "done when": typing 2x+4, 4+2x and 2(x+2) behaves as specified.
test.use({ viewport: { width: 360, height: 740 } });

const anyForm = { kind: "expression", latex: "2x+4", variables: ["x"] };
const factorised = { kind: "expression", latex: "2(x+2)", variables: ["x"], form: "factorised" };

/** Starts a fresh session and swaps its first question's hidden answer to `spec`. */
async function questionWithAnswer(page: Page, spec: object) {
  const res = await page.request.post("/api/solo/start", {
    data: { topicSlugs: ["expanding-factorising"], count: 5, timed: false },
  });
  expect(res.status()).toBe(201);
  const { sessionId, current } = await res.json();
  await setHiddenAnswer(current.question.instanceId, spec, "$2x + 4$");
  await page.goto(`/play/solo/${sessionId}`);
  await expect(page.locator("math-field#answer")).toBeVisible();
}

async function typeInMathField(page: Page, keys: string) {
  // The field focuses itself when the question appears. (Clicking an already
  // focused MathLive field and typing within milliseconds drops the first key
  // while MathLive places the caret; no person types that fast after a tap.)
  await expect(page.locator("math-field#answer")).toBeFocused();
  await page.keyboard.type(keys, { delay: 20 });
}

test("the maths keyboard field marks equivalent and wrong-form expressions", async ({ page }) => {
  await signUp(page);

  for (const [spec, keys, verdict, feedback] of [
    [anyForm, "2x+4", "Correct!", null],
    [anyForm, "4+2x", "Correct!", null],
    [anyForm, "2(x+2)", "Correct!", null],
    [anyForm, "2x+5", "Not quite", null],
    [factorised, "2(x+2)", "Correct!", null],
    [factorised, "2x+4", "Not quite", "Factorise your answer fully"],
  ] as const) {
    await questionWithAnswer(page, spec);
    await typeInMathField(page, keys);
    await page.keyboard.press("Enter"); // Enter in the maths field submits
    await expect(page.getByRole("heading", { level: 2, name: verdict }), `${keys}`).toBeVisible();
    if (feedback) await expect(page.getByText(feedback)).toBeVisible();
  }
});

test("players can switch to a plain text box, and the choice is remembered", async ({ page }) => {
  await signUp(page);
  await questionWithAnswer(page, anyForm);

  await page.getByRole("button", { name: "Use a plain text box instead" }).click();
  const box = page.getByRole("textbox", { name: "Your answer" });
  await expect(box).toBeFocused();
  await box.fill("4 + 2x");
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Correct!" })).toBeVisible();

  // The next question keeps the plain text box
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();
  await page.getByRole("button", { name: "Use the maths keyboard instead" }).click();
  await expect(page.locator("math-field#answer")).toBeVisible();
});
