
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

  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: apiConfig } = useDoc(apiConfigRef)

  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)

  // Approval Form State
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

  // Ref to prevent re-initialization of form while it's already open
  const prevIsDetailOpen = useRef(false);

  useEffect(() => {
    if (isDetailOpen && !prevIsDetailOpen.current && selectedReg && buildings) {
      const targetB = buildings.find(b => b.name === selectedReg.buildingName || b.id === selectedReg.buildingId)
      setApprovalForm({
        buildingId: targetB?.id || "",
        roomNumber: String(selectedReg.roomNumber || ""),
        seatNumber: String(selectedReg.seatNumber || ""),
        paymentSystem: selectedReg.occupation === 'job_holder' ? 'non-package' : 'package',
        monthlyRent: "",
        initialRentPayment: "0",
        initialFoodPayment: "0",
        advanceAmount: "0",
        serviceCharge: "0",
        historicalTotalReceived: "0",
        foodDueAmount: "0",
        duesBreakdown: [],
        duesEntryMode: "monthly",
        singleTotalDue: "0",
        billingStartDate: new Date().toISOString().split('T')[0],
        receiver: "",
        method: "cash"
      });
    }
    prevIsDetailOpen.current = isDetailOpen;
  }, [isDetailOpen, selectedReg, buildings]);

  const selectedBuilding = useMemo(() => buildings?.find(b => b.id === approvalForm.buildingId), [buildings, approvalForm.buildingId])
  
  const roomsInBuilding = useMemo(() => {
    if (!selectedBuilding) return []
    return selectedBuilding.apartmentsDetail?.flatMap((apt: any) => 
      apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))
    ) || []
  }, [selectedBuilding])

  const selectedRoom = useMemo(() => roomsInBuilding.find((r: any) => String(r.roomNo) === String(approvalForm.roomNumber)), [roomsInBuilding, approvalForm.roomNumber])
  const emptySeats = useMemo(() => selectedRoom?.seats?.filter((s: any) => s.status === 'empty') || [], [selectedRoom])

  // EFFECT: Auto-fill rent when room is selected
  useEffect(() => {
    if (selectedRoom) {
      const rent = Number(selectedRoom.rentPerSeat || 0)
      setApprovalForm(prev => ({
        ...prev,
        monthlyRent: rent.toString(),
        initialRentPayment: rent.toString(),
        advanceAmount: rent.toString(),
        seatNumber: prev.seatNumber // Keep current seat if any
      }))
    }
  }, [selectedRoom])

  const handleAddDueMonth = () => {
    const newEntry: DueEntry = {
      id: Math.random().toString(36).substr(2, 9),
      month: MONTHS[new Date().getMonth()],
      year: new Date().getFullYear().toString(),
      amount: ""
    };
    setApprovalForm(prev => ({
      ...prev,
      duesBreakdown: [...prev.duesBreakdown, newEntry]
    }));
  }

  const updateDueEntry = (id: string, field: keyof DueEntry, value: string) => {
    setApprovalForm(prev => ({
      ...prev,
      duesBreakdown: prev.duesBreakdown.map(entry => 
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    }));
  }

  const removeDueEntry = (id: string) => {
    setApprovalForm(prev => ({
      ...prev,
      duesBreakdown: prev.duesBreakdown.filter(entry => entry.id !== id)
    }));
  }

  const handleApprove = async () => {
    if (!approvalForm.monthlyRent || !approvalForm.buildingId || !approvalForm.roomNumber || !approvalForm.seatNumber) {
      toast({ variant: "destructive", title: "Error", description: "Monthly Rent and Location are required." })
      return
    }

    if (!selectedReg) return

    setIsProcessing(true)
    try {
      const studentId = doc(collection(db, "students")).id
      const bId = approvalForm.buildingId
      const rNum = approvalForm.roomNumber
      const sNum = approvalForm.seatNumber
      
      // Get APT name correctly from selected room
      const aptName = selectedRoom?.aptName || "General"

      const isOld = selectedReg.type === 'old'
      const monthlyRent = Number(approvalForm.monthlyRent)
      const svcCharge = Number(approvalForm.serviceCharge)
      const advAmount = Number(approvalForm.advanceAmount)
      
      let createdPaymentId = null;
      let totalNewReceived = 0;

      // Logic for NEW Student: Advance, Svc Charge, Rent -> Log to Income/Payments
      if (!isOld) {
        const rentPaid = Number(approvalForm.initialRentPayment)
        const foodPaid = Number(approvalForm.initialFoodPayment)
        totalNewReceived = rentPaid + advAmount + svcCharge + foodPaid

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

      // Handle Dues Breakdown based on mode
      const finalDuesBreakdown: Record<string, number> = {}
      let initialTotalDue = 0;
      
      if (isOld) {
        if (approvalForm.duesEntryMode === 'monthly') {
          approvalForm.duesBreakdown.forEach(d => {
            if (d.month && d.year && d.amount) {
              const label = `${d.month} ${d.year}`;
              const amt = Number(d.amount);
              finalDuesBreakdown[label] = (finalDuesBreakdown[label] || 0) + amt;
              initialTotalDue += amt;
            }
          });
        } else {
          const total = Number(approvalForm.singleTotalDue);
          finalDuesBreakdown["Historical Balance"] = total;
          initialTotalDue = total;
        }
        
        // Add food due if negative balance
        const foodDue = Number(approvalForm.foodDueAmount);
        if (foodDue < 0) {
          initialTotalDue += Math.abs(foodDue);
        }
      }

      // Save the Student Record
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
        foodDueAmount: isOld ? Number(approvalForm.foodDueAmount || 0) : 0, 
        billingStartDate: approvalForm.billingStartDate,
        paymentSystem: approvalForm.paymentSystem,
        isActive: true,
        branch: userBranch,
        paymentsHistory: [], 
        mealsHistory: [],
        historicalTotalReceived: isOld ? Number(approvalForm.historicalTotalReceived) : totalNewReceived,
        duesBreakdown: finalDuesBreakdown,
        totalDue: initialTotalDue,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Sync Seat Occupancy in Building - Robust Array Update
      if (selectedBuilding) {
        let occCount = 0;
        let totalCount = 0;

        const updatedApts = selectedBuilding.apartmentsDetail.map((apt: any) => {
          const newRooms = apt.rooms.map((room: any) => {
            const newSeats = room.seats.map((seat: any) => {
              totalCount++;
              // Check if this is the target seat
              if (apt.name === aptName && String(room.roomNo) === String(rNum) && String(seat.seatNo) === String(sNum)) {
                occCount++;
                return { ...seat, status: 'occupied' };
              }
              if (seat.status === 'occupied') occCount++;
              return seat;
            });
            return { ...room, seats: newSeats };
          });
          return { ...apt, rooms: newRooms };
        });
        
        await updateDoc(doc(db, "buildings", bId), {
          apartmentsDetail: updatedApts,
          occupiedSeats: occCount,
          emptySeats: totalCount - occCount,
          updatedAt: serverTimestamp()
        })
      }

      // SMS Notification
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
      toast({ title: "Approved Successfully", description: "Resident profile and allocation synced." })
      
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
      {/* App Bar */}
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
        <>
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-3xl">
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
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="md:hidden space-y-4">
            {registrations?.map((reg) => (
              <Card key={reg.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className={reg.type === 'old' ? 'border-primary text-primary' : 'border-orange-500 text-orange-500'}>
                      {reg.type === 'old' ? 'Existing Resident' : 'New Admission'}
                    </Badge>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(reg.createdAt?.toDate?.() || reg.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-slate-800 text-lg leading-tight">{reg.name}</h3>
                      <p className="text-xs font-bold text-slate-400 mt-0.5">{reg.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Target</p>
                      <p className="text-xs font-black text-primary">{reg.buildingName} • R-{reg.roomNumber || '?'}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full h-10 rounded-xl font-bold gap-2 text-xs" onClick={() => { setSelectedReg(reg); setIsDetailOpen(true); }}>
                    <Eye size={14} /> Review Request
                  </Button>
                </CardContent>
              </Card>
            ))}
            {registrations.length === 0 && (
              <div className="text-center py-20 text-muted-foreground italic">No admission requests.</div>
            )}
          </div>
        </>
      )}

      {/* APPROVAL DIALOG */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto rounded-3xl p-0">
          <div className="h-2 bg-primary w-full" />
          <DialogHeader className="px-8 pt-6">
            <DialogTitle className="text-2xl font-black">Approval Dashboard: {selectedReg?.name}</DialogTitle>
            <DialogDescription>Assign unit and configure financials for {selectedReg?.type === 'old' ? 'existing' : 'new'} resident.</DialogDescription>
          </DialogHeader>
          
          {selectedReg && (
            <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Profile & Location Side */}
              <div className="lg:col-span-1 space-y-6">
                <div className="p-5 bg-secondary/30 rounded-3xl border-2 border-secondary space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><UserCircle size={14}/> Applicant Info</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-bold">Name:</span> 
                      <span className="font-black text-slate-800">{selectedReg.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-bold">Phone:</span> 
                      <span className="font-black text-slate-800">{selectedReg.phone}</span>
                    </div>
                    <Separator className="bg-slate-200" />
                    <div className="grid grid-cols-2 gap-y-2 text-[10px] uppercase font-black text-muted-foreground">
                      <span>Type:</span> <Badge variant="secondary" className="w-fit h-4 text-[8px] bg-white border">{selectedReg.type}</Badge>
                      <span>Origin:</span> <span className="text-slate-700">{selectedReg.district}</span>
                    </div>
                    <div className="p-2 bg-white/50 rounded-xl border border-dashed text-[10px] space-y-1">
                      <p className="flex items-center gap-1"><GraduationCap size={10} className="text-primary"/> {selectedReg.collegeUniversity || 'No Institute'}</p>
                      <p className="flex items-center gap-1"><Briefcase size={10} className="text-primary"/> {selectedReg.department || 'General'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 border-2 border-primary/10 bg-primary/5 rounded-3xl space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Building2 size={14}/> Unit Allocation</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black ml-1">Building</Label>
                      <Select value={approvalForm.buildingId} onValueChange={val => setApprovalForm(prev => ({...prev, buildingId: val, roomNumber: "", seatNumber: ""}))}>
                        <SelectTrigger className="bg-white rounded-xl h-11 shadow-sm"><SelectValue placeholder="সিলেক্ট বিল্ডিং"/></SelectTrigger>
                        <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black ml-1">Room No.</Label>
                      <Select disabled={!approvalForm.buildingId} value={approvalForm.roomNumber} onValueChange={val => setApprovalForm(prev => ({...prev, roomNumber: val, seatNumber: ""}))}>
                        <SelectTrigger className="bg-white rounded-xl h-11 shadow-sm"><SelectValue placeholder="রুম সিলেক্ট করুন"/></SelectTrigger>
                        <SelectContent>{roomsInBuilding.map((r: any, idx: number) => <SelectItem key={idx} value={String(r.roomNo)}>R-{r.roomNo} ({r.aptName})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black ml-1">Seat No.</Label>
                      <Select disabled={!approvalForm.roomNumber} value={approvalForm.seatNumber} onValueChange={val => setApprovalForm(prev => ({...prev, seatNumber: val}))}>
                        <SelectTrigger className="bg-white rounded-xl h-11 shadow-sm"><SelectValue placeholder="সিট সিলেক্ট করুন"/></SelectTrigger>
                        <SelectContent>{emptySeats.map((s: any) => <SelectItem key={s.seatNo} value={s.seatNo}>Seat {s.seatNo}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Section */}
              <div className="lg:col-span-2 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="p-5 border-2 border-primary/20 bg-primary/5 rounded-3xl space-y-5 shadow-sm">
                      <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Calculator size={14}/> Financial Parameters</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black">Monthly Rent</Label>
                            <Input type="number" className="h-11 rounded-xl bg-white font-black text-slate-800" value={approvalForm.monthlyRent} onChange={e => setApprovalForm(prev => ({...prev, monthlyRent: e.target.value}))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black">Plan</Label>
                            <Select value={approvalForm.paymentSystem} onValueChange={v => setApprovalForm(prev => ({...prev, paymentSystem: v}))}>
                              <SelectTrigger className="bg-white h-11 rounded-xl"><SelectValue/></SelectTrigger>
                              <SelectContent><SelectItem value="package">Package</SelectItem><SelectItem value="non-package">Non-Package</SelectItem></SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-black">Billing Start Date</Label>
                          <Input type="date" className="h-11 rounded-xl bg-white" value={approvalForm.billingStartDate} onChange={e => setApprovalForm(prev => ({...prev, billingStartDate: e.target.value}))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Service Charge</Label><Input type="number" className="h-11 rounded-xl bg-white" value={approvalForm.serviceCharge} onChange={e => setApprovalForm(prev => ({...prev, serviceCharge: e.target.value}))} /></div>
                          <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Security Advance</Label><Input type="number" className="h-11 rounded-xl bg-white" value={approvalForm.advanceAmount} onChange={e => setApprovalForm(prev => ({...prev, advanceAmount: e.target.value}))} /></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-5 bg-slate-50 border rounded-3xl space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">Admission Receiver (Staff)</Label>
                        <Select value={approvalForm.receiver} onValueChange={v => setApprovalForm(prev => ({...prev, receiver: v}))}>
                          <SelectTrigger className="bg-white h-11 rounded-xl shadow-sm"><SelectValue placeholder="Select Staff"/></SelectTrigger>
                          <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">Payment Method</Label>
                        <Select value={approvalForm.method} onValueChange={v => setApprovalForm(prev => ({...prev, method: v}))}>
                          <SelectTrigger className="bg-white h-11 rounded-xl shadow-sm"><SelectValue/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="bkash">Bkash</SelectItem>
                            <SelectItem value="nagad">Nagad</SelectItem>
                            <SelectItem value="bank">Bank</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Historical vs Initial Pay */}
                  <div className="space-y-6">
                    {selectedReg.type === 'old' ? (
                      <div className="p-5 border-2 border-orange-200 bg-orange-50/50 rounded-3xl space-y-5 shadow-sm">
                        <h3 className="text-[10px] font-black uppercase text-orange-600 tracking-widest flex items-center gap-2"><History size={14}/> Migration Data (Historical)</h3>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black flex justify-between">
                              Lifetime Total Received <Info size={10} className="text-orange-400" />
                            </Label>
                            <Input type="number" className="h-11 rounded-xl bg-white font-black" value={approvalForm.historicalTotalReceived} onChange={e => setApprovalForm(prev => ({...prev, historicalTotalReceived: e.target.value}))} />
                            <p className="text-[8px] text-muted-foreground italic">* মোট যত টাকা আজ পর্যন্ত কালেক্ট করেছেন (ভাড়া/খাবার সহ)</p>
                          </div>

                          {approvalForm.paymentSystem === 'non-package' && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                              <Label className="text-[10px] uppercase font-black">Food Balance (+/-)</Label>
                              <Input type="number" className="h-11 rounded-xl bg-white" value={approvalForm.foodDueAmount} onChange={e => setApprovalForm(prev => ({...prev, foodDueAmount: e.target.value}))} placeholder="0.00" />
                            </div>
                          )}
                          
                          <Separator className="bg-orange-200" />
                          
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <Label className="text-[10px] uppercase font-black">Resident Dues Entry</Label>
                              <Badge variant="outline" className="bg-white text-[8px]">MIGRATION MODE</Badge>
                            </div>

                            <Tabs value={approvalForm.duesEntryMode} onValueChange={v => setApprovalForm(prev => ({...prev, duesEntryMode: v}))} className="w-full">
                              <TabsList className="grid w-full grid-cols-2 h-8 bg-orange-100/50 p-1">
                                <TabsTrigger value="monthly" className="text-[9px] font-bold h-6 uppercase">Monthly Boxes</TabsTrigger>
                                <TabsTrigger value="total" className="text-[9px] font-bold h-6 uppercase">Single Total</TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="monthly" className="space-y-3 mt-3">
                                <Button type="button" onClick={handleAddDueMonth} size="sm" variant="outline" className="w-full h-9 gap-2 border-orange-300 text-orange-700 bg-white">
                                  <Plus size={14}/> Add Month Box
                                </Button>
                                
                                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                                  {approvalForm.duesBreakdown.map((entry) => (
                                    <div key={entry.id} className="flex gap-1.5 items-center p-2 bg-white rounded-xl border border-orange-100 shadow-sm animate-in slide-in-from-top-1 duration-200">
                                      <Select value={entry.month} onValueChange={v => updateDueEntry(entry.id, 'month', v)}>
                                        <SelectTrigger className="h-9 text-[10px] bg-white border-orange-200 flex-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                      </Select>
                                      <Select value={entry.year} onValueChange={v => updateDueEntry(entry.id, 'year', v)}>
                                        <SelectTrigger className="h-9 text-[10px] bg-white border-orange-200 w-16"><SelectValue /></SelectTrigger>
                                        <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                                      </Select>
                                      <Input 
                                        type="number" 
                                        placeholder="Amt" 
                                        className="h-9 w-16 text-xs bg-white border-orange-200" 
                                        value={entry.amount} 
                                        onChange={e => updateDueEntry(entry.id, 'amount', e.target.value)} 
                                      />
                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeDueEntry(entry.id)}>
                                        <Trash2 size={14} />
                                      </Button>
                                    </div>
                                  ))}
                                  {approvalForm.duesBreakdown.length === 0 && (
                                    <p className="text-[10px] italic text-muted-foreground text-center py-4 bg-white/50 rounded-xl border border-dashed border-orange-200">
                                      বকেয়া থাকলে "Add Month Box" বাটনে ক্লিক করুন।
                                    </p>
                                  )}
                                </div>
                              </TabsContent>

                              <TabsContent value="total" className="mt-3">
                                <div className="space-y-1.5">
                                  <Label className="text-[9px] uppercase font-black text-orange-700">Total Oustanding Balance (৳)</Label>
                                  <div className="relative">
                                    <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-orange-400" />
                                    <Input type="number" className="h-10 rounded-xl pl-9 bg-white border-orange-200 font-black text-destructive" value={approvalForm.singleTotalDue} onChange={e => setApprovalForm(prev => ({...prev, singleTotalDue: e.target.value}))} />
                                  </div>
                                  <p className="text-[8px] text-muted-foreground italic leading-tight">এটি পুরাতন সকল বকেয়া (ভাড়া + খাবার) এর এককালীন টোটাল অ্যামাউন্ট।</p>
                                </div>
                              </TabsContent>
                            </Tabs>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 border-2 border-success/20 bg-success/5 rounded-3xl space-y-5 shadow-sm">
                        <h3 className="text-[10px] font-black uppercase text-success tracking-widest flex items-center gap-2"><Wallet size={14}/> Admission Collection</h3>
                        <div className="space-y-4">
                          <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Initial Rent (Current Month)</Label><Input type="number" className="h-11 rounded-xl bg-white font-black text-slate-800 shadow-inner" value={approvalForm.initialRentPayment} onChange={e => setApprovalForm(prev => ({...prev, initialRentPayment: e.target.value}))} /></div>
                          {approvalForm.paymentSystem === 'non-package' && (
                            <div className="space-y-1.5 animate-in fade-in"><Label className="text-[10px] uppercase font-black">Initial Food Deposit</Label><Input type="number" className="h-11 rounded-xl bg-white font-black text-slate-800 shadow-inner" value={approvalForm.initialFoodPayment} onChange={e => setApprovalForm(prev => ({...prev, initialFoodPayment: e.target.value}))} /></div>
                          )}
                          <div className="mt-4 p-5 bg-white/80 rounded-2xl border-2 border-dashed border-success/20">
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Immediate Income Log:</p>
                            <p className="text-3xl font-black text-success mt-1">৳{(Number(approvalForm.initialRentPayment) + Number(approvalForm.initialFoodPayment) + Number(approvalForm.advanceAmount) + Number(approvalForm.serviceCharge)).toLocaleString()}</p>
                            <p className="text-[8px] text-slate-400 mt-2 italic">* এটি সরাসরি আপনার ইনকাম ও ক্যাশ ব্যালেন্সে যোগ হবে।</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="p-8 bg-slate-100 border-t flex flex-col md:flex-row gap-4">
            <Button variant="outline" className="flex-1 h-14 rounded-2xl border-destructive text-destructive font-black uppercase hover:bg-destructive/5" onClick={() => { selectedReg && deleteDoc(doc(db, "registrations", selectedReg.id)); setIsDetailOpen(false); }}>Reject Enrollment</Button>
            <Button className="flex-[2] h-14 rounded-2xl bg-success hover:bg-success/90 font-black text-lg shadow-xl shadow-success/20" onClick={handleApprove} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="mr-2" />} Approve & Sync Resident</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
