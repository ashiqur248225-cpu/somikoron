
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  UserCheck, XCircle, Loader2, Eye, Phone, Building2, 
  MapPin, GraduationCap, Calendar, Clock, Filter, Trash2, UserCircle, Briefcase,
  AlertCircle, Calculator, Info, Utensils, Plus, Minus, History, Wallet, CheckCircle2,
  Receipt, HandCoins, ShieldCheck, DollarSign, ChevronLeft, ListOrdered, Hash,
  User, ChevronRight, LayoutGrid, CircleDollarSign
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, doc, deleteDoc, updateDoc, setDoc, serverTimestamp, increment, where, getDoc, writeBatch } from "firebase/firestore"
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
import { ScrollArea } from "@/components/ui/scroll-area"
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
  
  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("")
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

  const staffQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "staff"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: staffList } = useCollection(staffQuery)

  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)
  
  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: apiConfig } = useDoc(apiConfigRef)

  const managementStaff = useMemo(() => {
    if (!staffList) return []
    return staffList.filter(s => s.staffType === 'management' || !s.staffType)
  }, [staffList])

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
        advanceAmount: prev.monthlyRent || "0" 
      }));
    }
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

  useEffect(() => {
    if (selectedRoom) {
      const rent = String(selectedRoom.rentPerSeat || 0)
      setApprovalForm(prev => ({ 
        ...prev, 
        monthlyRent: rent, 
        advanceAmount: rent,
        initialRentPayment: rent 
      }))
    }
  }, [selectedRoom])

  const handleMonthlyRentChange = (val: string) => {
    setApprovalForm(prev => ({
      ...prev,
      monthlyRent: val,
      advanceAmount: val,
      initialRentPayment: val
    }))
  }

  const addDueEntry = () => {
    const newEntry: DueEntry = {
      id: Math.random().toString(36).substr(2, 9),
      month: MONTHS[new Date().getMonth()],
      year: new Date().getFullYear().toString(),
      amount: approvalForm.monthlyRent
    }
    setApprovalForm(prev => ({ ...prev, duesBreakdown: [...prev.duesBreakdown, newEntry] }))
  }

  const removeDueEntry = (id: string) => {
    setApprovalForm(prev => ({ ...prev, duesBreakdown: prev.duesBreakdown.filter(d => d.id !== id) }))
  }

  const updateDueEntry = (id: string, field: keyof DueEntry, value: string) => {
    setApprovalForm(prev => ({
      ...prev,
      duesBreakdown: prev.duesBreakdown.map(d => d.id === id ? { ...d, [field]: value } : d)
    }))
  }

  const handleApprove = async () => {
    if (!approvalForm.monthlyRent || !approvalForm.buildingId || !approvalForm.roomNumber || !approvalForm.seatNumber) {
      toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "সিট বরাদ্দ এবং ভাড়ার তথ্য প্রদান করুন।" })
      return
    }
    setIsProcessing(true)
    try {
      const studentId = doc(collection(db, "students")).id
      const isOld = selectedReg.type === 'old'
      const aptName = selectedRoom?.aptName || "General"
      
      const now = new Date()
      const currentMonth = MONTHS[now.getMonth()]
      const currentYear = now.getFullYear().toString()
      const currentMonthLabel = `${currentMonth} ${currentYear}`

      const finalDuesBreakdown: Record<string, any> = {}
      let initialTotalDue = 0;
      
      if (isOld) {
        approvalForm.duesBreakdown.forEach(d => {
          const label = `${d.month} ${d.year}`;
          const amt = Number(d.amount);
          finalDuesBreakdown[label] = { month: d.month, year: d.year, amount: amt };
          initialTotalDue += amt;
        });
      } else {
        const rentPaid = Number(approvalForm.initialRentPayment || 0)
        const monthlyRent = Number(approvalForm.monthlyRent || 0)
        if (rentPaid < monthlyRent) {
          const dueAmt = monthlyRent - rentPaid;
          finalDuesBreakdown[currentMonthLabel] = { month: currentMonth, year: currentYear, amount: dueAmt };
          initialTotalDue = dueAmt;
        }
      }

      let totalNewReceived = 0;
      let initialPaymentRecord: any = null;

      if (!isOld) {
        const rentPaid = Number(approvalForm.initialRentPayment)
        const foodPaid = Number(approvalForm.initialFoodPayment)
        const advAmount = Number(approvalForm.advanceAmount)
        const svcCharge = Number(approvalForm.serviceCharge)
        totalNewReceived = rentPaid + advAmount + svcCharge + foodPaid

        if (totalNewReceived > 0) {
          const pId = doc(collection(db, "payments")).id
          initialPaymentRecord = {
            id: pId, amount: totalNewReceived, seatAmount: rentPaid, foodAmount: foodPaid,
            advanceAmount: advAmount, serviceCharge: svcCharge, studentId, studentName: selectedReg.name,
            buildingId: approvalForm.buildingId, buildingName: selectedBuilding?.name,
            roomNumber: approvalForm.roomNumber, branch: userBranch, type: "income", 
            method: approvalForm.method, receiver: approvalForm.receiver, month: currentMonth, year: currentYear,
            date: new Date().toISOString(), createdAt: new Date().toISOString()
          }
          await setDoc(doc(db, "payments", pId), { ...initialPaymentRecord, date: serverTimestamp(), createdAt: serverTimestamp() })

          const balanceRef = doc(db, "netBalance", userBranch);
          const methodKeyMap: Record<string, string> = {
            'cash': 'totalCash', 'bkash': 'totalBkash', 'nagad': 'totalNagad', 'bank': 'totalBank'
          };
          const methodKey = methodKeyMap[approvalForm.method] || 'totalCash';
          await setDoc(balanceRef, { branchId: userBranch, [methodKey]: increment(totalNewReceived), totalHandCash: increment(totalNewReceived), lastUpdated: serverTimestamp() }, { merge: true });
        }
      }

      const foodDueAmount = isOld ? Number(approvalForm.foodDueAmount || 0) : Number(approvalForm.initialFoodPayment);

      await setDoc(doc(db, "students", studentId), {
        id: studentId, name: selectedReg.name, phone: selectedReg.phone, branch: userBranch,
        buildingId: approvalForm.buildingId, buildingName: selectedBuilding?.name,
        roomNumber: approvalForm.roomNumber, seatNumber: approvalForm.seatNumber, apartmentName: aptName,
        monthlyRent: Number(approvalForm.monthlyRent), advanceAmount: Number(approvalForm.advanceAmount),
        serviceCharge: Number(approvalForm.serviceCharge), paymentSystem: approvalForm.paymentSystem,
        foodDueAmount, duesBreakdown: finalDuesBreakdown, totalDue: initialTotalDue,
        historicalTotalReceived: isOld ? Number(approvalForm.historicalTotalReceived) : totalNewReceived,
        isActive: true, billingStartDate: approvalForm.billingStartDate,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        fatherName: selectedReg.fatherName || "", motherName: selectedReg.motherName || "",
        dob: selectedReg.dob || "", bloodGroup: selectedReg.bloodGroup || "",
        address: selectedReg.village || "", occupation: selectedReg.occupation || "",
        school: selectedReg.school || "", schoolSession: selectedReg.schoolSession || "", schoolGroup: selectedReg.schoolGroup || "",
        college: selectedReg.college || "", collegeSession: selectedReg.collegeSession || "", collegeGroup: selectedReg.collegeGroup || "",
        university: selectedReg.university || "", universitySession: selectedReg.universitySession || "",
        department: selectedReg.department || "",
        parentPhone: selectedReg.parentPhone || "", guardianPhone: selectedReg.guardianPhone || "",
        paymentsHistory: initialPaymentRecord ? [initialPaymentRecord] : [],
        mealsHistory: []
      })

      if (selectedBuilding) {
        const updatedApts = selectedBuilding.apartmentsDetail.map((apt: any) => {
          if (apt.name === aptName) {
            return {
              ...apt,
              rooms: apt.rooms.map((room: any) => {
                if (String(room.roomNo) === String(approvalForm.roomNumber)) {
                  return { 
                    ...room, 
                    seats: room.seats.map((s: any) => s.seatNo === approvalForm.seatNumber ? { ...s, status: 'occupied' } : s) 
                  }
                }
                return room;
              })
            }
          }
          return apt;
        });
        const total = updatedApts.reduce((acc: number, apt: any) => acc + apt.rooms.reduce((rAcc: number, r: any) => rAcc + r.seats.length, 0), 0)
        const occupied = updatedApts.reduce((acc: number, apt: any) => acc + apt.rooms.reduce((rAcc: number, r: any) => rAcc + r.seats.filter((s: any) => s.status === 'occupied').length, 0), 0)
        await updateDoc(doc(db, "buildings", approvalForm.buildingId), { apartmentsDetail: updatedApts, occupiedSeats: occupied, emptySeats: total - occupied, updatedAt: serverTimestamp() })
      }

      if (apiConfig?.apikey) {
        const template = templatesData?.templates?.find((t: any) => t.id === 'admission')?.text || 
                         "প্রিয় [নাম], [Hostel Name]-এ আপনার admission সফল হয়েছে। রুম: [রুম], বিল্ডিং: [building]। আমাদের সাথে থাকার জন্য ধন্যবাদ।";
        
        const foodBalance = foodDueAmount > 0 ? foodDueAmount : 0;
        const foodDue = foodDueAmount < 0 ? Math.abs(foodDueAmount) : 0;
        const totalPayable = initialTotalDue + foodDue;

        const msg = template
          .replaceAll('[নাম]', selectedReg.name)
          .replaceAll('[মাস]', currentMonth)
          .replaceAll('[rent]', approvalForm.monthlyRent)
          .replaceAll('[total_payable]', totalPayable.toString())
          .replaceAll('[paid]', totalNewReceived.toString())
          .replaceAll('[food_balance]', foodBalance.toString())
          .replaceAll('[food_due]', foodDue.toString())
          .replaceAll('[রুম]', approvalForm.roomNumber)
          .replaceAll('[সিট]', approvalForm.seatNumber)
          .replaceAll('[building]', selectedBuilding?.name || '')
          .replaceAll('[Hostel Name]', templatesData?.hostelName || userBranch);

        const smsResult = await sendSMS(apiConfig.apikey, apiConfig.senderid, selectedReg.phone, msg);
        const logId = doc(collection(db, "smsLogs")).id;
        await setDoc(doc(db, "smsLogs", logId), { id: logId, to: selectedReg.phone, message: msg, branch: userBranch, sentBy: userName, status: smsResult.error === 0 ? 'Success' : 'Failed', createdAt: serverTimestamp() });
      }

      await deleteDoc(doc(db, "registrations", selectedReg.id))
      toast({ title: "ভর্তি সম্পন্ন হয়েছে!", description: `${selectedReg.name} এখন একজন সচল রেসিডেন্ট।` })
      setIsDetailOpen(false)
      setSelectedReg(null)
      router.refresh();
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) }
    finally { setIsProcessing(false) }
  }

  const handleReject = async () => {
    if (!selectedReg) return
    setIsProcessing(true)
    try {
      await deleteDoc(doc(db, "registrations", selectedReg.id))
      toast({ title: "বাতিল করা হয়েছে", description: "আবেদনটি লিস্ট থেকে সরিয়ে দেওয়া হয়েছে।" })
      setIsDetailOpen(false)
      setSelectedReg(null)
      router.refresh();
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
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Pending admission requests for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">{userName ? userName.substring(0, 2) : "U"}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
      ) : (
        <>
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-3xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Student Details</TableHead>
                    <TableHead>Request Type</TableHead>
                    <TableHead>Location Preference</TableHead>
                    <TableHead>Occupation</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations?.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{reg.name}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone size={10}/> {reg.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(reg.type === 'old' ? 'border-primary text-primary' : 'border-orange-500 text-orange-500')}>
                          {reg.type === 'old' ? 'Migration (Old)' : 'New Admission'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className="font-medium text-slate-600">{reg.buildingName}</span>
                          <span className="text-[10px] text-muted-foreground italic">Room: {reg.roomNumber || 'Any'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500">
                          {reg.occupation === 'student' ? <GraduationCap size={14}/> : <Briefcase size={14}/>}
                          {reg.occupation}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="gap-2 font-bold" onClick={() => { setSelectedReg(reg); setIsDetailOpen(true); }}>
                          <Eye size={14} /> Verify & Approve
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {registrations.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No pending requests found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="md:hidden space-y-4">
            {registrations?.map((reg) => (
              <Card key={reg.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white" onClick={() => { setSelectedReg(reg); setIsDetailOpen(true); }}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><UserCircle size={24}/></div>
                      <div>
                        <h3 className="font-black text-slate-800 leading-tight">{reg.name}</h3>
                        <p className="text-[10px] text-muted-foreground font-bold mt-0.5">{reg.phone}</p>
                      </div>
                    </div>
                    <Badge className={cn("text-[8px] font-black uppercase", reg.type === 'old' ? 'bg-primary' : 'bg-orange-500')}>
                      {reg.type === 'old' ? 'MIGRATION' : 'NEW'}
                    </Badge>
                  </div>
                  <div className="bg-secondary/30 p-3 rounded-xl border border-secondary flex justify-between items-center">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Target Location</p>
                      <p className="text-xs font-bold text-slate-700">{reg.buildingName} • R-{reg.roomNumber || '?'}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-primary"><ChevronRight size={20}/></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {registrations.length === 0 && (
              <div className="text-center py-12 text-muted-foreground italic">No pending requests.</div>
            )}
          </div>
        </>
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto rounded-3xl p-0">
          <div className="h-2 bg-primary w-full" />
          <DialogHeader className="px-8 pt-6">
            <div className="flex justify-between items-center w-full pr-8">
              <div>
                <DialogTitle className="text-2xl font-black flex items-center gap-2">
                  <ShieldCheck className="text-primary" /> Approval Verification
                </DialogTitle>
                <DialogDescription>Verify details and assign infrastructure for <b>{selectedReg?.name}</b>.</DialogDescription>
              </div>
              <Badge variant="outline" className={cn("text-[10px] font-bold h-6", selectedReg?.type === 'old' ? 'border-primary text-primary' : 'border-orange-500 text-orange-500')}>
                {selectedReg?.type === 'old' ? 'MIGRATION ACCOUNT' : 'NEW ADMISSION'}
              </Badge>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><User size={14}/> Section 1: Basic Info</h3>
                  <div className="p-5 border-2 border-slate-100 bg-slate-50 rounded-3xl space-y-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Full Name</Label>
                      <p className="font-black text-slate-800">{selectedReg?.name}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Education Summary</Label>
                      <div className="text-xs space-y-2 text-slate-600 font-medium">
                        {selectedReg?.occupation === 'student' ? (
                          <>
                            <div className="p-2 bg-white rounded-lg border border-slate-200">
                              <p className="font-bold">School: {selectedReg?.school}</p>
                              <p className="text-[10px] uppercase text-muted-foreground">Session: {selectedReg?.schoolSession} | Group: {selectedReg?.schoolGroup}</p>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-200">
                              <p className="font-bold">College: {selectedReg?.college}</p>
                              <p className="text-[10px] uppercase text-muted-foreground">Session: {selectedReg?.collegeSession} | Group: {selectedReg?.collegeGroup}</p>
                            </div>
                            {selectedReg?.university && (
                              <div className="p-2 bg-white rounded-lg border border-slate-200">
                                <p className="font-bold">University: {selectedReg?.university}</p>
                                <p className="text-[10px] uppercase text-muted-foreground">Session: {selectedReg?.universitySession} | Dept: {selectedReg?.department}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <p>Work: {selectedReg?.companyName} ({selectedReg?.designation || 'N/A'})</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Building2 size={14}/> Section 2: Seat Selection</h3>
                  <div className="p-5 border-2 border-primary/10 bg-primary/5 rounded-3xl space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Building</Label>
                      <Select value={approvalForm.buildingId} onValueChange={val => setApprovalForm({...approvalForm, buildingId: val, roomNumber: "", seatNumber: ""})}>
                        <SelectTrigger className="bg-white rounded-xl h-11"><SelectValue placeholder="Choose Building" /></SelectTrigger>
                        <SelectContent>
                          {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Room No.</Label>
                        <Select disabled={!approvalForm.buildingId} value={approvalForm.roomNumber} onValueChange={val => setApprovalForm({...approvalForm, roomNumber: val, seatNumber: ""})}>
                          <SelectTrigger className="bg-white rounded-xl h-11"><SelectValue placeholder="Room" /></SelectTrigger>
                          <SelectContent>
                            {roomsInBuilding.map((r: any, idx: number) => (
                              <SelectItem key={idx} value={String(r.roomNo)}>R-{r.roomNo} ({r.aptName})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Available Seat</Label>
                        <Select disabled={!approvalForm.roomNumber} value={approvalForm.seatNumber} onValueChange={val => setApprovalForm({...approvalForm, seatNumber: val})}>
                          <SelectTrigger className="bg-white rounded-xl h-11"><SelectValue placeholder="Seat" /></SelectTrigger>
                          <SelectContent>
                            {emptySeats.map((s: any) => (
                              <SelectItem key={s.seatNo} value={s.seatNo}>Seat {s.seatNo}</SelectItem>
                            ))}
                            {emptySeats.length === 0 && approvalForm.roomNumber && <SelectItem disabled value="full">No seats available</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-8">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><LayoutGrid size={14}/> Section 3: Rental Plan & Financials</h3>
                  <div className="p-6 border-2 border-slate-100 rounded-3xl bg-white grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-primary">Monthly Seat Rent (৳)</Label>
                      <Input type="number" value={approvalForm.monthlyRent} onChange={e => handleMonthlyRentChange(e.target.value)} className="h-11 font-black text-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Payment System</Label>
                      <Select value={approvalForm.paymentSystem} onValueChange={v => setApprovalForm({...approvalForm, paymentSystem: v})}>
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="package">Package (Included Food)</SelectItem>
                          <SelectItem value="non-package">Non-Package (Per Meal)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Security Advance (৳)</Label>
                      <Input type="number" value={approvalForm.advanceAmount} onChange={e => setApprovalForm({...approvalForm, advanceAmount: e.target.value})} className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Admission Service Charge (৳)</Label>
                      <Input type="number" value={approvalForm.serviceCharge} onChange={e => setApprovalForm({...approvalForm, serviceCharge: e.target.value})} className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Billing Start Date</Label>
                      <Input type="date" value={approvalForm.billingStartDate} onChange={e => setApprovalForm({...approvalForm, billingStartDate: e.target.value})} className="h-11" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <Calculator size={14}/> Section 4: {selectedReg?.type === 'old' ? 'Migration History' : 'Initial Collection'}
                  </h3>
                  
                  {selectedReg?.type === 'old' ? (
                    <div className="p-6 border-2 border-orange-200 bg-orange-50/50 rounded-3xl space-y-6 shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-orange-700">Lifetime Total Received (৳)</Label>
                          <Input type="number" value={approvalForm.historicalTotalReceived} onChange={e => setApprovalForm({...approvalForm, historicalTotalReceived: e.target.value})} placeholder="Total collected so far" className="bg-white" />
                        </div>
                        {approvalForm.paymentSystem === 'non-package' && (
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-orange-700">Net Food Balance (৳)</Label>
                            <Input type="number" value={approvalForm.foodDueAmount} onChange={e => setApprovalForm({...approvalForm, foodDueAmount: e.target.value})} placeholder="+ জমা / - বকেয়া" className="bg-white" />
                          </div>
                        )}
                      </div>

                      <Separator className="bg-orange-200" />

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-bold uppercase text-orange-800 flex items-center gap-2"><ListOrdered size={14}/> Historical Dues Breakdown</Label>
                          <Button variant="outline" size="sm" onClick={addDueEntry} className="h-8 gap-1 border-orange-300 text-orange-700 hover:bg-orange-100">
                            <Plus size={14}/> Add Month Box
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {approvalForm.duesBreakdown.map((due) => (
                            <div key={due.id} className="p-3 bg-white rounded-xl border border-orange-200 shadow-sm flex items-end gap-2 group animate-in zoom-in-95">
                              <div className="flex-1 space-y-1">
                                <Label className="text-[8px] uppercase">Month & Year</Label>
                                <div className="flex gap-1">
                                  <Select value={due.month} onValueChange={v => updateDueEntry(due.id, 'month', v)}>
                                    <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <Select value={due.year} onValueChange={v => updateDueEntry(due.id, 'year', v)}>
                                    <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="w-24 space-y-1">
                                <Label className="text-[8px] uppercase">Amount</Label>
                                <Input type="number" value={due.amount} onChange={e => updateDueEntry(due.id, 'amount', e.target.value)} className="h-8 text-[10px] font-bold" />
                              </div>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50" onClick={() => removeDueEntry(due.id)}>
                                <XCircle size={14}/>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 border-2 border-primary/10 bg-primary/5 rounded-3xl grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-primary">Initial Rent Payment (৳)</Label>
                        <Input type="number" value={approvalForm.initialRentPayment} onChange={e => setApprovalForm({...approvalForm, initialRentPayment: e.target.value})} className="bg-white h-11" placeholder="Current month rent if paid" />
                      </div>
                      {approvalForm.paymentSystem === 'non-package' && (
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-primary">Initial Food Deposit (৳)</Label>
                          <Input type="number" value={approvalForm.initialFoodPayment} onChange={e => setApprovalForm({...approvalForm, initialFoodPayment: e.target.value})} className="bg-white h-11" placeholder="Food opening balance" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {selectedReg?.type !== 'old' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><HandCoins size={14}/> Section 5: Collection Details</h3>
                      <div className="p-6 border-2 border-slate-100 rounded-3xl bg-white grid grid-cols-1 md:grid-cols-2 gap-6 shadow-sm">
                        <div className="space-y-2">
                          <Label className="text-xs">Received By (Staff)</Label>
                          <Select value={approvalForm.receiver} onValueChange={v => setApprovalForm({...approvalForm, receiver: v})}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Select Staff Member" /></SelectTrigger>
                            <SelectContent>
                              {managementStaff?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Payment Method</Label>
                          <Select value={approvalForm.method} onValueChange={v => setApprovalForm({...approvalForm, method: v})}>
                            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
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

                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><CircleDollarSign size={14}/> Section 6: Total Amount Summary</h3>
                      <div className="p-6 border-2 border-slate-100 rounded-3xl bg-white shadow-sm">
                        <div className="flex justify-between items-center">
                          <div className="space-y-1">
                            <span className="text-sm font-bold text-slate-600 uppercase">Grand Total Collection</span>
                            <p className="text-[10px] text-muted-foreground font-medium">Rent + Food + Advance + Service Charge</p>
                          </div>
                          <span className="text-3xl font-black text-primary">
                            ৳{(
                              Number(approvalForm.initialRentPayment || 0) + 
                              Number(approvalForm.initialFoodPayment || 0) + 
                              Number(approvalForm.advanceAmount || 0) + 
                              Number(approvalForm.serviceCharge || 0)
                            ).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-slate-50 border-t sticky bottom-0 z-20 flex flex-col md:flex-row gap-4">
            <Button variant="outline" className="h-14 flex-1 text-destructive border-destructive/20 hover:bg-red-50 font-bold text-lg rounded-2xl" onClick={handleReject} disabled={isProcessing}>
              Reject Request
            </Button>
            <Button className="h-14 flex-[2] bg-success hover:bg-success/90 text-white font-black text-xl rounded-2xl shadow-xl shadow-success/20 gap-2" onClick={handleApprove} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Confirm Approval & Sync Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
