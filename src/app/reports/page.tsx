
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
    const mostLossMaking = buildingComparison.length > 0 ? [...buildingComparison].sort((a, b) => a.profit - b.profit)[0] : null

    const insights: string[] = []
    buildingComparison.forEach(b => {
      if (b.isLoss) insights.push(`Building "${b.name}" is currently operating in loss (৳${Math.abs(b.profit).toLocaleString()}).`)
    })

    return { 
      totalIncome, totalExpense, netProfit, occupancyRate, healthScore, totalEfficiency,
      trendData, expensesByCategory, buildingComparison, highCostCategory, mostProfitable, mostLossMaking, insights 
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

      {/* Financial Health Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
        <Card className="border-none shadow-lg bg-primary/5 border border-primary/10 rounded-3xl overflow-hidden flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
              <TrendingUpIcon size={14}/> Total Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-4xl font-black text-primary">{stats.totalEfficiency.toFixed(1)}%</div>
            <p className="text-[9px] text-muted-foreground font-bold mt-1 uppercase">Income relative to expenses</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-orange-50 border border-orange-100 rounded-3xl overflow-hidden flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-orange-700 tracking-widest flex items-center gap-2">
              <Receipt size={14}/> High-Cost Category
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-black text-orange-800 truncate">{stats.highCostCategory?.name || 'N/A'}</div>
            <p className="text-[9px] text-orange-600 font-bold mt-1 uppercase">৳{stats.highCostCategory?.value.toLocaleString()} Spent</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-success/5 border border-success/10 rounded-3xl overflow-hidden flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-success tracking-widest flex items-center gap-2">
              <Building2 size={14}/> Best Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-black text-success truncate">{stats.mostProfitable?.name || 'General'}</div>
            <p className="text-[9px] text-success/70 font-bold mt-1 uppercase">৳{stats.mostProfitable?.profit.toLocaleString()} Net Profit</p>
          </CardContent>
        </Card>
      </div>

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

      {/* Main Charts Section */}
      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3 print:hidden">
        {/* Health Score Card */}
        <Card className="rounded-3xl border-none shadow-sm overflow-hidden flex flex-col justify-center items-center p-8 bg-white">
          <div className="text-5xl font-black text-slate-800">{stats.healthScore}%</div>
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-2">Overall Hostel Health</p>
          <div className="mt-6 w-full space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase"><span>Status</span><span className={cn(stats.healthScore > 70 ? "text-success" : "text-orange-500")}>{stats.healthScore > 70 ? "Stable" : "Requires Attention"}</span></div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className={cn("h-full", stats.healthScore > 70 ? "bg-success" : "bg-orange-500")} style={{ width: `${stats.healthScore}%` }} /></div>
          </div>
        </Card>

        {/* Financial Trend Area Chart */}
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

      {/* Advanced Visualizations Row */}
      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3 print:hidden">
        {/* Expense Breakdown Pie Chart */}
        <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2"><PieChartIcon size={20} className="text-primary"/> Expense Breakdown</CardTitle>
            <CardDescription>Category-wise spending analysis.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center p-0">
            {stats.expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.expensesByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    formatter={(value: any) => [`৳${value.toLocaleString()}`, 'Amount']}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground italic text-sm">No expense data available for this range.</div>
            )}
          </CardContent>
        </Card>

        {/* Building-wise Profit/Loss Bar Chart */}
        <Card className="lg:col-span-2 rounded-3xl border-none shadow-sm bg-white overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2"><BarChart3 size={20} className="text-primary"/> Building Comparison</CardTitle>
            <CardDescription>Income vs Expense per infrastructure unit.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.buildingComparison} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `৳${val/1000}k`} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="income" fill="#296EB3" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expense" radius={[4, 4, 0, 0]} name="Expense">
                  {stats.buildingComparison.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isLoss ? "#EF4444" : "#F06A6A"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          {stats.insights.length > 0 && (
            <div className="px-6 pb-6 space-y-2">
              <Separator />
              {stats.insights.map((insight, i) => (
                <div key={i} className="flex gap-2 items-start text-xs text-destructive font-medium bg-red-50 p-3 rounded-xl">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <p>{insight}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Existing Building Efficiency List */}
      <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white print:hidden">
        <CardHeader className="bg-slate-50/50 border-b">
          <CardTitle className="text-lg flex items-center gap-2"><LayoutGrid size={20} className="text-primary"/> Operational Efficiency by Building</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Building Name</TableHead>
                <TableHead className="text-right font-bold">Income</TableHead>
                <TableHead className="text-right font-bold">Expense</TableHead>
                <TableHead className="text-right font-bold">Efficiency Ratio</TableHead>
                <TableHead className="text-right font-bold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.buildingComparison.map((b, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-bold">{b.name}</TableCell>
                  <TableCell className="text-right font-bold text-success">৳{b.income.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold text-destructive">৳{b.expense.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-black">
                    {(b.expense > 0 ? (b.income / b.expense) : 0).toFixed(2)}x
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className={cn("rounded-lg text-[10px] font-black", b.isLoss ? "bg-destructive" : "bg-success")}>
                      {b.isLoss ? "LOSS" : "PROFIT"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {stats.buildingComparison.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">No building records found for current filter.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
    </div>
  )
}
