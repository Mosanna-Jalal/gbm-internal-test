"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: { preventDefault(): void }) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Login failed")
        return
      }
      // Tell the browser's password manager to save/update credentials
      // (needed for fetch-based logins on mobile — browser can't detect success otherwise)
      if (typeof window !== "undefined" && "PasswordCredential" in window) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cred = new (window as any).PasswordCredential({ id: username, password })
          await navigator.credentials.store(cred)
        } catch {}
      }
      router.push("/admin/dashboard")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-xs tracking-widest uppercase text-gray-500 mb-1">
            Gautam Buddha Mahila College, Gaya
          </p>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Admin Login</h1>
          <p className="text-sm text-gray-500 mt-1">MCQ Test Management Portal</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. masteradmin"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                required
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e3a5f] hover:bg-[#162d4a] text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center mt-4 text-xs text-gray-400">
          Student portal:{" "}
          <a href="/" className="text-[#1e3a5f] hover:underline">Go to Home</a>
          {" "}&nbsp;|&nbsp;{" "}
          <a href="/admin/setup" className="text-gray-400 hover:text-[#1e3a5f]">First-time setup</a>
        </p>
      </div>
    </div>
  )
}
