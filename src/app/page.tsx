
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Building2, 
  TrendingUp,
  History,
  Loader2,
  Plus,
  Wallet,
  Check,
  UserPlus
} from "lucide-react"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, where, Timestamp, doc, setDoc, updateDoc, arrayUnion, increment } from "firebase/firestore"

export default function DashboardPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: "", phone: "" })

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

  // Data for Dashboard
  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students } = useCollection(studentsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const recentPaymentsQuery = useMemoFirebase(() => 
    query(collection(db, "payments"), orderBy("date", "desc"), limit(5)), [db])
  const { data: recentPayments, isLoading: paymentsLoading } = useCollection(recentPaymentsQuery)

  const recentExpensesQuery = useMemoFirebase(() => 
    query(collection(db, "expenses"), orderBy("createdAt", "desc"), limit(5)), [db])
  const { data: recentExpenses, isLoading: expensesLoading } = useCollection(recentExpensesQuery)

  // Quick Payment Form State
  const [selectedBuildingId, setSelectedBuildingId] = useState("")
  const [paymentForm, setPaymentForm] = useState({
    studentId: "",
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    amount: "",
    method: "cash",
    receiver: "",
    description: ""
  })

  const filteredStudents = useMemo(() => {
    return students?.filter(s => s.buildingId === selectedBuildingId && s.isActive) || []
  }, [students, selectedBuildingId])

  const selectedStudent = useMemo(() => {
    return students?.find(s => s.id === paymentForm.studentId)
  }, [students, paymentForm.studentId])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayIncome = useMemo(() => {
    return (recentPayments || [])
      .filter(p => p.date?.toDate() >= today)
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [recentPayments, today])

  const todayExpense = useMemo(() => {
    return (recentExpenses || [])
      .filter(e => e.createdAt?.toDate() >= today)
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [recentExpenses, today])

  const recentActivity = useMemo(() => {
    const combined = [
      ...(recentPayments || []).map(p => ({ ...p, type: 'income', title: `${p.studentName} - Rent` })),
      ...(recentExpenses || []).map(e => ({ ...e, type: 'expense', title: e.description, date: e.createdAt }))
    ].sort((a, b) => {
      const dateA = a.date?.toDate?.() || new Date(0)
      const dateB = b.date?.toDate?.() || new Date(0)
      return dateB.getTime() - dateA.getTime()
    }).slice(0, 5)
    return combined
  }, [recentPayments, recentExpenses])

  const handleQuickPayment = async () => {
    if (!paymentForm.studentId || !paymentForm.amount || !paymentForm.receiver) {
      toast({ variant: "destructive", title: "Error", description: "Please fill required fields (Student, Amount, Receiver)." })
      return
    }

    setIsSubmitting(true)
    const building = buildings?.find(b => b.id === selectedBuildingId)
    const amount = Number(paymentForm.amount)
    const paymentId = doc(collection(db, "payments")).id
    const summaryId = `${paymentForm.year}-${paymentForm.month}`

    const paymentRecord = {
      amount,
      buildingId: selectedBuildingId,
      buildingName: building?.name || "Unknown",
      studentName: selectedStudent?.name || "Unknown",
      studentId: paymentForm.studentId,
      type: "income",
      month: paymentForm.month,
      year: paymentForm.year,
      method: paymentForm.method,
      receiver: paymentForm.receiver,
      description: paymentForm.description,
      date: new Date().toISOString()
    }

    try {
      await setDoc(doc(db, "payments", paymentId), {
        ...paymentRecord,
        date: Timestamp.now(),
        createdAt: Timestamp.now(),
      })

      // Update student: decrement dueAmount
      await updateDoc(doc(db, "students", paymentForm.studentId), {
        paymentsHistory: arrayUnion(paymentRecord),
        dueAmount: increment(-amount),
        updatedAt: Timestamp.now()
      })

      await setDoc(doc(db, "summaries", summaryId), {
        totalIncome: increment(amount),
        [`buildingIncome.${building?.name || 'Unknown'}`]: increment(amount),
        updatedAt: Timestamp.now()
      }, { merge: true })

      toast({ title: "Payment Recorded", description: `Quick payment of ₹${amount} saved and student due updated.` })
      setIsPaymentOpen(false)
      setPaymentForm({
        studentId: "",
        month: new Date().toLocaleString('default', { month: 'long' }),
        year: new Date().getFullYear().toString(),
        amount: "",
        method: "cash",
        receiver: "",
        description: ""
      })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddStaff = async () => {
    if (!newStaff.name) return
    setIsSubmitting(true)
    try {
      const staffId = doc(collection(db, "staff")).id
      await setDoc(doc(db, "staff", staffId), {
        ...newStaff,
        createdAt: Timestamp.now()
      })
      toast({ title: "Success", description: "Staff added to receivers list." })
      setNewStaff({ name: "", phone: "" })
      setIsAddStaffOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const stats = [
    {
      title: "Today's Income",
      amount: `₹${todayIncome.toLocaleString()}`,
      change: "Recorded today",
      icon: ArrowUpCircle,
      color: "text-income"
    },
    {
      title: "Today's Expenses",
      amount: `₹${todayExpense.toLocaleString()}`,
      change: "Logged today",
      icon: ArrowDownCircle,
      color: "text-expense"
    },
    {
      title: "Active Students",
      amount: students?.filter(s => s.isActive).length || 0,
      change: "Current residents",
      icon: TrendingUp,
      color: "text-primary"
    },
    {
      title: "Total Buildings",
      amount: buildings?.length || 0,
      change: `${buildings?.reduce((acc, b) => acc + (b.roomsCount || 0), 0) || 0} Rooms total`,
      icon: Building2,
      color: "text-primary"
    }
  ]

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight text-primary">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Daily overview and quick insights for your hostel network.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="shadow-sm border-none bg-card hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.amount}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4 shadow-sm border-none">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Recent Transactions</CardTitle>
              <p className="text-sm text-muted-foreground">Latest income and expenses recorded.</p>
            </div>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {paymentsLoading || expensesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivity.map((tx, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[150px] font-bold">{tx.title}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {tx.date?.toDate?.().toLocaleDateString() || 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal capitalize">
                          {tx.category || tx.paymentType || 'General'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-bold ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}>
                        {tx.type === 'income' ? '+' : '-'}₹{tx.amount?.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {recentActivity.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No recent activity.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3 shadow-sm border-none">
          <CardHeader>
            <CardTitle>Building Occupancy</CardTitle>
            <p className="text-sm text-muted-foreground">Room usage across properties.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {buildings?.map((building: any) => {
              const occupiedCount = building.occupiedSeats || 0;
              const totalSeats = building.totalSeats || 1;
              const percentage = Math.min((occupiedCount / totalSeats) * 100, 100);
              
              return (
                <div key={building.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{building.name}</span>
                    <span className="text-muted-foreground">
                      {occupiedCount}/{totalSeats} Students
                    </span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {(!buildings || buildings.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">No building data available.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg border-2 border-white bg-primary hover:bg-primary/90 transition-transform active:scale-95">
              <Plus className="h-8 w-8 text-white" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" onKeyDown={handleKeyDown}>
            <DialogHeader>
              <DialogTitle>Quick Payment Record</DialogTitle>
              <DialogDescription>Record a student payment directly from the dashboard.</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Building</Label>
                <Select onValueChange={setSelectedBuildingId}>
                  <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                  <SelectContent>
                    {buildings?.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Student</Label>
                <Select 
                  disabled={!selectedBuildingId} 
                  onValueChange={val => setPaymentForm({...paymentForm, studentId: val})}
                >
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {filteredStudents.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.paymentSystem})</SelectItem>
                    ))}
                    {filteredStudents.length === 0 && selectedBuildingId && (
                      <div className="p-2 text-xs text-center text-muted-foreground">No active students in this building</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedStudent && (
                <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 text-xs flex justify-between">
                  <span>Standard Rent: <strong>₹{selectedStudent.monthlyRent}</strong></span>
                  <span>Prev. Due: <strong className="text-destructive">₹{selectedStudent.dueAmount || 0}</strong></span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select value={paymentForm.month} onValueChange={val => setPaymentForm({...paymentForm, month: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Receiver Name</Label>
                  <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
                    <DialogTrigger asChild>
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                        <UserPlus size={12} className="mr-1" /> Add New
                      </Button>
                    </DialogTrigger>
                    <DialogContent onKeyDown={handleKeyDown}>
                      <DialogHeader>
                        <DialogTitle>Add New Receiver</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Full Name</Label>
                          <Input value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone Number</Label>
                          <Input 
                            value={newStaff.phone} 
                            maxLength={11}
                            onChange={e => setNewStaff({...newStaff, phone: e.target.value})} 
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddStaff} disabled={isSubmitting}>Save Receiver</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <Select value={paymentForm.receiver} onValueChange={val => setPaymentForm({...paymentForm, receiver: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select receiver" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList?.map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name} ({s.phone})</SelectItem>
                    ))}
                    {(!staffList || staffList.length === 0) && (
                      <div className="p-2 text-xs text-muted-foreground text-center">No staff found. Please add one.</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleQuickPayment} className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Wallet size={16} />}
                Confirm Quick Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
