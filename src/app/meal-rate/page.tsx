"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  Info
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

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const getLocYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DailyMealRatePage() {
  const db = useFirestore()
  const [userBranch, setUserBranch] = useState("")
  const [selectedBuildingId, setSelectedBuildingId] = useState("")
  const [selectedDate, setSelectedDate] = useState(getLocYMD(new Date()))
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
    return query(collection(db, "students"), where("buildingId", "==", selectedBuildingId), where("isActive", "==", true))
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

  const mealConfigRef = useMemoFirebase(() => 
    userBranch ? doc(db, "configs", `mealConfig_${userBranch}`) : null, 
    [db, userBranch]
  )
  const { data: mealConfig } = useDoc(mealConfigRef)

  // CALCULATE RATE FOR SELECTED BUILDING & DATE
  const analysis = useMemo(() => {
    if (!selectedBuildingId || !selectedDate || !students || !expenses || !isMounted) return null

    const targetDateYMD = selectedDate
    const now = new Date()
    const todayYMD = getLocYMD(now)
    
    // Yesterday logic to find "Decision Date" for Today's meals
    const targetDateObj = new Date(selectedDate)
    const yesterdayObj = new Date(targetDateObj)
    yesterdayObj.setDate(targetDateObj.getDate() - 1)
    const updateDateForTargetYMD = getLocYMD(yesterdayObj)
    
    const dayName = WEEKDAYS[targetDateObj.getDay()]
    const bAvail = mealConfig?.breakfastAvailable !== false;
    const lAvail = mealConfig?.lunchAvailable !== false;
    const dAvail = mealConfig?.dinnerAvailable !== false;

    let bCount = 0; let lCount = 0; let dCount = 0;
    
    students.forEach(s => {
      let eatsB = false; let eatsL = false; let eatsD = false;
      const lastUpdateYMD = s.lastMealUpdateDate || "";
      
      // Determine if student was active for this specific date
      // If the target is Future/Today, use current status/schedule
      if (targetDateYMD >= todayYMD) {
        const isUpdated = lastUpdateYMD === todayYMD || lastUpdateYMD === updateDateForTargetYMD;
        if (isUpdated) {
          eatsB = !!s.mealStatus?.breakfast && bAvail;
          eatsL = !!s.mealStatus?.lunch && lAvail;
          eatsD = !!s.mealStatus?.dinner && dAvail;
        } else if (s.mealStatus?.autoMode) {
          const sched = s.weeklySchedule?.[dayName] || { breakfast: true, lunch: true, dinner: true }
          eatsB = !!sched.breakfast && bAvail;
          eatsL = !!sched.lunch && lAvail;
          eatsD = !!sched.dinner && dAvail;
        }
        
        // Guest meals
        if (lastUpdateYMD === updateDateForTargetYMD) {
          bCount += Number(s.tomorrowGuestMeals?.breakfast || 0);
          lCount += Number(s.tomorrowGuestMeals?.lunch || 0);
          dCount += Number(s.tomorrowGuestMeals?.dinner || 0);
        }
      } else {
        // For past dates, we assume full attendance if in auto mode 
        // (Since we don't have daily history logs yet, this is an estimation)
        if (s.mealStatus?.autoMode) {
          const sched = s.weeklySchedule?.[dayName] || { breakfast: true, lunch: true, dinner: true }
          eatsB = !!sched.breakfast && bAvail;
          eatsL = !!sched.lunch && lAvail;
          eatsD = !!sched.dinner && dAvail;
        }
      }

      if (eatsB) bCount += 1;
      if (eatsL) lCount += 1;
      if (eatsD) dCount += 1;
    })

    const totalWeightedMeals = (bCount * 0.5) + lCount + dCount;

    // Filter expenses for specific date
    const dailyExpenses = expenses.filter(e => e.expenseDate === targetDateYMD)
    const totalMarketCost = dailyExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0)

    const rate = totalWeightedMeals > 0 ? (totalMarketCost / totalWeightedMeals) : 0

    return {
      cost: totalMarketCost,
      bCount, lCount, dCount,
      totalMeals: totalWeightedMeals,
      rate
    }
  }, [selectedBuildingId, selectedDate, students, expenses, mealConfig, isMounted])

  // GENERATE HISTORY (Last 7 Days)
  const history = useMemo(() => {
    if (!selectedBuildingId || !expenses || !students || !isMounted) return []
    const list = []
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ymd = getLocYMD(d)
      
      const dailyExpenses = expenses.filter(e => e.expenseDate === ymd)
      const cost = dailyExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
      
      // We'll just show cost for now as calculating historical meal counts precisely requires snapshots
      list.push({ date: ymd, cost, building: buildings?.find(b => b.id === selectedBuildingId)?.name })
    }
    return list
  }, [selectedBuildingId, expenses, students, buildings, isMounted])

  if (!isMounted) return null

  return (
    <div className="space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Meal Rate Analysis</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Calculate daily ROI and catering efficiency Building-wise.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
             <CardHeader className="bg-primary text-white">
                <CardTitle className="flex items-center gap-2"><Building2 size={20}/> Scope Selection</CardTitle>
                <CardDescription className="text-white/60">Choose building and date for calculation.</CardDescription>
             </CardHeader>
             <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Target Building</Label>
                  <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                       <SelectValue placeholder={buildingsLoading ? "Loading..." : "Select Building"} />
                    </SelectTrigger>
                    <SelectContent>
                       {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Select Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-primary" />
                    <Input 
                      type="date" 
                      value={selectedDate} 
                      onChange={e => setSelectedDate(e.target.value)} 
                      className="pl-10 h-12 rounded-2xl bg-slate-50 border-none font-bold"
                    />
                  </div>
                </div>
             </CardContent>
             <CardFooter className="bg-slate-50 border-t p-4">
                <div className="flex gap-2 items-center text-[10px] font-bold text-slate-400 uppercase">
                   <Info size={14}/>
                   <span>Formula: Total Cost / ((B×0.5) + L + D)</span>
                </div>
             </CardFooter>
          </Card>

          {analysis && analysis.totalMeals > 0 && (
            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden p-8 space-y-6">
               <div className="text-center space-y-1">
                  <p className="text-[10px] font-black uppercase text-primary/70 tracking-[0.3em]">Daily Calculated Rate</p>
                  <h2 className="text-6xl font-black text-white">৳{analysis.rate.toFixed(2)}</h2>
                  <p className="text-[10px] font-bold text-white/30 uppercase mt-2">Cost per Plate</p>
               </div>
               <Separator className="bg-white/10" />
               <div className="flex justify-between items-center bg-white/5 p-4 rounded-3xl">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-2xl bg-success/20 flex items-center justify-center text-success"><ShoppingBag size={20}/></div>
                     <div><p className="text-[8px] font-bold text-white/40 uppercase">Daily Expense</p><p className="font-bold">৳{analysis.cost.toLocaleString()}</p></div>
                  </div>
                  <div className="text-right">
                     <p className="text-[8px] font-bold text-white/40 uppercase">Plate Yield</p>
                     <p className="font-bold">{analysis.totalMeals} Units</p>
                  </div>
               </div>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-none shadow-sm bg-white rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-1">
                 <div className="h-10 w-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center mb-2"><Soup size={20}/></div>
                 <p className="text-[10px] font-black uppercase text-muted-foreground">Breakfast</p>
                 <h4 className="text-2xl font-black text-slate-800">{analysis?.bCount || 0}</h4>
                 <Badge variant="secondary" className="text-[8px] font-bold uppercase">Weight: 0.5</Badge>
              </Card>
              <Card className="border-none shadow-sm bg-white rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-1">
                 <div className="h-10 w-10 rounded-xl bg-success/5 text-success flex items-center justify-center mb-2"><Utensils size={20}/></div>
                 <p className="text-[10px] font-black uppercase text-muted-foreground">Lunch</p>
                 <h4 className="text-2xl font-black text-slate-800">{analysis?.lCount || 0}</h4>
                 <Badge variant="secondary" className="text-[8px] font-bold uppercase">Weight: 1.0</Badge>
              </Card>
              <Card className="border-none shadow-sm bg-white rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-1">
                 <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center mb-2"><Utensils size={20}/></div>
                 <p className="text-[10px] font-black uppercase text-muted-foreground">Dinner</p>
                 <h4 className="text-2xl font-black text-slate-800">{analysis?.dCount || 0}</h4>
                 <Badge variant="secondary" className="text-[8px] font-bold uppercase">Weight: 1.0</Badge>
              </Card>
           </div>

           <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
                 <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><History size={20}/></div>
                   <CardTitle className="text-lg">Recent Daily Expenses</CardTitle>
                 </div>
                 <Badge className="bg-primary/10 text-primary border-none">Last 7 Days</Badge>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                    <TableHeader className="bg-slate-50/30">
                       <TableRow>
                          <TableHead className="font-bold">Date</TableHead>
                          <TableHead className="font-bold">Building</TableHead>
                          <TableHead className="text-right font-bold">Market Cost</TableHead>
                          <TableHead className="text-right font-bold">Action</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {history.map((h, i) => (
                         <TableRow key={i} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell className="font-medium text-xs">{h.date}</TableCell>
                            <TableCell className="text-xs font-bold text-slate-600">{h.building || '...'}</TableCell>
                            <TableCell className="text-right font-black text-destructive">৳{h.cost.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                               <Button variant="ghost" size="sm" onClick={() => setSelectedDate(h.date)} className="text-primary gap-1 font-bold">
                                  Select <ArrowRight size={14}/>
                               </Button>
                            </TableCell>
                         </TableRow>
                       ))}
                       {!selectedBuildingId && (
                         <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">Please select a building to view history.</TableCell></TableRow>
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
