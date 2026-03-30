
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
import { TrendingDown, Plus, Loader2, Building2, UserCircle, Receipt, Calendar, Wrench, Lightbulb, Utensils, Wifi, Wallet, Zap, LayoutGrid } from "lucide-react"
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
  
  const [formData, setFormData] = useState({
    category: "market",
    buildingId: "",
    apartmentName: "",
    amount: "",
    method: "cash",
    description: "",
    expenseDate: new Date().toISOString().split('T')[0],
  })

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const expensesQuery = useMemoFirebase(() => query(collection(db, "expenses"), orderBy("expenseDate", "desc"), limit(200)), [db])
  const { data: expenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  const selectedBuildingForForm = useMemo(() => buildings?.find(b => b.id === formData.buildingId), [buildings, formData.buildingId])
  const apartmentsInBuilding = useMemo(() => selectedBuildingForForm?.apartmentsDetail || [], [selectedBuildingForForm])

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.buildingId || !formData.amount) return

    setIsSubmitting(true)
    const building = buildings?.find(b => b.id === formData.buildingId)
    const expenseId = doc(collection(db, "expenses")).id

    try {
      await setDoc(doc(db, "expenses", expenseId), {
        ...formData,
        amount: Number(formData.amount),
        buildingName: building?.name || "General",
        createdAt: serverTimestamp(),
      })
      toast({ title: "Success", description: "Expense recorded." })
      setIsEntryOpen(false)
      setFormData({
        category: "market", buildingId: "", apartmentName: "", amount: "", method: "cash", description: "",
        expenseDate: new Date().toISOString().split('T')[0],
      })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-headline font-bold text-primary">Expenses</h1>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Building</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses?.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{new Date(e.expenseDate).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize text-[10px]">{e.category}</Badge></TableCell>
                  <TableCell className="text-xs">{e.buildingName} {e.apartmentName ? `(${e.apartmentName})` : ''}</TableCell>
                  <TableCell className="text-right font-bold text-expense">₹{e.amount?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="fixed bottom-8 right-8 z-50">
        <Button onClick={() => setIsEntryOpen(true)} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-destructive"><Plus className="h-8 w-8 text-white" /></Button>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Log Expense</DialogTitle></DialogHeader>
          <form onSubmit={handleEntrySubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={val => setFormData({...formData, category: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Building</Label>
              <Select onValueChange={val => setFormData({...formData, buildingId: val, apartmentName: ""})}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {formData.category === 'electricity' && formData.buildingId && (
              <div className="space-y-2 p-3 bg-primary/5 border rounded-lg">
                <Label className="flex items-center gap-1.5"><LayoutGrid size={12} className="text-primary"/> Select Apartment/Unit</Label>
                <Select onValueChange={val => {
                  const apt = apartmentsInBuilding.find((a: any) => a.name === val)
                  setFormData({...formData, apartmentName: val})
                }}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{apartmentsInBuilding.map((a: any) => <SelectItem key={a.name} value={a.name}>{a.name} (Meter: {a.meterNo})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Amount</Label><Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
              <div className="space-y-2"><Label>Method</Label><Select value={formData.method} onValueChange={val => setFormData({...formData, method: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem></SelectContent></Select></div>
            </div>

            <Textarea placeholder="Description..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            <Button type="submit" className="w-full bg-expense h-12 text-lg" disabled={isSubmitting}>Confirm Expense</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
