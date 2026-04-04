
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Wallet, Info, Loader2, Building2, Plus, Search, Filter, HandCoins, CreditCard, LayoutGrid, XCircle, UserCheck, Calendar, DoorOpen, FileSpreadsheet, Printer, Download, Share2, FileText, BellRing, ShieldAlert, Calculator, AlertCircle, ArrowUpRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, increment, updateDoc, arrayUnion, query, orderBy, limit, where } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function IncomeHistoryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  
  // User Context
  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")

  // Filter State
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [roomFilter, setRoomFilter] = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  const [residentStatusFilter, setResidentStatusFilter] = useState("all")

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("")

  useEffect(() => {
    const role = localStorage.getItem("user_role") || "Manager"
    const branch = localStorage.getItem("user_branch") || "Main Branch"
    const name = localStorage.getItem("user_name") || "User"
    const assignedId = localStorage.getItem("assigned_building_id") || "none"

    setUserRole(role)
    setUserBranch(branch)
    setUserName(name)
    setAssignedBuildingId(assignedId)

    if (role === 'Building Manager' && assignedId !== 'none') {
      setSelectedBuildingId(assignedId)
      setBuildingFilter(assignedId)
    }
  }, [])

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

  // Queries
  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "buildings"), where("id", "==", assignedBuildingId))
    }
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId])
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

  const incomeQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "payments"), where("buildingId", "==", assignedBuildingId), limit(500))
    }
    return query(collection(db, "payments"), where("branch", "==", userBranch), limit(500))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: rawPayments, isLoading: paymentsLoading } = useCollection(incomeQuery)

  const payments = useMemo(() => {
    if (!rawPayments) return []
    return [...rawPayments].sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date)
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date)
      return dateB.getTime() - dateA.getTime()
    })
  }, [rawPayments])

  const filteredPayments = useMemo(() => {
    if (!payments) return []
    return payments.filter(p => {
      const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date)
      const matchesStartDate = !startDate || pDate >= new Date(startDate)
      const matchesEndDate = !endDate || pDate <= new Date(new Date(endDate).setHours(23, 59, 59))
      const matchesBuilding = buildingFilter === "all" || p.buildingId === buildingFilter
      const matchesMethod = methodFilter === "all" || p.method === methodFilter
      const matchesSearch = p.studentName?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesRoom = !roomFilter || (p.roomNumber || "").toLowerCase().includes(roomFilter.toLowerCase())
      
      const student = students?.find(s => s.id === p.studentId)
      const matchesPlan = planFilter === "all" || (student?.paymentSystem === planFilter)
      const matchesResidentStatus = residentStatusFilter === "all" 
        ? true 
        : (residentStatusFilter === "active" ? student?.isActive : !student?.isActive)

      return matchesStartDate && matchesEndDate && matchesBuilding && matchesMethod && matchesSearch && matchesRoom && matchesPlan && matchesResidentStatus
    })
  }, [payments, students, startDate, endDate, buildingFilter, methodFilter, searchTerm, roomFilter, planFilter, residentStatusFilter])

  const handleCreatePayment = async () => {
    if (!formData.studentId || !formData.receiver) {
      toast({ variant: "destructive", title: "Error", description: "Select student and receiver." })
      return
    }

    const student = students?.find(s => s.id === formData.studentId)
    if (!student) return

    const seatPaid = student.paymentSystem === 'package' ? Number(formData.amount) : Number(formData.seatAmount)
    const foodPaid = student.paymentSystem === 'non-package' ? Number(formData.foodAmount) : 0
    const addAdvance = Number(formData.addAdvanceAmount)
    const totalCashAmount = seatPaid + foodPaid + addAdvance

    if (totalCashAmount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Payment amount must be greater than zero." })
      return
    }

    setIsSubmitting(true)
    try {
      const pId = doc(collection(db, "payments")).id
      const pRecord = {
        id: pId,
        amount: totalCashAmount,
        seatAmount: seatPaid,
        foodAmount: foodPaid,
        advanceAmount: addAdvance,
        buildingId: student.buildingId,
        buildingName: student.buildingName,
        studentName: student.name,
        studentId: student.id,
        roomNumber: student.roomNumber,
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

      // Update student document
      const studentRef = doc(db, "students", student.id)
      const mKey = `${formData.month} ${formData.year}`
      const currentMap = student.duesBreakdown || {}
      
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

      toast({ title: "Payment Recorded", description: `Amount ৳${totalCashAmount} collected from ${student.name}.` })
      setIsEntryOpen(false)
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

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  const selectedStudentForEntry = students?.find(s => s.id === formData.studentId)

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Income History</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Receipts for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Download size={16} /> <span className="hidden sm:inline">Export</span></Button>
          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">{userName ? userName.substring(0, 2) : "U"}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      <div className="bg-secondary/20 p-4 rounded-xl border space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Search size={10}/> Student Name</Label>
            <Input placeholder="Search..." className="bg-white h-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Building2 size={10}/> Building</Label>
            <Select value={buildingFilter} onValueChange={setBuildingFilter}>
              <SelectTrigger className="bg-white h-10"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buildings</SelectItem>
                {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><DoorOpen size={10}/> Room No.</Label>
            <Input placeholder="e.g. 301" className="bg-white h-10" value={roomFilter} onChange={e => setRoomFilter(e.target.value)} />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Payment Plan</Label>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="package">Package Plan</SelectItem>
                <SelectItem value="non-package">Non-Package</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Resident Status</Label>
            <Select value={residentStatusFilter} onValueChange={setResidentStatusFilter}>
              <SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="active">Active Residents</SelectItem>
                <SelectItem value="left">Left Residents</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Method</Label>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bkash">Bkash</SelectItem>
                <SelectItem value="nagad">Nagad</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" className="h-10 font-bold uppercase text-xs" onClick={() => { 
            setSearchTerm(""); 
            setBuildingFilter("all"); 
            setMethodFilter("all"); 
            setRoomFilter(""); 
            setPlanFilter("all"); 
            setResidentStatusFilter("all");
          }}>
            <XCircle size={14} className="mr-1" /> Reset
          </Button>
        </div>
      </div>

      {paymentsLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* Table for Desktop */}
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-bold text-slate-500">{p.date?.toDate ? p.date.toDate().toLocaleDateString() : 'Processing'}</TableCell>
                      <TableCell className="font-black text-slate-800">{p.studentName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.buildingName} • R-{p.roomNumber}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{p.method}</Badge></TableCell>
                      <TableCell className="text-right font-black text-income">৳{p.amount?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cards for Mobile */}
          <div className="md:hidden space-y-4">
            {filteredPayments.map((p: any) => (
              <Card key={p.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="font-black text-slate-800 text-lg leading-tight">{p.studentName}</h3>
                      <p className="text-xs font-bold text-slate-400">{p.date?.toDate ? p.date.toDate().toLocaleDateString() : 'Processing'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-income flex items-center gap-1 justify-end">
                        <ArrowUpRight size={14} /> ৳{p.amount?.toLocaleString()}
                      </p>
                      <Badge variant="secondary" className="text-[8px] uppercase mt-1 px-1 font-bold">{p.method}</Badge>
                    </div>
                  </div>
                  <Separator className="opacity-50" />
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <Building2 size={10} /> {p.buildingName} • R-{p.roomNumber}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredPayments.length === 0 && <div className="text-center py-12 text-muted-foreground italic">No income records found.</div>}
          </div>
        </>
      )}

      {/* FAB */}
      <div className="fixed bottom-8 right-8 z-50 print:hidden">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-income hover:scale-105 transition-transform">
          <Plus size={32} className="text-white" />
        </Button>
      </div>

      {/* Entry Dialog */}
      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Income Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Resident</Label>
              <Select value={formData.studentId} onValueChange={val => setFormData({...formData, studentId: val})}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students?.filter(s => s.isActive).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} (R-{s.roomNumber})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedStudentForEntry && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Monthly Rent:</span>
                  <span className="font-bold">৳{selectedStudentForEntry.monthlyRent}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Payment Plan:</span>
                  <Badge variant="outline" className="text-[8px] h-4 uppercase">{selectedStudentForEntry.paymentSystem}</Badge>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Month</Label>
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
              <Label className="font-bold text-primary flex items-center gap-2"><Calculator size={14} /> Payment Amounts</Label>
              {selectedStudentForEntry?.paymentSystem === 'package' ? (
                <div className="space-y-2">
                  <Label className="text-xs">Amount Received (৳)</Label>
                  <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-xs">Seat Rent (৳)</Label><Input type="number" value={formData.seatAmount} onChange={e => setFormData({...formData, seatAmount: e.target.value})} placeholder="0.00" /></div>
                  <div className="space-y-2"><Label className="text-xs">Food Credit (৳)</Label><Input type="number" value={formData.foodAmount} onChange={e => setFormData({...formData, foodAmount: e.target.value})} placeholder="0.00" /></div>
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
                <Label>Receiver</Label>
                <Select value={formData.receiver} onValueChange={val => setFormData({...formData, receiver: val})}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Optional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreatePayment} disabled={isSubmitting} className="w-full h-12 text-lg font-bold">
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirm & Save Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
