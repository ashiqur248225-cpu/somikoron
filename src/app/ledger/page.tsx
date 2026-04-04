
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
import { History, Search, Filter, Download, Loader2, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, where } from "firebase/firestore"

export default function LedgerPage() {
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  
  // User Context
  const [userBranch, setUserBranch] = useState("Main Branch")
  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
  }, [])

  // CRITICAL: Filter ledger by branch
  const paymentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "payments"), where("branch", "==", userBranch), orderBy("date", "desc"), limit(500))
  }, [db, userBranch])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "expenses"), where("branch", "==", userBranch), orderBy("expenseDate", "desc"), limit(500))
  }, [db, userBranch])
  const { data: expenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  const getTransactionDate = (tx: any) => {
    if (tx.date?.toDate) return tx.date.toDate()
    if (tx.date) return new Date(tx.date)
    if (tx.expenseDate) return new Date(tx.expenseDate)
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
        (tx.studentName || tx.expensePartyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.buildingName || "").toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === "all" || tx.txType === typeFilter
      return matchesSearch && matchesType
    })
  }, [allTransactions, searchTerm, typeFilter])

  const totalIncome = useMemo(() => (payments || []).reduce((acc, curr) => acc + (curr.amount || 0), 0), [payments])
  const totalExpense = useMemo(() => (expenses || []).reduce((acc, curr) => acc + (curr.amount || 0), 0), [expenses])

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Accounting Ledger</h1>
          <p className="text-muted-foreground mt-1">Unified records for <span className="font-bold text-foreground">{userBranch}</span>.</p>
        </div>
        <Button className="flex gap-2"><FileSpreadsheet size={18} /> Export CSV</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-income/5 border-l-4 border-l-income">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-income uppercase">Total Income</p>
                <p className="text-2xl font-bold text-income">৳{totalIncome.toLocaleString()}</p>
              </div>
              <History className="text-income h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-expense/5 border-l-4 border-l-expense">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-expense uppercase">Total Expense</p>
                <p className="text-2xl font-bold text-expense">৳{totalExpense.toLocaleString()}</p>
              </div>
              <History className="text-expense h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-primary/5 border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-primary uppercase">Net Balance</p>
                <p className="text-2xl font-bold text-primary">৳{(totalIncome - totalExpense).toLocaleString()}</p>
              </div>
              <History className="text-primary h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search records..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Select defaultValue="all" onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(paymentsLoading || expensesLoading) ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Entity / Party</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs">{getTransactionDate(row).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{row.studentName || row.expensePartyName}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize text-[10px]">{row.category || 'Rent/Food'}</Badge></TableCell>
                    <TableCell className={`text-right font-bold ${row.txType === 'income' ? 'text-income' : 'text-expense'}`}>
                      {row.txType === 'income' ? '+' : '-'}৳{row.amount?.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
