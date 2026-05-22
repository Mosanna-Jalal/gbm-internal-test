import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Test from "@/models/Test"
import { getAdminFromCookie } from "@/lib/auth"

export async function GET(req: NextRequest) {
  await connectDB()
  const admin = await getAdminFromCookie()
  const { searchParams } = req.nextUrl
  const filter: Record<string, unknown> = {}

  if (!admin) {
    filter.isPublished = true
    if (!searchParams.get("roll")) {
      filter.startTime = { $lte: new Date() }
      filter.$or = [{ endTime: null }, { endTime: { $gte: new Date() } }]
    }
  }

  // Apply client query params (course, session, semester)
  for (const key of ["course", "session"]) {
    const val = searchParams.get(key)
    if (val) filter[key] = val
  }
  const sem = searchParams.get("semester")
  if (sem) filter.semester = parseInt(sem)

  // Subject filter: dept admin always sees only their own subject; master/public use client param
  if (admin?.role === "subject" && admin.subject) {
    filter.subject = admin.subject
  } else {
    const subjectParam = searchParams.get("subject")
    if (subjectParam) filter.subject = subjectParam
  }

  const tests = await Test.find(filter).sort({ startTime: -1 }).limit(100)
  return NextResponse.json(tests)
}

export async function POST(req: NextRequest) {
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const body = await req.json()

  const questions = body.questions ?? []
  const totalMarks = questions.reduce((s: number, q: { marks: number }) => s + (q.marks ?? 1), 0)

  const createdBy = (body.createdBy as string | undefined)?.trim() || admin.name
  const test = await Test.create({ ...body, totalMarks, createdBy })
  return NextResponse.json(test, { status: 201 })
}
