"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  SESSIONS, COURSES, DEPARTMENTS, VALID_COURSES_FOR_SESSION,
  semesterLabel,
  type Session, type Course,
} from "@/lib/constants"

interface Question {
  _id: string
  subject: string
  course: string
  session: string
  semester: number
  text: string
  options: string[]
  correctIndex: number
  marks: number
  negMarks: number
  difficulty: "easy" | "medium" | "hard"
  createdBy: string
  createdAt: string
}

const DIFFICULTY_COLOR = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  hard: "bg-red-100 text-red-700",
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)

  const [filterCourse, setFilterCourse] = useState<Course | "">("")
  const [filterSession, setFilterSession] = useState<Session | "">("")
  const [filterSubject, setFilterSubject] = useState("")
  const [filterSemester, setFilterSemester] = useState("")

  const availableCourses = filterSession
    ? VALID_COURSES_FOR_SESSION[filterSession as Session]
    : COURSES

  const availableSubjects = filterCourse ? DEPARTMENTS[filterCourse as Course] : []

  useEffect(() => {
    setFilterSubject("")
  }, [filterCourse])

  async function fetchQuestions() {
    setLoading(true)
    const p = new URLSearchParams()
    if (filterCourse) p.set("course", filterCourse)
    if (filterSession) p.set("session", filterSession)
    if (filterSubject) p.set("subject", filterSubject)
    if (filterSemester) p.set("semester", filterSemester)

    const res = await fetch(`/api/questions?${p}`)
    const data = await res.json()
    setQuestions(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchQuestions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function deleteQuestion(id: string) {
    if (!confirm("Delete this question?")) return
    await fetch(`/api/questions/${id}`, { method: "DELETE" })
    setQuestions((prev) => prev.filter((q) => q._id !== id))
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Questions</h1>
        <Link
          href="/admin/questions/new"
          className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162d4a]"
        >
          + Add Question
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select
            value={filterSession}
            onChange={(e) => { setFilterSession(e.target.value as Session); setFilterCourse("") }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          >
            <option value="">All Sessions</option>
            {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value as Course)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          >
            <option value="">All Courses</option>
            {availableCourses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            disabled={!filterCourse}
          >
            <option value="">All Subjects</option>
            {availableSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          >
            <option value="">All Semesters</option>
            {[1,2,3,4,5,6,7,8].map((n) => (
              <option key={n} value={n}>Sem {semesterLabel(n)}</option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchQuestions}
          className="mt-3 bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#162d4a]"
        >
          Apply Filters
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : questions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No questions found.{" "}
          <Link href="/admin/questions/new" className="text-[#1e3a5f] underline">Add one</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">
            {questions.length} question{questions.length !== 1 ? "s" : ""}
          </div>
          <div className="divide-y divide-gray-100">
            {questions.map((q) => (
              <div key={q._id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 line-clamp-2">{q.text}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{q.subject}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{q.course}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{q.session}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Sem {semesterLabel(q.semester)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLOR[q.difficulty]}`}>{q.difficulty}</span>
                      {q.marks !== 1 && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{q.marks}M</span>
                      )}
                    </div>
                    <p className="text-xs text-green-700 mt-1">
                      ✓ {q.options[q.correctIndex]}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteQuestion(q._id)}
                    className="shrink-0 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
