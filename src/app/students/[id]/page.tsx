
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
  ExternalLink, UserCheck, Zap, Clock
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

  useEffect(() => {
    if (student) {
      setEditForm({ ...student })
    }
  }, [student])

  // Calculation Logic
  const stats = useMemo(() => {
    if (!student) return null
    
    const billingStart = student.billingStartDate ? new Date(student.billingStartDate) : (student.createdAt?.toDate?.() || new Date())
    const now = new Date()
    const endDate = student.isActive ? now : (student.leftAt?.toDate?.() || now)
    
    const monthsElapsed = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth())
    const totalMonths = Math.max(0, monthsElapsed + 1)
    const generatedRent = totalMonths * (student.monthlyRent || 0)
    
    const totalRentPaid = (student.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.seatAmount || 0), 0) || 0)
    const historicalRentDue = student.duesBreakdown ? Object.values(student.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
    const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

    const historicalFoodDue = Number(student.foodDueAmount) || 0
    const generatedFoodCost = student.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
    const totalFoodPaid = (student.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.foodAmount || 0), 0) || 0)
    const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)

    const totalReceivedNew = (student.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0) || 0)
    const totalReceived = (student.historicalTotalReceived || 0) + totalReceivedNew

    const dueBreakdownList = []
    for (let i = 0; i < totalMonths; i++) {
      const d = new Date(billingStart.getFullYear(), billingStart.getMonth() + i, 1)
      const monthLabel = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
      dueBreakdownList.push({ month: monthLabel, amount: student.monthlyRent, status: 'Unpaid' })
    }

    return { 
      rentDue, 
      foodBalance, 
      totalDue: rentDue + Math.max(0, -foodBalance),
      totalReceived,
      advanceRemaining: student.advanceAmount || 0,
      currentMonthDue: student.monthlyRent,
      dueBreakdownList: dueBreakdownList.reverse()
    }
  }, [student])

  const settlementAmount = stats ? (stats.totalDue - stats.advanceRemaining) : 0

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
      
      if (apiConfig?.apikey && templatesData?.templates) {
        const paymentTemplate = templatesData.templates.find((t: any) => t.id === 'payment')
        if (paymentTemplate) {
          const hostelDisplayName = templatesData.hostelName || student.branch;
          let msg = paymentTemplate.text
            .replaceAll('[নাম]', student.name)
            .replaceAll('[পরিমাণ]', totalAmt.toString())
            .replaceAll('[Hostel Name]', hostelDisplayName);
          await sendSMS(apiConfig.apikey, apiConfig.senderid, student.phone, msg)
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
      toast({ title: "Resident Released" })
      setIsExitDialogOpen(false)
      router.push("/students")
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  const editBuildingData = buildings?.find(b => b.id === editForm?.buildingId)
  const editRoomsList = useMemo(() => {
    if (!editBuildingData) return []
    return editBuildingData.apartmentsDetail?.flatMap((apt: any) => 
      apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))
    ) || []
  }, [editBuildingData])

  const editRoomData = editRoomsList.find((r: any) => String(r.roomNo) === String(editForm?.roomNumber))
  const editSeatsList = editRoomData?.seats || []

  if (studentLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
  if (!student) return <div className="text-center p-20">Resident not found.</div>

  return (
    <div className="space-y-8 pb-24 max-w-7xl mx-auto px-4 relative">
      {/* Mobile App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
          <ChevronLeft size={24} />
        </Button>
        <div className="flex-1 overflow-hidden">
          <h1 className="text-lg font-bold truncate">{student.name}</h1>
          <p className="text-[10px] text-muted-foreground font-bold uppercase">{student.buildingName} • R-{student.roomNumber}</p>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 shadow-xl border-slate-100">
              <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                <Edit size={16} className="text-primary" /> Edit Profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsExitDialogOpen(true)} className="gap-2 font-medium text-destructive p-3 rounded-lg cursor-pointer">
                <UserMinus size={16} /> Mark as Left
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Desktop Header Header */}
      <div className="hidden md:flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <UserCircle size={48} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">{student.name}</h1>
            <div className="flex gap-2 mt-1">
              <Badge className={cn("rounded-full", student.isActive ? "bg-success" : "bg-destructive")}>{student.isActive ? "Active Resident" : "Ex-Resident"}</Badge>
              <Badge variant="secondary" className="rounded-full uppercase text-[10px] font-bold">{student.paymentSystem} Plan</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl h-11 px-6 font-bold" onClick={() => setIsEditDialogOpen(true)}>
            <Edit size={18} className="mr-2"/> Edit Profile
          </Button>
          <Button variant="destructive" className="rounded-xl h-11 px-6 font-bold gap-2 shadow-lg shadow-destructive/10" onClick={() => setIsExitDialogOpen(true)}>
            <UserMinus size={18} /> Mark as Left
          </Button>
          <Button variant="ghost" className="rounded-xl h-11 px-6 font-bold" onClick={() => router.back()}>Back</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="border-none shadow-sm rounded-3xl p-6 bg-white space-y-6">
          <h2 className="text-xl font-bold text-slate-800">Contact & Location</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-slate-600">
              <div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Phone size={18}/></div>
              <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Mobile</p><p className="font-bold">{student.phone}</p></div>
            </div>
            <div className="flex items-center gap-4 text-slate-600">
              <div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Building2 size={18}/></div>
              <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Building</p><p className="font-bold">{student.buildingName}</p></div>
            </div>
            <div className="flex items-center gap-4 text-slate-600">
              <div className="bg-primary/5 p-2.5 rounded-xl text-primary"><LayoutGrid size={18}/></div>
              <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Unit</p><p className="font-bold">Room {student.roomNumber} | Seat {student.seatNumber}</p></div>
            </div>
            <div className="flex items-center gap-4 text-slate-600">
              <div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Calendar size={18}/></div>
              <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Billing Start</p><p className="font-bold">{student.billingStartDate}</p></div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl p-6 bg-white space-y-6">
          <h2 className="text-xl font-bold text-slate-800">Financial Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-orange-50/50 border border-orange-100 flex flex-col items-center text-center space-y-1">
              <p className="text-[9px] font-black uppercase text-orange-600 tracking-widest">Monthly Rent</p>
              <p className="text-2xl font-black text-orange-700">৳{student.monthlyRent}</p>
            </div>
            <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100 flex flex-col items-center text-center space-y-1">
              <p className="text-[9px] font-black uppercase text-blue-600 tracking-widest">Advance Pool</p>
              <p className="text-2xl font-black text-blue-700">৳{student.advanceAmount}</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center space-y-1">
              <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Service Charge</p>
              <p className="text-2xl font-black text-slate-700">৳{student.serviceCharge}</p>
            </div>
            <div className="p-5 rounded-2xl bg-destructive/5 border border-destructive/10 flex flex-col items-center text-center space-y-1">
              <p className="text-[9px] font-black uppercase text-destructive tracking-widest">Total Rent Due</p>
              <p className="text-2xl font-black text-destructive">৳{stats?.rentDue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-6 rounded-2xl">
          <TabsTrigger value="payments" className="rounded-xl gap-2 h-10 px-6 font-bold"><Wallet size={14}/> Payments</TabsTrigger>
          <TabsTrigger value="dues" className="rounded-xl gap-2 h-10 px-6 font-bold"><Clock size={14}/> Dues Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.paymentsHistory?.slice().reverse().map((p: any, idx: number) => (
                  <TableRow key={idx} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/receipts/${p.id}`)}>
                    <TableCell className="text-xs text-slate-500">{new Date(p.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-bold">{p.month} {p.year}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{p.method}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.description || "N/A"}</TableCell>
                    <TableCell className="text-right font-black text-success">৳{p.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="dues">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Month</TableHead>
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
                    <TableCell><Badge variant="outline" className="text-[10px] text-destructive border-destructive">Unpaid</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-primary font-bold" onClick={() => setIsPaymentDialogOpen(true)}>Pay</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-8 right-8 z-50">
        <Button size="icon" className="h-14 w-14 rounded-full shadow-2xl bg-primary border-4 border-white" onClick={() => setIsPaymentDialogOpen(true)}>
          <Plus size={32} />
        </Button>
      </div>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-5 bg-slate-900 rounded-3xl text-white space-y-3 shadow-xl">
              <div className="flex justify-between items-center opacity-70 text-xs"><span>Current Month ({paymentData.month})</span> <span>৳{student.monthlyRent}</span></div>
              <div className="flex justify-between items-center opacity-70 text-xs"><span>Existing Arrears/Dues</span> <span>৳{stats?.rentDue}</span></div>
              <Separator className="bg-white/10" />
              <div className="flex justify-between items-center font-black">
                <span className="text-xs uppercase tracking-widest text-primary">Total Recommendation</span>
                <span className="text-2xl">৳{(student.monthlyRent + (stats?.rentDue || 0)).toLocaleString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Month</Label><Select value={paymentData.month} onValueChange={v => setPaymentData({...paymentData, month: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Year</Label><Select value={paymentData.year} onValueChange={v => setPaymentData({...paymentData, year: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{"2024,2025,2026".split(',').map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
            </div>

            <div className="space-y-4">
              {student.paymentSystem === 'package' ? (
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Package Amount (৳)</Label><Input type="number" className="rounded-xl h-12 text-lg font-black" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} placeholder="0.00" /></div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Seat Rent (৳)</Label><Input type="number" className="rounded-xl h-12" value={paymentData.seatAmount} onChange={e => setPaymentData({...paymentData, seatAmount: e.target.value})} /></div>
                  <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Food Bill (৳)</Label><Input type="number" className="rounded-xl h-12" value={paymentData.foodAmount} onChange={e => setPaymentData({...paymentData, foodAmount: e.target.value})} /></div>
                </div>
              )}
              <div className="space-y-1"><Label className="text-xs font-bold text-primary uppercase">Add to Security Advance (৳)</Label><Input type="number" className="rounded-xl h-12 border-primary/20" value={paymentData.addAdvanceAmount} onChange={e => setPaymentData({...paymentData, addAdvanceAmount: e.target.value})} /></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Method</Label><Select value={paymentData.method} onValueChange={v => setPaymentData({...paymentData, method: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>Receiver</Label><Select value={paymentData.receiver} onValueChange={v => setPaymentData({...paymentData, receiver: v})}><SelectTrigger><SelectValue placeholder="Staff"/></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button className="w-full h-14 rounded-2xl text-lg font-black" onClick={handlePaymentSubmit} disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin" /> : "Confirm & Save Receipt"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Update Profile & Allocation</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Full Name</Label><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                <div className="space-y-1.5"><Label>Phone Number</Label><Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
              </div>

              <div className="p-5 border-2 border-primary/10 rounded-3xl bg-primary/5 space-y-4">
                <h3 className="text-[10px] font-black uppercase text-primary tracking-widest">Re-Allocation (Building/Room/Seat)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Building</Label>
                    <Select value={editForm.buildingId} onValueChange={v => setEditForm({...editForm, buildingId: v, roomNumber: "", seatNumber: ""})}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Select Building"/></SelectTrigger>
                      <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Room No.</Label>
                    <Select disabled={!editForm.buildingId} value={String(editForm.roomNumber)} onValueChange={v => setEditForm({...editForm, roomNumber: v, seatNumber: ""})}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Select Room"/></SelectTrigger>
                      <SelectContent>{editRoomsList.map((r: any, i: number) => <SelectItem key={i} value={String(r.roomNo)}>R-{r.roomNo} ({r.aptName})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Seat No.</Label>
                    <Select disabled={!editForm.roomNumber} value={String(editForm.seatNumber)} onValueChange={v => setEditForm({...editForm, seatNumber: v})}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Select Seat"/></SelectTrigger>
                      <SelectContent>
                        {editSeatsList.map((s: any, i: number) => (
                          (s.status === 'empty' || s.seatNo === student.seatNumber) && 
                          <SelectItem key={i} value={String(s.seatNo)}>Seat {s.seatNo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Monthly Rent (৳)</Label><Input type="number" value={editForm.monthlyRent} onChange={e => setEditForm({...editForm, monthlyRent: Number(e.target.value)})} /></div>
                <div className="space-y-1.5"><Label>Advance (৳)</Label><Input type="number" value={editForm.advanceAmount} onChange={e => setEditForm({...editForm, advanceAmount: Number(e.target.value)})} /></div>
              </div>
            </div>
          )}
          <DialogFooter><Button className="w-full h-12 rounded-2xl font-bold" onClick={handleUpdateProfile} disabled={isUpdating}>Save Profile Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle className="text-destructive">Process Final Exit</DialogTitle></DialogHeader>
          <div className="py-6 space-y-6">
            <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 text-center space-y-2 shadow-inner">
              <p className="text-xs font-bold text-muted-foreground uppercase">Settlement Amount</p>
              <p className="text-4xl font-black text-slate-800">৳{settlementAmount.toLocaleString()}</p>
              <p className="text-[10px] font-black uppercase text-primary tracking-widest mt-2">
                {settlementAmount >= 0 ? "STUDENT PAYS TO HOSTEL" : "HOSTEL REFUNDS TO STUDENT"}
              </p>
            </div>
            <p className="text-xs text-slate-500 text-center italic">
              Note: Settlement = (Pending Rent + Food Debt) - Security Advance. Confirming this will release seat {student.seatNumber}.
            </p>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="rounded-2xl" onClick={() => setIsExitDialogOpen(false)}>Cancel</Button>
            <Button className="bg-destructive hover:bg-destructive/90 rounded-2xl font-black" onClick={handleConfirmExit} disabled={isUpdating}>Confirm Release</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
