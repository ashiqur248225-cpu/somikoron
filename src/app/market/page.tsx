"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Loader2, 
  Trash2, 
  Calendar, 
  User, 
  CheckCircle2, 
  ArrowUpRight,
  TrendingDown,
  Receipt
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, setDoc, query, where, serverTimestamp, deleteDoc, orderBy, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function MarketTrackingPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    itemName: "",
    category: "Groceries",
    quantity: "",
    unitPrice: "",
    remarks: ""
  })

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  const marketQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "marketExpenses"), where("branch", "==", userBranch), orderBy("date", "desc"), limit(200))
  }, [db, userBranch])
  const { data: expenses, isLoading } = useCollection(marketQuery)

  const stats = useMemo(() => {
    if (!expenses) return { total: 0, count: 0 }
    const total = expenses.reduce((a, b) => a + (Number(b.quantity) * Number(b.unitPrice)), 0)
    return { total, count: expenses.length }
  }, [expenses])

  const handleCreate = async () => {
    if (!formData.itemName || !formData.quantity || !formData.unitPrice) {
      toast({ variant: "destructive", title: "Missing Data", description: "Item name, quantity and price are required." })
      return
    }

    setIsSubmitting(true)
    try {
      const expId = doc(collection(db, "marketExpenses")).id
      const totalPrice = Number(formData.quantity) * Number(formData.unitPrice)
      
      await setDoc(doc(db, "marketExpenses", expId), {
        ...formData,
        id: expId,
        totalPrice,
        branch: userBranch,
        purchasedBy: userName,
        createdAt: serverTimestamp()
      })

      // Optional: Log to general expenses for accounting sync
      const generalExpId = doc(collection(db, "expenses")).id
      await setDoc(doc(db, "expenses", generalExpId), {
        id: generalExpId,
        category: "market",
        amount: totalPrice,
        expenseDate: formData.date,
        description: `Market: ${formData.itemName} (${formData.quantity})`,
        method: "cash",
        spentBy: userName,
        branch: userBranch,
        buildingName: "Kitchen",
        createdAt: serverTimestamp()
      })

      toast({ title: "Expense Recorded", description: "Market item added successfully." })
      setIsAddOpen(false)
      setFormData({ date: new Date().toISOString().split('T')[0], itemName: "", category: "Groceries", quantity: "", unitPrice: "", remarks: "" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "marketExpenses", id))
      toast({ title: "Deleted", description: "Market entry removed." })
    } catch (e) {
      toast({ variant: "destructive", description: "Failed to delete." })
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Market Tracking</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Grocery and kitchen inventory expenses for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 h-10 rounded-xl font-bold">
                <Plus size={18} /> <span className="hidden sm:inline">New Purchase</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-3xl">
              <DialogHeader>
                <DialogTitle>Record Market Purchase</DialogTitle>
                <DialogDescription>Add grocery items to kitchen inventory.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Category</Label>
                    <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                       <SelectTrigger><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="Groceries">Groceries</SelectItem>
                          <SelectItem value="Vegetables">Vegetables</SelectItem>
                          <SelectItem value="Fish/Meat">Fish/Meat</SelectItem>
                          <SelectItem value="Kitchen Tools">Kitchen Tools</SelectItem>
                       </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Item Name</Label><Input value={formData.itemName} onChange={e => setFormData({...formData, itemName: e.target.value})} placeholder="e.g. Rice 50kg Bag" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Quantity</Label><Input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} placeholder="e.g. 5" /></div>
                  <div className="space-y-2"><Label>Unit Price (৳)</Label><Input type="number" value={formData.unitPrice} onChange={e => setFormData({...formData, unitPrice: e.target.value})} placeholder="0.00" /></div>
                </div>
                <div className="space-y-2"><Label>Remarks</Label><Input value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} placeholder="Notes..." /></div>
                <div className="p-3 bg-primary/5 rounded-xl text-center">
                   <p className="text-[10px] font-black uppercase text-primary">Total Price Calculated</p>
                   <p className="text-xl font-black text-slate-800">৳{(Number(formData.quantity || 0) * Number(formData.unitPrice || 0)).toLocaleString()}</p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={isSubmitting} className="w-full h-12 text-lg font-bold rounded-2xl">
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Receipt size={18} className="mr-2" />}
                  Record Expense
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-destructive rounded-2xl">
          <CardHeader className="pb-2 flex justify-between"><CardTitle className="text-[10px] font-bold uppercase text-destructive tracking-widest">Total Market Spend</CardTitle><TrendingDown size={14} className="text-destructive" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-slate-800">৳{stats.total.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-primary rounded-2xl">
          <CardHeader className="pb-2 flex justify-between"><CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest">Items Purchased</CardTitle><ShoppingBag size={14} className="text-primary" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-slate-800">{stats.count} Items</div></CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white rounded-3xl">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item Details</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total Price</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses?.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-[10px] font-bold text-slate-400">{e.date}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-sm">{e.itemName}</span>
                        <Badge variant="secondary" className="w-fit text-[8px] h-3.5 uppercase px-1.5">{e.category}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-600">{e.quantity}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-slate-500">৳{Number(e.unitPrice).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-black text-destructive text-lg">৳{Number(e.totalPrice).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(e.id)}><Trash2 size={14} /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {expenses?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No market entries found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
