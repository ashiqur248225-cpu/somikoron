
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { History, Search, Filter, Download, Loader2, FileSpreadsheet, Printer, ArrowUpCircle, ArrowDownCircle, Wallet, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const formatCompactDate = (date: any) => {
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

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
  const { data: payments, isLoading: pLoading } = useCollection(paymentsQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "expenses"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: expenses, isLoading: eLoading } = useCollection(expensesQuery)

  const ledgerData = useMemo(() => {
    const combined = [
      ...(payments || []).map(p => ({ ...p, txType: 'income', debit: 0, credit: p.amount })),
      ...(expenses || []).map(e => ({ ...e, txType: 'expense', debit: e.amount, credit: 0, date: e.expenseDate }))
    ]
    const sorted = combined.sort((a, b) => {
      const d1 = a.date?.toDate ? a.date.toDate() : new Date(a.date)
      const d2 = b.date?.toDate ? b.date.toDate() : new Date(b.date)
      return d1.getTime() - d2.getTime()
    })

    let runningBalance = 0
    const calculated = sorted.map(tx => {
      runningBalance += (tx.credit - tx.debit)
      return { ...tx, balance: runningBalance }
    })
    return calculated.reverse()
  }, [payments, expenses])

  const filteredData = useMemo(() => {
    return ledgerData.filter(tx => {
      const matchesSearch = (tx.studentName || tx.expensePartyName || tx.category || "").toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === "all" || tx.txType === typeFilter
      return matchesSearch && matchesType
    })
  }, [ledgerData, searchTerm, typeFilter])

  const stats = useMemo(() => {
    const income = (payments || []).reduce((a, b) => a + b.amount, 0)
    const expense = (expenses || []).reduce((a, b) => a + b.amount, 0)
    return { income, expense, balance: income - expense, count: filteredData.length }
  }, [payments, expenses, filteredData])

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  const handleExportCSV = () => {
    try {
      const headers = ["Date", "Type", "Source/Category", "Method", "Credit", "Debit", "Balance"];
      const rows = filteredData.map(tx => [formatCompactDate(tx.date), tx.txType, tx.studentName || tx.category, tx.method, tx.credit, tx.debit, tx.balance]);
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `ledger_${new Date().getTime()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) { toast({ variant: "destructive", title: "Export Failed" }) }
  }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Ledger</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Cash flow for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={handleExportCSV}><FileSpreadsheet size={16} /> <span className="hidden sm:inline">Export CSV</span></Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Download PDF</span></Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* Official Ledger Print Format (Hidden on Screen) */}
      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">SOMIKORON HOSTEL</h1>
          <p className="text-sm font-bold">{userBranch} Branch • General Ledger</p>
          <div className="mt-4 border-y py-2 grid grid-cols-2 text-left text-[10pt]">
            <div>
              <p><b>Account Type:</b> Cash / Bank / Digital</p>
              <p><b>Filter:</b> {typeFilter === 'all' ? 'All Transactions' : typeFilter.toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p><b>Date Range:</b> Custom Range</p>
              <p><b>Generated At:</b> {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <TableRow>
              <TableHead className="w-[12%]">Date</TableHead>
              <TableHead className="w-[10%]">Type</TableHead>
              <TableHead className="w-[20%]">Source / Category</TableHead>
              <TableHead className="w-[18%]">Location</TableHead>
              <TableHead className="w-[10%]">Method</TableHead>
              <TableHead className="w-[10%] text-right">Debit</TableHead>
              <TableHead className="w-[10%] text-right">Credit</TableHead>
              <TableHead className="w-[10%] text-right">Balance</TableHead>
            </TableRow>
          </thead>
          <TableBody>
            {ledgerData.slice().reverse().map((tx: any) => (
              <TableRow key={tx.id}>
                <TableCell>{formatCompactDate(tx.date)}</TableCell>
                <TableCell className="capitalize text-[7pt]">{tx.txType}</TableCell>
                <TableCell className="font-bold">{tx.studentName || tx.category}</TableCell>
                <TableCell className="text-[7pt]">{tx.buildingName} {tx.roomNumber ? `- R${tx.roomNumber}` : ''}</TableCell>
                <TableCell className="uppercase">{tx.method}</TableCell>
                <TableCell className="text-right">{tx.debit > 0 ? `৳${tx.debit.toLocaleString()}` : '-'}</TableCell>
                <TableCell className="text-right">{tx.credit > 0 ? `৳${tx.credit.toLocaleString()}` : '-'}</TableCell>
                <TableCell className="text-right font-bold">৳{tx.balance.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>

        <div className="summary-section">
          <div className="bg-slate-50 p-4 border rounded-xl grid grid-cols-3 gap-4">
            <div className="border-r">
              <p className="text-[8pt] uppercase font-bold text-success">Total Income (Credit)</p>
              <p className="text-lg font-bold">৳{stats.income.toLocaleString()}</p>
            </div>
            <div className="border-r">
              <p className="text-[8pt] uppercase font-bold text-destructive">Total Expense (Debit)</p>
              <p className="text-lg font-bold">৳{stats.expense.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[8pt] uppercase font-bold text-primary">Closing Balance</p>
              <p className="text-2xl font-black text-primary">৳{stats.balance.toLocaleString()}</p>
            </div>
          </div>
          <div className="print-footer mt-10">
            <div className="signature-box">Accountant Signature</div>
            <div className="text-center self-end print-page-number"></div>
            <div className="signature-box">Manager Signature</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-success">Total Income</CardTitle><ArrowUpCircle className="h-4 w-4 text-success" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-slate-900">৳{stats.income.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-destructive">Total Expense</CardTitle><ArrowDownCircle className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-slate-900">৳{stats.expense.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-primary rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-primary">Closing Balance</CardTitle><Wallet className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">৳{stats.balance.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      {(pLoading || eLoading) ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl print:hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Source / Category</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs font-bold text-slate-500">{formatCompactDate(tx.date)}</TableCell>
                      <TableCell className="font-bold">{tx.studentName || tx.category}</TableCell>
                      <TableCell className="text-right text-success">{tx.credit > 0 ? `৳${tx.credit.toLocaleString()}` : '-'}</TableCell>
                      <TableCell className="text-right text-destructive">{tx.debit > 0 ? `৳${tx.debit.toLocaleString()}` : '-'}</TableCell>
                      <TableCell className="text-right font-black">৳{tx.balance.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4 print:hidden">
            {filteredData.map((tx: any) => (
              <Card key={tx.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{formatCompactDate(tx.date)}</p>
                      <h3 className="font-bold text-slate-800 mt-1">{tx.studentName || tx.category}</h3>
                    </div>
                    <Badge className={cn("text-[8px] uppercase font-bold", tx.txType === 'income' ? "bg-success" : "bg-destructive")}>
                      {tx.txType}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-xl bg-secondary/30 border border-secondary">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Transaction</p>
                      <p className={cn("text-xs font-black", tx.txType === 'income' ? "text-success" : "text-destructive")}>
                        {tx.txType === 'income' ? "+" : "-"} ৳{(tx.credit || tx.debit).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/10">
                      <p className="text-[9px] font-bold text-primary uppercase mb-1">Running Balance</p>
                      <p className="text-xs font-black text-primary">৳{tx.balance?.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase">
                    <span className="flex items-center gap-1"><Wallet size={10} /> {tx.method}</span>
                    <span>{tx.buildingName}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredData.length === 0 && <div className="text-center py-12 text-muted-foreground italic text-sm">No ledger entries found.</div>}
          </div>
        </>
      )}
    </div>
  )
}
