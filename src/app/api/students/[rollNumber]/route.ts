import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Student from "@/models/Student"
import StudentAttempt from "@/models/StudentAttempt"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ rollNumber: string }> }
) {
  await connectDB()
  const { rollNumber } = await params

  // Check admission register first — returns name + course + session
  const student = await Student.findOne({ rollNumber }).select("name course session").lean()
  if (student) {
    const s = student as { name: string; course: string; session: string }
    return NextResponse.json({ name: s.name, course: s.course, session: s.session })
  }

  // Fall back to previous attempt records (name only — course/session unknown)
  const attempt = await StudentAttempt.findOne({ rollNumber })
    .sort({ submittedAt: -1 })
    .select("studentName")
    .lean()

  if (!attempt) return NextResponse.json({ name: null })

  return NextResponse.json({ name: (attempt as { studentName: string }).studentName })
}
