
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
  CircleAlert
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, serverTimestamp, setDoc, updateDoc, arrayUnion, increment, getDoc, writeBatch } from "firebase/firestore"
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
import { sendSMS } from "@/app/actions/sms"
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
  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")
  const [timeRange, setTimeRange] = useState("this_month")

  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false)
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
  const [isBulkMealEntryOpen, setIsBulkMealEntryOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [mealLogFilter, setMealLogFilter] = useState({
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    buildingId: "all"
  })
  const [mealInputs, setMealLogInputs] = useState<Record<string, string>>({})

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

  const [expenseFormData, setExpenseFormData] = useState({
    category: "others",
    buildingId: "none",
    apartmentName: "",
    roomNumber: "",
    meterNo: "",
    amount: "",
    totalMeals: "",
    method: "cash",
    expensePartyName: "",
    receiver: "",
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    description: "",
    expenseDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserName(localStorage.getItem("user_name") || "User")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setAssignedBuildingId(localStorage.getItem("assigned_building_id") || "none")
  }, [])

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

  const configRef = useMemoFirebase(() => doc(db, "configs", "mealRate"), [db])
  const { data: mealConfig } = useDoc(configRef)

  const staffQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "staff"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: staffList } = useCollection(staffQuery)

  // Auto Rent Generation Logic - Object Based
  useEffect(() => {
    const generateMonthlyRent = async () => {
      if (!students || students.length === 0 || !userBranch) return;
      const now = new Date();
      const currentMonth = MONTHS[now.getMonth()];
      const currentYear = now.getFullYear().toString();
      const currentMonthLabel = `${currentMonth} ${currentYear}`;
      const batch = writeBatch(db);
      let updatesCount = 0;

      students.forEach(s => {
        if (!s.isActive) return;
        const dues = { ...(s.duesBreakdown || {}) };
        
        // Logical check: If month+year is missing from breakdown map, add it
        if (dues[currentMonthLabel] === undefined) {
          const rent = Number(s.monthlyRent || 0);
          dues[currentMonthLabel] = {
            month: currentMonth,
            year: currentYear,
            amount: rent
          };
          // Recalculate totalDue as sum of all objects in map
          const total = Object.values(dues).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);
          batch.update(doc(db, "students", s.id), {
            duesBreakdown: dues,
            totalDue: total,
            updatedAt: serverTimestamp()
          });
          updatesCount++;
        }
      });

      if (updatesCount > 0) {
        try { await batch.commit(); } catch (e) { console.error("Auto-rent failed:", e); }
      }
    };

    if (userRole === 'Admin' || userRole === 'Branch Manager') {
      generateMonthlyRent();
    }
  }, [students, userBranch, userRole, db]);

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

    const totalIncome = filteredPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
    const totalExpense = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0)
    
    // Total Due from DB field (which is kept updated as sum of breakdown)
    const totalDue = (students || []).filter(s => s.isActive).reduce((acc, s) => {
      const rentDue = Number(s.totalDue || 0);
      const foodDebt = (s.foodDueAmount || 0) < 0 ? Math.abs(s.foodDueAmount) : 0;
      return acc + rentDue + foodDebt;
    }, 0)

    return { 
      income: totalIncome, 
      expense: totalExpense, 
      activeResidents: (students || []).filter(s => s.isActive).length,
      totalDue
    }
  }, [allPayments, allExpenses, students, timeRange])

  // Bulk Meal Entry Logic - Deducts from foodDueAmount (Net balance)
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

        // SUBTRACT from net balance (Minus cost)
        batch.update(doc(db, "students", s.id), {
          mealsHistory: arrayUnion(mealRecord),
          foodDueAmount: increment(-totalCost),
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      toast({ title: "Meals Logged", description: "Food balances updated." });
      setMealLogInputs({});
      setIsBulkMealEntryOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Payment Logic - Standardized
  const handleCreatePayment = async () => {
    const selectedStudent = students?.find(s => s.id === formData.studentId)
    if (!formData.studentId || !formData.receiver || !selectedStudent) return
    setIsSubmitting(true)
    try {
      const pId = doc(collection(db, "payments")).id
      const seatPaid = selectedStudent.paymentSystem === 'package' ? Number(formData.amount || 0) : Number(formData.seatAmount || 0)
      const foodPaid = selectedStudent.paymentSystem === 'non-package' ? Number(formData.foodAmount || 0) : 0
      const extraAdvance = Number(formData.addAdvanceAmount || 0)
      const totalAmt = seatPaid + foodPaid + extraAdvance
      
      const pRecord = {
        id: pId, amount: totalAmt, seatAmount: seatPaid, foodAmount: foodPaid, advanceAmount: extraAdvance,
        studentName: selectedStudent.name, studentId: selectedStudent.id, buildingId: selectedStudent.buildingId,
        buildingName: selectedStudent.buildingName, roomNumber: selectedStudent.roomNumber, branch: userBranch,
        type: "income", month: formData.month, year: formData.year, method: formData.method, receiver: formData.receiver,
        description: formData.description, date: new Date().toISOString()
      }

      await setDoc(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp(), createdAt: serverTimestamp() })
      
      const currentDues = { ...(selectedStudent.duesBreakdown || {}) };
      const targetLabel = `${formData.month} ${formData.year}`;
      let remainingRentPaid = seatPaid;

      // Deduct from specific month object if exists
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

      // If still have money, pay other months
      if (remainingRentPaid > 0) {
        const remainingMonths = Object.keys(currentDues).sort((a, b) => {
          const [mA, yA] = a.split(' ');
          const [mB, yB] = b.split(' ');
          if (yA !== yB) return Number(yA) - Number(yB);
          return MONTHS.indexOf(mA) - MONTHS.indexOf(mB);
        });

        for (const month of remainingMonths) {
          if (remainingRentPaid <= 0) break;
          const dueAmt = Number(currentDues[month].amount);
          if (remainingRentPaid >= dueAmt) {
            remainingRentPaid -= dueAmt;
            delete currentDues[month];
          } else {
            currentDues[month].amount = dueAmt - remainingRentPaid;
            remainingRentPaid = 0;
          }
        }
      }

      // Recalculate totalDue as sum of all objects in duesBreakdown
      const finalTotalDue = Object.values(currentDues).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);

      await updateDoc(doc(db, "students", selectedStudent.id), {
        paymentsHistory: arrayUnion(pRecord),
        advanceAmount: increment(extraAdvance),
        totalDue: finalTotalDue,
        duesBreakdown: currentDues,
        foodDueAmount: increment(foodPaid), // PLUS to net balance
        historicalTotalReceived: increment(totalAmt), // Accumulate total received
        updatedAt: serverTimestamp()
      })
      
      toast({ title: "Payment Recorded" })
      setIsIncomeDialogOpen(false)
      router.push(`/receipts/${pId}`)
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsSubmitting(false) }
  }

  const handleCreateExpense = async () => {
    if (!expenseFormData.amount || !expenseFormData.expensePartyName) return
    setIsSubmitting(true)
    try {
      const selectedB = buildings?.find(b => b.id === expenseFormData.buildingId)
      const expenseId = doc(collection(db, "expenses")).id
      const expenseData = { 
        ...expenseFormData, 
        amount: Number(expenseFormData.amount), 
        branch: userBranch, 
        buildingName: selectedB?.name || "General", 
        updatedAt: serverTimestamp() 
      }
      await setDoc(doc(db, "expenses", expenseId), { ...expenseData, id: expenseId, createdAt: serverTimestamp() })
      toast({ title: "Expense Saved" })
      setIsExpenseDialogOpen(false)
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) }
    finally { setIsSubmitting(false) }
  }

  const selectedStudentForEntry = useMemo(() => students?.find(s => s.id === formData.studentId), [students, formData.studentId]);

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

      {/* Main Dashboard Cards */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-success tracking-widest">Income ({timeRangeLabels[timeRange]})</CardTitle><ArrowUpCircle className="h-4 w-4 text-success" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-slate-900">৳{stats.income.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-destructive tracking-widest">Expenses ({timeRangeLabels[timeRange]})</CardTitle><ArrowDownCircle className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-slate-900">৳{stats.expense.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-orange-500 rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-orange-600 tracking-widest">Total Dues</CardTitle><AlertCircle className="h-4 w-4 text-orange-600" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-slate-900">৳{stats.totalDue.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-[6px] border-l-primary rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-primary tracking-widest">Residents</CardTitle><Users className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-slate-900">{stats.activeResidents}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2"><Building2 size={20} className="text-primary"/> Building Status</CardTitle>
              <CardDescription>Occupancy and capacity across your branch.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
              {buildings?.map(b => {
                const occRate = (b.occupiedSeats / (b.totalSeats || 1)) * 100
                return (
                  <div key={b.id} className="p-4 rounded-2xl bg-secondary/20 border border-secondary group hover:bg-white hover:shadow-md transition-all cursor-pointer" onClick={() => router.push(`/buildings/${b.id}`)}>
                    <div className="flex justify-between items-start mb-3">
                      <div><h4 className="font-bold text-slate-800">{b.name}</h4><p className="text-[10px] font-bold text-muted-foreground uppercase">{b.address}</p></div>
                      <Badge className={cn("text-[8px] font-black", occRate > 90 ? "bg-destructive" : "bg-success")}>{occRate.toFixed(0)}% FULL</Badge>
                    </div>
                    <Progress value={occRate} className="h-1.5 mb-2" />
                    <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground"><span>{b.occupiedSeats} Occupied</span> <span>{b.emptySeats} Available</span></div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b flex justify-between items-center">
            <CardTitle className="text-lg font-bold flex items-center gap-2"><Wallet size={20} className="text-primary"/> Branch Fund Status</CardTitle>
            <div className="text-right">
              <p className="text-[8px] font-bold text-muted-foreground uppercase">Total Net Balance</p>
              <p className="text-lg font-black text-primary">৳{(stats.income - stats.expense).toLocaleString()}</p>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-3">
              {[
                { label: "Cash in Hand", icon: Banknote, color: "text-green-600", val: (allPayments || []).filter(p => p.method === 'cash').reduce((a,b)=>a+b.amount,0) - (allExpenses || []).filter(e => e.method === 'cash').reduce((a,b)=>a+b.amount,0) },
                { label: "Bank Account", icon: Landmark, color: "text-blue-600", val: (allPayments || []).filter(p => p.method === 'bank').reduce((a,b)=>a+b.amount,0) - (allExpenses || []).filter(e => e.method === 'bank').reduce((a,b)=>a+b.amount,0) },
                { label: "Bkash Wallet", icon: Smartphone, color: "text-pink-600", val: (allPayments || []).filter(p => p.method === 'bkash').reduce((a,b)=>a+b.amount,0) - (allExpenses || []).filter(e => e.method === 'bkash').reduce((a,b)=>a+b.amount,0) },
                { label: "Nagad Wallet", icon: Smartphone, color: "text-orange-600", val: (allPayments || []).filter(p => p.method === 'nagad').reduce((a,b)=>a+b.amount,0) - (allExpenses || []).filter(e => e.method === 'nagad').reduce((a,b)=>a+b.amount,0) },
              ].map((fund, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="flex items-center gap-3"><fund.icon size={18} className={fund.color} /><span className="text-sm font-medium text-slate-600">{fund.label}</span></div>
                  <span className="font-black text-slate-800">৳{fund.val.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-8 right-8 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-2xl bg-primary border-4 border-white">
              <Plus size={32} className="text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-xl mb-2">
            <DropdownMenuItem onClick={() => setIsIncomeDialogOpen(true)} className="gap-2 p-3 rounded-xl font-bold cursor-pointer"><Wallet size={18} className="text-success"/> Collect Payment</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsExpenseDialogOpen(true)} className="gap-2 p-3 rounded-xl font-bold cursor-pointer"><Receipt size={18} className="text-destructive"/> Record Expense</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsBulkMealEntryOpen(true)} className="gap-2 p-3 rounded-xl font-bold cursor-pointer"><Utensils size={18} className="text-primary"/> Log Daily Meals</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* INCOME DIALOG */}
      <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle>Collect Payment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/30 rounded-xl border">
              <div className="space-y-1"><Label className="text-[10px] font-bold">Building</Label><Select value={entryBuildingFilter} onValueChange={val => { setEntryBuildingFilter(val); setEntryRoomFilter("all"); }}><SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[10px] font-bold">Room</Label><Select value={entryRoomFilter} onValueChange={setEntryRoomFilter}><SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{Array.from(new Set(students?.filter(s => s.buildingId === entryBuildingFilter || entryBuildingFilter === 'all').map(s => s.roomNumber))).sort().map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Resident</Label><Select value={formData.studentId} onValueChange={val => setFormData({...formData, studentId: val})}><SelectTrigger><SelectValue placeholder="Choose student" /></SelectTrigger><SelectContent>{students?.filter(s => (entryBuildingFilter === 'all' || s.buildingId === entryBuildingFilter) && (entryRoomFilter === 'all' || s.roomNumber === entryRoomFilter) && s.isActive).map(s => <SelectItem key={s.id} value={s.id}>{s.name} (R-{s.roomNumber})</SelectItem>)}</SelectContent></Select></div>
            
            {selectedStudentForEntry && (
              <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-3 shadow-inner">
                <div className="flex justify-between items-center opacity-70 text-[10px] uppercase font-bold"><span>Rent Due</span> <span className="text-destructive font-black">৳{selectedStudentForEntry.totalDue || 0}</span></div>
                {selectedStudentForEntry.paymentSystem === 'non-package' && (
                  <div className="flex justify-between items-center opacity-70 text-[10px] uppercase font-bold"><span>Food Bal</span> <span className={cn((selectedStudentForEntry.foodDueAmount || 0) < 0 ? "text-destructive" : "text-success")}>৳{selectedStudentForEntry.foodDueAmount || 0}</span></div>
                )}
                {selectedStudentForEntry.duesBreakdown && Object.keys(selectedStudentForEntry.duesBreakdown).length > 0 && (
                  <div className="pt-2 border-t border-white/10 space-y-1">
                    <p className="text-[8px] font-black uppercase text-primary">Dues History:</p>
                    <div className="grid grid-cols-2 gap-2 max-h-[80px] overflow-y-auto pr-1">
                      {Object.entries(selectedStudentForEntry.duesBreakdown).map(([label, data]: any) => (
                        <div key={label} className="bg-white/5 p-1.5 rounded flex justify-between items-center border border-white/5">
                          <span className="text-[8px] font-medium">{label}</span>
                          <span className="text-[9px] font-black text-destructive">৳{data.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Month</Label><Select value={formData.month} onValueChange={v => setFormData({...formData, month: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Year</Label><Select value={formData.year} onValueChange={v => setFormData({...formData, year: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="p-4 border-2 border-primary/20 rounded-xl space-y-4 bg-primary/5">
              <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-xs">Seat Rent (৳)</Label><Input type="number" value={formData.seatAmount} onChange={e => setFormData({...formData, seatAmount: e.target.value})} /></div><div className="space-y-2"><Label className="text-xs">Food Deposit (৳)</Label><Input type="number" value={formData.foodAmount} onChange={e => setFormData({...formData, foodAmount: e.target.value})} /></div></div>
              <div className="space-y-2"><Label className="text-xs font-bold text-primary">Add Advance (৳)</Label><Input type="number" value={formData.addAdvanceAmount} onChange={e => setFormData({...formData, addAdvanceAmount: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Method</Label><Select value={formData.method} onValueChange={v => setFormData({...formData, method: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Receiver</Label><Select value={formData.receiver} onValueChange={v => setFormData({...formData, receiver: v})}><SelectTrigger><SelectValue placeholder="Staff" /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleCreatePayment} disabled={isSubmitting} className="w-full h-12 font-bold">{isSubmitting ? <Loader2 className="animate-spin" /> : "Save Receipt"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EXPENSE DIALOG */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Category</Label><Select value={expenseFormData.category} onValueChange={val => setExpenseFormData({...expenseFormData, category: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Amount (৳)</Label><Input type="number" value={expenseFormData.amount} onChange={e => setExpenseFormData({...expenseFormData, amount: e.target.value})} /></div>
            <div className="space-y-2"><Label>Spent By</Label><Select value={expenseFormData.expensePartyName} onValueChange={val => setExpenseFormData({...expenseFormData, expensePartyName: val})}><SelectTrigger><SelectValue placeholder="Select Staff" /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Method</Label><Select value={expenseFormData.method} onValueChange={v => setExpenseFormData({...expenseFormData, method: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={expenseFormData.expenseDate} onChange={e => setExpenseFormData({...expenseFormData, expenseDate: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={handleCreateExpense} disabled={isSubmitting} className="w-full h-12 bg-destructive font-bold">{isSubmitting ? <Loader2 className="animate-spin" /> : "Save Expense"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK MEAL DIALOG */}
      <Dialog open={isBulkMealEntryOpen} onOpenChange={setIsBulkMealEntryOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl p-0">
          <div className="h-2 bg-primary w-full" />
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-bold flex items-center gap-2"><Utensils className="text-primary"/> Daily Meal Logging</DialogTitle>
            <DialogDescription>Enter meal counts for all non-package residents.</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 bg-slate-50 border-y flex gap-4">
            <div className="flex-1"><Label className="text-[10px] font-bold">Month</Label><Select value={mealLogFilter.month} onValueChange={v => setMealLogFilter({...mealLogFilter, month: v})}><SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex-1"><Label className="text-[10px] font-bold">Year</Label><Select value={mealLogFilter.year} onValueChange={v => setMealLogFilter({...mealLogFilter, year: v})}><SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex-1"><Label className="text-[10px] font-bold">Building</Label><Select value={mealLogFilter.buildingId} onValueChange={v => setMealLogFilter({...mealLogFilter, buildingId: v})}><SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <ScrollArea className="flex-1 px-6 py-4">
            <Table>
              <TableHeader><TableRow><TableHead>Resident</TableHead><TableHead>Current Balance</TableHead><TableHead className="w-24 text-right">Meal Count</TableHead></TableRow></TableHeader>
              <TableBody>
                {students?.filter(s => (mealLogFilter.buildingId === 'all' || s.buildingId === mealLogFilter.buildingId) && s.isActive && s.paymentSystem === 'non-package').map(s => (
                  <TableRow key={s.id}>
                    <TableCell><div className="font-bold text-xs">{s.name}</div><div className="text-[10px] text-muted-foreground">R-{s.roomNumber}</div></TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-[9px] font-bold", (s.foodDueAmount || 0) < 0 ? "text-destructive" : "text-success")}>৳{s.foodDueAmount || 0}</Badge></TableCell>
                    <TableCell><Input type="number" className="h-8 text-right font-bold" value={mealInputs[s.id] || ""} onChange={e => setMealLogInputs({...mealInputs, [s.id]: e.target.value})} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button onClick={handleBulkMealSubmit} disabled={isSubmitting} className="w-full h-12 font-bold text-lg">{isSubmitting ? <Loader2 className="animate-spin" /> : "Commit Meal Log"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
