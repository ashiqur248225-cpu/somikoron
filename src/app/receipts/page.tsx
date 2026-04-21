
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Receipt, 
  Search, 
  Filter, 
  Loader2, 
  Eye, 
  Calendar, 
  User, 
  Smartphone, 
  RotateCcw,
  Building2,
  Printer,
  Clock,
  ListFilter,
  Trash2,
  MapPin
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, limit, getDocs, writeBatch, Timestamp, doc } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"

const formatCompactDate = (date: any) => {
  if (!date) return 'N/A'
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function ReceiptsHistoryPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [isDevMode, setIsDevMode] = useState(false)
  
  // States
  const [searchTerm, setSearchTerm] = useState("")
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteRange, setDeleteRange] = useState({ start: "", end: "" })
  const [isDeleting, setIsDeleting] = useState(false)

  // Filters
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [timeView, setTimeView] = useState("today")

  // Default range: 1st of month to Today
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    setIsDevMode(localStorage.getItem("isDeveloperMode") === "true")
  }, [])

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const paymentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(
      collection(db, "payments"), 
      where("branch", "==", userBranch),
      limit(1000)
    )
  }, [db, userBranch])
  
  const { data: payments, isLoading } = useCollection(paymentsQuery)

  const uniqueRooms = useMemo(() => {
    if (!payments) return []
    const rooms = Array.from(new Set(payments.map(p => String(p.roomNumber)).filter(Boolean))).sort()
    return rooms
  }, [payments])

  const filteredReceipts = useMemo(() => {
    if (!payments) return []
    
    const now = new Date()
    // Local YYYY-MM-DD for current day
    const todayYMD = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`

    return payments.filter(p => {
      const search = searchTerm.toLowerCase()
      const receiptNo = `RCPT-${p.id?.substring(0, 8).toUpperCase()}`
      
      // Multi-criteria search logic
      const matchesSearch = 
        receiptNo.toLowerCase().includes(search) || 
        (p.studentName || "").toLowerCase().includes(search) ||
        (p.phone || "").includes(searchTerm) ||
        (p.buildingName || "").toLowerCase().includes(search) ||
        (p.roomNumber || "").toString().includes(search)
      
      const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date)
      if (isNaN(pDate.getTime())) return false

      const matchesMethod = methodFilter === "all" || p.method === methodFilter
      const matchesBuilding = buildingFilter === "all" || p.buildingId === buildingFilter
      const matchesRoom = roomFilter === "all" || String(p.roomNumber) === roomFilter
      
      let matchesTime = true
      if (timeView === 'today') {
        const pYMD = `${pDate.getFullYear()}-${(pDate.getMonth() + 1).toString().padStart(2, '0')}-${pDate.getDate().toString().padStart(2, '0')}`
        matchesTime = pYMD === todayYMD
      } else {
        const matchesStartDate = !startDate || pDate >= new Date(startDate + "T00:00:00")
        const matchesEndDate = !endDate || pDate <= new Date(endDate + "T23:59:59")
        matchesTime = matchesStartDate && matchesEndDate
      }

      return matchesSearch && matchesMethod && matchesBuilding && matchesRoom && matchesTime
    }).sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime()
      const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime()
      return dateB - dateA
    })
  }, [payments, searchTerm, startDate, endDate, methodFilter, buildingFilter, roomFilter, timeView])

  const handleBulkDelete = async () => {
    if (!deleteRange.start || !deleteRange.end) return;
    const confirm = window.confirm(`WARNING: This will permanently delete ALL payments within range. Proceed?`);
    if (!confirm) return;

    setIsDeleting(true)
    try {
      const q = query(
        collection(db, "payments"),
        where("branch", "==", userBranch),
        where("date", ">=", Timestamp.fromDate(new Date(deleteRange.start))),
        where("date", "<=", Timestamp.fromDate(new Date(deleteRange.end + "T23:59:59")))
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      
      toast({ title: "Deleted Successfully", description: `${snapshot.size} records removed.` });
      setIsDeleteOpen(false);
      router.refresh();
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message });
    } finally {
      setIsDeleting(false)
    }
  }

  const handleReset = () => {
    setSearchTerm("")
    setBuildingFilter("all")
    setRoomFilter("all")
    setMethodFilter("all")
    setStartDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
    setEndDate(new Date().toISOString().split('T')[0])
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Receipts</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Archived money receipts for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {isDevMode && (
            <Button size="sm" variant="destructive" className="gap-2 h-9 rounded-lg" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 size={16} /> <span className="hidden sm:inline">Bulk Delete</span>
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-2 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold" onClick={() => setIsFilterDialogOpen(true)}>
            <Filter size={16} /> <span className="hidden sm:inline">Filter</span>
          </Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 /> Bulk Delete Archive</DialogTitle>
            <DialogDescription>Documents within this range will be permanently removed.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-[10px] font-bold">Start Date</Label><Input type="date" value={deleteRange.start} onChange={e => setDeleteRange({...deleteRange, start: e.target.value})} /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-bold">End Date</Label><Input type="date" value={deleteRange.end} onChange={e => setDeleteRange({...deleteRange, end: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting} className="rounded-xl font-bold">
              {isDeleting ? <Loader2 className="animate-spin" /> : "Delete Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        <div className="relative w-full">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search Receipt No, Name.." 
            className="pl-12 h-12 rounded-2xl border-none shadow-md bg-white text-lg" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
        <Tabs value={timeView} onValueChange={setTimeView} className="w-full">
          <TabsList className="bg-secondary/50 p-1 rounded-2xl w-full max-w-[400px] mx-auto grid grid-cols-2">
            <TabsTrigger value="today" className="rounded-xl gap-2 h-10 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"><Clock size={14}/> Today</TabsTrigger>
            <TabsTrigger value="all" className="rounded-xl gap-2 h-10 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"><ListFilter size={14}/> All Receipts</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
      ) : (
        <>
          <Card className="hidden md:block border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50"><TableRow><TableHead>Receipt No</TableHead><TableHead>Date</TableHead><TableHead>Resident</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredReceipts.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-black text-primary text-xs">RCPT-{p.id?.substring(0, 8).toUpperCase()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">{formatCompactDate(p.date)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col"><span className="font-bold text-slate-800">{p.studentName}</span><span className="text-[10px] text-muted-foreground uppercase font-bold">{p.buildingName} • R-{p.roomNumber}</span></div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="uppercase text-[9px] font-black">{p.method}</Badge></TableCell>
                    <TableCell className="text-right font-black text-slate-800 text-lg">৳{p.amount?.toLocaleString()}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" className="text-primary" onClick={() => router.push(`/receipts/${p.id}`)}><Printer size={18} /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <div className="md:hidden space-y-4">
            {filteredReceipts.map((p) => (
              <Card key={p.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white" onClick={() => router.push(`/receipts/${p.id}`)}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start"><Badge variant="outline" className="text-[10px] font-black text-primary">RCPT-{p.id?.substring(0, 8).toUpperCase()}</Badge><p className="text-[10px] font-bold text-muted-foreground uppercase">{formatCompactDate(p.date)}</p></div>
                  <div className="flex justify-between items-end"><div><h3 className="font-black text-slate-800 text-lg">{p.studentName}</h3><p className="text-[10px] text-slate-400 uppercase">{p.buildingName} • Room {p.roomNumber}</p></div><div className="text-right"><p className="text-xl font-black text-success">৳{p.amount?.toLocaleString()}</p></div></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Advanced Filter</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">Building</Label>
                <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                  <SelectTrigger className="bg-slate-50 h-11 rounded-xl">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Entire Branch</SelectItem>
                    {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">Room No.</Label>
                <Select value={roomFilter} onValueChange={setRoomFilter}>
                  <SelectTrigger className="bg-slate-50 h-11 rounded-xl">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rooms</SelectItem>
                    {uniqueRooms.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold">Payment Method</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="bg-slate-50 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bkash">Bkash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold">Date Range</Label>
              <div className="flex gap-2">
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50" />
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50" />
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" className="gap-2 font-bold" onClick={handleReset}><RotateCcw size={14}/> Reset</Button>
            <Button className="rounded-xl px-8" onClick={() => setIsFilterDialogOpen(false)}>Apply Search</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
