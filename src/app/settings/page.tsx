
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
  Info
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
  
  // Admin/Dev States
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

  // Print Flyer State
  const [activeFlyer, setActiveFlyer] = useState<{label: string, url: string, bengaliLabel: string} | null>(null)

  const editorRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const branch = localStorage.getItem("user_branch") || "Main Branch"
    const role = localStorage.getItem("user_role") || "Manager"
    const name = localStorage.getItem("user_name") || "User"
    
    setUserBranch(branch)
    setSelectedLinkBranch(branch)
    setSelectedMealBranch(branch)
    setSelectedBalanceBranch(branch)
    setUserRole(role)
    setUserName(name)
    setIsDevMode(localStorage.getItem("isDeveloperMode") === "true")
  }, [])

  // Project Planner Logic
  const plannerResults = useMemo(() => {
    const rent = Number(plannerSettings.buildingRent) || 0
    const uCost = Number(plannerSettings.utilityCost) || 0
    const fCost = Number(plannerSettings.foodCost) || 4500
    const dist = Number(plannerSettings.distribution) / 100

    let totalRevenue = 0
    let totalFoodExpense = 0
    let totalSeats = 0
    let packageSeatsCount = 0
    let nonPackageSeatsCount = 0

    plannerGroups.forEach(g => {
      const rooms = Number(g.rooms) || 0
      const spr = Number(g.spr) || 0
      const seats = rooms * spr
      const pRent = Number(g.pRent) || 0
      const npRent = Number(g.npRent) || 0

      totalSeats += seats
      
      const gPackageSeats = seats * dist
      const gNonPackageSeats = seats * (1 - dist)
      
      totalRevenue += (gPackageSeats * pRent) + (gNonPackageSeats * npRent)
      totalFoodExpense += gPackageSeats * fCost
      
      packageSeatsCount += gPackageSeats
      nonPackageSeatsCount += gNonPackageSeats
    })

    const totalUtilityExpense = totalSeats * uCost
    const totalCosts = rent + totalFoodExpense + totalUtilityExpense
    const profit = totalRevenue - totalCosts
    const efficiency = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

    return { 
      totalSeats, 
      packageSeatsCount: Math.round(packageSeatsCount), 
      nonPackageSeatsCount: Math.round(nonPackageSeatsCount), 
      revenue: totalRevenue, 
      costs: totalCosts, 
      profit, 
      efficiency 
    }
  }, [plannerGroups, plannerSettings])

  // Planner Group Actions
  const addRoomGroup = () => {
    const newGroup: RoomGroup = {
      id: Math.random().toString(36).substr(2, 9),
      rooms: "1",
      spr: "4",
      pRent: "9500",
      npRent: "5000"
    }
    setPlannerGroups([...plannerGroups, newGroup])
  }

  const removeRoomGroup = (id: string) => {
    if (plannerGroups.length > 1) {
      setPlannerGroups(plannerGroups.filter(g => g.id !== id))
    }
  }

  const updateGroup = (id: string, field: keyof RoomGroup, value: any) => {
    setPlannerGroups(plannerGroups.map(g => g.id === id ? { ...g, [field]: value } : g))
  }

  // Print synchronization effect
  useEffect(() => {
    if (activeFlyer) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      
      const handleAfterPrint = () => {
        setActiveFlyer(null);
      };
      
      window.addEventListener('afterprint', handleAfterPrint);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [activeFlyer]);

  // Opening Balances State - Represents Amount to Add
  const [balances, setBalances] = useState({
    cash: "0",
    bank: "0",
    bkash: "0",
    nagad: "0"
  })

  // Reset inputs when branch changes
  useEffect(() => {
    setBalances({ cash: "0", bank: "0", bkash: "0", nagad: "0" })
  }, [selectedBalanceBranch])

  // BRANCH AWARE MEAL RATE
  const configRef = useMemoFirebase(() => 
    selectedMealBranch ? doc(db, "configs", `mealRate_${selectedMealBranch}`) : null, 
    [db, selectedMealBranch]
  )
  const { data: config, isLoading: isConfigLoading } = useDoc(configRef)

  // BRANCH AWARE OPENING BALANCES (Total Sum recorded so far)
  const balancesRef = useMemoFirebase(() => 
    selectedBalanceBranch ? doc(db, "configs", `openingBalances_${selectedBalanceBranch}`) : null, 
    [db, selectedBalanceBranch]
  )
  const { data: totalOpeningBalances, isLoading: isBalancesLoading } = useDoc(balancesRef)

  const rulesRef = useMemoFirebase(() => doc(db, "configs", "hostelRules"), [db])
  const { data: rulesData, isLoading: isRulesLoading } = useDoc(rulesRef)

  const securityRef = useMemoFirebase(() => doc(db, "configs", "securityConfig"), [db])
  const { data: securityData } = useDoc(securityRef)

  const estimatesRef = useMemoFirebase(() => doc(db, "configs", "financialEstimates"), [db])
  const { data: estimatesData } = useDoc(estimatesRef)

  const branchesQuery = useMemoFirebase(() => collection(db, "branches"), [db])
  const { data: branches } = useCollection(branchesQuery)

  useEffect(() => {
    if (config) {
      setRate(config.rate?.toString() || "")
    } else {
      setRate("")
    }
  }, [config])

  useEffect(() => {
    if (rulesData?.rulesText) setRules(rulesData.rulesText)
  }, [rulesData])

  useEffect(() => {
    if (securityData) setEnhancedSecurity(securityData.enhancedSecurity || false)
  }, [securityData])

  useEffect(() => {
    if (estimatesData) {
      setFinancialEstimates({
        packageFoodCost: (estimatesData.packageFoodCost || 4500).toString(),
        utilityEstimateCost: (estimatesData.utilityEstimateCost || 500).toString()
      })
    }
  }, [estimatesData])

  const handleSaveRate = async () => {
    if (!rate || isNaN(Number(rate))) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid meal rate." })
      return
    }
    if (!selectedMealBranch) {
      toast({ variant: "destructive", title: "Error", description: "Please select a branch first." })
      return
    }
    setIsUpdating(true)
    try {
      if (!configRef) throw new Error("Document reference not ready");
      await setDoc(configRef, { rate: Number(rate), updatedAt: serverTimestamp() })
      toast({ title: "Settings Saved", description: `Meal rate updated for ${selectedMealBranch}.` })
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveEstimates = async () => {
    setIsUpdating(true)
    try {
      await setDoc(estimatesRef, {
        packageFoodCost: Number(financialEstimates.packageFoodCost),
        utilityEstimateCost: Number(financialEstimates.utilityEstimateCost),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Estimation Constants Saved", description: "Profit calculations will now reflect these values." })
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveBalances = async () => {
    if (!selectedBalanceBranch) {
      toast({ variant: "destructive", title: "Error", description: "Select a branch first." })
      return;
    }
    
    const cash = Number(balances.cash || 0)
    const bank = Number(balances.bank || 0)
    const bkash = Number(balances.bkash || 0)
    const nagad = Number(balances.nagad || 0)
    const totalToAdd = cash + bank + bkash + nagad

    if (totalToAdd === 0) {
      toast({ variant: "destructive", title: "Amount Required", description: "Please enter some amounts to add to the balance." })
      return
    }

    setIsUpdating(true)
    try {
      // 1. Update the Audit/Tracking document for "Total Opening Balance"
      if (!balancesRef) throw new Error("Document reference not ready");
      await setDoc(balancesRef, {
        cash: increment(cash),
        bank: increment(bank),
        bkash: increment(bkash),
        nagad: increment(nagad),
        updatedAt: serverTimestamp()
      }, { merge: true })

      // 2. Add to current Net Balance using increment (Persistent Addition)
      const netBalanceRef = doc(db, "netBalance", selectedBalanceBranch)
      await setDoc(netBalanceRef, {
        branchId: selectedBalanceBranch,
        totalCash: increment(cash),
        totalBank: increment(bank),
        totalBkash: increment(bkash),
        totalNagad: increment(nagad),
        totalHandCash: increment(totalToAdd),
        lastUpdated: serverTimestamp()
      }, { merge: true })

      // 3. Reset inputs to 0 to prevent double-adding
      setBalances({ cash: "0", bank: "0", bkash: "0", nagad: "0" })

      toast({ 
        title: "Funds Added Successfully", 
        description: `৳${totalToAdd.toLocaleString()} has been summed into ${selectedBalanceBranch} net balance.` 
      })
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveRules = async () => {
    setIsUpdating(true)
    const finalHtml = editorRef.current?.innerHTML || rules;
    try {
      await setDoc(rulesRef, {
        rulesText: finalHtml,
        updatedAt: serverTimestamp(),
        updatedBy: localStorage.getItem("somikoron_auth_id")
      })
      setRules(finalHtml)
      toast({ title: "Rules Updated" })
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleToggleDeveloperMode = async () => {
    if (isDevMode) {
      localStorage.setItem("isDeveloperMode", "false");
      setIsDevMode(false);
      setIsDevDialogOpen(false);
      setDevPassword("");
      toast({ title: "Developer Mode Disabled" });
      return;
    }

    const docSnap = await getDoc(doc(db, "configs", "devConfig"));
    const cloudPassword = docSnap.exists() ? docSnap.data().password : "123456789";
    
    if (devPassword === cloudPassword) {
      localStorage.setItem("isDeveloperMode", "true");
      setIsDevMode(true);
      setIsDevDialogOpen(false);
      setDevPassword("");
      toast({ title: "Developer Mode Active" });
    } else {
      toast({ variant: "destructive", title: "Incorrect Password" });
    }
  }

  const handleSaveSecurity = async (val: boolean) => {
    try {
      await setDoc(doc(db, "configs", "securityConfig"), { 
        enhancedSecurity: val,
        updatedAt: serverTimestamp()
      });
      setEnhancedSecurity(val);
      toast({ title: "Security Updated" });
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message });
    }
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) setRules(editorRef.current.innerHTML);
  };

  const copyToClipboard = (path: string) => {
    const fullUrl = `${PRODUCTION_DOMAIN}${path}`
    navigator.clipboard.writeText(fullUrl)
    toast({ title: "Link Copied!" })
  }

  const handlePrintFlyer = (label: string, url: string, bengaliLabel: string) => {
    setActiveFlyer({ label, url, bengaliLabel });
  }

  if (isConfigLoading || isBalancesLoading || isRulesLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Settings</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Configure parameters for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-secondary">
                <MoreVertical size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl p-2 border-slate-100">
              <DropdownMenuItem onClick={() => setIsPlannerOpen(true)} className="gap-3 p-3 rounded-lg cursor-pointer">
                <Calculator size={18} className="text-indigo-600" />
                <span className="font-bold text-indigo-600">Project Planner</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsDevDialogOpen(true)} className="gap-3 p-3 rounded-lg cursor-pointer">
                <ShieldAlert size={18} className={isDevMode ? "text-destructive" : "text-primary"} />
                <span className="font-bold">{isDevMode ? "Disable Dev Mode" : "Developer Mode"}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsSecurityDialogOpen(true)} className="gap-3 p-3 rounded-lg cursor-pointer">
                <Lock size={18} className="text-orange-500" />
                <span className="font-bold">Login Security</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">{userName ? userName.substring(0, 2) : "U"}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* PROJECT PLANNER DIALOG */}
      <Dialog open={isPlannerOpen} onOpenChange={setIsPlannerOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden rounded-3xl p-0 flex flex-col">
          <div className="h-2 bg-indigo-600 w-full shrink-0" />
          <DialogHeader className="px-8 pt-6 shrink-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Calculator size={24}/></div>
              <div>
                <DialogTitle className="text-2xl font-black">Investment & Profit Planner</DialogTitle>
                <DialogDescription>Compare Package vs Non-Package ROI with dynamic room groups.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Input Section */}
            <div className="lg:col-span-8 flex flex-col gap-6 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-indigo-600 ml-1">Building Rent (৳)</Label>
                  <div className="relative">
                    <Home className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="number" className="pl-9 h-10 font-bold" value={plannerSettings.buildingRent} onChange={e => setPlannerSettings({...plannerSettings, buildingRent: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Est. Utility/Seat</Label>
                    <Input type="number" className="h-10" value={plannerSettings.utilityCost} onChange={e => setPlannerSettings({...plannerSettings, utilityCost: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Fixed Food Cost</Label>
                    <Input type="number" className="h-10" value={plannerSettings.foodCost} onChange={e => setPlannerSettings({...plannerSettings, foodCost: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* GLOBAL DISTRIBUTION SLIDER */}
              <div className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-3xl space-y-4 shrink-0 shadow-inner">
                <div className="flex justify-between items-end mb-2">
                  <Label className="text-[11px] font-black uppercase text-indigo-700 ml-1">Student Distribution Strategy</Label>
                  <div className="text-right">
                    <span className="text-lg font-black text-indigo-600">{plannerSettings.distribution}%</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Package</span>
                  </div>
                </div>
                <div className="px-1">
                  <Slider 
                    value={[Number(plannerSettings.distribution)]} 
                    onValueChange={(val) => setPlannerSettings({...plannerSettings, distribution: val[0].toString()})}
                    max={100}
                    step={1}
                    className="py-4"
                  />
                  <div className="flex justify-between text-[8px] font-black uppercase text-muted-foreground tracking-widest px-1">
                    <span>100% Non-Package</span>
                    <span>100% Package</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center shrink-0 border-b pb-2">
                <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2">
                  <LayoutGrid size={14}/> Room Categories
                </h4>
                <Button variant="outline" size="sm" onClick={addRoomGroup} className="h-8 gap-1.5 text-[10px] font-bold uppercase text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                  <Plus size={14}/> Add Room Group
                </Button>
              </div>

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4 pb-24">
                  {plannerGroups.map((group, idx) => (
                    <Card key={group.id} className="border-2 shadow-none rounded-2xl overflow-hidden relative group animate-in slide-in-from-right-2 duration-300">
                      <div className="h-1 w-full bg-indigo-200" />
                      <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-10 gap-4 items-end">
                          <div className="md:col-span-2 space-y-1">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Rooms</Label>
                            <Input type="number" value={group.rooms} onChange={e => updateGroup(group.id, 'rooms', e.target.value)} className="h-9 text-xs" />
                          </div>
                          <div className="md:col-span-2 space-y-1">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Seats/R</Label>
                            <Input type="number" value={group.spr} onChange={e => updateGroup(group.id, 'spr', e.target.value)} className="h-9 text-xs" />
                          </div>
                          <div className="md:col-span-3 space-y-1">
                            <Label className="text-[9px] font-black uppercase text-primary">Package (৳)</Label>
                            <Input type="number" value={group.pRent} onChange={e => updateGroup(group.id, 'pRent', e.target.value)} className="h-9 text-xs font-bold" />
                          </div>
                          <div className="md:col-span-3 space-y-1">
                            <Label className="text-[9px] font-black uppercase text-orange-600">Non-Pack (৳)</Label>
                            <Input type="number" value={group.npRent} onChange={e => updateGroup(group.id, 'npRent', e.target.value)} className="h-9 text-xs font-bold" />
                          </div>
                        </div>
                        {plannerGroups.length > 1 && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute -top-1 -right-1 h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" 
                            onClick={() => removeRoomGroup(group.id)}
                          >
                            <X size={14}/>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Results Section */}
            <div className="lg:col-span-4 space-y-6 shrink-0">
              <Card className="border-none shadow-inner bg-slate-50 rounded-3xl p-6 h-full flex flex-col">
                <div className="flex-1 space-y-6">
                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Capacity</p>
                    <p className="text-4xl font-black text-slate-800">{plannerResults.totalSeats} <span className="text-lg text-slate-400">Seats</span></p>
                    <div className="flex justify-center gap-4 text-[9px] font-bold uppercase mt-2">
                      <span className="text-primary">{plannerResults.packageSeatsCount} PKG</span>
                      <span className="text-orange-600">{plannerResults.nonPackageSeatsCount} Non-P</span>
                    </div>
                  </div>

                  <Separator className="bg-slate-200" />

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-success" /> <span className="text-xs font-medium text-slate-600">Expected Revenue</span></div>
                      <span className="font-black text-slate-800">৳{plannerResults.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-destructive" /> <span className="text-xs font-medium text-slate-600">Est. Operating Expense</span></div>
                      <span className="font-black text-slate-800">৳{plannerResults.costs.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="mt-8 p-6 bg-white rounded-3xl border-2 border-indigo-100 shadow-xl space-y-2 text-center animate-in zoom-in-95 duration-500">
                    <p className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em]">Projected Monthly Profit</p>
                    <p className={cn("text-4xl font-black tracking-tighter", plannerResults.profit >= 0 ? "text-success" : "text-destructive")}>
                      ৳{plannerResults.profit.toLocaleString()}
                    </p>
                    <div className="pt-2">
                      <Badge className={cn("rounded-full font-bold", plannerResults.efficiency > 20 ? "bg-success" : (plannerResults.efficiency > 0 ? "bg-orange-500" : "bg-destructive"))}>
                        Efficiency: {plannerResults.efficiency.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="pt-6 space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase">
                    <Target size={12}/> Planner Insight
                  </div>
                  <p className="text-[10px] leading-relaxed text-muted-foreground italic">
                    {plannerResults.profit > 15000 
                      ? "This looks like a high-yield project. Monitor the distribution for maximum ROI."
                      : "Profit margins are tight. Try increasing seats per room or adjusting distribution."}
                  </p>
                </div>
              </Card>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsPlannerOpen(false)} className="rounded-xl px-8 h-12 font-bold">Close Planner</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Developer Mode Password Dialog */}
      <Dialog open={isDevDialogOpen} onOpenChange={setIsDevDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className={isDevMode ? "text-slate-900" : "text-destructive"}/> Developer Access</DialogTitle>
            <DialogDescription>{isDevMode ? "Developer mode is currently active." : "Management restricted area. Enter admin password to proceed."}</DialogDescription>
          </DialogHeader>
          {!isDevMode && (
            <div className="py-4">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Password</Label>
              <Input type="password" value={devPassword} onChange={e => setDevPassword(e.target.value)} placeholder="••••••••" className="h-12 bg-slate-50 border-none shadow-inner rounded-2xl text-lg text-center font-black" />
            </div>
          )}
          <DialogFooter><Button onClick={handleToggleDeveloperMode} className={cn("w-full h-12 text-lg font-bold rounded-2xl", isDevMode ? "bg-slate-900" : "bg-destructive")}>{isDevMode ? "Deactivate Mode" : "Activate Mode"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Security Toggle Dialog */}
      <Dialog open={isSecurityDialogOpen} onOpenChange={setIsSecurityDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Lock className="text-orange-500"/> Session Security</DialogTitle><DialogDescription>Control how users stay logged into the system.</DialogDescription></DialogHeader>
          <div className="py-6 flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="space-y-1"><Label className="text-sm font-bold">Enhanced Login Security</Label><p className="text-[10px] text-muted-foreground leading-tight">If ON, users must login every time they open the app.</p></div>
            <Switch checked={enhancedSecurity} onCheckedChange={handleSaveSecurity} />
          </div>
          <DialogFooter><Button onClick={() => setIsSecurityDialogOpen(false)} className="w-full h-12 rounded-2xl">Close Settings</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Financial Estimation Constants Section */}
      <Card className="border-none shadow-sm overflow-hidden border-t-4 border-t-indigo-600 print:hidden">
        <CardHeader>
          <div className="flex items-center gap-2 text-indigo-600">
            <Calculator size={20} />
            <CardTitle>Financial Estimation Constants</CardTitle>
          </div>
          <CardDescription>Configure global food and utility costs for profit calculations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="foodCost">Package Food Cost (৳)</Label>
              <div className="relative">
                <Utensils className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="foodCost" 
                  type="number" 
                  className="pl-9" 
                  placeholder="e.g. 4500" 
                  value={financialEstimates.packageFoodCost} 
                  onChange={e => setFinancialEstimates({...financialEstimates, packageFoodCost: e.target.value})} 
                />
              </div>
              <p className="text-[10px] text-muted-foreground italic">Estimated monthly food expense per package student.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="utilCost">Estimated Utility Cost (৳)</Label>
              <div className="relative">
                <Zap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="utilCost" 
                  type="number" 
                  className="pl-9" 
                  placeholder="e.g. 500" 
                  value={financialEstimates.utilityEstimateCost} 
                  onChange={e => setFinancialEstimates({...financialEstimates, utilityEstimateCost: e.target.value})} 
                />
              </div>
              <p className="text-[10px] text-muted-foreground italic">Estimated monthly utility expense (electricity/water) per active student.</p>
            </div>
          </div>
          <Button onClick={handleSaveEstimates} disabled={isUpdating} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700">
            {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18} />} Update Estimation Rules
          </Button>
        </CardContent>
      </Card>

      {/* Meal Configuration Section */}
      <Card className="border-none shadow-sm overflow-hidden print:hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1"><div className="flex items-center gap-2 text-primary"><Utensils size={20} /><CardTitle>Meal Configuration</CardTitle></div><CardDescription>Set the monthly standard meal rate.</CardDescription></div>
          <Link href="/food-history"><Button variant="outline" size="sm" className="gap-2 h-9 rounded-lg border-primary/20 text-primary font-bold"><History size={14} /> meals ret</Button></Link>
        </CardHeader>
        <CardContent className="space-y-6">
          {userRole === 'Admin' && (
            <div className="space-y-2 mb-4">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                <MapPin size={12}/> Select Branch for Rate
              </Label>
              <Select value={selectedMealBranch} onValueChange={setSelectedMealBranch}>
                <SelectTrigger className="h-10 bg-slate-50 border-none shadow-inner font-bold">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map(b => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="mealRate">Standard Meal Rate (৳)</Label>
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
                {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18} />} Save Rate
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground italic">Configuring for Branch: <b>{selectedMealBranch || 'None'}</b></p>
          </div>
        </CardContent>
      </Card>

      {/* Registration Links Section */}
      <Card className="border-none shadow-sm border-l-4 border-l-primary bg-primary/5 print:hidden">
        <CardHeader><div className="flex items-center gap-2 text-primary"><LinkIcon size={20} /><CardTitle>Public Registration Links</CardTitle></div><CardDescription>Share these secure links with students.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {/* Branch Selection for Admin */}
          {userRole === 'Admin' && (
             <div className="p-4 bg-white rounded-2xl border border-primary/10 space-y-2 mb-2 shadow-sm">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  <MapPin size={12}/> Target Branch for Links
                </Label>
                <Select value={selectedLinkBranch} onValueChange={setSelectedLinkBranch}>
                   <SelectTrigger className="h-10 bg-slate-50 border-none shadow-inner font-bold">
                      <SelectValue placeholder="Select Branch" />
                   </SelectTrigger>
                   <SelectContent>
                      {branches?.map(b => (
                         <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                      ))}
                   </SelectContent>
                </Select>
                <p className="text-[9px] text-muted-foreground italic">Generate links and QR codes for different hostel locations.</p>
             </div>
          )}

          {[
            { label: "New Student Registration", bengaliLabel: "নতুন স্টুডেন্ট এডমিশন ফর্ম", type: "new" },
            { label: "Existing Resident (Data Import)", bengaliLabel: "পুরাতন স্টুডেন্ট এডমিশন ফর্ম", type: "old" }
          ].map((link) => {
            const path = `/register?branch=${encodeURIComponent(selectedLinkBranch || userBranch)}&type=${link.type}`;
            const fullUrl = `${PRODUCTION_DOMAIN}${path}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fullUrl)}`;
            return (
              <div key={link.type} className="flex flex-col gap-4 p-4 bg-background rounded-3xl border shadow-sm">
                <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                  <div className="flex-1 overflow-hidden"><p className="text-sm font-bold">{link.label}</p><p className="text-[10px] text-muted-foreground truncate">{fullUrl}</p></div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[10px] font-bold uppercase" onClick={() => window.open(fullUrl, '_blank')}><ExternalLink size={14} /> Open</Button>
                    <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-[10px] font-bold uppercase" onClick={() => copyToClipboard(path)}><Copy size={14} /> Copy</Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[10px] font-bold uppercase text-primary border-primary/20" asChild><a href={qrUrl} download={`qr_${link.type}.png`}><Download size={14} /> QR Image</a></Button>
                    <Button size="sm" className="h-8 gap-1.5 text-[10px] font-bold uppercase" onClick={() => handlePrintFlyer(link.label, fullUrl, link.bengaliLabel)}><Printer size={14} /> Print Flyer</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Rules & Regulations Editor Section */}
      <Card className="border-none shadow-sm overflow-hidden print:hidden">
        <CardHeader><div className="flex items-center gap-2 text-primary"><ScrollText size={20} /><CardTitle>Rules & Regulations Setup</CardTitle></div><CardDescription>Edit hostel rules like a document.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4"><TabsTrigger value="edit" className="gap-2"><Edit3 size={14} /> Document Editor</TabsTrigger><TabsTrigger value="preview" className="gap-2"><Eye size={14} /> Preview</TabsTrigger></TabsList>
            <TabsContent value="edit" className="space-y-0">
              <div className="flex flex-wrap gap-1 p-2 bg-secondary/30 rounded-t-lg border-x border-t sticky top-0 z-10 backdrop-blur-sm">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Bold" onClick={() => execCommand('bold')}><Bold size={14} /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Heading 1" onClick={() => execCommand('formatBlock', 'H1')}><Heading1 size={14} /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Heading 2" onClick={() => execCommand('formatBlock', 'H2')}><Heading2 size={14} /></Button>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="List" onClick={() => execCommand('insertUnorderedList')}><List size={14} /></Button>
                <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Palette size={14} /></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onClick={() => execCommand('foreColor', '#000000')}>Black</DropdownMenuItem><DropdownMenuItem onClick={() => execCommand('foreColor', '#296EB3')}>Blue</DropdownMenuItem><DropdownMenuItem onClick={() => execCommand('foreColor', '#F06A6A')}>Red</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => execCommand('removeFormat')}><Eraser size={14} /></Button>
              </div>
              <div ref={editorRef} contentEditable onInput={(e) => setRules(e.currentTarget.innerHTML)} className="rich-text min-h-[400px] p-6 border rounded-b-lg focus:outline-none bg-white shadow-inner overflow-y-auto" dangerouslySetInnerHTML={{ __html: rules }} />
            </TabsContent>
            <TabsContent value="preview" className="border rounded-lg p-8 bg-slate-50 min-h-[400px]"><div className="bg-white p-8 rounded-2xl shadow-sm border max-w-2xl mx-auto"><div className="rich-text text-sm max-w-none text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: rules || "<i>No rules written yet.</i>" }} /></div></TabsContent>
          </Tabs>
          <Button onClick={handleSaveRules} disabled={isUpdating} className="w-full gap-2 h-14 text-lg font-bold shadow-lg mt-4">{isUpdating ? <Loader2 className="animate-spin" /> : <Save size={20} />} Save & Publish Rules</Button>
        </CardContent>
      </Card>

      {/* Opening Balances Section (Add to Balance Mode) */}
      <Card className="border-none shadow-sm print:hidden">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <Wallet size={20} />
            <CardTitle>Initial Fund Addition</CardTitle>
          </div>
          <CardDescription>Amounts entered here will be <b>summed</b> to your current branch balances.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {userRole === 'Admin' && (
            <div className="space-y-2 mb-4">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                <MapPin size={12}/> Select Branch to Add Funds
              </Label>
              <Select value={selectedBalanceBranch} onValueChange={setSelectedBalanceBranch}>
                <SelectTrigger className="h-10 bg-slate-50 border-none shadow-inner font-bold">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map(b => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {totalOpeningBalances && (
            <div className="p-4 bg-primary/5 rounded-2xl border border-dashed border-primary/20 space-y-2 mb-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary tracking-widest">
                <Info size={12}/> Lifetime Added Opening Funds
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                <div className="text-[10px] font-bold text-slate-500">Cash: <span className="text-slate-800">৳{totalOpeningBalances.cash?.toLocaleString() || 0}</span></div>
                <div className="text-[10px] font-bold text-slate-500">Bank: <span className="text-slate-800">৳{totalOpeningBalances.bank?.toLocaleString() || 0}</span></div>
                <div className="text-[10px] font-bold text-slate-500">Bkash: <span className="text-slate-800">৳{totalOpeningBalances.bkash?.toLocaleString() || 0}</span></div>
                <div className="text-[10px] font-bold text-slate-500">Nagad: <span className="text-slate-800">৳{totalOpeningBalances.nagad?.toLocaleString() || 0}</span></div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Add to Cash</Label><div className="relative"><Banknote className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input type="number" value={balances.cash} onChange={e => setBalances({...balances, cash: e.target.value})} className="pl-9 h-11 rounded-xl font-bold bg-white" /></div></div>
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Add to Bank</Label><div className="relative"><Landmark className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input type="number" value={balances.bank} onChange={e => setBalances({...balances, bank: e.target.value})} className="pl-9 h-11 rounded-xl font-bold bg-white" /></div></div>
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Add to Bkash</Label><div className="relative"><Smartphone className="absolute left-3 top-3 h-4 w-4 text-pink-500" /><Input type="number" value={balances.bkash} onChange={e => setBalances({...balances, bkash: e.target.value})} className="pl-9 h-11 rounded-xl font-bold bg-white" /></div></div>
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Add to Nagad</Label><div className="relative"><Smartphone className="absolute left-3 top-3 h-4 w-4 text-orange-500" /><Input type="number" value={balances.nagad} onChange={e => setBalances({...balances, nagad: e.target.value})} className="pl-9 h-11 rounded-xl font-bold bg-white" /></div></div>
          </div>
          
          <Button onClick={handleSaveBalances} disabled={isUpdating} className="w-full gap-2 h-14 text-lg font-black rounded-2xl shadow-xl shadow-primary/10">
            {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={20} />} Confirm & Sum to Balance
          </Button>
          <p className="text-[9px] text-center text-muted-foreground italic uppercase font-bold tracking-widest">
            Warning: This will increase your current net balance for <b>{selectedBalanceBranch}</b>.
          </p>
        </CardContent>
      </Card>

      {/* PRINT FLYER AREA (A4 Design) */}
      {activeFlyer && (
        <div className="print-only print-report-container flex flex-col items-center justify-center h-[297mm] w-[210mm] border-[10mm] border-primary bg-white">
          <div className="text-center space-y-6 p-12 flex flex-col items-center">
            <h1 className="text-6xl font-black text-primary uppercase tracking-tighter mb-4" style={{ color: 'hsl(var(--primary)) !important' }}>সমীকরণ ছাত্রাবাস</h1>
            <div className="bg-primary text-white px-12 py-4 rounded-full text-3xl font-black uppercase tracking-widest shadow-xl" style={{ backgroundColor: 'hsl(var(--primary)) !important', color: 'white !important' }}>অনলাইন ভর্তি ফর্ম</div>
            <div className="pt-12 flex flex-col items-center space-y-8">
              <div className="p-8 border-[3px] border-dashed border-primary rounded-[3rem] bg-white shadow-inner" style={{ borderColor: 'hsl(var(--primary)) !important' }}><img src={`https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encodeURIComponent(activeFlyer.url)}`} alt="Registration QR Code" className="w-[120mm] h-[120mm] block" /></div>
              <div className="space-y-4"><h2 className="text-4xl font-black text-slate-800">{activeFlyer.bengaliLabel}</h2><p className="text-2xl font-bold text-slate-500 uppercase tracking-widest">Scan to enroll now</p></div>
            </div>
            <div className="pt-20 text-center space-y-4">
              <p className="text-xl font-bold text-primary flex items-center justify-center gap-3" style={{ color: 'hsl(var(--primary)) !important' }}><MapPin size={24} /> {selectedLinkBranch || userBranch} Branch</p>
              <div className="h-1 w-48 bg-primary/20 mx-auto rounded-full" style={{ backgroundColor: 'rgba(41, 110, 179, 0.2) !important' }} /><p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Powered by Somikoron Digital System</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
