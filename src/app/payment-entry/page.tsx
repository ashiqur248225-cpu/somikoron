
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, increment, updateDoc, arrayUnion, query, where, getDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
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
import { 
  Wallet, 
  Loader2, 
  CheckCircle2, 
  ChevronLeft,
  Smartphone
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2024", "2025", "2026", "2027", "2028"];

export default function PaymentEntryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const router = useRouter()
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    buildingId: "all",
    roomNumber: "all",
    studentId: "",
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    seatAmount: "",
    foodAmount: "",
    addAdvanceAmount: "0",
    method: "cash",
    receiver: "",
    description: ""
  })

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

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

  const staffQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "staff"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: staffList } = useCollection(staffQuery)

  const selectedStudent = useMemo(() => 
    students?.find(s => s.id === formData.studentId), 
    [students, formData.studentId]
  )

  const handleCreatePayment = async () => {
    if (!formData.studentId || !formData.receiver || !selectedStudent) {
      toast({ variant: "destructive", title: "Error", description: "Please complete all fields." })
      return
    }
    setIsSubmitting(true)
    try {
      const pId = doc(collection(db, "payments")).id
      const seatPaid = Number(formData.seatAmount || 0)
      const foodPaid = Number(formData.foodAmount || 0)
      const extraAdvance = Number(formData.addAdvanceAmount || 0)
      const totalAmt = seatPaid + foodPaid + extraAdvance
      
      const pRecord = {
        id: pId, amount: totalAmt, seatAmount: seatPaid, foodAmount: foodPaid, advanceAmount: extraAdvance,
        studentName: selectedStudent.name, studentId: selectedStudent.id, 
        buildingId: selectedStudent.buildingId, buildingName: selectedStudent.buildingName, 
        roomNumber: selectedStudent.roomNumber, branch: userBranch,
        type: "income", month: formData.month, year: formData.year, method: formData.method, 
        receiver: formData.receiver, description: formData.description, date: new Date().toISOString()
      }

      await setDoc(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp(), createdAt: serverTimestamp() })
      
      const currentDues = { ...(selectedStudent.duesBreakdown || {}) };
      const targetLabel = `${formData.month} ${formData.year}`;
      let remainingRentPaid = seatPaid;

      if (currentDues[targetLabel] && remainingRentPaid > 0) {
        const dueAmt = Number(currentDues[targetLabel].amount);
        if (remainingRentPaid >= dueAmt) {
          remainingRentPaid -= dueAmt;
          delete currentDues[targetLabel];
        } else {
          currentDues[targetLabel].amount = dueAmt - remainingRentPaid;
          remainingRentPaid = 0;
        }
      }

      if (remainingRentPaid > 0) {
        const sortedMonths = Object.keys(currentDues).sort((a, b) => {
          const [mA, yA] = a.split(' ');
          const [mB, yB] = b.split(' ');
          if (yA !== yB) return Number(yA) - Number(yB);
          return MONTHS.indexOf(mA) - MONTHS.indexOf(mB);
        });
        for (const m of sortedMonths) {
          if (remainingRentPaid <= 0) break;
          const dueAmt = Number(currentDues[m].amount);
          if (remainingRentPaid >= dueAmt) {
            remainingRentPaid -= dueAmt;
            delete currentDues[m];
          } else {
            currentDues[m].amount = dueAmt - remainingRentPaid;
            remainingRentPaid = 0;
          }
        }
      }

      const finalTotalDue = Object.values(currentDues).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);

      await updateDoc(doc(db, "students", selectedStudent.id), {
        paymentsHistory: arrayUnion(pRecord),
        advanceAmount: increment(extraAdvance),
        totalDue: finalTotalDue,
        duesBreakdown: currentDues,
        foodDueAmount: increment(foodPaid),
        historicalTotalReceived: increment(totalAmt),
        updatedAt: serverTimestamp()
      })
      
      toast({ title: "Payment Successful" })
      router.push(`/receipts/${pId}`)
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message }) 
    } finally { 
      setIsSubmitting(false) 
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ChevronLeft />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">Payment Entry</h1>
          <p className="text-muted-foreground text-sm">Record incoming resident payment for {userBranch}.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        <div className="h-2 bg-success w-full" />
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-success">
            <Wallet size={20}/> Transaction Details
          </CardTitle>
          <CardDescription>Select resident and enter amount.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Building</Label>
              <Select value={formData.buildingId} onValueChange={val => setFormData({...formData, buildingId: val, roomNumber: "all", studentId: ""})}>
                <SelectTrigger className="bg-slate-50 border-none h-11 rounded-xl shadow-inner font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Building</SelectItem>
                  {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Room</Label>
              <Select value={formData.roomNumber} onValueChange={val => setFormData({...formData, roomNumber: val, studentId: ""})}>
                <SelectTrigger className="bg-slate-50 border-none h-11 rounded-xl shadow-inner font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Room</SelectItem>
                  {Array.from(new Set(students?.filter(s => (formData.buildingId === 'all' || s.buildingId === formData.buildingId)).map(s => s.roomNumber))).sort().map(r => (
                    <SelectItem key={r} value={r}>Room {r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Select Student</Label>
            <Select value={formData.studentId} onValueChange={val => setFormData({...formData, studentId: val})}>
              <SelectTrigger className="bg-slate-50 border-none h-12 rounded-xl shadow-inner font-black text-lg"><SelectValue placeholder="Choose Resident" /></SelectTrigger>
              <SelectContent>
                {students?.filter(s => 
                  (formData.buildingId === 'all' || s.buildingId === formData.buildingId) && 
                  (formData.roomNumber === 'all' || s.roomNumber === formData.roomNumber) && 
                  s.isActive
                ).map(s => <SelectItem key={s.id} value={s.id}>{s.name} (R-{s.roomNumber})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedStudent && (
            <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-4 shadow-xl">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <p className="text-[8px] font-black uppercase text-success/70 tracking-widest">Monthly Rent</p>
                  <p className="text-xl font-black">৳{selectedStudent.monthlyRent || 0}</p>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[8px] font-black uppercase text-primary/70 tracking-widest">Security Advance</p>
                  <p className="text-xl font-black">৳{selectedStudent.advanceAmount || 0}</p>
                </div>
              </div>
              
              <Separator className="bg-white/10" />
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-[8px] font-black uppercase text-destructive tracking-widest">Outstanding Dues</p>
                  <Badge variant="destructive" className="text-[8px] h-4">৳{selectedStudent.totalDue || 0}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-[100px] overflow-y-auto pr-1">
                  {Object.entries(selectedStudent.duesBreakdown || {}).map(([label, data]: any) => (
                    <div key={label} className="bg-white/5 p-2 rounded-xl flex justify-between items-center border border-white/5">
                      <span className="text-[8px] font-medium">{label}</span>
                      <span className="text-[9px] font-black text-destructive">৳{data.amount}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedStudent.paymentSystem === 'non-package' && (
                <div className="pt-2 flex justify-between items-center border-t border-white/10">
                  <p className="text-[8px] font-black uppercase text-orange-400 tracking-widest">Food Balance</p>
                  <span className={cn("text-xs font-black", (selectedStudent.foodDueAmount || 0) < 0 ? "text-destructive" : "text-success")}>
                    ৳{selectedStudent.foodDueAmount || 0}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label className="text-xs">Month</Label><Select value={formData.month} onValueChange={v => setFormData({...formData, month: v})}><SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Year</Label><Select value={formData.year} onValueChange={v => setFormData({...formData, year: v})}><SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
          </div>

          <div className="p-6 border-2 border-success/10 bg-success/5 rounded-3xl space-y-4 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Rent Amount</Label>
                <Input type="number" value={formData.seatAmount} onChange={e => setFormData({...formData, seatAmount: e.target.value})} className="bg-white h-12 text-xl font-black" placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Food Amount</Label>
                <Input disabled={selectedStudent?.paymentSystem === 'package'} type="number" value={formData.foodAmount} onChange={e => setFormData({...formData, foodAmount: e.target.value})} className="bg-white h-12 text-xl font-black" placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-primary">Add to Advance (Security)</Label>
              <Input type="number" value={formData.addAdvanceAmount} onChange={e => setFormData({...formData, addAdvanceAmount: e.target.value})} className="bg-white h-12 border-primary/20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Method</Label>
              <Select value={formData.method} onValueChange={v => setFormData({...formData, method: v})}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Receiver</Label>
              <Select value={formData.receiver} onValueChange={v => setFormData({...formData, receiver: v})}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Staff"/></SelectTrigger>
                <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Additional notes..." className="rounded-2xl bg-slate-50 border-none shadow-inner min-h-[100px]" />
        </CardContent>
        <CardFooter className="p-8 bg-slate-50 border-t">
          <Button onClick={handleCreatePayment} disabled={isSubmitting || !formData.studentId} className="w-full h-16 rounded-2xl text-xl font-black bg-success hover:bg-success/90 shadow-2xl shadow-success/20">
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2"/>} Confirm & Generate Receipt
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
