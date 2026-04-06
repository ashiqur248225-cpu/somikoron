
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
import { Wallet, Info, Loader2, Building2, Plus, Search, Filter, HandCoins, CreditCard, LayoutGrid, XCircle, UserCheck, Calendar, DoorOpen, FileSpreadsheet, Printer, Download, Calculator, ArrowUpCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, increment, updateDoc, arrayUnion, query, limit, where, getDoc } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ReceiptDialog } from "@/components/receipt-dialog"
import { sendSMS } from "@/app/actions/sms"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const formatCompactDate = (date: any) => {
  if (!date) return 'N/A'
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function IncomeHistoryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  
  // App Context
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")

  // Filtering States
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [receiverFilter, setReceiverFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  
  // UI States
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Receipt Modal Logic
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [lastPayment, setLastPayment] = useState<any>(null)
  const [targetStudent, setTargetStudent] = useState<any>(null)

  // Entry Form Specific Filters
  const [entryBuildingFilter, setEntryBuildingFilter] = useState("all")
  const [entryRoomFilter, setEntryRoomFilter] = useState("all")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    setUserRole(localStorage.getItem("user_role") || "Manager")
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
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "students"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: students } = useCollection(studentsQuery)

  const staffQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "staff"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: staffList } = useCollection(staffQuery)

  const incomeQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "payments"), where("branch", "==", userBranch), limit(1000))
  }, [db, userBranch])
  const { data: rawPayments, isLoading: paymentsLoading } = useCollection(incomeQuery)

  // API Config Logic for SMS
  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: apiConfig } = useDoc(apiConfigRef)

  // SMS Template Logic
  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)

  const logSMSToDatabase = async (to: string, msg: string, status: 'Success' | 'Failed', errorMsg?: string) => {
    try {
      const logId = doc(collection(db, "smsLogs")).id
      await setDoc(doc(db, "smsLogs", logId), {
        id: logId,
        to,
        message: msg,
        status,
        error: errorMsg || null,
        branch: userBranch,
        sentBy: userName,
        createdAt: serverTimestamp()
      })
    } catch (e) {}
  }

  // Advanced Filtering Logic
  const filteredPayments = useMemo(() => {
    if (!rawPayments) return []
    return rawPayments.filter(p => {
      const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date)
      const matchesStartDate = !startDate || pDate >= new Date(startDate)
      const matchesEndDate = !endDate || pDate <= new Date(new Date(endDate).setHours(23, 59, 59))
      
      const matchesBuilding = buildingFilter === "all" || p.buildingId === buildingFilter
      const matchesRoom = roomFilter === "all" || p.roomNumber === roomFilter
      const matchesMethod = methodFilter === "all" || p.method === methodFilter
      const matchesReceiver = receiverFilter === "all" || p.receiver === receiverFilter
      
      return matchesStartDate && matchesEndDate && matchesBuilding && matchesRoom && matchesMethod && matchesReceiver
    }).sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date)
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date)
      return dateB.getTime() - dateA.getTime()
    })
  }, [rawPayments, startDate, endDate, buildingFilter, roomFilter, methodFilter, receiverFilter])

  const stats = useMemo(() => {
    const total = filteredPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    return { total, count: filteredPayments.length }
  }, [filteredPayments])

  const availableRoomsForFilter = useMemo(() => {
    if (!buildings) return []
    let rooms: string[] = []
    buildings.forEach(b => {
      if (buildingFilter === "all" || b.id === buildingFilter) {
        b.apartmentsDetail?.forEach((apt: any) => {
          apt.rooms?.forEach((room: any) => {
            if (room.roomNo && !rooms.includes(room.roomNo)) rooms.push(room.roomNo)
          })
        })
      }
    })
    return rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [buildings, buildingFilter])

  // Entry Modal Logic
  const availableRoomsForEntry = useMemo(() => {
    if (!buildings) return []
    let rooms: string[] = []
    buildings.forEach(b => {
      if (entryBuildingFilter === "all" || b.id === entryBuildingFilter) {
        b.apartmentsDetail?.forEach((apt: any) => {
          apt.rooms?.forEach((room: any) => {
            if (room.roomNo && !rooms.includes(room.roomNo)) rooms.push(room.roomNo)
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

  const selectedStudent = useMemo(() => students?.find(s => s.id === formData.studentId), [students, formData.studentId])

  const handleCreatePayment = async () => {
    if (!formData.studentId || !formData.receiver || !selectedStudent) return
    setIsSubmitting(true)
    try {
      const pId = doc(collection(db, "payments")).id
      const seatPaid = selectedStudent.paymentSystem === 'package' ? Number(formData.amount) : Number(formData.seatAmount)
      const foodPaid = selectedStudent.paymentSystem === 'non-package' ? Number(formData.foodAmount) : 0
      const totalAmt = seatPaid + foodPaid + Number(formData.addAdvanceAmount)
      
      const pRecord = {
        id: pId, amount: totalAmt, 
        seatAmount: seatPaid,
        foodAmount: foodPaid, advanceAmount: Number(formData.addAdvanceAmount),
        studentName: selectedStudent.name, studentId: selectedStudent.id, buildingId: selectedStudent.buildingId,
        buildingName: selectedStudent.buildingName, roomNumber: selectedStudent.roomNumber, branch: userBranch,
        type: "income", month: formData.month, year: formData.year, method: formData.method, receiver: formData.receiver,
        description: formData.description, date: new Date().toISOString()
      }

      if (userRole === 'Building Manager') {
        const reqId = doc(collection(db, "managerRequests")).id
        await setDoc(doc(db, "managerRequests", reqId), { ...pRecord, id: reqId, requestType: "income", requestedBy: localStorage.getItem("somikoron_auth_id"), requestedByName: userName, createdAt: serverTimestamp() })
        toast({ title: "Request Sent", description: "Payment is waiting for approval." })
      } else {
        await setDoc(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp(), createdAt: serverTimestamp() })
        
        // Calculate totals for SMS mapping
        const billingStart = selectedStudent.billingStartDate ? new Date(selectedStudent.billingStartDate) : (selectedStudent.createdAt?.toDate?.() || new Date())
        const now = new Date()
        const monthsElapsed = (now.getFullYear() - billingStart.getFullYear()) * 12 + (now.getMonth() - billingStart.getMonth())
        const generatedRent = (monthsElapsed >= 0 ? monthsElapsed + 1 : 0) * (selectedStudent.monthlyRent || 0)
        
        const totalRentPaidPrev = selectedStudent.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.seatAmount || (selectedStudent.paymentSystem === 'package' ? curr.amount : 0)), 0) || 0
        const historicalRentDue = selectedStudent.duesBreakdown ? Object.values(selectedStudent.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
        const rentDueAfter = Math.max(0, (historicalRentDue + generatedRent) - (totalRentPaidPrev + seatPaid))

        const historicalFoodDue = Number(selectedStudent.foodDueAmount) || 0
        const generatedFoodCost = selectedStudent.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
        const totalFoodPaidPrev = selectedStudent.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.foodAmount || (selectedStudent.paymentSystem === 'non-package' ? curr.amount : 0)), 0) || 0
        const foodBalanceAfter = (totalFoodPaidPrev + foodPaid) - (historicalFoodDue + generatedFoodCost)
        
        const totalPayableAfter = rentDueAfter + Math.max(0, -foodBalanceAfter)

        // CRITICAL FIX: Removed serverTimestamp() from arrayUnion
        await updateDoc(doc(db, "students", selectedStudent.id), {
          paymentsHistory: arrayUnion(pRecord),
          advanceAmount: increment(Number(formData.addAdvanceAmount)),
          updatedAt: serverTimestamp()
        })
        
        // Dynamic SMS Mapping
        if (apiConfig?.apikey && templatesData?.templates) {
          const paymentTemplate = templatesData.templates.find((t: any) => t.id === 'payment')
          if (paymentTemplate) {
            const hostelDisplayName = templatesData.hostelName || userBranch;
            let msg = paymentTemplate.text
              .replaceAll('[নাম]', selectedStudent.name)
              .replaceAll('[পরিমাণ]', totalAmt.toString())
              .replaceAll('[বকেয়া]', totalPayableAfter.toString())
              .replaceAll('[total_payable]', totalPayableAfter.toString())
              .replaceAll('[food_balance]', Math.max(0, foodBalanceAfter).toString())
              .replaceAll('[food_due]', Math.max(0, -foodBalanceAfter).toString())
              .replaceAll('[মাস]', formData.month)
              .replaceAll('[খাত]', selectedStudent.paymentSystem === 'package' ? 'প্যাকেজ ভাড়া' : 'ভাড়া/খাবার')
              .replaceAll('[Hostel Name]', hostelDisplayName);
            
            const result = await sendSMS(apiConfig.apikey, apiConfig.senderid, selectedStudent.phone, msg);
            await logSMSToDatabase(selectedStudent.phone, msg, result.error === 0 ? 'Success' : 'Failed', result.error !== 0 ? result.msg : undefined)
            
            if (result.error === 0) {
              toast({ title: "SMS Sent", description: `মেসেজ: ${msg.substring(0, 50)}...` })
            } else if (result.error === 417) {
              toast({ variant: "destructive", title: "ব্যালেন্স নেই", description: "আপনার পর্যাপ্ত ব্যালেন্স নেই, দয়া করে রিচার্জ করুন।" })
            } else {
              toast({ variant: "destructive", title: "SMS Failed", description: result.msg })
            }
          }
        }
        
        toast({ title: "Success", description: "Payment recorded." })
        
        // Trigger Receipt
        setLastPayment({ ...pRecord, date: new Date() })
        setTargetStudent({ ...selectedStudent, totalDue: totalPayableAfter })
        setIsReceiptOpen(true)
      }
      setIsEntryOpen(false)
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message })
    }
    finally { setIsSubmitting(false) }
  }

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Income</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Receipts for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Download PDF</span></Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      <ReceiptDialog 
        isOpen={isReceiptOpen} 
        onClose={() => setIsReceiptOpen(false)} 
        payment={lastPayment} 
        student={targetStudent}
      />

      {/* GLOBAL FILTER BAR (Desktop) */}
      <div className="hidden md:flex bg-secondary/20 p-4 rounded-xl border items-end gap-4 print:hidden">
        <div className="w-[150px] space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Building</Label>
          <Select value={buildingFilter} onValueChange={val => { setBuildingFilter(val); setRoomFilter("all"); }}>
            <SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[120px] space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Room</Label>
          <Select value={roomFilter} onValueChange={setRoomFilter}>
            <SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {availableRoomsForFilter.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[180px] space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Received By</Label>
          <Select value={receiverFilter} onValueChange={setReceiverFilter}>
            <SelectTrigger className="bg-white h-10"><SelectValue placeholder="All Staff" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[150px] space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Method</Label>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[280px] space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Date Range</Label>
          <div className="flex gap-2">
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 bg-white" />
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 bg-white" />
          </div>
        </div>
        <Button variant="ghost" className="h-10 text-xs font-bold uppercase" onClick={() => { setBuildingFilter("all"); setRoomFilter("all"); setMethodFilter("all"); setReceiverFilter("all"); setStartDate(""); setEndDate(""); }}>Reset</Button>
      </div>

      <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden print:hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-xs font-bold uppercase text-success">Total Filtered Income</CardTitle><ArrowUpCircle className="h-4 w-4 text-success" /></CardHeader>
        <CardContent><div className="text-3xl font-black text-slate-900">৳{stats.total.toLocaleString()}</div><p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Found {stats.count} matching records</p></CardContent>
      </Card>

      {paymentsLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW */}
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl print:hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Location</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-bold text-slate-500">{formatCompactDate(p.date)}</TableCell>
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

          {/* MOBILE CARD VIEW */}
          <div className="md:hidden space-y-4 print:hidden">
            {filteredPayments.map((p: any) => (
              <Card key={p.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div><p className="text-[10px] font-bold text-muted-foreground uppercase">{formatCompactDate(p.date)}</p><h3 className="font-black text-slate-800 text-lg mt-1">{p.studentName}</h3></div>
                    <Badge variant="outline" className="uppercase font-bold text-[9px]">{p.method}</Badge>
                  </div>
                  <div className="bg-secondary/30 p-3 rounded-xl border border-secondary flex justify-between items-center">
                    <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase">Location</p><p className="text-xs font-bold text-slate-700">{p.buildingName} • R-{p.roomNumber}</p></div>
                    <div className="text-right"><p className="text-[10px] font-bold text-muted-foreground uppercase">Collected</p><p className="text-xl font-black text-income">৳{p.amount?.toLocaleString()}</p></div>
                  </div>
                  <div className="text-[10px] text-muted-foreground italic flex items-center gap-1.5"><UserCheck size={12} className="text-primary"/><span>Received by <b>{p.receiver}</b></span></div>
                </CardContent>
              </Card>
            ))}
            {filteredPayments.length === 0 && <div className="text-center py-12 text-muted-foreground italic text-sm">No entries found.</div>}
          </div>
        </>
      )}

      {/* FIXED ACTION BUTTON */}
      <div className="fixed bottom-8 right-8 z-50 print:hidden">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-income"><Plus size={32} className="text-white" /></Button>
      </div>

      {/* NEW INCOME DIALOG */}
      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Income Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/30 rounded-xl border">
              <div className="space-y-1"><Label className="text-[10px] font-bold">Building</Label><Select value={entryBuildingFilter} onValueChange={val => { setEntryBuildingFilter(val); setEntryRoomFilter("all"); }}><SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[10px] font-bold">Room</Label><Select value={entryRoomFilter} onValueChange={setEntryRoomFilter}><SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{availableRoomsForEntry.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Select Resident</Label><Select value={formData.studentId} onValueChange={val => setFormData({...formData, studentId: val})}><SelectTrigger><SelectValue placeholder="Choose student" /></SelectTrigger><SelectContent>{filteredStudentsForEntry.map(s => <SelectItem key={s.id} value={s.id}>{s.name} (R-{s.roomNumber})</SelectItem>)}</SelectContent></Select></div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Month</Label><Select value={formData.month} onValueChange={v => setFormData({...formData, month: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Year</Label><Select value={formData.year} onValueChange={v => setFormData({...formData, year: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{"2024,2025,2026".split(',').map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="p-4 border-2 border-primary/20 rounded-xl space-y-4 bg-primary/5">
              <Label className="font-bold text-primary flex items-center gap-2"><Calculator size={14} /> Collection Amounts</Label>
              {selectedStudent?.paymentSystem === 'package' ? (
                <div className="space-y-2">
                  <Label className="text-xs">Amount Received (৳)</Label>
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
              <div className="space-y-2"><Label>Method</Label><Select value={formData.method} onValueChange={v => setFormData({...formData, method: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Receiver</Label><Select value={formData.receiver} onValueChange={v => setFormData({...formData, receiver: v})}><SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Notes..." />
          </div>
          <DialogFooter><Button onClick={handleCreatePayment} disabled={isSubmitting} className="w-full h-12 text-lg font-bold">{isSubmitting ? <Loader2 className="animate-spin" /> : "Confirm & Save Receipt"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
