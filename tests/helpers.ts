import { Page } from "@playwright/test"

export const ADMIN = { username: "masteradmin", password: "KingwithacapitalK" }
export const HINDI_ADMIN = { username: "hindi", password: "Rx2pN7cB5k" }
export const BASE = "http://localhost:3011"

/** Log in as admin and land on dashboard */
export async function loginAsAdmin(page: Page, creds = ADMIN) {
  await page.goto("/admin/login")
  await page.fill('input[autocomplete="username"]', creds.username)
  await page.fill('input[autocomplete="current-password"]', creds.password)
  await page.click('button[type="submit"]')
  await page.waitForURL("**/admin/dashboard", { timeout: 8000 })
}

/** Mock the student lookup API to return a known student */
export async function mockStudentFound(page: Page, opts?: { course?: string; session?: string }) {
  const course   = opts?.course   ?? "B.A"
  const session  = opts?.session  ?? "2024-28"
  await page.route("/api/students/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ name: "Test Student", course, session }),
    })
  )
}

/** Mock the student lookup API to return not-found */
export async function mockStudentNotFound(page: Page) {
  await page.route("/api/students/**", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({}) })
  )
}

/** Mock /api/tests to return a list of tests */
export async function mockTests(page: Page, tests: object[]) {
  await page.route("/api/tests**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(tests),
    })
  )
}

/** Mock /api/attempts to return no previous attempts */
export async function mockNoAttempts(page: Page) {
  await page.route("/api/attempts**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
  )
}

/** Build a fake test object */
export function fakeTest(overrides: Partial<{
  _id: string; title: string; subject: string; course: string; session: string;
  semester: number; duration: number; totalMarks: number; startTime: string; endTime: string | null
}> = {}) {
  const now = Date.now()
  return {
    _id: "test123",
    title: "Hindi Paper I – CIA",
    subject: "HINDI",
    course: "B.A",
    session: "2024-28",
    semester: 3,
    duration: 30,
    totalMarks: 50,
    startTime: new Date(now - 10 * 60 * 1000).toISOString(), // started 10 min ago
    endTime: new Date(now + 20 * 60 * 1000).toISOString(),   // ends 20 min from now
    ...overrides,
  }
}
