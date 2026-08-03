
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  Wallet, 
  Send, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Smartphone,
  Landmark,
  History,
  Info,
  CircleDollarSign,
  User
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, serverTimestamp, doc, addDoc, query, where, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function PaymentRequestPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [studentId, setStudentId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setStudentId(localStorage.getItem("somikoron_auth_id") || "")
    setIsMounted(true)
  }, [])

  const studentRef = useMemoFirebase(() => studentId ? doc(db, "students", studentId) : null, [db, studentId])
  const { data: student } = useDoc(studentRef)

  // Official Accounts for the branch
  const accountRef = useMemoFirebase(() => 
    student?.branch ? doc(db, "configs", `paymentAccounts_${student.branch}`) : null, 
    [db, student?.branch]
  )
  const { data: accountsData } = useDoc(accountRef)

  const [formData, setFormData] = useState({
    method: "",
    account: "",
    amount: "",
    transactionId: "",
    senderInfo: "", // New field for sender mobile/bank info
    purpose: "Monthly Rent & Food",
    description: ""
  })

  const requestsQuery = useMemoFirebase(() => {
    if (!studentId) return null
    return query(collection(db, "paymentRequests"), where("studentId", "==", studentId), limit(10))
  }, [db, studentId])
  const { data: recentRequests } = useCollection(requestsQuery)

  const duesSummary = useMemo(() => {
    if (!student) return { monthlyRent: 0, outstandingDue: 0 }
    const rentDue = Object.values(student.duesBreakdown || {}).reduce((a: any, b: any) => a + Number(b.amount || 0), 0)
    const foodVal = Number(student.foodDueAmount || 0)
    const foodDue = foodVal < 0 ? Math.abs(foodVal) : 0
    return {
      monthlyRent: Number(student.monthlyRent || 0),
      outstandingDue: rentDue + foodDue
    }
  }, [student])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.amount || !formData.transactionId || !formData.account || !formData.senderInfo) {
      toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "অনুগ্রহ করে সব তথ্য সঠিকভাবে পূরণ করুন।" })
      return
    }

    setIsSubmitting(true)
    try {
      await addDoc(collection(db, "paymentRequests"), {
        ...formData,
        studentId,
        studentName: student?.name,
        roomNumber: student?.roomNumber,
        branch: student?.branch,
        status: "pending",
        createdAt: serverTimestamp()
      })
      toast({ title: "আবেদন জমা হয়েছে", description: "ম্যানেজার আপনার ট্রানজেকশনটি ভেরিফাই করবেন।" })
      setFormData({ method: "", account: "", amount: "", transactionId: "", senderInfo: "", purpose: "Monthly Rent & Food", description: "" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="space-y-1 mb-2">
        <h1 className="text-2xl font-black text-slate-800">Payment Request</h1>
        <p className="text-muted-foreground text-sm font-medium">Submit your digital payment for verification.</p>
      </header>

      {/* Dues Awareness Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-none shadow-sm bg-primary/5 rounded-2xl p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><CircleDollarSign size={20}/></div>
          <div>
            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Monthly Rent</p>
            <p className="text-lg font-black text-primary">৳{duesSummary.monthlyRent}</p>
          </div>
        </Card>
        <Card className="border-none shadow-sm bg-destructive/5 rounded-2xl p-4 flex items-center gap-4 border-l-4 border-l-destructive">
          <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive"><AlertCircle size={20}/></div>
          <div>
            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Outstanding Dues</p>
            <p className="text-lg font-black text-destructive">৳{duesSummary.outstandingDue}</p>
          </div>
        </Card>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
        <div className="h-2 bg-primary w-full" />
        <CardContent className="p-8 space-y-6">
           <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Official Account (যেখানে টাকা পাঠিয়েছেন)</Label>
                  <Select value={formData.account} onValueChange={v => setFormData({...formData, account: v})}>
                    <SelectTrigger className="bg-white h-12 rounded-xl shadow-sm border-none font-bold">
                      <SelectValue placeholder="রিসিভার নাম্বার সিলেক্ট করুন" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountsData?.accounts?.map((acc: any, i: number) => (
                        <SelectItem key={`account-${acc.number}-${i}`} value={acc.number}>
                          {acc.label}: {acc.number}
                        </SelectItem>
                      ))}
                      {!accountsData?.accounts && <SelectItem disabled value="none">No accounts configured</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Amount (৳)</Label>
                    <Input 
                      type="number" 
                      value={formData.amount} 
                      onChange={e => setFormData({...formData, amount: e.target.value})} 
                      className="bg-white h-12 rounded-xl font-black text-lg border-none shadow-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Method</Label>
                    <Select value={formData.method} onValueChange={v => setFormData({...formData, method: v})}>
                       <SelectTrigger className="bg-white h-12 rounded-xl border-none shadow-sm font-bold"><SelectValue placeholder="Mode"/></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="bkash">Bkash</SelectItem>
                          <SelectItem value="nagad">Nagad</SelectItem>
                          <SelectItem value="bank">Bank</SelectItem>
                       </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Sender Info (আপনার নাম্বার/ব্যাংক অ্যাকাউন্ট)</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={formData.senderInfo} 
                      onChange={e => setFormData({...formData, senderInfo: e.target.value})} 
                      className="pl-10 bg-white h-12 rounded-xl font-bold border-none shadow-sm"
                      placeholder="যেমন: 017XXXXXXXX বা ব্যাংক নাম"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Transaction ID / Reference</Label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={formData.transactionId} 
                      onChange={e => setFormData({...formData, transactionId: e.target.value})} 
                      className="pl-10 bg-white h-12 rounded-xl font-mono border-none shadow-sm uppercase"
                      placeholder="TRX12345678"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                 <AlertCircle className="text-amber-600 h-5 w-5 shrink-0 mt-0.5" />
                 <p className="text-[9px] text-amber-700 leading-tight font-bold uppercase">
                   Warning: ভুল তথ্য দিলে পেমেন্ট রিকোয়েস্ট বাতিল হতে পারে। সেন্ডার নাম্বার এবং TRX ID মিলিয়ে নিন।
                 </p>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full h-16 rounded-[2rem] text-lg font-black shadow-xl shadow-primary/20 gap-3 transition-all hover:scale-[1.01]">
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                Confirm Request
              </Button>
           </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2 ml-2">
          <History size={14}/> Recent Requests
        </h3>
        <div className="space-y-3">
          {recentRequests?.map((req: any) => (
            <div key={req.id} className="p-4 bg-white rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-[8px] font-bold text-muted-foreground uppercase">
                  {isMounted && req.createdAt?.toDate ? new Date(req.createdAt.toDate()).toLocaleDateString() : 'Loading...'}
                </p>
                <h4 className="font-black text-slate-800 text-sm">৳{req.amount}</h4>
                <p className="text-[9px] font-mono text-slate-400">Sender: {req.senderInfo}</p>
              </div>
              <Badge className={cn(
                "rounded-full text-[8px] font-black uppercase px-3",
                req.status === 'approved' ? "bg-success" : (req.status === 'rejected' ? "bg-destructive" : "bg-orange-400")
              )}>
                {req.status}
              </Badge>
            </div>
          ))}
          {(!recentRequests || recentRequests.length === 0) && (
            <p className="text-center py-8 text-xs text-muted-foreground italic">No recent requests found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
