
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  CheckCircle2, XCircle, Loader2, Eye, Wallet, Receipt, 
  UserCircle, Building2, Calendar, Trash2, ArrowUpRight, ArrowDownRight, Info
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, doc, deleteDoc, updateDoc, setDoc, serverTimestamp, increment, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"

export default function ManagerRequestsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [selectedReq, setSelectedReq] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  
  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
  }, [])

  // CRITICAL: Load manager requests for this branch. Removed orderBy to avoid index issues.
  const requestsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "managerRequests"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: rawRequests, isLoading } = useCollection(requestsQuery)

  // Sort requests in memory to avoid composite index requirement
  const requests = useMemo(() => {
    if (!rawRequests) return []
    return [...rawRequests].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt)
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt)
      return dateB.getTime() - dateA.getTime()
    })
  }, [rawRequests])

  const handleApprove = async () => {
    if (!selectedReq) return
    setIsProcessing(true)
    
    try {
      if (selectedReq.requestType === 'income') {
        const paymentId = doc(collection(db, "payments")).id
        await setDoc(doc(db, "payments", paymentId), {
          ...selectedReq,
          id: paymentId,
          type: "income",
          approvedAt: serverTimestamp(),
          approvedBy: localStorage.getItem("user_name"),
          createdAt: serverTimestamp(),
          date: serverTimestamp() // Ensure actual date is set
        })

        // Update Student Advance if applicable
        if (selectedReq.advanceAmount > 0) {
          await updateDoc(doc(db, "students", selectedReq.studentId), {
            advanceAmount: increment(selectedReq.advanceAmount),
            updatedAt: serverTimestamp()
          })
        }
      } else if (selectedReq.requestType === 'expense') {
        const expenseId = doc(collection(db, "expenses")).id
        await setDoc(doc(db, "expenses", expenseId), {
          ...selectedReq,
          id: expenseId,
          approvedAt: serverTimestamp(),
          approvedBy: localStorage.getItem("user_name"),
          createdAt: serverTimestamp()
        })
      }

      // Remove from requests
      await deleteDoc(doc(db, "managerRequests", selectedReq.id))

      toast({ title: "Approved!", description: "Transaction added to permanent records." })
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
      await deleteDoc(doc(db, "managerRequests", selectedReq.id))
      toast({ title: "Rejected", description: "Request has been removed." })
      setIsDetailOpen(false)
      setSelectedReq(null)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Manager Requests</h1>
          <p className="text-muted-foreground mt-1">Pending income/expense approvals for <span className="font-bold text-foreground">{userBranch}</span>.</p>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests?.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <Badge variant="outline" className={req.requestType === 'income' ? 'border-success text-success' : 'border-destructive text-destructive'}>
                        {req.requestType === 'income' ? <ArrowUpRight size={12} className="mr-1"/> : <ArrowDownRight size={12} className="mr-1"/>}
                        {req.requestType?.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{req.studentName || req.category}</span>
                        <span className="text-[10px] text-muted-foreground italic">{req.description}</span>
                      </div>
                    </TableCell>
                    <TableCell><div className="flex items-center gap-1.5 text-xs font-medium"><Building2 size={12}/> {req.buildingName}</div></TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-primary">{req.requestedByName}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(req.createdAt?.toDate?.() || req.createdAt).toLocaleDateString()}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-black">৳{req.amount?.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedReq(req); setIsDetailOpen(true); }}>
                        <Eye size={14} className="mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {requests?.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No pending requests from Building Managers.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Verification</DialogTitle>
            <DialogDescription>Review transaction details before approving.</DialogDescription>
          </DialogHeader>
          
          {selectedReq && (
            <div className="space-y-6 py-4">
              <div className="p-4 bg-secondary/20 rounded-xl border space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Type:</span>
                  <Badge className={selectedReq.requestType === 'income' ? 'bg-success' : 'bg-destructive'}>
                    {selectedReq.requestType?.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Entity:</span>
                  <span className="font-bold text-primary">{selectedReq.studentName || selectedReq.expensePartyName || selectedReq.category}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Location:</span>
                  <span className="text-sm">{selectedReq.buildingName} {selectedReq.roomNumber ? `| R-${selectedReq.roomNumber}` : ''}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Amount:</span>
                  <span className="text-2xl font-black text-foreground">৳{selectedReq.amount?.toLocaleString()}</span>
                </div>
                <Separator />
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Info size={10}/> Description:</span>
                  <p className="text-xs leading-relaxed">{selectedReq.description || "No notes provided."}</p>
                </div>
              </div>

              <div className="p-3 border rounded-lg bg-primary/5 text-[10px] flex items-center gap-2">
                <UserCircle size={14} className="text-primary"/>
                <span>Submitted by <b>{selectedReq.requestedByName}</b> on {new Date(selectedReq.createdAt?.toDate?.() || selectedReq.createdAt).toLocaleString()}</span>
              </div>
            </div>
          )}

          <DialogFooter className="grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={handleReject} disabled={isProcessing} className="border-destructive text-destructive hover:bg-destructive/5">
              Reject Request
            </Button>
            <Button onClick={handleApprove} disabled={isProcessing} className="bg-success hover:bg-success/90">
              {isProcessing ? <Loader2 className="animate-spin" /> : "Approve Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
