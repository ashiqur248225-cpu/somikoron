
"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ChevronLeft, 
  History, 
  Wallet, 
  Receipt,
  ArrowRight,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function StudentPaymentHistoryPage() {
  const router = useRouter()
  const db = useFirestore()
  const [studentId, setStudentId] = useState("")
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setStudentId(localStorage.getItem("somikoron_auth_id") || "")
    setIsMounted(true)
  }, [])

  const studentRef = useMemoFirebase(() => studentId ? doc(db, "students", studentId) : null, [db, studentId])
  const { data: student, isLoading } = useDoc(studentRef)

  const sortedHistory = useMemo(() => {
    if (!student?.paymentsHistory) return []
    return [...student.paymentsHistory].sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateB - dateA
    })
  }, [student])

  if (!isMounted) return null
  if (isLoading) return <div className="flex justify-center p-20 animate-pulse text-sm font-bold text-muted-foreground uppercase">Fetching Records...</div>

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft />
        </Button>
        <div>
          <h1 className="text-2xl font-black text-slate-800">Payment History</h1>
          <p className="text-muted-foreground text-sm font-medium">All verified transactions.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {sortedHistory.map((payment: any, idx: number) => (
          <Card 
            key={payment.id || idx} 
            className="border-none shadow-sm rounded-3xl bg-white overflow-hidden active:scale-[0.98] transition-transform cursor-pointer" 
            onClick={() => router.push(`/receipts/${payment.id}`)}
          >
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-success/10 text-success flex items-center justify-center">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800">{payment.month} {payment.year}</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {payment.date ? new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-success">৳{payment.amount?.toLocaleString()}</p>
                  <Badge variant="outline" className="text-[8px] font-black uppercase mt-1 border-success/30 text-success bg-success/5">
                    {payment.method}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-50">
                <div className="text-center space-y-0.5">
                  <p className="text-[8px] font-bold text-muted-foreground uppercase">Seat</p>
                  <p className="text-xs font-black text-slate-700">৳{payment.seatAmount || 0}</p>
                </div>
                <div className="text-center space-y-0.5">
                  <p className="text-[8px] font-bold text-muted-foreground uppercase">Food</p>
                  <p className="text-xs font-black text-slate-700">৳{payment.foodAmount || 0}</p>
                </div>
                <div className="text-center space-y-0.5">
                  <p className="text-[8px] font-bold text-muted-foreground uppercase">Adv.</p>
                  <p className="text-xs font-black text-primary">৳{payment.advanceAmount || 0}</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <div className="flex items-center gap-2">
                   <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Wallet size={12}/>
                   </div>
                   <span className="text-[10px] font-medium text-slate-500">Receipt: RCPT-{payment.id?.substring(0,6).toUpperCase()}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-primary font-bold text-[10px] uppercase gap-1">
                  View Receipt <ArrowRight size={12}/>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {sortedHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 opacity-30 space-y-4">
            <History size={64} strokeWidth={1} />
            <p className="font-bold uppercase tracking-widest text-sm">No transaction records</p>
          </div>
        )}
      </div>
      
      <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] pt-4 pb-8">
        System Generated History • Somikoron
      </p>
    </div>
  )
}
