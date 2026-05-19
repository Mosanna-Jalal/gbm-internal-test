"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { semesterLabel } from "@/lib/constants"

interface Question {
  _id: string
  text: string
  options: string[]
  marks: number
}

interface TestData {
  _id: string
  title: string
  subject: string
  course: string
  session: string
  semester: number
  duration: number
  totalMarks: number
  questions: Question[]
}

const OPTION_LABELS = ["A", "B", "C", "D"]

function TestPage({ params }: { params: Promise<{ testId: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const roll = searchParams.get("roll") ?? ""
  const name = searchParams.get("name") ?? ""
  const course = searchParams.get("course") ?? ""
  const session = searchParams.get("session") ?? ""
  const semester = parseInt(searchParams.get("semester") ?? "1")

  const [testId, setTestId] = useState<string>("")
  const [test, setTest] = useState<TestData | null>(null)
  const [answers, setAnswers] = useState<Record<string, number | null>>({})
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const startTimeRef = useRef<number>(0)

  // Resolve params
  useEffect(() => {
    params.then(({ testId: id }) => setTestId(id))
  }, [params])

  // Load test
  useEffect(() => {
    if (!testId || !roll) return

    const storageKey = `test_start_${testId}_${roll}`
    const stored = localStorage.getItem(storageKey)

    async function loadTest() {
      try {
        const res = await fetch(`/api/tests/${testId}?roll=${encodeURIComponent(roll)}`)
        if (!res.ok) {
          const data = await res.json()
          setError(data.error ?? "Test not available")
          setLoading(false)
          return
        }
        const data: TestData = await res.json()
        setTest(data)

        // Initialize timer
        let start = stored ? parseInt(stored) : Date.now()
        if (!stored) {
          localStorage.setItem(storageKey, String(start))
        }
        startTimeRef.current = start
        const elapsed = Math.floor((Date.now() - start) / 1000)
        const remaining = Math.max(0, data.duration * 60 - elapsed)
        setTimeLeft(remaining)

        // Restore saved answers
        const savedAnswers = localStorage.getItem(`test_answers_${testId}_${roll}`)
        if (savedAnswers) {
          setAnswers(JSON.parse(savedAnswers))
        }
      } catch {
        setError("Failed to load test")
      } finally {
        setLoading(false)
      }
    }

    loadTest()
  }, [testId, roll])

  // Timer countdown
  useEffect(() => {
    if (!test || timeLeft <= 0) return
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          handleSubmit(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test, timeLeft > 0])

  // Save answers to localStorage on change
  useEffect(() => {
    if (testId && roll && Object.keys(answers).length > 0) {
      localStorage.setItem(`test_answers_${testId}_${roll}`, JSON.stringify(answers))
    }
  }, [answers, testId, roll])

  const handleAnswer = (questionId: string, shuffledIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: prev[questionId] === shuffledIndex ? null : shuffledIndex,
    }))
  }

  const handleSubmit = useCallback(
    async (autoSubmit = false) => {
      if (!test || submitting) return
      setSubmitting(true)
      setShowConfirm(false)

      const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000)

      const answersPayload = test.questions.map((q) => ({
        questionId: q._id,
        chosenShuffledIndex: answers[q._id] ?? null,
      }))

      try {
        const res = await fetch("/api/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testId: test._id,
            rollNumber: roll,
            studentName: name,
            course,
            session,
            semester,
            answers: answersPayload,
            timeTaken,
          }),
        })

        const data = await res.json()

        if (res.status === 409) {
          // Already attempted
          router.push(`/result/${data.attemptId}?roll=${roll}`)
          return
        }

        if (!res.ok) throw new Error(data.error)

        // Clean up localStorage
        localStorage.removeItem(`test_start_${testId}_${roll}`)
        localStorage.removeItem(`test_answers_${testId}_${roll}`)

        router.push(`/result/${data.attemptId}?roll=${roll}`)
      } catch {
        if (!autoSubmit) {
          alert("Submission failed. Please try again.")
          setSubmitting(false)
        }
      }
    },
    [test, submitting, answers, roll, name, course, session, semester, testId, router]
  )

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  const answeredCount = Object.values(answers).filter((v) => v !== null).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading test...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center max-w-md">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-semibold text-red-700 mb-2">{error}</h2>
          <button
            onClick={() => router.push("/")}
            className="mt-4 text-sm text-[#1e3a5f] underline"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    )
  }

  if (!test) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 bg-[#1e3a5f] text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-sm leading-tight">{test.title}</h1>
            <p className="text-blue-200 text-xs">
              {test.subject} · Sem {semesterLabel(test.semester)} · {test.totalMarks} marks
            </p>
          </div>
          <div className="text-right">
            <div
              className={`text-xl font-mono font-bold ${
                timeLeft < 300 ? "text-red-300 animate-pulse" : "text-white"
              }`}
            >
              {formatTime(timeLeft)}
            </div>
            <div className="text-xs text-blue-200">
              {answeredCount}/{test.questions.length} answered
            </div>
          </div>
        </div>
      </header>

      {/* Student Info Bar */}
      <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 text-xs text-blue-700 text-center">
        {name} &nbsp;|&nbsp; Roll: {roll} &nbsp;|&nbsp; {course} · {session}
      </div>

      {/* Questions */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-6 md:pb-6">
        {test.questions.map((q, idx) => {
          const selected = answers[q._id]
          return (
            <div
              key={q._id}
              id={`q-${idx}`}
              className={`bg-white rounded-xl border p-5 shadow-sm transition-colors ${
                selected !== undefined && selected !== null
                  ? "border-blue-300"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-start gap-3 mb-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <p className="text-gray-900 text-sm leading-relaxed">{q.text}</p>
              </div>
              <div className="space-y-2 ml-0 sm:ml-10">
                {q.options.map((opt, optIdx) => {
                  const isSelected = selected === optIdx
                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleAnswer(q._id, optIdx)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                        isSelected
                          ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                          : "bg-gray-50 text-gray-800 border-gray-200 hover:border-[#1e3a5f] hover:bg-blue-50"
                      }`}
                    >
                      <span className="font-semibold mr-2">{OPTION_LABELS[optIdx]}.</span>
                      {opt}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2 ml-0 sm:ml-10">[{q.marks} mark{q.marks !== 1 ? "s" : ""}]</p>
            </div>
          )
        })}

        {/* Mobile question navigator (inline, above submit) */}
        <div className="md:hidden bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Jump to Question</p>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(2rem, 1fr))" }}>
            {test.questions.map((q, idx) => {
              const isAnswered = answers[q._id] !== null && answers[q._id] !== undefined
              return (
                <a
                  key={q._id}
                  href={`#q-${idx}`}
                  className={`h-8 rounded text-xs font-medium flex items-center justify-center transition-colors ${
                    isAnswered ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {idx + 1}
                </a>
              )
            })}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pb-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-sm text-gray-600 mb-1">
              Answered: <strong>{answeredCount}</strong> / {test.questions.length}
            </p>
            {answeredCount < test.questions.length && (
              <p className="text-xs text-orange-600 mb-3">
                {test.questions.length - answeredCount} question{test.questions.length - answeredCount !== 1 ? "s" : ""} unanswered — marked as skipped
              </p>
            )}
            <button
              onClick={() => setShowConfirm(true)}
              disabled={submitting}
              className="bg-[#8b1a1a] hover:bg-[#6f1515] text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Test"}
            </button>
          </div>
        </div>
      </main>

      {/* Question Navigator — desktop floating only */}
      <div className="hidden md:block fixed bottom-4 right-4 bg-white rounded-xl border border-gray-200 shadow-lg p-3 max-w-[200px]">
        <p className="text-xs font-medium text-gray-500 mb-2">Questions</p>
        <div className="grid grid-cols-5 gap-1">
          {test.questions.map((q, idx) => {
            const isAnswered = answers[q._id] !== null && answers[q._id] !== undefined
            return (
              <a
                key={q._id}
                href={`#q-${idx}`}
                className={`w-7 h-7 rounded text-xs font-medium flex items-center justify-center transition-colors ${
                  isAnswered
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {idx + 1}
              </a>
            )
          })}
        </div>
      </div>

      {/* Confirm Submit Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Submit Test?</h3>
            <p className="text-sm text-gray-600 mb-1">
              You have answered <strong>{answeredCount}</strong> out of{" "}
              <strong>{test.questions.length}</strong> questions.
            </p>
            {answeredCount < test.questions.length && (
              <p className="text-sm text-orange-600 mb-3">
                {test.questions.length - answeredCount} unanswered questions will score 0.
              </p>
            )}
            <p className="text-sm text-red-600 font-medium mb-4">
              You cannot change your answers after submission.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Review Answers
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="flex-1 bg-[#8b1a1a] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#6f1515] disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Confirm Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TestPageWrapper({ params }: { params: Promise<{ testId: string }> }) {
  return <Suspense><TestPage params={params} /></Suspense>
}
