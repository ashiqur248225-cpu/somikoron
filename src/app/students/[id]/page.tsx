"use client"

import * as React from "react"
import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
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

export default function StudentDetailsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = React.use(props.params)
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
                return { ...apt, rooms: apt.rooms.map((room: any) => (String(room.roomNo) === String(student.roomNumber)) ? { ...room, seats: room.seats.map((s: any) => s.seatNo === student.seatNumber ? { ...s, status: 'empty' } : s) } : room) }
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
                return { ...apt, rooms: apt.rooms.map((room: any) => (String(room.roomNo) === String(editForm.roomNumber)) ? { ...room, seats: room.seats.map((s: any) => s.seatNo === editForm.seatNumber ? { ...s, status: 'occupied' } : s) } : room) }
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
      setIsEditDialogOpen(false); toast({ title: "Profile Updated" }); router.refresh()
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) } 
    finally { setIsUpdating(false) }
  }

  const handlePaymentSubmit = async () => {
    if (!studentRef || !student) return
    const seatPaid = Number(paymentData.seatAmount || 0); const foodPaid = Number(paymentData.foodAmount || 0); const extraAdv = Number(paymentData.addAdvanceAmount || 0); const totalAmt = Number(paymentData.amount) || (seatPaid + foodPaid + extraAdv);
    if (totalAmt <= 0) { toast({ variant: "destructive", title: "Error", description: "Invalid payment amount." }); return; }
    setIsUpdating(true); const batch = writeBatch(db);
    try {
      const pId = doc(collection(db, "payments")).id;
      const pRecord = { id: pId, amount: totalAmt, seatAmount: seatPaid, foodAmount: foodPaid, advanceAmount: extraAdv, studentId: student.id, studentName: student.name, buildingId: student.buildingId, buildingName: student.buildingName, roomNumber: student.roomNumber, branch: student.branch, type: "income", month: paymentData.month, year: paymentData.year, method: paymentData.method, receiver: paymentData.receiver, date: new Date().toISOString(), description: paymentData.description };
      batch.set(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp(), createdAt: serverTimestamp() });
      const currentDues = { ...(student.duesBreakdown || {}) }; const targetLabel = `${paymentData.month} ${paymentData.year}`; let remainingRentPaid = seatPaid;
      if (currentDues[targetLabel] && remainingRentPaid > 0) {
        const dueAmt = Number(currentDues[targetLabel].amount);
        if (remainingRentPaid >= dueAmt) { remainingRentPaid -= dueAmt; delete currentDues[targetLabel]; }
        else { currentDues[targetLabel].amount = dueAmt - remainingRentPaid; remainingRentPaid = 0; }
      }
      if (remainingRentPaid > 0) {
        const sortedMonths = Object.keys(currentDues).sort((a, b) => { const [mA, yA] = a.split(' '); const [mB, yB] = b.split(' '); if (yA !== yB) return Number(yA) - Number(yB); return MONTHS.indexOf(mA) - MONTHS.indexOf(mB); });
        for (const m of sortedMonths) { if (remainingRentPaid <= 0) break; const dueAmt = Number(currentDues[m].amount); if (remainingRentPaid >= dueAmt) { remainingRentPaid -= dueAmt; delete currentDues[m]; } else { currentDues[m].amount = dueAmt - remainingRentPaid; remainingRentPaid = 0; } }
      }
      const finalTotalDue = Object.values(currentDues).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);
      batch.update(studentRef, { paymentsHistory: arrayUnion(pRecord), advanceAmount: increment(extraAdv), totalDue: finalTotalDue, duesBreakdown: currentDues, foodDueAmount: increment(foodPaid), historicalTotalReceived: increment(totalAmt), updatedAt: serverTimestamp() });
      const balanceRef = doc(db, "netBalance", student.branch); const methodKeyMap: Record<string, string> = { 'cash': 'totalCash', 'bkash': 'totalBkash', 'nagad': 'totalNagad', 'bank': 'totalBank' }; const methodKey = methodKeyMap[paymentData.method] || 'totalCash';
      batch.set(balanceRef, { [methodKey]: increment(totalAmt), totalHandCash: increment(totalAmt), lastUpdated: serverTimestamp() }, { merge: true });
      const noticeId = doc(collection(db, "notices")).id; batch.set(doc(db, "notices", noticeId), { id: noticeId, studentId: student.id, title: "Payment Received", branch: student.branch, message: `৳${totalAmt} recorded successfully.`, type: "payment", isRead: false, createdAt: serverTimestamp() });
      await batch.commit(); toast({ title: "Payment Recorded" }); setIsPaymentDialogOpen(false); setPaymentData({ ...paymentData, amount: "", seatAmount: "", foodAmount: "", addAdvanceAmount: "0", description: "" });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) } finally { setIsUpdating(false) }
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
    <div className="space-y-8 pb-24 max-w-full w-full px-1 md:px-4 relative overflow-x-hidden">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2"><ChevronLeft size={24} /></Button>
        <div className="flex-1 overflow-hidden"><h1 className="text-lg font-bold truncate">{student.name}</h1><p className="text-[10px] text-muted-foreground font-bold uppercase">{student.buildingName} • R-{student.roomNumber}</p></div>
        <div className="flex items-center gap-1">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical size={20} /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-xl border-slate-100">
              <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer"><Edit size={16} className="text-primary" /> Edit Profile</DropdownMenuItem>
              {userRole === 'Admin' && <DropdownMenuItem onSelect={() => setIsMigrationDialogOpen(true)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer text-indigo-600"><Database size={16} /> Migration Setup</DropdownMenuItem>}
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
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          {userRole === 'Admin' && <Button variant="outline" className="rounded-xl h-11 px-6 font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50" onClick={() => setIsMigrationDialogOpen(true)}><Database size={18} className="mr-2"/> Migration Setup</Button>}
          <Button variant="outline" className="rounded-xl h-11 px-6 font-bold" onClick={() => setIsEditDialogOpen(true)}><Edit size={18} className="mr-2"/> Edit Profile</Button>
          <Button variant="destructive" className="rounded-xl h-11 px-6 font-bold gap-2 shadow-lg shadow-destructive/10" onClick={() => setIsExitDialogOpen(true)}><Scale size={18} /> Exit & Settlement</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="border-none shadow-sm rounded-3xl p-6 bg-white flex flex-col justify-between">
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800">Contact & Location</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4"><div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Phone size={18}/></div><div><p className="text-[10px] uppercase font-bold text-muted-foreground">Mobile</p><p className="font-bold">{student.phone}</p></div></div>
              <div className="flex items-center gap-4"><div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Building2 size={18}/></div><div><p className="text-[10px] uppercase font-bold text-muted-foreground">Location</p><p className="font-bold">{student.buildingName} • R-{student.roomNumber} | S-{student.seatNumber}</p></div></div>
              <Separator />
              <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-3 shadow-xl">
                 <div className="flex justify-between items-end"><div><p className="text-[10px] text-white/50 font-bold uppercase">System Password</p><p className="text-lg font-mono font-black tracking-wider">{showPassword ? student.password : "••••••••"}</p></div><Button variant="ghost" size="icon" className="text-white/60 hover:text-white" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <X size={18}/> : <Eye size={18}/>}</Button></div>
              </div>
            </div>
          </div>
          <Button variant="secondary" className="w-full mt-8 rounded-xl font-bold gap-2 text-xs uppercase" onClick={() => setIsDetailsDialogOpen(true)}><Info size={14} /> View All Information</Button>
        </Card>
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {financialCards.map((card, idx) => (
            <Card key={idx} className="p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 bg-white">
              <div className={cn("p-3 rounded-xl shrink-0", card.bg, card.color === 'success' ? 'text-success' : (card.color === 'destructive' ? 'text-destructive' : `text-${card.color}`))}><card.icon size={24}/></div>
              <div className="min-w-0"><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest truncate">{card.label}</p><p className={cn("text-xl font-black", card.color === 'success' ? "text-success" : (card.color === 'destructive' ? "text-destructive" : "text-slate-800"))}>৳{card.val?.toLocaleString()}</p></div>
            </Card>
          ))}
          <Card className="p-4 rounded-2xl border-2 border-primary/10 shadow-md flex flex-col sm:flex-row items-center justify-between bg-white md:col-span-2 gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="p-3 rounded-xl bg-primary/5 text-primary"><Calculator size={24}/></div>
              <div><p className="text-[10px] font-black uppercase text-primary">Consumption Stats</p>
                <div className="flex gap-4 mt-1">
                  <div className="text-center"><p className="text-[8px] font-bold uppercase">B</p><p className="text-sm font-black">{student.currentMonthBreakfast || 0}</p></div>
                  <div className="text-center"><p className="text-[8px] font-bold uppercase">L</p><p className="text-sm font-black">{student.currentMonthLunch || 0}</p></div>
                  <div className="text-center"><p className="text-[8px] font-bold uppercase">D</p><p className="text-sm font-black">{student.currentMonthDinner || 0}</p></div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="rounded-xl h-10 px-4 font-bold border-success/20 text-success flex-1" onClick={() => setIsPaymentDialogOpen(true)}><Plus size={16} className="mr-1"/> Record Payment</Button>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setIsMealAdjustOpen(true)}><Settings2 size={20}/></Button>
            </div>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-6 rounded-2xl flex w-full overflow-x-auto h-auto">
          <TabsTrigger value="payments" className="rounded-xl gap-2 h-10 px-6 font-bold flex-1">History</TabsTrigger>
          <TabsTrigger value="dues" className="rounded-xl gap-2 h-10 px-6 font-bold flex-1">Dues</TabsTrigger>
          {student.paymentSystem === 'non-package' && <TabsTrigger value="meals" className="rounded-xl gap-2 h-10 px-6 font-bold flex-1">Meals</TabsTrigger>}
        </TabsList>
        <TabsContent value="payments" className="space-y-4">
          <Card className="hidden md:block border rounded-3xl overflow-hidden bg-white">
            <div className="overflow-x-auto"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Date</TableHead><TableHead>Period</TableHead><TableHead>Rent</TableHead><TableHead>Food</TableHead><TableHead>Advance</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>{student.paymentsHistory?.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((p: any, idx: number) => (
                <TableRow key={idx} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/receipts/${p.id}`)}>
                  <TableCell className="text-xs text-slate-500">{new Date(p.date).toLocaleDateString()}</TableCell><TableCell className="font-bold">{p.month} {p.year}</TableCell><TableCell>৳{p.seatAmount || 0}</TableCell><TableCell>৳{p.foodAmount || 0}</TableCell><TableCell>৳{p.advanceAmount || 0}</TableCell><TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{p.method}</Badge></TableCell><TableCell className="text-right font-black text-success">৳{p.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))}</TableBody></Table></div></Card>
          <div className="md:hidden space-y-4">{student.paymentsHistory?.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((p: any, idx: number) => (
            <Card key={idx} className="border-none shadow-sm rounded-2xl bg-white p-4 space-y-3" onClick={() => router.push(`/receipts/${p.id}`)}>
              <div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(p.date).toLocaleDateString()}</p><h3 className="font-black text-slate-800">{p.month} {p.year}</h3></div><Badge className="bg-success font-black">৳{p.amount.toLocaleString()}</Badge></div>
              <div className="grid grid-cols-3 gap-2 bg-secondary/30 p-2 rounded-xl text-[8px] font-bold uppercase text-slate-500 text-center"><div><p className="opacity-60">Rent</p><p className="text-slate-800">৳{p.seatAmount || 0}</p></div><div><p className="opacity-60">Food</p><p className="text-slate-800">৳{p.foodAmount || 0}</p></div><div><p className="opacity-60">Adv</p><p className="text-primary">৳{p.advanceAmount || 0}</p></div></div>
            </Card>))}</div>
        </TabsContent>
        <TabsContent value="dues" className="space-y-4">
          <Card className="hidden md:block border rounded-3xl overflow-hidden bg-white"><div className="overflow-x-auto"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Month</TableHead><TableHead>Due Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{stats?.dueBreakdownList.map((d, i) => (<TableRow key={i}><TableCell className="font-bold">{d.month}</TableCell><TableCell className="font-black text-destructive">৳{d.amount.toLocaleString()}</TableCell><TableCell><Badge variant="outline" className="text-[10px] text-destructive border-destructive uppercase">Unpaid</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" className="text-primary font-bold" onClick={() => router.push(`/payment-entry?studentId=${student.id}`)}>Record Pay</Button></TableCell></TableRow>))}</TableBody></Table></div></Card>
          <div className="md:hidden space-y-4">{stats?.dueBreakdownList.map((d, i) => (
            <Card key={i} className="border-none shadow-sm rounded-2xl bg-white border-l-4 border-l-destructive p-4 flex justify-between items-center">
              <div><h3 className="font-black text-slate-800">{d.month}</h3><p className="text-xl font-black text-destructive">৳{d.amount.toLocaleString()}</p></div><Button size="sm" className="rounded-xl font-bold" onClick={() => router.push(`/payment-entry?studentId=${student.id}`)}>Record</Button>
            </Card>))}</div>
        </TabsContent>
      </Tabs>
    </div>
  )
}