
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  CheckCircle2,
  MoreVertical,
  Receipt,
  Lightbulb,
  Wrench,
  Utensils,
  Wifi,
  UserCircle,
  Zap,
  LayoutGrid,
  Apple,
  Table as TableIcon,
  Check,
  CircleAlert,
  Hash
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, serverTimestamp, setDoc, updateDoc, arrayUnion, increment, getDoc, writeBatch, limit, orderBy } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRouter } from "next/navigation"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2024", "2025", "2026", "2027", "2028"];

const EXPENSE_CATEGORIES = [
  { id: "rent", label: "Building Rent", icon: Building2 },
  { id: "electricity", label: "Electricity Bill", icon: Lightbulb },
  { id: "water", label: "Water & Gas Bill", icon: Receipt },
  { id: "maintenance", label: "Maintenance/Repair", icon: Wrench },
  { id: "food", label: "Food / Meal Cost", icon: Utensils },
  { id: "market", label: "General Market", icon: Apple },
  { id: "internet", label: "Internet Bill", icon: Wifi },
  { id: "salary", label: "Staff Salary", icon: UserCircle },
  { id: "others", label: "Others", icon: Wallet },
]

const timeRangeLabels: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  this_month: "This Month",
  this_year: "This Year",
  all_time: "All Time"
};

