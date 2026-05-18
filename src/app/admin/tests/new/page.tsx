"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  SESSIONS, COURSES, DEPARTMENTS, VALID_COURSES_FOR_SESSION, SESSION_SEMS,
  computeSemester, semesterLabel, getCourseForDepartment,
  type Session, type Course,
} from "@/lib/constants"

const OPTION_LABELS = ["A", "B", "C", "D"]

const QUICK_TIMES = [
  { label: "9:00 AM",  value: "09:00" },
  { label: "10:00 AM", value: "10:00" },
  { label: "11:00 AM", value: "11:00" },
  { label: "12:00 PM", value: "12:00" },
  { label: "2:00 PM",  value: "14:00" },
  { label: "3:00 PM",  value: "15:00" },
  { label: "4:00 PM",  value: "16:00" },
]

function todayStr()    { return new Date().toISOString().split("T")[0] }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0] }
function nowTimeStr()  { const n = new Date(); return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}` }
function addMinutes(timeStr: string, mins: number): string {
  if (!timeStr) return ""
  const [h, m] = timeStr.split(":").map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60) % 24).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`
}
function formatDate(s: string) {
  if (!s) return ""
  return new Date(s + "T00:00:00").toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short", year:"numeric" })
}

interface InlineQuestion {
  id: string
  text: string
  options: [string, string, string, string]
  correctIndex: number | null
  marks: string
  negMarks: string
  difficulty: string
}

function emptyQ(): InlineQuestion {
  return { id: crypto.randomUUID(), text: "", options: ["","","",""], correctIndex: null, marks: "1", negMarks: "0", difficulty: "medium" }
}

function readCtx() { try { return JSON.parse(localStorage.getItem("q_context") ?? "{}") } catch { return {} } }

function NewTestPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initSession  = (searchParams.get("session")  ?? "") as Session | ""
  const initCourse   = (searchParams.get("course")   ?? "") as Course  | ""
  const initSemester = searchParams.get("semester") ?? ""
  const isPreset = !!(initSession && initCourse && initSemester)

  const [locked, setLocked]         = useState(isPreset)
  const [title, setTitle]           = useState("")
  const [teacherName, setTeacherName] = useState("")
  const [session, setSession]       = useState<Session | "">(initSession)
  const [course, setCourse]         = useState<Course  | "">(initCourse)
  const [semester, setSemester]     = useState(initSemester)
  const [subject, setSubject]       = useState("")
  const [paper, setPaper]           = useState("")
  const [papers, setPapers]         = useState<{ _id: string; name: string }[]>([])
  const [duration, setDuration]     = useState("30")
  const [adminSubject, setAdminSubject] = useState<string | null>(null)

  const [startDate, setStartDate]       = useState("")
  const [startTimeStr, setStartTimeStr] = useState("")
  const [endDate, setEndDate]           = useState("")
  const [endTimeStr, setEndTimeStr]     = useState("")
  const isPublished = true

  // Inline questions
  const [questions, setQuestions] = useState<InlineQuestion[]>([])
  const [currentQ, setCurrentQ]   = useState<InlineQuestion>(emptyQ())
  const [qError, setQError]       = useState("")
  const [showQForm, setShowQForm] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const [toast, setToast]   = useState("")
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(""), 5000)
  }

  const availableCourses  = session ? VALID_COURSES_FOR_SESSION[session as Session] : COURSES
  const availableSubjects = course  ? DEPARTMENTS[course as Course] : []
  const maxSem            = session ? SESSION_SEMS[session as Session] : 8
  const totalMarks        = questions.reduce((s, q) => s + parseFloat(q.marks || "0"), 0)

  // Save draft to sessionStorage on every change
  useEffect(() => {
    try {
      sessionStorage.setItem("gbm_test_draft", JSON.stringify({
        title, teacherName, session, course, semester, subject, paper,
        duration, startDate, startTimeStr, endDate, endTimeStr, questions, locked,
      }))
    } catch {}
  }, [title, teacherName, session, course, semester, subject, paper,
      duration, startDate, startTimeStr, endDate, endTimeStr, questions, locked])

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.subject) {
        setAdminSubject(d.subject)
        setSubject(d.subject)
        const detectedCourse = getCourseForDepartment(d.subject)
        if (detectedCourse) setCourse(detectedCourse)
      }
      // Restore draft (non-locked fields only)
      try {
        const raw = sessionStorage.getItem("gbm_test_draft")
        if (!raw) return
        const draft = JSON.parse(raw)
        if (draft.title)       setTitle(draft.title)
        if (draft.teacherName) setTeacherName(draft.teacherName)
        if (draft.duration)    setDuration(draft.duration)
        if (draft.startDate)   setStartDate(draft.startDate)
        if (draft.startTimeStr) setStartTimeStr(draft.startTimeStr)
        if (draft.endDate)     setEndDate(draft.endDate)
        if (draft.endTimeStr)  setEndTimeStr(draft.endTimeStr)
        if (draft.questions?.length) setQuestions(draft.questions)
        if (!d?.subject) {
          // Only restore batch/dept for master admin
          if (draft.session)  setSession(draft.session)
          if (draft.course)   setCourse(draft.course)
          if (draft.semester) setSemester(draft.semester)
          if (draft.subject)  setSubject(draft.subject)
          if (draft.locked)   setLocked(draft.locked)
        }
        if (draft.paper) setPaper(draft.paper)
      } catch {}
    })

    const ctx = readCtx()
    if (isPreset) {
      if (!subject && ctx.subject) setSubject(ctx.subject)
      return
    }
    if (ctx.session && ctx.course && ctx.semester) {
      setSession(ctx.session as Session)
      setCourse(ctx.course as Course)
      setSemester(ctx.semester)
      if (ctx.subject) setSubject(ctx.subject)
      setLocked(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (subject) {
      fetch(`/api/papers?department=${encodeURIComponent(subject)}`)
        .then((r) => r.ok ? r.json() : []).then(setPapers)
      setPaper("")
    } else {
      setPapers([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject])

  function handleSessionChange(val: Session | "") {
    setSession(val)
    if (!adminSubject) { setCourse(""); setSubject("") }
    const sem = val ? computeSemester(val) : null
    setSemester(sem ? String(sem) : "")
  }
  function handleCourseChange(val: Course | "") {
    setCourse(val)
    if (!adminSubject) setSubject("")
  }

  // Question form helpers
  function setOpt(i: number, val: string) {
    setCurrentQ((q) => { const opts = [...q.options] as [string,string,string,string]; opts[i] = val; return { ...q, options: opts } })
  }

  function addQuestion() {
    setQError("")
    if (!currentQ.text.trim()) { setQError("Question text is required"); return }
    if (currentQ.options.some((o) => !o.trim())) { setQError("All 4 options are required"); return }
    if (currentQ.correctIndex === null) { setQError("Mark the correct answer"); return }
    setQuestions((prev) => [...prev, { ...currentQ }])
    setCurrentQ(emptyQ())
    setShowQForm(false)
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  async function handleCreate() {
    if (!title.trim())          { setError("Please enter a Test Title"); return }
    if (!teacherName.trim())    { setError("Please enter the Teacher Name"); return }
    if (!session)               { setError("Please select a Session"); return }
    if (!course)                { setError("Please select a Course"); return }
    if (!semester)              { setError("Please select a Semester"); return }
    if (!subject)               { setError("Please select a Department"); return }
    if (!paper)                 { setError("Please select a Paper"); return }
    if (!startDate || !startTimeStr) { setError("Please set the Start Date and Time"); return }
    if (questions.length === 0) { setError("Add at least one question"); return }
    setSaving(true); setError("")
    try {
      const startISO = new Date(`${startDate}T${startTimeStr}`).toISOString()
      if (new Date(startISO) <= new Date()) {
        setSaving(false)
        showToast("The start time has already passed. Please select a future date and time.")
        return
      }
      const endISO   = endDate && endTimeStr ? new Date(`${endDate}T${endTimeStr}`).toISOString() : null
      const payload = {
        title, subject, paper, course, session,
        semester: parseInt(semester),
        duration: parseInt(duration),
        startTime: startISO, endTime: endISO, isPublished,
        createdBy: teacherName.trim(),
        questions: questions.map(({ text, options, correctIndex, marks, negMarks, difficulty }) => ({
          text, options, correctIndex, marks: parseFloat(marks), negMarks: parseFloat(negMarks), difficulty,
        })),
      }
      const res = await fetch("/api/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to create test"); return }
      try { sessionStorage.removeItem("gbm_test_draft") } catch {}
      router.push("/admin/tests")
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 max-w-sm w-full">
          <div className="bg-[#1e3a5f] text-white rounded-2xl shadow-2xl border border-blue-400/20 p-4 flex items-start gap-3">
            <div className="text-2xl shrink-0">⏰</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Start Time Already Passed</p>
              <p className="text-xs text-blue-200 mt-0.5 leading-relaxed">{toast}</p>
            </div>
            <button onClick={() => setToast("")} className="text-blue-300 hover:text-white text-xl leading-none shrink-0">×</button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
        <h1 className="text-2xl font-bold text-gray-900">Create Test</h1>
      </div>

      <div className="space-y-6">
        {/* ── Test Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Test Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Title <span className="text-red-500">*</span></label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Accounts CIA-1 2025"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Teacher Name <span className="text-red-500">*</span></label>
              <input type="text" value={teacherName} onChange={(e) => setTeacherName(e.target.value)}
                placeholder="e.g. Dr. Sunita Sharma"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" />
            </div>
          </div>

          {locked ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Batch</p>
                  <button type="button"
                    onClick={() => { setLocked(false); setSession(""); setCourse(""); setSemester(""); setSubject(""); try { localStorage.removeItem("q_context") } catch {} }}
                    className="text-xs text-blue-400 hover:text-blue-700">Change</button>
                </div>
                <div className="flex flex-wrap gap-6">
                  <div><span className="text-xs text-blue-400">Course</span><p className="text-sm font-semibold text-blue-900">{course}</p></div>
                  <div><span className="text-xs text-blue-400">Session</span><p className="text-sm font-semibold text-blue-900">{session}</p></div>
                  <div><span className="text-xs text-blue-400">Semester</span><p className="text-sm font-semibold text-blue-900">Sem {semesterLabel(parseInt(semester))}</p></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
                  {adminSubject ? (
                    <div className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 text-sm font-semibold text-blue-900">
                      {adminSubject}
                    </div>
                  ) : (
                    <select value={subject} onChange={(e) => setSubject(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                      <option value="">Select department</option>
                      {availableSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paper <span className="text-red-500">*</span></label>
                  {papers.length === 0 ? (
                    <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700">
                      No papers added yet.{" "}
                      <a href="/admin/papers" className="underline font-medium">Add papers →</a>
                    </div>
                  ) : (
                    <select value={paper} onChange={(e) => setPaper(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                      <option value="">Select paper</option>
                      {papers.map((p) => <option key={p._id} value={p.name}>{p.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Session <span className="text-red-500">*</span></label>
                <select value={session} onChange={(e) => handleSessionChange(e.target.value as Session)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                  <option value="">Select</option>
                  {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course <span className="text-red-500">*</span></label>
                {adminSubject ? (
                  <div className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 text-sm font-semibold text-blue-900">
                    {course || getCourseForDepartment(adminSubject)}
                  </div>
                ) : (
                  <select value={course} onChange={(e) => handleCourseChange(e.target.value as Course)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                    <option value="">Select</option>
                    {availableCourses.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Semester <span className="text-red-500">*</span></label>
                <select value={semester} onChange={(e) => setSemester(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                  <option value="">Select</option>
                  {Array.from({ length: maxSem }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Sem {semesterLabel(n)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
                {adminSubject ? (
                  <div className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 text-sm font-semibold text-blue-900">
                    {adminSubject}
                  </div>
                ) : (
                  <select
                    value={subject}
                    onChange={(e) => {
                      const val = e.target.value
                      setSubject(val)
                      if (val) {
                        const detected = getCourseForDepartment(val)
                        if (detected) setCourse(detected)
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                  >
                    <option value="">Select</option>
                    {availableSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Paper <span className="text-red-500">*</span></label>
                {!subject ? (
                  <div className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-400">Select a department first</div>
                ) : papers.length === 0 ? (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700">
                    No papers for this department yet.{" "}
                    <a href="/admin/papers" className="underline font-medium">Add papers →</a>
                  </div>
                ) : (
                  <select value={paper} onChange={(e) => setPaper(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                    <option value="">Select paper</option>
                    {papers.map((p) => <option key={p._id} value={p.name}>{p.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes) <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              <input type="number" min="5" max="180" value={duration} onChange={(e) => setDuration(e.target.value)}
                className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" />
              <div className="flex gap-1.5">
                {[15, 20, 30, 45, 60, 90].map((d) => (
                  <button key={d} type="button" onClick={() => setDuration(String(d))}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${duration === String(d) ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "border-gray-200 text-gray-600 hover:border-[#1e3a5f] hover:text-[#1e3a5f] bg-white"}`}>
                    {d}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Schedule ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
          <h2 className="font-semibold text-gray-800">Schedule</h2>

          {/* Start Time */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Start Time <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">📅</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} min={todayStr()}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" />
              </div>
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">🕐</span>
                <input type="time" value={startTimeStr} onChange={(e) => setStartTimeStr(e.target.value)}
                  min={startDate === todayStr() ? nowTimeStr() : undefined}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" />
              </div>
            </div>
            {startDate && <p className="text-xs text-gray-500 pl-1">{formatDate(startDate)}{startTimeStr && ` at ${startTimeStr}`}</p>}
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-gray-400 self-center mr-1">Date:</span>
              {[{ label: "Today", value: todayStr() }, { label: "Tomorrow", value: tomorrowStr() }].map((opt) => (
                <button key={opt.value} type="button" onClick={() => setStartDate(opt.value)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${startDate === opt.value ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "border-gray-200 text-gray-600 hover:border-[#1e3a5f] hover:text-[#1e3a5f] bg-white"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-gray-400 self-center mr-1">Time:</span>
              {QUICK_TIMES.filter((o) => startDate !== todayStr() || o.value > nowTimeStr()).map((opt) => (
                <button key={opt.value} type="button" onClick={() => setStartTimeStr(opt.value)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${startTimeStr === opt.value ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "border-gray-200 text-gray-600 hover:border-[#1e3a5f] hover:text-[#1e3a5f] bg-white"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* End Time */}
          <div className="border-t border-gray-100 pt-4 space-y-2">
            <label className="block text-sm font-medium text-gray-700">End Time <span className="text-xs font-normal text-gray-400">(optional)</span></label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">📅</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate || todayStr()}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" />
              </div>
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">🕐</span>
                <input type="time" value={endTimeStr} onChange={(e) => setEndTimeStr(e.target.value)}
                  min={endDate === startDate && startTimeStr ? addMinutes(startTimeStr, parseInt(duration) || 0) : undefined}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" />
              </div>
            </div>
            {endDate && <p className="text-xs text-gray-500 pl-1">{formatDate(endDate)}{endTimeStr && ` at ${endTimeStr}`}</p>}
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-gray-400 self-center mr-1">Date:</span>
              {[{ label: "Today", value: todayStr() }, { label: "Tomorrow", value: tomorrowStr() }].map((opt) => (
                <button key={opt.value} type="button" onClick={() => setEndDate(opt.value)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${endDate === opt.value ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "border-gray-200 text-gray-600 hover:border-[#1e3a5f] hover:text-[#1e3a5f] bg-white"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-gray-400 self-center mr-1">Time:</span>
              {QUICK_TIMES.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setEndTimeStr(opt.value)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${endTimeStr === opt.value ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "border-gray-200 text-gray-600 hover:border-[#1e3a5f] hover:text-[#1e3a5f] bg-white"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {(endDate || endTimeStr) && (
              <button type="button" onClick={() => { setEndDate(""); setEndTimeStr("") }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors">✕ Clear end time</button>
            )}
          </div>
        </div>

        {/* ── Questions ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Questions
              {questions.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">{questions.length} added · {totalMarks} marks total</span>
              )}
            </h2>
          </div>

          {/* Added questions list */}
          {questions.length > 0 && (
            <div className="space-y-2">
              {questions.map((q, idx) => (
                <div key={q.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-xs text-gray-400 mt-0.5 shrink-0 w-5">{idx + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 line-clamp-2">{q.text}</p>
                    <p className="text-xs text-green-700 mt-0.5">✓ {OPTION_LABELS[q.correctIndex!]}. {q.options[q.correctIndex!]}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-gray-400">{q.difficulty}</span>
                      <span className="text-xs text-gray-400">{q.marks} mark{parseFloat(q.marks) !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeQuestion(q.id)} className="text-xs text-red-400 hover:text-red-600 shrink-0">Remove</button>
                </div>
              ))}
            </div>
          )}

          {/* Add question — button-first */}
          {!showQForm ? (
            <button type="button" onClick={() => { setCurrentQ(emptyQ()); setQError(""); setShowQForm(true) }}
              className="w-full border-2 border-dashed border-[#1e3a5f] text-[#1e3a5f] py-3 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
              + Add Question
            </button>
          ) : (
            <div className="border border-[#1e3a5f] rounded-lg p-4 space-y-3 bg-blue-50/30">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide">
                  New Question #{questions.length + 1}
                </p>
                <button type="button" onClick={() => { setShowQForm(false); setQError("") }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors">✕ Cancel</button>
              </div>

              <textarea value={currentQ.text} onChange={(e) => setCurrentQ({ ...currentQ, text: e.target.value })}
                rows={2} placeholder="Type the question here..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] resize-none bg-white" />

              <div className="space-y-2">
                <p className="text-xs text-gray-500">Options <span className="text-gray-400">(click letter to mark correct)</span></p>
                {currentQ.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button type="button" onClick={() => setCurrentQ({ ...currentQ, correctIndex: i })}
                      className={`shrink-0 w-7 h-7 rounded-full border-2 text-xs font-bold transition-colors ${currentQ.correctIndex === i ? "bg-green-600 border-green-600 text-white" : "border-gray-300 text-gray-500 hover:border-green-500"}`}>
                      {OPTION_LABELS[i]}
                    </button>
                    <input type="text" value={opt} onChange={(e) => setOpt(i, e.target.value)}
                      placeholder={`Option ${OPTION_LABELS[i]}`}
                      className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white ${currentQ.correctIndex === i ? "border-green-400 bg-green-50" : "border-gray-300"}`} />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 flex-wrap">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Marks</label>
                  <input type="number" min="0.5" step="0.5" value={currentQ.marks}
                    onChange={(e) => setCurrentQ({ ...currentQ, marks: e.target.value })}
                    className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Neg. Marks</label>
                  <input type="number" min="0" step="0.25" value={currentQ.negMarks}
                    onChange={(e) => setCurrentQ({ ...currentQ, negMarks: e.target.value })}
                    className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Difficulty</label>
                  <select value={currentQ.difficulty} onChange={(e) => setCurrentQ({ ...currentQ, difficulty: e.target.value })}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              {qError && <p className="text-xs text-red-600">{qError}</p>}

              <button type="button" onClick={addQuestion}
                className="w-full bg-[#1e3a5f] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors">
                ✓ Save Question
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}

        <button onClick={handleCreate} disabled={saving}
          className="w-full bg-[#8b1a1a] hover:bg-[#6f1515] text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-60">
          {saving ? "Creating..." : `Create Test${questions.length > 0 ? ` (${questions.length} questions, ${totalMarks} marks)` : ""}`}
        </button>
      </div>
    </div>
  )
}

export default function NewTestPageWrapper() {
  return <Suspense><NewTestPage /></Suspense>
}
