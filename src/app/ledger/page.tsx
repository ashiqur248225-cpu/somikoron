
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { History, Search, Filter, Download, Loader2, FileSpreadsheet, Printer, ArrowUpCircle, ArrowDownCircle, Wallet, XCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const formatCompactDate = (date: any) => {
  if (!date) return 'N/A'
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function LedgerPage() {
  const { toast } = useToast()
  const db = useFirestore()
  
  // States
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  
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

  const rawLedgerData = useMemo(() => {
    const combined = [
      ...(payments || []).map(p => ({ ...p, txType: 'income', debit: 0, credit: p.amount })),
      ...(expenses || []).map(e => ({ ...e, txType: 'expense', debit: e.amount, credit: 0, date: e.expenseDate }))
    ]
    return combined.sort((a, b) => {
      const d1 = a.date?.toDate ? a.date.toDate() : new Date(a.date)
      const d2 = b.date?.toDate ? b.date.toDate() : new Date(b.date)
      return d1.getTime() - d2.getTime()
    })
  }, [payments, expenses])

  const filteredData = useMemo(() => {
    let runningBalance = 0
    return rawLedgerData.filter(tx => {
      const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date)
      const matchesStartDate = !startDate || txDate >= new Date(startDate)
      const matchesEndDate = !endDate || txDate <= new Date(new Date(endDate).setHours(23, 59, 59))
      const matchesSearch = (tx.studentName || tx.expensePartyName || tx.category || "").toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === "all" || tx.txType === typeFilter
      return matchesStartDate && matchesEndDate && matchesSearch && matchesType
    }).map(tx => {
      runningBalance += (tx.credit - tx.debit)
      return { ...tx, balance: runningBalance }
    }).reverse()
  }, [rawLedgerData, searchTerm, typeFilter, startDate, endDate])

  const stats = useMemo(() => {
    const income = filteredData.reduce((a, b) => a + b.credit, 0)
    const expense = filteredData.reduce((a, b) => a + b.debit, 0)
    return { income, expense, balance: income - expense, count: filteredData.length }
  }, [filteredData])

  const handlePrint = () => { 
    if (typeof window !== "undefined") { 
      setTimeout(() => {
        window.print(); 
      }, 500);
    } 
  }

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
    <div className="space-y-8 pb-20 print:p-0 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Ledger</h1><p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Cash flow for <span className="font-bold text-foreground">{userBranch}</span>.</p></div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsFilterDialogOpen(true)}>
            <Filter size={16} /> <span className="hidden sm:inline">Filter</span>
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handleExportCSV}><FileSpreadsheet size={16} /> <span className="hidden sm:inline">Export CSV</span></Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Download PDF</span></Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* OFFICIAL PRINT REPORT SECTION */}
      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">সমীকরণ ছাত্রাবাস</h1>
          <p className="text-sm font-bold text-slate-600">{userBranch} ব্রাঞ্চ • জেনারেল লেজার রিপোর্ট (Ledger)</p>
          <div className="mt-4 border-y-2 border-slate-200 py-3 grid grid-cols-2 text-left text-[9pt] font-medium bg-slate-50/50 px-4">
            <div>
              <p><b>Period:</b> {startDate || 'Start'} to {endDate || 'Today'}</p>
              <p><b>Account Type:</b> Cash / Bank / Digital</p>
            </div>
            <div className="text-right">
              <p><b>Generated At:</b> {new Date().toLocaleString()}</p>
              <p><b>Staff:</b> {userName}</p>
            </div>
          </div>
        </div>

        <table className="w-full border-collapse border mt-6 text-[9pt]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 p-2 text-left font-black uppercase text-slate-700">Date</th>
              <th className="border border-slate-300 p-2 text-left font-black uppercase text-slate-700">Type</th>
              <th className="border border-slate-300 p-2 text-left font-black uppercase text-slate-700">Source / Category</th>
              <th className="border border-slate-300 p-2 text-right font-black uppercase text-slate-700">Credit (+)</th>
              <th className="border border-slate-300 p-2 text-right font-black uppercase text-slate-700">Debit (-)</th>
              <th className="border border-slate-300 p-2 text-right font-black uppercase text-slate-700">Balance</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.slice().reverse().map((tx: any) => (
              <tr key={tx.id}>
                <td className="border border-slate-200 p-2">{formatCompactDate(tx.date)}</td>
                <td className="border border-slate-200 p-2 capitalize text-[8pt]">{tx.txType}</td>
                <td className="border border-slate-200 p-2 font-bold">{tx.studentName || tx.category}</td>
                <td className="border border-slate-200 p-2 text-right text-success font-bold">{tx.credit > 0 ? `৳${tx.credit.toLocaleString()}` : '-'}</td>
                <td className="border border-slate-200 p-2 text-right text-destructive font-bold">{tx.debit > 0 ? `৳${tx.debit.toLocaleString()}` : '-'}</td>
                <td className="border border-slate-200 p-2 text-right font-black">৳{tx.balance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white font-black">
              <td colSpan={3} className="p-3 text-right uppercase text-[10pt]">Final Closing Balance</td>
              <td className="p-3 text-right text-success-foreground text-[11pt]">৳{stats.income.toLocaleString()}</td>
              <td className="p-3 text-right text-destructive-foreground text-[11pt]">৳{stats.expense.toLocaleString()}</td>
              <td className="p-3 text-right text-[11pt]">৳{stats.balance.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="print-footer mt-24 flex justify-between px-10">
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[8pt] font-black uppercase text-slate-800">Accountant Signature</p>
          </div>
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[8pt] font-black uppercase text-slate-800">Manager Signature</p>
          </div>
        </div>
      </div>

      <div className="print:hidden space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold uppercase text-success">Total Income</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-slate-900">৳{stats.income.toLocaleString()}</div></CardContent>
          </Card>
          <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold uppercase text-destructive">Total Expense</CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-slate-900">৳{stats.expense.toLocaleString()}</div></CardContent>
          </Card>
          <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-primary rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold uppercase text-primary">Closing Balance</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">৳{stats.balance.toLocaleString()}</div></CardContent>
          </Card>
        </div>

        {(pLoading || eLoading) ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0 overflow-x-auto">
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
        )}
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Filter Ledger</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5"><Label>Search</Label><Input placeholder="..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Type</Label><Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Date Range</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setIsFilterDialogOpen(false)}>Apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
