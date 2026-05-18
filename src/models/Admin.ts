import { Schema, model, Document, models } from "mongoose"

export interface IAdmin extends Document {
  username: string
  name: string
  password: string
  role: "master" | "subject"
  subject: string | null
  createdAt: Date
}

const AdminSchema = new Schema<IAdmin>(
  {
    username: { type: String, required: true, unique: true, lowercase: true },
    name:     { type: String, required: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ["master", "subject"], default: "master" },
    subject:  { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

if (process.env.NODE_ENV !== "production") {
  try { mongoose.deleteModel("Admin") } catch {}
}

export default models.Admin ?? model<IAdmin>("Admin", AdminSchema)
