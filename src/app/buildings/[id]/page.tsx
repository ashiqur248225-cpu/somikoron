
"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, updateDoc, deleteDoc, serverTimestamp, collection, query, where } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { 
  Building2, MapPin, DoorOpen, Users, UserCheck, 
  UserMinus, Trash2, Edit, Loader2, Plus, CheckCircle2, 
  XCircle, Zap, LayoutGrid, Calculator, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Banknote, Calendar, BarChart3,
  CircleDollarSign, Percent, Wind, Construction, Bath
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"

interface SeatDetail {
  seatNo: string;
  status: 'empty' | 'occupied';
}

interface RoomDetail {
  roomNo: string;
  totalSeats: number;
  seats: SeatDetail[];
  rentPerSeat?: number;
  facilities?: string[];
}

interface ApartmentDetail {
  id: string;
  name: string;
  meterNo: string;
  rooms: RoomDetail[];
}

export default function BuildingDetailsPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<any>
}) {
  const { id } = React.use(params)
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const buildingRef = useMemoFirebase(() => id ? doc(db, "buildings", id) : null, [db, id])
  const { data: building, isLoading } = useDoc(buildingRef)

  // Fetch Payments for recent collection analytics
  const paymentsQuery = useMemoFirebase(() => {
    if (!id) return null
    return query(collection(db, "payments"), where("buildingId", "==", id))
  }, [db, id])
  const { data: payments } = useCollection(paymentsQuery)

  const [editForm, setEditForm] = useState({ name: "", address: "", buildingRentCost: "0" })
  const [editApts, setEditApts] = useState<ApartmentDetail[]>([])

  useMemo(() => {
    if (building) {
      setEditForm({ 
        name: building.name, 
        address: building.address,
        buildingRentCost: (building.buildingRentCost || 0).toString() 
      })
      setEditApts(building.apartmentsDetail || [])
    }
  }, [building])

  // Advanced Financial Analytics Memo
  const revenueStats = useMemo(() => {
    if (!building) return { 
      expectedIncome: 0, 
      occupiedRevenue: 0, 
      efficiency: 0,
      thisMonthCollected: 0,
      last30DaysCollected: 0,
      last7DaysCollected: 0,
      netProfit: 0,
      roomRevenueList: []
    }

    let expectedIncome = 0
    let occupiedRevenue = 0
    const roomRevenueList: any[] = []

    building.apartmentsDetail?.forEach((apt: any) => {
      apt.rooms?.forEach((room: any) => {
        const rentPerSeat = Number(room.rentPerSeat || 0)
        const roomExpected = room.totalSeats * rentPerSeat
        const occCount = room.seats.filter((s: any) => s.status === 'occupied').length
        const roomCurrent = occCount * rentPerSeat
        
        expectedIncome += roomExpected
        occupiedRevenue += roomCurrent

        roomRevenueList.push({
          roomNo: room.roomNo,
          aptName: apt.name,
          totalSeats: room.totalSeats,
          occupiedSeats: occCount,
          rentPerSeat,
          expected: roomExpected,
          current: roomCurrent,
          vacancyImpact: roomExpected - roomCurrent
        })
      })
    })

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    let thisMonthCollected = 0
    let last30DaysCollected = 0
    let last7DaysCollected = 0

    payments?.forEach(p => {
      const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date)
      const amount = Number(p.amount || 0)
      
      if (pDate >= startOfMonth) thisMonthCollected += amount
      if (pDate >= thirtyDaysAgo) last30DaysCollected += amount
      if (pDate >= sevenDaysAgo) last7DaysCollected += amount
    })

    const efficiency = expectedIncome > 0 ? (occupiedRevenue / expectedIncome) * 100 : 0
    const netProfit = last30DaysCollected - (building.buildingRentCost || 0)

    return { 
      expectedIncome, 
      occupiedRevenue, 
      efficiency, 
      thisMonthCollected, 
      last30DaysCollected, 
      last7DaysCollected, 
      netProfit,
      roomRevenueList
    }
  }, [building, payments])

  const handleUpdate = async () => {
    if (!buildingRef) return
    setIsUpdating(true)
    
    let total = 0
    let occupied = 0
    editApts.forEach(apt => {
      apt.rooms.forEach(room => {
        room.seats.forEach(seat => {
          total++
          if (seat.status === 'occupied') occupied++
        })
      })
    })

    try {
      await updateDoc(buildingRef, {
        ...editForm,
        buildingRentCost: Number(editForm.buildingRentCost || 0),
        apartmentsDetail: editApts,
        apartmentsCount: editApts.length,
        totalSeats: total,
        occupiedSeats: occupied,
        emptySeats: total - occupied,
        updatedAt: serverTimestamp()
      })
      setIsEditDialogOpen(false)
      toast({ title: "Updated", description: "Hierarchy and financials saved." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!buildingRef) return
    setIsUpdating(true)
    try {
      await deleteDoc(buildingRef)
      toast({ title: "Deleted", description: "Building removed." })
      router.push("/buildings")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
  if (!building) return <div className="text-center p-20">Building not found.</div>

  const toggleFacility = (aptIdx: number, roomIdx: number, facility: string) => {
    const updated = [...editApts]
    const currentRoom = updated[aptIdx].rooms[roomIdx]
    if (!currentRoom.facilities) currentRoom.facilities = []
    
    if (currentRoom.facilities.includes(facility)) {
      currentRoom.facilities = currentRoom.facilities.filter(f => f !== facility)
    } else {
      currentRoom.facilities.push(facility)
    }
    setEditApts(updated)
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-xl text-primary"><Building2 size={32} /></div>
          <div>
            <h1 className="text-3xl font-bold">{building.name}</h1>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <MapPin size={14} /> <span>{building.address}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
             <DialogTrigger asChild>
               <Button variant="outline" className="gap-2"><Edit size={16} /> Edit Building</Button>
             </DialogTrigger>
             <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Building & Financials</DialogTitle>
                  <DialogDescription>Manage Apartments, Meters, Rooms and Rent rates.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Building Name</Label>
                        <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Address</Label>
                        <Input value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-primary font-bold">Building Monthly Rent (৳)</Label>
                        <Input type="number" value={editForm.buildingRentCost} onChange={e => setEditForm({...editForm, buildingRentCost: e.target.value})} />
                      </div>
                   </div>
                   <p className="text-sm font-bold text-muted-foreground uppercase border-b pb-2">Apartments & Revenue Setup</p>
                   <div className="space-y-6">
                      {editApts.map((apt, aIdx) => (
                        <div key={apt.id || aIdx} className="p-4 border-2 rounded-xl bg-secondary/5 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase font-bold">Apt Name</Label>
                              <Input value={apt.name} onChange={e => {
                                const updated = [...editApts]
                                updated[aIdx].name = e.target.value
                                setEditApts(updated)
                              }} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase font-bold">Meter No</Label>
                              <Input value={apt.meterNo} onChange={e => {
                                const updated = [...editApts]
                                updated[aIdx].meterNo = e.target.value
                                setEditApts(updated)
                              }} />
                            </div>
                          </div>
                          <div className="ml-4 pl-4 border-l-2 border-primary/20 space-y-4">
                             {apt.rooms.map((room, rIdx) => (
                               <div key={`${room.roomNo}-${rIdx}`} className="p-3 bg-background border rounded-lg space-y-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold uppercase">Room {room.roomNo}</span>
                                        <Badge variant="secondary">{room.totalSeats} Seats</Badge>
                                     </div>
                                     <div className="flex items-center gap-2">
                                        <Label className="text-[9px] uppercase font-bold text-primary">Rent Per Seat (৳)</Label>
                                        <Input type="number" className="h-7 text-xs w-24" value={room.rentPerSeat || ""} onChange={e => {
                                          const updated = [...editApts]
                                          updated[aIdx].rooms[rIdx].rentPerSeat = Number(e.target.value)
                                          setEditApts(updated)
                                        }} />
                                     </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Room Facilities</Label>
                                    <div className="flex flex-wrap gap-4">
                                      {['AC', 'Balcony', 'Attached Washroom'].map((fac) => (
                                        <div key={fac} className="flex items-center gap-1.5">
                                          <Checkbox 
                                            id={`edit-fac-${aIdx}-${rIdx}-${fac}`}
                                            checked={room.facilities?.includes(fac)}
                                            onCheckedChange={() => toggleFacility(aIdx, rIdx, fac)}
                                          />
                                          <Label htmlFor={`edit-fac-${aIdx}-${rIdx}-${fac}`} className="text-[10px] cursor-pointer">{fac}</Label>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-1.5 pt-2 border-t mt-2">
                                    {room.seats.map((seat, sIdx) => (
                                      <button
                                        key={sIdx}
                                        onClick={() => {
                                          const updated = [...editApts]
                                          const current = updated[aIdx].rooms[rIdx].seats[sIdx].status
                                          updated[aIdx].rooms[rIdx].seats[sIdx].status = current === 'empty' ? 'occupied' : 'empty'
                                          setEditApts(updated)
                                        }}
                                        className={cn(
                                          "px-2 py-1 rounded text-[10px] font-bold border",
                                          seat.status === 'occupied' ? "bg-success/10 border-success text-success" : "bg-destructive/10 border-destructive text-destructive"
                                        )}
                                      >
                                        S-{seat.seatNo}
                                      </button>
                                    ))}
                                  </div>
                               </div>
                             ))}
                          </div>
                        </div>
                      ))}
                   </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleUpdate} disabled={isUpdating} className="w-full">
                    {isUpdating ? <Loader2 className="animate-spin" /> : "Save Changes"}
                  </Button>
                </DialogFooter>
             </DialogContent>
           </Dialog>

           <AlertDialog>
             <AlertDialogTrigger asChild>
               <Button variant="destructive" size="icon"><Trash2 size={16}/></Button>
             </AlertDialogTrigger>
             <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Building?</AlertDialogTitle>
                  <AlertDialogDescription>Hierarchy Apartment &rarr; Room &rarr; Seat will be lost.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction>
                </AlertDialogFooter>
             </AlertDialogContent>
           </AlertDialog>
           <Button variant="ghost" onClick={() => router.push("/buildings")}>Back</Button>
        </div>
      </div>

      {/* Summary Analytics Cards - Arranged 3 then 2 */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Building Rent</p>
                  <p className="text-xl font-bold mt-1">৳{(building.buildingRentCost || 0).toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Banknote size={20} /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Expected Rev.</p>
                  <p className="text-xl font-bold mt-1">৳{revenueStats.expectedIncome.toLocaleString()}</p>
                </div>
                <div className="bg-primary/5 p-2 rounded-lg text-primary"><TrendingUp size={20} /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white border-l-4 border-l-orange-500">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Occupied Rev.</p>
                  <p className="text-xl font-bold mt-1">৳{revenueStats.occupiedRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Users size={20} /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-none shadow-sm bg-white border-l-4 border-l-success">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Recent Collect</p>
                  <p className="text-xl font-bold mt-1 text-success">৳{revenueStats.last30DaysCollected.toLocaleString()}</p>
                </div>
                <div className="bg-success/5 p-2 rounded-lg text-success"><CircleDollarSign size={20} /></div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "border-none shadow-sm bg-white border-l-4",
            revenueStats.netProfit >= 0 ? "border-l-success" : "border-l-destructive"
          )}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Net Profit/Loss</p>
                  <p className={cn(
                    "text-xl font-bold mt-1",
                    revenueStats.netProfit >= 0 ? "text-success" : "text-destructive"
                  )}>৳{revenueStats.netProfit.toLocaleString()}</p>
                </div>
                <div className={cn(
                  "p-2 rounded-lg",
                  revenueStats.netProfit >= 0 ? "bg-success/5 text-success" : "bg-destructive/5 text-destructive"
                )}>{revenueStats.netProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Revenue Efficiency Card */}
          <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Percent className="text-primary" size={18} />
                  <CardTitle className="text-sm font-bold uppercase tracking-tight">Revenue Efficiency Insight</CardTitle>
                </div>
                <Badge variant="outline" className="font-black text-primary bg-white">{revenueStats.efficiency.toFixed(1)}%</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                  <span>Current Occupied Earnings</span>
                  <span>Full Potential</span>
                </div>
                <Progress value={revenueStats.efficiency} className="h-3 bg-secondary" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Building is currently operating at <span className="font-bold text-primary">{revenueStats.efficiency.toFixed(1)}%</span> of its total earning capacity. 
                  Vacant seats are causing a monthly loss of <span className="font-bold text-destructive">৳{(revenueStats.expectedIncome - revenueStats.occupiedRevenue).toLocaleString()}</span>.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Room Wise Revenue Table */}
          <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-primary" size={18} />
                <CardTitle className="text-sm font-bold uppercase tracking-tight">Room Wise Revenue Matrix</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-bold">Room</TableHead>
                    <TableHead className="text-center font-bold">Seats</TableHead>
                    <TableHead className="text-center font-bold">Occ.</TableHead>
                    <TableHead className="text-right font-bold">Rent</TableHead>
                    <TableHead className="text-right font-bold">Expected</TableHead>
                    <TableHead className="text-right font-bold">Current</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueStats.roomRevenueList.map((room: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-bold">R-{room.roomNo}<br/><span className="text-[10px] text-muted-foreground font-normal">{room.aptName}</span></TableCell>
                      <TableCell className="text-center font-medium">{room.totalSeats}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn(
                          "text-[10px] font-black",
                          room.occupiedSeats === room.totalSeats ? "border-success text-success" : "border-orange-400 text-orange-600"
                        )}>
                          {room.occupiedSeats}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-600">৳{room.rentPerSeat}</TableCell>
                      <TableCell className="text-right font-bold">৳{room.expected.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-black text-primary">৳{room.current.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Collection Logs Summary */}
          <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <div className="flex items-center gap-2">
                <Calculator className="text-primary" size={18} />
                <CardTitle className="text-sm font-bold uppercase tracking-tight">Recent Collections</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-dashed">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Last 7 Days</p>
                  <p className="text-lg font-bold">৳{revenueStats.last7DaysCollected.toLocaleString()}</p>
                </div>
                <ArrowUpRight className="text-success" />
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-dashed">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Last 30 Days</p>
                  <p className="text-lg font-bold">৳{revenueStats.last30DaysCollected.toLocaleString()}</p>
                </div>
                <ArrowUpRight className="text-success" />
              </div>
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase text-primary tracking-widest">This Calendar Month</p>
                  <p className="text-xl font-black text-primary">৳{revenueStats.thisMonthCollected.toLocaleString()}</p>
                </div>
                <div className="bg-primary/10 p-2 rounded-full text-primary"><Calendar size={18}/></div>
              </div>
            </CardContent>
          </Card>

          {/* Occupancy Summary Stats */}
          <div className="grid grid-cols-1 gap-4">
            <Card className="bg-primary/5 border-none shadow-none">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <div><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Total Seats</p><p className="text-2xl font-black text-slate-800">{building.totalSeats}</p></div>
                  <Users className="text-primary/40" size={32} />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-success/5 border-none shadow-none">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <div><p className="text-[10px] text-success uppercase font-bold tracking-widest">Occupied</p><p className="text-2xl font-black text-success">{building.occupiedSeats}</p></div>
                  <UserCheck className="text-success/40" size={32} />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-destructive/5 border-none shadow-none">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <div><p className="text-[10px] text-destructive uppercase font-bold tracking-widest">Empty/Lost</p><p className="text-2xl font-black text-destructive">{building.emptySeats}</p></div>
                  <UserMinus className="text-destructive/40" size={32} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Existing Physical Hierarchy View */}
      <div className="space-y-8">
        <h2 className="text-lg font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <LayoutGrid size={20} /> Physical Structure & Allocation
        </h2>
        {building.apartmentsDetail?.map((apt: any, aIdx: number) => (
          <div key={apt.id || aIdx} className="space-y-4">
             <div className="flex items-center gap-4 bg-secondary/30 p-4 rounded-xl border">
                <div className="bg-primary/10 p-2 rounded-lg text-primary"><LayoutGrid size={24} /></div>
                <div className="flex-1">
                   <h2 className="text-xl font-bold">{apt.name}</h2>
                   <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Zap size={12} className="text-primary" /> Meter: {apt.meterNo}</span>
                      <span className="flex items-center gap-1"><DoorOpen size={12} /> {apt.rooms?.length} Rooms</span>
                   </div>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ml-4">
                {apt.rooms?.map((room: any, rIdx: number) => (
                  <Card key={`${room.roomNo}-${rIdx}`} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all">
                    <div className="h-1.5 bg-primary/20 w-full" />
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">Room {room.roomNo}</CardTitle>
                          <Badge variant="secondary" className="w-fit text-[9px] uppercase mt-1">৳{room.rentPerSeat}/seat</Badge>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {room.facilities?.map((f: string) => (
                              <Badge key={f} variant="outline" className="text-[7px] py-0 px-1 border-primary/30 text-primary uppercase font-bold">
                                {f}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Badge variant="outline" className="font-bold text-muted-foreground">{room.totalSeats} Seats</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {room.seats?.map((seat: any, sIdx: number) => (
                          <div 
                            key={sIdx}
                            className={cn(
                              "flex flex-col items-center justify-center p-2 rounded-md border w-14",
                              seat.status === 'occupied' ? "bg-success/10 border-success text-success" : "bg-destructive/10 border-destructive text-destructive"
                            )}
                          >
                            <span className="text-[10px] font-bold">S-{seat.seatNo}</span>
                            {seat.status === 'occupied' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
             </div>
          </div>
        ))}
      </div>
    </div>
  )
}
