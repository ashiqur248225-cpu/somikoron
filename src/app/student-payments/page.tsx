
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  CheckCircle2, XCircle, Loader2, Eye, Wallet, Smartphone, 
  UserCircle, Building2, Calendar, Trash2, ArrowUpRight, Info, AlertCircle, Clock, History, Receipt, ChevronRight
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

  // Fetch Student data for verification when selecting a request
  const [studentData, setStudentData] = useState<any>(null)
  const [isStudentLoading, setIsStudentLoading] = useState(false)

  useEffect(() => {
    if (selectedReq?.studentId) {
      setIsStudentLoading(true)
      const fetchStudent = async () => {
        const sSnap = await getDoc(doc(db, "students", selectedReq.studentId))
        if (sSnap.exists()) setStudentData(sSnap.data())
        setIsStudentLoading(false)
      }
      fetchStudent()
    } else {
      setStudentData(null)
    }
  }, [selectedReq, db])

  const handleApprove = async () => {
    if (!selectedReq || !studentData) return
    setIsProcessing(true)
    const batch = writeBatch(db)
    try {
      const pId = doc(collection(db, "payments")).id
      const amount = Number(selectedReq.amount)
      
      const pRecord = {
        id: pId,
        amount,
        studentId: selectedReq.studentId,
        studentName: selectedReq.studentName,
        buildingId: studentData.buildingId,
        buildingName: studentData.buildingName,
        roomNumber: studentData.roomNumber,
        branch: userBranch,
        method: selectedReq.method,
        transactionId: selectedReq.transactionId,
        receiver: userName,
        date: new Date().toISOString(),
        description: `Student App Payment: ${selectedReq.purpose}. TXID: ${selectedReq.transactionId}`,
        createdAt: new Date().toISOString() // Fixed: serverTimestamp() cannot be used inside arrayUnion
      }

      batch.set(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp() })
      
      // Update Student History and Balances
      const rentPaid = Math.min(amount, studentData.totalDue || 0)

      batch.update(doc(db, "students", selectedReq.studentId), {
        paymentsHistory: arrayUnion(pRecord),
        historicalTotalReceived: increment(amount),
        totalDue: increment(-rentPaid),
        updatedAt: serverTimestamp()
      })

      // Update Net Balance
      const balanceRef = doc(db, "netBalance", userBranch)
      const methodKeyMap: Record<string, string> = { 'cash': 'totalCash', 'bkash': 'totalBkash', 'nagad': 'totalNagad', 'bank': 'totalBank' }
      const methodKey = methodKeyMap[selectedReq.method] || 'totalCash'
      batch.set(balanceRef, { [methodKey]: increment(amount), totalHandCash: increment(amount), lastUpdated: serverTimestamp() }, { merge: true })

      // Mark request as approved
      batch.update(doc(db, "paymentRequests", selectedReq.id), { status: "approved", approvedBy: userName, updatedAt: serverTimestamp() })

      await batch.commit()
      toast({ title: "Payment Accepted", description: "Records updated successfully." })
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
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Payment Requests</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Review student submissions.</p>
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
                    <TableCell><Badge variant="outline" className="uppercase text-[9px] font-black">{req.method}</Badge></TableCell>
                    <TableCell className="text-right font-black text-lg text-primary">৳{req.amount}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" className="font-bold gap-2">Review <ChevronRight size={14}/></Button></TableCell>
                  </TableRow>
                ))}
                {requests.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No pending requests.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="text-primary"/> Verify Student Payment</DialogTitle>
            <DialogDescription>Cross-check transaction ID and current dues.</DialogDescription>
          </DialogHeader>

          {selectedReq && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-primary tracking-widest ml-1">Submission Details</h3>
                <div className="p-5 bg-slate-50 rounded-2xl border space-y-3">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Amount:</span><span className="font-black text-lg">৳{selectedReq.amount}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Method:</span><span className="font-bold uppercase text-primary">{selectedReq.method}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">TXID:</span><span className="font-mono font-bold text-orange-600">{selectedReq.transactionId}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Account:</span><span>{selectedReq.account}</span></div>
                  <Separator />
                  <p className="text-[10px] text-slate-500 italic">"{selectedReq.purpose}"</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-primary tracking-widest ml-1">Student Snapshot</h3>
                <div className="p-5 bg-slate-900 rounded-2xl text-white space-y-3 shadow-xl">
                  {isStudentLoading ? <Loader2 className="animate-spin mx-auto"/> : studentData ? (
                    <>
                      <div className="flex justify-between text-[10px] opacity-70"><span>Total Due</span><span className="text-destructive font-black">৳{studentData.totalDue || 0}</span></div>
                      <div className="flex justify-between text-[10px] opacity-70"><span>Food Balance</span><span className="text-success font-black">৳{studentData.foodDueAmount || 0}</span></div>
                      <div className="flex justify-between text-[10px] opacity-70"><span>Security Adv.</span><span className="text-primary font-black">৳{studentData.advanceAmount || 0}</span></div>
                      <Separator className="bg-white/10" />
                      <div className="flex justify-between items-end">
                         <span className="text-[8px] uppercase font-bold text-white/40">Status</span>
                         <Badge variant="outline" className="bg-success/20 text-success border-success/30 text-[8px] font-black">ACTIVE</Badge>
                      </div>
                    </>
                  ) : <p className="text-xs italic text-center">Student not found</p>}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={handleReject} disabled={isProcessing} className="rounded-xl border-destructive text-destructive h-12">Reject</Button>
            <Button onClick={handleApprove} disabled={isProcessing || !studentData} className="rounded-xl bg-success hover:bg-success/90 h-12 gap-2">
              {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>} Accept & Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
