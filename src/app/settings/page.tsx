
"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { 
  Utensils, Save, Loader2, Wallet, Banknote, Smartphone, Landmark, 
  Link as LinkIcon, Copy, ExternalLink, ScrollText,
  Bold, Heading1, Heading2, List, Palette, Eye, Edit3, Type, Eraser, Highlighter, ListOrdered, History, TrendingUp, Search
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { doc, setDoc, serverTimestamp, collection, query, where, orderBy, limit } from "firebase/firestore"
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
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function SettingsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [rate, setRate] = useState("")
  const [rules, setRules] = useState("")
  const [userBranch, setUserBranch] = useState("Main Branch")
  const [userName, setUserName] = useState("")
  const [isFoodHistoryOpen, setIsFoodHistoryOpen] = useState(false)
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
      collection(db, "foodCostBreakdown"), 
      where("branch", "==", userBranch),
      orderBy("date", "desc"),
      limit(100)
    )
  }, [db, userBranch])
  const { data: foodHistory, isLoading: isFoodHistoryLoading } = useCollection(foodHistoryQuery)

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

  const regLinks = [
    { label: "New Student Registration", type: "new", icon: LinkIcon },
    { label: "Existing Resident (Data Import)", type: "old", icon: LinkIcon }
  ]

  if (isConfigLoading || isBalancesLoading || isRulesLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
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

      {/* Meal Configuration Section */}
      <Card className="border-none shadow-sm overflow-hidden">
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
              <Button variant="outline" size="sm" className="gap-2 h-9 rounded-lg">
                <History size={14} /> <span className="hidden sm:inline">Daily Food History</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><TrendingUp className="text-primary"/> Daily Food Cost History</DialogTitle>
                <DialogDescription>Track daily spending and meal counts for {userBranch}.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Total Meals</TableHead>
                        <TableHead>Cost (৳)</TableHead>
                        <TableHead className="text-right">Per Meal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {foodHistory?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                          <TableCell>
                            {item.totalMeals > 0 ? (
                              <Badge variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100 border-none">{item.totalMeals} Meals</Badge>
                            ) : <span className="text-muted-foreground italic text-xs">Not set</span>}
                          </TableCell>
                          <TableCell className="font-bold text-destructive">৳{item.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {item.totalMeals > 0 ? `৳${(item.amount / item.totalMeals).toFixed(2)}` : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!foodHistory || foodHistory.length === 0) && (
                        <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">No food cost records found.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
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
      <Card className="border-none shadow-sm border-l-4 border-l-primary bg-primary/5">
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
      <Card className="border-none shadow-sm overflow-hidden">
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
