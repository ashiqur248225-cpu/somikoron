
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Utensils, Save, Plus, Trash2, Clock, CheckCircle2, Loader2, ChevronLeft } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { doc, setDoc, collection, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { useRouter } from "next/navigation"

const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

export default function MealRoutinePage() {
  const { toast } = useToast()
  const db = useFirestore()
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)
  const [userBranch, setUserBranch] = useState("")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
  }, [])

  const routineQuery = useMemoFirebase(() => collection(db, "mealRoutines"), [db])
  const { data: routines, isLoading } = useCollection(routineQuery)

  const [localRoutine, setLocalRoutine] = useState<Record<string, any>>({})

  useEffect(() => {
    if (routines) {
      const map: any = {}
      routines.forEach(r => {
        if (r.branch === userBranch) map[r.day] = r
      })
      setLocalRoutine(map)
    }
  }, [routines, userBranch])

  const handleUpdateField = (day: string, meal: string, value: string) => {
    setLocalRoutine(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || { day, breakfast: "", lunch: "", dinner: "", branch: userBranch }),
        [meal]: value
      }
    }))
  }

  const handleSave = async (day: string) => {
    const data = localRoutine[day]
    if (!data) return
    setIsUpdating(true)
    try {
      await setDoc(doc(db, "mealRoutines", `${day}_${userBranch}`), {
        ...data,
        branch: userBranch,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Routine Saved", description: `${day} menu updated.` })
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Meal Routine</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Set weekly menu and choice options.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {DAYS.map((day) => (
          <Card key={day} className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-4 px-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-xl text-primary"><Clock size={20}/></div>
                <CardTitle className="text-lg">{day}</CardTitle>
              </div>
              <Button onClick={() => handleSave(day)} disabled={isUpdating} size="sm" className="gap-2 rounded-xl h-9">
                <Save size={16}/> Save {day}
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Breakfast (সকাল)</Label>
                  <Input 
                    value={localRoutine[day]?.breakfast || ""} 
                    onChange={e => handleUpdateField(day, 'breakfast', e.target.value)}
                    placeholder="e.g. Khichuri / Ruti Dal"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Lunch (দুপুর)</Label>
                  <Input 
                    value={localRoutine[day]?.lunch || ""} 
                    onChange={e => handleUpdateField(day, 'lunch', e.target.value)}
                    placeholder="e.g. Rice, Fish/Egg, Veg"
                    className="h-11 rounded-xl"
                  />
                  <p className="text-[9px] text-primary font-bold">Tip: Use '/' for choices (e.g. Fish/Egg)</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Dinner (রাত)</Label>
                  <Input 
                    value={localRoutine[day]?.dinner || ""} 
                    onChange={e => handleUpdateField(day, 'dinner', e.target.value)}
                    placeholder="e.g. Rice, Beef/Chicken"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
