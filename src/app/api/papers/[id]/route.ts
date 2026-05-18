import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Paper from "@/models/Paper"
import { getAdminFromCookie } from "@/lib/auth"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB()
  const admin = await getAdminFromCookie()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const paper = await Paper.findById(id)
  if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (admin.subject && paper.department !== admin.subject) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  await paper.deleteOne()
  return NextResponse.json({ success: true })
}
