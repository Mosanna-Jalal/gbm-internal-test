import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Test, { IEmbeddedQuestion } from "@/models/Test"
import StudentAttempt from "@/models/StudentAttempt"
import { seededShuffle } from "@/lib/shuffle"
import { getAdminFromCookie } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const rollNumber = req.nextUrl.searchParams.get("rollNumber")
  if (!rollNumber) return NextResponse.json({ error: "rollNumber required" }, { status: 400 })

  await connectDB()
  const admin = await getAdminFromCookie()

  if (admin) {
    const attempts = await StudentAttempt.find({ rollNumber }).sort({ submittedAt: -1 }).lean()
    const testIds = [...new Set(attempts.map((a) => String(a.testId)))]
    const tests = await Test.find({ _id: { $in: testIds } }).select("title subject paper semester").lean()
    const testMap = Object.fromEntries(tests.map((t) => [String(t._id), t]))
    return NextResponse.json(attempts.map((a) => ({
      _id: String(a._id),
      testId: String(a.testId),
      testTitle: (testMap[String(a.testId)] as { title?: string })?.title ?? "Deleted test",
      testPaper: (testMap[String(a.testId)] as { paper?: string })?.paper ?? "",
      testSemester: (testMap[String(a.testId)] as { semester?: number })?.semester ?? 0,
      score: a.score, maxScore: a.maxScore, percentage: a.percentage,
      rank: a.rank, timeTaken: a.timeTaken, submittedAt: a.submittedAt,
    })))
  }

  // Public: minimal mapping only
  const attempts = await StudentAttempt.find({ rollNumber }).select("testId _id").lean()
  return NextResponse.json(
    attempts.map((a) => ({ testId: String(a.testId), attemptId: String(a._id) }))
  )
}

export async function POST(req: NextRequest) {
  await connectDB()

  const { testId, rollNumber, studentName, course, session, semester, answers, timeTaken } =
    await req.json()

  if (!testId || !rollNumber || !studentName)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })

  // Block re-attempt
  const existing = await StudentAttempt.findOne({ testId, rollNumber })
  if (existing)
    return NextResponse.json({ error: "Already attempted", attemptId: existing._id }, { status: 409 })

  const test = await Test.findById(testId)
  if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 })

  const questions = test.questions as IEmbeddedQuestion[]
  let score = 0
  const maxScore = questions.reduce((s, q) => s + q.marks, 0)

  const scoredAnswers = (answers as { questionId: string; chosenShuffledIndex: number | null }[]).map(
    ({ questionId, chosenShuffledIndex }) => {
      const question = questions.find((q) => q._id.toString() === questionId)
      if (!question) return { questionId, chosenIndex: null }

      let originalIndex: number | null = null

      if (chosenShuffledIndex !== null && chosenShuffledIndex !== undefined) {
        const { order } = seededShuffle(question.options, `${testId}-${rollNumber}-${questionId}`)
        originalIndex = order[chosenShuffledIndex]

        if (originalIndex === question.correctIndex) {
          score += question.marks
        } else {
          score -= question.negMarks
        }
      }

      return { questionId, chosenIndex: originalIndex }
    }
  )

  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0

  const attempt = await StudentAttempt.create({
    testId, studentName, rollNumber, course, session, semester,
    answers: scoredAnswers,
    submittedAt: new Date(),
    timeTaken: timeTaken ?? 0,
    score, maxScore, percentage, rank: 0,
  })

  // Recompute ranks for all attempts in this test
  const allAttempts = await StudentAttempt.find({ testId }).sort({ score: -1, timeTaken: 1 })
  let currentRank = 1
  await Promise.all(allAttempts.map((a, i) => {
    if (i > 0 && (
      allAttempts[i].score !== allAttempts[i - 1].score ||
      allAttempts[i].timeTaken !== allAttempts[i - 1].timeTaken
    )) currentRank = i + 1
    return StudentAttempt.findByIdAndUpdate(a._id, { rank: currentRank })
  }))

  const updated = await StudentAttempt.findById(attempt._id)
  return NextResponse.json({ success: true, attemptId: attempt._id, score, maxScore, percentage, rank: updated?.rank ?? 1 })
}
