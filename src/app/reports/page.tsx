
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  Calendar, 
  ArrowRight, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  FileSpreadsheet,
  Printer,
  XCircle,
  Building2,
  Info
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

export default function ReportsPage() {
  const db = useFirestore()
  
  // States for filtering
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [buildingFilter, setBuildingFilter] = useState("all")

  // Data Fetching
  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, "payments"), orderBy("date", "desc")), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const expensesQuery = useMemoFirebase(() => query(collection(db, "expenses"), orderBy("expenseDate", "desc")), [db])
  const { data: expenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  // Filtered Data Logic
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

  // Calculation Aggregates
  const stats = useMemo(() => {
    const totalIncome = filteredData.income.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    const totalExpense = filteredData.expense.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense
    }
  }, [filteredData])

  // Prepare Chart Data (Grouped by Date)
  const chartData = useMemo(() => {
    const dailyMap: Record<string, { name: string, income: number, expense: number }> = {}
    
    filteredData.income.forEach(p => {
      const d = p.date?.toDate ? p.date.toDate().toLocaleDateString() : new Date(p.date).toLocaleDateString()
      if (!dailyMap[d]) dailyMap[d] = { name: d, income: 0, expense: 0 }
      dailyMap[d].income += (p.amount || 0)
    })

    filteredData.expense.forEach(e => {
      const d = new Date(e.expenseDate).toLocaleDateString()
      if (!dailyMap[d]) dailyMap[d] = { name: d, income: 0, expense: 0 }
      dailyMap[d].expense += (e.amount || 0)
    })

    return Object.values(dailyMap).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime())
  }, [filteredData])

  // CSV Export Logic
  const handleExportCSV = () => {
    const headers = ["Type", "Date", "Receiver/Expenser", "Category", "Payment Method", "Location (Bldg/Unit/Room)", "Amount"]
    
    // Formatting rows for CSV
    const incomeRows = filteredData.income.map(p => [
      "INCOME",
      p.date?.toDate ? p.date.toDate().toLocaleDateString() : new Date(p.date).toLocaleDateString(),
      p.receiver || "N/A",
      "Rent/Food Collection",
      p.method || "N/A",
      p.buildingName || "N/A",
      p.amount
    ])

    const expenseRows = filteredData.expense.map(e => [
      "EXPENSE",
      new Date(e.expenseDate).toLocaleDateString(),
      e.expensePartyName || "N/A",
      e.category || "N/A",
      e.method || "N/A",
      `${e.buildingName || 'General'}${e.apartmentName && e.apartmentName !== 'none' ? ' / ' + e.apartmentName : ''}${e.roomNumber ? ' / Room ' + e.roomNumber : ''}`,
      e.amount
    ])

    // Building the CSV content with sections and totals
    let csvContent = "data:text/csv;charset=utf-8," 
    csvContent += "SOMIKORON FINANCIAL REPORT\n"
    csvContent += `Period: ${startDate} to ${endDate}\n`
    csvContent += `Building Filter: ${buildingFilter === 'all' ? 'All Properties' : buildings?.find(b => b.id === buildingFilter)?.name}\n\n`

    // Income Section
    csvContent += "SECTION: INCOME RECORDS\n"
    csvContent += headers.join(",") + "\n"
    incomeRows.forEach(row => { csvContent += row.join(",") + "\n" })
    csvContent += `,,,,,SUBTOTAL INCOME,${stats.totalIncome}\n\n`

    // Expense Section
    csvContent += "SECTION: EXPENSE RECORDS\n"
    csvContent += headers.join(",") + "\n"
    expenseRows.forEach(row => { csvContent += row.join(",") + "\n" })
    csvContent += `,,,,,SUBTOTAL EXPENSE,${stats.totalExpense}\n\n`

    // Summary Section
    csvContent += "FINAL SUMMARY\n"
    csvContent += `Total Income,,,,,,${stats.totalIncome}\n`
    csvContent += `Total Expense,,,,,,${stats.totalExpense}\n`
    csvContent += `Net Profit/Loss,,,,,,${stats.netProfit}\n`

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Somikoron_Detailed_Report_${startDate}_to_${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleReset = () => {
    setStartDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
    setEndDate(new Date().toISOString().split('T')[0])
    setBuildingFilter("all")
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
            <p className="text-muted-foreground mt-1">Granular financial insights with custom filtering.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <FileSpreadsheet size={16} /> Export CSV
          </Button>
          <Button className="gap-2" onClick={handlePrint}>
            <Printer size={16} /> Print/PDF
          </Button>
        </div>
      </div>

      {/* Filter Section */}
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
            <Button variant="ghost" className="h-10" onClick={handleReset}>
              <XCircle size={14} className="mr-1" /> Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-income/5 border-l-4 border-l-income">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase text-income">Total Income</CardTitle>
            <TrendingUp className="text-income h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">₹{stats.totalIncome.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Based on {filteredData.income.length} collections</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-expense/5 border-l-4 border-l-expense">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase text-expense">Total Expenses</CardTitle>
            <TrendingDown className="text-expense h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">₹{stats.totalExpense.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Based on {filteredData.expense.length} payments</p>
          </CardContent>
        </Card>
        <Card className={cn(
          "border-none shadow-sm border-l-4",
          stats.netProfit >= 0 ? "bg-primary/5 border-l-primary" : "bg-destructive/5 border-l-destructive"
        )}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase">Net Profit/Loss</CardTitle>
            <Wallet className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-3xl font-black",
              stats.netProfit >= 0 ? "text-primary" : "text-destructive"
            )}>
              {stats.netProfit < 0 ? '-' : ''}₹{Math.abs(stats.netProfit).toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">For selected period</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 size={18} className="text-primary" />
              Cash Flow Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="income" name="Income" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-sm">Summary Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Transactions</span>
                <Badge variant="secondary">{filteredData.income.length + filteredData.expense.length}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm border-t pt-4">
                <span className="text-muted-foreground font-medium">Income Streams</span>
                <span className="font-bold text-income">₹{stats.totalIncome.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Expenses</span>
                <span className="font-bold text-expense">₹{stats.totalExpense.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="bg-primary/5 p-4 rounded-xl space-y-2">
                <p className="text-[10px] uppercase font-bold text-primary">Efficiency Ratio</p>
                <div className="text-xl font-bold">
                  {stats.totalIncome > 0 ? ((stats.netProfit / stats.totalIncome) * 100).toFixed(1) : 0}% 
                  <span className="text-xs font-normal text-muted-foreground ml-1">Margin</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-primary text-primary-foreground overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={80} /></div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-widest opacity-80">Report Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{new Date(startDate).toLocaleDateString()}</div>
              <div className="flex items-center gap-2 text-xs opacity-60 my-1"><ArrowRight size={12}/> to</div>
              <div className="text-lg font-bold">{new Date(endDate).toLocaleDateString()}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hidden summary for Print */}
      <div className="hidden print:block space-y-8 mt-8 border-t pt-8">
        <h2 className="text-2xl font-bold text-center">Financial Performance Report</h2>
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <p><strong>Period:</strong> {startDate} to {endDate}</p>
            <p><strong>Building:</strong> {buildingFilter === 'all' ? 'All Properties' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
          </div>
          <div className="text-right">
            <p><strong>Generated on:</strong> {new Date().toLocaleString()}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="font-bold border-b pb-1">Summary Aggregates</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="border p-2">
              <p className="text-xs uppercase">Total Income</p>
              <p className="text-lg font-bold">₹{stats.totalIncome.toLocaleString()}</p>
            </div>
            <div className="border p-2">
              <p className="text-xs uppercase">Total Expense</p>
              <p className="text-lg font-bold text-destructive">₹{stats.totalExpense.toLocaleString()}</p>
            </div>
            <div className="border p-2">
              <p className="text-xs uppercase">Net Balance</p>
              <p className="text-lg font-bold text-primary">₹{stats.netProfit.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold border-b pb-1">Income Details</h3>
          <table className="w-full text-xs border">
            <thead>
              <tr className="bg-secondary/20">
                <th className="border p-1 text-left">Date</th>
                <th className="border p-1 text-left">Receiver</th>
                <th className="border p-1 text-left">Bldg</th>
                <th className="border p-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.income.map((p, i) => (
                <tr key={i}>
                  <td className="border p-1">{p.date?.toDate ? p.date.toDate().toLocaleDateString() : new Date(p.date).toLocaleDateString()}</td>
                  <td className="border p-1">{p.receiver}</td>
                  <td className="border p-1">{p.buildingName}</td>
                  <td className="border p-1 text-right">₹{p.amount?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold border-b pb-1">Expense Details</h3>
          <table className="w-full text-xs border">
            <thead>
              <tr className="bg-secondary/20">
                <th className="border p-1 text-left">Date</th>
                <th className="border p-1 text-left">Expenser</th>
                <th className="border p-1 text-left">Category</th>
                <th className="border p-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.expense.map((e, i) => (
                <tr key={i}>
                  <td className="border p-1">{new Date(e.expenseDate).toLocaleDateString()}</td>
                  <td className="border p-1">{e.expensePartyName}</td>
                  <td className="border p-1">{e.category}</td>
                  <td className="border p-1 text-right text-destructive">₹{e.amount?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
