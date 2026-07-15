
"use client"

import { useState, useEffect } from "react"
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
  Info
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

  useEffect(() => {
    setStudentId(localStorage.getItem("somikoron_auth_id") || "")
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
    purpose: "Monthly Rent & Food",
    description: ""
  })

  const requestsQuery = useMemoFirebase(() => {
    if (!studentId) return null
    return query(collection(db, "paymentRequests"), where("studentId", "==", studentId), limit(10))
  }, [db, studentId])
  const { data: recentRequests } = useCollection(requestsQuery)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.amount || !formData.transactionId || !formData.account) {
      toast({ variant: "destructive", title: "Error", description: "Please fill all fields correctly." })
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
      toast({ title: "Request Submitted", description: "Manager will verify your transaction soon." })
      setFormData({ method: "", account: "", amount: "", transactionId: "", purpose: "Monthly Rent & Food", description: "" })
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message })
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

      <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
        <div className="h-2 bg-primary w-full" />
        <CardContent className="p-8 space-y-6">
           <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Official Account</Label>
                  <Select value={formData.account} onValueChange={v => setFormData({...formData, account: v})}>
                    <SelectTrigger className="bg-white h-12 rounded-xl shadow-sm border-none font-bold">
                      <SelectValue placeholder="Select Receiver Number" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountsData?.accounts?.map((acc: any, i: number) => (
                        <SelectItem key={i} value={acc.number}>{acc.label}: {acc.number}</SelectItem>
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
                   Warning: Payments sent to any unofficial account or incorrect Transaction IDs will not be accepted.
                 </p>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full h-16 rounded-[2rem] text-lg font-black shadow-xl shadow-primary/20 gap-3">
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                Submit Request
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
                <p className="text-[8px] font-bold text-muted-foreground uppercase">{new Date(req.createdAt?.toDate?.()).toLocaleDateString()}</p>
                <h4 className="font-black text-slate-800 text-sm">৳{req.amount}</h4>
                <p className="text-[9px] font-mono text-slate-400">{req.transactionId}</p>
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
