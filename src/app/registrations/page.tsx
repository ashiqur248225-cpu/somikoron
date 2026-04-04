
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  UserCheck, XCircle, Loader2, Eye, Phone, Building2, 
  MapPin, GraduationCap, Calendar, Clock, Filter, Trash2, UserCircle, Briefcase
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, doc, deleteDoc, updateDoc, setDoc, serverTimestamp, increment, where } from "firebase/firestore"
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

export default function RegistrationsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  
  const [userRole, setUserRole] = useState("Manager")
  const [userBranch, setUserBranch] = useState("Main Branch")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
  }, [])

  // CRITICAL: Filter pending requests by branch
  const regQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "registrations"), where("branch", "==", userBranch), orderBy("createdAt", "desc"))
  }, [db, userBranch])
  const { data: registrations, isLoading } = useCollection(regQuery)

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  // Approval Form State
  const [approvalForm, setApprovalForm] = useState({
    monthlyRent: "",
    serviceCharge: "0",
    advanceAmount: "0",
    initialPayment: "0",
    receiver: "",
    method: "cash",
    billingStartDate: new Date().toISOString().split('T')[0],
    buildingId: "",
    roomNumber: "",
    seatNumber: ""
  })

  const selectedBuilding = buildings?.find(b => b.id === (approvalForm.buildingId || selectedReg?.buildingId))
  const roomsInBuilding = useMemo(() => {
    if (!selectedBuilding) return []
    return selectedBuilding.apartmentsDetail?.flatMap((apt: any) => 
      apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))
    ) || []
  }, [selectedBuilding])

  const selectedRoom = roomsInBuilding.find((r: any) => r.roomNo === (approvalForm.roomNumber || selectedReg?.roomNumber))
  const emptySeats = selectedRoom?.seats?.filter((s: any) => s.status === 'empty') || []

  const handleApprove = async () => {
    if (!approvalForm.monthlyRent || !approvalForm.receiver) {
      toast({ variant: "destructive", title: "Error", description: "Rent and Receiver are required." })
      return
    }

    setIsProcessing(true)
    try {
      const studentId = doc(collection(db, "students")).id
      const bId = approvalForm.buildingId || selectedReg.buildingId
      const rNum = approvalForm.roomNumber || selectedReg.roomNumber
      const sNum = approvalForm.seatNumber || selectedReg.seatNumber
      const aptName = selectedRoom?.aptName || selectedReg.apartmentName

      const rentPaid = Number(approvalForm.initialPayment)
      const advPaid = Number(approvalForm.advanceAmount)
      const svcPaid = Number(approvalForm.serviceCharge)
      const totalInitial = rentPaid + advPaid + svcPaid

      // Create Payment Record
      if (totalInitial > 0) {
        const pId = doc(collection(db, "payments")).id
        await setDoc(doc(db, "payments", pId), {
          id: pId,
          amount: totalInitial,
          seatAmount: rentPaid,
          advanceAmount: advPaid,
          serviceCharge: svcPaid,
          buildingId: bId,
          buildingName: selectedBuilding?.name || "Unknown",
          studentName: selectedReg.name,
          studentId: studentId,
          roomNumber: rNum,
          branch: userBranch, // CRITICAL
          type: "income",
          month: new Date().toLocaleString('default', { month: 'long' }),
          year: new Date().getFullYear().toString(),
          method: approvalForm.method,
          receiver: approvalForm.receiver,
          description: `Initial payment at registration.`,
          date: serverTimestamp()
        })
      }

      // Create Student
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
        monthlyRent: Number(approvalForm.monthlyRent),
        serviceCharge: svcPaid,
        advanceAmount: advPaid,
        dueAmount: Number(approvalForm.monthlyRent) > rentPaid ? Number(approvalForm.monthlyRent) : 0,
        billingStartDate: approvalForm.billingStartDate,
        paymentSystem: selectedReg.group === 'Other' ? 'non-package' : 'package',
        isActive: true,
        branch: userBranch, // CRITICAL
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      // Update Building Seats
      const buildingRef = doc(db, "buildings", bId)
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
      await updateDoc(buildingRef, {
        apartmentsDetail: updatedApts,
        occupiedSeats: increment(1),
        emptySeats: increment(-1)
      })

      // Remove from pending
      await deleteDoc(doc(db, "registrations", selectedReg.id))

      toast({ title: "Approved!", description: "Resident is now active." })
      setIsDetailOpen(false)
      setSelectedReg(null)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Pending Registrations</h1>
          <p className="text-muted-foreground mt-1">Review student applications for <span className="font-bold text-foreground">{userBranch}</span>.</p>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : (
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
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setSelectedReg(reg)
                        setIsDetailOpen(true)
                        setApprovalForm({...approvalForm, buildingId: reg.buildingId || "", roomNumber: reg.roomNumber || "", seatNumber: reg.seatNumber || ""})
                      }}>
                        <Eye size={14} className="mr-1" /> Process
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {registrations?.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No pending requests for this branch.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registration Details: {selectedReg?.name}</DialogTitle>
            <DialogDescription>Review and finalize student enrollment.</DialogDescription>
          </DialogHeader>
          
          {selectedReg && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-secondary/20 rounded-xl border space-y-3">
                    <h3 className="font-bold flex items-center gap-2 text-primary">Student Info</h3>
                    <div className="text-sm grid grid-cols-2 gap-2">
                      <span className="text-muted-foreground">Occupation:</span> <span className="capitalize font-bold">{selectedReg.occupation?.replace('_', ' ')}</span>
                      <span className="text-muted-foreground">Phone:</span> <span>{selectedReg.phone}</span>
                      <span className="text-muted-foreground">Parent:</span> <span>{selectedReg.parentPhone}</span>
                      <span className="text-muted-foreground">{selectedReg.occupation === 'job_holder' ? 'Company:' : 'Institute:'}</span> <span>{selectedReg.institute}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 border-2 border-primary/20 rounded-xl space-y-4 bg-primary/5">
                    <h3 className="font-bold text-primary flex items-center gap-2"><UserCheck size={18}/> Approval Action</h3>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Building</Label>
                        <Select value={approvalForm.buildingId} onValueChange={val => setApprovalForm({...approvalForm, buildingId: val, roomNumber: "", seatNumber: ""})}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Branch" /></SelectTrigger>
                          <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Room</Label>
                        <Select disabled={!approvalForm.buildingId} value={approvalForm.roomNumber} onValueChange={val => setApprovalForm({...approvalForm, roomNumber: val, seatNumber: ""})}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Room" /></SelectTrigger>
                          <SelectContent>{roomsInBuilding.map((r: any) => <SelectItem key={r.roomNo} value={r.roomNo}>{r.roomNo}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Seat</Label>
                        <Select disabled={!approvalForm.roomNumber} value={approvalForm.seatNumber} onValueChange={val => setApprovalForm({...approvalForm, seatNumber: val})}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seat" /></SelectTrigger>
                          <SelectContent>{emptySeats.map((s: any) => <SelectItem key={s.seatNo} value={s.seatNo}>{s.seatNo}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Monthly Rent (৳)</Label>
                        <Input type="number" className="h-9" value={approvalForm.monthlyRent} onChange={e => setApprovalForm({...approvalForm, monthlyRent: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Initial Payment (৳)</Label>
                        <Input type="number" className="h-9" value={approvalForm.initialPayment} onChange={e => setApprovalForm({...approvalForm, initialPayment: e.target.value})} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Payment Receiver</Label>
                      <Select value={approvalForm.receiver} onValueChange={val => setApprovalForm({...approvalForm, receiver: val})}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Staff" /></SelectTrigger>
                        <SelectContent>{staffList?.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={handleApprove} disabled={isProcessing || !approvalForm.seatNumber} className="bg-success hover:bg-success/90 w-full">
              {isProcessing ? <Loader2 className="animate-spin" /> : "Approve Admission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
