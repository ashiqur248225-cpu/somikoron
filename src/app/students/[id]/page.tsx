
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
  UserPlus
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
import { cn } from "@/lib/utils"

export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isCalcDialogOpen, setIsCalcDialogOpen] = useState(false)
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)
  
  // Monthly Meal Entry State
  const [logMonth, setLogMonth] = useState(new Date().toLocaleString('default', { month: 'long' }))
  const [logCount, setLogCount] = useState("")

  const [editRate, setEditRate] = useState(false)
  const [newRate, setNewRate] = useState("")

  // Calculator State
  const [calcMonth, setCalcMonth] = useState(new Date().toLocaleString('default', { month: 'long' }))
  const [calcMealCount, setCalcMealCount] = useState("")
  const [calcRate, setCalcRate] = useState("")

  // Staff Data
  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)
  const [newStaff, setNewStaff] = useState({ name: "", phone: "" })

  // Payment State
  const [paymentData, setPaymentData] = useState({
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    amount: "", 
    seatAmount: "", 
    foodAmount: "", 
    method: "cash",
    receiver: "",
    description: ""
  })

  // Fetch Student Data
  const studentRef = useMemoFirebase(() => id ? doc(db, "students", id) : null, [db, id])
  const { data: student, isLoading: studentLoading } = useDoc(studentRef)

  const currentMonth = new Date().toLocaleString('default', { month: 'long' })

  const currentMonthMealRecord = useMemo(() => {
    return student?.mealsHistory?.find((m: any) => m.month === currentMonth)
  }, [student, currentMonth])

  const foodBill = useMemo(() => {
    if (student?.paymentSystem === 'package') return 0
    return (currentMonthMealRecord?.totalMeals || 0) * (student?.foodRate || 0)
  }, [currentMonthMealRecord, student])

  const foodAdvance = student?.foodCost || 0
  const foodBalance = foodAdvance - foodBill

  // Updated Total Due Logic
  const totalDueAmount = useMemo(() => {
    if (!student) return 0
    const baseDue = (student.dueAmount || 0) + (student.monthlyRent || 0)
    if (student.paymentSystem === 'package') {
      return baseDue
    } else {
      // For non-package: Monthly Seat Rent + Food Overspent (if any)
      const foodDebt = foodBalance < 0 ? Math.abs(foodBalance) : 0
      return baseDue + foodDebt
    }
  }, [student, foodBalance])

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
                if (seat.seatNo === student.seatNumber) {
                  return { ...seat, status: 'empty' }
                }
                return seat
              })
            }
          }
          return room
        })

        await updateDoc(buildingRef, {
          roomsDetail: updatedRoomsDetail,
          occupiedSeats: Math.max(0, (buildingData.occupiedSeats || 0) - 1),
          emptySeats: (buildingData.emptySeats || 0) + 1,
          updatedAt: serverTimestamp()
        })
      }
      toast({ title: "Student Inactivated", description: "Resident profile updated and seat vacated." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handlePaymentSubmit = async () => {
    if (!student || !studentRef) return
    
    const totalAmount = student.paymentSystem === 'package' 
      ? Number(paymentData.amount) 
      : Number(paymentData.seatAmount) + Number(paymentData.foodAmount)

    if (totalAmount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid amount." })
      return
    }

    if (!paymentData.receiver) {
      toast({ variant: "destructive", title: "Error", description: "Please select a receiver." })
      return
    }

    setIsUpdating(true)
    
    const paymentId = doc(collection(db, "payments")).id
    const summaryId = `${paymentData.year}-${paymentData.month}`

    const paymentRecord = {
      amount: totalAmount,
      seatAmount: student.paymentSystem === 'non-package' ? Number(paymentData.seatAmount) : totalAmount,
      foodAmount: student.paymentSystem === 'non-package' ? Number(paymentData.foodAmount) : 0,
      buildingId: student.buildingId,
      buildingName: student.buildingName,
      studentName: student.name,
      studentId: student.id,
      type: "income",
      month: paymentData.month,
      year: paymentData.year,
      method: paymentData.method,
      receiver: paymentData.receiver,
      description: paymentData.description,
      date: new Date().toISOString()
    }

    try {
      await setDoc(doc(db, "payments", paymentId), {
        ...paymentRecord,
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
      })

      await updateDoc(studentRef, {
        paymentsHistory: arrayUnion(paymentRecord),
        ...(student.paymentSystem === 'non-package' && {
          foodCost: increment(Number(paymentData.foodAmount))
        }),
        updatedAt: serverTimestamp()
      })

      await setDoc(doc(db, "summaries", summaryId), {
        totalIncome: increment(totalAmount),
        [`buildingIncome.${student.buildingName}`]: increment(totalAmount),
        updatedAt: serverTimestamp()
      }, { merge: true })

      toast({ title: "Payment Recorded", description: `Amount ₹${totalAmount} added to history.` })
      setIsPaymentDialogOpen(false)
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
      const mealRate = student.foodRate || 0
      const totalMeals = Number(logCount)
      const totalCost = totalMeals * mealRate

      const mealEntry = {
        date: new Date().toISOString(),
        month: logMonth,
        totalMeals,
        perMealCost: mealRate,
        totalCost
      }

      await updateDoc(studentRef, {
        mealsHistory: arrayUnion(mealEntry),
        updatedAt: serverTimestamp()
      })
      
      toast({ title: "Monthly Count Saved", description: `Record for ${logMonth} added to history.` })
      setLogCount("")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const updateMealRate = async () => {
    if (!student || !newRate || !studentRef) return
    setIsUpdating(true)
    try {
      await updateDoc(studentRef, { 
        foodRate: Number(newRate),
        updatedAt: serverTimestamp() 
      })
      setEditRate(false)
      toast({ title: "Rate Updated", description: `Meal rate set to ₹${newRate}` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const calculatedTotal = useMemo(() => {
    const count = Number(calcMealCount) || 0
    const rate = Number(calcRate) || 0
    return count * rate
  }, [calcMealCount, calcRate])

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
              <Badge variant={student.isActive ? "default" : "destructive"} className={student.isActive ? "bg-success hover:bg-success/80" : ""}>
                {student.isActive ? "Active Resident" : "Inactive / Left"}
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
            <CardTitle className="text-lg">Contact & Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Phone className="text-primary" size={16} />
              <div className="flex flex-col">
                <span className="font-bold">{student.phone}</span>
                <span className="text-[10px] text-muted-foreground uppercase">Student Contact</span>
              </div>
            </div>
            {student.parentPhone && (
              <div className="flex items-center gap-3 text-sm">
                <Contact className="text-primary" size={16} />
                <div className="flex flex-col">
                  <span className="font-bold">{student.parentPhone}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">Parent/Guardian Contact</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="text-muted-foreground" size={16} />
              <span>{student.address || "No address provided"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm border-t pt-4">
              <Building2 className="text-primary" size={16} />
              <span className="font-semibold">{student.buildingName}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <BedDouble className="text-primary" size={16} />
              <span>Room {student.roomNumber} - Seat {student.seatNumber}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Financial Overview</CardTitle>
              <CardDescription>Plan and calculations.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "grid gap-4",
              student.paymentSystem === 'package' ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-5"
            )}>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Advance</p>
                <p className="text-lg font-bold">₹{student.advanceAmount || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-[10px] uppercase text-muted-foreground font-bold">{student.paymentSystem === 'package' ? 'Monthly Rent' : 'Seat Rent'}</p>
                <p className="text-lg font-bold">₹{student.monthlyRent || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Service Charge</p>
                <p className="text-lg font-bold">₹{student.serviceCharge || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-[10px] uppercase text-destructive font-bold">Total Due</p>
                <p className="text-lg font-bold text-destructive">₹{totalDueAmount.toLocaleString()}</p>
                <div className="text-[9px] text-muted-foreground mt-1">
                   Prev Due: ₹{student.dueAmount || 0} + Rent: ₹{student.monthlyRent || 0}
                   {student.paymentSystem === 'non-package' && foodBalance < 0 && ` + Food: ₹${Math.abs(foodBalance)}`}
                </div>
              </div>

              {student.paymentSystem === 'non-package' && (
                <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-[10px] uppercase text-success font-bold">Food Balance</p>
                  <p className={`text-lg font-bold ${foodBalance < 0 ? 'text-destructive' : 'text-success'}`}>
                    ₹{foodBalance.toLocaleString()}
                  </p>
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                    <span>Adv: ₹{foodAdvance}</span>
                    <span>Bill: ₹{foodBill}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-4">
          <TabsTrigger value="payments" className="flex gap-2"><CreditCard size={14} /> Payment History</TabsTrigger>
          <TabsTrigger value="meals" className="flex gap-2"><Utensils size={14} /> Monthly Meal Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="payments">
          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Month/Year</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Receiver</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {student.paymentsHistory?.map((p: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{new Date(p.date).toLocaleDateString()}</TableCell>
                      <TableCell>{p.month} {p.year}</TableCell>
                      <TableCell className="capitalize">{p.method}</TableCell>
                      <TableCell className="text-xs">{p.receiver}</TableCell>
                      <TableCell className="text-right font-bold text-success">₹{p.amount?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {(!student.paymentsHistory || student.paymentsHistory.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No payments recorded in history.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meals">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-6">
              <Card className="border-none shadow-sm h-fit">
                <CardHeader>
                  <CardTitle className="text-sm">Log Monthly Count</CardTitle>
                  <CardDescription>Enter total meals for a specific month.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label>Month</Label>
                      <Select value={logMonth} onValueChange={setLogMonth}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Total Meals</Label>
                      <Input type="number" placeholder="Enter count" value={logCount} onChange={e => setLogCount(e.target.value)} />
                    </div>
                  </div>
                  <Button className="w-full gap-2" onClick={logMonthlyMeal} disabled={isUpdating}>
                    <Plus size={16} /> Save Record
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm h-fit">
                <CardHeader>
                  <CardTitle className="text-sm">Meal Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  {!editRate ? (
                    <div className="flex justify-between items-center">
                      <div className="text-sm">
                        <p className="text-muted-foreground text-xs">Current Rate</p>
                        <p className="font-bold text-lg">₹{student.foodRate || 0}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => {
                        setNewRate(student.foodRate?.toString() || "")
                        setEditRate(true)
                      }}>Change</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs">New Rate (₹)</Label>
                      <div className="flex gap-2">
                        <Input type="number" value={newRate} onChange={e => setNewRate(e.target.value)} className="h-8" />
                        <Button size="sm" onClick={updateMealRate} disabled={isUpdating} className="h-8">Save</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="md:col-span-2 border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm">Monthly Records History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Rate (₹)</TableHead>
                      <TableHead className="text-right">Total (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.mealsHistory?.map((m: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.date ? new Date(m.date).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell className="font-medium">{m.month}</TableCell>
                        <TableCell className="font-bold">{m.totalMeals}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">₹{m.perMealCost}</TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          ₹{m.totalCost?.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!student.mealsHistory || student.mealsHistory.length === 0) && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No monthly records found in history.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg border-2 border-white bg-primary hover:bg-primary/90 transition-transform active:scale-95">
              <Plus className="h-8 w-8 text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2 space-y-1 mb-2">
            <DropdownMenuItem onClick={() => setIsCalcDialogOpen(true)} className="flex items-center gap-2 cursor-pointer p-3">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <Calculator size={18} />
              </div>
              <span className="font-medium">Monthly Calculator</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsPaymentDialogOpen(true)} className="flex items-center gap-2 cursor-pointer p-3">
              <div className="bg-success/10 p-2 rounded-lg text-success">
                <Wallet size={18} />
              </div>
              <span className="font-medium">Record Payment</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Monthly Calculator Dialog */}
      <Dialog open={isCalcDialogOpen} onOpenChange={setIsCalcDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Monthly Meal Calculator</DialogTitle>
            <DialogDescription>Quickly calculate food bill for any month.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Select Month</Label>
              <Select value={calcMonth} onValueChange={setCalcMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Meals</Label>
                <Input type="number" placeholder="0" value={calcMealCount} onChange={e => setCalcMealCount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rate per Meal (₹)</Label>
                <Input type="number" placeholder="0" value={calcRate} onChange={e => setCalcRate(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20 flex justify-between items-center">
              <span className="font-semibold text-muted-foreground">Total for {calcMonth}:</span>
              <span className="text-2xl font-bold text-primary">₹{calculatedTotal.toLocaleString()}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment for {student.name}</DialogTitle>
            <DialogDescription>
              {student.paymentSystem === 'package' ? 'Record full monthly package payment.' : 'Record seat rent and food advance separately.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-secondary/30 p-4 rounded-lg space-y-2 mb-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Previous Due:</span>
              <span className="font-bold text-destructive">₹{student.dueAmount || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly Rent ({student.paymentSystem}):</span>
              <span className="font-bold">₹{student.monthlyRent || 0}</span>
            </div>
            {student.paymentSystem === 'non-package' && foodBalance < 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Food Debt:</span>
                <span className="font-bold text-destructive">₹{Math.abs(foodBalance)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="font-semibold">Total Payable:</span>
              <span className="font-bold text-primary">₹{totalDueAmount}</span>
            </div>
          </div>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={paymentData.month} onValueChange={val => setPaymentData({...paymentData, month: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>

            {student.paymentSystem === 'package' ? (
              <div className="space-y-2">
                <Label>Amount Paid (₹)</Label>
                <Input 
                  type="number" 
                  value={paymentData.amount} 
                  onChange={e => setPaymentData({...paymentData, amount: e.target.value})} 
                  placeholder="0.00" 
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Seat Rent Paid</Label>
                  <Input 
                    type="number" 
                    value={paymentData.seatAmount} 
                    onChange={e => setPaymentData({...paymentData, seatAmount: e.target.value})} 
                    placeholder="Rent portion" 
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Food Cost Paid</Label>
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Receiver</Label>
                <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
                  <DialogTrigger asChild>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                      <UserPlus size={12} className="mr-1" /> Add New
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Receiver</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input 
                          value={newStaff.phone} 
                          maxLength={11}
                          onChange={e => setNewStaff({...newStaff, phone: e.target.value})} 
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddStaff} disabled={isUpdating}>Save Receiver</Button>
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
                  {staffList?.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground text-center">No staff found. Please add one.</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={paymentData.description} onChange={e => setPaymentData({...paymentData, description: e.target.value})} placeholder="Any notes..." />
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={handlePaymentSubmit} className="w-full gap-2" disabled={isUpdating}>
              {isUpdating ? <Loader2 className="animate-spin" /> : <Wallet size={16} />} 
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
