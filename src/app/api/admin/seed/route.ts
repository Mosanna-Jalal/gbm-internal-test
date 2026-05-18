import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/mongodb"
import Admin from "@/models/Admin"
import { getAdminFromCookie } from "@/lib/auth"

// Pre-generated passwords — no recognisable pattern, mixed case alphanumeric
export const SUBJECT_ACCOUNTS = [
  { subject: "ACCOUNTS",         username: "accounts",    password: "n7Xw2mPq4R" },
  { subject: "ECONOMICS",        username: "economics",   password: "Lp5vK8nT3z" },
  { subject: "ENGLISH",          username: "english",     password: "Jh4mW9sY6q" },
  { subject: "HINDI",            username: "hindi",       password: "Rx2pN7cB5k" },
  { subject: "HISTORY",          username: "history",     password: "Tw8vL3nZ6j" },
  { subject: "HOME SCIENCE",     username: "homescience", password: "Qp4mK9xB2n" },
  { subject: "MUSIC",            username: "music",       password: "Gx5nR8kT2p" },
  { subject: "PHILOSOPHY",       username: "philosophy",  password: "Yk7cW4nP8m" },
  { subject: "POLITICAL SCIENCE",username: "polscience",  password: "Rn3xT6mB9p" },
  { subject: "PSYCHOLOGY",       username: "psychology",  password: "Zk5nM8pX2w" },
  { subject: "SANSKRIT",         username: "sanskrit",    password: "Lm9vR4cT7n" },
  { subject: "URDU",             username: "urdu",        password: "Pw6kN3mX8j" },
  { subject: "BOTANY",           username: "botany",      password: "Xm4vZ9pT2k" },
  { subject: "CHEMISTRY",        username: "chemistry",   password: "Bn7wK5mR3p" },
  { subject: "MATHEMATICS",      username: "mathematics", password: "Tz8nL4xV6m" },
  { subject: "PHYSICS",          username: "physics",     password: "Kp3mB9nW7x" },
  { subject: "ZOOLOGY",          username: "zoology",     password: "Mn6xT4pZ8k" },
  { subject: "LIBRARY SCIENCE",  username: "libscience",  password: "Vk9mP3nB5w" },
]

const MASTER = { username: "masteradmin", password: "KingwithacapitalK", name: "Master Admin" }

// GET — returns credential table (master admin only)
export async function GET() {
  const admin = await getAdminFromCookie()
  if (!admin || admin.role !== "master") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ master: { username: MASTER.username, password: MASTER.password }, subjects: SUBJECT_ACCOUNTS })
}

// POST — creates / re-seeds all accounts (callable without auth for first-time setup)
export async function POST() {
  await connectDB()

  // Allow only if no admin exists yet, OR if master admin is calling
  const existingMaster = await Admin.findOne({ username: "masteradmin" })
  if (existingMaster) {
    const caller = await getAdminFromCookie()
    if (!caller || caller.role !== "master") {
      return NextResponse.json({ error: "Already seeded. Log in as masteradmin to re-seed." }, { status: 403 })
    }
  }

  // Drop the old email_1 unique index if it still exists from the previous schema
  try { await Admin.collection.dropIndex("email_1") } catch {}

  const results: { username: string; created: boolean }[] = []

  // Master admin
  const masterHash = await bcrypt.hash(MASTER.password, 10)
  await Admin.findOneAndUpdate(
    { username: MASTER.username },
    {
      $set:         { name: MASTER.name, password: masterHash, role: "master", subject: null },
      $setOnInsert: { username: MASTER.username },
    },
    { upsert: true, new: true }
  )
  results.push({ username: MASTER.username, created: true })

  // Subject admins
  for (const acc of SUBJECT_ACCOUNTS) {
    const hash = await bcrypt.hash(acc.password, 10)
    await Admin.findOneAndUpdate(
      { username: acc.username },
      {
        $set:         { name: acc.subject, password: hash, role: "subject", subject: acc.subject },
        $setOnInsert: { username: acc.username },
      },
      { upsert: true, new: true }
    )
    results.push({ username: acc.username, created: true })
  }

  return NextResponse.json({ success: true, seeded: results.length, accounts: results })
}
