
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
import { History, Search, Filter, Download, Loader2, FileSpreadsheet, Printer, ArrowUpCircle, ArrowDownCircle, Wallet, XCircle, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function LedgerPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

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

  const handlePrint = () => { if (typeof window !== "undefined") { window.print() } }

  const handleExportCSV = () => {
    try {
      const headers = ["Date", "Type", "Entity/Purpose", "Details", "Method", "Amount"];
      const rows = filteredData.map(row => [
        getTransactionDate(row).toLocaleDateString(),
        row.txType.toUpperCase(),
        row.studentName || row.expensePartyName || "N/A",
        row.description || row.category || '',
        row.method || 'N/A',
        row.amount
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `ledger_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Export Success", description: "CSV file downloaded." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export Failed", description: err.message });
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
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Ledger</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">unified financial records for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}><Download size={16} /> <span className="hidden sm:inline">Export CSV</span></Button>
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-2 shadow-sm">
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
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-destructive">Total Expense</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{totalExpense.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-primary rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary">Net Balance</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">৳{(totalIncome - totalExpense).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-secondary/20 p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-center print:hidden">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search records..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-[160px] h-10 bg-white font-bold text-xs uppercase"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(paymentsLoading || expensesLoading) ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Table for Desktop */}
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Entity / Purpose</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row) => (
                    <TableRow key={row.id} className="group border-b last:border-0">
                      <TableCell className="py-4 text-xs font-bold text-slate-500">
                        {getTransactionDate(row).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{row.studentName || row.expensePartyName || "N/A"}</span>
                          <Badge variant="outline" className={cn("text-[9px] h-4 font-bold uppercase w-fit px-1.5 mt-1", row.txType === 'income' ? "bg-success/5 text-success border-success/20" : "bg-destructive/5 text-destructive border-destructive/20")}>
                            {row.txType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] text-slate-500 italic max-w-[200px] truncate">{row.description || row.category}</TableCell>
                      <TableCell className={cn("text-right font-black text-base", row.txType === 'income' ? 'text-success' : 'text-destructive')}>
                        {row.txType === 'income' ? '+' : '-'}৳{row.amount?.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cards for Mobile */}
          <div className="md:hidden space-y-4">
            {filteredData.map((row) => (
              <Card key={row.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="font-black text-slate-800 text-lg leading-tight">{row.studentName || row.expensePartyName || "Miscellaneous"}</h3>
                      <p className="text-xs font-bold text-slate-400">{getTransactionDate(row).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xl font-black", row.txType === 'income' ? 'text-success' : 'text-destructive')}>
                        {row.txType === 'income' ? <ArrowUpRight size={14} className="inline mr-1" /> : <ArrowDownRight size={14} className="inline mr-1" />}
                        ৳{row.amount?.toLocaleString()}
                      </p>
                      <Badge variant="secondary" className="text-[8px] uppercase mt-1 px-1">{row.txType}</Badge>
                    </div>
                  </div>
                  <Separator className="opacity-50" />
                  <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <span>Purpose: {row.category || 'General'}</span>
                    <span>Method: {row.method || 'N/A'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredData.length === 0 && (
              <div className="text-center py-12 text-muted-foreground italic">No financial records found.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
