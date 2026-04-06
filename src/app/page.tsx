
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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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
  const [canRequestExpense, setCanRequestExpense] = useState(false)

  // Dialog States
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false)
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
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
    setCanRequestIncome(localStorage.getItem("can_request_income") === "true")
    setCanRequestExpense(localStorage.getItem("can_request_expense") === "true")
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

  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: apiConfig } = useDoc(apiConfigRef)

  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)

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

  // Bulk Meal Entry Filtering
  const filteredStudentsForMealLog = useMemo(() => {
    if (!students) return []
    return students.filter(s => {
      if (!s.isActive || s.paymentSystem !== 'non-package') return false
      const matchesBuilding = mealLogFilter.buildingId === "all" || s.buildingId === mealLogFilter.buildingId
      return matchesBuilding
    }).sort((a, b) => {
      // Sort by building then room then name
      if (a.buildingName !== b.buildingName) return a.buildingName.localeCompare(b.buildingName)
      if (a.roomNumber !== b.roomNumber) return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })
      return a.name.localeCompare(b.name)
    })
  }, [students, mealLogFilter.buildingId])

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
        
        // Dynamic SMS for Payment
        if (apiConfig?.apikey && templatesData?.templates) {
          const paymentTemplate = templatesData.templates.find((t: any) => t.id === 'payment')
          if (paymentTemplate) {
            const hostelDisplayName = templatesData.hostelName || userBranch;
            const finalDueAfterPayment = financialStats.totalDue - seatPaid - foodPaid;
            
            let msg = paymentTemplate.text
              .replaceAll('[নাম]', selectedStudent.name)
              .replaceAll('[পরিমাণ]', totalCashAmount.toString())
              .replaceAll('[বকেয়া]', finalDueAfterPayment.toString())
              .replaceAll('[total_payable]', finalDueAfterPayment.toString())
              .replaceAll('[মাস]', formData.month)
              .replaceAll('[Hostel Name]', hostelDisplayName);
            
            await sendSMS(apiConfig.apikey, apiConfig.senderid, selectedStudent.phone, msg);
          }
        }

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

  // Expense Entry Handler
  const handleCreateExpense = async () => {
    if (!expenseFormData.amount || !expenseFormData.expensePartyName) {
      toast({ variant: "destructive", title: "Error", description: "Amount and Spent By are required." })
      return
    }

    if (expenseFormData.category === 'others' && !expenseFormData.description) {
      toast({ variant: "destructive", title: "Error", description: "Description is mandatory for 'Others' category." })
      return
    }

    if (['rent', 'electricity', 'water', 'maintenance', 'internet'].includes(expenseFormData.category) && expenseFormData.buildingId === 'none') {
      toast({ variant: "destructive", title: "Error", description: "Building selection is required for this category." })
      return
    }

    setIsSubmitting(true)
    try {
      const selectedBuildingData = buildings?.find(b => b.id === expenseFormData.buildingId)
      const expenseId = doc(collection(db, "expenses")).id
      const expenseData = {
        ...expenseFormData,
        amount: Number(expenseFormData.amount),
        totalMeals: expenseFormData.category === 'food' ? Number(expenseFormData.totalMeals || 0) : 0,
        branch: userBranch,
        buildingName: selectedBuildingData?.name || "General",
        updatedAt: serverTimestamp()
      }

      if (userRole === 'Building Manager') {
        const reqId = doc(collection(db, "managerRequests")).id
        await setDoc(doc(db, "managerRequests", reqId), {
          ...expenseData,
          id: reqId,
          requestType: "expense",
          requestedBy: localStorage.getItem("somikoron_auth_id"),
          requestedByName: userName,
          createdAt: serverTimestamp()
        })
        toast({ title: "Request Sent", description: "Expense is waiting for approval." })
      } else {
        await setDoc(doc(db, "expenses", expenseId), {
          ...expenseData,
          id: expenseId,
          createdAt: serverTimestamp()
        })

        // If Category is FOOD, also log to Breakdown collection
        if (expenseFormData.category === 'food') {
          const breakdownId = doc(collection(db, "foodCostBreakdown")).id
          await setDoc(doc(db, "foodCostBreakdown", breakdownId), {
            id: breakdownId,
            expenseId: expenseId,
            branch: userBranch,
            branchName: userBranch,
            date: expenseFormData.expenseDate,
            amount: Number(expenseFormData.amount),
            totalMeals: Number(expenseFormData.totalMeals || 0),
            createdBy: localStorage.getItem("somikoron_auth_id"),
            createdByName: userName,
            createdAt: serverTimestamp()
          })
        }

        toast({ title: "Expense Recorded", description: `Amount ৳${expenseFormData.amount} saved.` })
      }

      setIsExpenseDialogOpen(false)
      setExpenseFormData({
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
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Bulk Meal Logic
  const handleBulkMealSubmit = async () => {
    const entries = Object.entries(mealInputs).filter(([_, count]) => count && Number(count) > 0)
    if (entries.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "Please enter meal quantities for students." })
      return
    }

    setIsSubmitting(true)
    try {
      const monthLabel = `${mealLogFilter.month} ${mealLogFilter.year}`
      const mealTemplate = templatesData?.templates?.find((t: any) => t.id === 'meal_summary')
      const hostelDisplayName = templatesData?.hostelName || userBranch;
      
      const promises = entries.map(async ([sId, count]) => {
        const student = students?.find(s => s.id === sId)
        if (!student) return
        
        const countNum = Number(count)
        const cost = countNum * currentMealRate
        const mealRecord = {
          month: monthLabel,
          totalMeals: countNum,
          perMealCost: currentMealRate,
          totalCost: cost,
          date: new Date().toISOString()
        }

        const sRef = doc(db, "students", sId)
        await updateDoc(sRef, {
          mealsHistory: arrayUnion(mealRecord),
          updatedAt: serverTimestamp()
        })

        // Automated SMS Logic with dynamic tags
        if (apiConfig?.apikey && mealTemplate) {
          // Calculate stats for SMS mapping
          const billingStart = student.billingStartDate ? new Date(student.billingStartDate) : (student.createdAt?.toDate?.() || new Date())
          const now = new Date()
          const monthsElapsed = (now.getFullYear() - billingStart.getFullYear()) * 12 + (now.getMonth() - billingStart.getMonth())
          const generatedRent = (monthsElapsed >= 0 ? monthsElapsed + 1 : 0) * (student.monthlyRent || 0)
          
          const totalRentPaid = student.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.seatAmount || (student.paymentSystem === 'package' ? curr.amount : 0)), 0) || 0
          const historicalRentDue = student.duesBreakdown ? Object.values(student.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
          const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

          const historicalFoodDue = Number(student.foodDueAmount) || 0
          const generatedFoodCostBefore = student.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
          const totalFoodPaid = student.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.foodAmount || (student.paymentSystem === 'non-package' ? curr.amount : 0)), 0) || 0
          
          // Current status AFTER adding the new meal bill
          const currentFoodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCostBefore + cost)
          const totalPayable = rentDue + Math.max(0, -currentFoodBalance)

          let msg = mealTemplate.text
            .replaceAll('[নাম]', student.name)
            .replaceAll('[মাস]', monthLabel)
            .replaceAll('[meal_count]', count)
            .replaceAll('[meal_rate]', currentMealRate.toString())
            .replaceAll('[meal_bill]', cost.toString())
            .replaceAll('[rent]', student.monthlyRent?.toString() || '0')
            .replaceAll('[food_balance]', Math.max(0, currentFoodBalance).toString())
            .replaceAll('[food_due]', Math.max(0, -currentFoodBalance).toString())
            .replaceAll('[total_payable]', totalPayable.toString())
            .replaceAll('[Hostel Name]', hostelDisplayName);
          
          await sendSMS(apiConfig.apikey, apiConfig.senderid, student.phone, msg);
        }
      })

      await Promise.all(promises)
      
      toast({ 
        title: "Logs Submitted Successfully", 
        description: `Meal logs saved for ${entries.length} residents. Automated SMS notifications sent.` 
      })
      
      setIsBulkMealEntryOpen(false)
      setMealLogInputs({})
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMealLogKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextInput = document.querySelector(`input[data-index="${index + 1}"]`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

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

  // Expense Dialog Helpers
  const selectedExpBuilding = buildings?.find(b => b.id === expenseFormData.buildingId)
  const apartmentList = selectedExpBuilding?.apartmentsDetail || []
  const roomList = (() => {
    if (!selectedExpBuilding) return []
    const rooms: string[] = []
    selectedExpBuilding.apartmentsDetail?.forEach((apt: any) => {
      apt.rooms?.forEach((room: any) => {
        if (room.roomNo && !rooms.includes(room.roomNo)) rooms.push(room.roomNo)
      })
    })
    return rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  })()

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

      {/* Quick Action FAB with Action Menu */}
      <div className="fixed bottom-8 right-8 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="icon" 
              className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:scale-110 transition-transform border-4 border-white"
            >
              <MoreVertical size={32} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-xl border-slate-100">
            {(userRole !== 'Building Manager' || canRequestIncome) && (
              <DropdownMenuItem 
                onClick={() => setIsIncomeDialogOpen(true)}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-primary/5 text-primary font-bold"
              >
                <Wallet className="h-5 w-5" />
                <span>New Income Entry</span>
              </DropdownMenuItem>
            )}
            {(userRole !== 'Building Manager' || canRequestExpense) && (
              <DropdownMenuItem 
                onClick={() => setIsExpenseDialogOpen(true)}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-destructive/5 text-destructive font-bold"
              >
                <Receipt className="h-5 w-5" />
                <span>Record New Expense</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={() => setIsMealLogSelectorOpen(true)}
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-orange-50 text-orange-600 font-bold"
            >
              <Utensils className="h-5 w-5" />
              <span>Monthly Meal Log</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* BULK MEAL LOG SELECTOR DIALOG */}
      <Dialog open={isMealLogSelectorOpen} onOpenChange={setIsMealLogSelectorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Monthly Meal Log Setup</DialogTitle>
            <DialogDescription>Select the billing period and target location to start entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={mealLogFilter.month} onValueChange={val => setMealLogFilter({...mealLogFilter, month: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={mealLogFilter.year} onValueChange={val => setMealLogFilter({...mealLogFilter, year: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["2024", "2025", "2026"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Target Building</Label>
              <Select value={mealLogFilter.buildingId} onValueChange={val => setMealLogFilter({...mealLogFilter, buildingId: val})}>
                <SelectTrigger><SelectValue placeholder="All Buildings" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buildings (Entire Branch)</SelectItem>
                  {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full h-12 text-lg font-bold gap-2" onClick={() => { setIsMealLogSelectorOpen(false); setIsBulkMealEntryOpen(true); }}>
              <TableIcon size={20} /> Open Entry Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK MEAL ENTRY DIALOG (The Grid) */}
      <Dialog open={isBulkMealEntryOpen} onOpenChange={setIsBulkMealEntryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl">
          <DialogHeader className="p-6 border-b bg-slate-50/50">
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Utensils className="text-orange-500" /> Bulk Meal Entry - {mealLogFilter.month} {mealLogFilter.year}
                </DialogTitle>
                <DialogDescription>Fast data entry for non-package residents in {mealLogFilter.buildingId === 'all' ? 'All Buildings' : buildings?.find(b => b.id === mealLogFilter.buildingId)?.name}.</DialogDescription>
              </div>
              <div className="bg-orange-50 px-4 py-2 rounded-xl border border-orange-100 text-center">
                <p className="text-[10px] font-bold text-orange-600 uppercase">Meal Rate</p>
                <p className="text-lg font-black text-orange-700">৳{currentMealRate}</p>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6">
            <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[30%]">Resident Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="w-[20%]">Monthly Rent</TableHead>
                    <TableHead className="w-[20%] text-center">Meal Count (Qty)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudentsForMealLog.map((s, idx) => (
                    <TableRow key={s.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-bold">{s.name}<br/><span className="text-[10px] text-muted-foreground font-normal">{s.phone}</span></TableCell>
                      <TableCell>
                        <div className="text-[10px] font-medium uppercase text-muted-foreground">
                          {s.buildingName} • R-{s.roomNumber}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-600">৳{s.monthlyRent}</TableCell>
                      <TableCell className="text-center">
                        <Input 
                          type="number"
                          data-index={idx}
                          placeholder="0"
                          className="w-24 mx-auto text-center h-9 font-black text-primary border-primary/20 focus:border-primary focus:ring-primary/20"
                          value={mealInputs[s.id] || ""}
                          onChange={(e) => setMealLogInputs({...mealInputs, [s.id]: e.target.value})}
                          onKeyDown={(e) => handleMealLogKeyDown(e, idx)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredStudentsForMealLog.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">No non-package residents found for this location.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>

          <div className="p-6 border-t bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Total Entered:</span> <b>{Object.values(mealInputs).filter(v => v !== "").length} Students</b>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" onClick={() => setIsBulkMealEntryOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleBulkMealSubmit} 
                className="flex-1 md:flex-none h-12 px-10 font-bold text-lg rounded-xl shadow-lg shadow-primary/20"
                disabled={isSubmitting || Object.keys(mealInputs).length === 0}
              >
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                Confirm & Submit All
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* RECORD NEW EXPENSE DIALOG (Dynamic) */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record New Expense</DialogTitle>
            <DialogDescription>Setup expense details based on selected category.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Common Fields - Part 1 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Expense Category</Label>
                <Select value={expenseFormData.category} onValueChange={val => setExpenseFormData({...expenseFormData, category: val, buildingId: 'none', apartmentName: '', roomNumber: '', receiver: '', totalMeals: '', month: MONTHS[new Date().getMonth()]})}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Spent By (Staff)</Label>
                <Select value={expenseFormData.expensePartyName} onValueChange={val => setExpenseFormData({...expenseFormData, expensePartyName: val})}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Who spent the money?" /></SelectTrigger>
                  <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Dynamic Fields Section */}
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Category: Building Rent, Electricity, Water, Maintenance, Internet, Others */}
              {['rent', 'electricity', 'water', 'maintenance', 'internet', 'others'].includes(expenseFormData.category) && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Target Building</Label>
                    <Select value={expenseFormData.buildingId} onValueChange={val => setExpenseFormData({...expenseFormData, buildingId: val, apartmentName: "", roomNumber: ""})}>
                      <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">General / No Building</SelectItem>
                        {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {(expenseFormData.category === 'rent' || expenseFormData.category === 'electricity' || expenseFormData.category === 'internet' || expenseFormData.category === 'others') && expenseFormData.buildingId !== 'none' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Apartment (Optional)</Label>
                      <Select value={expenseFormData.apartmentName} onValueChange={val => {
                        const apt = apartmentList.find((a: any) => a.name === val);
                        setExpenseFormData({...expenseFormData, apartmentName: val, meterNo: apt?.meterNo || ""});
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                        <SelectContent>
                          {apartmentList.map((apt: any) => <SelectItem key={apt.name} value={apt.name}>{apt.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(expenseFormData.category === 'maintenance' || expenseFormData.category === 'internet' || expenseFormData.category === 'others') && expenseFormData.buildingId !== 'none' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Room Number (Optional)</Label>
                      <Select value={expenseFormData.roomNumber} onValueChange={val => setExpenseFormData({...expenseFormData, roomNumber: val})}>
                        <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                        <SelectContent>
                          {roomList.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {expenseFormData.category === 'electricity' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1"><Zap size={12}/> Meter Number</Label>
                      <Input value={expenseFormData.meterNo} onChange={e => setExpenseFormData({...expenseFormData, meterNo: e.target.value})} placeholder="Enter Meter ID" />
                    </div>
                  )}
                </div>
              )}

              {/* Category: Market */}
              {expenseFormData.category === 'market' && (
                <div className="space-y-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-orange-700">Received By (Staff)</Label>
                    <Select value={expenseFormData.receiver} onValueChange={val => setExpenseFormData({...expenseFormData, receiver: val})}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Select receiver" /></SelectTrigger>
                      <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-orange-700">Market Description / Items</Label>
                    <Textarea value={expenseFormData.description} onChange={e => setExpenseFormData({...expenseFormData, description: e.target.value})} placeholder="e.g. Rice, Oil, Vegetables..." className="bg-white" />
                  </div>
                </div>
              )}

              {/* Category: Food (Daily Cost Tracking) */}
              {expenseFormData.category === 'food' && (
                <div className="space-y-4 p-4 bg-orange-50 rounded-xl border border-orange-200">
                  <h4 className="text-xs font-bold uppercase text-orange-700">Daily Food Cost Details</h4>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Food Cost Amount (৳)</Label>
                    <Input type="number" placeholder="Enter amount" value={expenseFormData.amount} onChange={e => setExpenseFormData({...expenseFormData, amount: e.target.value})} className="bg-white h-11 text-lg font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Total Meals Running Today (Optional)</Label>
                    <Input type="number" placeholder="e.g. 120" value={expenseFormData.totalMeals} onChange={e => setExpenseFormData({...expenseFormData, totalMeals: e.target.value})} className="bg-white" />
                  </div>
                </div>
              )}

              {/* Category: Staff Salary */}
              {expenseFormData.category === 'salary' && (
                <div className="space-y-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-primary">Salary For (Staff Name)</Label>
                    <Select value={expenseFormData.receiver} onValueChange={val => {
                      const staff = staffList?.find(s => s.name === val);
                      setExpenseFormData({...expenseFormData, receiver: val, amount: staff?.monthlySalary?.toString() || ""});
                    }}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Select Employee" /></SelectTrigger>
                      <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-primary">Salary Month</Label>
                      <Select value={expenseFormData.month} onValueChange={val => setExpenseFormData({...expenseFormData, month: val})}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-primary">Year</Label>
                      <Select value={expenseFormData.year} onValueChange={val => setExpenseFormData({...expenseFormData, year: val})}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{["2024", "2025", "2026"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Common Fields - Part 2 */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {expenseFormData.category !== 'food' && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Amount (৳)</Label>
                    <Input type="number" value={expenseFormData.amount} onChange={e => setExpenseFormData({...expenseFormData, amount: e.target.value})} placeholder="0.00" className="h-11 text-lg font-bold" />
                  </div>
                )}
                <div className={cn("space-y-2", expenseFormData.category === 'food' ? "col-span-2" : "")}>
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Payment Method</Label>
                  <Select value={expenseFormData.method} onValueChange={val => setExpenseFormData({...expenseFormData, method: val})}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="bkash">Bkash</SelectItem>
                      <SelectItem value="nagad">Nagad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Expense Date</Label>
                <Input type="date" value={expenseFormData.expenseDate} onChange={e => setExpenseFormData({...expenseFormData, expenseDate: e.target.value})} className="h-11" />
              </div>

              {expenseFormData.category !== 'market' && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Note / Reference (Optional)</Label>
                  <Textarea value={expenseFormData.description} onChange={e => setExpenseFormData({...expenseFormData, description: e.target.value})} placeholder="Add details..." />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateExpense} disabled={isSubmitting} className="w-full h-12 text-lg font-bold bg-expense hover:bg-expense/90">
              {isSubmitting ? <Loader2 className="animate-spin" /> : (userRole === 'Building Manager' ? "Send Approval Request" : "Save Expense Record")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
