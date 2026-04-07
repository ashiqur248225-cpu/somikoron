
"use client"

import { useState, useMemo, useEffect, useRef } from "react"
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
  Check
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

export default function DashboardPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const router = useRouter()
  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")
  const [timeRange, setTimeRange] = useState("this_month")

  // Permissions
  const [canRequestIncome, setCanRequestIncome] = useState(false)
  const [canRequestExpense, setCanRequestExpense] = useState(false)

  // Dialog States
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false)
  const [isMealLogSelectorOpen, setIsMealLogSelectorOpen] = useState(false)
  const [isBulkMealEntryOpen, setIsBulkMealEntryOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Meal Log Flow State
  const [mealLogFilter, setMealLogFilter] = useState({
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    buildingId: "all"
  })
  const [mealInputs, setMealLogInputs] = useState<Record<string, string>>({})

  // Income Entry Filter State
  const [entryBuildingFilter, setEntryBuildingFilter] = useState("all")
  const [entryRoomFilter, setEntryRoomFilter] = useState("all")

  // Form Datas
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
    setCanRequestExpense(localStorage.getItem("can_request_expense") === "true")
  }, [])

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "buildings"), where("id", "==", assignedBuildingId))
    }
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userRole, userBranch, assignedBuildingId])
  const { data: buildings, isLoading: buildingsLoading } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    let q = query(collection(db, "students"), where("branch", "==", userBranch))
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      q = query(collection(db, "students"), where("buildingId", "==", assignedBuildingId))
    }
    return q
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: students, isLoading: studentsLoading } = useCollection(studentsQuery)

  // AUTOMATIC MONTHLY RENT GENERATOR
  useEffect(() => {
    const generateMonthlyRent = async () => {
      if (!students || students.length === 0 || !userBranch) return;
      
      const now = new Date();
      const currentMonthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
      const batch = writeBatch(db);
      let updatesCount = 0;

      students.forEach(s => {
        if (!s.isActive) return;
        
        const dues = { ...(s.duesBreakdown || {}) };
        // Strictly check if month already exists to avoid duplication
        if (dues[currentMonthLabel] === undefined) {
          const rent = Number(s.monthlyRent || 0);
          dues[currentMonthLabel] = rent;
          
          batch.update(doc(db, "students", s.id), {
            duesBreakdown: dues,
            totalDue: increment(rent),
            updatedAt: serverTimestamp()
          });
          updatesCount++;
        }
      });

      if (updatesCount > 0) {
        try {
          await batch.commit();
          console.log(`Auto-generated rent for ${updatesCount} students.`);
        } catch (e) {
          console.error("Auto-rent failed:", e);
        }
      }
    };

    if (userRole === 'Admin' || userRole === 'Branch Manager') {
      generateMonthlyRent();
    }
  }, [students, userBranch, userRole, db]);

  const staffQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "staff"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: staffList } = useCollection(staffQuery)

  const mealRateRef = useMemoFirebase(() => doc(db, "configs", "mealRate"), [db])
  const { data: mealRateConfig } = useDoc(mealRateRef)
  const currentMealRate = mealRateConfig?.rate || 0

  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: apiConfig } = useDoc(apiConfigRef)

  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)

  // Summary Logic
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

  const allTransfersQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "transfers"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: allTransfers } = useCollection(allTransfersQuery)

  const balancesRef = useMemoFirebase(() => doc(db, "configs", "openingBalances"), [db])
  const { data: openingBalances } = useDoc(balancesRef)

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

    const fund = { cash: Number(openingBalances?.cash || 0), bank: Number(openingBalances?.bank || 0), bkash: Number(openingBalances?.bkash || 0), nagad: Number(openingBalances?.nagad || 0) };
    (allPayments || []).forEach(p => { if (fund[p.method as keyof typeof fund] !== undefined) fund[p.method as keyof typeof fund] += (p.amount || 0) });
    (allExpenses || []).forEach(e => { if (fund[e.method as keyof typeof fund] !== undefined) fund[e.method as keyof typeof fund] -= (e.amount || 0) });
    (allTransfers || []).forEach(t => {
      if (fund[t.fromAccount as keyof typeof fund] !== undefined) fund[t.fromAccount as keyof typeof fund] -= (t.amount || 0)
      if (fund[t.toAccount as keyof typeof fund] !== undefined) fund[t.toAccount as keyof typeof fund] += (t.amount || 0)
    });

    return { income: totalIncome, expense: totalExpense, fund, activeResidents: (students || []).filter(s => s.isActive).length }
  }, [allPayments, allExpenses, allTransfers, students, openingBalances, timeRange])

  const filteredStudentsForMealLog = useMemo(() => {
    if (!students) return []
    return students.filter(s => s.isActive && s.paymentSystem === 'non-package' && (mealLogFilter.buildingId === 'all' || s.buildingId === mealLogFilter.buildingId))
  }, [students, mealLogFilter.buildingId])

  const availableRooms = useMemo(() => {
    if (!buildings) return []
    let rooms: string[] = []
    buildings.forEach(b => {
      if (entryBuildingFilter === "all" || b.id === entryBuildingFilter) {
        b.apartmentsDetail?.forEach((apt: any) => {
          apt.rooms?.forEach((room: any) => { if (room.roomNo && !rooms.includes(room.roomNo)) rooms.push(room.roomNo) })
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

  const selectedStudent = useMemo(() => students?.find(s => s.id === formData.studentId), [students, formData.studentId])

  const studentFinancials = useMemo(() => {
    if (!selectedStudent) return null;
    // Dues breakdown sum is the Rent Due
    const breakdownSum = Object.values(selectedStudent.duesBreakdown || {}).reduce((a: any, b: any) => a + Number(b || 0), 0);
    const rentDue = breakdownSum;

    const historicalFoodDue = Number(selectedStudent.foodDueAmount) || 0;
    const generatedFoodCost = selectedStudent.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0;
    const totalFoodPaid = (selectedStudent.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.foodAmount || 0), 0) || 0);
    const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost);
    
    return { rentDue, foodBalance, advance: selectedStudent.advanceAmount || 0 };
  }, [selectedStudent]);

  const handleCreatePayment = async () => {
    if (!formData.studentId || !formData.receiver || !selectedStudent) return
    setIsSubmitting(true)
    try {
      const pId = doc(collection(db, "payments")).id
      const seatPaid = selectedStudent.paymentSystem === 'package' ? Number(formData.amount) : Number(formData.seatAmount)
      const foodPaid = selectedStudent.paymentSystem === 'non-package' ? Number(formData.foodAmount) : 0
      const totalAmt = seatPaid + foodPaid + Number(formData.addAdvanceAmount)
      
      const pRecord = {
        id: pId, amount: totalAmt, seatAmount: seatPaid, foodAmount: foodPaid, advanceAmount: Number(formData.addAdvanceAmount),
        studentName: selectedStudent.name, studentId: selectedStudent.id, buildingId: selectedStudent.buildingId,
        buildingName: selectedStudent.buildingName, roomNumber: selectedStudent.roomNumber, branch: userBranch,
        type: "income", month: formData.month, year: formData.year, method: formData.method, receiver: formData.receiver,
        description: formData.description, date: new Date().toISOString()
      }

      if (userRole === 'Building Manager') {
        const reqId = doc(collection(db, "managerRequests")).id
        await setDoc(doc(db, "managerRequests", reqId), { ...pRecord, id: reqId, requestType: "income", requestedBy: localStorage.getItem("somikoron_auth_id"), requestedByName: userName, createdAt: serverTimestamp() })
        toast({ title: "Request Sent" })
      } else {
        await setDoc(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp(), createdAt: serverTimestamp() })
        
        const currentDues = { ...(selectedStudent.duesBreakdown || {}) };
        let remainingRentPaid = seatPaid;
        const targetLabel = `${formData.month} ${formData.year}`;

        if (currentDues[targetLabel] && remainingRentPaid > 0) {
          const dueAmt = currentDues[targetLabel];
          if (remainingRentPaid >= dueAmt) {
            remainingRentPaid -= dueAmt;
            delete currentDues[targetLabel];
          } else {
            currentDues[targetLabel] = dueAmt - remainingRentPaid;
            remainingRentPaid = 0;
          }
        }

        if (remainingRentPaid > 0) {
          const dueMonths = Object.keys(currentDues).sort((a, b) => MONTHS.indexOf(a.split(' ')[0]) - MONTHS.indexOf(b.split(' ')[0]));
          for (const month of dueMonths) {
            if (remainingRentPaid <= 0) break;
            const dueAmt = currentDues[month];
            if (remainingRentPaid >= dueAmt) {
              remainingRentPaid -= dueAmt;
              delete currentDues[month];
            } else {
              currentDues[month] = dueAmt - remainingRentPaid;
              remainingRentPaid = 0;
            }
          }
        }

        const finalBreakdownSum = Object.values(currentDues).reduce((a: any, b: any) => a + Number(b || 0), 0);

        await updateDoc(doc(db, "students", selectedStudent.id), { 
          paymentsHistory: arrayUnion(pRecord), 
          advanceAmount: increment(Number(formData.addAdvanceAmount)), 
          totalDue: finalBreakdownSum,
          duesBreakdown: currentDues,
          historicalTotalReceived: increment(totalAmt),
          updatedAt: serverTimestamp() 
        })
        
        if (apiConfig?.apikey && templatesData?.templates) {
          const paymentTemplate = templatesData.templates.find((t: any) => t.id === 'payment')
          if (paymentTemplate) {
            const hostelDisplayName = templatesData.hostelName || userBranch;
            let msg = paymentTemplate.text
              .replaceAll('[নাম]', selectedStudent.name)
              .replaceAll('[পরিমাণ]', totalAmt.toString())
              .replaceAll('[total_payable]', finalBreakdownSum.toString())
              .replaceAll('[Hostel Name]', hostelDisplayName);
            await sendSMS(apiConfig.apikey, apiConfig.senderid, selectedStudent.phone, msg);
          }
        }
        router.push(`/receipts/${pId}`)
      }
      setIsIncomeDialogOpen(false)
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) }
    finally { setIsSubmitting(false) }
  }

  const handleBulkMealSubmit = async () => {
    const entries = Object.entries(mealInputs).filter(([_, count]) => count && Number(count) > 0)
    if (entries.length === 0) return
    setIsSubmitting(true)
    try {
      const monthLabel = `${mealLogFilter.month} ${mealLogFilter.year}`
      const mealTemplate = templatesData?.templates?.find((t: any) => t.id === 'meal_summary')
      const hostelDisplayName = templatesData?.hostelName || userBranch;
      
      const promises = entries.map(async ([sId, count]) => {
        const s = students?.find(std => std.id === sId)
        if (!s) return
        const countNum = Number(count); const cost = countNum * currentMealRate
        
        const historicalFoodDue = Number(s.foodDueAmount) || 0
        const generatedFoodCostPrev = s.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
        const totalFoodPaid = s.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.foodAmount || (s.paymentSystem === 'non-package' ? curr.amount : 0)), 0) || 0
        
        const oldFoodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCostPrev)
        const newFoodBalance = oldFoodBalance - cost
        
        let dueAdjustment = 0
        if (newFoodBalance < 0) {
          if (oldFoodBalance >= 0) dueAdjustment = Math.abs(newFoodBalance)
          else dueAdjustment = cost
        }

        await updateDoc(doc(db, "students", sId), { 
          mealsHistory: arrayUnion({ month: monthLabel, totalMeals: countNum, perMealCost: currentMealRate, totalCost: cost, date: new Date().toISOString() }),
          totalDue: increment(dueAdjustment),
          updatedAt: serverTimestamp() 
        })

        if (apiConfig?.apikey && mealTemplate) {
          let msg = mealTemplate.text
            .replaceAll('[নাম]', s.name).replaceAll('[মাস]', monthLabel).replaceAll('[meal_count]', count).replaceAll('[meal_bill]', cost.toString())
            .replaceAll('[food_balance]', Math.max(0, newFoodBalance).toString()).replaceAll('[food_due]', Math.max(0, -newFoodBalance).toString())
            .replaceAll('[Hostel Name]', hostelDisplayName);
          await sendSMS(apiConfig.apikey, apiConfig.senderid, s.phone, msg);
        }
      })
      await Promise.all(promises)
      toast({ title: "Meal Logs Submitted" }); setIsBulkMealEntryOpen(false); setMealLogInputs({})
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) }
    finally { setIsSubmitting(false) }
  }

  const combinedBalance = stats.fund.cash + stats.fund.bank + stats.fund.bkash + stats.fund.nagad

  return (
    <div className="space-y-8 pb-24 relative">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2"><SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mr-2 h-4 md:hidden" /><div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Dashboard</h1></div></div>
        <div className="ml-auto flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 h-10 px-4 bg-white border-slate-200 rounded-xl font-bold text-slate-700">
                <CalendarIcon size={16} className="text-primary" /><span className="hidden sm:inline capitalize">{timeRange.replace('_', ' ')}</span><ChevronDown size={14} className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 shadow-xl">
              <DropdownMenuItem onClick={() => setTimeRange('today')} className="p-3 cursor-pointer">Today</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange('yesterday')} className="p-3 cursor-pointer">Yesterday</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange('this_week')} className="p-3 cursor-pointer">This Week</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange('this_month')} className="p-3 cursor-pointer">This Month</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange('all_time')} className="p-3 cursor-pointer">All Time</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase text-success">Income</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">৳{stats.income.toLocaleString()}</div></CardContent></Card>
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase text-destructive">Expenses</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">৳{stats.expense.toLocaleString()}</div></CardContent></Card>
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-primary rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase text-primary">Residents</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.activeResidents}</div></CardContent></Card>
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-blue-500 rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase text-blue-600">Net Fund</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">৳{combinedBalance.toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-5">
        <Card className="lg:col-span-3 shadow-sm border-none bg-white rounded-3xl overflow-hidden">
          <CardHeader className="pb-6 border-b border-slate-50"><CardTitle className="text-lg">Branch Fund Status</CardTitle></CardHeader>
          <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl border space-y-2"><p className="text-[10px] uppercase font-bold text-muted-foreground">Cash in Hand</p><div className="text-2xl font-bold">৳{stats.fund.cash.toLocaleString()}</div></div>
            <div className="p-6 rounded-3xl border space-y-2"><p className="text-[10px] uppercase font-bold text-muted-foreground">Bank Account</p><div className="text-2xl font-bold">৳{stats.fund.bank.toLocaleString()}</div></div>
            <div className="p-6 rounded-3xl border space-y-2 text-primary"><p className="text-[10px] uppercase font-bold">Bkash Wallet</p><div className="text-2xl font-bold">৳{stats.fund.bkash.toLocaleString()}</div></div>
            <div className="p-6 rounded-3xl border space-y-2 text-orange-500"><p className="text-[10px] uppercase font-bold">Nagad Wallet</p><div className="text-2xl font-bold">৳{stats.fund.nagad.toLocaleString()}</div></div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 shadow-sm border-none bg-white rounded-3xl overflow-hidden">
          <CardHeader className="pb-6 border-b border-slate-50"><CardTitle className="text-lg">Occupancy</CardTitle></CardHeader>
          <CardContent className="p-8 space-y-6">
            {buildings?.map(b => (
              <div key={b.id} className="space-y-2">
                <div className="flex justify-between text-xs font-bold"><span>{b.name}</span><span>{Math.round((b.occupiedSeats / (b.totalSeats || 1)) * 100)}%</span></div>
                <Progress value={(b.occupiedSeats / (b.totalSeats || 1)) * 100} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-8 right-8 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" className="h-14 w-14 rounded-full shadow-2xl bg-primary border-4 border-white"><MoreVertical size={32} /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-xl">
            {(userRole !== 'Building Manager' || canRequestIncome) && (
              <DropdownMenuItem onClick={() => setIsIncomeDialogOpen(true)} className="flex items-center gap-3 p-3 cursor-pointer text-primary font-bold"><Wallet size={20} /><span>New Income Entry</span></DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setIsMealLogSelectorOpen(true)} className="flex items-center gap-3 p-3 cursor-pointer text-orange-600 font-bold"><Utensils size={20} /><span>Monthly Meal Log</span></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isMealLogSelectorOpen} onOpenChange={setIsMealLogSelectorOpen}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Meal Log Setup</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Month</Label><Select value={mealLogFilter.month} onValueChange={val => setMealLogFilter({...mealLogFilter, month: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Year</Label><Select value={mealLogFilter.year} onValueChange={val => setMealLogFilter({...mealLogFilter, year: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Building</Label><Select value={mealLogFilter.buildingId} onValueChange={val => setMealLogFilter({...mealLogFilter, buildingId: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button className="w-full h-12 text-lg font-bold" onClick={() => { setIsMealLogSelectorOpen(false); setIsBulkMealEntryOpen(true); }}>Open Entry Form</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkMealEntryOpen} onOpenChange={setIsBulkMealEntryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl">
          <DialogHeader className="p-6 border-b"><DialogTitle>Bulk Meal Entry - {mealLogFilter.month} {mealLogFilter.year}</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 p-6"><Table><TableHeader><TableRow><TableHead>Resident</TableHead><TableHead>Location</TableHead><TableHead className="text-center">Meal Count</TableHead></TableRow></TableHeader><TableBody>{filteredStudentsForMealLog.map(s => (<TableRow key={s.id}><TableCell className="font-bold">{s.name}</TableCell><TableCell className="text-xs">{s.buildingName} • R-{s.roomNumber}</TableCell><TableCell className="text-center"><Input type="number" className="w-24 mx-auto text-center" value={mealInputs[s.id] || ""} onChange={e => setMealLogInputs({...mealInputs, [s.id]: e.target.value})} /></TableCell></TableRow>))}</TableBody></Table></ScrollArea>
          <div className="p-6 border-t flex justify-end gap-2"><Button variant="outline" onClick={() => setIsBulkMealEntryOpen(false)}>Cancel</Button><Button onClick={handleBulkMealSubmit} className="h-12 px-10 font-bold" disabled={isSubmitting}>Confirm & Submit All</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Income Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/30 rounded-xl border">
              <div className="space-y-1"><Label className="text-[10px] font-bold">Building</Label><Select value={entryBuildingFilter} onValueChange={val => { setEntryBuildingFilter(val); setEntryRoomFilter("all"); }}><SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[10px] font-bold">Room</Label><Select value={entryRoomFilter} onValueChange={setEntryRoomFilter}><SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{availableRooms.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Select Resident</Label><Select value={formData.studentId} onValueChange={val => setFormData({...formData, studentId: val})}><SelectTrigger><SelectValue placeholder="Choose student" /></SelectTrigger><SelectContent>{filteredStudentsForEntry.map(s => <SelectItem key={s.id} value={s.id}>{s.name} (R-{s.roomNumber})</SelectItem>)}</SelectContent></Select></div>
            
            {studentFinancials && (
              <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-3 shadow-inner border border-slate-800">
                <div className="flex justify-between items-center opacity-70 text-[10px] uppercase font-bold"><span>Current Total Dues</span> <span className="text-destructive font-black">৳{studentFinancials.rentDue.toLocaleString()}</span></div>
                {selectedStudent?.paymentSystem === 'non-package' && (
                  <div className="flex justify-between items-center opacity-70 text-[10px] uppercase font-bold"><span>Food Balance</span> <span className={studentFinancials.foodBalance < 0 ? "text-destructive" : "text-success"}>৳{studentFinancials.foodBalance.toLocaleString()}</span></div>
                )}
                {selectedStudent?.duesBreakdown && Object.keys(selectedStudent.duesBreakdown).length > 0 && (
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-[8px] font-black uppercase text-primary mb-2">Detailed Dues List:</p>
                    <div className="grid grid-cols-2 gap-2 max-h-[80px] overflow-y-auto pr-1">
                      {Object.entries(selectedStudent.duesBreakdown).map(([label, amount]: any) => (
                        <div key={label} className="bg-white/5 p-1.5 rounded flex justify-between items-center"><span className="text-[8px] font-medium">{label}</span><span className="text-[9px] font-black text-destructive">৳{amount}</span></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Month</Label><Select value={formData.month} onValueChange={val => setFormData({...formData, month: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Year</Label><Select value={formData.year} onValueChange={val => setFormData({...formData, year: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="p-4 border-2 border-primary/20 rounded-xl space-y-4 bg-primary/5">
              {selectedStudent?.paymentSystem === 'package' ? (
                <div className="space-y-2"><Label className="text-xs">Amount Received (৳)</Label><Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" /></div>
              ) : (
                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-xs">Seat Rent</Label><Input type="number" value={formData.seatAmount} onChange={e => setFormData({...formData, seatAmount: e.target.value})} /></div><div className="space-y-2"><Label className="text-xs">Food Deposit</Label><Input type="number" value={formData.foodAmount} onChange={e => setFormData({...formData, foodAmount: e.target.value})} /></div></div>
              )}
              <div className="space-y-2"><Label className="text-xs">Add to Advance Pool</Label><Input type="number" value={formData.addAdvanceAmount} onChange={e => setFormData({...formData, addAdvanceAmount: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Method</Label><Select value={formData.method} onValueChange={val => setFormData({...formData, method: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Receiver</Label><Select value={formData.receiver} onValueChange={val => setFormData({...formData, receiver: val})}><SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div></div>
          </div>
          <DialogFooter><Button onClick={handleCreatePayment} disabled={isSubmitting} className="w-full h-12 text-lg font-bold">{isSubmitting ? <Loader2 className="animate-spin" /> : "Confirm & Save Receipt"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
