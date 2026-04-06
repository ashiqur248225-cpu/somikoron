
"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { 
  Utensils, Save, Loader2, Wallet, Banknote, Smartphone, Landmark, 
  Link as LinkIcon, Copy, ExternalLink, ScrollText,
  Bold, Heading1, Heading2, List, Palette, Eye, Edit3, Type, Eraser, Highlighter, ListOrdered, History, TrendingUp, Search, Printer, Calendar as CalendarIcon, XCircle, ArrowUpRight, ArrowDownRight, Calculator, UserCheck, Info, RefreshCw
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { doc, setDoc, serverTimestamp, collection, query, where, limit } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function SettingsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [rate, setRate] = useState("")
  const [rules, setRules] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [isFoodHistoryOpen, setIsFoodHistoryOpen] = useState(false)
  
  // Food History Filter States
  const [foodStartDate, setFoodStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [foodEndDate, setFoodEndDate] = useState(new Date().toISOString().split('T')[0])
  
  const editorRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

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

  const rulesRef = useMemoFirebase(() => doc(db, "configs", "hostelRules"), [db])
  const { data: rulesData, isLoading: isRulesLoading } = useDoc(rulesRef)

  // Food Cost History Query
  const foodHistoryQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(
      collection(db, "expenses"), 
      where("branch", "==", userBranch),
      where("category", "==", "food"),
      limit(1000)
    )
  }, [db, userBranch])
  const { data: rawFoodHistory, isLoading: isFoodHistoryLoading } = useCollection(foodHistoryQuery)

  const filteredFoodHistory = useMemo(() => {
    if (!rawFoodHistory) return []
    const start = new Date(foodStartDate)
    const end = new Date(foodEndDate)
    end.setHours(23, 59, 59)

    return rawFoodHistory
      .filter(item => {
        const itemDate = new Date(item.expenseDate)
        return itemDate >= start && itemDate <= end
      })
      .sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())
  }, [rawFoodHistory, foodStartDate, foodEndDate])

  // Analytics for the Report
  const foodAnalytics = useMemo(() => {
    if (!filteredFoodHistory.length) return {
      totalCost: 0,
      totalMeals: 0,
      avgPerMeal: 0,
      highestDay: null,
      lowestDay: null,
      bestEfficiency: null,
      totalDays: 0
    }

    let totalCost = 0
    let totalMeals = 0
    let highestDay = filteredFoodHistory[0]
    let lowestDay = filteredFoodHistory[0]
    let bestEfficiency = { date: '', rate: Infinity }

    filteredFoodHistory.forEach(item => {
      const cost = Number(item.amount || 0)
      const meals = Number(item.totalMeals || 0)
      totalCost += cost
      totalMeals += meals

      if (cost > highestDay.amount) highestDay = item
      if (cost < lowestDay.amount && cost > 0) lowestDay = item

      if (meals > 0) {
        const currentRate = cost / meals
        if (currentRate < bestEfficiency.rate) {
          bestEfficiency = { date: item.expenseDate, rate: currentRate }
        }
      }
    })

    return {
      totalCost,
      totalMeals,
      avgPerMeal: totalMeals > 0 ? (totalCost / totalMeals) : 0,
      highestDay,
      lowestDay,
      bestEfficiency: bestEfficiency.rate === Infinity ? null : bestEfficiency,
      totalDays: filteredFoodHistory.length
    }
  }, [filteredFoodHistory])

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

  useEffect(() => {
    if (rulesData && rulesData.rulesText) {
      setRules(rulesData.rulesText)
    }
  }, [rulesData])

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
      toast({ title: "Rules Updated", description: "Hostel rules and regulations have been saved." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setRules(editorRef.current.innerHTML);
    }
  };

  const copyToClipboard = (text: string) => {
    const baseUrl = window.location.origin
    const fullUrl = `${baseUrl}${text}`
    navigator.clipboard.writeText(fullUrl)
    toast({ title: "Copied!", description: "Link copied to clipboard." })
  }

  const handlePrintFoodHistory = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  const regLinks = [
    { label: "New Student Registration", type: "new", icon: LinkIcon },
    { label: "Existing Resident (Data Import)", type: "old", icon: LinkIcon }
  ]

  if (isConfigLoading || isBalancesLoading || isRulesLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Settings</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">
              Configure parameters for <span className="font-bold text-foreground">{userBranch}</span>.
            </p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">
                {userName ? userName.substring(0, 2) : "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* COMPREHENSIVE FOOD COST BREAKDOWN REPORT (Only visible in print) */}
      <div className="print-only print-report-container">
        <div className="report-header text-center pb-6">
          <h1 className="text-3xl font-black uppercase text-primary tracking-tighter">SOMIKORON HOSTEL</h1>
          <p className="text-sm font-bold text-slate-600">{userBranch} Branch Ledger</p>
          <div className="mt-4 border-y-2 border-primary/20 py-3">
            <h2 className="text-xl font-bold text-slate-800 uppercase tracking-widest">Food Cost Breakdown Report</h2>
            <p className="text-[10pt] font-medium text-muted-foreground mt-1">Report Period: <b>{foodStartDate}</b> to <b>{foodEndDate}</b></p>
          </div>
        </div>

        {/* Top Summary Stats for Print */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-slate-50 border rounded-xl space-y-1">
            <p className="text-[8pt] uppercase font-bold text-muted-foreground tracking-widest">Total Food Cost</p>
            <p className="text-lg font-black text-destructive">৳{foodAnalytics.totalCost.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-slate-50 border rounded-xl space-y-1">
            <p className="text-[8pt] uppercase font-bold text-muted-foreground tracking-widest">Total Meals Served</p>
            <p className="text-lg font-black text-slate-800">{foodAnalytics.totalMeals}</p>
          </div>
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-1">
            <p className="text-[8pt] uppercase font-bold text-primary tracking-widest">Avg Cost / Meal</p>
            <p className="text-lg font-black text-primary">৳{foodAnalytics.avgPerMeal.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-slate-50 border rounded-xl space-y-1">
            <p className="text-[8pt] uppercase font-bold text-muted-foreground tracking-widest">Days Observed</p>
            <p className="text-lg font-black text-slate-800">{foodAnalytics.totalDays} Days</p>
          </div>
        </div>

        {/* Detailed Table for Print */}
        <Table className="border w-full text-[9pt]">
          <TableHeader>
            <TableRow className="bg-slate-100/80">
              <TableHead className="border font-bold">Date</TableHead>
              <TableHead className="border font-bold">Branch</TableHead>
              <TableHead className="border font-bold text-center">Meals</TableHead>
              <TableHead className="border font-bold text-right">Cost (৳)</TableHead>
              <TableHead className="border font-bold text-right">Avg / Meal</TableHead>
              <TableHead className="border font-bold">Spent By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFoodHistory.map((item) => {
              const totalMeals = Number(item.totalMeals || 0)
              const amount = Number(item.amount || 0)
              const perMealPrice = totalMeals > 0 ? (amount / totalMeals).toFixed(2) : "N/A"
              return (
                <TableRow key={item.id}>
                  <TableCell className="border">{item.expenseDate}</TableCell>
                  <TableCell className="border text-[8pt]">{item.branch}</TableCell>
                  <TableCell className="border text-center font-bold">{totalMeals || '-'}</TableCell>
                  <TableCell className="border text-right font-bold">৳{amount.toLocaleString()}</TableCell>
                  <TableCell className="border text-right font-black">৳{perMealPrice}</TableCell>
                  <TableCell className="border text-[8pt]">{item.expensePartyName}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {/* Trend / Insight Section for Print */}
        <div className="mt-10 p-6 bg-slate-50 border-2 border-dashed rounded-2xl">
          <h3 className="text-xs font-black uppercase text-primary mb-4 flex items-center gap-2">
            <TrendingUp size={14}/> Report Analytics & Insights
          </h3>
          <div className="grid grid-cols-2 gap-x-10 gap-y-4 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Highest Food Cost Day:</span>
              <span className="font-bold text-destructive">{foodAnalytics.highestDay?.expenseDate} (৳{foodAnalytics.highestDay?.amount.toLocaleString()})</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Best Cost Efficiency:</span>
              <span className="font-bold text-success">
                {foodAnalytics.bestEfficiency ? `${foodAnalytics.bestEfficiency.date} (৳${foodAnalytics.bestEfficiency.rate.toFixed(2)}/meal)` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Overall Expense Center:</span>
              <span className="font-bold text-primary">{userBranch}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Report Generated By:</span>
              <span className="font-bold">{userName}</span>
            </div>
          </div>
        </div>

        {/* Print Footer / Signatures */}
        <div className="print-footer mt-20 flex justify-between px-10">
          <div className="signature-box flex flex-col items-center">
            <div className="w-40 border-t border-black pt-2 text-center text-[9pt] font-bold uppercase">Kitchen / Cook</div>
          </div>
          <div className="signature-box flex flex-col items-center">
            <div className="w-40 border-t border-black pt-2 text-center text-[9pt] font-bold uppercase">Manager</div>
          </div>
          <div className="signature-box flex flex-col items-center">
            <div className="w-40 border-t border-black pt-2 text-center text-[9pt] font-bold uppercase">Accountant</div>
          </div>
        </div>
        
        <div className="text-[8pt] text-muted-foreground text-center mt-10">
          Generated via Somikoron Hostel Management System on {new Date().toLocaleString()}
        </div>
      </div>

      {/* Meal Configuration Section (Screen View) */}
      <Card className="border-none shadow-sm overflow-hidden print:hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Utensils size={20} />
              <CardTitle>Meal Configuration</CardTitle>
            </div>
            <CardDescription>Set the monthly standard meal rate for all non-package students.</CardDescription>
          </div>
          <Dialog open={isFoodHistoryOpen} onOpenChange={setIsFoodHistoryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-9 rounded-lg border-primary/20 text-primary hover:bg-primary/5 font-bold">
                <History size={14} /> Daily Food History
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase text-primary">
                  <TrendingUp className="text-primary"/> Daily Food Cost History
                </DialogTitle>
                <DialogDescription>Detailed food cost analysis for {userBranch} fetched from expenses.</DialogDescription>
              </DialogHeader>
              
              {/* Summary Cards in Dialog */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4">
                <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-2xl">
                  <p className="text-[10px] font-black uppercase text-destructive/60 tracking-widest">Period Cost</p>
                  <p className="text-2xl font-black text-destructive">৳{foodAnalytics.totalCost.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                  <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest">Avg Cost/Meal</p>
                  <p className="text-2xl font-black text-primary">৳{foodAnalytics.avgPerMeal.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                  <p className="text-[10px] font-black uppercase text-orange-600 tracking-widest">Meals Logged</p>
                  <p className="text-2xl font-black text-orange-700">{foodAnalytics.totalMeals}</p>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-secondary/20 p-4 rounded-xl border items-end mb-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">From Date</Label>
                  <Input type="date" value={foodStartDate} onChange={e => setFoodStartDate(e.target.value)} className="bg-white h-10 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">To Date</Label>
                  <Input type="date" value={foodEndDate} onChange={e => setFoodEndDate(e.target.value)} className="bg-white h-10 rounded-lg" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-10 gap-2 font-bold uppercase text-xs rounded-lg border-primary/20 text-primary" onClick={handlePrintFoodHistory}>
                    <Printer size={16} /> Print Report
                  </Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground" onClick={() => {
                    setFoodStartDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
                    setFoodEndDate(new Date().toISOString().split('T')[0]);
                  }}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="py-2">
                <div className="rounded-xl border overflow-hidden bg-white shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Total Meals</TableHead>
                        <TableHead>Total Cost (৳)</TableHead>
                        <TableHead className="text-right">Per Meal Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isFoodHistoryLoading ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                      ) : (
                        filteredFoodHistory.map((item) => {
                          const totalMeals = Number(item.totalMeals || 0)
                          const amount = Number(item.amount || 0)
                          const perMealPrice = totalMeals > 0 ? (amount / totalMeals).toFixed(2) : "N/A"
                          
                          return (
                            <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                              <TableCell className="font-bold text-slate-600">{new Date(item.expenseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                              <TableCell>
                                {totalMeals > 0 ? (
                                  <Badge variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100 border-none font-bold">{totalMeals} Meals</Badge>
                                ) : <span className="text-muted-foreground italic text-xs">Not set</span>}
                              </TableCell>
                              <TableCell className="font-bold text-destructive">৳{amount.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-black text-primary">
                                {perMealPrice !== "N/A" ? `৳${perMealPrice}` : perMealPrice}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                      {!isFoodHistoryLoading && filteredFoodHistory.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">No food expense records found. Ensure expenses are recorded under "Food" category.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsFoodHistoryOpen(false)} variant="secondary" className="w-full h-11 rounded-xl">Close Report</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-6">
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
                {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                Save Rate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registration Links Section */}
      <Card className="border-none shadow-sm border-l-4 border-l-primary bg-primary/5 print:hidden">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <LinkIcon size={20} />
            <CardTitle>Public Registration Links</CardTitle>
          </div>
          <CardDescription>Share these links with students to collect their information for this branch.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {regLinks.map((link) => (
            <div key={link.type} className="flex flex-col md:flex-row gap-3 items-start md:items-center p-3 bg-background rounded-lg border shadow-sm">
              <div className="flex-1">
                <p className="text-sm font-bold">{link.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">/register?branch={encodeURIComponent(userBranch)}&type={link.type}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => window.open(`/register?branch=${encodeURIComponent(userBranch)}&type=${link.type}`, '_blank')}>
                  <ExternalLink size={14} /> Open Form
                </Button>
                <Button size="sm" variant="secondary" className="gap-2" onClick={() => copyToClipboard(`/register?branch=${encodeURIComponent(userBranch)}&type=${link.type}`)}>
                  <Copy size={14} /> Copy Link
                </Button>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground italic mt-2">* এই লিঙ্কগুলো ব্যবহার করে স্টুডেন্টরা আবেদন করলে সেগুলো সরাসরি আপনার "Pending Requests" সেকশনে জমা হবে।</p>
        </CardContent>
      </Card>

      {/* Rules & Regulations Editor Section */}
      <Card className="border-none shadow-sm overflow-hidden print:hidden">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <ScrollText size={20} />
            <CardTitle>Rules & Regulations Setup</CardTitle>
          </div>
          <CardDescription>Edit hostel rules like a document (Highlight, Bold, Colors).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="edit" className="gap-2"><Edit3 size={14} /> Document Editor</TabsTrigger>
              <TabsTrigger value="preview" className="gap-2"><Eye size={14} /> Form View Preview</TabsTrigger>
            </TabsList>
            
            <TabsContent value="edit" className="space-y-0">
              {/* WYSIWYG Toolbar */}
              <div className="flex flex-wrap gap-1 p-2 bg-secondary/30 rounded-t-lg border-x border-t sticky top-0 z-10 backdrop-blur-sm">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Bold" onClick={() => execCommand('bold')}><Bold size={14} /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Heading 1" onClick={() => execCommand('formatBlock', 'H1')}><Heading1 size={14} /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Heading 2" onClick={() => execCommand('formatBlock', 'H2')}><Heading2 size={14} /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Paragraph" onClick={() => execCommand('formatBlock', 'P')}><Type size={14} /></Button>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Bullet List" onClick={() => execCommand('insertUnorderedList')}><List size={14} /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Ordered List" onClick={() => execCommand('insertOrderedList')}><ListOrdered size={14} /></Button>
                <Separator orientation="vertical" className="h-6 mx-1" />
                
                {/* Color Picker Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Text Color"><Palette size={14} /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => execCommand('foreColor', '#000000')} className="gap-2"><div className="w-3 h-3 rounded-full bg-black" /> Black</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => execCommand('foreColor', '#296EB3')} className="gap-2"><div className="w-3 h-3 rounded-full bg-[#296EB3]" /> Hoste Blue</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => execCommand('foreColor', '#F06A6A')} className="gap-2"><div className="w-3 h-3 rounded-full bg-[#F06A6A]" /> Warning Red</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Highlight Picker Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Highlight"><Highlighter size={14} /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => execCommand('backColor', '#fef08a')} className="gap-2"><div className="w-3 h-3 bg-[#fef08a]" /> Yellow</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => execCommand('backColor', '#ffffff')} className="gap-2"><div className="w-3 h-3 bg-white border" /> None</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Separator orientation="vertical" className="h-6 mx-1" />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" title="Clear Formatting" onClick={() => execCommand('removeFormat')}><Eraser size={14} /></Button>
              </div>

              {/* Editable Content Area */}
              <div
                ref={editorRef}
                contentEditable
                onInput={(e) => setRules(e.currentTarget.innerHTML)}
                className="rich-text min-h-[400px] p-6 border rounded-b-lg focus:outline-none bg-white shadow-inner overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: rules }}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    document.execCommand('indent', false);
                  }
                }}
              />
              <p className="text-[10px] text-muted-foreground italic mt-2 px-1">* মাইক্রোসফট ওয়ার্ডের মতো এখানে সরাসরি নিয়মগুলো সাজান। আপনি যেভাবে সেভ করবেন, স্টুডেন্টরা ঠিক সেভাবেই দেখতে পাবে।</p>
            </TabsContent>

            <TabsContent value="preview" className="border rounded-lg p-8 bg-slate-50 min-h-[400px]">
              <div className="bg-white p-8 rounded-2xl shadow-sm border max-w-2xl mx-auto">
                <div 
                  className="rich-text text-sm max-w-none text-slate-600 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: rules || "<i>No rules written yet.</i>" }}
                />
              </div>
            </TabsContent>
          </Tabs>

          <Button onClick={handleSaveRules} disabled={isUpdating} className="w-full gap-2 h-14 text-lg font-bold shadow-lg mt-4">
            {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            Save & Publish Final Rules
          </Button>
        </CardContent>
      </Card>

      {/* Opening Balances Section */}
      <Card className="border-none shadow-sm print:hidden">
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
