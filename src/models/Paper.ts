import mongoose, { Schema, model, Document, models } from "mongoose"

export interface IPaper extends Document {
  name: string
  department: string
  createdAt: Date
}

const PaperSchema = new Schema<IPaper>(
  {
    name:       { type: String, required: true, trim: true },
    department: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

if (process.env.NODE_ENV !== "production") {
  try { mongoose.deleteModel("Paper") } catch {}
}

export default models.Paper ?? model<IPaper>("Paper", PaperSchema)
