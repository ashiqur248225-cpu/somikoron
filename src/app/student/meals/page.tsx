
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
  ChevronDown,
  ChevronUp
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
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  useEffect(() => {
    if (student?.mealStatus) setLocalMeals(student.mealStatus)
    if (student?.mealChoices) setMealChoices(student.mealChoices)
    if (student?.weeklySchedule) {
      setWeeklySchedule(student.weeklySchedule)
    } else {
      const defaultSched: any = {}
      WEEKDAYS.forEach(day => {
        defaultSched[day] = { breakfast: true, lunch: true, dinner: true, lunchChoice: "Normal", dinnerChoice: "Normal" }
      })
      setWeeklySchedule(defaultSched)
    }
  }, [student])

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

  const hasAlreadyUpdatedToday = useMemo(() => {
    if (!student?.lastMealUpdateDate) return false;
    const todayStr = new Date().toLocaleDateString('en-CA');
    return student.lastMealUpdateDate === todayStr;
  }, [student?.lastMealUpdateDate]);

  const canChange = useMemo(() => {
    return isMounted && timeWindow.isActive;
  }, [isMounted, timeWindow.isActive])

  const todayDay = isMounted ? WEEKDAYS[new Date().getDay()] : "Saturday"
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowDay = WEEKDAYS[tomorrowDate.getDay()];
  
  const todayMenu = weeklyMenu.find(r => r.day === todayDay)
  const tomorrowMenu = weeklyMenu.find(r => r.day === tomorrowDay)

  const handleUpdateMeals = useCallback(async () => {
    if (!studentRef || !timeWindow.isActive || isUpdating || !student) return
    setIsUpdating(true)
    try {
      let finalMeals = { ...localMeals }
      let finalChoices = { ...mealChoices }
      
      if (localMeals.autoMode) {
        const schedForTomorrow = weeklySchedule[tomorrowDay] || { breakfast: true, lunch: true, dinner: true }
        finalMeals = {
          ...finalMeals,
          breakfast: !!schedForTomorrow.breakfast && mealConfig?.breakfastAvailable !== false,
          lunch: !!schedForTomorrow.lunch && mealConfig?.lunchAvailable !== false,
          dinner: !!schedForTomorrow.dinner && mealConfig?.dinnerAvailable !== false
        }
        if (schedForTomorrow.lunchChoice) finalChoices.lunch = schedForTomorrow.lunchChoice
        if (schedForTomorrow.dinnerChoice) finalChoices.dinner = schedForTomorrow.dinnerChoice
      } else {
        if (mealConfig?.breakfastAvailable === false) finalMeals.breakfast = false;
        if (mealConfig?.lunchAvailable === false) finalMeals.lunch = false;
        if (mealConfig?.dinnerAvailable === false) finalMeals.dinner = false;
      }

      const todayStr = new Date().toLocaleDateString('en-CA');
      const targetLabel = `${MONTHS[tomorrowDate.getMonth()]} ${tomorrowDate.getFullYear()}`;
      
      const isReSubmission = student.lastMealUpdateDate === todayStr;
      const isNewMonth = student.currentMonthLabel !== targetLabel;

      const updates: any = { 
        mealStatus: finalMeals, 
        mealChoices: finalChoices, 
        weeklySchedule, 
        lastMealUpdate: serverTimestamp(),
        lastMealUpdateDate: todayStr,
        updatedAt: serverTimestamp(),
        currentMonthLabel: targetLabel
      }

      // ACCURATE COUNTER LOGIC
      if (isNewMonth) {
        // Reset counters and set only current selection if month changed
        updates.currentMonthBreakfast = finalMeals.breakfast ? 1 : 0;
        updates.currentMonthLunch = finalMeals.lunch ? 1 : 0;
        updates.currentMonthDinner = finalMeals.dinner ? 1 : 0;
      } else if (isReSubmission) {
        // Adjust counters based on difference if re-submitting today
        const diffB = (finalMeals.breakfast ? 1 : 0) - (student.mealStatus?.breakfast ? 1 : 0);
        const diffL = (finalMeals.lunch ? 1 : 0) - (student.mealStatus?.lunch ? 1 : 0);
        const diffD = (finalMeals.dinner ? 1 : 0) - (student.mealStatus?.dinner ? 1 : 0);
        
        if (diffB !== 0) updates.currentMonthBreakfast = increment(diffB);
        if (diffL !== 0) updates.currentMonthLunch = increment(diffL);
        if (diffD !== 0) updates.currentMonthDinner = increment(diffD);
      } else {
        // First submission of the day, just increment
        if (finalMeals.breakfast) updates.currentMonthBreakfast = increment(1);
        if (finalMeals.lunch) updates.currentMonthLunch = increment(1);
        if (finalMeals.dinner) updates.currentMonthDinner = increment(1);
      }

      await updateDoc(studentRef, updates)
      toast({ title: "Preferences Saved", description: `Meals for tomorrow (${tomorrowDay}) updated successfully.` })
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message }) 
    } finally { 
      setIsUpdating(false) 
    }
  }, [student, studentRef, timeWindow.isActive, isUpdating, localMeals, mealChoices, weeklySchedule, tomorrowDay, tomorrowDate, toast, mealConfig]);

  const toggleScheduleMeal = (day: string, meal: string) => {
    const isAvail = mealConfig?.[`${meal}Available`] !== false;
    if (!isAvail) return;
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
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-6 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex-1 overflow-hidden">
          <h1 className="text-lg font-black text-slate-800 truncate">Catering</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Meals</p>
        </div>
        <Link href="/meal-routine">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-primary/5 text-primary">
             <TableIcon size={20} />
          </Button>
        </Link>
      </div>

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

      <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-6 md:p-8 space-y-8">
           {!timeWindow.isActive ? (
             <div className="p-6 bg-amber-50 rounded-3xl border border-amber-200 flex flex-col items-center gap-3 text-center animate-in zoom-in-95">
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm"><Clock size={24} className="animate-pulse" /></div>
                <div className="space-y-1">
                   <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Updates Closed</p>
                   <p className="text-[10px] text-amber-700 font-bold uppercase leading-relaxed">
                     Update window is between <span className="text-amber-900 font-black">{timeWindow.startStr}</span> and <span className="text-amber-900 font-black">{timeWindow.endStr}</span>.
                   </p>
                </div>
             </div>
           ) : (
             <div className="space-y-4">
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 flex gap-3 items-center">
                   <Zap size={18} className="text-primary shrink-0 animate-bounce" />
                   <div className="flex-1">
                     <p className="text-[10px] text-primary font-black uppercase leading-tight">
                       Window open from {timeWindow.startStr} to {timeWindow.endStr}.
                     </p>
                     <p className="text-[8px] text-primary/70 uppercase font-bold mt-1">You can turn meals ON or OFF for Tomorrow ({tomorrowDay}).</p>
                   </div>
                </div>
                {hasAlreadyUpdatedToday && (
                  <div className="px-4 py-2 bg-success/10 rounded-full border border-success/20 w-fit mx-auto">
                    <p className="text-[9px] font-black text-success uppercase">✓ Preference recorded for tomorrow</p>
                  </div>
                )}
             </div>
           )}
           
           <div className={cn("space-y-6", (!canChange) && "opacity-50 pointer-events-none")}>
              <div className="flex items-center justify-between p-4 bg-slate-900 rounded-3xl text-white">
                <div className="space-y-1"><p className="text-xs font-black uppercase tracking-widest">Auto Mode</p><p className="text-[8px] text-white/40 uppercase">Sync with weekly schedule</p></div>
                <Switch disabled={!canChange} checked={localMeals.autoMode} onCheckedChange={v => setLocalMeals({...localMeals, autoMode: v})} />
              </div>

              {localMeals.autoMode ? (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                   <div className="flex items-center gap-2 px-1">
                      <ListChecks className="text-primary h-4 w-4" />
                      <h3 className="text-xs font-black uppercase text-slate-700 tracking-widest">Weekly Schedule (Auto-Sync)</h3>
                   </div>
                   <div className="grid grid-cols-1 gap-3">
                      {WEEKDAYS.map((day) => {
                        const dayData = weeklySchedule[day] || { breakfast: true, lunch: true, dinner: true, lunchChoice: "Normal", dinnerChoice: "Normal" };
                        const isExpanded = expandedDay === day;
                        const menuForDay = weeklyMenu.find(r => r.day === day);
                        
                        return (
                          <div key={day} className="border-2 rounded-2xl bg-slate-50/50 overflow-hidden">
                             <div 
                               className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100/50 transition-colors"
                               onClick={() => setExpandedDay(isExpanded ? null : day)}
                             >
                                <div className="flex items-center gap-3">
                                   <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center font-black text-[10px]", day === todayDay ? "bg-primary text-white" : "bg-white border text-slate-400")}>
                                      {day.substring(0, 2).toUpperCase()}
                                   </div>
                                   <span className="text-sm font-bold text-slate-700">{day}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                   <div className="flex gap-1.5">
                                      {['breakfast', 'lunch', 'dinner'].map(m => (
                                        <div key={m} className={cn("w-2 h-2 rounded-full", (dayData[m] && mealConfig?.[`${m}Available`] !== false) ? "bg-success" : "bg-slate-200")} />
                                      ))}
                                   </div>
                                   {isExpanded ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                                </div>
                             </div>
                             
                             {isExpanded && (
                               <div className="p-4 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                  <Separator />
                                  <div className="grid grid-cols-1 gap-4">
                                     {MEAL_TYPES.map(type => {
                                        const isAvail = mealConfig?.[`${type.id}Available`] !== false;
                                        const { common, options } = getMealDetails(menuForDay?.[type.id] || "");
                                        return (
                                          <div key={type.id} className={cn("space-y-3", !isAvail && "opacity-40")}>
                                             <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                  <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                                                     {type.icon} {type.label}
                                                  </Label>
                                                </div>
                                                <Switch 
                                                  disabled={!isAvail} 
                                                  checked={isAvail ? dayData[type.id] : false} 
                                                  onCheckedChange={() => toggleScheduleMeal(day, type.id)} 
                                                />
                                             </div>
                                             {dayData[type.id] && isAvail && options && (
                                               <RadioGroup 
                                                 value={dayData[`${type.id}Choice`] || options[0]} 
                                                 onValueChange={(v) => updateScheduleChoice(day, type.id, v)}
                                                 className="flex gap-3 flex-wrap ml-2"
                                               >
                                                  {options.map(opt => (
                                                    <div key={opt} className="flex items-center gap-1.5">
                                                       <RadioGroupItem value={opt} id={`sched-${day}-${type.id}-${opt}`} className="h-3 w-3" />
                                                       <Label htmlFor={`sched-${day}-${type.id}-${opt}`} className="text-[10px] font-bold text-slate-600">{opt}</Label>
                                                    </div>
                                                  ))}
                                               </RadioGroup>
                                             )}
                                          </div>
                                        )
                                     })}
                                  </div>
                                </div>
                             )}
                          </div>
                        )
                      })}
                   </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">Tomorrow's Selection ({tomorrowDay})</p>
                    <Badge variant="outline" className="text-[8px] font-bold text-muted-foreground uppercase">{tomorrowDay} Menu</Badge>
                  </div>
                  
                  {MEAL_TYPES.map((type) => {
                    const isAvailable = mealConfig?.[`${type.id}Available`] !== false
                    const isChecked = isAvailable && localMeals[type.id as keyof typeof localMeals]
                    const menuText = tomorrowMenu?.[type.id] || ""
                    const { common, options } = getMealDetails(menuText)
                    
                    return (
                      <div key={type.id} className={cn("p-5 rounded-3xl border-2 transition-all space-y-4", (!isAvailable) ? "opacity-30 border-slate-100" : (isChecked ? "border-success/20 bg-success/5" : "border-slate-50 bg-slate-50/30"))}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="text-2xl">{type.icon}</span>
                            <div className="space-y-0.5">
                              <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">{type.label}</h3>
                              <p className="text-[9px] font-bold text-primary uppercase">
                                {isAvailable ? (common || (options ? 'Choice Available' : 'Regular')) : 'Locked by Admin'}
                              </p>
                            </div>
                          </div>
                          <Switch 
                            disabled={!canChange || !isAvailable} 
                            checked={isChecked as boolean} 
                            onCheckedChange={v => setLocalMeals({...localMeals, [type.id]: v})} 
                          />
                        </div>

                        {isChecked && isAvailable && options && (
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

           {timeWindow.isActive && (
             <Button 
               onClick={handleUpdateMeals} 
               disabled={isUpdating} 
               className="w-full h-16 rounded-[2rem] text-lg font-black bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/20 gap-3 transition-transform active:scale-95"
             >
                {isUpdating ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} 
                {hasAlreadyUpdatedToday ? `Update Selection for ${tomorrowDay}` : `Confirm & Submit for ${tomorrowDay}`}
             </Button>
           )}
        </CardContent>
      </Card>

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
             <p className="text-[9px] font-medium italic text-slate-400">Counters are cumulative for the month. Submitting updates for tomorrow will accurately adjust your monthly total.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
