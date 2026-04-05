
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
  Plus, 
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
  Filter
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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, query, limit, where } from "firebase/firestore"
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
  { id: "market", label: "Market/Food", icon: Utensils },
  { id: "internet", label: "Internet Bill", icon: Wifi },
  { id: "salary", label: "Staff Salary", icon: UserCircle },
  { id: "others", label: "Others", icon: Wallet },
]

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const formatCompactDate = (date: any) => {
  const d = new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function ExpenseHistoryPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  
  // App Context
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")

  // Filter States
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [spentByFilter, setSpentByFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  
  // UI States
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    category: "others",
    buildingId: "none",
    apartmentName: "",
    roomNumber: "",
    meterNo: "",
    amount: "",
    method: "cash",
    expensePartyName: "",
    receiver: "",
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    description: "",
    expenseDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    setUserRole(localStorage.getItem("user_role") || "Manager")
  }, [])

  // Queries
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
      const matchesSpentBy = spentByFilter === "all" || e.expensePartyName === spentByFilter
      const matchesSearch = (e.expensePartyName || "").toLowerCase().includes(searchTerm.toLowerCase()) || (e.description || "").toLowerCase().includes(searchTerm.toLowerCase())
      
      const eDate = new Date(e.expenseDate)
      const matchesStartDate = !startDate || eDate >= new Date(startDate)
      const matchesEndDate = !endDate || eDate <= new Date(new Date(endDate).setHours(23, 59, 59))
      
      return matchesCategory && matchesBuilding && matchesSpentBy && matchesSearch && matchesStartDate && matchesEndDate
    }).sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())
  }, [rawExpenses, categoryFilter, buildingFilter, spentByFilter, searchTerm, startDate, endDate])

  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    return { total, count: filteredExpenses.length }
  }, [filteredExpenses])

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  const handleExportCSV = () => {
    try {
      const headers = ["Date", "Category", "Details", "Building - Room", "Spent By", "Method", "Amount"];
      const rows = filteredExpenses.map(e => [
        formatCompactDate(e.expenseDate), e.category, e.description?.replace(/,/g, ' '), `${e.buildingName} ${e.roomNumber || ''}`, e.expensePartyName, e.method, e.amount
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
      const expenseData = { ...formData, amount: Number(formData.amount), branch: userBranch, buildingName: selectedB?.name || "General", updatedAt: serverTimestamp() }
      if (userRole === 'Building Manager') {
        const reqId = doc(collection(db, "managerRequests")).id
        await setDoc(doc(db, "managerRequests", reqId), { ...expenseData, id: reqId, requestType: "expense", requestedBy: localStorage.getItem("somikoron_auth_id"), requestedByName: userName, createdAt: serverTimestamp() })
        toast({ title: "Request Sent" })
      } else {
        const expenseId = doc(collection(db, "expenses")).id
        await setDoc(doc(db, "expenses", expenseId), { ...expenseData, id: expenseId, createdAt: serverTimestamp() })
        toast({ title: "Success" })
      }
      setIsEntryOpen(false)
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) }
    finally { setIsSubmitting(false) }
  }

  const activeFilterChips = useMemo(() => {
    const chips = []
    if (categoryFilter !== "all") chips.push({ id: "category", label: categoryFilter.toUpperCase() })
    if (buildingFilter !== "all") chips.push({ id: "building", label: buildings?.find(b => b.id === buildingFilter)?.name })
    if (spentByFilter !== "all") chips.push({ id: "spentBy", label: spentByFilter })
    if (startDate || endDate) chips.push({ id: "date", label: "Date Applied" })
    return chips
  }, [categoryFilter, buildingFilter, spentByFilter, startDate, endDate, buildings])

  // Helpers for dynamic entry
  const selectedExpBuilding = buildings?.find(b => b.id === formData.buildingId)
  const apartmentList = selectedExpBuilding?.apartmentsDetail || []
  const roomList = (() => {
    if (!selectedExpBuilding) return []
    const rooms: string[] = []
    selectedExpBuilding.apartmentsDetail?.forEach((apt: any) => {
      apt.rooms?.forEach((room: any) => { if (room.roomNo && !rooms.includes(room.roomNo)) rooms.push(room.roomNo) })
    })
    return rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  })()

  return (
    <div className="space-y-8 pb-20 print:p-0">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Expense</h1><p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Spending for <span className="font-bold text-foreground">{userBranch}</span>.</p></div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={handleExportCSV}><FileSpreadsheet size={16} /> <span className="hidden sm:inline">Export CSV</span></Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Download PDF</span></Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* Official Ledger Print Format */}
      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">SOMIKORON HOSTEL</h1>
          <p className="text-sm font-bold">{userBranch} Branch • Official Expense Ledger</p>
          <div className="mt-4 border-y py-2 grid grid-cols-2 text-left text-[10pt]">
            <div><p><b>Filter:</b> {buildingFilter === 'all' ? 'All Properties' : buildings?.find(b => b.id === buildingFilter)?.name}</p><p><b>Category:</b> {categoryFilter === 'all' ? 'All Categories' : categoryFilter}</p></div>
            <div className="text-right"><p><b>Period:</b> {startDate || 'N/A'} to {endDate || 'N/A'}</p><p><b>Report Date:</b> {new Date().toLocaleString()}</p></div>
          </div>
        </div>
        <table>
          <thead>
            <TableRow><TableHead className="w-[12%]">Date</TableHead><TableHead className="w-[15%]">Category</TableHead><TableHead className="w-[20%]">Details</TableHead><TableHead className="w-[18%]">Building/Unit</TableHead><TableHead className="w-[15%]">Spent By</TableHead><TableHead className="w-[10%]">Method</TableHead><TableHead className="w-[10%] text-right">Amount</TableHead></TableRow>
          </thead>
          <TableBody>
            {filteredExpenses.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>{formatCompactDate(e.expenseDate)}</TableCell><TableCell className="capitalize">{e.category}</TableCell><TableCell className="text-[8pt] italic">{e.description || e.receiver || 'N/A'}</TableCell><TableCell>{e.buildingName} {e.apartmentName ? `(${e.apartmentName})` : ''} {e.roomNumber ? `- R${e.roomNumber}` : ''}</TableCell><TableCell>{e.expensePartyName}</TableCell><TableCell className="uppercase">{e.method}</TableCell><TableCell className="text-right font-bold">৳{e.amount?.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>
        <div className="summary-section">
          <div className="bg-slate-50 p-4 border rounded-xl grid grid-cols-2 gap-4">
            <div><h3 className="font-bold uppercase text-primary text-xs mb-2">Final Summary</h3><p className="text-sm">Total Entries: <b>{stats.count} Items</b></p></div>
            <div className="text-right"><p className="text-xs uppercase font-bold text-muted-foreground">Total Expenditure</p><p className="text-2xl font-black text-destructive">৳{stats.total.toLocaleString()}</p></div>
          </div>
          <div className="print-footer mt-10"><div className="signature-box">Accountant Signature</div><div className="text-center self-end print-page-number"></div><div className="signature-box">Manager Signature</div></div>
        </div>
      </div>

      {/* GLOBAL FILTER BAR (Desktop) */}
      <div className="hidden md:flex bg-secondary/20 p-4 rounded-xl border items-end gap-4 print:hidden">
        <div className="w-[150px] space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Category</Label><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="w-[150px] space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="w-[150px] space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Spent By</Label><Select value={spentByFilter} onValueChange={setSpentByFilter}><SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="w-[280px] space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Date Range</Label><div className="flex gap-2"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 bg-white" /><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 bg-white" /></div></div>
        <Button variant="ghost" className="h-10 text-xs font-bold uppercase" onClick={() => { setCategoryFilter("all"); setBuildingFilter("all"); setSpentByFilter("all"); setSearchTerm(""); setStartDate(""); setEndDate(""); }}>Reset</Button>
      </div>

      {/* MOBILE FILTER PANEL */}
      <div className="md:hidden space-y-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." className="pl-9 h-9 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
          <Dialog open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="h-9 gap-2"><Filter size={14} /> Filter</Button></DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-2xl">
              <DialogHeader><DialogTitle>Expense Filters</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2"><Label>Category</Label><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Spent By</Label><Select value={spentByFilter} onValueChange={setSpentByFilter}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Date Range</Label><div className="grid grid-cols-2 gap-2"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div></div>
              </div>
              <DialogFooter className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => { setCategoryFilter("all"); setBuildingFilter("all"); setSpentByFilter("all"); setStartDate(""); setEndDate(""); setIsMobileFilterOpen(false); }}>Reset</Button><Button onClick={() => setIsMobileFilterOpen(false)}>Apply</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
            {activeFilterChips.map((chip, idx) => (
              <Badge key={idx} variant="secondary" className="px-2 py-1 gap-1 text-[10px] font-bold uppercase bg-destructive/10 text-destructive border-none">
                {chip.label}
                <XCircle size={12} className="cursor-pointer" onClick={() => { if (chip.id === 'category') setCategoryFilter("all"); if (chip.id === 'building') setBuildingFilter("all"); if (chip.id === 'spentBy') setSpentByFilter("all"); if (chip.id === 'date') { setStartDate(""); setEndDate(""); } }} />
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden print:hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-xs font-bold uppercase text-destructive">Total Filtered Expense</CardTitle><ArrowDownCircle className="h-4 w-4 text-destructive" /></CardHeader>
        <CardContent><div className="text-3xl font-black text-slate-900">৳{stats.total.toLocaleString()}</div><p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Based on {stats.count} records</p></CardContent>
      </Card>

      {expensesLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW */}
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl print:hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Spent By</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((e: any) => (
                    <TableRow key={e.id} className="cursor-pointer" onClick={() => router.push(`/expenses/${e.id}`)}><TableCell className="text-xs font-bold text-slate-500">{formatCompactDate(e.expenseDate)}</TableCell><TableCell><Badge variant="secondary" className="capitalize text-[10px] font-bold">{e.category}</Badge></TableCell><TableCell className="font-bold text-slate-700">{e.expensePartyName}</TableCell><TableCell className="text-right font-black text-expense">৳{e.amount?.toLocaleString()}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* MOBILE CARD VIEW */}
          <div className="md:hidden space-y-4 print:hidden">
            {filteredExpenses.map((e: any) => (
              <Card key={e.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white" onClick={() => router.push(`/expenses/${e.id}`)}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-muted-foreground uppercase">{formatCompactDate(e.expenseDate)}</p><Badge variant="secondary" className="capitalize text-[10px] font-bold mt-1">{e.category}</Badge></div><div className="text-right"><p className="text-xl font-black text-expense">৳{e.amount?.toLocaleString()}</p></div></div>
                  <div className="space-y-1"><p className="text-sm font-bold text-slate-700">{e.expensePartyName}</p>{e.description && <p className="text-xs text-muted-foreground line-clamp-1 italic">{e.description}</p>}</div>
                  <div className="pt-2 border-t flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase"><span className="flex items-center gap-1"><Building2 size={10}/> {e.buildingName}</span><Badge variant="outline" className="text-[8px] h-4 uppercase font-bold">{e.method}</Badge></div>
                </CardContent>
              </Card>
            ))}
            {filteredExpenses.length === 0 && <div className="text-center py-12 text-muted-foreground italic text-sm">No expense records found.</div>}
          </div>
        </>
      )}

      {/* FIXED ACTION BUTTON */}
      <div className="fixed bottom-8 right-8 z-50 print:hidden">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-expense"><Plus size={32} className="text-white" /></Button>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Expense Entry</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2"><Label>Category</Label><Select value={formData.category} onValueChange={val => setFormData({...formData, category: val, buildingId: 'none', apartmentName: '', roomNumber: '', receiver: '', month: MONTHS[new Date().getMonth()]})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Spent By</Label><Select value={formData.expensePartyName} onValueChange={val => setFormData({...formData, expensePartyName: val})}><SelectTrigger><SelectValue placeholder="Who spent?" /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Separator />
            <div className="space-y-4">
              {['rent', 'electricity', 'water', 'maintenance', 'internet', 'others'].includes(formData.category) && (
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Building</Label><Select value={formData.buildingId} onValueChange={val => setFormData({...formData, buildingId: val, apartmentName: "", roomNumber: ""})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">General</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                  {formData.buildingId !== 'none' && apartmentList.length > 0 && <div className="space-y-2"><Label>Apartment</Label><Select value={formData.apartmentName} onValueChange={val => { const apt = apartmentList.find((a: any) => a.name === val); setFormData({...formData, apartmentName: val, meterNo: apt?.meterNo || ""}); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{apartmentList.map((apt: any) => <SelectItem key={apt.name} value={apt.name}>{apt.name}</SelectItem>)}</SelectContent></Select></div>}
                  {formData.category === 'maintenance' && formData.buildingId !== 'none' && <div className="space-y-2"><Label>Room Number</Label><Select value={formData.roomNumber} onValueChange={val => setFormData({...formData, roomNumber: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roomList.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}</SelectContent></Select></div>}
                  {formData.category === 'electricity' && <div className="space-y-2"><Label>Meter No.</Label><Input value={formData.meterNo} onChange={e => setFormData({...formData, meterNo: e.target.value})} /></div>}
                </div>
              )}
              {formData.category === 'market' && <div className="p-4 bg-orange-50 rounded-xl space-y-4"><Label>Market Received By</Label><Select value={formData.receiver} onValueChange={val => setFormData({...formData, receiver: val})}><SelectTrigger><SelectValue placeholder="Receiver" /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>}
              {formData.category === 'salary' && <div className="p-4 bg-primary/5 rounded-xl space-y-4"><Label>Staff Salary</Label><Select value={formData.receiver} onValueChange={val => { const s = staffList?.find(st => st.name === val); setFormData({...formData, receiver: val, amount: s?.monthlySalary?.toString() || ""}); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>}
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Amount</Label><Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div><div className="space-y-2"><Label>Method</Label><Select value={formData.method} onValueChange={val => setFormData({...formData, method: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div></div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={formData.expenseDate} onChange={e => setFormData({...formData, expenseDate: e.target.value})} /></div>
            <div className="space-y-2"><Label>Note</Label><Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={handleCreateExpense} disabled={isSubmitting} className="w-full h-12 bg-expense">{isSubmitting ? <Loader2 className="animate-spin" /> : "Save Expense"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
