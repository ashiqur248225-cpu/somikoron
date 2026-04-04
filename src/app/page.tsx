
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Building2, 
  TrendingUp,
  Loader2,
  Plus,
  Wallet,
  ArrowDownToLine,
  DoorOpen,
  CalendarDays,
  CircleDollarSign,
  Smartphone,
  Banknote,
  Landmark,
  AlertCircle
} from "lucide-react"
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

export default function DashboardPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timeFilter, setTimeFilter] = useState("month")

  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("Main Branch")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setAssignedBuildingId(localStorage.getItem("assigned_building_id") || "none")
  }, [])

  const [selectedBuildingId, setSelectedBuildingId] = useState("")
  const [selectedRoomNumber, setSelectedRoomNumber] = useState("")

  // CRITICAL: Filter ALL queries by the user's active branch
  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "buildings"), where("id", "==", assignedBuildingId))
    }
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userRole, userBranch, assignedBuildingId])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "students"), where("buildingId", "==", assignedBuildingId))
    }
    return query(collection(db, "students"), where("branch", "==", userBranch))
  }, [db, userRole, userBranch, assignedBuildingId])
  const { data: students } = useCollection(studentsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const allPaymentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "payments"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: allPayments } = useCollection(allPaymentsQuery)

  const allExpensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "expenses"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: allExpenses } = useCollection(allExpensesQuery)

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

  const selectedBuilding = buildings?.find(b => b.id === (selectedBuildingId || assignedBuildingId))
  const roomsInBuilding = useMemo(() => {
    if (!selectedBuilding) return []
    return selectedBuilding.apartmentsDetail?.flatMap((a: any) => a.rooms || []) || []
  }, [selectedBuilding])

  const filteredStudentsForQuickPay = useMemo(() => {
    return students?.filter(s => 
      (selectedBuildingId ? s.buildingId === selectedBuildingId : true) && 
      (selectedRoomNumber ? s.roomNumber === selectedRoomNumber : true) &&
      s.isActive
    ) || []
  }, [students, selectedBuildingId, selectedRoomNumber])

  const selectedStudent = useMemo(() => students?.find(s => s.id === paymentForm.studentId), [students, paymentForm.studentId])

  const selectedStudentRentDue = useMemo(() => {
    if (!selectedStudent) return 0
    const s = selectedStudent
    const billingStart = s.billingStartDate ? new Date(s.billingStartDate) : (s.createdAt?.toDate?.() || new Date())
    const now = new Date()
    const endDate = s.isActive ? now : (s.leftAt?.toDate?.() || now)
    const monthsElapsed = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth()) + 1
    const historicalRentDue = Number(s.dueAmount) || 0
    const generatedRent = (monthsElapsed > 0 ? monthsElapsed : 0) * (s.monthlyRent || 0)
    const totalRentPaid = s.paymentsHistory?.reduce((pAcc: number, curr: any) => {
      const isRefund = curr.type === 'refund'
      const rentPortion = (curr.seatAmount !== undefined) ? Number(curr.seatAmount) : (s.paymentSystem === 'package' ? Number(curr.amount) : 0)
      return pAcc + (isRefund ? -rentPortion : rentPortion)
    }, 0) || 0
    return Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)
  }, [selectedStudent])

  const stats = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    let filterDate = startOfMonth
    if (timeFilter === "today") filterDate = startOfToday
    if (timeFilter === "lastMonth") filterDate = startOfLastMonth
    if (timeFilter === "year") filterDate = startOfYear

    const parseDate = (val: any) => {
      if (!val) return null
      if (val.toDate) return val.toDate()
      return new Date(val)
    }

    const isWithinRange = (dateValue: any) => {
      const d = parseDate(dateValue)
      if (!d) return false
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
      const endDate = student.isActive ? now : (student.leftAt?.toDate?.() || now)
      const monthsElapsed = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth()) + 1
      const historicalRentDue = Number(student.dueAmount) || 0
      const generatedRent = (monthsElapsed > 0 ? monthsElapsed : 0) * (student.monthlyRent || 0)
      const totalRentPaid = student.paymentsHistory?.reduce((pAcc: number, curr: any) => {
        const isRefund = curr.type === 'refund'
        const rentPortion = (curr.seatAmount !== undefined) ? Number(curr.seatAmount) : (student.paymentSystem === 'package' ? Number(curr.amount) : 0)
        return pAcc + (isRefund ? -rentPortion : rentPortion)
      }, 0) || 0
      const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)
      const historicalFoodDue = Number(student.foodDueAmount) || 0
      const generatedFoodCost = student.mealsHistory?.reduce((fAcc: number, curr: any) => fAcc + (curr.totalCost || 0), 0) || 0
      const totalFoodPaid = student.paymentsHistory?.reduce((fAcc: number, curr: any) => {
        const isRefund = curr.type === 'refund'
        const foodPortion = (curr.foodAmount !== undefined) ? Number(curr.foodAmount) : (student.paymentSystem === 'non-package' ? Number(curr.amount) : 0)
        return fAcc + (isRefund ? -foodPortion : foodPortion)
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

    if (userRole === 'Admin') {
      (allPayments || []).forEach(p => { if (fund[p.method as keyof typeof fund] !== undefined) fund[p.method as keyof typeof fund] += (p.amount || 0) });
      (allExpenses || []).forEach(e => { if (fund[e.method as keyof typeof fund] !== undefined) fund[e.method as keyof typeof fund] -= (e.amount || 0) });
    }

    return { income, expense, dues: totalDues, fund }
  }, [allPayments, allExpenses, students, timeFilter, openingBalances, userRole])

  const handleQuickPayment = async () => {
    if (!paymentForm.studentId || !paymentForm.receiver) {
      toast({ variant: "destructive", title: "Error", description: "Fill required fields." })
      return
    }

    setIsSubmitting(true)
    const building = buildings?.find(b => b.id === (selectedBuildingId || selectedStudent?.buildingId))
    const paymentId = doc(collection(db, "payments")).id
    const seatPaid = selectedStudent?.paymentSystem === 'package' ? Number(paymentForm.amount) : Number(paymentForm.seatAmount)
    const foodPaid = selectedStudent?.paymentSystem === 'non-package' ? Number(paymentForm.foodAmount) : 0
    const addAdvance = Number(paymentForm.addAdvanceAmount)
    const totalCashAmount = seatPaid + foodPaid + addAdvance

    const paymentRecord = {
      id: paymentId,
      amount: totalCashAmount,
      seatAmount: seatPaid,
      foodAmount: foodPaid,
      advanceAmount: addAdvance,
      buildingId: selectedBuildingId || selectedStudent?.buildingId,
      buildingName: building?.name || "Unknown",
      studentName: selectedStudent?.name || "Unknown",
      studentId: paymentForm.studentId,
      roomNumber: selectedRoomNumber || selectedStudent?.roomNumber || "N/A",
      branch: userBranch, // CRITICAL
      type: "income",
      month: paymentForm.month,
      year: paymentForm.year,
      method: paymentForm.method,
      receiver: paymentForm.receiver,
      description: paymentForm.description,
      date: new Date().toISOString()
    }

    try {
      if (totalCashAmount > 0) {
        await setDoc(doc(db, "payments", paymentId), { ...paymentRecord, date: Timestamp.now(), createdAt: Timestamp.now() })
      }
      await updateDoc(doc(db, "students", paymentForm.studentId), {
        paymentsHistory: arrayUnion(paymentRecord),
        advanceAmount: increment(addAdvance),
        updatedAt: Timestamp.now()
      })
      toast({ title: "Success", description: `Processed ৳${totalCashAmount}.` })
      setIsPaymentOpen(false)
      setPaymentForm({ ...paymentForm, amount: "", seatAmount: "", foodAmount: "", addAdvanceAmount: "0", description: "" })
      setSelectedBuildingId(""); setSelectedRoomNumber("")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Branch: <span className="font-bold text-foreground">{userBranch}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-lg">
          <CalendarDays size={16} className="ml-2 text-muted-foreground" />
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[140px] border-none bg-transparent shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
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
          <CardContent><div className="text-2xl font-bold">৳{stats.income.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-expense/5 border-l-4 border-l-expense">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-expense">Expenses</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-expense" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">৳{stats.expense.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-destructive/5 border-l-4 border-l-destructive">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-destructive">Current Dues</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">৳{stats.dues.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-primary/5 border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">Residents</CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{students?.filter(s => s.isActive).length || 0}</div></CardContent>
        </Card>
      </div>

      {userRole === 'Admin' && (
        <Card className="shadow-sm border-none">
          <CardHeader><CardTitle className="text-lg">Total Fund Status (Admin Only)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border bg-secondary/20"><p className="text-[10px] text-muted-foreground uppercase font-bold">Cash</p><p className="text-xl font-bold">৳{stats.fund.cash.toLocaleString()}</p></div>
              <div className="p-4 rounded-xl border bg-secondary/20"><p className="text-[10px] text-muted-foreground uppercase font-bold">Bank</p><p className="text-xl font-bold">৳{stats.fund.bank.toLocaleString()}</p></div>
              <div className="p-4 rounded-xl border bg-secondary/20"><p className="text-[10px] text-muted-foreground uppercase font-bold">Bkash</p><p className="text-xl font-bold text-primary">৳{stats.fund.bkash.toLocaleString()}</p></div>
              <div className="p-4 rounded-xl border bg-secondary/20"><p className="text-[10px] text-muted-foreground uppercase font-bold">Nagad</p><p className="text-xl font-bold text-orange-500">৳{stats.fund.nagad.toLocaleString()}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-8 right-8 z-50">
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg bg-primary hover:scale-105 transition-transform"><Plus className="h-8 w-8 text-white" /></Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Quick Payment Record</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-secondary/10 rounded-xl border space-y-4">
                <div className="space-y-2">
                  <Label>Building</Label>
                  <Select value={selectedBuildingId || assignedBuildingId} onValueChange={(val) => { setSelectedBuildingId(val); setSelectedRoomNumber(""); setPaymentForm({...paymentForm, studentId: ""}) }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Room No.</Label>
                  <Select disabled={!selectedBuildingId && assignedBuildingId === 'none'} value={selectedRoomNumber} onValueChange={(val) => { setSelectedRoomNumber(val); setPaymentForm({...paymentForm, studentId: ""}) }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{roomsInBuilding.map((r: any) => <SelectItem key={r.roomNo} value={r.roomNo}>Room {r.roomNo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select disabled={!selectedRoomNumber} onValueChange={val => setPaymentForm({...paymentForm, studentId: val})}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{filteredStudentsForQuickPay.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {selectedStudent && (
                <div className="bg-secondary/30 p-4 rounded-lg space-y-2 border text-sm">
                  <div className="flex justify-between"><span>Rent:</span><span className="font-bold">৳{selectedStudent.monthlyRent}</span></div>
                  {selectedStudentRentDue > 0 && <div className="flex justify-between text-destructive"><span>Due:</span><span className="font-bold">৳{selectedStudentRentDue.toLocaleString()}</span></div>}
                  <div className="flex justify-between text-primary"><span>Advance:</span><span className="font-bold">৳{selectedStudent.advanceAmount || 0}</span></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={paymentForm.method} onValueChange={val => setPaymentForm({...paymentForm, method: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Receiver</Label>
                  <Select value={paymentForm.receiver} onValueChange={val => setPaymentForm({...paymentForm, receiver: val})}>
                    <SelectTrigger><SelectValue placeholder="Staff" /></SelectTrigger>
                    <SelectContent>{staffList?.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {selectedStudent?.paymentSystem === 'package' ? (
                <div className="space-y-2"><Label>Package Amount (৳)</Label><Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} /></div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Seat Rent (৳)</Label><Input type="number" value={paymentForm.seatAmount} onChange={e => setPaymentForm({...paymentForm, seatAmount: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Food (৳)</Label><Input type="number" value={paymentForm.foodAmount} onChange={e => setPaymentForm({...paymentForm, foodAmount: e.target.value})} /></div>
                </div>
              )}
              <div className="space-y-2"><Label>Description</Label><Textarea value={paymentForm.description} onChange={e => setPaymentForm({...paymentForm, description: e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={handleQuickPayment} className="w-full" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : "Record Payment"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
