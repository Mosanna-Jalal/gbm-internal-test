"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { semesterLabel } from "@/lib/constants"

interface Stats {
  totalQuestions: number
  totalTests: number
  totalAttempts: number
  recentTests: {
    _id: string
    title: string
    subject: string
    course: string
    session: string
    semester: number
    isPublished: boolean
    isResultPublished: boolean
    createdAt: string
  }[]
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [adminName, setAdminName] = useState("")
  const [studentCount, setStudentCount] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/admin/stats").then((r) => r.json()).then(setStats)
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setAdminName(d.name ?? ""))
    fetch("/api/admin/import-students").then((r) => r.json()).then((d) => setStudentCount(d.count ?? 0))
  }, [])

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {adminName && <p className="text-sm text-gray-500 mt-0.5">Welcome, {adminName}</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Questions", value: stats?.totalQuestions, icon: "❓", href: "/admin/tests" },
          { label: "Total Tests", value: stats?.totalTests, icon: "📝", href: "/admin/tests" },
          { label: "Total Attempts", value: stats?.totalAttempts, icon: "✍️", href: "/admin/tests" },
        ].map((s) => (
          <Link key={s.label} href={s.href}>
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="text-3xl font-bold text-[#1e3a5f]">
                {stats ? s.value : "—"}
              </div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link
          href="/admin/tests/new"
          className="bg-[#8b1a1a] text-white rounded-xl p-4 hover:bg-[#6f1515] transition-colors"
        >
          <div className="text-xl mb-1">+ Create Test</div>
          <div className="text-xs text-red-200">Create a new MCQ test with questions</div>
        </Link>
        <Link
          href="/admin/students"
          className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl p-4 transition-colors"
        >
          <div className="text-xl mb-1">🎓 Students</div>
          <div className="text-xs text-emerald-200">
            {studentCount !== null ? `${studentCount} in DB · ` : ""}Upload & manage admission lists
          </div>
        </Link>
      </div>


      {/* Recent Tests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Recent Tests</h2>
          <Link href="/admin/tests" className="text-sm text-[#1e3a5f] hover:underline">View all →</Link>
        </div>

        {!stats ? (
          <div className="text-sm text-gray-400 py-4">Loading...</div>
        ) : stats.recentTests.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
            No tests created yet.{" "}
            <Link href="/admin/tests/new" className="text-[#1e3a5f] underline">Create one</Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Sem</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.recentTests.map((t) => (
                  <tr key={t._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/tests/${t._id}`} className="font-medium text-[#1e3a5f] hover:underline">
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.subject}</td>
                    <td className="px-4 py-3 text-gray-600">Sem {semesterLabel(t.semester)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${t.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {t.isPublished ? "Published" : "Draft"}
                        </span>
                        {t.isResultPublished && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Results Out</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
