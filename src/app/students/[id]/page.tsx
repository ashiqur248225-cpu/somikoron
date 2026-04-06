
"use client"

import * as React from "react"
import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  Home
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

export default function StudentDetailsPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ action?: string }>
}) {
  const { id } = React.use(params)
  const resolvedSearchParams = React.use(searchParams)
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isLogMealDialogOpen, setIsLogMealDialogOpen] = useState(false)
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  
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

  const [mealLogData, setMealLogData] = useState({
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    count: ""
  })

  const [exitSettlement, setExitSettlement] = useState({
    refundAmount: "0",
    collectAmount: "0",
    method: "cash",
    staffName: "",
    description: ""
  })

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    parentPhone: "",
    guardianPhone: "",
    fatherName: "",
    motherName: "",
    address: "",
    village: "",
    postOffice: "",
    upazila: "",
    district: "",
    dob: "",
    bloodGroup: "",
    collegeUniversity: "",
    department: "",
    monthlyRent: "",
    paymentSystem: "package",
    billingStartDate: "",
    buildingId: "",
    roomNumber: "",
    seatNumber: "",
    apartmentName: ""
  })

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const studentRef = useMemoFirebase(() => id ? doc(db, "students", id) : null, [db, id])
  const { data: student, isLoading: studentLoading } = useDoc(studentRef)

  const buildingsQuery = useMemoFirebase(() => {
    if (!student?.branch) return null
    return query(collection(db, "buildings"), where("branch", "==", student.branch))
  }, [db, student?.branch])
  const { data: buildings } = useCollection(buildingsQuery)

  const mealRateRef = useMemoFirebase(() => doc(db, "configs", "mealRate"), [db])
  const { data: mealRateConfig } = useDoc(mealRateRef)
  const currentMealRate = mealRateConfig?.rate || 0

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
        branch: student?.branch || "Main Branch",
        sentBy: localStorage.getItem("user_name") || "Admin",
        createdAt: serverTimestamp()
      })
    } catch (e) {}
  }

  useEffect(() => {
    const action = resolvedSearchParams.action
    if (action === 'payment') setIsPaymentDialogOpen(true)
    if (action === 'meals') setIsLogMealDialogOpen(true)
  }, [resolvedSearchParams])

  useEffect(() => {
    if (student) {
      setEditForm({
        name: student.name || "",
        phone: student.phone || "",
        parentPhone: student.parentPhone || "",
        guardianPhone: student.guardianPhone || "",
        fatherName: student.fatherName || "",
        motherName: student.motherName || "",
        address: student.address || "",
        village: student.village || "",
        postOffice: student.postOffice || "",
        upazila: student.upazila || "",
        district: student.district || "",
        dob: student.dob || "",
        bloodGroup: student.bloodGroup || "",
        collegeUniversity: student.collegeUniversity || "",
        department: student.department || "",
        monthlyRent: (student.monthlyRent || 0).toString(),
        paymentSystem: student.paymentSystem || "package",
        billingStartDate: student.billingStartDate || "",
        buildingId: student.buildingId || "",
        roomNumber: student.roomNumber || "",
        seatNumber: student.seatNumber || "",
        apartmentName: student.apartmentName || ""
      })
    }
  }, [student])

  const financialStats = useMemo(() => {
    if (!student) return { rentDue: 0, foodBalance: 0, monthsList: [], usableAdvance: 0, totalDue: 0, totalLifetimeReceived: 0, totalSystemPayments: 0 }
    
    const billingStart = student.billingStartDate ? new Date(student.billingStartDate) : (student.createdAt?.toDate?.() || new Date())
    const now = new Date()
    const endDate = student.isActive ? now : (student.leftAt?.toDate?.() || now)
    
    const monthsList: any[] = []
    let tempDate = new Date(billingStart.getFullYear(), billingStart.getMonth(), 1)
    const endCompare = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

    while (tempDate <= endCompare) {
      const mKey = `${MONTHS[tempDate.getMonth()]} ${tempDate.getFullYear()}`
      monthsList.push({
        key: mKey,
        month: MONTHS[tempDate.getMonth()],
        year: tempDate.getFullYear().toString(),
        charge: student.monthlyRent || 0,
        paid: 0,
        status: 'Unpaid'
      })
      tempDate.setMonth(tempDate.getMonth() + 1)
    }

    const totalRentPaid = student.paymentsHistory?.reduce((acc: number, curr: any) => {
      const isRefund = curr.type === 'refund'
      const rentPortion = (curr.seatAmount !== undefined) ? Number(curr.seatAmount) : (student.paymentSystem === 'package' ? Number(curr.amount) : 0)
      return acc + (isRefund ? -rentPortion : rentPortion)
    }, 0) || 0

    const totalSystemPayments = student.paymentsHistory?.reduce((acc: number, curr: any) => {
      return acc + Number(curr.amount || 0)
    }, 0) || 0

    const histDuesMap = student.duesBreakdown || {}
    Object.entries(histDuesMap).forEach(([key, val]) => {
      if (!monthsList.find(m => m.key === key)) {
        monthsList.push({ key, month: key.split(' ')[0], year: key.split(' ')[1], charge: Number(val), paid: 0, status: 'Unpaid', isHistorical: true })
      } else {
        const idx = monthsList.findIndex(m => m.key === key)
        monthsList[idx].charge = Number(val)
      }
    })

    let remainingPool = totalRentPaid
    const sortedAlloc = [...monthsList].sort((a, b) => {
      const d1 = new Date(`${a.month} 1, ${a.year}`)
      const d2 = new Date(`${b.month} 1, ${b.year}`)
      return d1.getTime() - d2.getTime()
    })

    sortedAlloc.forEach(m => {
      if (remainingPool >= m.charge) { m.paid = m.charge; m.status = 'Paid'; remainingPool -= m.charge; }
      else if (remainingPool > 0) { m.paid = remainingPool; m.status = 'Partial'; remainingPool = 0; }
      else { m.paid = 0; m.status = 'Unpaid'; }
    })

    const rentDue = sortedAlloc.reduce((acc, m) => acc + (m.charge - m.paid), 0)
    const historicalFoodDue = Number(student.foodDueAmount) || 0
    const generatedFoodCost = student.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
    const totalFoodPaid = student.paymentsHistory?.reduce((acc: number, curr: any) => {
      const isRefund = curr.type === 'refund'
      const foodPortion = (curr.foodAmount !== undefined) ? Number(curr.foodAmount) : (student.paymentSystem === 'non-package' ? Number(curr.amount) : 0)
      return acc + (isRefund ? -foodPortion : foodPortion)
    }, 0) || 0
    const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)

    const totalDue = rentDue + (foodBalance < 0 ? Math.abs(foodBalance) : 0)
    const usableAdvance = Math.max(0, (student.advanceAmount || 0) - (student.monthlyRent || 0))
    
    return { rentDue, foodBalance, monthsList: sortedAlloc.reverse(), usableAdvance, totalDue, totalLifetimeReceived: (student.historicalTotalReceived || 0) + totalSystemPayments }
  }, [student])

  const handlePaymentSubmit = async () => {
    if (!student || !studentRef) return
    const seatPaid = student.paymentSystem === 'package' ? Number(paymentData.amount) : Number(paymentData.seatAmount)
    const foodPaid = student.paymentSystem === 'non-package' ? Number(paymentData.foodAmount) : 0
    const addAdvance = Number(paymentData.addAdvanceAmount)
    const totalCashAmount = seatPaid + foodPaid + addAdvance
    
    setIsUpdating(true)
    try {
      const pId = doc(collection(db, "payments")).id
      const pRecord = { 
        id: pId, amount: totalCashAmount, seatAmount: seatPaid, foodAmount: foodPaid, advanceAmount: addAdvance, 
        buildingId: student.buildingId, studentName: student.name, studentId: student.id, branch: student.branch,
        type: "income", month: paymentData.month, year: paymentData.year, method: paymentData.method, 
        receiver: paymentData.receiver, date: new Date().toISOString() 
      }
      
      await setDoc(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp() }) 
      await updateDoc(studentRef, { paymentsHistory: arrayUnion(pRecord), advanceAmount: increment(addAdvance), updatedAt: serverTimestamp() })
      
      // SMS Trigger
      if (apiConfig?.apikey && templatesData?.templates) {
        const paymentTemplate = templatesData.templates.find((t: any) => t.id === 'payment')
        if (paymentTemplate) {
          const hostelDisplayName = templatesData.hostelName || student.branch;
          let msg = paymentTemplate.text.replaceAll('[নাম]', student.name).replaceAll('[পরিমাণ]', totalCashAmount.toString()).replaceAll('[Hostel Name]', hostelDisplayName);
          const result = await sendSMS(apiConfig.apikey, apiConfig.senderid, student.phone, msg);
          await logSMSToDatabase(student.phone, msg, result.error === 0 ? 'Success' : 'Failed', result.error !== 0 ? result.msg : undefined)
        }
      }

      toast({ title: "Payment processed." })
      setIsPaymentDialogOpen(false)
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  const handleConfirmExit = async () => {
    if (!student || !studentRef || !exitSettlement.staffName) return
    setIsUpdating(true)
    try {
      const refund = Number(exitSettlement.refundAmount) || 0
      const collect = Number(exitSettlement.collectAmount) || 0

      if (refund > 0) {
        const expId = doc(collection(db, "expenses")).id
        await setDoc(doc(db, "expenses", expId), { id: expId, amount: refund, category: "others", buildingId: student.buildingId, expensePartyName: student.name, method: exitSettlement.method, expenseDate: new Date().toISOString().split('T')[0], branch: student.branch, createdAt: serverTimestamp() })
      }
      if (collect > 0) {
        const pId = doc(collection(db, "payments")).id
        await setDoc(doc(db, "payments", pId), { id: pId, amount: collect, studentId: student.id, studentName: student.name, type: "income", method: exitSettlement.method, receiver: exitSettlement.staffName, branch: student.branch, createdAt: serverTimestamp(), date: serverTimestamp() })
      }

      await updateDoc(studentRef, { isActive: false, leftAt: serverTimestamp(), advanceAmount: 0, duesBreakdown: {}, updatedAt: serverTimestamp() })
      
      // Exit SMS
      if (apiConfig?.apikey && templatesData?.templates) {
        const exitTemplate = templatesData.templates.find((t: any) => t.id === 'exit')
        if (exitTemplate) {
          let msg = exitTemplate.text.replaceAll('[নাম]', student.name).replaceAll('[Hostel Name]', templatesData.hostelName || student.branch);
          const result = await sendSMS(apiConfig.apikey, apiConfig.senderid, student.phone, msg);
          await logSMSToDatabase(student.phone, msg, result.error === 0 ? 'Success' : 'Failed', result.error !== 0 ? result.msg : undefined)
        }
      }

      toast({ title: "Exit Confirmed" })
      router.push("/students")
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  if (studentLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
  if (!student) return <div className="text-center p-20">Student not found.</div>

  return (
    <div className="space-y-6 pb-20 relative">
      {/* Desktop Header */}
      <div className="hidden md:flex justify-between items-start gap-4">
        <div className="flex gap-4 items-center">
          <div className="bg-primary/10 p-4 rounded-xl text-primary"><UserCircle size={48} /></div>
          <div>
            <h1 className="text-3xl font-bold">{student.name}</h1>
            <div className="flex gap-2 items-center mt-1">
              <Badge variant={student.isActive ? "default" : "destructive"} className={student.isActive ? "bg-success" : ""}>{student.isActive ? "Active Resident" : "Ex-Resident"}</Badge>
              <Badge variant="outline" className="capitalize">{student.paymentSystem} Plan</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditDialogOpen(true)} className="gap-2 h-11 px-6 rounded-xl font-bold text-slate-700"><Edit size={18} /> Edit</Button>
          {student.isActive && <Button variant="destructive" onClick={() => setIsExitDialogOpen(true)} className="gap-2 h-11 px-6 rounded-xl font-bold"><UserMinus size={18} /> Mark Left</Button>}
          <Button variant="ghost" onClick={() => router.push("/students")} className="h-11 rounded-xl">Back</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="border-none shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase text-muted-foreground">Stats</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20"><p className="text-[10px] uppercase text-orange-600 font-bold">Monthly Rent</p><p className="text-lg font-bold text-orange-600">৳{student.monthlyRent}</p></div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20"><p className="text-[10px] uppercase text-primary font-bold">Advance Pool</p><p className="text-lg font-bold text-primary">৳{student.advanceAmount || 0}</p></div>
            <div className={cn("p-3 rounded-lg border", financialStats.rentDue > 0 ? "bg-destructive/10 border-destructive/20" : "bg-success/10 border-success/20")}><p className={cn("text-[10px] uppercase font-bold", financialStats.rentDue > 0 ? "text-destructive" : "text-success")}>Total Due</p><p className="text-lg font-bold">৳{financialStats.totalDue.toLocaleString()}</p></div>
          </CardContent></Card>
        </div>

        <div className="md:col-span-2">
          <Tabs defaultValue="payments" className="w-full">
            <TabsList className="bg-secondary/50 p-1 mb-4 flex w-full md:w-auto">
              <TabsTrigger value="payments" className="flex-1">Payments</TabsTrigger>
              <TabsTrigger value="dues" className="flex-1">Dues</TabsTrigger>
              {student.paymentSystem === 'non-package' && <TabsTrigger value="meals" className="flex-1">Meals</TabsTrigger>}
            </TabsList>
            <TabsContent value="payments"><Card className="border-none shadow-sm overflow-hidden"><CardContent className="p-0"><Table><TableHeader className="bg-slate-50/50"><TableRow><TableHead>Date</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{student.paymentsHistory?.map((p: any, idx: number) => (<TableRow key={idx}><TableCell className="text-xs">{new Date(p.date).toLocaleDateString()}</TableCell><TableCell>{p.month} {p.year}</TableCell><TableCell className="text-right font-bold text-income">৳{p.amount?.toLocaleString()}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card></TabsContent>
            <TabsContent value="dues"><Card className="border-none shadow-sm overflow-hidden"><CardContent className="p-0"><Table><TableHeader className="bg-slate-50/50"><TableRow><TableHead>Month</TableHead><TableHead>Charge</TableHead><TableHead>Paid</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader><TableBody>{financialStats.monthsList.map((m: any, idx: number) => (<TableRow key={idx}><TableCell>{m.month} {m.year}</TableCell><TableCell>৳{m.charge}</TableCell><TableCell>৳{m.paid}</TableCell><TableCell className="text-right"><Badge className={m.status === 'Paid' ? "bg-success" : m.status === 'Partial' ? "bg-orange-500" : "bg-destructive"}>{m.status}</Badge></TableCell></TableRow>))}</TableBody></Table></CardContent></Card></TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Payment FAB */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-2">
        {student.isActive && <Button onClick={() => setIsPaymentDialogOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-primary border-4 border-white"><Plus size={32} className="text-white" /></Button>}
      </div>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Payment for {student.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Month</Label><Select value={paymentData.month} onValueChange={val => setPaymentData({...paymentData, month: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Year</Label><Select value={paymentData.year} onValueChange={val => setPaymentData({...paymentData, year: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["2024", "2025", "2026"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="p-4 border-2 border-primary/20 rounded-xl space-y-4 bg-primary/5">
              {student.paymentSystem === 'package' ? (
                <div className="space-y-2"><Label>Amount Received</Label><Input type="number" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} /></div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Seat Rent</Label><Input type="number" value={paymentData.seatAmount} onChange={e => setPaymentData({...paymentData, seatAmount: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Food Deposit</Label><Input type="number" value={paymentData.foodAmount} onChange={e => setPaymentData({...paymentData, foodAmount: e.target.value})} /></div>
                </div>
              )}
              <div className="space-y-2"><Label>Add to Advance Pool</Label><Input type="number" value={paymentData.addAdvanceAmount} onChange={e => setPaymentData({...paymentData, addAdvanceAmount: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Method</Label><Select value={paymentData.method} onValueChange={val => setPaymentData({...paymentData, method: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Receiver</Label><Select value={paymentData.receiver} onValueChange={val => setPaymentData({...paymentData, receiver: val})}><SelectTrigger><SelectValue placeholder="Staff" /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={`${student.id}-${s.name}`} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handlePaymentSubmit} className="w-full h-12 text-lg font-bold" disabled={isUpdating}>Confirm Payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Resident Exit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-secondary/30 p-4 rounded-xl space-y-2">
              <p className="text-xs font-bold uppercase text-muted-foreground">Final Settlement</p>
              <div className="flex justify-between font-black"><span>Total Dues:</span><span className="text-destructive">৳{financialStats.totalDue.toLocaleString()}</span></div>
              <div className="flex justify-between font-black"><span>Advance Pool:</span><span className="text-primary">৳{(student.advanceAmount || 0).toLocaleString()}</span></div>
            </div>
            <div className="space-y-2"><Label>Staff Name</Label><Select value={exitSettlement.staffName} onValueChange={val => setExitSettlement({...exitSettlement, staffName: val})}><SelectTrigger><SelectValue placeholder="Processed By" /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={`${student.id}-${s.name}-exit`} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button onClick={handleConfirmExit} className="w-full bg-destructive font-bold h-12" disabled={isUpdating}>Confirm Exit & Settlement</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
