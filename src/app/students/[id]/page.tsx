
"use client"

import * as React from "react"
import { useState, useMemo, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, serverTimestamp, updateDoc, setDoc, arrayUnion, increment, collection, query, where, getDoc, writeBatch } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  UserCircle, Phone, Building2, 
  Loader2, Calculator,
  Plus, UserMinus, Wallet,
  AlertCircle, History, Edit,
  Calendar, ChevronLeft,
  Info, ShieldCheck, HandCoins,
  MapPin, GraduationCap,
  LayoutGrid, CheckCircle2, 
  MoreVertical, Utensils, Clock,
  Smartphone, User, Zap, CircleDollarSign, Home, Trash2, Scale, Receipt, Printer, Send, FileText,
  X,
  Briefcase,
  ChevronRight,
  UserCheck,
  Lock,
  Eye,
  ShieldAlert,
  Settings2,
  Database,
  ArrowUpRight,
  Save,
  ChefHat
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
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
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { sendSMS } from "@/app/actions/sms"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2024", "2025", "2026", "2027", "2028", "2029", "2030"];

interface DueEntry {
  id: string;
  month: string;
  year: string;
  amount: string;
}

interface PastPaymentEntry {
  id: string;
  month: string;
  year: string;
  amount: string;
  seatAmount: string;
  foodAmount: string;
  method: string;
  date: string;
}

