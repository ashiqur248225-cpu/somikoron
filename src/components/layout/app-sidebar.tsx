
"use client"

import * as React from "react"
import { 
  Building2, 
  Users, 
  Wallet, 
  Receipt, 
  History, 
  LayoutDashboard, 
  Contact, 
  BarChart3,
  CircleDollarSign,
  Settings,
  CircleAlert,
  UserCog,
  ArrowLeftRight
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
  useSidebar
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"

const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Buildings",
    url: "/buildings",
    icon: Building2,
  },
  {
    title: "Students",
    url: "/students",
    icon: Users,
  },
  {
    title: "Income History",
    url: "/income",
    icon: Wallet,
  },
  {
    title: "Expense History",
    url: "/expenses",
    icon: Receipt,
  },
  {
    title: "Dues Tracking",
    url: "/dues",
    icon: CircleAlert,
  },
  {
    title: "Ledgers",
    url: "/ledger",
    icon: History,
  },
  {
    title: "Staff",
    url: "/staff",
    icon: UserCog,
  },
  {
    title: "Transfers",
    url: "/transfers",
    icon: ArrowLeftRight,
  },
  {
    title: "Parties",
    url: "/parties",
    icon: Contact,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b px-4 py-4">
        <div className="flex items-center gap-2 font-headline font-bold text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CircleDollarSign size={20} />
          </div>
          <span className="text-xl tracking-tight group-data-[collapsible=icon]:hidden">Somikoron</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Main Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {items.map((item) => (
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
      <SidebarFooter className="border-t p-4 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
        © 2024 Somikoron v1.0
      </SidebarFooter>
    </Sidebar>
  )
}
