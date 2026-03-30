
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
import { Wallet, Info, Loader2, Lock, ArrowDownToLine, UserPlus, DoorOpen, Building2, Plus, Search, Filter, History } from "lucide-react"
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
    query(collection(db, "payments"), orderBy("date", "desc"), limit(100)), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(incomeQuery)

  // Entry Filtering
  const entryBuilding = useMemo(() => buildings?.find(b => b.id === selectedBuildingId), [buildings, selectedBuildingId])
  const entryRooms = useMemo(() => entryBuilding?.roomsDetail || [], [entryBuilding])
  const entryStudents = useMemo(() => {
    return students?.filter(s => 
      s.buildingId === selectedBuildingId && 
      (selectedRoomNumber ? s.roomNumber === selectedRoomNumber : true) &&
      s.isActive
    ) || []
  }, [students, selectedBuildingId, selectedRoomNumber])

  const entryStudent = useMemo(() => {
    return students?.find(s => s.id === formData.studentId)
  }, [students, formData.studentId])

  const foodStats = useMemo(() => {
    if (!entryStudent || entryStudent.paymentSystem === 'package') return { balance: 0 }
    const totalBill = entryStudent.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
    const totalPaid = Number(entryStudent.foodCost) || 0
    return { balance: totalPaid - totalBill }
  }, [entryStudent])

  const availableAdvanceForDeduction = useMemo(() => {
    if (!entryStudent) return 0
    const currentAdvance = entryStudent.advanceAmount || 0
    const minRequired = entryStudent.monthlyRent || 0
    return Math.max(0, currentAdvance - minRequired)
  }, [entryStudent])

  // History Filtering
  const filteredPayments = useMemo(() => {
    if (!payments) return []
    return payments.filter(p => {
      const matchesMonth = monthFilter === "all" || p.month === monthFilter
      const matchesYear = yearFilter === "all" || p.year === yearFilter
      const matchesBuilding = buildingFilter === "all" || p.buildingId === buildingFilter
      const matchesSearch = p.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.buildingName?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesMonth && matchesYear && matchesBuilding && matchesSearch
    })
  }, [payments, monthFilter, yearFilter, buildingFilter, searchTerm])

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

  const handleAddStaff = async () => {
    if (!newStaff.name) return
    setIsSubmitting(true)
    try {
      const staffId = doc(collection(db, "staff")).id
      await setDoc(doc(db, "staff", staffId), {
        ...newStaff,
        createdAt: Timestamp.now()
      })
      toast({ title: "Success", description: "Staff added." })
      setNewStaff({ name: "", phone: "" })
      setIsAddStaffOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.studentId || !selectedBuildingId || (!useAdvanceBalance && !formData.receiver)) return

    const seatPaid = entryStudent?.paymentSystem === 'package' ? Number(formData.amount) : Number(formData.seatAmount)
    const foodPaid = entryStudent?.paymentSystem === 'non-package' ? Number(formData.foodAmount) : 0
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
      studentName: entryStudent?.name || "Unknown",
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
        ...(entryStudent?.paymentSystem === 'non-package' && foodPaid > 0 && { foodCost: increment(foodPaid) }),
        updatedAt: serverTimestamp()
      })

      toast({ title: "Success", description: "Payment recorded." })
      setIsEntryOpen(false)
      setFormData(prev => ({ ...prev, amount: "", seatAmount: "", foodAmount: "", description: "" }))
      setUseAdvanceBalance(false)
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
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Income History</h1>
            <p className="text-muted-foreground mt-1">Review all received payments and collections.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-secondary/20 p-4 rounded-xl border">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1"><Search size={10}/> Search</Label>
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
          <Label className="text-xs text-muted-foreground">Year</Label>
          <Input type="number" value={yearFilter} onChange={e => setYearFilter(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 size={10}/> Building</Label>
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setMonthFilter("all"); setYearFilter("all"); setBuildingFilter("all"); setSearchTerm("") }} className="h-10">Reset</Button>
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
                  <TableHead>Period</TableHead>
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
                    <TableCell className="text-xs">{p.month} {p.year}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {p.method === 'advance_deduction' ? "Adv. Adj." : p.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-income">₹{p.amount?.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {filteredPayments.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No payments found for this criteria.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Floating Action Button for Entry */}
      <div className="fixed bottom-8 right-8 z-50">
        <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg bg-primary">
              <Plus className="h-8 w-8 text-white" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyDown}>
            <DialogHeader>
              <DialogTitle>Record New Income</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEntrySubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4 p-4 bg-secondary/10 rounded-xl border">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 font-bold"><Building2 size={12}/> Building</Label>
                  <Select required onValueChange={(val) => {
                    setSelectedBuildingId(val)
                    setSelectedRoomNumber("")
                    setFormData({...formData, studentId: ""})
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                    <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 font-bold"><DoorOpen size={12}/> Room No.</Label>
                  <Select 
                    disabled={!selectedBuildingId} 
                    value={selectedRoomNumber}
                    onValueChange={(val) => {
                      setSelectedRoomNumber(val)
                      setFormData({...formData, studentId: ""})
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                    <SelectContent>{entryRooms.map(r => <SelectItem key={r.roomNo} value={r.roomNo}>Room {r.roomNo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 font-bold">Student</Label>
                  <Select 
                    required
                    disabled={!selectedRoomNumber && entryStudents.length === 0} 
                    onValueChange={val => setFormData({...formData, studentId: val})}
                  >
                    <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                    <SelectContent>{entryStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {entryStudent && (
                <div className="bg-secondary/30 p-4 rounded-lg space-y-2 border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Standard Rent:</span>
                    <span className="font-bold">₹{entryStudent.monthlyRent}</span>
                  </div>
                  {entryStudent.paymentSystem === 'non-package' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{foodStats.balance >= 0 ? "Food Surplus:" : "Food Debt:"}</span>
                      <span className={cn("font-bold", foodStats.balance >= 0 ? "text-success" : "text-destructive")}>₹{Math.abs(foodStats.balance)}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1 p-2 bg-primary/5 rounded border border-primary/10">
                    <div className="flex justify-between text-xs">
                      <span className="text-primary font-medium">Advance Pool:</span>
                      <span className="font-bold text-primary">₹{entryStudent.advanceAmount || 0}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground border-t pt-1">
                      <span>Available Deduction:</span>
                      <span className="font-bold text-success">₹{availableAdvanceForDeduction}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold flex items-center gap-2 cursor-pointer" htmlFor="advSwitchInc">
                    <ArrowDownToLine size={14} className="text-primary" />
                    Deduct from Advance
                  </Label>
                </div>
                <Switch 
                  id="advSwitchInc" 
                  checked={useAdvanceBalance} 
                  onCheckedChange={setUseAdvanceBalance}
                  disabled={!entryStudent || availableAdvanceForDeduction <= 0}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select value={formData.month} onValueChange={val => setFormData({...formData, month: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {!useAdvanceBalance && (
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select value={formData.method} onValueChange={val => setFormData({...formData, method: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem><SelectItem value="mobile">Mobile</SelectItem></SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {entryStudent?.paymentSystem === 'package' ? (
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input type="number" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 p-3 bg-secondary/10 rounded-lg border">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground">SEAT RENT (₹)</Label>
                    <Input type="number" placeholder="Rent" value={formData.seatAmount} onChange={e => setFormData({...formData, seatAmount: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground">FOOD CREDIT (₹)</Label>
                    <Input type="number" placeholder="Food" value={formData.foodAmount} onChange={e => setFormData({...formData, foodAmount: e.target.value})} />
                  </div>
                </div>
              )}

              {!useAdvanceBalance && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Receiver</Label>
                    <Button variant="link" size="sm" onClick={() => setIsAddStaffOpen(true)}>Add New</Button>
                  </div>
                  <Select value={formData.receiver} onValueChange={val => setFormData({...formData, receiver: val})}>
                    <SelectTrigger><SelectValue placeholder="Select receiver" /></SelectTrigger>
                    <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              <Textarea placeholder="Notes..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              
              <Button type="submit" className="w-full gap-2 h-12" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Wallet size={16} />}
                Confirm Payment
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
        <DialogContent onKeyDown={handleKeyDown}>
          <DialogHeader><DialogTitle>Add New Receiver</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Name" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
            <Input placeholder="Phone" maxLength={11} value={newStaff.phone} onChange={e => setNewStaff({...newStaff, phone: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={handleAddStaff} disabled={isSubmitting}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
