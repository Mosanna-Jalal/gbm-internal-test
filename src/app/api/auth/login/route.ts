import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/mongodb"
import Admin from "@/models/Admin"
import { signToken } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 })
  }

  await connectDB()
  const admin = await Admin.findOne({ username: username.toLowerCase() })

  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const token = await signToken({
    id: admin._id.toString(),
    username: admin.username,
    name: admin.name,
    role: admin.role,
    subject: admin.subject ?? null,
  })

  const cookieStore = await cookies()
  cookieStore.set("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  })

  return NextResponse.json({ success: true, name: admin.name, role: admin.role, subject: admin.subject })
}
