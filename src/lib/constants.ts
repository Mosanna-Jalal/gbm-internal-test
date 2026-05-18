export const SESSIONS = ["2023-27", "2024-28", "2025-29", "2025-26"] as const
export type Session = (typeof SESSIONS)[number]

export const SESSION_SEMS: Record<Session, number> = {
  "2023-27": 8,
  "2024-28": 8,
  "2025-29": 8,
  "2025-26": 2,
}

export const COURSES = ["B.A", "B.Sc", "B.Com", "BLIS"] as const
export type Course = (typeof COURSES)[number]

export const DEPARTMENTS: Record<Course, string[]> = {
  "B.A": [
    "ECONOMICS", "ENGLISH", "HINDI", "HISTORY", "HOME SCIENCE",
    "MUSIC", "PHILOSOPHY", "POLITICAL SCIENCE", "PSYCHOLOGY", "SANSKRIT", "URDU",
  ],
  "B.Sc": ["BOTANY", "CHEMISTRY", "MATHEMATICS", "PHYSICS", "ZOOLOGY"],
  "B.Com": ["ACCOUNTS"],
  "BLIS": ["LIBRARY SCIENCE"],
}

export function getCourseForDepartment(department: string): Course | null {
  for (const [course, depts] of Object.entries(DEPARTMENTS) as [Course, string[]][]) {
    if (depts.includes(department)) return course
  }
  return null
}

export const VALID_COURSES_FOR_SESSION: Record<Session, Course[]> = {
  "2025-26": ["BLIS"],
  "2023-27": ["B.A", "B.Sc", "B.Com"],
  "2024-28": ["B.A", "B.Sc", "B.Com"],
  "2025-29": ["B.A", "B.Sc", "B.Com"],
}

export function getSessionStartYear(session: Session): number {
  return parseInt(session.split("-")[0])
}

export function computeSemester(session: Session, date: Date = new Date()): number | null {
  const calendarMonth = date.getMonth() + 1
  const calendarYear = date.getFullYear()
  const sessionStartYear = getSessionStartYear(session)
  const academicYear = calendarMonth >= 6 ? calendarYear : calendarYear - 1
  const yearIndex = academicYear - sessionStartYear
  if (yearIndex < 0) return null
  const semester = 2 * yearIndex + (calendarMonth >= 6 ? 1 : 2)
  const cap = SESSION_SEMS[session]
  if (semester < 1 || semester > cap) return null
  return semester
}

export const SEMESTER_LABELS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]

export function semesterLabel(n: number): string {
  return SEMESTER_LABELS[n - 1] ?? String(n)
}

export function getGrade(percentage: number): string {
  if (percentage >= 85) return "Distinction"
  if (percentage >= 60) return "First Division"
  if (percentage >= 50) return "Second Division"
  if (percentage >= 40) return "Third Division"
  return "Fail"
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case "Distinction": return "text-purple-700"
    case "First Division": return "text-green-700"
    case "Second Division": return "text-blue-700"
    case "Third Division": return "text-yellow-700"
    default: return "text-red-700"
  }
}
