
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
  Printer
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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, limit, orderBy } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const formatCompactDate = (date: any) => {
  if (!date) return 'N/A'
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function ReceiptsHistoryPage() {
  const router = useRouter()
  const db = useFirestore()
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  
  // States
  const [searchTerm, setSearchTerm] = useState("")
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [methodFilter, setMethodFilter] = useState("all")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  const paymentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(
      collection(db, "payments"), 
      where("branch", "==", userBranch),
      orderBy("date", "desc"),
      limit(500)
    )
  }, [db, userBranch])
  
  const { data: payments, isLoading } = useCollection(paymentsQuery)

  const filteredReceipts = useMemo(() => {
    if (!payments) return []
    return payments.filter(p => {
      const search = searchTerm.toLowerCase()
      const receiptNo = `RCPT-${p.id?.substring(0, 8).toUpperCase()}`
      
      const matchesSearch = 
        receiptNo.toLowerCase().includes(search) || 
        p.studentName.toLowerCase().includes(search) ||
        (p.id || "").toLowerCase().includes(search)
      
      const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date)
      const matchesStartDate = !startDate || pDate >= new Date(startDate)
      const matchesEndDate = !endDate || pDate <= new Date(new Date(endDate).setHours(23, 59, 59))
      const matchesMethod = methodFilter === "all" || p.method === methodFilter

      return matchesSearch && matchesStartDate && matchesEndDate && matchesMethod
    })
  }, [payments, searchTerm, startDate, endDate, methodFilter])

  return (
    <div className="space-y-8 pb-20">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Receipts</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Archived money receipts for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold" onClick={() => setIsFilterDialogOpen(true)}>
            <Filter size={16} /> Filter
          </Button>
          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Main Search Bar */}
      <div className="relative max-w-2xl mx-auto">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Search by Receipt No (e.g. RCPT-XXXX) or Student Name..." 
          className="pl-12 h-12 rounded-2xl border-none shadow-md bg-white text-lg" 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
      ) : (
        <>
          {/* Desktop View Table */}
          <Card className="hidden md:block border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Receipt No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Resident</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-black text-primary text-xs">RCPT-{p.id?.substring(0, 8).toUpperCase()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">{formatCompactDate(p.date)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{p.studentName}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">{p.buildingName} • R-{p.roomNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="uppercase text-[9px] font-black">{p.method}</Badge></TableCell>
                    <TableCell className="text-right font-black text-slate-800 text-lg">৳{p.amount?.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-primary" onClick={() => router.push(`/receipts/${p.id}`)}>
                        <Printer size={18} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredReceipts.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-24 text-muted-foreground italic">No receipts found matching your search.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile View Cards */}
          <div className="md:hidden space-y-4">
            {filteredReceipts.map((p) => (
              <Card key={p.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white" onClick={() => router.push(`/receipts/${p.id}`)}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="text-[10px] font-black text-primary border-primary/20">
                      RCPT-{p.id?.substring(0, 8).toUpperCase()}
                    </Badge>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{formatCompactDate(p.date)}</p>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-slate-800 text-lg leading-tight">{p.studentName}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{p.buildingName} • Room {p.roomNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-success">৳{p.amount?.toLocaleString()}</p>
                      <Badge variant="secondary" className="text-[8px] uppercase mt-1">{p.method}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* FILTER DIALOG */}
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Filter className="text-primary" size={20}/> Advanced Search</DialogTitle>
            <DialogDescription>Filter archived receipts by date and payment method.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Payment Method</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="bg-slate-50 h-11 rounded-xl"><SelectValue placeholder="All Methods" /></SelectTrigger>
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
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Date Range</Label>
              <div className="flex gap-2">
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 rounded-xl h-11" />
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50 rounded-xl h-11" />
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button variant="ghost" className="gap-2 font-bold text-xs" onClick={() => { setMethodFilter("all"); setStartDate(""); setEndDate(""); }}>
              <RotateCcw size={14}/> Reset Filters
            </Button>
            <Button className="rounded-xl px-8 h-11 font-bold" onClick={() => setIsFilterDialogOpen(false)}>Apply Search</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
