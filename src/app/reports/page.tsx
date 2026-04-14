"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend, Tooltip
} from 'recharts';
import { Badge } from "@/components/ui/badge"
import { 
  Printer, Loader2, Building2, Filter, Calculator, 
  ArrowUpRight, ArrowDownRight, TrendingUp, PieChart as PieChartIcon, BarChart3
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

const COLORS = ['#296EB3', '#F06A6A', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

const formatCompactDate = (date: any) => {
  if (!date) return 'N/A'
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function ReportsPage() {
  const db = useFirestore()
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

  const stats = useMemo(() => {
    if (!payments || !expenses) return null
    const sDate = new Date(startDate)
    const eDate = new Date(new Date(endDate).setHours(23, 59, 59))
    const income = payments.filter(p => {
      const d = p.date?.toDate ? p.date.toDate() : new Date(p.date)
      return d >= sDate && d <= eDate && (buildingFilter === "all" || p.buildingId === buildingFilter)
    })
    const expense = expenses.filter(e => {
      const d = new Date(e.expenseDate)
      return d >= sDate && d <= eDate && (buildingFilter === "all" || e.buildingId === buildingFilter)
    })

    const totalIncome = income.reduce((a, b) => a + (b.amount || 0), 0)
    const totalExpense = expense.reduce((a, b) => a + (b.amount || 0), 0)
    
    const buildingMap: Record<string, any> = {}
    income.forEach(p => {
      if (p.buildingId) buildingMap[p.buildingId] = { ...buildingMap[p.buildingId], name: p.buildingName, income: (buildingMap[p.buildingId]?.income || 0) + p.amount }
    })
    expense.forEach(e => {
      if (e.buildingId && e.buildingId !== 'none') {
        buildingMap[e.buildingId] = { ...buildingMap[e.buildingId], name: e.buildingName, expense: (buildingMap[e.buildingId]?.expense || 0) + e.amount }
      }
    })

    const categoryMap: Record<string, number> = {}
    expense.forEach(e => { categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount })

    const buildingComparison = Object.values(buildingMap).map((b: any) => ({
      name: b.name || 'General',
      income: b.income || 0,
      expense: b.expense || 0,
      status: (b.income || 0) >= (b.expense || 0) ? 'Profit' : 'Loss'
    }))

    const expensesByCategory = Object.entries(categoryMap).map(([name, value]) => ({ name: name.toUpperCase(), value }))

    return { totalIncome, totalExpense, buildingComparison, expensesByCategory }
  }, [payments, expenses, startDate, endDate, buildingFilter])

  const handlePrint = () => { 
    if (typeof window !== "undefined") { 
      setTimeout(() => { window.print(); }, 500);
    } 
  }

  if (pLoading || eLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-8 pb-20 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2"><SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mr-2 h-4 md:hidden" /><div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Analytics</h1></div></div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsFilterDialogOpen(true)}><Filter size={16} /> Filter</Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> Export PDF</Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* OFFICIAL A4 PRINT REPORT */}
      <div className="print-only print-report-container">
        <div className="report-header">
          <h1>সমীকরণ ছাত্রাবাস</h1>
          <p className="branch-title">{userBranch} Branch • Performance Analytics</p>
          <div className="flex justify-between items-end mt-4 px-2 text-[8pt] font-bold text-slate-500 uppercase">
            <div>
              <p>Period: {startDate} to {endDate}</p>
              <p>Report: Building Performance Matrix</p>
            </div>
            <div className="text-right">
              <p>Generated: {new Date().toLocaleString()}</p>
              <p>Staff: {userName}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Building Name</th>
              <th className="text-right">Income</th>
              <th className="text-right">Expense</th>
              <th className="text-center">Profit/Loss Status</th>
            </tr>
          </thead>
          <tbody>
            {stats?.buildingComparison.map((b: any, idx: number) => (
              <tr key={idx}>
                <td className="font-bold">{b.name}</td>
                <td className="text-right">৳{b.income.toLocaleString()}</td>
                <td className="text-right">৳{b.expense.toLocaleString()}</td>
                <td className={cn("text-center font-black uppercase text-[8pt]", b.status === 'Loss' && "text-destructive")}>
                  {b.status}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td className="text-right uppercase">Consolidated Totals</td>
              <td className="text-right">৳{stats?.totalIncome.toLocaleString()}</td>
              <td className="text-right">৳{stats?.totalExpense.toLocaleString()}</td>
              <td className="text-center">NET: ৳{(stats?.totalIncome - stats?.totalExpense).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="print-footer">
          <div className="page-number"></div>
          <div className="signature-box">Manager Signature</div>
        </div>
      </div>

      {/* SCREEN VIEW (Preserved UI) */}
      <div className="print:hidden space-y-8">
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-3">
          <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-success rounded-2xl"><CardHeader className="pb-2 flex justify-between"><CardTitle className="text-[10px] font-bold uppercase text-success">Total Income</CardTitle><ArrowUpRight className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-black">৳{stats?.totalIncome.toLocaleString()}</div></CardContent></Card>
          <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-destructive rounded-2xl"><CardHeader className="pb-2 flex justify-between"><CardTitle className="text-[10px] font-bold uppercase text-destructive">Total Expenses</CardTitle><ArrowDownRight className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-black">৳{stats?.totalExpense.toLocaleString()}</div></CardContent></Card>
          <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-primary rounded-2xl"><CardHeader className="pb-2 flex justify-between"><CardTitle className="text-[10px] font-bold uppercase text-primary">Net Result</CardTitle><Calculator className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-2xl font-black">৳{(stats?.totalIncome - stats?.totalExpense).toLocaleString()}</div></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b"><CardTitle className="text-lg flex items-center gap-2"><PieChartIcon size={20} className="text-primary"/> Expense Breakdown</CardTitle></CardHeader>
            <CardContent className="h-[350px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={stats?.expensesByCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">{stats?.expensesByCategory.map((_, i) => (<Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />))}</Pie><Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} /><Legend /></PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b"><CardTitle className="text-lg flex items-center gap-2"><BarChart3 size={20} className="text-primary"/> Building Comparison</CardTitle></CardHeader>
            <CardContent className="h-[350px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.buildingComparison}><CartesianGrid vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} /><Legend /><Bar dataKey="income" fill="#296EB3" radius={[4, 4, 0, 0]} /><Bar dataKey="expense" fill="#F06A6A" radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Report Parameters</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">Entire Branch</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">Date Range</Label><div className="flex gap-2"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div></div>
          </div>
          <DialogFooter><Button className="rounded-xl px-8" onClick={() => setIsFilterDialogOpen(false)}>Apply Search</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}