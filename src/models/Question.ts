import { Schema, model, Document, models } from "mongoose"

export interface IQuestion extends Document {
  subject: string
  course: "B.A" | "B.Sc" | "B.Com" | "BLIS"
  session: string
  semester: number
  text: string
  options: string[]
  correctIndex: 0 | 1 | 2 | 3
  marks: number
  negMarks: number
  difficulty: "easy" | "medium" | "hard"
  createdBy: string
  createdAt: Date
}

const QuestionSchema = new Schema<IQuestion>(
  {
    subject: { type: String, required: true },
    course: { type: String, required: true, enum: ["B.A", "B.Sc", "B.Com", "BLIS"] },
    session: { type: String, required: true },
    semester: { type: Number, required: true, min: 1, max: 8 },
    text: { type: String, required: true },
    options: {
      type: [String],
      required: true,
      validate: (v: string[]) => v.length === 4,
    },
    correctIndex: { type: Number, required: true, enum: [0, 1, 2, 3] },
    marks: { type: Number, default: 1 },
    negMarks: { type: Number, default: 0 },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    createdBy: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export default models.Question ?? model<IQuestion>("Question", QuestionSchema)
