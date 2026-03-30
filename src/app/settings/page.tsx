"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Utensils, Save, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"

export default function SettingsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [rate, setRate] = useState("")

  const configRef = useMemoFirebase(() => doc(db, "configs", "mealRate"), [db])
  const { data: config, isLoading } = useDoc(configRef)

  useEffect(() => {
    if (config) {
      setRate(config.rate?.toString() || "")
    }
  }, [config])

  const handleSave = async () => {
    if (!rate || isNaN(Number(rate))) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid meal rate." })
      return
    }

    setIsUpdating(true)
    try {
      await setDoc(configRef, {
        rate: Number(rate),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Settings Saved", description: "Global meal rate updated for all students." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary">Global Settings</h1>
        <p className="text-muted-foreground mt-1">Configure hostel-wide parameters and rates.</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <Utensils size={20} />
            <CardTitle>Meal Configuration</CardTitle>
          </div>
          <CardDescription>Set the monthly standard meal rate for all non-package students.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="mealRate">Standard Meal Rate (₹)</Label>
            <div className="flex gap-4">
              <Input 
                id="mealRate" 
                type="number" 
                placeholder="e.g. 40" 
                value={rate} 
                onChange={e => setRate(e.target.value)}
                className="max-w-[200px]"
              />
              <Button onClick={handleSave} disabled={isUpdating} className="gap-2">
                {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                Save Rate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              * This rate will be applied automatically when logging monthly meal counts for any student.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
