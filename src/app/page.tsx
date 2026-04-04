
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Building2, 
  TrendingUp,
  Loader2,
  Plus,
  Wallet,
  DoorOpen,
  CalendarDays,
  CircleDollarSign,
  Smartphone,
  Banknote,
  Landmark,
  AlertCircle,
  Users,
  BellRing,
  Calendar as CalendarIcon,
  ChevronDown,
  Filter
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function DashboardPage() {
  const db = useFirestore()
  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")
  const [timeRange, setTimeRange] = useState("this_month")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserName(localStorage.getItem("user_name") || "User")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setAssignedBuildingId(localStorage.getItem("assigned_building_id") || "none")
  }, [])

  // 1. Fetch Buildings for this branch
  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "buildings"), where("id", "==", assignedBuildingId))
    }
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userRole, userBranch, assignedBuildingId])
  const { data: buildings, isLoading: buildingsLoading } = useCollection(buildingsQuery)

  // 2. Fetch Students for this branch
  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "students"), where("buildingId", "==", assignedBuildingId))
    }
    return query(collection(db, "students"), where("branch", "==", userBranch))
  }, [db, userRole, userBranch, assignedBuildingId])
  const { data: students, isLoading: studentsLoading } = useCollection(studentsQuery)

  // 3. Fetch All Payments for this branch
  const allPaymentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "payments"), where("buildingId", "==", assignedBuildingId))
    }
    return query(collection(db, "payments"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: allPayments, isLoading: paymentsLoading } = useCollection(allPaymentsQuery)

  // 4. Fetch All Expenses for this branch
  const allExpensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "expenses"), where("buildingId", "==", assignedBuildingId))
    }
    return query(collection(db, "expenses"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: allExpenses, isLoading: expensesLoading } = useCollection(allExpensesQuery)

  // 5. Pending Manager Requests
  const managerRequestsQuery = useMemoFirebase(() => {
    if (!userBranch || userRole === 'Building Manager') return null
    return query(collection(db, "managerRequests"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole])
  const { data: pendingMgrRequests } = useCollection(managerRequestsQuery)

  // 6. Opening Balances Config
  const balancesRef = useMemoFirebase(() => doc(db, "configs", "openingBalances"), [db])
  const { data: openingBalances } = useDoc(balancesRef)

  const isWithinRange = (date: Date, range: string) => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    if (range === 'today') {
      return date >= startOfToday
    }
    if (range === 'this_week') {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
      const startOfWeek = new Date(new Date(now).setDate(diff))
      startOfWeek.setHours(0, 0, 0, 0)
      return date >= startOfWeek
    }
    if (range === 'this_month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }
    if (range === 'this_year') {
      return date.getFullYear() === now.getFullYear()
    }
    return true
  }

  const stats = useMemo(() => {
    const now = new Date()

    // Filter payments and expenses based on selected timeRange
    const filteredPayments = (allPayments || []).filter(p => {
      const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date)
      return isWithinRange(pDate, timeRange)
    })

    const filteredExpenses = (allExpenses || []).filter(e => {
      const eDate = e.expenseDate ? new Date(e.expenseDate) : null
      return eDate && isWithinRange(eDate, timeRange)
    })

    const totalIncome = filteredPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
    const totalExpense = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0)

    // Dues Calculation (Always shows total outstanding for active residents)
    const totalDues = (students || []).filter(s => s.isActive).reduce((sAcc, s) => {
      const billingStart = s.billingStartDate ? new Date(s.billingStartDate) : (s.createdAt?.toDate?.() || new Date())
      const endDate = now
      
      const monthsElapsed = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth())
      const generatedRent = (monthsElapsed >= 0 ? monthsElapsed + 1 : 0) * (s.monthlyRent || 0)
      
      const historicalRentDue = s.duesBreakdown ? Object.values(s.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
      
      const totalRentPaid = s.paymentsHistory?.reduce((acc: number, curr: any) => {
        const isRefund = curr.type === 'refund'
        const rentPortion = (curr.seatAmount !== undefined) ? Number(curr.seatAmount) : (s.paymentSystem === 'package' ? Number(curr.amount) : 0)
        return acc + (isRefund ? -rentPortion : rentPortion)
      }, 0) || 0

      const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

      // Food Balance
      const historicalFoodDue = Number(s.foodDueAmount) || 0
      const generatedFoodCost = s.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
      const totalFoodPaid = s.paymentsHistory?.reduce((acc: number, curr: any) => {
        const isRefund = curr.type === 'refund'
        const foodPortion = (curr.foodAmount !== undefined) ? Number(curr.foodAmount) : (s.paymentSystem === 'non-package' ? Number(curr.amount) : 0)
        return acc + (isRefund ? -foodPortion : foodPortion)
      }, 0) || 0
      const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)

      return sAcc + rentDue + (foodBalance < 0 ? Math.abs(foodBalance) : 0)
    }, 0)

    // Fund status based on ALL history for THIS branch
    const fund = { 
      cash: Number(openingBalances?.cash || 0), 
      bank: Number(openingBalances?.bank || 0), 
      bkash: Number(openingBalances?.bkash || 0), 
      nagad: Number(openingBalances?.nagad || 0) 
    };

    (allPayments || []).forEach(p => { 
      if (fund[p.method as keyof typeof fund] !== undefined) fund[p.method as keyof typeof fund] += (p.amount || 0) 
    });
    (allExpenses || []).forEach(e => { 
      if (fund[e.method as keyof typeof fund] !== undefined) fund[e.method as keyof typeof fund] -= (e.amount || 0) 
    });

    return { 
      income: totalIncome, 
      expense: totalExpense, 
      dues: totalDues, 
      fund,
      activeResidents: (students || []).filter(s => s.isActive).length
    }
  }, [allPayments, allExpenses, students, openingBalances, timeRange])

  const combinedBalance = stats.fund.cash + stats.fund.bank + stats.fund.bkash + stats.fund.nagad

  const isLoading = buildingsLoading || studentsLoading || paymentsLoading || expensesLoading

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Syncing Branch Data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-24 relative">
      {/* Header / App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Dashboard</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Real-time overview for <span className="text-foreground font-bold">{userBranch}</span>.</p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          {/* Desktop Filter */}
          <div className="hidden md:block">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[160px] bg-white border-slate-200 font-bold text-slate-600 h-10 px-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={14} className="text-primary" />
                  <SelectValue placeholder="Select period" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100">
                <SelectItem value="today" className="font-medium">This Day</SelectItem>
                <SelectItem value="this_week" className="font-medium">This Week</SelectItem>
                <SelectItem value="this_month" className="font-medium">This Month</SelectItem>
                <SelectItem value="this_year" className="font-medium">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mobile Filter Icon */}
          <div className="md:hidden">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="h-10 w-10 p-0 border-none bg-secondary/50 rounded-full flex items-center justify-center shadow-none focus:ring-0">
                <CalendarIcon size={20} className="text-primary" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {userRole !== 'Building Manager' && pendingMgrRequests && pendingMgrRequests.length > 0 && (
            <Link href="/manager-requests" className="hidden sm:block">
              <Button variant="outline" className="bg-orange-50 border-orange-200 text-orange-600 animate-pulse gap-2 rounded-xl h-10 px-4">
                <BellRing size={16}/> {pendingMgrRequests.length}
              </Button>
            </Link>
          )}

          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">
                {userName ? userName.substring(0, 2) : "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Top Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-success">Income</CardTitle>
            <div className="bg-success/10 p-1.5 rounded-full"><ArrowUpCircle className="h-4 w-4 text-success" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{stats.income.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1 capitalize">For {timeRange.replace('_', ' ')}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-destructive">Expenses</CardTitle>
            <div className="bg-destructive/10 p-1.5 rounded-full"><ArrowDownCircle className="h-4 w-4 text-destructive" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{stats.expense.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1 capitalize">For {timeRange.replace('_', ' ')}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-orange-400 rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Total Dues</CardTitle>
            <div className="bg-orange-50 p-1.5 rounded-full"><TrendingUp className="h-4 w-4 text-orange-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{stats.dues.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Branch Receivables</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-primary rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Residents</CardTitle>
            <div className="bg-primary/10 p-1.5 rounded-full"><Building2 className="h-4 w-4 text-primary" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.activeResidents}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Active in {buildings?.length || 0} buildings</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-5">
        <Card className="lg:col-span-3 shadow-sm border-none bg-white rounded-3xl overflow-hidden">
          <CardHeader className="pb-6 border-b border-slate-50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-800">Branch Fund Status</CardTitle>
              <p className="text-xs text-muted-foreground font-medium mt-1">Opening + Transactions (including transfers).</p>
            </div>
            <div className="bg-primary/5 p-3 rounded-2xl text-primary border border-primary/10"><CircleDollarSign size={24} /></div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-3xl border bg-white shadow-sm space-y-3 group hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground tracking-widest"><Banknote size={14} className="text-slate-400"/> Cash in Hand</div>
                <div className="text-2xl font-bold text-slate-800 tracking-tighter">৳{stats.fund.cash.toLocaleString()}</div>
              </div>
              <div className="p-6 rounded-3xl border bg-white shadow-sm space-y-3 group hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground tracking-widest"><Landmark size={14} className="text-slate-400"/> Bank Account</div>
                <div className="text-2xl font-bold text-slate-800 tracking-tighter">৳{stats.fund.bank.toLocaleString()}</div>
              </div>
              <div className="p-6 rounded-3xl border bg-white shadow-sm space-y-3 group hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-primary/60 tracking-widest"><Smartphone size={14} className="text-primary/60"/> Bkash Wallet</div>
                <div className="text-2xl font-bold text-primary tracking-tighter">৳{stats.fund.bkash.toLocaleString()}</div>
              </div>
              <div className="p-6 rounded-3xl border bg-white shadow-sm space-y-3 group hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-orange-500/60 tracking-widest"><Smartphone size={14} className="text-orange-400"/> Nagad Wallet</div>
                <div className="text-2xl font-bold text-orange-500 tracking-tighter">৳{stats.fund.nagad.toLocaleString()}</div>
              </div>
            </div>
            
            <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Combined Net Balance:</p>
              <div className="text-3xl font-bold text-primary tracking-tighter">৳{combinedBalance.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm border-none bg-white rounded-3xl overflow-hidden">
          <CardHeader className="pb-6 border-b border-slate-50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-white bg-primary px-4 py-1 rounded-lg">Property Occupancy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-8">
              {buildings?.map((b: any) => {
                const occupancy = Math.round((b.occupiedSeats / (b.totalSeats || 1)) * 100)
                return (
                  <div key={b.id} className="space-y-3">
                    <div className="flex justify-between items-end">
                      <p className="text-sm font-bold text-slate-700">{b.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">{b.occupiedSeats}/{b.totalSeats} seats</span>
                        <span className="text-xs font-bold text-primary">{occupancy}%</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={cn(
                          "h-full transition-all duration-1000 ease-out rounded-full",
                          occupancy > 90 ? "bg-destructive" : occupancy > 70 ? "bg-orange-500" : "bg-primary"
                        )}
                        style={{ width: `${occupancy}%` }} 
                      />
                    </div>
                  </div>
                )
              })}
              {(!buildings || buildings.length === 0) && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-30">
                  <Building2 size={64} strokeWidth={1} />
                  <p className="mt-4 font-bold text-sm">No Properties Found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAB - Quick Actions */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-4 items-end">
        <Link href="/income">
          <Button size="icon" className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:scale-110 transition-transform border-4 border-white">
            <Plus size={32} />
          </Button>
        </Link>
      </div>
    </div>
  )
}
