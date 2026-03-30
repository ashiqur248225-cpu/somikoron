
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
import { Receipt, Search, UserPlus, Loader2, Plus, Filter, Calendar, TrendingDown } from "lucide-react"
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
  const [methodFilter, setMethodFilter] = useState("all")
  const [partyFilter, setPartyFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  // Data Fetching
  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const partiesQuery = useMemoFirebase(() => collection(db, "expenseParties"), [db])
  const { data: parties } = useCollection(partiesQuery)

  const expensesQuery = useMemoFirebase(() => query(collection(db, "expenses"), orderBy("expenseDate", "desc"), limit(200)), [db])
  const { data: expenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  // Entry Form State
  const [formData, setFormData] = useState({
    category: "market",
    buildingId: "",
    expensePartyId: "",
    amount: "",
    method: "cash",
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
      const matchesMethod = methodFilter === "all" || e.method === methodFilter
      const matchesParty = partyFilter === "all" || e.expensePartyId === partyFilter
      const matchesSearch = e.expensePartyName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           e.description?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesCategory && matchesBuilding && matchesMethod && matchesParty && matchesSearch
    })
  }, [expenses, categoryFilter, buildingFilter, methodFilter, partyFilter, searchTerm])

  const totalFilteredExpense = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [filteredExpenses])

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.buildingId || !formData.amount) return

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
        expensePartyName: party?.name || "Anonymous",
        createdAt: serverTimestamp(),
      })
      toast({ title: "Success", description: "Expense logged." })
      setIsEntryOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetFilters = () => {
    setCategoryFilter("all")
    setBuildingFilter("all")
    setMethodFilter("all")
    setPartyFilter("all")
    setSearchTerm("")
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Expense History</h1>
            <p className="text-muted-foreground mt-1">Review operational costs and market expenses.</p>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 bg-secondary/20 p-4 rounded-xl border">
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
              <SelectItem value="utility">Utility Bills</SelectItem>
              <SelectItem value="market">Market</SelectItem>
              <SelectItem value="salary">Salaries</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
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
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Party</Label>
          <Select value={partyFilter} onValueChange={setPartyFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Parties</SelectItem>
              {parties?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" className="h-10 mt-auto" onClick={resetFilters}>Reset</Button>
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
                    <TableCell className="font-medium">{e.expensePartyName}</TableCell>
                    <TableCell className="text-xs">{e.buildingName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase">{e.method || 'cash'}</Badge>
                    </TableCell>
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

      {/* FAB */}
      <div className="fixed bottom-8 right-8 z-50">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-destructive">
          <Plus className="h-8 w-8 text-white" />
        </Button>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Log New Expense</DialogTitle></DialogHeader>
          <form onSubmit={handleEntrySubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={formData.method} onValueChange={val => setFormData({...formData, method: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* ... other fields as per previous design ... */}
            <Button type="submit" className="w-full bg-expense" disabled={isSubmitting}>Confirm Expense</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
