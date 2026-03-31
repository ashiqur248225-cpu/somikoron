
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Utensils, Save, Loader2, Wallet, Banknote, Smartphone, Landmark } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [rate, setRate] = useState("")
  
  // Opening Balances State
  const [balances, setBalances] = useState({
    cash: "0",
    bank: "0",
    bkash: "0",
    nagad: "0"
  })

  const configRef = useMemoFirebase(() => doc(db, "configs", "mealRate"), [db])
  const { data: config, isLoading: isConfigLoading } = useDoc(configRef)

  const balancesRef = useMemoFirebase(() => doc(db, "configs", "openingBalances"), [db])
  const { data: openingBalances, isLoading: isBalancesLoading } = useDoc(balancesRef)

  useEffect(() => {
    if (config) {
      setRate(config.rate?.toString() || "")
    }
  }, [config])

  useEffect(() => {
    if (openingBalances) {
      setBalances({
        cash: (openingBalances.cash || 0).toString(),
        bank: (openingBalances.bank || 0).toString(),
        bkash: (openingBalances.bkash || 0).toString(),
        nagad: (openingBalances.nagad || 0).toString(),
      })
    }
  }, [openingBalances])

  const handleSaveRate = async () => {
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
      toast({ title: "Settings Saved", description: "Global meal rate updated." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveBalances = async () => {
    setIsUpdating(true)
    try {
      await setDoc(balancesRef, {
        cash: Number(balances.cash),
        bank: Number(balances.bank),
        bkash: Number(balances.bkash),
        nagad: Number(balances.nagad),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Balances Saved", description: "Initial opening balances updated." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  if (isConfigLoading || isBalancesLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Global Settings</h1>
          <p className="text-muted-foreground mt-1">Configure hostel-wide parameters and opening balances.</p>
        </div>
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
              <Button onClick={handleSaveRate} disabled={isUpdating} className="gap-2">
                {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                Save Rate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <Wallet size={20} />
            <CardTitle>Opening Balances</CardTitle>
          </div>
          <CardDescription>Set your initial funds before starting app usage. This money will be added to your current totals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Banknote size={14} /> Cash in Hand (Initial)</Label>
              <Input type="number" value={balances.cash} onChange={e => setBalances({...balances, cash: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Landmark size={14} /> Bank Account (Initial)</Label>
              <Input type="number" value={balances.bank} onChange={e => setBalances({...balances, bank: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Smartphone size={14} className="text-primary" /> Bkash Wallet (Initial)</Label>
              <Input type="number" value={balances.bkash} onChange={e => setBalances({...balances, bkash: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Smartphone size={14} className="text-orange-500" /> Nagad Wallet (Initial)</Label>
              <Input type="number" value={balances.nagad} onChange={e => setBalances({...balances, nagad: e.target.value})} />
            </div>
          </div>
          <Button onClick={handleSaveBalances} disabled={isUpdating} className="w-full gap-2 mt-4">
            {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18} />}
            Save Initial Balances
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
