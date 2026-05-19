"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getGrade, getGradeColor, semesterLabel } from "@/lib/constants"

interface Test {
  _id: string
  title: string
  subject: string
  course: string
  session: string
  semester: number
  totalMarks: number
  duration: number
  startTime: string
  endTime: string | null
  isPublished: boolean
  isResultPublished: boolean
  createdBy: string
}

interface Attempt {
  _id: string
  studentName: string
  rollNumber: string
  score: number
  maxScore: number
  percentage: number
  rank: number
  timeTaken: number
  submittedAt: string
}

export default function TestDetailPage({ params }: { params: Promise<{ testId: string }> }) {
  const router = useRouter()
  const [testId, setTestId] = useState("")
  const [test, setTest] = useState<Test | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(true)

  function downloadCSV() {
    if (!test) return
    const header = ["Rank","Student Name","Roll Number","Score","Max Score","Percentage","Grade","Time Taken","Submitted At"]
    const rows = attempts.map((a) => [
      a.rank,
      a.studentName,
      a.rollNumber,
      a.score,
      a.maxScore,
      a.percentage.toFixed(1) + "%",
      getGrade(a.percentage),
      formatTime(a.timeTaken),
      new Date(a.submittedAt).toLocaleString("en-IN"),
    ])
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url
    a.download = `${test.title.replace(/\s+/g, "_")}_results.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handlePrint() { window.print() }

  useEffect(() => {
    params.then(({ testId: id }) => setTestId(id))
  }, [params])

  useEffect(() => {
    if (!testId) return
    Promise.all([
      fetch(`/api/tests/${testId}`).then((r) => r.json()),
      fetch(`/api/attempts/${testId}`).then((r) => r.json()),
    ]).then(([testData, attemptsData]) => {
      setTest(testData)
      setAttempts(attemptsData)
      setLoading(false)
    })
  }, [testId])

  async function toggleField(field: "isPublished" | "isResultPublished") {
    if (!test) return
    const res = await fetch(`/api/tests/${testId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !test[field] }),
    })
    const updated = await res.json()
    setTest(updated)
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}m ${s}s`
  }

  const avg = attempts.length > 0
    ? (attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length).toFixed(1)
    : null

  const top = attempts.length > 0 ? attempts[0] : null
  const topScore = top ? top.percentage.toFixed(1) : null

  if (loading) {
    return <div className="p-6 text-gray-400">Loading...</div>
  }

  if (!test) {
    return (
      <div className="p-6">
        <p className="text-red-600">Test not found</p>
        <button onClick={() => router.back()} className="text-sm text-[#1e3a5f] mt-2">← Back</button>
      </div>
    )
  }

  return (
    <>
    <style>{`
      @media print {
        body * { visibility: hidden; }
        #results-printable, #results-printable * { visibility: visible; }
        #results-printable { position: fixed; inset: 0; padding: 24px; }
        .no-print { display: none !important; }
      }
    `}</style>
    <div className="p-4 sm:p-6" id="results-printable">

      {/* Header — wraps on mobile */}
      <div className="flex flex-wrap items-start gap-3 mb-6">
        <button onClick={() => router.push("/admin/tests")} className="text-sm text-gray-500 hover:text-gray-700 shrink-0 mt-1">
          ← Tests
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex-1 min-w-0">{test.title}</h1>
        {attempts.length > 0 && (
          <div className="flex gap-2 no-print w-full sm:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-sm flex items-center justify-center gap-1.5"
            >
              🖨️ Print
            </button>
            <button
              onClick={downloadCSV}
              className="flex-1 sm:flex-none border border-[#1e3a5f] text-[#1e3a5f] hover:bg-blue-50 px-3 py-1.5 rounded-lg text-sm flex items-center justify-center gap-1.5"
            >
              ⬇️ CSV
            </button>
          </div>
        )}
      </div>

      {/* Test Info + Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <h2 className="font-semibold text-gray-700 mb-3">Test Details</h2>
          <dl className="space-y-2 text-sm">
            {[
              ["Subject", test.subject],
              ["Course", `${test.course} · ${test.session}`],
              ["Semester", `Sem ${semesterLabel(test.semester)}`],
              ["Duration", `${test.duration} minutes`],
              ["Total Marks", String(test.totalMarks)],
              ["Created by", test.createdBy],
              ["Start Time", new Date(test.startTime).toLocaleString("en-IN")],
              ["End Time", test.endTime ? new Date(test.endTime).toLocaleString("en-IN") : "Open-ended"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-gray-500 w-24 sm:w-28 shrink-0 text-xs sm:text-sm">{k}</dt>
                <dd className="text-gray-900 font-medium text-xs sm:text-sm min-w-0">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-3">
          {/* Controls */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <h2 className="font-semibold text-gray-700 mb-3">Controls</h2>
            <div className="space-y-2">
              <button
                onClick={() => toggleField("isPublished")}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                  test.isPublished
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {test.isPublished ? "✓ Test Published (tap to unpublish)" : "Publish Test"}
              </button>
              <button
                onClick={() => toggleField("isResultPublished")}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                  test.isResultPublished
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {test.isResultPublished ? "✓ Results Published (tap to hide)" : "Publish Results"}
              </button>
            </div>
          </div>

          {/* Stats */}
          {attempts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Statistics</h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-[#1e3a5f]">{attempts.length}</div>
                  <div className="text-xs text-gray-500">Attempts</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-[#1e3a5f]">{avg}%</div>
                  <div className="text-xs text-gray-500">Avg Score</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-[#1e3a5f]">{topScore}%</div>
                  <div className="text-xs text-gray-500">Top Score</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attempts Table */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3">
          Student Attempts ({attempts.length})
        </h2>

        {attempts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
            No attempts yet. Publish the test for students to take it.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Rank</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Roll No.</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Score</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">%</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Grade</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attempts.map((a) => {
                    const grade = getGrade(a.percentage)
                    const gradeColor = getGradeColor(grade)
                    return (
                      <tr key={a._id} className={`hover:bg-gray-50 ${a.rank === 1 ? "bg-yellow-50" : ""}`}>
                        <td className="px-4 py-3 font-bold text-[#1e3a5f] whitespace-nowrap">
                          {a.rank === 1 ? "🥇" : a.rank === 2 ? "🥈" : a.rank === 3 ? "🥉" : `#${a.rank}`}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{a.studentName}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.rollNumber}</td>
                        <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{a.score}/{a.maxScore}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{a.percentage.toFixed(1)}%</td>
                        <td className={`px-4 py-3 font-medium text-xs whitespace-nowrap ${gradeColor}`}>{grade}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatTime(a.timeTaken)}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(a.submittedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
