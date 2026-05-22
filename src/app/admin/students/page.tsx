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
  const fileRef      = useRef<HTMLInputElement>(null)
  const terminalRef  = useRef<HTMLDivElement>(null)

  const [adminInfo, setAdminInfo]         = useState<AdminInfo | null>(null)
  const [lockedCourse,      setLockedCourse]      = useState<Course | "">("")
  const [lockedDepartment,  setLockedDepartment]  = useState("")

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
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadDone,     setUploadDone]     = useState(false)
  const [terminalLines,  setTerminalLines]  = useState<{ text: string; type: "cmd" | "ok" | "err" }[]>([])
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
        if (course) { setLockedCourse(course); setFilterCourse(course) }
        setLockedDepartment(d.subject)
        setFilterDepartment(d.subject)
        // Explicit refetch with dept filter so subject admins never see other departments,
        // even if the backend cookie check fails (stale JWT, edge cache, etc.)
        fetchStudents({ course: course || "", dept: d.subject })
        fetch(`/api/admin/import-students?department=${encodeURIComponent(d.subject)}`)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => { if (data?.count != null) setAllCount(data.count) })
      }
    })
    fetch("/api/admin/import-students")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setAllCount(d.count ?? 0) })
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

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight
  }, [terminalLines])

  async function fetchStudents({ p = 1, course = filterCourse, session = filterSession, dept = filterDepartment }: { p?: number; course?: string; session?: string; dept?: string } = {}) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (course)  params.set("course", course)
      if (session) params.set("session", session)
      if (dept)    params.set("department", dept)
      const res  = await fetch(`/api/admin/import-students?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setStudents(data.students ?? [])
      setTotalCount(data.count ?? 0)
      setPages(data.pages ?? 1)
      setPage(p)
    } catch {
      // Network error or empty response — leave existing list intact
    } finally {
      setLoading(false)
    }
  }

  function clearFilter() {
    setFilterSession("")
    if (!lockedCourse)     setFilterCourse("")
    if (!lockedDepartment) setFilterDepartment("")
    setFilterSemester("")
    fetchStudents({ course: lockedCourse || "", session: "", dept: lockedDepartment || "" })
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    flushSync(() => {
      setImporting(true)
      setUploadDone(false)
      setUploadingName(files.length === 1 ? files[0].name : `${files.length} files`)
      setTerminalLines([])
    })
    requestAnimationFrame(() => doUpload(Array.from(files)))
  }

  async function doUpload(files: File[]) {
    const form = new FormData()
    for (const file of files) form.append("files", file)

    const log = (text: string, type: "cmd" | "ok" | "err" = "cmd") =>
      setTerminalLines((prev) => [...prev, { text, type }])

    log(`Initializing upload...`)
    log(`Reading: ${files.length === 1 ? files[0].name : `${files.length} files`}`)

    const processingLogs = [
      "Parsing Excel workbook...",
      "Detecting header row...",
      "Mapping column fields...",
      "Validating student records...",
      "Checking for duplicates...",
      "Resolving departments...",
      "Writing to database...",
      "Finalizing import...",
    ]

    try {
      const data = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        let processingInterval: ReturnType<typeof setInterval> | null = null
        let xferLogged = false
        let logIndex = 0

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 70))
            if (!xferLogged) { xferLogged = true; log("Transferring to server...") }
          }
        })

        xhr.upload.addEventListener("load", () => {
          if (!xferLogged) log("Transferring to server...")
          log("File received. Starting server-side processing...")
          let current = 70
          let waitTick = 0
          let waitIndex = 0
          const waitingLogs = [
            "Verifying data integrity...",
            "Cross-checking session tags...",
            "Syncing department metadata...",
            "Confirming write operations...",
            "Building response payload...",
            "Awaiting server confirmation...",
          ]
          setUploadProgress(current)
          processingInterval = setInterval(() => {
            if (current < 95) {
              current++
              setUploadProgress(current)
              if ((current - 70) % 3 === 1 && logIndex < processingLogs.length)
                log(processingLogs[logIndex++])
            } else {
              // Stuck at 95 waiting for server — keep terminal alive
              waitTick++
              if (waitTick % 8 === 0 && waitIndex < waitingLogs.length)
                log(waitingLogs[waitIndex++])
            }
            // Never self-clear — xhr.load / xhr.error clears this
          }, 300)
        })

        xhr.addEventListener("load", () => {
          if (processingInterval) { clearInterval(processingInterval); processingInterval = null }
          setUploadProgress(100)
          try { resolve(JSON.parse(xhr.responseText)) }
          catch { reject(new Error("Invalid server response")) }
        })
        xhr.addEventListener("error", () => {
          if (processingInterval) { clearInterval(processingInterval); processingInterval = null }
          reject(new Error("Network error"))
        })
        xhr.open("POST", "/api/admin/import-students")
        xhr.send(form)
      })

      if (!data.success) {
        log(String(data.error ?? "Import failed"), "err")
        showToast({ type: "error", lines: [String(data.error ?? "Import failed")] })
        return
      }
      const imported         = Number(data.imported         ?? 0)
      const updated          = Number(data.updated          ?? 0)
      const departmentFilled = Number(data.departmentFilled ?? 0)
      const skipped          = Number(data.skipped          ?? 0)
      const skippedRows      = Array.isArray(data.skippedRows) ? data.skippedRows : []
      const errors           = Array.isArray(data.errors) ? data.errors as string[] : []
      if (skippedRows.length) console.table(skippedRows)

      if (imported > 0)         log(`${imported} new student${imported !== 1 ? "s" : ""} added`, "ok")
      if (updated > 0)          log(`${updated} record${updated !== 1 ? "s" : ""} updated`, "ok")
      if (departmentFilled > 0) log(`Department filled for ${departmentFilled}`, "ok")
      if (skipped > 0)          log(`${skipped} row${skipped !== 1 ? "s" : ""} skipped`)
      if (errors.length)        log(`${errors.length} file error${errors.length !== 1 ? "s" : ""}`, "err")
      log("Done.", "ok")

      const toastLines: string[] = []
      if (imported > 0)         toastLines.push(`${imported} new student${imported !== 1 ? "s" : ""} added`)
      if (updated > 0)          toastLines.push(`${updated} existing student${updated !== 1 ? "s" : ""} updated`)
      if (departmentFilled > 0) toastLines.push(`Department filled for ${departmentFilled} student${departmentFilled !== 1 ? "s" : ""}`)
      if (skipped > 0)          toastLines.push(`${skipped} row${skipped !== 1 ? "s" : ""} skipped (no roll number or name found)`)
      if (errors.length)        toastLines.push(`${errors.length} file${errors.length !== 1 ? "s" : ""} had errors`)

      await new Promise((r) => setTimeout(r, 800))
      if (toastLines.length === 0) {
        showToast({ type: "info", lines: ["All records are already up to date.", "No new data was found in the file."] })
      } else {
        showToast({ type: "success", lines: toastLines })
      }
      setUploadDone(true)
      if (doneTimer.current) clearTimeout(doneTimer.current)
      doneTimer.current = setTimeout(() => setUploadDone(false), 4000)
      fetchStudents()
      fetch("/api/admin/import-students").then((r) => r.json()).then((d) => setAllCount(d.count ?? 0))
    } catch {
      log("Upload failed. Please try again.", "err")
      await new Promise((r) => setTimeout(r, 800))
      showToast({ type: "error", lines: ["Upload failed. Please try again."] })
    } finally {
      setImporting(false)
      setUploadProgress(0)
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

      {/* Upload modal — full-screen overlay with terminal */}
      {importing && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[9990]" />
          <div className="fixed inset-0 z-[9991] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

              {/* Modal header */}
              <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2a4f82] px-6 py-4 flex items-center gap-3">
                <svg className="w-5 h-5 text-white animate-spin shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8m0 0a8 8 0 018 8" />
                </svg>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm">Importing Students</p>
                  <p className="text-blue-200 text-xs mt-0.5 truncate">{uploadingName}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-6 pt-4 pb-2">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-500">
                    {uploadProgress < 70 ? "Uploading file..." : uploadProgress < 100 ? "Processing on server..." : "Complete"}
                  </span>
                  <span className="font-mono font-bold text-[#1e3a5f]">{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${uploadProgress}%`,
                      background: uploadProgress < 70
                        ? "linear-gradient(90deg,#3b82f6,#1e3a5f)"
                        : "linear-gradient(90deg,#10b981,#047857)",
                    }}
                  />
                </div>
              </div>

              {/* Terminal screen */}
              <div className="mx-6 mb-6 mt-3 rounded-xl overflow-hidden border border-gray-800">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-[#1c1c1e] border-b border-gray-800">
                  <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                  <span className="text-gray-500 text-[11px] ml-2 font-mono">import.process</span>
                </div>
                <div ref={terminalRef} className="bg-gray-950 p-4 h-44 overflow-y-auto font-mono text-[11px] leading-5 space-y-0.5">
                  {terminalLines.map((line, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className={`shrink-0 ${line.type === "ok" ? "text-green-400" : line.type === "err" ? "text-red-400" : "text-blue-400"}`}>
                        {line.type === "ok" ? "✓" : line.type === "err" ? "✗" : "$"}
                      </span>
                      <span className={line.type === "ok" ? "text-green-300" : line.type === "err" ? "text-red-300" : "text-gray-300"}>
                        {line.text}
                      </span>
                    </div>
                  ))}
                  {uploadProgress < 100 && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-blue-400">$</span>
                      <span className="text-gray-600 animate-pulse">█</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </>,
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
            <label
              className={`cursor-pointer text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 min-w-[148px] justify-center transition-colors
                ${importing ? "bg-emerald-700 pointer-events-none opacity-80" : uploadDone ? "bg-emerald-600 pointer-events-none" : "bg-emerald-700 hover:bg-emerald-800"}`}
            >
              {importing
                ? <><svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 12a8 8 0 018-8m0 0a8 8 0 018 8" /></svg>Uploading...</>
                : uploadDone ? "✓ Uploaded!" : "↑ Upload Excel"}
              <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={handleUpload} disabled={importing} />
            </label>
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
                fetchStudents({ session: val })
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
                  fetchStudents({ course: val })
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">All Courses</option>
                {availableCourses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          {/* Department */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-gray-500 mb-1">Department</label>
            {lockedDepartment ? (
              <div className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 text-sm font-semibold text-blue-900">
                {lockedDepartment}
              </div>
            ) : (
              <select
                value={filterDepartment}
                onChange={(e) => {
                  const dept = e.target.value
                  setFilterDepartment(dept)
                  if (dept) {
                    const course = getCourseForDepartment(dept) as Course | null
                    if (course) {
                      setFilterCourse(course)
                      fetchStudents({ course, dept })
                    } else {
                      fetchStudents({ dept })
                    }
                  } else {
                    fetchStudents({ dept: "" })
                  }
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">All Departments</option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
          </div>

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

        {/* Filter result count */}
        {isFiltered && !loading && (
          <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-[#1e3a5f]/8 text-[#1e3a5f] text-sm font-medium px-3 py-1.5 rounded-lg">
              <span className="font-bold tabular-nums">{totalCount}</span>
              <span className="font-normal">student{totalCount !== 1 ? "s" : ""} found</span>
            </span>
            {filterDepartment && (
              <span className="text-xs text-gray-400">in {filterDepartment}{filterCourse ? ` · ${filterCourse}` : ""}{filterSession ? ` · ${filterSession}` : ""}</span>
            )}
          </div>
        )}

        {/* Create Test CTA */}
        {filterSession && filterCourse && (
          <div className="pt-3 border-t border-gray-100 space-y-2">
            <div>
              <p className="text-sm text-gray-700">
                <strong>{filterCourse} — {filterSession}</strong>
                {filterDepartment && (
                  <span className="ml-2 bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded">{filterDepartment}</span>
                )}
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
                <span className="font-semibold text-gray-700">{totalCount}</span> student{totalCount !== 1 ? "s" : ""} in this batch
              </p>
            </div>
            {selectedSem && (
              <button
                onClick={handleCreateTest}
                className="w-full sm:w-auto bg-[#8b1a1a] hover:bg-[#6f1515] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                + Create Test · {filterCourse} Sem {semesterLabel(selectedSem)}{filterDepartment ? ` · ${filterDepartment}` : ""}
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
              <button onClick={() => fetchStudents({ p: page - 1 })} disabled={page === 1}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">← Prev</button>
              <span className="text-sm text-gray-500">Page {page} of {pages}</span>
              <button onClick={() => fetchStudents({ p: page + 1 })} disabled={page === pages}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
