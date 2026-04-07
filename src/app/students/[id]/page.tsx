
"use client"

import * as React from "react"
import { useState, useMemo, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, serverTimestamp, updateDoc, setDoc, getDoc, arrayUnion, increment, collection, deleteDoc, query, where } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  UserCircle, Phone, Building2, 
  Loader2, Calculator,
  Plus, UserMinus, Wallet,
  AlertCircle, History, Edit, Trash2,
  Calendar, ChevronLeft,
  Info, ShieldCheck, HandCoins,
  MapPin, GraduationCap, Briefcase,
  Users, Home, Receipt, CircleDollarSign,
  Printer, FileText, Send, MoreVertical,
  Utensils, LayoutGrid, CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight,
  ExternalLink, UserCheck
} from "lucide-react"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { sendSMS } from "@/app/actions/sms"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function StudentDetailsPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  
  // UI Control States
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [showFullDetails, setShowFullDetails] = useState(false)
  
  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  // Firebase Data Hooks
  const studentRef = useMemoFirebase(() => id ? doc(db, "students", id) : null, [db, id])
  const { data: student, isLoading: studentLoading } = useDoc(studentRef)

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: apiConfig } = useDoc(apiConfigRef)

  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)

  // Forms State
  const [paymentData, setPaymentData] = useState({
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    amount: "",
    seatAmount: "",
    foodAmount: "",
    addAdvanceAmount: "0",
    method: "cash",
    receiver: "",
    description: ""
  })

  const [editForm, setEditForm] = useState<any>(null)

  // Initialize Edit Form
  useEffect(() => {
    if (student) {
      setEditForm({ ...student })
    }
  }, [student])

  // Advanced Financial Logic
  const stats = useMemo(() => {
    if (!student) return null
    
    const billingStart = student.billingStartDate ? new Date(student.billingStartDate) : (student.createdAt?.toDate?.() || new Date())
    const now = new Date()
    const endDate = student.isActive ? now : (student.leftAt?.toDate?.() || now)
    
    // 1. Rent Calculation
    const monthsElapsed = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth())
    const totalMonths = Math.max(0, monthsElapsed + 1)
    const generatedRent = totalMonths * (student.monthlyRent || 0)
    
    const totalRentPaid = (student.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.seatAmount || 0), 0) || 0)
    const historicalRentDue = student.duesBreakdown ? Object.values(student.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
    const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

    // 2. Food Calculation
    const historicalFoodDue = Number(student.foodDueAmount) || 0
    const generatedFoodCost = student.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
    const totalFoodPaid = (student.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.foodAmount || 0), 0) || 0)
    const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)

    // 3. Collection Summary
    const totalReceivedNew = (student.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0) || 0)
    const totalReceived = (student.historicalTotalReceived || 0) + totalReceivedNew

    // 4. Monthly Breakdown for display
    const dueBreakdownList = []
    for (let i = 0; i < totalMonths; i++) {
      const d = new Date(billingStart.getFullYear(), billingStart.getMonth() + i, 1)
      const monthLabel = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
      dueBreakdownList.push({ month: monthLabel, amount: student.monthlyRent, status: 'Generated' })
    }

    return { 
      rentDue, 
      foodBalance, 
      totalDue: rentDue + Math.max(0, -foodBalance),
      totalReceived,
      advanceRemaining: student.advanceAmount || 0,
      currentMonthDue: (now.getMonth() === billingStart.getMonth() && now.getFullYear() === billingStart.getFullYear()) ? student.monthlyRent : 0,
      dueBreakdownList: dueBreakdownList.reverse()
    }
  }, [student])

  // Handlers
  const handlePaymentSubmit = async () => {
    if (!student || !studentRef) return
    setIsUpdating(true)
    try {
      const seatPaid = student.paymentSystem === 'package' ? Number(paymentData.amount) : Number(paymentData.seatAmount)
      const foodPaid = student.paymentSystem === 'non-package' ? Number(paymentData.foodAmount) : 0
      const totalAmt = seatPaid + foodPaid + Number(paymentData.addAdvanceAmount)
      
      const pId = doc(collection(db, "payments")).id
      const pRecord = { 
        id: pId, amount: totalAmt, seatAmount: seatPaid, foodAmount: foodPaid, advanceAmount: Number(paymentData.addAdvanceAmount),
        studentId: student.id, studentName: student.name, buildingId: student.buildingId,
        buildingName: student.buildingName, roomNumber: student.roomNumber, branch: student.branch, 
        method: paymentData.method, receiver: paymentData.receiver, month: paymentData.month,
        year: paymentData.year, description: paymentData.description, date: new Date().toISOString()
      }
      
      await setDoc(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp(), createdAt: serverTimestamp() })
      await updateDoc(studentRef, { 
        paymentsHistory: arrayUnion(pRecord), 
        advanceAmount: increment(Number(paymentData.addAdvanceAmount)), 
        updatedAt: serverTimestamp() 
      })
      
      // SMS Logic with Mapping
      if (apiConfig?.apikey && templatesData?.templates) {
        const paymentTemplate = templatesData.templates.find((t: any) => t.id === 'payment')
        if (paymentTemplate) {
          const hostelDisplayName = templatesData.hostelName || student.branch;
          const remainingDue = (stats?.totalDue || 0) - totalAmt;
          let msg = paymentTemplate.text
            .replaceAll('[নাম]', student.name)
            .replaceAll('[পরিমাণ]', totalAmt.toString())
            .replaceAll('[total_payable]', Math.max(0, remainingDue).toString())
            .replaceAll('[Hostel Name]', hostelDisplayName);
            
          const result = await sendSMS(apiConfig.apikey, apiConfig.senderid, student.phone, msg)
          if (result.error === 0) toast({ title: "Receipt SMS Sent" })
        }
      }
      
      setIsPaymentDialogOpen(false)
      router.push(`/receipts/${pId}`)
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  const handleUpdateProfile = async () => {
    if (!studentRef || !editForm) return
    setIsUpdating(true)
    try {
      // Find new building name if ID changed
      const newBuilding = buildings?.find(b => b.id === editForm.buildingId)
      await updateDoc(studentRef, { 
        ...editForm, 
        buildingName: newBuilding?.name || student.buildingName,
        updatedAt: serverTimestamp() 
      })
      setIsEditDialogOpen(false)
      toast({ title: "Profile Updated" })
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  const handleConfirmExit = async () => {
    if (!studentRef) return
    setIsUpdating(true)
    try {
      await updateDoc(studentRef, { isActive: false, leftAt: serverTimestamp(), updatedAt: serverTimestamp() })
      toast({ title: "Resident Released", description: "Settlement complete." })
      setIsExitDialogOpen(false)
      router.push("/students")
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  if (studentLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
  if (!student) return <div className="text-center p-20 italic text-muted-foreground">Resident record not found.</div>

  const settlementAmount = (stats?.rentDue || 0) + Math.max(0, -(stats?.foodBalance || 0)) - (stats?.advanceRemaining || 0)

  return (
    <div className="space-y-8 pb-24 relative max-w-7xl mx-auto">
      {/* SECTION 1: MASTER HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-start gap-5">
          <Button variant="ghost" size="icon" onClick={() => router.push("/students")} className="rounded-full h-10 w-10 bg-slate-50 shrink-0">
            <ChevronLeft size={20} />
          </Button>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="h-24 w-24 rounded-3xl bg-primary/10 flex items-center justify-center text-primary shadow-inner shrink-0">
              <UserCircle size={64} strokeWidth={1.5} />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">{student.name}</h1>
                <Badge className={cn("rounded-full px-3", student.isActive ? "bg-success hover:bg-success" : "bg-destructive")}>
                  {student.isActive ? "Active" : "Ex-Resident"}
                </Badge>
                <Badge variant="outline" className="rounded-full border-primary/20 text-primary font-bold uppercase text-[9px]">
                  {student.paymentSystem} Plan
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm font-medium">
                <div className="flex items-center gap-2 text-slate-600"><Phone size={14} className="text-primary"/> {student.phone}</div>
                <div className="flex items-center gap-2 text-slate-600"><Users size={14} className="text-primary"/> Parent: {student.parentPhone}</div>
                <div className="flex items-center gap-2 text-slate-600"><Building2 size={14} className="text-primary"/> {student.buildingName} • R-{student.roomNumber} • S-{student.seatNumber}</div>
                <div className="flex items-center gap-2 text-slate-600"><MapPin size={14} className="text-primary"/> {student.branch} Branch</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl font-bold h-11 px-4 gap-2 flex-1 md:flex-none">
                <MoreVertical size={18} /> Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-xl border-slate-100">
              <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)} className="gap-2 font-bold cursor-pointer p-3 rounded-lg"><Edit size={16} className="text-primary"/> Edit Profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()} className="gap-2 font-bold cursor-pointer p-3 rounded-lg"><Printer size={16} className="text-primary"/> Print Profile</DropdownMenuItem>
              <DropdownMenuItem className="gap-2 font-bold cursor-pointer p-3 rounded-lg"><FileText size={16} className="text-primary"/> Payment PDF</DropdownMenuItem>
              <Separator className="my-2" />
              {student.isActive && (
                <DropdownMenuItem onClick={() => setIsExitDialogOpen(true)} className="gap-2 font-bold text-destructive cursor-pointer p-3 rounded-lg"><UserMinus size={16}/> Process Exit</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="rounded-xl h-11 px-6 font-bold gap-2 flex-1 md:flex-none shadow-lg shadow-primary/20" onClick={() => setIsPaymentDialogOpen(true)}>
            <Plus size={18} /> New Payment
          </Button>
        </div>
      </div>

      {/* SECTION 2: FINANCIAL SNAPSHOT */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {[
          { label: "Monthly Rent", val: student.monthlyRent, color: "slate-800", icon: Home },
          { label: "Advance", val: student.advanceAmount, color: "primary", icon: ShieldCheck },
          { label: "Service Chrg", val: student.serviceCharge, color: "orange-600", icon: Zap },
          { label: "Total Recv.", val: stats?.totalReceived, color: "indigo-600", icon: HandCoins },
          { label: "Total Due", val: stats?.totalDue, color: "destructive", icon: AlertCircle },
          { label: "Food Bal.", val: stats?.foodBalance, color: stats?.foodBalance >= 0 ? "success" : "orange-600", icon: Utensils },
          { label: "Curr. Month", val: stats?.currentMonthDue, color: "slate-500", icon: Calendar },
          { label: "History Recv.", val: student.historicalTotalReceived, color: "slate-400", icon: Clock },
        ].map((item, i) => (
          <Card key={i} className="border-none shadow-sm bg-white overflow-hidden group hover:scale-105 transition-transform duration-200">
            <CardContent className="p-4 flex flex-col justify-center items-center text-center space-y-1">
              <item.icon size={14} className={cn(`text-${item.color}`, "opacity-40 mb-1")} />
              <p className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">{item.label}</p>
              <p className={cn("text-xs font-black", `text-${item.color}`)}>৳{Number(item.val || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SECTION 3 & 4: TABLES & HISTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Tables */}
        <div className="lg:col-span-2 space-y-8">
          <Tabs defaultValue="payments" className="w-full">
            <TabsList className="bg-secondary/50 p-1 mb-4 rounded-2xl w-full flex overflow-x-auto h-auto">
              <TabsTrigger value="payments" className="flex-1 rounded-xl gap-2 h-10"><Wallet size={14}/> Payment History</TabsTrigger>
              <TabsTrigger value="dues" className="flex-1 rounded-xl gap-2 h-10"><History size={14}/> Due Breakdown</TabsTrigger>
              {student.paymentSystem === 'non-package' && (
                <TabsTrigger value="meals" className="flex-1 rounded-xl gap-2 h-10"><Utensils size={14}/> Meal Log</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="payments">
              <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden min-h-[400px]">
                <CardContent className="p-0">
                  {/* Desktop Table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Month</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Breakdown</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead className="text-right">Receiver</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {student.paymentsHistory?.slice().reverse().map((p: any, idx: number) => (
                          <TableRow key={idx} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/receipts/${p.id}`)}>
                            <TableCell className="text-[10px] font-bold text-slate-500">{new Date(p.date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-xs font-black text-slate-700">{p.month} {p.year}</TableCell>
                            <TableCell className="font-black text-success text-sm">৳{p.amount.toLocaleString()}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5 text-[9px] font-bold text-muted-foreground uppercase">
                                {p.seatAmount > 0 && <span>Rent: ৳{p.seatAmount}</span>}
                                {p.foodAmount > 0 && <span>Food: ৳{p.foodAmount}</span>}
                                {p.advanceAmount > 0 && <span className="text-primary">Adv: ৳{p.advanceAmount}</span>}
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-[8px] uppercase font-bold">{p.method}</Badge></TableCell>
                            <TableCell className="text-right text-[10px] font-bold text-slate-600">{p.receiver}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-4 p-4">
                    {student.paymentsHistory?.slice().reverse().map((p: any, idx: number) => (
                      <div key={idx} className="p-4 border rounded-2xl space-y-3 bg-slate-50/50" onClick={() => router.push(`/receipts/${p.id}`)}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(p.date).toLocaleDateString()}</p>
                            <p className="text-sm font-black text-slate-800">{p.month} {p.year}</p>
                          </div>
                          <p className="text-lg font-black text-success">৳{p.amount.toLocaleString()}</p>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                          <span className="flex items-center gap-1"><Wallet size={10}/> {p.method}</span>
                          <span className="flex items-center gap-1"><UserCircle size={10}/> {p.receiver}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {(!student.paymentsHistory || student.paymentsHistory.length === 0) && (
                    <div className="text-center py-20 text-muted-foreground italic">No payment records.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dues">
              <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden min-h-[400px]">
                <CardContent className="p-0">
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead>Billing Month</TableHead>
                          <TableHead>Due Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats?.dueBreakdownList.map((d, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-bold">{d.month}</TableCell>
                            <TableCell className="font-black text-destructive">৳{d.amount.toLocaleString()}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px] text-destructive border-destructive">Pending</Badge></TableCell>
                            <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setIsPaymentDialogOpen(true)}>Pay Now</Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="md:hidden p-4 space-y-4">
                    {stats?.dueBreakdownList.map((d, i) => (
                      <div key={i} className="p-4 border rounded-2xl flex justify-between items-center bg-destructive/5">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-700">{d.month}</p>
                          <p className="text-lg font-black text-destructive">৳{d.amount.toLocaleString()}</p>
                        </div>
                        <Badge variant="destructive" className="text-[10px]">Unpaid</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meals">
              <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden min-h-[400px]">
                <CardContent className="p-0">
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead>Billing Month</TableHead>
                          <TableHead className="text-center">Total Meals</TableHead>
                          <TableHead className="text-center">Rate</TableHead>
                          <TableHead className="text-right">Total Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {student.mealsHistory?.slice().reverse().map((m: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-bold text-slate-700">{m.month}</TableCell>
                            <TableCell className="text-center font-black text-orange-600">{m.totalMeals} Meals</TableCell>
                            <TableCell className="text-center text-[10px] font-bold">৳{m.perMealCost}</TableCell>
                            <TableCell className="text-right font-black">৳{m.totalCost.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="md:hidden p-4 space-y-4">
                    {student.mealsHistory?.slice().reverse().map((m: any, idx: number) => (
                      <div key={idx} className="p-4 border rounded-2xl space-y-2 bg-orange-50/30">
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-slate-700">{m.month}</p>
                          <p className="text-lg font-black text-orange-600">৳{m.totalCost.toLocaleString()}</p>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                          <span>Meals: {m.totalMeals}</span>
                          <span>Rate: ৳{m.perMealCost}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Actions & Details */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-primary">
                <ShieldCheck size={16}/> Identity & Origins
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="personal" className="border-none">
                  <AccordionTrigger className="hover:no-underline bg-slate-50 p-4 rounded-2xl font-bold text-sm">
                    <div className="flex items-center gap-2"><LayoutGrid size={16}/> Full Dossier</div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4 px-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Father's Name</Label>
                        <p className="text-xs font-bold text-slate-700">{student.fatherName}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Mother's Name</Label>
                        <p className="text-xs font-bold text-slate-700">{student.motherName}</p>
                      </div>
                    </div>
                    <Separator className="border-dashed" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">DOB</Label>
                        <p className="text-xs font-bold text-slate-700">{student.dob}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Blood Group</Label>
                        <p className="text-xs font-bold text-destructive">{student.bloodGroup}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Address</Label>
                      <p className="text-xs font-bold text-slate-700 leading-relaxed">{student.address}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="education" className="border-none mt-4">
                  <AccordionTrigger className="hover:no-underline bg-slate-50 p-4 rounded-2xl font-bold text-sm">
                    <div className="flex items-center gap-2"><GraduationCap size={16}/> Education & Work</div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4 px-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Institution / Company</Label>
                      <p className="text-xs font-bold text-slate-700">{student.collegeUniversity}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Dept / Designation</Label>
                      <p className="text-xs font-bold text-slate-700">{student.department}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="pt-4 space-y-3">
                <Button variant="outline" className="w-full rounded-xl gap-2 font-bold text-xs h-11" onClick={() => setIsEditDialogOpen(true)}>
                  <Edit size={14}/> Update Profile Details
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="w-full rounded-xl gap-2 font-bold text-destructive hover:text-destructive hover:bg-destructive/5 text-xs h-11">
                      <Trash2 size={14}/> Permanently Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Resident Record?</AlertDialogTitle>
                      <AlertDialogDescription>This will erase all payment and meal history. This action is irreversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={async () => { await deleteDoc(studentRef!); router.push("/students"); }} className="bg-destructive hover:bg-destructive/90">Confirm Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-primary rounded-3xl text-white overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest opacity-70">Resident Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={32} className="opacity-50" />
                  <div>
                    <p className="text-lg font-black leading-none">Staying</p>
                    <p className="text-[10px] opacity-70 mt-1 uppercase font-bold">Billing Start: {new Date(student.billingStartDate).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-black opacity-70">Plan</p>
                  <p className="text-sm font-black capitalize">{student.paymentSystem}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DIALOGS */}

      {/* 1. Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Record Payment</DialogTitle>
            <DialogDescription>Add a new income entry for {student.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase ml-1">Period</Label>
                <Select value={paymentData.month} onValueChange={v => setPaymentData({...paymentData, month: v})}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue/></SelectTrigger>
                  <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase ml-1">Year</Label>
                <Select value={paymentData.year} onValueChange={v => setPaymentData({...paymentData, year: v})}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue/></SelectTrigger>
                  <SelectContent>{"2024,2025,2026".split(',').map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-5 bg-primary/5 rounded-3xl border-2 border-primary/10 space-y-4">
              <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Calculator size={14}/> Collections</h3>
              {student.paymentSystem === 'package' ? (
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Package Amount (৳)</Label>
                  <Input type="number" className="rounded-xl h-11 bg-white font-black text-lg" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} placeholder="0.00" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Seat Rent (৳)</Label>
                    <Input type="number" className="rounded-xl h-11 bg-white" value={paymentData.seatAmount} onChange={e => setPaymentData({...paymentData, seatAmount: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Food Deposit (৳)</Label>
                    <Input type="number" className="rounded-xl h-11 bg-white" value={paymentData.foodAmount} onChange={e => setPaymentData({...paymentData, foodAmount: e.target.value})} />
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs font-bold text-primary">Add to Security Pool (৳)</Label>
                <Input type="number" className="rounded-xl h-11 bg-white border-primary/30" value={paymentData.addAdvanceAmount} onChange={e => setPaymentData({...paymentData, addAdvanceAmount: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase ml-1">Method</Label>
                <Select value={paymentData.method} onValueChange={v => setPaymentData({...paymentData, method: v})}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bkash">Bkash</SelectItem>
                    <SelectItem value="nagad">Nagad</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase ml-1">Receiver</Label>
                <Select value={paymentData.receiver} onValueChange={v => setPaymentData({...paymentData, receiver: v})}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Verified By"/></SelectTrigger>
                  <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Textarea className="rounded-2xl resize-none bg-slate-50 border-none shadow-inner" placeholder="Payment notes/details..." value={paymentData.description} onChange={e => setPaymentData({...paymentData, description: e.target.value})} />
          </div>
          <DialogFooter>
            <Button onClick={handlePaymentSubmit} disabled={isUpdating} className="w-full h-14 text-lg font-black rounded-2xl shadow-xl shadow-primary/20">
              {isUpdating ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />} 
              Confirm & Issue Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Exit Settlement Dialog */}
      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-destructive">Exit Settlement</DialogTitle>
            <DialogDescription>Process final account closure for {student.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border-2 border-slate-100 shadow-inner">
              <div className="flex justify-between text-sm font-medium text-slate-600"><span>Rent Pending:</span> <span className="font-black text-slate-800">৳{stats?.rentDue.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm font-medium text-slate-600"><span>Food Due:</span> <span className="font-black text-slate-800">৳{Math.max(0, -(stats?.foodBalance || 0)).toLocaleString()}</span></div>
              <div className="flex justify-between text-sm font-medium text-primary"><span>Security Advance:</span> <span className="font-black">- ৳{stats?.advanceRemaining.toLocaleString()}</span></div>
              <Separator />
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-black uppercase text-muted-foreground">Net Settlement:</span>
                <span className={cn("text-3xl font-black", settlementAmount >= 0 ? "text-destructive" : "text-success")}>
                  ৳{Math.abs(settlementAmount).toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] text-center font-bold text-muted-foreground uppercase tracking-widest mt-2">
                {settlementAmount >= 0 ? "STUDENT MUST PAY HOSTEL" : "HOSTEL MUST REFUND STUDENT"}
              </p>
            </div>

            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex gap-3">
              <Info size={20} className="text-primary shrink-0" />
              <p className="text-[10px] text-slate-600 leading-relaxed italic">
                Confirming exit will release the seat <b>(S-{student.seatNumber})</b> and archive this resident. Advance will be adjusted against the final dues.
              </p>
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="rounded-2xl h-12" onClick={() => setIsExitDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmExit} disabled={isUpdating} className="bg-destructive hover:bg-destructive/90 h-12 text-lg font-black rounded-2xl text-white">
              {isUpdating ? <Loader2 className="animate-spin" /> : <UserMinus className="mr-2" />} Confirm Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Edit Resident Profile</DialogTitle>
            <DialogDescription>Modify personal information or re-allocate location.</DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Full Name</Label><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                <div className="space-y-1.5"><Label>Phone Number</Label><Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Parent Phone</Label><Input value={editForm.parentPhone} onChange={e => setEditForm({...editForm, parentPhone: e.target.value})} /></div>
                <div className="space-y-1.5"><Label>Billing Start Date</Label><Input type="date" value={editForm.billingStartDate} onChange={e => setEditForm({...editForm, billingStartDate: e.target.value})} /></div>
              </div>
              <Separator />
              <div className="p-5 border-2 border-primary/10 rounded-3xl bg-primary/5 space-y-4">
                <h3 className="text-[10px] font-black uppercase text-primary tracking-widest">Financial & Plan Setup</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5"><Label>Monthly Rent (৳)</Label><Input type="number" value={editForm.monthlyRent} onChange={e => setEditForm({...editForm, monthlyRent: Number(e.target.value)})} /></div>
                  <div className="space-y-1.5"><Label>Plan</Label><Select value={editForm.paymentSystem} onValueChange={v => setEditForm({...editForm, paymentSystem: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="package">Package</SelectItem><SelectItem value="non-package">Non-Package</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1.5"><Label>Advance (৳)</Label><Input type="number" value={editForm.advanceAmount} onChange={e => setEditForm({...editForm, advanceAmount: Number(e.target.value)})} /></div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Building</Label>
                  <Select value={editForm.buildingId} onValueChange={v => setEditForm({...editForm, buildingId: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Room Number</Label><Input value={editForm.roomNumber} onChange={e => setEditForm({...editForm, roomNumber: e.target.value})} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleUpdateProfile} disabled={isUpdating} className="w-full h-12 text-lg font-black rounded-2xl shadow-lg">
              {isUpdating ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="mr-2" />} Save All Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
