
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  CheckCircle2, XCircle, Loader2, ChefHat, User, Smartphone, 
  Building2, Calendar, History, Trash2, ArrowRight, Info, AlertCircle, Clock, LayoutGrid, ChevronRight
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, doc, deleteDoc, updateDoc, serverTimestamp, increment, where, getDoc, writeBatch } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export default function MealRequestsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isProcessing, setIsProcessing] = useState(false)
  
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
    return query(collection(db, "mealRequests"), where("branch", "==", userBranch))
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

  const handleApprove = async (req: any) => {
    setIsProcessing(true)
    const batch = writeBatch(db)
    try {
      // 1. Approve the request
      batch.update(doc(db, "mealRequests", req.id), {
        status: "approved",
        approvedBy: userName,
        updatedAt: serverTimestamp()
      })

      // 2. Turn on student's meals for tomorrow and increment used count
      const studentRef = doc(db, "students", req.studentId)
      batch.update(studentRef, {
        "mealStatus.breakfast": true,
        "mealStatus.lunch": true,
        "mealStatus.dinner": true,
        "mealStatus.autoMode": false,
        emergencyMealUsedCount: increment(1),
        lastMealUpdateDate: new Date().toISOString().split('T')[0], // Marked as updated today
        updatedAt: serverTimestamp()
      })

      // 3. Increment current month counters (Tomorrow is the target)
      batch.update(studentRef, {
        currentMonthBreakfast: increment(1),
        currentMonthLunch: increment(1),
        currentMonthDinner: increment(1)
      })

      // 4. Send In-App Notice
      const noticeId = doc(collection(db, "notices")).id
      batch.set(doc(db, "notices", noticeId), {
        id: noticeId,
        studentId: req.studentId,
        title: "Emergency Meal Approved",
        message: "আপনার জরুরী মিল রিকোয়েস্টটি এপ্রুভ করা হয়েছে। আগামীকালের সব বেলার মিল আপনার অন করে দেওয়া হয়েছে।",
        type: "meal",
        isRead: false,
        createdAt: serverTimestamp(),
        branch: userBranch
      })

      await batch.commit()
      toast({ title: "Approved!", description: `${req.studentName}'s meals are now ON for tomorrow.` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async (reqId: string) => {
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, "mealRequests", reqId), {
        status: "rejected",
        rejectedBy: userName,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Rejected", description: "Request has been declined." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-8 pb-20 w-full overflow-x-hidden">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Meal Requests</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Review emergency meal requests from students.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">{userName ? userName.substring(0, 2) : "U"}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-3xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>Requested Date</TableHead>
                    <TableHead>Student Details</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Limit Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map(req => (
                    <TableRow key={req.id}>
                      <TableCell className="text-[10px] font-bold text-slate-400">
                        {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString() : 'Just now'}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-800">{req.studentName}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Smartphone size={10}/> {req.phone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-slate-600">{req.buildingName}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Room {req.roomNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Emergency Usage</span>
                            <div className="flex gap-1">
                               <div className={cn("h-1.5 w-6 rounded-full", req.emergencyMealUsedCount >= 1 ? "bg-orange-400" : "bg-slate-200")} />
                               <div className={cn("h-1.5 w-6 rounded-full", req.emergencyMealUsedCount >= 2 ? "bg-orange-400" : "bg-slate-200")} />
                            </div>
                         </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                           <Button variant="ghost" size="sm" className="text-destructive font-bold gap-1" onClick={() => handleReject(req.id)} disabled={isProcessing}>
                             <XCircle size={14}/> Reject
                           </Button>
                           <Button size="sm" className="bg-success hover:bg-success/90 font-bold gap-1 rounded-xl" onClick={() => handleApprove(req)} disabled={isProcessing}>
                             <CheckCircle2 size={14}/> Approve
                           </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {requests.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No pending meal requests.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4 px-1">
            {requests.map((req) => (
              <Card 
                key={req.id} 
                className="border-none shadow-sm rounded-2xl overflow-hidden bg-white active:scale-[0.98] transition-transform"
              >
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 shadow-inner">
                        <ChefHat size={20} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 text-lg leading-tight">{req.studentName}</h3>
                        <p className="text-[10px] text-muted-foreground font-bold">{req.phone}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[8px] font-black uppercase text-orange-500 border-orange-200 bg-orange-50">Pending</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 bg-secondary/30 p-3 rounded-xl border border-secondary">
                    <div className="space-y-1">
                       <p className="text-[8px] font-bold text-muted-foreground uppercase">Location</p>
                       <p className="text-[10px] font-black text-slate-700">{req.buildingName} • R-{req.roomNumber}</p>
                    </div>
                    <div className="space-y-1 text-right">
                       <p className="text-[8px] font-bold text-muted-foreground uppercase">Usage Count</p>
                       <p className="text-[10px] font-black text-orange-600">{req.emergencyMealUsedCount || 0} / 2</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1 h-11 border-destructive/20 text-destructive font-bold rounded-xl" onClick={() => handleReject(req.id)} disabled={isProcessing}>
                       Reject
                    </Button>
                    <Button className="flex-1 h-11 bg-success hover:bg-success/90 font-bold rounded-xl gap-2" onClick={() => handleApprove(req)} disabled={isProcessing}>
                       {isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : <CheckCircle2 size={16}/>}
                       Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {requests.length === 0 && (
              <div className="text-center py-20 text-muted-foreground italic flex flex-col items-center gap-3">
                 <ChefHat size={48} className="opacity-10" />
                 <p>No pending emergency meal requests.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
