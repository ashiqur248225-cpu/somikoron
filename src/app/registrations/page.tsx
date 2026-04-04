
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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2023", "2024", "2025", "2026"];

export default function RegistrationsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  
  const [userRole, setUserRole] = useState("Manager")
  const [userBranch, setUserBranch] = useState("Main Branch")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
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

  // Approval Form State
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

  // Monthly Dues State for Old Students
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

  // Sync initial state when a registration is selected
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
      
      // Calculate Financials
      const monthlyRent = Number(approvalForm.monthlyRent)
      const svcCharge = Number(approvalForm.serviceCharge)
      const advAmount = Number(approvalForm.advanceAmount)
      
      // Historical Dues Map
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

      // Create Payment Record only for NEW students
      if (!isOld && totalNewReceived > 0) {
        const pId = doc(collection(db, "payments")).id
        let details = []
        if (rentPaid > 0) details.push(`Rent: ৳${rentPaid}`)
        if (advAmount > 0) details.push(`Advance: ৳${advAmount}`)
        if (svcCharge > 0) details.push(`Service: ৳${svcCharge}`)
        if (foodPaid > 0) details.push(`Food: ৳${foodPaid}`)

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
          description: `Initial payment: ${details.join(', ')}`,
          date: serverTimestamp(),
          createdAt: serverTimestamp()
        })
      }

      // Create Student Document
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
        emptySeats: increment(-1),
        updatedAt: serverTimestamp()
      })

      // Remove from pending registrations
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

  const handleReject = async () => {
    if (!selectedReg) return
    setIsProcessing(true)
    try {
      await deleteDoc(doc(db, "registrations", selectedReg.id))
      toast({ title: "Rejected", description: "Application removed." })
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
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => {
                        setSelectedReg(reg)
                        setIsDetailOpen(true)
                      }}>
                        <Eye size={14} className="mr-1" /> Process
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {registrations?.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No pending applications for this branch.</TableCell></TableRow>
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
                    <h3 className="font-bold flex items-center gap-2 text-primary"><Info size={16}/> Applicant Info</h3>
                    <div className="text-sm grid grid-cols-2 gap-y-2">
                      <span className="text-muted-foreground">Type:</span> 
                      <Badge variant="secondary" className="w-fit h-5 text-[10px] capitalize">{selectedReg.type} Resident</Badge>
                      
                      <span className="text-muted-foreground">Phone:</span> <span>{selectedReg.phone}</span>
                      <span className="text-muted-foreground">Guardian:</span> <span>{selectedReg.parentPhone}</span>
                      <span className="text-muted-foreground">Occupation:</span> <span className="capitalize">{selectedReg.occupation?.replace('_', ' ')}</span>
                      <span className="text-muted-foreground">Address:</span> <span className="text-xs">{selectedReg.village}, {selectedReg.district}</span>
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
                            <SelectContent>{roomsInBuilding.map((r: any, idx: number) => <SelectItem key={`${selectedReg.id}-${r.aptName}-${r.roomNo}-${idx}`} value={r.roomNo}>Room {r.roomNo} ({r.aptName})</SelectItem>)}</SelectContent>
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

                <div className="space-y-4">
                  <div className="p-4 border-2 border-primary/20 rounded-xl space-y-4 bg-primary/5">
                    <h3 className="font-bold text-primary flex items-center gap-2"><Calculator size={18}/> Financial Setup</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Payment System</Label>
                        <Select value={approvalForm.paymentSystem} onValueChange={val => setApprovalForm({...approvalForm, paymentSystem: val})}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="package">Package</SelectItem>
                            <SelectItem value="non-package">Non-Package</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Monthly Rent (৳)</Label>
                        <Input type="number" className="h-9" value={approvalForm.monthlyRent} onChange={e => setApprovalForm({...approvalForm, monthlyRent: e.target.value})} placeholder="0.00" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-primary">Advance Taken (৳)</Label>
                        <Input type="number" className="h-9" value={approvalForm.advanceAmount} onChange={e => setApprovalForm({...approvalForm, advanceAmount: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-primary">Service Charge (৳)</Label>
                        <Input type="number" className="h-9" value={approvalForm.serviceCharge} onChange={e => setApprovalForm({...approvalForm, serviceCharge: e.target.value})} />
                      </div>
                    </div>

                    {selectedReg.type === 'old' ? (
                      <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20 space-y-3">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] uppercase font-bold text-destructive flex items-center gap-1"><AlertCircle size={10}/> Monthly Dues Breakdown (৳)</Label>
                          <Button variant="outline" size="sm" className="h-6 text-[9px] gap-1" onClick={addDueRow}><Plus size={10}/> Add Month</Button>
                        </div>
                        
                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                          {historicalDues.map((due, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <Select value={due.month} onValueChange={val => updateDueRow(idx, "month", val)}>
                                <SelectTrigger className="h-8 text-[10px] flex-1"><SelectValue/></SelectTrigger>
                                <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                              </Select>
                              <Select value={due.year} onValueChange={val => updateDueRow(idx, "year", val)}>
                                <SelectTrigger className="h-8 text-[10px] w-[70px]"><SelectValue/></SelectTrigger>
                                <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                              </Select>
                              <Input type="number" className="h-8 text-[10px] w-[80px]" value={due.amount} onChange={e => updateDueRow(idx, "amount", e.target.value)} placeholder="Amount"/>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeDueRow(idx)}><Minus size={12}/></Button>
                            </div>
                          ))}
                          {historicalDues.length === 0 && <p className="text-[9px] text-muted-foreground text-center py-2">No dues added yet.</p>}
                        </div>
                        
                        {approvalForm.paymentSystem === 'non-package' && (
                          <div className="space-y-1 pt-2">
                            <Label className="text-[10px] uppercase font-bold text-orange-600 flex items-center gap-1"><Utensils size={10}/> Historical Food Balance (৳)</Label>
                            <Input type="number" className="h-9 border-orange-200" value={approvalForm.foodDueAmount} onChange={e => setApprovalForm({...approvalForm, foodDueAmount: e.target.value})} placeholder="e.g. 3450 or -2450" />
                            <p className="text-[8px] text-muted-foreground italic">Positive = Credit (জমা), Negative = Owed (পাবে)</p>
                          </div>
                        )}
                        
                        <Separator className="my-2" />
                        <p className="text-[9px] text-muted-foreground mt-1.5 italic">* পুরাতন স্টুডেন্টের বকেয়া, এডভান্স এবং সার্ভিস চার্জ শুধু ডাটা হিসেবে থাকবে, ক্যাশ ব্যালেন্সে যোগ হবে না।</p>
                      </div>
                    ) : (
                      <div className="space-y-4 p-3 bg-success/5 rounded-lg border border-success/20">
                        <Label className="text-[10px] uppercase font-bold text-success">Initial Received Payments (৳)</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold">Rent Payment</Label>
                            <Input type="number" className="h-8 text-xs" value={approvalForm.initialRentPayment} onChange={e => setApprovalForm({...approvalForm, initialRentPayment: e.target.value})} />
                          </div>
                          {approvalForm.paymentSystem === 'non-package' && (
                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold">Food Payment</Label>
                              <Input type="number" className="h-8 text-xs" value={approvalForm.initialFoodPayment} onChange={e => setApprovalForm({...approvalForm, initialFoodPayment: e.target.value})} />
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold">Method</Label>
                            <Select value={approvalForm.method} onValueChange={val => setApprovalForm({...approvalForm, method: val})}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold">Receiver</Label>
                            <Select value={approvalForm.receiver} onValueChange={val => setApprovalForm({...approvalForm, receiver: val})}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Staff" /></SelectTrigger>
                              <SelectContent>{staffList?.map(s => <SelectItem key={`${selectedReg.id}-${s.name}`} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Billing Start Date</Label>
                      <Input type="date" className="h-9" value={approvalForm.billingStartDate} onChange={e => setApprovalForm({...approvalForm, billingStartDate: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleReject} disabled={isProcessing} className="text-destructive border-destructive/20 hover:bg-destructive/5">Reject Application</Button>
            <Button onClick={handleApprove} disabled={isProcessing || !approvalForm.seatNumber} className="bg-success hover:bg-success/90 min-w-[150px]">
              {isProcessing ? <Loader2 className="animate-spin" /> : <><UserCheck className="mr-2" size={18}/> Approve Admission</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
