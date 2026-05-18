import { test, expect } from "@playwright/test"
import { mockStudentFound, mockStudentNotFound, mockTests, mockNoAttempts, fakeTest } from "./helpers"

// The roll input has placeholder "e.g. 25291040005" — target by type + position
const rollInput = (page: import("@playwright/test").Page) =>
  page.locator('input[type="text"]').first()

test.describe("Student Home Page", () => {

  test("shows college header and roll number input", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("header").getByText("Gautam Buddha Mahila College, Gaya")).toBeVisible()
    await expect(page.getByText("Online MCQ Test Portal")).toBeVisible()
    await expect(rollInput(page)).toBeVisible()
    await expect(page.getByRole("button", { name: /search/i })).toBeVisible()
  })

  test("search button is disabled when input is empty", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("button", { name: /search/i })).toBeDisabled()
  })

  test("search button enables when roll number is typed", async ({ page }) => {
    await page.goto("/")
    await rollInput(page).fill("25291040001")
    await expect(page.getByRole("button", { name: /search/i })).toBeEnabled()
  })

  test("shows not-found message for unknown roll number", async ({ page }) => {
    await mockStudentNotFound(page)
    await page.goto("/")
    await rollInput(page).fill("99999999999")
    await page.click('button:has-text("Search")')
    await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 6000 })
  })

  test("shows student name and details when roll number is found", async ({ page }) => {
    await mockStudentFound(page, { course: "B.A", session: "2024-28" })
    await mockNoAttempts(page)
    await mockTests(page, [])
    await page.goto("/")
    await rollInput(page).fill("25291040001")
    await page.click('button:has-text("Search")')
    await expect(page.getByText("Test Student")).toBeVisible({ timeout: 6000 })
    await expect(page.getByText("B.A")).toBeVisible()
    await expect(page.getByText("2024-28")).toBeVisible()
  })

  test("shows all four test sections after student is found", async ({ page }) => {
    await mockStudentFound(page)
    await mockNoAttempts(page)
    await mockTests(page, [])
    await page.goto("/")
    await rollInput(page).fill("25291040001")
    await page.click('button:has-text("Search")')
    await expect(page.getByRole("heading", { name: "Active Tests" })).toBeVisible({ timeout: 6000 })
    await expect(page.getByRole("heading", { name: "Upcoming Tests" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Attempted Tests" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Missed Tests" })).toBeVisible()
  })

  test("shows empty state messages when no tests exist", async ({ page }) => {
    await mockStudentFound(page)
    await mockNoAttempts(page)
    await mockTests(page, [])
    await page.goto("/")
    await rollInput(page).fill("25291040001")
    await page.click('button:has-text("Search")')
    await expect(page.getByText(/No tests are live right now/i)).toBeVisible({ timeout: 6000 })
    await expect(page.getByText(/No tests are scheduled/i)).toBeVisible()
    await expect(page.getByText(/haven't submitted any tests/i)).toBeVisible()
    await expect(page.getByText(/haven't missed any tests/i)).toBeVisible()
  })

  test("active test card shows Start Test button", async ({ page }) => {
    await mockStudentFound(page)
    await mockNoAttempts(page)
    await mockTests(page, [fakeTest()])
    await page.goto("/")
    await rollInput(page).fill("25291040001")
    await page.click('button:has-text("Search")')
    await expect(page.getByRole("button", { name: /start test/i })).toBeVisible({ timeout: 6000 })
    await expect(page.getByText("Hindi Paper I – CIA")).toBeVisible()
  })

  test("upcoming test shows 'Not open yet', no Start Test button", async ({ page }) => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    await mockStudentFound(page)
    await mockNoAttempts(page)
    await mockTests(page, [fakeTest({ startTime: future, endTime: null })])
    await page.goto("/")
    await rollInput(page).fill("25291040001")
    await page.click('button:has-text("Search")')
    await expect(page.getByText(/not open yet/i)).toBeVisible({ timeout: 6000 })
    await expect(page.getByRole("button", { name: /start test/i })).not.toBeVisible()
  })

  test("missed test shows Not attempted badge", async ({ page }) => {
    const past    = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const pastEnd = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    await mockStudentFound(page)
    await mockNoAttempts(page)
    await mockTests(page, [fakeTest({ startTime: past, endTime: pastEnd })])
    await page.goto("/")
    await rollInput(page).fill("25291040001")
    await page.click('button:has-text("Search")')
    await expect(page.getByText(/not attempted/i)).toBeVisible({ timeout: 6000 })
  })

  test("attempted test shows View Result button", async ({ page }) => {
    const testId = "abc123testid"
    await mockStudentFound(page)
    await page.route("/api/attempts**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ testId, attemptId: "attempt999" }]),
      })
    )
    await mockTests(page, [fakeTest({ _id: testId })])
    await page.goto("/")
    await rollInput(page).fill("25291040001")
    await page.click('button:has-text("Search")')
    await expect(page.getByRole("button", { name: /view result/i })).toBeVisible({ timeout: 6000 })
  })

  test("manual course selection form shown for student not in DB", async ({ page }) => {
    await page.route("/api/students/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ name: "External Student" }),
      })
    )
    await page.goto("/")
    await rollInput(page).fill("99999999999")
    await page.click('button:has-text("Search")')
    await expect(page.getByText(/not found in the admission register/i)).toBeVisible({ timeout: 6000 })
  })

  test("footer admin link navigates to login", async ({ page }) => {
    await page.goto("/")
    await page.click('footer a:has-text("Admin")')
    await expect(page).toHaveURL(/\/admin\/login/)
  })

})
