
"use client"

import { useState, useMemo } from "react"
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
import { collection, query, orderBy, limit } from "firebase/firestore"

export default function LedgerPage() {
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")

  // Fetch payments (income)
  const paymentsQuery = useMemoFirebase(() => query(collection(db, "payments"), orderBy("date", "desc"), limit(500)), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  // Fetch expenses
  const expensesQuery = useMemoFirebase(() => query(collection(db, "expenses"), orderBy("createdAt", "desc"), limit(500)), [db])
  const { data: expenses, isLoading: expensesLoading } = useCollection(expensesQuery)

  // Helper function to get a Date object from various formats
  const getTransactionDate = (tx: any) => {
    if (tx.date?.toDate) return tx.date.toDate()
    if (tx.date) return new Date(tx.date)
    if (tx.expenseDate) return new Date(tx.expenseDate)
    if (tx.createdAt?.toDate) return tx.createdAt.toDate()
    return new Date(0)
  }

  // Merge and sort all transactions
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

  const handleExportCSV = () => {
    const headers = ["Date", "Type", "Entity/Party", "Category", "Building", "Amount"]
    const rows = filteredData.map(tx => [
      getTransactionDate(tx).toLocaleDateString(),
      tx.txType.toUpperCase(),
      tx.txType === 'income' ? tx.studentName : tx.expensePartyName,
      tx.category || tx.paymentType || 'General',
      tx.buildingName || "General",
      tx.txType === 'income' ? tx.amount : -tx.amount
    ])

    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += "SOMIKORON ACCOUNTING LEDGER\n"
    csvContent += `Generated on: ${new Date().toLocaleString()}\n\n`
    csvContent += headers.join(",") + "\n"
    rows.forEach(row => { csvContent += row.join(",") + "\n" })
    csvContent += `\n,,,,NET BALANCE,${totalIncome - totalExpense}`

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Ledger_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Accounting Ledger</h1>
          <p className="text-muted-foreground mt-1">Unified history of all income and expenses.</p>
        </div>
        <Button onClick={handleExportCSV} className="flex gap-2">
          <FileSpreadsheet size={18} /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-income/5 border-l-4 border-l-income">
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
        <Card className="border-none shadow-sm bg-expense/5 border-l-4 border-l-expense">
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
        <Card className="border-none shadow-sm bg-primary/5 border-l-4 border-l-primary">
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

      <Card className="border-none shadow-sm overflow-hidden">
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
                    <TableCell className="whitespace-nowrap text-xs">
                      {getTransactionDate(row).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {row.txType === 'income' ? row.studentName : row.expensePartyName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.txType === 'income' ? 'secondary' : 'outline'} className="font-normal capitalize text-[10px]">
                        {row.category || row.paymentType || 'General'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.buildingName}</TableCell>
                    <TableCell className={`text-right font-bold ${row.txType === 'income' ? 'text-income' : 'text-expense'}`}>
                      {row.txType === 'income' ? '+' : '-'}৳{row.amount?.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No transactions found.</TableCell>
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
