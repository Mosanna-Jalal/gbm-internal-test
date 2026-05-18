import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { connectDB } from "@/lib/mongodb"
import Student from "@/models/Student"
import { getAdminFromCookie } from "@/lib/auth"
import { getCourseForDepartment } from "@/lib/constants"

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
  // Name
  "name": "name", "student name": "name", "candidate name": "name",
  // Father's name
  "father name": "fatherName", "father's name": "fatherName", "fathers name": "fatherName",
  "father": "fatherName",
  // Mobile
  "mobile": "mobile", "mobile no": "mobile", "phone": "mobile",
  "contact no": "mobile", "contact": "mobile",
  // Category
  "category": "category", "caste": "category", "caste category": "category",
  // Gender
  "gender": "gender", "sex": "gender",
  // Course / session — detected from filename, but accept overrides
  "course": "course", "program": "course", "programme": "course",
  "session": "session", "batch": "session",
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()
}

interface ParsedStudent {
  rollNumber: string
  name: string
  course: string
  session: string
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
        if (/^\d{11}$/.test(val)) { rollNumber = val; rollIdx = parseInt(mappedRollIdx) }
      }
    }
    // Fallback: scan for any 11-digit number
    if (!rollNumber) {
      rollIdx = row.findIndex((c) => /^\d{11}$/.test(c))
      if (rollIdx >= 0) rollNumber = row[rollIdx]
    }
    if (!rollNumber) continue

    // Build record from all columns
    const record: ParsedStudent = {
      rollNumber,
      name: "",
      course: fileCourse,
      session: fileSession,
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
          (record as Record<string, string>)[field] = val
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
  const errors: string[] = []

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const students = parseBuffer(buffer, file.name)

      for (const s of students) {
        try {
          const existing = await Student.findOne({ rollNumber: s.rollNumber })
          // $set updates all fields BUT never touches StudentAttempt — those are in a
          // separate collection linked only by rollNumber, so they're always preserved.
          const result = await Student.updateOne(
            { rollNumber: s.rollNumber },
            { $set: s },
            { upsert: true }
          )
          if (existing) updated++
          else imported++
        } catch {
          // duplicate key or other — skip silently
        }
      }
    } catch (err) {
      errors.push(`${file.name}: ${(err as Error).message}`)
    }
  }

  return NextResponse.json({ success: true, imported, updated, errors })
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
