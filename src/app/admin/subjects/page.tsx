"use client"

import { useState } from "react"

interface Cred { subject: string; username: string; password: string }
interface CredData { master: { username: string; password: string }; subjects: Cred[] }

export default function SubjectsPage() {
  const [data, setData]         = useState<CredData | null>(null)
  const [seeding, setSeeding]   = useState(false)
  const [msg, setMsg]           = useState("")
  const [revealed, setRevealed] = useState(false)

  async function load() {
    const res = await fetch("/api/admin/seed")
    if (res.ok) { setData(await res.json()); setRevealed(true) }
    else setMsg("Only master admin can view credentials.")
  }

  async function seed() {
    setSeeding(true); setMsg("")
    const res = await fetch("/api/admin/seed", { method: "POST" })
    const d   = await res.json()
    setMsg(res.ok ? `Seeded ${d.seeded} accounts successfully.` : (d.error ?? "Failed"))
    if (res.ok) await load()
    setSeeding(false)
  }

  function handlePrint() {
    window.print()
  }

  function handleDownloadCSV() {
    if (!data) return
    const rows = [
      ["Role", "Subject", "Username", "Password", "Access"],
      ["Master Admin", "ALL", data.master.username, data.master.password, "Full access"],
      ...data.subjects.map((s) => [
        "Subject Admin", s.subject, s.username, s.password, `${s.subject} tests & results only`,
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url
    a.download = "gbm-admin-credentials.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Print styles — hidden on screen, shown only when printing */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #cred-printable, #cred-printable * { visibility: visible; }
          #cred-printable { position: fixed; inset: 0; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6 no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subject Admin Credentials</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              One login per subject. Share each row only with the concerned teacher.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {!revealed ? (
              <button onClick={load}
                className="bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-4 py-2 rounded-lg text-sm font-medium">
                🔓 Show All Passwords
              </button>
            ) : (
              <>
                <button onClick={handlePrint}
                  className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5">
                  🖨️ Print
                </button>
                <button onClick={handleDownloadCSV}
                  className="border border-[#1e3a5f] text-[#1e3a5f] hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5">
                  ⬇️ Download CSV
                </button>
              </>
            )}
            <button onClick={seed} disabled={seeding}
              className="bg-[#8b1a1a] hover:bg-[#6f1515] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 no-print">
              {seeding ? "Seeding..." : "Re-seed Accounts"}
            </button>
          </div>
        </div>

        {msg && (
          <p className={`mb-4 text-sm px-4 py-2 rounded-lg no-print ${msg.includes("success") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {msg}
          </p>
        )}

        {!revealed && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
            Click <strong className="text-gray-600">🔓 Show All Passwords</strong> to view and export login credentials.
          </div>
        )}

        {data && (
          <div id="cred-printable">
            {/* Print header — only shown when printing */}
            <div className="hidden print:block mb-6 text-center border-b pb-4">
              <p className="text-xs uppercase tracking-widest text-gray-500">Gautam Buddha Mahila College, Gaya</p>
              <h2 className="text-xl font-bold mt-1">Admin Login Credentials</h2>
              <p className="text-xs text-gray-500 mt-1">Confidential — do not distribute publicly</p>
            </div>

            {/* Master admin card — screen only, hidden when printing */}
            <div className="bg-[#1e3a5f] text-white rounded-xl p-4 mb-4 print:hidden">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-blue-200 print:text-gray-500 uppercase tracking-wide font-semibold">Master Admin</p>
                <span className="text-xs bg-white/20 print:bg-gray-100 print:text-gray-700 text-white px-2 py-0.5 rounded-full">Full Access</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-300 print:text-gray-500 text-xs">Username</span>
                  <p className="font-mono font-bold text-lg mt-0.5">{data.master.username}</p>
                </div>
                <div>
                  <span className="text-blue-300 print:text-gray-500 text-xs">Password</span>
                  <p className="font-mono font-bold text-lg mt-0.5">{data.master.password}</p>
                </div>
              </div>
              <p className="text-xs text-blue-300 print:text-gray-500 mt-3">
                Can view all subjects, manage students, and access this credentials page.
              </p>
            </div>

            {/* Subject admins table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 text-sm">Subject Admin Logins ({data.subjects.length} subjects)</h3>
                <span className="text-xs text-gray-500">Login URL: <span className="font-mono">/admin/login</span></span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">#</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Subject</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Username</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.subjects.map((s, i) => (
                    <tr key={s.username} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{s.subject}</td>
                      <td className="px-4 py-2.5 font-mono text-[#1e3a5f]">{s.username}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">{s.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 print:block">
                Each subject admin can only view and manage tests & results for their own subject.
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
