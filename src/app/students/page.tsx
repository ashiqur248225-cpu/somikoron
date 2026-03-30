
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
import { Users, Search, Plus, Phone, UserCircle, Loader2, BedDouble, MapPin, Eye, Contact } from "lucide-react"
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
import { collection, serverTimestamp, doc, setDoc, updateDoc, increment, Timestamp } from "firebase/firestore"

export default function StudentsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  
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
    foodCost: "0",
    foodRate: 40
  })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        e.preventDefault();
        const container = target.closest('.space-y-6') || target.closest('.grid') || target.closest('[role="dialog"]');
        if (container) {
          const focusables = Array.from(container.querySelectorAll('input, button, [role="combobox"], textarea, [role="radio"]')) as HTMLElement[];
          const index = focusables.indexOf(target);
          if (index > -1 && index < focusables.length - 1) {
            focusables[index + 1].focus();
          }
        }
      }
    }
  };

  // Cascading Select Helpers
  const selectedBuilding = buildings?.find(b => b.id === formData.buildingId)
  const rooms = selectedBuilding?.roomsDetail || []
  const selectedRoom = rooms.find((r: any) => r.roomNo === formData.roomNumber)
  const emptySeats = selectedRoom?.seats?.filter((s: any) => s.status === 'empty') || []

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
      
      // Calculate starting due
      const startingDue = formData.type === 'new' 
        ? (monthlyRent - initialRentPayment) 
        : Number(formData.dueAmount)

      // Calculate starting food cost (balance)
      const foodCostVal = formData.paymentSystem === 'package' 
        ? 0 
        : (formData.type === 'old' ? -Number(formData.foodDue) : Number(formData.foodCost))

      const paymentsHistory = []
      
      // If there's an initial payment, create a payment record
      if (initialRentPayment > 0 && formData.type === 'new') {
        const paymentId = doc(collection(db, "payments")).id
        const currentMonth = new Date().toLocaleString('default', { month: 'long' })
        const currentYear = new Date().getFullYear().toString()
        const summaryId = `${currentYear}-${currentMonth}`

        const paymentRecord = {
          amount: initialRentPayment,
          buildingId: formData.buildingId,
          buildingName: selectedBuilding?.name || "Unknown",
          studentName: formData.name,
          studentId: studentId,
          type: "income",
          paymentType: "registration_rent",
          month: currentMonth,
          year: currentYear,
          method: "cash",
          receiver: "Admin (Registration)",
          description: "Initial rent payment at registration",
          date: new Date().toISOString()
        }

        await setDoc(doc(db, "payments", paymentId), {
          ...paymentRecord,
          date: serverTimestamp(),
          createdAt: serverTimestamp(),
        })

        await setDoc(doc(db, "summaries", summaryId), {
          totalIncome: increment(initialRentPayment),
          [`buildingIncome.${selectedBuilding?.name || 'Unknown'}`]: increment(initialRentPayment),
          updatedAt: serverTimestamp()
        }, { merge: true })

        paymentsHistory.push(paymentRecord)
      }

      await setDoc(studentRef, {
        ...formData,
        dueAmount: startingDue,
        foodCost: foodCostVal,
        advanceAmount: Number(formData.advanceAmount),
        serviceCharge: Number(formData.serviceCharge),
        monthlyRent: monthlyRent,
        foodRate: Number(formData.foodRate),
        buildingName: selectedBuilding?.name || "Unknown",
        isActive: true,
        paymentsHistory: paymentsHistory,
        mealsHistory: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      const buildingRef = doc(db, "buildings", formData.buildingId)
      const updatedRoomsDetail = selectedBuilding.roomsDetail.map((room: any) => {
        if (room.roomNo === formData.roomNumber) {
          return {
            ...room,
            seats: room.seats.map((seat: any) => {
              if (seat.seatNo === formData.seatNumber) {
                return { ...seat, status: 'occupied' }
              }
              return seat
            })
          }
        }
        return room
      })

      await updateDoc(buildingRef, {
        roomsDetail: updatedRoomsDetail,
        occupiedSeats: increment(1),
        emptySeats: increment(-1),
        updatedAt: serverTimestamp()
      })

      toast({ title: "Student Registered", description: "Profile saved and seat occupied." })
      setOpen(false)
      setFormData({
        name: "", phone: "", parentPhone: "", address: "", buildingId: "", roomNumber: "", seatNumber: "",
        type: "new", dueAmount: "0", foodDue: "0", initialRentPayment: "0", advanceAmount: "0", serviceCharge: "0",
        paymentSystem: "package", monthlyRent: "", foodCost: "0", foodRate: 40
      })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredStudents = useMemo(() => {
    if (!students) return []
    const term = searchTerm.toLowerCase()
    return students.filter(s => 
      s.name.toLowerCase().includes(term) ||
      (s.phone || "").toLowerCase().includes(term) ||
      (s.parentPhone || "").toLowerCase().includes(term) ||
      (s.buildingName || "").toLowerCase().includes(term) ||
      (s.roomNumber || "").toLowerCase().includes(term)
    )
  }, [students, searchTerm])

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Student Residents</h1>
          <p className="text-muted-foreground mt-1">Manage profiles, seat assignments and financial plans.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex gap-2">
              <Plus size={18} /> Register Student
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyDown}>
            <DialogHeader>
              <DialogTitle>Resident Registration</DialogTitle>
              <DialogDescription>Assign cascading room/seat details and financial plans.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Student's name" />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input 
                    value={formData.phone} 
                    maxLength={11}
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    placeholder="11 digits" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Parent Number</Label>
                  <Input 
                    value={formData.parentPhone} 
                    maxLength={11}
                    onChange={e => setFormData({...formData, parentPhone: e.target.value})} 
                    placeholder="11 digits" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Home address" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-secondary/20 rounded-lg border">
                <div className="space-y-2">
                  <Label>Building</Label>
                  <Select onValueChange={val => setFormData({...formData, buildingId: val, roomNumber: "", seatNumber: ""})}>
                    <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                    <SelectContent>
                      {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Room</Label>
                  <Select 
                    disabled={!formData.buildingId}
                    value={formData.roomNumber}
                    onValueChange={val => setFormData({...formData, roomNumber: val, seatNumber: ""})}
                  >
                    <SelectTrigger><SelectValue placeholder="Select Room" /></SelectTrigger>
                    <SelectContent>
                      {rooms.map((r: any) => <SelectItem key={r.roomNo} value={r.roomNo}>Room {r.roomNo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Available Seat</Label>
                  <Select 
                    disabled={!formData.roomNumber}
                    value={formData.seatNumber}
                    onValueChange={val => setFormData({...formData, seatNumber: val})}
                  >
                    <SelectTrigger><SelectValue placeholder="Select Seat" /></SelectTrigger>
                    <SelectContent>
                      {emptySeats.map((s: any) => <SelectItem key={s.seatNo} value={s.seatNo}>Seat {s.seatNo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center gap-4">
                  <Label>Resident Type:</Label>
                  <RadioGroup 
                    value={formData.type}
                    onValueChange={val => setFormData({...formData, type: val})}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="new" id="new" />
                      <Label htmlFor="new">New Student</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="old" id="old" />
                      <Label htmlFor="old">Old Student</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {formData.type === 'old' && (
                    <>
                      <div className="space-y-2">
                        <Label>Previous Seat Rent Due</Label>
                        <Input type="number" value={formData.dueAmount} onChange={e => setFormData({...formData, dueAmount: e.target.value})} />
                      </div>
                      {formData.paymentSystem === 'non-package' && (
                        <div className="space-y-2">
                          <Label>Previous Food Due</Label>
                          <Input type="number" value={formData.foodDue} onChange={e => setFormData({...formData, foodDue: e.target.value})} />
                        </div>
                      )}
                    </>
                  )}
                  <div className="space-y-2">
                    <Label>Advance Amount</Label>
                    <Input type="number" value={formData.advanceAmount} onChange={e => setFormData({...formData, advanceAmount: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Service Charge</Label>
                    <Input type="number" value={formData.serviceCharge} onChange={e => setFormData({...formData, serviceCharge: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <Label className="text-primary font-bold">Billing & Food Plan</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Payment System</Label>
                    <Select value={formData.paymentSystem} onValueChange={val => setFormData({...formData, paymentSystem: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="package">Package (All-in)</SelectItem>
                        <SelectItem value="non-package">Non-Package (Separate)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {formData.paymentSystem === 'package' ? 'Fixed Monthly Rent (Full)' : 'Fixed Monthly Seat Rent'}
                    </Label>
                    <Input 
                      type="number" 
                      value={formData.monthlyRent} 
                      onChange={e => setFormData({...formData, monthlyRent: e.target.value})} 
                      placeholder="Enter fixed monthly amount"
                    />
                  </div>
                  
                  {formData.type === 'new' && (
                    <div className="space-y-2">
                      <Label>Rent Paid at Registration</Label>
                      <Input 
                        type="number" 
                        value={formData.initialRentPayment} 
                        onChange={e => setFormData({...formData, initialRentPayment: e.target.value})}
                        placeholder="0.00" 
                      />
                    </div>
                  )}

                  {formData.paymentSystem === 'non-package' && (
                    <div className="space-y-2">
                      <Label>Initial Food Advance</Label>
                      <Input 
                        type="number" 
                        value={formData.foodCost} 
                        onChange={e => setFormData({...formData, foodCost: e.target.value})} 
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="sticky bottom-0 bg-background pt-2 border-t mt-4">
              <Button onClick={handleRegister} className="w-full h-12 text-lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Save & Occupy Seat"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, phone or parent contact..." 
              className="pl-8" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" size={32} /></div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents?.map((student: any) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-1.5 rounded-full text-primary">
                          <UserCircle size={24} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold">{student.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{student.type} Resident</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Phone size={10} className="text-primary" />
                          {student.phone}
                        </div>
                        {student.parentPhone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Contact size={10} />
                            {student.parentPhone} (P)
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{student.buildingName}</span>
                        <span className="text-xs text-muted-foreground">R: {student.roomNumber} | S: {student.seatNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize font-normal text-[10px]">
                        {student.paymentSystem}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.isActive ? 'success' : 'destructive'} className="capitalize font-normal text-[10px]">
                        {student.isActive ? 'Active' : 'Left'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/students/${student.id}`)} className="h-8">
                        <Eye size={14} className="mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
