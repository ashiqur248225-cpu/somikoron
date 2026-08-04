
"use client"

import { usePathname, useRouter } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { useState, useEffect } from "react"
import { LayoutDashboard, Utensils, UserCircle, Soup, ChefHat, Wallet, BellRing } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "")
  }, [pathname])

  const isPublicPage = pathname.startsWith('/register') || pathname.startsWith('/hostel-registration')
  
  // Roles that use a limited/simplified UI without the main Admin sidebar
  const isLimitedUI = ['Staff', 'Worker', 'General Staff', 'Student'].includes(userRole)

  if (isPublicPage) {
    return <main className="min-h-screen bg-background">{children}</main>
  }

  const staffNavItems = [
    { title: "Kitchen", url: "/meals-dashboard", icon: ChefHat },
    { title: "Routine", url: "/meal-routine", icon: Soup },
    { title: "Profile", url: "/profile", icon: UserCircle },
  ]

  const studentNavItems = [
    { title: "Home", url: "/student/dashboard", icon: LayoutDashboard },
    { title: "Meals", url: "/student/meals", icon: Utensils },
    { title: "Payment", url: "/student/payments", icon: Wallet },
    { title: "Notice", url: "/student/notices", icon: BellRing },
    { title: "Profile", url: "/student/profile", icon: UserCircle },
  ]

  const bottomNavItems = userRole === 'Student' ? studentNavItems : staffNavItems;

  return (
    <SidebarProvider defaultOpen={!isLimitedUI}>
      {!isLimitedUI && <AppSidebar />}
      <SidebarInset>
        <main className={cn(
          "flex-1 p-4 md:p-8",
          isLimitedUI && "pb-24 md:pb-8"
        )}>
          {children}
        </main>

        {/* Bottom Nav for Limited UI Roles (Students, Workers) */}
        {isLimitedUI && (
          <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 flex items-center justify-around px-2 z-50 md:hidden shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
            {bottomNavItems.map((item) => {
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
                  {isActive && <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1" />}
                </Link>
              )
            })}
          </nav>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
