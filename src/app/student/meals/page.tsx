
"use client"

import { useState, useEffect, useMemo } from "react"
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
  Table as TableIcon
} from "lucide-react"
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { doc, serverTimestamp, updateDoc, collection, query, where } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import Link from "next/link"

const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast", icon: "🍳" },
  { id: "lunch", label: "Lunch", icon: "🍱" },
  { id: "dinner", label: "Dinner", icon: "🍛" },
]

const WEEKDAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function StudentMealPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [studentId, setStudentId] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [selectedBill, setSelectedBill] = useState<any>(null)
  const [isBillDialogOpen, setIsBillDialogOpen] = useState(false)

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

  // Fetch Weekly Routine
  const routineQuery = useMemoFirebase(() => collection(db, "mealRoutines"), [db])
  const { data: routines } = useCollection(routineQuery)
  
  const weeklyMenu = useMemo(() => {
    if (!routines || !userBranch) return []
    return routines.filter(r => r.branch === userBranch)
  }, [routines, userBranch])

  const [localMeals, setLocalMeals] = useState({ breakfast: false, lunch: false, dinner: false, autoMode: false })
  const [mealChoices, setMealChoices] = useState<Record<string, string>>({})

  useEffect(() => {
    if (student?.mealStatus) setLocalMeals(student.mealStatus)
    if (student?.mealChoices) setMealChoices(student.mealChoices)
  }, [student])

  const canChange = useMemo(() => {
    if (!isMounted || !mealConfig?.cutoffTime) return true
    try {
      const now = new Date(); const [h, m] = mealConfig.cutoffTime.split(':')
      const deadline = new Date(); deadline.setHours(parseInt(h), parseInt(m), 0, 0)
      return now < deadline
    } catch (e) { return true }
  }, [mealConfig, isMounted])

  const handleUpdateMeals = async () => {
    if (!studentRef || !canChange) return
    setIsUpdating(true)
    try {
      await updateDoc(studentRef, { mealStatus: localMeals, mealChoices, updatedAt: serverTimestamp() })
      toast({ title: "Preferences Saved", description: "Your meals and choices for tomorrow are updated." })
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  // SMART MEAL PARSER: Separates common items and slash-based choices
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

  const todayDay = isMounted ? WEEKDAYS[new Date().getDay()] : "Saturday"
  const tomorrowDay = isMounted ? WEEKDAYS[(new Date().getDay() + 1) % 7] : "Saturday"
  const tomorrowMenu = weeklyMenu.find(r => r.day === tomorrowDay)

  const mealHistory = useMemo(() => {
    if (!student?.mealsHistory) return []
    return [...student.mealsHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [student?.mealsHistory])

  const thisMonthSummary = useMemo(() => {
    if (!mealHistory.length) return null;
    const now = new Date();
    const currentMonthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    return mealHistory.find(m => m.month === currentMonthLabel) || mealHistory[0];
  }, [mealHistory])

  if (isLoading) return <div className="flex justify-center p-20 animate-pulse">Syncing Kitchen...</div>

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <header className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-800">Catering Panel</h1>
          <p className="text-muted-foreground text-sm font-medium">Manage tomorrow's meal choices.</p>
        </div>
        <Link href="/meal-routine">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-primary/10 text-primary shadow-inner">
             <TableIcon size={20} />
          </Button>
        </Link>
      </header>

      {/* Routine Preview */}
      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b py-4">
           <CardTitle className="text-xs font-black uppercase text-primary flex items-center gap-2"><Utensils size={14}/> Tomorrow's Menu ({tomorrowDay})</CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
           <div className="space-y-1"><p className="text-[8px] font-bold text-muted-foreground uppercase">Breakfast</p><p className="text-[10px] font-bold text-slate-700">{tomorrowMenu?.breakfast || 'Normal'}</p></div>
           <div className="space-y-1"><p className="text-[8px] font-bold text-muted-foreground uppercase">Lunch</p><p className="text-[10px] font-bold text-slate-700">{tomorrowMenu?.lunch || 'Normal'}</p></div>
           <div className="space-y-1"><p className="text-[8px] font-bold text-muted-foreground uppercase">Dinner</p><p className="text-[10px] font-bold text-slate-700">{tomorrowMenu?.dinner || 'Normal'}</p></div>
        </CardContent>
      </Card>

      {/* Main Controls */}
      <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-8 space-y-8">
           <div className="space-y-6">
              {MEAL_TYPES.map((type) => {
                const isAvailable = mealConfig?.[`${type.id}Available`] !== false
                const isChecked = localMeals[type.id as keyof typeof localMeals]
                const menuText = tomorrowMenu?.[type.id] || ""
                const { common, options } = getMealDetails(menuText)
                
                return (
                  <div key={type.id} className={cn("p-5 rounded-3xl border-2 transition-all space-y-4", !isAvailable ? "opacity-30 pointer-events-none" : (isChecked ? "border-success/20 bg-success/5" : "border-slate-50 bg-slate-50/30"))}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{type.icon}</span>
                        <div>
                          <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">{type.label}</h3>
                          <p className="text-[9px] font-bold text-primary uppercase">
                            {common || (options ? 'Mixed Options' : 'Regular Diet')}
                          </p>
                        </div>
                      </div>
                      <Switch disabled={!canChange} checked={isChecked as boolean} onCheckedChange={v => setLocalMeals({...localMeals, [type.id]: v})} />
                    </div>

                    {isChecked && options && (
                      <div className="pt-3 border-t border-success/10 animate-in slide-in-from-top-2">
                        <p className="text-[8px] font-black uppercase text-success/60 mb-2">Pick Your Selection</p>
                        <RadioGroup value={mealChoices[type.id] || options[0]} onValueChange={v => setMealChoices({...mealChoices, [type.id]: v})} className="flex gap-4 flex-wrap">
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

           <Separator className="opacity-50" />

           <div className="flex items-center justify-between p-4 bg-slate-900 rounded-3xl text-white">
              <div className="space-y-1"><p className="text-xs font-black uppercase tracking-widest">Auto Mode</p><p className="text-[8px] text-white/40 uppercase">Keep meals ON daily</p></div>
              <Switch checked={localMeals.autoMode} onCheckedChange={v => setLocalMeals({...localMeals, autoMode: v})} />
           </div>

           <Button onClick={handleUpdateMeals} disabled={isUpdating || !canChange} className="w-full h-16 rounded-[2rem] text-lg font-black shadow-2xl shadow-primary/20 gap-3 transition-transform active:scale-95">
              {isUpdating ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Save Preferences
           </Button>
        </CardContent>
      </Card>

      {/* History Log */}
      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
         <CardHeader className="bg-slate-50/50 border-b">
            <div className="flex justify-between items-center">
               <CardTitle className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2"><History size={14}/> Consumption History</CardTitle>
               <Badge variant="secondary" className="font-black text-[10px]">{mealHistory.length} Finished Months</Badge>
            </div>
         </CardHeader>
         <CardContent className="p-0">
            <div className="p-6 space-y-6">
               {thisMonthSummary && (
                 <div className="p-5 bg-primary/5 rounded-[2rem] border-2 border-primary/10 space-y-4">
                    <div className="flex justify-between items-center">
                       <p className="text-[10px] font-black uppercase text-primary tracking-widest">Latest Record ({thisMonthSummary.month})</p>
                       <Badge className="bg-primary text-[8px] font-black">LATEST</Badge>
                    </div>
                    <div className="flex justify-between items-end">
                       <div className="space-y-1">
                          <p className="text-3xl font-black text-slate-800">{thisMonthSummary.totalMeals}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Meals Consumed</p>
                       </div>
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="rounded-xl font-bold h-9 gap-2 border-primary/20 text-primary hover:bg-primary/10"
                         onClick={() => { setSelectedBill(thisMonthSummary); setIsBillDialogOpen(true); }}
                       >
                          <Receipt size={14}/> View Billing
                       </Button>
                    </div>
                 </div>
               )}

               <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Previous Reports</p>
                  <div className="grid grid-cols-1 gap-2">
                     {mealHistory.map((m: any, i: number) => (
                       <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                          <div className="space-y-0.5">
                             <p className="text-xs font-bold text-slate-700">{m.month}</p>
                             <p className="text-[9px] font-medium text-muted-foreground uppercase">{m.totalMeals} Meals logged</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 rounded-lg text-primary font-bold text-[10px] uppercase gap-1"
                            onClick={() => { setSelectedBill(m); setIsBillDialogOpen(true); }}
                          >
                             Details <ChevronRight size={12}/>
                          </Button>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
         </CardContent>
         <CardFooter className="bg-slate-50/50 border-t p-4">
            <p className="text-[9px] text-center w-full text-muted-foreground font-medium italic">Costs are finalized at month-end by management.</p>
         </CardFooter>
      </Card>

      {/* Bill Details Dialog */}
      <Dialog open={isBillDialogOpen} onOpenChange={setIsBillDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden">
          <div className="h-2 bg-primary w-full" />
          <DialogHeader className="p-8 pb-4">
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
               <Receipt className="text-primary"/> Monthly Billing Report
            </DialogTitle>
            <DialogDescription className="font-bold uppercase text-[10px] text-muted-foreground tracking-widest">
               Summary for {selectedBill?.month}
            </DialogDescription>
          </DialogHeader>
          
          <div className="px-8 pb-8 space-y-6">
             <div className="grid grid-cols-1 gap-4">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Total Consumption</p>
                      <p className="text-2xl font-black text-slate-800">{selectedBill?.totalMeals} <span className="text-xs font-bold text-slate-400">Meals</span></p>
                   </div>
                   <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-primary">
                      <Utensils size={24}/>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="p-5 bg-primary/5 rounded-3xl border border-primary/10 space-y-1">
                      <p className="text-[8px] font-black uppercase text-primary/60">Per Meal Rate</p>
                      <p className="text-lg font-black text-primary">৳{selectedBill?.perMealCost}</p>
                   </div>
                   <div className="p-5 bg-slate-900 rounded-3xl text-white space-y-1 shadow-xl">
                      <p className="text-[8px] font-black uppercase text-white/40">Total Charged</p>
                      <p className="text-lg font-black text-success">৳{selectedBill?.totalCost}</p>
                   </div>
                </div>
             </div>

             <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex gap-3 items-start">
                <Info size={16} className="text-orange-600 shrink-0 mt-0.5" />
                <p className="text-[9px] text-orange-800 font-bold uppercase leading-tight">
                   The total bill has been deducted from your food balance. Please ensure you have sufficient balance for the next period.
                </p>
             </div>
          </div>
          
          <DialogFooter className="p-6 bg-slate-50 border-t">
             <Button className="w-full h-12 rounded-2xl font-black text-xs uppercase" onClick={() => setIsBillDialogOpen(false)}>Close Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
