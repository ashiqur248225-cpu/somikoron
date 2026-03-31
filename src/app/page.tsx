
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
  DoorOpen,
  CalendarDays,
  CircleDollarSign,
  Smartphone,
  Banknote,
  Landmark
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
import { useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase"
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
  const [timeFilter, setTimeFilter] = useState("month") // today, month, lastMonth, year

  const [selectedBuildingId, setSelectedBuildingId] = useState("")
  const [selectedRoomNumber, setSelectedRoomNumber] = useState("")

  // Data Fetching
  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students } = useCollection(studentsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const allPaymentsQuery = useMemoFirebase(() => collection(db, "payments"), [db])
  const { data: allPayments } = useCollection(allPaymentsQuery)

  const allExpensesQuery = useMemoFirebase(() => collection(db, "expenses"), [db])
  const { data: allExpenses } = useCollection(allExpensesQuery)

  const allTransfersQuery = useMemoFirebase(() => collection(db, "transfers"), [db])
  const { data: allTransfers } = useCollection(allTransfersQuery)

  const balancesRef = useMemoFirebase(() => doc(db, "configs", "openingBalances"), [db])
  const { data: openingBalances } = useDoc(balancesRef)

  const [paymentForm, setPaymentForm] = useState({
    studentId: "",
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    amount: "",
    seatAmount: "",
    foodAmount: "",
    addAdvanceAmount: "0",
    method: "cash",
    receiver: "",
    description: ""
  })

  // Hierarchical Filtering Data (Building -> Room -> Student)
  const selectedBuilding = useMemo(() => buildings?.find(b => b.id === selectedBuildingId), [buildings, selectedBuildingId])
  const roomsInBuilding = useMemo(() => {
    if (!selectedBuilding) return []
    return selectedBuilding.apartmentsDetail?.flatMap((a: any) => a.rooms || []) || []
  }, [selectedBuilding])

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

  // Stats Calculations
  const stats = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    let filterDate = startOfMonth
    if (timeFilter === "today") filterDate = startOfToday
    if (timeFilter === "lastMonth") filterDate = startOfLastMonth
    if (timeFilter === "year") filterDate = startOfYear

    const isWithinRange = (dateValue: any) => {
      if (!dateValue) return false
      const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue)
      if (timeFilter === "lastMonth") return d >= startOfLastMonth && d <= endOfLastMonth
      return d >= filterDate
    }

    const income = (allPayments || [])
      .filter(p => isWithinRange(p.date))
      .reduce((acc, p) => acc + (p.amount || 0), 0)

    const expense = (allExpenses || [])
      .filter(e => isWithinRange(e.expenseDate))
      .reduce((acc, e) => acc + (e.amount || 0), 0)

    const totalDues = (students || []).filter(s => s.isActive).reduce((sAcc, student) => {
      const billingStart = student.billingStartDate ? new Date(student.billingStartDate) : (student.createdAt?.toDate?.() || new Date())
      const now = new Date()
      const monthsElapsed = (now.getFullYear() - billingStart.getFullYear()) * 12 + (now.getMonth() - billingStart.getMonth())
      
      const historicalRentDue = Number(student.dueAmount) || 0
      const generatedRent = (monthsElapsed > 0 ? monthsElapsed : 0) * (student.monthlyRent || 0)
      
      const totalRentPaid = student.paymentsHistory?.reduce((pAcc: number, curr: any) => {
        const rentPortion = (curr.seatAmount !== undefined) 
          ? Number(curr.seatAmount) 
          : (student.paymentSystem === 'package' ? Number(curr.amount) : 0)
        return pAcc + rentPortion
      }, 0) || 0
      
      const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

      const historicalFoodDue = Number(student.foodDueAmount) || 0
      const generatedFoodCost = student.mealsHistory?.reduce((fAcc: number, curr: any) => fAcc + (curr.totalCost || 0), 0) || 0
      
      const totalFoodPaid = student.paymentsHistory?.reduce((fAcc: number, curr: any) => {
        const foodPortion = (curr.foodAmount !== undefined) 
          ? Number(curr.foodAmount) 
          : (student.paymentSystem === 'non-package' ? Number(curr.amount) : 0)
        return fAcc + foodPortion
      }, 0) || 0
      
      const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)
      const foodDue = foodBalance < 0 ? Math.abs(foodBalance) : 0

      return sAcc + rentDue + foodDue
    }, 0)

    const fund = { 
      cash: Number(openingBalances?.cash || 0), 
      bkash: Number(openingBalances?.bkash || 0), 
      nagad: Number(openingBalances?.nagad || 0), 
      bank: Number(openingBalances?.bank || 0) 
    };

    (allPayments || []).forEach(p => {
      const m = p.method as keyof typeof fund
      if (fund[m] !== undefined) fund[m] += (p.amount || 0)
    });
    
    (allExpenses || []).forEach(e => {
      const m = e.method as keyof typeof fund
      if (fund[m] !== undefined) fund[m] -= (e.amount || 0)
    });

    // Incorporate Internal Transfers into Balances
    (allTransfers || []).forEach(t => {
      const from = t.fromAccount as keyof typeof fund
      const to = t.toAccount as keyof typeof fund
      if (fund[from] !== undefined) fund[from] -= (t.amount || 0)
      if (fund[to] !== undefined) fund[to] += (t.amount || 0)
    });

    return { income, expense, dues: totalDues, fund }
  }, [allPayments, allExpenses, allTransfers, students, timeFilter, openingBalances])

  const handleQuickPayment = async () => {
    if (!paymentForm.studentId || (!useAdvanceBalance && !paymentForm.receiver)) {
      toast({ variant: "destructive", title: "Error", description: "Fill required fields." })
      return
    }

    const seatPaid = selectedStudent?.paymentSystem === 'package' ? Number(paymentForm.amount) : Number(paymentForm.seatAmount)
    const foodPaid = selectedStudent?.paymentSystem === 'non-package' ? Number(paymentForm.foodAmount) : 0
    const addAdvance = Number(paymentForm.addAdvanceAmount)
    const totalCashAmount = seatPaid + foodPaid + addAdvance

    if (totalCashAmount <= 0 && !useAdvanceBalance) return

    setIsSubmitting(true)
    const building = buildings?.find(b => b.id === selectedBuildingId)
    const paymentId = doc(collection(db, "payments")).id

    let detailsArr = []
    if (seatPaid > 0) detailsArr.push(`Rent: ৳${seatPaid}`)
    if (foodPaid > 0) detailsArr.push(`Food: ৳${foodPaid}`)
    if (addAdvance > 0) detailsArr.push(`Advance: ৳${addAdvance}`)
    const breakdown = detailsArr.join(', ')

    const paymentRecord = {
      amount: totalCashAmount,
      seatAmount: seatPaid,
      foodAmount: foodPaid,
      advanceAmount: addAdvance,
      buildingId: selectedBuildingId,
      buildingName: building?.name || "Unknown",
      studentName: selectedStudent?.name || "Unknown",
      studentId: paymentForm.studentId,
      type: "income",
      month: paymentForm.month,
      year: paymentForm.year,
      method: useAdvanceBalance ? "advance_deduction" : paymentForm.method,
      receiver: useAdvanceBalance ? "System (Advance Deduction)" : paymentForm.receiver,
      description: `${breakdown}. ${paymentForm.description}`,
      date: new Date().toISOString()
    }

    try {
      if (!useAdvanceBalance && totalCashAmount > 0) {
        await setDoc(doc(db, "payments", paymentId), {
          ...paymentRecord,
          date: Timestamp.now(),
          createdAt: Timestamp.now(),
        })
      }

      await updateDoc(doc(db, "students", paymentForm.studentId), {
        paymentsHistory: arrayUnion(paymentRecord),
        advanceAmount: increment((useAdvanceBalance ? -(seatPaid + foodPaid) : addAdvance)),
        ...(selectedStudent?.paymentSystem === 'non-package' && foodPaid > 0 && { foodCost: increment(foodPaid) }),
        updatedAt: Timestamp.now()
      })

      toast({ title: "Success", description: `Processed ৳${totalCashAmount}.` })
      setIsPaymentOpen(false)
      setPaymentForm({ ...paymentForm, amount: "", seatAmount: "", foodAmount: "", addAdvanceAmount: "0", description: "" })
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
    if (!newStaff.name || newStaff.phone.length !== 11) {
      toast({ variant: "destructive", title: "Error", description: "Name and exactly 11 digit phone required." })
      return
    }
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Real-time overview of your hostel network.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-lg">
          <CalendarDays size={16} className="ml-2 text-muted-foreground" />
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[140px] border-none bg-transparent shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-none bg-income/5 border-l-4 border-l-income">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-income">Income</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-income" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{stats.income.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1 capitalize">Total for {timeFilter}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-expense/5 border-l-4 border-l-expense">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-expense">Expenses</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-expense" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{stats.expense.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1 capitalize">Total for {timeFilter}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-destructive/5 border-l-4 border-l-destructive">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-destructive">Total Dues</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{stats.dues.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Current outstanding</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-primary/5 border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">Residents</CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students?.filter(s => s.isActive).length || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Active in {buildings?.length || 0} properties</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="col-span-4 shadow-sm border-none">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Total Fund Status</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Opening + Transactions (including transfers).</p>
            </div>
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <CircleDollarSign size={20} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border bg-secondary/20 space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Banknote size={14} />
                  <span className="text-xs font-medium uppercase">Cash in Hand</span>
                </div>
                <p className="text-xl font-bold">৳{stats.fund.cash.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl border bg-secondary/20 space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Landmark size={14} />
                  <span className="text-xs font-medium uppercase">Bank Account</span>
                </div>
                <p className="text-xl font-bold">৳{stats.fund.bank.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl border bg-secondary/20 space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Smartphone size={14} className="text-primary" />
                  <span className="text-xs font-medium uppercase">Bkash Wallet</span>
                </div>
                <p className="text-xl font-bold text-primary">৳{stats.fund.bkash.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl border bg-secondary/20 space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Smartphone size={14} className="text-orange-500" />
                  <span className="text-xs font-medium uppercase">Nagad Wallet</span>
                </div>
                <p className="text-xl font-bold text-orange-500">৳{stats.fund.nagad.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Combined Net Balance:</span>
              <span className="text-2xl font-black text-primary">
                ৳{(stats.fund.cash + stats.fund.bank + stats.fund.bkash + stats.fund.nagad).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 shadow-sm border-none">
          <CardHeader><CardTitle className="text-lg">Property Occupancy</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {buildings?.map(b => (
              <div key={b.id} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{b.name}</span>
                  <span className="text-muted-foreground text-xs">{b.occupiedSeats}/{b.totalSeats} Seats</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${(b.occupiedSeats / (b.totalSeats || 1)) * 100}%` }} 
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-8 right-8 z-50">
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg bg-primary hover:scale-105 transition-transform">
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
                    <SelectContent>{roomsInBuilding.map((r: any) => <SelectItem key={r.roomNo} value={r.roomNo}>Room {r.roomNo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">Student</Label>
                  <Select 
                    disabled={!selectedRoomNumber} 
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
                    <span className="text-muted-foreground">Monthly Rent:</span>
                    <span className="font-bold">৳{selectedStudent.monthlyRent}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-2 bg-primary/5 rounded border border-primary/10">
                    <div className="flex justify-between text-xs">
                      <span className="text-primary font-medium">Advance Pool:</span>
                      <span className="font-bold text-primary">৳{selectedStudent.advanceAmount || 0}</span>
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
                  disabled={!selectedStudent || (selectedStudent.advanceAmount || 0) <= (selectedStudent.monthlyRent || 0)}
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
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bkash">Bkash</SelectItem>
                        <SelectItem value="nagad">Nagad</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {selectedStudent?.paymentSystem === 'package' ? (
                <div className="space-y-2">
                  <Label>Rent/Package Amount (৳)</Label>
                  <Input type="number" placeholder="0.00" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 p-3 bg-secondary/10 rounded-lg border">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground">SEAT RENT (৳)</Label>
                    <Input type="number" placeholder="Rent" value={paymentForm.seatAmount} onChange={e => setPaymentForm({...paymentForm, seatAmount: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground">FOOD CREDIT (৳)</Label>
                    <Input type="number" placeholder="Food" value={paymentForm.foodAmount} onChange={e => setPaymentForm({...paymentForm, foodAmount: e.target.value})} />
                  </div>
                </div>
              )}

              {!useAdvanceBalance && (
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 space-y-2">
                  <Label className="text-xs font-bold text-primary flex items-center gap-1"><Plus size={12}/> Add to Advance Pool (৳)</Label>
                  <Input type="number" value={paymentForm.addAdvanceAmount} onChange={e => setPaymentForm({...paymentForm, addAdvanceAmount: e.target.value})} placeholder="Extra amount to save" />
                </div>
              )}

              {!useAdvanceBalance && (
                <div className="space-y-2">
                  <Label>Receiver</Label>
                  <Select value={paymentForm.receiver} onValueChange={val => setPaymentForm({...paymentForm, receiver: val})}>
                    <SelectTrigger><SelectValue placeholder="Select receiver" /></SelectTrigger>
                    <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
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
            <Input placeholder="11 Digit Phone" maxLength={11} value={newStaff.phone} onChange={e => setNewStaff({...newStaff, phone: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={handleAddStaff} disabled={isSubmitting}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
