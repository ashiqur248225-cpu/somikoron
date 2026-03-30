
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
import { Wallet, Info, Loader2, Lock, ArrowDownToLine, UserPlus, DoorOpen, Building2, Plus, Search, Filter, History, HandCoins, CreditCard, LayoutGrid } from "lucide-react"
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
  const [selectedAptName, setSelectedAptName] = useState<string>("")
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

  // Cascading Selection for Form
  const selectedBuildingForForm = useMemo(() => buildings?.find(b => b.id === selectedBuildingId), [buildings, selectedBuildingId])
  const apartmentsInBuilding = useMemo(() => selectedBuildingForForm?.apartmentsDetail || [], [selectedBuildingForForm])
  const roomsInApt = useMemo(() => apartmentsInBuilding.find((a: any) => a.name === selectedAptName)?.rooms || [], [apartmentsInBuilding, selectedAptName])
  
  const filteredStudentsForForm = useMemo(() => {
    return students?.filter(s => 
      s.buildingId === selectedBuildingId && 
      s.apartmentName === selectedAptName &&
      s.roomNumber === selectedRoomNumber &&
      s.isActive
    ) || []
  }, [students, selectedBuildingId, selectedAptName, selectedRoomNumber])

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

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.studentId || !selectedBuildingId || !selectedAptName || !selectedRoomNumber) return

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

      toast({ title: "Success", description: "Hierarchy Apartment -> Room -> Seat updated." })
      setIsEntryOpen(false)
      setFormData({ ...formData, studentId: "", amount: "", seatAmount: "", foodAmount: "", description: "" })
      setSelectedBuildingId(""); setSelectedAptName(""); setSelectedRoomNumber("")
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

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-secondary/20 p-4 rounded-xl border">
         <Input placeholder="Search student..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
         <Select value={monthFilter} onValueChange={setMonthFilter}>
           <SelectTrigger><SelectValue /></SelectTrigger>
           <SelectContent>{["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
         </Select>
         <Select value={buildingFilter} onValueChange={setBuildingFilter}>
           <SelectTrigger><SelectValue placeholder="Building" /></SelectTrigger>
           <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
         </Select>
         <Button variant="ghost" onClick={() => { setSearchTerm(""); setMonthFilter("all"); setBuildingFilter("all") }}>Reset</Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{new Date(p.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{p.studentName}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] uppercase">{p.method}</Badge></TableCell>
                  <TableCell className="text-right font-bold text-income">₹{p.amount?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="fixed bottom-8 right-8 z-50">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg"><Plus className="h-8 w-8" /></Button>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Income</DialogTitle></DialogHeader>
          <form onSubmit={handleEntrySubmit} className="space-y-4 py-4">
             <div className="space-y-4 p-4 bg-secondary/10 rounded-xl border">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Building2 size={12}/> Building</Label>
                  <Select onValueChange={(val) => { setSelectedBuildingId(val); setSelectedAptName(""); setSelectedRoomNumber(""); setFormData({...formData, studentId: ""}) }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><LayoutGrid size={12}/> Apartment</Label>
                  <Select disabled={!selectedBuildingId} onValueChange={(val) => { setSelectedAptName(val); setSelectedRoomNumber(""); setFormData({...formData, studentId: ""}) }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{apartmentsInBuilding.map((a: any) => <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><DoorOpen size={12}/> Room</Label>
                  <Select disabled={!selectedAptName} onValueChange={(val) => { setSelectedRoomNumber(val); setFormData({...formData, studentId: ""}) }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{roomsInApt.map((r: any) => <SelectItem key={r.roomNo} value={r.roomNo}>Room {r.roomNo}</SelectItem>)}</SelectContent>
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

             <Button type="submit" className="w-full h-12" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : "Confirm Payment"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
