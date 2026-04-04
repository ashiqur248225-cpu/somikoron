
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  UserCheck, XCircle, Loader2, Eye, Phone, Building2, 
  MapPin, GraduationCap, Calendar, Clock, Filter, Trash2, UserCircle, Briefcase,
  AlertCircle, Calculator, Info, Utensils, Plus, Minus
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, doc, deleteDoc, updateDoc, setDoc, serverTimestamp, increment, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2023", "2024", "2025", "2026"];

export default function RegistrationsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  
  const [userRole, setUserRole] = useState("Manager")
  const [userBranch, setUserBranch] = useState("Main Branch")
  const [userName, setUserName] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    setAssignedBuildingId(localStorage.getItem("assigned_building_id") || "none")
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
    initialRentPayment: "0", 
    initialFoodPayment: "0", 
    paymentSystem: "package",
    receiver: "",
    method: "cash",
    billingStartDate: new Date().toISOString().split('T')[0],
    buildingId: "",
    roomNumber: "",
    seatNumber: ""
  })

  const [historicalDues, setHistoricalDues] = useState<{month: string, year: string, amount: string}[]>([])

  const addDueRow = () => {
    setHistoricalDues([...historicalDues, { month: MONTHS[new Date().getMonth()], year: new Date().getFullYear().toString(), amount: "" }])
  }

  const removeDueRow = (idx: number) => {
    setHistoricalDues(historicalDues.filter((_, i) => i !== idx))
  }

  const updateDueRow = (idx: number, field: string, value: string) => {
    const updated = [...historicalDues]
    ;(updated[idx] as any)[field] = value
    setHistoricalDues(updated)
  }

  useEffect(() => {
    if (selectedReg) {
      setApprovalForm(prev => ({
        ...prev,
        buildingId: selectedReg.buildingId || (userRole === 'Building Manager' ? assignedBuildingId : ""),
        roomNumber: selectedReg.roomNumber || "",
        seatNumber: selectedReg.seatNumber || "",
        paymentSystem: selectedReg.occupation === 'job_holder' ? 'non-package' : 'package',
      }))
      setHistoricalDues([])
    }
  }, [selectedReg, userRole, assignedBuildingId])

  const selectedBuilding = buildings?.find(b => b.id === approvalForm.buildingId)
  const roomsInBuilding = useMemo(() => {
    if (!selectedBuilding) return []
    return selectedBuilding.apartmentsDetail?.flatMap((apt: any) => 
      apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))
    ) || []
  }, [selectedBuilding])

  const selectedRoom = roomsInBuilding.find((r: any) => r.roomNo === approvalForm.roomNumber)
  const emptySeats = selectedRoom?.seats?.filter((s: any) => s.status === 'empty') || []

  const handleApprove = async () => {
    if (!approvalForm.monthlyRent || !approvalForm.buildingId || !approvalForm.roomNumber || !approvalForm.seatNumber) {
      toast({ variant: "destructive", title: "Error", description: "Rent and Location are required." })
      return
    }

    setIsProcessing(true)
    try {
      const studentId = doc(collection(db, "students")).id
      const bId = approvalForm.buildingId
      const rNum = approvalForm.roomNumber
      const sNum = approvalForm.seatNumber
      const aptName = selectedRoom?.aptName || "General"

      const isOld = selectedReg.type === 'old'
      const monthlyRent = Number(approvalForm.monthlyRent)
      const svcCharge = Number(approvalForm.serviceCharge)
      const advAmount = Number(approvalForm.advanceAmount)
      
      const duesBreakdown: Record<string, number> = {}
      let totalHistDue = 0
      historicalDues.forEach(d => {
        if (d.amount && Number(d.amount) > 0) {
          const key = `${d.month} ${d.year}`
          duesBreakdown[key] = (duesBreakdown[key] || 0) + Number(d.amount)
          totalHistDue += Number(d.amount)
        }
      })

      const histFoodDue = -Number(approvalForm.foodDueAmount || 0)
      const rentPaid = Number(approvalForm.initialRentPayment)
      const foodPaid = Number(approvalForm.initialFoodPayment)
      const totalNewReceived = rentPaid + advAmount + svcCharge + foodPaid

      if (!isOld && totalNewReceived > 0) {
        const pId = doc(collection(db, "payments")).id
        await setDoc(doc(db, "payments", pId), {
          id: pId,
          amount: totalNewReceived,
          seatAmount: rentPaid,
          advanceAmount: advAmount,
          serviceCharge: svcCharge,
          foodAmount: foodPaid,
          buildingId: bId,
          buildingName: selectedBuilding?.name || "Unknown",
          studentName: selectedReg.name,
          studentId: studentId,
          roomNumber: rNum,
          branch: userBranch,
          type: "income",
          month: new Date().toLocaleString('default', { month: 'long' }),
          year: new Date().getFullYear().toString(),
          method: approvalForm.method,
          receiver: approvalForm.receiver,
          description: "Initial registration payment",
          date: serverTimestamp(),
          createdAt: serverTimestamp()
        })
      }

      await setDoc(doc(db, "students", studentId), {
        id: studentId,
        name: selectedReg.name,
        occupation: selectedReg.occupation || "student",
        phone: selectedReg.phone,
        parentPhone: selectedReg.parentPhone,
        address: `${selectedReg.village}, ${selectedReg.postOffice}, ${selectedReg.upazila}, ${selectedReg.district}`,
        buildingId: bId,
        buildingName: selectedBuilding?.name || "Unknown",
        roomNumber: rNum,
        seatNumber: sNum,
        apartmentName: aptName,
        monthlyRent: monthlyRent,
        serviceCharge: svcCharge,
        advanceAmount: advAmount,
        dueAmount: isOld ? totalHistDue : (rentPaid >= monthlyRent ? 0 : monthlyRent),
        duesBreakdown: isOld ? duesBreakdown : {},
        foodDueAmount: isOld ? histFoodDue : 0,
        billingStartDate: approvalForm.billingStartDate,
        paymentSystem: approvalForm.paymentSystem,
        isActive: true,
        branch: userBranch,
        paymentsHistory: !isOld && totalNewReceived > 0 ? [{
          id: 'initial',
          amount: totalNewReceived,
          seatAmount: rentPaid,
          advanceAmount: advAmount,
          serviceCharge: svcCharge,
          foodAmount: foodPaid,
          method: approvalForm.method,
          description: "Initial payment at registration",
          date: new Date().toISOString(),
          month: new Date().toLocaleString('default', { month: 'long' }),
          year: new Date().getFullYear().toString()
        }] : [],
        mealsHistory: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      const updatedApts = selectedBuilding.apartmentsDetail.map((apt: any) => {
        if (apt.name === aptName) {
          return {
            ...apt,
            rooms: apt.rooms.map((room: any) => {
              if (room.roomNo === rNum) {
                return {
                  ...room,
                  seats: room.seats.map((seat: any) => seat.seatNo === sNum ? { ...seat, status: 'occupied' } : seat)
                }
              }
              return room
            })
          }
        }
        return apt
      })
      
      await updateDoc(doc(db, "buildings", bId), {
        apartmentsDetail: updatedApts,
        occupiedSeats: increment(1),
        emptySeats: increment(-1),
        updatedAt: serverTimestamp()
      })

      await deleteDoc(doc(db, "registrations", selectedReg.id))
      toast({ title: "Approved!", description: `${selectedReg.name} is now an active resident.` })
      setIsDetailOpen(false)
      setSelectedReg(null)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsProcessing(false)
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
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Admission Requests</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Review student applications for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
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
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* Table for Desktop */}
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Type & Occupation</TableHead>
                    <TableHead>Requested Info</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations?.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold">{reg.name}</span>
                          <span className="text-xs text-muted-foreground">{reg.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={reg.type === 'old' ? 'border-primary text-primary w-fit' : 'border-orange-500 text-orange-500 w-fit'}>
                            {reg.type === 'old' ? 'Existing' : 'New Admission'}
                          </Badge>
                          <span className="text-[10px] font-bold uppercase flex items-center gap-1 text-muted-foreground">
                            {reg.occupation === 'job_holder' ? <Briefcase size={10} /> : <GraduationCap size={10} />}
                            {reg.occupation?.replace('_', ' ') || 'Student'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {reg.buildingName} • Room {reg.roomNumber || 'Any'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedReg(reg); setIsDetailOpen(true); }}>
                          <Eye size={14} className="mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cards for Mobile */}
          <div className="md:hidden space-y-4">
            {registrations?.map((reg) => (
              <Card key={reg.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className={reg.type === 'old' ? 'bg-primary/5 text-primary border-primary/20' : 'bg-orange-50 text-orange-600 border-orange-200'}>
                      {reg.type === 'old' ? 'EXISTING RESIDENT' : 'NEW ADMISSION'}
                    </Badge>
                    <p className="text-[10px] font-bold text-slate-400">{new Date(reg.createdAt?.toDate?.() || reg.createdAt).toLocaleDateString()}</p>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <h3 className="font-black text-slate-800 text-lg leading-tight">{reg.name}</h3>
                      <div className="flex items-center gap-3">
                        <p className="text-xs font-medium text-slate-500 flex items-center gap-1"><Phone size={10} /> {reg.phone}</p>
                        <span className="text-xs text-slate-300">|</span>
                        <p className="text-xs font-bold text-primary capitalize">{reg.occupation?.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-secondary/30 p-3 rounded-xl border border-secondary text-xs flex justify-between items-center">
                    <span className="font-bold text-muted-foreground">Requested:</span>
                    <span className="font-black text-slate-700">{reg.buildingName} • Room {reg.roomNumber || 'Any'}</span>
                  </div>

                  <Button className="w-full h-10 rounded-xl font-bold gap-2" onClick={() => { setSelectedReg(reg); setIsDetailOpen(true); }}>
                    <Eye size={16} /> Process Application
                  </Button>
                </CardContent>
              </Card>
            ))}
            {registrations?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground italic">No pending applications found.</div>
            )}
          </div>
        </>
      )}

      {/* Process Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enrollment: {selectedReg?.name}</DialogTitle>
            <DialogDescription>Setup financials and allocate permanent room.</DialogDescription>
          </DialogHeader>
          {selectedReg && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Information Column */}
                <div className="space-y-4">
                  <div className="p-4 bg-secondary/20 rounded-xl border space-y-3">
                    <h3 className="font-bold flex items-center gap-2 text-primary"><Info size={16}/> Applicant Info</h3>
                    <div className="text-sm grid grid-cols-2 gap-y-2">
                      <span className="text-muted-foreground">Type:</span> 
                      <Badge variant="secondary" className="w-fit h-5 text-[10px] capitalize">{selectedReg.type} Resident</Badge>
                      <span className="text-muted-foreground">Phone:</span> <span>{selectedReg.phone}</span>
                      <span className="text-muted-foreground">Guardian:</span> <span>{selectedReg.parentPhone}</span>
                      <span className="text-muted-foreground">District:</span> <span>{selectedReg.district}</span>
                    </div>
                  </div>

                  <div className="p-4 border rounded-xl space-y-4">
                    <h3 className="font-bold flex items-center gap-2 text-primary"><Building2 size={16}/> Room Allocation</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Building</Label>
                        <Select value={approvalForm.buildingId} onValueChange={val => setApprovalForm({...approvalForm, buildingId: val, roomNumber: "", seatNumber: ""})}>
                          <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                          <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Room</Label>
                          <Select disabled={!approvalForm.buildingId} value={approvalForm.roomNumber} onValueChange={val => setApprovalForm({...approvalForm, roomNumber: val, seatNumber: ""})}>
                            <SelectTrigger><SelectValue placeholder="Room" /></SelectTrigger>
                            <SelectContent>{roomsInBuilding.map((r: any, idx: number) => <SelectItem key={`${selectedReg.id}-${r.aptName}-${r.roomNo}-${idx}`} value={r.roomNo}>R-{r.roomNo} ({r.aptName})</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Seat</Label>
                          <Select disabled={!approvalForm.roomNumber} value={approvalForm.seatNumber} onValueChange={val => setApprovalForm({...approvalForm, seatNumber: val})}>
                            <SelectTrigger><SelectValue placeholder="Seat" /></SelectTrigger>
                            <SelectContent>{emptySeats.map((s: any) => <SelectItem key={`${selectedReg.id}-${s.seatNo}`} value={s.seatNo}>Seat {s.seatNo}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Column */}
                <div className="space-y-4">
                  <div className="p-4 border-2 border-primary/20 rounded-xl space-y-4 bg-primary/5">
                    <h3 className="font-bold text-primary flex items-center gap-2"><Calculator size={18}/> Financial Setup</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Payment Plan</Label>
                        <Select value={approvalForm.paymentSystem} onValueChange={val => setApprovalForm({...approvalForm, paymentSystem: val})}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="package">Package</SelectItem><SelectItem value="non-package">Non-Package</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Monthly Rent (৳)</Label>
                        <Input type="number" className="h-9" value={approvalForm.monthlyRent} onChange={e => setApprovalForm({...approvalForm, monthlyRent: e.target.value})} placeholder="0.00" />
                      </div>
                    </div>

                    {selectedReg.type === 'old' ? (
                      <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20 space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-destructive flex items-center gap-1"><AlertCircle size={10}/> Historical Dues</Label>
                        <Button variant="outline" size="sm" className="h-6 text-[9px] w-full" onClick={addDueRow}>+ Add Dues Record</Button>
                        <div className="space-y-2 max-h-[100px] overflow-y-auto">
                          {historicalDues.map((due, idx) => (
                            <div key={idx} className="flex gap-1 items-center">
                              <Input type="number" className="h-7 text-[10px] flex-1" value={due.amount} onChange={e => updateDueRow(idx, "amount", e.target.value)} placeholder="Amount"/>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeDueRow(idx)}><Minus size={12}/></Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-success/5 rounded-lg border border-success/20 space-y-3">
                        <Label className="text-[10px] uppercase font-bold text-success">Initial Payment</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input type="number" className="h-8 text-xs" value={approvalForm.initialRentPayment} onChange={e => setApprovalForm({...approvalForm, initialRentPayment: e.target.value})} placeholder="Rent" />
                          <Input type="number" className="h-8 text-xs" value={approvalForm.advanceAmount} onChange={e => setApprovalForm({...approvalForm, advanceAmount: e.target.value})} placeholder="Advance" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="text-destructive border-destructive/20" onClick={() => { deleteDoc(doc(db, "registrations", selectedReg.id)); setUserName(null); setIsDetailOpen(false); }}>Reject</Button>
            <Button className="bg-success hover:bg-success/90" onClick={handleApprove} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin" /> : "Confirm Admission"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
