
"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { 
  LayoutDashboard, 
  Utensils, 
  Wallet, 
  BellRing, 
  UserCircle 
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const navItems = [
    { title: "Home", url: "/student/dashboard", icon: LayoutDashboard },
    { title: "Meals", url: "/student/meals", icon: Utensils },
    { title: "Payment", url: "/student/payments", icon: Wallet },
    { title: "Notice", url: "/student/notices", icon: BellRing },
    { title: "Profile", url: "/student/profile", icon: UserCircle },
  ]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20 md:pb-0">
      <main className="flex-1 p-4 md:p-8 max-w-lg mx-auto w-full">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 flex items-center justify-around px-2 z-50 md:hidden shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const isActive = pathname === item.url
          return (
            <Link 
              key={item.url} 
              href={item.url} 
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 transition-all duration-300",
                isActive ? "text-primary scale-110" : "text-slate-400"
              )}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.title}</span>
              {isActive && <div className="w-1 h-1 bg-primary rounded-full animate-bounce" />}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
