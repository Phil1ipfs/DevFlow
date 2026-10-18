import { expect, test } from "@playwright/test";
import { invite, newUser, register, registerWithWorkspace } from "./helpers";

test.describe("workspaces, invitations and helpdesk", () => {
  test("an invited member joins, raises a ticket and the admin is notified in real time", async ({ browser }) => {
    // Two browser contexts = two people signed in at the same time.
    const adminContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const admin = await adminContext.newPage();
    const member = await memberContext.newPage();
    const adminUser = newUser("Ada Admin");
    const memberUser = newUser("Mo Member");

    await registerWithWorkspace(admin, adminUser, "Helpdesk Co");
    const invitePath = await invite(admin, memberUser);

    await register(member, memberUser, invitePath);
    await expect(member).toHaveURL(new RegExp(invitePath));
    await member.getByRole("button", { name: "Join Helpdesk Co" }).click();
    await expect(member).toHaveURL(/\/app$/);

    // Members cannot manage the workspace.
    await member.goto("/app/settings/members");
    await expect(member.getByText("Ada Admin")).toBeVisible();
    await expect(member.getByRole("button", { name: "Invite" })).toHaveCount(0);

    await admin.goto("/app");
    const bell = admin.getByRole("button", { name: /^Notifications/ });
    await expect(bell).toHaveAccessibleName("Notifications");

    await member.goto("/app/tickets");
    await member.getByRole("button", { name: "New ticket" }).first().click();
    await member.getByLabel("Subject").fill("Laptop won't power on");
    await member.getByLabel("Description").fill("No lights at all.");
    await member.getByLabel("Urgency").click();
    await member.getByRole("option", { name: "Urgent" }).click();
    await member.getByRole("button", { name: "Submit ticket" }).click();
    await expect(member.getByRole("heading", { name: /#1/ })).toBeVisible();

    // Delivered over SignalR through the Next.js proxy: no reload on the admin's side.
    await expect(bell).toHaveAccessibleName("Notifications, 1 unread");
    await bell.click();
    await admin.getByRole("button", { name: /New urgent priority ticket #1/ }).click();
    await expect(admin.getByRole("heading", { name: /Laptop won't power on/ })).toBeVisible();

    await admin.getByLabel("Assignee").click();
    await admin.getByRole("option", { name: "Ada Admin" }).click();
    await admin.getByRole("checkbox", { name: "Internal note" }).check();
    await admin.locator("#ticketReply").fill("Probably the battery.");
    await admin.getByRole("button", { name: "Add note" }).click();
    await expect(admin.getByText("Probably the battery.")).toBeVisible();

    // The requester never sees internal notes.
    await member.reload();
    await expect(member.getByText("Laptop won't power on")).toBeVisible();
    await expect(member.getByText("Probably the battery.")).toHaveCount(0);

    await adminContext.close();
    await memberContext.close();
  });

  test("outsiders cannot open another workspace's project", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const outsiderContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const outsider = await outsiderContext.newPage();

    await registerWithWorkspace(owner, newUser("Oli Owner"), "Private Co");
    await owner.goto("/app/projects");
    await owner.getByRole("button", { name: "New project" }).first().click();
    await owner.getByLabel("Name").fill("Secret plans");
    await owner.getByRole("button", { name: "Create project" }).click();
    await expect(owner.getByRole("heading", { name: "Secret plans" })).toBeVisible();
    const projectUrl = owner.url();

    await registerWithWorkspace(outsider, newUser("Ozzy Outsider"), "Other Co");
    await outsider.goto(projectUrl);
    await expect(outsider.getByRole("heading", { name: "Project not found" })).toBeVisible();
    await expect(outsider.getByText("Secret plans")).toHaveCount(0);

    await ownerContext.close();
    await outsiderContext.close();
  });
});
