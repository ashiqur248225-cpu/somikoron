
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
  Filter,
  Apple
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
  { id: "food", label: "Food / Meal Cost", icon: Utensils },
  { id: "market", label: "General Market", icon: Apple },
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
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")

  const [categoryFilter, setCategoryFilter] = useState("all")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [spentByFilter, setSpentByFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    category: "others",
    buildingId: "none",
    apartmentName: "",
    roomNumber: "",
    meterNo: "",
    amount: "",
    totalMeals: "",
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

  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)

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

  const handleCreateExpense = async () => {
    if (!formData.amount || !formData.expensePartyName) return
    setIsSubmitting(true)
    try {
      const selectedB = buildings?.find(b => b.id === formData.buildingId)
      const expenseId = doc(collection(db, "expenses")).id
      const expenseData = { 
        ...formData, 
        amount: Number(formData.amount), 
        totalMeals: formData.category === 'food' ? Number(formData.totalMeals || 0) : 0,
        branch: userBranch, 
        buildingName: selectedB?.name || "General", 
        updatedAt: serverTimestamp() 
      }

      if (userRole === 'Building Manager') {
        const reqId = doc(collection(db, "managerRequests")).id
        await setDoc(doc(db, "managerRequests", reqId), { ...expenseData, id: reqId, requestType: "expense", requestedBy: localStorage.getItem("somikoron_auth_id"), requestedByName: userName, createdAt: serverTimestamp() })
        toast({ title: "Request Sent" })
      } else {
        await setDoc(doc(db, "expenses", expenseId), { ...expenseData, id: expenseId, createdAt: serverTimestamp() })
        toast({ title: "Success" })
      }
      setIsEntryOpen(false)
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) }
    finally { setIsSubmitting(false) }
  }

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
    <div className="space-y-8 pb-20 print:p-0 w-full overflow-hidden">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Expense</h1><p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Spending for <span className="font-bold text-foreground">{userBranch}</span>.</p></div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Download PDF</span></Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* MASTER PDF PRINT DESIGN (Fixed Pattern Rule) */}
      <div className="print-only print-report-container">
        <div className="report-header">
          <h1 className="font-black uppercase">{templatesData?.hostelName || "SOMIKORON HOSTEL"}</h1>
          <p className="text-sm font-bold text-slate-600">{userBranch} Branch • Official Expense Ledger</p>
          <div className="mt-4 border-y py-2 grid grid-cols-2 text-left text-[9pt]">
            <div>
              <p><b>Filter Building:</b> {buildingFilter === 'all' ? 'All Properties' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
              <p><b>Category:</b> {categoryFilter.toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p><b>Period:</b> {startDate || 'N/A'} to {endDate || 'N/A'}</p>
              <p><b>Generated At:</b> {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="summary-section">
          <div className="summary-box">
            <p className="text-[8pt] font-black uppercase text-muted-foreground">Total Entries</p>
            <p className="text-lg font-black">{stats.count}</p>
          </div>
          <div className="summary-box">
            <p className="text-[8pt] font-black uppercase text-destructive">Total Expenditure</p>
            <p className="text-lg font-black text-destructive">৳{stats.total.toLocaleString()}</p>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr>
              <th className="w-[12%]">Date</th>
              <th className="w-[15%]">Category</th>
              <th className="w-[20%]">Details</th>
              <th className="w-[18%]">Building/Unit</th>
              <th className="w-[15%]">Spent By</th>
              <th className="w-[10%]">Method</th>
              <th className="w-[10%] text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map((e: any) => (
              <tr key={e.id}>
                <td className="text-[8pt]">{formatCompactDate(e.expenseDate)}</td>
                <td className="capitalize font-bold">{e.category}</td>
                <td className="text-[8pt] italic">{e.description || e.receiver || 'N/A'}</td>
                <td className="text-[8pt]">{e.buildingName} {e.roomNumber ? `- R${e.roomNumber}` : ''}</td>
                <td className="text-[8pt]">{e.expensePartyName}</td>
                <td className="uppercase text-[8pt]">{e.method}</td>
                <td className="text-right font-black">৳{e.amount?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white font-black">
              <td colSpan={6} className="text-right uppercase p-3">Grand Total</td>
              <td className="text-right p-3">৳{stats.total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="print-footer">
          <div className="signature-box">Accountant Signature</div>
          <div className="text-xs text-slate-400">Page <span className="page-number"></span></div>
          <div className="signature-box">Manager Signature</div>
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-3 xl:grid-cols-5 bg-secondary/20 p-4 rounded-xl border items-end gap-4 print:hidden">
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Category</Label><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Spent By</Label><Select value={spentByFilter} onValueChange={setSpentByFilter}><SelectTrigger className="bg-white h-10"><SelectValue placeholder="All Staff" /></SelectTrigger><SelectContent><SelectItem value="all">All Staff</SelectItem>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Date Range</Label><div className="flex gap-2"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 bg-white" /><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 bg-white" /></div></div>
        <Button variant="ghost" className="h-10 text-xs font-bold uppercase w-full" onClick={() => { setCategoryFilter("all"); setBuildingFilter("all"); setSpentByFilter("all"); setSearchTerm(""); setStartDate(""); setEndDate(""); }}>Reset</Button>
      </div>

      <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden print:hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-xs font-bold uppercase text-destructive">Total Filtered Expense</CardTitle><ArrowDownCircle className="h-4 w-4 text-destructive" /></CardHeader>
        <CardContent><div className="text-3xl font-black text-slate-900">৳{stats.total.toLocaleString()}</div><p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Based on {stats.count} records</p></CardContent>
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

      <div className="fixed bottom-8 right-8 z-50 print:hidden"><Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-expense"><Plus size={32} className="text-white" /></Button></div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record New Expense</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2"><Label>Category</Label><Select value={formData.category} onValueChange={val => setFormData({...formData, category: val, buildingId: 'none', apartmentName: '', roomNumber: '', receiver: '', totalMeals: '', month: MONTHS[new Date().getMonth()]})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Spent By</Label><Select value={formData.expensePartyName} onValueChange={val => setFormData({...formData, expensePartyName: val})}><SelectTrigger><SelectValue placeholder="Who spent?" /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
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
