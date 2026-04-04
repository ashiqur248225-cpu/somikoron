
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
import { Wallet, Info, Loader2, Building2, Plus, Search, Filter, HandCoins, CreditCard, LayoutGrid, XCircle, UserCheck, Calendar, DoorOpen, FileSpreadsheet, Printer, Download, Share2, FileText, BellRing, ShieldAlert, Calculator, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, increment, updateDoc, arrayUnion, query, orderBy, limit, where } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function IncomeHistoryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  
  // User Context
  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")
  const [canRequest, setCanRequest] = useState(true)

  // Filters State
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [receiverFilter, setReceiverFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("")
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string>("")

  useEffect(() => {
    const role = localStorage.getItem("user_role") || "Manager"
    const branch = localStorage.getItem("user_branch") || "Main Branch"
    const assignedId = localStorage.getItem("assigned_building_id") || "none"
    const reqStatus = localStorage.getItem("can_request_income") !== "false"

    setUserRole(role)
    setUserBranch(branch)
    setAssignedBuildingId(assignedId)
    setCanRequest(reqStatus)

    // Auto-select building for Building Manager
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

  // Branch-Filtered Queries
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

  // Sort in-memory
  const payments = useMemo(() => {
    if (!rawPayments) return []
    return [...rawPayments].sort((a, b) => {
      const dateA = a.date?.toDate?.() || new Date(a.date)
      const dateB = b.date?.toDate?.() || new Date(b.date)
      return dateB.getTime() - dateA.getTime()
    })
  }, [rawPayments])

  const selectedBuildingForForm = buildings?.find(b => b.id === selectedBuildingId)
  const roomsInBuildingForForm = useMemo(() => {
    if (!selectedBuildingForForm) return []
    return selectedBuildingForForm.apartmentsDetail?.flatMap((a: any) => 
      a.rooms?.map((r: any) => ({ ...r, aptName: a.name })) || []
    ) || []
  }, [selectedBuildingForForm])
  
  const filteredStudentsForForm = useMemo(() => {
    return students?.filter(s => 
      s.buildingId === selectedBuildingId && 
      s.roomNumber === selectedRoomNumber &&
      s.isActive
    ) || []
  }, [students, selectedBuildingId, selectedRoomNumber])

  const selectedStudent = useMemo(() => students?.find(s => s.id === formData.studentId), [students, formData.studentId])

  // Real-time calculation for the selected student
  const studentFinancials = useMemo(() => {
    if (!selectedStudent) return null
    
    const billingStart = selectedStudent.billingStartDate ? new Date(selectedStudent.billingStartDate) : (selectedStudent.createdAt?.toDate?.() || new Date())
    const now = new Date()
    
    const monthsElapsed = (now.getFullYear() - billingStart.getFullYear()) * 12 + (now.getMonth() - billingStart.getMonth())
    const generatedRent = (monthsElapsed >= 0 ? monthsElapsed + 1 : 0) * (selectedStudent.monthlyRent || 0)
    
    const historicalRentDue = selectedStudent.duesBreakdown ? Object.values(selectedStudent.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
    
    const totalRentPaid = selectedStudent.paymentsHistory?.reduce((acc: number, curr: any) => {
      const isRefund = curr.type === 'refund'
      const rentPortion = (curr.seatAmount !== undefined) ? Number(curr.seatAmount) : (selectedStudent.paymentSystem === 'package' ? Number(curr.amount) : 0)
      return acc + (isRefund ? -rentPortion : rentPortion)
    }, 0) || 0

    const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)
    
    const lockedAdvance = selectedStudent.monthlyRent || 0
    const usableAdvance = Math.max(0, (selectedStudent.advanceAmount || 0) - lockedAdvance)

    return { rentDue, advanceAmount: selectedStudent.advanceAmount || 0, usableAdvance, monthlyRent: selectedStudent.monthlyRent }
  }, [selectedStudent])

  const filteredPayments = useMemo(() => {
    if (!payments) return []
    return payments.filter(p => {
      const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date)
      const matchesStartDate = !startDate || pDate >= new Date(startDate)
      const matchesEndDate = !endDate || pDate <= new Date(new Date(endDate).setHours(23, 59, 59))
      const matchesBuilding = buildingFilter === "all" || p.buildingId === buildingFilter
      const matchesMethod = methodFilter === "all" || p.method === methodFilter
      const matchesReceiver = receiverFilter === "all" || p.receiver === receiverFilter
      const matchesSearch = p.studentName?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = categoryFilter === "all" || 
        (categoryFilter === "rent" && (p.seatAmount || 0) > 0) ||
        (categoryFilter === "food" && (p.foodAmount || 0) > 0) ||
        (categoryFilter === "advance" && (p.advanceAmount || 0) > 0) ||
        (categoryFilter === "service" && (p.serviceCharge || 0) > 0)

      return matchesStartDate && matchesEndDate && matchesBuilding && matchesMethod && matchesReceiver && matchesSearch && matchesCategory
    })
  }, [payments, startDate, endDate, buildingFilter, methodFilter, receiverFilter, categoryFilter, searchTerm])

  const totalFilteredIncome = useMemo(() => filteredPayments.reduce((acc, p) => acc + (p.amount || 0), 0), [filteredPayments])

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.studentId || !selectedRoomNumber || (!formData.receiver && userRole !== 'Building Manager')) {
      toast({ variant: "destructive", title: "Error", description: "Fill all required fields." })
      return
    }

    const seatPaid = selectedStudent?.paymentSystem === 'package' ? Number(formData.amount) : Number(formData.seatAmount)
    const foodPaid = selectedStudent?.paymentSystem === 'non-package' ? Number(formData.foodAmount) : 0
    const addAdvance = Number(formData.addAdvanceAmount)
    const totalAmount = seatPaid + foodPaid + addAdvance

    if (totalAmount <= 0) return

    setIsSubmitting(true)
    const building = selectedBuildingForForm
    
    const recordPayload = {
      amount: totalAmount,
      seatAmount: seatPaid,
      foodAmount: foodPaid,
      advanceAmount: addAdvance,
      buildingId: building?.id,
      buildingName: building?.name,
      studentName: selectedStudent?.name,
      studentId: formData.studentId,
      roomNumber: selectedRoomNumber,
      branch: userBranch,
      month: formData.month,
      year: formData.year,
      method: formData.method,
      receiver: formData.receiver || `Pending (${localStorage.getItem("user_name")})`,
      description: formData.description,
      createdAt: serverTimestamp(),
      requestedBy: localStorage.getItem("somikoron_auth_id") || "system",
      requestedByName: localStorage.getItem("user_name")
    }

    try {
      if (userRole === 'Building Manager') {
        const reqId = doc(collection(db, "managerRequests")).id
        await setDoc(doc(db, "managerRequests", reqId), {
          ...recordPayload,
          id: reqId,
          requestType: 'income'
        })
        toast({ title: "Request Sent", description: "Payment request sent for approval." })
      } else {
        const paymentId = doc(collection(db, "payments")).id
        await setDoc(doc(db, "payments", paymentId), { ...recordPayload, id: paymentId, type: "income", date: serverTimestamp() })
        
        await updateDoc(doc(db, "students", formData.studentId), {
          paymentsHistory: arrayUnion({ ...recordPayload, id: paymentId, type: "income", date: new Date().toISOString() }),
          advanceAmount: increment(addAdvance),
          updatedAt: serverTimestamp()
        })
        toast({ title: "Success", description: "Payment recorded successfully." })
      }

      setIsEntryOpen(false)
      setFormData({ ...formData, studentId: "", amount: "", seatAmount: "", foodAmount: "", addAdvanceAmount: "0", description: "" })
      setSelectedRoomNumber("")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Income History</h1>
            <p className="text-muted-foreground mt-1">Receipts for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" type="button" className="gap-2"><FileSpreadsheet size={16} /> Export CSV</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button className="gap-2"><Download size={16} /> Export / Share</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePrint} className="cursor-pointer"><FileText size={14} className="mr-2" /> Download PDF (Print)</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer"><Share2 size={14} className="mr-2" /> Share Report</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden">
        <Card className="bg-income/5 border-none shadow-sm border-l-4 border-l-income">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-income flex items-center gap-2">
              Total Collections (Filtered)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div><p className="text-3xl font-bold text-income">৳{totalFilteredIncome.toLocaleString()}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {userRole !== 'Building Manager' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9 gap-4 bg-secondary/20 p-4 rounded-xl border items-end print:hidden">
           <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase font-bold">Search</Label><Input placeholder="Name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
           <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase font-bold">From</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
           <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase font-bold">To</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
           <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold">Building</Label>
              <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
           </div>
           <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold">Method</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Methods</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
              </Select>
           </div>
           <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold">Receiver</Label>
              <Select value={receiverFilter} onValueChange={setReceiverFilter}>
                <SelectTrigger><SelectValue placeholder="All Staff" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
           </div>
           <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold">Purpose</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Purposes</SelectItem>
                  <SelectItem value="rent">Seat Rent</SelectItem>
                  <SelectItem value="food">Food Credit</SelectItem>
                  <SelectItem value="advance">Advance</SelectItem>
                  <SelectItem value="service">Service Charge</SelectItem>
                </SelectContent>
              </Select>
           </div>
           <div className="xl:col-span-2">
             <Button variant="ghost" type="button" className="h-10 w-full" onClick={() => { setSearchTerm(""); setStartDate(""); setEndDate(""); setBuildingFilter("all"); setMethodFilter("all"); setReceiverFilter("all"); setCategoryFilter("all"); }}><XCircle size={14} className="mr-1" /> Reset</Button>
           </div>
        </div>
      )}

      <Card className="border-none shadow-sm overflow-hidden print:hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Receiver</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentsLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
              ) : filteredPayments.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{p.date?.toDate ? p.date.toDate().toLocaleDateString() : (p.date ? new Date(p.date).toLocaleDateString() : 'N/A')}</TableCell>
                  <TableCell className="font-medium">{p.studentName}</TableCell>
                  <TableCell><span className="text-[10px] text-muted-foreground">{p.description}</span></TableCell>
                  <TableCell className="text-xs font-medium">{p.receiver || 'N/A'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] uppercase">{p.method}</Badge></TableCell>
                  <TableCell className="text-right font-bold text-income">৳{p.amount?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {filteredPayments.length === 0 && !paymentsLoading && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No income records found for these criteria.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="fixed bottom-8 right-8 z-50 print:hidden flex flex-col gap-2">
        {userRole === 'Building Manager' ? (
          canRequest ? (
            <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-primary hover:scale-105 transition-transform">
              <BellRing size={24} className="text-white" />
            </Button>
          ) : (
            <div className="bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-destructive/20 text-destructive text-[10px] font-bold flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-right-4">
              <ShieldAlert size={14} /> Request Disabled
            </div>
          )
        ) : (
          <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-primary hover:scale-105 transition-transform">
            <Plus size={32} className="text-white" />
          </Button>
        )}
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{userRole === 'Building Manager' ? "Request Income Approval" : "Record Income Entry"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEntrySubmit} className="space-y-4 py-4">
             <div className="p-4 bg-secondary/10 rounded-xl border">
                <div className="space-y-2">
                  <Label>Building</Label>
                  <Select value={selectedBuildingId} onValueChange={(val) => { setSelectedBuildingId(val); setSelectedRoomNumber(""); setFormData({...formData, studentId: ""}) }}>
                    <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                    <SelectContent>
                      {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 mt-3">
                  <Label>Room No.</Label>
                  <Select value={selectedRoomNumber} onValueChange={(val) => { setSelectedRoomNumber(val); setFormData({...formData, studentId: ""}) }}>
                    <SelectTrigger><SelectValue placeholder="Select Room" /></SelectTrigger>
                    <SelectContent>{roomsInBuildingForForm.map((r: any, idx: number) => <SelectItem key={`${r.aptName}-${r.roomNo}-${idx}`} value={r.roomNo}>Room {r.roomNo} ({r.aptName})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 mt-3">
                  <Label>Student</Label>
                  <Select disabled={!selectedRoomNumber} value={formData.studentId} onValueChange={val => setFormData({...formData, studentId: val})}>
                    <SelectTrigger><SelectValue placeholder="Select Student" /></SelectTrigger>
                    <SelectContent>{filteredStudentsForForm.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
             </div>

             {studentFinancials && (
               <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <h4 className="text-[10px] font-bold uppercase text-primary flex items-center gap-1.5"><Calculator size={12}/> Current Status for {selectedStudent?.name}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white p-2 rounded border">
                      <p className="text-[8px] uppercase font-bold text-muted-foreground">Monthly Rent</p>
                      <p className="text-sm font-bold">৳{studentFinancials.monthlyRent}</p>
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <p className="text-[8px] uppercase font-bold text-destructive">Overall Due</p>
                      <p className="text-sm font-bold text-destructive">৳{studentFinancials.rentDue.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <p className="text-[8px] uppercase font-bold text-success">Total Advance</p>
                      <p className="text-sm font-bold text-success">৳{studentFinancials.advanceAmount.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <p className="text-[8px] uppercase font-bold text-primary">Usable Advance</p>
                      <p className="text-sm font-bold text-primary">৳{studentFinancials.usableAdvance.toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="text-[8px] text-muted-foreground italic flex items-center gap-1"><AlertCircle size={8}/> ১ মাসের ভাড়া অগ্রিম হিসেবে লক করা আছে (নিরাপত্তার জন্য)।</p>
               </div>
             )}

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
               {userRole !== 'Building Manager' && (
                 <div className="space-y-2">
                    <Label>Receiver</Label>
                    <Select value={formData.receiver} onValueChange={val => setFormData({...formData, receiver: val})}>
                      <SelectTrigger><SelectValue placeholder="Staff" /></SelectTrigger>
                      <SelectContent>{staffList?.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
               )}
             </div>

             <div className="space-y-2">
               <Label>Amount Received (৳)</Label>
               <Input type="number" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
             </div>

             <Button type="submit" className={cn("w-full h-12 font-bold", userRole === 'Building Manager' ? "bg-orange-500" : "bg-income")} disabled={isSubmitting}>
               {isSubmitting ? <Loader2 className="animate-spin"/> : (userRole === 'Building Manager' ? "Submit Approval Request" : "Confirm Payment")}
             </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
