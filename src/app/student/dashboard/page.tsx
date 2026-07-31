
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  Loader2
} from "lucide-react"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"

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
    
    return { rentDue, foodBalance, foodDue, totalDue, lastPayment }
  }, [student])

  if (isLoading) return <div className="flex justify-center p-20 animate-pulse">Loading Dashboard...</div>
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
                <p className="text-lg font-black">৳{stats?.foodBalance.toLocaleString()}</p>
             </div>
          </div>

          <Link href="/student/payments">
            <Button className="w-full bg-white text-primary hover:bg-slate-50 h-12 rounded-2xl font-black text-sm uppercase gap-2 shadow-xl shadow-primary/20">
              <CircleDollarSign size={18} /> Make Payment Request
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Quick Status Grid */}
      <div className="grid grid-cols-3 gap-3">
         <Card className="border-none shadow-sm bg-white rounded-2xl p-4 text-center space-y-1">
            <div className="h-8 w-8 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-2"><Home size={16}/></div>
            <p className="text-[8px] font-bold text-muted-foreground uppercase">Rent</p>
            <p className="text-xs font-black">৳{student.monthlyRent}</p>
         </Card>
         <Card className="border-none shadow-sm bg-white rounded-2xl p-4 text-center space-y-1">
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-2"><Wifi size={16}/></div>
            <p className="text-[8px] font-bold text-muted-foreground uppercase">WiFi</p>
            <p className="text-xs font-black">Active</p>
         </Card>
         <Card className="border-none shadow-sm bg-white rounded-2xl p-4 text-center space-y-1">
            <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center mx-auto mb-2"><ChefHat size={16}/></div>
            <p className="text-[8px] font-bold text-muted-foreground uppercase">Cooking</p>
            <p className="text-xs font-black">Standard</p>
         </Card>
      </div>

      {/* Meal Summary Card */}
      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b py-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary uppercase tracking-tight">
              <Utensils size={16}/> Meal Status
            </CardTitle>
            <Link href="/student/meals" className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase">Manage <ChevronRight size={12}/></Link>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex justify-around text-center">
            <div>
              <p className="text-[8px] font-bold text-muted-foreground uppercase mb-2">Breakfast</p>
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center mx-auto text-xs font-black", student.mealStatus?.breakfast ? "bg-success/10 text-success" : "bg-slate-100 text-slate-400")}>
                {student.mealStatus?.breakfast ? "ON" : "OFF"}
              </div>
            </div>
            <div>
              <p className="text-[8px] font-bold text-muted-foreground uppercase mb-2">Lunch</p>
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center mx-auto text-xs font-black", student.mealStatus?.lunch ? "bg-success/10 text-success" : "bg-slate-100 text-slate-400")}>
                {student.mealStatus?.lunch ? "ON" : "OFF"}
              </div>
            </div>
            <div>
              <p className="text-[8px] font-bold text-muted-foreground uppercase mb-2">Dinner</p>
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center mx-auto text-xs font-black", student.mealStatus?.dinner ? "bg-success/10 text-success" : "bg-slate-100 text-slate-400")}>
                {student.mealStatus?.dinner ? "ON" : "OFF"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Payment */}
      <Card className="border-none shadow-sm rounded-3xl bg-white p-6 space-y-4">
        <div className="flex items-center gap-3 text-primary">
          <History size={18}/>
          <h3 className="font-bold text-sm uppercase tracking-tight">Recent Transaction</h3>
        </div>
        {stats?.lastPayment ? (
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Date</p>
              <p className="text-xs font-bold text-slate-700">
                {isMounted ? new Date(stats.lastPayment.date).toLocaleDateString() : 'Loading...'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-slate-400">Amount</p>
              <p className="text-lg font-black text-success">৳{stats.lastPayment.amount.toLocaleString()}</p>
            </div>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground italic py-4">No recent payments found.</p>
        )}
      </Card>
      
      <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] pt-4">
        Protected by Somikoron Digital
      </p>
    </div>
  )
}
