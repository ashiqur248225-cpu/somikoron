"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  Calendar, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  FileSpreadsheet,
  XCircle,
  Building2,
  CircleAlert,
  Download,
  Share2,
  FileText,
  Activity,
  PieChart as PieChartIcon,
  Percent,
  Users
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
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

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, "payments"), orderBy("date", "desc")), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const expensesQuery = useMemoFirebase(() => query(collection(db, "expenses"), orderBy("expenseDate", "desc")), [db])
  const { data: expenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
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

    return {
      income: payments.filter(p => isMatch(p, 'date')),
      expense: expenses.filter(e => isMatch(e, 'expenseDate'))
    }
  }, [payments, expenses, startDate, endDate, buildingFilter])

  const stats = useMemo(() => {
    const totalIncome = filteredData.income.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    const totalExpense = filteredData.expense.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    
    const totalDues = (students || []).filter(s => s.isActive && (buildingFilter === 'all' || s.buildingId === buildingFilter)).reduce((acc, student) => {
      const billingStart = student.billingStartDate ? new Date(student.billingStartDate) : (student.createdAt?.toDate?.() || new Date())
      const now = new Date()
      const monthsElapsed = (now.getFullYear() - billingStart.getFullYear()) * 12 + (now.getMonth() - billingStart.getMonth())
      const historicalRentDue = Number(student.dueAmount) || 0
      const generatedRent = (monthsElapsed > 0 ? monthsElapsed : 0) * (student.monthlyRent || 0)
      const totalRentPaid = student.paymentsHistory?.reduce((pAcc: number, curr: any) => {
        const rentPortion = (curr.seatAmount !== undefined) ? Number(curr.seatAmount) : (student.paymentSystem === 'package' ? Number(curr.amount) : 0)
        return pAcc + rentPortion
      }, 0) || 0
      const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)
      const historicalFoodDue = Number(student.foodDueAmount) || 0
      const generatedFoodCost = student.mealsHistory?.reduce((fAcc: number, curr: any) => fAcc + (curr.totalCost || 0), 0) || 0
      const totalFoodPaid = student.paymentsHistory?.reduce((fAcc: number, curr: any) => {
        const foodPortion = (curr.foodAmount !== undefined) ? Number(curr.foodAmount) : (student.paymentSystem === 'non-package' ? Number(curr.amount) : 0)
        return fAcc + foodPortion
      }, 0) || 0
      const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)
      const foodDue = foodBalance < 0 ? Math.abs(foodBalance) : 0
      return acc + rentDue + foodDue
    }, 0)

    const totalSeats = (buildings || []).reduce((acc, b) => acc + (b.totalSeats || 0), 0)
    const occupiedSeats = (buildings || []).reduce((acc, b) => acc + (b.occupiedSeats || 0), 0)
    const occupancyRate = totalSeats > 0 ? (occupiedSeats / totalSeats) * 100 : 0
    const collectionEfficiency = (totalIncome + totalDues) > 0 ? (totalIncome / (totalIncome + totalDues)) * 100 : 0
    const profitMargin = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0

    return {
      totalIncome,
      totalExpense,
      totalDues,
      netProfit: totalIncome - totalExpense,
      occupancyRate,
      collectionEfficiency,
      profitMargin
    }
  }, [filteredData, students, buildingFilter, buildings])

  const chartData = useMemo(() => {
    const days: any = {}
    
    filteredData.income.forEach(p => {
      const d = p.date?.toDate ? p.date.toDate().toLocaleDateString() : new Date(p.date).toLocaleDateString()
      days[d] = { ...(days[d] || { name: d, income: 0, expense: 0 }), income: (days[d]?.income || 0) + p.amount }
    })
    
    filteredData.expense.forEach(e => {
      const d = new Date(e.expenseDate).toLocaleDateString()
      days[d] = { ...(days[d] || { name: d, income: 0, expense: 0 }), expense: (days[d]?.expense || 0) + e.amount }
    })

    return Object.values(days).sort((a: any, b: any) => new Date(a.name).getTime() - new Date(b.name).getTime())
  }, [filteredData])

  const buildingComparisonData = useMemo(() => {
    if (!buildings) return []
    return buildings.map(b => {
      const inc = filteredData.income.filter(p => p.buildingId === b.id).reduce((acc, p) => acc + p.amount, 0)
      const exp = filteredData.expense.filter(e => e.buildingId === b.id).reduce((acc, e) => acc + e.amount, 0)
      return { name: b.name, income: inc, expense: exp }
    })
  }, [buildings, filteredData])

  const expenseCategoryData = useMemo(() => {
    const cats: any = {}
    filteredData.expense.forEach(e => {
      cats[e.category] = (cats[e.category] || 0) + e.amount
    })
    return Object.entries(cats).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
  }, [filteredData])

  const handlePrint = () => { if (typeof window !== "undefined") { window.focus(); window.print(); } }

  const handleExportCSV = () => {
    const headers = ["Type", "Date", "Receiver/Expenser", "Category", "Amount"]
    const rows = [
      ...filteredData.income.map(p => ["INCOME", p.date?.toDate ? p.date.toDate().toLocaleDateString() : new Date(p.date).toLocaleDateString(), p.receiver || "-", "Rent/Food", p.amount]),
      ...filteredData.expense.map(e => ["EXPENSE", new Date(e.expenseDate).toLocaleDateString(), e.expensePartyName || "-", e.category, e.amount])
    ]
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n"
    rows.forEach(row => { csvContent += row.join(",") + "\n" })
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri); link.setAttribute("download", `Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  if (paymentsLoading || expensesLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Financial Reports</h1>
            <p className="text-muted-foreground mt-1 text-sm">Comprehensive visual and data insights.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" type="button" className="gap-2" onClick={handleExportCSV}><FileSpreadsheet size={16} /> Export CSV</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button className="gap-2"><Download size={16} /> Export / Share</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePrint} className="cursor-pointer"><FileText size={14} className="mr-2" /> Download PDF (Print)</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer"><Share2 size={14} className="mr-2" /> Share Report</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card className="border-none shadow-sm bg-secondary/20 print:hidden">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1.5"><Calendar size={12}/> From Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1.5"><Calendar size={12}/> To Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1.5"><Building2 size={12}/> Building</Label>
              <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" type="button" className="h-10" onClick={() => { setStartDate(""); setEndDate(""); setBuildingFilter("all") }}><XCircle size={14} className="mr-1" /> Reset Filters</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-income/5 border-l-4 border-l-income">
          <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-xs font-bold uppercase text-income">Total Income</CardTitle><TrendingUp className="text-income h-4 w-4" /></CardHeader>
          <CardContent><div className="text-2xl font-black">৳{stats.totalIncome.toLocaleString()}</div><p className="text-[10px] text-muted-foreground mt-1">From {filteredData.income.length} records</p></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-expense/5 border-l-4 border-l-expense">
          <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-xs font-bold uppercase text-expense">Total Expenses</CardTitle><TrendingDown className="text-expense h-4 w-4" /></CardHeader>
          <CardContent><div className="text-2xl font-black">৳{stats.totalExpense.toLocaleString()}</div><p className="text-[10px] text-muted-foreground mt-1">From {filteredData.expense.length} records</p></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-destructive/5 border-l-4 border-l-destructive">
          <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-xs font-bold uppercase text-destructive">Total Dues</CardTitle><CircleAlert className="text-destructive h-4 w-4" /></CardHeader>
          <CardContent><div className="text-2xl font-black">৳{stats.totalDues.toLocaleString()}</div><p className="text-[10px] text-muted-foreground mt-1">Current outstanding</p></CardContent>
        </Card>
        <Card className={cn("border-none shadow-sm border-l-4", stats.netProfit >= 0 ? "bg-primary/5 border-l-primary" : "bg-destructive/5 border-l-destructive")}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-xs font-bold uppercase">Net Balance</CardTitle><Wallet className="h-4 w-4" /></CardHeader>
          <CardContent><div className={cn("text-2xl font-black", stats.netProfit >= 0 ? "text-primary" : "text-destructive")}>৳{stats.netProfit.toLocaleString()}</div><p className="text-[10px] text-muted-foreground mt-1">Profit/Loss for period</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-full md:col-span-2 shadow-sm border-none">
          <CardHeader>
            <div className="flex items-center gap-2"><Activity className="text-primary h-5 w-5"/><CardTitle className="text-lg">Financial Trends</CardTitle></div>
            <CardDescription>Income vs Expense flow over selected period.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#296EB3" stopOpacity={0.1}/><stop offset="95%" stopColor="#296EB3" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F06A6A" stopOpacity={0.1}/><stop offset="95%" stopColor="#F06A6A" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `৳${value}`} />
                <RechartTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="income" stroke="#296EB3" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expense" stroke="#F06A6A" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none">
          <CardHeader>
            <div className="flex items-center gap-2"><PieChartIcon className="text-primary h-5 w-5"/><CardTitle className="text-lg">Hostel Health Score</CardTitle></div>
            <CardDescription>Key performance indicators.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5"><Users size={14} className="text-muted-foreground"/> Occupancy Rate</span><span className="font-bold">{stats.occupancyRate.toFixed(1)}%</span></div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${stats.occupancyRate}%` }} /></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5"><Percent size={14} className="text-muted-foreground"/> Collection Efficiency</span><span className="font-bold">{stats.collectionEfficiency.toFixed(1)}%</span></div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden"><div className="h-full bg-success transition-all" style={{ width: `${stats.collectionEfficiency}%` }} /></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5"><TrendingUp size={14} className="text-muted-foreground"/> Profit Margin</span><span className="font-bold">{stats.profitMargin.toFixed(1)}%</span></div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden"><div className={cn("h-full transition-all", stats.profitMargin >= 0 ? "bg-blue-500" : "bg-destructive")} style={{ width: `${Math.min(Math.abs(stats.profitMargin), 100)}%` }} /></div>
            </div>
            <div className="pt-4 border-t">
               <p className="text-[10px] text-muted-foreground leading-relaxed">
                 {stats.profitMargin > 20 ? "Your hostel is showing excellent financial stability." : stats.profitMargin > 0 ? "Moderate profit margin. Consider optimizing expenses." : "You are currently operating at a loss for this period."}
               </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-none">
          <CardHeader><CardTitle className="text-lg">Expense Categories</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenseCategoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {expenseCategoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <RechartTooltip />
                <Legend layout="vertical" align="right" verticalAlign="middle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none">
          <CardHeader><CardTitle className="text-lg">Building Comparison</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buildingComparisonData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <RechartTooltip cursor={{fill: '#f5f5f5'}} />
                <Legend />
                <Bar dataKey="income" fill="#296EB3" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#F06A6A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="hidden print:block space-y-8">
        <div className="text-center border-b pb-6 mb-6">
          <h1 className="text-3xl font-bold text-primary">Somikoron Hostel Ledger</h1>
          <h2 className="text-xl font-semibold">Summary Financial Report</h2>
          <p className="text-sm text-muted-foreground mt-2">Period: {startDate} to {endDate}</p>
        </div>
        <div className="grid gap-4 grid-cols-4">
          <div className="p-4 border rounded text-center"><p className="text-xs uppercase">Income</p><p className="text-xl font-bold">৳{stats.totalIncome}</p></div>
          <div className="p-4 border rounded text-center"><p className="text-xs uppercase">Expense</p><p className="text-xl font-bold">৳{stats.totalExpense}</p></div>
          <div className="p-4 border rounded text-center"><p className="text-xs uppercase">Dues</p><p className="text-xl font-bold">৳{stats.totalDues}</p></div>
          <div className="p-4 border rounded text-center"><p className="text-xs uppercase">Net</p><p className="text-xl font-bold">৳{stats.netProfit}</p></div>
        </div>
        <div className="pt-20 flex justify-between px-10">
          <div className="border-t border-black px-8 pt-2 text-center text-sm">Auditor Signature</div>
          <div className="border-t border-black px-8 pt-2 text-center text-sm">Director Signature</div>
        </div>
      </div>
    </div>
  )
}