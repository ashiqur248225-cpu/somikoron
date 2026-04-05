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
import { Plus, Loader2, Building2, UserCircle, Receipt, Calendar, Wrench, Lightbulb, Utensils, Wifi, Wallet, Zap, LayoutGrid, UserCheck, XCircle, Search, Filter, FileSpreadsheet, Printer, ArrowDownCircle, ArrowDownRight, DoorOpen } from "lucide-react"
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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, query, limit, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const EXPENSE_CATEGORIES = [
  { id: "rent", label: "Building Rent", icon: Building2 },
  { id: "electricity", label: "Electricity Bill", icon: Lightbulb },
  { id: "water", label: "Water & Gas Bill", icon: Receipt },
  { id: "maintenance", label: "Maintenance/Repair", icon: Wrench },
  { id: "market", label: "Market/Food", icon: Utensils },
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")

  const [categoryFilter, setCategoryFilter] = useState("all")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [formData, setFormData] = useState({
    category: "others", buildingId: "none", apartmentName: "", roomNumber: "", meterNo: "",
    amount: "", method: "cash", expensePartyName: "", receiver: "", month: "", year: "",
    description: "", expenseDate: new Date().toISOString().split('T')[0]
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

  const staffQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "staff"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: staffList } = useCollection(staffQuery)

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

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  const handleExportCSV = () => {
    try {
      const headers = ["Date", "Category", "Details", "Building - Room", "Spent By", "Method", "Amount"];
      const rows = filteredExpenses.map(e => [
        formatCompactDate(e.expenseDate),
        e.category,
        e.description?.replace(/,/g, ' '),
        `${e.buildingName} ${e.roomNumber || ''}`,
        e.expensePartyName,
        e.method,
        e.amount
      ]);
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `expense_report_${new Date().getTime()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) { toast({ variant: "destructive", title: "Export Failed" }) }
  }

  const handleCreateExpense = async () => {
    if (!formData.amount || !formData.expensePartyName) return
    setIsSubmitting(true)
    try {
      const selectedB = buildings?.find(b => b.id === formData.buildingId)
      const expenseId = doc(collection(db, "expenses")).id
      await setDoc(doc(db, "expenses", expenseId), {
        ...formData, id: expenseId, amount: Number(formData.amount),
        branch: userBranch, buildingName: selectedB?.name || "General",
        createdAt: serverTimestamp()
      })
      toast({ title: "Success", description: "Expense recorded." })
      setIsEntryOpen(false)
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) }
    finally { setIsSubmitting(false) }
  }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Expense</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Spending for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={handleExportCSV}><FileSpreadsheet size={16} /> <span className="hidden sm:inline">Export CSV</span></Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Print</span></Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">SOMIKORON HOSTEL</h1>
          <p className="text-sm font-bold">{userBranch} Branch • Official Expense Ledger</p>
          <div className="mt-4 border-y py-2 grid grid-cols-2 text-left text-[10pt]">
            <div>
              <p><b>Building:</b> {buildingFilter === 'all' ? 'All Properties' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
              <p><b>Category:</b> {categoryFilter === 'all' ? 'All Categories' : categoryFilter}</p>
            </div>
            <div className="text-right">
              <p><b>Period:</b> {startDate || 'N/A'} to {endDate || 'N/A'}</p>
              <p><b>Report Date:</b> {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <TableRow>
              <TableHead className="w-[12%]">Date</TableHead>
              <TableHead className="w-[15%]">Category</TableHead>
              <TableHead className="w-[20%]">Details</TableHead>
              <TableHead className="w-[18%]">Building/Unit</TableHead>
              <TableHead className="w-[15%]">Spent By</TableHead>
              <TableHead className="w-[10%]">Method</TableHead>
              <TableHead className="w-[10%] text-right">Amount</TableHead>
            </TableRow>
          </thead>
          <TableBody>
            {filteredExpenses.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>{formatCompactDate(e.expenseDate)}</TableCell>
                <TableCell className="capitalize">{e.category}</TableCell>
                <TableCell className="text-[8pt] italic">{e.description || e.receiver || 'N/A'}</TableCell>
                <TableCell>{e.buildingName} {e.apartmentName ? `(${e.apartmentName})` : ''} {e.roomNumber ? `- R${e.roomNumber}` : ''}</TableCell>
                <TableCell>{e.expensePartyName}</TableCell>
                <TableCell className="uppercase">{e.method}</TableCell>
                <TableCell className="text-right font-bold">৳{e.amount?.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>

        <div className="summary-section">
          <div className="bg-slate-50 p-4 border rounded-xl grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-bold uppercase text-primary text-xs mb-2">Final Summary</h3>
              <p className="text-sm">Total Entries: <b>{stats.count} Items</b></p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase font-bold text-muted-foreground">Total Expenditure</p>
              <p className="text-2xl font-black text-destructive">৳{stats.total.toLocaleString()}</p>
            </div>
          </div>
          <div className="print-footer mt-10">
            <div className="signature-box">Accountant Signature</div>
            <div className="text-center self-end print-page-number"></div>
            <div className="signature-box">Manager Signature</div>
          </div>
        </div>
      </div>

      <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden print:hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-bold uppercase text-destructive">Total Filtered Expense</CardTitle>
          <ArrowDownCircle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black text-slate-900">৳{stats.total.toLocaleString()}</div>
          <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Based on {stats.count} records</p>
        </CardContent>
      </Card>

      <div className="bg-secondary/20 p-4 rounded-xl border space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Category</Label><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1 md:col-span-2"><Label className="text-[10px] uppercase font-bold">Search</Label><Input placeholder="Spent by or description..." className="bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">From</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">To</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          <Button variant="ghost" onClick={() => { setCategoryFilter("all"); setBuildingFilter("all"); setSearchTerm(""); setStartDate(""); setEndDate(""); }}>Reset</Button>
        </div>
      </div>

      <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl print:hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Spent By</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.map((e: any) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => router.push(`/expenses/${e.id}`)}>
                  <TableCell className="text-xs font-bold text-slate-500">{formatCompactDate(e.expenseDate)}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize text-[10px] font-bold">{e.category}</Badge></TableCell>
                  <TableCell className="font-bold text-slate-700">{e.expensePartyName}</TableCell>
                  <TableCell className="text-right font-black text-expense">৳{e.amount?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="fixed bottom-8 right-8 z-50 print:hidden">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-expense"><Plus size={32} className="text-white" /></Button>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Expense Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Category</Label><Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Spent By</Label><Select value={formData.expensePartyName} onValueChange={v => setFormData({...formData, expensePartyName: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Amount (৳)</Label><Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
              <div className="space-y-2"><Label>Method</Label><Select value={formData.method} onValueChange={v => setFormData({...formData, method: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={formData.expenseDate} onChange={e => setFormData({...formData, expenseDate: e.target.value})} /></div>
            <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Notes..." />
          </div>
          <DialogFooter><Button onClick={handleCreateExpense} disabled={isSubmitting} className="w-full h-12 bg-expense text-white font-bold">Save Expense</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
