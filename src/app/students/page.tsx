
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
import { 
  Users, Search, Plus, Phone, UserCircle, Loader2, 
  BedDouble, MapPin, Eye, Contact, Filter, XCircle, 
  Building2, DoorOpen, LayoutGrid, MoreVertical,
  Wallet, Utensils
} from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, updateDoc, increment } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

export default function StudentsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")
  const [planFilter, setPlanFilter] = useState("all")

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students, isLoading } = useCollection(studentsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    parentPhone: "",
    address: "",
    buildingId: "",
    roomNumber: "",
    seatNumber: "",
    type: "new", 
    dueAmount: "0", 
    foodDueAmount: "0", 
    initialRentPayment: "0",
    initialFoodPayment: "0",
    advanceAmount: "0",
    serviceCharge: "0",
    paymentSystem: "package",
    monthlyRent: "",
    foodCost: "0",
    receiver: "",
    method: "cash"
  })

  const selectedBuilding = buildings?.find(b => b.id === formData.buildingId)
  
  const allRoomsInSelectedBuilding = useMemo(() => {
    if (!selectedBuilding) return []
    return selectedBuilding.apartmentsDetail?.flatMap((apt: any) => 
      apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))
    ) || []
  }, [selectedBuilding])

  const selectedRoom = allRoomsInSelectedBuilding.find((r: any) => r.roomNo === formData.roomNumber)
  const emptySeats = selectedRoom?.seats?.filter((s: any) => s.status === 'empty') || []

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

    if (formData.phone.length !== 11) {
      toast({ variant: "destructive", title: "Invalid Phone", description: "Phone number must be exactly 11 digits." })
      return
    }

    const rentPaid = Number(formData.initialRentPayment) || 0
    const foodPaid = Number(formData.initialFoodPayment) || 0
    const advPaid = Number(formData.advanceAmount) || 0
    const svcPaid = Number(formData.serviceCharge) || 0
    const totalInitialReceived = rentPaid + foodPaid + advPaid + svcPaid
    
    if (totalInitialReceived > 0 && !formData.receiver) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a receiver for the initial payment." })
      return
    }

    setIsSubmitting(true)
    try {
      const studentId = doc(collection(db, "students")).id
      const studentRef = doc(db, "students", studentId)
      const monthlyRent = Number(formData.monthlyRent)
      const apartmentName = selectedRoom?.aptName || "General"

      const startingRentDue = formData.type === 'old' ? Number(formData.dueAmount) : monthlyRent
      const startingFoodDue = formData.type === 'old' ? Number(formData.foodDueAmount) : 0

      // Detailed Description for Initial Payment
      let detailsArr = []
      if (rentPaid > 0) detailsArr.push(`Rent: ৳${rentPaid}`)
      if (foodPaid > 0) detailsArr.push(`Food: ৳${foodPaid}`)
      if (advPaid > 0) detailsArr.push(`Advance: ৳${advPaid}`)
      if (svcPaid > 0) detailsArr.push(`Service: ৳${svcPaid}`)
      const detailedDescription = `Initial payment: ${detailsArr.join(', ')}`

      const paymentRecord = totalInitialReceived > 0 ? {
        amount: totalInitialReceived,
        seatAmount: rentPaid,
        foodAmount: foodPaid,
        advanceAmount: advPaid,
        serviceCharge: svcPaid,
        buildingId: formData.buildingId,
        buildingName: selectedBuilding?.name || "Unknown",
        studentName: formData.name,
        studentId: studentId,
        type: "income",
        month: new Date().toLocaleString('default', { month: 'long' }),
        year: new Date().getFullYear().toString(),
        method: formData.method,
        receiver: formData.receiver,
        description: detailedDescription,
        date: new Date().toISOString()
      } : null

      if (paymentRecord) {
        await setDoc(doc(db, "payments", doc(collection(db, "payments")).id), {
          ...paymentRecord,
          date: serverTimestamp(),
          createdAt: serverTimestamp(),
        })
      }

      await setDoc(studentRef, {
        ...formData,
        dueAmount: startingRentDue,
        foodDueAmount: startingFoodDue,
        advanceAmount: advPaid,
        serviceCharge: svcPaid,
        monthlyRent: monthlyRent,
        apartmentName: apartmentName,
        buildingName: selectedBuilding?.name || "Unknown",
        isActive: true,
        paymentsHistory: paymentRecord ? [paymentRecord] : [],
        mealsHistory: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

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

      toast({ title: "Registered", description: "Resident registered successfully." })
      setOpen(false)
      setFormData({
        name: "", phone: "", parentPhone: "", address: "", buildingId: "", roomNumber: "", seatNumber: "",
        type: "new", dueAmount: "0", foodDueAmount: "0", initialRentPayment: "0", initialFoodPayment: "0", advanceAmount: "0", serviceCharge: "0",
        paymentSystem: "package", monthlyRent: "", foodCost: "0", receiver: "", method: "cash"
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
      const matchesPlan = planFilter === "all" || s.paymentSystem === planFilter
      return matchesSearch && matchesBuilding && matchesRoom && matchesStatus && matchesPlan
    })
  }, [students, searchTerm, buildingFilter, roomFilter, statusFilter, planFilter])

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
                       <SelectContent>
                         <SelectItem value="package">Package Plan (Fixed All-in)</SelectItem>
                         <SelectItem value="non-package">Non-Package (Separate Rent & Food)</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                   <div className="space-y-2">
                     <Label>{formData.paymentSystem === 'package' ? 'Monthly Package Rate (৳)' : 'Monthly Seat Rent (৳)'}</Label>
                     <Input type="number" value={formData.monthlyRent} onChange={e => setFormData({...formData, monthlyRent: e.target.value})} placeholder="0.00" />
                   </div>
                </div>
              </div>

              <div className="p-4 bg-secondary/20 rounded-lg border space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold">Student Type</Label>
                  <RadioGroup 
                    value={formData.type} 
                    onValueChange={val => setFormData({...formData, type: val})}
                    className="flex gap-6 pt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="new" id="new-std" />
                      <Label htmlFor="new-std" className="cursor-pointer">New Student</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="old" id="old-std" />
                      <Label htmlFor="old-std" className="cursor-pointer">Old Student (Existing Data)</Label>
                    </div>
                  </RadioGroup>
                </div>

                {formData.type === 'old' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label className="font-bold text-destructive">Previous RENT Due (৳)</Label>
                      <Input type="number" value={formData.dueAmount} onChange={e => setFormData({...formData, dueAmount: e.target.value})} placeholder="0.00" />
                    </div>
                    {formData.paymentSystem === 'non-package' && (
                      <div className="space-y-2">
                        <Label className="font-bold text-destructive">Previous FOOD Due (৳)</Label>
                        <Input type="number" value={formData.foodDueAmount} onChange={e => setFormData({...formData, foodDueAmount: e.target.value})} placeholder="0.00" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Student Name</Label>
                  <Input placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Student Phone</Label>
                  <Input placeholder="11 Digit Mobile Number" maxLength={11} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Parent's Phone</Label>
                  <Input placeholder="11 Digit Contact" maxLength={11} value={formData.parentPhone} onChange={e => setFormData({...formData, parentPhone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Permanent Address</Label>
                  <Textarea placeholder="Full Address Details" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-secondary/20 rounded-lg border">
                 <div className="space-y-1">
                    <Label className="text-[10px] font-bold flex items-center gap-1"><Building2 size={10}/> Building</Label>
                    <Select onValueChange={val => setFormData({...formData, buildingId: val, roomNumber: "", seatNumber: ""})}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-1">
                    <Label className="text-[10px] font-bold flex items-center gap-1"><DoorOpen size={10}/> Room No.</Label>
                    <Select disabled={!formData.buildingId} onValueChange={val => setFormData({...formData, roomNumber: val, seatNumber: ""})}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{allRoomsInSelectedBuilding.map((r: any) => <SelectItem key={r.roomNo} value={r.roomNo}>Room {r.roomNo}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-1">
                    <Label className="text-[10px] font-bold">Seat</Label>
                    <Select disabled={!formData.roomNumber} onValueChange={val => setFormData({...formData, seatNumber: val})}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{emptySeats.map((s: any) => <SelectItem key={s.seatNo} value={s.seatNo}>Seat {s.seatNo}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
                <Label className="font-bold">Initial Payments & Fees</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Initial Rent Payment (৳)</Label>
                    <Input type="number" value={formData.initialRentPayment} onChange={e => setFormData({...formData, initialRentPayment: e.target.value})} placeholder="0.00" />
                  </div>
                  {formData.paymentSystem === 'non-package' && (
                    <div className="space-y-2">
                      <Label>Initial Food Payment (৳)</Label>
                      <Input type="number" value={formData.initialFoodPayment} onChange={e => setFormData({...formData, initialFoodPayment: e.target.value})} placeholder="0.00" />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Advance / Security (৳)</Label>
                    <Input type="number" value={formData.advanceAmount} onChange={e => setFormData({...formData, advanceAmount: e.target.value})} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Service Charge (৳)</Label>
                    <Input type="number" value={formData.serviceCharge} onChange={e => setFormData({...formData, serviceCharge: e.target.value})} placeholder="0.00" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={formData.method} onValueChange={val => setFormData({...formData, method: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bkash">Bkash</SelectItem>
                        <SelectItem value="nagad">Nagad</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Receiver</Label>
                    <Select value={formData.receiver} onValueChange={val => setFormData({...formData, receiver: val})}>
                      <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                      <SelectContent>
                        {staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleRegister} className="w-full h-12 text-lg" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : "Register & Occupy Seat"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 bg-secondary/20 p-4 rounded-xl border items-end">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <Input placeholder="Name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Building</Label>
          <Select value={buildingFilter} onValueChange={val => { setBuildingFilter(val); setRoomFilter("all") }}>
            <SelectTrigger><SelectValue placeholder="Building" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Room</Label>
          <Select disabled={buildingFilter === 'all'} value={roomFilter} onValueChange={setRoomFilter}>
            <SelectTrigger><SelectValue placeholder="Room" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Rooms</SelectItem>{roomOptions.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active Residents</SelectItem>
              <SelectItem value="left">Ex-Residents</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Plan</Label>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger><SelectValue placeholder="Plan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="package">Package</SelectItem>
              <SelectItem value="non-package">Non-Package</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" className="h-10" onClick={() => { setBuildingFilter("all"); setRoomFilter("all"); setSearchTerm(""); setStatusFilter("active"); setPlanFilter("all"); }}>
          <XCircle size={14} className="mr-1" /> Reset
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((s: any) => (
                  <TableRow 
                    key={s.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/students/${s.id}`)}
                  >
                    <TableCell>
                       <div className="flex items-center gap-3">
                          <UserCircle size={32} className="text-primary/40" />
                          <div className="flex flex-col">
                            <span className="font-bold">{s.name}</span>
                            <span className="text-[10px] text-muted-foreground">{s.phone}</span>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{s.buildingName}</span>
                        <span className="text-[10px] text-muted-foreground">Room {s.roomNumber} | Seat {s.seatNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{s.paymentSystem}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? "default" : "secondary"} className={s.isActive ? "bg-success text-white" : ""}>
                        {s.isActive ? "Active" : "Left"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => router.push(`/students/${s.id}`)} className="cursor-pointer gap-2">
                            <Eye size={14} /> View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/students/${s.id}?action=payment`)} className="cursor-pointer gap-2">
                            <Wallet size={14} className="text-success" /> Process Payment
                          </DropdownMenuItem>
                          {s.paymentSystem === 'non-package' && (
                            <DropdownMenuItem onClick={() => router.push(`/students/${s.id}?action=meals`)} className="cursor-pointer gap-2">
                              <Utensils size={14} className="text-primary" /> Log Meals
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredStudents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No students found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
