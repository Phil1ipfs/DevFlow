import { expect, test, type Page } from "@playwright/test";
import { centre, drag, newUser, registerWithWorkspace } from "./helpers";

const column = (page: Page, name: string) => page.getByRole("region", { name: `${name} column` });
const card = (page: Page, title: string) => page.locator('li[aria-roledescription="Draggable task"]', { hasText: title });

async function createTask(page: Page, title: string, addAnother = false) {
  const titleField = page.getByRole("dialog").getByLabel("Title");
  await expect(titleField).toHaveValue("");
  await titleField.fill(title);
  await page.getByRole("button", { name: addAnother ? "Create and add another" : "Create task" }).click();
  // Wait for the card itself, not just the toast, before the next step.
  await expect(card(page, title)).toBeVisible();
}

test.describe("projects and the Kanban board", () => {
  test.beforeEach(async ({ page }) => {
    await registerWithWorkspace(page, newUser("Kim Board"), "Board Co");
    await page.goto("/app/projects");
    await page.getByRole("button", { name: "New project" }).first().click();
    await page.getByLabel("Name").fill("Website");
    await expect(page.getByLabel("Key")).toHaveValue("WEB");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("heading", { name: "Website" })).toBeVisible();
  });

  test("create tasks, drag them between columns and reorder", async ({ page }) => {
    await page.getByRole("button", { name: "New task" }).click();
    await createTask(page, "Design login page", true);
    await createTask(page, "Build auth API");
    await expect(column(page, "To do")).toContainText("WEB-1");
    await expect(column(page, "To do")).toContainText("Build auth API");

    // Pointer drag into another column. The board updates optimistically, so wait for the save
    // to finish before reloading; a reload would otherwise abort it.
    const moveSaved = page.waitForResponse((response) => /\/api\/v1\/tasks\/[^/]+\/move$/.test(response.url()));
    await drag(page, await centre(page, card(page, "Build auth API")), await centre(page, column(page, "In progress").locator("ul")));
    await expect(column(page, "In progress")).toContainText("Build auth API");
    expect((await moveSaved).ok()).toBe(true);
    await page.reload();
    await expect(column(page, "In progress")).toContainText("Build auth API");

    // Keyboard drag: Space picks up, arrow moves, Space drops. Each step waits for what a
    // screen-reader user would get: the "picked up" state, then the live announcement.
    const keyboardCard = card(page, "Design login page");
    await keyboardCard.focus();
    await page.keyboard.press("Space");
    await expect(keyboardCard).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("[aria-live]").filter({ hasText: "is over In progress" })).toHaveCount(1);
    await page.keyboard.press("Space");
    await expect(column(page, "In progress")).toContainText("Design login page");
  });

  test("task details: assign, change status, comment and see history", async ({ page }) => {
    await page.getByRole("button", { name: "New task" }).click();
    await createTask(page, "Write release notes");
    await card(page, "Write release notes").click();

    const panel = page.getByRole("dialog");
    await expect(panel).toContainText("WEB-1");
    await panel.getByLabel("Assignee").click();
    await page.getByRole("option", { name: "Kim Board" }).click();
    await panel.getByLabel("Status").click();
    await page.getByRole("option", { name: "In review" }).click();
    await panel.getByLabel("Add a comment").fill("Draft is in the wiki.");
    await panel.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(panel.getByText("Draft is in the wiki.")).toBeVisible();
    await expect(panel.getByRole("tab", { name: "Comments (1)" })).toBeVisible();

    await panel.getByRole("tab", { name: "Activity" }).click();
    await expect(panel).toContainText("moved it from To do to In review");
    await expect(panel).toContainText("assigned it to Kim Board");

    await page.keyboard.press("Escape");
    await expect(column(page, "In review")).toContainText("Write release notes");

    await page.goto("/app/my-tasks");
    await expect(page.getByRole("table")).toContainText("Write release notes");
  });

  test("list view filters and searches, with state in the URL", async ({ page }) => {
    await page.getByRole("button", { name: "New task" }).click();
    await createTask(page, "Fix login redirect", true);
    await createTask(page, "Write API docs");
    await page.getByRole("radio", { name: "List" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(2);

    await page.getByLabel("Search tasks").fill("docs");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page).toHaveURL(/q=docs/);

    await page.getByLabel("Search tasks").fill("WEB-1");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody")).toContainText("Fix login redirect");
  });
});
