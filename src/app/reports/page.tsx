
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
  XCircle, Building2, CircleAlert, Download, Share2, FileText, Activity, PieChart as PieChartIcon, Percent, Users,
  ArrowUpRight, ArrowDownRight, Scale, Zap, Info
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
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const CHART_COLORS = ['#296EB3', '#F06A6A', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4', '#607D8B', '#E91E63'];

const EXPENSE_LABELS: Record<string, string> = {
  rent: "Building Rent",
  electricity: "Electricity",
  water: "Water/Gas",
  maintenance: "Repair",
  market: "Market/Food",
  internet: "Internet",
  salary: "Salary",
  others: "Others"
}

export default function ReportsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [buildingFilter, setBuildingFilter] = useState("all")
  
  // User Context
  const [userBranch, setUserBranch] = useState("Main Branch")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  // Queries
  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const paymentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "payments"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: rawPayments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "expenses"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: rawExpenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "students"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: students } = useCollection(studentsQuery)

  // Memoized sorted data
  const payments = useMemo(() => {
    if (!rawPayments) return []
    return [...rawPayments].sort((a, b) => {
      const d1 = a.date?.toDate ? a.date.toDate() : new Date(a.date)
      const d2 = b.date?.toDate ? b.date.toDate() : new Date(b.date)
      return d2.getTime() - d1.getTime()
    })
  }, [rawPayments])

  const expenses = useMemo(() => {
    if (!rawExpenses) return []
    return [...rawExpenses].sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())
  }, [rawExpenses])

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

    return { 
      income: payments.filter(p => isMatch(p, 'date')), 
      expense: expenses.filter(e => isMatch(e, 'expenseDate')) 
    }
  }, [payments, expenses, startDate, endDate, buildingFilter])

  const stats = useMemo(() => {
    const totalIncome = filteredData.income.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    const totalExpense = filteredData.expense.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    
    const activeStudents = (students || []).filter(s => s.isActive && (buildingFilter === "all" || s.buildingId === buildingFilter))
    const totalDues = activeStudents.reduce((acc, s) => {
      const histDues = s.duesBreakdown ? Object.values(s.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
      return acc + histDues
    }, 0)

    const totalSeats = (buildings || []).filter(b => buildingFilter === "all" || b.id === buildingFilter).reduce((acc, b) => acc + (b.totalSeats || 0), 0)
    const occupiedSeats = (buildings || []).filter(b => buildingFilter === "all" || b.id === buildingFilter).reduce((acc, b) => acc + (b.occupiedSeats || 0), 0)
    const occupancyRate = totalSeats > 0 ? (occupiedSeats / totalSeats) * 100 : 0

    const collectionEfficiency = (totalIncome + totalDues) > 0 ? (totalIncome / (totalIncome + totalDues)) : 0
    const profitMargin = totalIncome > 0 ? (Math.max(0, totalIncome - totalExpense) / totalIncome) : 0
    
    const healthScore = Math.round(
      (occupancyRate * 0.4) + 
      (collectionEfficiency * 100 * 0.4) + 
      (profitMargin * 100 * 0.2)
    )

    const trendMap: Record<string, { name: string, income: number, expense: number }> = {}
    filteredData.income.forEach(p => {
      const d = (p.date?.toDate ? p.date.toDate() : new Date(p.date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      if (!trendMap[d]) trendMap[d] = { name: d, income: 0, expense: 0 }
      trendMap[d].income += (p.amount || 0)
    })
    filteredData.expense.forEach(e => {
      const d = new Date(e.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      if (!trendMap[d]) trendMap[d] = { name: d, income: 0, expense: 0 }
      trendMap[d].expense += (e.amount || 0)
    })
    const trendData = Object.values(trendMap).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime())

    const expenseCatMap: Record<string, number> = {}
    filteredData.expense.forEach(e => {
      const cat = e.category || 'others'
      expenseCatMap[cat] = (expenseCatMap[cat] || 0) + (e.amount || 0)
    })
    const expensePieData = Object.entries(expenseCatMap).map(([key, value]) => ({
      name: EXPENSE_LABELS[key] || key,
      value
    }))

    const buildingComparison = (buildings || []).map(b => {
      const bIncome = filteredData.income.filter(p => p.buildingId === b.id).reduce((acc, curr) => acc + curr.amount, 0)
      const bExpense = filteredData.expense.filter(e => e.buildingId === b.id).reduce((acc, curr) => acc + curr.amount, 0)
      return {
        name: b.name,
        income: bIncome,
        expense: bExpense
      }
    })

    return { 
      totalIncome, 
      totalExpense, 
      totalDues, 
      netProfit: totalIncome - totalExpense, 
      occupancyRate,
      healthScore,
      trendData,
      expensePieData,
      buildingComparison
    }
  }, [filteredData, students, buildings, buildingFilter])

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  const handleExportCSV = () => {
    try {
      const headers = ["Date", "Type", "Category/Purpose", "Entity Name", "Building", "Method", "Amount"];
      const rows = [];

      // Add Incomes
      filteredData.income.forEach(p => {
        const date = (p.date?.toDate ? p.date.toDate() : new Date(p.date)).toLocaleDateString();
        rows.push([
          date,
          "Income",
          "Payment Collection",
          p.studentName,
          p.buildingName,
          p.method,
          p.amount
        ]);
      });

      // Add Expenses
      filteredData.expense.forEach(e => {
        const date = new Date(e.expenseDate).toLocaleDateString();
        rows.push([
          date,
          "Expense",
          EXPENSE_LABELS[e.category] || e.category,
          e.receiver || e.expensePartyName,
          e.buildingName,
          e.method,
          e.amount
        ]);
      });

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(val => `"${val}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `somikoron_report_${startDate}_to_${endDate}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Export Success", description: "CSV file has been downloaded." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export Failed", description: err.message });
    }
  }

  if (paymentsLoading || expensesLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-8 pb-20 print:p-0">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Performance Reports</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">
              Deep analysis for <span className="font-bold text-foreground">{userBranch}</span>.
            </p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}><FileSpreadsheet size={16} /> CSV</Button>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}>
            <Download size={16} /> <span className="hidden sm:inline">Export PDF</span>
          </Button>

          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">
                {userName ? userName.substring(0, 2) : "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-secondary/20 p-6 rounded-2xl border items-end print:hidden">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Calendar size={10} /> Start Date</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white h-10" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Calendar size={10} /> End Date</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white h-10" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Building2 size={10} /> Filter Building</Label>
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" className="h-10 font-bold uppercase text-xs" onClick={() => { setBuildingFilter("all"); setStartDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]); setEndDate(new Date().toISOString().split('T')[0]) }}>
          <XCircle size={14} className="mr-1" /> Reset View
        </Button>
      </div>

      {/* Core Summary Cards */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-success">Total Income</CardTitle>
            <div className="bg-success/10 p-1.5 rounded-full"><ArrowUpRight className="h-4 w-4 text-success" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{stats.totalIncome.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Gross Collections</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-destructive">Total Expenses</CardTitle>
            <div className="bg-destructive/10 p-1.5 rounded-full"><ArrowDownRight className="h-4 w-4 text-destructive" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{stats.totalExpense.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Operational Costs</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-rose-400 rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-rose-500">Total Dues</CardTitle>
            <div className="bg-rose-100 p-1.5 rounded-full"><Scale className="h-4 w-4 text-rose-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{stats.totalDues.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Receivables</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "shadow-sm border-none border-l-[6px] rounded-2xl overflow-hidden group hover:shadow-md transition-all",
          stats.netProfit >= 0 ? "bg-primary/5 border-l-primary" : "bg-destructive/5 border-l-destructive"
        )}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-[10px] font-bold uppercase tracking-widest", stats.netProfit >= 0 ? "text-primary" : "text-destructive")}>Net Balance</CardTitle>
            <div className={cn("p-1.5 rounded-full", stats.netProfit >= 0 ? "bg-primary/10" : "bg-destructive/10")}>
              <Wallet className={cn("h-4 w-4", stats.netProfit >= 0 ? "text-primary" : "text-destructive")} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", stats.netProfit >= 0 ? "text-primary" : "text-destructive")}>
              ৳{Math.abs(stats.netProfit).toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">{stats.netProfit >= 0 ? "Profit Surplus" : "Loss Margin"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
        {/* Health Score Card */}
        <Card className="shadow-sm border-none bg-white rounded-3xl overflow-hidden border-t-4 border-t-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2"><Activity size={20} className="text-primary"/> Hostel Health Score</CardTitle>
            <CardDescription className="text-xs">Aggregate business health index.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-6 space-y-6">
            <div className="relative h-40 w-40 flex items-center justify-center">
              <svg className="h-full w-full transform -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={440} strokeDashoffset={440 - (440 * stats.healthScore) / 100} strokeLinecap="round" className={cn(
                  stats.healthScore > 80 ? "text-success" : stats.healthScore > 50 ? "text-orange-500" : "text-destructive"
                )} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-slate-800">{stats.healthScore}%</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Stable</span>
              </div>
            </div>
            
            <div className="w-full space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium flex items-center gap-1"><Users size={12}/> Occupancy Rate</span>
                <span className="font-bold">{stats.occupancyRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium flex items-center gap-1"><Scale size={12}/> Collection Efficiency</span>
                <span className="font-bold">{Math.round((stats.totalIncome / (stats.totalIncome + stats.totalDues)) * 100) || 0}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Trends Chart */}
        <Card className="lg:col-span-2 shadow-sm border-none bg-white rounded-3xl overflow-hidden border-t-4 border-t-primary">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold">Financial Trends</CardTitle>
              <CardDescription className="text-xs">Income vs Expense daily distribution.</CardDescription>
            </div>
            <TrendingUp size={24} className="text-slate-200" />
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#296EB3" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#296EB3" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F06A6A" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#F06A6A" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <RechartTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="income" name="Income" stroke="#296EB3" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expense" name="Expense" stroke="#F06A6A" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
        {/* Expense Categories */}
        <Card className="shadow-sm border-none bg-white rounded-3xl overflow-hidden border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2"><PieChartIcon size={20} className="text-primary"/> Expense Distribution</CardTitle>
            <CardDescription className="text-xs">Breakdown by category for current selection.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.expensePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.expensePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <RechartTooltip />
                <Legend verticalAlign="bottom" align="center" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Building Performance Comparison */}
        <Card className="shadow-sm border-none bg-white rounded-3xl overflow-hidden border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2"><Scale size={20} className="text-primary"/> Building Comparison</CardTitle>
            <CardDescription className="text-xs">Financial performance across properties.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.buildingComparison} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px' }} />
                <Legend iconType="circle" />
                <Bar dataKey="income" name="Income" fill="#296EB3" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="expense" name="Expense" fill="#F06A6A" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary Note */}
      <Card className="border-none shadow-sm bg-primary/5 rounded-2xl p-6 border border-primary/10 print:hidden">
        <div className="flex gap-4 items-start">
          <div className="p-2 bg-white rounded-lg shadow-sm text-primary border border-primary/10"><Info size={20} /></div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800">Intelligence Note</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Based on the data between <b>{new Date(startDate).toLocaleDateString()}</b> and <b>{new Date(endDate).toLocaleDateString()}</b>, 
              your net surplus is <b>৳{stats.netProfit.toLocaleString()}</b>. 
              {stats.occupancyRate < 70 ? " Warning: Your occupancy is below target (70%), consider running a promotional offer." : " Your occupancy rate is healthy."}
              {stats.totalDues > stats.totalIncome * 0.2 ? " Collection Alert: Your dues are exceeding 20% of income. Review your collection strategy." : " Your collection efficiency is within acceptable limits."}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
