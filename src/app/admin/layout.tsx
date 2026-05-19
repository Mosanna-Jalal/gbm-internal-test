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
  { href: "/admin/dashboard", label: "Dashboard",   icon: "📊" },
  { href: "/admin/tests",     label: "Tests",        icon: "📝" },
  { href: "/admin/students",  label: "Students",     icon: "🎓" },
  { href: "/admin/subjects",  label: "Credentials",  icon: "🔑" },
]

const SUBJECT_NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/tests",     label: "Tests",      icon: "📝" },
  { href: "/admin/papers",    label: "Papers",     icon: "📄" },
  { href: "/admin/students",  label: "Students",   icon: "🎓" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router    = useRouter()
  const pathname  = usePathname()
  const [loggingOut, setLoggingOut]   = useState(false)
  const [adminInfo, setAdminInfo]     = useState<AdminInfo | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (pathname === "/admin/login") return
    setLoggingOut(false)
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.role) setAdminInfo(d)
    })
  }, [pathname])

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  async function handleLogout() {
    setLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/admin/login")
  }

  if (pathname === "/admin/login") return <>{children}</>

  const nav = adminInfo?.role === "subject" ? SUBJECT_NAV : MASTER_NAV

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">

      {/* Mobile overlay backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col w-64
        bg-[#1e3a5f] text-white
        transition-transform duration-300 ease-in-out
        lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:w-56 lg:shrink-0 lg:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Mobile close button row */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-blue-800 lg:hidden">
          <span className="text-sm font-semibold text-blue-100">Menu</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-blue-200 hover:text-white"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sidebar header */}
        <div className="px-4 py-5 border-b border-blue-800">
          <p className="text-xs text-blue-300 uppercase tracking-widest">GBM College</p>
          {adminInfo?.role === "subject" ? (
            <>
              <h2 className="font-bold text-sm mt-0.5 leading-snug">{adminInfo.subject}</h2>
              <p className="text-xs text-blue-400 mt-0.5">Dept. Admin</p>
            </>
          ) : (
            <h2 className="font-bold text-sm mt-0.5">Master Admin</h2>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
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

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 bg-[#1e3a5f] text-white px-4 py-3 flex items-center gap-3 shadow-md lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 -ml-1 text-white"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-xs text-blue-300 uppercase tracking-widest leading-none">GBM College</p>
            <p className="text-sm font-semibold leading-tight mt-0.5 truncate">
              {adminInfo?.role === "subject" ? (adminInfo.subject ?? "Admin") : "Master Admin"}
            </p>
          </div>
        </header>

        <main className="flex-1 overflow-auto page-enter">
          {children}
        </main>
      </div>
    </div>
  )
}
