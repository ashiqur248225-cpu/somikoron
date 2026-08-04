
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  CheckCircle2, XCircle, Loader2, Eye, Wallet, Smartphone, 
  UserCircle, Building2, Calendar, Trash2, ArrowUpRight, Info, AlertCircle, Clock, History, Receipt, ChevronRight,
  Utensils, ShieldCheck, Wifi, Soup
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, doc, deleteDoc, updateDoc, setDoc, serverTimestamp, increment, where, getDoc, arrayUnion, writeBatch } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function StudentPaymentsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [selectedReq, setSelectedReq] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  
  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  const requestsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "paymentRequests"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: rawRequests, isLoading } = useCollection(requestsQuery)

  const requests = useMemo(() => {
    if (!rawRequests) return []
    return [...rawRequests].filter(r => r.status === 'pending').sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt)
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt)
      return dateB.getTime() - dateA.getTime()
    })
  }, [rawRequests])

  // Fetch Student and Configs for verification
  const [studentData, setStudentData] = useState<any>(null)
  const [billingConfig, setBillingConfig] = useState<any>(null)
  const [isStudentLoading, setIsStudentLoading] = useState(false)

  useEffect(() => {
    if (selectedReq?.studentId) {
      setIsStudentLoading(true)
      const fetchData = async () => {
        const sSnap = await getDoc(doc(db, "students", selectedReq.studentId))
        if (sSnap.exists()) setStudentData(sSnap.data())
        
        const bSnap = await getDoc(doc(db, "configs", `billingConfig_${userBranch}`))
        if (bSnap.exists()) setBillingConfig(bSnap.data())
        
        setIsStudentLoading(false)
      }
      fetchData()
    } else {
      setStudentData(null)
    }
  }, [selectedReq, db, userBranch])

  const handleApprove = async () => {
    if (!selectedReq || !studentData) return
    setIsProcessing(true)
    const batch = writeBatch(db)
    try {
      const pId = doc(collection(db, "payments")).id
      const totalAmt = Number(selectedReq.amount)
      
      let remaining = totalAmt;
      let seatPaid = 0;
      let foodPaid = 0;
      let advancePaid = 0;
      let cookingBill = 0;
      let wifiBill = 0;

      const currentDues = { ...(studentData.duesBreakdown || {}) };
      const now = new Date();
      const currentMonth = MONTHS[now.getMonth()];
      const currentYear = now.getFullYear().toString();
      const targetLabel = `${currentMonth} ${currentYear}`;

      // 1. DISTRIBUTE TO RENT (Specific Current Month)
      if (selectedReq.payRent && remaining > 0) {
        if (currentDues[targetLabel]) {
          const dueAmt = Number(currentDues[targetLabel].amount);
          const pay = Math.min(remaining, dueAmt);
          seatPaid += pay;
          remaining -= pay;
          if (pay >= dueAmt) delete currentDues[targetLabel];
          else currentDues[targetLabel].amount = dueAmt - pay;
        }
      }

      // 2. DISTRIBUTE TO DUE (Arrears/Historical)
      if (selectedReq.payDue && remaining > 0) {
        const sortedArrears = Object.keys(currentDues).sort((a, b) => {
          const [mA, yA] = a.split(' '); const [mB, yB] = b.split(' ');
          if (yA !== yB) return Number(yA) - Number(yB);
          return MONTHS.indexOf(mA) - MONTHS.indexOf(mB);
        }).filter(label => label !== targetLabel); // Already handled targetLabel if payRent was true

        for (const m of sortedArrears) {
          if (remaining <= 0) break;
          const dueAmt = Number(currentDues[m].amount);
          const pay = Math.min(remaining, dueAmt);
          seatPaid += pay;
          remaining -= pay;
          if (pay >= dueAmt) delete currentDues[m];
          else currentDues[m].amount = dueAmt - pay;
        }
      }

      // 3. DISTRIBUTE TO UTILITIES (Cooking Bill)
      if (selectedReq.payUtilities && remaining > 0 && billingConfig) {
        const cCost = Number(billingConfig.cookingBill || 0);
        const wCost = Number(billingConfig.wifiBill || 0);
        // Only Cooking Bill as per requested options rename
        if (remaining >= cCost && cCost > 0) { cookingBill = cCost; remaining -= cCost; }
      }

      // 4. DISTRIBUTE TO FOOD (Food Advance)
      if (selectedReq.payFood && remaining > 0) {
        foodPaid = remaining;
        remaining = 0;
      }

      // Final leftover fallback (if nothing specific satisfied everything, send to Advance)
      if (remaining > 0) {
        advancePaid = remaining;
        remaining = 0;
      }

      const finalTotalDue = Object.values(currentDues).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);

      const pRecord = {
        id: pId, amount: totalAmt, seatAmount: seatPaid, foodAmount: foodPaid, advanceAmount: advancePaid,
        cookingBill, wifiBill, studentId: selectedReq.studentId, studentName: selectedReq.studentName,
        buildingId: studentData.buildingId, buildingName: studentData.buildingName, roomNumber: studentData.roomNumber,
        branch: userBranch, method: selectedReq.method, transactionId: selectedReq.transactionId, receiver: userName,
        date: new Date().toISOString(), createdAt: new Date().toISOString(),
        description: `Approved Student Request. Purpose: ${selectedReq.payRent ? 'Rent ' : ''}${selectedReq.payDue ? 'Due ' : ''}${selectedReq.payFood ? 'FoodAdv ' : ''}. TXID: ${selectedReq.transactionId}`
      }

      batch.set(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp() })
      
      batch.update(doc(db, "students", selectedReq.studentId), {
        paymentsHistory: arrayUnion(pRecord),
        historicalTotalReceived: increment(totalAmt),
        totalDue: finalTotalDue,
        duesBreakdown: currentDues,
        advanceAmount: increment(advancePaid),
        foodDueAmount: increment(foodPaid),
        updatedAt: serverTimestamp()
      })

      const balanceRef = doc(db, "netBalance", userBranch)
      const methodKeyMap: Record<string, string> = { 'cash': 'totalCash', 'bkash': 'totalBkash', 'nagad': 'totalNagad', 'bank': 'totalBank' }
      const methodKey = methodKeyMap[selectedReq.method] || 'totalCash'
      batch.set(balanceRef, { [methodKey]: increment(totalAmt), totalHandCash: increment(totalAmt), lastUpdated: serverTimestamp() }, { merge: true })

      batch.update(doc(db, "paymentRequests", selectedReq.id), { status: "approved", approvedBy: userName, updatedAt: serverTimestamp() })

      await batch.commit()
      toast({ title: "Payment Accepted", description: `Rent ${seatPaid}, Food ${foodPaid}, Cooking ${cookingBill}` })
      setIsDetailOpen(false)
      setSelectedReq(null)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedReq) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, "paymentRequests", selectedReq.id), { status: "rejected", updatedAt: serverTimestamp() })
      toast({ title: "Request Rejected" })
      setIsDetailOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Student Payments</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Verify student digital submissions.</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white rounded-3xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Purpose (Student Sel.)</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(req => (
                  <TableRow key={req.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => { setSelectedReq(req); setIsDetailOpen(true); }}>
                    <TableCell className="text-[10px] font-bold text-slate-400">
                      {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : 'Just now'}
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-800">{req.studentName}</div>
                      <div className="text-[10px] text-muted-foreground">Room {req.roomNumber}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {req.payRent && <Badge variant="secondary" className="text-[7px] h-4 bg-blue-50 text-blue-600">Rent</Badge>}
                        {req.payDue && <Badge variant="secondary" className="text-[7px] h-4 bg-destructive/10 text-destructive">Due</Badge>}
                        {req.payFood && <Badge variant="secondary" className="text-[7px] h-4 bg-green-50 text-success">FoodAdv</Badge>}
                        {req.payUtilities && <Badge variant="secondary" className="text-[7px] h-4 bg-orange-50 text-orange-600">Cooking</Badge>}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="uppercase text-[9px] font-black">{req.method}</Badge></TableCell>
                    <TableCell className="text-right font-black text-lg text-primary">৳{req.amount}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" className="font-bold gap-2">Review <ChevronRight size={14}/></Button></TableCell>
                  </TableRow>
                ))}
                {requests.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No pending requests.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden">
          <div className="h-2 bg-primary w-full" />
          <DialogHeader className="p-8 pb-4">
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Receipt className="text-primary"/> Smart Verify & Distribute
            </DialogTitle>
            <DialogDescription>System will automatically assign funds based on student selection.</DialogDescription>
          </DialogHeader>

          {selectedReq && (
            <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest ml-1">Submission Details</h3>
                  <div className="p-6 bg-slate-50 rounded-3xl border space-y-4 shadow-inner">
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-muted-foreground uppercase">Amount:</span><span className="font-black text-2xl text-primary">৳{selectedReq.amount}</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-muted-foreground uppercase">Method:</span><Badge className="font-black uppercase">{selectedReq.method}</Badge></div>
                    <Separator className="bg-slate-200" />
                    <div className="space-y-1">
                      <p className="text-[8px] font-black uppercase text-muted-foreground">Reference Info</p>
                      <p className="text-xs font-bold font-mono text-slate-700">TXID: {selectedReq.transactionId}</p>
                      <p className="text-xs font-bold text-slate-600">Sender: {selectedReq.senderInfo}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                   <h3 className="text-[10px] font-black uppercase text-primary tracking-widest ml-1">Student Purpose Selection</h3>
                   <div className="flex flex-wrap gap-2">
                      <div className={cn("px-4 py-2 rounded-2xl border flex items-center gap-2", selectedReq.payRent ? "bg-blue-50 border-blue-200 text-blue-700" : "opacity-30")}>
                        <Home size={14}/> <span className="text-xs font-bold">Rent</span>
                      </div>
                      <div className={cn("px-4 py-2 rounded-2xl border flex items-center gap-2", selectedReq.payDue ? "bg-red-50 border-red-200 text-red-700" : "opacity-30")}>
                        <History size={14}/> <span className="text-xs font-bold">Due</span>
                      </div>
                      <div className={cn("px-4 py-2 rounded-2xl border flex items-center gap-2", selectedReq.payFood ? "bg-green-50 border-green-200 text-green-700" : "opacity-30")}>
                        <Utensils size={14}/> <span className="text-xs font-bold">Food Advance</span>
                      </div>
                      <div className={cn("px-4 py-2 rounded-2xl border flex items-center gap-2", selectedReq.payUtilities ? "bg-orange-50 border-orange-200 text-orange-700" : "opacity-30")}>
                        <Wifi size={14}/> <span className="text-xs font-bold">Cooking Bill</span>
                      </div>
                   </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest ml-1">Current Ledger Snapshot</h3>
                  <div className="p-6 bg-slate-900 rounded-[2rem] text-white space-y-4 shadow-xl">
                    {isStudentLoading ? <Loader2 className="animate-spin mx-auto text-primary"/> : studentData ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-white/40 uppercase">Total Rent Due</span>
                          <span className="text-lg font-black text-red-400">৳{studentData.totalDue || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-white/40 uppercase">Food Balance</span>
                          <span className={cn("text-lg font-black", (studentData.foodDueAmount || 0) < 0 ? "text-red-400" : "text-green-400")}>
                            ৳{studentData.foodDueAmount || 0}
                          </span>
                        </div>
                        <Separator className="bg-white/10" />
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <p className="text-[8px] font-bold text-white/30 uppercase">Monthly Rent</p>
                              <p className="font-bold">৳{studentData.monthlyRent}</p>
                           </div>
                           <div className="space-y-1 text-right">
                              <p className="text-[8px] font-bold text-white/30 uppercase">Advance</p>
                              <p className="font-bold">৳{studentData.advanceAmount}</p>
                           </div>
                        </div>
                      </>
                    ) : <p className="text-xs italic text-center py-4">Resident record missing</p>}
                  </div>
                </div>
                
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex gap-3">
                   <Info className="text-primary h-5 w-5 shrink-0" />
                   <p className="text-[9px] text-slate-600 leading-relaxed font-medium">
                     <b>Smart Split:</b> এপ্রুভ করলে সিস্টেম স্টুডেন্টের পছন্দ অনুযায়ী প্রথমে বর্তমান ভাড়া বা পুরনো বকেয়া সমন্বয় করবে।
                   </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-8 bg-slate-50 border-t grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={handleReject} disabled={isProcessing} className="rounded-2xl border-destructive text-destructive h-14 font-bold text-lg hover:bg-red-50">Reject Entry</Button>
            <Button onClick={handleApprove} disabled={isProcessing || !studentData} className="rounded-2xl bg-success hover:bg-success/90 h-14 gap-3 text-white font-black text-xl shadow-xl shadow-success/20">
              {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24}/>} Confirm & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
