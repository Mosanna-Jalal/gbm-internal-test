import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { connectDB } from "@/lib/mongodb"
import Student from "@/models/Student"
import { getAdminFromCookie } from "@/lib/auth"
import { getCourseForDepartment, DEPARTMENTS } from "@/lib/constants"

// Flat list of all known department names (uppercase) for normalization
const ALL_DEPARTMENTS = Object.values(DEPARTMENTS).flat().map((d) => d.toUpperCase())

const FILE_META: { pattern: RegExp; course: string; session: string }[] = [
  { pattern: /BA/i,   course: "B.A",   session: "2025-29" },
  { pattern: /BCOM/i, course: "B.Com", session: "2025-29" },
  { pattern: /BSC/i,  course: "B.Sc",  session: "2025-29" },
  { pattern: /BLIS/i, course: "BLIS",  session: "2025-26" },
]

function detectMeta(filename: string) {
  for (const m of FILE_META) {
    if (m.pattern.test(filename)) return { course: m.course, session: m.session }
  }
  return { course: "B.A", session: "2025-29" }
}

// Known header aliases → standard field names
const HEADER_MAP: Record<string, string> = {
  // Roll number
  "exam roll": "rollNumber", "exam roll no": "rollNumber", "exam roll number": "rollNumber",
  "roll no": "rollNumber", "roll number": "rollNumber", "rollno": "rollNumber",
  "registration no": "rollNumber", "reg no": "rollNumber",
  "university roll no": "rollNumber", "university roll number": "rollNumber", "university roll": "rollNumber",
  // Name
  "name": "name", "student name": "name", "candidate name": "name",
  // Father's name
  "father name": "fatherName", "father's name": "fatherName", "fathers name": "fatherName",
  "father": "fatherName",
  // Mother's name — stored in extras, no dedicated field
  "mother name": "motherName", "mother's name": "motherName", "mother": "motherName",
  // Mobile
  "mobile": "mobile", "mobile no": "mobile", "phone": "mobile",
  "contact no": "mobile", "contact": "mobile",
  // Category
  "category": "category", "caste": "category", "caste category": "category",
  // Gender
  "gender": "gender", "sex": "gender",
  // Department / subject (honours)
  "department": "department", "dept": "department",
  "subject": "department", "honours subject": "department",
  "hons subject": "department", "hons": "department",
  "honours": "department", "optional subject": "department",
  "subsidiary": "department", "subsidiary subject": "department",
  "paper": "department", "stream": "department",
  "major subject": "department", "major": "department",
  // Course / session — detected from filename, but accept overrides
  "course": "course", "program": "course", "programme": "course",
  "session": "session", "batch": "session",
}

/** Normalize a raw department value to uppercase and match against known departments.
 *  Returns the canonical name if found, otherwise returns the uppercased raw value. */
function normaliseDepartment(raw: string): string {
  const upper = raw.toUpperCase().trim()
  if (ALL_DEPARTMENTS.includes(upper)) return upper
  const partial = ALL_DEPARTMENTS.find((d) => d.startsWith(upper) || upper.startsWith(d))
  return partial ?? upper
}

/**
 * Parse GBMC internal roll format: GBMC/23-27/SEM I/BOT/325
 * Extracts session (23-27 → 2023-27) and department abbreviation (BOT → BOTANY).
 */
