
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { Loader2, Printer, ArrowDownCircle, Filter, Trash2, RotateCcw, Receipt, Calendar, UserCheck, Wallet, ChevronRight, MoreVertical } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, limit, where, getDocs, writeBatch } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const formatCompactDate = (date: any) => {
  if (!date) return 'N/A'
  // Parse date correctly considering local time for YYYY-MM-DD strings
  const d = typeof date === 'string' && date.includes('-') ? new Date(date.replace(/-/g, '/')) : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

const EXPENSE_CATEGORIES = [
  { id: "rent", label: "Building Rent" },
  { id: "electricity", label: "Electricity Bill" },
  { id: "water", label: "Water & Gas Bill" },
  { id: "maintenance", label: "Maintenance/Repair" },
  { id: "food", label: "Food / Meal Cost" },
  { id: "market", label: "General Market" },
  { id: "internet", label: "Internet Bill" },
  { id: "salary", label: "Staff Salary" },
  { id: "Student Refund", label: "Student Refund" },
  { id: "others", label: "Others" },
]

export default function ExpenseHistoryPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [spentByFilter, setSpentByFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)

  // Local date helpers
  const getLocalYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }
  const getFirstDayOfMonthYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`;
  }

  // Default to current month range (Local Time)
  const [startDate, setStartDate] = useState(getFirstDayOfMonthYMD())
  const [endDate, setEndDate] = useState(getLocalYMD())

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const staffQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "staff"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: staffList } = useCollection(staffQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "expenses"), where("branch", "==", userBranch), limit(1000))
  }, [db, userBranch])
  const { data: rawExpenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  const filteredExpenses = useMemo(() => {
    if (!rawExpenses) return []
    const sDate = startDate ? new Date(startDate.replace(/-/g, '/')) : null
    const eDate = endDate ? new Date(endDate.replace(/-/g, '/')) : null
    if (eDate) eDate.setHours(23, 59, 59)

    return rawExpenses.filter(e => {
      const matchesCategory = categoryFilter === "all" || e.category === categoryFilter
      const matchesBuilding = buildingFilter === "all" || e.buildingId === buildingFilter
      const matchesMethod = methodFilter === "all" || e.method === methodFilter
      const matchesSpentBy = spentByFilter === "all" || e.spentBy === spentByFilter || e.expensePartyName === spentByFilter
      const matchesSearch = (e.expensePartyName || "").toLowerCase().includes(searchTerm.toLowerCase()) || (e.description || "").toLowerCase().includes(searchTerm.toLowerCase())
      
      const recordDate = new Date(e.expenseDate.replace(/-/g, '/'))
      const matchesStartDate = !sDate || recordDate >= sDate
      const matchesEndDate = !eDate || recordDate <= eDate
      
      return matchesCategory && matchesBuilding && matchesMethod && matchesSpentBy && matchesSearch && matchesStartDate && matchesEndDate
    }).sort((a, b) => new Date(b.expenseDate.replace(/-/g, '/')).getTime() - new Date(a.expenseDate.replace(/-/g, '/')).getTime())
  }, [rawExpenses, categoryFilter, buildingFilter, methodFilter, spentByFilter, searchTerm, startDate, endDate])

  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    return { total, count: filteredExpenses.length }
  }, [filteredExpenses])

  const handlePrint = () => { 
    if (typeof window !== "undefined") { 
      setTimeout(() => { window.print(); }, 500);
    } 
  }

  const handleReset = () => {
    setCategoryFilter("all")
    setBuildingFilter("all")
    setMethodFilter("all")
    setSpentByFilter("all")
    setSearchTerm("")
    setStartDate(getFirstDayOfMonthYMD())
    setEndDate(getLocalYMD())
  }

  return (
    <div className="space-y-8 pb-20 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2"><SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mr-2 h-4 md:hidden" /><div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Expense</h1></div></div>
        <div className="ml-auto flex items-center gap-3">
          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <Button size="sm" variant="outline" className="gap-2 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold" onClick={() => setIsFilterDialogOpen(true)}><Filter size={16} /> Filter</Button>
            <Button size="sm" variant="outline" className="gap-2 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold" onClick={handlePrint}><Printer size={16} /> Print Report</Button>
          </div>

          {/* Mobile Actions (3-dot menu) */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-primary">
                  <MoreVertical size={24}/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 shadow-xl border-slate-100">
                <DropdownMenuItem onClick={() => setIsFilterDialogOpen(true)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                  <Filter size={16} className="text-primary" /> Filter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrint} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                  <Printer size={16} className="text-primary" /> Print Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* OFFICIAL A4 PRINT REPORT */}
      <div className="print-only print-report-container">
        <div className="report-header">
          <h1>সমীকরণ ছাত্রাবাস</h1>
          <p className="branch-title">{userBranch} Branch • Monthly Expense Report</p>
          <div className="flex justify-between items-end mt-4 px-2 text-[8pt] font-bold text-slate-500">
            <div>
              <p>Period: {startDate || 'Start'} to {endDate || 'Today'}</p>
              <p>Category: {categoryFilter === 'all' ? 'All Categories' : categoryFilter}</p>
            </div>
            <div className="text-right">
              <p>Generated: {new Date().toLocaleString()}</p>
              <p>Staff: {userName}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Spent By</th>
              <th>Description</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map((e: any) => (
              <tr key={e.id}>
                <td>{formatCompactDate(e.expenseDate)}</td>
                <td className="capitalize">{e.category}</td>
                <td className="font-bold">{e.expensePartyName || e.spentBy}</td>
                <td className="italic text-[8pt]">{e.description || '-'}</td>
                <td className="text-right font-bold">৳{e.amount?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={4} className="text-right uppercase">Grand Total Expense</td>
              <td className="text-right">৳{stats.total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="print-footer">
          <div className="page-number"></div>
          <div className="signature-box">Manager Signature</div>
        </div>
      </div>

      <div className="print:hidden space-y-8">
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-destructive">Total Filtered Expense</CardTitle><ArrowDownCircle className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-xl font-black text-slate-900">৳{stats.total.toLocaleString()}</div></CardContent>
        </Card>

        {expensesLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            {/* Desktop Table View */}
            <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/30">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Spent By</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((e: any) => (
                      <TableRow key={e.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => router.push(`/expenses/${e.id}`)}>
                        <TableCell className="text-xs font-bold text-slate-500">{formatCompactDate(e.expenseDate)}</TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize text-[10px] font-bold">{e.category}</Badge></TableCell>
                        <TableCell className="font-bold text-slate-700">{e.expensePartyName || e.spentBy}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{e.method}</Badge></TableCell>
                        <TableCell className="text-right font-black text-destructive text-lg">৳{e.amount?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredExpenses.map((e: any) => (
                <Card 
                  key={e.id} 
                  className="border-none shadow-sm rounded-2xl overflow-hidden bg-white active:scale-[0.98] transition-transform"
                  onClick={() => router.push(`/expenses/${e.id}`)}
                >
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="bg-destructive/10 p-2 rounded-lg text-destructive"><Receipt size={18}/></div>
                        <h3 className="font-black text-slate-800 leading-tight capitalize">{e.category}</h3>
                      </div>
                      <Badge variant="outline" className="text-[8px] font-black uppercase text-destructive border-destructive/20 bg-destructive/5">
                        {e.method}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase text-muted-foreground">
                      <div className="flex items-center gap-1.5"><Calendar size={12}/> {formatCompactDate(e.expenseDate)}</div>
                      <div className="flex items-center gap-1.5"><UserCheck size={12}/> By: {e.spentBy || e.expensePartyName}</div>
                    </div>

                    <Separator className="opacity-50" />

                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-slate-500 italic line-clamp-1 flex-1 pr-4">{e.description || 'No description'}</p>
                      <div className="text-right shrink-0">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase leading-none mb-1">Cost</p>
                        <p className="text-xl font-black text-destructive">৳{e.amount?.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredExpenses.length === 0 && (
                <div className="text-center py-12 text-muted-foreground italic">No expense records found.</div>
              )}
            </div>
          </>
        )}
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Filter Expenses</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Category</Label><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">Entire Branch</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Method</Label><Select value={methodFilter} onValueChange={setMethodFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Methods</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Spent By</Label><Select value={spentByFilter} onValueChange={setSpentByFilter}><SelectTrigger><SelectValue placeholder="Any Staff" /></SelectTrigger><SelectContent><SelectItem value="all">Any Staff</SelectItem>{staffList?.filter(s => s.staffType === 'management' || !s.staffType).map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-1.5"><Label>Date Range</Label><div className="flex gap-2"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div></div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" className="gap-2 font-bold" onClick={handleReset}><RotateCcw size={14}/> Reset</Button>
            <Button className="rounded-xl px-8" onClick={() => setIsFilterDialogOpen(false)}>Apply Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
