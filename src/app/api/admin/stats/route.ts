import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Test from "@/models/Test"
import StudentAttempt from "@/models/StudentAttempt"
import { getAdminFromCookie } from "@/lib/auth"

export async function GET() {
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()

  const testFilter = admin.subject ? { subject: admin.subject } : {}

  const [tests, totalAttempts, recentTests] = await Promise.all([
    Test.find(testFilter).select("questions"),
    admin.subject
      ? StudentAttempt.countDocuments({
          testId: { $in: (await Test.find({ subject: admin.subject }).select("_id")).map((t) => t._id) },
        })
      : StudentAttempt.countDocuments(),
    Test.find(testFilter).sort({ createdAt: -1 }).limit(5).select("title subject course session semester isPublished isResultPublished createdAt"),
  ])

  const totalTests = tests.length
  const totalQuestions = tests.reduce((sum, t) => sum + (t.questions?.length ?? 0), 0)

  return NextResponse.json({ totalQuestions, totalTests, totalAttempts, recentTests })
}
