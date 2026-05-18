import mongoose, { Schema, model, Document, models } from "mongoose"

export interface IAnswer {
  questionId: mongoose.Types.ObjectId
  chosenIndex: 0 | 1 | 2 | 3 | null
}

export interface IStudentAttempt extends Document {
  testId: mongoose.Types.ObjectId
  studentName: string
  rollNumber: string
  course: string
  session: string
  semester: number
  answers: IAnswer[]
  submittedAt: Date
  timeTaken: number
  score: number
  maxScore: number
  percentage: number
  rank: number
}

const AnswerSchema = new Schema<IAnswer>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    chosenIndex: { type: Number, default: null },
  },
  { _id: false }
)

const StudentAttemptSchema = new Schema<IStudentAttempt>(
  {
    testId: { type: Schema.Types.ObjectId, ref: "Test", required: true },
    studentName: { type: String, required: true },
    rollNumber: { type: String, required: true },
    course: { type: String, required: true },
    session: { type: String, required: true },
    semester: { type: Number, required: true },
    answers: [AnswerSchema],
    submittedAt: { type: Date },
    timeTaken: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    rank: { type: Number, default: 0 },
  },
  { timestamps: false }
)

StudentAttemptSchema.index({ testId: 1, rollNumber: 1 }, { unique: true })

export default models.StudentAttempt ?? model<IStudentAttempt>("StudentAttempt", StudentAttemptSchema)
