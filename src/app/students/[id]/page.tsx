
"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useMemo } from "react"
import { useDoc, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, serverTimestamp, updateDoc, setDoc, getDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  UserCircle, Phone, MapPin, Building2, 
  BedDouble, CreditCard, Utensils,
  Loader2, CheckCircle2, UserMinus, Calculator,
  Calendar as CalendarIcon
} from "lucide-react"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function StudentDetailsPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [mealCount, setMealCount] = useState("1")
  const [editRate, setEditRate] = useState(false)
  const [newRate, setNewRate] = useState("")

  // Calculator State
  const [calcMonth, setCalcMonth] = useState(new Date().toLocaleString('default', { month: 'long' }))
  const [calcYear, setCalcYear] = useState(new Date().getFullYear().toString())
  const [calcMealCount, setCalcMealCount] = useState("")
  const [calcRate, setCalcRate] = useState("")

  // Fetch Student Data
  const studentRef = useMemoFirebase(() => id ? doc(db, "students", id as string) : null, [db, id])
  const { data: student, isLoading: studentLoading } = useDoc(studentRef)

  // Fetch Payment History - Protected with id check
  const paymentsQuery = useMemoFirebase(() => 
    id ? query(collection(db, "payments"), where("studentId", "==", id)) : null, [db, id])
  const { data: payments } = useCollection(paymentsQuery)

  // Fetch Meal History - Protected with id check
  const mealsQuery = useMemoFirebase(() => 
    id ? query(collection(db, "meals"), where("studentId", "==", id)) : null, [db, id])
  const { data: meals } = useCollection(mealsQuery)

  // Financial Calculations
  const currentMonth = new Date().toLocaleString('default', { month: 'long' })
  const currentYear = new Date().getFullYear().toString()

  const currentMonthMeals = useMemo(() => {
    return meals?.filter(m => m.month === currentMonth && m.year === currentYear)
      .reduce((acc, curr) => acc + (curr.count || 0), 0) || 0
  }, [meals, currentMonth, currentYear])

  const foodBill = currentMonthMeals * (student?.foodRate || 0)
  const foodAdvance = student?.foodCost || 0
  const foodBalance = foodAdvance - foodBill

  const handleDeactivate = async () => {
    if (!student || !student.isActive || !studentRef) return
    setIsUpdating(true)
    try {
      await updateDoc(studentRef, { 
        isActive: false, 
        updatedAt: serverTimestamp(),
        leftAt: serverTimestamp()
      })

      const buildingRef = doc(db, "buildings", student.buildingId)
      const buildingSnap = await getDoc(buildingRef)
      
      if (buildingSnap.exists()) {
        const buildingData = buildingSnap.data()
        const updatedRoomsDetail = buildingData.roomsDetail.map((room: any) => {
          if (room.roomNo === student.roomNumber) {
            return {
              ...room,
              seats: room.seats.map((seat: any) => {
                if (seat.seatNo === student.seatNumber) {
                  return { ...seat, status: 'empty' }
                }
                return seat
              })
            }
          }
          return room
        })

        await updateDoc(buildingRef, {
          roomsDetail: updatedRoomsDetail,
          occupiedSeats: Math.max(0, (buildingData.occupiedSeats || 0) - 1),
          emptySeats: (buildingData.emptySeats || 0) + 1,
          updatedAt: serverTimestamp()
        })
      }
      toast({ title: "Student Inactivated", description: "Resident profile updated and seat vacated." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const logMeal = async () => {
    if (!student) return
    setIsUpdating(true)
    try {
      const mealId = doc(collection(db, "meals")).id
      const now = new Date()
      await setDoc(doc(db, "meals", mealId), {
        studentId: student.id,
        date: now.toISOString().split('T')[0],
        count: Number(mealCount),
        month: now.toLocaleString('default', { month: 'long' }),
        year: now.getFullYear().toString(),
        createdAt: serverTimestamp()
      })
      toast({ title: "Meal Logged", description: "Daily count updated." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const updateMealRate = async () => {
    if (!student || !newRate || !studentRef) return
    setIsUpdating(true)
    try {
      await updateDoc(studentRef, { 
        foodRate: Number(newRate),
        updatedAt: serverTimestamp() 
      })
      setEditRate(false)
      toast({ title: "Rate Updated", description: `Meal rate set to ₹${newRate}` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const calculatedTotal = useMemo(() => {
    const count = Number(calcMealCount) || 0
    const rate = Number(calcRate) || 0
    return count * rate
  }, [calcMealCount, calcRate])

  if (studentLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
  if (!student) return <div className="text-center p-20">Student not found.</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex gap-4 items-center">
          <div className="bg-primary/10 p-4 rounded-xl text-primary">
            <UserCircle size={48} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{student.name}</h1>
            <div className="flex gap-2 items-center mt-1">
              <Badge variant={student.isActive ? "default" : "destructive"} className={student.isActive ? "bg-success hover:bg-success/80" : ""}>
                {student.isActive ? "Active Resident" : "Inactive / Left"}
              </Badge>
              <Badge variant="outline">{student.paymentSystem?.toUpperCase()}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {student.isActive && (
            <Button variant="destructive" className="flex gap-2" onClick={handleDeactivate} disabled={isUpdating}>
              <UserMinus size={18} /> Mark as Left (Vacate Seat)
            </Button>
          )}
          <Button variant="outline" onClick={() => router.back()}>Back to List</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Contact & Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Phone className="text-muted-foreground" size={16} />
              <span>{student.phone}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="text-muted-foreground" size={16} />
              <span>{student.address || "No address provided"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm border-t pt-4">
              <Building2 className="text-primary" size={16} />
              <span className="font-semibold">{student.buildingName}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <BedDouble className="text-primary" size={16} />
              <span>Room {student.roomNumber} - Seat {student.seatNumber}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm md:col-span-2">
          <CardHeader className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg">Financial Overview</CardTitle>
              <CardDescription>Plan and real-time food balance.</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex gap-2">
                    <Calculator size={14} /> Calculate Monthly Bill
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Monthly Meal Calculator</DialogTitle>
                    <DialogDescription>Calculate the food bill for a specific month based on meals and rate.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Select Month</Label>
                        <Select value={calcMonth} onValueChange={setCalcMonth}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Input type="number" value={calcYear} onChange={e => setCalcYear(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Total Meals in {calcMonth}</Label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={calcMealCount} 
                          onChange={e => setCalcMealCount(e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rate Per Meal (₹)</Label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={calcRate} 
                          onChange={e => setCalcRate(e.target.value)} 
                        />
                      </div>
                    </div>
                    <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20 flex justify-between items-center">
                      <span className="font-semibold text-muted-foreground">Total Bill for {calcMonth}:</span>
                      <span className="text-2xl font-bold text-primary">₹{calculatedTotal.toLocaleString()}</span>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="secondary" onClick={() => {
                      setCalcMealCount("")
                      setCalcRate("")
                    }}>Reset</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <div className="flex items-center gap-2">
                <Calculator size={16} className="text-muted-foreground" />
                <span className="text-xs font-bold uppercase">₹{student.foodRate || 0}/Meal</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Monthly Rent</p>
                <p className="text-lg font-bold">₹{student.monthlyRent || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-[10px] uppercase text-primary font-bold">Food Bill (Current)</p>
                <p className="text-lg font-bold text-primary">₹{foodBill.toLocaleString()}</p>
                <p className="text-[9px] text-muted-foreground">{currentMonthMeals} Meals logged</p>
              </div>
              <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                <p className="text-[10px] uppercase text-success font-bold">Food Balance</p>
                <p className={`text-lg font-bold ${foodBalance < 0 ? 'text-destructive' : 'text-success'}`}>
                  ₹{foodBalance.toLocaleString()}
                </p>
                <p className="text-[9px] text-muted-foreground">Advance: ₹{foodAdvance}</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-[10px] uppercase text-destructive font-bold">Total Due</p>
                <p className="text-lg font-bold text-destructive">₹{(student.dueAmount || 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-4">
          <TabsTrigger value="payments" className="flex gap-2"><CreditCard size={14} /> Payment History</TabsTrigger>
          <TabsTrigger value="meals" className="flex gap-2"><Utensils size={14} /> Meal Logs & Calculations</TabsTrigger>
        </TabsList>
        
        <TabsContent value="payments">
          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Month/Year</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments?.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.date?.toDate()?.toLocaleDateString() || "N/A"}</TableCell>
                      <TableCell>{p.month} {p.year}</TableCell>
                      <TableCell><Badge variant="outline">{p.paymentType}</Badge></TableCell>
                      <TableCell className="text-right font-bold text-success">₹{p.amount?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {payments?.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No payments recorded yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meals">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-6">
              <Card className="border-none shadow-sm h-fit">
                <CardHeader>
                  <CardTitle className="text-sm">Log Daily Meal</CardTitle>
                  <CardDescription>Track food consumption.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Meal Count</Label>
                    <Input type="number" value={mealCount} onChange={e => setMealCount(e.target.value)} />
                  </div>
                  <Button className="w-full gap-2" onClick={logMeal} disabled={isUpdating}>
                    <CheckCircle2 size={16} /> Log Today's Meal
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm h-fit">
                <CardHeader>
                  <CardTitle className="text-sm">Meal Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!editRate ? (
                    <div className="flex justify-between items-center">
                      <div className="text-sm">
                        <p className="text-muted-foreground">Current Rate</p>
                        <p className="font-bold text-lg">₹{student.foodRate || 0}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => {
                        setNewRate(student.foodRate?.toString() || "")
                        setEditRate(true)
                      }}>Change</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>New Meal Rate (₹)</Label>
                      <div className="flex gap-2">
                        <Input type="number" value={newRate} onChange={e => setNewRate(e.target.value)} />
                        <Button size="sm" onClick={updateMealRate} disabled={isUpdating}>Save</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="md:col-span-2 border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm">Recent Logs</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Cost (Est.)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meals?.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.date}</TableCell>
                        <TableCell className="font-bold">{m.count}</TableCell>
                        <TableCell className="text-muted-foreground">{m.month} {m.year}</TableCell>
                        <TableCell className="text-right">₹{(m.count * (student.foodRate || 0)).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {meals?.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No meal records found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
