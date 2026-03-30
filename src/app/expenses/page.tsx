
"use client"

import { useState, useMemo } from "react"
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
import { TrendingDown, Plus, Loader2, Building2, UserCircle, Receipt, Calendar, Wrench, Lightbulb, Utensils, Wifi, Wallet, Zap, DoorOpen } from "lucide-react"
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
  const db = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false)
  
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const partiesQuery = useMemoFirebase(() => collection(db, "expenseParties"), [db])
  const { data: parties } = useCollection(partiesQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const expensesQuery = useMemoFirebase(() => query(collection(db, "expenses"), orderBy("expenseDate", "desc"), limit(200)), [db])
  const { data: expenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  const [formData, setFormData] = useState({
    category: "market",
    buildingId: "",
    expensePartyId: "",
    amount: "",
    method: "cash",
    paidBy: "",
    description: "",
    meterNumber: "",
    roomNo: "",
    expenseDate: new Date().toISOString().split('T')[0],
  })

  const [newParty, setNewParty] = useState({ name: "", role: "", phone: "" })

  const selectedBuildingForForm = useMemo(() => buildings?.find(b => b.id === formData.buildingId), [buildings, formData.buildingId])
  const roomsInBuilding = useMemo(() => selectedBuildingForForm?.roomsDetail || [], [selectedBuildingForForm])

  const filteredExpenses = useMemo(() => {
    if (!expenses) return []
    return expenses.filter(e => {
      const matchesCategory = categoryFilter === "all" || e.category === categoryFilter
      const matchesBuilding = buildingFilter === "all" || e.buildingId === buildingFilter
      const matchesMethod = methodFilter === "all" || e.method === methodFilter
      const matchesSearch = e.expensePartyName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           e.category?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesCategory && matchesBuilding && matchesMethod && matchesSearch
    })
  }, [expenses, categoryFilter, buildingFilter, methodFilter, searchTerm])

  const totalFilteredExpense = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [filteredExpenses])

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.buildingId || !formData.amount) {
      toast({ variant: "destructive", title: "Error", description: "Building and Amount are required." })
      return
    }

    setIsSubmitting(true)
    const building = buildings?.find(b => b.id === formData.buildingId)
    const party = parties?.find(p => p.id === formData.expensePartyId)
    const amount = Number(formData.amount)
    const expenseId = doc(collection(db, "expenses")).id

    try {
      await setDoc(doc(db, "expenses", expenseId), {
        ...formData,
        amount,
        buildingName: building?.name || "General",
        expensePartyName: party?.name || "Self/General",
        createdAt: serverTimestamp(),
      })
      toast({ title: "Success", description: "Expense successfully recorded." })
      setIsEntryOpen(false)
      setFormData({
        category: "market",
        buildingId: "",
        expensePartyId: "",
        amount: "",
        method: "cash",
        paidBy: "",
        description: "",
        meterNumber: "",
        roomNo: "",
        expenseDate: new Date().toISOString().split('T')[0],
      })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddParty = async () => {
    if (!newParty.name) return
    setIsSubmitting(true)
    try {
      const partyId = doc(collection(db, "expenseParties")).id
      await setDoc(doc(db, "expenseParties", partyId), {
        ...newParty,
        createdAt: serverTimestamp()
      })
      toast({ title: "Success", description: "New party added to master list." })
      setNewParty({ name: "", role: "", phone: "" })
      setIsAddPartyOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        e.preventDefault();
        const container = target.closest('[role="dialog"]') || target.closest('.space-y-4');
        if (container) {
          const focusables = Array.from(container.querySelectorAll('input, button, [role="combobox"], textarea')) as HTMLElement[];
          const index = focusables.indexOf(target);
          if (index > -1 && index < focusables.length - 1) {
            focusables[index + 1].focus();
          }
        }
      }
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Expense History</h1>
            <p className="text-muted-foreground mt-1">Review operational costs and maintenance expenses.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-destructive/5 border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
              <TrendingDown size={16} /> Total Spent (Filtered)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">₹{totalFilteredExpense.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 bg-secondary/20 p-4 rounded-xl border">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <Input placeholder="Recipient or notes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {EXPENSE_CATEGORIES.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Building</Label>
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Method</Label>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bkash">Bkash</SelectItem>
              <SelectItem value="nagad">Nagad</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" className="h-10 mt-auto" onClick={() => { setCategoryFilter("all"); setBuildingFilter("all"); setMethodFilter("all"); setSearchTerm("") }}>Reset</Button>
      </div>

      {expensesLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Party / Recipient</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{new Date(e.expenseDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize text-[10px]">
                        {EXPENSE_CATEGORIES.find(cat => cat.id === e.category)?.label || e.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{e.expensePartyName}</TableCell>
                    <TableCell className="text-xs">{e.buildingName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase">{e.method || 'cash'}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-expense">₹{e.amount?.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {filteredExpenses.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No expense records found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-8 right-8 z-50">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-destructive hover:bg-destructive/90">
          <Plus className="h-8 w-8 text-white" />
        </Button>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyDown}>
          <DialogHeader>
            <DialogTitle>Log New Expense</DialogTitle>
            <DialogDescription>Record hostel costs. Select building to pick meter numbers for electricity bills.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEntrySubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={val => setFormData({...formData, category: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Building</Label>
              <Select onValueChange={val => setFormData({...formData, buildingId: val, meterNumber: "", roomNo: ""})}>
                <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {formData.category === 'electricity' && formData.buildingId && (
              <div className="space-y-2 p-3 bg-primary/5 border rounded-lg">
                <Label className="flex items-center gap-1.5"><Zap size={12} className="text-primary"/> Select Apartment/Meter</Label>
                <Select onValueChange={val => {
                  const room = roomsInBuilding.find(r => r.roomNo === val)
                  setFormData({...formData, roomNo: val, meterNumber: room?.meterNo || ""})
                }}>
                  <SelectTrigger><SelectValue placeholder="Select Unit" /></SelectTrigger>
                  <SelectContent>
                    {roomsInBuilding.map(r => (
                      <SelectItem key={r.roomNo} value={r.roomNo}>
                        Room {r.roomNo} {r.meterNo ? `(M: ${r.meterNo})` : "(No Meter)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.meterNumber && (
                  <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase">
                    Meter Number: <span className="text-primary">{formData.meterNumber}</span>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Recipient / Vendor (Optional)</Label>
                <Button variant="link" size="sm" onClick={() => setIsAddPartyOpen(true)} className="h-auto p-0 text-xs">Add New Party</Button>
              </div>
              <Select onValueChange={val => setFormData({...formData, expensePartyId: val})}>
                <SelectTrigger><SelectValue placeholder="General / Unspecified" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">General / Unspecified</SelectItem>
                  {parties?.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.role})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input type="number" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Expense Date</Label>
                <Input type="date" value={formData.expenseDate} onChange={e => setFormData({...formData, expenseDate: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Method</Label>
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
              <div className="space-y-2">
                <Label>Paid By (Staff)</Label>
                <Select onValueChange={val => setFormData({...formData, paidBy: val})}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Voucher details, reason for expense, etc." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>

            <Button type="submit" className="w-full bg-expense h-12 text-lg" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirm Expense Entry"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddPartyOpen} onOpenChange={setIsAddPartyOpen}>
        <DialogContent onKeyDown={handleKeyDown}>
          <DialogHeader><DialogTitle>Add New Party / Vendor</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Electrician, Vendor Shop, etc." value={newParty.name} onChange={e => setNewParty({...newParty, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Role / Category</Label>
              <Input placeholder="e.g. Mistri, Cook, Landlord" value={newParty.role} onChange={e => setNewParty({...newParty, role: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Phone (Optional)</Label>
              <Input placeholder="Contact number" value={newParty.phone} onChange={e => setNewParty({...newParty, phone: e.target.value})} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddParty} disabled={isSubmitting}>Save Master Party</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
