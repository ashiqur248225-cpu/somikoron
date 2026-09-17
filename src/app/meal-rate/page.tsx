"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { 
  Calculator, 
  Building2, 
  Calendar, 
  Utensils, 
  Loader2, 
  TrendingUp, 
  ShoppingBag,
  ChevronLeft,
  ArrowRight,
  Soup,
  History,
  Info,
  CalendarDays,
  Users
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, limit } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2024", "2025", "2026", "2027", "2028"];

export default function DailyMealRatePage() {
  const db = useFirestore()
  const [userBranch, setUserBranch] = useState("")
  const [selectedBuildingId, setSelectedBuildingId] = useState("")
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
  }, [])

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings, isLoading: buildingsLoading } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!selectedBuildingId) return null
    // Fetch all students in building to look at history or current counters
    return query(collection(db, "students"), where("buildingId", "==", selectedBuildingId))
  }, [db, selectedBuildingId])
  const { data: students } = useCollection(studentsQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!selectedBuildingId) return null
    return query(
      collection(db, "expenses"), 
      where("buildingId", "==", selectedBuildingId),
      where("category", "in", ["market", "food"])
    )
  }, [db, selectedBuildingId])
  const { data: expenses } = useCollection(expensesQuery)

  // CALCULATE RATE FOR SELECTED BUILDING & MONTH
  const analysis = useMemo(() => {
    if (!selectedBuildingId || !selectedMonth || !selectedYear || !students || !expenses || !isMounted) return null

    const targetMonthLabel = `${selectedMonth} ${selectedYear}`
    const now = new Date()
    const currentMonthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
    const isCurrentMonth = targetMonthLabel === currentMonthLabel

    // 1. Calculate Monthly Market Cost
    // Expenses stored with expenseDate "YYYY-MM-DD"
    const monthIndex = MONTHS.indexOf(selectedMonth) + 1
    const prefix = `${selectedYear}-${String(monthIndex).padStart(2, '0')}`
    
    const monthlyExpenses = expenses.filter(e => e.expenseDate && e.expenseDate.startsWith(prefix))
    const totalMarketCost = monthlyExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0)

    // 2. Calculate Total Monthly Weighted Meals
    let bCount = 0; let lCount = 0; let dCount = 0; let gCount = 0;

    students.forEach(s => {
      if (isCurrentMonth) {
        // If current month, use the running counters
        bCount += Number(s.currentMonthBreakfast || 0);
        lCount += Number(s.currentMonthLunch || 0);
        dCount += Number(s.currentMonthDinner || 0);
        gCount += Number(s.currentMonthGuestMeals || 0);
      } else {
        // If past month, look in mealsHistory array
        const historyEntry = (s.mealsHistory || []).find((h: any) => h.month === targetMonthLabel);
        if (historyEntry) {
          // Note: mealsHistory often stores pre-calculated totalMeals. 
          // If individual counters aren't stored in history, we use the total.
          // For this aggregation, we'll assume the totalMeals already includes B*0.5 + L + D + G
          // But to keep UI consistent, we'll assign it to lunch for visual sum if counters missing.
          lCount += Number(historyEntry.totalMeals || 0);
        }
      }
    })

    const totalWeightedMeals = isCurrentMonth 
      ? (bCount * 0.5) + lCount + dCount + gCount 
      : lCount; // For history, we use the pre-calculated total

    const rate = totalWeightedMeals > 0 ? (totalMarketCost / totalWeightedMeals) : 0

    return {
      cost: totalMarketCost,
      bCount, lCount, dCount, gCount,
      totalMeals: totalWeightedMeals,
      rate,
      isCurrentMonth,
      targetMonthLabel
    }
  }, [selectedBuildingId, selectedMonth, selectedYear, students, expenses, isMounted])

  // HISTORY BY MONTH (Latest 6 Months)
  const history = useMemo(() => {
    if (!selectedBuildingId || !expenses || !isMounted) return []
    const list = []
    const now = new Date()
    
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const mName = MONTHS[d.getMonth()]
      const yName = d.getFullYear().toString()
      const mIdx = d.getMonth() + 1
      const prefix = `${yName}-${String(mIdx).padStart(2, '0')}`
      
      const monthlyExpenses = expenses.filter(e => e.expenseDate && e.expenseDate.startsWith(prefix))
      const cost = monthlyExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
      
      if (cost > 0) {
        list.push({ 
          label: `${mName} ${yName}`, 
          month: mName, 
          year: yName, 
          cost, 
          building: buildings?.find(b => b.id === selectedBuildingId)?.name 
        })
      }
    }
    return list
  }, [selectedBuildingId, expenses, buildings, isMounted])

  if (!isMounted) return null

  return (
    <div className="space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Meal Rate Analysis</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Calculate monthly ROI and average catering cost Building-wise.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
             <CardHeader className="bg-primary text-white">
                <CardTitle className="flex items-center gap-2"><Building2 size={20}/> Scope Selection</CardTitle>
                <CardDescription className="text-white/60">Choose building and month for analysis.</CardDescription>
             </CardHeader>
             <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Target Building</Label>
                  <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-slate-700">
                       <SelectValue placeholder={buildingsLoading ? "Loading..." : "Select Building"} />
                    </SelectTrigger>
                    <SelectContent>
                       {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Select Month</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-slate-700">
                        <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Year</Label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
             </CardContent>
             <CardFooter className="bg-slate-50 border-t p-4">
                <div className="flex gap-2 items-center text-[10px] font-bold text-slate-400 uppercase">
                   <Info size={14}/>
                   <span>Formula: Total Monthly Cost / Total Monthly Meals</span>
                </div>
             </CardFooter>
          </Card>

          {analysis && analysis.totalMeals > 0 && (
            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden p-8 space-y-6">
               <div className="text-center space-y-1">
                  <p className="text-[10px] font-black uppercase text-primary/70 tracking-[0.3em]">Monthly Average Rate</p>
                  <h2 className="text-6xl font-black text-white">৳{analysis.rate.toFixed(2)}</h2>
                  <p className="text-[10px] font-bold text-white/30 uppercase mt-2">Calculated for {analysis.targetMonthLabel}</p>
               </div>
               <Separator className="bg-white/10" />
               <div className="flex justify-between items-center bg-white/5 p-4 rounded-3xl">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-2xl bg-success/20 flex items-center justify-center text-success"><ShoppingBag size={20}/></div>
                     <div><p className="text-[8px] font-bold text-white/40 uppercase">Total Market</p><p className="font-bold">৳{analysis.cost.toLocaleString()}</p></div>
                  </div>
                  <div className="text-right">
                     <p className="text-[8px] font-bold text-white/40 uppercase">Total Yield</p>
                     <p className="font-bold">{analysis.totalMeals.toFixed(1)} Units</p>
                  </div>
               </div>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-none shadow-sm bg-white rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-1">
                 <div className="h-10 w-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center mb-2"><Soup size={20}/></div>
                 <p className="text-[10px] font-black uppercase text-muted-foreground">Monthly Breakfast</p>
                 <h4 className="text-2xl font-black text-slate-800">{analysis?.isCurrentMonth ? analysis.bCount : '-'}</h4>
                 <Badge variant="secondary" className="text-[8px] font-bold uppercase">Weight: 0.5</Badge>
              </Card>
              <Card className="border-none shadow-sm bg-white rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-1">
                 <div className="h-10 w-10 rounded-xl bg-success/5 text-success flex items-center justify-center mb-2"><Utensils size={20}/></div>
                 <p className="text-[10px] font-black uppercase text-muted-foreground">Monthly Lunch/Dinner</p>
                 <h4 className="text-2xl font-black text-slate-800">{analysis?.isCurrentMonth ? (analysis.lCount + analysis.dCount) : '-'}</h4>
                 <Badge variant="secondary" className="text-[8px] font-bold uppercase">Weight: 1.0</Badge>
              </Card>
              <Card className="border-none shadow-sm bg-white rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-1">
                 <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center mb-2"><Users size={20}/></div>
                 <p className="text-[10px] font-black uppercase text-muted-foreground">Monthly Guests</p>
                 <h4 className="text-2xl font-black text-slate-800">{analysis?.isCurrentMonth ? analysis.gCount : '-'}</h4>
                 <Badge variant="secondary" className="text-[8px] font-bold uppercase">Weight: 1.0</Badge>
              </Card>
           </div>

           <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
                 <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><History size={20}/></div>
                   <CardTitle className="text-lg">Monthly Cost History</CardTitle>
                 </div>
                 <Badge className="bg-primary/10 text-primary border-none">Last 6 Months</Badge>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                    <TableHeader className="bg-slate-50/30">
                       <TableRow>
                          <TableHead className="font-bold">Period</TableHead>
                          <TableHead className="font-bold">Building</TableHead>
                          <TableHead className="text-right font-bold">Total Market Cost</TableHead>
                          <TableHead className="text-right font-bold">Action</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {history.map((h, i) => (
                         <TableRow key={i} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell className="font-bold text-xs">{h.label}</TableCell>
                            <TableCell className="text-xs font-bold text-slate-600">{h.building || '...'}</TableCell>
                            <TableCell className="text-right font-black text-destructive">৳{h.cost.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                               <Button variant="ghost" size="sm" onClick={() => { setSelectedMonth(h.month); setSelectedYear(h.year); }} className="text-primary gap-1 font-bold">
                                  Analyze <ArrowRight size={14}/>
                               </Button>
                            </TableCell>
                         </TableRow>
                       ))}
                       {!selectedBuildingId && (
                         <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">Please select a building to view monthly history.</TableCell></TableRow>
                       )}
                       {selectedBuildingId && history.length === 0 && (
                         <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">No market data found for the last 6 months.</TableCell></TableRow>
                       )}
                    </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  )
}
