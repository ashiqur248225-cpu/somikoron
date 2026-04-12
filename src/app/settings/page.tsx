
"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { 
  Utensils, Save, Loader2, Wallet, Banknote, Smartphone, Landmark, 
  Link as LinkIcon, Copy, ExternalLink, ScrollText,
  Bold, Heading1, Heading2, List, Palette, Eye, Edit3, Type, Eraser, Highlighter, ListOrdered, History,
  MoreVertical, ShieldCheck, Lock, ShieldAlert, RefreshCw, QrCode, Download, Printer, MapPin
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore"
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

const PRODUCTION_DOMAIN = "https://somikoron-one.vercel.app";

export default function SettingsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [rate, setRate] = useState("")
  const [rules, setRules] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  
  // Admin/Dev States
  const [isDevDialogOpen, setIsDevDialogOpen] = useState(false)
  const [isSecurityDialogOpen, setIsSecurityDialogOpen] = useState(false)
  const [devPassword, setDevPassword] = useState("")
  const [isDevMode, setIsDevMode] = useState(false)
  const [enhancedSecurity, setEnhancedSecurity] = useState(false)
  
  // Print Flyer State
  const [activeFlyer, setActiveFlyer] = useState<{label: string, url: string, bengaliLabel: string} | null>(null)

  const editorRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    setIsDevMode(localStorage.getItem("isDeveloperMode") === "true")
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

  const securityRef = useMemoFirebase(() => doc(db, "configs", "securityConfig"), [db])
  const { data: securityData } = useDoc(securityRef)

  useEffect(() => {
    if (config) setRate(config.rate?.toString() || "")
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
    if (rulesData?.rulesText) setRules(rulesData.rulesText)
  }, [rulesData])

  useEffect(() => {
    if (securityData) setEnhancedSecurity(securityData.enhancedSecurity || false)
  }, [securityData])

  const handleSaveRate = async () => {
    if (!rate || isNaN(Number(rate))) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid meal rate." })
      return
    }
    setIsUpdating(true)
    try {
      await setDoc(configRef, { rate: Number(rate), updatedAt: serverTimestamp() })
      toast({ title: "Settings Saved" })
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message })
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
      toast({ title: "Balances Saved" })
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
      toast({ 
        title: "Developer Mode Disabled",
        description: "Bulk actions restricted."
      });
      return;
    }

    const docSnap = await getDoc(doc(db, "configs", "devConfig"));
    const cloudPassword = docSnap.exists() ? docSnap.data().password : "123456789";
    
    if (devPassword === cloudPassword) {
      localStorage.setItem("isDeveloperMode", "true");
      setIsDevMode(true);
      setIsDevDialogOpen(false);
      setDevPassword("");
      toast({ 
        title: "Developer Mode Active",
        description: "You can now perform bulk deletions."
      });
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
    toast({ title: "Link Copied!", description: "Public URL is now in your clipboard." })
  }

  const handlePrintFlyer = (label: string, url: string, bengaliLabel: string) => {
    setActiveFlyer({ label, url, bengaliLabel });
    // Small delay to allow state to propagate to DOM before printing
    setTimeout(() => {
      window.print();
    }, 200);
  }

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-secondary">
                <MoreVertical size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl p-2 border-slate-100">
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
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">
                {userName ? userName.substring(0, 2) : "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Developer Mode Password Dialog */}
      <Dialog open={isDevDialogOpen} onOpenChange={setIsDevDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className={isDevMode ? "text-slate-900" : "text-destructive"}/> Developer Access</DialogTitle>
            <DialogDescription>
              {isDevMode 
                ? "Developer mode is currently active. You can turn it off to restrict management tools." 
                : "Management restricted area. Enter admin password to proceed."}
            </DialogDescription>
          </DialogHeader>
          
          {!isDevMode && (
            <div className="py-4">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Password</Label>
              <Input 
                type="password" 
                value={devPassword} 
                onChange={e => setDevPassword(e.target.value)} 
                placeholder="••••••••"
                className="h-12 bg-slate-50 border-none shadow-inner rounded-2xl text-lg text-center font-black"
              />
            </div>
          )}

          <DialogFooter>
            <Button onClick={handleToggleDeveloperMode} className={cn("w-full h-12 text-lg font-bold rounded-2xl", isDevMode ? "bg-slate-900" : "bg-destructive")}>
              {isDevMode ? "Deactivate Mode" : "Activate Mode"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Security Toggle Dialog */}
      <Dialog open={isSecurityDialogOpen} onOpenChange={setIsSecurityDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="text-orange-500"/> Session Security</DialogTitle>
            <DialogDescription>Control how users stay logged into the system.</DialogDescription>
          </DialogHeader>
          <div className="py-6 flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="space-y-1">
              <Label className="text-sm font-bold">Enhanced Login Security</Label>
              <p className="text-[10px] text-muted-foreground leading-tight">If ON, users must login every time they open the app.</p>
            </div>
            <Switch checked={enhancedSecurity} onCheckedChange={handleSaveSecurity} />
          </div>
          <DialogFooter>
            <Button onClick={() => setIsSecurityDialogOpen(false)} className="w-full h-12 rounded-2xl">Close Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meal Configuration Section */}
      <Card className="border-none shadow-sm overflow-hidden print:hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Utensils size={20} />
              <CardTitle>Meal Configuration</CardTitle>
            </div>
            <CardDescription>Set the monthly standard meal rate.</CardDescription>
          </div>
          <Link href="/food-history">
            <Button variant="outline" size="sm" className="gap-2 h-9 rounded-lg border-primary/20 text-primary font-bold">
              <History size={14} /> Daily Food History
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="mealRate">Standard Meal Rate (৳)</Label>
            <div className="flex gap-4">
              <Input id="mealRate" type="number" placeholder="e.g. 40" value={rate} onChange={e => setRate(e.target.value)} className="max-w-[200px]" />
              <Button onClick={handleSaveRate} disabled={isUpdating} className="gap-2">
                {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18} />} Save Rate
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
          <CardDescription>Share these secure links with students.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "New Student Registration", bengaliLabel: "নতুন স্টুডেন্ট এডমিশন ফর্ম", type: "new" },
            { label: "Existing Resident (Data Import)", bengaliLabel: "পুরাতন স্টুডেন্ট এডমিশন ফর্ম", type: "old" }
          ].map((link) => {
            const path = `/register?branch=${encodeURIComponent(userBranch)}&type=${link.type}`;
            const fullUrl = `${PRODUCTION_DOMAIN}${path}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fullUrl)}`;
            
            return (
              <div key={link.type} className="flex flex-col gap-4 p-4 bg-background rounded-3xl border shadow-sm">
                <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold">{link.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{fullUrl}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[10px] font-bold uppercase" onClick={() => window.open(fullUrl, '_blank')}>
                      <ExternalLink size={14} /> Open
                    </Button>
                    <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-[10px] font-bold uppercase" onClick={() => copyToClipboard(path)}>
                      <Copy size={14} /> Copy
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 gap-1.5 text-[10px] font-bold uppercase text-primary border-primary/20"
                      asChild
                    >
                      <a href={qrUrl} download={`qr_${link.type}.png`}>
                        <Download size={14} /> QR Image
                      </a>
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-8 gap-1.5 text-[10px] font-bold uppercase"
                      onClick={() => handlePrintFlyer(link.label, fullUrl, link.bengaliLabel)}
                    >
                      <Printer size={14} /> Print Flyer
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Rules & Regulations Editor Section */}
      <Card className="border-none shadow-sm overflow-hidden print:hidden">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <ScrollText size={20} />
            <CardTitle>Rules & Regulations Setup</CardTitle>
          </div>
          <CardDescription>Edit hostel rules like a document.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="edit" className="gap-2"><Edit3 size={14} /> Document Editor</TabsTrigger>
              <TabsTrigger value="preview" className="gap-2"><Eye size={14} /> Preview</TabsTrigger>
            </TabsList>
            
            <TabsContent value="edit" className="space-y-0">
              <div className="flex flex-wrap gap-1 p-2 bg-secondary/30 rounded-t-lg border-x border-t sticky top-0 z-10 backdrop-blur-sm">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Bold" onClick={() => execCommand('bold')}><Bold size={14} /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Heading 1" onClick={() => execCommand('formatBlock', 'H1')}><Heading1 size={14} /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Heading 2" onClick={() => execCommand('formatBlock', 'H2')}><Heading2 size={14} /></Button>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="List" onClick={() => execCommand('insertUnorderedList')}><List size={14} /></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Palette size={14} /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => execCommand('foreColor', '#000000')}>Black</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => execCommand('foreColor', '#296EB3')}>Blue</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => execCommand('foreColor', '#F06A6A')}>Red</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => execCommand('removeFormat')}><Eraser size={14} /></Button>
              </div>
              <div ref={editorRef} contentEditable onInput={(e) => setRules(e.currentTarget.innerHTML)} className="rich-text min-h-[400px] p-6 border rounded-b-lg focus:outline-none bg-white shadow-inner overflow-y-auto" dangerouslySetInnerHTML={{ __html: rules }} />
            </TabsContent>

            <TabsContent value="preview" className="border rounded-lg p-8 bg-slate-50 min-h-[400px]">
              <div className="bg-white p-8 rounded-2xl shadow-sm border max-w-2xl mx-auto">
                <div className="rich-text text-sm max-w-none text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: rules || "<i>No rules written yet.</i>" }} />
              </div>
            </TabsContent>
          </Tabs>
          <Button onClick={handleSaveRules} disabled={isUpdating} className="w-full gap-2 h-14 text-lg font-bold shadow-lg mt-4">
            {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={20} />} Save & Publish Rules
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
          <CardDescription>Set your initial funds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><Label><Banknote size={14} /> Cash</Label><Input type="number" value={balances.cash} onChange={e => setBalances({...balances, cash: e.target.value})} /></div>
            <div className="space-y-2"><Label><Landmark size={14} /> Bank</Label><Input type="number" value={balances.bank} onChange={e => setBalances({...balances, bank: e.target.value})} /></div>
            <div className="space-y-2"><Label><Smartphone size={14} className="text-primary" /> Bkash</Label><Input type="number" value={balances.bkash} onChange={e => setBalances({...balances, bkash: e.target.value})} /></div>
            <div className="space-y-2"><Label><Smartphone size={14} className="text-orange-500" /> Nagad</Label><Input type="number" value={balances.nagad} onChange={e => setBalances({...balances, nagad: e.target.value})} /></div>
          </div>
          <Button onClick={handleSaveBalances} disabled={isUpdating} className="w-full gap-2 mt-4">
            {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18} />} Save Initial Balances
          </Button>
        </CardContent>
      </Card>

      {/* PRINT FLYER AREA (A4 Design) */}
      {activeFlyer && (
        <div className="print-only print-report-container flex flex-col items-center justify-center h-[297mm] w-[210mm] border-[10mm] border-primary">
          <div className="text-center space-y-6 p-12 flex flex-col items-center">
            <h1 className="text-6xl font-black text-primary uppercase tracking-tighter mb-4">সমীকরণ ছাত্রাবাস</h1>
            <div className="bg-primary text-white px-12 py-4 rounded-full text-3xl font-black uppercase tracking-widest shadow-xl">
              অনলাইন ভর্তি ফর্ম
            </div>
            
            <div className="pt-12 flex flex-col items-center space-y-8">
              <div className="p-8 border-[3px] border-dashed border-primary rounded-[3rem] bg-white shadow-inner">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encodeURIComponent(activeFlyer.url)}`}
                  alt="Registration QR Code"
                  className="w-[120mm] h-[120mm]"
                />
              </div>
              
              <div className="space-y-4">
                <h2 className="text-4xl font-black text-slate-800">{activeFlyer.bengaliLabel}</h2>
                <p className="text-2xl font-bold text-slate-500 uppercase tracking-widest">
                  Scan to enroll now
                </p>
              </div>
            </div>

            <div className="pt-20 text-center space-y-4">
              <p className="text-xl font-bold text-primary flex items-center justify-center gap-3">
                <MapPin size={24} /> {userBranch} Branch
              </p>
              <div className="h-1 w-48 bg-primary/20 mx-auto rounded-full" />
              <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                Powered by Somikoron Digital System
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
