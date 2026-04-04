
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Users, Search, Plus, Phone, UserCircle, Loader2, 
  BedDouble, MapPin, Eye, Contact, Filter, XCircle, 
  Building2, DoorOpen, LayoutGrid, MoreVertical,
  Wallet, Utensils, Calendar, Trash2, FileSpreadsheet, Download, Share2, FileText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, updateDoc, increment, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2024", "2025", "2026", "2027"];

interface MonthlyDue {
  month: string;
  year: string;
  amount: string;
}

export default function StudentsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filters State
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")
  const [planFilter, setPlanFilter] = useState("all")
  
  // User Context
  const [userBranch, setUserBranch] = useState("Main Branch")
  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
  }, [])

  // CRITICAL: Filter data by branch
  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "students"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: students, isLoading } = useCollection(studentsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    parentPhone: "",
    address: "",
    buildingId: "",
    roomNumber: "",
    seatNumber: "",
    type: "new", 
    dueAmount: "0", 
    foodDueAmount: "0", 
    initialRentPayment: "0",
    initialFoodPayment: "0",
    advanceAmount: "0",
    serviceCharge: "0",
    paymentSystem: "package",
    monthlyRent: "",
    foodCost: "0",
    receiver: "",
    method: "cash",
    billingStartDate: new Date().toISOString().split('T')[0],
    dueInputMethod: "total" as "total" | "breakdown"
  })

  const [monthlyDues, setMonthlyDues] = useState<MonthlyDue[]>([])

  const addMonthlyDueRow = () => {
    setMonthlyDues([...monthlyDues, { month: MONTHS[new Date().getMonth()], year: new Date().getFullYear().toString(), amount: "" }])
  }

  const removeMonthlyDueRow = (idx: number) => {
    setMonthlyDues(monthlyDues.filter((_, i) => i !== idx))
  }

  const updateMonthlyDueRow = (idx: number, field: keyof MonthlyDue, value: string) => {
    const updated = [...monthlyDues]
    updated[idx][field] = value
    setMonthlyDues(updated)
  }

  // Dynamic Due Logic for New Students
  useEffect(() => {
    if (formData.type === 'new') {
      const rentPaid = Number(formData.initialRentPayment) || 0;
      const monthlyRate = Number(formData.monthlyRent) || 0;
      
      setFormData(prev => {
        const calculatedDue = (rentPaid >= monthlyRate && monthlyRate > 0) ? "0" : monthlyRate.toString();
        if (prev.dueAmount !== calculatedDue) {
          return { ...prev, dueAmount: calculatedDue };
        }
        return prev;
      });
    }
  }, [formData.monthlyRent, formData.type, formData.initialRentPayment])

  const selectedBuilding = buildings?.find(b => b.id === formData.buildingId)
  
  const allRoomsInSelectedBuilding = useMemo(() => {
    if (!selectedBuilding) return []
    return selectedBuilding.apartmentsDetail?.flatMap((apt: any) => 
      apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))
    ) || []
  }, [selectedBuilding])

  const selectedRoom = allRoomsInSelectedBuilding.find((r: any) => r.roomNo === formData.roomNumber)
  const emptySeats = selectedRoom?.seats?.filter((s: any) => s.status === 'empty') || []

  const roomOptions = useMemo(() => {
    if (buildingFilter === "all" || !buildings) return []
    const b = buildings.find(b => b.id === buildingFilter)
    return b?.apartmentsDetail?.flatMap((a: any) => a.rooms?.map((r: any) => r.roomNo)) || []
  }, [buildingFilter, buildings])

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

  const handleRegister = async () => {
    if (!formData.name || !formData.buildingId || !formData.roomNumber || !formData.seatNumber || !formData.monthlyRent || !formData.billingStartDate) {
      toast({ variant: "destructive", title: "Missing Info", description: "Name, Building, Room, Seat, Rent and Billing Start Date are required." })
      return
    }

    if (formData.phone.length !== 11) {
      toast({ variant: "destructive", title: "Invalid Phone", description: "Phone number must be exactly 11 digits." })
      return
    }

    const rentPaid = Number(formData.initialRentPayment) || 0
    const foodPaid = Number(formData.initialFoodPayment) || 0
    const advPaid = Number(formData.advanceAmount) || 0
    const svcPaid = Number(formData.serviceCharge) || 0
    const totalInitialReceived = rentPaid + foodPaid + advPaid + svcPaid
    
    if (formData.type === 'new' && totalInitialReceived > 0 && !formData.receiver) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a receiver for the initial payment." })
      return
    }

    setIsSubmitting(true)
    try {
      const studentId = doc(collection(db, "students")).id
      const studentRef = doc(db, "students", studentId)
      const monthlyRent = Number(formData.monthlyRent)
      const apartmentName = selectedRoom?.aptName || "General"

      // Handle Dues Calculation based on method
      let startingRentDue = 0
      if (formData.type === 'old') {
        if (formData.dueInputMethod === 'total') {
          startingRentDue = Number(formData.dueAmount) || 0
        } else {
          startingRentDue = monthlyDues.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
        }
      } else {
        startingRentDue = Number(formData.dueAmount) || 0
      }

      const startingFoodDue = Number(formData.foodDueAmount) || 0

      let detailsArr = []
      if (rentPaid > 0) detailsArr.push(`Rent: ৳${rentPaid}`)
      if (foodPaid > 0) detailsArr.push(`Food: ৳${foodPaid}`)
      if (advPaid > 0) detailsArr.push(`Advance: ৳${advPaid}`)
      if (svcPaid > 0) detailsArr.push(`Service: ৳${svcPaid}`)
      
      const isOld = formData.type === 'old'
      const prefix = isOld ? "[Historical Data] " : "Initial payment: "
      const detailedDescription = `${prefix}${detailsArr.join(', ')}`

      const paymentRecord = totalInitialReceived > 0 ? {
        amount: totalInitialReceived,
        seatAmount: rentPaid,
        foodAmount: foodPaid,
        advanceAmount: advPaid,
        serviceCharge: svcPaid,
        buildingId: formData.buildingId,
        buildingName: selectedBuilding?.name || "Unknown",
        studentName: formData.name,
        studentId: studentId,
        roomNumber: formData.roomNumber,
        branch: userBranch,
        type: "income",
        month: new Date().toLocaleString('default', { month: 'long' }),
        year: new Date().getFullYear().toString(),
        method: isOld ? "historical_import" : formData.method,
        receiver: isOld ? "System (Data Import)" : formData.receiver,
        description: detailedDescription,
        date: new Date().toISOString()
      } : null

      if (paymentRecord && formData.type === 'new') {
        const pId = doc(collection(db, "payments")).id
        await setDoc(doc(db, "payments", pId), {
          ...paymentRecord,
          id: pId,
          date: serverTimestamp(),
          createdAt: serverTimestamp(),
        })
      }

      await setDoc(studentRef, {
        ...formData,
        id: studentId,
        branch: userBranch,
        dueAmount: startingRentDue,
        foodDueAmount: startingFoodDue,
        advanceAmount: advPaid,
        serviceCharge: svcPaid,
        monthlyRent: monthlyRent,
        apartmentName: apartmentName,
        buildingName: selectedBuilding?.name || "Unknown",
        isActive: true,
        paymentsHistory: paymentRecord ? [paymentRecord] : [],
        mealsHistory: [],
        historicalDuesBreakdown: formData.dueInputMethod === 'breakdown' ? monthlyDues : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      const buildingRef = doc(db, "buildings", formData.buildingId)
      const updatedApts = selectedBuilding.apartmentsDetail.map((apt: any) => {
        if (apt.name === apartmentName) {
          return {
            ...apt,
            rooms: apt.rooms.map((room: any) => {
              if (room.roomNo === formData.roomNumber) {
                return {
                  ...room,
                  seats: room.seats.map((seat: any) => {
                    if (seat.seatNo === formData.seatNumber) return { ...seat, status: 'occupied' }
                    return seat
                  })
                }
              }
              return room
            })
          }
        }
        return apt
      })

      await updateDoc(buildingRef, {
        apartmentsDetail: updatedApts,
        occupiedSeats: increment(1),
        emptySeats: increment(-1),
        updatedAt: serverTimestamp()
      })

      toast({ title: "Registered", description: isOld ? "Historical resident data imported." : "New resident registered successfully." })
      setOpen(false)
      setFormData({
        name: "", phone: "", parentPhone: "", address: "", buildingId: "", roomNumber: "", seatNumber: "",
        type: "new", dueAmount: "0", foodDueAmount: "0", initialRentPayment: "0", initialFoodPayment: "0", advanceAmount: "0", serviceCharge: "0",
        paymentSystem: "package", monthlyRent: "", foodCost: "0", receiver: "", method: "cash",
        billingStartDate: new Date().toISOString().split('T')[0],
        dueInputMethod: "total"
      })
      setMonthlyDues([])
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredStudents = useMemo(() => {
    if (!students) return []
    return students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || "").includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesRoom = roomFilter === "all" || s.roomNumber === roomFilter
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      const matchesPlan = planFilter === "all" || s.paymentSystem === planFilter
      return matchesSearch && matchesBuilding && matchesRoom && matchesStatus && matchesPlan
    })
  }, [students, searchTerm, buildingFilter, roomFilter, statusFilter, planFilter])

  const handleExportCSV = () => {
    const reportData = filteredStudents.map(s => {
      const billingStart = s.billingStartDate ? new Date(s.billingStartDate) : (s.createdAt?.toDate?.() || new Date())
      const now = new Date()
      const endDate = s.isActive ? now : (s.leftAt?.toDate?.() || now)
      const monthsElapsed = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth())
      const historicalRentDue = Number(s.dueAmount) || 0
      const generatedRent = (monthsElapsed > 0 ? monthsElapsed : 0) * (s.monthlyRent || 0)
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
      const latestMeal = s.mealsHistory && s.mealsHistory.length > 0 ? s.mealsHistory[s.mealsHistory.length - 1] : {}

      return { ...s, rentDue, foodBalance, totalMeals: latestMeal.totalMeals || 0, mealRate: latestMeal.perMealCost || 0, mealTotalCost: latestMeal.totalCost || 0 }
    })

    const headers = ["Resident Name", "Phone", "Parent Phone", "Building", "Room", "Seat", "Status", "Plan", "Monthly Rent", "Advance Balance", "Current Rent Due", "Food Balance (Credit/Due)", "Meals (Last Entry)", "Meal Rate", "Meal Cost", "Address"]
    const rows = reportData.map(s => [s.name, s.phone || "N/A", s.parentPhone || "N/A", s.buildingName, s.roomNumber, s.seatNumber, s.isActive ? "Active" : "Left", s.paymentSystem.toUpperCase(), s.monthlyRent, s.advanceAmount || 0, s.rentDue, s.foodBalance >= 0 ? `Credit: ৳${s.foodBalance}` : `Due: ৳${Math.abs(s.foodBalance)}`, s.totalMeals, s.mealRate, s.mealTotalCost, `"${s.address?.replace(/"/g, '""') || ""}"`])

    let csvContent = "data:text/csv;charset=utf-8,SOMIKORON DETAILED RESIDENT REPORT\n"
    csvContent += `Generated on: ${new Date().toLocaleString()}\nFilters - Branch: ${userBranch}, Building: ${buildingFilter}\n\n` + headers.join(",") + "\n"
    rows.forEach(row => { csvContent += row.join(",") + "\n" })
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", `Residents_${userBranch}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Residents</h1>
            <p className="text-muted-foreground mt-1">Manage occupants for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" className="gap-2"><Download size={16} /> Export / Share</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer"><FileSpreadsheet size={14} className="mr-2" /> Export CSV (Full Detail)</DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint} className="cursor-pointer"><FileText size={14} className="mr-2" /> Download PDF (Print)</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer"><Share2 size={14} className="mr-2" /> Share List</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus size={18} /> Register Student</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyDown}>
              <DialogHeader><DialogTitle>Register Resident</DialogTitle></DialogHeader>
              <div className="space-y-6 py-4">
                
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
                  <Label className="font-bold text-primary">Billing & Food Plan</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <Label>Payment System</Label>
                       <Select value={formData.paymentSystem} onValueChange={val => setFormData({...formData, paymentSystem: val})}>
                         <SelectTrigger><SelectValue /></SelectTrigger>
                         <SelectContent>
                           <SelectItem value="package">Package Plan (Fixed All-in)</SelectItem>
                           <SelectItem value="non-package">Non-Package (Separate Rent & Food)</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-2">
                       <Label>{formData.paymentSystem === 'package' ? 'Monthly Package Rate (৳)' : 'Monthly Seat Rent (৳)'}</Label>
                       <Input type="number" value={formData.monthlyRent} onChange={e => setFormData({...formData, monthlyRent: e.target.value})} placeholder="0.00" />
                     </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Calendar size={14} className="text-primary"/> Billing Start Date (Hostel Entry Date)</Label>
                    <Input type="date" value={formData.billingStartDate} onChange={e => setFormData({...formData, billingStartDate: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Student Name</Label><Input placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Student Phone</Label><Input placeholder="11 Digit Mobile Number" maxLength={11} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-secondary/20 rounded-lg border">
                   <div className="space-y-1">
                      <Label className="text-[10px] font-bold">Branch</Label>
                      <div className="h-9 flex items-center px-3 bg-white rounded border text-xs font-bold text-primary">{userBranch}</div>
                   </div>
                   <div className="space-y-1">
                      <Label className="text-[10px] font-bold flex items-center gap-1"><DoorOpen size={10}/> Room No.</Label>
                      <Select disabled={!formData.buildingId} onValueChange={val => setFormData({...formData, roomNumber: val, seatNumber: ""})}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{allRoomsInSelectedBuilding.map((r: any) => <SelectItem key={r.roomNo} value={r.roomNo}>Room {r.roomNo}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-1">
                      <Label className="text-[10px] font-bold">Seat</Label>
                      <Select disabled={!formData.roomNumber} onValueChange={val => setFormData({...formData, seatNumber: val})}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{emptySeats.map((s: any) => <SelectItem key={s.seatNo} value={s.seatNo}>Seat {s.seatNo}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
                  <Label className="font-bold text-success">Initial Payments & Fees</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Rent Payment (৳)</Label><Input type="number" value={formData.initialRentPayment} onChange={e => setFormData({...formData, initialRentPayment: e.target.value})} placeholder="0.00" /></div>
                    <div className="space-y-2"><Label>Payment Receiver</Label><Select value={formData.receiver} onValueChange={val => setFormData({...formData, receiver: val})}><SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleRegister} className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin"/> : "Register Resident"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 bg-secondary/20 p-4 rounded-xl border items-end print:hidden">
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Search size={10} /> Search Resident</Label><Input placeholder="Name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Building2 size={10} /> Building</Label><Select value={buildingFilter} onValueChange={val => { setBuildingFilter(val); setRoomFilter("all") }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><DoorOpen size={10} /> Room</Label><Select value={roomFilter} onValueChange={setRoomFilter} disabled={buildingFilter === "all"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Rooms</SelectItem>{roomOptions.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="active">Active Only</SelectItem><SelectItem value="left">Ex-Residents</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Plan</Label><Select value={planFilter} onValueChange={setPlanFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Plans</SelectItem><SelectItem value="package">Package Only</SelectItem><SelectItem value="non-package">Non-Package</SelectItem></SelectContent></Select></div>
        <Button variant="ghost" className="h-10" onClick={() => { setSearchTerm(""); setBuildingFilter("all"); setRoomFilter("all"); setStatusFilter("active"); setPlanFilter("all") }}><XCircle size={14} className="mr-1" /> Reset</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden print:shadow-none print:border">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right print:hidden">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((s: any) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/students/${s.id}`)}>
                    <TableCell><div className="flex items-center gap-3"><UserCircle size={32} className="text-primary/40 print:hidden" /><div className="flex flex-col"><span className="font-bold">{s.name}</span><span className="text-[10px] text-muted-foreground">{s.phone}</span></div></div></TableCell>
                    <TableCell><div className="flex flex-col"><span className="text-sm font-medium">{s.buildingName}</span><span className="text-[10px] text-muted-foreground">Room {s.roomNumber} | Seat {s.seatNumber}</span></div></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{s.paymentSystem}</Badge></TableCell>
                    <TableCell><Badge variant={s.isActive ? "default" : "secondary"} className={s.isActive ? "bg-success text-white" : ""}>{s.isActive ? "Active" : "Left"}</Badge></TableCell>
                    <TableCell className="text-right print:hidden" onClick={(e) => e.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical size={16} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={() => router.push(`/students/${s.id}`)} className="cursor-pointer gap-2"><Eye size={14} /> View Profile</DropdownMenuItem><DropdownMenuItem onClick={() => router.push(`/students/${s.id}?action=payment`)} className="cursor-pointer gap-2"><Wallet size={14} className="text-success" /> Process Payment</DropdownMenuItem>{s.paymentSystem === 'non-package' && (<DropdownMenuItem onClick={() => router.push(`/students/${s.id}?action=meals`)} className="cursor-pointer gap-2"><Utensils size={14} className="text-primary" /> Log Meals</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></TableCell>
                  </TableRow>
                ))}
                {filteredStudents.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No students found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
