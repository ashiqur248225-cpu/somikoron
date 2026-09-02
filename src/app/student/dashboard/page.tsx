
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Home, 
  Wallet, 
  Clock, 
  History, 
  ShieldCheck, 
  Utensils, 
  Smartphone,
  ChevronRight,
  TrendingUp,
  CircleDollarSign,
  Zap,
  Wifi,
  ChefHat,
  Loader2,
  Receipt,
  Calculator,
  CheckCircle2,
  AlertCircle
} from "lucide-react"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc, updateDoc, increment, serverTimestamp } from "firebase/firestore"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import Link from "next/link"

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Robust YYYY-MM-DD formatter for local time
 */
const getLocYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function StudentDashboardPage() {
  const db = useFirestore()
  const [studentId, setStudentId] = useState("")
  const [isMounted, setIsMounted] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    setStudentId(localStorage.getItem("somikoron_auth_id") || "")
    setIsMounted(true)
  }, [])

  const studentRef = useMemoFirebase(() => studentId ? doc(db, "students", studentId) : null, [db, studentId])
  const { data: student, isLoading } = useDoc(studentRef)

  const userBranch = student?.branch || ""
  const mealConfigRef = useMemoFirebase(() => 
    userBranch ? doc(db, "configs", `mealConfig_${userBranch}`) : null, 
    [db, userBranch]
  )
  const { data: mealConfig } = useDoc(mealConfigRef)

  // SMART AUTO-SYNC: Catch up on missed decisions while in Auto Mode
  useEffect(() => {
    if (!student || !student.mealStatus?.autoMode || !isMounted || isSyncing) return;

    const syncAutoMeals = async () => {
      const lastUpdateStr = student.lastMealUpdateDate;
      if (!lastUpdateStr) return;

      const lastUpdate = new Date(lastUpdateStr);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      
      const lastUpdateMidnight = new Date(lastUpdate.getFullYear(), lastUpdate.getMonth(), lastUpdate.getDate());
      const yesterdayMidnight = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      const yesterdayStr = getLocYMD(yesterdayMidnight);

      if (lastUpdateMidnight >= yesterdayMidnight) return;

      setIsSyncing(true);
      try {
        let currentMonthLabel = student.currentMonthLabel;
        let counters = {
          breakfast: Number(student.currentMonthBreakfast || 0),
          lunch: Number(student.currentMonthLunch || 0),
          dinner: Number(student.currentMonthDinner || 0),
          guest: Number(student.currentMonthGuestMeals || 0)
        };

        let checkDecisionDate = new Date(lastUpdateMidnight);
        
        while (getLocYMD(checkDecisionDate) < yesterdayStr) {
          checkDecisionDate.setDate(checkDecisionDate.getDate() + 1);
          
          // The meal occurs on the day AFTER the decision handled by Auto Mode
          const mealDate = new Date(checkDecisionDate);
          mealDate.setDate(mealDate.getDate() + 1);
          
          const mealMonthLabel = `${MONTHS[mealDate.getMonth()]} ${mealDate.getFullYear()}`;
          
          // Month transition check
          if (currentMonthLabel && currentMonthLabel !== mealMonthLabel) {
             counters = { breakfast: 0, lunch: 0, dinner: 0, guest: 0 };
             currentMonthLabel = mealMonthLabel;
          } else if (!currentMonthLabel) {
             currentMonthLabel = mealMonthLabel;
          }

          const dayName = WEEKDAYS[mealDate.getDay()];
          // Resilience: Default to true if specific schedule day is missing
          const sched = student.weeklySchedule?.[dayName] || { breakfast: true, lunch: true, dinner: true };
          
          if (sched.breakfast && mealConfig?.breakfastAvailable !== false) counters.breakfast += 1;
          if (sched.lunch && mealConfig?.lunchAvailable !== false) counters.lunch += 1;
          if (sched.dinner && mealConfig?.dinnerAvailable !== false) counters.dinner += 1;
        }

        await updateDoc(studentRef, {
          currentMonthBreakfast: counters.breakfast,
          currentMonthLunch: counters.lunch,
          currentMonthDinner: counters.dinner,
          currentMonthGuestMeals: counters.guest,
          currentMonthLabel,
          lastMealUpdateDate: yesterdayStr,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.error("Auto-sync error:", e);
      } finally {
        setIsSyncing(false);
      }
    };

    syncAutoMeals();
  }, [student, studentRef, isMounted, mealConfig, isSyncing]);

  const stats = useMemo(() => {
    if (!student) return null
    const rentDue = Object.values(student.duesBreakdown || {}).reduce((a: any, b: any) => a + Number(b.amount || 0), 0)
    const foodVal = Number(student.foodDueAmount || 0)
    const foodDue = foodVal < 0 ? Math.abs(foodVal) : 0
    const foodBalanceDisplay = foodVal
    
    // Cooking Bill Logic
    const cookVal = Number(student.cookingDueAmount || 0)
    const cookDue = cookVal < 0 ? Math.abs(cookVal) : 0
    const cookBalance = cookVal > 0 ? cookVal : 0
    
    const totalDue = rentDue + foodDue + cookDue
    
    const lastPayment = student.paymentsHistory?.[student.paymentsHistory.length - 1] || null
    const lastMonthFood = student.mealsHistory?.[student.mealsHistory.length - 1] || null

    const b = student.currentMonthBreakfast || 0
    const l = student.currentMonthLunch || 0
    const d = student.currentMonthDinner || 0
    const g = student.currentMonthGuestMeals || 0
    const currentMonthMealsTotal = b + l + d + g
    
    return { rentDue, foodBalanceDisplay, foodDue, cookDue, cookBalance, totalDue, lastPayment, lastMonthFood, currentMonthMealsTotal }
  }, [student])

  if (!isMounted) return null;
  if (isLoading) return <div className="flex justify-center p-20 animate-pulse text-sm font-bold text-muted-foreground uppercase">Syncing Dashboard...</div>
  if (!student) return <div className="text-center p-20">Access Denied. Please Login.</div>

  const displayName = (student.name || "Resident").split(' ')[0]

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-6 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex-1 overflow-hidden">
          <h1 className="text-lg font-black text-slate-800 truncate">Hi, {displayName}</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Portal</p>
        </div>
        <div className="flex items-center gap-2">
           {isSyncing && <Loader2 className="h-4 w-4 animate-spin text-primary opacity-40" />}
           <Badge className="bg-primary/10 text-primary border-none font-black text-[9px] uppercase px-3 rounded-full shrink-0">
             R-{student.roomNumber}
           </Badge>
        </div>
      </div>

      {/* Main Account Card */}
      <Card className="border-none shadow-2xl bg-primary rounded-[2.5rem] overflow-hidden text-white relative">
        <div className="absolute top-0 right-0 p-8 opacity-10"><Wallet size={120} /></div>
        <CardContent className="p-8 space-y-6 relative z-10">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase text-white/60 tracking-[0.2em]">Outstanding Due</p>
              <h2 className="text-4xl font-black">৳{stats?.totalDue.toLocaleString()}</h2>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md"><TrendingUp size={24}/></div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white/10 p-4 rounded-3xl border border-white/5">
                <p className="text-[8px] font-bold uppercase text-white/50 mb-1">Advance Balance</p>
                <p className="text-lg font-black">৳{student.advanceAmount?.toLocaleString()}</p>
             </div>
             <div className="bg-white/10 p-4 rounded-3xl border border-white/5">
                <p className="text-[8px] font-bold uppercase text-white/50 mb-1">
                  {(student.foodDueAmount || 0) < 0 ? "Food Due" : "Food Balance"}
                </p>
                <p className={cn("text-lg font-black", (student.foodDueAmount || 0) < 0 ? "text-red-300" : "text-green-300")}>
                  ৳{stats?.foodBalanceDisplay.toLocaleString()}
                </p>
             </div>
             <div className="bg-white/10 p-4 rounded-3xl border border-white/5">
                <p className="text-[8px] font-bold uppercase text-white/50 mb-1">Rent Due</p>
                <p className="text-lg font-black text-red-200">৳{stats?.rentDue.toLocaleString()}</p>
             </div>
             <div className="bg-white/10 p-4 rounded-3xl border border-white/5">
                <p className="text-[8px] font-bold uppercase text-white/50 mb-1">
                  {(student.cookingDueAmount || 0) < 0 ? "Cooking Due" : "Cooking Bill"}
                </p>
                <p className={cn("text-lg font-black", (student.cookingDueAmount || 0) < 0 ? "text-red-300" : "text-green-300")}>
                  ৳{student.cookingDueAmount || 0}
                </p>
             </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-center">
            <Link href="/student/history" className="w-full">
               <Button className="w-full bg-white text-primary hover:bg-slate-50 h-12 rounded-2xl font-black text-sm uppercase gap-2 shadow-xl shadow-primary/20">
                  View Payment History <History size={16}/>
               </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Cooking Bill Awareness Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <Card className={cn("border-none shadow-sm rounded-3xl overflow-hidden border-l-4", (stats?.rentDue || 0) > 0 ? "border-l-destructive bg-destructive/5" : "border-l-success bg-success/5")}>
            <CardContent className="p-5 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shadow-inner", (stats?.rentDue || 0) > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>
                     <Home size={20}/>
                  </div>
                  <div>
                     <p className="text-[8px] font-bold uppercase text-muted-foreground tracking-widest">Rent Status</p>
                     <p className={cn("text-lg font-black", (stats?.rentDue || 0) > 0 ? "text-destructive" : "text-success")}>
                       {(stats?.rentDue || 0) > 0 ? `Due: ৳${stats?.rentDue}` : "Rent Clear"}
                     </p>
                  </div>
               </div>
               {(stats?.rentDue || 0) > 0 ? <AlertCircle size={20} className="text-destructive animate-pulse" /> : <CheckCircle2 size={20} className="text-success" />}
            </CardContent>
         </Card>

         <Card className={cn("border-none shadow-sm rounded-3xl overflow-hidden border-l-4", (stats?.cookDue || 0) > 0 ? "border-l-destructive bg-destructive/5" : "border-l-success bg-success/5")}>
            <CardContent className="p-5 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shadow-inner", (stats?.cookDue || 0) > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>
                     <ChefHat size={20}/>
                  </div>
                  <div>
                     <p className="text-[8px] font-bold uppercase text-muted-foreground tracking-widest">Cooking Bill</p>
                     <p className={cn("text-lg font-black", (stats?.cookDue || 0) > 0 ? "text-destructive" : "text-success")}>
                       {(stats?.cookDue || 0) > 0 ? `Due: ৳${stats?.cookDue}` : (stats?.cookBalance && stats.cookBalance > 0 ? `Credit: ৳${stats.cookBalance}` : "Complete")}
                     </p>
                  </div>
               </div>
               {(stats?.cookDue || 0) > 0 ? <Smartphone size={20} className="text-destructive animate-pulse" /> : <CheckCircle2 size={20} className="text-success" />}
            </CardContent>
         </Card>
      </div>

      {/* Consumption Progress Card */}
      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-5 flex justify-between items-center">
           <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-inner"><Calculator size={20}/></div>
              <div>
                <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Month Consumption (Inc. Guests)</p>
                <p className="text-lg font-black text-slate-800">{stats?.currentMonthMealsTotal} <span className="text-[10px] font-medium text-slate-400">Total Plates</span></p>
              </div>
           </div>
           <Link href="/student/meals">
             <Button variant="ghost" size="sm" className="h-8 text-primary font-bold text-[10px] uppercase gap-1">Update <ChevronRight size={14}/></Button>
           </Link>
        </CardContent>
      </Card>

      {/* Recent Payment Card */}
      {stats?.lastPayment && (
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-success/5 border-b py-3 px-6 flex flex-row justify-between items-center">
             <CardTitle className="text-[10px] font-black uppercase text-success flex items-center gap-2">
                <CheckCircle2 size={14}/> Recent Payment Received
             </CardTitle>
             <span className="text-[8px] font-bold text-muted-foreground">
               {stats.lastPayment.date ? new Date(stats.lastPayment.date).toLocaleDateString() : ''}
             </span>
          </CardHeader>
          <CardContent className="p-4 flex justify-between items-center">
             <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-success/10 text-success flex items-center justify-center shadow-inner">
                   <Receipt size={20}/>
                </div>
                <div>
                   <p className="text-sm font-black text-slate-800">৳{stats.lastPayment.amount}</p>
                   <p className="text-[9px] text-muted-foreground font-bold uppercase">{stats.lastPayment.method} • {stats.lastPayment.month}</p>
                </div>
             </div>
             <Link href="/student/history">
                <Button variant="ghost" size="sm" className="h-8 text-primary font-bold text-[10px] uppercase gap-1">Receipt <ChevronRight size={14}/></Button>
             </Link>
          </CardContent>
        </Card>
      )}

      {/* Last Month Food Summary Card */}
      {stats?.lastMonthFood && (
        <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b py-4">
             <div className="flex justify-between items-center">
                <CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                  <Receipt size={14}/> Previous Month Final Bill
                </CardTitle>
                <Badge variant="outline" className="text-[8px] font-black uppercase">{stats.lastMonthFood.month}</Badge>
             </div>
          </CardHeader>
          <CardContent className="p-6">
             <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-0.5">
                   <p className="text-[8px] font-bold text-muted-foreground uppercase">Total Meals</p>
                   <p className="text-sm font-black text-slate-800">{stats.lastMonthFood.totalMeals}</p>
                </div>
                <div className="space-y-0.5">
                   <p className="text-[8px] font-bold text-muted-foreground uppercase">Rate</p>
                   <p className="text-sm font-black text-slate-800">৳{stats.lastMonthFood.perMealCost}</p>
                </div>
                <div className="space-y-0.5">
                   <p className="text-[8px] font-bold text-muted-foreground uppercase">Total Bill</p>
                   <p className="text-sm font-black text-destructive">৳{stats.lastMonthFood.totalCost}</p>
                </div>
             </div>
          </CardContent>
          <CardFooter className="bg-slate-50/30 border-t p-3 flex justify-center">
             <Link href="/student/meals">
                <Button variant="ghost" size="sm" className="h-6 text-primary font-bold text-[8px] uppercase gap-1">
                   View Full Breakdown <ChevronRight size={10}/>
                </Button>
             </Link>
          </CardFooter>
        </Card>
      )}

      <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] pt-4 pb-8">
        Protected by Somikoron Digital
      </p>
    </div>
  )
}
