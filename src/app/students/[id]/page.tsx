
"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, serverTimestamp, updateDoc, setDoc, getDoc, arrayUnion, increment, collection, Timestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  UserCircle, Phone, MapPin, Building2, 
  BedDouble, CreditCard, Utensils,
  Loader2, Calculator,
  Contact, Plus, UserMinus, Wallet,
  UserPlus, AlertCircle, CheckCircle,
  ArrowDownToLine
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
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
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)
  const [useAdvanceBalance, setUseAdvanceBalance] = useState(false)
  
  // States for Meal Logging
  const [logMonth, setLogMonth] = useState(new Date().toLocaleString('default', { month: 'long' }))
  const [logCount, setLogCount] = useState("")

  // Staff Data
  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)
  const [newStaff, setNewStaff] = useState({ name: "", phone: "" })

  // Global Config Data (Meal Rate)
  const configRef = useMemoFirebase(() => doc(db, "configs", "mealRate"), [db])
  const { data: config } = useDoc(configRef)
  const globalMealRate = config?.rate || 0

  // Payment State
  const [paymentData, setPaymentData] = useState({
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    amount: "", // Used for package
    seatAmount: "", // Used for non-package
    foodAmount: "", // Used for non-package
    method: "cash",
    receiver: "",
    description: ""
  })

  // Fetch Student Data
  const studentRef = useMemoFirebase(() => id ? doc(db, "students", id) : null, [db, id])
  const { data: student, isLoading: studentLoading } = useDoc(studentRef)

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // --- FINANCIAL CALCULATIONS ---

  // 1. Food Balance (For Non-Package) - Running Balance Concept
  const foodStats = useMemo(() => {
    if (!student || student.paymentSystem === 'package') return { bill: 0, balance: 0, debt: 0, surplus: 0 }
    
    const totalBill = student.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
    const totalPaid = Number(student.foodCost) || 0 // Cumulative payments for food
    const balance = totalPaid - totalBill
    
    return {
      bill: totalBill,
      paid: totalPaid,
      balance: balance,
      debt: balance < 0 ? Math.abs(balance) : 0,
      surplus: balance > 0 ? balance : 0
    }
  }, [student])

  // 2. Monthly Rent Breakdown (Auto-accumulation)
  const dueBreakdown = useMemo(() => {
    if (!student) return []
    const results = []
    const joinDate = student.createdAt?.toDate?.() || new Date()
    const joinMonth = joinDate.getMonth()
    const joinYear = joinDate.getFullYear()
    
    const now = new Date()
    let checkDate = new Date(joinYear, joinMonth, 1)
    
    while (checkDate <= now) {
      const mName = months[checkDate.getMonth()]
      const yName = checkDate.getFullYear().toString()
      
      const monthPayments = student.paymentsHistory?.filter((p: any) => p.month === mName && p.year === yName) || []
      const totalPaidForMonth = monthPayments.reduce((acc: number, curr: any) => {
        return acc + (curr.seatAmount || (student.paymentSystem === 'package' ? curr.amount : 0) || 0)
      }, 0)
      
      const monthlyRent = student.monthlyRent || 0
      
      results.push({
        month: mName,
        year: yName,
        status: totalPaidForMonth >= monthlyRent ? 'Paid' : (totalPaidForMonth > 0 ? 'Partial' : 'Unpaid'),
        paidAmount: totalPaidForMonth,
        expected: monthlyRent,
        due: Math.max(0, monthlyRent - totalPaidForMonth)
      })
      
      checkDate.setMonth(checkDate.getMonth() + 1)
    }
    
    return results.reverse()
  }, [student])

  const totalRentDue = useMemo(() => {
    if (!student) return 0
    const totalExpected = dueBreakdown.reduce((acc, curr) => acc + curr.expected, 0)
    const totalPaid = student.paymentsHistory?.reduce((acc: number, curr: any) => {
      return acc + (curr.seatAmount || (student.paymentSystem === 'package' ? curr.amount : 0) || 0)
    }, 0) || 0
    
    const startingDebt = student.type === 'old' ? (Number(student.dueAmount) || 0) : 0
    
    return Math.max(0, (totalExpected + startingDebt) - totalPaid)
  }, [student, dueBreakdown])

  const totalDueAmount = useMemo(() => {
    return totalRentDue + (foodStats.debt || 0)
  }, [totalRentDue, foodStats.debt])

  const availableAdvanceForDeduction = useMemo(() => {
    if (!student) return 0
    const currentAdvance = student.advanceAmount || 0
    const minRequired = student.monthlyRent || 0
    return Math.max(0, currentAdvance - minRequired)
  }, [student])

  // --- ACTIONS ---

  const handleDeactivate = async () => {
    if (!student || !student.isActive || !studentRef) return
    setIsUpdating(true)
    try {
      await updateDoc(studentRef, { 
        isActive: false, 
        updatedAt: serverTimestamp(),
        leftAt: serverTimestamp()
      })

      const buildingRef = doc(db, "buildings", student.buildingId)
      const buildingSnap = await getDoc(buildingRef)
      if (buildingSnap.exists()) {
        const buildingData = buildingSnap.data()
        const updatedRoomsDetail = buildingData.roomsDetail.map((room: any) => {
          if (room.roomNo === student.roomNumber) {
            return {
              ...room,
              seats: room.seats.map((seat: any) => {
                if (seat.seatNo === student.seatNumber) return { ...seat, status: 'empty' }
                return seat
              })
            }
          }
          return room
        })

        await updateDoc(buildingRef, {
          roomsDetail: updatedRoomsDetail,
          occupiedSeats: increment(-1),
          emptySeats: increment(1),
          updatedAt: serverTimestamp()
        })
      }
      toast({ title: "Resident Left", description: "Profile deactivated and seat vacated." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handlePaymentSubmit = async () => {
    if (!student || !studentRef) return
    
    const seatPaid = student.paymentSystem === 'package' ? Number(paymentData.amount) : Number(paymentData.seatAmount)
    const foodPaid = student.paymentSystem === 'non-package' ? Number(paymentData.foodAmount) : 0
    const totalAmount = seatPaid + foodPaid

    if (totalAmount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid amount." })
      return
    }

    if (useAdvanceBalance && availableAdvanceForDeduction < totalAmount) {
      toast({ 
        variant: "destructive", 
        title: "Deduction Restricted", 
        description: `You must keep at least one month's rent (₹${student.monthlyRent}) in Advance as security.` 
      })
      return
    }

    if (!paymentData.receiver && !useAdvanceBalance) {
      toast({ variant: "destructive", title: "Error", description: "Please select a receiver." })
      return
    }

    setIsUpdating(true)
    const paymentId = doc(collection(db, "payments")).id
    const summaryId = `${paymentData.year}-${paymentData.month}`

    const paymentRecord = {
      amount: totalAmount,
      seatAmount: seatPaid,
      foodAmount: foodPaid,
      buildingId: student.buildingId,
      buildingName: student.buildingName,
      studentName: student.name,
      studentId: student.id,
      type: "income",
      month: paymentData.month,
      year: paymentData.year,
      method: useAdvanceBalance ? "advance_deduction" : paymentData.method,
      receiver: useAdvanceBalance ? "System (Advance Deduction)" : paymentData.receiver,
      description: (useAdvanceBalance ? "[Deducted from Advance] " : "") + paymentData.description,
      date: new Date().toISOString()
    }

    try {
      if (!useAdvanceBalance) {
        await setDoc(doc(db, "payments", paymentId), {
          ...paymentRecord,
          date: serverTimestamp(),
          createdAt: serverTimestamp(),
        })

        await setDoc(doc(db, "summaries", summaryId), {
          totalIncome: increment(totalAmount),
          [`buildingIncome.${student.buildingName}`]: increment(totalAmount),
          updatedAt: serverTimestamp()
        }, { merge: true })
      }

      await updateDoc(studentRef, {
        paymentsHistory: arrayUnion(paymentRecord),
        ...(useAdvanceBalance && {
          advanceAmount: increment(-totalAmount)
        }),
        ...(student.paymentSystem === 'non-package' && foodPaid > 0 && {
          foodCost: increment(foodPaid)
        }),
        updatedAt: serverTimestamp()
      })

      toast({ 
        title: useAdvanceBalance ? "Advance Adjusted" : "Payment Recorded", 
        description: `Successfully processed ₹${totalAmount}. Food credit updated.` 
      })
      setIsPaymentDialogOpen(false)
      setUseAdvanceBalance(false)
      setPaymentData(prev => ({ ...prev, amount: "", seatAmount: "", foodAmount: "", description: "" }))
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAddStaff = async () => {
    if (!newStaff.name) return
    setIsUpdating(true)
    try {
      const staffId = doc(collection(db, "staff")).id
      await setDoc(doc(db, "staff", staffId), {
        ...newStaff,
        createdAt: serverTimestamp()
      })
      toast({ title: "Success", description: "Staff added to receivers list." })
      setNewStaff({ name: "", phone: "" })
      setIsAddStaffOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const logMonthlyMeal = async () => {
    if (!student || !logCount || !studentRef) return
    setIsUpdating(true)
    try {
      const totalMeals = Number(logCount)
      const totalCost = totalMeals * globalMealRate

      const mealEntry = {
        date: new Date().toISOString(),
        month: logMonth,
        totalMeals,
        perMealCost: globalMealRate,
        totalCost
      }

      await updateDoc(studentRef, {
        mealsHistory: arrayUnion(mealEntry),
        updatedAt: serverTimestamp()
      })
      
      toast({ title: "Meal Record Saved", description: `Log for ${logMonth} saved. Balance updated.` })
      setLogCount("")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

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

  if (studentLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
  if (!student) return <div className="text-center p-20">Student not found.</div>

  return (
    <div className="space-y-6 pb-20 relative">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex gap-4 items-center">
          <div className="bg-primary/10 p-4 rounded-xl text-primary">
            <UserCircle size={48} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{student.name}</h1>
            <div className="flex gap-2 items-center mt-1">
              <Badge variant={student.isActive ? "default" : "destructive"} className={student.isActive ? "bg-success" : ""}>
                {student.isActive ? "Active Resident" : "Ex-Resident"}
              </Badge>
              <Badge variant="outline" className="capitalize">{student.paymentSystem} Plan</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {student.isActive && (
            <Button variant="destructive" className="flex gap-2" onClick={handleDeactivate} disabled={isUpdating}>
              <UserMinus size={18} /> Mark as Left
            </Button>
          )}
          <Button variant="outline" onClick={() => router.back()}>Back</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Contact & Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Phone className="text-primary" size={16} />
              <span className="font-bold">{student.phone}</span>
            </div>
            {student.parentPhone && (
              <div className="flex items-center gap-3 text-sm">
                <Contact className="text-primary" size={16} />
                <span className="font-bold">{student.parentPhone} (Parent)</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="text-primary" size={16} />
              <span className="font-semibold">{student.buildingName}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <BedDouble className="text-primary" size={16} />
              <span>Room {student.roomNumber} | Seat {student.seatNumber}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Financial Overview</CardTitle>
            <CardDescription>Real-time running balances and debt tracking.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-[10px] uppercase text-primary font-bold">Advance Pool</p>
                <p className="text-lg font-bold">₹{student.advanceAmount || 0}</p>
                <div className="text-[8px] text-muted-foreground mt-1 flex justify-between">
                  <span>Security Lock: ₹{student.monthlyRent || 0}</span>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Monthly Rent</p>
                <p className="text-lg font-bold">₹{student.monthlyRent || 0}</p>
              </div>

              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-[10px] uppercase text-destructive font-bold">Rent Due</p>
                <p className="text-lg font-bold text-destructive">₹{totalRentDue.toLocaleString()}</p>
              </div>

              {student.paymentSystem === 'non-package' && (
                <div className={cn(
                  "p-3 rounded-lg border",
                  foodStats.balance >= 0 ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20"
                )}>
                  <p className={cn("text-[10px] uppercase font-bold", foodStats.balance >= 0 ? "text-success" : "text-destructive")}>
                    {foodStats.balance >= 0 ? "Food Surplus" : "Food Debt"}
                  </p>
                  <p className={cn("text-lg font-bold", foodStats.balance >= 0 ? "text-success" : "text-destructive")}>
                    ₹{foodStats.balance.toLocaleString()}
                  </p>
                  <p className="text-[8px] text-muted-foreground mt-1">
                    {foodStats.balance >= 0 ? "Carried to next month" : "Needs payment"}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-4">
          <TabsTrigger value="payments" className="flex gap-2"><CreditCard size={14} /> Payments</TabsTrigger>
          <TabsTrigger value="dues" className="flex gap-2"><AlertCircle size={14} /> Monthly Status</TabsTrigger>
          {student.paymentSystem === 'non-package' && (
            <TabsTrigger value="meals" className="flex gap-2"><Utensils size={14} /> Meal Records</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="payments">
          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Receiver</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {student.paymentsHistory?.map((p: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">{new Date(p.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{p.month} {p.year}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[10px] font-normal uppercase",
                          p.method === 'advance_deduction' ? "border-primary text-primary" : ""
                        )}>
                          {p.method === 'advance_deduction' ? "Adj. from Advance" : p.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{p.receiver}</TableCell>
                      <TableCell className="text-right font-bold text-income">₹{p.amount?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {(!student.paymentsHistory || student.paymentsHistory.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No payment records found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dues">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Monthly Rent Tracking (Automatic)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month & Year</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Unpaid Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dueBreakdown.map((due, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{due.month} {due.year}</TableCell>
                      <TableCell className="text-xs">₹{due.expected.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-success font-bold">₹{due.paidAmount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={due.status === 'Paid' ? 'secondary' : (due.status === 'Partial' ? 'outline' : 'destructive')} 
                          className="text-[10px] h-5"
                        >
                          {due.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {due.due > 0 ? `₹${due.due.toLocaleString()}` : '0'}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-6">
                <Card className="border-none shadow-sm h-fit">
                  <CardHeader>
                    <CardTitle className="text-sm">Log Monthly Count</CardTitle>
                    <CardDescription className="text-xs">Global rate: ₹{globalMealRate}/meal</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Month</Label>
                      <Select value={logMonth} onValueChange={setLogMonth}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Total Meals</Label>
                      <Input type="number" placeholder="Count" value={logCount} onChange={e => setLogCount(e.target.value)} />
                    </div>
                    <Button className="w-full gap-2" onClick={logMonthlyMeal} disabled={isUpdating}>
                      <Plus size={16} /> Save Record
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="md:col-span-2 border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm">Meal Logs History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead className="text-right">Cost (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {student.mealsHistory?.map((m: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{m.month}</TableCell>
                          <TableCell className="font-bold">{m.totalMeals}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">₹{m.perMealCost}</TableCell>
                          <TableCell className="text-right font-bold">
                            ₹{m.totalCost?.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <div className="fixed bottom-8 right-8 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg border-2 border-white bg-primary hover:bg-primary/90 transition-transform active:scale-95">
              <Plus className="h-8 w-8 text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2 space-y-1 mb-2">
            <DropdownMenuItem onClick={() => setIsPaymentDialogOpen(true)} className="flex items-center gap-2 cursor-pointer p-3">
              <div className="bg-success/10 p-2 rounded-lg text-success">
                <Wallet size={18} />
              </div>
              <span className="font-medium">Process Payment</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md" onKeyDown={handleKeyDown}>
          <DialogHeader>
            <DialogTitle>Record Transaction for {student.name}</DialogTitle>
          </DialogHeader>
          
          <div className="bg-secondary/30 p-4 rounded-lg space-y-2 mb-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rent Due:</span>
              <span className="font-bold text-destructive">₹{totalRentDue.toLocaleString()}</span>
            </div>
            {student.paymentSystem === 'non-package' && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {foodStats.balance >= 0 ? "Food Surplus (Carried):" : "Food Debt (Unpaid):"}
                </span>
                <span className={cn("font-bold", foodStats.balance >= 0 ? "text-success" : "text-destructive")}>
                  ₹{Math.abs(foodStats.balance).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between text-xs mt-2 p-2 bg-primary/5 rounded border border-primary/10">
              <span className="text-primary font-medium">Available Advance:</span>
              <span className="font-bold text-primary">₹{student.advanceAmount || 0}</span>
            </div>
          </div>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold flex items-center gap-2 cursor-pointer" htmlFor="advSwitch">
                  <ArrowDownToLine size={14} className="text-primary" />
                  Deduct from Advance Pool
                </Label>
                <p className="text-[10px] text-muted-foreground">Security deposit will remain locked.</p>
              </div>
              <Switch id="advSwitch" checked={useAdvanceBalance} onCheckedChange={setUseAdvanceBalance} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>For Month</Label>
                <Select value={paymentData.month} onValueChange={val => setPaymentData({...paymentData, month: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {!useAdvanceBalance && (
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={paymentData.method} onValueChange={val => setPaymentData({...paymentData, method: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {student.paymentSystem === 'package' ? (
              <div className="space-y-2">
                <Label>Total Payment Amount (₹)</Label>
                <Input 
                  type="number" 
                  value={paymentData.amount} 
                  onChange={e => setPaymentData({...paymentData, amount: e.target.value})} 
                  placeholder="Enter amount" 
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 p-3 bg-secondary/10 rounded-lg border">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Seat Rent Payment</Label>
                  <Input 
                    type="number" 
                    value={paymentData.seatAmount} 
                    onChange={e => setPaymentData({...paymentData, seatAmount: e.target.value})} 
                    placeholder="Seat portion" 
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Food Credit Payment</Label>
                  <Input 
                    type="number" 
                    value={paymentData.foodAmount} 
                    onChange={e => setPaymentData({...paymentData, foodAmount: e.target.value})} 
                    placeholder="Food portion" 
                    className="h-9"
                  />
                </div>
              </div>
            )}

            {!useAdvanceBalance && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Payment Receiver</Label>
                  <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
                    <DialogTrigger asChild>
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary">
                        <UserPlus size={12} className="mr-1" /> Add New
                      </Button>
                    </DialogTrigger>
                    <DialogContent onKeyDown={handleKeyDown}>
                      <DialogHeader>
                        <DialogTitle>Add New Receiver</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Staff Name</Label>
                          <Input value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Staff Phone</Label>
                          <Input 
                            value={newStaff.phone} 
                            maxLength={11}
                            onChange={e => setNewStaff({...newStaff, phone: e.target.value})} 
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddStaff} disabled={isUpdating}>Save Staff</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <Select value={paymentData.receiver} onValueChange={val => setPaymentData({...paymentData, receiver: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select receiver" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList?.map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name} ({s.phone})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea value={paymentData.description} onChange={e => setPaymentData({...paymentData, description: e.target.value})} placeholder="Billing details, etc." />
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={handlePaymentSubmit} className="w-full h-12 text-lg" disabled={isUpdating}>
              {isUpdating ? <Loader2 className="animate-spin" /> : (useAdvanceBalance ? "Confirm Adjustment" : "Record Payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
