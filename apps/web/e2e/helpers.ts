import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = "a-long-e2e-passphrase";

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

export type TestUser = { name: string; email: string };

export function newUser(name: string): TestUser {
  return { name, email: uniqueEmail(name.split(" ")[0].toLowerCase()) };
}

/** Registers through the UI and stops wherever the app lands (onboarding, or `next`). */
export async function register(page: Page, user: TestUser, next?: string) {
  await page.goto(next ? `/register?next=${encodeURIComponent(next)}` : "/register");
  await page.getByLabel("Name").fill(user.name);
  await page.getByLabel("Work email").fill(user.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function signIn(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app/);
}

/** Registers a brand-new user and creates their first workspace. */
export async function registerWithWorkspace(page: Page, user: TestUser, workspace: string) {
  await register(page, user);
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Workspace name").fill(workspace);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
}

type CapturedEmail = { to: string; subject: string; textBody: string };

/** Reads the API's development mailbox (only exists outside Production). */
export async function latestEmail(request: APIRequestContext, to: string, subject: RegExp): Promise<CapturedEmail> {
  let found: CapturedEmail | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(`/api/v1/dev/emails?to=${encodeURIComponent(to)}`);
      const emails = (await response.json()) as CapturedEmail[];
      found = emails.find((e) => subject.test(e.subject));
      return Boolean(found);
    })
    .toBe(true);
  return found!;
}

/** Extracts the path (and query) of the first link in an email, to open it on the server under test. */
export function linkPath(body: string, pattern: RegExp) {
  const url = new URL(body.match(pattern)![0]);
  return url.pathname + url.search;
}

/** Invites `user` from the admin's members page and returns the invitation link path. */
export async function invite(admin: Page, user: TestUser, role: "Member" | "Admin" = "Member") {
  await admin.goto("/app/settings/members");
  await admin.getByRole("button", { name: "Invite" }).click();
  await admin.getByLabel("Email").fill(user.email);
  if (role === "Admin") {
    await admin.getByLabel("Role").click();
    await admin.getByRole("option", { name: "Admin" }).click();
  }
  await admin.getByRole("button", { name: "Send invitation" }).click();
  // Scoped to <main>: the confirmation toast also mentions the email.
  await expect(admin.getByRole("main").getByRole("listitem").filter({ hasText: user.email })).toBeVisible();
  const email = await latestEmail(admin.request, user.email, /invited you/);
  return linkPath(email.textBody, /https?:\/\/\S+\/invite\/\S+/);
}

/** Pointer drag with small steps, which is how dnd-kit's pointer sensor expects to be driven. */
export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.up();
}

export async function centre(page: Page, locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no bounding box");
  return { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 30) };
}
