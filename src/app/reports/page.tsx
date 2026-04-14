
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend, Tooltip
} from 'recharts';
import { Badge } from "@/components/ui/badge"
import { 
  Printer, Loader2, Calendar, LayoutGrid, Filter, XCircle, 
  TrendingUp, TrendingDown, AlertCircle, Info, Calculator, 
  ArrowUpRight, ArrowDownRight, Zap, Wrench, Building2, UserCircle, Receipt, Utensils, Wifi, Wallet, RotateCcw,
  CircleDollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  TrendingUp as TrendingUpIcon,
  ArrowRight
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
  const [userRole, setUserRole] = useState("")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    setUserRole(localStorage.getItem("user_role") || "Manager")
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
    const totalEfficiency = totalExpense > 0 ? (totalIncome / totalExpense) * 100 : (totalIncome > 0 ? 100 : 0)
    
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

    filteredData.expense.forEach(e => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount
      if (e.buildingId && e.buildingId !== 'none') {
        if (!buildingMap[e.buildingId]) buildingMap[e.buildingId] = { name: e.buildingName || 'Unknown', expense: 0, income: 0 }
        buildingMap[e.buildingId].expense += e.amount
      }
    })

    filteredData.income.forEach(p => {
      if (p.buildingId) {
        if (!buildingMap[p.buildingId]) buildingMap[p.buildingId] = { name: p.buildingName || 'Unknown', expense: 0, income: 0 }
        buildingMap[p.buildingId].income += p.amount
      }
    })

    const expensesByCategory = Object.entries(categoryMap).map(([name, value]) => ({ name: name.toUpperCase(), value }))
    
    const buildingComparison = Object.entries(buildingMap).map(([id, data]) => ({
      name: data.name,
      income: data.income,
      expense: data.expense,
      profit: data.income - data.expense,
      isLoss: data.expense > data.income
    })).sort((a, b) => b.income - a.income)

    const highCostCategory = expensesByCategory.length > 0 ? [...expensesByCategory].sort((a, b) => b.value - a.value)[0] : null
    const mostProfitable = buildingComparison.length > 0 ? [...buildingComparison].sort((a, b) => b.profit - a.profit)[0] : null

    const insights: string[] = []
    buildingComparison.forEach(b => {
      if (b.isLoss) insights.push(`Building "${b.name}" is currently operating in loss (৳${Math.abs(b.profit).toLocaleString()}).`)
    })

    return { 
      totalIncome, totalExpense, netProfit, occupancyRate, healthScore, totalEfficiency,
      trendData, expensesByCategory, buildingComparison, highCostCategory, mostProfitable, insights 
    }
  }, [filteredData, buildings, buildingFilter])

  const handlePrint = () => { 
    if (typeof window !== "undefined") { 
      setTimeout(() => {
        window.print(); 
      }, 500);
    } 
  }

  if (pLoading || eLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="space-y-8 pb-20 print:p-0 w-full">
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

      {/* OFFICIAL PRINT REPORT SECTION */}
      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">সমীকরণ ছাত্রাবাস</h1>
          <p className="text-sm font-bold text-slate-600">{userBranch} ব্রাঞ্চ • বিস্তারিত এনালিটিক্স রিপোর্ট</p>
          <div className="mt-4 border-y-2 border-slate-200 py-3 grid grid-cols-2 text-left text-[9pt] font-medium bg-slate-50/50 px-4">
            <div>
              <p><b>Period:</b> {startDate} to {endDate}</p>
              <p><b>Filter Building:</b> {buildingFilter === 'all' ? 'All' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
            </div>
            <div className="text-right">
              <p><b>Generated At:</b> {new Date().toLocaleString()}</p>
              <p><b>Staff:</b> {userName}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 my-8">
          <div className="border border-slate-300 p-3 rounded-xl text-center">
            <p className="text-[8pt] font-black text-muted-foreground uppercase mb-1">Total Income</p>
            <p className="text-md font-black">৳{stats.totalIncome.toLocaleString()}</p>
          </div>
          <div className="border border-slate-300 p-3 rounded-xl text-center">
            <p className="text-[8pt] font-black text-muted-foreground uppercase mb-1">Total Expense</p>
            <p className="text-md font-black">৳{stats.totalExpense.toLocaleString()}</p>
          </div>
          <div className="border border-slate-300 p-3 rounded-xl text-center">
            <p className="text-[8pt] font-black text-muted-foreground uppercase mb-1">Net Balance</p>
            <p className="text-md font-black">৳{stats.netProfit.toLocaleString()}</p>
          </div>
          <div className="border border-slate-300 p-3 rounded-xl text-center">
            <p className="text-[8pt] font-black text-muted-foreground uppercase mb-1">Health Score</p>
            <p className="text-md font-black">{stats.healthScore}%</p>
          </div>
        </div>

        <h3 className="text-sm font-black uppercase border-b-2 border-slate-900 pb-1 mb-4">Building-wise Financial Summary</h3>
        <table className="w-full border-collapse border text-[9pt]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 p-2 text-left">Building Name</th>
              <th className="border border-slate-300 p-2 text-right">Income</th>
              <th className="border border-slate-300 p-2 text-right">Expense</th>
              <th className="border border-slate-300 p-2 text-right">Efficiency</th>
              <th className="border border-slate-300 p-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {stats.buildingComparison.map((b: any, idx: number) => (
              <tr key={idx}>
                <td className="border border-slate-200 p-2 font-bold">{b.name}</td>
                <td className="border border-slate-200 p-2 text-right">৳{b.income.toLocaleString()}</td>
                <td className="border border-slate-200 p-2 text-right">৳{b.expense.toLocaleString()}</td>
                <td className="border border-slate-200 p-2 text-right">{(b.income / (b.expense || 1)).toFixed(2)}x</td>
                <td className="border border-slate-200 p-2 text-center font-black uppercase text-[7pt]">{b.isLoss ? 'Loss' : 'Profit'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-footer mt-24 flex justify-between px-10">
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[8pt] font-black uppercase text-slate-800">Accountant Signature</p>
          </div>
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[8pt] font-black uppercase text-slate-800">Branch Manager Signature</p>
          </div>
        </div>
      </div>

      <div className="print:hidden space-y-8">
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden"><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-[10px] font-bold uppercase text-success">Total Income</CardTitle><ArrowUpRight className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-black">৳{stats.totalIncome.toLocaleString()}</div></CardContent></Card>
          <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden"><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-[10px] font-bold uppercase text-destructive">Total Expenses</CardTitle><ArrowDownRight className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-black">৳{stats.totalExpense.toLocaleString()}</div></CardContent></Card>
          <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-primary rounded-2xl overflow-hidden"><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-[10px] font-bold uppercase text-primary">Net Result</CardTitle><Calculator className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className={cn("text-2xl font-black", stats.netProfit >= 0 ? "text-primary" : "text-destructive")}>৳{Math.abs(stats.netProfit).toLocaleString()}</div></CardContent></Card>
          <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-orange-500 rounded-2xl overflow-hidden"><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-[10px] font-bold uppercase text-orange-600">Occupancy</CardTitle><Building2 className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-2xl font-black">{stats.occupancyRate.toFixed(1)}%</div></CardContent></Card>
        </div>

        <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
          <Card className="rounded-3xl border-none shadow-sm overflow-hidden flex flex-col justify-center items-center p-8 bg-white"><div className="text-5xl font-black text-slate-800">{stats.healthScore}%</div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-2">Overall Hostel Health</p></Card>
          <Card className="lg:col-span-2 rounded-3xl border-none shadow-sm overflow-hidden bg-white"><CardHeader><CardTitle className="text-lg font-bold flex items-center gap-2"><TrendingUp size={20} className="text-primary"/> Financial Trend</CardTitle></CardHeader>
            <CardContent className="h-[250px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trendData}><XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} /><YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `৳${val/1000}k`} /><Tooltip /><Area type="monotone" dataKey="income" stroke="#296EB3" strokeWidth={3} fillOpacity={0.1} fill="#296EB3" /><Area type="monotone" dataKey="expense" stroke="#F06A6A" strokeWidth={3} fillOpacity={0.1} fill="#F06A6A" /></AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Report Parameters</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5"><Label>Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">Entire Branch</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Date Range</Label><div className="flex gap-2"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div></div>
          </div>
          <DialogFooter><Button onClick={() => setIsFilterDialogOpen(false)}>Apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
