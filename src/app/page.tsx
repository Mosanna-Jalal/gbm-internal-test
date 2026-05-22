"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  SESSIONS, COURSES, VALID_COURSES_FOR_SESSION,
  computeSemester, semesterLabel,
  type Session, type Course,
} from "@/lib/constants"

interface Test {
  _id: string
  title: string
  subject: string
  course: string
  session: string
  semester: number
  duration: number
  totalMarks: number
  startTime: string
  endTime: string | null
}

interface StudentInfo {
  name: string
  course?: string
  session?: string
  department?: string | null
}

// ── Test card sections ──────────────────────────────────────────────────────

interface TestSectionsProps {
  tests: Test[]
  studentName: string
  now: number
  getStatus: (t: Test) => "attempted" | "active" | "upcoming" | "missed"
  onStart: (id: string) => void
  onResult: (id: string) => void
}

function formatCountdown(secs: number): string {
  if (secs >= 3600) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return `${h}h ${m}m`
  }
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function TestCard({ test, status, studentName, now, onStart, onResult }: {
  test: Test
  status: "attempted" | "active" | "upcoming" | "missed"
  studentName: string
  now: number
  onStart: (id: string) => void
  onResult: (id: string) => void
}) {
  const start = new Date(test.startTime).getTime()

  const secondsToStart = status === "upcoming" ? Math.ceil((start - now) / 1000) : 0
  const isLastMinute   = status === "upcoming" && secondsToStart <= 60

  return (
    <div className={`bg-white rounded-xl border p-5 shadow-sm transition-colors ${
      status === "missed"    ? "border-red-200 opacity-80"  :
      status === "attempted" ? "border-green-200"           :
      status === "active"    ? "border-[#8b1a1a]/30"        : "border-gray-200"
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 leading-snug">{test.title}</h4>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{test.subject}</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Sem {semesterLabel(test.semester)}</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{test.duration} min</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{test.totalMarks} marks</span>
          </div>
          {status === "upcoming" && (
            <p className={`text-xs mt-2 font-medium ${isLastMinute ? "text-[#8b1a1a] animate-pulse" : "text-amber-700"}`}>
              Opens in <span className="font-mono font-bold">{formatCountdown(secondsToStart)}</span>
              {" · "}{new Date(test.startTime).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          {status === "active" && test.endTime && (
            <p className="text-xs text-[#8b1a1a] mt-2 font-medium">
              Closes {new Date(test.endTime).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          {status === "missed" && test.endTime && (
            <p className="text-xs text-red-400 mt-2">
              Closed {new Date(test.endTime).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          {status === "attempted" && (
            <button
              onClick={() => onResult(test._id)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              View Result
            </button>
          )}
          {status === "active" && (
            <button
              onClick={() => onStart(test._id)}
              disabled={!studentName.trim()}
              className="bg-[#8b1a1a] hover:bg-[#6f1515] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Start Test
            </button>
          )}
          {status === "upcoming" && (
            <div className={`text-center border rounded-lg px-3 py-2 min-w-[72px] ${
              isLastMinute ? "border-amber-400 bg-amber-50" : "border-gray-200"
            }`}>
              <p className={`text-xs font-mono font-bold ${isLastMinute ? "text-[#8b1a1a] animate-pulse" : "text-gray-500"}`}>
                {formatCountdown(secondsToStart)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">until open</p>
            </div>
          )}
          {status === "missed" && (
            <span className="text-xs text-red-400 border border-red-200 px-3 py-2 rounded-lg">
              Not attempted
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

const SECTIONS = [
  {
    key: "active" as const,
    label: "Active Tests",
    icon: "🔴",
    accent: "text-[#8b1a1a]",
    empty: "No tests are live right now. Active tests will appear here the moment they open.",
  },
  {
    key: "attempted" as const,
    label: "Attempted Tests",
    icon: "✅",
    accent: "text-emerald-700",
    empty: "You haven't submitted any tests yet. Once you complete a test, it will appear here along with your result.",
  },
  {
    key: "upcoming" as const,
    label: "Upcoming Tests",
    icon: "📅",
    accent: "text-amber-700",
    empty: "No tests are scheduled for you at the moment. Your teacher will notify you when new tests are added.",
  },
  {
    key: "missed" as const,
    label: "Missed Tests",
    icon: "⏰",
    accent: "text-red-500",
    empty: "Great — you haven't missed any tests. Keep it up!",
  },
]

function TestSections({ tests, studentName, now, getStatus, onStart, onResult }: TestSectionsProps) {
  const grouped = {
    active:    tests.filter((t) => getStatus(t) === "active"),
    upcoming:  tests.filter((t) => getStatus(t) === "upcoming"),
    attempted: tests.filter((t) => getStatus(t) === "attempted"),
    missed:    tests.filter((t) => getStatus(t) === "missed"),
  }

  return (
    <div className="space-y-6">
      {SECTIONS.map(({ key, label, icon, accent, empty }) => (
        <section key={key}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-base">{icon}</span>
            <h3 className={`text-sm font-semibold ${accent}`}>{label}</h3>
            {grouped[key].length > 0 && (
              <span className="ml-auto text-xs text-gray-400">{grouped[key].length}</span>
            )}
          </div>
          {grouped[key].length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 text-sm text-gray-400 italic">
              {empty}
            </div>
          ) : (
            <div className="space-y-3">
              {grouped[key].map((test) => (
                <TestCard
                  key={test._id}
                  test={test}
                  status={key}
                  studentName={studentName}
                  now={now}
                  onStart={onStart}
                  onResult={onResult}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()

  const [rollNumber, setRollNumber]     = useState("")
  const [studentName, setStudentName]   = useState("")
  const [studentInfo, setStudentInfo]   = useState<StudentInfo | null>(null)
  const [lookingUp, setLookingUp]       = useState(false)

  // Manual fallback (when student not in DB)
  const [manualSession, setManualSession] = useState<Session | "">("")
  const [manualCourse, setManualCourse]   = useState<Course  | "">("")

  const [tests, setTests]         = useState<Test[]>([])
  const [loadingTests, setLoadingTests] = useState(false)
  const [testsLoaded, setTestsLoaded]   = useState(false)
  const [notFound, setNotFound]         = useState(false)
  const [attemptMap, setAttemptMap]     = useState<Record<string, string>>({})
  const [now, setNow]                   = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const availableManualCourses = manualSession
    ? VALID_COURSES_FOR_SESSION[manualSession as Session]
    : COURSES

  async function lookupRoll(roll: string) {
    if (!roll) return
    setLookingUp(true)
    setStudentInfo(null)
    setStudentName("")
    setTests([])
    setTestsLoaded(false)
    setNotFound(false)
    setAttemptMap({})
    try {
      const res  = await fetch(`/api/students/${encodeURIComponent(roll)}`)
      const data = await res.json() as StudentInfo
      if (data.name) {
        setStudentName(data.name)
        setStudentInfo(data)
        setLookingUp(false)           // release button immediately after student is found
        if (data.course && data.session) {
          loadTests(data.course, data.session, roll)   // has its own loadingTests state
        }
      } else {
        setNotFound(true)
      }
    } catch {
      setNotFound(true)
    } finally {
      setLookingUp(false)
    }
  }

  async function loadTests(course: string, session: string, roll?: string) {
    setLoadingTests(true)
    setTestsLoaded(true)
    try {
      const sem = computeSemester(session as Session)
      const rollToUse = roll ?? rollNumber.trim()
      const p = new URLSearchParams({
        course, session,
        ...(sem ? { semester: String(sem) } : {}),
        ...(rollToUse ? { roll: rollToUse } : {}),
      })
      const [testsRes, attemptsRes] = await Promise.all([
        fetch(`/api/tests?${p}`),
        rollToUse ? fetch(`/api/attempts?rollNumber=${encodeURIComponent(rollToUse)}`) : Promise.resolve(null),
      ])
      // Parse both before setting state so tests and attemptMap update in the same render
      const [testsData, attemptsData] = await Promise.all([
        testsRes.json(),
        attemptsRes?.ok ? attemptsRes.json() : Promise.resolve(null),
      ])
      const map: Record<string, string> = {}
      if (attemptsData) {
        // API returns { attemptId, testId } for public and { _id, testId } when admin cookie is present
        ;(attemptsData as { testId: string; attemptId?: string; _id?: string }[])
          .forEach((a) => {
            const aid = a.attemptId ?? a._id
            if (aid) map[a.testId] = aid
          })
      }
      setTests(testsData)
      setAttemptMap(map)
    } catch { setTests([]) }
    finally { setLoadingTests(false) }
  }

  type TestStatus = "attempted" | "active" | "upcoming" | "missed"
  function getStatus(test: Test): TestStatus {
    if (attemptMap[test._id]) return "attempted"
    const start = new Date(test.startTime).getTime()
    const end = test.endTime ? new Date(test.endTime).getTime() : null
    if (start > now) return "upcoming"
    if (end && end < now) return "missed"
    return "active"
  }

  function handleManualSearch(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!manualSession || !manualCourse) return
    loadTests(manualCourse, manualSession, rollNumber.trim())
  }

  const activeCourse  = studentInfo?.course  || manualCourse
  const activeSession = studentInfo?.session || manualSession
  const semester      = activeSession ? computeSemester(activeSession as Session) : null

  function startTest(testId: string) {
    const p = new URLSearchParams({
      roll:     rollNumber.trim(),
      name:     studentName.trim(),
      course:   activeCourse,
      session:  activeSession,
      semester: String(semester ?? 1),
    })
    router.push(`/test/${testId}?${p}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-5 text-center">
          <p className="text-xs tracking-widest uppercase text-blue-200 mb-1">
            Gautam Buddha Mahila College, Gaya
          </p>
          <h1 className="text-2xl font-bold">Online MCQ Test Portal</h1>
          <p className="text-blue-300 text-sm mt-1">Internal Assessment — CIA Examination</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Roll number card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Enter Your Roll Number</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Roll Number</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => {
                    setRollNumber(e.target.value)
                    setStudentInfo(null)
                    setStudentName("")
                    setTests([])
                    setTestsLoaded(false)
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") lookupRoll(rollNumber.trim()) }}
                  placeholder="e.g. 25291040005"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                />
                <button
                  onClick={() => lookupRoll(rollNumber.trim())}
                  disabled={lookingUp || !rollNumber.trim()}
                  className="bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
                >
                  {lookingUp ? "..." : "Search"}
                </button>
              </div>
            </div>

            {/* Student info — auto-detected */}
            {studentInfo?.name && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 text-sm">✓</span>
                  <span className="text-sm font-semibold text-green-900">{studentInfo.name}</span>
                </div>
                {studentInfo.course && studentInfo.session && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-green-700">
                    <span>Course: <strong>{studentInfo.course}</strong></span>
                    <span>Session: <strong>{studentInfo.session}</strong></span>
                    {semester && <span>Semester: <strong>Sem {semesterLabel(semester)}</strong></span>}
                    {studentInfo.department && (
                      <span>Department: <strong>{studentInfo.department}</strong></span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Name override (if student not in DB but found in attempts) */}
            {studentInfo && !studentInfo.course && (
              <div>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  Your details were not found in the admission register. Please select your session and course below.
                </p>
                <form onSubmit={handleManualSearch} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Session</label>
                      <select value={manualSession} onChange={(e) => { setManualSession(e.target.value as Session); setManualCourse("") }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" required>
                        <option value="">Select</option>
                        {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
                      <select value={manualCourse} onChange={(e) => setManualCourse(e.target.value as Course)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" required disabled={!manualSession}>
                        <option value="">Select</option>
                        {availableManualCourses.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-[#1e3a5f] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#162d4a]">
                    Find Tests
                  </button>
                </form>
              </div>
            )}

            {/* Not found after explicit search */}
            {notFound && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Roll number not found. Please check and try again, or contact your teacher.
              </p>
            )}
          </div>
        </div>

        {/* Tests */}
        {testsLoaded && (
          <div>
            {loadingTests ? (
              <div className="text-center py-8 text-gray-400">Loading tests...</div>
            ) : (
              <TestSections
                tests={tests}
                studentName={studentName}
                now={now}
                getStatus={getStatus}
                onStart={startTest}
                onResult={(id) => router.push(`/result/${attemptMap[id]}?roll=${encodeURIComponent(rollNumber.trim())}`)}
              />
            )}
          </div>
        )}
      </main>

      <footer className="mt-12 py-4 text-center text-xs text-gray-400 border-t">
        Gautam Buddha Mahila College, Gaya &mdash; Internal Test System &nbsp;|&nbsp;
        <a href="/admin/login" className="hover:text-gray-600">Admin</a>
      </footer>
    </div>
  )
}
