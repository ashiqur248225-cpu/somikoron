
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
import { Plus, Loader2, Building2, UserCircle, Receipt, Calendar, Wrench, Lightbulb, Utensils, Wifi, Wallet, Zap, LayoutGrid, UserCheck, XCircle, Search, Filter, FileSpreadsheet, Printer, Download, Share2, FileText, BellRing, ShieldAlert } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

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
  
  // User Context
  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")
  const [canRequest, setCanRequest] = useState(true)

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setAssignedBuildingId(localStorage.getItem("assigned_building_id") || "none")
    setCanRequest(localStorage.getItem("can_request_expense") !== "false")
  }, [])

  // Filters State
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [expenserFilter, setExpenserFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [formData, setFormData] = useState({
    category: "others",
    buildingId: "",
    amount: "",
    method: "cash",
    expensePartyName: "",
    receiver: "",
    description: "",
    expenseDate: new Date().toISOString().split('T')[0],
  })

  // Branch-Filtered Queries
  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "buildings"), where("id", "==", assignedBuildingId))
    }
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: buildings } = useCollection(buildingsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "expenses"), where("buildingId", "==", assignedBuildingId), limit(500))
    }
    return query(collection(db, "expenses"), where("branch", "==", userBranch), limit(500))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: rawExpenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  // Sort in memory
  const expenses = useMemo(() => {
    if (!rawExpenses) return []
    return [...rawExpenses].sort((a, b) => {
      const dateA = new Date(a.expenseDate)
      const dateB = new Date(b.expenseDate)
      return dateB.getTime() - dateA.getTime()
    })
  }, [rawExpenses])

  useEffect(() => {
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none' && !formData.buildingId) {
      setFormData(prev => ({ ...prev, buildingId: assignedBuildingId }))
    }
  }, [userRole, assignedBuildingId, formData.buildingId])

  const filteredExpenses = useMemo(() => {
    if (!expenses) return []
    return expenses.filter(e => {
      const eDate = new Date(e.expenseDate)
      const matchesCategory = categoryFilter === "all" || e.category === categoryFilter
      const matchesBuilding = buildingFilter === "all" || e.buildingId === buildingFilter
      const matchesMethod = methodFilter === "all" || e.method === methodFilter
      const matchesExpenser = expenserFilter === "all" || e.expensePartyName === expenserFilter
      const matchesStartDate = !startDate || eDate >= new Date(startDate)
      const matchesEndDate = !endDate || eDate <= new Date(new Date(endDate).setHours(23, 59, 59))
      return matchesCategory && matchesBuilding && matchesMethod && matchesExpenser && matchesStartDate && matchesEndDate
    })
  }, [expenses, categoryFilter, buildingFilter, methodFilter, expenserFilter, startDate, endDate])

  const totalFilteredExpense = useMemo(() => filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0), [filteredExpenses])

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.amount || !formData.buildingId || !formData.expensePartyName) {
      toast({ variant: "destructive", title: "Error", description: "Amount, Building and Expenser name are required." })
      return
    }

    setIsSubmitting(true)
    const building = buildings?.find(b => b.id === formData.buildingId)
    
    const recordPayload = {
      ...formData,
      amount: Number(formData.amount),
      buildingName: building?.name || "General",
      branch: userBranch, // CRITICAL
      createdAt: serverTimestamp(),
      requestedBy: localStorage.getItem("somikoron_auth_id") || "system",
      requestedByName: localStorage.getItem("user_name")
    }

    try {
      if (userRole === 'Building Manager') {
        const reqId = doc(collection(db, "managerRequests")).id
        await setDoc(doc(db, "managerRequests", reqId), {
          ...recordPayload,
          id: reqId,
          requestType: 'expense'
        })
        toast({ title: "Request Sent", description: "Expense request sent for approval." })
      } else {
        const expenseId = doc(collection(db, "expenses")).id
        await setDoc(doc(db, "expenses", expenseId), { ...recordPayload, id: expenseId })
        toast({ title: "Success", description: "Expense recorded." })
      }
      setIsEntryOpen(false)
      setFormData({
        category: "others", buildingId: assignedBuildingId || "", amount: "", method: "cash", 
        expensePartyName: "", receiver: "", description: "",
        expenseDate: new Date().toISOString().split('T')[0],
      })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Expenses</h1>
            <p className="text-muted-foreground mt-1">Spending records for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2"><FileSpreadsheet size={16} /> Export CSV</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2"><Download size={16} /> Export / Share</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePrint} className="cursor-pointer">
                <FileText size={14} className="mr-2" /> Download PDF (Print)
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Share2 size={14} className="mr-2" /> Share Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden">
        <Card className="bg-destructive/5 border-none shadow-sm border-l-4 border-l-destructive">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
              Total Expenses (Filtered)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div><p className="text-3xl font-bold text-destructive">৳{totalFilteredExpense.toLocaleString()}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {userRole !== 'Building Manager' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 bg-secondary/20 p-4 rounded-xl border items-end print:hidden">
           <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}
                </SelectContent>
              </Select>
           </div>
           <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold">Building</Label>
              <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buildings</SelectItem>
                  {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
           </div>
           <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold">Method</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bkash">Bkash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
           </div>
           <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold">Expenser</Label>
              <Select value={expenserFilter} onValueChange={setExpenserFilter}>
                <SelectTrigger><SelectValue placeholder="All Staff" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
           </div>
           <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase font-bold">From</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
           <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase font-bold">To</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
           <Button variant="ghost" className="h-10" onClick={() => { setCategoryFilter("all"); setBuildingFilter("all"); setMethodFilter("all"); setExpenserFilter("all"); setStartDate(""); setEndDate("") }}>
             <XCircle size={14} className="mr-1" /> Reset
           </Button>
        </div>
      )}

      <Card className="border-none shadow-sm overflow-hidden print:hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Expenser</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expensesLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
              ) : filteredExpenses?.map((e: any) => (
                <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/expenses/${e.id}`)}>
                  <TableCell className="text-xs">{new Date(e.expenseDate).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize text-[10px]">{e.category}</Badge></TableCell>
                  <TableCell className="text-xs">{e.buildingName}</TableCell>
                  <TableCell className="text-xs font-medium">{e.expensePartyName}</TableCell>
                  <TableCell className="text-right font-bold text-expense">৳{e.amount?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {filteredExpenses.length === 0 && !expensesLoading && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No expense records found matching these criteria.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="fixed bottom-8 right-8 z-50 print:hidden">
        {userRole === 'Building Manager' ? (
          canRequest ? (
            <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-destructive hover:scale-105 transition-transform">
              <BellRing size={24} className="text-white" />
            </Button>
          ) : (
            <div className="bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-destructive/20 text-destructive text-[10px] font-bold flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-right-4">
              <ShieldAlert size={14} /> Request Disabled
            </div>
          )
        ) : (
          <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-destructive hover:scale-105 transition-transform">
            <Plus size={32} className="text-white" />
          </Button>
        )}
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{userRole === 'Building Manager' ? "Submit Expense Request" : "Log Expense Entry"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEntrySubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={val => setFormData({...formData, category: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Building</Label>
              <Select value={formData.buildingId} onValueChange={(val) => setFormData({...formData, buildingId: val})}>
                <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                <SelectContent>
                  {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Paid By (Expenser/Manager)</Label>
              <Select value={formData.expensePartyName} onValueChange={val => setFormData({...formData, expensePartyName: val})}>
                <SelectTrigger><SelectValue placeholder="Who is paying?" /></SelectTrigger>
                <SelectContent>
                  {staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{formData.category === 'salary' ? "Paid To (Staff Name)" : "Receiver (Party/Vendor Name)"}</Label>
              <div className="relative">
                <Input 
                  value={formData.receiver} 
                  onChange={e => setFormData({...formData, receiver: e.target.value})} 
                  placeholder={formData.category === 'salary' ? "Employee Name" : "Receiver Name"} 
                />
                {formData.category === 'salary' && (
                  <div className="mt-2">
                    <p className="text-[10px] text-muted-foreground mb-1 uppercase font-bold">Quick Select Staff:</p>
                    <div className="flex flex-wrap gap-1">
                      {staffList?.map(s => (
                        <Button 
                          key={s.id} 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="h-6 text-[9px] px-2"
                          onClick={() => setFormData({...formData, receiver: s.name})}
                        >
                          {s.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Amount (৳)</Label><Input type="number" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={formData.method} onValueChange={val => setFormData({...formData, method: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2"><Label>Expense Date</Label><Input type="date" value={formData.expenseDate} onChange={e => setFormData({...formData, expenseDate: e.target.value})} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea placeholder="Details..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>

            <Button type="submit" className="w-full bg-destructive h-12 text-lg font-bold" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : (userRole === 'Building Manager' ? "Send Approval Request" : "Confirm Expense Record")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
