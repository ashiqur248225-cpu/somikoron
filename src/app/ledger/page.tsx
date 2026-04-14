"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Printer, Filter, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const formatCompactDate = (date: any) => {
  if (!date) return 'N/A'
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function LedgerPage() {
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  
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
      const matchesDate = (!startDate || txDate >= new Date(startDate)) && (!endDate || txDate <= new Date(new Date(endDate).setHours(23, 59, 59)))
      const matchesSearch = (tx.studentName || tx.expensePartyName || tx.category || "").toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === "all" || tx.txType === typeFilter
      return matchesDate && matchesSearch && matchesType
    }).map(tx => {
      runningBalance += (tx.credit - tx.debit)
      return { ...tx, balance: runningBalance }
    }).reverse()
  }, [rawLedgerData, searchTerm, typeFilter, startDate, endDate])

  const stats = useMemo(() => {
    const income = filteredData.reduce((a, b) => a + b.credit, 0)
    const expense = filteredData.reduce((a, b) => a + b.debit, 0)
    return { income, expense, balance: income - expense }
  }, [filteredData])

  const handlePrint = () => { 
    if (typeof window !== "undefined") { 
      setTimeout(() => { window.print(); }, 500);
    } 
  }

  return (
    <div className="space-y-8 pb-20 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2"><SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mr-2 h-4 md:hidden" /><div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Ledger</h1></div></div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsFilterDialogOpen(true)}><Filter size={16} /> Filter</Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> Download PDF</Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* OFFICIAL A4 PRINT REPORT */}
      <div className="print-only print-report-container">
        <div className="report-header">
          <h1>সমীকরণ ছাত্রাবাস</h1>
          <p className="branch-title">{userBranch} Branch • Transaction Ledger</p>
          <div className="flex justify-between items-end mt-4 px-2 text-[8pt] font-bold text-slate-500 uppercase">
            <div>
              <p>Period: {startDate || 'Start'} to {endDate || 'Today'}</p>
              <p>Account: General Ledger (Consolidated)</p>
            </div>
            <div className="text-right">
              <p>Generated: {new Date().toLocaleString()}</p>
              <p>Report Staff: {userName}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Source / Category</th>
              <th className="text-right">Credit (+)</th>
              <th className="text-right">Debit (-)</th>
              <th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.slice().reverse().map((tx: any, idx: number) => (
              <tr key={idx}>
                <td>{formatCompactDate(tx.date)}</td>
                <td className="capitalize text-[7pt]">{tx.txType}</td>
                <td className="font-bold">{tx.studentName || tx.category}</td>
                <td className="text-right text-success">{tx.credit > 0 ? `৳${tx.credit.toLocaleString()} (+)` : '—'}</td>
                <td className="text-right text-destructive">{tx.debit > 0 ? `৳${tx.debit.toLocaleString()} (-)` : '—'}</td>
                <td className="text-right font-black">৳{tx.balance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={3} className="text-right uppercase">Final Closing Balance</td>
              <td className="text-right">৳{stats.income.toLocaleString()}</td>
              <td className="text-right">৳{stats.expense.toLocaleString()}</td>
              <td className="text-right text-[10pt]">৳{stats.balance.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="print-footer">
          <div className="page-number"></div>
          <div className="signature-box">Manager Signature</div>
        </div>
      </div>

      <div className="print:hidden space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-success">Total Income</CardTitle><ArrowUpCircle className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold">৳{stats.income.toLocaleString()}</div></CardContent></Card>
          <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-destructive">Total Expense</CardTitle><ArrowDownCircle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">৳{stats.expense.toLocaleString()}</div></CardContent></Card>
          <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-primary rounded-2xl overflow-hidden"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-primary">Closing Balance</CardTitle><Wallet className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">৳{stats.balance.toLocaleString()}</div></CardContent></Card>
        </div>

        {(pLoading || eLoading) ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
        ) : (
          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50"><TableRow><TableHead>Date</TableHead><TableHead>Source / Category</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>{filteredData.map((tx: any, idx: number) => (<TableRow key={idx}><TableCell className="text-xs font-bold text-slate-500">{formatCompactDate(tx.date)}</TableCell><TableCell className="font-bold">{tx.studentName || tx.category}</TableCell><TableCell className="text-right text-success">{tx.credit > 0 ? `৳${tx.credit.toLocaleString()}` : '-'}</TableCell><TableCell className="text-right text-destructive">{tx.debit > 0 ? `৳${tx.debit.toLocaleString()}` : '-'}</TableCell><TableCell className="text-right font-black">৳{tx.balance.toLocaleString()}</TableCell></TableRow>))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Filter Ledger</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5"><Label>Search</Label><Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
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