export default function StudentDetailsPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [isMealAdjustOpen, setIsMealAdjustOpen] = useState(false)
  const [isMigrationDialogOpen, setIsMigrationDialogOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")
  const [settlementInput, setSettlementInput] = useState("")
  const [exitMethod, setExitMethod] = useState("cash")
  const [exitStaff, setExitStaff] = useState("")

  const [mealAdjustment, setMealAdjustData] = useState({
    breakfast: "0",
    lunch: "0",
    dinner: "0"
  })

  // Migration Form State
  const [migrationForm, setMigrationForm] = useState({
    dues: [] as DueEntry[],
    pastPayments: [] as PastPaymentEntry[],
    advanceAmount: "0",
    serviceCharge: "0",
    foodDueAmount: "0",
    cookingDueAmount: "0",
    historicalTotalReceived: "0"
  })

  useEffect(() => {
    const role = localStorage.getItem("user_role") || "Manager"
    const name = localStorage.getItem("user_name") || "User"
    setUserRole(role)
    setUserName(name)
    setExitStaff(name)
  }, [])

  const studentRef = useMemoFirebase(() => id ? doc(db, "students", id) : null, [db, id])
  const { data: student, isLoading: studentLoading } = useDoc(studentRef)

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings, isLoading: buildingsLoading } = useCollection(buildingsQuery)

  const staffListQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffListQuery)

  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)
  
  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: apiConfig } = useDoc(apiConfigRef)

  const mealConfigRef = useMemoFirebase(() => 
    student?.branch ? doc(db, "configs", `mealRate_${student.branch}`) : null, 
    [db, student?.branch]
  )
  const { data: mealConfig } = useDoc(mealConfigRef)

  const billingConfigRef = useMemoFirebase(() => 
    student?.branch ? doc(db, "configs", `billingConfig_${student.branch}`) : null, 
    [db, student?.branch]
  )
  const { data: billingConfig } = useDoc(billingConfigRef)

  const managementStaff = useMemo(() => {
    if (!staffList) return []
    const userBranch = student?.branch || localStorage.getItem("user_branch") || "";
    return staffList.filter(s => {
      if (s.role === 'Admin') return true;
      return s.branch === userBranch && (s.staffType === 'management' || !s.staffType);
    })
  }, [staffList, student?.branch])

  const [paymentData, setPaymentData] = useState({
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
    if (isPaymentDialogOpen && userName) {
      setPaymentData(prev => ({ ...prev, receiver: userName }))
    }
  }, [isPaymentDialogOpen, userName])

  useEffect(() => {
    if (isMealAdjustOpen && student) {
      setMealAdjustData({
        breakfast: (student.currentMonthBreakfast || 0).toString(),
        lunch: (student.currentMonthLunch || 0).toString(),
        dinner: (student.currentMonthDinner || 0).toString()
      })
    }
  }, [isMealAdjustOpen, student])

  // Initialize Migration Form when dialog opens
  useEffect(() => {
    if (isMigrationDialogOpen && student) {
      const historicalDues = Object.entries(student.duesBreakdown || {}).map(([label, data]: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        month: data.month,
        year: data.year,
        amount: data.amount.toString()
      }))

      setMigrationForm({
        dues: historicalDues,
        pastPayments: (student.paymentsHistory || []).map((p: any) => ({
          id: p.id || Math.random().toString(36).substr(2, 9),
          month: p.month,
          year: p.year,
          amount: p.amount.toString(),
          seatAmount: (p.seatAmount || 0).toString(),
          foodAmount: (p.foodAmount || 0).toString(),
          method: p.method,
          date: p.date?.includes('T') ? p.date.split('T')[0] : p.date
        })),
        advanceAmount: (student.advanceAmount || 0).toString(),
        serviceCharge: (student.serviceCharge || 0).toString(),
        foodDueAmount: (student.foodDueAmount || 0).toString(),
        cookingDueAmount: (student.cookingDueAmount || 0).toString(),
        historicalTotalReceived: (student.historicalTotalReceived || 0).toString()
      })
    }
  }, [isMigrationDialogOpen, student])

  const [editForm, setEditForm] = useState<any>(null)

  useEffect(() => {
    if (student) {
      setEditForm({ ...student })
    }
  }, [student])

  // AUTO DUE GENERATION LOGIC (RENT + COOKING BILL)
  useEffect(() => {
    if (!student || !student.isActive || !studentRef || isUpdating || !billingConfig) return;

    const syncDues = async () => {
      const now = new Date();
      const billingDateStr = student.billingStartDate || "";
      const billingDate = new Date(billingDateStr);
      if (isNaN(billingDate.getTime())) return;

      const updatedDues = { ...(student.duesBreakdown || {}) };
      let totalDueIncrement = 0;
      let totalCookingDueDecrement = 0;
      let hasChanges = false;

      let checkDate = new Date(billingDate.getFullYear(), billingDate.getMonth(), 1);
      const todayLimit = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const monthlyCookingBill = Number(billingConfig.cookingBill || 0);

      while (checkDate <= todayLimit) {
        const m = MONTHS[checkDate.getMonth()];
        const y = checkDate.getFullYear().toString();
        const label = `${m} ${y}`;

        // Check Rent
        const inBreakdown = updatedDues[label];
        const inHistory = student.paymentsHistory?.some((p: any) => 
          p.month === m && p.year === y && (Number(p.seatAmount) > 0 || p.method === 'adjustment')
        );

        if (!inBreakdown && !inHistory) {
          const rent = Number(student.monthlyRent || 0);
          if (rent > 0) {
            updatedDues[label] = { month: m, year: y, amount: rent };
            totalDueIncrement += rent;
            hasChanges = true;
          }
          
          // Apply monthly cooking bill debit
          if (monthlyCookingBill > 0) {
             totalCookingDueDecrement += monthlyCookingBill;
             hasChanges = true;
          }
        }
        checkDate.setMonth(checkDate.getMonth() + 1);
      }

      if (hasChanges) {
        updateDoc(studentRef, {
          duesBreakdown: updatedDues,
          totalDue: increment(totalDueIncrement),
          cookingDueAmount: increment(-totalCookingDueDecrement),
          updatedAt: serverTimestamp()
        }).catch(() => {});
      }
    };

    syncDues();
  }, [student, studentRef, isUpdating, billingConfig]);

  const selectedBuildingForEdit = useMemo(() => 
    buildings?.find(b => b.id === editForm?.buildingId), 
    [buildings, editForm?.buildingId]
  )

  const roomsInBuildingForEdit = useMemo(() => {
    if (!selectedBuildingForEdit) return []
    return selectedBuildingForEdit.apartmentsDetail?.flatMap((apt: any) => 
      apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))
    ) || []
  }, [selectedBuildingForEdit])

  const selectedRoomForEdit = useMemo(() => 
    roomsInBuildingForEdit.find((r: any) => String(r.roomNo) === String(editForm?.roomNumber)), 
    [roomsInBuildingForEdit, editForm?.roomNumber]
  )

  const emptySeatsForEdit = useMemo(() => {
    if (!selectedRoomForEdit) return []
    const originalSeat = student?.seatNumber
    const originalRoom = student?.roomNumber
    const originalBuilding = student?.buildingId

    return selectedRoomForEdit.seats?.filter((s: any) => {
      if (s.status === 'empty') return true
      if (originalBuilding === editForm?.buildingId && originalRoom === editForm?.roomNumber && s.seatNo === originalSeat) return true
      return false
    }) || []
  }, [selectedRoomForEdit, student, editForm?.buildingId, editForm?.roomNumber])

  useEffect(() => {
    if (selectedRoomForEdit && isEditDialogOpen) {
      const newRent = Number(selectedRoomForEdit.rentPerSeat || 0)
      const isOriginalRoom = student?.buildingId === editForm?.buildingId && String(student?.roomNumber) === String(editForm?.roomNumber);
      let nextSeat = editForm?.seatNumber;

      if (!isOriginalRoom || !editForm?.seatNumber) {
        const firstAvailable = selectedRoomForEdit.seats?.find((s: any) => s.status === 'empty')?.seatNo || "";
        nextSeat = firstAvailable;
      }

      setEditForm((prev: any) => ({ 
        ...prev, 
        monthlyRent: newRent,
        seatNumber: nextSeat
      }))
    }
  }, [selectedRoomForEdit, isEditDialogOpen])

  const stats = useMemo(() => {
    if (!student) return null
    const rentDue = Object.values(student.duesBreakdown || {}).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);
    const foodBalance = student.foodDueAmount || 0
    const cookBalance = student.cookingDueAmount || 0
    const totalReceived = student.historicalTotalReceived || 0
    
    // UI calculation: Cooking Due vs Balance
    const cookDueDisplay = cookBalance < 0 ? Math.abs(cookBalance) : 0;
    
    const totalDue = rentDue + (foodBalance < 0 ? Math.abs(foodBalance) : 0) + cookDueDisplay;
    
    const dueBreakdownList = Object.entries(student.duesBreakdown || {}).map(([monthLabel, data]: any) => ({
      month: monthLabel, amount: Number(data.amount), status: 'Unpaid'
    })).sort((a, b) => {
      const [mA, yA] = a.month.split(' ');
      const [mB, yB] = b.month.split(' ');
      if (yA !== yB) return Number(yB) - Number(yA);
      return MONTHS.indexOf(mB) - MONTHS.indexOf(mA);
    });
    return { rentDue, foodBalance, cookBalance, totalDue, totalReceived, advanceRemaining: student.advanceAmount || 0, dueBreakdownList }
  }, [student])

  const settlementCalculation = useMemo(() => {
    if (!stats || !student) return null;
    const securityAdvance = Number(student.advanceAmount || 0);
    const unpaidRent = stats.rentDue;
    const foodDueAmount = student.paymentSystem === 'non-package' ? Number(student.foodDueAmount || 0) : 0;
    const cookingDueAmount = Number(student.cookingDueAmount || 0);
    const netResult = securityAdvance + foodDueAmount + cookingDueAmount - unpaidRent;
    return { 
      pendingRent: unpaidRent, 
      foodDue: foodDueAmount,
      cookingDue: cookingDueAmount,
      advance: securityAdvance, 
      netResult, 
      isRefund: netResult > 0, 
      absResult: Math.abs(netResult) 
    };
  }, [stats, student]);

  useEffect(() => {
    if (isExitDialogOpen && settlementCalculation) {
      setSettlementInput(settlementCalculation.absResult.toString());
    }
  }, [isExitDialogOpen, settlementCalculation]);

  const handleUpdateProfile = async () => {
    if (!studentRef || !editForm || !student) return
    setIsUpdating(true)
    const batch = writeBatch(db)
    
    const locationChanged = student.buildingId !== editForm.buildingId || 
                            student.roomNumber !== editForm.roomNumber || 
                            student.seatNumber !== editForm.seatNumber
    
    let studentUpdateData = { ...editForm };
    
    try {
      if (locationChanged) {
        if (student.buildingId === editForm.buildingId) {
          const bRef = doc(db, "buildings", student.buildingId)
          const bSnap = await getDoc(bRef)
          if (bSnap.exists()) {
            const bData = bSnap.data()
            const newAptName = selectedRoomForEdit?.aptName || "General"
            const updatedApts = bData.apartmentsDetail.map((apt: any) => {
              let newApt = { ...apt, rooms: [...apt.rooms] };
              newApt.rooms = newApt.rooms.map((room: any) => {
                let newRoom = { ...room, seats: [...room.seats] };
                if (apt.name === student.apartmentName && String(room.roomNo) === String(student.roomNumber)) {
                  newRoom.seats = newRoom.seats.map((s: any) => s.seatNo === student.seatNumber ? { ...s, status: 'empty' } : s);
                }
                if (apt.name === newAptName && String(room.roomNo) === String(editForm.roomNumber)) {
                  newRoom.seats = newRoom.seats.map((s: any) => s.seatNo === editForm.seatNumber ? { ...s, status: 'occupied' } : s);
                }
                return newRoom;
              });
              return newApt;
            });
            batch.update(bRef, { apartmentsDetail: updatedApts, updatedAt: serverTimestamp() });
            studentUpdateData.apartmentName = newAptName;
          }
        } else {
          const oldBRef = doc(db, "buildings", student.buildingId)
          const oldBSnap = await getDoc(oldBRef)
          if (oldBSnap.exists()) {
            const oldBData = oldBSnap.data()
            const updatedOldApts = oldBData.apartmentsDetail.map((apt: any) => {
              if (apt.name === student.apartmentName) {
                return { 
                  ...apt, 
                  rooms: apt.rooms.map((room: any) => {
                    if (String(room.roomNo) === String(student.roomNumber)) {
                      return { 
                        ...room, 
                        seats: room.seats.map((s: any) => s.seatNo === student.seatNumber ? { ...s, status: 'empty' } : s) 
                      }
                    }
                    return room
                  })
                }
              }
              return apt
            })
            batch.update(oldBRef, { apartmentsDetail: updatedOldApts, occupiedSeats: increment(-1), emptySeats: increment(1), updatedAt: serverTimestamp() })
          }

          const newBRef = doc(db, "buildings", editForm.buildingId)
          const newBSnap = await getDoc(newBRef)
          if (newBSnap.exists()) {
            const newBData = newBSnap.data()
            const newAptName = selectedRoomForEdit?.aptName || "General"
            const updatedNewApts = newBData.apartmentsDetail.map((apt: any) => {
              if (apt.name === newAptName) {
                return { 
                  ...apt, 
                  rooms: apt.rooms.map((room: any) => {
                    if (String(room.roomNo) === String(editForm.roomNumber)) {
                      return { 
                        ...room, 
                        seats: room.seats.map((s: any) => s.seatNo === editForm.seatNumber ? { ...s, status: 'occupied' } : s) 
                      }
                    }
                    return room
                  })
                }
              }
              return apt
            })
            batch.update(newBRef, { apartmentsDetail: updatedNewApts, occupiedSeats: increment(1), emptySeats: increment(-1), updatedAt: serverTimestamp() })
            studentUpdateData.buildingName = newBData.name
            studentUpdateData.apartmentName = newAptName
          }
        }
      }
      batch.update(studentRef, { ...studentUpdateData, updatedAt: serverTimestamp() })
      await batch.commit()
      setIsEditDialogOpen(false)
      toast({ title: "Profile Updated" })
      router.refresh()
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) } 
    finally { setIsUpdating(false) }
  }

  const handleMealAdjust = async () => {
    if (!studentRef) return
    setIsUpdating(true)
    try {
      await updateDoc(studentRef, {
        currentMonthBreakfast: Number(mealAdjustment.breakfast),
        currentMonthLunch: Number(mealAdjustment.lunch),
        currentMonthDinner: Number(mealAdjustment.dinner),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Counters Adjusted", description: "This month's meal totals updated manually." })
      setIsMealAdjustOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handlePaymentSubmit = async () => {
    if (!studentRef || !student) return
    const seatPaid = Number(paymentData.seatAmount || 0)
    const foodPaid = Number(paymentData.foodAmount || 0)
    const extraAdv = Number(paymentData.addAdvanceAmount || 0)
    const totalAmt = Number(paymentData.amount) || (seatPaid + foodPaid + extraAdv)

    if (totalAmt <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Invalid payment amount." })
      return
    }

    setIsUpdating(true)
    const batch = writeBatch(db)
    try {
      const pId = doc(collection(db, "payments")).id
      const pRecord = {
        id: pId, amount: totalAmt, seatAmount: seatPaid, foodAmount: foodPaid, advanceAmount: extraAdv,
        studentId: student.id, studentName: student.name, buildingId: student.buildingId,
        buildingName: student.buildingName, roomNumber: student.roomNumber, branch: student.branch,
        type: "income", month: paymentData.month, year: paymentData.year, method: paymentData.method,
        receiver: paymentData.receiver, date: new Date().toISOString(), description: paymentData.description
      }

      batch.set(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp(), createdAt: serverTimestamp() })

      // Process Rent Dues
      const currentDues = { ...(student.duesBreakdown || {}) };
      const targetLabel = `${paymentData.month} ${paymentData.year}`;
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
          const [mA, yA] = a.split(' '); const [mB, yB] = b.split(' ');
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

      batch.update(studentRef, {
        paymentsHistory: arrayUnion(pRecord),
        advanceAmount: increment(extraAdv),
        totalDue: finalTotalDue,
        duesBreakdown: currentDues,
        foodDueAmount: increment(foodPaid),
        historicalTotalReceived: increment(totalAmt),
        updatedAt: serverTimestamp()
      })

      // Update Net Balance
      const balanceRef = doc(db, "netBalance", student.branch);
      const methodKeyMap: Record<string, string> = { 'cash': 'totalCash', 'bkash': 'totalBkash', 'nagad': 'totalNagad', 'bank': 'totalBank' };
      const methodKey = methodKeyMap[paymentData.method] || 'totalCash';
      batch.set(balanceRef, { [methodKey]: increment(totalAmt), totalHandCash: increment(totalAmt), lastUpdated: serverTimestamp() }, { merge: true });

      // In-App Notice
      const noticeId = doc(collection(db, "notices")).id
      batch.set(doc(db, "notices", noticeId), {
        id: noticeId, studentId: student.id, title: "Payment Received", branch: student.branch,
        message: `৳${totalAmt} recorded successfully. Seat: ${seatPaid}, Food: ${foodPaid}, Adv: ${extraAdv}.`,
        type: "payment", isRead: false, createdAt: serverTimestamp()
      })

      await batch.commit()
      toast({ title: "Payment Recorded", description: "Balance and ledger updated." })
      setIsPaymentDialogOpen(false)
      setPaymentData({ ...paymentData, amount: "", seatAmount: "", foodAmount: "", addAdvanceAmount: "0", description: "" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleConfirmExit = async () => {
    if (!studentRef || !student || !settlementCalculation || !exitStaff) {
      toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "অনুগ্রহ করে স্টাফ মেম্বার সিলেক্ট করুন।" })
      return
    }
    setIsUpdating(true)
    const batch = writeBatch(db)
    try {
      const bRef = doc(db, "buildings", student.buildingId)
      const buildingSnap = await getDoc(bRef)
      if (buildingSnap.exists()) {
        const bData = buildingSnap.data()
        const updatedApts = bData.apartmentsDetail.map((apt: any) => {
          if (apt.name === student.apartmentName) {
            return {
              ...apt,
              rooms: apt.rooms.map((room: any) => {
                if (String(room.roomNo) === String(student.roomNumber)) {
                  return { 
                    ...room, 
                    seats: room.seats.map((seat: any) => seat.seatNo === student.seatNumber ? { ...seat, status: 'empty' } : seat) 
                  }
                }
                return room
              })
            }
          }
          return apt
        })
        batch.update(bRef, { apartmentsDetail: updatedApts, occupiedSeats: increment(-1), emptySeats: increment(1), updatedAt: serverTimestamp() })
      }

      const processedAmt = Number(settlementInput)
      const balanceRef = doc(db, "netBalance", student.branch)
      const methodKeyMap: Record<string, string> = { 'cash': 'totalCash', 'bkash': 'totalBkash', 'nagad': 'totalNagad', 'bank': 'totalBank' }
      const methodKey = methodKeyMap[exitMethod] || 'totalCash'

      let finalTotalDue = 0; let finalAdvance = 0;
      if (settlementCalculation.isRefund) {
        if (processedAmt > 0) {
          const expenseId = doc(collection(db, "expenses")).id
          batch.set(doc(db, "expenses", expenseId), {
            id: expenseId, category: "Student Refund", amount: processedAmt,
            expenseDate: new Date().toISOString().split('T')[0], method: exitMethod, spentBy: exitStaff,
            branch: student.branch, buildingId: student.buildingId, buildingName: student.buildingName,
            description: `Exit refund settlement for ${student.name} (${student.phone}). Room: ${student.buildingName} R-{student.roomNumber}.`,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
          })
          batch.set(balanceRef, { [methodKey]: increment(-processedAmt), totalHandCash: increment(-processedAmt), lastUpdated: serverTimestamp() }, { merge: true })
        }
        const delta = settlementCalculation.netResult - processedAmt;
        if (delta > 0) finalAdvance = delta; else if (delta < 0) finalTotalDue = Math.abs(delta);
      } else {
        if (processedAmt > 0) {
          const paymentId = doc(collection(db, "payments")).id
          batch.set(doc(db, "payments", paymentId), {
            id: paymentId, type: "income", category: "Settlement Income", amount: processedAmt,
            studentId: student.id, studentName: student.name, buildingId: student.buildingId,
            buildingName: student.buildingName, roomNumber: student.roomNumber, branch: student.branch,
            method: exitMethod, receiver: exitStaff, date: serverTimestamp(),
            description: `Exit due clearance for ${student.name}.`,
            createdAt: serverTimestamp()
          })
          batch.set(balanceRef, { [methodKey]: increment(processedAmt), totalHandCash: increment(processedAmt), lastUpdated: serverTimestamp() }, { merge: true })
        }
        const delta = Math.abs(settlementCalculation.netResult) - processedAmt;
        if (delta > 0) finalTotalDue = delta; else if (delta < 0) finalAdvance = Math.abs(delta);
      }
      batch.update(studentRef, { isActive: false, leftAt: serverTimestamp(), totalDue: finalTotalDue, advanceAmount: finalAdvance, foodDueAmount: 0, cookingDueAmount: 0, duesBreakdown: {}, finalSettlementAmount: processedAmt, finalSettlementMethod: exitMethod, finalSettlementProcessedBy: exitStaff, updatedAt: serverTimestamp() })
      await batch.commit()
      if (apiConfig?.apikey) {
        const template = templatesData?.templates?.find((t: any) => t.id === 'exit')?.text || "প্রিয় [নাম], [Hostel Name]-এ থাকার জন্য আপনাকে ধন্যবাদ। আপনার আগামী দিনগুলো সুন্দর হোক। শুভকামনা।";
        const msg = template.replaceAll('[নাম]', student.name).replaceAll('[Hostel Name]', templatesData?.hostelName || student.branch);
        const smsResult = await sendSMS(apiConfig.apikey, apiConfig.senderid, student.phone, msg);
        const logId = doc(collection(db, "smsLogs")).id;
        await setDoc(doc(db, "smsLogs", logId), { id: logId, to: student.phone, message: msg, status: smsResult.error === 0 ? 'Success' : 'Failed', branch: student.branch, sentBy: userName, createdAt: serverTimestamp() });
      }
      toast({ title: "Settlement Complete", description: `Seat released. Remaining Due: ৳${finalTotalDue}` });
      setIsExitDialogOpen(false); router.push("/students");
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) } 
    finally { setIsUpdating(false) }
  }

  // MIGRATION ACTIONS
  const addMigrationDue = () => {
    setMigrationForm(prev => ({
      ...prev,
      dues: [...prev.dues, { id: Math.random().toString(36).substr(2, 9), month: MONTHS[new Date().getMonth()], year: new Date().getFullYear().toString(), amount: student?.monthlyRent?.toString() || "0" }]
    }))
  }

  const removeMigrationDue = (id: string) => {
    setMigrationForm(prev => ({ ...prev, dues: prev.dues.filter(d => d.id !== id) }))
  }

  const addMigrationPayment = () => {
    setMigrationForm(prev => ({
      ...prev,
      pastPayments: [...prev.pastPayments, { id: Math.random().toString(36).substr(2, 9), month: MONTHS[new Date().getMonth()], year: new Date().getFullYear().toString(), amount: student?.monthlyRent?.toString() || "0", seatAmount: student?.monthlyRent?.toString() || "0", foodAmount: "0", method: "cash", date: new Date().toISOString().split('T')[0] }]
    }))
  }

  const removeMigrationPayment = (id: string) => {
    setMigrationForm(prev => ({ ...prev, pastPayments: prev.pastPayments.filter(p => p.id !== id) }))
  }

  const handleSaveMigration = async () => {
    if (!studentRef) return
    setIsUpdating(true)
    try {
      const finalDues: Record<string, any> = {}
      let totalDue = 0
      migrationForm.dues.forEach(d => {
        const label = `${d.month} ${d.year}`
        const amt = Number(d.amount)
        finalDues[label] = { month: d.month, year: d.year, amount: amt }
        totalDue += amt
      })

      const finalPayments = migrationForm.pastPayments.map(p => ({
        ...p,
        amount: Number(p.amount),
        seatAmount: Number(p.seatAmount),
        foodAmount: Number(p.foodAmount),
        date: new Date(p.date).toISOString()
      }))

      await updateDoc(studentRef, {
        duesBreakdown: finalDues,
        totalDue: totalDue,
        paymentsHistory: finalPayments,
        advanceAmount: Number(migrationForm.advanceAmount),
        serviceCharge: Number(migrationForm.serviceCharge),
        foodDueAmount: Number(migrationForm.foodDueAmount),
        cookingDueAmount: Number(migrationForm.cookingDueAmount),
        historicalTotalReceived: Number(migrationForm.historicalTotalReceived),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Migration Successful", description: "Historical data and balances have been updated." })
      setIsMigrationDialogOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Migration Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  if (studentLoading || buildingsLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
  if (!student) return <div className="text-center p-20">Resident not found.</div>

  const financialCards = [
    { label: "Advance", val: student.advanceAmount, color: "blue-600", icon: ShieldCheck, bg: "bg-blue-50" },
    { label: "Service Chrg", val: student.serviceCharge, color: "purple-600", icon: Zap, bg: "bg-purple-50" },
    { label: "Monthly Rent", val: student.monthlyRent, color: "orange-600", icon: Home, bg: "bg-orange-50" },
    { label: "Total Recv.", val: stats?.totalReceived, color: "green-600", icon: HandCoins, bg: "bg-green-50" },
    { label: "Rent Due", val: stats?.rentDue || 0, color: "destructive", icon: AlertCircle, bg: "bg-red-50" },
    { label: "Food Bal.", val: stats?.foodBalance, color: (stats?.foodBalance ?? 0) >= 0 ? "success" : "destructive", icon: Utensils, bg: (stats?.foodBalance ?? 0) >= 0 ? "bg-success/5" : "bg-red-50" },
    { label: "Cooking Bal.", val: student.cookingDueAmount || 0, color: (student.cookingDueAmount || 0) >= 0 ? "success" : "destructive", icon: ChefHat, bg: (student.cookingDueAmount || 0) >= 0 ? "bg-success/5" : "bg-red-50" },
  ].filter(c => c.label !== 'Food Bal.' || student.paymentSystem === 'non-package');

  return (
    <div className="space-y-8 pb-24 max-w-7xl mx-auto px-4 relative">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2"><ChevronLeft size={24} /></Button>
        <div className="flex-1 overflow-hidden"><h1 className="text-lg font-bold truncate">{student.name}</h1><p className="text-[10px] text-muted-foreground font-bold uppercase">{student.buildingName} • R-{student.roomNumber}</p></div>
        <div className="flex items-center gap-1">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical size={20} /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-xl border-slate-100">
              <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer"><Edit size={16} className="text-primary" /> Edit Profile</DropdownMenuItem>
              {userRole === 'Admin' && (
                <DropdownMenuItem onSelect={() => setIsMigrationDialogOpen(true)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer text-indigo-600"><Database size={16} /> Migration Setup</DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setIsExitDialogOpen(true)} className="gap-2 font-medium text-destructive p-3 rounded-lg cursor-pointer"><Scale size={16} /> Process Exit & Settlement</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="hidden md:flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><UserCircle size={48} strokeWidth={1.5} /></div>
          <div><h1 className="text-3xl font-black text-slate-800 tracking-tight">{student.name}</h1>
            <div className="flex gap-2 mt-1">
               <Badge className={cn("rounded-full", student.isActive ? "bg-success" : "bg-destructive")}>{student.isActive ? "Active Resident" : "Ex-Resident"}</Badge>
               <Badge variant="secondary" className="rounded-full uppercase text-[10px] font-bold">{student.paymentSystem} Plan</Badge>
               <Badge variant="outline" className="rounded-full uppercase text-[10px] font-bold text-primary border-primary/20">Role: {student.role || 'Student'}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          {userRole === 'Admin' && (
            <Button variant="outline" className="rounded-xl h-11 px-6 font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50" onClick={() => setIsMigrationDialogOpen(true)}><Database size={18} className="mr-2"/> Migration Setup</Button>
          )}
          <Button variant="outline" className="rounded-xl h-11 px-6 font-bold" onClick={() => setIsEditDialogOpen(true)}><Edit size={18} className="mr-2"/> Edit Profile</Button>
          <Button variant="destructive" className="rounded-xl h-11 px-6 font-bold gap-2 shadow-lg shadow-destructive/10" onClick={() => setIsExitDialogOpen(true)}><Scale size={18} /> Process Exit & Settlement</Button>
          <Button variant="ghost" className="rounded-xl h-11 px-6 font-bold" onClick={() => router.back()}>Back</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="border-none shadow-sm rounded-3xl p-6 bg-white flex flex-col justify-between">
          <div><h2 className="text-xl font-bold text-slate-800 mb-6">Contact & Location</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-slate-600"><div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Phone size={18}/></div><div><p className="text-[10px] uppercase font-bold text-muted-foreground">Personal Mobile</p><p className="font-bold">{student.phone}</p></div></div>
              <div className="flex items-center gap-4 text-slate-600"><div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Smartphone size={18}/></div><div><p className="text-[10px] uppercase font-bold text-muted-foreground">Parent Mobile</p><p className="font-bold">{student.parentPhone || 'N/A'}</p></div></div>
              <div className="flex items-center gap-4 text-slate-600"><div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Building2 size={18}/></div><div><p className="text-[10px] uppercase font-bold text-muted-foreground">Location</p><p className="font-bold">{student.buildingName} • R-{student.roomNumber} | S-{student.seatNumber}</p></div></div>
              
              <Separator />

              <div className="pt-2 space-y-4">
                 <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-3 shadow-xl">
                    <div className="flex justify-between items-center">
                       <p className="text-[8px] font-black uppercase text-primary tracking-widest flex items-center gap-1"><Lock size={10}/> Portal Access</p>
                       <Badge variant="outline" className="text-[8px] font-bold text-white border-white/20">Secured</Badge>
                    </div>
                    <div className="flex justify-between items-end">
                       <div className="space-y-1">
                          <p className="text-[10px] text-white/50 font-bold uppercase">System Password</p>
                          <p className="text-lg font-mono font-black tracking-wider">
                             {showPassword ? student.password : "••••••••"}
                          </p>
                       </div>
                       <Button variant="ghost" size="icon" className="text-white/60 hover:text-white" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <X size={18}/> : <Eye size={18}/>}
                       </Button>
                    </div>
                    <p className="text-[8px] text-white/30 italic">Generated during admission. Give this to the resident for portal login.</p>
                 </div>
              </div>
            </div>
          </div>
          <Button variant="secondary" className="w-full mt-8 rounded-xl font-bold gap-2 text-xs uppercase" onClick={() => setIsDetailsDialogOpen(true)}><Info size={14} /> View All Information</Button>
        </Card>
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {financialCards.map((card, idx) => (
            <Card key={idx} className={cn("p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 bg-white")}>
              <div className={cn("p-3 rounded-xl shrink-0", card.bg, card.color === 'success' ? 'text-success' : (card.color === 'destructive' ? 'text-destructive' : `text-${card.color}`))}><card.icon size={24}/></div>
              <div><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{card.label}</p><p className={cn("text-xl font-black", card.color === 'success' ? "text-success" : (card.color === 'destructive' ? "text-destructive" : "text-slate-800"))}>৳{card.val?.toLocaleString()}</p></div>
            </Card>
          ))}
          
          <Card className="p-4 rounded-2xl border-2 border-primary/10 shadow-md flex items-center justify-between bg-white md:col-span-2">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/5 text-primary"><Calculator size={24}/></div>
              <div>
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">Month Consumption Adjustment</p>
                <div className="flex gap-4 mt-1">
                  <div className="text-center"><p className="text-[8px] font-bold text-muted-foreground uppercase">B</p><p className="text-sm font-black">{student.currentMonthBreakfast || 0}</p></div>
                  <div className="text-center"><p className="text-[8px] font-bold text-muted-foreground uppercase">L</p><p className="text-sm font-black">{student.currentMonthLunch || 0}</p></div>
                  <div className="text-center"><p className="text-[8px] font-bold text-muted-foreground uppercase">D</p><p className="text-sm font-black">{student.currentMonthDinner || 0}</p></div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl h-10 px-4 font-bold border-success/20 text-success" onClick={() => setIsPaymentDialogOpen(true)}>
                <Plus size={16} className="mr-1"/> Record Payment
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setIsMealAdjustOpen(true)}>
                <Settings2 size={20}/>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-6 rounded-2xl overflow-x-auto h-auto flex">
          <TabsTrigger value="payments" className="rounded-xl gap-2 h-10 px-6 font-bold flex-1"><Wallet size={14}/> Finance History</TabsTrigger>
          <TabsTrigger value="dues" className="rounded-xl gap-2 h-10 px-6 font-bold flex-1"><Clock size={14}/> Dues Breakdown</TabsTrigger>
          {student.paymentSystem === 'non-package' && <TabsTrigger value="meals" className="rounded-xl gap-2 h-10 px-6 font-bold flex-1"><Utensils size={14}/> Food Log</TabsTrigger>}
        </TabsList>
        <TabsContent value="payments">
          <Card className="hidden md:block border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Date</TableHead>Complete Record<TableHead>Period</TableHead><TableHead>Rent</TableHead><TableHead>Food</TableHead><TableHead>Cooking</TableHead><TableHead>Advance</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>{student.paymentsHistory?.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((p: any, idx: number) => (
                <TableRow key={idx} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/receipts/${p.id}`)}>
                  <TableCell className="text-xs text-slate-500">{new Date(p.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-bold">{p.month} {p.year}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>৳{p.seatAmount || 0}</span>
                      {p.method === 'adjustment' && <span className="text-[8px] font-bold text-primary uppercase">From Advance</span>}
                    </div>
                  </TableCell>
                  <TableCell>৳{p.foodAmount || 0}</TableCell>
                  <TableCell>৳{p.cookingBill || 0}</TableCell>
                  <TableCell>৳{p.advanceAmount || 0}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[9px] uppercase font-bold", p.method === 'adjustment' ? "border-primary text-primary bg-primary/5" : "text-muted-foreground")}>
                      {p.method}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-black text-success">৳{p.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </Card>
          <div className="md:hidden space-y-4">{student.paymentsHistory?.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((p: any, idx: number) => (
            <Card key={idx} className="border-none shadow-sm rounded-2xl bg-white p-4 space-y-3" onClick={() => router.push(`/receipts/${p.id}`)}>
              <div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(p.date).toLocaleDateString()}</p><h3 className="font-black text-slate-800">{p.month} {p.year}</h3></div><Badge className="bg-success font-black">৳{p.amount.toLocaleString()}</Badge></div>
              <div className="grid grid-cols-4 gap-2 bg-secondary/30 p-2 rounded-xl text-[8px] font-bold uppercase text-slate-500"><div className="text-center"><p className="opacity-60">Rent</p><p className="text-slate-800">৳{p.seatAmount || 0}</p></div><div className="text-center"><p className="opacity-60">Food</p><p className="text-slate-800">৳{p.foodAmount || 0}</p></div><div className="text-center"><p className="opacity-60">Cook</p><p className="text-slate-800">৳{p.cookingBill || 0}</p></div><div className="text-center"><p className="opacity-60">Adv.</p><p className="text-primary">৳{p.advanceAmount || 0}</p></div></div>
              {p.description && <p className="text-[9px] text-slate-400 italic line-clamp-1">{p.description}</p>}
              <div className="flex justify-between items-center text-[10px]">
                <span className={cn("font-bold uppercase flex items-center gap-1", p.method === 'adjustment' ? "text-primary" : "text-muted-foreground")}>
                  <Wallet size={10}/> {p.method === 'adjustment' ? 'Adjusted from Advance' : p.method}
                </span>
                <Button variant="ghost" size="sm" className="h-6 text-primary gap-1 font-bold">Receipt <ChevronRight size={12}/></Button>
              </div>
            </Card>
          ))}</div>
        </TabsContent>
        <TabsContent value="dues">
          <Card className="hidden md:block border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Month</TableHead><TableHead>Due Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>{stats?.dueBreakdownList.map((d, i) => (
                <TableRow key={i}><TableCell className="font-bold">{d.month}</TableCell><TableCell className="font-black text-destructive">৳{d.amount.toLocaleString()}</TableCell><TableCell><Badge variant="outline" className="text-[10px] text-destructive border-destructive uppercase">Unpaid</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" className="text-primary font-bold" onClick={() => router.push(`/payment-entry?studentId=${student.id}`)}>Record Pay</Button></TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </Card>
          <div className="md:hidden space-y-4">{stats?.dueBreakdownList.map((d, i) => (
            <Card key={i} className="border-none shadow-sm rounded-2xl bg-white border-l-4 border-l-destructive p-4 flex justify-between items-center"><div><h3 className="font-black text-slate-800">{d.month}</h3><p className="text-xl font-black text-destructive">৳{d.amount.toLocaleString()}</p></div><Button size="sm" className="rounded-xl h-9 px-4 font-bold" onClick={() => router.push(`/payment-entry?studentId=${student.id}`)}>Record</Button></Card>
          ))}</div>
        </TabsContent>
        {student.paymentSystem === 'non-package' && (
          <TabsContent value="meals">
            <Card className="hidden md:block border-none shadow-sm rounded-3xl overflow-hidden bg-white">
              <Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Date</TableHead><TableHead>Month</TableHead><TableHead>Meal Count</TableHead><TableHead className="text-right">Total Cost</TableHead></TableRow></TableHeader>
                <TableBody>{student.mealsHistory?.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((m: any, idx: number) => (
                  <TableRow key={idx}><TableCell className="text-xs text-slate-500">{new Date(m.date).toLocaleDateString()}</TableCell><TableCell className="font-bold">{m.month}</TableCell><TableCell><Badge variant="secondary" className="font-bold">{m.totalMeals} Meals</Badge></TableCell><TableCell className="text-right font-black text-destructive">৳{m.totalCost?.toLocaleString()}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </Card>
            <div className="md:hidden space-y-4">{student.mealsHistory?.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((m: any, idx: number) => (
              <Card key={idx} className="border-none shadow-sm rounded-2xl bg-white p-4 space-y-2"><div className="flex justify-between items-center"><p className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(m.date).toLocaleDateString()}</p><Badge variant="secondary" className="font-black">{m.totalMeals} MEALS</Badge></div><div className="flex justify-between items-end"><h3 className="font-black text-slate-800">{m.month}</h3><p className="text-xl font-black text-destructive">৳{m.totalCost?.toLocaleString()}</p></div></Card>
            ))}</div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-5 bg-slate-900 rounded-3xl text-white space-y-3 shadow-xl">
              <div className="flex justify-between items-center opacity-70 text-xs"><span>Rent Due (History)</span> <span className="text-destructive font-black">৳{stats?.totalDue || 0}</span></div>
              <Separator className="bg-white/10" />
              {student.duesBreakdown && Object.keys(student.duesBreakdown).length > 0 && (
                <div className="space-y-2 py-2"><p className="text-[8px] font-black uppercase text-primary">Monthly Breakdown:</p>
                  <div className="grid grid-cols-2 gap-2 max-h-[100px] overflow-y-auto pr-1">
                    {Object.entries(student.duesBreakdown).map(([label, data]: any) => (
                      <div key={label} className="bg-white/10 p-1.5 rounded flex justify-between items-center border border-white/5"><span className="text-[8px] font-medium">{label}</span><span className="text-[9px] font-black text-destructive">৳{data.amount}</span></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Month</Label><Select value={paymentData.month} onValueChange={v => setPaymentData({...paymentData, month: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Year</Label><Select value={paymentData.year} onValueChange={v => setPaymentData({...paymentData, year: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Seat Rent (৳)</Label><Input type="number" className="rounded-xl h-12" value={paymentData.seatAmount} onChange={e => setPaymentData({...paymentData, seatAmount: e.target.value})} /></div>
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Food Bill (৳)</Label><Input disabled={student.paymentSystem === 'package'} type="number" className="rounded-xl h-12" value={paymentData.foodAmount} onChange={e => setPaymentData({...paymentData, foodAmount: e.target.value})} /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs font-bold text-primary uppercase">Add Security Advance (৳)</Label><Input type="number" className="rounded-xl h-12 border-primary/20" value={paymentData.addAdvanceAmount} onChange={e => setPaymentData({...paymentData, addAdvanceAmount: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Method</Label><Select value={paymentData.method} onValueChange={v => setPaymentData({...paymentData, method: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>Receiver</Label><Select value={paymentData.receiver} onValueChange={v => setPaymentData({...paymentData, receiver: v})}><SelectTrigger><SelectValue placeholder="Select Staff Member"/></SelectTrigger><SelectContent>{managementStaff?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold">Notes</Label>
              <Textarea value={paymentData.description} onChange={e => setPaymentData({...paymentData, description: e.target.value})} placeholder="Internal note..." />
            </div>
          </div>
          <DialogFooter><Button className="w-full h-14 rounded-2xl text-lg font-black" onClick={handlePaymentSubmit} disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin" /> : "Confirm & Save Receipt"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMealAdjustOpen} onOpenChange={setIsMealAdjustOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calculator className="text-primary"/> Adjust Monthly Totals</DialogTitle>
            <DialogDescription>Manually update consumption for {student.currentMonthLabel}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-3 gap-4">
               <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-orange-500">Breakfast</Label><Input type="number" value={mealAdjustment.breakfast} onChange={e => setMealAdjustData({...mealAdjustment, breakfast: e.target.value})} className="h-12 font-black text-lg text-center bg-slate-50 border-none" /></div>
               <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-success">Lunch</Label><Input type="number" value={mealAdjustment.lunch} onChange={e => setMealAdjustData({...mealAdjustment, lunch: e.target.value})} className="h-12 font-black text-lg text-center bg-slate-50 border-none" /></div>
               <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-blue-500">Dinner</Label><Input type="number" value={mealAdjustment.dinner} onChange={e => setMealAdjustData({...mealAdjustment, dinner: e.target.value})} className="h-12 font-black text-lg text-center bg-slate-50 border-none" /></div>
            </div>
            <p className="text-[10px] text-muted-foreground italic bg-primary/5 p-3 rounded-xl border border-dashed">বি.দ্র: এখানে সরাসরি এই মাসের মোট মিলের সংখ্যা বসিয়ে দিন। এটি ১ তারিখ থেকে আজকের দিন পর্যন্ত খাবারের সংখ্যা আপডেট করতে সাহায্য করবে।</p>
          </div>
          <DialogFooter><Button onClick={handleMealAdjust} disabled={isUpdating} className="w-full h-12 rounded-xl font-bold uppercase text-xs tracking-widest">{isUpdating ? <Loader2 className="animate-spin" /> : "Save Adjusted Counts"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADVANCED MIGRATION DIALOG */}
      <Dialog open={isMigrationDialogOpen} onOpenChange={setIsMigrationDialogOpen}>
        <DialogContent className="max-w-4xl rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-600"><Database /> Advanced Migration Setup (Admin Only)</DialogTitle>
            <DialogDescription>Configure historical data, past payments and initial ledger balances.</DialogDescription>
          </DialogHeader>

          <div className="space-y-8 py-4">
            {/* Initial Balances Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50 rounded-3xl border">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Historical Recv.</Label>
                <Input type="number" value={migrationForm.historicalTotalReceived} onChange={e => setMigrationForm({...migrationForm, historicalTotalReceived: e.target.value})} className="h-10 font-bold" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Security Adv.</Label>
                <Input type="number" value={migrationForm.advanceAmount} onChange={e => setMigrationForm({...migrationForm, advanceAmount: e.target.value})} className="h-10 font-bold" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Svc Charge</Label>
                <Input type="number" value={migrationForm.serviceCharge} onChange={e => setMigrationForm({...migrationForm, serviceCharge: e.target.value})} className="h-10 font-bold" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-orange-600">Food Bal (+/-)</Label>
                <Input type="number" value={migrationForm.foodDueAmount} onChange={e => setMigrationForm({...migrationForm, foodDueAmount: e.target.value})} className="h-10 font-bold" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-indigo-600">Cooking Bal (+/-)</Label>
                <Input type="number" value={migrationForm.cookingDueAmount} onChange={e => setMigrationForm({...migrationForm, cookingDueAmount: e.target.value})} className="h-10 font-bold" />
                <p className="text-[8px] text-muted-foreground italic">Use negative for Due, positive for Balance.</p>
              </div>
            </div>

            {/* Dues Breakdown Management */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black uppercase text-primary flex items-center gap-2"><Clock size={16}/> Historical Unpaid Rent Dues</h3>
                <Button variant="outline" size="sm" onClick={addMigrationDue} className="gap-2 text-[10px] font-bold h-8"><Plus size={14}/> Add Month Box</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {migrationForm.dues.map(due => (
                  <div key={due.id} className="p-3 bg-white border-2 border-slate-100 rounded-2xl flex items-end gap-2 group animate-in zoom-in-95">
                    <div className="flex-1 space-y-1">
                      <div className="flex gap-1">
                        <Select value={due.month} onValueChange={v => {
                             const updated = migrationForm.dues.map(d => d.id === due.id ? { ...d, month: v } : d)
                             setMigrationForm({ ...migrationForm, dues: updated })
                        }}>
                          <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={due.year} onValueChange={v => {
                             const updated = migrationForm.dues.map(d => d.id === due.id ? { ...d, year: v } : d)
                             setMigrationForm({ ...migrationForm, dues: updated })
                        }}>
                          <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="w-24 space-y-1">
                      <Input type="number" value={due.amount} onChange={e => {
                         const updated = migrationForm.dues.map(d => d.id === due.id ? { ...d, amount: e.target.value } : d)
                         setMigrationForm({ ...migrationForm, dues: updated })
                      }} className="h-8 text-[10px] font-bold" />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-30 group-hover:opacity-100" onClick={() => removeMigrationDue(due.id)}>
                      <X size={14}/>
                    </Button>
                  </div>
                ))}
                {migrationForm.dues.length === 0 && <p className="text-center text-xs text-muted-foreground italic col-span-2">No historical dues assigned.</p>}
              </div>
            </div>

            {/* Payments History Management */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black uppercase text-success flex items-center gap-2"><History size={16}/> Payments History Records</h3>
                <Button variant="outline" size="sm" onClick={addMigrationPayment} className="gap-2 text-[10px] font-bold h-8"><Plus size={14}/> Record Past Pay</Button>
              </div>
              <div className="space-y-3">
                {migrationForm.pastPayments.map(p => (
                  <div key={p.id} className="p-4 bg-slate-50 border rounded-2xl flex flex-wrap md:flex-nowrap gap-4 items-end animate-in slide-in-from-top-2">
                     <div className="w-32 space-y-1">
                        <Label className="text-[8px] uppercase">Date</Label>
                        <Input type="date" value={p.date} onChange={e => {
                          const updated = migrationForm.pastPayments.map(pay => pay.id === p.id ? { ...pay, date: e.target.value } : pay)
                          setMigrationForm({ ...migrationForm, pastPayments: updated })
                        }} className="h-8 text-[10px]" />
                     </div>
                     <div className="w-40 space-y-1">
                        <Label className="text-[8px] uppercase">Month/Year</Label>
                        <div className="flex gap-1">
                           <Select value={p.month} onValueChange={v => {
                             const updated = migrationForm.pastPayments.map(pay => pay.id === p.id ? { ...pay, month: v } : pay)
                             setMigrationForm({ ...migrationForm, pastPayments: updated })
                           }}><SelectTrigger className="h-8 text-[9px]"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                           <Select value={p.year} onValueChange={v => {
                             const updated = migrationForm.pastPayments.map(pay => pay.id === p.id ? { ...pay, year: v } : pay)
                             setMigrationForm({ ...migrationForm, pastPayments: updated })
                           }}><SelectTrigger className="h-8 text-[9px]"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                        </div>
                     </div>
                     <div className="flex-1 space-y-1">
                        <Label className="text-[8px] uppercase">Seat + Food = Total</Label>
                        <div className="flex gap-2 items-center">
                           <Input type="number" value={p.seatAmount} onChange={e => {
                             const seat = Number(e.target.value); const total = seat + Number(p.foodAmount)
                             const updated = migrationForm.pastPayments.map(pay => pay.id === p.id ? { ...pay, seatAmount: e.target.value, amount: total.toString() } : pay)
                             setMigrationForm({ ...migrationForm, pastPayments: updated })
                           }} className="h-8 text-[10px] font-bold" />
                           <span className="text-[10px] font-bold">+</span>
                           <Input type="number" value={p.foodAmount} onChange={e => {
                             const food = Number(e.target.value); const total = food + Number(p.seatAmount)
                             const updated = migrationForm.pastPayments.map(pay => pay.id === p.id ? { ...pay, foodAmount: e.target.value, amount: total.toString() } : pay)
                             setMigrationForm({ ...migrationForm, pastPayments: updated })
                           }} className="h-8 text-[10px] font-bold" />
                           <span className="text-[10px] font-bold">=</span>
                           <Badge className="bg-success text-[10px] h-8 px-3">৳{p.amount}</Badge>
                        </div>
                     </div>
                     <div className="w-24 space-y-1">
                        <Label className="text-[8px] uppercase">Method</Label>
                        <Select value={p.method} onValueChange={v => {
                          const updated = migrationForm.pastPayments.map(pay => pay.id === p.id ? { ...pay, method: v } : pay)
                          setMigrationForm({ ...migrationForm, pastPayments: updated })
                        }}><SelectTrigger className="h-8 text-[9px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem></SelectContent></Select>
                     </div>
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMigrationPayment(p.id)}><Trash2 size={14}/></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-slate-50 border-t sticky bottom-0">
             <Button onClick={handleSaveMigration} disabled={isUpdating} className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl shadow-xl shadow-indigo-200 gap-3">
                {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={24}/>}
                Commit & Finalize Migration
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Info className="text-primary" /> Full Resident Profile</DialogTitle><DialogDescription>Comprehensive records for {student.name}</DialogDescription></DialogHeader>
          <div className="space-y-8 py-4">
            <div className="space-y-4"><h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><User size={14}/> Personal Information</h3>
              <div className="grid grid-cols-2 gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="space-y-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Father's Name</Label><p className="font-bold text-slate-700">{student.fatherName || 'N/A'}</p></div>
                <div className="space-y-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Mother's Name</Label><p className="font-bold text-slate-700">{student.motherName || 'N/A'}</p></div>
                <div className="space-y-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Date of Birth</Label><p className="font-bold text-slate-700">{student.dob || 'N/A'}</p></div>
                <div className="space-y-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Blood Group</Label><Badge variant="outline" className="font-black text-primary border-primary/20">{student.bloodGroup || 'N/A'}</Badge></div>
              </div>
            </div>
            
            <div className="space-y-4">
               <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                 {student.occupation === 'student' ? <GraduationCap size={14}/> : <Briefcase size={14}/>}
                  {student.occupation === 'student' ? 'Education Info' : 'Work Info'}
               </h3>
               <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                 {student.occupation === 'student' ? (
                   <>
                     <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3">
                       <Label className="text-[10px] font-bold text-primary uppercase">School Information</Label>
                       <p className="font-bold text-slate-700">{student.school || 'N/A'}</p>
                       <div className="flex gap-4 text-[10px] font-bold text-muted-foreground uppercase">
                         <span>Session: {student.schoolSession || 'N/A'}</span>
                         <span>Group: {student.schoolGroup || 'N/A'}</span>
                       </div>
                     </div>
                     <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3">
                       <Label className="text-[10px] font-bold text-primary uppercase">College Information</Label>
                       <p className="font-bold text-slate-700">{student.college || 'N/A'}</p>
                       <div className="flex gap-4 text-[10px] font-bold text-muted-foreground uppercase">
                         <span>Session: {student.collegeSession || 'N/A'}</span>
                         <span>Group: {student.collegeGroup || 'N/A'}</span>
                       </div>
                     </div>
                     <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3">
                       <Label className="text-[10px] font-bold text-primary uppercase">University Information</Label>
                       <p className="font-bold text-slate-700">{student.university || 'N/A'}</p>
                       <div className="flex gap-4 text-[10px] font-bold text-muted-foreground uppercase">
                         <span>Session: {student.universitySession || 'N/A'}</span>
                         <span>Dept: {student.department || 'N/A'}</span>
                       </div>
                     </div>
                   </>
                 ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Company Name</Label>
                        <p className="font-bold text-slate-700">{student.companyName || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Designation</Label>
                        <p className="font-bold text-slate-700">{student.designation || 'N/A'}</p>
                      </div>
                    </div>
                 )}
               </div>
            </div>

            <div className="space-y-4"><h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><MapPin size={14}/> Permanent Address</h3>
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Address</Label><p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{student.address || 'N/A'}</p></div>
            </div>
            <div className="space-y-4"><h3 className="text-[10px] font-black uppercase text-destructive tracking-widest flex items-center gap-2"><Smartphone size={14}/> Emergency Contacts</h3>
              <div className="grid grid-cols-2 gap-4"><div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-1"><Label className="text-[8px] font-bold text-destructive uppercase">Parent's Mobile</Label><p className="font-black text-slate-800">{student.parentPhone || 'N/A'}</p></div><div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-1"><Label className="text-[8px] font-bold text-destructive uppercase">Guardian Mobile</Label><p className="font-black text-slate-800">{student.guardianPhone || 'N/A'}</p></div></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setIsDetailsDialogOpen(false)} className="w-full rounded-2xl h-12 font-bold">Close Details</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Resident Profile</DialogTitle><DialogDescription>Update contact, location, or personal details.</DialogDescription></DialogHeader>
          {editForm && (
            <div className="space-y-8 py-4">
              <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Smartphone size={14}/> Communication & Contacts</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-1"><Label className="text-xs">Full Name</Label><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="bg-white" /></div>
                  <div className="space-y-1"><Label className="text-xs">Personal Phone</Label><Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="bg-white" /></div>
                  <div className="space-y-1"><Label className="text-xs">Parent's Mobile</Label><Input value={editForm.parentPhone} onChange={e => setEditForm({...editForm, parentPhone: e.target.value})} className="bg-white" /></div>
                  <div className="space-y-1"><Label className="text-xs">Guardian Mobile</Label><Input value={editForm.guardianPhone} onChange={e => setEditForm({...editForm, guardianPhone: e.target.value})} className="bg-white" /></div>
                </div>
              </div>
              <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Building2 size={14}/> Location Shifting (Hierarchy)</Label>
                <div className="p-5 border-2 border-primary/10 bg-primary/5 rounded-3xl space-y-4">
                  <div className="space-y-2"><Label className="text-xs">Select Building</Label><Select value={editForm.buildingId} onValueChange={val => setEditForm({...editForm, buildingId: val, roomNumber: "", seatNumber: ""})}><SelectTrigger className="bg-white rounded-xl h-11"><SelectValue placeholder="Choose Building" /></SelectTrigger><SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label className="text-xs">Room No.</Label><Select disabled={!editForm.buildingId} value={editForm.roomNumber} onValueChange={val => setEditForm({...editForm, roomNumber: val, seatNumber: ""})}><SelectTrigger className="bg-white rounded-xl h-11"><SelectValue placeholder="Room" /></SelectTrigger><SelectContent>{roomsInBuildingForEdit.map((r: any, idx: number) => (<SelectItem key={idx} value={String(r.roomNo)}>R-{r.roomNo} ({r.aptName})</SelectItem>))}</SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-xs">Available Seat</Label><Select disabled={!editForm.roomNumber} value={editForm.seatNumber} onValueChange={val => setEditForm({...editForm, seatNumber: val})}><SelectTrigger className="bg-white rounded-xl h-11"><SelectValue placeholder="Seat" /></SelectTrigger><SelectContent>{emptySeatsForEdit.map((s: any) => (<SelectItem key={s.seatNo} value={s.seatNo}>Seat {s.seatNo}</SelectItem>))}</SelectContent></Select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2"><div className="space-y-1"><Label className="text-xs font-bold text-orange-600">Monthly Rent (Auto-sync)</Label><Input type="number" value={editForm.monthlyRent} onChange={e => setEditForm({...editForm, monthlyRent: Number(e.target.value)})} className="bg-white font-black" /></div><div className="space-y-1"><Label className="text-xs">Billing Start Date</Label><Input type="date" value={editForm.billingStartDate} onChange={e => setEditForm({...editForm, billingStartDate: e.target.value})} className="bg-white" /></div></div>
                </div>
              </div>
              <Button onClick={handleUpdateProfile} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl" disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin" /> : "Save Profile Updates"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><UserMinus /> Exit & Settlement</DialogTitle><DialogDescription>Process resident checkout and final financial clearing.</DialogDescription></DialogHeader>
          {settlementCalculation && (
            <div className="space-y-6 py-4">
              <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 space-y-4">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Unpaid Rent:</span><span className="font-bold text-destructive">৳{settlementCalculation.pendingRent.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{settlementCalculation.foodDue >= 0 ? "Food Balance (Credit):" : "Food Debt:"}</span>
                  <span className={cn("font-bold", settlementCalculation.foodDue >= 0 ? "text-success" : "text-destructive")}>
                    ৳{Math.abs(settlementCalculation.foodDue).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{settlementCalculation.cookingDue >= 0 ? "Cooking Balance:" : "Cooking Debt:"}</span>
                  <span className={cn("font-bold", settlementCalculation.cookingDue >= 0 ? "text-success" : "text-destructive")}>
                    ৳{Math.abs(settlementCalculation.cookingDue).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Security Advance:</span><span className="font-bold text-primary">৳{settlementCalculation.advance.toLocaleString()}</span></div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-black text-slate-800">Theoretical Result:</span>
                  <div className="text-right">
                    <p className={cn("text-2xl font-black", settlementCalculation.isRefund ? "text-success" : "text-destructive")}>৳{settlementCalculation.absResult.toLocaleString()}</p>
                    <p className="text-[10px] font-bold uppercase opacity-60">{settlementCalculation.isRefund ? "Hostel Pays Resident (Refund)" : "Resident Pays Hostel (Due Clearance)"}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Final Amount Processed (৳)</Label>
                  <Input type="number" value={settlementInput} onChange={e => setSettlementInput(e.target.value)} className="h-12 text-lg font-black" />
                  <p className="text-[9px] text-muted-foreground italic">Note: If processed amount is less than result, the remainder stays as "Due" in profile.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Payment Method</Label>
                    <Select value={exitMethod} onValueChange={setExitMethod}>
                      <SelectTrigger className="bg-white h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bkash">Bkash</SelectItem>
                        <SelectItem value="nagad">Nagad</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Processed By</Label>
                    <Select value={exitStaff} onValueChange={setExitStaff}>
                      <SelectTrigger className="bg-white h-11"><SelectValue placeholder="Select Staff Member" /></SelectTrigger>
                      <SelectContent>
                        {managementStaff?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex gap-3"><AlertCircle className="text-destructive h-5 w-5 shrink-0" /><p className="text-[10px] text-red-700 leading-tight">This action will release Seat {student.seatNumber} in Room {student.roomNumber} and mark the resident as inactive. Remaining dues will be preserved.</p></div>
            </div>
          )}
          <DialogFooter className="grid grid-cols-2 gap-4"><Button variant="outline" className="rounded-xl" onClick={() => setIsExitDialogOpen(false)}>Cancel</Button><Button variant="destructive" className="rounded-xl font-bold" onClick={handleConfirmExit} disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin" /> : "Confirm & Process"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
