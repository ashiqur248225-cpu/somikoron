
"use client"

import * as React from "react"
import { useState, useMemo, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, serverTimestamp, updateDoc, setDoc, arrayUnion, increment, collection, query, where, getDoc, writeBatch } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  UserCircle, Phone, Building2, 
  Loader2, Calculator,
  Plus, UserMinus, Wallet,
  AlertCircle, History, Edit,
  Calendar, ChevronLeft,
  Info, ShieldCheck, HandCoins,
  MapPin, GraduationCap,
  LayoutGrid, CheckCircle2, 
  MoreVertical, Utensils, Clock,
  Smartphone, User, Zap, CircleDollarSign, Home, Trash2, Scale, Receipt, Printer, Send, FileText,
  X,
  Briefcase,
  ChevronRight,
  UserCheck
} from "lucide-react"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { sendSMS } from "@/app/actions/sms"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2024", "2025", "2026", "2027", "2028"];
const GROUPS = ["Science", "B.Studies", "Humanities"]

interface DueEntry {
  id: string;
  month: string;
  year: string;
  amount: string;
}

export default function StudentDetailsPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  
  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")
  const [settlementInput, setSettlementInput] = useState("")
  const [exitMethod, setExitMethod] = useState("cash")
  const [exitStaff, setExitStaff] = useState("")

  useEffect(() => {
    const role = localStorage.getItem("user_role") || "Manager"
    const name = localStorage.getItem("user_name") || "User"
    setUserRole(role)
    setUserName(name)
    setExitStaff(name)
  }, [])

  const studentRef = useMemoFirebase(() => id ? doc(db, "students", id) : null, [db, id])
  const { data: student, isLoading: studentLoading } = useDoc(studentRef)

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings, isLoading: buildingsLoading } = useCollection(buildingsQuery)

  const staffListQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffListQuery)

  const managementStaff = useMemo(() => {
    if (!staffList) return []
    const userBranch = student?.branch || localStorage.getItem("user_branch") || "";
    return staffList.filter(s => {
      if (s.role === 'Admin') return true;
      return s.branch === userBranch && (s.staffType === 'management' || !s.staffType);
    })
  }, [staffList, student?.branch])

  const [paymentData, setPaymentData] = useState({
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    amount: "",
    seatAmount: "",
    foodAmount: "",
    addAdvanceAmount: "0",
    method: "cash",
    receiver: "",
    description: ""
  })

  useEffect(() => {
    if (isPaymentDialogOpen && userName) {
      setPaymentData(prev => ({ ...prev, receiver: userName }))
    }
  }, [isPaymentDialogOpen, userName])

  const [editForm, setEditForm] = useState<any>(null)

  useEffect(() => {
    if (student) {
      setEditForm({ ...student })
    }
  }, [student])

  const selectedBuildingForEdit = useMemo(() => buildings?.find(b => b.id === editForm?.buildingId), [buildings, editForm?.buildingId])
  const roomsInBuildingForEdit = useMemo(() => {
    if (!selectedBuildingForEdit) return []
    return selectedBuildingForEdit.apartmentsDetail?.flatMap((apt: any) => apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))) || []
  }, [selectedBuildingForEdit])

  const selectedRoomForEdit = useMemo(() => roomsInBuildingForEdit.find((r: any) => String(r.roomNo) === String(editForm?.roomNumber)), [roomsInBuildingForEdit, editForm?.roomNumber])
  const emptySeatsForEdit = useMemo(() => {
    if (!selectedRoomForEdit) return []
    const originalSeat = student?.seatNumber
    const originalRoom = student?.roomNumber
    const originalBuilding = student?.buildingId
    return selectedRoomForEdit.seats?.filter((s: any) => {
      if (s.status === 'empty') return true
      if (originalBuilding === editForm?.buildingId && originalRoom === editForm?.roomNumber && s.seatNo === originalSeat) return true
      return false
    }) || []
  }, [selectedRoomForEdit, student, editForm?.buildingId, editForm?.roomNumber])

  const handleUpdateProfile = async () => {
    if (!studentRef || !editForm || !student) return
    setIsUpdating(true)
    const batch = writeBatch(db)
    const locationChanged = student.buildingId !== editForm.buildingId || student.roomNumber !== editForm.roomNumber || student.seatNumber !== editForm.seatNumber
    try {
      if (locationChanged) {
        const oldBRef = doc(db, "buildings", student.buildingId); const oldBSnap = await getDoc(oldBRef)
        if (oldBSnap.exists()) {
          const oldBData = oldBSnap.data(); const updatedApts = oldBData.apartmentsDetail.map((apt: any) => {
            if (apt.name === student.apartmentName) {
              return { ...apt, rooms: apt.rooms.map((room: any) => {
                if (String(room.roomNo) === String(student.roomNumber)) { return { ...room, seats: room.seats.map((seat: any) => seat.seatNo === student.seatNumber ? { ...seat, status: 'empty' } : seat) } }
                return room
              })}
            } return apt
          })
          batch.update(oldBRef, { apartmentsDetail: updatedApts, occupiedSeats: increment(-1), emptySeats: increment(1), updatedAt: serverTimestamp() })
        }
        const newBRef = doc(db, "buildings", editForm.buildingId); const newBSnap = await getDoc(newBRef)
        if (newBSnap.exists()) {
          const newBData = newBSnap.data(); const newAptName = selectedRoomForEdit?.aptName || "General";
          const updatedApts = newBData.apartmentsDetail.map((apt: any) => {
            if (apt.name === newAptName) {
              return { ...apt, rooms: apt.rooms.map((room: any) => {
                if (String(room.roomNo) === String(editForm.roomNumber)) { return { ...room, seats: room.seats.map((seat: any) => seat.seatNo === editForm.seatNumber ? { ...seat, status: 'occupied' } : seat) } }
                return room
              })}
            } return apt
          })
          batch.update(newBRef, { apartmentsDetail: updatedApts, occupiedSeats: increment(1), emptySeats: increment(-1), updatedAt: serverTimestamp() })
          editForm.buildingName = newBData.name; editForm.apartmentName = newAptName
        }
      }
      batch.update(studentRef, { ...editForm, updatedAt: serverTimestamp() })
      await batch.commit()
      setIsEditDialogOpen(false); toast({ title: "Profile Updated" }); router.refresh();
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) } 
    finally { setIsUpdating(false) }
  }

  if (studentLoading || buildingsLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
  if (!student) return <div className="text-center p-20">Resident not found.</div>

  return (
    <div className="space-y-8 pb-24 max-w-7xl mx-auto px-4 relative">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2"><ChevronLeft size={24} /></Button>
        <div className="flex-1 overflow-hidden"><h1 className="text-lg font-bold truncate">{student.name}</h1><p className="text-[10px] text-muted-foreground font-bold uppercase">{student.buildingName} • R-{student.roomNumber}</p></div>
        <div className="flex items-center gap-1">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical size={20} /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-xl border-slate-100">
              <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer"><Edit size={16} className="text-primary" /> Edit Profile</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsExitDialogOpen(true)} className="gap-2 font-medium text-destructive p-3 rounded-lg cursor-pointer"><Scale size={16} /> Process Exit & Settlement</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="hidden md:flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><UserCircle size={48} strokeWidth={1.5} /></div>
          <div><h1 className="text-3xl font-black text-slate-800 tracking-tight">{student.name}</h1>
            <div className="flex gap-2 mt-1"><Badge className={cn("rounded-full", student.isActive ? "bg-success" : "bg-destructive")}>{student.isActive ? "Active Resident" : "Ex-Resident"}</Badge><Badge variant="secondary" className="rounded-full uppercase text-[10px] font-bold">{student.paymentSystem} Plan</Badge></div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl h-11 px-6 font-bold" onClick={() => setIsEditDialogOpen(true)}><Edit size={18} className="mr-2"/> Edit Profile</Button>
          <Button variant="destructive" className="rounded-xl h-11 px-6 font-bold gap-2 shadow-lg shadow-destructive/10" onClick={() => setIsExitDialogOpen(true)}><Scale size={18} /> Process Exit & Settlement</Button>
          <Button variant="ghost" className="rounded-xl h-11 px-6 font-bold" onClick={() => router.back()}>Back</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="border-none shadow-sm rounded-3xl p-6 bg-white flex flex-col justify-between">
          <div><h2 className="text-xl font-bold text-slate-800 mb-6">Contact & Location</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-slate-600"><div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Phone size={18}/></div><div><p className="text-[10px] uppercase font-bold text-muted-foreground">Personal Mobile</p><p className="font-bold">{student.phone}</p></div></div>
              <div className="flex items-center gap-4 text-slate-600"><div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Smartphone size={18}/></div><div><p className="text-[10px] uppercase font-bold text-muted-foreground">Parent Mobile</p><p className="font-bold">{student.parentPhone || 'N/A'}</p></div></div>
              <div className="flex items-center gap-4 text-slate-600"><div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Building2 size={18}/></div><div><p className="text-[10px] uppercase font-bold text-muted-foreground">Location</p><p className="font-bold">{student.buildingName} • R-{student.roomNumber} | S-{student.seatNumber}</p></div></div>
              <div className="flex items-center gap-4 text-slate-600"><div className="bg-primary/5 p-2.5 rounded-xl text-primary"><Calendar size={18}/></div><div><p className="text-[10px] uppercase font-bold text-muted-foreground">Billing Start</p><p className="font-bold">{student.billingStartDate}</p></div></div>
            </div>
          </div>
          <Button variant="secondary" className="w-full mt-8 rounded-xl font-bold gap-2 text-xs uppercase" onClick={() => setIsDetailsDialogOpen(true)}><Info size={14} /> View All Information</Button>
        </Card>
        
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 bg-white">
            <div className="p-3 rounded-xl shrink-0 bg-blue-50 text-blue-600"><ShieldCheck size={24}/></div>
            <div><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Advance</p><p className="text-xl font-black text-slate-800">৳{student.advanceAmount?.toLocaleString()}</p></div>
          </Card>
          <Card className="p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 bg-white">
            <div className="p-3 rounded-xl shrink-0 bg-purple-50 text-purple-600"><Zap size={24}/></div>
            <div><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Service Chrg</p><p className="text-xl font-black text-slate-800">৳{student.serviceCharge?.toLocaleString()}</p></div>
          </Card>
          <Card className="p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 bg-white">
            <div className="p-3 rounded-xl shrink-0 bg-orange-50 text-orange-600"><Home size={24}/></div>
            <div><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Monthly Rent</p><p className="text-xl font-black text-slate-800">৳{student.monthlyRent?.toLocaleString()}</p></div>
          </Card>
          <Card className="p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 bg-white">
            <div className="p-3 rounded-xl shrink-0 bg-red-50 text-destructive"><AlertCircle size={24}/></div>
            <div><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Rent Due</p><p className="text-xl font-black text-destructive">৳{student.totalDue?.toLocaleString() || 0}</p></div>
          </Card>
        </div>
      </div>

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Info className="text-primary" /> Full Resident Profile</DialogTitle><DialogDescription>Comprehensive records for {student.name}</DialogDescription></DialogHeader>
          <div className="space-y-8 py-4">
            <div className="space-y-4"><h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><User size={14}/> Personal Information</h3>
              <div className="grid grid-cols-2 gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="space-y-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Father's Name</Label><p className="font-bold text-slate-700">{student.fatherName || 'N/A'}</p></div>
                <div className="space-y-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Mother's Name</Label><p className="font-bold text-slate-700">{student.motherName || 'N/A'}</p></div>
                <div className="space-y-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Date of Birth</Label><p className="font-bold text-slate-700">{student.dob || 'N/A'}</p></div>
                <div className="space-y-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Blood Group</Label><Badge variant="outline" className="font-black text-primary border-primary/20">{student.bloodGroup || 'N/A'}</Badge></div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                {student.occupation === 'student' ? <GraduationCap size={14}/> : <Briefcase size={14}/>} 
                {student.occupation === 'student' ? 'Education Info' : 'Work Info'}
              </h3>
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                {student.occupation === 'student' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">School</Label>
                        <p className="font-bold text-slate-700">{student.school || 'N/A'}</p>
                        <p className="text-[10px] text-primary uppercase font-bold">Session: {student.schoolSession || 'N/A'} • Group: {student.schoolGroup || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">College</Label>
                        <p className="font-bold text-slate-700">{student.college || 'N/A'}</p>
                        <p className="text-[10px] text-primary uppercase font-bold">Session: {student.collegeSession || 'N/A'} • Group: {student.collegeGroup || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">University</Label>
                        <p className="font-bold text-slate-700">{student.university || 'N/A'}</p>
                        <p className="text-[10px] text-primary uppercase font-bold">Session: {student.universitySession || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Department</Label>
                        <p className="font-bold text-slate-700">{student.department || 'N/A'}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Company</Label><p className="font-bold text-slate-700">{student.companyName || 'N/A'}</p></div>
                    <div className="space-y-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Designation</Label><p className="font-bold text-slate-700">{student.designation || 'N/A'}</p></div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4"><h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><MapPin size={14}/> Permanent Address</h3>
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Address</Label><p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{student.address || 'N/A'}</p></div>
            </div>
            <div className="space-y-4"><h3 className="text-[10px] font-black uppercase text-destructive tracking-widest flex items-center gap-2"><Smartphone size={14}/> Emergency Contacts</h3>
              <div className="grid grid-cols-2 gap-4"><div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-1"><Label className="text-[8px] font-bold text-destructive uppercase">Parent's Mobile</Label><p className="font-black text-slate-800">{student.parentPhone || 'N/A'}</p></div><div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-1"><Label className="text-[8px] font-bold text-destructive uppercase">Guardian Mobile</Label><p className="font-black text-slate-800">{student.guardianPhone || 'N/A'}</p></div></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setIsDetailsDialogOpen(false)} className="w-full rounded-2xl h-12 font-bold">Close Details</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Resident Profile</DialogTitle><DialogDescription>Update contact, location, or personal details.</DialogDescription></DialogHeader>
          {editForm && (
            <div className="space-y-8 py-4">
              <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Smartphone size={14}/> Communication & Contacts</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-1"><Label className="text-xs">Full Name</Label><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="bg-white" /></div>
                  <div className="space-y-1"><Label className="text-xs">Personal Phone</Label><Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="bg-white" /></div>
                  <div className="space-y-1"><Label className="text-xs">Parent's Mobile</Label><Input value={editForm.parentPhone} onChange={e => setEditForm({...editForm, parentPhone: e.target.value})} className="bg-white" /></div>
                  <div className="space-y-1"><Label className="text-xs">Guardian Mobile</Label><Input value={editForm.guardianPhone} onChange={e => setEditForm({...editForm, guardianPhone: e.target.value})} className="bg-white" /></div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  {editForm.occupation === 'student' ? <GraduationCap size={14}/> : <Briefcase size={14}/>} {editForm.occupation === 'student' ? 'Education Info' : 'Work Info'}
                </Label>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  {editForm.occupation === 'student' ? (
                    <>
                      <div className="space-y-4">
                        <div className="space-y-1"><Label className="text-xs">School Name</Label><Input value={editForm.school} onChange={e => setEditForm({...editForm, school: e.target.value})} className="bg-white" /></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1"><Label className="text-xs">School Session</Label><Input value={editForm.schoolSession} onChange={e => setEditForm({...editForm, schoolSession: e.target.value})} className="bg-white" /></div>
                          <div className="space-y-1"><Label className="text-xs">School Group</Label>
                            <Select value={editForm.schoolGroup} onValueChange={v => setEditForm({...editForm, schoolGroup: v})}>
                              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                              <SelectContent>{GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-4">
                        <div className="space-y-1"><Label className="text-xs">College Name</Label><Input value={editForm.college} onChange={e => setEditForm({...editForm, college: e.target.value})} className="bg-white" /></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1"><Label className="text-xs">College Session</Label><Input value={editForm.collegeSession} onChange={e => setEditForm({...editForm, collegeSession: e.target.value})} className="bg-white" /></div>
                          <div className="space-y-1"><Label className="text-xs">College Group</Label>
                            <Select value={editForm.collegeGroup} onValueChange={v => setEditForm({...editForm, collegeGroup: v})}>
                              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                              <SelectContent>{GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-4">
                        <div className="space-y-1"><Label className="text-xs">University (Optional)</Label><Input value={editForm.university} onChange={e => setEditForm({...editForm, university: e.target.value})} className="bg-white" /></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1"><Label className="text-xs">Univ. Session</Label><Input value={editForm.universitySession} onChange={e => setEditForm({...editForm, universitySession: e.target.value})} className="bg-white" /></div>
                          <div className="space-y-1"><Label className="text-xs">Department</Label><Input value={editForm.department} onChange={e => setEditForm({...editForm, department: e.target.value})} className="bg-white" /></div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><Label className="text-xs">Company Name</Label><Input value={editForm.companyName} onChange={e => setEditForm({...editForm, companyName: e.target.value})} className="bg-white" /></div>
                      <div className="space-y-1"><Label className="text-xs">Designation</Label><Input value={editForm.designation} onChange={e => setEditForm({...editForm, designation: e.target.value})} className="bg-white" /></div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Building2 size={14}/> Location Shifting</Label>
                <div className="p-5 border-2 border-primary/10 bg-primary/5 rounded-3xl space-y-4">
                  <div className="space-y-2"><Label className="text-xs">Select Building</Label><Select value={editForm.buildingId} onValueChange={val => setEditForm({...editForm, buildingId: val, roomNumber: "", seatNumber: ""})}><SelectTrigger className="bg-white rounded-xl h-11"><SelectValue placeholder="Choose Building" /></SelectTrigger><SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label className="text-xs">Room No.</Label><Select disabled={!editForm.buildingId} value={editForm.roomNumber} onValueChange={val => setEditForm({...editForm, roomNumber: val, seatNumber: ""})}><SelectTrigger className="bg-white rounded-xl h-11"><SelectValue placeholder="Room" /></SelectTrigger><SelectContent>{roomsInBuildingForEdit.map((r: any, idx: number) => (<SelectItem key={idx} value={String(r.roomNo)}>R-{r.roomNo} ({r.aptName})</SelectItem>))}</SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-xs">Available Seat</Label><Select disabled={!editForm.roomNumber} value={editForm.seatNumber} onValueChange={val => setEditForm({...editForm, seatNumber: val})}><SelectTrigger className="bg-white rounded-xl h-11"><SelectValue placeholder="Seat" /></SelectTrigger><SelectContent>{emptySeatsForEdit.map((s: any) => (<SelectItem key={s.seatNo} value={s.seatNo}>Seat {s.seatNo}</SelectItem>))}</SelectContent></Select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2"><div className="space-y-1"><Label className="text-xs font-bold text-orange-600">Monthly Rent (Auto-sync)</Label><Input type="number" value={editForm.monthlyRent} onChange={e => setEditForm({...editForm, monthlyRent: Number(e.target.value)})} className="bg-white font-black" /></div><div className="space-y-1"><Label className="text-xs">Billing Start Date</Label><Input type="date" value={editForm.billingStartDate} onChange={e => setEditForm({...editForm, billingStartDate: e.target.value})} className="bg-white" /></div></div>
                </div>
              </div>
              <Button onClick={handleUpdateProfile} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl" disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin" /> : "Save Profile Updates"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
