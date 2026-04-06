
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Printer, Loader2, Calendar, LayoutGrid, Filter, XCircle, 
  TrendingUp, Calculator, ArrowUpRight, ArrowDownRight, RefreshCw, ChevronLeft
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, limit } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function FoodHistoryPage() {
  const db = useFirestore()
  const router = useRouter()
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  
  // Date Filtering States
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  // Food Cost History Query - directamente filter for Food category
  const foodHistoryQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(
      collection(db, "expenses"), 
      where("branch", "==", userBranch),
      where("category", "==", "food"),
      limit(1000)
    )
  }, [db, userBranch])
  
  const { data: rawFoodHistory, isLoading } = useCollection(foodHistoryQuery)

  const filteredHistory = useMemo(() => {
    if (!rawFoodHistory) return []
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59)

    return rawFoodHistory
      .filter(item => {
        const itemDate = new Date(item.expenseDate)
        return itemDate >= start && itemDate <= end
      })
      .sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())
  }, [rawFoodHistory, startDate, endDate])

  const analytics = useMemo(() => {
    if (!filteredHistory.length) return {
      totalCost: 0,
      totalMeals: 0,
      avgPerMeal: 0,
      highestDay: null,
      lowestDay: null,
      totalDays: 0
    }

    let totalCost = 0
    let totalMeals = 0
    let highestDay = filteredHistory[0]
    let lowestDay = filteredHistory[0]

    filteredHistory.forEach(item => {
      const cost = Number(item.amount || 0)
      const meals = Number(item.totalMeals || 0)
      totalCost += cost
      totalMeals += meals

      if (cost > (Number(highestDay?.amount) || 0)) highestDay = item
      if (cost < (Number(lowestDay?.amount) || Infinity) && cost > 0) lowestDay = item
    })

    return {
      totalCost,
      totalMeals,
      avgPerMeal: totalMeals > 0 ? (totalCost / totalMeals) : 0,
      highestDay,
      lowestDay,
      totalDays: filteredHistory.length
    }
  }, [filteredHistory])

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
            <ChevronLeft size={24} />
          </Button>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Daily Food History</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">
              Food cost analysis for <span className="font-bold text-foreground">{userBranch}</span>.
            </p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold uppercase text-xs" onClick={handlePrint}>
            <Printer size={16} /> <span className="hidden sm:inline">Print Report</span>
          </Button>
          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* OFFICIAL PROFESSIONAL PRINT REPORT (Hidden on Screen) */}
      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-3xl font-black uppercase text-primary tracking-tighter">SOMIKORON HOSTEL</h1>
          <p className="text-sm font-bold text-slate-600">{userBranch} Branch • Official Records</p>
          <div className="mt-4 border-y-2 border-slate-200 py-4 bg-slate-50/50">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">DAILY FOOD COST HISTORY REPORT</h2>
            <div className="flex justify-center gap-8 text-[10pt] font-bold text-muted-foreground mt-2">
              <p>Period: {new Date(startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} to {new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              <p>Generated At: {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 my-8">
          <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl flex flex-col items-center shadow-sm">
            <p className="text-[8pt] uppercase font-black text-muted-foreground tracking-widest mb-1">Grand Total Food Cost</p>
            <p className="text-xl font-black text-destructive">৳{analytics.totalCost.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl flex flex-col items-center shadow-sm">
            <p className="text-[8pt] uppercase font-black text-muted-foreground tracking-widest mb-1">Total Meals Served</p>
            <p className="text-xl font-black text-slate-800">{analytics.totalMeals.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-2xl flex flex-col items-center shadow-sm">
            <p className="text-[8pt] uppercase font-black text-primary tracking-widest mb-1">Overall Avg Cost/Meal</p>
            <p className="text-xl font-black text-primary">৳{analytics.avgPerMeal.toFixed(2)}</p>
          </div>
        </div>

        <Table className="border-collapse border w-full text-[10pt]">
          <TableHeader>
            <TableRow className="bg-slate-100 border-b-2 border-slate-300">
              <TableHead className="border border-slate-300 font-black text-slate-900 h-12">Date</TableHead>
              <TableHead className="border border-slate-300 font-black text-slate-900 text-center h-12">Total Meals</TableHead>
              <TableHead className="border border-slate-300 font-black text-slate-900 text-right h-12">Total Food Cost</TableHead>
              <TableHead className="border border-slate-300 font-black text-slate-900 text-right h-12">Avg Cost/Meal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredHistory.map((item) => {
              const totalMeals = Number(item.totalMeals || 0)
              const amount = Number(item.amount || 0)
              const perMealPrice = totalMeals > 0 ? (amount / totalMeals).toFixed(2) : "N/A"
              return (
                <TableRow key={item.id} className="border-b border-slate-200">
                  <TableCell className="border border-slate-200 h-10 font-medium">{new Date(item.expenseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                  <TableCell className="border border-slate-200 text-center h-10 font-bold">{totalMeals || '-'}</TableCell>
                  <TableCell className="border border-slate-200 text-right h-10 font-bold">৳{amount.toLocaleString()}</TableCell>
                  <TableCell className="border border-slate-200 text-right h-10 font-black text-primary">৳{perMealPrice}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <div className="print-footer mt-24 flex justify-between px-10">
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[9pt] font-black uppercase">Kitchen Manager</p>
          </div>
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[9pt] font-black uppercase">Branch Manager</p>
          </div>
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[9pt] font-black uppercase">Accountant Signature</p>
          </div>
        </div>
      </div>

      {/* SCREEN VIEW DASHBOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 print:hidden">
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-destructive">Period Cost</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">৳{analytics.totalCost.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Total spending on food</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-primary rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Avg Cost/Meal</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-primary">৳{analytics.avgPerMeal.toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Calculated system average</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-orange-500 rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Total Meals</CardTitle>
            <LayoutGrid className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{analytics.totalMeals}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Meals logged in period</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-secondary/20 p-6 rounded-2xl border items-end print:hidden">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Start Date</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white h-11 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">End Date</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white h-11 rounded-xl" />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground rounded-xl" onClick={() => {
            setStartDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
            setEndDate(new Date().toISOString().split('T')[0]);
          }}>
            <RefreshCw className="h-5 w-5" />
          </Button>
          <Button className="flex-1 h-11 gap-2 font-bold uppercase text-xs rounded-xl" onClick={() => toast({ title: "Filters Applied", description: "Showing data for selected range." })}>
            <Filter size={16}/> Apply Filter
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl print:hidden">
        <CardHeader className="bg-slate-50/50 border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" /> Daily Cost breakdown
            </CardTitle>
            <Badge variant="outline" className="bg-white text-[10px] font-bold uppercase tracking-widest">{analytics.totalDays} Days Found</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold uppercase text-[10px]">Date</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] text-center">Meals Logged</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] text-right">Total Cost</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] text-right">Per Meal Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredHistory.map((item) => {
                  const totalMeals = Number(item.totalMeals || 0)
                  const amount = Number(item.amount || 0)
                  const perMealPrice = totalMeals > 0 ? (amount / totalMeals).toFixed(2) : "N/A"
                  
                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-slate-600">
                        {new Date(item.expenseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-none font-bold">
                          {totalMeals > 0 ? `${totalMeals} Meals` : 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">৳{amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-black text-primary">
                        {perMealPrice !== "N/A" ? `৳${perMealPrice}` : perMealPrice}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!isLoading && filteredHistory.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">No food expense records found for selected period.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Insights Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
        <Card className="border-none shadow-sm bg-primary/5 border border-primary/10 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase text-primary tracking-widest">Smart Insights</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 items-center">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <p className="text-sm font-medium text-slate-700">Highest daily market: <b>৳{analytics.highestDay?.amount?.toLocaleString() || 0}</b></p>
            </div>
            <div className="flex gap-3 items-center">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <p className="text-sm font-medium text-slate-700">Average cost trend: <b>৳{analytics.avgPerMeal.toFixed(2)} /meal</b></p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-orange-50 border border-orange-100 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase text-orange-700 tracking-widest">Efficiency Alert</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-orange-800 leading-relaxed">
              If the average meal price exceeds your threshold, consider reviewing vendor rates or bulk purchases. 
              Currently, your branch efficiency is <Badge variant="outline" className="bg-white text-orange-700 border-orange-200">Stable</Badge>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
