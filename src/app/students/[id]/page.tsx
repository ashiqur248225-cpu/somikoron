
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
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  
  const [paymentData, setPaymentData] = useState({ month: MONTHS[new Date().getMonth()], year: new Date().getFullYear().toString(), amount: "", seatAmount: "", foodAmount: "", addAdvanceAmount: "0", method: "cash", receiver: "", description: "" })
  const [exitSettlement, setExitSettlement] = useState({ refundAmount: "0", collectAmount: "0", method: "cash", staffName: "", description: "" })

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
      await setDoc(doc(db, "smsLogs", logId), { id: logId, to, message: msg, status, error: errorMsg || null, branch: student?.branch, sentBy: localStorage.getItem("user_name"), createdAt: serverTimestamp() })
    } catch (e) {}
  }

  const financialStats = useMemo(() => {
    if (!student) return { rentDue: 0, foodBalance: 0, monthsList: [], totalDue: 0 }
    
    const billingStart = student.billingStartDate ? new Date(student.billingStartDate) : (student.createdAt?.toDate?.() || new Date())
    const now = new Date()
    const endDate = student.isActive ? now : (student.leftAt?.toDate?.() || now)
    
    const totalMonths = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth()) + 1
    const generatedRent = totalMonths * (student.monthlyRent || 0)
    const totalRentPaid = student.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.seatAmount || (student.paymentSystem === 'package' ? curr.amount : 0)), 0) || 0
    const historicalRentDue = student.duesBreakdown ? Object.values(student.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
    const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

    const historicalFoodDue = Number(student.foodDueAmount) || 0
    const generatedFoodCost = student.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
    const totalFoodPaid = student.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.foodAmount || (student.paymentSystem === 'non-package' ? curr.amount : 0)), 0) || 0
    const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)

    return { rentDue, foodBalance, totalDue: rentDue + Math.max(0, -foodBalance) }
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
        studentId: student.id, 
        studentName: student.name, 
        branch: student.branch, 
        method: paymentData.method, 
        receiver: paymentData.receiver, 
        date: serverTimestamp(), 
        createdAt: serverTimestamp() 
      }
      
      await setDoc(doc(db, "payments", pId), pRecord)
      
      // CRITICAL FIX: Use Date string instead of serverTimestamp inside arrayUnion
      await updateDoc(studentRef, { 
        paymentsHistory: arrayUnion({ ...pRecord, date: new Date().toISOString() }), 
        advanceAmount: increment(Number(paymentData.addAdvanceAmount)), 
        updatedAt: serverTimestamp() 
      })
      
      if (apiConfig?.apikey && templatesData?.templates) {
        const paymentTemplate = templatesData.templates.find((t: any) => t.id === 'payment')
        if (paymentTemplate) {
          const hostelDisplayName = templatesData.hostelName || student.branch;
          let msg = paymentTemplate.text
            .replaceAll('[নাম]', student.name)
            .replaceAll('[পরিমাণ]', totalAmt.toString())
            .replaceAll('[Hostel Name]', hostelDisplayName);
            
          const result = await sendSMS(apiConfig.apikey, apiConfig.senderid, student.phone, msg)
          await logSMSToDatabase(student.phone, msg, result.error === 0 ? 'Success' : 'Failed', result.error !== 0 ? result.msg : undefined)
          
          if (result.error === 0) {
            toast({ title: "SMS Sent", description: `মেসেজ: ${msg.substring(0, 50)}...` })
          } else if (result.error === 417) {
            toast({ variant: "destructive", title: "ব্যালেন্স নেই", description: "আপনার পর্যাপ্ত ব্যালেন্স নেই, দয়া করে রিচার্জ করুন।" })
          }
        }
      }
      setIsPaymentDialogOpen(false)
      toast({ title: "Payment Recorded" })
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  const handleConfirmExit = async () => {
    if (!student || !studentRef) return
    setIsUpdating(true)
    try {
      await updateDoc(studentRef, { isActive: false, leftAt: serverTimestamp(), updatedAt: serverTimestamp() })
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
      router.push("/students")
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  if (studentLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
  if (!student) return <div className="text-center p-20">Student not found.</div>

  return (
    <div className="space-y-6 pb-20 relative">
      <div className="flex justify-between items-start">
        <div className="flex gap-4 items-center">
          <div className="bg-primary/10 p-4 rounded-xl text-primary"><UserCircle size={48} /></div>
          <div>
            <h1 className="text-3xl font-bold">{student.name}</h1>
            <Badge variant={student.isActive ? "default" : "destructive"}>{student.isActive ? "Active" : "Ex-Resident"}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>Edit</Button>
          {student.isActive && <Button variant="destructive" onClick={() => setIsExitDialogOpen(true)}>Mark Left</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 space-y-4">
          <div className="p-3 bg-secondary rounded-lg flex justify-between"><span>Total Due:</span><span className="font-bold text-destructive">৳{financialStats.totalDue.toLocaleString()}</span></div>
          <div className="p-3 bg-primary/5 rounded-lg flex justify-between"><span>Advance:</span><span className="font-bold">৳{student.advanceAmount || 0}</span></div>
        </Card>
        <div className="md:col-span-2">
          <Tabs defaultValue="payments"><TabsList><TabsTrigger value="payments">Payments</TabsTrigger></TabsList>
            <TabsContent value="payments">
              <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>{student.paymentsHistory?.map((p: any, idx: number) => (<TableRow key={idx}><TableCell>{new Date(p.date).toLocaleDateString()}</TableCell><TableCell className="text-right">৳{p.amount.toLocaleString()}</TableCell></TableRow>))}</TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-50">
        <Button onClick={() => setIsPaymentDialogOpen(true)} size="icon" className="h-14 w-14 rounded-full bg-primary"><Plus size={32} /></Button>
      </div>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Payment Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input type="number" placeholder="Amount" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} />
            <Select value={paymentData.receiver} onValueChange={v => setPaymentData({...paymentData, receiver: v})}><SelectTrigger><SelectValue placeholder="Receiver" /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <DialogFooter><Button onClick={handlePaymentSubmit} className="w-full" disabled={isUpdating}>Confirm Payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Mark as Left</DialogTitle></DialogHeader>
          <div className="p-4 bg-secondary/30 rounded-xl">Settlement: <b>৳{financialStats.totalDue}</b></div>
          <DialogFooter><Button onClick={handleConfirmExit} className="w-full bg-destructive" disabled={isUpdating}>Confirm Exit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
