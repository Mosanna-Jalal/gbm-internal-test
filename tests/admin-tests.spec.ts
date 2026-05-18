import { test, expect } from "@playwright/test"
import { loginAsAdmin, ADMIN, HINDI_ADMIN } from "./helpers"

test.describe("Admin Tests List Page", () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, ADMIN)
    await page.goto("/admin/tests")
  })

  test("page loads with Tests heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Tests" })).toBeVisible()
  })

  test("Create New Test button is visible", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /new test/i })
        .or(page.getByRole("button", { name: /new test/i }))
        .or(page.getByText(/create.*test/i).first())
    ).toBeVisible()
  })

})

test.describe("Create Test Page – Master Admin", () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, ADMIN)
    await page.goto("/admin/tests/new")
  })

  test("page loads with Create Test heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Create Test" })).toBeVisible()
  })

  test("Test Title input is visible", async ({ page }) => {
    await expect(page.getByPlaceholder(/Accounts CIA/i)).toBeVisible()
  })

  test("session dropdown is visible", async ({ page }) => {
    await expect(page.getByText("Session")).toBeVisible()
    await expect(page.locator("select").first()).toBeVisible()
  })

  test("duration field is visible", async ({ page }) => {
    await expect(page.getByText(/duration/i)).toBeVisible()
    await expect(page.locator('input[type="number"]').first()).toBeVisible()
  })

  test("Add Question button is visible before any questions", async ({ page }) => {
    await expect(page.getByRole("button", { name: /add question/i })).toBeVisible()
  })

  test("clicking Add Question opens the question textarea", async ({ page }) => {
    await page.getByRole("button", { name: /add question/i }).click()
    await expect(page.getByPlaceholder(/type the question here/i)).toBeVisible({ timeout: 3000 })
  })

  test("start time past shows toast notification", async ({ page }) => {
    // Use Hindi admin so dept + course are pre-locked (fewer fields to fill)
    await loginAsAdmin(page, HINDI_ADMIN)

    // Mock papers API with a Hindi paper so the paper select is populated
    await page.route("/api/papers**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ _id: "p1", name: "Hindi Paper I", department: "HINDI" }]),
      })
    )
    await page.goto("/admin/tests/new")

    await page.getByPlaceholder(/Accounts CIA/i).fill("Test Title")
    await page.getByPlaceholder(/Dr\. Sunita/i).fill("Test Teacher")

    // Session
    await page.locator("select").first().selectOption("2024-28")
    // Wait for semester options to appear then select one
    await page.waitForTimeout(300)
    const semSelect = page.locator("select").filter({ hasText: /sem|I$/i }).last()
    if (await semSelect.count() > 0) await semSelect.selectOption({ index: 1 })

    // Paper
    const paperSelect = page.locator("select").filter({ hasText: /paper|Hindi/i }).last()
    if (await paperSelect.count() > 0) await paperSelect.selectOption({ index: 1 })

    // Add a question (the questions-length check runs before start-time check)
    await page.getByRole("button", { name: /add question/i }).click()
    await page.getByPlaceholder(/type the question here/i).fill("What is 2+2?")
    const opts = page.locator('input[placeholder^="Option"]')
    await opts.nth(0).fill("1")
    await opts.nth(1).fill("4")
    await opts.nth(2).fill("3")
    await opts.nth(3).fill("5")
    // Mark option B as correct (circular letter buttons: A/B/C/D)
    await page.getByRole("button", { name: /^B$/ }).click()
    await page.getByRole("button", { name: /save question/i }).click()
    await page.waitForTimeout(300)

    // Set start date to yesterday + time — triggers the past start-time toast
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    await page.locator('input[type="date"]').first().fill(yesterday)
    await page.locator('input[type="time"]').first().fill("09:00")

    await page.getByRole("button", { name: "Create Test" }).click()

    await expect(page.getByText("Start Time Already Passed")).toBeVisible({ timeout: 6000 })
  })

})

test.describe("Create Test Page – Dept Admin (Hindi)", () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, HINDI_ADMIN)
    await page.goto("/admin/tests/new")
  })

  test("department field is locked and shows HINDI", async ({ page }) => {
    // Locked dept shows as a blue box — check main content area
    await expect(page.getByRole("main").getByText("HINDI")).toBeVisible()
  })

  test("course is auto-filled as B.A", async ({ page }) => {
    await expect(page.getByRole("main").getByText("B.A")).toBeVisible()
  })

})
