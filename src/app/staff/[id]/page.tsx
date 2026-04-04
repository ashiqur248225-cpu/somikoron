
"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, updateDoc, serverTimestamp, arrayUnion, collection, setDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { 
  UserCircle, Phone, MapPin, 
  Wallet, History, Plus, Loader2, 
  ChevronLeft, Calendar, Shield, Briefcase,
  Banknote, CreditCard, Smartphone, Receipt
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function StaffProfilePage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<any>
}) {
  const { id } = React.use(params)
  // React.use(searchParams) // Add if needed
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)

  const [paymentData, setPaymentData] = useState({
    amount: "",
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    method: "cash",
    description: ""
  })

  const staffRef = useMemoFirebase(() => id ? doc(db, "staff", id) : null, [db, id])
  const { data: staff, isLoading } = useDoc(staffRef)

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const handlePaySalary = async () => {
    if (!staff || !staffRef) return
    if (!paymentData.amount) {
      toast({ variant: "destructive", title: "Error", description: "Please enter salary amount." })
      return
    }

    setIsUpdating(true)
    try {
      const amount = Number(paymentData.amount)
      const salaryRecord = {
        amount,
        month: paymentData.month,
        year: paymentData.year,
        date: new Date().toISOString(),
        method: paymentData.method,
        description: paymentData.description || `Salary for ${paymentData.month} ${paymentData.year}`
      }

      // 1. Update Staff Salary History
      await updateDoc(staffRef, {
        salaryHistory: arrayUnion(salaryRecord),
        updatedAt: serverTimestamp()
      })

      // 2. Create Expense Record
      const expenseId = doc(collection(db, "expenses")).id
      await setDoc(doc(db, "expenses", expenseId), {
        id: expenseId,
        amount,
        category: "salary",
        buildingId: "none",
        buildingName: "Staff Payroll",
        branch: staff.branch,
        expenseDate: new Date().toISOString().split('T')[0],
        expensePartyName: localStorage.getItem("user_name") || "Admin", // Paid by
        receiver: staff.name, // Paid to
        method: paymentData.method,
        description: `Salary Payment: ${staff.name} - ${paymentData.month} ${paymentData.year}. ${paymentData.description}`,
        createdAt: serverTimestamp()
      })

      toast({ title: "Payment Recorded", description: `Salary paid to ${staff.name} for ${paymentData.month}.` })
      setIsPayDialogOpen(false)
      setPaymentData({ ...paymentData, amount: "", description: "" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
  if (!staff) return <div className="text-center p-20">Employee not found.</div>

  const sortedHistory = [...(staff.salaryHistory || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ChevronLeft />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary tracking-tight">Staff Profile</h1>
            <p className="text-muted-foreground text-sm">Detailed information and payroll history.</p>
          </div>
        </div>
        <Button onClick={() => setIsPayDialogOpen(true)} className="gap-2 h-11 px-6 rounded-xl shadow-lg bg-success hover:bg-success/90">
          <Plus size={18} /> Pay Salary
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-1 border-none shadow-xl rounded-3xl overflow-hidden bg-white">
          <div className="h-24 bg-primary w-full relative">
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
              <div className="h-20 w-20 rounded-full border-4 border-white bg-secondary flex items-center justify-center text-primary shadow-lg">
                {staff.staffType === 'management' ? <Shield size={32}/> : <Briefcase size={32}/>}
              </div>
            </div>
          </div>
          <CardContent className="pt-14 pb-8 text-center space-y-4">
            <div>
              <h2 className="text-xl font-black text-slate-800">{staff.name}</h2>
              <Badge variant="secondary" className="mt-1 bg-primary/10 text-primary border-none font-bold uppercase text-[10px]">
                {staff.role}
              </Badge>
            </div>
            
            <Separator />
            
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Phone size={16} className="text-slate-400" />
                <span className="font-medium">{staff.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <MapPin size={16} className="text-slate-400" />
                <span className="font-medium">{staff.address || "Address not set"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Calendar size={16} className="text-slate-400" />
                <span className="font-medium">Joined: {staff.createdAt?.toDate ? staff.createdAt.toDate().toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="border-none shadow-md bg-white border-l-[6px] border-l-orange-500 rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Monthly Salary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-800">৳{staff.monthlySalary?.toLocaleString() || 0}</div>
                <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Contracted Base Pay</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-success">Total Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-800">
                  ৳{(staff.salaryHistory || []).reduce((acc: number, curr: any) => acc + curr.amount, 0).toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Cumulative Payroll</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardHeader className="border-b bg-slate-50/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><History size={16}/> Salary Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHistory.map((h: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">{new Date(h.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-bold text-slate-700">{h.month} {h.year}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{h.method}</Badge></TableCell>
                      <TableCell className="text-right font-black text-slate-800">৳{h.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {sortedHistory.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">No payment records found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Disburse Salary</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex justify-between items-center">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-orange-600 uppercase">Monthly Base</p>
                <p className="text-xl font-black text-slate-800">৳{staff.monthlySalary?.toLocaleString()}</p>
              </div>
              <Wallet className="text-orange-400" size={32} />
            </div>

            <div className="space-y-2">
              <Label>Salary Amount (৳)</Label>
              <Input type="number" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} placeholder={staff.monthlySalary?.toString()} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>For Month</Label>
                <Select value={paymentData.month} onValueChange={val => setPaymentData({...paymentData, month: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={paymentData.year} onValueChange={val => setPaymentData({...paymentData, year: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["2024", "2025", "2026"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {['cash', 'bkash', 'nagad', 'bank'].map((m) => (
                  <Button 
                    key={m}
                    type="button"
                    variant={paymentData.method === m ? 'default' : 'outline'}
                    className="h-9 text-xs capitalize gap-2"
                    onClick={() => setPaymentData({...paymentData, method: m})}
                  >
                    {m === 'cash' && <Banknote size={14}/>}
                    {m === 'bank' && <CreditCard size={14}/>}
                    {(m === 'bkash' || m === 'nagad') && <Smartphone size={14}/>}
                    {m}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reference / Notes</Label>
              <Input value={paymentData.description} onChange={e => setPaymentData({...paymentData, description: e.target.value})} placeholder="e.g. Paid with bonus" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handlePaySalary} disabled={isUpdating} className="w-full bg-success hover:bg-success/90 h-12 text-lg font-bold shadow-lg shadow-success/20">
              {isUpdating ? <Loader2 className="animate-spin" /> : <><Receipt size={18} className="mr-2"/> Confirm Salary Disbursement</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
