
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
  Receipt,
  X,
  PlusCircle
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, setDoc, query, where, serverTimestamp, deleteDoc, orderBy, limit, writeBatch } from "firebase/firestore"
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

const MARKET_CATEGORIES: Record<string, string[]> = {
  "Groceries": ["Oil", "Rice", "Lentils (Dal)", "Salt/Sugar", "Spices", "Other"],
  "Vegetables": ["Potato", "Onion", "Green Chili", "Seasonal Veg", "Other"],
  "Fish/Meat": ["Chicken", "Beef", "Fish", "Egg", "Other"],
  "Kitchen Tools": ["Cleaning", "Utensils", "Gas Refill", "Other"],
  "Others": ["General"]
}

interface MarketItem {
  id: string;
  itemName: string;
  category: string;
  subCategory: string;
  quantity: string;
  unitPrice: string;
}

export default function MarketTrackingPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [items, setItems] = useState<MarketItem[]>([
    { id: Math.random().toString(36).substr(2, 9), itemName: "", category: "Groceries", subCategory: "", quantity: "", unitPrice: "" }
  ])

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
    const total = expenses.reduce((a, b) => a + (Number(b.totalPrice || 0)), 0)
    return { total, count: expenses.length }
  }, [expenses])

  const handleAddItem = () => {
    setItems([...items, { id: Math.random().toString(36).substr(2, 9), itemName: "", category: "Groceries", subCategory: "", quantity: "", unitPrice: "" }])
  }

  const handleRemoveItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof MarketItem, value: string) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  const handleCreateBatch = async () => {
    const invalid = items.some(item => !item.itemName || !item.quantity || !item.unitPrice)
    if (invalid) {
      toast({ variant: "destructive", title: "Missing Data", description: "All fields are required for each item." })
      return
    }

    setIsSubmitting(true)
    try {
      const batch = writeBatch(db)
      let totalPurchaseCost = 0

      for (const item of items) {
        const expId = doc(collection(db, "marketExpenses")).id
        const totalPrice = Number(item.quantity) * Number(item.unitPrice)
        totalPurchaseCost += totalPrice
        
        batch.set(doc(db, "marketExpenses", expId), {
          ...item,
          id: expId,
          date: purchaseDate,
          totalPrice,
          branch: userBranch,
          purchasedBy: userName,
          createdAt: serverTimestamp()
        })

        // Also log each to general expenses for accounting sync
        const generalExpId = doc(collection(db, "expenses")).id
        batch.set(doc(db, "expenses", generalExpId), {
          id: generalExpId,
          category: "market",
          amount: totalPrice,
          expenseDate: purchaseDate,
          description: `Market: ${item.itemName} (${item.category} > ${item.subCategory || 'General'})`,
          method: "cash",
          spentBy: userName,
          branch: userBranch,
          buildingName: "Kitchen",
          createdAt: serverTimestamp()
        })
      }

      await batch.commit()
      toast({ title: "Purchase Recorded", description: `${items.length} items added to inventory.` })
      setIsAddOpen(false)
      setItems([{ id: Math.random().toString(36).substr(2, 9), itemName: "", category: "Groceries", subCategory: "", quantity: "", unitPrice: "" }])
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

  const grandTotalPreview = items.reduce((acc, curr) => acc + (Number(curr.quantity || 0) * Number(curr.unitPrice || 0)), 0)

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
              <Button size="sm" className="gap-2 h-10 rounded-xl font-bold shadow-lg">
                <Plus size={18} /> <span className="hidden sm:inline">New Purchase</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col rounded-3xl p-0 overflow-hidden">
              <DialogHeader className="p-6 bg-primary text-white">
                <DialogTitle className="text-2xl font-black">Record Market Purchase</DialogTitle>
                <DialogDescription className="text-primary-foreground/70">Add multiple grocery items to kitchen inventory in one batch.</DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                   <div className="space-y-1.5 flex-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Purchase Date</Label>
                      <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="h-11 rounded-xl" />
                   </div>
                   <div className="p-3 bg-secondary/30 rounded-xl flex-1 text-center border border-dashed">
                      <p className="text-[8px] font-black uppercase text-muted-foreground">Total Batch Cost</p>
                      <p className="text-lg font-black text-primary">৳{grandTotalPreview.toLocaleString()}</p>
                   </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-bold uppercase tracking-tight text-slate-500">Items List</Label>
                    <Button variant="outline" size="sm" onClick={handleAddItem} className="h-8 gap-1 rounded-full border-primary/20 text-primary font-bold">
                       <PlusCircle size={14}/> Add Row
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {items.map((item, idx) => (
                      <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group animate-in slide-in-from-top-2">
                         {items.length > 1 && (
                           <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white shadow-md text-destructive" onClick={() => handleRemoveItem(item.id)}>
                              <X size={12}/>
                           </Button>
                         )}
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                            <div className="lg:col-span-2 space-y-1">
                               <Label className="text-[9px] uppercase font-bold ml-1">Item Name</Label>
                               <Input value={item.itemName} onChange={e => updateItem(item.id, 'itemName', e.target.value)} placeholder="e.g. Miniket Rice" className="h-9 text-xs rounded-lg" />
                            </div>
                            <div className="space-y-1">
                               <Label className="text-[9px] uppercase font-bold ml-1">Category</Label>
                               <Select value={item.category} onValueChange={v => updateItem(item.id, 'category', v)}>
                                  <SelectTrigger className="h-9 text-[10px] rounded-lg bg-white"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                     {Object.keys(MARKET_CATEGORIES).map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                  </SelectContent>
                               </Select>
                            </div>
                            <div className="space-y-1">
                               <Label className="text-[9px] uppercase font-bold ml-1">Sub Category</Label>
                               <Select value={item.subCategory} onValueChange={v => updateItem(item.id, 'subCategory', v)}>
                                  <SelectTrigger className="h-9 text-[10px] rounded-lg bg-white"><SelectValue placeholder="Pick One" /></SelectTrigger>
                                  <SelectContent>
                                     {MARKET_CATEGORIES[item.category]?.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                                  </SelectContent>
                               </Select>
                            </div>
                            <div className="space-y-1">
                               <Label className="text-[9px] uppercase font-bold ml-1">Qty</Label>
                               <Input type="number" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} placeholder="0" className="h-9 text-xs rounded-lg" />
                            </div>
                            <div className="space-y-1">
                               <Label className="text-[9px] uppercase font-bold ml-1">Price (৳)</Label>
                               <Input type="number" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', e.target.value)} placeholder="0" className="h-9 text-xs rounded-lg" />
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="p-6 bg-slate-50 border-t">
                <Button onClick={handleCreateBatch} disabled={isSubmitting} className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl">
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Receipt size={18} className="mr-2" />}
                  Confirm & Record {items.length} Items
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-destructive rounded-2xl">
          <CardHeader className="pb-2 flex justify-between flex-row items-center"><CardTitle className="text-[10px] font-bold uppercase text-destructive tracking-widest">Total Market Spend</CardTitle><TrendingDown size={14} className="text-destructive" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-slate-800">৳{stats.total.toLocaleString() ?? 0}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-primary rounded-2xl">
          <CardHeader className="pb-2 flex justify-between flex-row items-center"><CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest">Items Purchased</CardTitle><ShoppingBag size={14} className="text-primary" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-slate-800">{stats.count} Records</div></CardContent>
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
                  <TableHead>Category</TableHead>
                  <TableHead>Qty</TableHead>
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
                        <span className="text-[9px] text-muted-foreground italic">{e.subCategory || 'General'}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize text-[8px] h-4 px-1.5">{e.category}</Badge></TableCell>
                    <TableCell className="text-xs font-medium text-slate-600">{e.quantity}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-slate-500">৳{Number(e.unitPrice).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-black text-destructive text-lg">৳{Number(e.totalPrice).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(e.id)}><Trash2 size={14} /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {expenses?.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-20 text-muted-foreground italic text-lg">No bazaar entries found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
