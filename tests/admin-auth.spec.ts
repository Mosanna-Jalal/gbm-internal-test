import { test, expect } from "@playwright/test"
import { loginAsAdmin, ADMIN, HINDI_ADMIN } from "./helpers"

test.describe("Admin Authentication", () => {

  test("login page loads with correct elements", async ({ page }) => {
    await page.goto("/admin/login")
    await expect(page.getByRole("heading", { name: "Admin Login" })).toBeVisible()
    await expect(page.getByText("Gautam Buddha Mahila College, Gaya")).toBeVisible()
    await expect(page.getByPlaceholder(/masteradmin/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible()
  })

  test("shows error for wrong credentials", async ({ page }) => {
    await page.goto("/admin/login")
    await page.fill('input[autocomplete="username"]', "masteradmin")
    await page.fill('input[autocomplete="current-password"]', "wrongpassword")
    await page.click('button[type="submit"]')
    await expect(page.getByText("Invalid credentials")).toBeVisible({ timeout: 6000 })
  })

  test("shows error for unknown username", async ({ page }) => {
    await page.goto("/admin/login")
    await page.fill('input[autocomplete="username"]', "unknownuser")
    await page.fill('input[autocomplete="current-password"]', "anypassword")
    await page.click('button[type="submit"]')
    await expect(page.getByText("Invalid credentials")).toBeVisible({ timeout: 6000 })
  })

  test("master admin logs in and lands on dashboard", async ({ page }) => {
    await loginAsAdmin(page, ADMIN)
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  })

  test("department admin (hindi) logs in successfully", async ({ page }) => {
    await loginAsAdmin(page, HINDI_ADMIN)
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    await expect(page.locator("aside").getByRole("heading", { name: "HINDI" })).toBeVisible()
  })

  test("admin can sign out", async ({ page }) => {
    await loginAsAdmin(page, ADMIN)
    await page.click('button:has-text("Sign Out")')
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 6000 })
  })

  test("unauthenticated access to dashboard redirects to login", async ({ page }) => {
    await page.goto("/admin/dashboard")
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 6000 })
  })

  test("unauthenticated access to students page redirects to login", async ({ page }) => {
    await page.goto("/admin/students")
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 6000 })
  })

})
