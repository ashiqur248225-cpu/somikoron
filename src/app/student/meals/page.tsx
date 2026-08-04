
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
  Lock,
  ListChecks,
  CalendarDays,
  ChevronDown
} from "lucide-react"
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { doc, serverTimestamp, updateDoc, collection, query, where, increment } from "firebase/firestore"
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

export default function StudentMealPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [studentId, setStudentId] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [selectedBill, setSelectedBill] = useState<any>(null)
  const [isBillDialogOpen, setIsBillDialogOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

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

  const routineQuery = useMemoFirebase(() => collection(db, "mealRoutines"), [db])
  const { data: routines } = useCollection(routineQuery)
  
  const weeklyMenu = useMemo(() => {
    if (!routines || !userBranch) return []
    return routines.filter(r => r.branch === userBranch)
  }, [routines, userBranch])

  const [localMeals, setLocalMeals] = useState({ breakfast: false, lunch: false, dinner: false, autoMode: false })
  const [mealChoices, setMealChoices] = useState<Record<string, string>>({})
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, any>>({})

  useEffect(() => {
    if (student?.mealStatus) setLocalMeals(student.mealStatus)
    if (student?.mealChoices) setMealChoices(student.mealChoices)
    if (student?.weeklySchedule) {
      setWeeklySchedule(student.weeklySchedule)
    } else {
      const defaultSched: any = {}
      WEEKDAYS.forEach(day => {
        defaultSched[day] = { breakfast: true, lunch: true, dinner: true, lunchChoice: "", dinnerChoice: "" }
      })
      setWeeklySchedule(defaultSched)
    }
  }, [student])

  // DYNAMIC WINDOW LOGIC from Firestore
  const timeWindow = useMemo(() => {
    const hours = currentTime.getHours()
    const minutes = currentTime.getMinutes()
    const totalMinutes = hours * 60 + minutes
    
    const startTimeStr = mealConfig?.startTime || "21:00"
    const endTimeStr = mealConfig?.endTime || "23:30"
    
    const [startH, startM] = startTimeStr.split(':').map(Number)
    const [endH, endM] = endTimeStr.split(':').map(Number)
    
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    
    const isActive = totalMinutes >= startMinutes && totalMinutes <= endMinutes
    
    const format12h = (time24: string) => {
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
  }, [currentTime, mealConfig])

  const isLockedForToday = useMemo(() => {
    if (!student?.lastMealUpdate) return false;
    const lastUpdate = student.lastMealUpdate.toDate ? student.lastMealUpdate.toDate() : new Date(student.lastMealUpdate);
    const today = new Date();
    return lastUpdate.toDateString() === today.toDateString();
  }, [student?.lastMealUpdate]);

  const canChange = useMemo(() => {
    return isMounted && timeWindow.isActive && !isLockedForToday
  }, [isMounted, timeWindow.isActive, isLockedForToday])

  const todayDay = isMounted ? WEEKDAYS[new Date().getDay()] : "Saturday"
  const tomorrowDay = isMounted ? WEEKDAYS[(new Date().getDay() + 1) % 7] : "Saturday"
  
  const todayMenu = weeklyMenu.find(r => r.day === todayDay)
  const tomorrowMenu = weeklyMenu.find(r => r.day === tomorrowDay)

  const handleUpdateMeals = useCallback(async () => {
    if (!studentRef || !canChange || isUpdating || !student) return
    setIsUpdating(true)
    try {
      let finalMeals = { ...localMeals }
      let finalChoices = { ...mealChoices }
      
      if (localMeals.autoMode) {
        const schedForTomorrow = weeklySchedule[tomorrowDay] || { breakfast: true, lunch: true, dinner: true }
        finalMeals = {
          ...finalMeals,
          breakfast: !!schedForTomorrow.breakfast,
          lunch: !!schedForTomorrow.lunch,
          dinner: !!schedForTomorrow.dinner
        }
        if (schedForTomorrow.lunchChoice) finalChoices.lunch = schedForTomorrow.lunchChoice
        if (schedForTomorrow.dinnerChoice) finalChoices.dinner = schedForTomorrow.dinnerChoice
      }

      const now = new Date();
      const currentLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
      const isNewMonth = student?.currentMonthLabel !== currentLabel;

      const updates: any = { 
        mealStatus: finalMeals, 
        mealChoices: finalChoices, 
        weeklySchedule, 
        lastMealUpdate: serverTimestamp(),
        updatedAt: serverTimestamp(),
        currentMonthLabel: currentLabel
      }

      if (isNewMonth) {
        updates.currentMonthBreakfast = finalMeals.breakfast ? 1 : 0;
        updates.currentMonthLunch = finalMeals.lunch ? 1 : 0;
        updates.currentMonthDinner = finalMeals.dinner ? 1 : 0;
      } else {
        if (finalMeals.breakfast) updates.currentMonthBreakfast = increment(1);
        if (finalMeals.lunch) updates.currentMonthLunch = increment(1);
        if (finalMeals.dinner) updates.currentMonthDinner = increment(1);
      }

      await updateDoc(studentRef, updates)
      toast({ title: "Preferences Locked", description: "Meals for tomorrow have been added to your monthly total." })
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message }) 
    } finally { 
      setIsUpdating(false) 
    }
  }, [student, studentRef, canChange, isUpdating, localMeals, mealChoices, weeklySchedule, tomorrowDay, toast]);

  const toggleScheduleMeal = (day: string, meal: string) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [meal]: !prev[day][meal] }
    }))
  }

  const updateScheduleChoice = (day: string, mealType: string, choice: string) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [`${mealType}Choice`]: choice }
    }))
  }

  const getMealDetails = (text: string) => {
    if (!text) return { common: "Regular Diet", options: null };
    if (!text.includes('/')) return { common: text, options: null };
    const parts = text.split(',');
    const lastPart = parts[parts.length - 1];
    if (lastPart.includes('/')) {
      const common = parts.length > 1 ? parts.slice(0, -1).join(', ').trim() : "";
      const options = lastPart.split('/').map(t => t.trim());
      return { common, options };
    }
    return { common: text, options: null };
  }

  const mealHistory = useMemo(() => {
    if (!student?.mealsHistory) return []
    return [...student.mealsHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [student?.mealsHistory])

  const currentMonthConsumption = useMemo(() => {
    const now = new Date();
    const currentLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    return {
      month: currentLabel,
      breakfast: student?.currentMonthBreakfast || 0,
      lunch: student?.currentMonthLunch || 0,
      dinner: student?.currentMonthDinner || 0,
      total: (student?.currentMonthBreakfast || 0) + (student?.currentMonthLunch || 0) + (student?.currentMonthDinner || 0)
    }
  }, [student])

  if (isLoading) return <div className="flex justify-center p-20 animate-pulse">Syncing Kitchen...</div>

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 max-w-4xl mx-auto w-full">
      <header className="flex justify-between items-end mb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-800">Catering Panel</h1>
          <p className="text-muted-foreground text-sm font-medium">Manage your daily meals.</p>
        </div>
        <Link href="/meal-routine">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-primary/10 text-primary shadow-inner">
             <TableIcon size={20} />
          </Button>
        </Link>
      </header>

      {/* TODAY'S MENU */}
      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden border-l-4 border-l-primary">
        <CardHeader className="bg-slate-50/50 border-b py-4">
           <CardTitle className="text-xs font-black uppercase text-primary flex items-center gap-2">
             <CheckCircle2 size={14}/> Today's Menu ({todayDay})
           </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
           <div className="space-y-1"><p className="text-[8px] font-bold text-muted-foreground uppercase">Breakfast</p><p className="text-[10px] font-bold text-slate-700">{todayMenu?.breakfast || 'Normal'}</p></div>
           <div className="space-y-1"><p className="text-[8px] font-bold text-muted-foreground uppercase">Lunch</p><p className="text-[10px] font-bold text-slate-700">{todayMenu?.lunch || 'Normal'}</p></div>
           <div className="space-y-1"><p className="text-[8px] font-bold text-muted-foreground uppercase">Dinner</p><p className="text-[10px] font-bold text-slate-700">{todayMenu?.dinner || 'Normal'}</p></div>
        </CardContent>
      </Card>

      {/* Main Controls with Timing Window */}
      <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-6 md:p-8 space-y-8">
           {!timeWindow.isActive ? (
             <div className="p-6 bg-amber-50 rounded-3xl border border-amber-200 flex flex-col items-center gap-3 text-center animate-in zoom-in-95">
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm"><Clock size={24} className="animate-pulse" /></div>
                <div className="space-y-1">
                   <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Updates Closed</p>
                   <p className="text-[10px] text-amber-700 font-bold uppercase leading-relaxed">
                     You can turn meals ON/OFF only between <span className="text-amber-900 font-black">{timeWindow.startStr}</span> and <span className="text-amber-900 font-black">{timeWindow.endStr}</span>.
                   </p>
                </div>
             </div>
           ) : isLockedForToday ? (
             <div className="p-4 bg-success/5 rounded-2xl border border-success/20 flex gap-3 items-center mb-2">
                <CheckCircle2 size={18} className="text-success shrink-0" />
                <p className="text-[10px] text-success font-black uppercase leading-tight">
                  Meals for tomorrow are already saved and locked.
                </p>
             </div>
           ) : (
             <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 flex gap-3 items-center mb-2">
                <Zap size={18} className="text-primary shrink-0 animate-bounce" />
                <p className="text-[10px] text-primary font-black uppercase leading-tight">
                  Interaction window open! Update your meals for <span className="underline">{tomorrowDay}</span> now.
                </p>
             </div>
           )}
           
           <div className={cn("space-y-6", !canChange && "opacity-50 pointer-events-none")}>
              <div className="flex items-center justify-between p-4 bg-slate-900 rounded-3xl text-white">
                <div className="space-y-1"><p className="text-xs font-black uppercase tracking-widest">Auto Mode</p><p className="text-[8px] text-white/40 uppercase">Sync with weekly schedule</p></div>
                <Switch disabled={!canChange} checked={localMeals.autoMode} onCheckedChange={v => setLocalMeals({...localMeals, autoMode: v})} />
              </div>

              {!localMeals.autoMode && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">Tomorrow's Selection ({tomorrowDay})</p>
                    <Badge variant="outline" className="text-[8px] font-bold text-muted-foreground uppercase">{tomorrowDay} Menu</Badge>
                  </div>
                  
                  {MEAL_TYPES.map((type) => {
                    const isAvailable = mealConfig?.[`${type.id}Available`] !== false
                    const isChecked = localMeals[type.id as keyof typeof localMeals]
                    const menuText = tomorrowMenu?.[type.id] || ""
                    const { common, options } = getMealDetails(menuText)
                    
                    return (
                      <div key={type.id} className={cn("p-5 rounded-3xl border-2 transition-all space-y-4", (!isAvailable) ? "opacity-30" : (isChecked ? "border-success/20 bg-success/5" : "border-slate-50 bg-slate-50/30"))}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="text-2xl">{type.icon}</span>
                            <div>
                              <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">{type.label}</h3>
                              <p className="text-[9px] font-bold text-primary uppercase">
                                {common || (options ? 'Choice Available' : 'Regular')}
                              </p>
                            </div>
                          </div>
                          <Switch disabled={!canChange} checked={isChecked as boolean} onCheckedChange={v => setLocalMeals({...localMeals, [type.id]: v})} />
                        </div>

                        {isChecked && options && (
                          <div className="pt-3 border-t border-success/10">
                            <RadioGroup disabled={!canChange} value={mealChoices[type.id] || options[0]} onValueChange={v => setMealChoices({...mealChoices, [type.id]: v})} className="flex gap-4 flex-wrap">
                               {options.map(opt => (
                                 <div key={opt} className="flex items-center gap-2">
                                    <RadioGroupItem value={opt} id={`${type.id}-${opt}`} className="border-success text-success" />
                                    <Label htmlFor={`${type.id}-${opt}`} className="text-xs font-bold text-slate-700">{opt}</Label>
                                 </div>
                               ))}
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
           </div>

           {canChange && (
             <Button onClick={handleUpdateMeals} disabled={isUpdating} className="w-full h-16 rounded-[2rem] text-lg font-black shadow-2xl shadow-primary/20 gap-3 transition-transform active:scale-95">
                {isUpdating ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} 
                Confirm & Save for {tomorrowDay}
             </Button>
           )}

           {!canChange && tomorrowMenu && (
             <div className="p-5 bg-slate-50 rounded-3xl border space-y-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center">Menu for {tomorrowDay}</p>
                <div className="grid grid-cols-1 gap-2">
                   <div className="flex justify-between text-xs font-bold px-2"><span className="text-slate-400">Breakfast:</span><span className="text-slate-700">{tomorrowMenu.breakfast}</span></div>
                   <div className="flex justify-between text-xs font-bold px-2"><span className="text-slate-400">Lunch:</span><span className="text-slate-700">{tomorrowMenu.lunch}</span></div>
                   <div className="flex justify-between text-xs font-bold px-2"><span className="text-slate-400">Dinner:</span><span className="text-slate-700">{tomorrowMenu.dinner}</span></div>
                </div>
             </div>
           )}
        </CardContent>
      </Card>

      {/* Weekly Schedule & Monthly Stats Footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><CardTitle className="text-xs font-black uppercase text-primary">Monthly Counter</CardTitle></CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-orange-50 p-2 rounded-xl"><p className="text-[8px] font-bold uppercase">B</p><p className="text-sm font-black">{currentMonthConsumption.breakfast}</p></div>
                <div className="bg-success/5 p-2 rounded-xl"><p className="text-[8px] font-bold uppercase">L</p><p className="text-sm font-black">{currentMonthConsumption.lunch}</p></div>
                <div className="bg-blue-50 p-2 rounded-xl"><p className="text-[8px] font-bold uppercase">D</p><p className="text-sm font-black">{currentMonthConsumption.dinner}</p></div>
                <div className="bg-slate-900 text-white p-2 rounded-xl"><p className="text-[8px] font-bold uppercase">Total</p><p className="text-sm font-black">{currentMonthConsumption.total}</p></div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><CardTitle className="text-xs font-black uppercase text-muted-foreground">Quick Info</CardTitle></CardHeader>
          <CardContent className="p-6 flex flex-col justify-center items-center text-center">
             <Info size={24} className="text-primary mb-2 opacity-20" />
             <p className="text-[9px] font-medium italic text-slate-400">Data is synced with the kitchen management system. Update daily for accurate billing.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
