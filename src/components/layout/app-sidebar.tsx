
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
  ScrollText
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const db = useFirestore()
  
  const [userRole, setUserRole] = React.useState("")
  const [userName, setUserName] = React.useState("")
  const [userBranch, setUserBranch] = React.useState("")

  React.useEffect(() => {
    const role = localStorage.getItem("user_role") || "Manager"
    const name = localStorage.getItem("user_name") || "User"
    let branch = localStorage.getItem("user_branch")
    
    if (!branch) {
      branch = "Main Branch"
      localStorage.setItem("user_branch", branch)
    }

    setUserRole(role)
    setUserName(name)
    setUserBranch(branch)
  }, [])

  const branchesQuery = useMemoFirebase(() => collection(db, "branches"), [db])
  const { data: branches } = useCollection(branchesQuery)

  // Strict Menu Access Definition
  const items = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["Admin", "Branch Manager", "Building Manager"] },
    { title: "Buildings", url: "/buildings", icon: Building2, roles: ["Admin", "Branch Manager", "Building Manager"] },
    { title: "Students", url: "/students", icon: Users, roles: ["Admin", "Branch Manager", "Building Manager"] },
    { title: "Admission Requests", url: "/registrations", icon: UserPlus, roles: ["Admin", "Branch Manager"] },
    { title: "Manager Requests", url: "/manager-requests", icon: BellRing, roles: ["Admin", "Branch Manager"] },
    { title: "Income", url: "/income", icon: Wallet, roles: ["Admin", "Branch Manager", "Building Manager"] },
    { title: "Receipts", url: "/receipts", icon: ScrollText, roles: ["Admin", "Branch Manager", "Building Manager"] },
    { title: "Expense", url: "/expenses", icon: Receipt, roles: ["Admin", "Branch Manager", "Building Manager"] },
    { title: "Due", url: "/dues", icon: CircleAlert, roles: ["Admin", "Branch Manager", "Building Manager"] },
    { title: "Ledgers", url: "/ledger", icon: History, roles: ["Admin", "Branch Manager"] },
    { title: "SMS Panel", url: "/sms", icon: MessageSquareQuote, roles: ["Admin", "Branch Manager"] },
    { title: "Staff & Roles", url: "/staff", icon: UserCog, roles: ["Admin"] },
    { title: "Branches", url: "/branches", icon: MapPin, roles: ["Admin"] },
    { title: "Transfers", url: "/transfers", icon: ArrowLeftRight, roles: ["Admin", "Branch Manager"] },
    { title: "Reports", url: "/reports", icon: BarChart3, roles: ["Admin", "Branch Manager"] },
    { title: "Settings", url: "/settings", icon: Settings, roles: ["Admin", "Branch Manager"] },
  ]

  const filteredItems = items.filter(item => item.roles.includes(userRole))

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
              <React.Fragment key={item.title}>
                {item.subItems ? (
                  <Collapsible asChild defaultOpen={pathname.startsWith(item.url)} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.title}>
                          <item.icon />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.subItems.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                                <Link href={subItem.url}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem>
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
                )}
              </React.Fragment>
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
