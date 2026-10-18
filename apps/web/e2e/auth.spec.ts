import { expect, test } from "@playwright/test";
import { latestEmail, linkPath, newUser, PASSWORD, register, registerWithWorkspace, signIn } from "./helpers";

test.describe("authentication", () => {
  test("protected pages redirect anonymous visitors to sign in", async ({ page }) => {
    await page.goto("/app/projects");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fprojects/);
  });

  test("register, onboard, sign out and sign back in", async ({ page }) => {
    const user = newUser("Ana Lee");
    await registerWithWorkspace(page, user, "Ana's Team");

    await page.getByRole("button", { name: "Open profile menu" }).click();
    await expect(page.getByRole("menu")).toContainText(user.email);
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);

    await signIn(page, user);
    await expect(page.getByRole("heading", { name: "Welcome back, Ana" })).toBeVisible();
  });

  test("validation and wrong credentials are reported clearly", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Work email").fill("not-an-email");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();

    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.test");
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    // (Next.js adds its own route-announcer alert, so pick ours by content.)
    await expect(page.getByRole("alert").filter({ hasText: "Invalid email or password" })).toBeVisible();
  });

  test("forgot password resets the password via the emailed link", async ({ page }) => {
    const user = newUser("Rae Reset");
    await registerWithWorkspace(page, user, "Reset Co");
    await page.context().clearCookies();

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    const email = await latestEmail(page.request, user.email, /Reset your DevFlow password/);
    await page.goto(linkPath(email.textBody, /http\S+reset-password\S+/));
    const newPassword = `${PASSWORD}-new`;
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app/);
  });

  test("an open redirect through ?next= is refused", async ({ page }) => {
    const user = newUser("Nia Next");
    await register(page, user);
    await page.context().clearCookies();
    await page.goto("/login?next=%2F%2Fevil.example");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/localhost|127\.0\.0\.1/);
    expect(new URL(page.url()).host).not.toContain("evil.example");
  });
});
