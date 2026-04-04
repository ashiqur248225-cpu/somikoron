
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { History, Search, Filter, Download, Loader2, FileSpreadsheet, Printer, ArrowUpCircle, ArrowDownCircle, Wallet, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function LedgerPage() {
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  
  // User Context
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  // CRITICAL: Filter ledger by branch. Removed orderBy to avoid index requirements.
  const paymentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "payments"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "expenses"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: expenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  const getTransactionDate = (tx: any) => {
    if (tx.date?.toDate) return tx.date.toDate()
    if (tx.date) return new Date(tx.date)
    if (tx.expenseDate) return new Date(tx.expenseDate)
    if (tx.createdAt?.toDate) return tx.createdAt.toDate()
    return new Date(0)
  }

  const allTransactions = useMemo(() => {
    const combined = [
      ...(payments || []).map(p => ({ ...p, txType: 'income' })),
      ...(expenses || []).map(e => ({ ...e, txType: 'expense' }))
    ]
    // Sort in memory DESC by date
    return combined.sort((a, b) => getTransactionDate(b).getTime() - getTransactionDate(a).getTime())
  }, [payments, expenses])

  const filteredData = useMemo(() => {
    return allTransactions.filter(tx => {
      const matchesSearch = 
        (tx.studentName || tx.expensePartyName || tx.category || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.buildingName || "").toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === "all" || tx.txType === typeFilter
      return matchesSearch && matchesType
    })
  }, [allTransactions, searchTerm, typeFilter])

  const totalIncome = useMemo(() => (payments || []).reduce((acc, curr) => acc + (curr.amount || 0), 0), [payments])
  const totalExpense = useMemo(() => (expenses || []).reduce((acc, curr) => acc + (curr.amount || 0), 0), [expenses])

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print()
    }
  }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Accounting Ledger</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">
              Unified financial records for <span className="font-bold text-foreground">{userBranch}</span>.
            </p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" size="sm" className="gap-2"><FileSpreadsheet size={16} /> <span className="hidden sm:inline">Export</span></Button>
          </div>
          <Button size="sm" onClick={handlePrint} className="gap-2 shadow-lg">
            <Printer size={16} /> <span className="hidden sm:inline">Print</span>
          </Button>

          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">
                {userName ? userName.substring(0, 2) : "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-success">Total Income</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{totalIncome.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Total collections</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-destructive">Total Expense</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{totalExpense.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Total spending</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-primary rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary">Net Balance</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">৳{(totalIncome - totalExpense).toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Current operating surplus</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
        <CardHeader className="pb-4 border-b print:hidden">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by student, staff or category..." 
                className="pl-10 h-10 bg-slate-50 border-none" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
            <div className="flex gap-2">
              <Select defaultValue="all" onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] h-10 bg-slate-50 border-none font-bold text-xs uppercase">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income Only</SelectItem>
                  <SelectItem value="expense">Expenses Only</SelectItem>
                </SelectContent>
              </Select>
              { (searchTerm || typeFilter !== 'all') && (
                <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(""); setTypeFilter("all") }} className="h-10 w-10 text-muted-foreground">
                  <XCircle size={18} />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(paymentsLoading || expensesLoading) ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading database records...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="py-4 font-bold text-slate-600">Date</TableHead>
                  <TableHead className="py-4 font-bold text-slate-600">Entity / Purpose</TableHead>
                  <TableHead className="py-4 font-bold text-slate-600">Details</TableHead>
                  <TableHead className="py-4 font-bold text-slate-600 text-right pr-8">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row) => (
                  <TableRow key={row.id} className="group border-b last:border-0">
                    <TableCell className="py-4">
                      <span className="text-xs font-bold text-slate-500">
                        {getTransactionDate(row).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{row.studentName || row.expensePartyName || "N/A"}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={cn(
                            "text-[9px] h-4 font-bold uppercase px-1.5",
                            row.txType === 'income' ? "bg-success/5 text-success border-success/20" : "bg-destructive/5 text-destructive border-destructive/20"
                          )}>
                            {row.txType === 'income' ? 'Income' : 'Expense'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-medium">{row.buildingName}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{row.category || 'Seat Rent/Food'}</span>
                        <span className="text-[10px] text-slate-500 italic line-clamp-1 max-w-[200px]">{row.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn(
                      "text-right pr-8 font-black text-base",
                      row.txType === 'income' ? 'text-success' : 'text-destructive'
                    )}>
                      {row.txType === 'income' ? '+' : '-'}৳{row.amount?.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-24 bg-slate-50/20">
                      <div className="flex flex-col items-center justify-center opacity-30">
                        <History size={48} strokeWidth={1} />
                        <p className="mt-4 font-bold text-sm">No Financial Records Found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
