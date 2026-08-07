"use client"

import { useState, useMemo, useEffect } from "react"
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
import { Wallet, Loader2, Search, Filter, Printer, ArrowUpCircle, RotateCcw, Trash2, Calendar, Smartphone, MapPin, UserCircle, MoreVertical } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, limit, where, getDocs, writeBatch, Timestamp } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useRouter } from "next/navigation"

const formatCompactDate = (date: any) => {
  if (!date) return 'N/A'
  const d = date?.toDate ? date.toDate() : (typeof date === 'string' && date.includes('-') ? new Date(date.replace(/-/g, '/')) : new Date(date))
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function IncomeHistoryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const router = useRouter()
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [isDevMode, setIsDevMode] = useState(false)

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  
  const getLocalYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }
  const getFirstDayOfMonthYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`;
  }

  const [startDate, setStartDate] = useState(getFirstDayOfMonthYMD())
  const [endDate, setEndDate] = useState(getLocalYMD())

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

  const incomeQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "payments"), where("branch", "==", userBranch), limit(1000))
  }, [db, userBranch])
  const { data: rawPayments, isLoading: paymentsLoading } = useCollection(incomeQuery)

  const filteredPayments = useMemo(() => {
    if (!rawPayments) return []
    const sDate = startDate ? new Date(startDate.replace(/-/g, '/')) : null
    const eDate = endDate ? new Date(endDate.replace(/-/g, '/')) : null
    if (eDate) eDate.setHours(23, 59, 59)

    return rawPayments.filter(p => {
      const pDate = p.date?.toDate ? p.date.toDate() : (typeof p.date === 'string' && p.date.includes('-') ? new Date(p.date.replace(/-/g, '/')) : new Date(p.date))
      const matchesStartDate = !sDate || pDate >= sDate
      const matchesEndDate = !eDate || pDate <= eDate
      const matchesBuilding = buildingFilter === "all" || p.buildingId === buildingFilter
      const matchesMethod = methodFilter === "all" || p.method === methodFilter
      return matchesStartDate && matchesEndDate && matchesBuilding && matchesMethod && p.method !== 'adjustment'
    }).sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date)
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date)
      return dateB.getTime() - dateA.getTime()
    })
  }, [rawPayments, startDate, endDate, buildingFilter, methodFilter])

  const stats = useMemo(() => {
    const total = filteredPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    return { total, count: filteredPayments.length }
  }, [filteredPayments])

  const handlePrint = () => { if (typeof window !== "undefined") setTimeout(() => { window.print(); }, 500); }
  const handleReset = () => { setBuildingFilter("all"); setMethodFilter("all"); setStartDate(getFirstDayOfMonthYMD()); setEndDate(getLocalYMD()); }

  return (
    <div className="space-y-8 pb-20 w-full max-w-full overflow-x-hidden">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2"><SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mr-2 h-4 md:hidden" /><div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Income</h1></div></div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3"><Button size="sm" variant="outline" className="gap-2 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold" onClick={() => setIsFilterDialogOpen(true)}><Filter size={16} /> Filter</Button><Button size="sm" variant="outline" className="gap-2 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold" onClick={handlePrint}><Printer size={16} /></Button></div>
          <div className="md:hidden"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 text-primary"><MoreVertical size={24}/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48 p-2 shadow-xl rounded-xl"><DropdownMenuItem onClick={() => setIsFilterDialogOpen(true)} className="gap-2 p-3 font-medium cursor-pointer"><Filter size={16} /> Filter</DropdownMenuItem><DropdownMenuItem onClick={handlePrint} className="gap-2 p-3 font-medium cursor-pointer"><Printer size={16} /> Print</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      <div className="print-only print-report-container">
        <div className="report-header"><h1>সমীকরণ ছাত্রাবাস</h1><p className="branch-title">{userBranch} Branch • Income Report</p></div>
        <table><thead><tr><th>Date</th><th>Student</th><th>Room</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
          <tbody>{filteredPayments.map((p: any) => (<tr key={p.id}><td>{formatCompactDate(p.date)}</td><td className="font-bold">{p.studentName}</td><td>R-{p.roomNumber}</td><td className="uppercase">{p.method}</td><td className="text-right font-bold">৳{p.amount?.toLocaleString()}</td></tr>))}</tbody>
          <tfoot><tr className="total-row"><td colSpan={4} className="text-right uppercase">Total Income</td><td className="text-right">৳{stats.total.toLocaleString()}</td></tr></tfoot>
        </table>
      </div>

      <div className="print:hidden space-y-8">
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-success">Total Filtered Income</CardTitle><ArrowUpCircle className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-xl font-black text-slate-900">৳{stats.total.toLocaleString()}</div></CardContent></Card>

        {paymentsLoading ? (<div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>) : (
          <>
            <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl"><CardContent className="p-0 overflow-x-auto"><Table><TableHeader className="bg-secondary/30"><TableRow><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Location</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>{filteredPayments.map((p: any) => (<TableRow key={p.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => router.push(`/receipts/${p.id}`)}><TableCell className="text-xs font-bold text-slate-500">{formatCompactDate(p.date)}</TableCell><TableCell className="font-black text-slate-800">{p.studentName}</TableCell><TableCell className="text-xs text-muted-foreground">{p.buildingName} • R-{p.roomNumber}</TableCell><TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{p.method}</Badge></TableCell><TableCell className="text-right font-black text-income text-lg">৳{p.amount?.toLocaleString()}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
            <div className="md:hidden space-y-4">{filteredPayments.map((p: any) => (
              <Card key={p.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white active:scale-[0.98] transition-transform" onClick={() => router.push(`/receipts/${p.id}`)}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start"><div className="flex items-center gap-2"><div className="bg-success/10 p-2 rounded-lg text-success"><Wallet size={18}/></div><h3 className="font-black text-slate-800">{p.studentName}</h3></div><Badge variant="outline" className="text-[8px] uppercase font-black">{p.method}</Badge></div>
                  <div className="grid grid-cols-2 gap-3 text-[10px] font-bold uppercase text-muted-foreground"><div><Calendar size={12}/> {formatCompactDate(p.date)}</div><div className="text-right"><MapPin size={12}/> R-{p.roomNumber}</div></div>
                  <Separator className="opacity-50" /><div className="flex justify-between items-center"><div><p className="text-[8px] font-bold uppercase opacity-60">Amount</p><p className="text-xl font-black text-success">৳{p.amount?.toLocaleString()}</p></div><ChevronRight className="text-slate-300"/></div>
                </CardContent></Card>))}
            </div>
          </>
        )}
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}><DialogContent className="max-w-md rounded-3xl"><DialogHeader><DialogTitle>Filter Income</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><Label>Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">Entire Branch</SelectItem>{buildings?.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}</SelectContent></Select></div><div className="space-y-1.5"><Label>Method</Label><Select value={methodFilter} onValueChange={setMethodFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem></SelectContent></Select></div></div><div className="space-y-1.5"><Label>Range</Label><div className="flex gap-2"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div></div></div>
        <DialogFooter className="flex gap-2"><Button variant="ghost" className="gap-2 font-bold" onClick={handleReset}><RotateCcw size={14}/> Reset</Button><Button className="rounded-xl px-8" onClick={() => setIsFilterDialogOpen(false)}>Apply</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}