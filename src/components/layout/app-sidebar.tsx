
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
  LogOut,
  MapPin,
  RefreshCw
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
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const db = useFirestore()
  
  const [userRole, setUserRole] = React.useState("")
  const [userName, setUserName] = React.useState("")
  const [userBranch, setUserBranch] = React.useState("")

  React.useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserName(localStorage.getItem("user_name") || "User")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
  }, [])

  const branchesQuery = useMemoFirebase(() => collection(db, "branches"), [db])
  const { data: branches } = useCollection(branchesQuery)

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
    { title: "Branches", url: "/branches", icon: MapPin, adminOnly: true },
    { title: "Transfers", url: "/transfers", icon: ArrowLeftRight },
    { title: "Reports", url: "/reports", icon: BarChart3 },
    { title: "Settings", url: "/settings", icon: Settings },
  ]

  const filteredItems = items.filter(item => !item.adminOnly || userRole === 'Admin')

  const handleLogout = () => {
    localStorage.clear()
    window.location.href = "/"
  }

  const handleBranchSwitch = (newBranch: string) => {
    localStorage.setItem("user_branch", newBranch)
    setUserBranch(newBranch)
    window.location.reload() // Force reload to refresh all queries
  }

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b px-4 py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg text-white">
              <RefreshCw size={18} className="group-data-[collapsible=icon]:rotate-90 transition-transform" />
            </div>
            <span className="text-xl font-black text-primary tracking-tight group-data-[collapsible=icon]:hidden">Somikoron</span>
          </div>
          
          {userRole === 'Admin' && (
            <div className="group-data-[collapsible=icon]:hidden space-y-1">
              <p className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Active Branch</p>
              <Select value={userBranch} onValueChange={handleBranchSwitch}>
                <SelectTrigger className="h-8 text-xs bg-secondary/50 border-none font-bold">
                  <SelectValue placeholder="Switch Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Branches">All Branches</SelectItem>
                  {branches?.map(b => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col group-data-[collapsible=icon]:hidden pt-1">
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
        {userRole !== 'Admin' && (
          <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Logout Session</span>
          </Button>
        )}
        <div className="text-[10px] text-muted-foreground">© 2024 Somikoron ERP</div>
      </SidebarFooter>
    </Sidebar>
  )
}
