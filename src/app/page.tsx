
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
  BellRing
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, where, Timestamp, doc, setDoc, updateDoc, arrayUnion, increment } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import Link from "next/link"

export default function DashboardPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [timeFilter, setTimeFilter] = useState("month")

  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setAssignedBuildingId(localStorage.getItem("assigned_building_id") || "none")
  }, [])

  // Queries
  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "buildings"), where("id", "==", assignedBuildingId))
    }
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userRole, userBranch, assignedBuildingId])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "students"), where("buildingId", "==", assignedBuildingId))
    }
    return query(collection(db, "students"), where("branch", "==", userBranch))
  }, [db, userRole, userBranch, assignedBuildingId])
  const { data: students } = useCollection(studentsQuery)

  const allPaymentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "payments"), where("buildingId", "==", assignedBuildingId))
    }
    return query(collection(db, "payments"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: allPayments } = useCollection(allPaymentsQuery)

  const allExpensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "expenses"), where("buildingId", "==", assignedBuildingId))
    }
    return query(collection(db, "expenses"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: allExpenses } = useCollection(allExpensesQuery)

  const managerRequestsQuery = useMemoFirebase(() => {
    if (!userBranch || userRole === 'Building Manager') return null
    return query(collection(db, "managerRequests"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole])
  const { data: pendingMgrRequests } = useCollection(managerRequestsQuery)

  const balancesRef = useMemoFirebase(() => doc(db, "configs", "openingBalances"), [db])
  const { data: openingBalances } = useDoc(balancesRef)

  const stats = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const parseDate = (val: any) => {
      if (!val) return null
      if (val.toDate) return val.toDate()
      return new Date(val)
    }

    const income = (allPayments || [])
      .reduce((acc, p) => acc + (p.amount || 0), 0)

    const expense = (allExpenses || [])
      .reduce((acc, e) => acc + (e.amount || 0), 0)

    const totalDues = (students || []).filter(s => s.isActive).reduce((sAcc, student) => {
      const historicalRentDue = Number(student.dueAmount) || 0
      return sAcc + historicalRentDue
    }, 0)

    const fund = { 
      cash: Number(openingBalances?.cash || 0), 
      bkash: Number(openingBalances?.bkash || 0), 
      nagad: Number(openingBalances?.nagad || 0), 
      bank: Number(openingBalances?.bank || 0) 
    };

    if (userRole !== 'Building Manager') {
      (allPayments || []).forEach(p => { if (fund[p.method as keyof typeof fund] !== undefined) fund[p.method as keyof typeof fund] += (p.amount || 0) });
      (allExpenses || []).forEach(e => { if (fund[e.method as keyof typeof fund] !== undefined) fund[e.method as keyof typeof fund] -= (e.amount || 0) });
    }

    return { income, expense, dues: totalDues, fund }
  }, [allPayments, allExpenses, students, openingBalances, userRole])

  const combinedBalance = stats.fund.cash + stats.fund.bank + stats.fund.bkash + stats.fund.nagad

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              {userRole === 'Building Manager' ? `Overview for Assigned Building` : `Real-time overview of ${userBranch}`}
            </p>
          </div>
        </div>
        
        {userRole !== 'Building Manager' && pendingMgrRequests && pendingMgrRequests.length > 0 && (
          <Link href="/manager-requests">
            <Button variant="outline" className="bg-orange-50 border-orange-200 text-orange-600 animate-pulse gap-2">
              <BellRing size={16}/> {pendingMgrRequests.length} Manager Requests
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-none bg-white border-l-4 border-l-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-success">Approved Income</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">৳{stats.income.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-white border-l-4 border-l-destructive">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-destructive">Approved Expenses</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">৳{stats.expense.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-white border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-orange-500">Building Dues</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">৳{stats.dues.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-white border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">Residents</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{students?.filter(s => s.isActive).length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {userRole !== 'Building Manager' && (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <Card className="lg:col-span-2 shadow-sm border-none bg-white rounded-2xl overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl font-bold">Branch Fund Status</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Real-time balances for {userBranch}.</p>
                </div>
                <div className="bg-primary/10 p-2 rounded-lg text-primary"><CircleDollarSign size={20} /></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border bg-secondary/5 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest"><Banknote size={14} /> Cash in Hand</div>
                  <div className="text-2xl font-black text-primary">৳{stats.fund.cash.toLocaleString()}</div>
                </div>
                <div className="p-5 rounded-2xl border bg-secondary/5 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest"><Landmark size={14} /> Bank Account</div>
                  <div className="text-2xl font-black text-primary">৳{stats.fund.bank.toLocaleString()}</div>
                </div>
              </div>
              <div className="pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Branch Net Balance:</p>
                <div className="text-4xl font-black text-primary tracking-tighter">৳{combinedBalance.toLocaleString()}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none bg-white rounded-2xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold bg-primary/10 w-fit px-3 py-1 rounded text-primary">Occupancy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {buildings?.map((b: any) => {
                  const occupancy = Math.round((b.occupiedSeats / (b.totalSeats || 1)) * 100)
                  return (
                    <div key={b.id} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <p className="text-sm font-bold">{b.name}</p>
                        <span className="text-xs font-black text-primary">{occupancy}%</span>
                      </div>
                      <Progress value={occupancy} className="h-2" />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {userRole === 'Building Manager' && (
        <Card className="shadow-sm border-none bg-white rounded-2xl">
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
            <CardDescription>Submit requests for the Admin to approve.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Link href="/income" className="flex-1">
              <Button className="w-full h-20 text-lg bg-success hover:bg-success/90 flex-col gap-1">
                <Wallet size={24}/> Request Income Entry
              </Button>
            </Link>
            <Link href="/expenses" className="flex-1">
              <Button className="w-full h-20 text-lg bg-destructive hover:bg-destructive/90 flex-col gap-1">
                <Receipt size={24}/> Request Expense Entry
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
