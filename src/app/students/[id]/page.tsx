
"use client"

import * as React from "react"
import { useState, useMemo, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, serverTimestamp, updateDoc, setDoc, arrayUnion, increment, collection, query, where, getDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  UserCircle, Phone, Building2, 
  Loader2, Calculator,
  Plus, UserMinus, Wallet,
  AlertCircle, History, Edit,
  Calendar, ChevronLeft,
  Info, ShieldCheck, HandCoins,
  MapPin, GraduationCap,
  LayoutGrid, CheckCircle2, 
  MoreVertical, Utensils, Clock,
  Smartphone, User, Zap, CircleDollarSign, Home, Trash2, Scale, Receipt, Printer, Send, FileText
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
const YEARS = ["2024", "2025", "2026", "2027", "2028"];

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
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  
  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")
  const [settlementInput, setSettlementInput] = useState("")

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

  const stats = useMemo(() => {
    if (!student) return null
    
    // Rent Dues calculation from structured breakdown objects
    const rentDue = Object.values(student.duesBreakdown || {}).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);

    // foodDueAmount is the direct "Net Balance" field
    const foodBalance = student.foodDueAmount || 0
    const totalReceived = student.historicalTotalReceived || 0

    const dueBreakdownList = Object.entries(student.duesBreakdown || {}).map(([monthLabel, data]: any) => ({
      month: monthLabel,
      amount: Number(data.amount),
      status: 'Unpaid'
    })).sort((a, b) => {
      const [mA, yA] = a.month.split(' ');
      const [mB, yB] = b.month.split(' ');
      if (yA !== yB) return Number(yB) - Number(yA);
      return MONTHS.indexOf(mB) - MONTHS.indexOf(mA);
    });

    return { 
      rentDue, 
      foodBalance, 
      totalDue: rentDue,
      totalReceived,
      advanceRemaining: student.advanceAmount || 0,
      dueBreakdownList
    }
  }, [student])

  const settlementCalculation = useMemo(() => {
    if (!stats || !student) return null;
    const pendingRent = stats.rentDue;
    const foodDue = stats.foodBalance < 0 ? Math.abs(stats.foodBalance) : 0;
    const advance = student.advanceAmount || 0;
    
    const netResult = (pendingRent + foodDue) - advance;
    
    return {
      pendingRent,
      foodDue,
      advance,
      netResult,
      isRefund: netResult < 0,
      absResult: Math.abs(netResult)
    };
  }, [stats, student]);

  useEffect(() => {
    if (isExitDialogOpen && settlementCalculation) {
      setSettlementInput(settlementCalculation.absResult.toString());
    }
  }, [isExitDialogOpen, settlementCalculation]);

  // Payment Submit Logic for Profile
  const handlePaymentSubmit = async () => {
    if (!student || !studentRef) return
    setIsUpdating(true)
    try {
      const seatPaid = student.paymentSystem === 'package' ? Number(paymentData.amount || 0) : Number(paymentData.seatAmount || 0)
      const foodPaid = student.paymentSystem === 'non-package' ? Number(paymentData.foodAmount || 0) : 0
      const extraAdvance = Number(paymentData.addAdvanceAmount || 0)
      const totalAmt = seatPaid + foodPaid + extraAdvance
      
      const pId = doc(collection(db, "payments")).id
      const pRecord = { 
        id: pId, amount: totalAmt, seatAmount: seatPaid, foodAmount: foodPaid, advanceAmount: extraAdvance,
        studentId: student.id, studentName: student.name, buildingId: student.buildingId,
        buildingName: student.buildingName, roomNumber: student.roomNumber, branch: student.branch, 
        method: paymentData.method, receiver: paymentData.receiver, month: paymentData.month,
        year: paymentData.year, description: paymentData.description, date: new Date().toISOString()
      }
      
      const currentDues = { ...(student.duesBreakdown || {}) };
      let remainingRentPaid = seatPaid;
      const targetLabel = `${paymentData.month} ${paymentData.year}`;

      // 1. Deduct from selected month object
      if (currentDues[targetLabel] && remainingRentPaid > 0) {
        const dueAmt = Number(currentDues[targetLabel].amount);
        if (remainingRentPaid >= dueAmt) {
          remainingRentPaid -= dueAmt;
          delete currentDues[targetLabel];
        } else {
          currentDues[targetLabel].amount = dueAmt - remainingRentPaid;
          remainingRentPaid = 0;
        }
      }

      // 2. Pay other months if money left
      if (remainingRentPaid > 0) {
        const remainingMonths = Object.keys(currentDues).sort((a, b) => {
          const [mA, yA] = a.split(' ');
          const [mB, yB] = b.split(' ');
          if (yA !== yB) return Number(yA) - Number(yB);
          return MONTHS.indexOf(mA) - MONTHS.indexOf(mB);
        });

        for (const month of remainingMonths) {
          if (remainingRentPaid <= 0) break;
          const dueAmt = Number(currentDues[month].amount);
          if (remainingRentPaid >= dueAmt) {
            remainingRentPaid -= dueAmt;
            delete currentDues[month];
          } else {
            currentDues[month].amount = dueAmt - remainingRentPaid;
            remainingRentPaid = 0;
          }
        }
      }

      const finalTotalDue = Object.values(currentDues).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);

      await setDoc(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp(), createdAt: serverTimestamp() })
      await updateDoc(studentRef, { 
        paymentsHistory: arrayUnion(pRecord), 
        advanceAmount: increment(extraAdvance), 
        totalDue: finalTotalDue,
        duesBreakdown: currentDues,
        foodDueAmount: increment(foodPaid), // PLUS to net balance
        historicalTotalReceived: increment(totalAmt), // Accumulate
        updatedAt: serverTimestamp() 
      })
      
      toast({ title: "Payment Recorded" })
      setIsPaymentDialogOpen(false)
      router.push(`/receipts/${pId}`)
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  const handleUpdateProfile = async () => {
    if (!studentRef || !editForm) return
    setIsUpdating(true)
    try {
      await updateDoc(studentRef, { ...editForm, updatedAt: serverTimestamp() })
      setIsEditDialogOpen(false)
      toast({ title: "Profile Updated" })
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  const handleConfirmExit = async () => {
    if (!studentRef || !student) return
    setIsUpdating(true)
    try {
      // Seat release logic kept same as previous turns
      const bRef = doc(db, "buildings", student.buildingId)
      const buildingSnap = await getDoc(bRef)
      if (buildingSnap.exists()) {
        const bData = buildingSnap.data()
        const updatedApts = bData.apartmentsDetail.map((apt: any) => {
          if (apt.name === student.apartmentName) {
            return {
              ...apt,
              rooms: apt.rooms.map((room: any) => {
                if (String(room.roomNo) === String(student.roomNumber)) {
                  return {
                    ...room,
                    seats: room.seats.map((seat: any) => 
                      seat.seatNo === student.seatNumber ? { ...seat, status: 'empty' } : seat
                    )
                  }
                }
                return room
              })
            }
          }
          return apt
        })
        await updateDoc(bRef, {
          apartmentsDetail: updatedApts,
          occupiedSeats: increment(-1),
          emptySeats: increment(1),
          updatedAt: serverTimestamp()
        })
      }

      await updateDoc(studentRef, { 
        isActive: false, 
        leftAt: serverTimestamp(), 
        finalSettlementAmount: Number(settlementInput),
        updatedAt: serverTimestamp() 
      })

      toast({ title: "Resident Released" })
      setIsExitDialogOpen(false)
      router.push("/students")
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsUpdating(false) }
  }

  if (studentLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
  if (!student) return <div className="text-center p-20">Resident not found.</div>

  const financialCards = [
    { label: "Advance", val: student.advanceAmount, color: "blue-600", icon: ShieldCheck, bg: "bg-blue-50" },
    { label: "Service Chrg", val: student.serviceCharge, color: "purple-600", icon: Zap, bg: "bg-purple-50" },
    { label: "Monthly Rent", val: student.monthlyRent, color: "orange-600", icon: Home, bg: "bg-orange-50" },
    { label: "Total Recv.", val: stats?.totalReceived, color: "green-600", icon: HandCoins, bg: "bg-green-50" },
    { label: "Rent Due", val: stats?.totalDue || 0, color: "destructive", icon: AlertCircle, bg: "bg-red-50" },
    { 
      label: "Food Bal.", 
      val: stats?.foodBalance, 
      color: (stats?.foodBalance ?? 0) >= 0 ? "success" : "destructive", 
      icon: Utensils, 
      bg: (stats?.foodBalance ?? 0) >= 0 ? "bg-success/5" : "bg-red-50" 
    },
  ].filter(c => c.label !== 'Food Bal.' || student.paymentSystem === 'non-package');

  return (
    <div className="space-y-8 pb-24 max-w-7xl mx-auto px-4 relative">
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
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-xl border-slate-100">
              <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                <Edit size={16} className="text-primary" /> Edit Profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsExitDialogOpen(true)} className="gap-2 font-medium text-destructive p-3 rounded-lg cursor-pointer">
                <Scale size={16} /> Process Exit & Settlement
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
            <Scale size={18} /> Process Exit & Settlement
          </Button>
          <Button variant="ghost" className="rounded-xl h-11 px-6 font-bold" onClick={() => router.back()}>Back</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="border-none shadow-sm rounded-3xl p-6 bg-white flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-6">Contact & Location</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-slate-600">
                <div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Phone size={18}/></div>
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Personal Mobile</p><p className="font-bold">{student.phone}</p></div>
              </div>
              <div className="flex items-center gap-4 text-slate-600">
                <div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Smartphone size={18}/></div>
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Parent Mobile</p><p className="font-bold">{student.parentPhone || 'N/A'}</p></div>
              </div>
              <div className="flex items-center gap-4 text-slate-600">
                <div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Building2 size={18}/></div>
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Location</p><p className="font-bold">{student.buildingName} • R-{student.roomNumber} | S-{student.seatNumber}</p></div>
              </div>
              <div className="flex items-center gap-4 text-slate-600">
                <div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Calendar size={18}/></div>
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Billing Start</p><p className="font-bold">{student.billingStartDate}</p></div>
              </div>
            </div>
          </div>
          <Button variant="secondary" className="w-full mt-8 rounded-xl font-bold gap-2 text-xs uppercase" onClick={() => setIsDetailsDialogOpen(true)}><Info size={14} /> View All Information</Button>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {financialCards.map((card, idx) => (
            <Card key={idx} className={cn("p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 bg-white")}>
              <div className={cn("p-3 rounded-xl shrink-0", card.bg, card.color === 'success' ? 'text-success' : (card.color === 'destructive' ? 'text-destructive' : `text-${card.color}`))}>
                <card.icon size={24}/>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{card.label}</p>
                <p className={cn("text-xl font-black", card.color === 'success' ? "text-success" : (card.color === 'destructive' ? "text-destructive" : "text-slate-800"))}>৳{card.val?.toLocaleString()}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-6 rounded-2xl overflow-x-auto h-auto flex">
          <TabsTrigger value="payments" className="rounded-xl gap-2 h-10 px-6 font-bold flex-1"><Wallet size={14}/> Finance History</TabsTrigger>
          <TabsTrigger value="dues" className="rounded-xl gap-2 h-10 px-6 font-bold flex-1"><Clock size={14}/> Dues Breakdown</TabsTrigger>
          {student.paymentSystem === 'non-package' && (
            <TabsTrigger value="meals" className="rounded-xl gap-2 h-10 px-6 font-bold flex-1"><Utensils size={14}/> Food Log</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="payments">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50"><TableRow><TableHead>Date</TableHead><TableHead>Period</TableHead><TableHead>Rent</TableHead><TableHead>Food</TableHead><TableHead>Advance</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {student.paymentsHistory?.slice().reverse().map((p: any, idx: number) => (
                  <TableRow key={idx} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/receipts/${p.id}`)}>
                    <TableCell className="text-xs text-slate-500">{new Date(p.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-bold">{p.month} {p.year}</TableCell>
                    <TableCell>৳{p.seatAmount || 0}</TableCell>
                    <TableCell>৳{p.foodAmount || 0}</TableCell>
                    <TableCell>৳{p.advanceAmount || 0}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{p.method}</Badge></TableCell>
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
              <TableHeader className="bg-slate-50"><TableRow><TableHead>Month</TableHead><TableHead>Due Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {stats?.dueBreakdownList.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-bold">{d.month}</TableCell>
                    <TableCell className="font-black text-destructive">৳{d.amount.toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] text-destructive border-destructive uppercase">Unpaid</Badge></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" className="text-primary font-bold" onClick={() => setIsPaymentDialogOpen(true)}>Record Pay</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-5 bg-slate-900 rounded-3xl text-white space-y-3 shadow-xl">
              <div className="flex justify-between items-center opacity-70 text-xs"><span>Rent Due (History)</span> <span className="text-destructive font-black">৳{stats?.totalDue || 0}</span></div>
              <Separator className="bg-white/10" />
              {student.duesBreakdown && Object.keys(student.duesBreakdown).length > 0 && (
                <div className="space-y-2 py-2">
                  <p className="text-[8px] font-black uppercase text-primary">Monthly Breakdown:</p>
                  <div className="grid grid-cols-2 gap-2 max-h-[100px] overflow-y-auto pr-1">
                    {Object.entries(student.duesBreakdown).map(([label, data]: any) => (
                      <div key={label} className="bg-white/10 p-1.5 rounded flex justify-between items-center border border-white/5">
                        <span className="text-[8px] font-medium">{label}</span>
                        <span className="text-[9px] font-black text-destructive">৳{data.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Month</Label><Select value={paymentData.month} onValueChange={v => setPaymentData({...paymentData, month: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Year</Label><Select value={paymentData.year} onValueChange={v => setPaymentData({...paymentData, year: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
            </div>

            <div className="space-y-4">
              {student.paymentSystem === 'package' ? (
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Package Amount (৳)</Label><Input type="number" className="rounded-xl h-12 text-lg font-black" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} /></div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Seat Rent (৳)</Label><Input type="number" className="rounded-xl h-12" value={paymentData.seatAmount} onChange={e => setPaymentData({...paymentData, seatAmount: e.target.value})} /></div>
                  <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Food Bill (৳)</Label><Input type="number" className="rounded-xl h-12" value={paymentData.foodAmount} onChange={e => setPaymentData({...paymentData, foodAmount: e.target.value})} /></div>
                </div>
              )}
              <div className="space-y-1"><Label className="text-xs font-bold text-primary uppercase">Add Security Advance (৳)</Label><Input type="number" className="rounded-xl h-12 border-primary/20" value={paymentData.addAdvanceAmount} onChange={e => setPaymentData({...paymentData, addAdvanceAmount: e.target.value})} /></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Method</Label><Select value={paymentData.method} onValueChange={v => setPaymentData({...paymentData, method: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>Receiver</Label><Select value={paymentData.receiver} onValueChange={v => setPaymentData({...paymentData, receiver: v})}><SelectTrigger><SelectValue placeholder="Staff"/></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button className="w-full h-14 rounded-2xl text-lg font-black" onClick={handlePaymentSubmit} disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin" /> : "Confirm & Save Receipt"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
