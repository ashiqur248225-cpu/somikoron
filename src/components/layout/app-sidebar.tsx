
"use client"

import * as React from "react"
import { 
  Building2, 
  Users, 
  Wallet, 
  Receipt, 
  History, 
  LayoutDashboard, 
  BarChart3,
  Settings,
  CircleAlert,
  UserCog,
  ArrowLeftRight,
  UserPlus,
  LogOut
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarFooter,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  
  const userRole = typeof window !== 'undefined' ? localStorage.getItem("user_role") : "Manager"
  const userName = typeof window !== 'undefined' ? localStorage.getItem("user_name") : "User"
  const userBranch = typeof window !== 'undefined' ? localStorage.getItem("user_branch") : "Main"

  const items = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Buildings", url: "/buildings", icon: Building2 },
    { title: "Students", url: "/students", icon: Users },
    { title: "Pending Requests", url: "/registrations", icon: UserPlus },
    { title: "Income History", url: "/income", icon: Wallet },
    { title: "Expense History", url: "/expenses", icon: Receipt },
    { title: "Dues Tracking", url: "/dues", icon: CircleAlert },
    { title: "Ledgers", url: "/ledger", icon: History },
    { title: "Staff / Roles", url: "/staff", icon: UserCog, adminOnly: true },
    { title: "Transfers", url: "/transfers", icon: ArrowLeftRight },
    { title: "Reports", url: "/reports", icon: BarChart3 },
    { title: "Settings", url: "/settings", icon: Settings },
  ]

  const filteredItems = items.filter(item => !item.adminOnly || userRole === 'Admin')

  const handleLogout = () => {
    localStorage.clear()
    window.location.href = "/"
  }

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b px-4 py-4">
        <div className="flex flex-col gap-1">
          <span className="text-xl font-black text-primary tracking-tight group-data-[collapsible=icon]:hidden">Somikoron</span>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">{userBranch}</span>
            <span className="text-[9px] text-primary font-medium">{userName} ({userRole})</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Main Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {filteredItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild 
                  isActive={pathname === item.url}
                  tooltip={item.title}
                >
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4 group-data-[collapsible=icon]:hidden space-y-4">
        <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Logout Session</span>
        </Button>
        <div className="text-[10px] text-muted-foreground">© 2024 Somikoron v1.1.0</div>
      </SidebarFooter>
    </Sidebar>
  )
}
