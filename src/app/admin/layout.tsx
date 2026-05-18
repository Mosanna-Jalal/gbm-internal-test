"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"

interface AdminInfo {
  role: "master" | "subject"
  subject: string | null
  name: string
}

const MASTER_NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/tests",     label: "Tests",      icon: "📝" },
  { href: "/admin/students",  label: "Students",   icon: "🎓" },
  { href: "/admin/subjects",  label: "Credentials",icon: "🔑" },
]

const SUBJECT_NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/tests",     label: "Tests",      icon: "📝" },
  { href: "/admin/papers",    label: "Papers",     icon: "📄" },
  { href: "/admin/students",  label: "Students",   icon: "🎓" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)
  const [adminInfo, setAdminInfo]   = useState<AdminInfo | null>(null)

  useEffect(() => {
    if (pathname === "/admin/login") return
    setLoggingOut(false)
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.role) setAdminInfo(d)
    })
  }, [pathname])

  async function handleLogout() {
    setLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/admin/login")
  }

  if (pathname === "/admin/login") return <>{children}</>

  const nav = adminInfo?.role === "subject" ? SUBJECT_NAV : MASTER_NAV

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-56 bg-[#1e3a5f] text-white flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-blue-800">
          <p className="text-xs text-blue-300 uppercase tracking-widest">GBM College</p>
          {adminInfo?.role === "subject" ? (
            <>
              <h2 className="font-bold text-sm mt-0.5">{adminInfo.subject}</h2>
              <p className="text-xs text-blue-400 mt-0.5">Dept. Admin</p>
            </>
          ) : (
            <h2 className="font-bold text-sm mt-0.5">Master Admin</h2>
          )}
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-white/20 text-white font-medium"
                  : "text-blue-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 pb-10 border-t border-blue-800">
          <a href="/" target="_blank" className="block text-xs text-blue-300 hover:text-white mb-3">
            ↗ Student Portal
          </a>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full text-left text-xs text-blue-300 hover:text-white disabled:opacity-60"
          >
            {loggingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
