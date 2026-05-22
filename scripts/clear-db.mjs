import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import mongoose from "mongoose"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Parse .env.local manually (no dotenv dependency needed)
const envPath = resolve(__dirname, "../.env.local")
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
}

const uri = process.env.MONGODB_URI
if (!uri) { console.error("MONGODB_URI not found in .env.local"); process.exit(1) }

await mongoose.connect(uri)

const db = mongoose.connection.db
const testsDel    = await db.collection("tests").deleteMany({})
const attemptsDel = await db.collection("studentattempts").deleteMany({})

console.log(`Deleted ${testsDel.deletedCount} test(s)`)
console.log(`Deleted ${attemptsDel.deletedCount} attempt(s)`)

await mongoose.disconnect()
console.log("Done.")
