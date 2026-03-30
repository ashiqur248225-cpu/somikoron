
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Wallet, Info, Loader2, Lock, ArrowDownToLine, UserPlus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, increment, updateDoc, arrayUnion, Timestamp } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"

export default function IncomeEntryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("")
  const [useAdvanceBalance, setUseAdvanceBalance] = useState(false)
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: "", phone: "" })

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students } = useCollection(studentsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const [formData, setFormData] = useState({
    studentId: "",
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    amount: "", // Used for package
    seatAmount: "", // Used for non-package
    foodAmount: "", // Used for non-package
    method: "cash",
    receiver: "",
    description: ""
  })

  const filteredStudents = students?.filter(s => s.buildingId === selectedBuildingId && s.isActive)

  const selectedStudent = useMemo(() => {
    return students?.find(s => s.id === formData.studentId)
  }, [students, formData.studentId])

  // --- Financial Logic ---
  const foodStats = useMemo(() => {
    if (!selectedStudent || selectedStudent.paymentSystem === 'package') return { balance: 0 }
    const totalBill = selectedStudent.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
    const totalPaid = Number(selectedStudent.foodCost) || 0
    return { balance: totalPaid - totalBill }
  }, [selectedStudent])

  const availableAdvanceForDeduction = useMemo(() => {
    if (!selectedStudent) return 0
    const currentAdvance = selectedStudent.advanceAmount || 0
    const minRequired = selectedStudent.monthlyRent || 0
    return Math.max(0, currentAdvance - minRequired)
  }, [selectedStudent])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        e.preventDefault();
        const form = target.closest('form');
        if (form) {
          const focusables = Array.from(form.querySelectorAll('input, button, [role="combobox"], textarea')) as HTMLElement[];
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.studentId || !selectedBuildingId || (!useAdvanceBalance && !formData.receiver)) return

    const seatPaid = selectedStudent?.paymentSystem === 'package' ? Number(formData.amount) : Number(formData.seatAmount)
    const foodPaid = selectedStudent?.paymentSystem === 'non-package' ? Number(formData.foodAmount) : 0
    const totalAmount = seatPaid + foodPaid

    if (totalAmount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Please enter valid amount." })
      return
    }

    if (useAdvanceBalance && availableAdvanceForDeduction < totalAmount) {
      toast({ variant: "destructive", title: "Restricted", description: "Security lock prevents this deduction." })
      return
    }

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
      studentName: selectedStudent?.name || "Unknown",
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
        ...(selectedStudent?.paymentSystem === 'non-package' && foodPaid > 0 && { foodCost: increment(foodPaid) }),
        updatedAt: serverTimestamp()
      })

      toast({ title: "Success", description: "Payment recorded successfully." })
      setFormData(prev => ({ ...prev, amount: "", seatAmount: "", foodAmount: "", description: "" }))
      setUseAdvanceBalance(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary">Income Entry</h1>
        <p className="text-muted-foreground mt-1">Unified payment entry with advance deduction support.</p>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-primary/5">
          <div className="flex items-center gap-2 text-primary">
            <Wallet size={20} />
            <CardTitle>Payment Details</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6" onKeyDown={handleKeyDown}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Building</Label>
                <Select required onValueChange={setSelectedBuildingId}>
                  <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                  <SelectContent>
                    {buildings?.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Student</Label>
                <Select 
                  required
                  disabled={!selectedBuildingId}
                  onValueChange={(val) => setFormData({...formData, studentId: val})}
                >
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {filteredStudents?.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} (Room: {s.roomNumber} | {s.paymentSystem})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedStudent && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-secondary/30 rounded-lg border">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Monthly Rent</p>
                  <p className="text-lg font-bold">₹{selectedStudent.monthlyRent || 0}</p>
                </div>
                {selectedStudent.paymentSystem === 'non-package' && (
                  <div className="space-y-1">
                    <p className={cn("text-[10px] uppercase font-bold", foodStats.balance >= 0 ? "text-success" : "text-destructive")}>
                      {foodStats.balance >= 0 ? "Food Surplus" : "Food Debt"}
                    </p>
                    <p className={cn("text-lg font-bold", foodStats.balance >= 0 ? "text-success" : "text-destructive")}>
                      ₹{Math.abs(foodStats.balance).toLocaleString()}
                    </p>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] uppercase font-bold text-primary">Advance Pool</p>
                    <span className="text-[8px] flex items-center gap-0.5 text-muted-foreground"><Lock size={8}/> ₹{selectedStudent.monthlyRent} Locked</span>
                  </div>
                  <p className="text-lg font-bold text-primary">₹{selectedStudent.advanceAmount || 0}</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold flex items-center gap-2 cursor-pointer" htmlFor="advSwitch">
                    <ArrowDownToLine size={14} className="text-primary" />
                    Deduct from Advance Pool
                  </Label>
                  <p className="text-[10px] text-muted-foreground">Use student's advance balance (Security Lock: ₹{selectedStudent?.monthlyRent || 0})</p>
                </div>
                <Switch 
                  id="advSwitch" 
                  checked={useAdvanceBalance} 
                  onCheckedChange={setUseAdvanceBalance}
                  disabled={!selectedStudent || availableAdvanceForDeduction <= 0}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Payment Month & Year</Label>
                  <div className="flex gap-2">
                    <Select value={formData.month} onValueChange={val => setFormData({...formData, month: val})}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input className="w-24" type="number" value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} />
                  </div>
                </div>

                {!useAdvanceBalance && (
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select value={formData.method} onValueChange={val => setFormData({...formData, method: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="mobile">Mobile Banking</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedStudent?.paymentSystem === 'package' ? (
                  <div className="space-y-2">
                    <Label>Payment Amount (₹)</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      required 
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                    />
                  </div>
                ) : (
                  <div className="md:col-span-2 grid grid-cols-2 gap-4 p-4 bg-secondary/10 rounded-lg border">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground">Seat Rent Portion (₹)</Label>
                      <Input type="number" placeholder="Rent amount" value={formData.seatAmount} onChange={e => setFormData({...formData, seatAmount: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground">Food Credit Portion (₹)</Label>
                      <Input type="number" placeholder="Food amount" value={formData.foodAmount} onChange={e => setFormData({...formData, foodAmount: e.target.value})} />
                    </div>
                  </div>
                )}

                {!useAdvanceBalance && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Receiver</Label>
                      <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
                        <DialogTrigger asChild>
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs">Add New</Button>
                        </DialogTrigger>
                        <DialogContent onKeyDown={handleKeyDown}>
                          <DialogHeader><DialogTitle>Add Staff</DialogTitle></DialogHeader>
                          <div className="space-y-4 py-4">
                            <Input placeholder="Name" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
                            <Input placeholder="Phone" maxLength={11} value={newStaff.phone} onChange={e => setNewStaff({...newStaff, phone: e.target.value})} />
                          </div>
                          <DialogFooter><Button onClick={handleAddStaff}>Save</Button></DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <Select value={formData.receiver} onValueChange={val => setFormData({...formData, receiver: val})}>
                      <SelectTrigger><SelectValue placeholder="Select receiver" /></SelectTrigger>
                      <SelectContent>
                        {staffList?.map(s => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  placeholder="Payment details..." 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <Button type="submit" className="w-full h-14 text-lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Record Transaction"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
