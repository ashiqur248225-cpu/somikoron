
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
import { Wallet, Info, Loader2, Building2, Plus, Search, Filter, HandCoins, CreditCard, LayoutGrid, XCircle, UserCheck, Calendar, DoorOpen, FileSpreadsheet, Printer, Download, Share2, FileText } from "lucide-react"
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

export default function IncomeHistoryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  
  // User Context
  const [userBranch, setUserBranch] = useState("Main Branch")
  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
  }, [])

  // Filters State
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [receiverFilter, setReceiverFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("")
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string>("")

  const [formData, setFormData] = useState({
    studentId: "",
    month: new Date().toLocaleString('default', { month: 'long' }),
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
    return query(collection(db, "payments"), where("branch", "==", userBranch), orderBy("date", "desc"), limit(500))
  }, [db, userBranch])
  const { data: payments, isLoading: paymentsLoading } = useCollection(incomeQuery)

  // Cascading Selection for Form (Building -> Room -> Student)
  const selectedBuildingForForm = buildings?.find(b => b.id === selectedBuildingId)
  const roomsInBuildingForForm = useMemo(() => {
    if (!selectedBuildingForForm) return []
    return selectedBuildingForForm.apartmentsDetail?.flatMap((a: any) => a.rooms || []) || []
  }, [selectedBuildingForForm])
  
  const filteredStudentsForForm = useMemo(() => {
    return students?.filter(s => 
      s.buildingId === selectedBuildingId && 
      s.roomNumber === selectedRoomNumber &&
      s.isActive
    ) || []
  }, [students, selectedBuildingId, selectedRoomNumber])

  const selectedStudent = useMemo(() => students?.find(s => s.id === formData.studentId), [students, formData.studentId])

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
      
      return matchesStartDate && matchesEndDate && matchesBuilding && matchesMethod && matchesReceiver && matchesSearch
    })
  }, [payments, startDate, endDate, buildingFilter, methodFilter, receiverFilter, searchTerm])

  const totalFilteredIncome = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
  }, [filteredPayments])

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.studentId || !selectedBuildingId || !selectedRoomNumber || !formData.receiver) {
      toast({ variant: "destructive", title: "Error", description: "Fill all required fields including Receiver." })
      return
    }

    const seatPaid = selectedStudent?.paymentSystem === 'package' ? Number(formData.amount) : Number(formData.seatAmount)
    const foodPaid = selectedStudent?.paymentSystem === 'non-package' ? Number(formData.foodAmount) : 0
    const addAdvance = Number(formData.addAdvanceAmount)
    const totalAmount = seatPaid + foodPaid + addAdvance

    if (totalAmount <= 0) return

    setIsSubmitting(true)
    const paymentId = doc(collection(db, "payments")).id

    let detailsArr = []
    if (seatPaid > 0) detailsArr.push(`Rent: ৳${seatPaid}`)
    if (foodPaid > 0) detailsArr.push(`Food: ৳${foodPaid}`)
    if (addAdvance > 0) detailsArr.push(`Advance: ৳${addAdvance}`)
    const breakdown = detailsArr.join(', ')

    const paymentRecord = {
      amount: totalAmount,
      seatAmount: seatPaid,
      foodAmount: foodPaid,
      advanceAmount: addAdvance,
      buildingId: selectedBuildingId,
      buildingName: selectedBuildingForForm?.name || "Unknown",
      studentName: selectedStudent?.name || "Unknown",
      studentId: formData.studentId,
      roomNumber: selectedRoomNumber,
      branch: userBranch, // CRITICAL
      type: "income",
      month: formData.month,
      year: formData.year,
      method: formData.method,
      receiver: formData.receiver,
      description: `${breakdown}. ${formData.description}`,
      date: new Date().toISOString()
    }

    try {
      await setDoc(doc(db, "payments", paymentId), { ...paymentRecord, id: paymentId, date: serverTimestamp(), createdAt: serverTimestamp() })

      await updateDoc(doc(db, "students", formData.studentId), {
        paymentsHistory: arrayUnion(paymentRecord),
        advanceAmount: increment(addAdvance),
        ...(selectedStudent?.paymentSystem === 'non-package' && foodPaid > 0 && { foodCost: increment(foodPaid) }),
        updatedAt: serverTimestamp()
      })

      toast({ title: "Success", description: `Processed ৳${totalAmount} for Room ${selectedRoomNumber}.` })
      setIsEntryOpen(false)
      setFormData({ ...formData, studentId: "", amount: "", seatAmount: "", foodAmount: "", addAdvanceAmount: "0", description: "" })
      setSelectedBuildingId(""); setSelectedRoomNumber("")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetFilters = () => {
    setSearchTerm("")
    setStartDate("")
    setEndDate("")
    setBuildingFilter("all")
    setMethodFilter("all")
    setReceiverFilter("all")
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-income flex items-center justify-between">
              <span className="flex items-center gap-2"><HandCoins size={16} /> Total Collections (Filtered)</span>
              {receiverFilter !== 'all' && <Badge variant="outline" className="text-[10px] bg-income/10 border-income/20">{receiverFilter}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-bold text-income">৳{totalFilteredIncome.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Branch: {userBranch}</p>
              </div>
              <Badge variant="outline" className="bg-income/10 text-income border-income/20 mb-1 px-3 py-1">
                {filteredPayments.length} Receipts
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 bg-secondary/20 p-4 rounded-xl border items-end print:hidden">
         <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase font-bold">Search</Label>
            <Input placeholder="Student name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
         </div>
         <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase font-bold">From Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
         </div>
         <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase font-bold">To Date</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
         </div>
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
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bkash">Bkash</SelectItem>
                <SelectItem value="nagad">Nagad</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
         </div>
         <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase font-bold">Receiver</Label>
            <Select value={receiverFilter} onValueChange={setReceiverFilter}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
         </div>
         <Button variant="ghost" type="button" className="h-10" onClick={handleResetFilters}>
           <XCircle size={14} className="mr-1" /> Reset
         </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden print:hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Receiver</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">
                    {p.date?.toDate ? p.date.toDate().toLocaleDateString() : (p.date ? new Date(p.date).toLocaleDateString() : 'N/A')}
                  </TableCell>
                  <TableCell className="font-medium">{p.studentName}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[250px]">
                      {p.seatAmount > 0 && <Badge variant="outline" className="text-[8px] h-4 px-1">Rent: ৳{p.seatAmount}</Badge>}
                      {p.foodAmount > 0 && <Badge variant="outline" className="text-[8px] h-4 px-1">Food: ৳{p.foodAmount}</Badge>}
                      {p.advanceAmount > 0 && <Badge variant="outline" className="text-[8px] h-4 px-1 border-primary text-primary">Adv: ৳{p.advanceAmount}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] uppercase">{p.method}</Badge></TableCell>
                  <TableCell className="text-xs font-medium text-primary">{p.receiver}</TableCell>
                  <TableCell className="text-right font-bold text-income">৳{p.amount?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {filteredPayments.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No income records found for this branch.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Print View Table */}
      <div className="hidden print:block">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-primary">Income History Report</h2>
          <p className="text-sm text-muted-foreground">Branch: {userBranch} | Period: {startDate || 'Start'} to {endDate || 'Now'}</p>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-secondary/30 border">
              <th className="border p-2 text-left">Date</th>
              <th className="border p-2 text-left">Student</th>
              <th className="border p-2 text-left">Building & Room</th>
              <th className="border p-2 text-left">Method</th>
              <th className="border p-2 text-left">Receiver</th>
              <th className="border p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((p: any) => (
              <tr key={p.id} className="border">
                <td className="border p-2">{p.date?.toDate ? p.date.toDate().toLocaleDateString() : (p.date ? new Date(p.date).toLocaleDateString() : 'N/A')}</td>
                <td className="border p-2 font-bold">{p.studentName}</td>
                <td className="border p-2">{p.buildingName} | R-{p.roomNumber}</td>
                <td className="border p-2 uppercase">{p.method}</td>
                <td className="border p-2">{p.receiver}</td>
                <td className="border p-2 text-right">৳{p.amount?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold bg-secondary/10">
              <td colSpan={5} className="border p-2 text-right">Grand Total:</td>
              <td className="border p-2 text-right">৳{totalFilteredIncome.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="fixed bottom-8 right-8 z-50 print:hidden">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-primary hover:scale-105 transition-transform"><Plus h-8 w-8 text-white /></Button>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Income Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleEntrySubmit} className="space-y-4 py-4">
             <div className="p-4 bg-secondary/10 rounded-xl border">
                <div className="space-y-2">
                  <Label>Building</Label>
                  <Select onValueChange={(val) => { setSelectedBuildingId(val); setSelectedRoomNumber(""); setFormData({...formData, studentId: ""}) }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Room No.</Label>
                  <Select disabled={!selectedBuildingId} onValueChange={(val) => { setSelectedRoomNumber(val); setFormData({...formData, studentId: ""}) }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{roomsInBuildingForForm.map((r: any) => <SelectItem key={r.roomNo} value={r.roomNo}>Room {r.roomNo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select disabled={!selectedRoomNumber} onValueChange={val => setFormData({...formData, studentId: val})}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{filteredStudentsForForm.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
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
                    <SelectTrigger><SelectValue placeholder="Select Staff" /></SelectTrigger>
                    <SelectContent>{staffList?.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
               </div>
             </div>

             <Button type="submit" className="w-full h-12 bg-income" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : "Confirm Payment"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
