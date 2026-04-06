
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
  ArrowUpRight, ArrowDownRight, Zap, Wrench, Building2, UserCircle, Receipt, Utensils, Wifi, Wallet
} from "lucide-react"
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
    
    // Health Score
    const healthScore = Math.round((occupancyRate * 0.4) + (totalIncome > 0 ? 40 : 0) + (netProfit > 0 ? 20 : 0))

    // Trend Data
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

    // Deep Expense Analysis Maps
    const categoryMap: Record<string, number> = {}
    const buildingMap: Record<string, {name: string, expense: number, income: number}> = {}
    const roomMap: Record<string, {name: string, bName: string, expense: number, count: number}> = {}
    const aptMap: Record<string, {name: string, bName: string, expense: number}> = {}

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

        if (e.apartmentName) {
          const aKey = `${e.buildingId}-${e.apartmentName}`
          if (!aptMap[aKey]) aptMap[aKey] = { name: e.apartmentName, bName: e.buildingName, expense: 0 }
          aptMap[aKey].expense += e.amount
        }
      }
    })

    // Map income to buildings for efficiency score
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
    
    // Insights Generation
    const insights: string[] = []
    if (expensesByBuilding.length > 0) {
      insights.push(`${expensesByBuilding[0].name} has the highest operational cost in this period.`)
      const lowEfficiency = expensesByBuilding.find(b => Number(b.efficiency) < 1.5)
      if (lowEfficiency) insights.push(`${lowEfficiency.name} showing low cost efficiency (${lowEfficiency.efficiency}). Review overheads.`)
    }
    const topCategory = expensesByCategory.sort((a, b) => b.value - a.value)[0]
    if (topCategory) insights.push(`${topCategory.name} is the leading expense driver (৳${topCategory.value.toLocaleString()}).`)
    
    const chronicRooms = expensesByRoom.filter(r => r.count >= 3)
    if (chronicRooms.length > 0) insights.push(`Room ${chronicRooms[0].name} (${chronicRooms[0].bName}) required repeated maintenance.`)

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
        <div className="flex items-center gap-2"><SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mr-2 h-4 md:hidden" /><div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Analytics Report</h1></div></div>
        <div className="ml-auto flex items-center gap-3"><Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Export PDF</span></Button><Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link></div>
      </div>

      {/* Official Ledger Print Format (Hidden on Screen) */}
      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">SOMIKORON HOSTEL</h1>
          <p className="text-sm font-bold">{userBranch} Branch • Comprehensive Financial Analysis</p>
          <div className="mt-4 border-y py-2 grid grid-cols-2 text-left text-[10pt]">
            <div><p><b>Period:</b> {startDate} to {endDate}</p><p><b>Unit Scope:</b> {buildingFilter === 'all' ? 'Entire Branch' : buildings?.find(b => b.id === buildingFilter)?.name}</p></div>
            <div className="text-right"><p><b>Health Score:</b> {stats.healthScore}%</p><p><b>Occupancy Rate:</b> {stats.occupancyRate.toFixed(1)}%</p></div>
          </div>
        </div>
        <div className="summary-section grid grid-cols-2 gap-6 mb-10">
          <div className="bg-slate-50 p-4 border rounded-2xl">
            <h3 className="font-bold uppercase text-xs mb-3">P&L Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Total Revenue:</span><span className="font-bold">৳{stats.totalIncome.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Operational Cost:</span><span className="font-bold text-destructive">৳{stats.totalExpense.toLocaleString()}</span></div>
              <div className="flex justify-between border-t pt-2"><span>Net Surplus:</span><span className="font-black text-primary">৳{stats.netProfit.toLocaleString()}</span></div>
            </div>
          </div>
          <div className="bg-slate-50 p-4 border rounded-2xl">
            <h3 className="font-bold uppercase text-xs mb-3">Efficiency Metrics</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Rent Recovery:</span><span className="font-bold">{Math.round((stats.totalIncome / (stats.totalIncome + 5000)) * 100) || 0}%</span></div>
              <div className="flex justify-between"><span>Cost/Revenue Ratio:</span><span className="font-bold">{((stats.totalExpense / (stats.totalIncome || 1)) * 100).toFixed(1)}%</span></div>
            </div>
          </div>
        </div>
        <h3 className="font-black uppercase text-xs mb-2">Expense Categories</h3>
        <table className="mb-8">
          <thead><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Total Amount</TableHead></TableRow></thead>
          <TableBody>{stats.expensesByCategory.map(c => (<TableRow key={c.name}><TableCell className="capitalize">{c.name}</TableCell><TableCell className="text-right">৳{c.value.toLocaleString()}</TableCell></TableRow>))}</TableBody>
        </table>
        <div className="print-footer mt-10"><div className="signature-box">Accountant Signature</div><div className="signature-box">Manager Signature</div></div>
      </div>

      {/* Main Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-secondary/20 p-6 rounded-2xl border print:hidden">
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white h-10" /></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white h-10" /></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Building Scope</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger className="bg-white h-10"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">Entire Branch</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
        <Button variant="ghost" className="h-10 font-bold uppercase text-xs gap-2" onClick={() => { setBuildingFilter("all"); setStartDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]); setEndDate(new Date().toISOString().split('T')[0]) }}><XCircle size={14}/> Reset View</Button>
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

      {/* Row 1: Health and Trend */}
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
          <CardHeader><CardTitle className="text-lg font-bold flex items-center gap-2"><TrendingUp size={20} className="text-primary"/> Financial Performance Trend</CardTitle></CardHeader>
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

      {/* ROW 2: Deep Expense Analysis (The Core Update) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:hidden">
        {/* Category breakdown Chart */}
        <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="text-lg font-bold flex items-center gap-2"><Info size={20} className="text-primary"/> Expense Category Split</CardTitle>
            <CardDescription>Breakdown of spending by major cost heads.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center p-6">
            {stats.expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.expensesByCategory}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartTooltip />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground italic">No expense data for selected period.</div>
            )}
          </CardContent>
        </Card>

        {/* Building Efficiency / Performance */}
        <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="text-lg font-bold flex items-center gap-2"><Calculator size={20} className="text-primary"/> Building Cost Efficiency</CardTitle>
            <CardDescription>Income generated vs Expense incurred (Ratio).</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-6">
            {stats.expensesByBuilding.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.expensesByBuilding} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} />
                  <RechartTooltip cursor={{fill: '#f8fafc'}} />
                  <Legend />
                  <Bar dataKey="income" fill="#296EB3" radius={[4, 4, 0, 0]} name="Income (৳)" />
                  <Bar dataKey="expense" fill="#F06A6A" radius={[4, 4, 0, 0]} name="Expense (৳)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground italic">Insufficient building data.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Room Ranking and Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:hidden">
        {/* Most Costly Units Table */}
        <Card className="lg:col-span-2 rounded-3xl border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-bold flex items-center gap-2"><ArrowUpRight size={20} className="text-destructive"/> Top Expense Center (Rooms)</CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase">Period Ranked</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">Exp. Count</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.expensesByRoom.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell><div className="font-bold">Room {r.name}</div><div className="text-[10px] text-muted-foreground">{r.bName}</div></TableCell>
                    <TableCell className="text-center"><Badge variant="secondary" className="h-5 text-[10px]">{r.count} Times</Badge></TableCell>
                    <TableCell className="text-right font-black text-destructive">৳{r.expense.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {r.count >= 3 ? <Badge className="bg-destructive">High</Badge> : r.count >= 2 ? <Badge className="bg-orange-500">Mid</Badge> : <Badge variant="outline" className="text-success border-success">Low</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
                {stats.expensesByRoom.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No room-specific expenses identified.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Smart Insights Box */}
        <div className="space-y-6">
          <Card className="rounded-3xl border-none shadow-sm bg-primary/5 border border-primary/10 overflow-hidden">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2"><Zap size={16}/> Smart Analytics</CardTitle></CardHeader>
            <CardContent className="space-y-4 pt-2">
              {stats.insights.map((insight, idx) => (
                <div key={idx} className="flex gap-3 items-start group">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0 group-hover:scale-150 transition-transform"/>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed">{insight}</p>
                </div>
              ))}
              {stats.insights.length === 0 && <p className="text-xs text-muted-foreground italic">Insufficient data to generate specific insights.</p>}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="pb-2 border-b"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Highest Efficiency Unit</CardTitle></CardHeader>
            <CardContent className="pt-6 text-center">
              {stats.expensesByBuilding.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-3xl font-black text-success">
                    {stats.expensesByBuilding.sort((a,b) => Number(b.efficiency) - Number(a.efficiency))[0]?.name}
                  </div>
                  <Badge className="bg-success text-[10px] uppercase">Efficiency Ratio: {stats.expensesByBuilding.sort((a,b) => Number(b.efficiency) - Number(a.efficiency))[0]?.efficiency}</Badge>
                </div>
              ) : <p className="text-xs text-muted-foreground italic">N/A</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
