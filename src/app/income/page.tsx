"use client"

import { useState, useMemo } from "react"
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
import { collection, serverTimestamp, doc, setDoc, increment, updateDoc, arrayUnion, query, orderBy, limit } from "firebase/firestore"
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

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students } = useCollection(studentsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const incomeQuery = useMemoFirebase(() => query(collection(db, "payments"), orderBy("date", "desc"), limit(500)), [db])
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
      type: "income",
      month: formData.month,
      year: formData.year,
      method: formData.method,
      receiver: formData.receiver,
      description: `${breakdown}. ${formData.description}`,
      date: new Date().toISOString()
    }

    try {
      await setDoc(doc(db, "payments", paymentId), { ...paymentRecord, date: serverTimestamp(), createdAt: serverTimestamp() })

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

  const handleExportCSV = () => {
    const headers = ["Type", "Date", "Student", "Details", "Method", "Receiver", "Building", "Amount"]
    const rows = filteredPayments.map(p => [
      "INCOME",
      p.date?.toDate ? p.date.toDate().toLocaleDateString() : (p.date ? new Date(p.date).toLocaleDateString() : 'N/A'),
      p.studentName,
      p.description || "-",
      p.method,
      p.receiver,
      p.buildingName,
      p.amount
    ])

    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += "SOMIKORON INCOME HISTORY\n"
    csvContent += `Generated on: ${new Date().toLocaleString()}\n\n`
    csvContent += headers.join(",") + "\n"
    rows.forEach(row => { csvContent += row.join(",") + "\n" })
    csvContent += `\n,,,,,,,TOTAL COLLECTIONS,${totalFilteredIncome}`

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Income_History_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.focus();
      window.print();
    }
  }

  const handleShare = async () => {
    if (typeof window !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Somikoron Income Report',
          text: `Check out the income collection report for ${startDate || 'All Time'} to ${endDate || 'Today'}.`,
          url: window.location.href,
        });
      } catch (err) {
        // Share cancelled
      }
    } else {
      toast({ title: "Share not supported", description: "Sharing is not supported on this browser." });
    }
  }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-3xl font-headline font-bold text-primary">Income History</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" type="button" className="gap-2" onClick={handleExportCSV}>
            <FileSpreadsheet size={16} /> Export CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Download size={16} /> Export / Share
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePrint} className="cursor-pointer">
                <FileText size={14} className="mr-2" /> Download PDF (Print)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShare} className="cursor-pointer">
                <Share2 size={14} className="mr-2" /> Share Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden">
        <Card className="bg-income/5 border-none shadow-sm border-l-4 border-l-income">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-income flex items-center gap-2">
              <HandCoins size={16} /> Total Collections (Filtered)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-income">৳{totalFilteredIncome.toLocaleString()}</p>
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
                      {p.serviceCharge > 0 && <Badge variant="outline" className="text-[8px] h-4 px-1 border-orange-500 text-orange-500">Svc: ৳{p.serviceCharge}</Badge>}
                      {!p.seatAmount && !p.foodAmount && !p.advanceAmount && !p.serviceCharge && (
                        <span className="text-[10px] text-muted-foreground truncate" title={p.description}>{p.description || "-"}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] uppercase">{p.method}</Badge></TableCell>
                  <TableCell className="text-xs">{p.receiver}</TableCell>
                  <TableCell className="text-right font-bold text-income">৳{p.amount?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {filteredPayments.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No income records found for these filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Optimized Print Section */}
      <div className="hidden print:block space-y-6">
        <div className="text-center space-y-2 border-b pb-4">
          <h1 className="text-2xl font-bold text-primary">Somikoron Hostel Ledger</h1>
          <h2 className="text-xl font-semibold">Income Collection Report</h2>
          <div className="text-sm text-muted-foreground flex justify-center gap-4">
            <span>Period: {startDate || 'All Time'} - {endDate || 'Today'}</span>
            <span>Building: {buildingFilter === 'all' ? 'All Properties' : buildings?.find(b => b.id === buildingFilter)?.name}</span>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th>Resident</th>
              <th>Purpose/Details</th>
              <th>Method</th>
              <th>Receiver</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((p, i) => (
              <tr key={i}>
                <td>{p.date?.toDate ? p.date.toDate().toLocaleDateString() : (p.date ? new Date(p.date).toLocaleDateString() : 'N/A')}</td>
                <td className="font-medium">{p.studentName}</td>
                <td>{p.description || "-"}</td>
                <td className="uppercase">{p.method}</td>
                <td>{p.receiver}</td>
                <td className="text-right font-bold">৳{p.amount?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td colSpan={5} className="text-right font-bold py-4">GRAND TOTAL COLLECTIONS:</td>
              <td className="text-right font-bold text-lg text-primary py-4">৳{totalFilteredIncome.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
        
        <div className="pt-20 flex justify-between px-10">
          <div className="border-t border-black px-8 pt-2 text-center text-sm">Accountant Signature</div>
          <div className="border-t border-black px-8 pt-2 text-center text-sm">Manager Signature</div>
        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-50 print:hidden">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-primary hover:scale-105 transition-transform"><Plus className="h-8 w-8 text-white" /></Button>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyDown}>
          <DialogHeader><DialogTitle>Record Income Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleEntrySubmit} className="space-y-4 py-4">
             <div className="space-y-4 p-4 bg-secondary/10 rounded-xl border">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Building2 size={12}/> Building</Label>
                  <Select onValueChange={(val) => { setSelectedBuildingId(val); setSelectedRoomNumber(""); setFormData({...formData, studentId: ""}) }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><DoorOpen size={12}/> Room No.</Label>
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

             {selectedStudent && (
               <div className="bg-primary/5 p-3 rounded-lg border text-sm space-y-2">
                  <div className="flex justify-between font-bold"><span>Monthly Rent:</span><span>৳{selectedStudent.monthlyRent}</span></div>
                  <div className="flex justify-between text-xs text-primary"><span>Advance Balance:</span><span>৳{selectedStudent.advanceAmount || 0}</span></div>
               </div>
             )}

             <div className="grid grid-cols-2 gap-4">
               {selectedStudent?.paymentSystem === 'package' ? (
                 <div className="col-span-2 space-y-2">
                   <Label>Rent/Package Amount (৳)</Label>
                   <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                 </div>
               ) : (
                 <>
                   <div className="space-y-2"><Label>Seat Rent (৳)</Label><Input type="number" value={formData.seatAmount} onChange={e => setFormData({...formData, seatAmount: e.target.value})} /></div>
                   <div className="space-y-2"><Label>Food Credit (৳)</Label><Input type="number" value={formData.foodAmount} onChange={e => setFormData({...formData, foodAmount: e.target.value})} /></div>
                 </>
               )}
             </div>

             <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 space-y-2">
                <Label className="text-xs font-bold text-primary flex items-center gap-1"><Plus size={12}/> Add to Advance Pool (৳)</Label>
                <Input type="number" value={formData.addAdvanceAmount} onChange={e => setFormData({...formData, addAdvanceAmount: e.target.value})} placeholder="Extra amount to save" />
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
                    <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
               </div>
             </div>

             <Textarea placeholder="Description..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
             <Button type="submit" className="w-full h-12 bg-income" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : "Confirm Payment"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
