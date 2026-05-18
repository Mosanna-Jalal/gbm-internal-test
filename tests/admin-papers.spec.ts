import { test, expect } from "@playwright/test"
import { loginAsAdmin, HINDI_ADMIN } from "./helpers"

test.describe("Papers Page – Dept Admin (Hindi)", () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, HINDI_ADMIN)
    await page.goto("/admin/papers")
  })

  test("papers page loads with heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Papers" })).toBeVisible()
  })

  test("shows department name below heading", async ({ page }) => {
    // "Department: HINDI" — the span inside the p
    await expect(page.getByRole("main").getByText("HINDI")).toBeVisible()
  })

  test("has an Add New Paper section with text input", async ({ page }) => {
    await expect(page.getByText("Add New Paper")).toBeVisible()
    await expect(page.getByPlaceholder(/Hindi Prose/i)).toBeVisible()
  })

  test("Add button is disabled when input is empty", async ({ page }) => {
    const addBtn = page.getByRole("button", { name: /^\+ Add$/ })
    await expect(addBtn).toBeDisabled()
  })

  test("Add button enables when paper name is typed", async ({ page }) => {
    await page.getByPlaceholder(/Hindi Prose/i).fill("Hindi Grammar")
    await expect(page.getByRole("button", { name: /^\+ Add$/ })).toBeEnabled()
  })

  test("adding a paper name shows it in the list", async ({ page }) => {
    const name = `Test Paper ${Date.now()}`
    await page.getByPlaceholder(/Hindi Prose/i).fill(name)
    await page.getByRole("button", { name: /^\+ Add$/ }).click()
    await expect(page.getByText(name)).toBeVisible({ timeout: 6000 })
  })

})
