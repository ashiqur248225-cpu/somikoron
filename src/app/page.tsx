
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Building2, 
  TrendingUp,
  History,
  Loader2,
  Plus,
  Wallet,
  Check,
  UserPlus,
  Lock,
  ArrowDownToLine,
  DoorOpen
} from "lucide-react"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, where, Timestamp, doc, setDoc, updateDoc, arrayUnion, increment } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: "", phone: "" })
  const [useAdvanceBalance, setUseAdvanceBalance] = useState(false)

  const [selectedBuildingId, setSelectedBuildingId] = useState("")
  const [selectedRoomNumber, setSelectedRoomNumber] = useState("")

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students } = useCollection(studentsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const recentPaymentsQuery = useMemoFirebase(() => 
    query(collection(db, "payments"), orderBy("date", "desc"), limit(5)), [db])
  const { data: recentPayments, isLoading: paymentsLoading } = useCollection(recentPaymentsQuery)

  const recentExpensesQuery = useMemoFirebase(() => 
    query(collection(db, "expenses"), orderBy("createdAt", "desc"), limit(5)), [db])
  const { data: recentExpenses, isLoading: expensesLoading } = useCollection(recentExpensesQuery)

  const [paymentForm, setPaymentForm] = useState({
    studentId: "",
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    amount: "",
    seatAmount: "",
    foodAmount: "",
    method: "cash",
    receiver: "",
    description: ""
  })

  // Hierarchical Filtering Data
  const selectedBuilding = useMemo(() => buildings?.find(b => b.id === selectedBuildingId), [buildings, selectedBuildingId])
  const roomsInBuilding = useMemo(() => selectedBuilding?.roomsDetail || [], [selectedBuilding])

  const filteredStudents = useMemo(() => {
    return students?.filter(s => 
      s.buildingId === selectedBuildingId && 
      (selectedRoomNumber ? s.roomNumber === selectedRoomNumber : true) &&
      s.isActive
    ) || []
  }, [students, selectedBuildingId, selectedRoomNumber])

  const selectedStudent = useMemo(() => {
    return students?.find(s => s.id === paymentForm.studentId)
  }, [students, paymentForm.studentId])

  const foodStats = useMemo(() => {
    if (!selectedStudent || selectedStudent.paymentSystem === 'package') return { balance: 0 }
    const totalBill = selectedStudent.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
    const totalPaid = Number(selectedStudent.foodCost) || 0
    return { balance: totalPaid - totalBill }
  }, [selectedStudent])

  const availableAdvanceForDeduction = useMemo(() => {
    if (!selectedStudent) return 0
    const currentAdvance = selectedStudent.advanceAmount || 0
    const minRequired = selectedStudent.monthlyRent || 0
    return Math.max(0, currentAdvance - minRequired)
  }, [selectedStudent])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayIncome = useMemo(() => {
    return (recentPayments || [])
      .filter(p => p.date?.toDate() >= today)
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [recentPayments, today])

  const todayExpense = useMemo(() => {
    return (recentExpenses || [])
      .filter(e => e.createdAt?.toDate() >= today)
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [recentExpenses, today])

  const handleQuickPayment = async () => {
    if (!paymentForm.studentId || (!useAdvanceBalance && !paymentForm.receiver)) {
      toast({ variant: "destructive", title: "Error", description: "Fill required fields." })
      return
    }

    const seatPaid = selectedStudent?.paymentSystem === 'package' ? Number(paymentForm.amount) : Number(paymentForm.seatAmount)
    const foodPaid = selectedStudent?.paymentSystem === 'non-package' ? Number(paymentForm.foodAmount) : 0
    const totalAmount = seatPaid + foodPaid

    if (totalAmount <= 0) return

    setIsSubmitting(true)
    const building = buildings?.find(b => b.id === selectedBuildingId)
    const paymentId = doc(collection(db, "payments")).id
    const summaryId = `${paymentForm.year}-${paymentForm.month}`

    const paymentRecord = {
      amount: totalAmount,
      seatAmount: seatPaid,
      foodAmount: foodPaid,
      buildingId: selectedBuildingId,
      buildingName: building?.name || "Unknown",
      studentName: selectedStudent?.name || "Unknown",
      studentId: paymentForm.studentId,
      type: "income",
      month: paymentForm.month,
      year: paymentForm.year,
      method: useAdvanceBalance ? "advance_deduction" : paymentForm.method,
      receiver: useAdvanceBalance ? "System (Advance Deduction)" : paymentForm.receiver,
      description: (useAdvanceBalance ? "[Deducted from Advance] " : "") + paymentForm.description,
      date: new Date().toISOString()
    }

    try {
      if (!useAdvanceBalance) {
        await setDoc(doc(db, "payments", paymentId), {
          ...paymentRecord,
          date: Timestamp.now(),
          createdAt: Timestamp.now(),
        })

        await setDoc(doc(db, "summaries", summaryId), {
          totalIncome: increment(totalAmount),
          [`buildingIncome.${building?.name || 'Unknown'}`]: increment(totalAmount),
          updatedAt: Timestamp.now()
        }, { merge: true })
      }

      await updateDoc(doc(db, "students", paymentForm.studentId), {
        paymentsHistory: arrayUnion(paymentRecord),
        ...(useAdvanceBalance && { advanceAmount: increment(-totalAmount) }),
        ...(selectedStudent?.paymentSystem === 'non-package' && foodPaid > 0 && { foodCost: increment(foodPaid) }),
        updatedAt: Timestamp.now()
      })

      toast({ title: "Success", description: `Processed ₹${totalAmount}.` })
      setIsPaymentOpen(false)
      setPaymentForm({ ...paymentForm, amount: "", seatAmount: "", foodAmount: "", description: "" })
      setSelectedBuildingId("")
      setSelectedRoomNumber("")
      setUseAdvanceBalance(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddStaff = async () => {
    if (!newStaff.name) return
    setIsSubmitting(true)
    try {
      const staffId = doc(collection(db, "staff")).id
      await setDoc(doc(db, "staff", staffId), {
        ...newStaff,
        createdAt: Timestamp.now()
      })
      toast({ title: "Success", description: "Staff added." })
      setNewStaff({ name: "", phone: "" })
      setIsAddStaffOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const stats = [
    { title: "Today's Income", amount: `₹${todayIncome.toLocaleString()}`, change: "Recorded today", icon: ArrowUpCircle, color: "text-income" },
    { title: "Today's Expenses", amount: `₹${todayExpense.toLocaleString()}`, change: "Logged today", icon: ArrowDownCircle, color: "text-expense" },
    { title: "Active Students", amount: students?.filter(s => s.isActive).length || 0, change: "Current residents", icon: TrendingUp, color: "text-primary" },
    { title: "Total Buildings", amount: buildings?.length || 0, change: "Buildings count", icon: Building2, color: "text-primary" }
  ]

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

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time overview of your hostel network.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="shadow-sm border-none bg-card hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.amount}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4 shadow-sm border-none">
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayments?.slice(0, 5).map((p, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{p.studentName}</TableCell>
                    <TableCell className="text-right text-income font-bold">₹{p.amount?.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="col-span-3 shadow-sm border-none">
          <CardHeader><CardTitle>Occupancy</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {buildings?.map(b => (
              <div key={b.id} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{b.name}</span>
                  <span>{b.occupiedSeats}/{b.totalSeats}</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(b.occupiedSeats / (b.totalSeats || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-8 right-8 z-50">
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg bg-primary">
              <Plus className="h-8 w-8 text-white" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyDown}>
            <DialogHeader><DialogTitle>Quick Payment Record</DialogTitle></DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4 p-4 bg-secondary/10 rounded-xl border">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Building2 size={12}/> Building</Label>
                  <Select onValueChange={(val) => {
                    setSelectedBuildingId(val)
                    setSelectedRoomNumber("")
                    setPaymentForm({...paymentForm, studentId: ""})
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                    <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><DoorOpen size={12}/> Room No.</Label>
                  <Select 
                    disabled={!selectedBuildingId} 
                    value={selectedRoomNumber}
                    onValueChange={(val) => {
                      setSelectedRoomNumber(val)
                      setPaymentForm({...paymentForm, studentId: ""})
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                    <SelectContent>{roomsInBuilding.map(r => <SelectItem key={r.roomNo} value={r.roomNo}>Room {r.roomNo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">Student</Label>
                  <Select 
                    disabled={!selectedRoomNumber && filteredStudents.length === 0} 
                    onValueChange={val => setPaymentForm({...paymentForm, studentId: val})}
                  >
                    <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                    <SelectContent>{filteredStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {selectedStudent && (
                <div className="bg-secondary/30 p-4 rounded-lg space-y-2 border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Standard Rent:</span>
                    <span className="font-bold">₹{selectedStudent.monthlyRent}</span>
                  </div>
                  {selectedStudent.paymentSystem === 'non-package' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{foodStats.balance >= 0 ? "Food Surplus:" : "Food Debt:"}</span>
                      <span className={cn("font-bold", foodStats.balance >= 0 ? "text-success" : "text-destructive")}>₹{Math.abs(foodStats.balance)}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1 p-2 bg-primary/5 rounded border border-primary/10">
                    <div className="flex justify-between text-xs">
                      <span className="text-primary font-medium">Advance Pool:</span>
                      <span className="font-bold text-primary">₹{selectedStudent.advanceAmount || 0}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground border-t pt-1">
                      <span>Available Deduction:</span>
                      <span className="font-bold text-success">₹{availableAdvanceForDeduction}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold flex items-center gap-2 cursor-pointer" htmlFor="advSwitchDash">
                    <ArrowDownToLine size={14} className="text-primary" />
                    Deduct from Advance
                  </Label>
                </div>
                <Switch 
                  id="advSwitchDash" 
                  checked={useAdvanceBalance} 
                  onCheckedChange={setUseAdvanceBalance}
                  disabled={!selectedStudent || availableAdvanceForDeduction <= 0}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select value={paymentForm.month} onValueChange={val => setPaymentForm({...paymentForm, month: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {!useAdvanceBalance && (
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select value={paymentForm.method} onValueChange={val => setPaymentForm({...paymentForm, method: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem><SelectItem value="mobile">Mobile</SelectItem></SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {selectedStudent?.paymentSystem === 'package' ? (
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input type="number" placeholder="0.00" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 p-3 bg-secondary/10 rounded-lg border">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground">SEAT RENT (₹)</Label>
                    <Input type="number" placeholder="Rent" value={paymentForm.seatAmount} onChange={e => setPaymentForm({...paymentForm, seatAmount: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground">FOOD CREDIT (₹)</Label>
                    <Input type="number" placeholder="Food" value={paymentForm.foodAmount} onChange={e => setPaymentForm({...paymentForm, foodAmount: e.target.value})} />
                  </div>
                </div>
              )}

              {!useAdvanceBalance && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Receiver</Label>
                    <Button variant="link" size="sm" onClick={() => setIsAddStaffOpen(true)}>Add New</Button>
                  </div>
                  <Select value={paymentForm.receiver} onValueChange={val => setPaymentForm({...paymentForm, receiver: val})}>
                    <SelectTrigger><SelectValue placeholder="Select receiver" /></SelectTrigger>
                    <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              <Textarea placeholder="Notes..." value={paymentForm.description} onChange={e => setPaymentForm({...paymentForm, description: e.target.value})} />
            </div>

            <DialogFooter className="sticky bottom-0 bg-background pt-2 border-t">
              <Button onClick={handleQuickPayment} className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Wallet size={16} />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
        <DialogContent onKeyDown={handleKeyDown}>
          <DialogHeader><DialogTitle>Add New Receiver</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Name" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
            <Input placeholder="Phone" maxLength={11} value={newStaff.phone} onChange={e => setNewStaff({...newStaff, phone: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={handleAddStaff} disabled={isSubmitting}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
