"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Printer, Filter, ArrowUpCircle, ArrowDownCircle, Wallet, RotateCcw, Calendar, History, ArrowRight } from "lucide-react"
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
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  
  // Default to current month range
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

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
      const matchesBuilding = buildingFilter === "all" || tx.buildingId === buildingFilter
      return matchesDate && matchesSearch && matchesType && matchesBuilding
    }).map(tx => {
      runningBalance += (tx.credit - tx.debit)
      return { ...tx, balance: runningBalance }
    }).reverse()
  }, [rawLedgerData, searchTerm, typeFilter, buildingFilter, startDate, endDate])

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

  const handleReset = () => {
    setSearchTerm("")
    setTypeFilter("all")
    setBuildingFilter("all")
    setStartDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
    setEndDate(new Date().toISOString().split('T')[0])
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
          <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-success">Total Income</CardTitle><ArrowUpCircle className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-xl font-bold">৳{stats.income.toLocaleString()}</div></CardContent></Card>
          <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-destructive">Total Expense</CardTitle><ArrowDownCircle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-xl font-bold">৳{stats.expense.toLocaleString()}</div></CardContent></Card>
          <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-primary rounded-2xl overflow-hidden"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-primary">Closing Balance</CardTitle><Wallet className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-xl font-bold text-primary">৳{stats.balance.toLocaleString()}</div></CardContent></Card>
        </div>

        {(pLoading || eLoading) ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            {/* Desktop Table View */}
            <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source / Category</TableHead>
                      <TableHead className="text-right">Credit (+)</TableHead>
                      <TableHead className="text-right">Debit (-)</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((tx: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-bold text-slate-500">{formatCompactDate(tx.date)}</TableCell>
                        <TableCell className="font-bold text-slate-700">{tx.studentName || tx.category || "General"}</TableCell>
                        <TableCell className="text-right text-success font-medium">{tx.credit > 0 ? `৳${tx.credit.toLocaleString()} (+)` : '-'}</TableCell>
                        <TableCell className="text-right text-destructive font-medium">{tx.debit > 0 ? `৳${tx.debit.toLocaleString()} (-)` : '-'}</TableCell>
                        <TableCell className="text-right font-black text-slate-900">৳{tx.balance.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredData.map((tx: any, idx: number) => (
                <Card 
                  key={idx} 
                  className={cn(
                    "border-none shadow-sm rounded-2xl overflow-hidden bg-white border-l-4",
                    tx.txType === 'income' ? "border-l-success" : "border-l-destructive"
                  )}
                >
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className={cn("p-2 rounded-lg", tx.txType === 'income' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                          {tx.txType === 'income' ? <ArrowUpCircle size={18}/> : <ArrowDownCircle size={18}/>}
                        </div>
                        <h3 className="font-black text-slate-800 leading-tight truncate max-w-[150px]">
                          {tx.studentName || tx.category || "General"}
                        </h3>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-black uppercase",
                        tx.txType === 'income' ? "text-success border-success/20 bg-success/5" : "text-destructive border-destructive/20 bg-destructive/5"
                      )}>
                        {tx.txType}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-secondary/30 p-3 rounded-xl border border-secondary">
                      <div className="space-y-1">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Transaction Info</p>
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-700">
                          <Calendar size={10} className="text-primary"/> {formatCompactDate(tx.date)}
                        </div>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Type Sum</p>
                        <p className={cn("text-xs font-black", tx.txType === 'income' ? "text-success" : "text-destructive")}>
                          {tx.txType === 'income' ? `৳${tx.credit.toLocaleString()} (+)` : `৳${tx.debit.toLocaleString()} (-)`}
                        </p>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-dashed flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                        <History size={12}/> Running Balance
                      </div>
                      <p className="text-lg font-black text-primary">৳{tx.balance.toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredData.length === 0 && (
                <div className="text-center py-12 text-muted-foreground italic">No transactions match filters.</div>
              )}
            </div>
          </>
        )}
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Filter Ledger</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>TX Type</Label><Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="income">Income Only</SelectItem><SelectItem value="expense">Expense Only</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">Entire Branch</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-1.5">
              <Label>Date Range (From date to To date)</Label>
              <div className="flex gap-2">
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
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
