"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend, Tooltip, ResponsiveContainer, XAxis, YAxis
} from 'recharts';
import { Badge } from "@/components/ui/badge"
import { 
  Printer, Loader2, Building2, Filter, Calculator, 
  ArrowUpRight, ArrowDownRight, ArrowDownCircle, TrendingUp, PieChart as PieChartIcon, BarChart3,
  Lightbulb, Target, Zap, ShieldCheck, RotateCcw, MoreVertical,
  Activity, LayoutGrid, AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

const COLORS = ['#296EB3', '#F06A6A', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

export default function ReportsPage() {
  const db = useFirestore()
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  
  const getLocalYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }
  const getFirstDayOfMonthYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`;
  }

  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")

  const [startDate, setStartDate] = useState(getFirstDayOfMonthYMD())
  const [endDate, setEndDate] = useState(getLocalYMD())
  const [branchFilter, setBranchFilter] = useState("all")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [selectedTrackerBuilding, setSelectedTrackerBuilding] = useState("all")
  
  useEffect(() => {
    const storedRole = localStorage.getItem("user_role") || "Manager"
    const storedBranch = localStorage.getItem("user_branch") || "Main Branch"
    const storedName = localStorage.getItem("user_name") || "User"
    setUserRole(storedRole); setUserBranch(storedBranch); setUserName(storedName)
    
    // Admin or not, automatically set the branch filter to the user's current branch
    setBranchFilter(storedBranch)
  }, [])

  const branchesQuery = useMemoFirebase(() => collection(db, "branches"), [db])
  const { data: branches } = useCollection(branchesQuery)

  const buildingsQuery = useMemoFirebase(() => {
    if (!branchFilter) return null
    if (branchFilter === 'all') return collection(db, "buildings")
    return query(collection(db, "buildings"), where("branch", "==", branchFilter))
  }, [db, branchFilter])
  const { data: buildings } = useCollection(buildingsQuery)

  const paymentsQuery = useMemoFirebase(() => {
    if (!branchFilter) return null
    if (branchFilter === 'all') return collection(db, "payments")
    return query(collection(db, "payments"), where("branch", "==", branchFilter))
  }, [db, branchFilter])
  const { data: payments, isLoading: pLoading } = useCollection(paymentsQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!branchFilter) return null
    if (branchFilter === 'all') return collection(db, "expenses")
    return query(collection(db, "expenses"), where("branch", "==", branchFilter))
  }, [db, branchFilter])
  const { data: expenses, isLoading: eLoading } = useCollection(expensesQuery)

  // BRANCH AWARE ESTIMATES
  const estimatesRef = useMemoFirebase(() => {
    if (!branchFilter || branchFilter === 'all') return doc(db, "configs", "financialEstimates");
    return doc(db, "configs", `financialEstimates_${branchFilter}`);
  }, [db, branchFilter])
  const { data: estimates } = useDoc(estimatesRef)

  const studentsQuery = useMemoFirebase(() => {
    if (!branchFilter) return null
    if (branchFilter === 'all') return query(collection(db, "students"), where("isActive", "==", true))
    return query(collection(db, "students"), where("branch", "==", branchFilter), where("isActive", "==", true))
  }, [db, branchFilter])
  const { data: activeStudents } = useCollection(studentsQuery)

  const stats = useMemo(() => {
    if (!payments || !expenses || !activeStudents || !buildings) return null
    const sDate = startDate ? new Date(startDate.replace(/-/g, '/')) : new Date(0)
    const eDate = endDate ? new Date(endDate.replace(/-/g, '/')) : new Date()
    eDate.setHours(23, 59, 59)

    const foodCostPerPackage = estimates?.packageFoodCost || 4500;
    const utilCostPerStudent = estimates?.utilityEstimateCost || 500;

    const income = payments.filter(p => {
      const d = p.date?.toDate ? p.date.toDate() : (typeof p.date === 'string' && p.date.includes('-') ? new Date(p.date.replace(/-/g, '/')) : new Date(p.date))
      
      // CRITICAL: Filter out adjustments from report income
      const isNotAdjustment = p.method !== 'adjustment'
      
      return d >= sDate && d <= eDate && (buildingFilter === "all" || p.buildingId === buildingFilter) && isNotAdjustment
    })
    const expense = expenses.filter(e => {
      const d = new Date(e.expenseDate.replace(/-/g, '/'))
      return d >= sDate && d <= eDate && (buildingFilter === "all" || e.buildingId === buildingFilter)
    })

    const totalIncome = income.reduce((a, b) => a + (b.amount || 0), 0)
    const totalExpense = expense.reduce((a, b) => a + (b.amount || 0), 0)
    
    const buildingMap: Record<string, any> = {}
    buildings.forEach(b => {
      if (buildingFilter !== 'all' && b.id !== buildingFilter) return;

      const buildingStudents = activeStudents.filter(s => s.buildingId === b.id);
      const grossRealIncome = buildingStudents.reduce((acc, s) => acc + (Number(s.monthlyRent) || 0), 0);
      const packageCount = buildingStudents.filter(s => s.paymentSystem === 'package').length;
      
      const foodDeduction = packageCount * foodCostPerPackage;
      const utilityDeduction = buildingStudents.length * utilCostPerStudent;
      const buildingRent = Number(b.buildingRentCost || 0);

      const realNetProfit = grossRealIncome - foodDeduction - utilityDeduction - buildingRent;

      buildingMap[b.id] = {
        name: b.name,
        income: grossRealIncome,
        expense: foodDeduction + utilityDeduction + buildingRent,
        net: realNetProfit,
        status: realNetProfit >= 0 ? 'Profit' : 'Loss'
      }
    })

    const categoryMap: Record<string, number> = {}
    expense.forEach(e => { categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount })

    const buildingComparison = Object.values(buildingMap);
    const expensesByCategory = Object.entries(categoryMap).map(([name, value]) => ({ 
      name: name.toUpperCase(), value, percentage: totalExpense > 0 ? ((value / totalExpense) * 100).toFixed(1) : 0
    }))

    const sortedCategories = [...expensesByCategory].sort((a, b) => b.value - a.value)
    const topExpenseCategory = sortedCategories[0] || { name: 'None', value: 0, percentage: 0 }
    
    const sortedBuildingsByIncome = [...buildingComparison].sort((a, b) => b.income - a.income)
    const topIncomeBuilding = sortedBuildingsByIncome[0] || { name: 'N/A', income: 0 }

    const sortedBuildingsByExpense = [...buildingComparison].sort((a, b) => b.expense - a.expense)
    const topExpenseBuilding = sortedBuildingsByExpense[0] || { name: 'N/A', expense: 0 }

    const healthScore = totalIncome > 0 ? Math.min(100, Math.max(0, ((totalIncome - totalExpense) / totalIncome) * 100)) : 0

    return { 
      totalIncome, totalExpense, buildingComparison, expensesByCategory, topExpenseCategory,
      topIncomeBuilding, topExpenseBuilding, healthScore
    }
  }, [payments, expenses, activeStudents, buildings, estimates, startDate, endDate, buildingFilter])

  const trackerData = useMemo(() => {
    if (!expenses) return { categoryStats: [], highestCategory: "None" };
    const filtered = expenses.filter(e => {
      const d = new Date(e.expenseDate.replace(/-/g, '/'));
      const sDate = startDate ? new Date(startDate.replace(/-/g, '/')) : new Date(0);
      const eDate = endDate ? new Date(endDate.replace(/-/g, '/')) : new Date();
      eDate.setHours(23, 59, 59);
      const matchesDate = d >= sDate && d <= eDate;
      const matchesBuilding = selectedTrackerBuilding === 'all' || e.buildingId === selectedTrackerBuilding;
      return matchesDate && matchesBuilding;
    });
    const map: Record<string, number> = {};
    filtered.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount });
    const categoryStats = Object.entries(map).map(([name, value]) => ({ 
      name: name.charAt(0).toUpperCase() + name.slice(1), value 
    })).sort((a, b) => b.value - a.value);
    return { categoryStats, highestCategory: categoryStats[0]?.name || "None" };
  }, [expenses, selectedTrackerBuilding, startDate, endDate]);

  const handlePrint = () => { if (typeof window !== "undefined") setTimeout(() => { window.print(); }, 500); }
  
  const handleReset = () => { 
    setBranchFilter(userBranch); 
    setBuildingFilter("all"); 
    setStartDate(getFirstDayOfMonthYMD()); 
    setEndDate(getLocalYMD()); 
  }

  if (pLoading || eLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-8 pb-20 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2"><SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mr-2 h-4 md:hidden" /><div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Analytics</h1></div></div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3">
            <Button size="sm" variant="outline" className="gap-2 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold" onClick={() => setIsFilterDialogOpen(true)}>
              <Filter size={16} /> Filter
            </Button>
            <Button size="sm" variant="outline" className="gap-2 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold" onClick={handlePrint}>
              <Printer size={16} /> Print Report
            </Button>
          </div>
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-primary">
                  <MoreVertical size={24}/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 shadow-xl border-slate-100">
                <DropdownMenuItem onClick={() => setIsFilterDialogOpen(true)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                  <Filter size={16} className="text-primary" /> Filter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrint} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                  <Printer size={16} className="text-primary" /> Print Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      <div className="print-only print-report-container">
        <div className="report-header">
          <h1>সমীকরণ ছাত্রাবাস</h1>
          <p className="branch-title">{branchFilter === 'all' ? 'All Branches' : branchFilter} • Performance Analytics</p>
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
                <td className={cn("text-center font-black uppercase text-[8pt]", b.status === 'Loss' && "text-destructive")}>{b.status}</td>
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
        <div className="print-footer"><div className="page-number"></div><div className="signature-box">Manager Signature</div></div>
      </div>

      <div className="print:hidden space-y-8">
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-3">
          <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-success rounded-2xl"><CardHeader className="pb-2 flex justify-between"><CardTitle className="text-[10px] font-bold uppercase text-success">Total Income</CardTitle><ArrowUpRight className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-xl font-black">৳{stats?.totalIncome.toLocaleString()}</div></CardContent></Card>
          <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-destructive rounded-2xl"><CardHeader className="pb-2 flex justify-between"><CardTitle className="text-[10px] font-bold uppercase text-destructive">Total Expenses</CardTitle><ArrowDownCircle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-xl font-black">৳{stats?.totalExpense.toLocaleString()}</div></CardContent></Card>
          <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-primary rounded-2xl"><CardHeader className="pb-2 flex justify-between"><CardTitle className="text-[10px] font-bold uppercase text-primary">Net Result</CardTitle><Calculator className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-xl font-black">৳{(stats?.totalIncome - stats?.totalExpense).toLocaleString()}</div></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden"><CardHeader className="bg-slate-50/50 border-b"><CardTitle className="text-lg flex items-center gap-2"><PieChartIcon size={20} className="text-primary"/> Expense Breakdown</CardTitle></CardHeader><CardContent className="h-[350px] pt-6"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats?.expensesByCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">{stats?.expensesByCategory.map((_, i) => (<Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />))}</Pie><Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden"><CardHeader className="bg-slate-50/50 border-b"><CardTitle className="text-lg flex items-center gap-2"><BarChart3 size={20} className="text-primary"/> Building Comparison</CardTitle></CardHeader><CardContent className="h-[350px] pt-6"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats?.buildingComparison}><CartesianGrid vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} /><Legend /><Bar dataKey="income" fill="#296EB3" radius={[4, 4, 0, 0]} /><Bar dataKey="expense" fill="#F06A6A" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
        </div>

        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Separator className="opacity-50" /><h2 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight"><Lightbulb className="text-primary" /> Strategic Intelligence Summary</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="border-none shadow-lg bg-white rounded-3xl overflow-hidden group hover:scale-[1.01] transition-transform">
              <CardHeader className="bg-slate-900 text-white pb-6">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Financial Health Score</CardTitle>
                  <ShieldCheck size={20} className="text-success" />
                </div>
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-5xl font-black">{stats?.healthScore.toFixed(0)}%</span>
                  <Badge className={cn("mb-2 font-bold", stats?.healthScore > 70 ? "bg-success" : (stats?.healthScore > 40 ? "bg-orange-500" : "bg-destructive"))}>
                    {stats?.healthScore > 70 ? "Excellent" : (stats?.healthScore > 40 ? "Stable" : "Requires Attention")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground"><span>Performance Rating</span><span>Efficiency</span></div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("h-full transition-all duration-1000", stats?.healthScore > 70 ? "bg-success" : "bg-primary")} style={{ width: `${stats?.healthScore}%` }} />
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed italic">*Based on Net Profit Margin and Operating Efficiency for the selected period.</p>
              </CardContent>
            </Card>
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-none shadow-sm bg-white rounded-3xl p-6 border-t-4 border-t-destructive"><div className="flex gap-4"><div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive shrink-0"><Zap size={24}/></div><div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Main Cost Driver</p><h3 className="text-lg font-black text-slate-800 capitalize">{stats?.topExpenseCategory.name}</h3><p className="text-sm text-slate-600 font-medium">Accounts for <span className="text-destructive font-black">{stats?.topExpenseCategory.percentage}%</span> of your total spending.</p></div></div></Card>
              <Card className="border-none shadow-sm bg-white rounded-3xl p-6 border-t-4 border-t-success"><div className="flex gap-4"><div className="h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center text-success shrink-0"><Target size={24}/></div><div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Revenue Leader</p><h3 className="text-lg font-black text-slate-800">{stats?.topIncomeBuilding.name}</h3><p className="text-sm text-slate-600 font-medium">Highest contributing location with <span className="text-success font-black">৳{stats?.topIncomeBuilding.income.toLocaleString()}</span> collection.</p></div></div></Card>
              <Card className="border-none shadow-sm bg-white rounded-3xl p-6 border-t-4 border-t-primary"><div className="flex gap-4"><div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><BarChart3 size={24}/></div><div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">High Expense Property</p><h3 className="text-lg font-black text-slate-800">{stats?.topExpenseBuilding.name}</h3><p className="text-sm text-slate-600 font-medium">Consumption leader at <span className="text-primary font-black">৳{stats?.topExpenseBuilding.expense.toLocaleString()}</span>. Monitor utility usage here.</p></div></div></Card>
              <Card className="border-none shadow-sm bg-slate-50 rounded-3xl p-6 border-dashed border-2 border-slate-200"><div className="space-y-3"><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Lightbulb size={12} className="text-orange-500" /> Growth Recommendation</p><p className="text-xs font-bold text-slate-700 leading-relaxed">{stats?.healthScore < 50 ? `Your expenses are high relative to income. Focus on reducing ${stats?.topExpenseCategory.name} or reviewing building rents.` : `Performance is strong. Consider optimizing vacant seats in ${stats?.topExpenseBuilding.name} to maximize revenue.`}</p><div className="pt-2"><Button variant="link" className="p-0 h-auto text-[10px] font-black uppercase text-primary" asChild><Link href="/buildings">Improve Occupancy &rarr;</Link></Button></div></div></Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
             <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden border-t-4 border-t-primary">
                <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2 text-primary">
                      <Activity size={20}/> Smart Expense Tracker
                    </CardTitle>
                    <CardDescription>Building-specific spending insights.</CardDescription>
                  </div>
                  <Select value={selectedTrackerBuilding} onValueChange={setSelectedTrackerBuilding}>
                    <SelectTrigger className="w-[180px] h-9 bg-white font-bold text-xs">
                      <LayoutGrid size={14} className="mr-2 text-primary" />
                      <SelectValue placeholder="All Buildings" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Entire Branch</SelectItem>
                      {buildings?.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trackerData.categoryStats} layout="vertical" margin={{ left: 0, right: 30 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" fontSize={10} width={80} axisLine={false} tickLine={false} fontFamily="Inter" fontWeight={700}/>
                        <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} cursor={{ fill: 'transparent' }} />
                        <Bar dataKey="value" fill="#296EB3" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center justify-between group hover:bg-primary/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary"><TrendingUp size={20}/></div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">High-Cost Alert</p>
                        <h4 className="text-sm font-black text-slate-800">Highest expense: <span className="text-primary capitalize">{trackerData.highestCategory}</span></h4>
                      </div>
                    </div>
                    <Badge className="bg-primary group-hover:scale-110 transition-transform">৳{(trackerData.categoryStats[0]?.value || 0).toLocaleString()}</Badge>
                  </div>
                </CardContent>
             </Card>
          </div>
        </div>
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl"><DialogHeader><DialogTitle>Report Parameters</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            {userRole === 'Admin' && (
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">Branch</Label>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger><SelectValue placeholder="All Branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches?.map(b => (<SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold">Building</Label>
              <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Entire Branch</SelectItem>
                  {buildings?.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold">Date Range</Label>
              <div className="flex gap-2">
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" className="gap-2 font-bold" onClick={handleReset}><RotateCcw size={14}/> Reset</Button>
            <Button className="rounded-xl px-8" onClick={() => setIsFilterDialogOpen(false)}>Apply Search</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
