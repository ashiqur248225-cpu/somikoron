
"use client"

import { useState, useMemo } from "react"
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
import { Plus, Loader2, Building2, UserCircle, Receipt, Calendar, Wrench, Lightbulb, Utensils, Wifi, Wallet, Zap, LayoutGrid, UserCheck, XCircle, Search, Filter } from "lucide-react"
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
import { collection, serverTimestamp, doc, setDoc, query, orderBy, limit } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

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
  
  // Filters State
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [expenserFilter, setExpenserFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [formData, setFormData] = useState({
    category: "market",
    buildingId: "",
    apartmentName: "",
    roomNumber: "",
    amount: "",
    method: "cash",
    expensePartyName: "",
    receiver: "",
    description: "",
    expenseDate: new Date().toISOString().split('T')[0],
  })

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const expensesQuery = useMemoFirebase(() => query(collection(db, "expenses"), orderBy("expenseDate", "desc"), limit(500)), [db])
  const { data: expenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  const selectedBuildingForForm = useMemo(() => buildings?.find(b => b.id === formData.buildingId), [buildings, formData.buildingId])
  const apartmentsInBuilding = useMemo(() => selectedBuildingForForm?.apartmentsDetail || [], [selectedBuildingForForm])

  const filteredExpenses = useMemo(() => {
    if (!expenses) return []
    return expenses.filter(e => {
      const eDate = new Date(e.expenseDate)
      const matchesSearch = 
        (e.expensePartyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.buildingName || "").toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = categoryFilter === "all" || e.category === categoryFilter
      const matchesBuilding = buildingFilter === "all" || e.buildingId === buildingFilter
      const matchesExpenser = expenserFilter === "all" || e.expensePartyName === expenserFilter
      const matchesMethod = methodFilter === "all" || e.method === methodFilter
      const matchesStartDate = !startDate || eDate >= new Date(startDate)
      const matchesEndDate = !endDate || eDate <= new Date(new Date(endDate).setHours(23, 59, 59))

      return matchesSearch && matchesCategory && matchesBuilding && matchesExpenser && matchesMethod && matchesStartDate && matchesEndDate
    })
  }, [expenses, searchTerm, categoryFilter, buildingFilter, expenserFilter, methodFilter, startDate, endDate])

  const totalFilteredExpense = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0)
  }, [filteredExpenses])

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.amount || !formData.expensePartyName) {
      toast({ variant: "destructive", title: "Error", description: "Amount and Expenser are required." })
      return
    }

    setIsSubmitting(true)
    const building = buildings?.find(b => b.id === formData.buildingId)
    const expenseId = doc(collection(db, "expenses")).id

    try {
      await setDoc(doc(db, "expenses", expenseId), {
        ...formData,
        id: expenseId,
        amount: Number(formData.amount),
        buildingName: building?.name || "General",
        createdAt: serverTimestamp(),
      })
      toast({ title: "Success", description: "Expense recorded." })
      setIsEntryOpen(false)
      setFormData({
        category: "market", buildingId: "", apartmentName: "", roomNumber: "", amount: "", method: "cash", 
        expensePartyName: "", receiver: "", description: "",
        expenseDate: new Date().toISOString().split('T')[0],
      })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetFilters = () => {
    setSearchTerm("")
    setCategoryFilter("all")
    setBuildingFilter("all")
    setExpenserFilter("all")
    setMethodFilter("all")
    setStartDate("")
    setEndDate("")
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-3xl font-headline font-bold text-primary">Expenses</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-destructive/5 border-none shadow-sm border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
              <Receipt size={16} /> Total Expenses (Filtered)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">₹{totalFilteredExpense.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 bg-secondary/20 p-4 rounded-xl border items-end">
         <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase font-bold">Search</Label>
            <Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
         </div>
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
                <SelectItem value="none">General</SelectItem>
                {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
         </div>
         <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase font-bold">Expenser</Label>
            <Select value={expenserFilter} onValueChange={setExpenserFilter}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
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
            <Label className="text-[10px] text-muted-foreground uppercase font-bold">From Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
         </div>
         <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase font-bold">To Date</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
         </div>
         <Button variant="ghost" className="h-10" onClick={handleResetFilters}>
           <XCircle size={14} className="mr-1" /> Reset
         </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Expenser / Party</TableHead>
                <TableHead>Location</TableHead>
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
                  <TableCell className="font-medium text-sm">
                    <div className="flex flex-col">
                      <span>{e.expensePartyName}</span>
                      {e.receiver && <span className="text-[10px] text-muted-foreground italic">via {e.receiver}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col">
                      <span>{e.buildingName}</span>
                      {e.apartmentName && e.apartmentName !== 'none' && <span className="text-[10px] text-muted-foreground">{e.apartmentName} {e.roomNumber ? `| Room ${e.roomNumber}` : ''}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-expense">₹{e.amount?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {filteredExpenses?.length === 0 && !expensesLoading && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No expenses found for these criteria.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="fixed bottom-8 right-8 z-50">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-destructive hover:scale-105 transition-transform"><Plus className="h-8 w-8 text-white" /></Button>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Log Expense Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleEntrySubmit} className="space-y-4 py-4">
            
            <div className="space-y-2">
              <Label>Expense Category</Label>
              <Select value={formData.category} onValueChange={val => setFormData({...formData, category: val, buildingId: "", apartmentName: "", roomNumber: "", receiver: ""})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {["rent", "electricity", "water", "maintenance", "internet"].includes(formData.category) && (
              <div className="space-y-2 p-3 bg-secondary/10 rounded-lg border">
                <Label className="flex items-center gap-1.5"><Building2 size={12}/> Target Building</Label>
                <Select value={formData.buildingId} onValueChange={val => setFormData({...formData, buildingId: val, apartmentName: "", roomNumber: ""})}>
                  <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                  <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {formData.buildingId && (
              <div className="space-y-3 p-3 bg-primary/5 border rounded-lg">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase flex items-center gap-1.5">
                    <LayoutGrid size={12} className="text-primary"/> 
                    {formData.category === 'electricity' ? 'Apartment / Meter (Required)' : 'Apartment / Unit (Optional)'}
                  </Label>
                  <Select value={formData.apartmentName} onValueChange={val => setFormData({...formData, apartmentName: val})}>
                    <SelectTrigger><SelectValue placeholder="Select Apartment" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- None --</SelectItem>
                      {apartmentsInBuilding.map((a: any) => <SelectItem key={a.id || a.name} value={a.name}>{a.name} (Meter: {a.meterNo})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                {["maintenance", "internet"].includes(formData.category) && (
                   <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase">Specific Room (Optional)</Label>
                      <Input placeholder="e.g. 301" value={formData.roomNumber} onChange={e => setFormData({...formData, roomNumber: e.target.value})} />
                   </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 font-bold"><UserCheck size={14} className="text-primary"/> Expenser (Staff Name)</Label>
              <Select value={formData.expensePartyName} onValueChange={val => setFormData({...formData, expensePartyName: val})}>
                <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                <SelectContent>
                  {staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {["market", "salary"].includes(formData.category) && (
              <div className="space-y-2 p-3 bg-success/5 border-success/20 border rounded-lg">
                <Label className="flex items-center gap-1.5 text-success font-bold">Receiver (Staff member)</Label>
                <Select value={formData.receiver} onValueChange={val => setFormData({...formData, receiver: val})}>
                  <SelectTrigger><SelectValue placeholder="Select Staff" /></SelectTrigger>
                  <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input type="number" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
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
              <Label>Expense Date</Label>
              <Input type="date" value={formData.expenseDate} onChange={e => setFormData({...formData, expenseDate: e.target.value})} />
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea placeholder="Details about the expense..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>

            <Button type="submit" className="w-full bg-destructive h-12 text-lg font-bold" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirm Expense Record"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
