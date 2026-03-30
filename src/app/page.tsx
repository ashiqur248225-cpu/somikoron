"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Building2, 
  TrendingUp,
  History
} from "lucide-react"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const stats = [
  {
    title: "Today's Income",
    amount: "₹12,500",
    change: "+12% from yesterday",
    icon: ArrowUpCircle,
    color: "text-income"
  },
  {
    title: "Today's Expenses",
    amount: "₹4,200",
    change: "-5% from yesterday",
    icon: ArrowDownCircle,
    color: "text-expense"
  },
  {
    title: "Monthly Income",
    amount: "₹185,000",
    change: "+8% from last month",
    icon: TrendingUp,
    color: "text-primary"
  },
  {
    title: "Total Buildings",
    amount: "4",
    change: "32 Rooms total",
    icon: Building2,
    color: "text-primary"
  }
]

const recentTransactions = [
  { id: "1", type: "income", title: "John Doe - Rent", amount: 5500, date: "2024-05-20", category: "Rent" },
  { id: "2", type: "expense", title: "Electricity Bill - B1", amount: 1200, date: "2024-05-19", category: "Utility" },
  { id: "3", type: "income", title: "Alice Smith - Meal", amount: 2500, date: "2024-05-19", category: "Meal" },
  { id: "4", type: "expense", title: "Vegetable Market", amount: 800, date: "2024-05-18", category: "Market" },
  { id: "5", type: "income", title: "Robert Brown - Package", amount: 7500, date: "2024-05-18", category: "Package" },
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight text-primary">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Daily overview and quick insights for your hostel network.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="shadow-sm border-none bg-card hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.amount}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4 shadow-sm border-none">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Recent Transactions</CardTitle>
              <p className="text-sm text-muted-foreground">Latest income and expenses recorded.</p>
            </div>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{tx.title}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{tx.date}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {tx.category}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}>
                      {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="col-span-3 shadow-sm border-none">
          <CardHeader>
            <CardTitle>Building Occupancy</CardTitle>
            <p className="text-sm text-muted-foreground">Room availability across buildings.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              { name: "Blue Heights", occupied: 12, total: 15 },
              { name: "Serene Residency", occupied: 8, total: 10 },
              { name: "Victory Hostel", occupied: 20, total: 20 },
              { name: "Park Side", occupied: 4, total: 8 },
            ].map((building) => (
              <div key={building.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{building.name}</span>
                  <span className="text-muted-foreground">
                    {building.occupied}/{building.total} Rooms
                  </span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary" 
                    style={{ width: `${(building.occupied / building.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}