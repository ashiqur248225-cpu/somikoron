
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { Badge } from "@/components/ui/badge"
import { Activity, Calendar, Building2, TrendingUp, TrendingDown, Wallet, FileSpreadsheet, XCircle, Printer, Scale, Info, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const CHART_COLORS = ['#296EB3', '#F06A6A', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4', '#607D8B', '#E91E63'];

const EXPENSE_LABELS: Record<string, string> = {
  rent: "Building Rent", electricity: "Electricity", water: "Water/Gas", maintenance: "Repair",
  market: "Market/Food", internet: "Internet", salary: "Salary", others: "Others"
}

const formatCompactDate = (date: any) => {
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function ReportsPage() {
  const { toast } = useToast()
  const db = useFirestore()
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
      return itemDate >= sDate && itemDate <= eDate && (buildingFilter === "all" || item.buildingId === buildingFilter)
    }
    return { income: payments.filter(p => isMatch(p, 'date')), expense: expenses.filter(e => isMatch(e, 'expenseDate')) }
  }, [payments, expenses, startDate, endDate, buildingFilter])

  const stats = useMemo(() => {
    const totalIncome = filteredData.income.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    const totalExpense = filteredData.expense.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    const netProfit = totalIncome - totalExpense
    
    const activeStudents = (students || []).filter(s => s.isActive && (buildingFilter === "all" || s.buildingId === buildingFilter))
    const totalDues = activeStudents.reduce((acc, s) => {
      const dues = s.duesBreakdown ? Object.values(s.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
      return acc + dues
    }, 0)
    
    const totalSeats = (buildings || []).filter(b => buildingFilter === "all" || b.id === buildingFilter).reduce((acc, b) => acc + (b.totalSeats || 0), 0)
    const occupiedSeats = (buildings || []).filter(b => buildingFilter === "all" || b.id === buildingFilter).reduce((acc, b) => acc + (b.occupiedSeats || 0), 0)
    const occupancyRate = totalSeats > 0 ? (occupiedSeats / totalSeats) * 100 : 0
    
    // Growth calculation
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

    const expensePieData = Object.entries(filteredData.expense.reduce((acc: any, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount
      return acc
    }, {})).map(([name, value]) => ({ name: EXPENSE_LABELS[name] || name, value }))

    return { totalIncome, totalExpense, totalDues, netProfit, occupancyRate, healthScore, trendData, expensePieData }
  }, [filteredData, students, buildings, buildingFilter])

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  if (pLoading || eLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Reports</h1></div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Print / PDF</span></Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">SOMIKORON HOSTEL</h1>
          <p className="text-sm font-bold">{userBranch} Branch • Business Analytics Report</p>
          <div className="mt-4 border-y py-2 grid grid-cols-2 text-left text-[10pt]">
            <div>
              <p><b>Period:</b> {startDate} to {endDate}</p>
              <p><b>Scope:</b> {buildingFilter === 'all' ? 'Entire Branch' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
            </div>
            <div className="text-right">
              <p><b>Health Score:</b> {stats.healthScore}%</p>
              <p><b>Occupancy:</b> {stats.occupancyRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="summary-section grid grid-cols-2 gap-6 mb-10">
          <div className="bg-slate-50 p-4 border rounded-2xl">
            <h3 className="font-bold uppercase text-xs mb-3">Profit & Loss Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Total Revenue:</span><span className="font-bold">৳{stats.totalIncome.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Total Operational Cost:</span><span className="font-bold text-destructive">৳{stats.totalExpense.toLocaleString()}</span></div>
              <div className="flex justify-between border-t pt-2"><span>Net Profit/Surplus:</span><span className="font-black text-primary">৳{stats.netProfit.toLocaleString()}</span></div>
            </div>
          </div>
          <div className="bg-slate-50 p-4 border rounded-2xl">
            <h3 className="font-bold uppercase text-xs mb-3">Receivables Analysis</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Uncollected Rent:</span><span className="font-bold">৳{stats.totalDues.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Recovery Efficiency:</span><span className="font-bold">{Math.round((stats.totalIncome / (stats.totalIncome + stats.totalDues)) * 100) || 0}%</span></div>
            </div>
          </div>
        </div>

        <h3 className="font-black uppercase text-xs mb-2">Detailed Financial Trend</h3>
        <table className="w-full border-collapse">
          <thead>
            <TableRow>
              <TableHead className="border px-4 py-2 bg-slate-50">Date</TableHead>
              <TableHead className="border px-4 py-2 bg-slate-50 text-right">Daily Income</TableHead>
              <TableHead className="border px-4 py-2 bg-slate-50 text-right">Daily Expense</TableHead>
              <TableHead className="border px-4 py-2 bg-slate-50 text-right">Net Change</TableHead>
            </TableRow>
          </thead>
          <TableBody>
            {stats.trendData.reverse().map((t: any) => (
              <TableRow key={t.name}>
                <TableCell className="border px-4 py-2">{t.name}</TableCell>
                <TableCell className="border px-4 py-2 text-right text-success">৳{(t.income || 0).toLocaleString()}</TableCell>
                <TableCell className="border px-4 py-2 text-right text-destructive">৳{(t.expense || 0).toLocaleString()}</TableCell>
                <TableCell className="border px-4 py-2 text-right font-bold">৳{((t.income || 0) - (t.expense || 0)).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>

        <div className="print-footer mt-10">
          <div className="signature-box">Accountant Signature</div>
          <div className="text-center self-end print-page-number"></div>
          <div className="signature-box">Manager Signature</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-secondary/20 p-6 rounded-2xl border print:hidden">
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white" /></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white" /></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
        <Button variant="ghost" onClick={() => { setBuildingFilter("all"); setStartDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]); setEndDate(new Date().toISOString().split('T')[0]) }}>Reset</Button>
      </div>

      {/* Analytics Cards */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <Card className="border-l-[6px] border-l-success rounded-2xl overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-success">Total Income</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">৳{stats.totalIncome.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-l-[6px] border-l-destructive rounded-2xl overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-destructive">Total Expenses</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">৳{stats.totalExpense.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-l-[6px] border-l-rose-400 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-rose-500">Total Dues</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">৳{stats.totalDues.toLocaleString()}</div></CardContent>
        </Card>
        <Card className={cn("border-l-[6px] rounded-2xl overflow-hidden", stats.netProfit >= 0 ? "border-l-primary" : "border-l-destructive")}>
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase">Net Profit</CardTitle></CardHeader>
          <CardContent><div className={cn("text-2xl font-bold", stats.netProfit >= 0 ? "text-primary" : "text-destructive")}>৳{Math.abs(stats.netProfit).toLocaleString()}</div></CardContent>
        </Card>
      </div>

      {/* Visual Charts - Screen Only */}
      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3 print:hidden">
        <Card className="rounded-3xl overflow-hidden"><CardHeader><CardTitle className="text-lg font-bold">Hostel Health</CardTitle></CardHeader><CardContent className="flex flex-col items-center pt-6"><div className="text-4xl font-black">{stats.healthScore}%</div><p className="text-xs text-muted-foreground uppercase font-bold mt-2">Overall Score</p></CardContent>
        <Card className="lg:col-span-2 rounded-3xl overflow-hidden"><CardHeader><CardTitle className="text-lg font-bold">Financial Trends</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={stats.trendData}><XAxis dataKey="name" /><YAxis /><RechartTooltip /><Area type="monotone" dataKey="income" stroke="#296EB3" fill="#296EB3" fillOpacity={0.1}/><Area type="monotone" dataKey="expense" stroke="#F06A6A" fill="#F06A6A" fillOpacity={0.1}/></AreaChart></ResponsiveContainer></CardContent>
      </div>
    </div>
  )
}
