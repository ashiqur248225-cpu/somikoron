
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, Calendar, Loader2, TrendingUp, TrendingDown, Wallet, FileSpreadsheet,
  XCircle, Building2, CircleAlert, Download, Share2, FileText, Activity, PieChart as PieChartIcon, Percent, Users
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const CHART_COLORS = ['#296EB3', '#F06A6A', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4'];

export default function ReportsPage() {
  const db = useFirestore()
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [buildingFilter, setBuildingFilter] = useState("all")
  
  // User Context
  const [userBranch, setUserBranch] = useState("Main Branch")
  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
  }, [])

  // CRITICAL: Filter ALL queries by the user's active branch
  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const paymentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "payments"), where("branch", "==", userBranch), orderBy("date", "desc"))
  }, [db, userBranch])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "expenses"), where("branch", "==", userBranch), orderBy("expenseDate", "desc"))
  }, [db, userBranch])
  const { data: expenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "students"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: students } = useCollection(studentsQuery)

  const filteredData = useMemo(() => {
    if (!payments || !expenses) return { income: [], expense: [] }
    const sDate = new Date(startDate)
    const eDate = new Date(new Date(endDate).setHours(23, 59, 59))
    const isMatch = (item: any, dateKey: string) => {
      const itemDate = item[dateKey]?.toDate ? item[dateKey].toDate() : new Date(item[dateKey])
      const matchesDate = itemDate >= sDate && itemDate <= eDate
      const matchesBuilding = buildingFilter === "all" || item.buildingId === buildingFilter
      return matchesDate && matchesBuilding
    }
    return { income: payments.filter(p => isMatch(p, 'date')), expense: expenses.filter(e => isMatch(e, 'expenseDate')) }
  }, [payments, expenses, startDate, endDate, buildingFilter])

  const stats = useMemo(() => {
    const totalIncome = filteredData.income.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    const totalExpense = filteredData.expense.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    const totalDues = (students || []).filter(s => s.isActive).reduce((acc, s) => acc + (s.rentDue || 0), 0)
    const totalSeats = (buildings || []).reduce((acc, b) => acc + (b.totalSeats || 0), 0)
    const occupiedSeats = (buildings || []).reduce((acc, b) => acc + (b.occupiedSeats || 0), 0)
    const occupancyRate = totalSeats > 0 ? (occupiedSeats / totalSeats) * 100 : 0
    return { totalIncome, totalExpense, totalDues, netProfit: totalIncome - totalExpense, occupancyRate }
  }, [filteredData, students, buildings])

  if (paymentsLoading || expensesLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Financial Reports</h1>
          <p className="text-muted-foreground mt-1">Performance analysis for <span className="font-bold text-foreground">{userBranch}</span>.</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-income/5 border-l-4 border-l-income"><CardHeader className="pb-2 text-xs font-bold uppercase text-income">Total Income</CardHeader><CardContent><div className="text-2xl font-black">৳{stats.totalIncome.toLocaleString()}</div></CardContent></Card>
        <Card className="bg-expense/5 border-l-4 border-l-expense"><CardHeader className="pb-2 text-xs font-bold uppercase text-expense">Total Expenses</CardHeader><CardContent><div className="text-2xl font-black">৳{stats.totalExpense.toLocaleString()}</div></CardContent></Card>
        <Card className="bg-destructive/5 border-l-4 border-l-destructive"><CardHeader className="pb-2 text-xs font-bold uppercase text-destructive">Total Dues</CardHeader><CardContent><div className="text-2xl font-black">৳{stats.totalDues.toLocaleString()}</div></CardContent></Card>
        <Card className="bg-primary/5 border-l-4 border-l-primary"><CardHeader className="pb-2 text-xs font-bold uppercase">Occupancy</CardHeader><CardContent><div className="text-2xl font-black">{stats.occupancyRate.toFixed(1)}%</div></CardContent></Card>
      </div>

      <Card className="shadow-sm border-none"><CardHeader><CardTitle className="text-lg">Trends</CardTitle></CardHeader><CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={[]}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><RechartTooltip /><Area type="monotone" dataKey="income" stroke="#296EB3" fill="#296EB3" fillOpacity={0.1}/></AreaChart></ResponsiveContainer>
      </CardContent></Card>
    </div>
  )
}
