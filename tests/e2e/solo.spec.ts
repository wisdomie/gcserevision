import { expect, test } from "@playwright/test";
import { correctAnswerFor, expectNoHorizontalScroll, signUp, usePlainTextBox } from "./helpers";

// PLAN.md M2 "done when": a new user signs up, chooses AQA Higher, plays a
// 10-question Algebra session, and sees correct marking and solutions on a phone.
test.use({ viewport: { width: 360, height: 740 } });

const ALGEBRA_TOPICS =
  /Linear equations|Quadratics|Substitution|Sequences|Simplifying|Expanding|Rearranging/;

test("AQA Higher player completes a 10-question Algebra session", async ({ page }) => {
  await signUp(page, { board: "aqa", tier: "Higher" });
  await expect(page.getByText("AQA · Higher tier")).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByRole("link", { name: "Start practising" }).click();
  await page.getByRole("checkbox", { name: "All algebra topics" }).check();
  await page.getByRole("button", { name: /^Start \(\d+ topics?\)$/ }).click();
  await expect(page).toHaveURL(/\/play\/solo\/[0-9a-f-]{36}$/);

  for (let i = 1; i <= 10; i++) {
    await expect(page.getByText(`Question ${i} of 10`)).toBeVisible();
    const card = page.locator("[data-instance-id]");
    await expect(card.getByText(ALGEBRA_TOPICS)).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Answer odd questions correctly and even ones wrongly, and check the marking.
    const answerRight = i % 2 === 1;
    const instanceId = (await card.getAttribute("data-instance-id"))!;
    const { mcqIndex, text } = await correctAnswerFor(instanceId);
    const radios = card.getByRole("radio");
    if (mcqIndex !== undefined) {
      const count = await radios.count();
      await radios.nth(answerRight ? mcqIndex : (mcqIndex + 1) % count).check();
    } else {
      // Typed answers go in the plain text box (the maths keyboard has its own test)
      await usePlainTextBox(page);
      await page.getByRole("textbox", { name: "Your answer" }).fill(answerRight ? text! : "999999");
    }
    await page.getByRole("button", { name: "Check answer" }).click();

    await expect(
      page.getByRole("heading", { level: 2, name: answerRight ? "Correct!" : "Not quite" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Worked solution" })).toBeVisible();
    await expect(page.getByText("Answer:")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole("button", { name: i < 10 ? "Next question" : "See results" }).click();
  }

  await expect(page.getByRole("heading", { name: "Your results" })).toBeVisible();
  await expect(page.getByText("5 / 10", { exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
