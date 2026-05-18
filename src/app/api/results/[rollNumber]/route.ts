import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import StudentAttempt from "@/models/StudentAttempt"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ rollNumber: string }> }
) {
  await connectDB()
  const { rollNumber } = await params

  const attempts = await StudentAttempt.find({ rollNumber })
    .populate({ path: "testId", select: "title subject course session semester isResultPublished duration questions" })
    .sort({ submittedAt: -1 })

  return NextResponse.json(attempts)
}
