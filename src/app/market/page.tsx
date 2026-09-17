
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
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
  PlusCircle,
  ChevronRight,
  LayoutGrid,
  Zap,
  Package,
  Filter,
  RotateCcw,
  Building2,
  Calculator,
  ListFilter,
  TableProperties
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, setDoc, query, where, serverTimestamp, deleteDoc, orderBy, limit, writeBatch, increment } from "firebase/firestore"
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
import { cn } from "@/lib/utils"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2024", "2025", "2026", "2027", "2028"];

interface MarketItem {
  id: string;
  itemName: string;
  category: string;
  subCategory: string;
  quantity: string;
  unit: string;
  totalPrice: string;
}

export default function MarketTrackingPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dictionary Data
  const marketCatsRef = useMemoFirebase(() => doc(db, "configs", "marketCategories"), [db])
  const { data: marketCatsStore } = useDoc(marketCatsRef)
  const categories = useMemo(() => marketCatsStore?.categories || {}, [marketCatsStore])

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [filterBuilding, setFilterBuilding] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterSubCategory, setFilterSubCategory] = useState("all")
  const [filterItem, setFilterItem] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  // Entry Form
  const [entryDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [entryBuildingId, setEntryBuildingId] = useState("")
  const [entryItems, setEntryItems] = useState<MarketItem[]>([
    { id: Math.random().toString(36).substr(2, 9), itemName: "", category: "", subCategory: "", quantity: "", unit: "Kg", totalPrice: "" }
  ])

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  // Data Fetching
  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const marketQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "marketExpenses"), where("branch", "==", userBranch), orderBy("date", "desc"), limit(1000))
  }, [db, userBranch])
  const { data: rawExpenses, isLoading } = useCollection(marketQuery)

  // AGGREGATION & FILTERING LOGIC
  const processedData = useMemo(() => {
    if (!rawExpenses) return { filtered: [], summary: null, aggregatedItems: [] };

    const monthIdx = MONTHS.indexOf(selectedMonth) + 1;
    const prefix = `${selectedYear}-${String(monthIdx).padStart(2, '0')}`;

    const filtered = rawExpenses.filter(e => {
      const matchesMonth = e.date.startsWith(prefix);
      const matchesBuilding = filterBuilding === 'all' || e.buildingId === filterBuilding;
      const matchesCategory = filterCategory === 'all' || e.category === filterCategory;
      const matchesSub = filterSubCategory === 'all' || e.subCategory === filterSubCategory;
      const matchesItem = filterItem === 'all' || e.itemName === filterItem;
      const matchesSearch = !searchTerm || e.itemName.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesMonth && matchesBuilding && matchesCategory && matchesSub && matchesItem && matchesSearch;
    });

    const totalCost = filtered.reduce((acc, curr) => acc + Number(curr.totalPrice || 0), 0);
    const uniqueDays = new Set(filtered.map(e => e.date)).size;
    const totalItemsCount = filtered.length;

    // Aggregate by Item Name
    const itemMap: Record<string, any> = {};
    filtered.forEach(e => {
      const key = `${e.itemName}_${e.unit}`;
      if (!itemMap[key]) {
        itemMap[key] = { 
          name: e.itemName, 
          category: e.category, 
          sub: e.subCategory, 
          unit: e.unit, 
          totalQty: 0, 
          totalCost: 0, 
          days: new Set() 
        };
      }
      itemMap[key].totalQty += Number(e.quantity || 0);
      itemMap[key].totalCost += Number(e.totalPrice || 0);
      itemMap[key].days.add(e.date);
    });

    const aggregatedItems = Object.values(itemMap).map((i: any) => ({
      ...i,
      purchaseDays: i.days.size
    })).sort((a, b) => b.totalCost - a.totalCost);

    return { 
      filtered, 
      summary: { totalCost, uniqueDays, totalItemsCount },
      aggregatedItems 
    };
  }, [rawExpenses, selectedMonth, selectedYear, filterBuilding, filterCategory, filterSubCategory, filterItem, searchTerm]);

  // Daily Summary (Date-wise sum)
  const dailySummary = useMemo(() => {
    const map: Record<string, { count: number, cost: number }> = {};
    processedData.filtered.forEach(e => {
      if (!map[e.date]) map[e.date] = { count: 0, cost: 0 };
      map[e.date].count += 1;
      map[e.date].cost += Number(e.totalPrice || 0);
    });
    return Object.entries(map).map(([date, data]) => ({ date, ...data })).sort((a, b) => b.date.localeCompare(a.date));
  }, [processedData.filtered]);

  // Handlers for Entry
  const handleAddItemRow = () => {
    setEntryItems([...entryItems, { id: Math.random().toString(36).substr(2, 9), itemName: "", category: "", subCategory: "", quantity: "", unit: "Kg", totalPrice: "" }])
  }

  const handleRemoveItemRow = (id: string) => {
    if (entryItems.length > 1) setEntryItems(entryItems.filter(i => i.id !== id))
  }

  const updateEntryItem = (id: string, field: keyof MarketItem, value: string) => {
    setEntryItems(entryItems.map(item => {
      if (item.id === id) {
        const newItem = { ...item, [field]: value };
        // Auto-populate category/sub if item is selected
        if (field === 'itemName') {
          for (const [cat, subs] of Object.entries(categories)) {
            for (const [sub, items] of Object.entries(subs as any)) {
              if ((items as string[]).includes(value)) {
                newItem.category = cat;
                newItem.subCategory = sub;
                break;
              }
            }
          }
        }
        return newItem;
      }
      return item;
    }))
  }

  const handleCreateBatch = async () => {
    if (!entryBuildingId) { toast({ variant: "destructive", title: "Missing Building", description: "Please select a building." }); return; }
    const invalid = entryItems.some(item => !item.itemName || !item.quantity || !item.totalPrice)
    if (invalid) { toast({ variant: "destructive", title: "Missing Data", description: "Fill all fields for each item." }); return; }

    setIsSubmitting(true)
    try {
      const batch = writeBatch(db)
      let totalBatchCost = 0
      const buildingName = buildings?.find(b => b.id === entryBuildingId)?.name || "General"

      for (const item of entryItems) {
        const expId = doc(collection(db, "marketExpenses")).id
        const cost = Number(item.totalPrice)
        totalBatchCost += cost
        
        batch.set(doc(db, "marketExpenses", expId), {
          ...item,
          id: expId,
          date: entryDate,
          buildingId: entryBuildingId,
          buildingName,
          totalPrice: cost,
          quantity: Number(item.quantity),
          branch: userBranch,
          purchasedBy: userName,
          createdAt: serverTimestamp()
        })
      }

      // Consolidate for Ledger
      const generalExpId = doc(collection(db, "expenses")).id
      batch.set(doc(db, "expenses", generalExpId), {
        id: generalExpId,
        category: "market",
        amount: totalBatchCost,
        expenseDate: entryDate,
        buildingId: entryBuildingId,
        buildingName,
        description: `Market Batch (${entryItems.length} items). Collector: ${userName}`,
        method: "cash",
        spentBy: userName,
        branch: userBranch,
        createdAt: serverTimestamp()
      })

      // Update Balance
      const balanceRef = doc(db, "netBalance", userBranch);
      batch.set(balanceRef, { branchId: userBranch, totalCash: increment(-totalBatchCost), totalHandCash: increment(-totalBatchCost), lastUpdated: serverTimestamp() }, { merge: true });

      await batch.commit()
      toast({ title: "Recorded", description: `৳${totalBatchCost} added to expenses.` })
      setIsAddOpen(false)
      setEntryItems([{ id: Math.random().toString(36).substr(2, 9), itemName: "", category: "", subCategory: "", quantity: "", unit: "Kg", totalPrice: "" }])
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) } 
    finally { setIsSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this entry?")) return
    try {
      await deleteDoc(doc(db, "marketExpenses", id))
      toast({ title: "Deleted" })
    } catch (e) { toast({ variant: "destructive", description: "Failed to delete." }) }
  }

  const handleResetFilters = () => {
    setFilterBuilding("all"); setFilterCategory("all"); setFilterSubCategory("all"); setFilterItem("all"); setSearchTerm("");
  }

  return (
    <div className="space-y-8 pb-20 w-full overflow-x-hidden">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Meals Tracking</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Advanced kitchen consumption and cost analytics.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2 h-10 rounded-xl font-bold" onClick={() => setIsFilterOpen(true)}>
             <Filter size={16}/> <span className="hidden sm:inline">Filters</span>
          </Button>
          <Button size="sm" className="gap-2 h-10 rounded-xl font-bold shadow-lg" onClick={() => setIsAddOpen(true)}>
            <Plus size={18} /> <span className="hidden sm:inline">New Purchase</span>
          </Button>
        </div>
      </div>

      {/* DASHBOARD SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-primary rounded-2xl">
          <CardHeader className="pb-2 flex justify-between flex-row items-center"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Total Market Cost</CardTitle><TrendingDown size={14} className="text-destructive" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-slate-800">৳{processedData.summary?.totalCost.toLocaleString() || 0}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-indigo-500 rounded-2xl">
          <CardHeader className="pb-2 flex justify-between flex-row items-center"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Purchase Days</CardTitle><Calendar size={14} className="text-indigo-500" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-slate-800">{processedData.summary?.uniqueDays || 0} Days</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-success rounded-2xl">
          <CardHeader className="pb-2 flex justify-between flex-row items-center"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Items Count</CardTitle><Package size={14} className="text-success" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-slate-800">{processedData.summary?.totalItemsCount || 0} Entries</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-slate-900 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-primary/70 tracking-[0.2em]">Current Period</CardTitle></CardHeader>
          <CardContent><div className="text-lg font-black text-white">{selectedMonth} {selectedYear}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* Aggregated List */}
         <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between">
               <h2 className="text-lg font-black uppercase tracking-tight text-slate-700 flex items-center gap-2">
                  <Calculator size={18} className="text-primary"/> Aggregated Item Consumption
               </h2>
               <div className="relative w-48">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search item..." className="pl-8 h-9 text-xs rounded-xl bg-white border-none shadow-sm" />
               </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden bg-white rounded-3xl">
              <Table>
                <TableHeader className="bg-slate-50/50">
                   <TableRow>
                      <TableHead className="font-bold">Item Name</TableHead>
                      <TableHead className="text-center font-bold">Days</TableHead>
                      <TableHead className="text-right font-bold">Total Qty</TableHead>
                      <TableHead className="text-right font-bold">Total Cost</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {processedData.aggregatedItems.map((item, idx) => (
                     <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                        <TableCell>
                           <div className="flex flex-col">
                              <span className="font-black text-slate-800">{item.name}</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">{item.category} &rarr; {item.sub}</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-center font-bold text-xs">{item.purchaseDays}d</TableCell>
                        <TableCell className="text-right font-black text-primary">{item.totalQty} {item.unit}</TableCell>
                        <TableCell className="text-right font-black text-slate-900">৳{item.totalCost.toLocaleString()}</TableCell>
                     </TableRow>
                   ))}
                   {processedData.aggregatedItems.length === 0 && (
                     <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">No consumption records match current filters.</TableCell></TableRow>
                   )}
                </TableBody>
              </Table>
            </Card>
         </div>

         {/* Daily Summaries */}
         <div className="lg:col-span-4 space-y-6">
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-700 flex items-center gap-2">
               <History size={18} className="text-primary"/> Daily Summaries
            </h2>
            <div className="space-y-3">
               {dailySummary.map((day, i) => (
                 <Card key={i} className="border-none shadow-sm bg-white rounded-2xl p-4 flex justify-between items-center group hover:bg-primary/5 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                       <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white transition-all shadow-inner"><Calendar size={20}/></div>
                       <div>
                          <p className="text-xs font-black text-slate-800">{new Date(day.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">{day.count} Items Purchased</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-md font-black text-slate-900">৳{day.cost.toLocaleString()}</p>
                       <Button variant="ghost" size="sm" className="h-5 px-1 text-[8px] font-black uppercase text-primary">Details &rarr;</Button>
                    </div>
                 </Card>
               ))}
               {dailySummary.length === 0 && <p className="text-center py-20 text-xs text-muted-foreground opacity-40">No records found.</p>}
            </div>
         </div>
      </div>

      {/* FILTER DIALOG */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Advanced Filters</DialogTitle></DialogHeader>
          <div className="space-y-5 py-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Month</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Year</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                </div>
             </div>

             <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Target Building</Label>
                <Select value={filterBuilding} onValueChange={setFilterBuilding}><SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
             </div>

             <Separator />

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Category</Label>
                  <Select value={filterCategory} onValueChange={val => { setFilterCategory(val); setFilterSubCategory("all"); setFilterItem("all"); }}><SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem>{Object.keys(categories).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Sub Category</Label>
                  <Select value={filterSubCategory} onValueChange={val => { setFilterSubCategory(val); setFilterItem("all"); }} disabled={filterCategory === 'all'}><SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Subs</SelectItem>{filterCategory !== 'all' && Object.keys(categories[filterCategory] || {}).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                </div>
             </div>

             <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Specific Item</Label>
                <Select value={filterItem} onValueChange={setFilterItem} disabled={filterSubCategory === 'all'}><SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Items</SelectItem>{(filterCategory !== 'all' && filterSubCategory !== 'all') && (categories[filterCategory][filterSubCategory] as string[]).map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select>
             </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3">
             <Button variant="ghost" className="gap-2 font-bold" onClick={handleResetFilters}><RotateCcw size={14}/> Reset</Button>
             <Button className="rounded-xl font-bold" onClick={() => setIsFilterOpen(false)}>Apply Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NEW PURCHASE DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col rounded-[2.5rem] p-0 overflow-hidden">
          <DialogHeader className="p-8 bg-slate-900 text-white">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Record Daily Purchase</DialogTitle>
            <DialogDescription className="text-slate-400">Add kitchen inventory items to specific building records.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Purchase Date</Label>
                  <Input type="date" value={entryDate} onChange={e => setPurchaseDate(e.target.value)} className="h-12 rounded-2xl bg-slate-50 border-none shadow-inner font-bold" />
                </div>
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Allocated Building</Label>
                  <Select value={entryBuildingId} onValueChange={setEntryBuildingId}><SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none shadow-inner font-bold"><SelectValue placeholder="Target Building"/></SelectTrigger><SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
                </div>
             </div>

             <div className="space-y-4">
                <div className="flex justify-between items-center"><Label className="text-sm font-black uppercase tracking-widest text-slate-400">Purchased Items</Label><Button variant="outline" size="sm" onClick={handleAddItemRow} className="h-8 gap-1.5 rounded-full border-primary/20 text-primary font-bold"><PlusCircle size={14}/> Add Item Row</Button></div>
                
                <div className="space-y-4">
                   {entryItems.map((item, idx) => (
                     <div key={item.id} className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 relative group animate-in slide-in-from-top-2">
                        {entryItems.length > 1 && (
                          <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white shadow-md text-destructive" onClick={() => handleRemoveItemRow(item.id)}><X size={14}/></Button>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                           <div className="md:col-span-1 space-y-1.5">
                              <Label className="text-[9px] font-black uppercase text-muted-foreground">Select Item</Label>
                              <Select value={item.itemName} onValueChange={v => updateEntryItem(item.id, 'itemName', v)}>
                                 <SelectTrigger className="h-11 bg-white rounded-xl shadow-sm"><SelectValue placeholder="Pick Item"/></SelectTrigger>
                                 <SelectContent>
                                    {Object.entries(categories).map(([cat, subs]) => (
                                      <SelectGroup key={cat}><SelectLabel className="text-[8px] font-black uppercase opacity-40">{cat}</SelectLabel>
                                         {Object.entries(subs as any).map(([sub, items]) => (
                                           (items as string[]).map(i => <SelectItem key={`${cat}_${sub}_${i}`} value={i} className="text-xs">{i} ({sub})</SelectItem>)
                                         ))}
                                      </SelectGroup>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>
                           <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Quantity</Label><Input type="number" value={item.quantity} onChange={e => updateEntryItem(item.id, 'quantity', e.target.value)} placeholder="Qty" className="h-11 bg-white rounded-xl" /></div>
                           <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Unit</Label><Select value={item.unit} onValueChange={v => updateEntryItem(item.id, 'unit', v)}><SelectTrigger className="h-11 bg-white rounded-xl"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Kg">Kg</SelectItem><SelectItem value="Liter">Liter</SelectItem><SelectItem value="Piece">Piece</SelectItem><SelectItem value="Bundle">Bundle</SelectItem><SelectItem value="Packet">Packet</SelectItem></SelectContent></Select></div>
                           <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-primary">Total Price (৳)</Label><Input type="number" value={item.totalPrice} onChange={e => updateEntryItem(item.id, 'totalPrice', e.target.value)} placeholder="0.00" className="h-11 bg-primary/5 border-primary/20 font-black text-lg text-primary rounded-xl" /></div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>

          <DialogFooter className="p-8 bg-slate-50 border-t flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="text-center md:text-left space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Consolidated Cost</p>
                <h3 className="text-3xl font-black text-slate-900">৳{entryItems.reduce((acc, curr) => acc + Number(curr.totalPrice || 0), 0).toLocaleString()}</h3>
             </div>
             <Button onClick={handleCreateBatch} disabled={isSubmitting} className="w-full md:w-80 h-16 rounded-[2rem] text-xl font-black shadow-2xl shadow-primary/20 gap-3">
                {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24}/>} Confirm & Submit
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
