
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Receipt, Search, UserPlus, Loader2, Plus, Filter, Calendar } from "lucide-react"
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
import { collection, serverTimestamp, doc, setDoc, increment, query, orderBy, limit } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function ExpenseHistoryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  const [isAddingParty, setIsAddingParty] = useState(false)
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  // Data Fetching
  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const partiesQuery = useMemoFirebase(() => collection(db, "expenseParties"), [db])
  const { data: parties } = useCollection(partiesQuery)

  const expensesQuery = useMemoFirebase(() => query(collection(db, "expenses"), orderBy("expenseDate", "desc"), limit(100)), [db])
  const { data: expenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  // Entry Form State
  const [formData, setFormData] = useState({
    category: "market",
    buildingId: "",
    expensePartyId: "",
    amount: "",
    description: "",
    expenseDate: new Date().toISOString().split('T')[0],
    meterNumber: ""
  })

  const [newParty, setNewParty] = useState({ name: "", role: "", phone: "" })

  const filteredExpenses = useMemo(() => {
    if (!expenses) return []
    return expenses.filter(e => {
      const matchesCategory = categoryFilter === "all" || e.category === categoryFilter
      const matchesBuilding = buildingFilter === "all" || e.buildingId === buildingFilter
      const matchesSearch = e.expensePartyName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           e.description?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesCategory && matchesBuilding && matchesSearch
    })
  }, [expenses, categoryFilter, buildingFilter, searchTerm])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        e.preventDefault();
        const container = target.closest('[role="dialog"]') || target.closest('form');
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

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.buildingId || !formData.amount) return

    setIsSubmitting(true)
    const building = buildings?.find(b => b.id === formData.buildingId)
    const party = parties?.find(p => p.id === formData.expensePartyId)

    const amount = Number(formData.amount)
    const expenseId = doc(collection(db, "expenses")).id
    const dateObj = new Date(formData.expenseDate)
    const summaryId = `${dateObj.getFullYear()}-${dateObj.toLocaleString('default', { month: 'long' })}`

    try {
      await setDoc(doc(db, "expenses", expenseId), {
        ...formData,
        amount,
        buildingName: building?.name || "General",
        expensePartyName: party?.name || "Anonymous",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      await setDoc(doc(db, "summaries", summaryId), {
        totalExpense: increment(amount),
        [`categoryExpense.${formData.category}`]: increment(amount),
        updatedAt: serverTimestamp()
      }, { merge: true })

      toast({ title: "Expense Logged", description: "Transaction saved." })
      setFormData(prev => ({ ...prev, amount: "", description: "", meterNumber: "" }))
      setIsEntryOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddParty = async () => {
    if (!newParty.name) return
    setIsAddingParty(true)
    try {
      const partyId = doc(collection(db, "expenseParties")).id
      await setDoc(doc(db, "expenseParties", partyId), {
        ...newParty,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      setNewParty({ name: "", role: "", phone: "" })
      setIsAddingParty(false)
      toast({ title: "Party Added", description: "New vendor created." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsAddingParty(false)
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Expense History</h1>
            <p className="text-muted-foreground mt-1">Review all operational costs and market expenses.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-secondary/20 p-4 rounded-xl border">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1"><Search size={10}/> Search</Label>
          <Input placeholder="Recipient or notes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="utility">Utility Bills</SelectItem>
              <SelectItem value="market">Market / Groceries</SelectItem>
              <SelectItem value="salary">Staff Salaries</SelectItem>
              <SelectItem value="rent">Building Rent</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 size={10}/> Building</Label>
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter("all"); setBuildingFilter("all"); setSearchTerm("") }} className="h-10">Reset</Button>
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
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{new Date(e.expenseDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase font-normal">{e.category}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{e.expensePartyName}</TableCell>
                    <TableCell className="text-xs">{e.buildingName}</TableCell>
                    <TableCell className="text-right font-bold text-expense">₹{e.amount?.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {filteredExpenses.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No expenses found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Floating Action Button for Entry */}
      <div className="fixed bottom-8 right-8 z-50">
        <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg bg-destructive">
              <Plus className="h-8 w-8 text-white" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyDown}>
            <DialogHeader>
              <DialogTitle>Log New Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEntrySubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={val => setFormData({...formData, category: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utility">Utility Bills</SelectItem>
                    <SelectItem value="market">Market / Groceries</SelectItem>
                    <SelectItem value="salary">Staff Salaries</SelectItem>
                    <SelectItem value="rent">Building Rent</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Building</Label>
                <Select required onValueChange={val => setFormData({...formData, buildingId: val})}>
                  <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General / All</SelectItem>
                    {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Party / Recipient</Label>
                  <Button variant="link" size="sm" type="button" onClick={() => setIsAddingParty(true)}>Add New</Button>
                </div>
                <Select onValueChange={val => setFormData({...formData, expensePartyId: val})}>
                  <SelectTrigger><SelectValue placeholder="Select party" /></SelectTrigger>
                  <SelectContent>
                    {parties?.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.role})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" required value={formData.expenseDate} onChange={e => setFormData({...formData, expenseDate: e.target.value})} />
                </div>
              </div>

              {formData.category === "utility" && (
                <div className="space-y-2">
                  <Label>Meter Number</Label>
                  <Input value={formData.meterNumber} onChange={e => setFormData({...formData, meterNumber: e.target.value})} />
                </div>
              )}

              <Textarea placeholder="Expense details..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              
              <Button type="submit" className="w-full bg-expense h-12" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirm Expense"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isAddingParty} onOpenChange={setIsAddingParty}>
        <DialogContent onKeyDown={handleKeyDown}>
          <DialogHeader><DialogTitle>Add New Party</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Name" value={newParty.name} onChange={e => setNewParty({...newParty, name: e.target.value})} />
            <Input placeholder="Role (e.g. Electrician)" value={newParty.role} onChange={e => setNewParty({...newParty, role: e.target.value})} />
            <Input placeholder="Phone" maxLength={11} value={newParty.phone} onChange={e => setNewParty({...newParty, phone: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={handleAddParty} disabled={isAddingParty}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