export default function DashboardPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const router = useRouter()
  
  // User Context
  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")
  const [timeRange, setTimeRange] = useState("this_month")

  // Dialog Controls
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false)
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
  const [isBulkMealEntryOpen, setIsBulkMealEntryOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Payment Entry State
  const [incomeForm, setIncomeForm] = useState({
    buildingId: "all",
    roomNumber: "all",
    studentId: "",
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    seatAmount: "",
    foodAmount: "",
    addAdvanceAmount: "0",
    method: "cash",
    receiver: "",
    description: ""
  })

  // Expense Entry State
  const [expenseForm, setExpenseForm] = useState({
    category: "others",
    amount: "",
    expenseDate: new Date().toISOString().split('T')[0],
    method: "cash",
    spentBy: "",
    buildingId: "none",
    apartmentName: "",
    roomNumber: "",
    meterNo: "",
    receiver: "",
    totalMeals: "",
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    description: ""
  })

  // Bulk Meal Entry State
  const [mealLogFilter, setMealLogFilter] = useState({
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    buildingId: "all"
  })
  const [mealInputs, setMealInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserName(localStorage.getItem("user_name") || "User")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setAssignedBuildingId(localStorage.getItem("assigned_building_id") || "none")
  }, [])

  // Queries
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
    let q = query(collection(db, "students"), where("branch", "==", userBranch))
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      q = query(collection(db, "students"), where("buildingId", "==", assignedBuildingId))
    }
    return q
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: students } = useCollection(studentsQuery)

  const staffQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "staff"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: staffList } = useCollection(staffQuery)

  const paymentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "payments"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: allPayments } = useCollection(paymentsQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "expenses"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: allExpenses } = useCollection(expensesQuery)

  const mealConfigRef = useMemoFirebase(() => doc(db, "configs", "mealRate"), [db])
  const { data: mealConfig } = useDoc(mealConfigRef)

  // Statistics Calculation
  const stats = useMemo(() => {
    const now = new Date()
    const isWithinRange = (date: Date, range: string) => {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      if (range === 'today') return date >= startOfToday
      if (range === 'yesterday') {
        const yesterday = new Date(startOfToday); yesterday.setDate(yesterday.getDate() - 1)
        return date >= yesterday && date < startOfToday
      }
      if (range === 'this_week') {
        const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay())
        return date >= startOfWeek
      }
      if (range === 'this_month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      if (range === 'this_year') return date.getFullYear() === now.getFullYear()
      return true
    }

    const filteredPayments = (allPayments || []).filter(p => isWithinRange(p.date?.toDate ? p.date.toDate() : new Date(p.date), timeRange))
    const filteredExpenses = (allExpenses || []).filter(e => e.expenseDate && isWithinRange(new Date(e.expenseDate), timeRange))

    const income = filteredPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
    const expense = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0)
    
    const totalDue = (students || []).filter(s => s.isActive).reduce((acc, s) => {
      const rentDue = Number(s.totalDue || 0);
      const foodDebt = (s.foodDueAmount || 0) < 0 ? Math.abs(s.foodDueAmount) : 0;
      return acc + rentDue + foodDebt;
    }, 0)

    return { 
      income, 
      expense, 
      activeResidents: (students || []).filter(s => s.isActive).length,
      totalDue
    }
  }, [allPayments, allExpenses, students, timeRange])

  // Payment Entry Logic
  const selectedStudentForPayment = useMemo(() => 
    students?.find(s => s.id === incomeForm.studentId), 
    [students, incomeForm.studentId]
  )

  const handleCreatePayment = async () => {
    if (!incomeForm.studentId || !incomeForm.receiver || !selectedStudentForPayment) {
      toast({ variant: "destructive", title: "Error", description: "Please complete all fields." })
      return
    }
    setIsSubmitting(true)
    try {
      const pId = doc(collection(db, "payments")).id
      const seatPaid = Number(incomeForm.seatAmount || 0)
      const foodPaid = Number(incomeForm.foodAmount || 0)
      const extraAdvance = Number(incomeForm.addAdvanceAmount || 0)
      const totalAmt = seatPaid + foodPaid + extraAdvance
      
      const pRecord = {
        id: pId, amount: totalAmt, seatAmount: seatPaid, foodAmount: foodPaid, advanceAmount: extraAdvance,
        studentName: selectedStudentForPayment.name, studentId: selectedStudentForPayment.id, 
        buildingId: selectedStudentForPayment.buildingId, buildingName: selectedStudentForPayment.buildingName, 
        roomNumber: selectedStudentForPayment.roomNumber, branch: userBranch,
        type: "income", month: incomeForm.month, year: incomeForm.year, method: incomeForm.method, 
        receiver: incomeForm.receiver, description: incomeForm.description, date: new Date().toISOString()
      }

      await setDoc(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp(), createdAt: serverTimestamp() })
      
      const currentDues = { ...(selectedStudentForPayment.duesBreakdown || {}) };
      const targetLabel = `${incomeForm.month} ${incomeForm.year}`;
      let remainingRentPaid = seatPaid;

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

      if (remainingRentPaid > 0) {
        const sortedMonths = Object.keys(currentDues).sort((a, b) => {
          const [mA, yA] = a.split(' ');
          const [mB, yB] = b.split(' ');
          if (yA !== yB) return Number(yA) - Number(yB);
          return MONTHS.indexOf(mA) - MONTHS.indexOf(mB);
        });
        for (const m of sortedMonths) {
          if (remainingRentPaid <= 0) break;
          const dueAmt = Number(currentDues[m].amount);
          if (remainingRentPaid >= dueAmt) {
            remainingRentPaid -= dueAmt;
            delete currentDues[m];
          } else {
            currentDues[m].amount = dueAmt - remainingRentPaid;
            remainingRentPaid = 0;
          }
        }
      }

      const finalTotalDue = Object.values(currentDues).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);

      await updateDoc(doc(db, "students", selectedStudentForPayment.id), {
        paymentsHistory: arrayUnion(pRecord),
        advanceAmount: increment(extraAdvance),
        totalDue: finalTotalDue,
        duesBreakdown: currentDues,
        foodDueAmount: increment(foodPaid),
        historicalTotalReceived: increment(totalAmt),
        updatedAt: serverTimestamp()
      })
      
      toast({ title: "Payment Successful" })
      setIsIncomeDialogOpen(false)
      setIncomeForm({
        buildingId: "all", roomNumber: "all", studentId: "", 
        month: MONTHS[new Date().getMonth()], year: new Date().getFullYear().toString(),
        seatAmount: "", foodAmount: "", addAdvanceAmount: "0", 
        method: "cash", receiver: "", description: ""
      })
      router.refresh();
      router.push(`/receipts/${pId}`)
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message }) 
    } finally { 
      setIsSubmitting(false) 
    }
  }

  // Expense Entry Logic
  const handleCreateExpense = async () => {
    if (!expenseForm.amount || !expenseForm.spentBy) {
      toast({ variant: "destructive", title: "Error", description: "Amount and Spent By are required." })
      return
    }
    setIsSubmitting(true)
    try {
      const selectedB = buildings?.find(b => b.id === expenseForm.buildingId)
      const expenseId = doc(collection(db, "expenses")).id
      const amount = Number(expenseForm.amount)
      
      const expenseData = { 
        ...expenseForm, 
        id: expenseId,
        amount, 
        totalMeals: expenseForm.category === 'food' ? Number(expenseForm.totalMeals || 0) : 0,
        branch: userBranch, 
        buildingName: selectedB?.name || "General", 
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp() 
      }

      await setDoc(doc(db, "expenses", expenseId), expenseData)

      // Dual Save for Food Category
      if (expenseForm.category === 'food') {
        const breakdownId = doc(collection(db, "foodCostBreakdown")).id
        await setDoc(doc(db, "foodCostBreakdown", breakdownId), {
          id: breakdownId,
          expenseId,
          branch: userBranch,
          branchName: userBranch,
          date: expenseForm.expenseDate,
          amount,
          totalMeals: Number(expenseForm.totalMeals || 0),
          createdBy: localStorage.getItem("somikoron_auth_id"),
          createdByName: userName,
          createdAt: serverTimestamp()
        })
      }

      toast({ title: "Expense Recorded" })
      setIsExpenseDialogOpen(false)
      setExpenseForm({
        category: "others", amount: "", expenseDate: new Date().toISOString().split('T')[0],
        method: "cash", spentBy: "", buildingId: "none", apartmentName: "", roomNumber: "",
        meterNo: "", receiver: "", totalMeals: "", month: MONTHS[new Date().getMonth()],
        year: new Date().getFullYear().toString(), description: ""
      })
      router.refresh();
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message }) 
    } finally { 
      setIsSubmitting(false) 
    }
  }

  // Bulk Meal Entry Submit
  const handleBulkMealSubmit = async () => {
    if (!students || !mealConfig?.rate) return;
    setIsSubmitting(true);
    const batch = writeBatch(db);
    const mealRate = Number(mealConfig.rate);
    const monthLabel = `${mealLogFilter.month} ${mealLogFilter.year}`;

    try {
      students.forEach(s => {
        if (!s.isActive || s.paymentSystem === 'package') return;
        const count = Number(mealInputs[s.id] || 0);
        if (count <= 0) return;

        const totalCost = count * mealRate;
        const mealRecord = {
          month: monthLabel,
          totalMeals: count,
          perMealCost: mealRate,
          totalCost: totalCost,
          date: new Date().toISOString()
        };

        batch.update(doc(db, "students", s.id), {
          mealsHistory: arrayUnion(mealRecord),
          foodDueAmount: increment(-totalCost),
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      toast({ title: "Bulk Entries Submitted", description: "Student balances updated successfully." });
      setMealInputs({});
      setIsBulkMealEntryOpen(false);
      router.refresh();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Dashboard</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Real-time overview for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] h-9 bg-white border-none shadow-sm font-bold text-xs">
              <CalendarIcon size={14} className="mr-2 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="all_time">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Link href="/profile">
            <Avatar className="h-9 w-9 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar>
          </Link>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-success rounded-2xl group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-success tracking-widest">Income</CardTitle><ArrowUpCircle className="h-4 w-4 text-success" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-slate-900">৳{stats.income.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-destructive rounded-2xl group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-destructive tracking-widest">Expenses</CardTitle><ArrowDownCircle className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-slate-900">৳{stats.expense.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-orange-500 rounded-2xl group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-orange-600 tracking-widest">Total Dues</CardTitle><AlertCircle className="h-4 w-4 text-orange-600" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-slate-900">৳{stats.totalDue.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-primary rounded-2xl group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-primary tracking-widest">Residents</CardTitle><Users className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-slate-900">{stats.activeResidents}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Buildings Card */}
        <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2"><Building2 size={20} className="text-primary"/> Building Status</CardTitle>
              <CardDescription>Capacity overview for your branch.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {buildings?.map(b => {
              const occRate = (b.occupiedSeats / (b.totalSeats || 1)) * 100
              return (
                <div key={b.id} className="p-4 rounded-2xl bg-secondary/20 border border-secondary group hover:bg-white hover:shadow-md transition-all cursor-pointer" onClick={() => router.push(`/buildings/${b.id}`)}>
                  <div className="flex justify-between items-start mb-3">
                    <div><h4 className="font-bold text-slate-800">{b.name}</h4><p className="text-[10px] font-bold text-muted-foreground uppercase">{b.address}</p></div>
                    <Badge className={cn("text-[8px] font-black", occRate > 90 ? "bg-destructive" : "bg-success")}>{occRate.toFixed(0)}% FULL</Badge>
                  </div>
                  <Progress value={occRate} className="h-1.5 mb-2" />
                  <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground"><span>{b.occupiedSeats} Occupied</span> <span>{b.emptySeats} Free</span></div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Funds Card */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b flex justify-between items-center">
            <CardTitle className="text-lg font-bold flex items-center gap-2"><Wallet size={20} className="text-primary"/> Branch Fund</CardTitle>
            <div className="text-right">
              <p className="text-[8px] font-bold text-muted-foreground uppercase">Net Balance</p>
              <p className="text-lg font-black text-primary">৳{(stats.income - stats.expense).toLocaleString()}</p>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            {[
              { label: "Cash", icon: Banknote, color: "text-green-600", val: (allPayments || []).filter(p => p.method === 'cash').reduce((a,b)=>a+b.amount,0) - (allExpenses || []).filter(e => e.method === 'cash').reduce((a,b)=>a+b.amount,0) },
              { label: "Bank", icon: Landmark, color: "text-blue-600", val: (allPayments || []).filter(p => p.method === 'bank').reduce((a,b)=>a+b.amount,0) - (allExpenses || []).filter(e => e.method === 'bank').reduce((a,b)=>a+b.amount,0) },
              { label: "Bkash", icon: Smartphone, color: "text-pink-600", val: (allPayments || []).filter(p => p.method === 'bkash').reduce((a,b)=>a+b.amount,0) - (allExpenses || []).filter(e => e.method === 'bkash').reduce((a,b)=>a+b.amount,0) },
              { label: "Nagad", icon: Smartphone, color: "text-orange-600", val: (allPayments || []).filter(p => p.method === 'nagad').reduce((a,b)=>a+b.amount,0) - (allExpenses || []).filter(e => e.method === 'nagad').reduce((a,b)=>a+b.amount,0) },
            ].map((fund, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-3"><fund.icon size={18} className={fund.color} /><span className="text-sm font-medium text-slate-600">{fund.label}</span></div>
                <span className="font-black text-slate-800">৳{fund.val.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* FAB */}
      <div className="fixed bottom-8 right-8 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-2xl bg-primary border-4 border-white transition-transform hover:scale-110 active:scale-95">
              <Plus size={32} className="text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2 shadow-xl mb-4 border-slate-100">
            <DropdownMenuItem onClick={() => setIsIncomeDialogOpen(true)} className="gap-3 p-3 rounded-xl font-bold cursor-pointer hover:bg-success/10"><Wallet size={18} className="text-success"/> Payment Entry</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsExpenseDialogOpen(true)} className="gap-3 p-3 rounded-xl font-bold cursor-pointer hover:bg-destructive/10"><Receipt size={18} className="text-destructive"/> Expense Entry</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsBulkMealEntryOpen(true)} className="gap-3 p-3 rounded-xl font-bold cursor-pointer hover:bg-primary/10"><Utensils size={18} className="text-primary"/> Monthly Bulk Meal Entry</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* PAYMENT ENTRY DIALOG */}
      <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-none shadow-2xl">
          <div className="h-2 bg-success w-full" />
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-success"><Wallet size={20}/> Payment Entry</DialogTitle>
            <DialogDescription>Record a new incoming payment from resident.</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-6">
            {/* Step 1: Selection Chain */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Building</Label>
                  <Select value={incomeForm.buildingId} onValueChange={val => setIncomeForm({...incomeForm, buildingId: val, roomNumber: "all", studentId: ""})}>
                    <SelectTrigger className="bg-slate-50 border-none h-10 rounded-xl shadow-inner font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Building</SelectItem>
                      {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Room</Label>
                  <Select value={incomeForm.roomNumber} onValueChange={val => setIncomeForm({...incomeForm, roomNumber: val, studentId: ""})}>
                    <SelectTrigger className="bg-slate-50 border-none h-10 rounded-xl shadow-inner font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Room</SelectItem>
                      {Array.from(new Set(students?.filter(s => (incomeForm.buildingId === 'all' || s.buildingId === incomeForm.buildingId)).map(s => s.roomNumber))).sort().map(r => (
                        <SelectItem key={r} value={r}>Room {r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Select Student</Label>
                <Select value={incomeForm.studentId} onValueChange={val => setIncomeForm({...incomeForm, studentId: val})}>
                  <SelectTrigger className="bg-slate-50 border-none h-11 rounded-xl shadow-inner font-black"><SelectValue placeholder="Choose Resident" /></SelectTrigger>
                  <SelectContent>
                    {students?.filter(s => 
                      (incomeForm.buildingId === 'all' || s.buildingId === incomeForm.buildingId) && 
                      (incomeForm.roomNumber === 'all' || s.roomNumber === incomeForm.roomNumber) && 
                      s.isActive
                    ).map(s => <SelectItem key={s.id} value={s.id}>{s.name} (R-{s.roomNumber})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Step 2: Auto-fetched Stats */}
            {selectedStudentForPayment && (
              <div className="p-5 bg-slate-900 rounded-3xl text-white space-y-4 shadow-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-black uppercase text-success/70 tracking-widest">Monthly Rent</p>
                    <p className="text-xl font-black">৳{selectedStudentForPayment.monthlyRent || 0}</p>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <p className="text-[8px] font-black uppercase text-primary/70 tracking-widest">Security Advance</p>
                    <p className="text-xl font-black">৳{selectedStudentForPayment.advanceAmount || 0}</p>
                  </div>
                </div>
                
                <Separator className="bg-white/10" />
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[8px] font-black uppercase text-destructive tracking-widest">Outstanding Dues</p>
                    <Badge variant="destructive" className="text-[8px] h-4">৳{selectedStudentForPayment.totalDue || 0}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-[80px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
                    {Object.entries(selectedStudentForPayment.duesBreakdown || {}).map(([label, data]: any) => (
                      <div key={label} className="bg-white/5 p-1.5 rounded-lg flex justify-between items-center border border-white/5">
                        <span className="text-[8px] font-medium">{label}</span>
                        <span className="text-[9px] font-black text-destructive">৳{data.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedStudentForPayment.paymentSystem === 'non-package' && (
                  <div className="pt-2 flex justify-between items-center border-t border-white/10">
                    <p className="text-[8px] font-black uppercase text-orange-400 tracking-widest">Food Balance</p>
                    <span className={cn("text-xs font-black", (selectedStudentForPayment.foodDueAmount || 0) < 0 ? "text-destructive" : "text-success")}>
                      ৳{selectedStudentForPayment.foodDueAmount || 0}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Inputs */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label className="text-xs">Month</Label><Select value={incomeForm.month} onValueChange={v => setIncomeForm({...incomeForm, month: v})}><SelectTrigger className="h-10 rounded-xl"><SelectValue/></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Year</Label><Select value={incomeForm.year} onValueChange={v => setIncomeForm({...incomeForm, year: v})}><SelectTrigger className="h-10 rounded-xl"><SelectValue/></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
              </div>

              <div className="p-5 border-2 border-success/10 bg-success/5 rounded-3xl space-y-4 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Rent Amount</Label>
                    <Input type="number" value={incomeForm.seatAmount} onChange={e => setIncomeForm({...incomeForm, seatAmount: e.target.value})} className="bg-white h-11 text-lg font-black" placeholder="0.00" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Food Amount</Label>
                    <Input disabled={selectedStudentForPayment?.paymentSystem === 'package'} type="number" value={incomeForm.foodAmount} onChange={e => setIncomeForm({...incomeForm, foodAmount: e.target.value})} className="bg-white h-11 text-lg font-black" placeholder="0.00" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-primary">Add to Advance (Security)</Label>
                  <Input type="number" value={incomeForm.addAdvanceAmount} onChange={e => setIncomeForm({...incomeForm, addAdvanceAmount: e.target.value})} className="bg-white h-11 border-primary/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Method</Label>
                  <Select value={incomeForm.method} onValueChange={v => setIncomeForm({...incomeForm, method: v})}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Receiver</Label>
                  <Select value={incomeForm.receiver} onValueChange={v => setIncomeForm({...incomeForm, receiver: v})}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Staff"/></SelectTrigger>
                    <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea value={incomeForm.description} onChange={e => setIncomeForm({...incomeForm, description: e.target.value})} placeholder="Additional notes..." className="rounded-2xl bg-slate-50 border-none shadow-inner min-h-[80px]" />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t mt-2">
            <Button onClick={handleCreatePayment} disabled={isSubmitting || !incomeForm.studentId} className="w-full h-14 rounded-2xl text-lg font-black bg-success hover:bg-success/90 shadow-xl shadow-success/20">
              {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2"/>} Confirm & Generate Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EXPENSE ENTRY DIALOG */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-none shadow-2xl">
          <div className="h-2 bg-destructive w-full" />
          <DialogHeader className="px-8 pt-8">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-destructive"><Receipt size={24}/> Expense Entry</DialogTitle>
            <DialogDescription>Record hostel operational expense by category.</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><LayoutGrid size={14}/> Core Details</Label>
                  <div className="space-y-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Expense Date</Label>
                      <Input type="date" value={expenseForm.expenseDate} onChange={e => setExpenseForm({...expenseForm, expenseDate: e.target.value})} className="bg-white h-11 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Category</Label>
                      <Select value={expenseForm.category} onValueChange={v => setExpenseForm({...expenseForm, category: v, buildingId: "none", apartmentName: "", roomNumber: "", receiver: "", totalMeals: ""})}>
                        <SelectTrigger className="bg-white h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Amount (৳)</Label>
                      <Input type="number" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} className="bg-white h-11 rounded-xl text-lg font-black text-destructive" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Wallet size={14}/> Payment Info</Label>
                  <div className="grid grid-cols-1 gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Method</Label>
                      <Select value={expenseForm.method} onValueChange={v => setExpenseForm({...expenseForm, method: v})}>
                        <SelectTrigger className="bg-white h-11 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Spent By (Staff)</Label>
                      <Select value={expenseForm.spentBy} onValueChange={v => setExpenseForm({...expenseForm, spentBy: v})}>
                        <SelectTrigger className="bg-white h-11 rounded-xl"><SelectValue placeholder="Staff Name" /></SelectTrigger>
                        <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Fields Section */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Zap size={14}/> Context Fields</Label>
                  <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 space-y-5 min-h-[300px]">
                    {['rent', 'electricity', 'water', 'maintenance', 'others'].includes(expenseForm.category) && (
                      <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Target Building</Label>
                          <Select value={expenseForm.buildingId} onValueChange={v => setExpenseForm({...expenseForm, buildingId: v, apartmentName: "", roomNumber: ""})}>
                            <SelectTrigger className="bg-white h-10 rounded-xl"><SelectValue placeholder="Building" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">General / No Building</SelectItem>
                              {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        {expenseForm.category === 'electricity' && (
                          <div className="space-y-1.5"><Label className="text-xs">Meter Number</Label><Input value={expenseForm.meterNo} onChange={e => setExpenseForm({...expenseForm, meterNo: e.target.value})} className="bg-white h-10 rounded-xl" /></div>
                        )}
                        {['maintenance', 'others'].includes(expenseForm.category) && (
                          <div className="space-y-1.5"><Label className="text-xs">Room / Unit</Label><Input value={expenseForm.roomNumber} onChange={e => setExpenseForm({...expenseForm, roomNumber: e.target.value})} className="bg-white h-10 rounded-xl" /></div>
                        )}
                      </div>
                    )}

                    {expenseForm.category === 'salary' && (
                      <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Staff Member</Label>
                          <Select value={expenseForm.receiver} onValueChange={v => setExpenseForm({...expenseForm, receiver: v})}>
                            <SelectTrigger className="bg-white h-10 rounded-xl"><SelectValue placeholder="Recipient" /></SelectTrigger>
                            <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={expenseForm.month} onValueChange={v => setExpenseForm({...expenseForm, month: v})}><SelectTrigger className="bg-white h-10 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                          <Select value={expenseForm.year} onValueChange={v => setExpenseForm({...expenseForm, year: v})}><SelectTrigger className="bg-white h-10 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                        </div>
                      </div>
                    )}

                    {expenseForm.category === 'food' && (
                      <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <p className="text-[10px] text-primary font-bold bg-primary/10 p-2 rounded-lg leading-tight">This will create a dual record in Expense and Food Cost Breakdown.</p>
                        <div className="space-y-1.5"><Label className="text-xs font-bold text-primary">Total Meals Logged</Label><Input type="number" placeholder="Optional" value={expenseForm.totalMeals} onChange={e => setExpenseForm({...expenseForm, totalMeals: e.target.value})} className="bg-white h-11 rounded-xl text-lg font-black border-primary/20" /></div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Received By</Label>
                          <Select value={expenseForm.receiver} onValueChange={v => setExpenseForm({...expenseForm, receiver: v})}>
                            <SelectTrigger className="bg-white h-10 rounded-xl"><SelectValue placeholder="Market Manager / Cook" /></SelectTrigger>
                            <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs">Description / Notes</Label>
                      <Textarea value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} placeholder="Details..." className="bg-white rounded-2xl resize-none min-h-[100px]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t">
            <Button onClick={handleCreateExpense} disabled={isSubmitting} className="w-full h-16 rounded-3xl text-xl font-black bg-destructive hover:bg-destructive/90 shadow-2xl shadow-destructive/20 gap-3">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Receipt size={24}/>} Save Expense Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MONTHLY BULK MEAL ENTRY DIALOG */}
      <Dialog open={isBulkMealEntryOpen} onOpenChange={setIsBulkMealEntryOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col rounded-[2.5rem] p-0 border-none shadow-2xl">
          <div className="h-2 bg-primary w-full" />
          <DialogHeader className="px-8 pt-8 pb-4">
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
              <div>
                <DialogTitle className="text-2xl font-black flex items-center gap-2 text-primary"><Utensils size={24}/> Monthly Bulk Meal Entry</DialogTitle>
                <DialogDescription>Spreadsheet style entry for mass balance updates.</DialogDescription>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 rounded-2xl border border-primary/10">
                <Calculator size={16} className="text-primary" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Global Meal Rate</span>
                  <span className="text-sm font-black text-primary">৳{mealConfig?.rate || 0} / Meal</span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="px-8 py-4 bg-slate-50 border-y flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[120px] space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Month</Label><Select value={mealLogFilter.month} onValueChange={v => setMealLogFilter({...mealLogFilter, month: v})}><SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex-1 min-w-[120px] space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Year</Label><Select value={mealLogFilter.year} onValueChange={v => setMealLogFilter({...mealLogFilter, year: v})}><SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex-1 min-w-[150px] space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Building</Label><Select value={mealLogFilter.buildingId} onValueChange={v => setMealLogFilter({...mealLogFilter, buildingId: v})}><SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground" onClick={() => { setMealInputs({}); toast({ title: "Inputs Cleared" }); }}><RotateCcw size={18}/></Button>
          </div>

          <ScrollArea className="flex-1 px-8 py-2">
            <Table>
              <TableHeader className="bg-white sticky top-0 z-10">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Resident Details</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Current Balance</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-right w-32">Meal Count</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-right w-32">Total Bill</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-right w-32">New Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students?.filter(s => (mealLogFilter.buildingId === 'all' || s.buildingId === mealLogFilter.buildingId) && s.isActive && s.paymentSystem === 'non-package').map(s => {
                  const count = Number(mealInputs[s.id] || 0)
                  const rate = Number(mealConfig?.rate || 0)
                  const bill = count * rate
                  const currentBal = Number(s.foodDueAmount || 0)
                  const newBal = currentBal - bill

                  return (
                    <TableRow key={s.id} className={cn("group transition-colors", newBal < 0 && "bg-destructive/[0.02]")}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary font-bold text-[10px]">{s.name.substring(0, 2).toUpperCase()}</div>
                          <div><p className="font-bold text-slate-800 text-sm">{s.name}</p><p className="text-[10px] font-bold text-muted-foreground uppercase">{s.buildingName} • R-{s.roomNumber}</p></div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn("font-black text-[10px] px-3", currentBal < 0 ? "text-destructive border-destructive/20" : "text-success border-success/20")}>৳{currentBal}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="relative inline-block w-full max-w-[80px]">
                          <Input 
                            type="number" 
                            className="h-10 text-center font-black bg-slate-50 border-none shadow-inner rounded-xl focus:ring-primary/20" 
                            value={mealInputs[s.id] || ""} 
                            onChange={e => setMealInputs({...mealInputs, [s.id]: e.target.value})} 
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-600">৳{bill}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn("font-black text-sm", newBal < 0 ? "text-destructive" : "text-primary")}>৳{newBal}</span>
                        {newBal < 0 && <p className="text-[8px] font-bold uppercase text-destructive tracking-widest mt-0.5">Due Created</p>}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {students?.filter(s => (mealLogFilter.buildingId === 'all' || s.buildingId === mealLogFilter.buildingId) && s.isActive && s.paymentSystem === 'non-package').length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No non-package residents found matching filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          <DialogFooter className="p-8 bg-slate-50 border-t flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex gap-12 text-center">
              <div className="space-y-0.5"><p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Total Recipients</p><p className="text-xl font-black text-slate-800">{Object.keys(mealInputs).filter(id => Number(mealInputs[id]) > 0).length}</p></div>
              <div className="space-y-0.5"><p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Grand Bill Sum</p><p className="text-xl font-black text-primary">৳{Object.keys(mealInputs).reduce((acc, id) => acc + (Number(mealInputs[id]) * Number(mealConfig?.rate || 0)), 0)}</p></div>
            </div>
            <Button onClick={handleBulkMealSubmit} disabled={isSubmitting || Object.keys(mealInputs).length === 0} className="w-full md:w-80 h-16 rounded-[1.5rem] text-xl font-black shadow-2xl shadow-primary/20 gap-3">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24}/>} Confirm & Submit All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
