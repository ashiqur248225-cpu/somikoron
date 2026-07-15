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
  Wifi,
  UtensilsCrossed
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

export default function SettingsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [rules, setRules] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")
  
  // Admin/Dev States
  const [isDevMode, setIsDevMode] = useState(false)

  // Advanced Meal & Utility States
  const [mealConfigForm, setMealConfigForm] = useState({
    cutoffTime: "10:00",
    breakfastAvailable: true,
    lunchAvailable: true,
    dinnerAvailable: true
  })
  
  const [utilityForm, setUtilityForm] = useState({
    cookingBill: "500",
    wifiBill: "300"
  })

  // Official Accounts State
  const [officialAccounts, setOfficialAccounts] = useState<any[]>([])
  const [newAccount, setNewAccount] = useState({ label: "Bkash Personal", number: "" })

  const editorRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const branch = localStorage.getItem("user_branch") || "Main Branch"
    const role = localStorage.getItem("user_role") || "Manager"
    const name = localStorage.getItem("user_name") || "User"
    setUserBranch(branch); setUserRole(role); setUserName(name)
    setIsDevMode(localStorage.getItem("isDeveloperMode") === "true")
  }, [])

  // Branch Aware Configs
  const mealRef = useMemoFirebase(() => userBranch ? doc(db, "configs", `mealConfig_${userBranch}`) : null, [db, userBranch])
  const { data: storedMealConfig } = useDoc(mealRef)

  const billingRef = useMemoFirebase(() => userBranch ? doc(db, "configs", `billingConfig_${userBranch}`) : null, [db, userBranch])
  const { data: storedBillingConfig } = useDoc(billingRef)

  const accountsRef = useMemoFirebase(() => userBranch ? doc(db, "configs", `paymentAccounts_${userBranch}`) : null, [db, userBranch])
  const { data: storedAccounts } = useDoc(accountsRef)

  const rulesRef = useMemoFirebase(() => doc(db, "configs", "hostelRules"), [db])
  const { data: rulesData } = useDoc(rulesRef)

  useEffect(() => {
    if (storedMealConfig) setMealConfigForm({ ...mealConfigForm, ...storedMealConfig })
    if (storedBillingConfig) setUtilityForm({ ...utilityForm, ...storedBillingConfig })
    if (storedAccounts?.accounts) setOfficialAccounts(storedAccounts.accounts)
    if (rulesData?.rulesText) setRules(rulesData.rulesText)
  }, [storedMealConfig, storedBillingConfig, storedAccounts, rulesData])

  const handleSaveMealConfig = async () => {
    if (!mealRef) return
    setIsUpdating(true)
    try {
      await setDoc(mealRef, { ...mealConfigForm, updatedAt: serverTimestamp() })
      toast({ title: "Meal Config Saved" })
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  const handleSaveBilling = async () => {
    if (!billingRef) return
    setIsUpdating(true)
    try {
      await setDoc(billingRef, { ...utilityForm, updatedAt: serverTimestamp() })
      toast({ title: "Utility Rates Saved" })
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  const handleAddAccount = async () => {
    if (!newAccount.number || !accountsRef) return
    const updated = [...officialAccounts, newAccount]
    setIsUpdating(true)
    try {
      await setDoc(accountsRef, { accounts: updated, updatedAt: serverTimestamp() }, { merge: true })
      setOfficialAccounts(updated)
      setNewAccount({ label: "Bkash Personal", number: "" })
      toast({ title: "Account Added" })
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  const handleRemoveAccount = async (idx: number) => {
    if (!accountsRef) return
    const updated = officialAccounts.filter((_, i) => i !== idx)
    try {
      await setDoc(accountsRef, { accounts: updated, updatedAt: serverTimestamp() }, { merge: true })
      setOfficialAccounts(updated)
      toast({ title: "Account Removed" })
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
  }

  const handleSaveRules = async () => {
    const ref = doc(db, "configs", "hostelRules")
    setIsUpdating(true)
    try {
      await setDoc(ref, { 
        rulesText: rules,
        updatedAt: serverTimestamp(),
        updatedBy: userName
      }, { merge: true })
      toast({ title: "Rules Published", description: "Registration rules have been updated." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) setRules(editorRef.current.innerHTML);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">System Configuration</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Meal Logic Config */}
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
          <CardHeader className="bg-primary/5 border-b">
            <div className="flex items-center gap-2 text-primary"><Clock size={20}/><CardTitle className="text-lg">Meal Logic & Deadline</CardTitle></div>
            <CardDescription>Control daily cutoff and meal types.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
             <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Daily Cutoff Time (for students)</Label>
                <div className="flex gap-2">
                  <Input type="time" value={mealConfigForm.cutoffTime} onChange={e => setMealConfigForm({...mealConfigForm, cutoffTime: e.target.value})} className="h-12 text-lg font-black" />
                  <Button onClick={handleSaveMealConfig} disabled={isUpdating}><Save size={18}/></Button>
                </div>
             </div>
             <Separator />
             <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">Availability Control</p>
                <div className="space-y-3">
                   {['breakfast', 'lunch', 'dinner'].map(meal => (
                     <div key={meal} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <Label className="capitalize font-bold text-sm">{meal} Service</Label>
                        <Switch 
                          checked={mealConfigForm[`${meal}Available` as keyof typeof mealConfigForm] as boolean} 
                          onCheckedChange={val => setMealConfigForm({...mealConfigForm, [`${meal}Available`]: val})} 
                        />
                     </div>
                   ))}
                </div>
             </div>
             <Button onClick={handleSaveMealConfig} disabled={isUpdating} className="w-full h-12 rounded-2xl gap-2">
                {isUpdating ? <Loader2 className="animate-spin"/> : <Save size={18}/>} Save Control Settings
             </Button>
          </CardContent>
        </Card>

        {/* Utility Billing Config */}
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
           <CardHeader className="bg-success/5 border-b">
             <div className="flex items-center gap-2 text-success"><Zap size={20}/><CardTitle className="text-lg">Utility Bill Management</CardTitle></div>
             <CardDescription>Fixed rates for optional collections.</CardDescription>
           </CardHeader>
           <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Cooking Bill (৳)</Label>
                    <div className="relative">
                      <UtensilsCrossed className="absolute left-3 top-3.5 h-4 w-4 text-orange-500" />
                      <Input type="number" value={utilityForm.cookingBill} onChange={e => setUtilityForm({...utilityForm, cookingBill: e.target.value})} className="pl-9 h-12 font-black" />
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">WiFi Bill (৳)</Label>
                    <div className="relative">
                      <Wifi className="absolute left-3 top-3.5 h-4 w-4 text-blue-500" />
                      <Input type="number" value={utilityForm.wifiBill} onChange={e => setUtilityForm({...utilityForm, wifiBill: e.target.value})} className="pl-9 h-12 font-black" />
                    </div>
                 </div>
              </div>
              <Button onClick={handleSaveBilling} disabled={isUpdating} className="w-full h-12 rounded-2xl bg-success hover:bg-success/90 gap-2">
                 {isUpdating ? <Loader2 className="animate-spin"/> : <Save size={18}/>} Sync Utility Rates
              </Button>
              <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                 <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase">
                   Note: These bills will appear as optional deductions in the Payment Entry page.
                 </p>
              </div>
           </CardContent>
        </Card>
      </div>

      {/* Official Payment Accounts */}
      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-blue-50/50 border-b">
          <div className="flex items-center gap-2 text-blue-600"><Smartphone size={20}/><CardTitle>Official Payment Accounts</CardTitle></div>
          <CardDescription>Visible to students in their portal.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Label</Label>
                <Input value={newAccount.label} onChange={e => setNewAccount({...newAccount, label: e.target.value})} placeholder="e.g. Bkash Personal" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Mobile / Account No</Label>
                <Input value={newAccount.number} onChange={e => setNewAccount({...newAccount, number: e.target.value})} placeholder="01XXXXXXXXX" />
              </div>
              <Button onClick={handleAddAccount} disabled={isUpdating} className="h-10 bg-blue-600 hover:bg-blue-700 gap-2"><Plus size={16}/> Add Account</Button>
           </div>
           
           <div className="space-y-3">
              {officialAccounts.map((acc, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                   <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-[10px] uppercase">
                        {acc.label.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-700">{acc.label}</p>
                        <p className="text-xs font-mono text-slate-400">{acc.number}</p>
                      </div>
                   </div>
                   <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleRemoveAccount(i)}><Trash2 size={16}/></Button>
                </div>
              ))}
              {officialAccounts.length === 0 && <p className="text-center py-8 text-xs text-muted-foreground italic">No accounts listed.</p>}
           </div>
        </CardContent>
      </Card>

      {/* Rules Document Editor */}
      <Card className="border-none shadow-sm overflow-hidden bg-white rounded-3xl">
        <CardHeader className="bg-primary/5 border-b"><div className="flex items-center gap-2 text-primary"><ScrollText size={20} /><CardTitle>Rules & Regulations (Public)</CardTitle></div></CardHeader>
        <CardContent className="p-6 space-y-4">
          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4"><TabsTrigger value="edit" className="gap-2"><Edit3 size={14} /> Document Editor</TabsTrigger><TabsTrigger value="preview" className="gap-2"><Eye size={14} /> Preview</TabsTrigger></TabsList>
            <TabsContent value="edit" className="space-y-0">
              <div className="flex flex-wrap gap-1 p-2 bg-secondary/30 rounded-t-lg border-x border-t sticky top-0 z-10 backdrop-blur-sm">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Bold" onClick={() => execCommand('bold')}><Bold size={14} /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Heading 1" onClick={() => execCommand('formatBlock', 'H1')}><Heading1 size={14} /></Button>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="List" onClick={() => execCommand('insertUnorderedList')}><List size={14} /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => execCommand('removeFormat')}><Eraser size={14} /></Button>
              </div>
              <div ref={editorRef} contentEditable onInput={(e) => setRules(e.currentTarget.innerHTML)} className="rich-text min-h-[300px] p-6 border rounded-b-lg focus:outline-none bg-white shadow-inner overflow-y-auto" dangerouslySetInnerHTML={{ __html: rules }} />
            </TabsContent>
            <TabsContent value="preview" className="border rounded-lg p-8 bg-slate-50 min-h-[300px]"><div className="bg-white p-8 rounded-2xl shadow-sm border max-w-2xl mx-auto"><div className="rich-text text-sm max-w-none text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: rules || "<i>No rules written yet.</i>" }} /></div></TabsContent>
          </Tabs>
          <Button onClick={handleSaveRules} disabled={isUpdating} className="w-full gap-2 h-14 text-lg font-bold shadow-lg mt-4">{isUpdating ? <Loader2 className="animate-spin" /> : <Save size={20} />} Save & Publish Rules</Button>
        </CardContent>
      </Card>
    </div>
  )
}
