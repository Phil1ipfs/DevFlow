import { expect, test } from "@playwright/test";
import { newUser, registerWithWorkspace } from "./helpers";

/** Runs in the "mobile" project (Pixel 7 viewport). */
test.describe("mobile layout", () => {
  test("landing page menu and app sidebar work on a phone", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Features" }).click();
    await expect(page).toHaveURL(/#features/);

    await registerWithWorkspace(page, newUser("Pia Phone"), "Pocket Co");
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await page.getByRole("link", { name: "Tickets" }).click();
    await expect(page).toHaveURL(/\/app\/tickets/);

    for (const path of ["/", "/app", "/app/tickets", "/app/reports", "/app/settings"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    }
  });
});
