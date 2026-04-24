
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
  BellRing,
  ChevronRight,
  MessageSquareQuote,
  ScrollText,
  PlusCircle,
  Utensils
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarFooter,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc } from "firebase/firestore"
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
  const [authId, setAuthId] = React.useState("")
  const [assignedBuildingId, setAssignedBuildingId] = React.useState("")

  React.useEffect(() => {
    const role = localStorage.getItem("user_role") || "Manager"
    const name = localStorage.getItem("user_name") || "User"
    const branch = localStorage.getItem("user_branch") || "Main Branch"
    const id = localStorage.getItem("somikoron_auth_id") || ""
    const bId = localStorage.getItem("assigned_building_id") || "none"
    
    setUserRole(role)
    setUserName(name)
    setUserBranch(branch)
    setAuthId(id)
    setAssignedBuildingId(bId)
  }, [])

  // Fetch current user's direct entry permissions
  const staffRef = useMemoFirebase(() => authId ? doc(db, "staff", authId) : null, [db, authId])
  const { data: staffData } = useDoc(staffRef)

  const branchesQuery = useMemoFirebase(() => collection(db, "branches"), [db])
  const { data: branches } = useCollection(branchesQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "students"), where("branch", "==", userBranch), where("isActive", "==", true))
  }, [db, userBranch])
  const { data: students } = useCollection(studentsQuery)

  const birthdayCount = React.useMemo(() => {
    if (!students) return 0
    const today = new Date()
    const todayStr = `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
    return students.filter(s => s.dob?.endsWith(todayStr)).length
  }, [students])

  // Intelligent URL for Buildings based on role
  const buildingsUrl = (userRole === 'Building Manager' && assignedBuildingId !== 'none') 
    ? `/buildings/${assignedBuildingId}` 
    : "/buildings";

  // Menu Definition with strict role access
  const items = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["Admin", "Branch Manager"] },
    { title: "Students", url: "/students", icon: Users, roles: ["Admin", "Branch Manager", "Building Manager"] },
    { title: "Buildings", url: buildingsUrl, icon: Building2, roles: ["Admin", "Branch Manager", "Building Manager"] },
    { title: "Due", url: "/dues", icon: CircleAlert, roles: ["Admin", "Branch Manager", "Building Manager"] },
    { title: "Payment Entry", url: "/payment-entry", icon: PlusCircle, roles: ["Building Manager"] },
    { title: "Expense Entry", url: "/expense-entry", icon: Receipt, roles: ["Building Manager"] },
    { title: "Bulk Meal Entry", url: "/bulk-meal-entry", icon: Utensils, roles: ["Admin", "Branch Manager", "Building Manager"] },
    { title: "Admission Requests", url: "/registrations", icon: UserPlus, roles: ["Admin", "Branch Manager"] },
    { title: "Income", url: "/income", icon: Wallet, roles: ["Admin", "Branch Manager"] },
    { title: "Receipts", url: "/receipts", icon: ScrollText, roles: ["Admin", "Branch Manager"] },
    { title: "Expense", url: "/expenses", icon: Receipt, roles: ["Admin", "Branch Manager"] },
    { title: "Ledgers", url: "/ledger", icon: History, roles: ["Admin", "Branch Manager"] },
    { title: "SMS Panel", url: "/sms", icon: MessageSquareQuote, roles: ["Admin"], badge: birthdayCount > 0 ? birthdayCount : null },
    { title: "Staff & Roles", url: "/staff", icon: UserCog, roles: ["Admin"] },
    { title: "Branches", url: "/branches", icon: MapPin, roles: ["Admin"] },
    { title: "Transfers", url: "/transfers", icon: ArrowLeftRight, roles: ["Admin", "Branch Manager"] },
    { title: "Reports", url: "/reports", icon: BarChart3, roles: ["Admin", "Branch Manager"] },
    { title: "Settings", url: "/settings", icon: Settings, roles: ["Admin"] },
  ]

  const filteredItems = items.filter(item => {
    // 1. Base Role Check
    const hasRole = item.roles.includes(userRole)
    if (!hasRole) return false

    // 2. Permission Check for Building Manager
    if (userRole === 'Building Manager') {
      if (item.title === "Payment Entry" && staffData?.canDirectEntryIncome !== true) return false
      if (item.title === "Expense Entry" && staffData?.canDirectEntryExpense !== true) return false
      if (item.title === "Bulk Meal Entry" && staffData?.canDirectEntryBulkMeal !== true) return false
    }

    return true
  })

  const handleLogout = () => {
    localStorage.clear()
    window.location.href = "/"
  }

  const handleBranchSwitch = (newBranch: string) => {
    localStorage.setItem("user_branch", newBranch)
    setUserBranch(newBranch)
    window.location.reload()
  }

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black text-primary tracking-tight group-data-[collapsible=icon]:hidden">Somikoron</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {filteredItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild 
                  isActive={pathname === item.url}
                  tooltip={item.title}
                >
                  <Link href={item.url} className="flex items-center w-full">
                    <item.icon />
                    <span>{item.title}</span>
                    {item.badge && (
                      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-black text-destructive-foreground animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4 space-y-4 group-data-[collapsible=icon]:hidden">
        <div className="flex flex-col gap-3">
          {userRole === 'Admin' && (
            <div className="space-y-1">
              <p className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Active Branch</p>
              <Select value={userBranch} onValueChange={handleBranchSwitch}>
                <SelectTrigger className="h-8 text-xs bg-secondary/50 border-none font-bold">
                  <SelectValue placeholder="Switch Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map(b => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col pt-1">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">{userBranch}</span>
            <span className="text-[9px] text-primary font-medium">{userName} ({userRole})</span>
          </div>
        </div>

        {userRole !== 'Admin' && (
          <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 h-9" onClick={handleLogout}>
            <LogOut size={16} />
            <span className="text-xs">Logout Session</span>
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
