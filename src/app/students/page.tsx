"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
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
import { Users, Search, Plus, Phone, UserCircle, Loader2, BedDouble, MapPin, Eye, Contact, Filter, XCircle, Building2, DoorOpen, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, updateDoc, increment } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export default function StudentsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students, isLoading } = useCollection(studentsQuery)

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    parentPhone: "",
    address: "",
    buildingId: "",
    apartmentName: "",
    roomNumber: "",
    seatNumber: "",
    type: "new", 
    dueAmount: "0",
    foodDue: "0",
    initialRentPayment: "0",
    advanceAmount: "0",
    serviceCharge: "0",
    paymentSystem: "package",
    monthlyRent: "",
    foodCost: "0"
  })

  // Cascading Selection Logic for Form (Building -> Room -> Seat)
  const selectedBuilding = buildings?.find(b => b.id === formData.buildingId)
  
  // Flatten all rooms from all apartments in the building
  const allRoomsInSelectedBuilding = useMemo(() => {
    if (!selectedBuilding) return []
    return selectedBuilding.apartmentsDetail?.flatMap((apt: any) => 
      apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))
    ) || []
  }, [selectedBuilding])

  const selectedRoom = allRoomsInSelectedBuilding.find((r: any) => r.roomNo === formData.roomNumber)
  const emptySeats = selectedRoom?.seats?.filter((s: any) => s.status === 'empty') || []

  // Cascading Options for Filters
  const roomOptions = useMemo(() => {
    if (buildingFilter === "all" || !buildings) return []
    const b = buildings.find(b => b.id === buildingFilter)
    return b?.apartmentsDetail?.flatMap((a: any) => a.rooms?.map((r: any) => r.roomNo)) || []
  }, [buildingFilter, buildings])

  const handleRegister = async () => {
    if (!formData.name || !formData.buildingId || !formData.roomNumber || !formData.seatNumber || !formData.monthlyRent) {
      toast({ variant: "destructive", title: "Missing Info", description: "Name, Building, Room, Seat and Monthly Rent are required." })
      return
    }

    setIsSubmitting(true)
    try {
      const studentId = doc(collection(db, "students")).id
      const studentRef = doc(db, "students", studentId)
      const monthlyRent = Number(formData.monthlyRent)
      const initialRentPayment = Number(formData.initialRentPayment)
      
      const startingDue = formData.type === 'new' ? (monthlyRent - initialRentPayment) : Number(formData.dueAmount)
      const foodCostVal = formData.paymentSystem === 'package' ? 0 : (formData.type === 'old' ? -Number(formData.foodDue) : Number(formData.foodCost))

      // Important: Save the apartment name derived from the room
      const apartmentName = selectedRoom?.aptName || "General"

      const paymentRecord = (initialRentPayment > 0 && formData.type === 'new') ? {
        amount: initialRentPayment,
        seatAmount: initialRentPayment,
        buildingId: formData.buildingId,
        buildingName: selectedBuilding?.name || "Unknown",
        studentName: formData.name,
        studentId: studentId,
        type: "income",
        paymentType: "registration_rent",
        month: new Date().toLocaleString('default', { month: 'long' }),
        year: new Date().getFullYear().toString(),
        method: "cash",
        receiver: "Admin (Registration)",
        description: "Initial rent payment at registration",
        date: new Date().toISOString()
      } : null

      if (paymentRecord) {
        await setDoc(doc(db, "payments", doc(collection(db, "payments")).id), {
          ...paymentRecord,
          date: serverTimestamp(),
          createdAt: serverTimestamp(),
        })
        const summaryId = `${paymentRecord.year}-${paymentRecord.month}`
        await setDoc(doc(db, "summaries", summaryId), {
          totalIncome: increment(initialRentPayment),
          [`buildingIncome.${selectedBuilding?.name}`]: increment(initialRentPayment),
          updatedAt: serverTimestamp()
        }, { merge: true })
      }

      await setDoc(studentRef, {
        ...formData,
        apartmentName: apartmentName,
        dueAmount: startingDue,
        foodCost: foodCostVal,
        advanceAmount: Number(formData.advanceAmount),
        serviceCharge: Number(formData.serviceCharge),
        buildingName: selectedBuilding?.name || "Unknown",
        isActive: true,
        paymentsHistory: paymentRecord ? [paymentRecord] : [],
        mealsHistory: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Update building occupied status
      const buildingRef = doc(db, "buildings", formData.buildingId)
      const updatedApts = selectedBuilding.apartmentsDetail.map((apt: any) => {
        if (apt.name === apartmentName) {
          return {
            ...apt,
            rooms: apt.rooms.map((room: any) => {
              if (room.roomNo === formData.roomNumber) {
                return {
                  ...room,
                  seats: room.seats.map((seat: any) => {
                    if (seat.seatNo === formData.seatNumber) return { ...seat, status: 'occupied' }
                    return seat
                  })
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

      toast({ title: "Registered", description: "Seat occupied successfully." })
      setOpen(false)
      setFormData({
        name: "", phone: "", parentPhone: "", address: "", buildingId: "", apartmentName: "", roomNumber: "", seatNumber: "",
        type: "new", dueAmount: "0", foodDue: "0", initialRentPayment: "0", advanceAmount: "0", serviceCharge: "0",
        paymentSystem: "package", monthlyRent: "", foodCost: "0"
      })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredStudents = useMemo(() => {
    if (!students) return []
    return students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || "").includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesRoom = roomFilter === "all" || s.roomNumber === roomFilter
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      return matchesSearch && matchesBuilding && matchesRoom && matchesStatus
    })
  }, [students, searchTerm, buildingFilter, roomFilter, statusFilter])

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Residents</h1>
            <p className="text-muted-foreground mt-1">Manage Building &rarr; Room &rarr; Seat Hierarchy</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus size={18} /> Register Student</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Register Resident</DialogTitle></DialogHeader>
            <div className="space-y-6 py-4">
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
                <Label className="font-bold">Billing & Food Plan</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Payment System</Label>
                     <Select value={formData.paymentSystem} onValueChange={val => setFormData({...formData, paymentSystem: val})}>
                       <SelectTrigger><SelectValue /></SelectTrigger>
                       <SelectContent><SelectItem value="package">Package</SelectItem><SelectItem value="non-package">Non-Package</SelectItem></SelectContent>
                     </Select>
                   </div>
                   <div className="space-y-2">
                     <Label>Monthly Rent</Label>
                     <Input type="number" value={formData.monthlyRent} onChange={e => setFormData({...formData, monthlyRent: e.target.value})} />
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                <Input placeholder="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-secondary/20 rounded-lg border">
                 <div className="space-y-1">
                    <Label className="text-[10px] font-bold flex items-center gap-1"><Building2 size={10}/> Building</Label>
                    <Select onValueChange={val => setFormData({...formData, buildingId: val, roomNumber: "", seatNumber: ""})}>
                      <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                      <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-1">
                    <Label className="text-[10px] font-bold flex items-center gap-1"><DoorOpen size={10}/> Room No.</Label>
                    <Select disabled={!formData.buildingId} onValueChange={val => setFormData({...formData, roomNumber: val, seatNumber: ""})}>
                      <SelectTrigger><SelectValue placeholder="Select Room" /></SelectTrigger>
                      <SelectContent>{allRoomsInSelectedBuilding.map((r: any) => <SelectItem key={r.roomNo} value={r.roomNo}>Room {r.roomNo}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-1">
                    <Label className="text-[10px] font-bold">Seat</Label>
                    <Select disabled={!formData.roomNumber} onValueChange={val => setFormData({...formData, seatNumber: val})}>
                      <SelectTrigger><SelectValue placeholder="Select Seat" /></SelectTrigger>
                      <SelectContent>{emptySeats.map((s: any) => <SelectItem key={s.seatNo} value={s.seatNo}>Seat {s.seatNo}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                 <div className="space-y-2">
                    <Label>Advance / Security</Label>
                    <Input type="number" value={formData.advanceAmount} onChange={e => setFormData({...formData, advanceAmount: e.target.value})} />
                 </div>
                 <div className="space-y-2">
                    <Label>Rent Paid at Registration</Label>
                    <Input type="number" value={formData.initialRentPayment} onChange={e => setFormData({...formData, initialRentPayment: e.target.value})} />
                 </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleRegister} className="w-full h-12" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : "Register & Occupy Seat"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-secondary/20 p-4 rounded-xl border">
        <Input placeholder="Search name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <Select value={buildingFilter} onValueChange={val => { setBuildingFilter(val); setRoomFilter("all") }}>
          <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select disabled={buildingFilter === 'all'} value={roomFilter} onValueChange={setRoomFilter}>
          <SelectTrigger><SelectValue placeholder="Select Room" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Rooms</SelectItem>{roomOptions.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="ghost" onClick={() => { setBuildingFilter("all"); setRoomFilter("all"); setSearchTerm("") }}>Reset Filters</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <Table>
          <TableHeader className="bg-secondary/30">
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell>
                   <div className="flex items-center gap-3">
                      <UserCircle size={32} className="text-primary/40" />
                      <div className="flex flex-col"><span className="font-bold">{s.name}</span><span className="text-[10px] text-muted-foreground">{s.phone}</span></div>
                   </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{s.buildingName}</span>
                    <span className="text-[10px] text-muted-foreground">Room {s.roomNumber} | Seat {s.seatNumber}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{s.paymentSystem}</Badge></TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => router.push(`/students/${s.id}`)}><Eye size={14} className="mr-1" /> View</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
