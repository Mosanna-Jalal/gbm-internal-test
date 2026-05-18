import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Test from "@/models/Test"
import StudentAttempt from "@/models/StudentAttempt"
import { getAdminFromCookie } from "@/lib/auth"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  await connectDB()
  const { testId } = await params
  const admin = await getAdminFromCookie()

  if (!admin) {
    // Public access only when results are published
    const test = await Test.findById(testId).select("isResultPublished")
    if (!test?.isResultPublished) {
      return NextResponse.json({ error: "Results not yet published" }, { status: 403 })
    }
    const attempts = await StudentAttempt.find({ testId })
      .select("studentName rollNumber score maxScore percentage rank timeTaken submittedAt")
      .sort({ rank: 1, timeTaken: 1 })
    return NextResponse.json(attempts)
  }

  // Subject admin: verify this test belongs to their subject
  if (admin.subject) {
    const test = await Test.findById(testId).select("subject")
    if (!test || test.subject !== admin.subject) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
  }

  const attempts = await StudentAttempt.find({ testId }).sort({ rank: 1, timeTaken: 1 })
  return NextResponse.json(attempts)
}
