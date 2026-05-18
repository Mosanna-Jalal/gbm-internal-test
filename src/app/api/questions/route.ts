import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Question from "@/models/Question"
import { getAdminFromCookie } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { searchParams } = new URL(req.url)
  const filter: Record<string, unknown> = {}

  for (const key of ["subject", "course", "session", "difficulty"]) {
    const val = searchParams.get(key)
    if (val) filter[key] = val
  }
  const sem = searchParams.get("semester")
  if (sem) filter.semester = parseInt(sem)

  const questions = await Question.find(filter).sort({ createdAt: -1 }).limit(200)
  return NextResponse.json(questions)
}

export async function POST(req: NextRequest) {
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const body = await req.json()
  const isArray = Array.isArray(body)
  const items = isArray ? body : [body]

  const created = await Question.insertMany(
    items.map((q: Record<string, unknown>) => ({ ...q, createdBy: admin.name }))
  )

  return NextResponse.json(isArray ? created : created[0], { status: 201 })
}
