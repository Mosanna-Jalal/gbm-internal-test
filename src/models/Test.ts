import mongoose, { Schema, model, Document, models } from "mongoose"

export interface IEmbeddedQuestion {
  _id: mongoose.Types.ObjectId
  text: string
  options: string[]
  correctIndex: number
  marks: number
  negMarks: number
  difficulty: string
}

export interface ITest extends Document {
  title: string
  subject: string   // department name — used for access control
  paper: string     // specific paper name within the department
  course: string
  session: string
  semester: number
  questions: IEmbeddedQuestion[]
  totalMarks: number
  duration: number
  startTime: Date
  endTime: Date | null
  createdBy: string
  isPublished: boolean
  isResultPublished: boolean
  createdAt: Date
}

const EmbeddedQuestionSchema = new Schema<IEmbeddedQuestion>({
  text:         { type: String, required: true },
  options:      [{ type: String, required: true }],
  correctIndex: { type: Number, required: true },
  marks:        { type: Number, required: true, default: 1 },
  negMarks:     { type: Number, required: true, default: 0 },
  difficulty:   { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
}, { _id: true })

const TestSchema = new Schema<ITest>(
  {
    title:             { type: String, required: true },
    subject:           { type: String, required: true },
    paper:             { type: String, required: true },
    course:            { type: String, required: true },
    session:           { type: String, required: true },
    semester:          { type: Number, required: true },
    questions:         [EmbeddedQuestionSchema],
    totalMarks:        { type: Number, required: true },
    duration:          { type: Number, required: true },
    startTime:         { type: Date,   required: true },
    endTime:           { type: Date,   default: null },
    createdBy:         { type: String, required: true },
    isPublished:       { type: Boolean, default: false },
    isResultPublished: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

TestSchema.index({ subject: 1, paper: 1, session: 1, semester: 1 })

if (process.env.NODE_ENV !== "production") {
  try { mongoose.deleteModel("Test") } catch {}
}

export default models.Test ?? model<ITest>("Test", TestSchema)
