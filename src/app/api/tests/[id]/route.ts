import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Test, { IEmbeddedQuestion } from "@/models/Test"
import { getAdminFromCookie } from "@/lib/auth"
import { seededShuffle } from "@/lib/shuffle"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB()
  const { id } = await params
  const test = await Test.findById(id)
  if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const roll = req.nextUrl.searchParams.get("roll")
  const admin = await getAdminFromCookie()

  // Admin without roll param → full unshuffled doc (for admin panel)
  // If roll is present → always serve shuffled student view, even for admins
  if (admin && !roll) return NextResponse.json(test)

  // Student: enforce visibility rules
  if (!test.isPublished)
    return NextResponse.json({ error: "Test not available" }, { status: 403 })
  const now = new Date()
  if (test.startTime > now)
    return NextResponse.json({ error: "Test has not started yet" }, { status: 403 })
  if (test.endTime && test.endTime < now)
    return NextResponse.json({ error: "Test has ended" }, { status: 403 })

  const effectiveRoll = roll ?? "anon"

  // Shuffle questions
  const { shuffled: shuffledQuestions } = seededShuffle(
    test.questions as IEmbeddedQuestion[],
    `${id}-${effectiveRoll}`
  )

  // Shuffle options, strip correct answer
  const questions = shuffledQuestions.map((q: IEmbeddedQuestion) => {
    const qid = q._id.toHexString()
    const { shuffled: shuffledOptions } = seededShuffle(q.options, `${id}-${effectiveRoll}-${qid}`)
    return { _id: qid, text: q.text, options: shuffledOptions, marks: q.marks }
  })

  return NextResponse.json({
    _id: id,
    title: test.title,
    subject: test.subject,
    course: test.course,
    session: test.session,
    semester: test.semester,
    duration: test.duration,
    totalMarks: test.totalMarks,
    startTime: test.startTime,
    endTime: test.endTime,
    questions,
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params

  if (admin.subject) {
    const existing = await Test.findById(id).select("subject")
    if (!existing || existing.subject !== admin.subject)
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  const body = await req.json()
  const test = await Test.findByIdAndUpdate(id, body, { new: true })
  if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(test)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params

  if (admin.subject) {
    const existing = await Test.findById(id).select("subject")
    if (!existing || existing.subject !== admin.subject)
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  await Test.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
