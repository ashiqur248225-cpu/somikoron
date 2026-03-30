"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from "@/components/ui/badge"
import { BarChart3, Download, Calendar, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const chartData = [
  { name: 'Jan', income: 4000, expense: 2400 },
  { name: 'Feb', income: 3000, expense: 1398 },
  { name: 'Mar', income: 2000, expense: 9800 },
  { name: 'Apr', income: 2780, expense: 3908 },
  { name: 'May', income: 1890, expense: 4800 },
];

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Financial Reports</h1>
          <p className="text-muted-foreground mt-1">Aggregated insights and detailed financial summaries.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex gap-2">
            <Calendar size={18} /> Last 6 Months
          </Button>
          <Button className="flex gap-2">
            <Download size={18} /> Generate PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Cash Flow</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Bar dataKey="income" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wider opacity-80">Building Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Blue Heights", amt: 12500 },
                  { name: "Victory Hostel", amt: 21000 },
                  { name: "Serene Res.", amt: 8400 },
                ].map((b) => (
                  <div key={b.name} className="flex justify-between items-center border-b border-primary-foreground/20 pb-2 last:border-0">
                    <span className="text-sm">{b.name}</span>
                    <span className="font-bold">₹{b.amt.toLocaleString()}</span>
                  </div>
                ))}
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
                <span className="text-muted-foreground">Active Students</span>
                <Badge variant="secondary">44</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Unpaid Dues</span>
                <span className="font-bold text-expense">₹8,400.00</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Advance Collected</span>
                <span className="font-bold text-income">₹12,200.00</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Maintenance Ratio</span>
                <span className="font-bold">12.4%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}