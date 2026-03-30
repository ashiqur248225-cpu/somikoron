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
import { Switch } from "@/components/ui/switch"
import { Wallet, Info, Loader2, Lock, ArrowDownToLine, UserPlus, DoorOpen, Building2, Plus, Search, Filter, History, HandCoins, CreditCard, LayoutGrid, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, increment, updateDoc, arrayUnion, Timestamp, query, orderBy, where, limit } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function IncomeHistoryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  
  const [monthFilter, setMonthFilter] = useState(new Date().toLocaleString('default', { month: 'long' }))
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("")
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string>("")
  const [useAdvanceBalance, setUseAdvanceBalance] = useState(false)

  const [formData, setFormData] = useState({
    studentId: "",
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    amount: "",
    seatAmount: "",
    foodAmount: "",
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

  const incomeQuery = useMemoFirebase(() => query(collection(db, "payments"), orderBy("date", "desc"), limit(200)), [db])
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
      const matchesMonth = monthFilter === "all" || p.month === monthFilter
      const matchesBuilding = buildingFilter === "all" || p.buildingId === buildingFilter
      const matchesSearch = p.studentName?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesMonth && matchesBuilding && matchesSearch
    })
  }, [payments, monthFilter, buildingFilter, searchTerm])

  const totalFilteredIncome = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
  }, [filteredPayments])

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.studentId || !selectedBuildingId || !selectedRoomNumber) return

    const seatPaid = selectedStudent?.paymentSystem === 'package' ? Number(formData.amount) : Number(formData.seatAmount)
    const foodPaid = selectedStudent?.paymentSystem === 'non-package' ? Number(formData.foodAmount) : 0
    const totalAmount = seatPaid + foodPaid

    setIsSubmitting(true)
    const paymentId = doc(collection(db, "payments")).id
    const summaryId = `${formData.year}-${formData.month}`

    const paymentRecord = {
      amount: totalAmount,
      seatAmount: seatPaid,
      foodAmount: foodPaid,
      buildingId: selectedBuildingId,
      buildingName: selectedBuildingForForm?.name || "Unknown",
      studentName: selectedStudent?.name || "Unknown",
      studentId: formData.studentId,
      type: "income",
      month: formData.month,
      year: formData.year,
      method: useAdvanceBalance ? "advance_deduction" : formData.method,
      receiver: useAdvanceBalance ? "System (Advance Deduction)" : formData.receiver,
      description: formData.description,
      date: new Date().toISOString()
    }

    try {
      if (!useAdvanceBalance) {
        await setDoc(doc(db, "payments", paymentId), { ...paymentRecord, date: serverTimestamp(), createdAt: serverTimestamp() })
        await setDoc(doc(db, "summaries", summaryId), {
          totalIncome: increment(totalAmount),
          [`buildingIncome.${selectedBuildingForForm?.name}`]: increment(totalAmount),
          updatedAt: serverTimestamp()
        }, { merge: true })
      }

      await updateDoc(doc(db, "students", formData.studentId), {
        paymentsHistory: arrayUnion(paymentRecord),
        ...(useAdvanceBalance && { advanceAmount: increment(-totalAmount) }),
        ...(selectedStudent?.paymentSystem === 'non-package' && foodPaid > 0 && { foodCost: increment(foodPaid) }),
        updatedAt: serverTimestamp()
      })

      toast({ title: "Success", description: `Processed ₹${totalAmount} for Room ${selectedRoomNumber}.` })
      setIsEntryOpen(false)
      setFormData({ ...formData, studentId: "", amount: "", seatAmount: "", foodAmount: "", description: "" })
      setSelectedBuildingId(""); setSelectedRoomNumber("")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-3xl font-headline font-bold text-primary">Income</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-income/5 border-none shadow-sm border-l-4 border-l-income">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-income flex items-center gap-2">
              <HandCoins size={16} /> Total Collections (Filtered)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-income">₹{totalFilteredIncome.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-secondary/20 p-4 rounded-xl border">
         <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase font-bold">Search</Label>
            <Input placeholder="Student name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
         </div>
         <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase font-bold">Month</Label>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
         </div>
         <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase font-bold">Building</Label>
            <Select value={buildingFilter} onValueChange={setBuildingFilter}>
              <SelectTrigger><SelectValue placeholder="Building" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
         </div>
         <Button variant="ghost" className="h-10 mt-auto" onClick={() => { setSearchTerm(""); setMonthFilter(new Date().toLocaleString('default', { month: 'long' })); setBuildingFilter("all") }}>
           <XCircle size={14} className="mr-1" /> Reset
         </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Receiver</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{new Date(p.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{p.studentName}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] uppercase">{p.method}</Badge></TableCell>
                  <TableCell className="text-xs">{p.receiver}</TableCell>
                  <TableCell className="text-right font-bold text-income">₹{p.amount?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {filteredPayments.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No income records found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="fixed bottom-8 right-8 z-50">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-primary hover:scale-105 transition-transform"><Plus className="h-8 w-8 text-white" /></Button>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                  <div className="flex justify-between font-bold"><span>Monthly Rent:</span><span>₹{selectedStudent.monthlyRent}</span></div>
                  <div className="flex justify-between text-xs text-primary"><span>Advance Balance:</span><span>₹{selectedStudent.advanceAmount || 0}</span></div>
               </div>
             )}

             <div className="grid grid-cols-2 gap-4">
               {selectedStudent?.paymentSystem === 'package' ? (
                 <div className="col-span-2 space-y-2">
                   <Label>Amount</Label>
                   <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                 </div>
               ) : (
                 <>
                   <div className="space-y-2"><Label>Seat Rent</Label><Input type="number" value={formData.seatAmount} onChange={e => setFormData({...formData, seatAmount: e.target.value})} /></div>
                   <div className="space-y-2"><Label>Food Credit</Label><Input type="number" value={formData.foodAmount} onChange={e => setFormData({...formData, foodAmount: e.target.value})} /></div>
                 </>
               )}
             </div>

             <div className="space-y-2">
                <Label>Receiver</Label>
                <Select value={formData.receiver} onValueChange={val => setFormData({...formData, receiver: val})}>
                  <SelectTrigger><SelectValue placeholder="Staff Member" /></SelectTrigger>
                  <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
             </div>

             <Button type="submit" className="w-full h-12 bg-income" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : "Confirm Payment"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
