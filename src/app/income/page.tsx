
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
import { Wallet, Info, Loader2, Lock, ArrowDownToLine, UserPlus, DoorOpen, Building2, Plus, Search, Filter, History, HandCoins, CreditCard } from "lucide-react"
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
  
  // Filters
  const [monthFilter, setMonthFilter] = useState(new Date().toLocaleString('default', { month: 'long' }))
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [receiverFilter, setReceiverFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  // Entry Form States
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("")
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string>("")
  const [useAdvanceBalance, setUseAdvanceBalance] = useState(false)
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: "", phone: "" })

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

  // Data Fetching
  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students } = useCollection(studentsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const incomeQuery = useMemoFirebase(() => 
    query(collection(db, "payments"), orderBy("date", "desc"), limit(200)), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(incomeQuery)

  // Filtering Logic
  const filteredPayments = useMemo(() => {
    if (!payments) return []
    return payments.filter(p => {
      const matchesMonth = monthFilter === "all" || p.month === monthFilter
      const matchesYear = yearFilter === "all" || p.year === yearFilter
      const matchesBuilding = buildingFilter === "all" || p.buildingId === buildingFilter
      const matchesMethod = methodFilter === "all" || p.method === methodFilter
      const matchesReceiver = receiverFilter === "all" || p.receiver === receiverFilter
      const matchesSearch = p.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.buildingName?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesMonth && matchesYear && matchesBuilding && matchesMethod && matchesReceiver && matchesSearch
    })
  }, [payments, monthFilter, yearFilter, buildingFilter, methodFilter, receiverFilter, searchTerm])

  const totalFilteredIncome = useMemo(() => {
    return filteredPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [filteredPayments])

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const student = students?.find(s => s.id === formData.studentId)
    if (!formData.studentId || !selectedBuildingId || (!useAdvanceBalance && !formData.receiver)) return

    const seatPaid = student?.paymentSystem === 'package' ? Number(formData.amount) : Number(formData.seatAmount)
    const foodPaid = student?.paymentSystem === 'non-package' ? Number(formData.foodAmount) : 0
    const totalAmount = seatPaid + foodPaid

    if (totalAmount <= 0) return

    setIsSubmitting(true)
    const building = buildings?.find(b => b.id === selectedBuildingId)
    const paymentId = doc(collection(db, "payments")).id
    const summaryId = `${formData.year}-${formData.month}`

    const paymentRecord = {
      amount: totalAmount,
      seatAmount: seatPaid,
      foodAmount: foodPaid,
      buildingId: selectedBuildingId,
      buildingName: building?.name || "Unknown",
      studentName: student?.name || "Unknown",
      studentId: formData.studentId,
      type: "income",
      month: formData.month,
      year: formData.year,
      method: useAdvanceBalance ? "advance_deduction" : formData.method,
      receiver: useAdvanceBalance ? "System (Advance Deduction)" : formData.receiver,
      description: (useAdvanceBalance ? "[Deducted from Advance] " : "") + formData.description,
      date: new Date().toISOString()
    }

    try {
      if (!useAdvanceBalance) {
        await setDoc(doc(db, "payments", paymentId), {
          ...paymentRecord,
          date: serverTimestamp(),
          createdAt: serverTimestamp(),
        })

        await setDoc(doc(db, "summaries", summaryId), {
          totalIncome: increment(totalAmount),
          [`buildingIncome.${building?.name || 'Unknown'}`]: increment(totalAmount),
          updatedAt: serverTimestamp()
        }, { merge: true })
      }

      const studentRef = doc(db, "students", formData.studentId)
      await updateDoc(studentRef, {
        paymentsHistory: arrayUnion(paymentRecord),
        ...(useAdvanceBalance && { advanceAmount: increment(-totalAmount) }),
        ...(student?.paymentSystem === 'non-package' && foodPaid > 0 && { foodCost: increment(foodPaid) }),
        updatedAt: serverTimestamp()
      })

      toast({ title: "Success", description: "Payment recorded." })
      setIsEntryOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetFilters = () => {
    setMonthFilter(new Date().toLocaleString('default', { month: 'long' }))
    setYearFilter(new Date().getFullYear().toString())
    setBuildingFilter("all")
    setMethodFilter("all")
    setReceiverFilter("all")
    setSearchTerm("")
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Income History</h1>
            <p className="text-muted-foreground mt-1">Review all received payments and collections.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-success/5 border-l-4 border-l-success">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-success flex items-center gap-2">
              <HandCoins size={16} /> Total Collections (Filtered)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">₹{totalFilteredIncome.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 bg-secondary/20 p-4 rounded-xl border">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <Input placeholder="Student or Building..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Month</Label>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Building</Label>
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Method</Label>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
              <SelectItem value="advance_deduction">Advance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Receiver</Label>
          <Select value={receiverFilter} onValueChange={setReceiverFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Receivers</SelectItem>
              {staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" className="h-10 mt-auto" onClick={resetFilters}>Reset</Button>
      </div>

      {paymentsLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Receiver</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{p.date?.toDate ? p.date.toDate().toLocaleDateString() : new Date(p.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{p.studentName}</TableCell>
                    <TableCell className="text-xs">{p.buildingName}</TableCell>
                    <TableCell className="text-xs">{p.receiver}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {p.method === 'advance_deduction' ? "Adv. Adj." : p.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-income">₹{p.amount?.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {filteredPayments.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No payments found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Entry Dialog Trigger (FAB) */}
      <div className="fixed bottom-8 right-8 z-50">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg">
          <Plus className="h-8 w-8" />
        </Button>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record New Income</DialogTitle></DialogHeader>
          <form onSubmit={handleEntrySubmit} className="space-y-4 py-4">
             {/* Same form as Dashboard Quick Payment but more detailed if needed */}
             <div className="space-y-4">
               <Label>Standard selection fields (Building -> Room -> Student)</Label>
               {/* Simplified for brevity, reuse logic from page.tsx or dashboard */}
             </div>
             <Button type="submit" className="w-full h-12" disabled={isSubmitting}>Confirm Payment</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
