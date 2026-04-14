"use client"

import { useState, useMemo, useEffect } from "react"
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
import { Wallet, Loader2, Search, Filter, Printer, ArrowUpCircle, RotateCcw, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, limit, where, getDocs, writeBatch, Timestamp } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useRouter } from "next/navigation"

const formatCompactDate = (date: any) => {
  if (!date) return 'N/A'
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function IncomeHistoryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const router = useRouter()
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [isDevMode, setIsDevMode] = useState(false)

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteRange, setDeleteRange] = useState({ start: "", end: "" })
  const [isDeleting, setIsDeleting] = useState(false)

  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [receiverFilter, setReceiverFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    setIsDevMode(localStorage.getItem("isDeveloperMode") === "true")
  }, [])

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const staffQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "staff"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: staffList } = useCollection(staffQuery)

  const incomeQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "payments"), where("branch", "==", userBranch), limit(1000))
  }, [db, userBranch])
  const { data: rawPayments, isLoading: paymentsLoading } = useCollection(incomeQuery)

  const filteredPayments = useMemo(() => {
    if (!rawPayments) return []
    return rawPayments.filter(p => {
      const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date)
      const matchesStartDate = !startDate || pDate >= new Date(startDate)
      const matchesEndDate = !endDate || pDate <= new Date(new Date(endDate).setHours(23, 59, 59))
      const matchesBuilding = buildingFilter === "all" || p.buildingId === buildingFilter
      const matchesRoom = roomFilter === "all" || String(p.roomNumber) === roomFilter
      const matchesMethod = methodFilter === "all" || p.method === methodFilter
      const matchesReceiver = receiverFilter === "all" || p.receiver === receiverFilter
      return matchesStartDate && matchesEndDate && matchesBuilding && matchesRoom && matchesMethod && matchesReceiver
    }).sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date)
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date)
      return dateB.getTime() - dateA.getTime()
    })
  }, [rawPayments, startDate, endDate, buildingFilter, roomFilter, methodFilter, receiverFilter])

  const stats = useMemo(() => {
    const total = filteredPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    return { total, count: filteredPayments.length }
  }, [filteredPayments])

  const handleBulkDelete = async () => {
    if (!deleteRange.start || !deleteRange.end) return
    const confirm = window.confirm(`WARNING: This will permanently delete ALL payments within range. Proceed?`);
    if (!confirm) return;
    setIsDeleting(true)
    try {
      const q = query(collection(db, "payments"), where("branch", "==", userBranch), where("date", ">=", Timestamp.fromDate(new Date(deleteRange.start))), where("date", "<=", Timestamp.fromDate(new Date(deleteRange.end + "T23:59:59"))));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast({ title: "Deleted Successfully" });
      setIsDeleteOpen(false);
    } catch (e: any) { toast({ variant: "destructive", description: e.message }); }
    finally { setIsDeleting(false) }
  }

  const handlePrint = () => { 
    if (typeof window !== "undefined") { 
      setTimeout(() => { window.print(); }, 500);
    } 
  }

  const handleReset = () => {
    setBuildingFilter("all")
    setRoomFilter("all")
    setMethodFilter("all")
    setReceiverFilter("all")
    setStartDate("")
    setEndDate("")
  }

  return (
    <div className="space-y-8 pb-20 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Income</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Receipts for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsFilterDialogOpen(true)}><Filter size={16} /> Filter</Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> Print Report</Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* OFFICIAL A4 PRINT REPORT */}
      <div className="print-only print-report-container">
        <div className="report-header">
          <h1>সমীকরণ ছাত্রাবাস</h1>
          <p className="branch-title">{userBranch} Branch • Monthly Income Report</p>
          <div className="flex justify-between items-end mt-4 px-2 text-[8pt] font-bold text-slate-500">
            <div>
              <p>Period: {startDate || 'Start'} to {endDate || 'Today'}</p>
              <p>Filter: {buildingFilter === 'all' ? 'All Buildings' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
            </div>
            <div className="text-right">
              <p>Generated: {new Date().toLocaleString()}</p>
              <p>Staff: {userName}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Location</th>
              <th>Received By</th>
              <th>Method</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((p: any) => (
              <tr key={p.id}>
                <td>{formatCompactDate(p.date)}</td>
                <td className="font-bold">{p.studentName}</td>
                <td>{p.buildingName} • R-{p.roomNumber}</td>
                <td>{p.receiver}</td>
                <td className="uppercase">{p.method}</td>
                <td className="text-right font-bold">৳{p.amount?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={5} className="text-right uppercase">Grand Total Income</td>
              <td className="text-right">৳{stats.total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="print-footer">
          <div className="page-number"></div>
          <div className="signature-box">Manager Signature</div>
        </div>
      </div>

      <div className="print:hidden space-y-8">
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-success">Total Filtered Income</CardTitle><ArrowUpCircle className="h-4 w-4 text-success" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-slate-900">৳{stats.total.toLocaleString()}</div></CardContent>
        </Card>

        {paymentsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : (
          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/30"><TableRow><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Location</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>{filteredPayments.map((p: any) => (<TableRow key={p.id}><TableCell className="text-xs font-bold text-slate-500">{formatCompactDate(p.date)}</TableCell><TableCell className="font-black text-slate-800">{p.studentName}</TableCell><TableCell className="text-xs text-muted-foreground">{p.buildingName} • R-{p.roomNumber}</TableCell><TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{p.method}</Badge></TableCell><TableCell className="text-right font-black text-income">৳{p.amount?.toLocaleString()}</TableCell></TableRow>))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Filter Income</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Method</Label><Select value={methodFilter} onValueChange={setMethodFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Methods</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-1.5"><Label>Received By</Label><Select value={receiverFilter} onValueChange={setReceiverFilter}><SelectTrigger><SelectValue placeholder="Any Staff" /></SelectTrigger><SelectContent><SelectItem value="all">Any Staff</SelectItem>{staffList?.filter(s => s.staffType === 'management' || !s.staffType).map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Date Range</Label><div className="flex gap-2"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div></div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" className="gap-2 font-bold" onClick={handleReset}><RotateCcw size={14}/> Reset</Button>
            <Button className="rounded-xl px-8" onClick={() => setIsFilterDialogOpen(false)}>Apply Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}