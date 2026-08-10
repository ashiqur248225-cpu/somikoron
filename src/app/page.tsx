
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  ArrowUpRight, 
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
  Filter,
  Calculator,
  Search,
  CheckCircle2,
  MoreVertical,
  Receipt,
  Lightbulb,
  Wrench,
  Utensils,
  Wifi,
  UserCircle,
  Zap,
  LayoutGrid,
  Apple,
  Table as TableIcon,
  Check,
  CircleAlert,
  Hash,
  RotateCcw
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, serverTimestamp, getDoc, limit, orderBy } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function DashboardPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const router = useRouter()
  
  // User Context
  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [authId, setAuthId] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")
  const [timeRange, setTimeRange] = useState("this_month")
  const [selectedBuildingId, setSelectedBuildingId] = useState("all")
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
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

    // Redirect non-admin roles immediately
    if (role === 'Student') {
      router.push('/student/dashboard')
    } else if (role === 'Staff' || role === 'Worker' || role === 'General Staff') {
      router.push('/meals-dashboard')
    } else if (role === 'Building Manager') {
      router.push('/students')
    } else {
      setIsReady(true)
    }
  }, [router])

  // Fetch current user's permissions
  const staffRef = useMemoFirebase(() => authId ? doc(db, "staff", authId) : null, [db, authId])
  const { data: staffData } = useDoc(staffRef)

  // Optimized netBalance fetching
  const balanceRef = useMemoFirebase(() => userBranch ? doc(db, "netBalance", userBranch) : null, [db, userBranch])
  const { data: branchBalance } = useDoc(balanceRef)

  // Queries
  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch || !isReady) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "buildings"), where("id", "==", assignedBuildingId))
    }
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userRole, userBranch, assignedBuildingId, isReady])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch || !isReady) return null
    let q = query(collection(db, "students"), where("branch", "==", userBranch))
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      q = query(collection(db, "students"), where("buildingId", "==", assignedBuildingId))
    }
    return q
  }, [db, userBranch, userRole, assignedBuildingId, isReady])
  const { data: students } = useCollection(studentsQuery)

  const paymentsQuery = useMemoFirebase(() => {
    if (!userBranch || !isReady) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "payments"), where("buildingId", "==", assignedBuildingId))
    }
    return query(collection(db, "payments"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId, isReady])
  const { data: allPayments } = useCollection(paymentsQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!userBranch || !isReady) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "expenses"), where("buildingId", "==", assignedBuildingId))
    }
    return query(collection(db, "expenses"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId, isReady])
  const { data: allExpenses } = useCollection(expensesQuery)

  // Statistics Calculation with Smart Building Filtering
  const stats = useMemo(() => {
    if (!isReady) return { income: 0, expense: 0, activeResidents: 0, totalDue: 0 }
    const now = new Date()
    const isWithinRange = (date: Date, range: string) => {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      if (range === 'today') return date >= startOfToday
      if (range === 'yesterday') {
        const yesterday = new Date(startOfToday); yesterday.setDate(yesterday.getDate() - 1)
        return date >= yesterday && date < startOfToday
      }
      if (range === 'this_week') {
        const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay())
        return date >= startOfWeek
      }
      if (range === 'this_month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      if (range === 'this_year') return date.getFullYear() === now.getFullYear()
      
      if (range.startsWith('month_')) {
        const monthIdx = parseInt(range.split('_')[1])
        return date.getMonth() === monthIdx && date.getFullYear() === now.getFullYear()
      }

      return true 
    }

    const filteredPayments = (allPayments || []).filter(p => {
      const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date)
      const matchesTime = isWithinRange(pDate, timeRange) && p.method !== 'adjustment'
      const matchesBuilding = selectedBuildingId === 'all' || p.buildingId === selectedBuildingId
      return matchesTime && matchesBuilding
    })

    const filteredExpenses = (allExpenses || []).filter(e => {
      const eDate = e.expenseDate ? new Date(e.expenseDate.replace(/-/g, '/')) : null
      const matchesTime = eDate && isWithinRange(eDate, timeRange)
      const matchesBuilding = selectedBuildingId === 'all' || e.buildingId === selectedBuildingId
      return matchesTime && matchesBuilding
    })

    const income = filteredPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
    const expense = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0)
    
    const filteredStudents = (students || []).filter(s => {
      const matchesBuilding = selectedBuildingId === 'all' || s.buildingId === selectedBuildingId
      return s.isActive && matchesBuilding
    })

    const totalDue = filteredStudents.reduce((acc, s) => {
      const rentDue = Number(s.totalDue || 0);
      const foodDebt = (s.foodDueAmount || 0) < 0 ? Math.abs(s.foodDueAmount) : 0;
      return acc + rentDue + foodDebt;
    }, 0)

    return { 
      income, 
      expense, 
      activeResidents: filteredStudents.length,
      totalDue
    }
  }, [allPayments, allExpenses, students, timeRange, selectedBuildingId, isReady])

  // Prevent UI rendering for non-management roles
  if (!isReady || ['Staff', 'Worker', 'General Staff', 'Student'].includes(userRole)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
        <p className="text-sm font-bold text-muted-foreground uppercase animate-pulse">Loading Portal...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Dashboard</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Real-time overview for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Building Filter */}
          <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
            <SelectTrigger className="w-[140px] h-9 bg-white border-none shadow-sm font-bold text-xs">
              <Building2 size={14} className="mr-2 text-primary" />
              <SelectValue placeholder="All Buildings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Entire Branch</SelectItem>
              <SelectSeparator />
              {buildings?.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Time Filter */}
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] h-9 bg-white border-none shadow-sm font-bold text-xs">
              <CalendarIcon size={14} className="mr-2 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              
              <SelectGroup>
                <SelectLabel className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-tighter px-2 pt-2 border-t mt-1">Specific Month ({new Date().getFullYear()})</SelectLabel>
                {MONTHS.map((m, idx) => (
                  <SelectItem key={idx} value={`month_${idx}`}>{m}</SelectItem>
                ))}
              </SelectGroup>
              
              <SelectSeparator />
              <SelectItem value="this_year">This Year (All)</SelectItem>
              <SelectItem value="all_time">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Link href="/profile">
            <Avatar className="h-9 w-9 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-success rounded-2xl group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-success tracking-widest">Income</CardTitle><ArrowUpRight className="h-4 w-4 text-success" /></CardHeader>
          <CardContent><div className="text-xl font-black text-slate-900">৳{stats.income.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-destructive rounded-2xl group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-destructive tracking-widest">Expenses</CardTitle><ArrowDownCircle className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-xl font-black text-slate-900">৳{stats.expense.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-orange-500 rounded-2xl group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-orange-600 tracking-widest">Total Dues</CardTitle><AlertCircle className="h-4 w-4 text-orange-600" /></CardHeader>
          <CardContent><div className="text-xl font-black text-slate-900">৳{stats.totalDue.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-primary rounded-2xl group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-primary tracking-widest">Residents</CardTitle><Users className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent><div className="text-xl font-black text-slate-900">{stats.activeResidents}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2"><Building2 size={20} className="text-primary"/> Building Status</CardTitle>
              <CardDescription>Capacity overview for your branch.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {buildings?.map(b => {
              const occRate = (b.occupiedSeats / (b.totalSeats || 1)) * 100
              return (
                <div key={b.id} className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer",
                  selectedBuildingId === b.id ? "bg-white border-primary shadow-md ring-2 ring-primary/10" : "bg-secondary/20 border-secondary group hover:bg-white hover:shadow-md"
                )} onClick={() => {
                  setSelectedBuildingId(b.id === selectedBuildingId ? "all" : b.id)
                }}>
                  <div className="flex justify-between items-start mb-3">
                    <div><h4 className="font-bold text-slate-800">{b.name}</h4><p className="text-[10px] font-bold text-muted-foreground uppercase">{b.address}</p></div>
                    <Badge className={cn("text-[8px] font-black", occRate > 90 ? "bg-destructive" : "bg-success")}>{occRate.toFixed(0)}% FULL</Badge>
                  </div>
                  <Progress value={occRate} className="h-1.5 mb-2" />
                  <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground"><span>{b.occupiedSeats} Occupied</span> <span>{b.emptySeats} Free</span></div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b flex justify-between items-center">
            <CardTitle className="text-lg font-bold flex items-center gap-2"><Wallet size={20} className="text-primary"/> Net Balance</CardTitle>
            <div className="text-right">
              <p className="text-[8px] font-bold text-muted-foreground uppercase">Net Balance</p>
              <p className="text-lg font-black text-primary">৳{(branchBalance?.totalHandCash || 0).toLocaleString()}</p>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            {[
              { label: "Cash", icon: Banknote, color: "text-green-600", val: branchBalance?.totalCash || 0 },
              { label: "Bank", icon: Landmark, color: "text-blue-600", val: branchBalance?.totalBank || 0 },
              { label: "Bkash", icon: Smartphone, color: "text-pink-600", val: branchBalance?.totalBkash || 0 },
              { label: "Nagad", icon: Smartphone, color: "text-orange-600", val: branchBalance?.totalNagad || 0 },
            ].map((fund, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-3"><fund.icon size={18} className={fund.color} /><span className="text-sm font-medium text-slate-600">{fund.label}</span></div>
                <span className="font-black text-slate-800">৳{fund.val.toLocaleString()}</span>
              </div>
            ))}

            {selectedBuildingId !== 'all' && (
              <div className="mt-4 pt-4 border-t border-dashed space-y-3">
                <div className="flex justify-between items-center p-4 bg-primary/5 rounded-2xl border border-primary/10 shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm text-primary">
                      <LayoutGrid size={18} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Building Net Result</p>
                      <span className="text-xs font-black text-slate-800 truncate max-w-[120px] block">
                        {buildings?.find(b => b.id === selectedBuildingId)?.name}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-lg font-black", (stats.income - stats.expense) >= 0 ? "text-success" : "text-destructive")}>
                      ৳{(stats.income - stats.expense).toLocaleString()}
                    </p>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">{timeRange.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-8 right-8 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-2xl bg-primary border-4 border-white transition-transform hover:scale-110 active:scale-95">
              <Plus size={32} className="text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2 shadow-xl mb-4 border-slate-100">
            <DropdownMenuItem onClick={() => router.push('/payment-entry')} className="gap-3 p-3 rounded-xl font-bold cursor-pointer hover:bg-success/10"><Wallet size={18} className="text-success" /> Payment Entry</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/expense-entry')} className="gap-3 p-3 rounded-xl font-bold cursor-pointer hover:bg-destructive/10"><Receipt size={18} className="text-destructive" /> Expense Entry</DropdownMenuItem>
            {(userRole === 'Admin' || userRole === 'Branch Manager' || (userRole === 'Building Manager' && staffData?.canDirectEntryBulkMeal)) && (
              <DropdownMenuItem onClick={() => router.push('/bulk-meal-entry')} className="gap-3 p-3 rounded-xl font-bold cursor-pointer hover:bg-primary/10"><Utensils size={18} className="text-primary" /> Monthly Bulk Meal Entry</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
