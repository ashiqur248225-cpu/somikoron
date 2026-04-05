
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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, increment, updateDoc, arrayUnion, query, limit, where } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const formatCompactDate = (date: any) => {
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function IncomeHistoryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  const [entryBuildingFilter, setEntryBuildingFilter] = useState("all")
  const [entryRoomFilter, setEntryRoomFilter] = useState("all")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
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

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const incomeQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "payments"), where("branch", "==", userBranch), limit(1000))
  }, [db, userBranch])
  const { data: rawPayments, isLoading: paymentsLoading } = useCollection(incomeQuery)

  const filteredPayments = useMemo(() => {
    if (!rawPayments) return []
    return rawPayments.filter(p => {
      const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date)
      const matchesStartDate = !startDate || pDate >= new Date(startDate)
      const matchesEndDate = !endDate || pDate <= new Date(new Date(endDate).setHours(23, 59, 59))
      const matchesBuilding = buildingFilter === "all" || p.buildingId === buildingFilter
      const matchesMethod = methodFilter === "all" || p.method === methodFilter
      const matchesSearch = p.studentName?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesStartDate && matchesEndDate && matchesBuilding && matchesMethod && matchesSearch
    }).sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date)
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date)
      return dateB.getTime() - dateA.getTime()
    })
  }, [rawPayments, startDate, endDate, buildingFilter, methodFilter, searchTerm])

  const stats = useMemo(() => {
    const total = filteredPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    return { total, count: filteredPayments.length }
  }, [filteredPayments])

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  const handleExportCSV = () => {
    try {
      const headers = ["Date", "Student Name", "Building & Room", "Method", "Received By", "Amount"];
      const rows = filteredPayments.map(p => [
        formatCompactDate(p.date),
        p.studentName,
        `${p.buildingName} - R${p.roomNumber}`,
        p.method,
        p.receiver,
        p.amount
      ]);
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `income_report_${new Date().getTime()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) { toast({ variant: "destructive", title: "Export Failed" }) }
  }

  const availableRooms = useMemo(() => {
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

  const financialStats = useMemo(() => {
    if (!selectedStudent) return { rentDue: 0, foodBalance: 0, totalDue: 0 }
    const billingStart = selectedStudent.billingStartDate ? new Date(selectedStudent.billingStartDate) : (selectedStudent.createdAt?.toDate?.() || new Date())
    const monthsElapsed = (new Date().getFullYear() - billingStart.getFullYear()) * 12 + (new Date().getMonth() - billingStart.getMonth())
    const generatedRent = (monthsElapsed >= 0 ? monthsElapsed + 1 : 0) * (selectedStudent.monthlyRent || 0)
    const historicalRentDue = selectedStudent.duesBreakdown ? Object.values(selectedStudent.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
    const totalRentPaid = selectedStudent.paymentsHistory?.reduce((acc: number, curr: any) => acc + (curr.seatAmount || 0), 0) || 0
    const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)
    
    const historicalFoodDue = Number(selectedStudent.foodDueAmount) || 0
    const generatedFoodCost = selectedStudent.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
    const totalFoodPaid = selectedStudent.paymentsHistory?.reduce((acc: number, curr: any) => acc + (curr.foodAmount || 0), 0) || 0
    const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)
    return { rentDue, foodBalance, totalDue: rentDue + (foodBalance < 0 ? Math.abs(foodBalance) : 0) }
  }, [selectedStudent])

  const handleCreatePayment = async () => {
    if (!formData.studentId || !formData.receiver || !selectedStudent) return
    setIsSubmitting(true)
    try {
      const pId = doc(collection(db, "payments")).id
      const totalAmt = (selectedStudent.paymentSystem === 'package' ? Number(formData.amount) : Number(formData.seatAmount) + Number(formData.foodAmount)) + Number(formData.addAdvanceAmount)
      const pRecord = {
        id: pId, amount: totalAmt, seatAmount: Number(formData.seatAmount || (selectedStudent.paymentSystem === 'package' ? formData.amount : 0)),
        foodAmount: Number(formData.foodAmount || 0), advanceAmount: Number(formData.addAdvanceAmount),
        studentName: selectedStudent.name, studentId: selectedStudent.id, buildingId: selectedStudent.buildingId,
        buildingName: selectedStudent.buildingName, roomNumber: selectedStudent.roomNumber, branch: userBranch,
        type: "income", month: formData.month, year: formData.year, method: formData.method, receiver: formData.receiver,
        description: formData.description, date: serverTimestamp(), createdAt: serverTimestamp()
      }
      await setDoc(doc(db, "payments", pId), pRecord)
      await updateDoc(doc(db, "students", selectedStudent.id), {
        paymentsHistory: arrayUnion({ ...pRecord, date: new Date().toISOString() }),
        advanceAmount: increment(Number(formData.addAdvanceAmount)),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Success", description: "Payment recorded." })
      setIsEntryOpen(false)
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) }
    finally { setIsSubmitting(false) }
  }

  return (
    <div className="space-y-8 pb-20 print:p-0">
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
          <Button size="sm" variant="outline" className="gap-2" onClick={handleExportCSV}><FileSpreadsheet size={16} /> <span className="hidden sm:inline">Export CSV</span></Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Print</span></Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* Professional Multi-page PDF Structure */}
      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">SOMIKORON HOSTEL</h1>
          <p className="text-sm font-bold">{userBranch} Branch • Official Income Ledger</p>
          <div className="mt-4 border-y py-2 grid grid-cols-2 text-left text-[10pt]">
            <div>
              <p><b>Report Type:</b> Income / Collection</p>
              <p><b>Property:</b> {buildingFilter === 'all' ? 'All Buildings' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
            </div>
            <div className="text-right">
              <p><b>Period:</b> {startDate || 'N/A'} to {endDate || 'N/A'}</p>
              <p><b>Generated At:</b> {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <TableRow>
              <TableHead className="w-[15%]">Date</TableHead>
              <TableHead className="w-[25%]">Student Name</TableHead>
              <TableHead className="w-[20%]">Building & Room</TableHead>
              <TableHead className="w-[10%]">Method</TableHead>
              <TableHead className="w-[15%]">Received By</TableHead>
              <TableHead className="w-[15%] text-right">Amount</TableHead>
            </TableRow>
          </thead>
          <TableBody>
            {filteredPayments.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{formatCompactDate(p.date)}</TableCell>
                <TableCell className="font-bold">{p.studentName}</TableCell>
                <TableCell>{p.buildingName} - R{p.roomNumber}</TableCell>
                <TableCell className="uppercase">{p.method}</TableCell>
                <TableCell>{p.receiver}</TableCell>
                <TableCell className="text-right font-bold">৳{p.amount?.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>

        <div className="summary-section">
          <div className="bg-slate-50 p-4 border rounded-xl grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-bold uppercase text-primary text-xs mb-2">Final Summary</h3>
              <p className="text-sm">Total Collections: <b>৳{stats.total.toLocaleString()}</b></p>
              <p className="text-sm">Total Receipts: <b>{stats.count} Entries</b></p>
            </div>
            <div className="text-right flex flex-col justify-end">
              <p className="text-xs uppercase font-bold text-muted-foreground">End of Report</p>
            </div>
          </div>
          <div className="print-footer mt-10">
            <div className="signature-box">Accountant Signature</div>
            <div className="text-center self-end print-page-number"></div>
            <div className="signature-box">Manager Signature</div>
          </div>
        </div>
      </div>

      <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden print:hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-bold uppercase text-success">Total Filtered Income</CardTitle>
          <ArrowUpCircle className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black text-slate-900">৳{stats.total.toLocaleString()}</div>
          <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Found {stats.count} matching records</p>
        </CardContent>
      </Card>

      <div className="bg-secondary/20 p-4 rounded-xl border space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground"><Search className="inline h-3 w-3 mr-1"/> Student Name</Label>
            <Input placeholder="Search..." className="bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Building</Label>
            <Select value={buildingFilter} onValueChange={setBuildingFilter}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buildings</SelectItem>
                {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Method</Label>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Date From</Label><Input type="date" className="bg-white" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Date To</Label><Input type="date" className="bg-white" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          <Button variant="ghost" className="h-10 font-bold uppercase text-xs" onClick={() => { setSearchTerm(""); setBuildingFilter("all"); setMethodFilter("all"); setStartDate(""); setEndDate(""); }}>
            <XCircle size={14} className="mr-1" /> Reset Date Filter
          </Button>
        </div>
      </div>

      {paymentsLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl print:hidden">
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
      )}

      <div className="fixed bottom-8 right-8 z-50 print:hidden">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-income"><Plus size={32} className="text-white" /></Button>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Income Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/30 rounded-xl border">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase">Building</Label>
                <Select value={entryBuildingFilter} onValueChange={val => { setEntryBuildingFilter(val); setEntryRoomFilter("all"); }}>
                  <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Buildings</SelectItem>
                    {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase">Room No.</Label>
                <Select value={entryRoomFilter} onValueChange={setEntryRoomFilter}>
                  <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rooms</SelectItem>
                    {availableRooms.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Resident</Label>
              <Select value={formData.studentId} onValueChange={val => setFormData({...formData, studentId: val})}>
                <SelectTrigger><SelectValue placeholder="Choose student" /></SelectTrigger>
                <SelectContent>
                  {filteredStudentsForEntry.map(s => <SelectItem key={s.id} value={s.id}>{s.name} (R-{s.roomNumber})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {selectedStudent && (
              <div className="bg-primary/5 p-4 rounded-xl space-y-3 border border-primary/10">
                <h4 className="text-[10px] font-bold uppercase text-primary flex items-center gap-1.5"><Calculator size={12}/> Resident Ledger Stats</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2 rounded border shadow-sm">
                    <p className="text-[8px] uppercase font-bold text-muted-foreground">Monthly Rent</p>
                    <p className="text-sm font-bold">৳{selectedStudent.monthlyRent}</p>
                  </div>
                  <div className="bg-white p-2 rounded border shadow-sm">
                    <p className="text-[8px] uppercase font-bold text-destructive">Overall Due</p>
                    <p className="text-sm font-bold text-destructive">৳{financialStats.totalDue.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Month</Label><Select value={formData.month} onValueChange={v => setFormData({...formData, month: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Year</Label><Select value={formData.year} onValueChange={v => setFormData({...formData, year: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{"2024,2025,2026".split(',').map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
            </div>

            <div className="p-4 border-2 border-primary/20 rounded-xl space-y-4 bg-primary/5">
              {selectedStudent?.paymentSystem === 'package' ? (
                <div className="space-y-2"><Label className="text-xs">Amount Received (৳)</Label><Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-xs">Seat Rent (৳)</Label><Input type="number" value={formData.seatAmount} onChange={e => setFormData({...formData, seatAmount: e.target.value})} /></div>
                  <div className="space-y-2"><Label className="text-xs">Food Deposit (৳)</Label><Input type="number" value={formData.foodAmount} onChange={e => setFormData({...formData, foodAmount: e.target.value})} /></div>
                </div>
              )}
              <div className="space-y-2"><Label className="text-xs font-bold text-primary">Add to Advance Pool (৳)</Label><Input type="number" value={formData.addAdvanceAmount} onChange={e => setFormData({...formData, addAdvanceAmount: e.target.value})} /></div>
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
