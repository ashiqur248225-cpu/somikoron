
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, serverTimestamp, doc, updateDoc, arrayUnion, increment, writeBatch, query, where, setDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Utensils, 
  Loader2, 
  CheckCircle2, 
  ChevronLeft,
  Calculator,
  RotateCcw,
  Hash,
  Users,
  RefreshCw
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { sendSMS } from "@/app/actions/sms"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2024", "2025", "2026", "2027", "2028"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const getLocYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function BulkMealEntryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const router = useRouter()
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const [mealLogFilter, setMealLogFilter] = useState({
    month: "",
    year: "",
    buildingId: "all"
  })
  const [mealInputs, setMealInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    const branch = localStorage.getItem("user_branch") || "Main Branch"
    const name = localStorage.getItem("user_name") || "User"
    const role = localStorage.getItem("user_role") || "Manager"
    const bId = localStorage.getItem("assigned_building_id") || "none"

    setUserBranch(branch)
    setUserName(name)
    setUserRole(role)
    setAssignedBuildingId(bId)

    const now = new Date()
    const currentMonth = MONTHS[now.getMonth()]
    const currentYear = now.getFullYear().toString()

    setMealLogFilter({
      month: currentMonth,
      year: currentYear,
      buildingId: (role === 'Building Manager' && bId !== 'none') ? bId : "all"
    })
  }, [])

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "buildings"), where("id", "==", assignedBuildingId))
    }
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "students"), where("buildingId", "==", assignedBuildingId))
    }
    return query(collection(db, "students"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: students } = useCollection(studentsQuery)

  const mealConfigRef = useMemoFirebase(() => 
    userBranch ? doc(db, "configs", `mealConfig_${userBranch}`) : null, 
    [db, userBranch]
  )
  const { data: mealConfig } = useDoc(mealConfigRef)

  const mealRateRef = useMemoFirebase(() => 
    userBranch ? doc(db, "configs", `mealRate_${userBranch}`) : null, 
    [db, userBranch]
  )
  const { data: mealRateData } = useDoc(mealRateRef)

  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)
  
  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: apiConfig } = useDoc(apiConfigRef)

  const filteredStudents = useMemo(() => {
    if (!students) return []
    return students.filter(s => 
      (mealLogFilter.buildingId === 'all' || s.buildingId === mealLogFilter.buildingId) && 
      s.isActive && 
      s.paymentSystem === 'non-package'
    )
  }, [students, mealLogFilter.buildingId])

  // SMART SYNC FOR ADMIN: Catch up all students before billing
  const handleGlobalSync = async () => {
    if (!students || !userBranch || isSyncing) return;
    setIsSyncing(true);
    const batch = writeBatch(db);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = getLocYMD(yesterday);
    let syncCount = 0;

    try {
      students.forEach(s => {
        if (!s.isActive || !s.mealStatus?.autoMode || !s.lastMealUpdateDate || s.lastMealUpdateDate >= yesterdayStr) return;
        
        syncCount++;
        let currentMonthLabel = s.currentMonthLabel;
        let counters = {
          b: Number(s.currentMonthBreakfast || 0),
          l: Number(s.currentMonthLunch || 0),
          d: Number(s.currentMonthDinner || 0),
          g: Number(s.currentMonthGuestMeals || 0)
        };

        const lastUpdate = new Date(s.lastMealUpdateDate);
        let checkDecisionDate = new Date(lastUpdate.getFullYear(), lastUpdate.getMonth(), lastUpdate.getDate());

        while (getLocYMD(checkDecisionDate) < yesterdayStr) {
          checkDecisionDate.setDate(checkDecisionDate.getDate() + 1);
          const mealDate = new Date(checkDecisionDate);
          mealDate.setDate(mealDate.getDate() + 1);
          const mealMonthLabel = `${MONTHS[mealDate.getMonth()]} ${mealDate.getFullYear()}`;

          if (currentMonthLabel && currentMonthLabel !== mealMonthLabel) {
            counters = { b: 0, l: 0, d: 0, g: 0 };
            currentMonthLabel = mealMonthLabel;
          } else if (!currentMonthLabel) {
            currentMonthLabel = mealMonthLabel;
          }

          const dayName = WEEKDAYS[mealDate.getDay()];
          const sched = s.weeklySchedule?.[dayName] || { breakfast: true, lunch: true, dinner: true };
          if (sched.breakfast && mealConfig?.breakfastAvailable !== false) counters.b += 1;
          if (sched.lunch && mealConfig?.lunchAvailable !== false) counters.l += 1;
          if (sched.dinner && mealConfig?.dinnerAvailable !== false) counters.d += 1;
        }

        batch.update(doc(db, "students", s.id), {
          currentMonthBreakfast: counters.b,
          currentMonthLunch: counters.l,
          currentMonthDinner: counters.d,
          currentMonthGuestMeals: counters.g,
          currentMonthLabel,
          lastMealUpdateDate: yesterdayStr,
          updatedAt: serverTimestamp()
        });
      });

      if (syncCount > 0) {
        await batch.commit();
        toast({ title: "Auto-Sync Complete", description: `${syncCount} students synced to yesterday.` });
      } else {
        toast({ title: "Up to Date", description: "All students are already synced." });
      }
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  // POPULATE MEAL INPUTS AUTOMATICALLY FROM STUDENT COUNTERS (STUDENT + GUESTS)
  useEffect(() => {
    if (filteredStudents.length > 0) {
      const initialInputs: Record<string, string> = {};
      filteredStudents.forEach(s => {
        // BREAKFAST counts as 0.5, LUNCH and DINNER count as 1.0
        // GUEST counts as 1.0 each
        const breakfast = (Number(s.currentMonthBreakfast) || 0) * 0.5;
        const lunch = (Number(s.currentMonthLunch) || 0);
        const dinner = (Number(s.currentMonthDinner) || 0);
        const guest = (Number(s.currentMonthGuestMeals) || 0);
        
        const effectiveTotal = breakfast + lunch + dinner + guest;
        initialInputs[s.id] = effectiveTotal.toString();
      });
      setMealInputs(prev => ({...prev, ...initialInputs}));
    }
  }, [filteredStudents]);

  const totalMealsCount = useMemo(() => {
    return filteredStudents.reduce((acc, s) => acc + (Number(mealInputs[s.id]) || 0), 0)
  }, [mealInputs, filteredStudents])

  const totalGuestMealsCount = useMemo(() => {
    return filteredStudents.reduce((acc, s) => acc + (Number(s.currentMonthGuestMeals) || 0), 0)
  }, [filteredStudents])

  const grandBillSum = useMemo(() => {
    const rate = Number(mealRateData?.rate || 0);
    return filteredStudents.reduce((acc, s) => {
      return acc + (Number(mealInputs[s.id] || 0) * rate)
    }, 0)
  }, [mealInputs, filteredStudents, mealRateData?.rate])

  const handleBulkMealSubmit = async () => {
    if (!students || !mealRateData?.rate) {
      toast({ variant: "destructive", title: "Error", description: "Meal rate not configured." });
      return;
    }
    setIsSubmitting(true);
    const batch = writeBatch(db);
    const mealRate = Number(mealRateData.rate);
    const monthLabel = `${mealLogFilter.month} ${mealLogFilter.year}`;
    const updatedRecords: any[] = [];
    const todayStr = getLocYMD(new Date());

    try {
      filteredStudents.forEach(s => {
        const count = Number(mealInputs[s.id] || 0);
        if (count <= 0) return;

        const totalCost = count * mealRate;
        const mealRecord = {
          month: monthLabel,
          totalMeals: count,
          perMealCost: mealRate,
          totalCost: totalCost,
          date: new Date().toISOString()
        };

        batch.update(doc(db, "students", s.id), {
          mealsHistory: arrayUnion(mealRecord),
          foodDueAmount: increment(-totalCost),
          currentMonthBreakfast: 0,
          currentMonthLunch: 0,
          currentMonthDinner: 0,
          currentMonthGuestMeals: 0,
          lastMealUpdateDate: todayStr, // Handle the "handled up to today" rule
          updatedAt: serverTimestamp()
        });

        const noticeId = doc(collection(db, "notices")).id;
        batch.set(doc(db, "notices", noticeId), {
          id: noticeId,
          studentId: s.id,
          title: "Monthly Meal Bill Generated",
          message: `Your meal bill for ${monthLabel} has been generated. Total Effective Meals (inc. guests): ${count}, Total Bill: ${totalCost} Tk.`,
          type: "meal",
          isRead: false,
          createdAt: serverTimestamp(),
          branch: userBranch
        });

        updatedRecords.push({ student: s, count, bill: totalCost });
      });

      await batch.commit();

      // Background SMS logic...
      if (apiConfig?.apikey && updatedRecords.length > 0) {
        (async () => {
          const template = templatesData?.templates?.find((t: any) => t.id === 'meal_summary')?.text || 
                           "প্রিয় [নাম], [মাস] মাসে আপনি মোট [meal_count] টি meal গ্রহণ করেছেন। মোট খাবার বিল ৳[meal_bill]। ধন্যবাদ। [Hostel Name]";
          for (const item of updatedRecords) {
            try {
              const s = item.student; const count = item.count; const bill = item.bill;
              const currentFoodVal = Number(s.foodDueAmount || 0); const newFoodVal = currentFoodVal - bill;
              const foodBalance = newFoodVal > 0 ? newFoodVal : 0; const foodDue = newFoodVal < 0 ? Math.abs(newFoodVal) : 0;
              const msg = template.replaceAll('[নাম]', s.name).replaceAll('[মাস]', monthLabel).replaceAll('[meal_count]', count.toString()).replaceAll('[meal_bill]', bill.toString()).replaceAll('[food_balance]', foodBalance.toString()).replaceAll('[food_due]', foodDue.toString()).replaceAll('[Hostel Name]', templatesData?.hostelName || userBranch);
              await sendSMS(apiConfig.apikey, apiConfig.senderid, s.phone, msg);
            } catch (e) { console.error(e) }
          }
        })();
      }

      toast({ title: "Bulk Entries Submitted", description: "Counters reset and balances updated." });
      router.push('/food-history');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <SidebarTrigger className="-ml-2" />
        <div className="flex-1 overflow-hidden"><h1 className="text-lg font-bold truncate">Meal Entry</h1></div>
      </div>

      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-4">
          {(userRole === 'Admin' || userRole === 'Branch Manager') && (
            <Button variant="ghost" size="icon" onClick={() => router.back()}><ChevronLeft /></Button>
          )}
          <div><h1 className="text-3xl font-bold text-primary tracking-tight">Bulk Meal Entry</h1><p className="text-muted-foreground text-sm">Update meal counts and guest meals for non-package residents.</p></div>
        </div>
        {userRole === 'Admin' && (
          <Button onClick={handleGlobalSync} disabled={isSyncing} variant="outline" className="gap-2 font-bold rounded-xl border-primary/20 text-primary">
            <RefreshCw size={16} className={cn(isSyncing && "animate-spin")} />
            Sync Auto Counters
          </Button>
        )}
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
        <div className="h-2 bg-primary w-full" />
        <CardHeader className="px-8 pt-8 pb-4">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
            <div><CardTitle className="text-2xl font-black flex items-center gap-2 text-primary"><Utensils size={24}/> Meal Ledger Sync</CardTitle><CardDescription>Effective meals includes Student + Guest counts.</CardDescription></div>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-3 px-6 py-3 bg-primary/5 rounded-2xl border border-primary/10 shadow-sm">
                <Users size={20} className="text-primary" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Guest Plates</span>
                  <span className="text-lg font-black text-primary">{totalGuestMealsCount}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 bg-primary/5 rounded-2xl border border-primary/10 shadow-sm">
                <Hash size={20} className="text-primary" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Effective Total</span>
                  <span className="text-lg font-black text-primary">{totalMealsCount}</span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <div className="px-8 py-6 bg-slate-50 border-y flex flex-wrap gap-6 items-end">
          <div className="flex-1 min-w-[150px] space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Select Month</Label><Select value={mealLogFilter.month} onValueChange={v => setMealLogFilter({...mealLogFilter, month: v})}><SelectTrigger className="h-12 rounded-2xl bg-white shadow-sm border-none font-bold"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex-1 min-w-[150px] space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Select Year</Label><Select value={mealLogFilter.year} onValueChange={v => setMealLogFilter({...mealLogFilter, year: v})}><SelectTrigger className="h-12 rounded-2xl bg-white shadow-sm border-none font-bold"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex-1 min-w-[200px] space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Filter Building</Label><Select value={mealLogFilter.buildingId} onValueChange={v => setMealLogFilter({...mealLogFilter, buildingId: v})}><SelectTrigger className="h-12 rounded-2xl bg-white shadow-sm border-none font-bold"><SelectValue /></SelectTrigger><SelectContent>{userRole !== 'Building Manager' && <SelectItem value="all">All Buildings</SelectItem>}{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
          <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl text-muted-foreground bg-white shadow-sm" onClick={() => { setMealInputs({}); toast({ title: "Inputs Cleared" }); }}><RotateCcw size={20}/></Button>
        </div>

        <div className="px-8">
          <Table>
            <TableHeader className="bg-white sticky top-0 z-10"><TableRow className="border-none h-16"><TableHead className="font-black uppercase text-[11px] text-slate-500">Resident Details</TableHead><TableHead className="font-black uppercase text-[11px] text-center text-slate-500">Counters (Self | Guest)</TableHead><TableHead className="font-black uppercase text-[11px] text-right w-40 text-slate-500">Effective Billable</TableHead><TableHead className="font-black uppercase text-[11px] text-right w-40 text-slate-500">Meal Bill</TableHead><TableHead className="font-black uppercase text-[11px] text-right w-40 text-slate-500">New Balance</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredStudents.map(s => {
                const count = Number(mealInputs[s.id] || 0); const rate = Number(mealRateData?.rate || 0); const bill = count * rate; const currentBal = Number(s.foodDueAmount || 0); const newBal = currentBal - bill;
                return (
                  <TableRow key={s.id} className={cn("group transition-all hover:bg-slate-50 h-20", newBal < 0 && "bg-destructive/[0.03]")}>
                    <TableCell><div className="flex items-center gap-4"><div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs shadow-sm">{s.name.substring(0, 2).toUpperCase()}</div><div><p className="font-bold text-slate-800 text-sm leading-none">{s.name}</p><p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">{s.buildingName} • R-{s.roomNumber}</p></div></div></TableCell>
                    <TableCell className="text-center">
                       <div className="flex items-center justify-center gap-2">
                          <Badge variant="outline" className="text-[9px] font-black">S: {(s.currentMonthBreakfast || 0) + (s.currentMonthLunch || 0) + (s.currentMonthDinner || 0)}</Badge>
                          <Badge variant="outline" className="text-[9px] font-black text-primary border-primary/20">G: {s.currentMonthGuestMeals || 0}</Badge>
                       </div>
                    </TableCell>
                    <TableCell className="text-right"><div className="relative inline-block w-full max-w-[100px]"><Input type="number" step="0.5" className="h-12 text-center text-lg font-black bg-slate-100 border-none shadow-inner rounded-2xl" value={mealInputs[s.id] || ""} onChange={e => setMealInputs({...mealInputs, [s.id]: e.target.value})} /></div></TableCell>
                    <TableCell className="text-right font-black text-slate-600 text-lg">৳{bill}</TableCell>
                    <TableCell className="text-right"><span className={cn("font-black text-xl", newBal < 0 ? "text-destructive" : "text-primary")}>৳{newBal}</span></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <CardFooter className="p-10 bg-slate-50 border-t flex flex-col md:flex-row items-center justify-between gap-8 mt-4">
          <div className="flex gap-16 text-center">
            <div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Recipients</p><p className="text-3xl font-black text-slate-800">{filteredStudents.filter(s => Number(mealInputs[s.id]) > 0).length}</p></div>
            <div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Grand Total Bill</p><p className="text-3xl font-black text-primary">৳{grandBillSum.toLocaleString()}</p></div>
          </div>
          <Button onClick={handleBulkMealSubmit} disabled={isSubmitting || filteredStudents.length === 0} className="w-full md:w-96 h-20 rounded-[2rem] text-2xl font-black shadow-2xl shadow-primary/20 gap-4 transition-transform active:scale-95">
            {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={32}/>} Confirm & Submit
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
