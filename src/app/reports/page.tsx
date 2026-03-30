
"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from "@/components/ui/badge"
import { BarChart3, Download, Calendar, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit } from "firebase/firestore"

export default function ReportsPage() {
  const db = useFirestore()

  // Fetch data for reporting
  const paymentsQuery = useMemoFirebase(() => query(collection(db, "payments"), orderBy("date", "desc"), limit(100)), [db])
  const { data: payments, isLoading: pLoading } = useCollection(paymentsQuery)

  const expensesQuery = useMemoFirebase(() => query(collection(db, "expenses"), orderBy("createdAt", "desc"), limit(100)), [db])
  const { data: expenses, isLoading: eLoading } = useCollection(expensesQuery)

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  // Aggregate data by month for the chart
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const currentYear = new Date().getFullYear()
    
    // Initialize last 5 months
    const now = new Date()
    const result = []
    for(let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      result.push({
        name: months[d.getMonth()],
        monthIdx: d.getMonth(),
        year: d.getFullYear(),
        income: 0,
        expense: 0
      })
    }

    payments?.forEach(p => {
      const pDate = p.date?.toDate()
      if (!pDate) return
      const entry = result.find(r => r.monthIdx === pDate.getMonth() && r.year === pDate.getFullYear())
      if (entry) entry.income += p.amount || 0
    })

    expenses?.forEach(e => {
      const eDate = e.createdAt?.toDate()
      if (!eDate) return
      const entry = result.find(r => r.monthIdx === eDate.getMonth() && r.year === eDate.getFullYear())
      if (entry) entry.expense += e.amount || 0
    })

    return result
  }, [payments, expenses])

  // Building wise breakdown
  const buildingBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {}
    payments?.forEach(p => {
      const bName = p.buildingName || "Unknown"
      breakdown[bName] = (breakdown[bName] || 0) + (p.amount || 0)
    })
    return Object.entries(breakdown).map(([name, amt]) => ({ name, amt })).sort((a, b) => b.amt - a.amt)
  }, [payments])

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Financial Reports</h1>
          <p className="text-muted-foreground mt-1">Aggregated insights and detailed financial summaries.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex gap-2">
            <Calendar size={18} /> Last 5 Months
          </Button>
          <Button className="flex gap-2">
            <Download size={18} /> Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Cash Flow</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            {pLoading || eLoading ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wider opacity-80">Building Collections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {buildingBreakdown.map((b) => (
                  <div key={b.name} className="flex justify-between items-center border-b border-primary-foreground/20 pb-2 last:border-0">
                    <span className="text-sm">{b.name}</span>
                    <span className="font-bold">₹{b.amt.toLocaleString()}</span>
                  </div>
                ))}
                {buildingBreakdown.length === 0 && (
                  <p className="text-sm opacity-60">No collection data yet.</p>
                )}
                <Button variant="secondary" size="sm" className="w-full mt-4 bg-white/10 hover:bg-white/20 border-none text-white">
                  Full Building Report <ArrowRight size={14} className="ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Quick Aggregates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Buildings</span>
                <Badge variant="secondary">{buildings?.length || 0}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Income</span>
                <span className="font-bold text-income">₹{payments?.reduce((acc, p) => acc + (p.amount || 0), 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Expense</span>
                <span className="font-bold text-expense">₹{expenses?.reduce((acc, e) => acc + (e.amount || 0), 0).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
