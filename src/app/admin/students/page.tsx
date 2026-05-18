"use client"

import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  SESSIONS, COURSES, DEPARTMENTS, VALID_COURSES_FOR_SESSION, SESSION_SEMS,
  computeSemester, semesterLabel, getCourseForDepartment,
  getGrade, getGradeColor,
  type Session, type Course,
} from "@/lib/constants"

interface StudentAttemptRow {
  _id: string
  testId: string
  testTitle: string
  testPaper: string
  testSemester: number
  score: number
  maxScore: number
  percentage: number
  rank: number
  timeTaken: number
  submittedAt: string
}

interface Student {
  _id: string
  rollNumber: string
  name: string
  course: string
  session: string
  fatherName?: string
  mobile?: string
  category?: string
  gender?: string
}

interface AdminInfo {
  role: "master" | "subject"
  subject: string | null
}

export default function StudentsPage() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [adminInfo, setAdminInfo]         = useState<AdminInfo | null>(null)
  const [lockedCourse, setLockedCourse]   = useState<Course | "">("")

  // Filter state
  const [filterSession,    setFilterSession]    = useState<Session | "">("")
  const [filterCourse,     setFilterCourse]     = useState<Course | "">("")
  const [filterDepartment, setFilterDepartment] = useState("")
  const [filterSemester,   setFilterSemester]   = useState<number | "">("")

  // Expandable row state
  const [selectedRoll,     setSelectedRoll]     = useState<string | null>(null)
  const [studentAttempts,  setStudentAttempts]  = useState<StudentAttemptRow[]>([])
  const [attemptsLoading,  setAttemptsLoading]  = useState(false)

  // Data state
  const [students,   setStudents]   = useState<Student[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [allCount,   setAllCount]   = useState(0)
  const [page,  setPage]  = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)

  // Upload state
  const [importing,    setImporting]    = useState(false)
  const [importMsg,    setImportMsg]    = useState("")
  const [importError,  setImportError]  = useState("")

  const availableCourses = filterSession
    ? VALID_COURSES_FOR_SESSION[filterSession as Session]
    : COURSES

  const maxSem = filterSession ? SESSION_SEMS[filterSession as Session] : 8

  const autoSemester = filterSession
    ? (computeSemester(filterSession as Session) ?? null)
    : null

  // Semester options for the selected session
  const semesterOptions = filterSession
    ? Array.from({ length: maxSem }, (_, i) => i + 1)
    : []

  // On mount: get admin info, pre-lock course for dept admins
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((d: AdminInfo | null) => {
      if (!d) return
      setAdminInfo(d)
      if (d.subject) {
        const course = getCourseForDepartment(d.subject) as Course | null
        if (course) {
          setLockedCourse(course)
          setFilterCourse(course)
        }
      }
    })
    fetch("/api/admin/import-students")
      .then((r) => r.json())
      .then((d) => setAllCount(d.count ?? 0))
    fetchStudents()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch attempts when a student row is expanded
  useEffect(() => {
    if (!selectedRoll) { setStudentAttempts([]); return }
    setAttemptsLoading(true)
    fetch(`/api/attempts?rollNumber=${encodeURIComponent(selectedRoll)}`)
      .then((r) => r.json())
      .then((d) => setStudentAttempts(Array.isArray(d) ? d : []))
      .catch(() => setStudentAttempts([]))
      .finally(() => setAttemptsLoading(false))
  }, [selectedRoll])

  // Keep q_context in sync for test creation page
  useEffect(() => {
    if (!filterSession) return
    try {
      localStorage.setItem("q_context", JSON.stringify({
        session:  filterSession,
        course:   filterCourse,
        semester: filterSemester ? String(filterSemester) : (autoSemester ? String(autoSemester) : ""),
        subject:  adminInfo?.subject ?? "",
      }))
    } catch {}
  }, [filterSession, filterCourse, filterSemester, autoSemester, adminInfo])

  async function fetchStudents(p = 1, course = filterCourse, session = filterSession) {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (course)   params.set("course", course)
    if (session)  params.set("session", session)
    const res  = await fetch(`/api/admin/import-students?${params}`)
    const data = await res.json()
    setStudents(data.students ?? [])
    setTotalCount(data.count ?? 0)
    setPages(data.pages ?? 1)
    setPage(p)
    setLoading(false)
  }

  function clearFilter() {
    setFilterSession("")
    if (!lockedCourse) { setFilterCourse(""); setFilterDepartment("") }
    setFilterSemester("")
    fetchStudents(1, lockedCourse || "", "")
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setImporting(true); setImportMsg(""); setImportError("")
    const form = new FormData()
    for (const file of Array.from(files)) form.append("files", file)
    try {
      const res  = await fetch("/api/admin/import-students", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error ?? "Import failed"); return }
      setImportMsg(`✓ Imported ${data.imported} new, updated ${data.updated ?? 0} existing students.${data.errors?.length ? ` ${data.errors.length} file(s) had errors.` : ""}`)
      fetchStudents(1, filterCourse, filterSession)
      fetch("/api/admin/import-students").then((r) => r.json()).then((d) => setAllCount(d.count ?? 0))
    } catch {
      setImportError("Upload failed. Please try again.")
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handleClear() {
    if (!confirm(`Delete all ${allCount} students from the database?`)) return
    await fetch("/api/admin/import-students", { method: "DELETE" })
    setStudents([]); setTotalCount(0); setAllCount(0)
    setImportMsg("All students cleared.")
  }

  function handleCreateTest() {
    const sem = filterSemester || autoSemester
    const params = new URLSearchParams()
    if (filterCourse)   params.set("course", filterCourse)
    if (filterSession)  params.set("session", filterSession)
    if (sem)            params.set("semester", String(sem))
    router.push(`/admin/tests/new?${params}`)
  }

  const selectedSem = filterSemester || autoSemester
  const isFiltered  = !!(filterCourse || filterSession || filterDepartment)

  // Departments to show — filtered by selected course if one is chosen
  const departmentOptions = filterCourse
    ? (DEPARTMENTS[filterCourse] ?? [])
    : (Object.values(DEPARTMENTS).flat() as string[])
  const isMaster    = !adminInfo || adminInfo.role === "master"

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">{allCount} total in database</p>
        </div>
        <div className="flex gap-3">
          {allCount > 0 && isMaster && (
            <button onClick={handleClear} className="border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm">
              Clear All
            </button>
          )}
          {isMaster && (
            <label className={`cursor-pointer bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ${importing ? "opacity-60 pointer-events-none" : ""}`}>
              {importing ? "Importing..." : "↑ Upload Excel File(s)"}
              <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={handleUpload} disabled={importing} />
            </label>
          )}
        </div>
      </div>

      {isMaster && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 mb-4">
          File name must contain <strong>BA</strong>, <strong>BCOM</strong>, <strong>BSC</strong>, or <strong>BLIS</strong> for course auto-detection.
        </div>
      )}

      {importMsg   && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm mb-4">{importMsg}</div>}
      {importError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">{importError}</div>}

      {/* Filter Panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Filter &amp; Select Batch</h2>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Session */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Session</label>
            <select
              value={filterSession}
              onChange={(e) => {
                const val = e.target.value as Session
                setFilterSession(val)
                setFilterSemester("")
                fetchStudents(1, filterCourse, val)
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            >
              <option value="">All Sessions</option>
              {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Course — locked for dept admins */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Course</label>
            {lockedCourse ? (
              <div className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 text-sm font-semibold text-blue-900 min-w-[100px]">
                {lockedCourse}
              </div>
            ) : (
              <select
                value={filterCourse}
                onChange={(e) => {
                  const val = e.target.value as Course
                  setFilterCourse(val)
                  // clear department if it doesn't belong to the new course
                  if (filterDepartment && val) {
                    const deptCourse = getCourseForDepartment(filterDepartment)
                    if (deptCourse !== val) setFilterDepartment("")
                  }
                  if (!val) setFilterDepartment("")
                  fetchStudents(1, val, filterSession)
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">All Courses</option>
                {availableCourses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          {/* Department — master admin only */}
          {!lockedCourse && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Department</label>
              <select
                value={filterDepartment}
                onChange={(e) => {
                  const dept = e.target.value
                  setFilterDepartment(dept)
                  if (dept) {
                    const course = getCourseForDepartment(dept) as Course | null
                    if (course) {
                      setFilterCourse(course)
                      fetchStudents(1, course, filterSession)
                    }
                  } else {
                    fetchStudents(1, filterCourse, filterSession)
                  }
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">All Departments</option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {/* Semester selector — shown when session is selected */}
          {filterSession && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Semester <span className="text-gray-400">(for test)</span>
              </label>
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value ? parseInt(e.target.value) : "")}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">Auto-detect</option>
                {semesterOptions.map((n) => (
                  <option key={n} value={n}>
                    Sem {semesterLabel(n)}{n === autoSemester ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isFiltered && (
            <button onClick={clearFilter} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-2">
              ✕ Clear
            </button>
          )}
        </div>

        {/* Create Test CTA */}
        {filterSession && filterCourse && (
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-gray-700">
                <strong>{filterCourse} — {filterSession}</strong>
                {selectedSem ? (
                  <>
                    {" · "}
                    <span className="font-bold text-[#1e3a5f]">Sem {semesterLabel(selectedSem)}</span>
                    {!filterSemester && <span className="text-gray-400 text-xs ml-1">(auto)</span>}
                  </>
                ) : (
                  <span className="text-orange-600 text-xs ml-2">Session may have ended — select semester manually</span>
                )}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {totalCount} student{totalCount !== 1 ? "s" : ""} in this batch
              </p>
            </div>
            {selectedSem && (
              <button
                onClick={handleCreateTest}
                className="bg-[#8b1a1a] hover:bg-[#6f1515] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                + Create Test · {filterCourse} {filterSession} Sem {semesterLabel(selectedSem)}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          {allCount === 0 ? "No students yet. Upload an admission Excel file above." : "No students match the selected filters."}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Roll Number</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Course</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Session</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s, i) => {
                  const isExpanded = selectedRoll === s.rollNumber
                  return (
                    <React.Fragment key={s._id}>
                      <tr
                        key={s._id}
                        onClick={() => setSelectedRoll(isExpanded ? null : s.rollNumber)}
                        className={`cursor-pointer transition-colors ${isExpanded ? "bg-blue-50" : "hover:bg-gray-50"}`}
                      >
                        <td className="px-4 py-2.5 text-gray-400">{(page - 1) * 50 + i + 1}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-700">{s.rollNumber}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{s.name}</td>
                        <td className="px-4 py-2.5 text-gray-600">{s.course}</td>
                        <td className="px-4 py-2.5 text-gray-600">{s.session}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-right select-none">
                          {isExpanded ? "▲" : "▼"}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${s._id}-detail`}>
                          <td colSpan={6} className="bg-blue-50/60 px-5 py-4 border-t border-blue-100">
                              {/* Profile strip */}
                            <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3 text-xs text-gray-600">
                              <span><span className="text-gray-400">Roll:</span> <span className="font-mono text-gray-800">{s.rollNumber}</span></span>
                              <span><span className="text-gray-400">Course:</span> {s.course} · {s.session}</span>
                              {s.fatherName && <span><span className="text-gray-400">Father:</span> {s.fatherName}</span>}
                              {s.mobile    && <span><span className="text-gray-400">Mobile:</span> {s.mobile}</span>}
                              {s.category  && <span><span className="text-gray-400">Category:</span> {s.category}</span>}
                              {s.gender    && <span><span className="text-gray-400">Gender:</span> {s.gender}</span>}
                            </div>
                            <p className="text-xs font-semibold text-blue-700 mb-3 uppercase tracking-wide">
                              Test History — {s.name}
                            </p>
                            {attemptsLoading ? (
                              <p className="text-sm text-gray-400 py-2">Loading...</p>
                            ) : studentAttempts.length === 0 ? (
                              <p className="text-sm text-gray-400 italic py-2">
                                This student has not attempted any tests yet.
                              </p>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-blue-200">
                                <table className="w-full text-xs">
                                  <thead className="bg-blue-100 text-blue-800">
                                    <tr>
                                      <th className="text-left px-3 py-2 font-semibold">Test</th>
                                      <th className="text-left px-3 py-2 font-semibold">Paper</th>
                                      <th className="text-center px-3 py-2 font-semibold">Sem</th>
                                      <th className="text-center px-3 py-2 font-semibold">Score</th>
                                      <th className="text-center px-3 py-2 font-semibold">%</th>
                                      <th className="text-center px-3 py-2 font-semibold">Grade</th>
                                      <th className="text-center px-3 py-2 font-semibold">Rank</th>
                                      <th className="text-center px-3 py-2 font-semibold">Time</th>
                                      <th className="text-right px-3 py-2 font-semibold">Submitted</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-blue-100 bg-white">
                                    {studentAttempts.map((a) => {
                                      const grade = getGrade(a.percentage)
                                      const gradeColor = getGradeColor(grade)
                                      const mins = Math.floor(a.timeTaken / 60)
                                      const secs = a.timeTaken % 60
                                      return (
                                        <tr key={a._id} className="hover:bg-blue-50/40">
                                          <td className="px-3 py-2 text-gray-800 font-medium max-w-[180px] truncate">{a.testTitle}</td>
                                          <td className="px-3 py-2 text-gray-600">{a.testPaper || "—"}</td>
                                          <td className="px-3 py-2 text-center text-gray-600">{a.testSemester || "—"}</td>
                                          <td className="px-3 py-2 text-center font-mono text-gray-800">
                                            {a.score}/{a.maxScore}
                                          </td>
                                          <td className="px-3 py-2 text-center text-gray-700">{a.percentage.toFixed(1)}%</td>
                                          <td className="px-3 py-2 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${gradeColor}`}>
                                              {grade}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-center text-gray-700">#{a.rank}</td>
                                          <td className="px-3 py-2 text-center text-gray-500">
                                            {mins}m {secs}s
                                          </td>
                                          <td className="px-3 py-2 text-right text-gray-400">
                                            {new Date(a.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => fetchStudents(page - 1)} disabled={page === 1}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">← Prev</button>
              <span className="text-sm text-gray-500">Page {page} of {pages}</span>
              <button onClick={() => fetchStudents(page + 1)} disabled={page === pages}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
