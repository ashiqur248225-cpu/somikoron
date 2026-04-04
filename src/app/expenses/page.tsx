
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectGroup,
  SelectItem, 
  SelectLabel,
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Loader2, Building2, UserCircle, Receipt, Calendar, Wrench, Lightbulb, Utensils, Wifi, Wallet, Zap, LayoutGrid, UserCheck, XCircle, Search, Filter, FileSpreadsheet, Printer, Download, Share2, FileText, BellRing, ShieldAlert, ArrowDownRight, ArrowDownCircle } from "lucide-react"
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
import { collection, serverTimestamp, doc, setDoc, query, orderBy, limit, where } from "firebase/firestore"
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

export default function ExpenseHistoryPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  
  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")

  const [categoryFilter, setCategoryFilter] = useState("all")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [formData, setFormData] = useState({
    category: "others",
    buildingId: "none",
    apartmentName: "",
    amount: "",
    method: "cash",
    expensePartyName: "",
    receiver: "",
    description: "",
    expenseDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    setAssignedBuildingId(localStorage.getItem("assigned_building_id") || "none")
    
    if (localStorage.getItem("user_role") === 'Building Manager' && localStorage.getItem("assigned_building_id") !== 'none') {
      setBuildingFilter(localStorage.getItem("assigned_building_id") || "all")
    }
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
    return query(collection(db, "expenses"), where("branch", "==", userBranch), limit(500))
  }, [db, userBranch])
  const { data: rawExpenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  const expenses = useMemo(() => {
    if (!rawExpenses) return []
    return [...rawExpenses].sort((a, b) => {
      const dateA = new Date(a.expenseDate)
      const dateB = new Date(b.expenseDate)
      return dateB.getTime() - dateA.getTime()
    })
  }, [rawExpenses])

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesCategory = categoryFilter === "all" || e.category === categoryFilter
      const matchesBuilding = buildingFilter === "all" || e.buildingId === buildingFilter
      const matchesSearch = (e.expensePartyName || "").toLowerCase().includes(searchTerm.toLowerCase()) || (e.description || "").toLowerCase().includes(searchTerm.toLowerCase())
      
      const eDate = new Date(e.expenseDate)
      const matchesStartDate = !startDate || eDate >= new Date(startDate)
      const matchesEndDate = !endDate || eDate <= new Date(new Date(endDate).setHours(23, 59, 59))
      
      return matchesCategory && matchesBuilding && matchesSearch && matchesStartDate && matchesEndDate
    })
  }, [expenses, categoryFilter, buildingFilter, searchTerm, startDate, endDate])

  const totalFilteredExpense = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [filteredExpenses])

  const handleCreateExpense = async () => {
    if (!formData.amount || !formData.expensePartyName) {
      toast({ variant: "destructive", title: "Error", description: "Amount and Expenser Name are required." })
      return
    }

    setIsSubmitting(true)
    try {
      const expenseId = doc(collection(db, "expenses")).id
      const selectedBuilding = buildings?.find(b => b.id === formData.buildingId)
      
      await setDoc(doc(db, "expenses", expenseId), {
        ...formData,
        id: expenseId,
        amount: Number(formData.amount),
        branch: userBranch,
        buildingName: selectedBuilding?.name || "General",
        createdAt: serverTimestamp()
      })

      toast({ title: "Expense Recorded", description: `Amount ৳${formData.amount} saved.` })
      setIsEntryOpen(false)
      setFormData({
        category: "others",
        buildingId: "none",
        apartmentName: "",
        amount: "",
        method: "cash",
        expensePartyName: "",
        receiver: "",
        description: "",
        expenseDate: new Date().toISOString().split('T')[0]
      })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  const handleExportCSV = () => {
    try {
      const headers = ["Date", "Category", "Building", "Paid By", "Method", "Amount", "Description"];
      const rows = filteredExpenses.map(e => [
        e.expenseDate,
        e.category,
        e.buildingName,
        e.expensePartyName,
        e.method,
        e.amount,
        e.description
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(val => `"${val || ''}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `expenses_history_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Export Success", description: "CSV file downloaded." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export Failed", description: err.message });
    }
  }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Expense</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Spending for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={handleExportCSV}><Download size={16} /> <span className="hidden sm:inline">Export</span></Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Print</span></Button>
          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">{userName ? userName.substring(0, 2) : "U"}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden group hover:shadow-md transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-destructive">Total Filtered Expense</CardTitle>
          <div className="bg-destructive/10 p-1.5 rounded-full"><ArrowDownCircle className="h-4 w-4 text-destructive" /></div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black text-slate-900">৳{totalFilteredExpense.toLocaleString()}</div>
          <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Based on current filters</p>
        </CardContent>
      </Card>

      <div className="bg-secondary/20 p-4 rounded-xl border space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Building</Label>
            <Select value={buildingFilter} onValueChange={setBuildingFilter}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Search</Label>
            <Input placeholder="Description or party..." className="bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Calendar size={10}/> Date From</Label>
            <Input type="date" className="bg-white h-10" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Calendar size={10}/> Date To</Label>
            <Input type="date" className="bg-white h-10" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <Button variant="ghost" className="h-10 font-bold uppercase text-xs" onClick={() => { setSearchTerm(""); setCategoryFilter("all"); setBuildingFilter("all"); setStartDate(""); setEndDate(""); }}>
            <XCircle size={14} className="mr-1" /> Reset Filters
          </Button>
        </div>
      </div>

      {expensesLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* Table for Desktop */}
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Expenser</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((e: any) => (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/expenses/${e.id}`)}>
                      <TableCell className="text-xs font-bold text-slate-500">{new Date(e.expenseDate).toLocaleDateString()}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize text-[10px] font-bold">{e.category}</Badge></TableCell>
                      <TableCell className="font-bold text-slate-700">{e.expensePartyName}</TableCell>
                      <TableCell className="text-right font-black text-expense">৳{e.amount?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cards for Mobile */}
          <div className="md:hidden space-y-4">
            {filteredExpenses.map((e: any) => (
              <Card key={e.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white" onClick={() => router.push(`/expenses/${e.id}`)}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="font-black text-slate-800 text-lg leading-tight capitalize">{e.category}</h3>
                      <p className="text-xs font-bold text-slate-400">{new Date(e.expenseDate).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-expense flex items-center gap-1 justify-end">
                        <ArrowDownRight size={14} /> ৳{e.amount?.toLocaleString()}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">{e.method}</p>
                    </div>
                  </div>
                  <Separator className="opacity-50" />
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">
                    <UserCircle size={10} /> Paid By: {e.expensePartyName}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredExpenses.length === 0 && <div className="text-center py-12 text-muted-foreground italic">No expense records found.</div>}
          </div>
        </>
      )}

      {/* FAB */}
      <div className="fixed bottom-8 right-8 z-50 print:hidden">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-expense hover:scale-105 transition-transform">
          <Plus size={32} className="text-white" />
        </Button>
      </div>

      {/* NEW EXPENSE DIALOG */}
      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record New Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={val => setFormData({...formData, category: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Building / Property</Label>
              <Select value={formData.buildingId} onValueChange={val => setFormData({...formData, buildingId: val})}>
                <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General (No Building)</SelectItem>
                  {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (৳)</Label>
                <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={formData.method} onValueChange={val => setFormData({...formData, method: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bkash">Bkash</SelectItem>
                    <SelectItem value="nagad">Nagad</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Expenser (Who Paid?)</Label>
              <Select value={formData.expensePartyName} onValueChange={val => setFormData({...formData, expensePartyName: val})}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Expense Date</Label>
              <Input type="date" value={formData.expenseDate} onChange={e => setFormData({...formData, expenseDate: e.target.value})} />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="What was this for?" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateExpense} disabled={isSubmitting} className="w-full h-12 text-lg font-bold bg-expense hover:bg-expense/90">
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Save Expense Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
