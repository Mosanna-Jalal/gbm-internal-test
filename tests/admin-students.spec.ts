import { test, expect } from "@playwright/test"
import { loginAsAdmin, ADMIN, HINDI_ADMIN } from "./helpers"

test.describe("Admin Students Page – Master Admin", () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, ADMIN)
    await page.goto("/admin/students")
  })

  test("page loads with Students heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Students" })).toBeVisible()
  })

  test("shows total count in database", async ({ page }) => {
    await expect(page.getByText(/total in database/i)).toBeVisible()
  })

  test("filter panel is visible with Session and Course dropdowns", async ({ page }) => {
    await expect(page.getByText("Filter & Select Batch")).toBeVisible()
    // Session is first select, Course is second
    await expect(page.locator("select").first()).toBeVisible()
    await expect(page.locator("select").nth(1)).toBeVisible()
  })

  test("Upload Excel button is visible for master admin", async ({ page }) => {
    await expect(page.getByText(/upload excel/i)).toBeVisible()
  })

  test("selecting a session shows semester dropdown", async ({ page }) => {
    await page.locator("select").first().selectOption("2024-28")
    await expect(page.getByText(/semester/i)).toBeVisible({ timeout: 3000 })
  })

  test("selecting session + course shows Create Test CTA", async ({ page }) => {
    await page.locator("select").first().selectOption("2024-28")
    await page.locator("select").nth(1).selectOption("B.A")
    await expect(page.getByRole("button", { name: /create test/i })).toBeVisible({ timeout: 3000 })
  })

  test("Clear filter button appears when session is selected", async ({ page }) => {
    await page.locator("select").first().selectOption("2024-28")
    await expect(page.getByText("✕ Clear")).toBeVisible()
  })

  test("Clear filter button disappears after clicking", async ({ page }) => {
    await page.locator("select").first().selectOption("2024-28")
    await page.click('button:has-text("✕ Clear")')
    await expect(page.getByText("✕ Clear")).not.toBeVisible()
  })

})

test.describe("Admin Students Page – Dept Admin (Hindi)", () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, HINDI_ADMIN)
    await page.goto("/admin/students")
  })

  test("course is locked as B.A for hindi dept admin", async ({ page }) => {
    // Locked course shows as a blue box div, not a <select>
    await expect(page.locator("div").filter({ hasText: /^B\.A$/ }).first()).toBeVisible()
    // The course <select> should not exist
    await expect(page.locator('select[value="B.A"]')).not.toBeAttached()
  })

  test("Upload Excel button is hidden for dept admin", async ({ page }) => {
    await expect(page.getByText(/upload excel/i)).not.toBeVisible()
  })

  test("Clear All button is hidden for dept admin", async ({ page }) => {
    await expect(page.getByRole("button", { name: /clear all/i })).not.toBeVisible()
  })

})
