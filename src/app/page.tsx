
"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Building2, 
  TrendingUp,
  History,
  Loader2
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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, where, Timestamp } from "firebase/firestore"

export default function DashboardPage() {
  const db = useFirestore()

  // Queries for dynamic stats
  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students } = useCollection(studentsQuery)

  // Get today's range for stats
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTimestamp = Timestamp.fromDate(today)

  const recentPaymentsQuery = useMemoFirebase(() => 
    query(collection(db, "payments"), orderBy("date", "desc"), limit(5)), [db])
  const { data: recentPayments, isLoading: paymentsLoading } = useCollection(recentPaymentsQuery)

  const recentExpensesQuery = useMemoFirebase(() => 
    query(collection(db, "expenses"), orderBy("createdAt", "desc"), limit(5)), [db])
  const { data: recentExpenses, isLoading: expensesLoading } = useCollection(recentExpensesQuery)

  // Today's Income Calculation (Client side aggregation to minimize reads)
  const todayIncome = useMemo(() => {
    return (recentPayments || [])
      .filter(p => p.date?.toDate() >= today)
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [recentPayments, today])

  // Today's Expense Calculation
  const todayExpense = useMemo(() => {
    return (recentExpenses || [])
      .filter(e => e.createdAt?.toDate() >= today)
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [recentExpenses, today])

  // Merge for recent activity feed
  const recentActivity = useMemo(() => {
    const combined = [
      ...(recentPayments || []).map(p => ({ ...p, type: 'income', title: `${p.studentName} - Rent` })),
      ...(recentExpenses || []).map(e => ({ ...e, type: 'expense', title: e.description, date: e.createdAt }))
    ].sort((a, b) => {
      const dateA = a.date?.toDate?.() || new Date(0)
      const dateB = b.date?.toDate?.() || new Date(0)
      return dateB.getTime() - dateA.getTime()
    }).slice(0, 5)
    return combined
  }, [recentPayments, recentExpenses])

  const stats = [
    {
      title: "Today's Income",
      amount: `₹${todayIncome.toLocaleString()}`,
      change: "Recorded today",
      icon: ArrowUpCircle,
      color: "text-income"
    },
    {
      title: "Today's Expenses",
      amount: `₹${todayExpense.toLocaleString()}`,
      change: "Logged today",
      icon: ArrowDownCircle,
      color: "text-expense"
    },
    {
      title: "Active Students",
      amount: students?.length || 0,
      change: "Current residents",
      icon: TrendingUp,
      color: "text-primary"
    },
    {
      title: "Total Buildings",
      amount: buildings?.length || 0,
      change: `${buildings?.reduce((acc, b) => acc + (b.rooms || 0), 0) || 0} Rooms total`,
      icon: Building2,
      color: "text-primary"
    }
  ]

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
            {paymentsLoading || expensesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivity.map((tx, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[150px]">{tx.title}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {tx.date?.toDate?.().toLocaleDateString() || 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal capitalize">
                          {tx.category || tx.paymentType || 'General'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-bold ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}>
                        {tx.type === 'income' ? '+' : '-'}₹{tx.amount?.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {recentActivity.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No recent activity.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3 shadow-sm border-none">
          <CardHeader>
            <CardTitle>Building Occupancy</CardTitle>
            <p className="text-sm text-muted-foreground">Room usage across properties.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {buildings?.map((building: any) => {
              const occupiedCount = students?.filter(s => s.buildingId === building.id).length || 0;
              const totalRooms = building.rooms || 1;
              const percentage = Math.min((occupiedCount / totalRooms) * 100, 100);
              
              return (
                <div key={building.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{building.name}</span>
                    <span className="text-muted-foreground">
                      {occupiedCount}/{totalRooms} Students
                    </span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {(!buildings || buildings.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">No building data available.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
