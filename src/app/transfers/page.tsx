
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeftRight, Search, Plus, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, query, orderBy, limit, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

const ACCOUNTS = [
  { id: "cash", label: "Cash in Hand" },
  { id: "bank", label: "Bank Account" },
  { id: "bkash", label: "Bkash Wallet" },
  { id: "nagad", label: "Nagad Wallet" },
]

export default function TransfersPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // User Context
  const [userBranch, setUserBranch] = useState("Main Branch")
  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
  }, [])

  const [formData, setFormData] = useState({
    amount: "",
    fromAccount: "cash",
    toAccount: "bank",
    senderId: "",
    receiverId: "",
    description: ""
  })

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staff } = useCollection(staffQuery)

  const transfersQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "transfers"), where("branch", "==", userBranch), orderBy("date", "desc"), limit(100))
  }, [db, userBranch])
  const { data: transfers, isLoading } = useCollection(transfersQuery)

  const handleCreate = async () => {
    if (!formData.amount || !formData.senderId || !formData.receiverId) {
      toast({ variant: "destructive", title: "Error", description: "Please fill all required fields." })
      return
    }

    setIsSubmitting(true)
    try {
      const sender = staff?.find(s => s.id === formData.senderId)
      const receiver = staff?.find(s => s.id === formData.receiverId)
      const transferId = doc(collection(db, "transfers")).id
      
      const transferData = {
        id: transferId,
        branch: userBranch, // CRITICAL
        amount: Number(formData.amount),
        fromAccount: formData.fromAccount,
        toAccount: formData.toAccount,
        senderId: formData.senderId,
        senderName: sender?.name || "Unknown",
        receiverId: formData.receiverId,
        receiverName: receiver?.name || "Unknown",
        description: formData.description,
        date: serverTimestamp()
      }

      setDocumentNonBlocking(doc(db, "transfers", transferId), transferData, { merge: true })
      toast({ title: "Success", description: "Transfer recorded successfully." })
      setFormData({ amount: "", fromAccount: "cash", toAccount: "bank", senderId: "", receiverId: "", description: "" })
      setIsAddOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Fund Transfers</h1>
          <p className="text-muted-foreground mt-1">Inter-account movement for <span className="font-bold text-foreground">{userBranch}</span>.</p>
        </div>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogTrigger asChild><Button className="flex gap-2"><Plus size={18} /> New Transfer</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>Record Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="Amount (৳)" />
            <div className="grid grid-cols-2 gap-4">
              <Select value={formData.fromAccount} onValueChange={val => setFormData({...formData, fromAccount: val})}><SelectTrigger><SelectValue placeholder="From" /></SelectTrigger><SelectContent>{ACCOUNTS.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent></Select>
              <Select value={formData.toAccount} onValueChange={val => setFormData({...formData, toAccount: val})}><SelectTrigger><SelectValue placeholder="To" /></SelectTrigger><SelectContent>{ACCOUNTS.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <Select value={formData.senderId} onValueChange={val => setFormData({...formData, senderId: val})}><SelectTrigger><SelectValue placeholder="Sender Staff" /></SelectTrigger><SelectContent>{staff?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
            <Select value={formData.receiverId} onValueChange={val => setFormData({...formData, receiverId: val})}><SelectTrigger><SelectValue placeholder="Receiver Staff" /></SelectTrigger><SelectContent>{staff?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
            <Button onClick={handleCreate} disabled={isSubmitting} className="w-full">Confirm Transfer</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow><TableHead>Date</TableHead><TableHead>Route</TableHead><TableHead>Amount</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {transfers?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs">{t.date?.toDate?.() ? t.date.toDate().toLocaleDateString() : 'Pending'}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{t.fromAccount}</Badge> &rarr; <Badge variant="outline" className="capitalize">{t.toAccount}</Badge></TableCell>
                  <TableCell className="text-right font-bold text-primary">৳{t.amount?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
