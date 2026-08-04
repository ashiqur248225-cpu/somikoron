
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Home, 
  Wallet, 
  Clock, 
  History, 
  ShieldCheck, 
  Utensils, 
  Smartphone,
  ChevronRight,
  TrendingUp,
  CircleDollarSign,
  Zap,
  Wifi,
  ChefHat,
  Loader2,
  Receipt,
  Calculator
} from "lucide-react"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import Link from "next/link"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function StudentDashboardPage() {
  const db = useFirestore()
  const [studentId, setStudentId] = useState("")
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setStudentId(localStorage.getItem("somikoron_auth_id") || "")
    setIsMounted(true)
  }, [])

  const studentRef = useMemoFirebase(() => studentId ? doc(db, "students", studentId) : null, [db, studentId])
  const { data: student, isLoading } = useDoc(studentRef)

  const stats = useMemo(() => {
    if (!student) return null
    const rentDue = Object.values(student.duesBreakdown || {}).reduce((a: any, b: any) => a + Number(b.amount || 0), 0)
    const foodVal = Number(student.foodDueAmount || 0)
    const foodDue = foodVal < 0 ? Math.abs(foodVal) : 0
    const foodBalance = foodVal > 0 ? foodVal : 0
    const totalDue = rentDue + foodDue
    
    const lastPayment = student.paymentsHistory?.[student.paymentsHistory.length - 1] || null
    const lastMonthFood = student.mealsHistory?.[student.mealsHistory.length - 1] || null

    const currentMonthMeals = (student.currentMonthBreakfast || 0) + (student.currentMonthLunch || 0) + (student.currentMonthDinner || 0)
    
    return { rentDue, foodBalance, foodDue, totalDue, lastPayment, lastMonthFood, currentMonthMeals }
  }, [student])

  if (!isMounted) return null;
  if (isLoading) return <div className="flex justify-center p-20 animate-pulse text-sm font-bold text-muted-foreground uppercase">Syncing Dashboard...</div>
  if (!student) return <div className="text-center p-20">Access Denied. Please Login.</div>

  const displayName = (student.name || "Resident").split(' ')[0]

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-end mb-2">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase text-primary tracking-widest">Resident Portal</p>
          <h1 className="text-2xl font-black text-slate-800">Hello, {displayName}!</h1>
        </div>
        <Badge className="bg-primary/10 text-primary border-none font-black text-[9px] uppercase px-3 rounded-full">
          R-{student.roomNumber}
        </Badge>
      </header>

      {/* Main Account Card */}
      <Card className="border-none shadow-2xl bg-primary rounded-[2.5rem] overflow-hidden text-white relative">
        <div className="absolute top-0 right-0 p-8 opacity-10"><Wallet size={120} /></div>
        <CardContent className="p-8 space-y-6 relative z-10">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase text-white/60 tracking-[0.2em]">Outstanding Due</p>
              <h2 className="text-4xl font-black">৳{stats?.totalDue.toLocaleString()}</h2>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md"><TrendingUp size={24}/></div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white/10 p-4 rounded-3xl border border-white/5">
                <p className="text-[8px] font-bold uppercase text-white/50 mb-1">Advance Balance</p>
                <p className="text-lg font-black">৳{student.advanceAmount?.toLocaleString()}</p>
             </div>
             <div className="bg-white/10 p-4 rounded-3xl border border-white/5">
                <p className="text-[8px] font-bold uppercase text-white/50 mb-1">Food Balance</p>
                <p className={cn("text-lg font-black", (student.foodDueAmount || 0) < 0 ? "text-red-300" : "text-green-300")}>
                  ৳{stats?.foodBalance.toLocaleString()}
                </p>
             </div>
             <div className="bg-white/10 p-4 rounded-3xl border border-white/5">
                <p className="text-[8px] font-bold uppercase text-white/50 mb-1">Rent Due</p>
                <p className="text-lg font-black text-red-200">৳{stats?.rentDue.toLocaleString()}</p>
             </div>
             <div className="bg-white/10 p-4 rounded-3xl border border-white/5">
                <p className="text-[8px] font-bold uppercase text-white/50 mb-1">Total Received</p>
                <p className="text-lg font-black text-green-200">৳{student.historicalTotalReceived || 0}</p>
             </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-center">
            <Link href="/student/history" className="w-full">
               <Button className="w-full bg-white text-primary hover:bg-slate-50 h-12 rounded-2xl font-black text-sm uppercase gap-2 shadow-xl shadow-primary/20">
                  View Payment History <History size={16}/>
               </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Consumption Progress Card */}
      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-5 flex justify-between items-center">
           <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-inner"><Calculator size={20}/></div>
              <div>
                <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Current Month Meals</p>
                <p className="text-lg font-black text-slate-800">{stats?.currentMonthMeals} <span className="text-[10px] font-medium text-slate-400">Meals</span></p>
              </div>
           </div>
           <Link href="/student/meals">
             <Button variant="ghost" size="sm" className="h-8 text-primary font-bold text-[10px] uppercase gap-1">Update <ChevronRight size={14}/></Button>
           </Link>
        </CardContent>
      </Card>

      {/* Last Month Food Summary Card */}
      {stats?.lastMonthFood && (
        <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b py-4">
             <div className="flex justify-between items-center">
                <CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                  <Receipt size={14}/> Previous Month Final Bill
                </CardTitle>
                <Badge variant="outline" className="text-[8px] font-black uppercase">{stats.lastMonthFood.month}</Badge>
             </div>
          </CardHeader>
          <CardContent className="p-5 flex justify-between items-center">
             <div className="space-y-1">
                <p className="text-xs font-bold text-slate-600">Total Bill: <span className="text-destructive font-black">৳{stats.lastMonthFood.totalCost}</span></p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase">{stats.lastMonthFood.totalMeals} Meals Consumed</p>
             </div>
             <Link href="/student/meals">
                <Button variant="ghost" size="sm" className="h-8 text-primary font-bold text-[10px] uppercase gap-1">
                   Details <ChevronRight size={14}/>
                </Button>
             </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick Status Grid */}
      <div className="grid grid-cols-1 gap-3">
         <Card className="border-none shadow-sm bg-white rounded-2xl p-4 text-center space-y-1">
            <div className="h-8 w-8 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-2"><Home size={16}/></div>
            <p className="text-[8px] font-bold text-muted-foreground uppercase">Rent</p>
            <p className="text-xs font-black">৳{student.monthlyRent}</p>
         </Card>
      </div>

      <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] pt-4 pb-8">
        Protected by Somikoron Digital
      </p>
    </div>
  )
}
