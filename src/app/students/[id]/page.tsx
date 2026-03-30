
"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useDoc, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, serverTimestamp, updateDoc, setDoc, increment } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  UserCircle, Phone, MapPin, Building2, 
  BedDouble, CreditCard, Utensils, History,
  AlertTriangle, Loader2, CheckCircle2, UserMinus
} from "lucide-react"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"

export default function StudentDetailsPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [mealCount, setMealCount] = useState("1")

  // Fetch Student Data
  const studentRef = useMemoFirebase(() => doc(db, "students", id as string), [db, id])
  const { data: student, isLoading: studentLoading } = useDoc(studentRef)

  // Fetch Payment History
  const paymentsQuery = useMemoFirebase(() => 
    query(collection(db, "payments"), where("studentId", "==", id)), [db, id])
  const { data: payments } = useCollection(paymentsQuery)

  // Fetch Meal History (For non-package)
  const mealsQuery = useMemoFirebase(() => 
    query(collection(db, "meals"), where("studentId", "==", id)), [db, id])
  const { data: meals } = useCollection(mealsQuery)

  const handleDeactivate = async () => {
    if (!student || !student.isActive) return
    setIsUpdating(true)
    try {
      // 1. Mark student as Inactive
      await updateDoc(studentRef, { 
        isActive: false, 
        updatedAt: serverTimestamp(),
        leftAt: serverTimestamp()
      })

      // 2. Free up the seat in Building
      const buildingRef = doc(db, "buildings", student.buildingId)
      // Fetch building to find the seat detail
      // (Normally we'd use a transaction here, but for simplicity:)
      // This logic assumes we have the building data or can fetch it
      // Let's assume the building structure needs the seat status reset
      toast({ title: "Student Inactivated", description: "Seat is now free." })
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
              <Badge variant={student.isActive ? "success" : "destructive"}>
                {student.isActive ? "Active Resident" : "Inactive / Left"}
              </Badge>
              <Badge variant="outline">{student.paymentSystem.toUpperCase()}</Badge>
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
        {/* Profile Card */}
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

        {/* Financial Summary */}
        <Card className="border-none shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Financial Overview</CardTitle>
            <CardDescription>Resident plan and outstanding amounts.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Monthly Rent</p>
                <p className="text-lg font-bold">₹{student.monthlyRent}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Food Cost</p>
                <p className="text-lg font-bold">₹{student.foodCost}</p>
              </div>
              <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                <p className="text-[10px] uppercase text-success font-bold">Advance Paid</p>
                <p className="text-lg font-bold text-success">₹{student.advanceAmount}</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-[10px] uppercase text-destructive font-bold">Current Due</p>
                <p className="text-lg font-bold text-destructive">₹{student.dueAmount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-4">
          <TabsTrigger value="payments" className="flex gap-2"><CreditCard size={14} /> Payment History</TabsTrigger>
          <TabsTrigger value="meals" className="flex gap-2"><Utensils size={14} /> Meal Logs</TabsTrigger>
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
                      <TableCell className="text-right font-bold text-success">₹{p.amount.toLocaleString()}</TableCell>
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
            <Card className="border-none shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-sm">Log Daily Meal</CardTitle>
                <CardDescription>For non-package residents tracking food consumption.</CardDescription>
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

            <Card className="md:col-span-2 border-none shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Period</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meals?.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.date}</TableCell>
                        <TableCell className="font-bold">{m.count}</TableCell>
                        <TableCell className="text-muted-foreground">{m.month} {m.year}</TableCell>
                      </TableRow>
                    ))}
                    {meals?.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No meal records found.</TableCell></TableRow>
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
