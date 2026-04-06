
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
  BedDouble, CreditCard, Utensils,
  Loader2, Calculator,
  Plus, UserMinus, Wallet,
  AlertCircle, CheckCircle,
  History, MoreVertical, Edit, Trash2,
  Calendar,
  Clock,
  UtensilsCrossed,
  ChevronLeft,
  ArrowDownRight,
  ArrowUpRight,
  Info,
  Banknote,
  Smartphone,
  Landmark,
  ShieldCheck,
  CheckCircle2,
  HandCoins,
  MapPin,
  GraduationCap,
  Briefcase,
  Users,
  Home,
  Receipt,
  CircleDollarSign
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
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { sendSMS } from "@/app/actions/sms"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function StudentDetailsPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  
  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

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

  const studentRef = useMemoFirebase(() => id ? doc(db, "students", id) : null, [db, id])
  const { data: student, isLoading: studentLoading } = useDoc(studentRef)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: apiConfig } = useDoc(apiConfigRef)

  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)

  const logSMSToDatabase = async (to: string, msg: string, status: 'Success' | 'Failed', errorMsg?: string) => {
    try {
      const logId = doc(collection(db, "smsLogs")).id
      await setDoc(doc(db, "smsLogs", logId), {
        id: logId,
        to,
        message: msg,
        status,
        error: errorMsg || null,
        branch: student?.branch,
        sentBy: userName,
        createdAt: serverTimestamp()
      })
    } catch (e) {}
  }

  const financialStats = useMemo(() => {
    if (!student) return { rentDue: 0, foodBalance: 0, totalDue: 0, paidRent: 0, paidFood: 0, lifetimeCollected: 0 }
    
    const billingStart = student.billingStartDate ? new Date(student.billingStartDate) : (student.createdAt?.toDate?.() || new Date())
    const now = new Date()
    const endDate = student.isActive ? now : (student.leftAt?.toDate?.() || now)
    
    const totalMonths = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth()) + 1
    const generatedRent = totalMonths * (student.monthlyRent || 0)
    
    const totalRentPaid = (student.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.seatAmount || (student.paymentSystem === 'package' ? curr.amount : 0)), 0) || 0)
    const historicalRentDue = student.duesBreakdown ? Object.values(student.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
    const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

    const historicalFoodDue = Number(student.foodDueAmount) || 0
    const generatedFoodCost = student.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
    const totalFoodPaid = (student.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.foodAmount || (student.paymentSystem === 'non-package' ? curr.amount : 0)), 0) || 0)
    const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)

    const historicalTotalReceived = Number(student.historicalTotalReceived || 0)
    const newPaymentsTotal = student.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0) || 0
    const lifetimeCollected = historicalTotalReceived + newPaymentsTotal

    return { 
      rentDue, 
      foodBalance, 
      totalDue: rentDue + Math.max(0, -foodBalance),
      paidRent: totalRentPaid,
      paidFood: totalFoodPaid,
      lifetimeCollected
    }
  }, [student])

  const handlePaymentSubmit = async () => {
    if (!student || !studentRef) return
    setIsUpdating(true)
    try {
      const seatPaid = student.paymentSystem === 'package' ? Number(paymentData.amount) : Number(paymentData.seatAmount)
      const foodPaid = student.paymentSystem === 'non-package' ? Number(paymentData.foodAmount) : 0
      const totalAmt = seatPaid + foodPaid + Number(paymentData.addAdvanceAmount)
      
      const pId = doc(collection(db, "payments")).id
      const pRecord = { 
        id: pId, 
        amount: totalAmt, 
        seatAmount: seatPaid, 
        foodAmount: foodPaid, 
        advanceAmount: Number(paymentData.addAdvanceAmount),
        studentId: student.id, 
        studentName: student.name, 
        buildingId: student.buildingId,
        buildingName: student.buildingName,
        roomNumber: student.roomNumber,
        branch: student.branch, 
        method: paymentData.method, 
        receiver: paymentData.receiver, 
        month: paymentData.month,
        year: paymentData.year,
        description: paymentData.description,
        date: new Date().toISOString()
      }
      
      await setDoc(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp(), createdAt: serverTimestamp() })
      await updateDoc(studentRef, { 
        paymentsHistory: arrayUnion(pRecord), 
        advanceAmount: increment(Number(paymentData.addAdvanceAmount)), 
        updatedAt: serverTimestamp() 
      })
      
      // SMS Logic
      if (apiConfig?.apikey && templatesData?.templates) {
        const paymentTemplate = templatesData.templates.find((t: any) => t.id === 'payment')
        if (paymentTemplate) {
          const hostelDisplayName = templatesData.hostelName || student.branch;
          const remainingDue = financialStats.totalDue - totalAmt;
          let msg = paymentTemplate.text
            .replaceAll('[নাম]', student.name)
            .replaceAll('[পরিমাণ]', totalAmt.toString())
            .replaceAll('[total_payable]', Math.max(0, remainingDue).toString())
            .replaceAll('[Hostel Name]', hostelDisplayName);
            
          const result = await sendSMS(apiConfig.apikey, apiConfig.senderid, student.phone, msg)
          await logSMSToDatabase(student.phone, msg, result.error === 0 ? 'Success' : 'Failed', result.error !== 0 ? result.msg : undefined)
          
          if (result.error === 0) {
            toast({ title: "SMS Sent", description: `Msg: ${msg.substring(0, 40)}...` })
          }
        }
      }
      
      setIsPaymentDialogOpen(false)
      toast({ title: "Payment Recorded" })
      router.push(`/receipts/${pId}`)
    } catch (e: any) { 
      toast({ variant: "destructive", description: e.message }) 
    }
    finally { setIsUpdating(false) }
  }

  const handleConfirmExit = async () => {
    if (!student || !studentRef) return
    setIsUpdating(true)
    try {
      await updateDoc(studentRef, { 
        isActive: false, 
        leftAt: serverTimestamp(), 
        updatedAt: serverTimestamp() 
      })
      
      if (apiConfig?.apikey && templatesData?.templates) {
        const exitTemplate = templatesData.templates.find((t: any) => t.id === 'exit')
        if (exitTemplate) {
          const hostelDisplayName = templatesData.hostelName || student.branch;
          const msg = exitTemplate.text.replaceAll('[নাম]', student.name).replaceAll('[Hostel Name]', hostelDisplayName)
          const result = await sendSMS(apiConfig.apikey, apiConfig.senderid, student.phone, msg)
          await logSMSToDatabase(student.phone, msg, result.error === 0 ? 'Success' : 'Failed', result.error !== 0 ? result.msg : undefined)
        }
      }
      toast({ title: "Exit Confirmed" })
      setIsExitDialogOpen(false)
      router.push("/students")
    } catch (e: any) { 
      toast({ variant: "destructive", description: e.message }) 
    }
    finally { setIsUpdating(false) }
  }

  if (studentLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
  if (!student) return <div className="text-center p-20">Resident not found.</div>

  return (
    <div className="space-y-8 pb-24 relative max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-12 w-12 bg-secondary/50">
            <ChevronLeft size={24} />
          </Button>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <UserCircle size={40} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">{student.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn("rounded-full px-3", student.isActive ? "bg-success hover:bg-success text-white" : "bg-destructive text-white")}>
                  {student.isActive ? "Active Resident" : "Ex-Resident"}
                </Badge>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{student.branch} Branch</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-2xl h-11 px-6 font-bold" onClick={() => setIsEditDialogOpen(true)}>
            <Edit size={18} className="mr-2" /> Edit Profile
          </Button>
          {student.isActive && (
            <Button variant="destructive" className="rounded-2xl h-11 px-6 font-bold shadow-lg shadow-destructive/20" onClick={() => setIsExitDialogOpen(true)}>
              <UserMinus size={18} className="mr-2" /> Release Resident
            </Button>
          )}
        </div>
      </div>

      {/* Financial Dashboard - Standardized Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-none shadow-sm bg-white border-t-4 border-t-primary rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Security Advance</p>
            <p className="text-2xl font-black text-primary mt-1">৳{(student.advanceAmount || 0).toLocaleString()}</p>
            <div className="mt-2 flex items-center gap-1 text-[8px] text-muted-foreground font-bold">
              <ShieldCheck size={10}/> PROTECTED FUND
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-t-4 border-t-slate-800 rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Monthly Rent</p>
            <p className="text-2xl font-black text-slate-800 mt-1">৳{(student.monthlyRent || 0).toLocaleString()}</p>
            <div className="mt-2 flex items-center gap-1 text-[8px] text-muted-foreground font-bold uppercase">
              {student.paymentSystem} Plan
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-primary/5 border-t-4 border-t-indigo-500 rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-[9px] font-black uppercase text-indigo-600 tracking-widest">Total Collected</p>
            <p className="text-2xl font-black text-indigo-700 mt-1">৳{financialStats.lifetimeCollected.toLocaleString()}</p>
            <div className="mt-2 flex items-center gap-1 text-[8px] text-indigo-400 font-bold uppercase">
              LIFETIME REVENUE
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-t-4 border-t-destructive rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-[9px] font-black uppercase text-destructive tracking-widest">Remaining Due</p>
            <p className="text-2xl font-black text-destructive mt-1">৳{financialStats.rentDue.toLocaleString()}</p>
            <div className="mt-2 flex items-center gap-1 text-[8px] text-destructive/60 font-bold uppercase">
              PENDING RECEIVABLES
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-none shadow-sm bg-white border-t-4 rounded-2xl",
          financialStats.foodBalance >= 0 ? "border-t-success" : "border-t-orange-500"
        )}>
          <CardContent className="pt-6">
            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Food Wallet</p>
            <p className={cn(
              "text-2xl font-black mt-1",
              financialStats.foodBalance >= 0 ? "text-success" : "text-orange-600"
            )}>৳{Math.abs(financialStats.foodBalance).toLocaleString()}</p>
            <div className="mt-2 flex items-center gap-1 text-[8px] font-bold uppercase">
              {financialStats.foodBalance >= 0 ? <span className="text-success">Credit Balance</span> : <span className="text-orange-500">Loan/Due</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Resident Identity & Details */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                <Info size={16} className="text-primary"/> Personal Dossier
              </CardTitle>
              <Badge variant="secondary" className="h-5 text-[8px] uppercase">ID: {student.id.substring(0, 6)}</Badge>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary"><Phone size={20}/></div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Resident Contact</p>
                  <p className="font-bold text-slate-700">{student.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600"><Building2 size={20}/></div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Allocation</p>
                  <p className="font-bold text-slate-700">{student.buildingName} | R-{student.roomNumber} | S-{student.seatNumber}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-dashed space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground uppercase">Father</p>
                    <p className="text-xs font-bold">{student.fatherName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground uppercase">Mother</p>
                    <p className="text-xs font-bold">{student.motherName}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground uppercase">Joined Date</p>
                    <p className="text-xs font-bold">{new Date(student.billingStartDate).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground uppercase">Blood Group</p>
                    <p className="text-xs font-bold text-destructive">{student.bloodGroup}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-muted-foreground uppercase">Permanent Origin</p>
                  <p className="text-xs font-medium leading-relaxed">{student.address}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {student.historicalDuesNote && (
            <Card className="border-none shadow-sm bg-orange-50 border border-orange-100 rounded-3xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase text-orange-600 tracking-widest flex items-center gap-2">
                  <AlertCircle size={12}/> Historical Dues Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-orange-800 leading-relaxed font-medium whitespace-pre-wrap">{student.historicalDuesNote}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Financial & Activity Tables */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="payments" className="w-full">
            <TabsList className="bg-secondary/50 p-1 mb-4 rounded-2xl w-full flex">
              <TabsTrigger value="payments" className="flex-1 rounded-xl gap-2"><Wallet size={14}/> Transaction Ledger</TabsTrigger>
              <TabsTrigger value="meals" className="flex-1 rounded-xl gap-2"><Utensils size={14}/> Food Log</TabsTrigger>
              <TabsTrigger value="identity" className="flex-1 rounded-xl gap-2"><UserCircle size={14}/> Education/Work</TabsTrigger>
            </TabsList>

            <TabsContent value="payments">
              <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden min-h-[450px]">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {student.paymentsHistory?.slice().reverse().map((p: any, idx: number) => (
                        <TableRow key={idx} className="cursor-pointer group hover:bg-slate-50" onClick={() => router.push(`/receipts/${p.id}`)}>
                          <TableCell className="text-[10px] font-bold text-slate-500">
                            {new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </TableCell>
                          <TableCell className="text-xs font-black text-slate-700">{p.month} {p.year}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[8px] uppercase font-bold">{p.method}</Badge></TableCell>
                          <TableCell className="text-right font-black text-success">৳{p.amount.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {(!student.paymentsHistory || student.paymentsHistory.length === 0) && (
                        <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">No financial transactions recorded.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meals">
              <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden min-h-[450px]">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead>Billing Month</TableHead>
                        <TableHead className="text-center">Meal Count</TableHead>
                        <TableHead className="text-center">Rate</TableHead>
                        <TableHead className="text-right">Net Cost</TableHead>
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
                      {(!student.mealsHistory || student.mealsHistory.length === 0) && (
                        <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">No diet logs found.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="identity">
              <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden min-h-[450px]">
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2"><GraduationCap size={16}/> Professional/Educational Path</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 rounded-2xl border bg-slate-50/50">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Organization/Institution</p>
                        <p className="text-sm font-bold text-slate-800 mt-1">{student.collegeUniversity}</p>
                      </div>
                      <div className="p-4 rounded-2xl border bg-slate-50/50">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Dept / Designation</p>
                        <p className="text-sm font-bold text-slate-800 mt-1">{student.department}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2"><MapPin size={16}/> Emergency Backup</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 rounded-2xl border bg-secondary/20">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Parent Phone</p>
                        <p className="text-sm font-black text-slate-800 mt-1">{student.parentPhone}</p>
                      </div>
                      <div className="p-4 rounded-2xl border bg-secondary/20">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Guardian/Local Contact</p>
                        <p className="text-sm font-black text-slate-800 mt-1">{student.guardianPhone}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Floating Payment Action */}
      {student.isActive && (
        <div className="fixed bottom-8 right-8 z-50">
          <Button onClick={() => setIsPaymentDialogOpen(true)} size="icon" className="h-16 w-16 rounded-full shadow-2xl bg-primary text-white border-4 border-white animate-in zoom-in duration-300 hover:scale-110 transition-transform">
            <Plus size={32} />
          </Button>
        </div>
      )}

      {/* DIALOGS */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>New Payment Entry</DialogTitle><DialogDescription>Recording transaction for {student.name}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Month</Label><Select value={paymentData.month} onValueChange={v => setPaymentData({...paymentData, month: v})}><SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Year</Label><Select value={paymentData.year} onValueChange={v => setPaymentData({...paymentData, year: v})}><SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger><SelectContent>{"2024,2025,2026".split(',').map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="p-4 bg-primary/5 rounded-2xl border-2 border-primary/10 space-y-4">
              {student.paymentSystem === 'package' ? (
                <div className="space-y-1"><Label>Amount Received (৳)</Label><Input type="number" className="rounded-xl h-11" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} placeholder="0.00" /></div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>Seat Rent (৳)</Label><Input type="number" className="rounded-xl h-11" value={paymentData.seatAmount} onChange={e => setPaymentData({...paymentData, seatAmount: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Food Deposit (৳)</Label><Input type="number" className="rounded-xl h-11" value={paymentData.foodAmount} onChange={e => setPaymentData({...paymentData, foodAmount: e.target.value})} /></div>
                </div>
              )}
              <div className="space-y-1"><Label className="text-primary font-bold">Add to Advance Wallet (৳)</Label><Input type="number" className="rounded-xl h-11" value={paymentData.addAdvanceAmount} onChange={e => setPaymentData({...paymentData, addAdvanceAmount: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Method</Label><Select value={paymentData.method} onValueChange={v => setPaymentData({...paymentData, method: v})}><SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>Receiver</Label><Select value={paymentData.receiver} onValueChange={v => setPaymentData({...paymentData, receiver: v})}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Staff"/></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Textarea className="rounded-xl resize-none" placeholder="Payment description/note..." value={paymentData.description} onChange={e => setPaymentData({...paymentData, description: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={handlePaymentSubmit} disabled={isUpdating} className="w-full h-12 text-lg font-bold rounded-2xl">{isUpdating ? <Loader2 className="animate-spin" /> : "Confirm & Issue Receipt"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Resident Exit Settlement</DialogTitle><DialogDescription>Closing account for {student.name}</DialogDescription></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-6 bg-destructive/5 rounded-3xl border-2 border-destructive/10 text-center">
              <p className="text-xs font-bold text-destructive uppercase tracking-widest">Final Settlement Amount</p>
              <p className="text-4xl font-black text-slate-900 mt-2">৳{financialStats.totalDue.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-2 font-bold">RENT OUTSTANDING + FOOD DEBT</p>
            </div>
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <p className="text-xs text-slate-600 leading-relaxed italic text-center">
                Confirming exit will release the seat (S-{student.seatNumber}) and mark the resident as inactive. Ensure all dues are cleared before confirmation.
              </p>
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="rounded-2xl h-12" onClick={() => setIsExitDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmExit} disabled={isUpdating} className="bg-destructive hover:bg-destructive/90 h-12 text-lg font-bold rounded-2xl text-white">
              {isUpdating ? <Loader2 className="animate-spin" /> : "Confirm Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
