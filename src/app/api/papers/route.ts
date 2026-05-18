import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Paper from "@/models/Paper"
import { getAdminFromCookie } from "@/lib/auth"

export async function GET(req: NextRequest) {
  await connectDB()
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dept = req.nextUrl.searchParams.get("department")
  const filter: Record<string, string> = {}

  if (admin.subject) {
    filter.department = admin.subject
  } else if (dept) {
    filter.department = dept
  }

  const papers = await Paper.find(filter).sort({ name: 1 })
  return NextResponse.json(papers)
}

export async function POST(req: NextRequest) {
  await connectDB()
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!admin.subject) return NextResponse.json({ error: "Only department admins can add papers" }, { status: 403 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Paper name is required" }, { status: 400 })

  const paper = await Paper.create({ name: name.trim(), department: admin.subject })
  return NextResponse.json(paper, { status: 201 })
}
