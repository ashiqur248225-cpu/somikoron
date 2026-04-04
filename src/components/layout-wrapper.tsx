
"use client"

import { usePathname } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublicPage = pathname.startsWith('/register') || pathname.startsWith('/hostel-registration')

  if (isPublicPage) {
    return <main className="min-h-screen bg-background">{children}</main>
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
