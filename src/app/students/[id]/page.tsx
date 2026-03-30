
"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, serverTimestamp, updateDoc, setDoc, getDoc, arrayUnion, increment, collection, deleteDoc } from "firebase/firestore"
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
  ArrowDownToLine, Lock,
  History, MoreVertical, Edit, Trash2,
  HelpCircle,
  Info
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
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default function StudentDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const id = params.id
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isLogMealDialogOpen, setIsLogMealDialogOpen] = useState(false)
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [useAdvanceBalance, setUseAdvanceBalance] = useState(false)
  
  const [logMonth, setLogMonth] = useState(new Date().toLocaleString('default', { month: 'long' }))
  const [logCount, setLogCount] = useState("")

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    parentPhone: "",
    address: "",
    monthlyRent: "",
    paymentSystem: "package"
  })

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)
  const [newStaff, setNewStaff] = useState({ name: "", phone: "" })

  const configRef = useMemoFirebase(() => doc(db, "configs", "mealRate"), [db])
  const { data: config } = useDoc(configRef)
  const globalMealRate = config?.rate || 0

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

  const studentRef = useMemoFirebase(() => id ? doc(db, "students", id) : null, [db, id])
  const { data: student, isLoading: studentLoading } = useDoc(studentRef)

  useMemo(() => {
    if (student) {
      setEditForm({
        name: student.name || "",
        phone: student.phone || "",
        parentPhone: student.parentPhone || "",
        address: student.address || "",
        monthlyRent: (student.monthlyRent || 0).toString(),
        paymentSystem: student.paymentSystem || "package"
      })
    }
  }, [student])

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Dues Calculation (Historical + Generated - Paid)
  const financialStats = useMemo(() => {
    if (!student) return { rentDue: 0, foodDue: 0, monthsElapsed: 0 }
    
    const regDate = student.createdAt?.toDate?.() || new Date()
    const now = new Date()
    const monthsElapsed = (now.getFullYear() - regDate.getFullYear()) * 12 + (now.getMonth() - regDate.getMonth())
    
    // Rent Due
    const historicalRentDue = Number(student.dueAmount) || 0
    const generatedRent = monthsElapsed > 0 ? monthsElapsed * (student.monthlyRent || 0) : 0
    const totalRentPaid = student.paymentsHistory?.reduce((acc: number, curr: any) => {
      return acc + (curr.seatAmount || (student.paymentSystem === 'package' ? curr.amount : 0) || 0)
    }, 0) || 0
    const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

    // Food Due
    const historicalFoodDue = Number(student.foodDueAmount) || 0
    const generatedFoodCost = student.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
    const totalFoodPaid = student.paymentsHistory?.reduce((acc: number, curr: any) => acc + (curr.foodAmount || 0), 0) || 0
    const foodDue = Math.max(0, (historicalFoodDue + generatedFoodCost) - totalFoodPaid)

    return { rentDue, foodDue, monthsElapsed }
  }, [student])

  const totalOverallDue = financialStats.rentDue + financialStats.foodDue
  
  const exitSettlement = useMemo(() => {
    if (!student) return { finalBalance: 0, mode: 'none' }
    const advance = student.advanceAmount || 0
    const balance = advance - totalOverallDue
    return {
      advance,
      dues: totalOverallDue,
      finalBalance: balance,
      mode: balance >= 0 ? 'refund' : 'deficit'
    }
  }, [student, totalOverallDue])

  const availableAdvanceForDeduction = useMemo(() => {
    if (!student) return 0
    const currentAdvance = student.advanceAmount || 0
    const minRequired = student.monthlyRent || 0
    return Math.max(0, currentAdvance - minRequired)
  }, [student])

  const handleDeleteStudent = async () => {
    if (!studentRef || !student) return
    setIsUpdating(true)
    try {
      if (student.isActive) {
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
                    return { ...room, seats: room.seats.map((seat: any) => seat.seatNo === student.seatNumber ? { ...seat, status: 'empty' } : seat) }
                  }
                  return room
                })
              }
            }
            return apt
          })
          await updateDoc(bRef, { apartmentsDetail: updatedApts, occupiedSeats: increment(-1), emptySeats: increment(1) })
        }
      }
      await deleteDoc(studentRef)
      toast({ title: "Deleted", description: "Student record permanently removed." })
      router.push("/students")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUpdateStudent = async () => {
    if (!studentRef) return
    setIsUpdating(true)
    try {
      await updateDoc(studentRef, {
        ...editForm,
        monthlyRent: Number(editForm.monthlyRent),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Updated", description: "Student details saved." })
      setIsEditDialogOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeactivate = async () => {
    if (!student || !student.isActive || !studentRef) return
    setIsUpdating(true)
    try {
      const settlement = exitSettlement
      const settlementRecords = []

      if (settlement.advance > 0 && settlement.dues > 0) {
        const adjustAmount = Math.min(settlement.advance, settlement.dues)
        const paymentRecord = {
          amount: adjustAmount,
          buildingId: student.buildingId,
          buildingName: student.buildingName,
          studentName: student.name,
          studentId: student.id,
          type: "income",
          month: months[new Date().getMonth()],
          year: new Date().getFullYear().toString(),
          method: "exit_settlement_advance",
          receiver: "System (Auto Settlement)",
          description: `Automatic adjustment from advance on exit. Settled ₹${adjustAmount} of dues.`,
          date: new Date().toISOString()
        }
        settlementRecords.push(paymentRecord)
        
        const pId = doc(collection(db, "payments")).id
        await setDoc(doc(db, "payments", pId), { ...paymentRecord, date: serverTimestamp() })
      }

      await updateDoc(studentRef, { 
        isActive: false, 
        advanceAmount: settlement.mode === 'refund' ? 0 : settlement.advance - Math.min(settlement.advance, settlement.dues),
        paymentsHistory: arrayUnion(...settlementRecords),
        updatedAt: serverTimestamp(),
        leftAt: serverTimestamp()
      })

      const buildingRef = doc(db, "buildings", student.buildingId)
      const buildingSnap = await getDoc(buildingRef)
      if (buildingSnap.exists()) {
        const bData = buildingSnap.data()
        const updatedApts = bData.apartmentsDetail.map((apt: any) => {
          if (apt.name === student.apartmentName) {
            return {
              ...apt,
              rooms: apt.rooms.map((room: any) => {
                if (room.roomNo === student.roomNumber) {
                  return { ...room, seats: room.seats.map((seat: any) => seat.seatNo === student.seatNumber ? { ...seat, status: 'empty' } : seat) }
                }
                return room
              })
            }
          }
          return apt
        })
        await updateDoc(buildingRef, { apartmentsDetail: updatedApts, occupiedSeats: increment(-1), emptySeats: increment(1) })
      }
      toast({ title: "Settled & Deactivated", description: "Student marked as left. Seat vacated and advance adjusted." })
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
    if (totalAmount <= 0) { toast({ variant: "destructive", title: "Error", description: "Enter valid amount." }); return }
    if (useAdvanceBalance && availableAdvanceForDeduction < totalAmount) { toast({ variant: "destructive", title: "Error", description: "Security lock violation." }); return }
    if (!paymentData.receiver && !useAdvanceBalance) { toast({ variant: "destructive", title: "Error", description: "Select receiver." }); return }
    setIsUpdating(true)
    try {
      const pId = doc(collection(db, "payments")).id
      const pRecord = {
        amount: totalAmount, seatAmount: seatPaid, foodAmount: foodPaid, buildingId: student.buildingId,
        buildingName: student.buildingName, studentName: student.name, studentId: student.id, type: "income",
        month: paymentData.month, year: paymentData.year, method: useAdvanceBalance ? "advance_deduction" : paymentData.method,
        receiver: useAdvanceBalance ? "System (Advance Deduction)" : paymentData.receiver,
        description: (useAdvanceBalance ? "[Deducted from Advance] " : "") + paymentData.description,
        date: new Date().toISOString()
      }
      if (!useAdvanceBalance) { await setDoc(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp() }) }
      await updateDoc(studentRef, {
        paymentsHistory: arrayUnion(pRecord),
        ...(useAdvanceBalance && { advanceAmount: increment(-totalAmount) }),
        ...(student.paymentSystem === 'non-package' && foodPaid > 0 && { foodCost: increment(foodPaid) }),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Success", description: "Payment processed." })
      setIsPaymentDialogOpen(false)
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) } finally { setIsUpdating(false) }
  }

  const handleAddStaff = async () => {
    if (!newStaff.name) return
    setIsUpdating(true)
    try {
      await setDoc(doc(collection(db, "staff")), { ...newStaff, createdAt: serverTimestamp() })
      toast({ title: "Success", description: "Staff added." }); setNewStaff({ name: "", phone: "" }); setIsAddStaffOpen(false)
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) } finally { setIsUpdating(false) }
  }

  const logMonthlyMeal = async () => {
    if (!student || !logCount || !studentRef) return
    setIsUpdating(true)
    try {
      const totalCost = Number(logCount) * globalMealRate
      const mealEntry = { date: new Date().toISOString(), month: logMonth, totalMeals: Number(logCount), perMealCost: globalMealRate, totalCost }
      await updateDoc(studentRef, { mealsHistory: arrayUnion(mealEntry), updatedAt: serverTimestamp() })
      toast({ title: "Success", description: "Meals logged." }); setLogCount(""); setIsLogMealDialogOpen(false)
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) } finally { setIsUpdating(false) }
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
          if (index > -1 && index < focusables.length - 1) focusables[index + 1].focus();
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
          <div className="bg-primary/10 p-4 rounded-xl text-primary"><UserCircle size={48} /></div>
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
        <div className="flex gap-2 items-center">
          {student.isActive && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="flex gap-2" disabled={isUpdating}>
                  <UserMinus size={18} /> Mark as Left
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>Resident Exit Settlement</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="mt-4 space-y-3">
                      <p className="text-sm font-medium">System will perform automatic background settlement:</p>
                      <div className="bg-secondary/50 p-4 rounded-lg space-y-2 border text-xs">
                        <div className="flex justify-between"><span>Total Dues (Rent + Food):</span><span className="font-bold text-destructive">₹{exitSettlement.dues.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Advance Pool:</span><span className="font-bold text-primary">₹{exitSettlement.advance.toLocaleString()}</span></div>
                        <Separator />
                        <div className="flex justify-between font-bold text-sm pt-1">
                          <span>{exitSettlement.mode === 'refund' ? 'Refund to Student:' : 'Net Deficit (Remaining Due):'}</span>
                          <span className={exitSettlement.mode === 'refund' ? 'text-success' : 'text-destructive'}>₹{Math.abs(exitSettlement.finalBalance).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="p-3 bg-primary/5 rounded border border-primary/20 text-[10px] text-muted-foreground italic">
                        * Confirming will vacate the seat, adjust advance against dues, and mark the resident as inactive.
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeactivate} className="bg-destructive">Confirm Settlement & Exit</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon"><MoreVertical size={18}/></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setIsEditDialogOpen(true)}>
                <Edit size={14}/> Edit Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-destructive cursor-pointer" onSelect={(e) => e.preventDefault()}>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <div className="flex items-center gap-2 w-full"><Trash2 size={14}/> Delete Student</div>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Permanent Deletion</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove all history and vacate the seat. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteStudent} className="bg-destructive">Delete Permanently</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" onClick={() => router.push("/students")}>Back</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-lg">Contact & Location</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm"><Phone className="text-primary" size={16} /><span className="font-bold">{student.phone}</span></div>
            {student.parentPhone && <div className="flex items-center gap-3 text-sm"><Contact className="text-primary" size={16} /><span className="font-bold">{student.parentPhone} (Parent)</span></div>}
            <div className="flex items-center gap-3 text-sm"><Building2 className="text-primary" size={16} /><span className="font-semibold">{student.buildingName}</span></div>
            <div className="flex items-center gap-3 text-sm"><BedDouble className="text-primary" size={16} /><span>Room {student.roomNumber} | Seat {student.seatNumber}</span></div>
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
                <div className="text-[8px] text-muted-foreground mt-1 flex justify-between items-center"><span className="flex items-center gap-0.5"><Lock size={8} /> Locked: ₹{student.monthlyRent || 0}</span></div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Monthly Rate</p>
                <p className="text-lg font-bold">₹{student.monthlyRent || 0}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 relative">
                <div className="flex justify-between items-start">
                  <p className="text-[10px] uppercase text-destructive font-bold">Rent Due</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info size={12} className="text-destructive cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-[10px]">Rent Due = (Initial Debt: ₹{student.dueAmount || 0}) + (Rent for {financialStats.monthsElapsed} months elapsed: ₹{financialStats.monthsElapsed * (student.monthlyRent || 0)}) - (Total Rent Paid)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-lg font-bold text-destructive">₹{financialStats.rentDue.toLocaleString()}</p>
              </div>

              {student.paymentSystem === 'non-package' && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 relative">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] uppercase text-destructive font-bold">Food Due</p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info size={12} className="text-destructive cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-[10px]">Food Due = (Initial Food Debt: ₹{student.foodDueAmount || 0}) + (Total Meal Cost from Logs) - (Total Food Paid)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-lg font-bold text-destructive">₹{financialStats.foodDue.toLocaleString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-4">
          <TabsTrigger value="payments" className="flex gap-2"><CreditCard size={14} /> Payments</TabsTrigger>
          <TabsTrigger value="dues" className="flex gap-2"><AlertCircle size={14} /> Historical Status</TabsTrigger>
          {student.paymentSystem === 'non-package' && <TabsTrigger value="meals" className="flex gap-2"><Utensils size={14} /> Meal Records</TabsTrigger>}
        </TabsList>
        <TabsContent value="payments">
          <Card className="border-none shadow-sm"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Period</TableHead><TableHead>Method</TableHead><TableHead>Receiver</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{student.paymentsHistory?.map((p: any, idx: number) => (
            <TableRow key={idx}><TableCell className="text-xs">{new Date(p.date).toLocaleDateString()}</TableCell><TableCell className="font-medium">{p.month} {p.year}</TableCell><TableCell><Badge variant="outline" className={cn("text-[10px] font-normal uppercase", p.method?.includes('settlement') ? "border-primary text-primary" : "")}>{p.method?.replace(/_/g, ' ')}</Badge></TableCell><TableCell className="text-xs">{p.receiver}</TableCell><TableCell className="text-right font-bold text-income">₹{p.amount?.toLocaleString()}</TableCell></TableRow>
          ))}{(!student.paymentsHistory || student.paymentsHistory.length === 0) && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No payment records found.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="dues">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-sm">Account Summary at Registration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase font-bold">Historical Rent Due</p>
                  <p className="text-xl font-bold">₹{student.dueAmount || 0}</p>
                </div>
                {student.paymentSystem === 'non-package' && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase font-bold">Historical Food Due</p>
                    <p className="text-xl font-bold">₹{student.foodDueAmount || 0}</p>
                  </div>
                )}
              </div>
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 text-xs">
                <p><strong>Note:</strong> বকেয়া হিসেব করার সময় ভর্তির তারিখ থেকে শুরু হওয়া প্রতিটি মাসের ভাড়া (Monthly Rent) ঐতিহাসিক বকেয়ার (Historical Due) সাথে যোগ করা হয়।</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {student.paymentSystem === 'non-package' && (
          <TabsContent value="meals"><Card className="border-none shadow-sm"><CardHeader><CardTitle className="text-sm">Meal Logs History</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Count</TableHead><TableHead>Rate</TableHead><TableHead className="text-right">Cost (₹)</TableHead></TableRow></TableHeader><TableBody>{student.mealsHistory?.map((m: any, idx: number) => (
            <TableRow key={idx}><TableCell className="font-medium">{m.month}</TableCell><TableCell className="font-bold">{m.totalMeals}</TableCell><TableCell className="text-xs text-muted-foreground">₹{m.perMealCost}</TableCell><TableCell className="text-right font-bold">₹{m.totalCost?.toLocaleString()}</TableCell></TableRow>
          ))}{(!student.mealsHistory || student.mealsHistory.length === 0) && <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No meal records found.</TableCell></TableRow>}</TableBody></Table></CardContent></Card></TabsContent>
        )}
      </Tabs>

      <div className="fixed bottom-8 right-8 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" className="h-14 w-14 rounded-full shadow-lg border-2 border-white bg-primary hover:bg-primary/90 transition-transform active:scale-95"><Plus className="h-8 w-8 text-white" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2 space-y-1 mb-2">
            <DropdownMenuItem onClick={() => setIsPaymentDialogOpen(true)} className="flex items-center gap-2 cursor-pointer p-3"><div className="bg-success/10 p-2 rounded-lg text-success"><Wallet size={18} /></div><span className="font-medium">Process Payment</span></DropdownMenuItem>
            {student.paymentSystem === 'non-package' && <DropdownMenuItem onClick={() => setIsLogMealDialogOpen(true)} className="flex items-center gap-2 cursor-pointer p-3"><div className="bg-primary/10 p-2 rounded-lg text-primary"><Utensils size={18} /></div><span className="font-medium">Log Meals</span></DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent onKeyDown={handleKeyDown}>
          <DialogHeader><DialogTitle>Edit Resident Details</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Full Name</Label><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}/></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})}/></div>
              <div className="space-y-2"><Label>Parent Phone</Label><Input value={editForm.parentPhone} onChange={e => setEditForm({...editForm, parentPhone: e.target.value})}/></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Monthly Rent (₹)</Label><Input type="number" value={editForm.monthlyRent} onChange={e => setEditForm({...editForm, monthlyRent: e.target.value})}/></div>
              <div className="space-y-2"><Label>Plan</Label><Select value={editForm.paymentSystem} onValueChange={val => setEditForm({...editForm, paymentSystem: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="package">Package</SelectItem><SelectItem value="non-package">Non-Package</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Textarea value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})}/></div>
          </div>
          <DialogFooter><Button onClick={handleUpdateStudent} disabled={isUpdating} className="w-full">Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyDown}>
          <DialogHeader><DialogTitle>Record Transaction for {student.name}</DialogTitle></DialogHeader>
          <div className="bg-secondary/30 p-4 rounded-lg space-y-2 mb-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Rent Due:</span><span className="font-bold text-destructive">₹{financialStats.rentDue.toLocaleString()}</span></div>
            {student.paymentSystem === 'non-package' && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Food Due:</span><span className="font-bold text-destructive">₹{financialStats.foodDue.toLocaleString()}</span></div>}
            <div className="flex flex-col gap-1 mt-2 p-2 bg-primary/5 rounded border border-primary/10"><div className="flex justify-between text-xs"><span className="text-primary font-medium">Advance Pool:</span><span className="font-bold text-primary">₹{student.advanceAmount || 0}</span></div><div className="flex justify-between text-[10px] text-muted-foreground"><span>Security Lock:</span><span>₹{student.monthlyRent || 0}</span></div></div>
          </div>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5"><div className="space-y-0.5"><Label className="text-sm font-bold flex items-center gap-2 cursor-pointer" htmlFor="advSwitch"><ArrowDownToLine size={14} className="text-primary" />Deduct from Advance</Label></div><Switch id="advSwitch" checked={useAdvanceBalance} onCheckedChange={setUseAdvanceBalance} disabled={availableAdvanceForDeduction <= 0} /></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>For Month</Label><Select value={paymentData.month} onValueChange={val => setPaymentData({...paymentData, month: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>{!useAdvanceBalance && <div className="space-y-2"><Label>Method</Label><Select value={paymentData.method} onValueChange={val => setPaymentData({...paymentData, method: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>}</div>
            {student.paymentSystem === 'package' ? <div className="space-y-2"><Label>Total Payment (₹)</Label><Input type="number" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} /></div> : <div className="grid grid-cols-2 gap-4 p-3 bg-secondary/10 rounded-lg border"><div className="space-y-2"><Label className="text-xs">Seat Rent</Label><Input type="number" value={paymentData.seatAmount} onChange={e => setPaymentData({...paymentData, seatAmount: e.target.value})} /></div><div className="space-y-2"><Label className="text-xs">Food Credit</Label><Input type="number" value={paymentData.foodAmount} onChange={e => setPaymentData({...paymentData, foodAmount: e.target.value})} /></div></div>}
            {!useAdvanceBalance && <div className="space-y-2"><div className="flex justify-between items-center"><Label>Receiver</Label><Button variant="link" size="sm" onClick={() => setIsAddStaffOpen(true)} className="h-auto p-0 text-xs">Add New</Button></div><Select value={paymentData.receiver} onValueChange={val => setPaymentData({...paymentData, receiver: val})}><SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>}
            <Textarea value={paymentData.description} onChange={e => setPaymentData({...paymentData, description: e.target.value})} placeholder="Notes..." />
          </div>
          <DialogFooter className="sticky bottom-0 bg-background pt-2 border-t"><Button onClick={handlePaymentSubmit} className="w-full h-12 text-lg" disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin" /> : "Confirm Transaction"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLogMealDialogOpen} onOpenChange={setIsLogMealDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyDown}>
          <DialogHeader><DialogTitle>Log Monthly Meals</DialogTitle><DialogDescription>Rate: ₹{globalMealRate}/meal.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Month</Label><Select value={logMonth} onValueChange={setLogMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Total Meals</Label><Input type="number" value={logCount} onChange={e => setLogCount(e.target.value)} /></div>
            {logCount && <div className="bg-primary/5 p-3 rounded-lg flex justify-between items-center text-sm"><span>Total Cost:</span><span className="font-bold text-primary">₹{(Number(logCount) * globalMealRate).toLocaleString()}</span></div>}
          </div>
          <DialogFooter><Button className="w-full h-12 text-lg" onClick={logMonthlyMeal} disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin" /> : "Save Meal Record"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
        <DialogContent onKeyDown={handleKeyDown}>
          <DialogHeader><DialogTitle>Add New Receiver</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Name" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
            <Input placeholder="Phone" maxLength={11} value={newStaff.phone} onChange={e => setNewStaff({...newStaff, phone: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={handleAddStaff} disabled={isUpdating}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
