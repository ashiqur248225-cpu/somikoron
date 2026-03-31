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
  Info,
  CircleAlert,
  Download,
  Share2,
  FileText
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

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students } = useCollection(studentsQuery)

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
    
    const totalDues = (students || []).filter(s => s.isActive && (buildingFilter === 'all' || s.buildingId === buildingFilter)).reduce((acc, student) => {
      const billingStart = student.billingStartDate ? new Date(student.billingStartDate) : (student.createdAt?.toDate?.() || new Date())
      const now = new Date()
      const monthsElapsed = (now.getFullYear() - billingStart.getFullYear()) * 12 + (now.getMonth() - billingStart.getMonth())
      
      const historicalRentDue = Number(student.dueAmount) || 0
      const generatedRent = (monthsElapsed > 0 ? monthsElapsed : 0) * (student.monthlyRent || 0)
      
      const totalRentPaid = student.paymentsHistory?.reduce((pAcc: number, curr: any) => {
        const rentPortion = (curr.seatAmount !== undefined) 
          ? Number(curr.seatAmount) 
          : (student.paymentSystem === 'package' ? Number(curr.amount) : 0)
        return pAcc + rentPortion
      }, 0) || 0
      
      const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

      const historicalFoodDue = Number(student.foodDueAmount) || 0
      const generatedFoodCost = student.mealsHistory?.reduce((fAcc: number, curr: any) => fAcc + (curr.totalCost || 0), 0) || 0
      
      const totalFoodPaid = student.paymentsHistory?.reduce((fAcc: number, curr: any) => {
        const foodPortion = (curr.foodAmount !== undefined) 
          ? Number(curr.foodAmount) 
          : (student.paymentSystem === 'non-package' ? Number(curr.amount) : 0)
        return fAcc + foodPortion
      }, 0) || 0
      
      const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)
      const foodDue = foodBalance < 0 ? Math.abs(foodBalance) : 0

      return acc + rentDue + foodDue
    }, 0)

    return {
      totalIncome,
      totalExpense,
      totalDues,
      netProfit: totalIncome - totalExpense
    }
  }, [filteredData, students, buildingFilter])

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.focus();
      window.print();
    }
  }

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
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Report_${startDate}_to_${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleShare = async () => {
    if (typeof window !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Somikoron Financial Summary',
          text: `Financial report summary for period ${startDate} to ${endDate}.`,
          url: window.location.href,
        });
      } catch (err) {
        // Share cancelled
      }
    } else {
      toast({ title: "Share not supported", description: "Sharing is not supported on this browser." });
    }
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
          <Button variant="outline" type="button" className="gap-2" onClick={handleExportCSV}>
            <FileSpreadsheet size={16} /> Export CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Download size={16} /> Export / Share
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePrint} className="cursor-pointer">
                <FileText size={14} className="mr-2" /> Download PDF (Print)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShare} className="cursor-pointer">
                <Share2 size={14} className="mr-2" /> Share Report
              </DropdownMenuItem>
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
            <Button variant="ghost" type="button" className="h-10" onClick={() => { setStartDate(""); setEndDate(""); setBuildingFilter("all") }}>
              <XCircle size={14} className="mr-1" /> Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* This section will be printed */}
      <div className="space-y-8">
        <div className="hidden print:block text-center border-b pb-6 mb-6">
          <h1 className="text-3xl font-bold text-primary">Somikoron Hostel Ledger</h1>
          <h2 className="text-xl font-semibold">Summary Financial Report</h2>
          <p className="text-sm text-muted-foreground mt-2">Period: {startDate} to {endDate}</p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
          <Card className="border-none shadow-sm bg-income/5 border-l-4 border-l-income">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase text-income">Total Income</CardTitle>
              <TrendingUp className="text-income h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">৳{stats.totalIncome.toLocaleString()}</div>
              <p className="text-[10px] text-muted-foreground mt-1">From {filteredData.income.length} records</p>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-sm bg-expense/5 border-l-4 border-l-expense">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase text-expense">Total Expenses</CardTitle>
              <TrendingDown className="text-expense h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">৳{stats.totalExpense.toLocaleString()}</div>
              <p className="text-[10px] text-muted-foreground mt-1">From {filteredData.expense.length} records</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-destructive/5 border-l-4 border-l-destructive">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase text-destructive">Total Dues</CardTitle>
              <CircleAlert className="text-destructive h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">৳{stats.totalDues.toLocaleString()}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Current outstanding</p>
            </CardContent>
          </Card>

          <Card className={cn(
            "border-none shadow-sm border-l-4",
            stats.netProfit >= 0 ? "bg-primary/5 border-l-primary" : "bg-destructive/5 border-l-destructive"
          )}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase">Net Balance</CardTitle>
              <Wallet className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-black",
                stats.netProfit >= 0 ? "text-primary" : "text-destructive"
              )}>
                ৳{stats.netProfit.toLocaleString()}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Profit/Loss for period</p>
            </CardContent>
          </Card>
        </div>

        <div className="hidden print:block space-y-8 pt-8">
          <div className="space-y-4">
            <h3 className="text-lg font-bold border-b pb-2">Recent Income Records</h3>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Receiver</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.income.slice(0, 50).map((p, i) => (
                  <tr key={i}>
                    <td>{p.date?.toDate ? p.date.toDate().toLocaleDateString() : new Date(p.date).toLocaleDateString()}</td>
                    <td>{p.studentName}</td>
                    <td>{p.receiver}</td>
                    <td className="text-right">৳{p.amount?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold border-b pb-2">Recent Expense Records</h3>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Expenser</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.expense.slice(0, 50).map((e, i) => (
                  <tr key={i}>
                    <td>{new Date(e.expenseDate).toLocaleDateString()}</td>
                    <td className="capitalize">{e.category}</td>
                    <td>{e.expensePartyName}</td>
                    <td className="text-right">৳{e.amount?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-20 flex justify-between px-10">
            <div className="border-t border-black px-8 pt-2 text-center text-sm">Auditor Signature</div>
            <div className="border-t border-black px-8 pt-2 text-center text-sm">Director Signature</div>
          </div>
        </div>
      </div>
    </div>
  )
}
