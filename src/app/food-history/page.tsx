"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Printer, Loader2, RefreshCw, ChevronLeft, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, limit } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function FoodHistoryPage() {
  const db = useFirestore()
  const router = useRouter()
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  const foodHistoryQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "expenses"), where("branch", "==", userBranch), where("category", "==", "food"), limit(1000))
  }, [db, userBranch])
  
  const { data: rawFoodHistory, isLoading } = useCollection(foodHistoryQuery)

  const filteredHistory = useMemo(() => {
    if (!rawFoodHistory) return []
    const start = new Date(startDate)
    const end = new Date(endDate); end.setHours(23, 59, 59)
    return rawFoodHistory.filter(item => {
      const itemDate = new Date(item.expenseDate)
      return itemDate >= start && itemDate <= end
    }).sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())
  }, [rawFoodHistory, startDate, endDate])

  const totals = useMemo(() => {
    const cost = filteredHistory.reduce((a, b) => a + (b.amount || 0), 0)
    const meals = filteredHistory.reduce((a, b) => a + (b.totalMeals || 0), 0)
    return { cost, meals }
  }, [filteredHistory])

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      setTimeout(() => { window.print(); }, 500);
    }
  }

  return (
    <div className="space-y-8 pb-20 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => router.back()}><ChevronLeft size={24} /></Button><Separator orientation="vertical" className="mr-2 h-4" /><div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Food cost History</h1></div></div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> Print Report</Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* OFFICIAL A4 PRINT REPORT */}
      <div className="print-only print-report-container">
        <div className="report-header">
          <h1>সমীকরণ ছাত্রাবাস</h1>
          <p className="branch-title">{userBranch} Branch • Food Cost Analysis</p>
          <div className="flex justify-between items-end mt-4 px-2 text-[8pt] font-bold text-slate-500 uppercase">
            <div>
              <p>Period: {startDate} to {endDate}</p>
              <p>Target: Monthly Meal Expense Summary</p>
            </div>
            <div className="text-right">
              <p>Generated: {new Date().toLocaleString()}</p>
              <p>Kitchen Staff: {userName}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th className="text-center">Total Meals</th>
              <th className="text-right">Total Food Cost</th>
              <th className="text-right">Avg Cost/Meal</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map((item: any) => {
              const totalMeals = Number(item.totalMeals || 0)
              const amount = Number(item.amount || 0)
              const perMeal = totalMeals > 0 ? (amount / totalMeals).toFixed(2) : "—"
              return (
                <tr key={item.id}>
                  <td className="font-bold">{new Date(item.expenseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="text-center">{totalMeals || '—'}</td>
                  <td className="text-right font-bold">৳{amount.toLocaleString()}</td>
                  <td className="text-right font-black text-primary">৳{perMeal}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td className="text-right uppercase">Consolidated Totals</td>
              <td className="text-center">{totals.meals} Meals</td>
              <td className="text-right">৳{totals.cost.toLocaleString()}</td>
              <td className="text-right">AVG: ৳{totals.meals > 0 ? (totals.cost / totals.meals).toFixed(2) : '—'}</td>
            </tr>
          </tfoot>
        </table>

        <div className="print-footer px-10">
          <div className="signature-box">Kitchen Manager</div>
          <div className="signature-box">Accountant</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-secondary/20 p-6 rounded-2xl border items-end print:hidden">
        <div className="space-y-1.5"><Label className="text-[10px] font-bold">Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-[10px] font-bold">End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl print:hidden">
        <CardHeader className="bg-slate-50/50 border-b px-6 py-4"><CardTitle className="text-lg font-bold">Cost breakdown</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50"><TableRow><TableHead>Date</TableHead><TableHead className="text-center">Meals</TableHead><TableHead className="text-right">Total Cost</TableHead><TableHead className="text-right">Per Meal</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (<TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>) : 
                filteredHistory.map((item) => {
                  const perMeal = Number(item.totalMeals || 0) > 0 ? (Number(item.amount) / Number(item.totalMeals)).toFixed(2) : "N/A"
                  return (
                    <TableRow key={item.id}><TableCell className="font-bold text-slate-600">{new Date(item.expenseDate).toLocaleDateString()}</TableCell><TableCell className="text-center"><Badge variant="secondary">{item.totalMeals || 'N/A'}</Badge></TableCell><TableCell className="text-right font-bold text-destructive">৳{item.amount.toLocaleString()}</TableCell><TableCell className="text-right font-black text-primary">৳{perMeal}</TableCell></TableRow>
                  )
                })
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}