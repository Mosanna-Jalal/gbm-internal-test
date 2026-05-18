"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  SESSIONS, COURSES, DEPARTMENTS, VALID_COURSES_FOR_SESSION, SESSION_SEMS,
  computeSemester, semesterLabel,
  type Session, type Course,
} from "@/lib/constants"

const OPTION_LABELS = ["A", "B", "C", "D"]
const LS_KEY = "q_context"

function readContext() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") } catch { return {} }
}
function saveContext(ctx: Record<string, string>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(ctx)) } catch {}
}

export default function NewQuestionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const paramSession  = (searchParams.get("session")  ?? "") as Session | ""
  const paramCourse   = (searchParams.get("course")   ?? "") as Course  | ""
  const paramSemester = searchParams.get("semester") ?? ""
  const paramSubject  = searchParams.get("subject")  ?? ""

  const [session,  setSession]  = useState<Session | "">(paramSession)
  const [course,   setCourse]   = useState<Course  | "">(paramCourse)
  const [semester, setSemester] = useState(paramSemester)
  const [subject,  setSubject]  = useState(paramSubject)

  const [text, setText]           = useState("")
  const [options, setOptions]     = useState(["", "", "", ""])
  const [correctIndex, setCorrectIndex] = useState<number | "">("")
  const [marks, setMarks]         = useState("1")
  const [negMarks, setNegMarks]   = useState("0")
  const [difficulty, setDifficulty] = useState("medium")
  const [saving, setSaving]       = useState(false)
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState("")

  // Load from localStorage on mount (only if URL params didn't supply values)
  useEffect(() => {
    const ctx = readContext()
    if (!paramSession  && ctx.session)  setSession(ctx.session  as Session)
    if (!paramCourse   && ctx.course)   setCourse(ctx.course    as Course)
    if (!paramSemester && ctx.semester) setSemester(ctx.semester as string)
    if (!paramSubject  && ctx.subject)  setSubject(ctx.subject  as string)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist to localStorage whenever context changes
  useEffect(() => {
    if (!session && !course && !semester && !subject) return
    saveContext({ session, course, semester, subject })
  }, [session, course, semester, subject])

  const availableCourses  = session ? VALID_COURSES_FOR_SESSION[session as Session] : COURSES
  const availableSubjects = course  ? DEPARTMENTS[course as Course] : []
  const maxSem            = session ? SESSION_SEMS[session as Session] : 8

  const handleOption = (i: number, val: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)))

  async function handleSave(addAnother = false) {
    if (!session || !course || !semester || !subject || !text || options.some((o) => !o.trim()) || correctIndex === "") {
      setError("Please fill in all required fields")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session, course, semester: parseInt(semester), subject,
          text, options, correctIndex: parseInt(String(correctIndex)),
          marks: parseFloat(marks), negMarks: parseFloat(negMarks), difficulty,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save"); return }

      if (addAnother) {
        setText(""); setOptions(["", "", "", ""]); setCorrectIndex("")
        setSuccess(true)
        setTimeout(() => setSuccess(false), 2000)
      } else {
        router.push("/admin/questions")
      }
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  // Batch context is locked when session + course + semester are all known
  const batchSet = !!(session && course && semester)

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
        <h1 className="text-2xl font-bold text-gray-900">Add Question</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">

        {/* Batch context — locked panel when session/course/semester are known */}
        {batchSet ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Batch</p>
              <button
                type="button"
                onClick={() => { setSession(""); setCourse(""); setSemester(""); setSubject(""); saveContext({}) }}
                className="text-xs text-blue-400 hover:text-blue-700"
              >
                Change
              </button>
            </div>
            <div className="flex flex-wrap gap-5">
              <div><span className="text-xs text-blue-400">Course</span><p className="text-sm font-semibold text-blue-900">{course}</p></div>
              <div><span className="text-xs text-blue-400">Session</span><p className="text-sm font-semibold text-blue-900">{session}</p></div>
              <div><span className="text-xs text-blue-400">Semester</span><p className="text-sm font-semibold text-blue-900">Sem {semesterLabel(parseInt(semester))}</p></div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session *</label>
              <select value={session}
                onChange={(e) => {
                  const val = e.target.value as Session
                  setSession(val); setCourse(""); setSubject("")
                  const sem = val ? computeSemester(val) : null
                  setSemester(sem ? String(sem) : "")
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                <option value="">Select</option>
                {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course *</label>
              <select value={course}
                onChange={(e) => { setCourse(e.target.value as Course); setSubject("") }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                <option value="">Select</option>
                {availableCourses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester *</label>
              <select value={semester} onChange={(e) => setSemester(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                <option value="">Select</option>
                {Array.from({ length: maxSem }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>Sem {semesterLabel(n)}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Subject — always a dropdown (question-specific) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              disabled={!course}>
              <option value="">Select</option>
              {availableSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Question */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Question Text *</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
            placeholder="Type the question here..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] resize-none" />
        </div>

        {/* Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Options * <span className="font-normal text-gray-400">(click a letter to mark correct)</span>
          </label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-3">
                <button type="button" onClick={() => setCorrectIndex(i)}
                  className={`shrink-0 w-7 h-7 rounded-full border-2 text-xs font-bold transition-colors ${
                    correctIndex === i ? "bg-green-600 border-green-600 text-white" : "border-gray-300 text-gray-500 hover:border-green-500"
                  }`}>
                  {OPTION_LABELS[i]}
                </button>
                <input type="text" value={opt} onChange={(e) => handleOption(i, e.target.value)}
                  placeholder={`Option ${OPTION_LABELS[i]}`}
                  className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] ${
                    correctIndex === i ? "border-green-400 bg-green-50" : "border-gray-300"
                  }`} />
              </div>
            ))}
          </div>
          {correctIndex !== "" && (
            <p className="text-xs text-green-700 mt-1.5">✓ Option {OPTION_LABELS[correctIndex as number]} marked as correct</p>
          )}
        </div>

        {/* Marks & Difficulty */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
            <input type="number" min="0.5" step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Neg. Marks</label>
            <input type="number" min="0" step="0.25" value={negMarks} onChange={(e) => setNegMarks(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        {error   && <p className="text-sm text-red-600   bg-red-50   px-3 py-2 rounded-lg">{error}</p>}
        {success && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">Question saved! Add another below.</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={() => handleSave(false)} disabled={saving}
            className="flex-1 bg-[#1e3a5f] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#162d4a] disabled:opacity-60">
            {saving ? "Saving..." : "Save & Exit"}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="flex-1 border border-[#1e3a5f] text-[#1e3a5f] py-2.5 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-60">
            Save & Add Another
          </button>
        </div>
      </div>
    </div>
  )
}
