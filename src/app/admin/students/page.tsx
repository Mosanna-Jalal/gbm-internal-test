"use client"

import React, { useEffect, useRef, useState } from "react"
import { createPortal, flushSync } from "react-dom"
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
  department?: string
  fatherName?: string
  mobile?: string
  category?: string
  gender?: string
}

interface ImportToast {
  type: "success" | "error" | "info"
  lines: string[]
}

interface AdminInfo {
  role: "master" | "subject"
  subject: string | null
}

export default function StudentsPage() {
  const router        = useRouter()
  const fileRef       = useRef<HTMLInputElement>(null)
  const uploadBtnRef  = useRef<HTMLLabelElement>(null)
  const uploadTextRef = useRef<HTMLSpanElement>(null)

  const [adminInfo, setAdminInfo]         = useState<AdminInfo | null>(null)
  const [lockedCourse, setLockedCourse]   = useState<Course | "">("")

  const [filterSession,    setFilterSession]    = useState<Session | "">("")
  const [filterCourse,     setFilterCourse]     = useState<Course | "">("")
  const [filterDepartment, setFilterDepartment] = useState("")
  const [filterSemester,   setFilterSemester]   = useState<number | "">("")

  const [selectedRoll,     setSelectedRoll]     = useState<string | null>(null)
  const [studentAttempts,  setStudentAttempts]  = useState<StudentAttemptRow[]>([])
  const [attemptsLoading,  setAttemptsLoading]  = useState(false)

  const [students,   setStudents]   = useState<Student[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [allCount,   setAllCount]   = useState(0)
  const [page,  setPage]  = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const [importing,      setImporting]      = useState(false)
  const [uploadingName,  setUploadingName]  = useState("")
  const [uploadDone,     setUploadDone]     = useState(false)
  const [toast,          setToast]          = useState<ImportToast | null>(null)
  const toastTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const doneTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(t: ImportToast) {
    setToast(t)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 8000)
  }

  const availableCourses = filterSession
    ? VALID_COURSES_FOR_SESSION[filterSession as Session]
    : COURSES

  const maxSem = filterSession ? SESSION_SEMS[filterSession as Session] : 8

  const autoSemester = filterSession
    ? (computeSemester(filterSession as Session) ?? null)
    : null

  const semesterOptions = filterSession
    ? Array.from({ length: maxSem }, (_, i) => i + 1)
    : []

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

  useEffect(() => {
    if (!selectedRoll) { setStudentAttempts([]); return }
    setAttemptsLoading(true)
    fetch(`/api/attempts?rollNumber=${encodeURIComponent(selectedRoll)}`)
      .then((r) => r.json())
      .then((d) => setStudentAttempts(Array.isArray(d) ? d : []))
      .catch(() => setStudentAttempts([]))
      .finally(() => setAttemptsLoading(false))
  }, [selectedRoll])

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
    if (course)  params.set("course", course)
    if (session) params.set("session", session)
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

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    // Direct DOM update — instant, no React cycle needed
    if (uploadBtnRef.current) {
      uploadBtnRef.current.style.opacity = "0.65"
      uploadBtnRef.current.style.pointerEvents = "none"
      uploadBtnRef.current.style.cursor = "default"
      uploadBtnRef.current.setAttribute("aria-disabled", "true")
      uploadBtnRef.current.setAttribute("data-uploading", "true")
    }
    if (uploadTextRef.current) {
      uploadTextRef.current.textContent = "Uploading..."
    }
    // flushSync keeps React state in sync with the DOM update above
    flushSync(() => {
      setImporting(true)
      setUploadDone(false)
      setUploadingName(files.length === 1 ? files[0].name : `${files.length} files`)
    })
    requestAnimationFrame(() => doUpload(Array.from(files)))
  }

  async function doUpload(files: File[]) {
    const form = new FormData()
    for (const file of files) form.append("files", file)
    try {
      const res  = await fetch("/api/admin/import-students", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) {
        showToast({ type: "error", lines: [data.error ?? "Import failed"] })
        return
      }
      const lines: string[] = []
      if (data.imported > 0)
        lines.push(`${data.imported} new student${data.imported !== 1 ? "s" : ""} added`)
      if (data.updated > 0)
        lines.push(`${data.updated} existing student${data.updated !== 1 ? "s" : ""} updated`)
      if (data.departmentFilled > 0)
        lines.push(`Department filled for ${data.departmentFilled} student${data.departmentFilled !== 1 ? "s" : ""}`)
      if (data.errors?.length)
        lines.push(`${data.errors.length} file${data.errors.length !== 1 ? "s" : ""} had errors`)
      if (lines.length === 0) {
        showToast({ type: "info", lines: ["All records are already up to date.", "No new data was found in the file."] })
      } else {
        showToast({ type: "success", lines })
      }
      setUploadDone(true)
      if (doneTimer.current) clearTimeout(doneTimer.current)
      doneTimer.current = setTimeout(() => setUploadDone(false), 4000)
      fetchStudents(1, filterCourse, filterSession)
      fetch("/api/admin/import-students").then((r) => r.json()).then((d) => setAllCount(d.count ?? 0))
    } catch {
      showToast({ type: "error", lines: ["Upload failed. Please try again."] })
    } finally {
      // Reset any direct DOM styles applied in handleUpload
      if (uploadBtnRef.current) {
        uploadBtnRef.current.style.opacity = ""
        uploadBtnRef.current.style.pointerEvents = ""
        uploadBtnRef.current.style.cursor = ""
        uploadBtnRef.current.removeAttribute("aria-disabled")
        uploadBtnRef.current.removeAttribute("data-uploading")
      }
      setImporting(false)
      setUploadingName("")
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handleClear() {
    if (!confirm(`Delete all ${allCount} students from the database?`)) return
    await fetch("/api/admin/import-students", { method: "DELETE" })
    setStudents([]); setTotalCount(0); setAllCount(0)
    showToast({ type: "success", lines: ["All students cleared from the database."] })
  }

  function handleCreateTest() {
    const sem = filterSemester || autoSemester
    const params = new URLSearchParams()
    if (filterCourse)  params.set("course", filterCourse)
    if (filterSession) params.set("session", filterSession)
    if (sem)           params.set("semester", String(sem))
    router.push(`/admin/tests/new?${params}`)
  }

  const selectedSem = filterSemester || autoSemester
  const isFiltered  = !!(filterCourse || filterSession || filterDepartment)

  const departmentOptions = filterCourse
    ? (DEPARTMENTS[filterCourse] ?? [])
    : (Object.values(DEPARTMENTS).flat() as string[])
  const isMaster = !adminInfo || adminInfo.role === "master"

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">

      {/* Toast — portal-rendered so it's never clipped by parent overflow/transforms */}
      {toast && typeof document !== "undefined" && createPortal(
        <div className={`toast-enter fixed top-4 left-4 right-4 sm:left-auto sm:right-5 sm:top-5 z-[9999] sm:w-80
          rounded-2xl shadow-2xl overflow-hidden`}
        >
          {/* Coloured top bar */}
          <div className={`h-1 w-full ${
            toast.type === "success" ? "bg-emerald-500" :
            toast.type === "info"    ? "bg-blue-400" :
                                       "bg-red-500"
          }`} />
          <div className="bg-white px-4 py-3.5 flex items-start gap-3">
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base mt-0.5 ${
              toast.type === "success" ? "bg-emerald-100 text-emerald-600" :
              toast.type === "info"    ? "bg-blue-100 text-blue-600" :
                                         "bg-red-100 text-red-600"
            }`}>
              {toast.type === "success" ? "✓" : toast.type === "info" ? "ℹ" : "✕"}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${
                toast.type === "success" ? "text-emerald-800" :
                toast.type === "info"    ? "text-blue-800" :
                                           "text-red-800"
              }`}>
                {toast.type === "success" ? "Import Complete" :
                 toast.type === "info"    ? "No Changes" :
                                            "Import Failed"}
              </p>
              <ul className="mt-1.5 space-y-1">
                {toast.lines.map((line, i) => (
                  <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                    <span className="shrink-0 mt-px">·</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setToast(null)}
              className="shrink-0 text-gray-300 hover:text-gray-500 text-xl leading-none mt-0.5"
            >×</button>
          </div>
        </div>,
        document.body
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">{allCount} total in database</p>
        </div>
        {isMaster && (
          <div className="flex flex-wrap gap-2">
            {allCount > 0 && (
              <button onClick={handleClear} className="border border-red-300 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm">
                Clear All
              </button>
            )}
            <div className="flex flex-col items-end gap-1">
              <label
                ref={uploadBtnRef}
                aria-disabled={importing || uploadDone}
                className={`cursor-pointer bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2
                  ${importing || uploadDone ? "opacity-70 pointer-events-none cursor-default" : ""}`}
              >
                {importing ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 12a8 8 0 018-8m0 0a8 8 0 018 8" />
                    </svg>
                    <span ref={uploadTextRef}>Uploading...</span>
                  </>
                ) : uploadDone ? <span ref={uploadTextRef}>✓ Uploaded!</span> : <span ref={uploadTextRef}>↑ Upload Excel</span>}
                <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={handleUpload} disabled={importing} />
              </label>
              {importing && uploadingName && (
                <p className="text-xs text-gray-400 truncate max-w-[200px]">{uploadingName}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {isMaster && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 mb-4">
          File name must contain <strong>BA</strong>, <strong>BCOM</strong>, <strong>BSC</strong>, or <strong>BLIS</strong> for auto-detection.
          Department/subject columns (e.g. &quot;Honours Subject&quot;) are auto-imported.
        </div>
      )}

      {/* Filter Panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Filter &amp; Select Batch</h2>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 items-end">
          {/* Session */}
          <div className="col-span-1">
            <label className="block text-xs text-gray-500 mb-1">Session</label>
            <select
              value={filterSession}
              onChange={(e) => {
                const val = e.target.value as Session
                setFilterSession(val)
                setFilterSemester("")
                fetchStudents(1, filterCourse, val)
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            >
              <option value="">All Sessions</option>
              {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Course */}
          <div className="col-span-1">
            <label className="block text-xs text-gray-500 mb-1">Course</label>
            {lockedCourse ? (
              <div className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 text-sm font-semibold text-blue-900">
                {lockedCourse}
              </div>
            ) : (
              <select
                value={filterCourse}
                onChange={(e) => {
                  const val = e.target.value as Course
                  setFilterCourse(val)
                  if (filterDepartment && val) {
                    const deptCourse = getCourseForDepartment(filterDepartment)
                    if (deptCourse !== val) setFilterDepartment("")
                  }
                  if (!val) setFilterDepartment("")
                  fetchStudents(1, val, filterSession)
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">All Courses</option>
                {availableCourses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          {/* Department — master admin only */}
          {!lockedCourse && (
            <div className="col-span-2 sm:col-span-1">
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">All Departments</option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {/* Semester */}
          {filterSession && (
            <div className="col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Semester</label>
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value ? parseInt(e.target.value) : "")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">Auto</option>
                {semesterOptions.map((n) => (
                  <option key={n} value={n}>
                    Sem {semesterLabel(n)}{n === autoSemester ? " ✓" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isFiltered && (
            <button onClick={clearFilter} className="col-span-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-2 self-end">
              ✕ Clear
            </button>
          )}
        </div>

        {/* Create Test CTA */}
        {filterSession && filterCourse && (
          <div className="pt-3 border-t border-gray-100 space-y-2">
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
                  <span className="text-orange-600 text-xs ml-2">Select semester manually</span>
                )}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {totalCount} student{totalCount !== 1 ? "s" : ""} in this batch
              </p>
            </div>
            {selectedSem && (
              <button
                onClick={handleCreateTest}
                className="w-full sm:w-auto bg-[#8b1a1a] hover:bg-[#6f1515] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                + Create Test · {filterCourse} Sem {semesterLabel(selectedSem)}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Roll</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Father&apos;s Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Dept</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Course</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Session</th>
                    <th className="px-4 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((s, i) => {
                    const isExpanded = selectedRoll === s.rollNumber
                    return (
                      <React.Fragment key={s._id}>
                        <tr
                          onClick={() => setSelectedRoll(isExpanded ? null : s.rollNumber)}
                          className={`cursor-pointer transition-colors ${isExpanded ? "bg-blue-50" : "hover:bg-gray-50"}`}
                        >
                          <td className="px-4 py-2.5 text-gray-400">{(page - 1) * 50 + i + 1}</td>
                          <td className="px-4 py-2.5 font-mono text-gray-700 text-xs">{s.rollNumber}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900">{s.name}</td>
                          <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">{s.fatherName || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            {s.department
                              ? <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">{s.department}</span>
                              : <span className="text-gray-300">—</span>
                            }
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">{s.course}</td>
                          <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">{s.session}</td>
                          <td className="px-4 py-2.5 text-gray-400 text-right select-none">
                            {isExpanded ? "▲" : "▼"}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${s._id}-detail`}>
                            <td colSpan={8} className="bg-blue-50/60 px-4 py-4 border-t border-blue-100">
                              <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3 text-xs text-gray-600">
                                <span><span className="text-gray-400">Roll:</span> <span className="font-mono text-gray-800">{s.rollNumber}</span></span>
                                <span><span className="text-gray-400">Course:</span> {s.course} · {s.session}</span>
                                {s.department && (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="text-gray-400">Dept:</span>
                                    <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[11px] font-medium">{s.department}</span>
                                  </span>
                                )}
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
                                  No tests attempted yet.
                                </p>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-blue-200">
                                  <table className="w-full text-xs min-w-[500px]">
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
                                        <th className="text-right px-3 py-2 font-semibold">Date</th>
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
                                            <td className="px-3 py-2 text-gray-800 font-medium max-w-[160px] truncate">{a.testTitle}</td>
                                            <td className="px-3 py-2 text-gray-600">{a.testPaper || "—"}</td>
                                            <td className="px-3 py-2 text-center text-gray-600">{a.testSemester || "—"}</td>
                                            <td className="px-3 py-2 text-center font-mono text-gray-800">{a.score}/{a.maxScore}</td>
                                            <td className="px-3 py-2 text-center text-gray-700">{a.percentage.toFixed(1)}%</td>
                                            <td className="px-3 py-2 text-center">
                                              <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${gradeColor}`}>
                                                {grade}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-center text-gray-700">#{a.rank}</td>
                                            <td className="px-3 py-2 text-center text-gray-500">{mins}m {secs}s</td>
                                            <td className="px-3 py-2 text-right text-gray-400">
                                              {new Date(a.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
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
