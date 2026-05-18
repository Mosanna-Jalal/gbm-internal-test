"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function SetupPage() {
  const router  = useRouter()
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [msg, setMsg]       = useState("")

  async function handleSetup() {
    setStatus("loading")
    try {
      const res  = await fetch("/api/admin/seed", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setStatus("done")
        setMsg(`All ${data.seeded} accounts created successfully.`)
      } else {
        setStatus("error")
        setMsg(data.error ?? "Setup failed")
      }
    } catch {
      setStatus("error")
      setMsg("Network error")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-xs tracking-widest uppercase text-gray-500 mb-1">
          Gautam Buddha Mahila College, Gaya
        </p>
        <h1 className="text-2xl font-bold text-[#1e3a5f] mb-1">First-Time Setup</h1>
        <p className="text-sm text-gray-500 mb-8">Create the master admin and all subject admin accounts</p>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          {status === "idle" && (
            <>
              <p className="text-sm text-gray-600">
                This will create <strong>masteradmin</strong> and 17 subject admin accounts in the database.
              </p>
              <button
                onClick={handleSetup}
                className="w-full bg-[#1e3a5f] hover:bg-[#162d4a] text-white py-3 rounded-lg font-medium transition-colors"
              >
                Initialize System
              </button>
            </>
          )}

          {status === "loading" && (
            <div className="py-4">
              <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Creating accounts...</p>
            </div>
          )}

          {status === "done" && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-700 font-semibold">✓ Setup complete!</p>
                <p className="text-sm text-green-600 mt-1">{msg}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left text-sm space-y-1">
                <p className="font-semibold text-gray-700">Master Admin Login:</p>
                <p>Username: <strong className="font-mono">masteradmin</strong></p>
                <p>Password: <strong className="font-mono">KingwithacapitalK</strong></p>
              </div>
              <button
                onClick={() => router.push("/admin/login")}
                className="w-full bg-[#1e3a5f] hover:bg-[#162d4a] text-white py-3 rounded-lg font-medium transition-colors"
              >
                Go to Login →
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 font-semibold">Setup failed</p>
                <p className="text-sm text-red-600 mt-1">{msg}</p>
              </div>
              <button
                onClick={() => setStatus("idle")}
                className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50"
              >
                Try Again
              </button>
            </>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Already set up?{" "}
          <a href="/admin/login" className="text-[#1e3a5f] hover:underline">Go to Login</a>
        </p>
      </div>
    </div>
  )
}
