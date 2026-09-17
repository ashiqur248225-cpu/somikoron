"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Utensils, 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  History,
  Calendar,
  Zap,
  Info,
  ChevronRight,
  ListOrdered,
  Loader2,
  Receipt,
  Calculator,
  Coins,
  Table as TableIcon,
  ListChecks,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Users,
  Plus,
  Wallet,
  ChefHat,
  Send
} from "lucide-react"
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { doc, serverTimestamp, updateDoc, setDoc, collection, query, where, increment, addDoc, getDocs, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Link from "next/link"

const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast", icon: "🍳" },
  { id: "lunch", label: "Lunch", icon: "🍱" },
  { id: "dinner", label: "Dinner", icon: "🍛" },
]

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const getLocYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function StudentMealPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [studentId, setStudentId] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isLowBalanceDialogOpen, setIsLowBalanceDialogOpen] = useState(false)

  useEffect(() => {
    setStudentId(localStorage.getItem("somikoron_auth_id") || "")
    setIsMounted(true)
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const studentRef = useMemoFirebase(() => studentId ? doc(db, "students", studentId) : null, [db, studentId])
  const { data: student, isLoading } = useDoc(studentRef)

  const userBranch = student?.branch || ""
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

  const routineQuery = useMemoFirebase(() => collection(db, "mealRoutines"), [db])
  const { data: routines } = useCollection(routineQuery)
  
  const weeklyMenu = useMemo(() => {
    if (!routines || !userBranch) return []
    return routines.filter(r => r.branch === userBranch)
  }, [routines, userBranch])

  const [localMeals, setLocalMeals] = useState({ breakfast: false, lunch: false, dinner: false, autoMode: false })
  const [mealChoices, setMealChoices] = useState<Record<string, string>>({})
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, any>>({})
  const [localGuestMeals, setLocalGuestMeals] = useState({ breakfast: 0, lunch: 0, dinner: 0 })

  const tomorrowDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, [currentTime]);

  const tomorrowYMD = useMemo(() => getLocYMD(tomorrowDate), [tomorrowDate]);
  const tomorrowDay = WEEKDAYS[tomorrowDate.getDay()];

  useEffect(() => {
    if (student) {
      const isAlreadyDecidedForTomorrow = student.lastMealUpdateDateTomorrow === tomorrowYMD;
      
      if (isAlreadyDecidedForTomorrow) {
        setLocalMeals({ ...student.mealStatus, autoMode: false });
        if (student.tomorrowGuestMeals) setLocalGuestMeals(student.tomorrowGuestMeals);
      } else {
        // Fresh start for tomorrow decision (Attendance Mode)
        setLocalMeals({ breakfast: false, lunch: false, dinner: false, autoMode: false });
        setLocalGuestMeals({ breakfast: 0, lunch: 0, dinner: 0 });
      }

      if (student.mealChoices) setMealChoices(student.mealChoices);
      if (student.weeklySchedule) setWeeklySchedule(student.weeklySchedule);
      else {
        const defaultSched: any = {}
        WEEKDAYS.forEach(day => {
          defaultSched[day] = { breakfast: true, lunch: true, dinner: true }
        })
        setWeeklySchedule(defaultSched)
      }
    }
  }, [student, tomorrowYMD])

  const stats = useMemo(() => {
    if (!student) return null
    const foodVal = Number(student.foodDueAmount || 0)
    const b = student.currentMonthBreakfast || 0
    const l = student.currentMonthLunch || 0
    const d = student.currentMonthDinner || 0
    const g = student.currentMonthGuestMeals || 0
    
    const mealRate = Number(mealRateData?.rate || 0)
    const effectiveMeals = (b * 0.5) + l + d + g
    const estimatedMonthlyCost = effectiveMeals * mealRate
    const estimatedFoodBalance = foodVal - estimatedMonthlyCost
    
    return { estimatedFoodBalance, mealRate }
  }, [student, mealRateData])

  const timeWindow = useMemo(() => {
    if (!isMounted) return { isActive: false, startStr: "", endStr: "" }
    
    const hours = currentTime.getHours()
    const minutes = currentTime.getMinutes()
    const totalMinutes = hours * 60 + minutes
    
    const startTimeStr = mealConfig?.startTime || "21:00"
    const endTimeStr = mealConfig?.endTime || "23:30"
    
    const [startH, startM] = startTimeStr.split(':').map(Number)
    const [endH, endM] = endTimeStr.split(':').map(Number)
    
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    
    let isActive = false
    if (startMinutes <= endMinutes) {
      isActive = totalMinutes >= startMinutes && totalMinutes <= endMinutes
    } else {
      isActive = totalMinutes >= startMinutes || totalMinutes <= endMinutes
    }
    
    const format12h = (time24: string) => {
      if (!time24) return "";
      const [h, m] = time24.split(':').map(Number)
      const period = h >= 12 ? 'PM' : 'AM'
      const h12 = h % 12 || 12
      return `${h12}:${m.toString().padStart(2, '0')} ${period}`
    }

    return {
      isActive,
      startStr: format12h(startTimeStr),
      endStr: format12h(endTimeStr)
    }
  }, [currentTime, mealConfig, isMounted])

  const hasAlreadyUpdatedForTomorrow = useMemo(() => {
    if (!student) return false;
    return student.lastMealUpdateDateTomorrow === tomorrowYMD;
  }, [student, tomorrowYMD]);

  const canChange = useMemo(() => {
    return isMounted && timeWindow.isActive && !hasAlreadyUpdatedForTomorrow;
  }, [isMounted, timeWindow.isActive, hasAlreadyUpdatedForTomorrow])

  const tomorrowMenu = weeklyMenu.find(r => r.day === tomorrowDay)

  const handleUpdateMeals = useCallback(async () => {
    if (!studentRef || !timeWindow.isActive || isUpdating || !student) return
    
    const isTurningAnyOn = localMeals.breakfast || localMeals.lunch || localMeals.dinner || 
                           localGuestMeals.breakfast > 0 || localGuestMeals.lunch > 0 || localGuestMeals.dinner > 0;
    
    if (isTurningAnyOn && stats && stats.estimatedFoodBalance < 50) {
      setIsLowBalanceDialogOpen(true);
      return;
    }

    setIsUpdating(true)
    try {
      let finalMeals = { ...localMeals, autoMode: false }
      let finalChoices = { ...mealChoices }
      let finalGuestMeals = { ...localGuestMeals }
      
      const targetLabel = `${MONTHS[tomorrowDate.getMonth()]} ${tomorrowDate.getFullYear()}`;
      
      const updates: any = { 
        mealStatus: finalMeals, 
        mealChoices: finalChoices, 
        weeklySchedule, 
        tomorrowGuestMeals: finalGuestMeals,
        lastMealUpdate: serverTimestamp(),
        lastMealUpdateDateTomorrow: tomorrowYMD, // Locked for target date
        updatedAt: serverTimestamp(),
        currentMonthLabel: targetLabel
      }

      // Difference calculation between fresh start and manual decision
      // Since it's a fresh decision for tomorrowYMD, we increment based on new finalMeals
      const diffB = (finalMeals.breakfast ? 1 : 0);
      const diffL = (finalMeals.lunch ? 1 : 0);
      const diffD = (finalMeals.dinner ? 1 : 0);
      const guestTotal = Number(finalGuestMeals.breakfast) + Number(finalGuestMeals.lunch) + Number(finalGuestMeals.dinner);

      if (diffB !== 0) updates.currentMonthBreakfast = increment(diffB);
      if (diffL !== 0) updates.currentMonthLunch = increment(diffL);
      if (diffD !== 0) updates.currentMonthDinner = increment(diffD);
      if (guestTotal !== 0) updates.currentMonthGuestMeals = increment(guestTotal);

      await updateDoc(studentRef, updates)
      toast({ title: "Preferences Saved", description: `Meals for tomorrow (${tomorrowDay}) updated.` })
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message }) 
    } finally { 
      setIsUpdating(false) 
    }
  }, [student, studentRef, timeWindow.isActive, isUpdating, localMeals, mealChoices, localGuestMeals, weeklySchedule, tomorrowDay, tomorrowDate, tomorrowYMD, toast, mealConfig, stats]);

  const updateGuestCount = (type: 'breakfast' | 'lunch' | 'dinner', delta: number) => {
    const key = type === 'breakfast' ? 'breakfast' : (type === 'lunch' ? 'lunch' : 'dinner');
    const current = Number(localGuestMeals[key as keyof typeof localGuestMeals] || 0);
    const newVal = Math.max(0, current + delta);
    setLocalGuestMeals({ ...localGuestMeals, [key]: newVal });
  }

  if (isLoading) return <div className="flex justify-center p-20 animate-pulse font-bold text-muted-foreground">SYNCING KITCHEN...</div>

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 max-w-4xl mx-auto w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-6 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex-1 overflow-hidden">
          <h1 className="text-lg font-black text-slate-800 truncate">Catering</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Attendance System</p>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-6 md:p-8 space-y-8">
           {!timeWindow.isActive ? (
             <div className="p-6 bg-amber-50 rounded-3xl border border-amber-200 flex flex-col items-center gap-3 text-center">
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm"><Clock size={24}/></div>
                <div className="space-y-1">
                   <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Window Closed</p>
                   <p className="text-[10px] text-amber-700 font-bold uppercase leading-relaxed">
                     Attendance window: <span className="text-amber-900 font-black">{timeWindow.startStr}</span> to <span className="text-amber-900 font-black">{timeWindow.endStr}</span>.
                   </p>
                </div>
             </div>
           ) : (
             <div className="space-y-4">
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 flex gap-3 items-center">
                   <Zap size={18} className="text-primary shrink-0" />
                   <div className="flex-1">
                     <p className="text-[10px] text-primary font-black uppercase leading-tight">Window open for tomorrow ({tomorrowDay}).</p>
                   </div>
                </div>
                {hasAlreadyUpdatedForTomorrow && (
                  <div className="px-4 py-2 bg-success/10 rounded-full border border-success/20 w-fit mx-auto">
                    <p className="text-[9px] font-black text-success uppercase">✓ Attendance marked for tomorrow</p>
                  </div>
                )}
             </div>
           )}
           
           <div className={cn("space-y-6", (!canChange) && "opacity-50 pointer-events-none")}>
              <div className="space-y-6">
                {MEAL_TYPES.map((type) => {
                  const isAvailable = mealConfig?.[`${type.id}Available`] !== false
                  const isChecked = isAvailable && localMeals[type.id as keyof typeof localMeals]
                  const guestKey = type.id === 'breakfast' ? 'breakfast' : (type.id === 'lunch' ? 'lunch' : 'dinner');
                  const guestCount = Number(localGuestMeals[guestKey as keyof typeof localGuestMeals] || 0);

                  return (
                    <div key={type.id} className={cn("p-5 rounded-3xl border-2 transition-all space-y-4", (!isAvailable) ? "opacity-30 border-slate-100" : (isChecked || guestCount > 0 ? "border-success/20 bg-success/5" : "border-slate-50 bg-slate-50/30"))}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">{type.icon}</span>
                          <div className="space-y-0.5">
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">{type.label}</h3>
                            <p className="text-[9px] font-bold text-primary uppercase">{isAvailable ? 'Available' : 'Disabled'}</p>
                          </div>
                        </div>
                        <Switch 
                          disabled={!canChange || !isAvailable} 
                          checked={isChecked as boolean} 
                          onCheckedChange={v => setLocalMeals({...localMeals, [type.id]: v})} 
                        />
                      </div>

                      {isAvailable && (
                        <div className="pt-2 flex items-center justify-between bg-white/40 p-3 rounded-2xl border border-dashed border-success/20">
                           <div className="flex items-center gap-3"><Users size={14} className="text-primary"/><span className="text-[10px] font-bold uppercase text-slate-600">Guest Meals</span></div>
                           <div className="flex items-center gap-3">
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-white border" onClick={() => updateGuestCount(type.id as any, -1)} disabled={!canChange || guestCount <= 0}><Plus className="h-3 w-3 rotate-45" /></Button>
                              <span className="text-sm font-black text-slate-800 w-4 text-center">{guestCount}</span>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-white border" onClick={() => updateGuestCount(type.id as any, 1)} disabled={!canChange || guestCount >= 10}><Plus className="h-3 w-3" /></Button>
                           </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
           </div>

           {timeWindow.isActive && (
             <Button 
               onClick={handleUpdateMeals} 
               disabled={isUpdating || hasAlreadyUpdatedForTomorrow} 
               className={cn(
                 "w-full h-16 rounded-[2rem] text-lg font-black shadow-2xl gap-3 transition-transform active:scale-95",
                 hasAlreadyUpdatedForTomorrow ? "bg-success hover:bg-success/90" : "bg-primary hover:bg-primary/90"
               )}
             >
                {isUpdating ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} 
                {hasAlreadyUpdatedForTomorrow ? `Saved for ${tomorrowDay}` : `Mark Attendance for ${tomorrowDay}`}
             </Button>
           )}
        </CardContent>
      </Card>

      <Dialog open={isLowBalanceDialogOpen} onOpenChange={setIsLowBalanceDialogOpen}>
        <DialogContent className="max-w-sm rounded-[2.5rem] p-8 text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-2"><Wallet size={32} /></div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Low Balance</h2>
          <p className="text-sm font-medium text-slate-600 leading-relaxed">
            আপনার খাবারের আনুমানিক ব্যালেন্স বর্তমানে ৳৫০ এর নিচে। বিড়ম্বনা এড়াতে দয়া করে দ্রুত ব্যালেন্স রিচার্জ করুন।
          </p>
          <Link href="/student/payments" className="w-full">
            <Button className="w-full h-12 rounded-xl font-black text-sm uppercase">Recharge Now</Button>
          </Link>
          <Button variant="ghost" onClick={() => setIsLowBalanceDialogOpen(false)} className="text-xs font-bold uppercase text-muted-foreground">Close</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