function parseGBMCRoll(val: string): { session?: string; department?: string } {
  const match = val.match(/GBMC\/(\d{2})-(\d{2})\/SEM\s+[IVX]+\/([A-Z]+)\//i)
  if (!match) return {}
  const [, yy1, yy2, deptAbbr] = match
  const session = `20${yy1}-${yy2}`
  const department = normaliseDepartment(deptAbbr)
  return { session, department }
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()
}

interface ParsedStudent {
  rollNumber: string
  name: string
  course: string
  session: string
  department: string
  fatherName: string
  mobile: string
  category: string
  gender: string
  extras: Record<string, string>
}

function parseBuffer(buffer: Buffer, filename: string): ParsedStudent[] {
  const wb = XLSX.read(buffer, { type: "buffer" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as string[][]
  const { course: fileCourse, session: fileSession } = detectMeta(filename)

  // Find the header row — first row where ≥3 cells are non-numeric text
  let headerRowIdx = -1
  let colMap: Record<number, string> = {}   // colIndex → standard field or raw header

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r].map((c) => String(c).trim())
    const textCells = row.filter((c) => c && !/^\d+$/.test(c))
    if (textCells.length >= 3) {
      headerRowIdx = r
      row.forEach((cell, idx) => {
        if (!cell) return
        const norm = normaliseHeader(cell)
        const field = HEADER_MAP[norm]
        colMap[idx] = field ?? norm   // use standard name or raw header as key
      })
      break
    }
  }

  const students: ParsedStudent[] = []
  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r].map((c) => String(c).trim())

    // Find roll number: 11-digit numeric cell
    let rollNumber = ""
    let rollIdx = -1

    if (headerRowIdx >= 0) {
      // Look in mapped roll column first
      const mappedRollIdx = Object.entries(colMap).find(([, v]) => v === "rollNumber")?.[0]
      if (mappedRollIdx !== undefined) {
        const val = row[parseInt(mappedRollIdx)] ?? ""
        if (/^\d{10,11}$/.test(val)) { rollNumber = val; rollIdx = parseInt(mappedRollIdx) }
      }
    }
    // Fallback: scan for any 11-digit number
    if (!rollNumber) {
      rollIdx = row.findIndex((c) => /^\d{10,11}$/.test(c))
      if (rollIdx >= 0) rollNumber = row[rollIdx]
    }
    if (!rollNumber) continue

    // Build record from all columns
    const record: ParsedStudent = {
      rollNumber,
      name: "",
      course: fileCourse,
      session: fileSession,
      department: "",
      fatherName: "",
      mobile: "",
      category: "",
      gender: "",
      extras: {},
    }

    if (headerRowIdx >= 0) {
      // Use header map to assign values
      for (const [colIdxStr, field] of Object.entries(colMap)) {
        const val = row[parseInt(colIdxStr)] ?? ""
        if (!val || val === rollNumber) continue
        if (field === "rollNumber") continue
        if (["name","fatherName","mobile","category","gender","course","session"].includes(field)) {
          (record as unknown as Record<string, string>)[field] = val
        } else if (field === "department") {
          record.department = normaliseDepartment(val)
        } else {
          record.extras[field] = val
        }
      }
    } else {
      // No header: fallback — name is next non-numeric non-empty cell after roll
      const nameVal = row[rollIdx + 1] ?? ""
      if (nameVal && !/^\d/.test(nameVal) && nameVal.length >= 2) {
        record.name = nameVal
      }
    }

    // Scan every cell for GBMC internal roll format (e.g. GBMC/23-27/SEM I/BOT/325)
    // This gives us accurate per-student session and department, overriding filename defaults
    for (const cell of row) {
      if (/^GBMC\//i.test(cell)) {
        const meta = parseGBMCRoll(cell)
        if (meta.session) record.session = meta.session
        if (meta.department && !record.department) record.department = meta.department
        break
      }
    }

    // Validate: must have a name
    if (!record.name || record.name.length < 2) continue

    students.push(record)
  }

  return students
}

// POST — accepts uploaded files via FormData
export async function POST(req: NextRequest) {
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()

  const formData = await req.formData()
  const files = formData.getAll("files") as File[]

  if (!files.length) return NextResponse.json({ error: "No files uploaded" }, { status: 400 })

  let imported = 0
  let updated = 0
  let departmentFilled = 0
  const errors: string[] = []

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const students = parseBuffer(buffer, file.name)

      for (const s of students) {
        try {
          const existing = await Student.findOne({ rollNumber: s.rollNumber }).lean()
          if (existing) {
            // Track when an existing student gains a department value they didn't have
            if (s.department && !existing.department) departmentFilled++
            updated++
          } else {
            imported++
          }
          // $set updates all fields BUT never touches StudentAttempt — those are in a
          // separate collection linked only by rollNumber, so they're always preserved.
          // Only overwrite department if the incoming value is non-empty
          const setPayload: Record<string, unknown> = { ...s }
          if (!s.department) delete setPayload.department
          await Student.updateOne(
            { rollNumber: s.rollNumber },
            { $set: setPayload },
            { upsert: true }
          )
        } catch {
          // duplicate key or other — skip silently
        }
      }
    } catch (err) {
      errors.push(`${file.name}: ${(err as Error).message}`)
    }
  }

  return NextResponse.json({ success: true, imported, updated, departmentFilled, errors })
}

// GET — return count + list of students (with optional course/session filter)
export async function GET(req: NextRequest) {
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { searchParams } = req.nextUrl
  const page  = parseInt(searchParams.get("page") ?? "1")
  const limit = 50
  const skip  = (page - 1) * limit

  const filter: Record<string, string> = {}
  const course  = searchParams.get("course")
  const session = searchParams.get("session")
  if (session) filter.session = session

  if (admin.subject) {
    const adminCourse = getCourseForDepartment(admin.subject)
    if (adminCourse) filter.course = adminCourse
  } else if (course) {
    filter.course = course
  }

  const [count, students] = await Promise.all([
    Student.countDocuments(filter),
    Student.find(filter).skip(skip).limit(limit).sort({ name: 1 }).lean(),
  ])

  return NextResponse.json({ count, students, page, pages: Math.ceil(count / limit) })
}

// DELETE — clear all students (master admin only)
export async function DELETE(_req: NextRequest) {
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  await Student.deleteMany({})
  return NextResponse.json({ success: true })
}
