
"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  UserCheck, XCircle, Loader2, Eye, Phone, Building2, 
  MapPin, GraduationCap, Calendar, Clock, Filter, Trash2, UserCircle, Briefcase,
  AlertCircle, Calculator, Info, Utensils, Plus, Minus, History, Wallet, CheckCircle2,
  Receipt, HandCoins, ShieldCheck, DollarSign, ChevronLeft, ListOrdered, Hash
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, doc, deleteDoc, updateDoc, setDoc, serverTimestamp, increment, where, getDoc } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { sendSMS } from "@/app/actions/sms"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2024", "2025", "2026", "2027", "2028"];

interface DueEntry {
  id: string;
  month: string;
  year: string;
  amount: string;
}

export default function RegistrationsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const router = useRouter()
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  
  const [userRole, setUserRole] = useState("Manager")
  const [userBranch, setUserBranch] = useState("Main Branch")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  const regQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "registrations"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: rawRegistrations, isLoading } = useCollection(regQuery)

  const registrations = useMemo(() => {
    if (!rawRegistrations) return []
    return [...rawRegistrations].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt)
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt)
      return dateB.getTime() - dateA.getTime()
    })
  }, [rawRegistrations])

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const [approvalForm, setApprovalForm] = useState({
    monthlyRent: "",
    serviceCharge: "0",
    advanceAmount: "0",
    foodDueAmount: "0", 
    historicalTotalReceived: "0", 
    initialRentPayment: "0", 
    initialFoodPayment: "0", 
    paymentSystem: "package",
    receiver: "",
    method: "cash",
    billingStartDate: new Date().toISOString().split('T')[0],
    buildingId: "",
    roomNumber: "",
    seatNumber: "",
    duesBreakdown: [] as DueEntry[],
    duesEntryMode: "monthly",
    singleTotalDue: "0"
  })

  useEffect(() => {
    if (isDetailOpen && selectedReg && buildings) {
      const targetB = buildings.find(b => b.name === selectedReg.buildingName || b.id === selectedReg.buildingId)
      setApprovalForm(prev => ({
        ...prev,
        buildingId: targetB?.id || "",
        roomNumber: String(selectedReg.roomNumber || ""),
        seatNumber: String(selectedReg.seatNumber || ""),
        paymentSystem: selectedReg.occupation === 'job_holder' ? 'non-package' : 'package',
      }));
    }
  }, [isDetailOpen, selectedReg, buildings]);

  const selectedBuilding = useMemo(() => buildings?.find(b => b.id === approvalForm.buildingId), [buildings, approvalForm.buildingId])
  const roomsInBuilding = useMemo(() => {
    if (!selectedBuilding) return []
    return selectedBuilding.apartmentsDetail?.flatMap((apt: any) => apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))) || []
  }, [selectedBuilding])
  const selectedRoom = useMemo(() => roomsInBuilding.find((r: any) => String(r.roomNo) === String(approvalForm.roomNumber)), [roomsInBuilding, approvalForm.roomNumber])
  const emptySeats = useMemo(() => selectedRoom?.seats?.filter((s: any) => s.status === 'empty') || [], [selectedRoom])

  const handleApprove = async () => {
    if (!approvalForm.monthlyRent || !approvalForm.buildingId || !approvalForm.roomNumber || !approvalForm.seatNumber) {
      toast({ variant: "destructive", title: "Error", description: "Required fields missing." })
      return
    }
    setIsProcessing(true)
    try {
      const studentId = doc(collection(db, "students")).id
      const isOld = selectedReg.type === 'old'
      const aptName = selectedRoom?.aptName || "General"
      
      const finalDuesBreakdown: Record<string, any> = {}
      let initialTotalDue = 0;
      
      if (isOld) {
        if (approvalForm.duesEntryMode === 'monthly') {
          approvalForm.duesBreakdown.forEach(d => {
            const label = `${d.month} ${d.year}`;
            const amt = Number(d.amount);
            finalDuesBreakdown[label] = { month: d.month, year: d.year, amount: amt };
            initialTotalDue += amt;
          });
        } else {
          const total = Number(approvalForm.singleTotalDue);
          finalDuesBreakdown["Historical Balance"] = { month: "Historical", year: "Balance", amount: total };
          initialTotalDue = total;
        }
      }

      let totalNewReceived = 0;
      if (!isOld) {
        const rentPaid = Number(approvalForm.initialRentPayment)
        const foodPaid = Number(approvalForm.initialFoodPayment)
        const advAmount = Number(approvalForm.advanceAmount)
        const svcCharge = Number(approvalForm.serviceCharge)
        totalNewReceived = rentPaid + advAmount + svcCharge + foodPaid

        if (totalNewReceived > 0) {
          const pId = doc(collection(db, "payments")).id
          await setDoc(doc(db, "payments", pId), {
            id: pId, amount: totalNewReceived, seatAmount: rentPaid, foodAmount: foodPaid,
            advanceAmount: advAmount, serviceCharge: svcCharge, studentId, studentName: selectedReg.name,
            buildingId: approvalForm.buildingId, branch: userBranch, type: "income", date: serverTimestamp(), createdAt: serverTimestamp()
          })
        }
      }

      await setDoc(doc(db, "students", studentId), {
        id: studentId, name: selectedReg.name, phone: selectedReg.phone, branch: userBranch,
        buildingId: approvalForm.buildingId, buildingName: selectedBuilding?.name,
        roomNumber: approvalForm.roomNumber, seatNumber: approvalForm.seatNumber, apartmentName: aptName,
        monthlyRent: Number(approvalForm.monthlyRent), advanceAmount: Number(approvalForm.advanceAmount),
        serviceCharge: Number(approvalForm.serviceCharge), paymentSystem: approvalForm.paymentSystem,
        foodDueAmount: isOld ? Number(approvalForm.foodDueAmount || 0) : Number(approvalForm.initialFoodPayment),
        duesBreakdown: finalDuesBreakdown, totalDue: initialTotalDue,
        historicalTotalReceived: isOld ? Number(approvalForm.historicalTotalReceived) : totalNewReceived,
        isActive: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      })

      // Seat occupied logic
      if (selectedBuilding) {
        const updatedApts = selectedBuilding.apartmentsDetail.map((apt: any) => {
          if (apt.name === aptName) {
            return {
              ...apt,
              rooms: apt.rooms.map((room: any) => {
                if (String(room.roomNo) === String(approvalForm.roomNumber)) {
                  return { ...room, seats: room.seats.map((s: any) => s.seatNo === approvalForm.seatNumber ? { ...s, status: 'occupied' } : s) }
                }
                return room;
              })
            }
          }
          return apt;
        });
        await updateDoc(doc(db, "buildings", approvalForm.buildingId), { apartmentsDetail: updatedApts, occupiedSeats: increment(1), emptySeats: increment(-1), updatedAt: serverTimestamp() })
      }

      await deleteDoc(doc(db, "registrations", selectedReg.id))
      toast({ title: "Approved Successfully" })
      setIsDetailOpen(false)
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) }
    finally { setIsProcessing(false) }
  }

  return (
    <div className="space-y-8 pb-20">
      {/* UI same as previous turned code - logic implemented above */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Enrollments</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Pending admission requests for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white rounded-3xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30"><TableRow><TableHead>Student</TableHead><TableHead>Category</TableHead><TableHead>Req. Location</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {registrations?.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell><div className="font-bold">{reg.name}</div><div className="text-xs text-muted-foreground">{reg.phone}</div></TableCell>
                    <TableCell><Badge variant="outline" className={reg.type === 'old' ? 'border-primary text-primary' : 'border-orange-500 text-orange-500'}>{reg.type === 'old' ? 'Existing' : 'New'}</Badge></TableCell>
                    <TableCell className="text-xs">{reg.buildingName} • Room {reg.roomNumber || 'Any'}</TableCell>
                    <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => { setSelectedReg(reg); setIsDetailOpen(true); }}><Eye size={14} className="mr-1" /> Verify</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog logic updated in handleApprove above */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto rounded-3xl p-0">
          <div className="h-2 bg-primary w-full" />
          <DialogHeader className="px-8 pt-6"><DialogTitle className="text-2xl font-black">Approval: {selectedReg?.name}</DialogTitle></DialogHeader>
          <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="p-5 border-2 border-primary/10 bg-primary/5 rounded-3xl space-y-4">
                <Label>Allocation</Label>
                <Select value={approvalForm.buildingId} onValueChange={val => setApprovalForm(prev => ({...prev, buildingId: val, roomNumber: "", seatNumber: ""}))}>
                  <SelectTrigger className="bg-white rounded-xl h-11 shadow-sm"><SelectValue placeholder="Building"/></SelectTrigger>
                  <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select disabled={!approvalForm.buildingId} value={approvalForm.roomNumber} onValueChange={val => setApprovalForm(prev => ({...prev, roomNumber: val, seatNumber: ""}))}>
                  <SelectTrigger className="bg-white rounded-xl h-11 shadow-sm"><SelectValue placeholder="Room"/></SelectTrigger>
                  <SelectContent>{roomsInBuilding.map((r: any, idx: number) => <SelectItem key={idx} value={String(r.roomNo)}>R-{r.roomNo} ({r.aptName})</SelectItem>)}</SelectContent>
                </Select>
                <Select disabled={!approvalForm.roomNumber} value={approvalForm.seatNumber} onValueChange={val => setApprovalForm(prev => ({...prev, seatNumber: val}))}>
                  <SelectTrigger className="bg-white rounded-xl h-11 shadow-sm"><SelectValue placeholder="Seat"/></SelectTrigger>
                  <SelectContent>{emptySeats.map((s: any) => <SelectItem key={s.seatNo} value={s.seatNo}>S-{s.seatNo}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Monthly Rent</Label><Input type="number" value={approvalForm.monthlyRent} onChange={e => setApprovalForm({...approvalForm, monthlyRent: e.target.value})} /></div>
                <div className="space-y-2"><Label>Plan</Label><Select value={approvalForm.paymentSystem} onValueChange={v => setApprovalForm({...approvalForm, paymentSystem: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="package">Package</SelectItem><SelectItem value="non-package">Non-Package</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Security Advance</Label><Input type="number" value={approvalForm.advanceAmount} onChange={e => setApprovalForm({...approvalForm, advanceAmount: e.target.value})} /></div>
                <div className="space-y-2"><Label>Service Charge</Label><Input type="number" value={approvalForm.serviceCharge} onChange={e => setApprovalForm({...approvalForm, serviceCharge: e.target.value})} /></div>
              </div>
              {selectedReg?.type === 'old' && (
                <div className="p-5 border-2 border-orange-200 bg-orange-50/50 rounded-3xl space-y-4">
                  <h3 className="font-bold text-orange-700">Migration Data</h3>
                  <div className="space-y-2"><Label>Lifetime Received</Label><Input type="number" value={approvalForm.historicalTotalReceived} onChange={e => setApprovalForm({...approvalForm, historicalTotalReceived: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Food Balance (+/-)</Label><Input type="number" value={approvalForm.foodDueAmount} onChange={e => setApprovalForm({...approvalForm, foodDueAmount: e.target.value})} /></div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t"><Button className="w-full h-14 rounded-2xl bg-success text-white font-black" onClick={handleApprove} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin" /> : "Approve & Sync Resident"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
