
"use client"

import { useState, useEffect, useMemo } from "react"
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
import { ArrowLeftRight, Search, Plus, Loader2, ArrowRight, Wallet, History, ArrowUpRight, ArrowDownRight } from "lucide-react"
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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, query, where, limit } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

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
  
  const [userBranch, setUserBranch] = useState("Main Branch")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
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
    return query(collection(db, "transfers"), where("branch", "==", userBranch), limit(200))
  }, [db, userBranch])
  const { data: rawTransfers, isLoading } = useCollection(transfersQuery)

  const sortedTransfers = useMemo(() => {
    if (!rawTransfers) return []
    return [...rawTransfers].sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : (a.date ? new Date(a.date) : new Date(0))
      const dateB = b.date?.toDate ? b.date.toDate() : (b.date ? new Date(b.date) : new Date(0))
      return dateB.getTime() - dateA.getTime()
    })
  }, [rawTransfers])

  const handleCreate = async () => {
    if (!formData.amount || !formData.senderId || !formData.receiverId) {
      toast({ variant: "destructive", title: "Error", description: "Please fill all required fields." })
      return
    }

    if (formData.fromAccount === formData.toAccount) {
      toast({ variant: "destructive", title: "Invalid Transfer", description: "Source and destination accounts must be different." })
      return
    }

    setIsSubmitting(true)
    try {
      const sender = staff?.find(s => s.id === formData.senderId)
      const receiver = staff?.find(s => s.id === formData.receiverId)
      const transferRef = doc(collection(db, "transfers"))
      
      const transferData = {
        id: transferRef.id,
        branch: userBranch,
        amount: Number(formData.amount),
        fromAccount: formData.fromAccount,
        toAccount: formData.toAccount,
        senderId: formData.senderId,
        senderName: sender?.name || "Unknown",
        receiverId: formData.receiverId,
        receiverName: receiver?.name || "Unknown",
        description: formData.description || "",
        date: serverTimestamp(),
        createdAt: serverTimestamp()
      }

      await setDoc(transferRef, transferData)
      
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
    <div className="space-y-8 pb-20">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Fund Transfers</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Inter-account movement for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus size={18} /> <span className="hidden sm:inline">New Transfer</span></Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Record Fund Movement</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Amount (৳)</Label>
                  <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" className="text-lg font-bold" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Account</Label>
                    <Select value={formData.fromAccount} onValueChange={val => setFormData({...formData, fromAccount: val})}>
                      <SelectTrigger><SelectValue placeholder="From" /></SelectTrigger>
                      <SelectContent>{ACCOUNTS.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>To Account</Label>
                    <Select value={formData.toAccount} onValueChange={val => setFormData({...formData, toAccount: val})}>
                      <SelectTrigger><SelectValue placeholder="To" /></SelectTrigger>
                      <SelectContent>{ACCOUNTS.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Sender Staff</Label>
                  <Select value={formData.senderId} onValueChange={val => setFormData({...formData, senderId: val})}>
                    <SelectTrigger><SelectValue placeholder="Who is sending?" /></SelectTrigger>
                    <SelectContent>{staff?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Receiver Staff</Label>
                  <Select value={formData.receiverId} onValueChange={val => setFormData({...formData, receiverId: val})}>
                    <SelectTrigger><SelectValue placeholder="Who is receiving?" /></SelectTrigger>
                    <SelectContent>{staff?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Note / Purpose</Label>
                  <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Reason for transfer..." />
                </div>

                <Button onClick={handleCreate} disabled={isSubmitting} className="w-full h-12 font-bold text-lg">
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Confirm & Save Transfer"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">
                {userName ? userName.substring(0, 2) : "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
      ) : (
        <>
          {/* Table for Desktop */}
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Movement Route</TableHead>
                    <TableHead>Personnel</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransfers?.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs font-bold text-slate-500">
                        {t.date?.toDate ? t.date.toDate().toLocaleDateString() : 'Processing'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize bg-slate-50 font-bold">{t.fromAccount}</Badge>
                          <ArrowRight size={14} className="text-muted-foreground" />
                          <Badge variant="outline" className="capitalize bg-primary/5 text-primary border-primary/20 font-bold">{t.toAccount}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-600">
                        {t.senderName} <span className="text-slate-300 mx-1">&rarr;</span> {t.receiverName}
                      </TableCell>
                      <TableCell className="text-right font-black text-slate-800 text-lg">
                        ৳{t.amount?.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cards for Mobile */}
          <div className="md:hidden space-y-4">
            {sortedTransfers?.map((t) => (
              <Card key={t.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="bg-primary/10 p-2 rounded-lg text-primary"><ArrowLeftRight size={18} /></div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none">Internal Transfer</p>
                        <p className="text-xs font-bold text-slate-400 mt-1">
                          {t.date?.toDate ? t.date.toDate().toLocaleDateString() : 'Processing'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-primary leading-none">৳{t.amount?.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-secondary/30 p-3 rounded-xl border border-secondary">
                    <div className="text-center flex-1">
                      <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">From</p>
                      <Badge variant="secondary" className="capitalize text-[10px] font-bold">{t.fromAccount}</Badge>
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground mx-2" />
                    <div className="text-center flex-1">
                      <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">To</p>
                      <Badge className="capitalize text-[10px] bg-primary font-bold">{t.toAccount}</Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500 italic">
                    <History size={10} />
                    <span>{t.senderName} moved funds to {t.receiverName}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {sortedTransfers?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground italic">No transfers found.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
