"use client"

import { useEffect, useState } from "react"

interface Paper {
  _id: string
  name: string
  department: string
}

export default function PapersPage() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")
  const [department, setDepartment] = useState("")

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.subject) setDepartment(d.subject)
    })
    fetchPapers()
  }, [])

  async function fetchPapers() {
    const res = await fetch("/api/papers")
    if (res.ok) setPapers(await res.json())
    setLoading(false)
  }

  async function addPaper(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true); setError("")
    const res = await fetch("/api/papers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (res.ok) {
      const paper = await res.json()
      setPapers((prev) => [...prev, paper].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName("")
    } else {
      const d = await res.json()
      setError(d.error ?? "Failed to add paper")
    }
    setAdding(false)
  }

  async function deletePaper(id: string, name: string) {
    if (!confirm(`Remove paper "${name}"? Tests already created with this paper are not affected.`)) return
    await fetch(`/api/papers/${id}`, { method: "DELETE" })
    setPapers((prev) => prev.filter((p) => p._id !== id))
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Papers</h1>
        {department && (
          <p className="text-sm text-gray-500 mt-1">
            Department: <span className="font-semibold text-[#1e3a5f]">{department}</span>
          </p>
        )}
        <p className="text-xs text-gray-400 mt-1">Add the paper names for your department. These appear as options when creating a test.</p>
      </div>

      {/* Add paper form */}
      <form onSubmit={addPaper} className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add New Paper</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Hindi Prose and Poetry, Hindi Grammar..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162d4a] disabled:opacity-50 transition-colors"
          >
            {adding ? "Adding..." : "+ Add"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </form>

      {/* Papers list */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : papers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No papers added yet. Add your first paper above.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{papers.length} paper{papers.length !== 1 ? "s" : ""}</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {papers.map((p) => (
              <li key={p._id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-800 font-medium">{p.name}</span>
                <button
                  onClick={() => deletePaper(p._id, p.name)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
