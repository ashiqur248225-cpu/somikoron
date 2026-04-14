
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
import { Textarea } from "@/components/ui/textarea"
import { Wallet, Info, Loader2, Building2, Search, Filter, HandCoins, CreditCard, LayoutGrid, XCircle, UserCheck, Calendar, DoorOpen, FileSpreadsheet, Printer, Download, Calculator, ArrowUpCircle, RotateCcw, Clock, AlertCircle, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, increment, updateDoc, arrayUnion, query, limit, where, getDocs, writeBatch, Timestamp } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { sendSMS } from "@/app/actions/sms"
import { useRouter } from "next/navigation"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2024", "2025", "2026", "2027", "2028"];

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
  const [userRole, setUserRole] = useState("")
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
  
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [entryBuildingFilter, setEntryBuildingFilter] = useState("all")
  const [entryRoomFilter, setEntryRoomFilter] = useState("all")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setIsDevMode(localStorage.getItem("isDeveloperMode") === "true")
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
      const matchesRoom = roomFilter === "all" || p.roomNumber === roomFilter
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
    if (!deleteRange.start || !deleteRange.end) {
      toast({ variant: "destructive", title: "Error", description: "Select date range first." })
      return
    }
    
    const confirm = window.confirm(`WARNING: This will permanently delete ALL payments from ${deleteRange.start} to ${deleteRange.end}. Proceed?`);
    if (!confirm) return;

    setIsDeleting(true)
    try {
      const q = query(
        collection(db, "payments"),
        where("branch", "==", userBranch),
        where("date", ">=", Timestamp.fromDate(new Date(deleteRange.start))),
        where("date", "<=", Timestamp.fromDate(new Date(deleteRange.end + "T23:59:59")))
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      
      toast({ title: "Deleted Successfully", description: `${snapshot.size} records removed.` });
      setIsDeleteOpen(false);
      router.refresh();
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message });
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePrint = () => { 
    if (typeof window !== "undefined") { 
      // Add a delay to ensure everything is rendered before opening the print dialog
      setTimeout(() => {
        window.print(); 
      }, 500);
    } 
  }

  return (
    <div className="space-y-8 pb-20 print:p-0 w-full">
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
          {isDevMode && (
            <Button size="sm" variant="destructive" className="gap-2 h-9 rounded-lg" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 size={16} /> <span className="hidden sm:inline">Bulk Delete</span>
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsFilterDialogOpen(true)}>
            <Filter size={16} /> <span className="hidden sm:inline">Filter</span>
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Print PDF</span></Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* OFFICIAL PRINT REPORT SECTION */}
      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">সমীকরণ ছাত্রাবাস</h1>
          <p className="text-sm font-bold text-slate-600">{userBranch} ব্রাঞ্চ • ইনকাম সামারি রিপোর্ট (Income)</p>
          <div className="mt-4 border-y-2 border-slate-200 py-3 grid grid-cols-2 text-left text-[9pt] font-medium bg-slate-50/50 px-4">
            <div>
              <p><b>Period:</b> {startDate || 'Start'} to {endDate || 'Today'}</p>
              <p><b>Filter Building:</b> {buildingFilter === 'all' ? 'All' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
            </div>
            <div className="text-right">
              <p><b>Generated At:</b> {new Date().toLocaleString()}</p>
              <p><b>Staff:</b> {userName}</p>
            </div>
          </div>
        </div>

        <table className="w-full border-collapse border mt-6 text-[9pt]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 p-2 text-left font-black uppercase text-slate-700">Date</th>
              <th className="border border-slate-300 p-2 text-left font-black uppercase text-slate-700">Student Name</th>
              <th className="border border-slate-300 p-2 text-left font-black uppercase text-slate-700">Location</th>
              <th className="border border-slate-300 p-2 text-center font-black uppercase text-slate-700">Method</th>
              <th className="border border-slate-300 p-2 text-right font-black uppercase text-slate-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((p: any) => (
              <tr key={p.id}>
                <td className="border border-slate-200 p-2">{formatCompactDate(p.date)}</td>
                <td className="border border-slate-200 p-2 font-bold">{p.studentName}</td>
                <td className="border border-slate-200 p-2 text-xs">{p.buildingName} • R-{p.roomNumber}</td>
                <td className="border border-slate-200 p-2 text-center uppercase text-[8pt]">{p.method}</td>
                <td className="border border-slate-200 p-2 text-right font-bold">৳{p.amount?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white font-black">
              <td colSpan={4} className="p-3 text-right uppercase text-[10pt]">Grand Total Income</td>
              <td className="p-3 text-right text-[11pt]">৳{stats.total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="print-footer mt-24 flex justify-between px-10">
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[8pt] font-black uppercase text-slate-800">Accountant Signature</p>
          </div>
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[8pt] font-black uppercase text-slate-800">Manager Signature</p>
          </div>
        </div>
      </div>

      <div className="print:hidden space-y-8">
        {/* Main UI Cards */}
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-success">Total Filtered Income</CardTitle><ArrowUpCircle className="h-4 w-4 text-success" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-slate-900">৳{stats.total.toLocaleString()}</div></CardContent>
        </Card>

        {paymentsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/30"><TableRow><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Location</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>{filteredPayments.map((p: any) => (<TableRow key={p.id}><TableCell className="text-xs font-bold text-slate-500">{formatCompactDate(p.date)}</TableCell><TableCell className="font-black text-slate-800">{p.studentName}</TableCell><TableCell className="text-xs text-muted-foreground">{p.buildingName} • R-{p.roomNumber}</TableCell><TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{p.method}</Badge></TableCell><TableCell className="text-right font-black text-income">৳{p.amount?.toLocaleString()}</TableCell></TableRow>))}</TableBody>
                </Table>
              </CardContent>
            </Card>
            <div className="md:hidden space-y-4">
              {filteredPayments.map((p: any) => (
                <Card key={p.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-muted-foreground uppercase">{formatCompactDate(p.date)}</p><h3 className="font-black text-slate-800 text-lg mt-1">{p.studentName}</h3></div><Badge variant="outline" className="uppercase font-bold text-[9px]">{p.method}</Badge></div>
                    <div className="bg-secondary/30 p-3 rounded-xl border border-secondary flex justify-between items-center"><div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase">Location</p><p className="text-xs font-bold text-slate-700">{p.buildingName} • R-{p.roomNumber}</p></div><div className="text-right"><p className="text-[10px] font-bold text-muted-foreground uppercase">Collected</p><p className="text-xl font-black text-income">৳{p.amount?.toLocaleString()}</p></div></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Filter className="text-primary" size={20}/> Filter Income Records</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Building</Label><Select value={buildingFilter} onValueChange={val => setBuildingFilter(val)}><SelectTrigger className="bg-slate-50"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Method</Label><Select value={methodFilter} onValueChange={setMethodFilter}><SelectTrigger className="bg-slate-50"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Date Range</Label><div className="flex gap-2"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50" /><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50" /></div></div>
          </div>
          <DialogFooter><Button className="rounded-xl px-8" onClick={() => setIsFilterDialogOpen(false)}>Apply Filters</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 /> Bulk Delete Payments</DialogTitle>
            <DialogDescription>Documents within this range will be permanently removed.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">Start Date</Label><Input type="date" value={deleteRange.start} onChange={e => setDeleteRange({...deleteRange, start: e.target.value})} /></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">End Date</Label><Input type="date" value={deleteRange.end} onChange={e => setDeleteRange({...deleteRange, end: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting} className="rounded-xl font-bold">
              {isDeleting ? <Loader2 className="animate-spin" /> : "Execute Deletion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
