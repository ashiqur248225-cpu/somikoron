
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { 
  Loader2, 
  Building2, 
  UserCircle, 
  Receipt, 
  Calendar, 
  Wrench, 
  Lightbulb, 
  Utensils, 
  Wifi, 
  Wallet, 
  Zap, 
  LayoutGrid, 
  DoorOpen,
  XCircle, 
  Search, 
  FileSpreadsheet, 
  Printer, 
  ArrowDownCircle, 
  Info,
  Eye,
  UserCheck,
  Filter,
  Apple,
  RotateCcw,
  Trash2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, query, limit, where, getDocs, writeBatch } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const EXPENSE_CATEGORIES = [
  { id: "rent", label: "Building Rent", icon: Building2 },
  { id: "electricity", label: "Electricity Bill", icon: Lightbulb },
  { id: "water", label: "Water & Gas Bill", icon: Receipt },
  { id: "maintenance", label: "Maintenance/Repair", icon: Wrench },
  { id: "food", label: "Food / Meal Cost", icon: Utensils },
  { id: "market", label: "General Market", icon: Apple },
  { id: "internet", label: "Internet Bill", icon: Wifi },
  { id: "salary", label: "Staff Salary", icon: UserCircle },
  { id: "others", label: "Others", icon: Wallet },
]

const formatCompactDate = (date: any) => {
  const d = new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function ExpenseHistoryPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [isDevMode, setIsDevMode] = useState(false)

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteRange, setDeleteRange] = useState({ start: "", end: "" })
  const [isDeleting, setIsDeleting] = useState(false)

  const [categoryFilter, setCategoryFilter] = useState("all")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
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

  const expensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "expenses"), where("branch", "==", userBranch), limit(1000))
  }, [db, userBranch])
  const { data: rawExpenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  const filteredExpenses = useMemo(() => {
    if (!rawExpenses) return []
    return rawExpenses.filter(e => {
      const matchesCategory = categoryFilter === "all" || e.category === categoryFilter
      const matchesBuilding = buildingFilter === "all" || e.buildingId === buildingFilter
      const matchesSearch = (e.expensePartyName || "").toLowerCase().includes(searchTerm.toLowerCase()) || (e.description || "").toLowerCase().includes(searchTerm.toLowerCase())
      const eDate = new Date(e.expenseDate)
      const matchesStartDate = !startDate || eDate >= new Date(startDate)
      const matchesEndDate = !endDate || eDate <= new Date(new Date(endDate).setHours(23, 59, 59))
      return matchesCategory && matchesBuilding && matchesSearch && matchesStartDate && matchesEndDate
    }).sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())
  }, [rawExpenses, categoryFilter, buildingFilter, searchTerm, startDate, endDate])

  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    return { total, count: filteredExpenses.length }
  }, [filteredExpenses])

  const handleBulkDelete = async () => {
    if (!deleteRange.start || !deleteRange.end) return;
    const confirm = window.confirm(`WARNING: Permanent delete ALL expenses from ${deleteRange.start} to ${deleteRange.end}. Proceed?`);
    if (!confirm) return;

    setIsDeleting(true)
    try {
      const q = query(
        collection(db, "expenses"),
        where("branch", "==", userBranch),
        where("expenseDate", ">=", deleteRange.start),
        where("expenseDate", "<=", deleteRange.end)
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

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  return (
    <div className="space-y-8 pb-20 print:p-0 w-full overflow-hidden">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Expense</h1><p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Spending for <span className="font-bold text-foreground">{userBranch}</span>.</p></div>
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
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* Bulk Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 /> Bulk Delete Expenses</DialogTitle>
            <DialogDescription>Permanently remove records by date range.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-[10px] font-bold">Start Date</Label><Input type="date" value={deleteRange.start} onChange={e => setDeleteRange({...deleteRange, start: e.target.value})} /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-bold">End Date</Label><Input type="date" value={deleteRange.end} onChange={e => setDeleteRange({...deleteRange, end: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting} className="rounded-xl font-bold">
              {isDeleting ? <Loader2 className="animate-spin" /> : "Delete Selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OFFICIAL PRINT REPORT SECTION */}
      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">সমীকরণ ছাত্রাবাস</h1>
          <p className="text-sm font-bold text-slate-600">{userBranch} ব্রাঞ্চ • খরচ সামারি রিপোর্ট (Expense)</p>
          <div className="mt-4 border-y-2 border-slate-200 py-3 grid grid-cols-2 text-left text-[9pt] font-medium bg-slate-50/50 px-4">
            <div>
              <p><b>Period:</b> {startDate || 'Start'} to {endDate || 'Today'}</p>
              <p><b>Category:</b> {categoryFilter === 'all' ? 'All' : categoryFilter}</p>
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
              <th className="border border-slate-300 p-2 text-left font-black uppercase text-slate-700">Category</th>
              <th className="border border-slate-300 p-2 text-left font-black uppercase text-slate-700">Spent By</th>
              <th className="border border-slate-300 p-2 text-left font-black uppercase text-slate-700">Description</th>
              <th className="border border-slate-300 p-2 text-right font-black uppercase text-slate-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map((e: any) => (
              <tr key={e.id}>
                <td className="border border-slate-200 p-2">{formatCompactDate(e.expenseDate)}</td>
                <td className="border border-slate-200 p-2 capitalize">{e.category}</td>
                <td className="border border-slate-200 p-2 font-medium">{e.expensePartyName}</td>
                <td className="border border-slate-200 p-2 text-xs italic">{e.description || '-'}</td>
                <td className="border border-slate-200 p-2 text-right font-bold">৳{e.amount?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white font-black">
              <td colSpan={4} className="p-3 text-right uppercase text-[10pt]">Grand Total Expense</td>
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

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Filter className="text-primary" size={20}/> Filter Expenses</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">Category</Label><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">Date Range</Label><div className="flex gap-2"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50" /><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50" /></div></div>
          </div>
          <DialogFooter><Button className="rounded-xl px-8" onClick={() => setIsFilterDialogOpen(false)}>Apply Filters</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden print:hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-destructive">Total Filtered Expense</CardTitle><ArrowDownCircle className="h-4 w-4 text-destructive" /></CardHeader>
        <CardContent><div className="text-3xl font-black text-slate-900">৳{stats.total.toLocaleString()}</div></CardContent>
      </Card>

      {expensesLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl print:hidden">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/30"><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Spent By</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>{filteredExpenses.map((e: any) => (<TableRow key={e.id} className="cursor-pointer" onClick={() => router.push(`/expenses/${e.id}`)}><TableCell className="text-xs font-bold text-slate-500">{formatCompactDate(e.expenseDate)}</TableCell><TableCell><Badge variant="secondary" className="capitalize text-[10px] font-bold">{e.category}</Badge></TableCell><TableCell className="font-bold text-slate-700">{e.expensePartyName}</TableCell><TableCell className="text-right font-black text-expense">৳{e.amount?.toLocaleString()}</TableCell></TableRow>))}</TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="md:hidden space-y-4 print:hidden">
            {filteredExpenses.map((e: any) => (
              <Card key={e.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white" onClick={() => router.push(`/expenses/${e.id}`)}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-muted-foreground uppercase">{formatCompactDate(e.expenseDate)}</p><Badge variant="secondary" className="capitalize text-[10px] font-bold mt-1">{e.category}</Badge></div><div className="text-right"><p className="text-xl font-black text-expense">৳{e.amount?.toLocaleString()}</p></div></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
