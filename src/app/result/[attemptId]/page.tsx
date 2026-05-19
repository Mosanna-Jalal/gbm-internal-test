"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { getGrade, getGradeColor, semesterLabel } from "@/lib/constants"

interface QuestionResult {
  _id: string
  text: string
  options: string[]
  correctIndex: number
  marks: number
  negMarks: number
}

interface AttemptResult {
  _id: string
  studentName: string
  rollNumber: string
  course: string
  session: string
  semester: number
  score: number
  maxScore: number
  percentage: number
  rank: number
  timeTaken: number
  submittedAt: string
  answers: { questionId: string; chosenIndex: number | null }[]
  testId: {
    _id: string
    title: string
    subject: string
    isResultPublished: boolean
    duration: number
    questions: QuestionResult[]
  }
}

interface LeaderboardEntry {
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

function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const searchParams = useSearchParams()
  const roll = searchParams.get("roll") ?? ""

  const [attemptId, setAttemptId] = useState("")
  const [result, setResult]       = useState<AttemptResult | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState("")

  useEffect(() => {
    params.then(({ attemptId: id }) => setAttemptId(id))
  }, [params])

  useEffect(() => {
    if (!attemptId || !roll) return
    async function fetchResult() {
      try {
        const res = await fetch(`/api/results/${encodeURIComponent(roll)}`)
        if (!res.ok) throw new Error()
        const attempts: AttemptResult[] = await res.json()
        const attempt = attempts.find((a) => a._id === attemptId)
        if (!attempt) { setError("Result not found"); return }
        setResult(attempt)
        if (attempt.testId.isResultPublished) {
          const lb = await fetch(`/api/attempts/${attempt.testId._id}`)
          if (lb.ok) setLeaderboard(await lb.json())
        }
      } catch { setError("Could not load your result") }
      finally { setLoading(false) }
    }
    fetchResult()
  }, [attemptId, roll])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !result) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-red-200 p-8 text-center max-w-md">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-semibold text-red-700 mb-2">{error || "Result not found"}</h2>
        <Link href="/" className="mt-4 text-sm text-[#1e3a5f] underline">← Back to Home</Link>
      </div>
    </div>
  )

  const test      = result.testId
  const grade     = getGrade(result.percentage)
  const gradeColor = getGradeColor(grade)
  const minutes   = Math.floor(result.timeTaken / 60)
  const seconds   = result.timeTaken % 60
  const submittedOn = new Date(result.submittedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #result-printable, #result-printable * { visibility: visible; }
          #result-printable { position: fixed; inset: 0; padding: 32px; background: white; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-[#1e3a5f] text-white py-4 px-4 no-print">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-200 tracking-widest uppercase">Gautam Buddha Mahila College, Gaya</p>
              <h1 className="text-xl font-bold mt-0.5">Test Result</h1>
            </div>
            {test.isResultPublished && (
              <button
                onClick={() => window.print()}
                className="border border-blue-300 text-blue-100 hover:bg-white/10 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors"
              >
                🖨️ Print / Save PDF
              </button>
            )}
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 py-8 space-y-4">
          <div id="result-printable">
            {/* Print-only college header */}
            <div className="hidden print:block text-center border-b pb-4 mb-6">
              <p className="text-xs uppercase tracking-widest text-gray-500">Gautam Buddha Mahila College, Gaya</p>
              <h2 className="text-xl font-bold mt-1">CIA Examination Result</h2>
              <p className="text-xs text-gray-400 mt-1">Printed on {new Date().toLocaleString("en-IN")}</p>
            </div>

            {/* Student + Test Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ["Student", result.studentName],
                  ["Roll Number", result.rollNumber],
                  ["Course", `${result.course} · ${result.session}`],
                  ["Semester", `Sem ${semesterLabel(result.semester)}`],
                  ["Test", test.title],
                  ["Subject", test.subject],
                  ["Submitted", submittedOn],
                  ["Time Taken", `${minutes}m ${seconds}s of ${test.duration} min`],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <span className="text-gray-400 text-xs">{k}</span>
                    <p className="font-medium text-gray-900 text-sm break-words">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Score card — always show if result is published */}
            {!test.isResultPublished ? (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                  <div className="text-3xl mb-2">📋</div>
                  <h3 className="font-semibold text-amber-800">Test Submitted Successfully</h3>
                  <p className="text-sm text-amber-700 mt-2">Results will be published by your teacher.</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-gray-500">
                  <span className="text-xl">🔍</span>
                  <p>Your score and question-by-question review will appear here once your teacher publishes the results.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Main score */}
                <div className="bg-white rounded-xl border-2 border-[#1e3a5f] p-6 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Marks Obtained</p>
                  <div className="text-6xl font-bold text-[#1e3a5f] mb-1">
                    {result.score}
                    <span className="text-3xl text-gray-400 font-normal"> / {result.maxScore}</span>
                  </div>
                  <div className="text-2xl font-semibold text-gray-700 mt-1">{result.percentage.toFixed(1)}%</div>
                  <div className={`text-xl font-bold mt-2 ${gradeColor}`}>{grade}</div>
                </div>

                {/* Rank + time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Class Rank</p>
                    <p className="text-3xl font-bold text-[#1e3a5f]">
                      {result.rank === 1 ? "🥇" : result.rank === 2 ? "🥈" : result.rank === 3 ? "🥉" : ""}
                      #{result.rank}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">by score · time as tiebreaker</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Time Taken</p>
                    <p className="text-2xl font-bold text-gray-700">{minutes}m {seconds}s</p>
                    <p className="text-xs text-gray-400 mt-1">of {test.duration} min allowed</p>
                  </div>
                </div>

                {/* Grade scale */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Grade Scale</h3>
                  <div className="space-y-1">
                    {[
                      { label: "Distinction",     min: 85, color: "text-purple-700" },
                      { label: "First Division",  min: 60, color: "text-green-700"  },
                      { label: "Second Division", min: 50, color: "text-blue-700"   },
                      { label: "Third Division",  min: 40, color: "text-yellow-700" },
                      { label: "Fail",            min: 0,  color: "text-red-700"    },
                    ].map((g) => (
                      <div
                        key={g.label}
                        className={`flex justify-between text-sm px-3 py-1.5 rounded-lg ${grade === g.label ? "bg-gray-100 font-semibold" : ""}`}
                      >
                        <span className={grade === g.label ? g.color : "text-gray-500"}>{g.label}</span>
                        <span className="text-gray-400 text-xs">≥ {g.min}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Question Review */}
                {test.questions?.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800">Question Review</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{test.questions.length} questions · tap each to see right/wrong</p>
                      </div>
                      <div className="flex gap-3 text-xs">
                        <span className="flex items-center gap-1 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Correct</span>
                        <span className="flex items-center gap-1 text-red-500"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Wrong</span>
                        <span className="flex items-center gap-1 text-gray-400"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Skipped</span>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {test.questions.map((q, idx) => {
                        const ans = result.answers?.find((a) => String(a.questionId) === String(q._id))
                        const chosen = ans?.chosenIndex ?? null
                        const isSkipped = chosen === null || chosen === undefined
                        const isCorrect = !isSkipped && chosen === q.correctIndex
                        const marksLabel = isSkipped
                          ? "Not attempted · 0 marks"
                          : isCorrect
                            ? `+${q.marks} mark${q.marks !== 1 ? "s" : ""}`
                            : q.negMarks > 0
                              ? `−${q.negMarks} mark${q.negMarks !== 1 ? "s" : ""} (wrong answer)`
                              : "0 marks (wrong answer)"

                        return (
                          <div key={q._id} className="p-4">
                            {/* Question */}
                            <div className="flex items-start gap-2 mb-3">
                              <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                isSkipped ? "bg-gray-100 text-gray-500" :
                                isCorrect ? "bg-green-100 text-green-700" :
                                "bg-red-100 text-red-600"
                              }`}>{idx + 1}</span>
                              <p className="text-sm text-gray-800 leading-snug flex-1 min-w-0">{q.text}</p>
                            </div>

                            {/* Options */}
                            <div className="ml-0 sm:ml-9 space-y-1.5 mb-2">
                              {q.options.map((opt, oi) => {
                                const isChosen = chosen === oi
                                const isRight  = q.correctIndex === oi
                                const bg =
                                  isChosen && isRight  ? "bg-green-50 border-green-300" :
                                  isChosen && !isRight ? "bg-red-50 border-red-300" :
                                  isRight              ? "bg-green-50 border-green-200" :
                                                         "bg-gray-50 border-transparent"
                                const dotBg =
                                  isChosen && isRight  ? "bg-green-600 text-white" :
                                  isChosen && !isRight ? "bg-red-500 text-white" :
                                  isRight              ? "bg-green-500 text-white" :
                                                         "bg-gray-200 text-gray-500"
                                return (
                                  <div key={oi} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${bg}`}>
                                    <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold shrink-0 mt-0.5 ${dotBg}`}>
                                      {String.fromCharCode(65 + oi)}
                                    </span>
                                    <span className={`flex-1 min-w-0 ${(isChosen || isRight) ? "font-medium text-gray-900" : "text-gray-700"}`}>
                                      <span className="block">{opt}</span>
                                      {isChosen && isRight  && <span className="block text-xs text-green-600 mt-0.5">✓ Your answer · Correct</span>}
                                      {isChosen && !isRight && <span className="block text-xs text-red-500 mt-0.5">✗ Your answer · Wrong</span>}
                                      {!isChosen && isRight && <span className="block text-xs text-green-600 mt-0.5">✓ Correct answer</span>}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Marks badge */}
                            <p className={`ml-0 sm:ml-9 text-xs font-semibold ${
                              isSkipped ? "text-gray-400" :
                              isCorrect ? "text-green-600" : "text-red-500"
                            }`}>{marksLabel}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Class Leaderboard */}
                {leaderboard.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-800">Class Leaderboard</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{leaderboard.length} students · ranked by score, then time</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <th className="px-3 py-2 text-center w-10">Rank</th>
                            <th className="px-3 py-2 text-left">Student</th>
                            <th className="px-3 py-2 text-center">Score</th>
                            <th className="px-3 py-2 text-center">%</th>
                            <th className="px-3 py-2 text-center">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {leaderboard.map((entry) => {
                            const isMe = entry._id === attemptId
                            const entryMin = Math.floor(entry.timeTaken / 60)
                            const entrySec = entry.timeTaken % 60
                            return (
                              <tr
                                key={entry._id}
                                className={isMe ? "bg-blue-50 font-semibold" : "hover:bg-gray-50"}
                              >
                                <td className="px-3 py-2.5 text-center font-bold text-[#1e3a5f]">
                                  {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                                </td>
                                <td className="px-3 py-2.5">
                                  <p className={isMe ? "text-[#1e3a5f]" : "text-gray-800"}>{entry.studentName}</p>
                                  <p className="text-xs text-gray-400">{entry.rollNumber}</p>
                                </td>
                                <td className="px-3 py-2.5 text-center text-gray-700">
                                  {entry.score}<span className="text-gray-400 text-xs">/{entry.maxScore}</span>
                                </td>
                                <td className="px-3 py-2.5 text-center text-gray-600">{entry.percentage.toFixed(1)}%</td>
                                <td className="px-3 py-2.5 text-center text-gray-500 text-xs">{entryMin}m {entrySec}s</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="text-center pt-2 no-print">
            <Link
              href="/"
              className="inline-block bg-[#1e3a5f] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </main>
      </div>
    </>
  )
}

export default function ResultPageWrapper({ params }: { params: Promise<{ attemptId: string }> }) {
  return <Suspense><ResultPage params={params} /></Suspense>
}
