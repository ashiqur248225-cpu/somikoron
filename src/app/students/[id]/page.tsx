
"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, serverTimestamp, updateDoc, setDoc, getDoc, arrayUnion, increment, collection, deleteDoc } from "firebase/firestore"
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
  UtensilsCrossed
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
  DialogFooter
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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function StudentDetailsPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(paramsPromise)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isLogMealDialogOpen, setIsLogMealDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [useAdvanceBalance, setUseAdvanceBalance] = useState(false)
  
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

  const [exitPayment, setExitPayment] = useState({ amount: "0", method: "cash", receiver: "", description: "" })
  
  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const studentRef = useMemoFirebase(() => id ? doc(db, "students", id) : null, [db, id])
  const { data: student, isLoading: studentLoading } = useDoc(studentRef)

  const mealRateRef = useMemoFirebase(() => doc(db, "configs", "mealRate"), [db])
  const { data: mealRateConfig } = useDoc(mealRateRef)
  const currentMealRate = mealRateConfig?.rate || 0

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'payment') setIsPaymentDialogOpen(true)
    if (action === 'meals') setIsLogMealDialogOpen(true)
  }, [searchParams])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        e.preventDefault();
        const container = target.closest('[role="dialog"]') || target.closest('.space-y-4');
        if (container) {
          const focusables = Array.from(container.querySelectorAll('input, button, [role="combobox"], textarea')) as HTMLElement[];
          const index = focusables.indexOf(target);
          if (index > -1 && index < focusables.length - 1) {
            focusables[index + 1].focus();
          }
        }
      }
    }
  };

  const financialStats = useMemo(() => {
    if (!student) return { rentDue: 0, foodBalance: 0, monthsElapsed: 0, monthsList: [] }
    
    const billingStart = student.billingStartDate ? new Date(student.billingStartDate) : (student.createdAt?.toDate?.() || new Date())
    const now = new Date()
    const endDate = student.isActive ? now : (student.leftAt?.toDate?.() || now)
    
    const monthsList: any[] = []
    let tempDate = new Date(billingStart.getFullYear(), billingStart.getMonth(), 1)
    const endCompare = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

    while (tempDate <= endCompare) {
      monthsList.push({
        month: MONTHS[tempDate.getMonth()],
        year: tempDate.getFullYear().toString(),
        charge: student.monthlyRent || 0,
        paid: 0,
        status: 'Unpaid'
      })
      tempDate.setMonth(tempDate.getMonth() + 1)
    }

    const historicalRentDue = Number(student.dueAmount) || 0
    const totalRentPaid = student.paymentsHistory?.reduce((acc: number, curr: any) => {
      const isRefund = curr.type === 'refund'
      const rentPortion = (curr.seatAmount !== undefined) ? Number(curr.seatAmount) : (student.paymentSystem === 'package' ? Number(curr.amount) : 0)
      return acc + (isRefund ? -rentPortion : rentPortion)
    }, 0) || 0

    let remainingPool = totalRentPaid - historicalRentDue
    monthsList.forEach(m => {
      if (remainingPool >= m.charge) {
        m.paid = m.charge
        m.status = 'Paid'
        remainingPool -= m.charge
      } else if (remainingPool > 0) {
        m.paid = remainingPool
        m.status = 'Partial'
        remainingPool = 0
      } else {
        m.paid = 0
        m.status = 'Unpaid'
      }
    })

    const monthsElapsed = monthsList.length
    const generatedRent = monthsElapsed * (student.monthlyRent || 0)
    const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

    const historicalFoodDue = Number(student.foodDueAmount) || 0
    const generatedFoodCost = student.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
    const totalFoodPaid = student.paymentsHistory?.reduce((acc: number, curr: any) => {
      const isRefund = curr.type === 'refund'
      const foodPortion = (curr.foodAmount !== undefined) ? Number(curr.foodAmount) : (student.paymentSystem === 'non-package' ? Number(curr.amount) : 0)
      return acc + (isRefund ? -foodPortion : foodPortion)
    }, 0) || 0
    const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)

    return { rentDue, foodBalance, monthsElapsed, monthsList: monthsList.reverse() }
  }, [student])

  const exitSettlement = useMemo(() => {
    if (!student) return { advance: 0, rentDue: 0, foodBalance: 0, finalBalance: 0, mode: 'none' }
    const advance = student.advanceAmount || 0
    const rentDue = financialStats.rentDue || 0
    const foodBalance = student.paymentSystem === 'non-package' ? financialStats.foodBalance : 0
    const balance = (advance + foodBalance) - rentDue
    return { advance, rentDue, foodBalance, finalBalance: balance, mode: balance >= 0 ? 'refund' : 'deficit' }
  }, [student, financialStats])

  const currentExitDeficit = Math.max(0, -exitSettlement.finalBalance)
  const remainingDueAtExit = Math.max(0, currentExitDeficit - Number(exitPayment.amount))
  const canConfirmExit = exitSettlement.mode === 'refund' || remainingDueAtExit <= 0;

  const handleDeactivate = async () => {
    if (!student || !student.isActive || !studentRef || !canConfirmExit) return
    setIsUpdating(true)
    try {
      const settlementRecords = []
      const manualAmt = Number(exitPayment.amount)
      if (manualAmt > 0) {
        const isRefund = exitSettlement.mode === 'refund'
        const manualRecord = {
          amount: manualAmt, buildingId: student.buildingId, buildingName: student.buildingName, studentName: student.name, studentId: student.id, roomNumber: student.roomNumber,
          type: isRefund ? "refund" : "income", month: MONTHS[new Date().getMonth()], year: new Date().getFullYear().toString(),
          method: exitPayment.method, receiver: exitPayment.receiver, description: isRefund ? `Refund at Exit: ${exitPayment.description}` : `Exit Payment: ${exitPayment.description}`,
          date: new Date().toISOString()
        }
        settlementRecords.push(manualRecord)
        if (isRefund) {
          const expId = doc(collection(db, "expenses")).id
          await setDoc(doc(db, "expenses", expId), { ...manualRecord, id: expId, category: "others", expenseDate: new Date().toISOString().split('T')[0], expensePartyName: student.name, createdAt: serverTimestamp() })
        } else {
          const pId = doc(collection(db, "payments")).id
          await setDoc(doc(db, "payments", pId), { ...manualRecord, date: serverTimestamp(), createdAt: serverTimestamp() })
        }
      }
      await updateDoc(studentRef, { isActive: false, advanceAmount: 0, paymentsHistory: arrayUnion(...settlementRecords), updatedAt: serverTimestamp(), leftAt: serverTimestamp(), exitNote: exitPayment.description })
      
      const bRef = doc(db, "buildings", student.buildingId)
      const bSnap = await getDoc(bRef)
      if (bSnap.exists()) {
        const bData = bSnap.data()
        const updatedApts = bData.apartmentsDetail.map((apt: any) => {
          if (apt.name === student.apartmentName) {
            return { ...apt, rooms: apt.rooms.map((room: any) => { if (room.roomNo === student.roomNumber) { return { ...room, seats: room.seats.map((seat: any) => seat.seatNo === student.seatNumber ? { ...seat, status: 'empty' } : seat) } } return room }) }
          }
          return apt
        })
        await updateDoc(bRef, { apartmentsDetail: updatedApts, occupiedSeats: increment(-1), emptySeats: increment(1) })
      }
      toast({ title: "Settled & Deactivated", description: "Resident vacated seat." })
      setIsUpdating(false)
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message })
      setIsUpdating(false)
    }
  }

  const handlePaymentSubmit = async () => {
    if (!student || !studentRef) return
    const seatPaid = student.paymentSystem === 'package' ? Number(paymentData.amount) : Number(paymentData.seatAmount)
    const foodPaid = student.paymentSystem === 'non-package' ? Number(paymentData.foodAmount) : 0
    const addAdvance = Number(paymentData.addAdvanceAmount)
    const totalCashAmount = seatPaid + foodPaid + addAdvance
    
    setIsUpdating(true)
    try {
      const pRecord = { 
        id: doc(collection(db, "payments")).id,
        amount: totalCashAmount, 
        seatAmount: seatPaid, 
        foodAmount: foodPaid, 
        advanceAmount: addAdvance, 
        buildingId: student.buildingId, 
        buildingName: student.buildingName, 
        studentName: student.name, 
        studentId: student.id, 
        roomNumber: student.roomNumber,
        type: "income", 
        month: paymentData.month, 
        year: paymentData.year, 
        method: useAdvanceBalance ? "advance_deduction" : paymentData.method, 
        receiver: useAdvanceBalance ? "System (Advance Deduction)" : paymentData.receiver, 
        description: paymentData.description, 
        date: new Date().toISOString() 
      }
      
      if (!useAdvanceBalance && totalCashAmount > 0) { 
        await setDoc(doc(db, "payments", pRecord.id), { ...pRecord, date: serverTimestamp() }) 
      }
      
      await updateDoc(studentRef, { 
        paymentsHistory: arrayUnion(pRecord), 
        advanceAmount: increment((useAdvanceBalance ? -(seatPaid + foodPaid) : addAdvance)), 
        ...(student.paymentSystem === 'non-package' && foodPaid > 0 && { foodCost: increment(foodPaid) }), 
        updatedAt: serverTimestamp() 
      })
      
      toast({ title: "Success", description: "Payment processed." })
      setIsPaymentDialogOpen(false)
      setIsUpdating(false)
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message })
      setIsUpdating(false)
    }
  }

  const handleLogMealSubmit = async () => {
    if (!student || !studentRef || !mealLogData.count) return
    setIsUpdating(true)
    const count = Number(mealLogData.count)
    const totalCost = count * currentMealRate

    try {
      await updateDoc(studentRef, {
        mealsHistory: arrayUnion({
          month: `${mealLogData.month} ${mealLogData.year}`,
          totalMeals: count,
          perMealCost: currentMealRate,
          totalCost: totalCost,
          date: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Meals Logged", description: `Recorded ${count} meals for ${mealLogData.month}.` })
      setIsLogMealDialogOpen(false)
      setIsUpdating(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
      setIsUpdating(false)
    }
  }

  if (studentLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
  if (!student) return <div className="text-center p-20">Student not found.</div>

  return (
    <div className="space-y-6 pb-20 relative">
      <div className="flex flex-col md:flex-row justify-between gap-4">
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
        <div className="flex gap-2 items-center">
          {student.isActive && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive" className="flex gap-2" disabled={isUpdating}><UserMinus size={18} /> Mark as Left</Button></AlertDialogTrigger>
              <AlertDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <AlertDialogHeader>
                  <AlertDialogTitle>Resident Exit Settlement</AlertDialogTitle>
                  <div className="mt-4 space-y-4">
                    <div className="bg-secondary/50 p-4 rounded-lg space-y-2 border text-xs">
                      <div className="flex justify-between"><span>Available Advance:</span><span className="font-bold text-primary">৳{exitSettlement.advance.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Rent Due:</span><span className="font-bold text-destructive">৳{exitSettlement.rentDue.toLocaleString()}</span></div>
                      {student.paymentSystem === 'non-package' && (<div className="flex justify-between"><span>Food Balance:</span><span className={cn("font-bold", exitSettlement.foodBalance >= 0 ? "text-success" : "text-destructive")}>৳{Math.abs(exitSettlement.foodBalance).toLocaleString()}</span></div>)}
                      <Separator /><div className="flex justify-between font-bold text-sm pt-1"><span>{exitSettlement.mode === 'refund' ? 'Net Refundable:' : 'Net Deficit (Owed):'}</span><span className={exitSettlement.mode === 'refund' ? 'text-success' : 'text-destructive'}>৳{Math.abs(exitSettlement.finalBalance).toLocaleString()}</span></div>
                    </div>
                    <div className="p-4 border-2 border-primary/20 rounded-xl space-y-4 bg-primary/5">
                       <Label className="font-bold text-primary flex items-center gap-2"><Calculator size={14} /> {exitSettlement.mode === 'refund' ? 'Refund Details' : 'Final Settlement Payment'}</Label>
                       <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">{exitSettlement.mode === 'refund' ? 'Refunded to Student (৳)' : 'Payment Received Now (৳)'}</Label><Input type="number" value={exitPayment.amount} onChange={e => setExitPayment({...exitPayment, amount: e.target.value})}/></div>
                       {exitSettlement.mode === 'deficit' && remainingDueAtExit > 0 && (<div className="p-3 bg-white rounded border text-[9px] text-destructive flex items-center gap-1"><AlertCircle size={8}/> বকেয়া বাকি থাকলে এক্সিট করা যাবে না। (Remaining: ৳{remainingDueAtExit})</div>)}
                       {Number(exitPayment.amount) > 0 && (
                         <div className="grid grid-cols-2 gap-3">
                           <div className="space-y-1">
                             <Label className="text-[10px] uppercase font-bold">Method</Label>
                             <Select value={exitPayment.method} onValueChange={val => setExitPayment({...exitPayment, method: val})}>
                               <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                               <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                             </Select>
                           </div>
                           <div className="space-y-1">
                             <Label className="text-[10px] uppercase font-bold">Receiver</Label>
                             <Select value={exitPayment.receiver} onValueChange={val => setExitPayment({...exitPayment, receiver: val})}>
                               <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Staff" /></SelectTrigger>
                               <SelectContent>{staffList?.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                             </Select>
                           </div>
                         </div>
                       )}
                       <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Exit Note</Label><Textarea className="text-xs min-h-[60px]" value={exitPayment.description} onChange={e => setExitPayment({...exitPayment, description: e.target.value})}/></div>
                    </div>
                  </div>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-4">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeactivate} className={cn("bg-destructive", !canConfirmExit && "opacity-50 cursor-not-allowed")} disabled={!canConfirmExit || isUpdating}>
                    {isUpdating ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle size={16} className="mr-2" />}Confirm Settlement & Exit
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="ghost" onClick={() => router.push("/students")}>Back</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-lg">Contact & Location</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm"><Phone className="text-primary" size={16} /><span className="font-bold">{student.phone}</span></div>
            <div className="flex items-center gap-3 text-sm"><Building2 className="text-primary" size={16} /><span className="font-semibold">{student.buildingName}</span></div>
            <div className="flex items-center gap-3 text-sm"><BedDouble className="text-primary" size={16} /><span>Room {student.roomNumber} | Seat {student.seatNumber}</span></div>
            <div className="flex items-center gap-3 text-sm"><Calendar className="text-primary" size={16} /><span>Billing Start: {student.billingStartDate || 'N/A'}</span></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm md:col-span-2">
          <CardHeader><CardTitle className="text-lg">Financial Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <p className="text-[10px] uppercase text-orange-600 font-bold">Monthly Rent</p>
                <p className="text-lg font-bold text-orange-600">৳{student.monthlyRent}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20"><p className="text-[10px] uppercase text-primary font-bold">Advance Pool</p><p className="text-lg font-bold">৳{student.advanceAmount || 0}</p></div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-secondary"><p className="text-[10px] uppercase text-muted-foreground font-bold">Service Charge</p><p className="text-lg font-bold">৳{student.serviceCharge || 0}</p></div>
              
              {financialStats.rentDue > 0 && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-[10px] uppercase text-destructive font-bold">Total Rent Due</p>
                  <p className="text-lg font-bold text-destructive">৳{financialStats.rentDue.toLocaleString()}</p>
                </div>
              )}
              
              {student.paymentSystem === 'non-package' && (
                <div className={cn("p-3 rounded-lg border", financialStats.foodBalance >= 0 ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20")}>
                  <p className={cn("text-[10px] uppercase font-bold", financialStats.foodBalance >= 0 ? "text-success" : "text-destructive")}>Food Balance</p>
                  <p className="text-lg font-bold">৳{financialStats.foodBalance.toLocaleString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-4">
          <TabsTrigger value="payments" className="flex gap-2"><CreditCard size={14} /> Payments</TabsTrigger>
          <TabsTrigger value="dues" className="flex gap-2"><Clock size={14} /> Dues Breakdown</TabsTrigger>
          {student.paymentSystem === 'non-package' && <TabsTrigger value="meals" className="flex gap-2"><Utensils size={14} /> Meals History</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="payments">
          <Card className="border-none shadow-sm"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Period</TableHead><TableHead>Method</TableHead><TableHead>Purpose</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{student.paymentsHistory?.map((p: any, idx: number) => (
            <TableRow key={idx}><TableCell className="text-xs">{new Date(p.date).toLocaleDateString()}</TableCell><TableCell className="font-medium">{p.month} {p.year}</TableCell><TableCell><Badge variant="outline" className={cn("text-[10px] uppercase", p.type === 'refund' ? "border-destructive text-destructive" : "")}>{p.type === 'refund' ? 'REFUND' : p.method}</Badge></TableCell><TableCell><span className="text-[10px] text-muted-foreground truncate max-w-[200px] block">{p.description}</span></TableCell><TableCell className={cn("text-right font-bold", p.type === 'refund' ? "text-destructive" : "text-income")}>{p.type === 'refund' ? '-' : ''}৳{p.amount?.toLocaleString()}</TableCell></TableRow>
          ))}{(!student.paymentsHistory || student.paymentsHistory.length === 0) && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No records.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="dues">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-sm">Monthly Rent Payment Status</CardTitle><CardDescription>System calculates payment coverage from joining date.</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Month & Year</TableHead><TableHead>Rent Amount</TableHead><TableHead>Amount Covered</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {financialStats.monthsList.map((m: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{m.month} {m.year}</TableCell>
                      <TableCell>৳{m.charge}</TableCell>
                      <TableCell>৳{m.paid}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={cn(
                          m.status === 'Paid' ? "bg-success" : m.status === 'Partial' ? "bg-orange-500" : "bg-destructive"
                        )}>{m.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {student.paymentSystem === 'non-package' && (
          <TabsContent value="meals">
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Logged Meals History</CardTitle>
                  <CardDescription>Meal entries at ৳{currentMealRate}/meal.</CardDescription>
                </div>
                <Button onClick={() => setIsLogMealDialogOpen(true)} variant="outline" size="sm" className="gap-2">
                  <UtensilsCrossed size={14} /> Log Monthly Meals
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Total Meals</TableHead><TableHead>Rate</TableHead><TableHead className="text-right">Total Cost</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {student.mealsHistory?.map((m: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{m.month}</TableCell>
                        <TableCell className="font-bold">{m.totalMeals}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">৳{m.perMealCost}</TableCell>
                        <TableCell className="text-right font-bold text-destructive">৳{m.totalCost?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {(!student.mealsHistory || student.mealsHistory.length === 0) && <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No meal records found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-2">
        {student.paymentSystem === 'non-package' && (
          <Button onClick={() => setIsLogMealDialogOpen(true)} size="icon" className="h-12 w-12 rounded-full shadow-lg border-2 border-white bg-orange-500 hover:bg-orange-600 transition-colors">
            <Utensils size={20} className="text-white" />
          </Button>
        )}
        <Button onClick={() => setIsPaymentDialogOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg border-2 border-white bg-primary">
          <Plus className="h-8 w-8 text-white" />
        </Button>
      </div>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyDown}>
          <DialogHeader><DialogTitle>Record Transaction for {student.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {student && (
              <div className="bg-secondary/30 p-4 rounded-lg space-y-2 border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Rent:</span>
                  <span className="font-bold">৳{student.monthlyRent}</span>
                </div>
                {financialStats.rentDue > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-destructive font-medium flex items-center gap-1"><AlertCircle size={12}/> Current Due:</span>
                    <span className="font-bold text-destructive">৳{financialStats.rentDue.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex flex-col gap-1 p-2 bg-primary/5 rounded border border-primary/10">
                  <div className="flex justify-between text-xs">
                    <span className="text-primary font-medium">Advance Pool:</span>
                    <span className="font-bold text-primary">৳{student.advanceAmount || 0}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={paymentData.month} onValueChange={val => setPaymentData({...paymentData, month: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={paymentData.method} onValueChange={val => setPaymentData({...paymentData, method: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {student.paymentSystem === 'package' ? (
              <div className="space-y-2"><Label>Amount (৳)</Label><Input type="number" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} placeholder="0.00" /></div>
            ) : (
              <div className="grid grid-cols-2 gap-4 p-3 bg-secondary/10 rounded-lg border">
                <div className="space-y-2"><Label className="text-xs">Seat Rent</Label><Input type="number" value={paymentData.seatAmount} onChange={e => setPaymentData({...paymentData, seatAmount: e.target.value})} placeholder="0.00" /></div>
                <div className="space-y-2"><Label className="text-xs">Food Credit</Label><Input type="number" value={paymentData.foodAmount} onChange={e => setPaymentData({...paymentData, foodAmount: e.target.value})} placeholder="0.00" /></div>
              </div>
            )}
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 space-y-2">
              <Label className="text-xs font-bold text-primary flex items-center gap-1"><Plus size={12}/> Add to Advance Pool (৳)</Label>
              <Input type="number" value={paymentData.addAdvanceAmount} onChange={e => setPaymentData({...paymentData, addAdvanceAmount: e.target.value})} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Receiver</Label>
              <Select value={paymentData.receiver} onValueChange={val => setPaymentData({...paymentData, receiver: val})}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{staffList?.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Textarea value={paymentData.description} onChange={e => setPaymentData({...paymentData, description: e.target.value})} placeholder="Notes..." />
          </div>
          <DialogFooter>
            <Button onClick={handlePaymentSubmit} className="w-full h-12 text-lg" disabled={isUpdating}>
              {isUpdating ? <Loader2 className="animate-spin" /> : "Confirm Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLogMealDialogOpen} onOpenChange={setIsLogMealDialogOpen}>
        <DialogContent className="max-w-sm" onKeyDown={handleKeyDown}>
          <DialogHeader><DialogTitle>Log Monthly Meals</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-orange-500/5 p-3 rounded-lg border border-orange-500/20 text-xs flex justify-between">
              <span className="text-orange-600 font-medium">Standard Meal Rate:</span>
              <span className="font-bold">৳{currentMealRate}/meal</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={mealLogData.month} onValueChange={val => setMealLogData({...mealLogData, month: val})}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={mealLogData.year} onValueChange={val => setMealLogData({...mealLogData, year: val})}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{["2024", "2025", "2026"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Total Meal Count</Label>
              <Input type="number" value={mealLogData.count} onChange={e => setMealLogData({...mealLogData, count: e.target.value})} placeholder="e.g. 60" />
            </div>
            {Number(mealLogData.count) > 0 && (
              <div className="p-3 bg-secondary/50 rounded-lg border flex justify-between items-center">
                <span className="text-xs font-medium">Calculated Cost:</span>
                <span className="text-lg font-bold text-destructive">৳{(Number(mealLogData.count) * currentMealRate).toLocaleString()}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleLogMealSubmit} className="w-full bg-orange-500 hover:bg-orange-600" disabled={isUpdating || !mealLogData.count}>
              {isUpdating ? <Loader2 className="animate-spin" /> : "Save Meal Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
