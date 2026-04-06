
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
  Receipt, HandCoins
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { sendSMS } from "@/app/actions/sms"
import { ReceiptDialog } from "@/components/receipt-dialog"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function RegistrationsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  
  // Receipt Modal Logic
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [lastPayment, setLastPayment] = useState<any>(null)
  const [targetStudent, setTargetStudent] = useState<any>(null)

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

  const logSMSToDatabase = async (to: string, msg: string, status: 'Success' | 'Failed', errorMsg?: string) => {
    try {
      const logId = doc(collection(db, "smsLogs")).id
      await setDoc(doc(db, "smsLogs", logId), {
        id: logId,
        to,
        message: msg,
        status,
        error: errorMsg || null,
        branch: userBranch,
        sentBy: userName,
        createdAt: serverTimestamp()
      })
    } catch (e) {}
  }

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
    seatNumber: ""
  })

  useEffect(() => {
    if (isDetailOpen && selectedReg && buildings) {
      const targetB = buildings.find(b => b.name === selectedReg.buildingName)
      setApprovalForm(prev => ({
        ...prev,
        buildingId: targetB?.id || "",
        roomNumber: String(selectedReg.roomNumber || ""),
        seatNumber: String(selectedReg.seatNumber || ""),
        paymentSystem: selectedReg.occupation === 'job_holder' ? 'non-package' : 'package'
      }))
    }
  }, [isDetailOpen, selectedReg, buildings])

  const selectedBuilding = buildings?.find(b => b.id === approvalForm.buildingId)
  const roomsInBuilding = useMemo(() => {
    if (!selectedBuilding) return []
    return selectedBuilding.apartmentsDetail?.flatMap((apt: any) => 
      apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))
    ) || []
  }, [selectedBuilding])

  const selectedRoom = roomsInBuilding.find((r: any) => String(r.roomNo) === String(approvalForm.roomNumber))
  const emptySeats = selectedRoom?.seats?.filter((s: any) => s.status === 'empty') || []

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
      
      let finalPRecord = null;
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
            month: new Date().toLocaleString('default', { month: 'long' }),
            year: new Date().getFullYear().toString(),
            method: approvalForm.method,
            receiver: approvalForm.receiver,
            description: "Admission initial payment",
            date: serverTimestamp(),
            createdAt: serverTimestamp()
          }
          await setDoc(doc(db, "payments", pId), pRecord)
          finalPRecord = { ...pRecord, date: new Date() }
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
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

      // Dynamic Admission SMS
      if (apiConfig?.apikey && templatesData?.templates) {
        const admissionTemplate = templatesData.templates.find((t: any) => t.id === 'admission')
        if (admissionTemplate) {
          const hostelDisplayName = templatesData.hostelName || userBranch;
          let msg = admissionTemplate.text
            .replaceAll('[নাম]', selectedReg.name)
            .replaceAll('[Hostel Name]', hostelDisplayName)
            .replaceAll('[রুম]', rNum)
            .replaceAll('[সিট]', sNum)
            .replaceAll('[তারিখ]', approvalForm.billingStartDate);
          
          const result = await sendSMS(apiConfig.apikey, apiConfig.senderid, selectedReg.phone, msg);
          await logSMSToDatabase(selectedReg.phone, msg, result.error === 0 ? 'Success' : 'Failed', result.error !== 0 ? result.msg : undefined)
        }
      }

      await deleteDoc(doc(db, "registrations", selectedReg.id))
      toast({ title: "Approved Successfully" })
      
      if (finalPRecord) {
        setLastPayment(finalPRecord)
        setTargetStudent({ name: selectedReg.name, phone: selectedReg.phone, buildingName: selectedBuilding?.name, roomNumber: rNum, paymentSystem: approvalForm.paymentSystem, branch: userBranch })
        setIsReceiptOpen(true)
      }

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
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      <ReceiptDialog isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} payment={lastPayment} student={targetStudent} />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30"><TableRow><TableHead>Student</TableHead><TableHead>Type & Occupation</TableHead><TableHead>Requested Info</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {registrations?.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell><div className="flex flex-col"><span className="font-bold">{reg.name}</span><span className="text-xs text-muted-foreground">{reg.phone}</span></div></TableCell>
                    <TableCell><div className="flex flex-col gap-1"><Badge variant="outline" className={reg.type === 'old' ? 'border-primary text-primary w-fit' : 'border-orange-500 text-orange-500 w-fit'}>{reg.type === 'old' ? 'Existing' : 'New Admission'}</Badge><span className="text-[10px] font-bold uppercase text-muted-foreground">{reg.occupation?.replace('_', ' ') || 'Student'}</span></div></TableCell>
                    <TableCell><div className="text-xs text-muted-foreground">{reg.buildingName} • Room {reg.roomNumber || 'Any'}</div></TableCell>
                    <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => { setSelectedReg(reg); setIsDetailOpen(true); }}><Eye size={14} className="mr-1" /> Review</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Enrollment: {selectedReg?.name}</DialogTitle></DialogHeader>
          {selectedReg && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-secondary/20 rounded-xl border space-y-3">
                    <h3 className="font-bold flex items-center gap-2 text-primary uppercase text-[10px] tracking-widest"><Info size={14}/> Applicant Info</h3>
                    <div className="text-xs grid grid-cols-2 gap-y-2">
                      <span className="text-muted-foreground">Type:</span> <Badge variant="secondary" className="w-fit h-5 text-[9px] capitalize">{selectedReg.type} Resident</Badge>
                      <span className="text-muted-foreground">Occupation:</span> <span className="capitalize">{selectedReg.occupation?.replace('_', ' ')}</span>
                      <span className="text-muted-foreground">Phone:</span> <span>{selectedReg.phone}</span>
                    </div>
                  </div>
                  <div className="p-4 border rounded-xl space-y-4 bg-primary/5 border-primary/10">
                    <h3 className="font-bold flex items-center gap-2 text-primary uppercase text-[10px] tracking-widest"><Building2 size={14}/> Room Allocation</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Building</Label><Select value={approvalForm.buildingId} onValueChange={val => setApprovalForm({...approvalForm, buildingId: val})}><SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger><SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Room</Label><Input value={approvalForm.roomNumber} onChange={e => setApprovalForm({...approvalForm, roomNumber: e.target.value})} /></div>
                        <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Seat</Label><Input value={approvalForm.seatNumber} onChange={e => setApprovalForm({...approvalForm, seatNumber: e.target.value})} /></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 border-2 border-primary/20 rounded-xl space-y-4 bg-primary/5">
                    <h3 className="font-bold text-primary uppercase text-[10px] tracking-widest"><Calculator size={14}/> Financials</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Plan</Label><Select value={approvalForm.paymentSystem} onValueChange={v => setApprovalForm({...approvalForm, paymentSystem: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="package">Package</SelectItem><SelectItem value="non-package">Non-Package</SelectItem></SelectContent></Select></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Rent (৳)</Label><Input type="number" value={approvalForm.monthlyRent} onChange={e => setApprovalForm({...approvalForm, monthlyRent: e.target.value})} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Initial Rent</Label><Input type="number" value={approvalForm.initialRentPayment} onChange={e => setApprovalForm({...approvalForm, initialRentPayment: e.target.value})} /></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Advance</Label><Input type="number" value={approvalForm.advanceAmount} onChange={e => setApprovalForm({...approvalForm, advanceAmount: e.target.value})} /></div>
                    </div>
                    <div className="space-y-2"><Label>Initial Receiver</Label><Select value={approvalForm.receiver} onValueChange={val => setApprovalForm({...approvalForm, receiver: val})}><SelectTrigger><SelectValue placeholder="Staff" /></SelectTrigger><SelectContent>{staffList?.map(s => <SelectItem key={`${selectedReg.id}-${s.name}`} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="border-destructive text-destructive" onClick={() => { deleteDoc(doc(db, "registrations", selectedReg.id)); setIsDetailOpen(false); }}>Reject</Button>
            <Button className="bg-success hover:bg-success/90 h-12 font-bold" onClick={handleApprove} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin" /> : "Approve & Admit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
