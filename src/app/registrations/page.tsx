
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
  AlertCircle, Calculator, Info, Utensils, Plus, Minus, History, Wallet, CheckCircle2,
  Receipt, HandCoins, ShieldCheck, DollarSign, ChevronLeft
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
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { sendSMS } from "@/app/actions/sms"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: apiConfig } = useDoc(apiConfigRef)

  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)

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
    duesBreakdown: "" 
  })

  const selectedBuilding = useMemo(() => buildings?.find(b => b.id === approvalForm.buildingId), [buildings, approvalForm.buildingId])
  
  const roomsInBuilding = useMemo(() => {
    if (!selectedBuilding) return []
    return selectedBuilding.apartmentsDetail?.flatMap((apt: any) => 
      apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))
    ) || []
  }, [selectedBuilding])

  const selectedRoom = useMemo(() => roomsInBuilding.find((r: any) => String(r.roomNo) === String(approvalForm.roomNumber)), [roomsInBuilding, approvalForm.roomNumber])
  const emptySeats = useMemo(() => selectedRoom?.seats?.filter((s: any) => s.status === 'empty') || [], [selectedRoom])

  // EFFECT: Auto-fill rent and initial payments when room is selected
  useEffect(() => {
    if (selectedRoom) {
      const rent = Number(selectedRoom.rentPerSeat || 0)
      setApprovalForm(prev => ({
        ...prev,
        monthlyRent: rent.toString(),
        initialRentPayment: rent.toString(),
        advanceAmount: rent.toString(),
        seatNumber: "" 
      }))
    }
  }, [selectedRoom])

  // EFFECT: Initialize form when detail dialog opens
  useEffect(() => {
    if (isDetailOpen && selectedReg && buildings) {
      const targetB = buildings.find(b => b.name === selectedReg.buildingName)
      setApprovalForm(prev => ({
        ...prev,
        buildingId: targetB?.id || "",
        roomNumber: String(selectedReg.roomNumber || ""),
        seatNumber: String(selectedReg.seatNumber || ""),
        paymentSystem: selectedReg.occupation === 'job_holder' ? 'non-package' : 'package',
        monthlyRent: "",
        initialRentPayment: "0",
        advanceAmount: "0",
        serviceCharge: "0"
      }))
    }
  }, [isDetailOpen, selectedReg, buildings])

  const handleApprove = async () => {
    if (!approvalForm.monthlyRent || !approvalForm.buildingId || !approvalForm.roomNumber || !approvalForm.seatNumber) {
      toast({ variant: "destructive", title: "Error", description: "Monthly Rent and Location are required." })
      return
    }

    setIsProcessing(true)
    try {
      const studentId = doc(collection(db, "students")).id
      const bId = approvalForm.buildingId
      const rNum = approvalForm.roomNumber
      const sNum = approvalForm.seatNumber
      const aptName = selectedRoom?.aptName || selectedReg.apartmentName || "General"

      const isOld = selectedReg.type === 'old'
      const monthlyRent = Number(approvalForm.monthlyRent)
      const svcCharge = Number(approvalForm.serviceCharge)
      const advAmount = Number(approvalForm.advanceAmount)
      
      let createdPaymentId = null;
      if (!isOld) {
        const rentPaid = Number(approvalForm.initialRentPayment)
        const foodPaid = Number(approvalForm.initialFoodPayment)
        const totalNewReceived = rentPaid + advAmount + svcCharge + foodPaid

        if (totalNewReceived > 0) {
          const pId = doc(collection(db, "payments")).id
          const pRecord = {
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
            month: MONTHS[new Date().getMonth()],
            year: new Date().getFullYear().toString(),
            method: approvalForm.method,
            receiver: approvalForm.receiver,
            description: "Admission initial payment",
            date: new Date().toISOString()
          }
          await setDoc(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp(), createdAt: serverTimestamp() })
          createdPaymentId = pId;
        }
      }

      await setDoc(doc(db, "students", studentId), {
        id: studentId,
        name: selectedReg.name,
        phone: selectedReg.phone,
        parentPhone: selectedReg.parentPhone || "",
        fatherName: selectedReg.fatherName || "",
        motherName: selectedReg.motherName || "",
        guardianPhone: selectedReg.guardianPhone || "",
        dob: selectedReg.dob || "",
        bloodGroup: selectedReg.bloodGroup || "",
        address: `${selectedReg.village}, ${selectedReg.postOffice}, ${selectedReg.upazila}, ${selectedReg.district}`,
        village: selectedReg.village || "",
        postOffice: selectedReg.postOffice || "",
        upazila: selectedReg.upazila || "",
        district: selectedReg.district || "",
        collegeUniversity: selectedReg.collegeUniversity || "",
        department: selectedReg.department || "",
        occupation: selectedReg.occupation || "student",
        buildingId: bId,
        buildingName: selectedBuilding?.name || "Unknown",
        roomNumber: rNum,
        seatNumber: sNum,
        apartmentName: aptName,
        monthlyRent: monthlyRent,
        serviceCharge: svcCharge,
        advanceAmount: advAmount,
        foodDueAmount: isOld ? -Number(approvalForm.foodDueAmount || 0) : 0, 
        billingStartDate: approvalForm.billingStartDate,
        paymentSystem: approvalForm.paymentSystem,
        isActive: true,
        branch: userBranch,
        paymentsHistory: [], 
        mealsHistory: [],
        historicalTotalReceived: isOld ? Number(approvalForm.historicalTotalReceived) : 0,
        historicalDuesNote: isOld ? approvalForm.duesBreakdown : "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      if (selectedBuilding) {
        const updatedApts = selectedBuilding.apartmentsDetail.map((apt: any) => {
          if (apt.name === aptName) {
            return {
              ...apt,
              rooms: apt.rooms.map((room: any) => {
                if (String(room.roomNo) === String(rNum)) {
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
      }

      // SMS Trigger
      if (apiConfig?.apikey && templatesData?.templates) {
        const admissionTemplate = templatesData.templates.find((t: any) => t.id === 'admission')
        if (admissionTemplate) {
          const hostelDisplayName = templatesData.hostelName || userBranch;
          let msg = admissionTemplate.text
            .replaceAll('[নাম]', selectedReg.name)
            .replaceAll('[Hostel Name]', hostelDisplayName)
            .replaceAll('[রুম]', rNum)
            .replaceAll('[সিট]', sNum);
          
          await sendSMS(apiConfig.apikey, apiConfig.senderid, selectedReg.phone, msg);
        }
      }

      await deleteDoc(doc(db, "registrations", selectedReg.id))
      toast({ title: "Approved Successfully" })
      
      if (createdPaymentId) {
        router.push(`/receipts/${createdPaymentId}`)
      } else {
        setIsDetailOpen(false)
        setSelectedReg(null)
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Enrollments</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Approving students for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white rounded-3xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Req. Location</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations?.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell><div className="flex flex-col"><span className="font-bold">{reg.name}</span><span className="text-xs text-muted-foreground">{reg.phone}</span></div></TableCell>
                    <TableCell><div className="flex flex-col gap-1"><Badge variant="outline" className={reg.type === 'old' ? 'border-primary text-primary w-fit' : 'border-orange-500 text-orange-500 w-fit'}>{reg.type === 'old' ? 'Existing' : 'New'}</Badge><span className="text-[10px] font-bold uppercase text-muted-foreground">{reg.occupation?.replace('_', ' ') || 'Student'}</span></div></TableCell>
                    <TableCell><div className="text-xs text-muted-foreground font-medium">{reg.buildingName} • Room {reg.roomNumber || 'Any'}</div></TableCell>
                    <TableCell className="text-right"><Button variant="outline" size="sm" className="rounded-xl font-bold" onClick={() => { setSelectedReg(reg); setIsDetailOpen(true); }}><Eye size={14} className="mr-1" /> Verify</Button></TableCell>
                  </TableRow>
                ))}
                {registrations.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">No admission requests.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl p-0">
          <div className="h-2 bg-primary w-full" />
          <DialogHeader className="px-8 pt-6">
            <DialogTitle className="text-2xl font-black">Approval Dashboard: {selectedReg?.name}</DialogTitle>
            <DialogDescription>Assign unit and configure financials.</DialogDescription>
          </DialogHeader>
          
          {selectedReg && (
            <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Profile Side */}
              <div className="lg:col-span-1 space-y-6">
                <div className="p-5 bg-secondary/30 rounded-3xl border-2 border-secondary space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><UserCircle size={14}/> Applicant Info</h3>
                  <div className="grid grid-cols-2 gap-y-3 text-xs">
                    <span className="text-muted-foreground">Type:</span> <Badge variant="secondary" className="w-fit h-5 text-[9px] capitalize">{selectedReg.type}</Badge>
                    <span className="text-muted-foreground">Mobile:</span> <span className="font-mono font-bold">{selectedReg.phone}</span>
                    <span className="text-muted-foreground">District:</span> <span className="font-bold">{selectedReg.district}</span>
                  </div>
                </div>

                <div className="p-5 border-2 border-primary/10 bg-primary/5 rounded-3xl space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Building2 size={14}/> Unit Allocation</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black ml-1">Building</Label>
                      <Select value={approvalForm.buildingId} onValueChange={val => setApprovalForm({...approvalForm, buildingId: val, roomNumber: "", seatNumber: ""})}>
                        <SelectTrigger className="bg-white rounded-xl h-11"><SelectValue/></SelectTrigger>
                        <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black ml-1">Room No.</Label>
                      <Select disabled={!approvalForm.buildingId} value={approvalForm.roomNumber} onValueChange={val => setApprovalForm({...approvalForm, roomNumber: val, seatNumber: ""})}>
                        <SelectTrigger className="bg-white rounded-xl h-11"><SelectValue placeholder="রুম সিলেক্ট করুন"/></SelectTrigger>
                        <SelectContent>{roomsInBuilding.map((r: any, idx: number) => <SelectItem key={idx} value={String(r.roomNo)}>R-{r.roomNo} ({r.aptName})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black ml-1">Seat No.</Label>
                      <Select disabled={!approvalForm.roomNumber} value={approvalForm.seatNumber} onValueChange={val => setApprovalForm({...approvalForm, seatNumber: val})}>
                        <SelectTrigger className="bg-white rounded-xl h-11"><SelectValue placeholder="সিট সিলেক্ট করুন"/></SelectTrigger>
                        <SelectContent>{emptySeats.map((s: any) => <SelectItem key={s.seatNo} value={s.seatNo}>Seat {s.seatNo}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Section */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="p-5 border-2 border-primary/20 bg-primary/5 rounded-3xl space-y-5">
                    <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Calculator size={14}/> Financial Parameters</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-black">Monthly Rent</Label>
                          <Input type="number" className="h-11 rounded-xl bg-white font-bold" value={approvalForm.monthlyRent} onChange={e => setApprovalForm({...approvalForm, monthlyRent: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-black">Plan</Label>
                          <Select value={approvalForm.paymentSystem} onValueChange={v => setApprovalForm({...approvalForm, paymentSystem: v})}>
                            <SelectTrigger className="bg-white h-11 rounded-xl"><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="package">Package</SelectItem><SelectItem value="non-package">Non-Package</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black">Billing Start Date</Label>
                        <Input type="date" className="h-11 rounded-xl bg-white" value={approvalForm.billingStartDate} onChange={e => setApprovalForm({...approvalForm, billingStartDate: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Service Charge</Label><Input type="number" className="h-11 rounded-xl bg-white" value={approvalForm.serviceCharge} onChange={e => setApprovalForm({...approvalForm, serviceCharge: e.target.value})} /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Advance</Label><Input type="number" className="h-11 rounded-xl bg-white" value={approvalForm.advanceAmount} onChange={e => setApprovalForm({...approvalForm, advanceAmount: e.target.value})} /></div>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 bg-slate-50 border rounded-3xl space-y-3">
                    <Label className="text-[10px] uppercase font-black ml-1">Admission Staff</Label>
                    <Select value={approvalForm.receiver} onValueChange={v => setApprovalForm({...approvalForm, receiver: v})}>
                      <SelectTrigger className="bg-white h-11 rounded-xl"><SelectValue placeholder="Select Staff"/></SelectTrigger>
                      <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-6">
                  {selectedReg.type === 'old' ? (
                    <div className="p-5 border-2 border-orange-200 bg-orange-50/50 rounded-3xl space-y-5">
                      <h3 className="text-[10px] font-black uppercase text-orange-600 tracking-widest flex items-center gap-2"><History size={14}/> Historical Data</h3>
                      <div className="space-y-4">
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Lifetime Collected</Label><Input type="number" className="h-11 rounded-xl bg-white" value={approvalForm.historicalTotalReceived} onChange={e => setApprovalForm({...approvalForm, historicalTotalReceived: e.target.value})} /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Food Balance</Label><Input type="number" className="h-11 rounded-xl bg-white" value={approvalForm.foodDueAmount} onChange={e => setApprovalForm({...approvalForm, foodDueAmount: e.target.value})} /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Dues Note</Label><Textarea className="bg-white rounded-xl h-20" placeholder="e.g. Feb Due: 2000" value={approvalForm.duesBreakdown} onChange={e => setApprovalForm({...approvalForm, duesBreakdown: e.target.value})} /></div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 border-2 border-success/20 bg-success/5 rounded-3xl space-y-5">
                      <h3 className="text-[10px] font-black uppercase text-success tracking-widest flex items-center gap-2"><Wallet size={14}/> Initial Payment</h3>
                      <div className="space-y-4">
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Rent Received</Label><Input type="number" className="h-11 rounded-xl bg-white" value={approvalForm.initialRentPayment} onChange={e => setApprovalForm({...approvalForm, initialRentPayment: e.target.value})} /></div>
                        {approvalForm.paymentSystem === 'non-package' && (
                          <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Food Deposit</Label><Input type="number" className="h-11 rounded-xl bg-white" value={approvalForm.initialFoodPayment} onChange={e => setApprovalForm({...approvalForm, initialFoodPayment: e.target.value})} /></div>
                        )}
                        <div className="space-y-1.5 pt-4">
                          <Label className="text-[10px] uppercase font-black">Method</Label>
                          <Select value={approvalForm.method} onValueChange={v => setApprovalForm({...approvalForm, method: v})}>
                            <SelectTrigger className="bg-white h-11 rounded-xl"><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="p-8 bg-slate-50 border-t flex flex-col md:flex-row gap-4">
            <Button variant="outline" className="flex-1 h-14 rounded-2xl border-destructive text-destructive font-black uppercase" onClick={() => { deleteDoc(doc(db, "registrations", selectedReg.id)); setIsDetailOpen(false); }}>Reject Request</Button>
            <Button className="flex-[2] h-14 rounded-2xl bg-success hover:bg-success/90 font-black text-lg shadow-xl shadow-success/20" onClick={handleApprove} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="mr-2" />} Approve & Admit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
