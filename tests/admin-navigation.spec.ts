import { test, expect } from "@playwright/test"
import { loginAsAdmin, ADMIN, HINDI_ADMIN } from "./helpers"

// Sidebar nav links live inside the <aside> element
const sidebarLink = (page: import("@playwright/test").Page, name: string) =>
  page.locator("aside").getByRole("link", { name })

test.describe("Admin Sidebar Navigation – Master Admin", () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, ADMIN)
  })

  test("dashboard page shows heading", async ({ page }) => {
    await page.goto("/admin/dashboard")
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  })

  test("sidebar Tests link navigates to tests page", async ({ page }) => {
    await sidebarLink(page, "Tests").click()
    await expect(page).toHaveURL(/\/admin\/tests/)
    await expect(page.getByRole("heading", { name: "Tests" })).toBeVisible()
  })

  test("sidebar Students link navigates to students page", async ({ page }) => {
    await sidebarLink(page, "Students").click()
    await expect(page).toHaveURL(/\/admin\/students/)
    await expect(page.getByRole("heading", { name: "Students" })).toBeVisible()
  })

  test("sidebar Credentials link navigates to subjects page", async ({ page }) => {
    await sidebarLink(page, "Credentials").click()
    await expect(page).toHaveURL(/\/admin\/subjects/)
  })

  test("navigating away and back to Tests preserves heading", async ({ page }) => {
    await sidebarLink(page, "Tests").click()
    await expect(page).toHaveURL(/\/admin\/tests/)
    await sidebarLink(page, "Students").click()
    await expect(page).toHaveURL(/\/admin\/students/)
    await sidebarLink(page, "Tests").click()
    await expect(page).toHaveURL(/\/admin\/tests/)
    await expect(page.getByRole("heading", { name: "Tests" })).toBeVisible()
  })

  test("sign out button is visible and not showing 'Signing out...'", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible()
    await expect(page.getByText("Signing out...")).not.toBeVisible()
  })

  test("master admin does NOT see Papers link in sidebar", async ({ page }) => {
    await expect(sidebarLink(page, "Papers")).not.toBeVisible()
  })

})

test.describe("Admin Sidebar Navigation – Dept Admin (Hindi)", () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, HINDI_ADMIN)
  })

  test("sidebar shows dept name HINDI", async ({ page }) => {
    await expect(page.locator("aside").getByRole("heading", { name: "HINDI" })).toBeVisible()
  })

  test("dept admin sees Papers link in sidebar", async ({ page }) => {
    await expect(sidebarLink(page, "Papers")).toBeVisible()
  })

  test("dept admin sees Students link in sidebar", async ({ page }) => {
    await expect(sidebarLink(page, "Students")).toBeVisible()
  })

  test("dept admin does NOT see Credentials link", async ({ page }) => {
    await expect(sidebarLink(page, "Credentials")).not.toBeVisible()
  })

  test("Papers link navigates to papers page", async ({ page }) => {
    await sidebarLink(page, "Papers").click()
    await expect(page).toHaveURL(/\/admin\/papers/)
    await expect(page.getByRole("heading", { name: "Papers" })).toBeVisible()
  })

})
