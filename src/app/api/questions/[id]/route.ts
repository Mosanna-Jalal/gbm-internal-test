import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Question from "@/models/Question"
import { getAdminFromCookie } from "@/lib/auth"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  const q = await Question.findById(id)
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(q)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  const body = await req.json()
  const q = await Question.findByIdAndUpdate(id, body, { new: true })
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(q)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  await Question.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
