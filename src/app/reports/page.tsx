
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend
} from 'recharts';
import { Badge } from "@/components/ui/badge"
import { 
  Printer, Loader2, Calendar, LayoutGrid, Filter, XCircle, 
  TrendingUp, TrendingDown, AlertCircle, Info, Calculator, 
  ArrowUpRight, ArrowDownRight, Zap, Wrench, Building2, UserCircle, Receipt, Utensils, Wifi, Wallet, RotateCcw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"

const COLORS = ['#296EB3', '#F06A6A', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

const formatCompactDate = (date: any) => {
  if (!date) return 'N/A'
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function ReportsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  
  // States
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [buildingFilter, setBuildingFilter] = useState("all")
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const paymentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "payments"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: payments, isLoading: pLoading } = useCollection(paymentsQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "expenses"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: expenses, isLoading: eLoading } = useCollection(expensesQuery)

  const filteredData = useMemo(() => {
    if (!payments || !expenses) return { income: [], expense: [] }
    const sDate = new Date(startDate)
    const eDate = new Date(new Date(endDate).setHours(23, 59, 59))
    const isMatch = (item: any, dateKey: string) => {
      const itemDate = item[dateKey]?.toDate ? item[dateKey].toDate() : new Date(item[dateKey])
      return itemDate >= sDate && itemDate <= eDate && (buildingFilter === "all" || item.buildingId === buildingFilter)
    }
    return { 
      income: payments.filter(p => isMatch(p, 'date')), 
      expense: expenses.filter(e => isMatch(e, 'expenseDate')) 
    }
  }, [payments, expenses, startDate, endDate, buildingFilter])

  const stats = useMemo(() => {
    const totalIncome = filteredData.income.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    const totalExpense = filteredData.expense.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    const netProfit = totalIncome - totalExpense
    
    // Occupancy
    const totalSeats = (buildings || []).filter(b => buildingFilter === "all" || b.id === buildingFilter).reduce((acc, b) => acc + (b.totalSeats || 0), 0)
    const occupiedSeats = (buildings || []).filter(b => buildingFilter === "all" || b.id === buildingFilter).reduce((acc, b) => acc + (b.occupiedSeats || 0), 0)
    const occupancyRate = totalSeats > 0 ? (occupiedSeats / totalSeats) * 100 : 0
    
    const healthScore = Math.round((occupancyRate * 0.4) + (totalIncome > 0 ? 40 : 0) + (netProfit > 0 ? 20 : 0))

    const trendMap: Record<string, any> = {}
    filteredData.income.forEach(p => {
      const d = formatCompactDate(p.date)
      trendMap[d] = { ...trendMap[d], name: d, income: (trendMap[d]?.income || 0) + p.amount }
    })
    filteredData.expense.forEach(e => {
      const d = formatCompactDate(e.expenseDate)
      trendMap[d] = { ...trendMap[d], name: d, expense: (trendMap[d]?.expense || 0) + e.amount }
    })
    const trendData = Object.values(trendMap).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime())

    const categoryMap: Record<string, number> = {}
    const buildingMap: Record<string, {name: string, expense: number, income: number}> = {}
    const roomMap: Record<string, {name: string, bName: string, expense: number, count: number}> = {}

    filteredData.expense.forEach(e => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount
      if (e.buildingId && e.buildingId !== 'none') {
        if (!buildingMap[e.buildingId]) buildingMap[e.buildingId] = { name: e.buildingName || 'Unknown', expense: 0, income: 0 }
        buildingMap[e.buildingId].expense += e.amount
        if (e.roomNumber) {
          const rKey = `${e.buildingId}-${e.roomNumber}`
          if (!roomMap[rKey]) roomMap[rKey] = { name: e.roomNumber, bName: e.buildingName, expense: 0, count: 0 }
          roomMap[rKey].expense += e.amount
          roomMap[rKey].count += 1
        }
      }
    })

    filteredData.income.forEach(p => {
      if (p.buildingId && buildingMap[p.buildingId]) {
        buildingMap[p.buildingId].income += p.amount
      }
    })

    const expensesByCategory = Object.entries(categoryMap).map(([name, value]) => ({ name: name.toUpperCase(), value }))
    const expensesByBuilding = Object.values(buildingMap).map(b => ({
      name: b.name,
      expense: b.expense,
      income: b.income,
      efficiency: b.expense > 0 ? (b.income / b.expense).toFixed(2) : '0'
    })).sort((a, b) => b.expense - a.expense)

    const expensesByRoom = Object.values(roomMap).sort((a, b) => b.expense - a.expense).slice(0, 10)
    
    const insights: string[] = []
    if (expensesByBuilding.length > 0) {
      insights.push(`${expensesByBuilding[0].name} has the highest operational cost in this period.`)
    }
    const topCategory = expensesByCategory.sort((a, b) => b.value - a.value)[0]
    if (topCategory) insights.push(`${topCategory.name} is the leading expense driver.`)

    return { 
      totalIncome, totalExpense, netProfit, occupancyRate, healthScore, 
      trendData, expensesByCategory, expensesByBuilding, expensesByRoom, insights 
    }
  }, [filteredData, buildings, buildingFilter])

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  if (pLoading || eLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2"><SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mr-2 h-4 md:hidden" /><div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Analytics</h1></div></div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsFilterDialogOpen(true)}>
            <Filter size={16} /> <span className="hidden sm:inline">Filter</span>
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Export PDF</span></Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* FILTER DIALOG */}
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Filter className="text-primary" size={20}/> Report Parameters</DialogTitle>
            <DialogDescription>Define the scope and period for your analytics.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Building Scope</Label>
              <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                <SelectTrigger className="bg-slate-50"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Entire Branch</SelectItem>
                  {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Date Range</Label>
              <div className="flex gap-2">
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50" />
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50" />
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button variant="ghost" className="gap-2 font-bold text-xs" onClick={() => { setBuildingFilter("all"); setStartDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]); setEndDate(new Date().toISOString().split('T')[0]) }}>
              <RotateCcw size={14}/> Reset View
            </Button>
            <Button className="rounded-xl px-8" onClick={() => setIsFilterDialogOpen(false)}>Generate Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Row */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-[10px] font-bold uppercase text-success">Total Income</CardTitle><ArrowUpRight className="h-4 w-4 text-success" /></CardHeader>
          <CardContent><div className="text-2xl font-black">৳{stats.totalIncome.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-[10px] font-bold uppercase text-destructive">Total Expenses</CardTitle><ArrowDownRight className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-2xl font-black">৳{stats.totalExpense.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-primary rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-[10px] font-bold uppercase text-primary">Net Result</CardTitle><Calculator className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent><div className={cn("text-2xl font-black", stats.netProfit >= 0 ? "text-primary" : "text-destructive")}>৳{Math.abs(stats.netProfit).toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-orange-500 rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-[10px] font-bold uppercase text-orange-600">Occupancy</CardTitle><Building2 className="h-4 w-4 text-orange-600" /></CardHeader>
          <CardContent><div className="text-2xl font-black">{stats.occupancyRate.toFixed(1)}%</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3 print:hidden">
        <Card className="rounded-3xl border-none shadow-sm overflow-hidden flex flex-col justify-center items-center p-8 bg-white">
          <div className="text-5xl font-black text-slate-800">{stats.healthScore}%</div>
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-2">Overall Hostel Health</p>
          <div className="mt-6 w-full space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase"><span>Status</span><span className={cn(stats.healthScore > 70 ? "text-success" : "text-orange-500")}>{stats.healthScore > 70 ? "Stable" : "Requires Attention"}</span></div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className={cn("h-full", stats.healthScore > 70 ? "bg-success" : "bg-orange-500")} style={{ width: `${stats.healthScore}%` }} /></div>
          </div>
        </Card>
        <Card className="lg:col-span-2 rounded-3xl border-none shadow-sm overflow-hidden bg-white">
          <CardHeader><CardTitle className="text-lg font-bold flex items-center gap-2"><TrendingUp size={20} className="text-primary"/> Financial Trend</CardTitle></CardHeader>
          <CardContent className="h-[250px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#296EB3" stopOpacity={0.1}/><stop offset="95%" stopColor="#296EB3" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F06A6A" stopOpacity={0.1}/><stop offset="95%" stopColor="#F06A6A" stopOpacity={0}/></linearGradient>
                </defs>
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `৳${val/1000}k`} />
                <RechartTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="income" stroke="#296EB3" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expense" stroke="#F06A6A" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
