
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
  DoorOpen,
  CalendarDays,
  CircleDollarSign,
  Smartphone,
  Banknote,
  Landmark,
  AlertCircle,
  Users,
  BellRing,
  Calendar as CalendarIcon,
  ChevronDown,
  Filter,
  Calculator,
  Search,
  CheckCircle2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, serverTimestamp, setDoc, updateDoc, arrayUnion, increment } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function DashboardPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")
  const [timeRange, setTimeRange] = useState("this_month")

  // Permissions
  const [canRequestIncome, setCanRequestIncome] = useState(false)

  // Income Entry Dialog State
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [entryBuildingFilter, setEntryBuildingFilter] = useState("all")
  const [entryRoomFilter, setEntryRoomFilter] = useState("all")
  const [formData, setFormData] = useState({
    studentId: "",
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

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserName(localStorage.getItem("user_name") || "User")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setAssignedBuildingId(localStorage.getItem("assigned_building_id") || "none")
    setCanRequestIncome(localStorage.getItem("can_request_income") === "true")
  }, [])

  // 1. Fetch Buildings - Role-based filtering
  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "buildings"), where("id", "==", assignedBuildingId))
    }
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userRole, userBranch, assignedBuildingId])
  const { data: buildings, isLoading: buildingsLoading } = useCollection(buildingsQuery)

  // 2. Fetch Students - Role-based filtering
  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    let q = query(collection(db, "students"), where("branch", "==", userBranch))
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      q = query(collection(db, "students"), where("buildingId", "==", assignedBuildingId))
    }
    return q
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: students, isLoading: studentsLoading } = useCollection(studentsQuery)

  const staffQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "staff"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: staffList } = useCollection(staffQuery)

  const mealRateRef = useMemoFirebase(() => doc(db, "configs", "mealRate"), [db])
  const { data: mealRateConfig } = useDoc(mealRateRef)
  const currentMealRate = mealRateConfig?.rate || 0

  // 3. Fetch All Payments
  const allPaymentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    let q = query(collection(db, "payments"), where("branch", "==", userBranch))
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      q = query(collection(db, "payments"), where("buildingId", "==", assignedBuildingId))
    }
    return q
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: allPayments, isLoading: paymentsLoading } = useCollection(allPaymentsQuery)

  // 4. Fetch All Expenses
  const allExpensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    let q = query(collection(db, "expenses"), where("branch", "==", userBranch))
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      q = query(collection(db, "expenses"), where("buildingId", "==", assignedBuildingId))
    }
    return q
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: allExpenses, isLoading: expensesLoading } = useCollection(allExpensesQuery)

  // 5. Fetch All Transfers
  const allTransfersQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "transfers"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: allTransfers, isLoading: transfersLoading } = useCollection(allTransfersQuery)

  // 6. Pending Manager Requests
  const managerRequestsQuery = useMemoFirebase(() => {
    if (!userBranch || userRole === 'Building Manager') return null
    return query(collection(db, "managerRequests"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole])
  const { data: pendingMgrRequests } = useCollection(managerRequestsQuery)

  // 7. Opening Balances Config
  const balancesRef = useMemoFirebase(() => doc(db, "configs", "openingBalances"), [db])
  const { data: openingBalances } = useDoc(balancesRef)

  const isWithinRange = (date: Date, range: string) => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    if (range === 'today') {
      return date >= startOfToday
    }
    if (range === 'this_week') {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      const startOfWeek = new Date(new Date(now).setDate(diff))
      startOfWeek.setHours(0, 0, 0, 0)
      return date >= startOfWeek
    }
    if (range === 'this_month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }
    if (range === 'this_year') {
      return date.getFullYear() === now.getFullYear()
    }
    return true
  }

  const stats = useMemo(() => {
    const now = new Date()
    const filteredPayments = (allPayments || []).filter(p => {
      const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date)
      return isWithinRange(pDate, timeRange)
    })
    const filteredExpenses = (allExpenses || []).filter(e => {
      const eDate = e.expenseDate ? new Date(e.expenseDate) : null
      return eDate && isWithinRange(eDate, timeRange)
    })

    const totalIncome = filteredPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
    const totalExpense = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0)

    const totalDues = (students || []).filter(s => s.isActive).reduce((sAcc, s) => {
      const billingStart = s.billingStartDate ? new Date(s.billingStartDate) : (s.createdAt?.toDate?.() || new Date())
      const endDate = now
      const monthsElapsed = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth())
      const generatedRent = (monthsElapsed >= 0 ? monthsElapsed + 1 : 0) * (s.monthlyRent || 0)
      const historicalRentDue = s.duesBreakdown ? Object.values(s.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
      const totalRentPaid = s.paymentsHistory?.reduce((acc: number, curr: any) => {
        const isRefund = curr.type === 'refund'
        const rentPortion = (curr.seatAmount !== undefined) ? Number(curr.seatAmount) : (s.paymentSystem === 'package' ? Number(curr.amount) : 0)
        return acc + (isRefund ? -rentPortion : rentPortion)
      }, 0) || 0
      const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

      const historicalFoodDue = Number(s.foodDueAmount) || 0
      const generatedFoodCost = s.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
      const totalFoodPaid = s.paymentsHistory?.reduce((acc: number, curr: any) => {
        const isRefund = curr.type === 'refund'
        const foodPortion = (curr.foodAmount !== undefined) ? Number(curr.foodAmount) : (s.paymentSystem === 'non-package' ? Number(curr.amount) : 0)
        return acc + (isRefund ? -foodPortion : foodPortion)
      }, 0) || 0
      const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)

      return sAcc + rentDue + (foodBalance < 0 ? Math.abs(foodBalance) : 0)
    }, 0)

    const fund = { 
      cash: Number(openingBalances?.cash || 0), 
      bank: Number(openingBalances?.bank || 0), 
      bkash: Number(openingBalances?.bkash || 0), 
      nagad: Number(openingBalances?.nagad || 0) 
    };

    (allPayments || []).forEach(p => { 
      if (fund[p.method as keyof typeof fund] !== undefined) fund[p.method as keyof typeof fund] += (p.amount || 0) 
    });
    (allExpenses || []).forEach(e => { 
      if (fund[e.method as keyof typeof fund] !== undefined) fund[e.method as keyof typeof fund] -= (e.amount || 0) 
    });
    (allTransfers || []).forEach(t => {
      if (fund[t.fromAccount as keyof typeof fund] !== undefined) fund[t.fromAccount as keyof typeof fund] -= (t.amount || 0)
      if (fund[t.toAccount as keyof typeof fund] !== undefined) fund[t.toAccount as keyof typeof fund] += (t.amount || 0)
    });

    return { 
      income: totalIncome, 
      expense: totalExpense, 
      dues: totalDues, 
      fund,
      activeResidents: (students || []).filter(s => s.isActive).length
    }
  }, [allPayments, allExpenses, allTransfers, students, openingBalances, timeRange])

  // Dialog Student Filtering
  const availableRooms = useMemo(() => {
    if (!buildings) return []
    let rooms: string[] = []
    buildings.forEach(b => {
      if (entryBuildingFilter === "all" || b.id === entryBuildingFilter) {
        b.apartmentsDetail?.forEach((apt: any) => {
          apt.rooms?.forEach((room: any) => {
            if (room.roomNo && !rooms.includes(room.roomNo)) {
              rooms.push(room.roomNo)
            }
          })
        })
      }
    })
    return rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [buildings, entryBuildingFilter])

  const filteredStudentsForEntry = useMemo(() => {
    if (!students) return []
    return students.filter(s => {
      if (!s.isActive) return false
      const matchesBuilding = entryBuildingFilter === "all" || s.buildingId === entryBuildingFilter
      const matchesRoom = entryRoomFilter === "all" || s.roomNumber === entryRoomFilter
      return matchesBuilding && matchesRoom
    })
  }, [students, entryBuildingFilter, entryRoomFilter])

  const selectedStudent = useMemo(() => 
    students?.find(s => s.id === formData.studentId), 
    [students, formData.studentId]
  )

  const financialStats = useMemo(() => {
    if (!selectedStudent) return { rentDue: 0, foodBalance: 0, totalDue: 0 }
    
    const billingStart = selectedStudent.billingStartDate ? new Date(selectedStudent.billingStartDate) : (selectedStudent.createdAt?.toDate?.() || new Date())
    const endDate = new Date()
    const monthsElapsed = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth())
    const generatedRent = (monthsElapsed >= 0 ? monthsElapsed + 1 : 0) * (selectedStudent.monthlyRent || 0)
    
    const totalRentPaid = selectedStudent.paymentsHistory?.reduce((acc: number, curr: any) => {
      const isRefund = curr.type === 'refund'
      const rentPortion = (curr.seatAmount !== undefined) ? Number(curr.seatAmount) : (selectedStudent.paymentSystem === 'package' ? Number(curr.amount) : 0)
      return acc + (isRefund ? -rentPortion : rentPortion)
    }, 0) || 0

    const historicalRentDue = selectedStudent.duesBreakdown ? Object.values(selectedStudent.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
    const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

    const historicalFoodDue = Number(selectedStudent.foodDueAmount) || 0
    const generatedFoodCost = selectedStudent.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
    const totalFoodPaid = selectedStudent.paymentsHistory?.reduce((acc: number, curr: any) => {
      const isRefund = curr.type === 'refund'
      const foodPortion = (curr.foodAmount !== undefined) ? Number(curr.foodAmount) : (selectedStudent.paymentSystem === 'non-package' ? Number(curr.amount) : 0)
      return acc + (isRefund ? -foodPortion : foodPortion)
    }, 0) || 0
    const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)

    return { rentDue, foodBalance, totalDue: rentDue + (foodBalance < 0 ? Math.abs(foodBalance) : 0) }
  }, [selectedStudent])

  const handleCreatePayment = async () => {
    if (!formData.studentId || !formData.receiver) {
      toast({ variant: "destructive", title: "Error", description: "Please select student and receiver staff." })
      return
    }

    if (!selectedStudent) return

    const seatPaid = selectedStudent.paymentSystem === 'package' ? Number(formData.amount) : Number(formData.seatAmount)
    const foodPaid = selectedStudent.paymentSystem === 'non-package' ? Number(formData.foodAmount) : 0
    const addAdvance = Number(formData.addAdvanceAmount)
    const totalCashAmount = seatPaid + foodPaid + addAdvance

    if (totalCashAmount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Payment amount must be greater than zero." })
      return
    }

    setIsSubmitting(true)
    try {
      if (userRole === 'Building Manager') {
        // Create Approval Request instead of direct entry
        const reqId = doc(collection(db, "managerRequests")).id
        await setDoc(doc(db, "managerRequests", reqId), {
          id: reqId,
          requestType: "income",
          amount: totalCashAmount,
          seatAmount: seatPaid,
          foodAmount: foodPaid,
          advanceAmount: addAdvance,
          buildingId: selectedStudent.buildingId,
          buildingName: selectedStudent.buildingName,
          studentName: selectedStudent.name,
          studentId: selectedStudent.id,
          roomNumber: selectedStudent.roomNumber,
          branch: userBranch,
          month: formData.month,
          year: formData.year,
          method: formData.method,
          receiver: formData.receiver,
          description: formData.description || `Income Request: ${selectedStudent.name}`,
          requestedBy: localStorage.getItem("somikoron_auth_id"),
          requestedByName: userName,
          createdAt: serverTimestamp()
        })
        toast({ title: "Request Sent", description: "Your entry is waiting for admin approval." })
      } else {
        // Direct Entry for Admin/Manager
        const pId = doc(collection(db, "payments")).id
        const pRecord = {
          id: pId,
          amount: totalCashAmount,
          seatAmount: seatPaid,
          foodAmount: foodPaid,
          advanceAmount: addAdvance,
          buildingId: selectedStudent.buildingId,
          buildingName: selectedStudent.buildingName,
          studentName: selectedStudent.name,
          studentId: selectedStudent.id,
          roomNumber: selectedStudent.roomNumber,
          branch: userBranch,
          type: "income",
          month: formData.month,
          year: formData.year,
          method: formData.method,
          receiver: formData.receiver,
          description: formData.description || `Collection for ${formData.month} ${formData.year}`,
          date: serverTimestamp(),
          createdAt: serverTimestamp()
        }

        await setDoc(doc(db, "payments", pId), pRecord)

        const studentRef = doc(db, "students", selectedStudent.id)
        const mKey = `${formData.month} ${formData.year}`
        const currentMap = selectedStudent.duesBreakdown || {}
        
        if (seatPaid > 0 && currentMap[mKey] !== undefined) {
          currentMap[mKey] = Math.max(0, currentMap[mKey] - seatPaid)
          if (currentMap[mKey] === 0) delete currentMap[mKey]
        }

        await updateDoc(studentRef, {
          paymentsHistory: arrayUnion({ ...pRecord, date: new Date().toISOString() }),
          advanceAmount: increment(addAdvance),
          duesBreakdown: currentMap,
          updatedAt: serverTimestamp()
        })
        toast({ title: "Payment Recorded", description: `Amount ৳${totalCashAmount} collected.` })
      }

      setIsIncomeDialogOpen(false)
      setFormData({
        studentId: "",
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
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const combinedBalance = stats.fund.cash + stats.fund.bank + stats.fund.bkash + stats.fund.nagad
  const isLoading = buildingsLoading || studentsLoading || paymentsLoading || expensesLoading || transfersLoading

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Syncing Financial Records...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-24 relative">
      {/* Header / App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Dashboard</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Real-time overview for <span className="text-foreground font-bold">{userBranch}</span>.</p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-10 h-10 p-0 flex items-center justify-center bg-white border-slate-200 text-slate-600 rounded-xl shadow-sm [&>svg:last-child]:hidden">
              <CalendarIcon size={18} className="text-primary" />
              <span className="sr-only">Period Selector</span>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-100">
              <SelectItem value="today" className="font-medium">Today</SelectItem>
              <SelectItem value="this_week" className="font-medium">This Week</SelectItem>
              <SelectItem value="this_month" className="font-medium">This Month</SelectItem>
              <SelectItem value="this_year" className="font-medium">This Year</SelectItem>
            </SelectContent>
          </Select>

          {userRole !== 'Building Manager' && pendingMgrRequests && pendingMgrRequests.length > 0 && (
            <Link href="/manager-requests" className="hidden sm:block">
              <Button variant="outline" className="bg-orange-50 border-orange-200 text-orange-600 animate-pulse gap-2 rounded-xl h-10 px-4">
                <BellRing size={16}/> {pendingMgrRequests.length}
              </Button>
            </Link>
          )}

          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">
                {userName ? userName.substring(0, 2) : "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-success">Income</CardTitle>
            <div className="bg-success/10 p-1.5 rounded-full"><ArrowUpCircle className="h-4 w-4 text-success" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{stats.income.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1 capitalize">{timeRange.replace('_', ' ')} summary</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-destructive">Expenses</CardTitle>
            <div className="bg-destructive/10 p-1.5 rounded-full"><ArrowDownCircle className="h-4 w-4 text-destructive" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{stats.expense.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1 capitalize">{timeRange.replace('_', ' ')} summary</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-orange-400 rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Total Dues</CardTitle>
            <div className="bg-orange-50 p-1.5 rounded-full"><TrendingUp className="h-4 w-4 text-orange-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{stats.dues.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Branch Receivables</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-primary rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Residents</CardTitle>
            <div className="bg-primary/10 p-1.5 rounded-full"><Building2 className="h-4 w-4 text-primary" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.activeResidents}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Active in {buildings?.length || 0} properties</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-5">
        <Card className="lg:col-span-3 shadow-sm border-none bg-white rounded-3xl overflow-hidden">
          <CardHeader className="pb-6 border-b border-slate-50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-800">Branch Fund Status</CardTitle>
              <p className="text-xs text-muted-foreground font-medium mt-1">Reflects Opening Balances + Income - Expenses + Internal Transfers.</p>
            </div>
            <div className="bg-primary/5 p-3 rounded-2xl text-primary border border-primary/10"><CircleDollarSign size={24} /></div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-3xl border bg-white shadow-sm space-y-3 group hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground tracking-widest"><Banknote size={14} className="text-slate-400"/> Cash in Hand</div>
                <div className="text-2xl font-bold text-slate-800 tracking-tighter">৳{stats.fund.cash.toLocaleString()}</div>
              </div>
              <div className="p-6 rounded-3xl border bg-white shadow-sm space-y-3 group hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground tracking-widest"><Landmark size={14} className="text-slate-400"/> Bank Account</div>
                <div className="text-2xl font-bold text-slate-800 tracking-tighter">৳{stats.fund.bank.toLocaleString()}</div>
              </div>
              <div className="p-6 rounded-3xl border bg-white shadow-sm space-y-3 group hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-primary/60 tracking-widest"><Smartphone size={14} className="text-primary/60"/> Bkash Wallet</div>
                <div className="text-2xl font-bold text-primary tracking-tighter">৳{stats.fund.bkash.toLocaleString()}</div>
              </div>
              <div className="p-6 rounded-3xl border bg-white shadow-sm space-y-3 group hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-orange-500/60 tracking-widest"><Smartphone size={14} className="text-orange-400"/> Nagad Wallet</div>
                <div className="text-2xl font-bold text-orange-500 tracking-tighter">৳{stats.fund.nagad.toLocaleString()}</div>
              </div>
            </div>
            
            <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Combined Net Balance:</p>
              <div className="text-3xl font-bold text-primary tracking-tighter">৳{combinedBalance.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm border-none bg-white rounded-3xl overflow-hidden">
          <CardHeader className="pb-6 border-b border-slate-50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-primary px-4 py-1 bg-primary/5 rounded-lg border border-primary/10">Property Occupancy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-8">
              {buildings?.map((b: any) => {
                const occupancy = Math.round((b.occupiedSeats / (b.totalSeats || 1)) * 100)
                return (
                  <div key={b.id} className="space-y-3">
                    <div className="flex justify-between items-end">
                      <p className="text-sm font-bold text-slate-700">{b.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">{b.occupiedSeats}/{b.totalSeats} seats</span>
                        <span className="text-xs font-bold text-primary">{occupancy}%</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={cn(
                          "h-full transition-all duration-1000 ease-out rounded-full",
                          occupancy > 90 ? "bg-destructive" : occupancy > 70 ? "bg-orange-500" : "bg-primary"
                        )}
                        style={{ width: `${occupancy}%` }} 
                      />
                    </div>
                  </div>
                )
              })}
              {(!buildings || buildings.length === 0) && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-30">
                  <Building2 size={64} strokeWidth={1} />
                  <p className="mt-4 font-bold text-sm">No properties registered.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action FAB */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-4 items-end">
        {(userRole !== 'Building Manager' || canRequestIncome) && (
          <Button 
            size="icon" 
            onClick={() => setIsIncomeDialogOpen(true)}
            className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:scale-110 transition-transform border-4 border-white"
          >
            <Plus size={32} />
          </Button>
        )}
      </div>

      {/* NEW INCOME ENTRY DIALOG */}
      <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{userRole === 'Building Manager' ? 'Send Income Request' : 'New Income Entry'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Filtering Controls */}
            <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/30 rounded-xl border">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Building</Label>
                <Select value={entryBuildingFilter} onValueChange={val => { setEntryBuildingFilter(val); setEntryRoomFilter("all"); }}>
                  <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Buildings</SelectItem>
                    {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Room No.</Label>
                <Select value={entryRoomFilter} onValueChange={setEntryRoomFilter}>
                  <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rooms</SelectItem>
                    {availableRooms.map(r => (
                      <SelectItem key={r} value={r}>Room {r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Resident</Label>
              <Select value={formData.studentId} onValueChange={val => setFormData({...formData, studentId: val})}>
                <SelectTrigger><SelectValue placeholder="Choose student" /></SelectTrigger>
                <SelectContent>
                  {filteredStudentsForEntry.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} (R-{s.roomNumber})</SelectItem>
                  ))}
                  {filteredStudentsForEntry.length === 0 && <SelectItem disabled value="none">No matching residents</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {selectedStudent && (
              <div className="bg-primary/5 p-4 rounded-xl space-y-3 border border-primary/10 animate-in fade-in zoom-in-95 duration-200">
                <h4 className="text-[10px] font-bold uppercase text-primary flex items-center gap-1.5"><Calculator size={12}/> Resident Ledger Stats</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2 rounded border shadow-sm">
                    <p className="text-[8px] uppercase font-bold text-muted-foreground">Monthly Rent</p>
                    <p className="text-sm font-bold text-slate-800">৳{selectedStudent.monthlyRent}</p>
                  </div>
                  <div className={cn("bg-white p-2 rounded border shadow-sm", financialStats.rentDue > 0 ? "border-destructive/30" : "")}>
                    <p className="text-[8px] uppercase font-bold text-destructive">Overall Rent Due</p>
                    <p className="text-sm font-bold text-destructive">৳{financialStats.rentDue.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-2 rounded border shadow-sm">
                    <p className="text-[8px] uppercase font-bold text-success">Advance Pool</p>
                    <p className="text-sm font-bold text-success">৳{(selectedStudent.advanceAmount || 0).toLocaleString()}</p>
                  </div>
                  {selectedStudent.paymentSystem === 'non-package' && (
                    <div className={cn("bg-white p-2 rounded border shadow-sm", financialStats.foodBalance < 0 ? "border-destructive/30" : "border-success/30")}>
                      <p className={cn("text-[8px] uppercase font-bold", financialStats.foodBalance < 0 ? "text-destructive" : "text-success")}>Food Balance</p>
                      <p className={cn("text-sm font-bold", financialStats.foodBalance < 0 ? "text-destructive" : "text-success")}>৳{financialStats.foodBalance.toLocaleString()}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[8px] h-4 uppercase bg-white">Plan: {selectedStudent.paymentSystem}</Badge>
                  <Badge variant="outline" className="text-[8px] h-4 uppercase bg-white">Building: {selectedStudent.buildingName}</Badge>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>For Month</Label>
                <Select value={formData.month} onValueChange={val => setFormData({...formData, month: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={formData.year} onValueChange={val => setFormData({...formData, year: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["2024", "2025", "2026"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 border-2 border-primary/20 rounded-xl space-y-4 bg-primary/5">
              <Label className="font-bold text-primary flex items-center gap-2"><Calculator size={14} /> Collection Amounts</Label>
              {selectedStudent?.paymentSystem === 'package' ? (
                <div className="space-y-2">
                  <Label className="text-xs">Flat Amount Received (৳)</Label>
                  <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-xs">Seat Rent (৳)</Label><Input type="number" value={formData.seatAmount} onChange={e => setFormData({...formData, seatAmount: e.target.value})} placeholder="0.00" /></div>
                  <div className="space-y-2"><Label className="text-xs">Food Deposit (৳)</Label><Input type="number" value={formData.foodAmount} onChange={e => setFormData({...formData, foodAmount: e.target.value})} placeholder="0.00" /></div>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-primary">Add to Advance Pool (৳)</Label>
                <Input type="number" value={formData.addAdvanceAmount} onChange={e => setFormData({...formData, addAdvanceAmount: e.target.value})} placeholder="0.00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={formData.method} onValueChange={val => setFormData({...formData, method: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bkash">Bkash</SelectItem>
                    <SelectItem value="nagad">Nagad</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Received By</Label>
                <Select value={formData.receiver} onValueChange={val => setFormData({...formData, receiver: val})}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <Textarea 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              placeholder="Optional notes or receipt no..." 
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCreatePayment} disabled={isSubmitting} className="w-full h-12 text-lg font-bold">
              {isSubmitting ? <Loader2 className="animate-spin" /> : (userRole === 'Building Manager' ? "Send Approval Request" : "Confirm & Save Receipt")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
