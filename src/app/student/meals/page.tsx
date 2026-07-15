
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
  Info
} from "lucide-react"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast", icon: "🍳" },
  { id: "lunch", label: "Lunch", icon: "🍱" },
  { id: "dinner", label: "Dinner", icon: "🍛" },
]

export default function StudentMealPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [studentId, setStudentId] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    setStudentId(localStorage.getItem("somikoron_auth_id") || "")
  }, [])

  const studentRef = useMemoFirebase(() => studentId ? doc(db, "students", studentId) : null, [db, studentId])
  const { data: student, isLoading } = useDoc(studentRef)

  // Branch Configs for Deadline and Availability
  const userBranch = student?.branch || ""
  const mealConfigRef = useMemoFirebase(() => 
    userBranch ? doc(db, "configs", `mealConfig_${userBranch}`) : null, 
    [db, userBranch]
  )
  const { data: mealConfig } = useDoc(mealConfigRef)

  const [localMeals, setLocalTemplates] = useState({
    breakfast: false,
    lunch: false,
    dinner: false,
    autoMode: false
  })

  useEffect(() => {
    if (student?.mealStatus) {
      setLocalTemplates({
        breakfast: student.mealStatus.breakfast || false,
        lunch: student.mealStatus.lunch || false,
        dinner: student.mealStatus.dinner || false,
        autoMode: student.mealStatus.autoMode || false
      })
    }
  }, [student])

  const canChange = useMemo(() => {
    if (!mealConfig?.cutoffTime) return true
    const now = new Date()
    const [hours, minutes] = mealConfig.cutoffTime.split(':')
    const deadline = new Date()
    deadline.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    return now < deadline
  }, [mealConfig])

  const handleUpdateMeals = async () => {
    if (!studentRef) return
    if (!canChange) {
      toast({ variant: "destructive", title: "Cutoff Time Crossed", description: `Changes allowed before ${mealConfig?.cutoffTime || 'set time'}.` })
      return
    }

    setIsUpdating(true)
    try {
      await updateDoc(studentRef, {
        mealStatus: localMeals,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Meals Updated", description: "Your meal preferences for tomorrow are saved." })
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) return <div className="flex justify-center p-20 animate-pulse">Loading Meal Status...</div>
  if (!student) return <div className="text-center p-20">Student Data Not Found.</div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="space-y-1 mb-4">
        <h1 className="text-2xl font-black text-slate-800">Meal Control</h1>
        <p className="text-muted-foreground text-sm font-medium">Turn your meals ON/OFF for tomorrow.</p>
      </header>

      {/* Deadline Info */}
      <div className={cn(
        "p-4 rounded-3xl flex items-center gap-4 border",
        canChange ? "bg-primary/5 border-primary/10 text-primary" : "bg-destructive/5 border-destructive/10 text-destructive"
      )}>
        <Clock size={20} className={cn(canChange && "animate-pulse")} />
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest">Daily Deadline</p>
          <p className="text-xs font-bold">{canChange ? `Deadline: ${mealConfig?.cutoffTime || '10:00 AM'}` : "Time Expired - Cannot change today."}</p>
        </div>
        {!canChange && <Badge variant="destructive" className="text-[8px] font-black">LOCKED</Badge>}
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
        <div className="h-2 bg-primary w-full" />
        <CardContent className="p-8 space-y-8">
          <div className="space-y-6">
            {MEAL_TYPES.map((type) => {
              const isAvailable = mealConfig?.[`${type.id}Available`] !== false
              const isChecked = localMeals[type.id as keyof typeof localMeals]
              
              return (
                <div key={type.id} className={cn(
                  "p-5 rounded-3xl border-2 transition-all flex items-center justify-between group",
                  !isAvailable ? "opacity-40 grayscale pointer-events-none border-slate-100" : (isChecked ? "border-success/20 bg-success/5" : "border-slate-50 bg-slate-50/30")
                )}>
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{type.icon}</span>
                    <div>
                      <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">{type.label}</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{isAvailable ? (isChecked ? "Enrolled" : "Not Taking") : "Not Available"}</p>
                    </div>
                  </div>
                  <Switch 
                    disabled={!isAvailable || !canChange}
                    checked={isChecked as boolean}
                    onCheckedChange={(val) => setLocalTemplates({...localMeals, [type.id]: val})}
                  />
                </div>
              )
            })}
          </div>

          <Separator className="opacity-50" />

          <div className="flex items-center justify-between p-4 bg-slate-900 rounded-3xl text-white">
             <div className="space-y-1">
                <div className="flex items-center gap-2"><Zap size={14} className="text-primary" /><h4 className="text-xs font-black uppercase tracking-widest">Auto Meal Mode</h4></div>
                <p className="text-[8px] text-white/50 uppercase font-bold">Apply every day automatically</p>
             </div>
             <Switch 
               checked={localMeals.autoMode}
               onCheckedChange={(val) => setLocalTemplates({...localMeals, autoMode: val})}
             />
          </div>

          <Button 
            onClick={handleUpdateMeals} 
            disabled={isUpdating || !canChange} 
            className="w-full h-16 rounded-[2rem] text-lg font-black shadow-2xl shadow-primary/20 gap-3"
          >
            {isUpdating ? <RefreshCw className="animate-spin" /> : <CheckCircle2 />}
            Save Preferences
          </Button>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm rounded-3xl bg-white p-6 space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold uppercase text-[10px] tracking-widest"><Info size={14}/> System Note</div>
        <p className="text-xs leading-relaxed text-slate-600 font-medium italic">
          "If you miss the deadline, please contact the Hostel Manager for manual meal activation."
        </p>
      </Card>
    </div>
  )
}
