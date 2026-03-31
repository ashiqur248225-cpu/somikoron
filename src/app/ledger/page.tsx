
"use client"

import { useState } from "react"
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
import { History, Search, Filter, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit } from "firebase/firestore"

export default function LedgerPage() {
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")

  // Fetch payments (income)
  const paymentsQuery = useMemoFirebase(() => query(collection(db, "payments"), orderBy("date", "desc"), limit(50)), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  // Fetch expenses
  const expensesQuery = useMemoFirebase(() => query(collection(db, "expenses"), orderBy("date", "desc"), limit(50)), [db])
  const { data: expenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  // Merge and sort all transactions
  const allTransactions = [
    ...(payments || []).map(p => ({ ...p, txType: 'income' })),
    ...(expenses || []).map(e => ({ ...e, txType: 'expense' }))
  ].sort((a, b) => {
    const dateA = a.date?.toDate?.() || new Date(0)
    const dateB = b.date?.toDate?.() || new Date(0)
    return dateB.getTime() - dateA.getTime()
  })

  const filteredData = allTransactions.filter(tx => {
    const matchesSearch = 
      (tx.studentName || tx.expensePartyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.buildingName || "").toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = typeFilter === "all" || tx.txType === typeFilter
    return matchesSearch && matchesType
  })

  const totalIncome = (payments || []).reduce((acc, curr) => acc + (curr.amount || 0), 0)
  const totalExpense = (expenses || []).reduce((acc, curr) => acc + (curr.amount || 0), 0)

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Accounting Ledger</h1>
          <p className="text-muted-foreground mt-1">Unified history of all income and expenses.</p>
        </div>
        <Button className="flex gap-2">
          <Download size={18} /> Export CSV
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search transactions..." 
                className="pl-8" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Select defaultValue="all" onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="h-3 w-3 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expenses</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                  <TableHead>Building</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {row.date?.toDate?.() ? row.date.toDate().toLocaleDateString() : 'Pending'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.txType === 'income' ? row.studentName : row.expensePartyName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.txType === 'income' ? 'secondary' : 'outline'} className="font-normal capitalize">
                        {row.category || row.paymentType || 'General'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{row.buildingName}</TableCell>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none bg-income/10">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-income uppercase tracking-wider">Total Income</p>
                <p className="text-2xl font-bold text-income">৳{totalIncome.toLocaleString()}</p>
              </div>
              <div className="bg-income/20 p-2 rounded-full">
                <History className="text-income h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none bg-expense/10">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-expense uppercase tracking-wider">Total Expense</p>
                <p className="text-2xl font-bold text-expense">৳{totalExpense.toLocaleString()}</p>
              </div>
              <div className="bg-expense/20 p-2 rounded-full">
                <History className="text-expense h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none bg-primary/10">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-primary uppercase tracking-wider">Net Balance</p>
                <p className="text-2xl font-bold text-primary">৳{(totalIncome - totalExpense).toLocaleString()}</p>
              </div>
              <div className="bg-primary/20 p-2 rounded-full">
                <History className="text-primary h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
