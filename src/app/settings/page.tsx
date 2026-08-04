
"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Utensils, Save, Loader2, Wallet, Banknote, Smartphone, Landmark, 
  Link as LinkIcon, Copy, ExternalLink, ScrollText,
  Bold, Heading1, Heading2, List, Palette, Eye, Edit3, Eraser,
  MoreVertical, ShieldCheck, Lock, ShieldAlert, RefreshCw, Download, Printer, MapPin,
  History,
  Calculator,
  Zap,
  LayoutGrid,
  Target,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  Users,
  Home,
  Plus,
  Trash2,
  X,
  Info,
  Clock,
  CheckCircle2,
  Wifi,
  ChefHat,
  Hash
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { doc, setDoc, serverTimestamp, getDoc, collection, increment } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select"

const PRODUCTION_DOMAIN = "https://somikoron-one.vercel.app";

interface RoomGroup {
  id: string;
  rooms: string;
  spr: string;
  pRent: string;
  npRent: string;
}

export default function SettingsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [rate, setRate] = useState("")
  const [rules, setRules] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")
  const [selectedLinkBranch, setSelectedLinkBranch] = useState("")
  const [selectedMealBranch, setSelectedMealBranch] = useState("")
  const [selectedBalanceBranch, setSelectedBalanceBranch] = useState("")
  const [selectedEstimatesBranch, setSelectedEstimatesBranch] = useState("")
  
  // Admin/Dev States (CLEANED UP - NO DUPLICATES)
  const [isDevDialogOpen, setIsDevDialogOpen] = useState(false)
  const [isSecurityDialogOpen, setIsSecurityDialogOpen] = useState(false)
  const [isPlannerOpen, setIsPlannerOpen] = useState(false)
  const [devPassword, setDevPassword] = useState("")
  const [isDevMode, setIsDevMode] = useState(false)
  const [enhancedSecurity, setEnhancedSecurity] = useState(false)
  
  // Project Planner State
  const [plannerGroups, setPlannerGroups] = useState<RoomGroup[]>([
    { id: "1", rooms: "5", spr: "4", pRent: "9500", npRent: "5000" }
  ])
  const [plannerSettings, setPlannerSettings] = useState({
    buildingRent: "45000",
    utilityCost: "600",
    foodCost: "4500",
    distribution: "50"
  })

  // Financial Estimates State
  const [financialEstimates, setFinancialEstimates] = useState({
    packageFoodCost: "4500",
    utilityEstimateCost: "500"
  })

  // Advanced Meal State
  const [mealConfigData, setMealConfigData] = useState({
    startTime: "21:00",
    endTime: "23:30",
    breakfastAvailable: true,
    lunchAvailable: true,
    dinnerAvailable: true
  })

  // Utility Billing State
  const [utilityBilling, setUtilityBilling] = useState({
    cookingBill: "500",
    wifiBill: "300"
  })

  // Payment Accounts State
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([])

  const editorRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const branch = localStorage.getItem("user_branch") || "Main Branch"
    const role = localStorage.getItem("user_role") || "Manager"
    const name = localStorage.getItem("user_name") || "User"
    
    setUserBranch(branch)
    setSelectedLinkBranch(branch)
    setSelectedMealBranch(branch)
    setSelectedBalanceBranch(branch)
    setSelectedEstimatesBranch(branch)
    setUserRole(role)
    setUserName(name)
    setIsDevMode(localStorage.getItem("isDeveloperMode") === "true")
  }, [])

  // Firebase Refs
  const mealConfigRef = useMemoFirebase(() => 
    selectedMealBranch ? doc(db, "configs", `mealConfig_${selectedMealBranch}`) : null, 
    [db, selectedMealBranch]
  )
  const { data: mealConfigStore } = useDoc(mealConfigRef)

  const billingConfigRef = useMemoFirebase(() => 
    userBranch ? doc(db, "configs", `billingConfig_${userBranch}`) : null, 
    [db, userBranch]
  )
  const { data: billingConfigStore } = useDoc(billingConfigRef)

  const accountsRef = useMemoFirebase(() => 
    userBranch ? doc(db, "configs", `paymentAccounts_${userBranch}`) : null, 
    [db, userBranch]
  )
  const { data: accountsStore } = useDoc(accountsRef)

  const mealRateConfigRef = useMemoFirebase(() => 
    selectedMealBranch ? doc(db, "configs", `mealRate_${selectedMealBranch}`) : null, 
    [db, selectedMealBranch]
  )
  const { data: mealRateConfig } = useDoc(mealRateConfigRef)

  const rulesRefStore = useMemoFirebase(() => doc(db, "configs", "hostelRules"), [db])
  const { data: rulesData } = useDoc(rulesRefStore)

  useEffect(() => {
    if (mealConfigStore) {
      setMealConfigData({
        startTime: mealConfigStore.startTime || "21:00",
        endTime: mealConfigStore.endTime || "23:30",
        breakfastAvailable: mealConfigStore.breakfastAvailable !== false,
        lunchAvailable: mealConfigStore.lunchAvailable !== false,
        dinnerAvailable: mealConfigStore.dinnerAvailable !== false
      })
    }
  }, [mealConfigStore])

  useEffect(() => {
    if (billingConfigStore) {
      setUtilityBilling({
        cookingBill: (billingConfigStore.cookingBill || "500").toString(),
        wifiBill: (billingConfigStore.wifiBill || "300").toString()
      })
    }
  }, [billingConfigStore])

  useEffect(() => {
    if (accountsStore?.accounts) {
      setPaymentAccounts(accountsStore.accounts)
    }
  }, [accountsStore])

  useEffect(() => { if (mealRateConfig) setRate(mealRateConfig.rate?.toString() || "") }, [mealRateConfig])
  useEffect(() => { if (rulesData?.rulesText) setRules(rulesData.rulesText) }, [rulesData])

  const handleSaveMealConfig = async () => {
    if (!mealConfigRef) return
    setIsUpdating(true)
    try {
      await setDoc(mealConfigRef, {
        ...mealConfigData,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Meal Config Saved" })
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveBilling = async () => {
    if (!billingConfigRef) return
    setIsUpdating(true)
    try {
      await setDoc(billingConfigRef, {
        cookingBill: Number(utilityBilling.cookingBill),
        wifiBill: Number(utilityBilling.wifiBill),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Billing Config Saved" })
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAddAccount = () => {
    setPaymentAccounts([...paymentAccounts, { label: "bKash Personal", number: "" }])
  }

  const handleUpdateAccount = (idx: number, field: string, val: string) => {
    const updated = [...paymentAccounts]
    updated[idx] = { ...updated[idx], [field]: val }
    setPaymentAccounts(updated)
  }

  const handleRemoveAccount = (idx: number) => {
    setPaymentAccounts(paymentAccounts.filter((_, i) => i !== idx))
  }

  const handleSaveAccounts = async () => {
    if (!accountsRef) return
    setIsUpdating(true)
    try {
      await setDoc(accountsRef, {
        accounts: paymentAccounts,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Accounts Updated" })
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveRate = async () => {
    if (!rate || isNaN(Number(rate)) || !mealRateConfigRef) return
    setIsUpdating(true)
    try { 
      await setDoc(mealRateConfigRef, { rate: Number(rate), updatedAt: serverTimestamp() }); 
      toast({ title: "Saved" }) 
    }
    catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  const handleSaveRules = async () => {
    setIsUpdating(true)
    const finalHtml = editorRef.current?.innerHTML || rules;
    try { 
      await setDoc(rulesRefStore, { rulesText: finalHtml, updatedAt: serverTimestamp(), updatedBy: userName }); 
      setRules(finalHtml); 
      toast({ title: "Rules Updated" }) 
    }
    catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  const handleSaveSecurity = async (val: boolean) => {
    try { 
      await setDoc(doc(db, "configs", "securityConfig"), { enhancedSecurity: val, updatedAt: serverTimestamp() }); 
      setEnhancedSecurity(val); 
      toast({ title: "Security Updated" }); 
    }
    catch (e: any) { toast({ variant: "destructive", description: e.message }); }
  }

  const handleToggleDeveloperMode = async () => {
    if (isDevMode) { 
      localStorage.setItem("isDeveloperMode", "false"); 
      setIsDevMode(false); 
      setIsDevDialogOpen(false); 
      return; 
    }
    const docSnap = await getDoc(doc(db, "configs", "devConfig"));
    const cloudPassword = docSnap.exists() ? docSnap.data().password : "01643894287";
    if (devPassword === cloudPassword) { 
      localStorage.setItem("isDeveloperMode", "true"); 
      setIsDevMode(true); 
      setIsDevDialogOpen(false); 
      toast({ title: "Dev Mode Active" }); 
    }
    else { toast({ variant: "destructive", title: "Incorrect Password" }); }
  }

  const copyToClipboard = (path: string) => {
    const fullUrl = `${PRODUCTION_DOMAIN}${path}`; 
    navigator.clipboard.writeText(fullUrl); 
    toast({ title: "Link Copied!" })
  }

  const execCommand = (command: string, value?: string) => { 
    document.execCommand(command, false, value); 
    if (editorRef.current) setRules(editorRef.current.innerHTML); 
  };

  const plannerResults = useMemo(() => {
    const rent = Number(plannerSettings.buildingRent) || 0
    const uCost = Number(plannerSettings.utilityCost) || 0
    const fCost = Number(plannerSettings.foodCost) || 4500
    const dist = Number(plannerSettings.distribution) / 100
    let totalRevenue = 0; let totalFoodExpense = 0; let totalSeats = 0; let packageSeatsCount = 0; let nonPackageSeatsCount = 0
    plannerGroups.forEach(g => {
      const rooms = Number(g.rooms) || 0; const spr = Number(g.spr) || 0; const seats = rooms * spr; const pRent = Number(g.pRent) || 0; const npRent = Number(g.npRent) || 0
      totalSeats += seats; const gPackageSeats = seats * dist; const gNonPackageSeats = seats * (1 - dist)
      totalRevenue += (gPackageSeats * pRent) + (gNonPackageSeats * npRent); totalFoodExpense += gPackageSeats * fCost
      packageSeatsCount += gPackageSeats; nonPackageSeatsCount += gNonPackageSeats
    })
    const totalUtilityExpense = totalSeats * uCost; const totalCosts = rent + totalFoodExpense + totalUtilityExpense
    const profit = totalRevenue - totalCosts; const efficiency = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0
    return { totalSeats, packageSeatsCount: Math.round(packageSeatsCount), nonPackageSeatsCount: Math.round(nonPackageSeatsCount), revenue: totalRevenue, costs: totalCosts, profit, efficiency }
  }, [plannerGroups, plannerSettings])

  const addRoomGroup = () => setPlannerGroups([...plannerGroups, { id: Math.random().toString(36).substr(2, 9), rooms: "1", spr: "4", pRent: "9500", npRent: "5000" }])
  const removeRoomGroup = (id: string) => plannerGroups.length > 1 && setPlannerGroups(plannerGroups.filter(g => g.id !== id))
  const updateGroup = (id: string, field: keyof RoomGroup, value: any) => setPlannerGroups(plannerGroups.map(g => g.id === id ? { ...g, [field]: value } : g))

  const [activeFlyer, setActiveFlyer] = useState<{label: string, url: string, bengaliLabel: string} | null>(null)
  const handlePrintFlyer = (label: string, url: string, bengaliLabel: string) => {
    setActiveFlyer({ label, url, bengaliLabel });
  }

  useEffect(() => {
    if (activeFlyer) {
      setTimeout(() => { window.print(); }, 1000);
      const handleAfterPrint = () => setActiveFlyer(null);
      window.addEventListener('afterprint', handleAfterPrint);
      return () => window.removeEventListener('afterprint', handleAfterPrint);
    }
  }, [activeFlyer]);

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2"><SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mr-2 h-4 md:hidden" /><div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Settings</h1><p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Configure parameters for <span className="font-bold text-foreground">{userBranch}</span>.</p></div></div>
        <div className="ml-auto flex items-center gap-3">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-secondary"><MoreVertical size={20} /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl p-2 border-slate-100">
              <DropdownMenuItem onClick={() => setIsPlannerOpen(true)} className="gap-3 p-3 rounded-lg cursor-pointer"><Calculator size={18} className="text-indigo-600" /><span className="font-bold text-indigo-600">Project Planner</span></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsDevDialogOpen(true)} className="gap-3 p-3 rounded-lg cursor-pointer"><ShieldAlert size={18} className={isDevMode ? "text-destructive" : "text-primary"} /><span className="font-bold">{isDevMode ? "Disable Dev Mode" : "Developer Mode"}</span></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsSecurityDialogOpen(true)} className="gap-3 p-3 rounded-lg cursor-pointer"><Lock size={18} className="text-orange-500" /><span className="font-bold">Login Security</span></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* MEAL ADVANCED CONFIG */}
      <Card className="border-none shadow-sm overflow-hidden border-t-4 border-t-primary print:hidden">
        <CardHeader>
           <div className="flex items-center gap-2 text-primary"><Clock size={20}/><CardTitle>Meal Management Control</CardTitle></div>
           <CardDescription>Set daily deadlines and toggle meal availability for residents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                 <Label className="text-xs font-bold uppercase">Meal Update Window (Time)</Label>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                     <Label className="text-[10px] uppercase font-bold text-muted-foreground">Start Time</Label>
                     <Input type="time" value={mealConfigData.startTime} onChange={e => setMealConfigData({...mealConfigData, startTime: e.target.value})} className="h-10 font-bold" />
                   </div>
                   <div className="space-y-1.5">
                     <Label className="text-[10px] uppercase font-bold text-muted-foreground">End Time</Label>
                     <Input type="time" value={mealConfigData.endTime} onChange={e => setMealConfigData({...mealConfigData, endTime: e.target.value})} className="h-10 font-bold" />
                   </div>
                 </div>
                 <p className="text-[10px] text-muted-foreground italic">Students can only change meals between these times.</p>
              </div>
              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border">
                 <Label className="text-[10px] font-black uppercase text-primary mb-2 block">Meal Availability</Label>
                 <div className="space-y-2">
                    {[
                      { id: 'breakfastAvailable', label: 'Breakfast' },
                      { id: 'lunchAvailable', label: 'Lunch' },
                      { id: 'dinnerAvailable', label: 'Dinner' }
                    ].map(m => (
                      <div key={m.id} className="flex items-center justify-between">
                         <span className="text-xs font-medium">{m.label}</span>
                         <Switch checked={mealConfigData[m.id as keyof typeof mealConfigData] as boolean} onCheckedChange={v => setMealConfigData({...mealConfigData, [m.id]: v})} />
                      </div>
                    ))}
                 </div>
              </div>
           </div>
           <Button onClick={handleSaveMealConfig} disabled={isUpdating} className="w-full h-11 gap-2 rounded-xl">
              {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18}/>} Save Meal Rules
           </Button>
        </CardContent>
      </Card>

      {/* UTILITY BILLING CONFIG */}
      <Card className="border-none shadow-sm overflow-hidden border-t-4 border-t-orange-500 print:hidden">
         <CardHeader>
            <div className="flex items-center gap-2 text-orange-600"><Zap size={20}/><CardTitle>Utility Billing Config</CardTitle></div>
            <CardDescription>Set fixed monthly charges for optional utilities.</CardDescription>
         </CardHeader>
         <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase flex items-center gap-1"><ChefHat size={12}/> Cooking Bill (৳)</Label>
                  <Input type="number" value={utilityBilling.cookingBill} onChange={e => setUtilityBilling({...utilityBilling, cookingBill: e.target.value})} />
               </div>
               <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase flex items-center gap-1"><Wifi size={12}/> WiFi Bill (৳)</Label>
                  <Input type="number" value={utilityBilling.wifiBill} onChange={e => setUtilityBilling({...utilityBilling, wifiBill: e.target.value})} />
               </div>
            </div>
            <Button onClick={handleSaveBilling} variant="outline" disabled={isUpdating} className="w-full h-11 gap-2 border-orange-200 text-orange-600 font-bold rounded-xl">
              {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18}/>} Update Utility Charges
            </Button>
         </CardContent>
      </Card>

      {/* OFFICIAL PAYMENT ACCOUNTS */}
      <Card className="border-none shadow-sm overflow-hidden border-t-4 border-t-success print:hidden">
         <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1"><div className="flex items-center gap-2 text-success"><Landmark size={20}/><CardTitle>Official Payment Accounts</CardTitle></div><CardDescription>Manage accounts for resident payment requests.</CardDescription></div>
            <Button variant="outline" size="sm" onClick={handleAddAccount} className="h-8 gap-1 rounded-lg text-success border-success/30"><Plus size={14}/> Add Account</Button>
         </CardHeader>
         <CardContent className="space-y-4">
            <div className="space-y-3">
               {paymentAccounts.map((acc, idx) => (
                 <div key={idx} className="flex gap-3 items-end p-4 bg-slate-50 rounded-2xl border group animate-in slide-in-from-top-2">
                    <div className="flex-1 space-y-1">
                       <Label className="text-[10px] uppercase">Account Label</Label>
                       <Input value={acc.label} onChange={e => handleUpdateAccount(idx, 'label', e.target.value)} placeholder="e.g. bKash Personal" className="h-9 text-xs" />
                    </div>
                    <div className="flex-[1.5] space-y-1">
                       <Label className="text-[10px] uppercase">Number</Label>
                       <div className="relative">
                          <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input value={acc.number} onChange={e => handleUpdateAccount(idx, 'number', e.target.value)} placeholder="01XXXXXXXXX" className="h-9 pl-8 text-xs font-mono font-bold" />
                       </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive opacity-40 group-hover:opacity-100" onClick={() => handleRemoveAccount(idx)}><Trash2 size={16}/></Button>
                 </div>
               ))}
               {paymentAccounts.length === 0 && <div className="text-center py-8 text-muted-foreground italic text-xs">No official accounts added.</div>}
            </div>
            <Button onClick={handleSaveAccounts} disabled={isUpdating} className="w-full bg-success hover:bg-success/90 h-11 gap-2 rounded-xl">
               {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18}/>} Save Public Accounts
            </Button>
         </CardContent>
      </Card>

      {/* MEAL RATE SETUP */}
      <Card className="border-none shadow-sm overflow-hidden print:hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary"><Utensils size={20} /><CardTitle>Meal Rate Setup</CardTitle></div>
            <CardDescription>Set the monthly standard meal rate.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Standard Meal Rate (৳)</Label>
            <div className="flex gap-4">
              <Input type="number" value={rate} onChange={e => setRate(e.target.value)} className="max-w-[200px]" />
              <Button onClick={handleSaveRate} disabled={isUpdating} className="gap-2">
                {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18} />} Save Rate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* REGISTRATION LINKS */}
      <Card className="border-none shadow-sm border-l-4 border-l-primary bg-primary/5 print:hidden">
        <CardHeader><div className="flex items-center gap-2 text-primary"><LinkIcon size={20} /><CardTitle>Registration Links</CardTitle></div></CardHeader>
        <CardContent className="space-y-4">
          {[{ label: "New Admission", type: "new" }, { label: "Existing Resident", type: "old" }].map((link) => { 
            const path = `/register?branch=${encodeURIComponent(userBranch)}&type=${link.type}`; 
            return (
              <div key={link.type} className="flex flex-col gap-3 p-4 bg-white rounded-2xl border shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{link.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{PRODUCTION_DOMAIN}{path}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => copyToClipboard(path)}><Copy size={14} /> Copy</Button>
                    <Button size="sm" className="h-8" onClick={() => handlePrintFlyer(link.label, `${PRODUCTION_DOMAIN}${path}`, link.label === 'New Admission' ? 'নতুন ভর্তি ফরম' : 'পুরাতন স্টুডেন্ট ফরম')}>
                      <Printer size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            ); 
          })}
        </CardContent>
      </Card>

      {/* RULES & REGULATIONS */}
      <Card className="border-none shadow-sm overflow-hidden print:hidden">
        <CardHeader><div className="flex items-center gap-2 text-primary"><ScrollText size={20} /><CardTitle>Rules & Regulations</CardTitle></div></CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="edit">Editor</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="edit">
              <div className="flex flex-wrap gap-1 p-2 bg-secondary/30 rounded-t-lg border-x border-t">
                <Button variant="ghost" size="sm" onClick={() => execCommand('bold')}><Bold size={14} /></Button>
                <Button variant="ghost" size="sm" onClick={() => execCommand('formatBlock', 'H1')}><Heading1 size={14} /></Button>
                <Button variant="ghost" size="sm" onClick={() => execCommand('insertUnorderedList')}><List size={14} /></Button>
              </div>
              <div 
                ref={editorRef} 
                contentEditable 
                onInput={(e) => setRules(e.currentTarget.innerHTML)} 
                className="rich-text min-h-[300px] p-6 border rounded-b-lg focus:outline-none bg-white shadow-inner overflow-y-auto" 
                dangerouslySetInnerHTML={{ __html: rules }} 
              />
            </TabsContent>
            <TabsContent value="preview" className="border rounded-lg p-8 bg-slate-50 min-h-[300px]">
              <div className="bg-white p-8 rounded-2xl shadow-sm border max-w-2xl mx-auto">
                <div className="rich-text text-sm text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: rules || "<i>No rules yet.</i>" }} />
              </div>
            </TabsContent>
          </Tabs>
          <Button onClick={handleSaveRules} disabled={isUpdating} className="w-full gap-2 h-14 text-lg font-bold shadow-lg mt-4">
            {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={20} />} Save Rules
          </Button>
        </CardContent>
      </Card>

      {/* PLANNER DIALOG */}
      <Dialog open={isPlannerOpen} onOpenChange={setIsPlannerOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] rounded-3xl p-8 overflow-y-auto">
          <DialogHeader><DialogTitle>Investment Planner</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <Label className="text-[10px] font-black uppercase">Building Rent</Label>
                <Input type="number" value={plannerSettings.buildingRent} onChange={e => setPlannerSettings({...plannerSettings, buildingRent: e.target.value})} />
              </div>
              <Button onClick={addRoomGroup} variant="outline" className="w-full">+ Add Room Group</Button>
              <div className="space-y-4">
                {plannerGroups.map(g => (
                  <Card key={g.id} className="p-4 relative">
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-[9px]">Rooms</Label><Input type="number" value={g.rooms} onChange={e => updateGroup(g.id, 'rooms', e.target.value)} /></div>
                      <div><Label className="text-[9px]">Seats/R</Label><Input type="number" value={g.spr} onChange={e => updateGroup(g.id, 'spr', e.target.value)} /></div>
                    </div>
                    <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 text-destructive" onClick={() => removeRoomGroup(g.id)}><X size={14}/></Button>
                  </Card>
                ))}
              </div>
            </div>
            <div className="bg-slate-50 p-8 rounded-3xl text-center space-y-6">
              <div>
                <p className="text-xs uppercase font-bold text-muted-foreground">Monthly Profit</p>
                <p className="text-5xl font-black text-primary">৳{plannerResults.profit.toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-2xl shadow-sm"><p className="text-[10px] font-bold">Total Seats</p><p className="text-xl font-black">{plannerResults.totalSeats}</p></div>
                <div className="p-4 bg-white rounded-2xl shadow-sm"><p className="text-[10px] font-bold">Efficiency</p><p className="text-xl font-black">{plannerResults.efficiency.toFixed(1)}%</p></div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DEV & SECURITY DIALOGS */}
      <Dialog open={isDevDialogOpen} onOpenChange={setIsDevDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Dev Access</DialogTitle></DialogHeader>
          <div className="py-4">
            <Input type="password" value={devPassword} onChange={e => setDevPassword(e.target.value)} placeholder="Password" />
          </div>
          <DialogFooter>
            <Button onClick={handleToggleDeveloperMode} className="w-full">{isDevMode ? "Disable Dev Mode" : "Enable Dev Mode"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSecurityDialogOpen} onOpenChange={setIsSecurityDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Security</DialogTitle></DialogHeader>
          <div className="py-6 flex items-center justify-between">
            <Label>Enhanced Login Session</Label>
            <Switch checked={enhancedSecurity} onCheckedChange={handleSaveSecurity} />
          </div>
          <DialogFooter><Button onClick={() => setIsSecurityDialogOpen(false)} className="w-full">Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {activeFlyer && (
        <div className="print-only print-report-container flex flex-col items-center justify-center h-[297mm] w-[210mm] border-[10mm] border-primary bg-white">
          <div className="text-center space-y-6 p-12">
            <h1 className="text-6xl font-black text-primary uppercase tracking-tighter mb-4" style={{ color: 'hsl(var(--primary)) !important' }}>সমীকরণ ছাত্রাবাস</h1>
            <div className="bg-primary text-white px-12 py-4 rounded-full text-3xl font-black" style={{ backgroundColor: 'hsl(var(--primary)) !important', color: 'white !important' }}>{activeFlyer.bengaliLabel}</div>
            <div className="pt-12 flex flex-col items-center gap-8">
              <div className="p-4 border-[3px] border-dashed border-primary rounded-[3rem] bg-white shadow-inner" style={{ borderColor: 'hsl(var(--primary)) !important' }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encodeURIComponent(activeFlyer.url)}`} alt="QR" className="w-[120mm] h-[120mm] block" />
              </div>
              <p className="text-2xl font-bold text-slate-500 uppercase tracking-widest">Scan to enroll now</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
