
"use client"

import * as React from "react"
import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  UtensilsCrossed,
  ChevronLeft,
  ArrowDownRight,
  ArrowUpRight,
  Info,
  Banknote,
  Smartphone,
  Landmark,
  ShieldCheck
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
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

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

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const studentRef = useMemoFirebase(() => id ? doc(db, "students", id) : null, [db, id])
  const { data: student, isLoading: studentLoading } = useDoc(studentRef)

  const mealRateRef = useMemoFirebase(() => doc(db, "configs", "mealRate"), [db])
  const { data: mealRateConfig } = useDoc(mealRateRef)
  const currentMealRate = mealRateConfig?.rate || 0

  useEffect(() => {
    const action = resolvedSearchParams.action
    if (action === 'payment') setIsPaymentDialogOpen(true)
    if (action === 'meals') setIsLogMealDialogOpen(true)
  }, [resolvedSearchParams])

  const financialStats = useMemo(() => {
    if (!student) return { rentDue: 0, foodBalance: 0, monthsList: [], usableAdvance: 0, totalDue: 0 }
    
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
    const lockedAdvance = student.monthlyRent || 0
    const usableAdvance = Math.max(0, (student.advanceAmount || 0) - lockedAdvance)

    return { rentDue, foodBalance, monthsList: sortedAlloc.reverse(), usableAdvance, totalDue }
  }, [student])

  useEffect(() => {
    if (student && isExitDialogOpen) {
      const net = (student.advanceAmount || 0) - financialStats.totalDue
      if (net > 0) {
        setExitSettlement(prev => ({ ...prev, refundAmount: net.toString(), collectAmount: "0" }))
      } else {
        setExitSettlement(prev => ({ ...prev, collectAmount: Math.abs(net).toString(), refundAmount: "0" }))
      }
    }
  }, [student, isExitDialogOpen, financialStats.totalDue])

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
        id: pId,
        amount: totalCashAmount, 
        seatAmount: seatPaid, 
        foodAmount: foodPaid, 
        advanceAmount: addAdvance, 
        buildingId: student.buildingId, 
        buildingName: student.buildingName, 
        studentName: student.name, 
        studentId: student.id, 
        roomNumber: student.roomNumber,
        branch: student.branch,
        type: "income", 
        month: paymentData.month, 
        year: paymentData.year, 
        method: paymentData.method, 
        receiver: paymentData.receiver, 
        description: paymentData.description || `Payment for ${paymentData.month} ${paymentData.year}`, 
        date: new Date().toISOString() 
      }
      
      if (totalCashAmount > 0) { 
        await setDoc(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp() }) 
      }
      
      const mKey = `${paymentData.month} ${paymentData.year}`
      const currentMap = student.duesBreakdown || {}
      if (seatPaid > 0 && currentMap[mKey] !== undefined) {
        currentMap[mKey] = Math.max(0, currentMap[mKey] - seatPaid)
        if (currentMap[mKey] === 0) delete currentMap[mKey]
      }

      await updateDoc(studentRef, { 
        paymentsHistory: arrayUnion(pRecord), 
        advanceAmount: increment(addAdvance),
        duesBreakdown: currentMap,
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
    try {
      const count = Number(mealLogData.count)
      const cost = count * currentMealRate
      const mealRecord = {
        month: `${mealLogData.month} ${mealLogData.year}`,
        totalMeals: count,
        perMealCost: currentMealRate,
        totalCost: cost,
        date: new Date().toISOString()
      }
      await updateDoc(studentRef, {
        mealsHistory: arrayUnion(mealRecord),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Success", description: "Meals logged." })
      setIsLogMealDialogOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleConfirmExit = async () => {
    if (!student || !studentRef) return
    if (!exitSettlement.staffName) {
      toast({ variant: "destructive", title: "Error", description: "Please select who processed this exit." })
      return
    }

    setIsUpdating(true)
    try {
      const refund = Number(exitSettlement.refundAmount) || 0
      const collect = Number(exitSettlement.collectAmount) || 0

      if (refund > 0) {
        const expId = doc(collection(db, "expenses")).id
        await setDoc(doc(db, "expenses", expId), {
          id: expId,
          amount: refund,
          category: "others",
          buildingId: student.buildingId,
          buildingName: student.buildingName,
          expensePartyName: student.name,
          receiver: student.name,
          method: exitSettlement.method,
          expenseDate: new Date().toISOString().split('T')[0],
          description: `Security/Advance Refund on Exit. Processed by ${exitSettlement.staffName}. ${exitSettlement.description}`,
          branch: student.branch,
          createdAt: serverTimestamp()
        })
      }

      if (collect > 0) {
        const pId = doc(collection(db, "payments")).id
        await setDoc(doc(db, "payments", pId), {
          id: pId,
          amount: collect,
          studentId: student.id,
          studentName: student.name,
          buildingId: student.buildingId,
          buildingName: student.buildingName,
          roomNumber: student.roomNumber,
          type: "income",
          method: exitSettlement.method,
          receiver: exitSettlement.staffName,
          description: `Outstanding Dues Collection on Exit. ${exitSettlement.description}`,
          date: serverTimestamp(),
          branch: student.branch,
          createdAt: serverTimestamp()
        })
      }

      const bRef = doc(db, "buildings", student.buildingId)
      const bSnap = await getDoc(bRef)
      if (bSnap.exists()) {
        const bData = bSnap.data()
        const updatedApts = bData.apartmentsDetail.map((apt: any) => {
          if (apt.name === student.apartmentName) {
            return {
              ...apt,
              rooms: apt.rooms.map((room: any) => {
                if (room.roomNo === student.roomNumber) {
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
        advanceAmount: 0, 
        duesBreakdown: {}, 
        updatedAt: serverTimestamp() 
      })

      toast({ title: "Settlement Complete", description: `${student.name} has officially left. Records updated.` })
      setIsExitDialogOpen(false)
      router.push("/students")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  if (studentLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
  if (!student) return <div className="text-center p-20">Student not found.</div>

  return (
    <div className="space-y-6 pb-20 relative">
      {/* Mobile App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
          <ChevronLeft size={24} />
        </Button>
        <div className="flex-1 overflow-hidden">
          <h1 className="text-lg font-bold truncate">{student.name}</h1>
        </div>
        <div className="flex items-center gap-1">
          {student.isActive && (
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setIsExitDialogOpen(true)}>
              <UserMinus size={20} />
            </Button>
          )}
        </div>
      </div>

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
        <div className="flex gap-2 items-center">
          {student.isActive && (
            <Button variant="destructive" className="flex gap-2" onClick={() => setIsExitDialogOpen(true)} disabled={isUpdating}>
              <UserMinus size={18} /> Mark as Left
            </Button>
          )}
          <Button variant="ghost" onClick={() => router.push("/students")}>Back</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm h-fit">
          <CardHeader><CardTitle className="text-lg">Contact & Location</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm"><Phone className="text-primary" size={16} /><span className="font-bold">{student.phone}</span></div>
            <div className="flex items-center gap-3 text-sm"><Building2 className="text-primary" size={16} /><span className="font-semibold">{student.buildingName}</span></div>
            <div className="flex items-center gap-3 text-sm"><BedDouble className="text-primary" size={16} /><span>Room {student.roomNumber} | Seat {student.seatNumber}</span></div>
            <div className="flex items-center gap-3 text-sm"><Calendar className="text-primary" size={16} /><span>Billing Start: {student.billingStartDate || 'N/A'}</span></div>
            
            <div className="md:hidden flex flex-wrap gap-2 pt-2 border-t mt-2">
              <Badge variant={student.isActive ? "default" : "destructive"} className={student.isActive ? "bg-success text-[10px]" : "text-[10px]"}>{student.isActive ? "Active Resident" : "Ex-Resident"}</Badge>
              <Badge variant="outline" className="capitalize text-[10px]">{student.paymentSystem} Plan</Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-lg">Financial Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <p className="text-[10px] uppercase text-orange-600 font-bold">Monthly Rent</p>
                <p className="text-lg font-bold text-orange-600">৳{student.monthlyRent}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-[10px] uppercase text-primary font-bold">Advance Pool</p>
                <p className="text-lg font-bold">৳{student.advanceAmount || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-secondary">
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Service Charge</p>
                <p className="text-lg font-bold">৳{student.serviceCharge || 0}</p>
              </div>
              
              <div className={cn("p-3 rounded-lg border", financialStats.rentDue > 0 ? "bg-destructive/10 border-destructive/20" : "bg-success/10 border-success/20")}>
                <p className={cn("text-[10px] uppercase font-bold", financialStats.rentDue > 0 ? "text-destructive" : "text-success")}>Total Rent Due</p>
                <p className="text-lg font-bold">৳{financialStats.rentDue.toLocaleString()}</p>
              </div>
              
              {student.paymentSystem === 'non-package' && (
                <div className={cn("p-3 rounded-lg border md:col-span-2", financialStats.foodBalance >= 0 ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20")}>
                  <p className={cn("text-[10px] uppercase font-bold", financialStats.foodBalance >= 0 ? "text-success" : "text-destructive")}>Food Balance</p>
                  <p className="text-lg font-bold">৳{financialStats.foodBalance.toLocaleString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-4 flex w-full md:w-auto">
          <TabsTrigger value="payments" className="flex-1 md:flex-none gap-2 text-[10px] md:text-sm"><CreditCard size={14} /> Payments</TabsTrigger>
          <TabsTrigger value="dues" className="flex-1 md:flex-none gap-2 text-[10px] md:text-sm"><Clock size={14} /> Dues</TabsTrigger>
          {student.paymentSystem === 'non-package' && <TabsTrigger value="meals" className="flex-1 md:flex-none gap-2 text-[10px] md:text-sm"><Utensils size={14} /> Meals</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="payments">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.paymentsHistory?.map((p: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs">{new Date(p.date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{p.month} {p.year}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] uppercase">{p.method}</Badge></TableCell>
                        <TableCell><span className="text-[10px] text-muted-foreground truncate max-w-[200px] block">{p.description}</span></TableCell>
                        <TableCell className="text-right font-bold text-income">৳{p.amount?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {(!student.paymentsHistory || student.paymentsHistory.length === 0) && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No records.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-3 p-4">
                {student.paymentsHistory?.map((p: any, idx: number) => (
                  <div key={idx} className="bg-secondary/20 p-3 rounded-xl border border-secondary flex justify-between items-center">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(p.date).toLocaleDateString()}</p>
                      <p className="text-sm font-black text-slate-800">{p.month} {p.year}</p>
                      <Badge variant="outline" className="text-[8px] h-4 uppercase">{p.method}</Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-income">৳{p.amount?.toLocaleString()}</p>
                      <p className="text-[8px] text-muted-foreground italic truncate max-w-[100px]">{p.description}</p>
                    </div>
                  </div>
                ))}
                {(!student.paymentsHistory || student.paymentsHistory.length === 0) && <p className="text-center py-12 text-muted-foreground italic text-sm">No records found.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dues">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-sm">Monthly Rent Status</CardTitle>
              <CardDescription className="text-xs">Real-time calculation based on payments and dues map.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month & Year</TableHead>
                      <TableHead>Rent Amount</TableHead>
                      <TableHead>Amount Covered</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialStats.monthsList.map((m: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{m.month} {m.year} {m.isHistorical && <Badge variant="secondary" className="text-[8px] h-4">Historical</Badge>}</TableCell>
                        <TableCell>৳{m.charge}</TableCell>
                        <TableCell>৳{m.paid}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={cn(
                            m.status === 'Paid' ? "bg-success text-white" : m.status === 'Partial' ? "bg-orange-500 text-white" : "bg-destructive text-white"
                          )}>{m.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-3 p-4">
                {financialStats.monthsList.map((m: any, idx: number) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border flex justify-between items-center shadow-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">{m.month} {m.year}</p>
                        {m.isHistorical && <Badge variant="secondary" className="text-[7px] h-3.5 px-1 uppercase">Hist</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                        <span>Charge: ৳{m.charge}</span>
                        <span>•</span>
                        <span className="text-income">Paid: ৳{m.paid}</span>
                      </div>
                    </div>
                    <Badge className={cn(
                      "text-[8px] h-5 px-1.5 font-bold uppercase",
                      m.status === 'Paid' ? "bg-success" : m.status === 'Partial' ? "bg-orange-500" : "bg-destructive"
                    )}>{m.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {student.paymentSystem === 'non-package' && (
          <TabsContent value="meals">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between p-4 md:p-6">
                <div>
                  <CardTitle className="text-sm">Meals History</CardTitle>
                  <CardDescription className="text-[10px] md:text-xs">৳{currentMealRate}/meal</CardDescription>
                </div>
                <Button onClick={() => setIsLogMealDialogOpen(true)} variant="outline" size="sm" className="h-8 gap-1 text-[10px] md:text-sm">
                  <UtensilsCrossed size={12} /> Log Meals
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Total Meals</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                      </TableRow>
                    </TableHeader>
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
                </div>

                <div className="md:hidden space-y-3 p-4">
                  {student.mealsHistory?.map((m: any, idx: number) => (
                    <div key={idx} className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 flex justify-between items-center shadow-sm">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800">{m.month}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">{m.totalMeals} Meals × ৳{m.perMealCost}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-destructive">৳{m.totalCost?.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                  {(!student.mealsHistory || student.mealsHistory.length === 0) && <p className="text-center py-12 text-muted-foreground italic text-sm">No meal entries found.</p>}
                </div>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Transaction for {student.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-secondary/30 p-4 rounded-xl space-y-3 border">
              <h4 className="text-[10px] font-bold uppercase text-primary flex items-center gap-1.5"><Calculator size={12}/> Current Status</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-2 rounded border">
                  <p className="text-[8px] uppercase font-bold text-muted-foreground">Monthly Rent</p>
                  <p className="text-sm font-bold">৳{student.monthlyRent}</p>
                </div>
                <div className="bg-white p-2 rounded border">
                  <p className="text-[8px] uppercase font-bold text-destructive">Overall Due</p>
                  <p className="text-sm font-bold text-destructive">৳{financialStats.rentDue.toLocaleString()}</p>
                </div>
                <div className="bg-white p-2 rounded border">
                  <p className="text-[8px] uppercase font-bold text-success">Total Advance</p>
                  <p className="text-sm font-bold text-success">৳{student.advanceAmount.toLocaleString()}</p>
                </div>
                <div className="bg-white p-2 rounded border">
                  <p className="text-[8px] uppercase font-bold text-primary">Usable Advance</p>
                  <p className="text-sm font-bold text-primary">৳{financialStats.usableAdvance.toLocaleString()}</p>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground italic flex items-center gap-1"><AlertCircle size={8}/> ১ মাসের ভাড়া অগ্রিম হিসেবে লক করা থাকে।</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={paymentData.month} onValueChange={val => setPaymentData({...paymentData, month: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={paymentData.year} onValueChange={val => setPaymentData({...paymentData, year: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["2024", "2025", "2026"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={paymentData.method} onValueChange={val => setPaymentData({...paymentData, method: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Receiver</Label>
                <Select value={paymentData.receiver} onValueChange={val => setPaymentData({...paymentData, receiver: val})}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>{staffList?.map(s => <SelectItem key={`${student.id}-${s.name}`} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 border-2 border-primary/20 rounded-xl space-y-4 bg-primary/5">
              <Label className="font-bold text-primary flex items-center gap-2"><Calculator size={14} /> Payment Amounts</Label>
              {student.paymentSystem === 'package' ? (
                <div className="space-y-2">
                  <Label className="text-xs">Amount Received (৳)</Label>
                  <Input type="number" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} placeholder="0.00" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-xs">Seat Rent (৳)</Label><Input type="number" value={paymentData.seatAmount} onChange={e => setPaymentData({...paymentData, seatAmount: e.target.value})} placeholder="0.00" /></div>
                  <div className="space-y-2"><Label className="text-xs">Food Credit (৳)</Label><Input type="number" value={paymentData.foodAmount} onChange={e => setPaymentData({...paymentData, foodAmount: e.target.value})} placeholder="0.00" /></div>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-primary">Add to Advance Pool (৳)</Label>
                <Input type="number" value={paymentData.addAdvanceAmount} onChange={e => setPaymentData({...paymentData, addAdvanceAmount: e.target.value})} placeholder="0.00" />
              </div>
            </div>

            <Textarea value={paymentData.description} onChange={e => setPaymentData({...paymentData, description: e.target.value})} placeholder="Notes (Optional)..." />
          </div>
          <DialogFooter>
            <Button onClick={handlePaymentSubmit} className="w-full h-12 text-lg font-bold" disabled={isUpdating}>
              {isUpdating ? <Loader2 className="animate-spin" /> : "Confirm Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLogMealDialogOpen} onOpenChange={setIsLogMealDialogOpen}>
        <DialogContent className="max-w-sm">
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
            <Button onClick={handleLogMealSubmit} className="w-full bg-orange-500 hover:bg-orange-600 font-bold" disabled={isUpdating || !mealLogData.count}>
              {isUpdating ? <Loader2 className="animate-spin" /> : "Save Meal Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserMinus className="text-destructive" /> Resident Exit & Settlement</DialogTitle>
            <DialogDescription>Calculate final dues and advance refund before student leaves.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-destructive/5 border-destructive/10 p-3">
                <Label className="text-[10px] uppercase font-bold text-destructive">Total Dues</Label>
                <p className="text-xl font-black text-destructive">৳{financialStats.totalDue.toLocaleString()}</p>
              </Card>
              <Card className="bg-primary/5 border-primary/10 p-3">
                <Label className="text-[10px] uppercase font-bold text-primary">Advance Pool</Label>
                <p className="text-xl font-black text-primary">৳{(student.advanceAmount || 0).toLocaleString()}</p>
              </Card>
            </div>

            <Separator />

            <div className="bg-secondary/30 p-4 rounded-2xl border space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Calculator size={14} /> Settlement Summary</h4>
              
              {((student.advanceAmount || 0) - financialStats.totalDue) > 0 ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-success/20">
                    <span className="text-xs font-bold text-slate-600">Hostel Owes Student:</span>
                    <span className="text-lg font-black text-success">৳{((student.advanceAmount || 0) - financialStats.totalDue).toLocaleString()}</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Actual Refund Paid (৳)</Label>
                    <div className="relative">
                      <Wallet className="absolute left-3 top-3 h-4 w-4 text-success" />
                      <Input type="number" value={exitSettlement.refundAmount} onChange={e => setExitSettlement({...exitSettlement, refundAmount: e.target.value})} className="pl-10 h-11 border-success/30 bg-success/5 font-bold text-success" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-destructive/20">
                    <span className="text-xs font-bold text-slate-600">Student Owes Hostel:</span>
                    <span className="text-lg font-black text-destructive">৳{Math.abs((student.advanceAmount || 0) - financialStats.totalDue).toLocaleString()}</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Actual Amount Collected (৳)</Label>
                    <div className="relative">
                      <ArrowUpRight className="absolute left-3 top-3 h-4 w-4 text-primary" />
                      <Input type="number" value={exitSettlement.collectAmount} onChange={e => setExitSettlement({...exitSettlement, collectAmount: e.target.value})} className="pl-10 h-11 border-primary/30 bg-primary/5 font-bold text-primary" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase">Method</Label>
                  <Select value={exitSettlement.method} onValueChange={val => setExitSettlement({...exitSettlement, method: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bkash">Bkash</SelectItem>
                      <SelectItem value="nagad">Nagad</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase">Processed By</Label>
                  <Select value={exitSettlement.staffName} onValueChange={val => setExitSettlement({...exitSettlement, staffName: val})}>
                    <SelectTrigger><SelectValue placeholder="Staff Name" /></SelectTrigger>
                    <SelectContent>
                      {staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase">Notes / Reason</Label>
                <Textarea value={exitSettlement.description} onChange={e => setExitSettlement({...exitSettlement, description: e.target.value})} placeholder="Any additional comments..." className="min-h-[80px]" />
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[10px] text-amber-700 flex gap-2">
              <Info className="shrink-0" size={14} />
              <p>Confirming this will vacate <b>Room {student.roomNumber} Seat {student.seatNumber}</b> and record any financial transaction in your accounting history.</p>
            </div>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={() => setIsExitDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmExit} disabled={isUpdating} className="bg-destructive hover:bg-destructive/90 font-bold">
              {isUpdating ? <Loader2 className="animate-spin" /> : <><ShieldCheck size={16} className="mr-2"/> Confirm Exit</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
