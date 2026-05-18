"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { semesterLabel } from "@/lib/constants"

interface Test {
  _id: string
  title: string
  subject: string
  paper: string
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
  createdAt: string
}

export default function TestsPage() {
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchTests() {
    const res = await fetch("/api/tests")
    setTests(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchTests() }, [])

  async function toggleField(id: string, field: "isPublished" | "isResultPublished", current: boolean) {
    await fetch(`/api/tests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !current }),
    })
    setTests((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [field]: !current } : t))
    )
  }

  async function deleteTest(id: string) {
    if (!confirm("Delete this test? All attempts will remain but the test will be removed.")) return
    await fetch(`/api/tests/${id}`, { method: "DELETE" })
    setTests((prev) => prev.filter((t) => t._id !== id))
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tests</h1>
        <Link
          href="/admin/tests/new"
          className="bg-[#8b1a1a] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6f1515]"
        >
          + Create Test
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : tests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No tests yet.{" "}
          <Link href="/admin/tests/new" className="text-[#1e3a5f] underline">Create one</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {tests.map((t) => (
              <div key={t._id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/tests/${t._id}`} className="font-semibold text-[#1e3a5f] hover:underline">
                        {t.title}
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{t.paper || t.subject}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t.subject}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.course} · {t.session}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Sem {semesterLabel(t.semester)}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.duration} min</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.totalMarks} marks</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      By: <span className="text-gray-500 font-medium">{t.createdBy}</span>
                      {" · "}Starts: {new Date(t.startTime).toLocaleString("en-IN")}
                      {t.endTime && ` · Ends: ${new Date(t.endTime).toLocaleString("en-IN")}`}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleField(t._id, "isPublished", t.isPublished)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          t.isPublished
                            ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                            : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                        }`}
                      >
                        {t.isPublished ? "✓ Published" : "Publish"}
                      </button>
                      <button
                        onClick={() => toggleField(t._id, "isResultPublished", t.isResultPublished)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          t.isResultPublished
                            ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
                            : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                        }`}
                      >
                        {t.isResultPublished ? "✓ Results Out" : "Publish Results"}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/tests/${t._id}`}
                        className="text-xs text-[#1e3a5f] hover:underline"
                      >
                        View Attempts
                      </Link>
                      <button
                        onClick={() => deleteTest(t._id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
