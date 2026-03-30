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
import { History, Search, Filter, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

const ledgerData = [
  { id: "TX1001", date: "2024-05-20", type: "income", category: "Rent", party: "John Doe", building: "Blue Heights", amount: 5500, status: "completed" },
  { id: "TX1002", date: "2024-05-19", type: "expense", category: "Utility", party: "Electric Supply Co", building: "Blue Heights", amount: 1200, status: "completed" },
  { id: "TX1003", date: "2024-05-19", type: "income", category: "Meal", party: "Alice Smith", building: "Serene Residency", amount: 2500, status: "completed" },
  { id: "TX1004", date: "2024-05-18", type: "expense", category: "Market", party: "Green Grocers", building: "Victory Hostel", amount: 800, status: "completed" },
  { id: "TX1005", date: "2024-05-18", type: "income", category: "Package", party: "Robert Brown", building: "Victory Hostel", amount: 7500, status: "completed" },
  { id: "TX1006", date: "2024-05-17", type: "expense", category: "Salary", party: "Maria (Cook)", building: "All Buildings", amount: 15000, status: "completed" },
]

export default function LedgerPage() {
  const [filter, setFilter] = useState("all")

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
              <Input placeholder="Search transactions, students, or parties..." className="pl-8" />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Select defaultValue="all">
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
              <Select defaultValue="all">
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Building" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buildings</SelectItem>
                  <SelectItem value="b1">Blue Heights</SelectItem>
                  <SelectItem value="b2">Serene Residency</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" className="w-[150px]" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead className="w-[100px]">TX ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Entity / Party</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Building</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerData.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.id}</TableCell>
                  <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                  <TableCell className="font-medium">{row.party}</TableCell>
                  <TableCell>
                    <Badge variant={row.type === 'income' ? 'secondary' : 'outline'} className="font-normal">
                      {row.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{row.building}</TableCell>
                  <TableCell className={`text-right font-bold ${row.type === 'income' ? 'text-income' : 'text-expense'}`}>
                    {row.type === 'income' ? '+' : '-'}₹{row.amount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none bg-income/10">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-income uppercase tracking-wider">Total Income</p>
                <p className="text-2xl font-bold text-income">₹15,500.00</p>
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
                <p className="text-2xl font-bold text-expense">₹17,000.00</p>
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
                <p className="text-2xl font-bold text-primary">-₹1,500.00</p>
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