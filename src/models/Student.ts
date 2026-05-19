import mongoose, { Schema, model, Document, models } from "mongoose"

export interface IStudent extends Document {
  rollNumber: string
  name: string
  course: string
  session: string
  department: string
  fatherName: string
  mobile: string
  category: string
  gender: string
  extras: Map<string, string>
}

const StudentSchema = new Schema<IStudent>(
  {
    rollNumber: { type: String, required: true, unique: true },
    name:       { type: String, required: true },
    course:     { type: String, required: true },
    session:    { type: String, required: true },
    department: { type: String, default: "" },
    fatherName: { type: String, default: "" },
    mobile:     { type: String, default: "" },
    category:   { type: String, default: "" },
    gender:     { type: String, default: "" },
    extras:     { type: Map, of: String, default: {} },
  },
  { timestamps: false }
)

if (process.env.NODE_ENV !== "production") {
  try { mongoose.deleteModel("Student") } catch {}
}

export default models.Student ?? model<IStudent>("Student", StudentSchema)
