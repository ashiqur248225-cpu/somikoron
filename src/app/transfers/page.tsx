
"use client"

import { useState } from "react"
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
import { collection, serverTimestamp, doc, setDoc, query, orderBy, limit } from "firebase/firestore"
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

  const transfersQuery = useMemoFirebase(() => query(collection(db, "transfers"), orderBy("date", "desc"), limit(100)), [db])
  const { data: transfers, isLoading } = useCollection(transfersQuery)

  const handleCreate = async () => {
    if (!formData.amount || !formData.senderId || !formData.receiverId) {
      toast({ variant: "destructive", title: "Error", description: "Please fill all required fields." })
      return
    }

    if (formData.fromAccount === formData.toAccount) {
      toast({ variant: "destructive", title: "Error", description: "Source and Destination accounts must be different." })
      return
    }

    setIsSubmitting(true)
    try {
      const sender = staff?.find(s => s.id === formData.senderId)
      const receiver = staff?.find(s => s.id === formData.receiverId)
      
      const transferId = doc(collection(db, "transfers")).id
      const transferData = {
        id: transferId,
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
      setFormData({
        amount: "", fromAccount: "cash", toAccount: "bank", senderId: "", receiverId: "", description: ""
      })
      setIsAddOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Internal Fund Transfers</h1>
            <p className="text-muted-foreground mt-1">Move money between accounts (Cash, Bank, Mobile Wallets).</p>
          </div>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="flex gap-2">
              <Plus size={18} /> New Transfer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Fund Transfer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Transfer Amount (৳)</Label>
                <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From (Source)</Label>
                  <Select value={formData.fromAccount} onValueChange={val => setFormData({...formData, fromAccount: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNTS.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To (Destination)</Label>
                  <Select value={formData.toAccount} onValueChange={val => setFormData({...formData, toAccount: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNTS.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Initiated By (Sender)</Label>
                <Select value={formData.senderId} onValueChange={val => setFormData({...formData, senderId: val})}>
                  <SelectTrigger><SelectValue placeholder="Select Staff" /></SelectTrigger>
                  <SelectContent>
                    {staff?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Handed Over To (Receiver)</Label>
                <Select value={formData.receiverId} onValueChange={val => setFormData({...formData, receiverId: val})}>
                  <SelectTrigger><SelectValue placeholder="Select Staff" /></SelectTrigger>
                  <SelectContent>
                    {staff?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Transfer details..." />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirm Transfer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Sender &rarr; Receiver</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">
                      {t.date?.toDate?.() ? t.date.toDate().toLocaleDateString() : 'Pending'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{t.fromAccount}</Badge>
                        <ArrowRight size={14} className="text-muted-foreground" />
                        <Badge className="capitalize">{t.toAccount}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{t.senderName}</span>
                        <span className="text-[10px] text-muted-foreground">to {t.receiverName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      ৳{t.amount?.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {transfers?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No transfer records found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
