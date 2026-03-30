"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase"
import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Building2, MapPin, DoorOpen, Users, UserCheck, UserMinus, Trash2, Edit, Loader2, Plus, CheckCircle2, XCircle, Zap, LayoutGrid } from "lucide-react"
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
import { cn } from "@/lib/utils"

interface SeatDetail {
  seatNo: string;
  status: 'empty' | 'occupied';
}

interface RoomDetail {
  roomNo: string;
  totalSeats: number;
  seats: SeatDetail[];
}

interface ApartmentDetail {
  id: string;
  name: string;
  meterNo: string;
  rooms: RoomDetail[];
}

export default function BuildingDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const id = params.id
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const buildingRef = useMemoFirebase(() => id ? doc(db, "buildings", id) : null, [db, id])
  const { data: building, isLoading } = useDoc(buildingRef)

  const [editForm, setEditForm] = useState({ name: "", address: "" })
  const [editApts, setEditApts] = useState<ApartmentDetail[]>([])

  useMemo(() => {
    if (building) {
      setEditForm({ name: building.name, address: building.address })
      setEditApts(building.apartmentsDetail || [])
    }
  }, [building])

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
        apartmentsDetail: editApts,
        apartmentsCount: editApts.length,
        totalSeats: total,
        occupiedSeats: occupied,
        emptySeats: total - occupied,
        updatedAt: serverTimestamp()
      })
      setIsEditDialogOpen(false)
      toast({ title: "Updated", description: "Hierarchy saved." })
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

  return (
    <div className="space-y-6">
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
                  <DialogTitle>Edit Building Hierarchy</DialogTitle>
                  <DialogDescription>Manage Apartments, Meters, and Rooms.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Building Name</Label>
                        <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Address</Label>
                        <Input value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                      </div>
                   </div>
                   <p className="text-sm font-bold text-muted-foreground uppercase border-b pb-2">Apartments & Hierarchy (Read-only status in edit)</p>
                   <div className="space-y-6">
                      {editApts.map((apt, aIdx) => (
                        <div key={apt.id} className="p-4 border-2 rounded-xl bg-secondary/5 space-y-4">
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
                               <div key={room.roomNo} className="p-3 bg-background border rounded-lg">
                                  <div className="flex justify-between items-center mb-2">
                                     <span className="text-xs font-bold uppercase">Room {room.roomNo}</span>
                                     <Badge variant="secondary">{room.totalSeats} Seats</Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-none">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div><p className="text-xs text-muted-foreground uppercase font-bold">Total Seats</p><p className="text-2xl font-bold">{building.totalSeats}</p></div>
              <Users className="text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-none">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div><p className="text-xs text-success uppercase font-bold">Occupied</p><p className="text-2xl font-bold text-success">{building.occupiedSeats}</p></div>
              <UserCheck className="text-success" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-none">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div><p className="text-xs text-destructive uppercase font-bold">Empty</p><p className="text-2xl font-bold text-destructive">{building.emptySeats}</p></div>
              <UserMinus className="text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-secondary/50 border-none">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div><p className="text-xs text-muted-foreground uppercase font-bold">Apartments</p><p className="text-2xl font-bold">{building.apartmentsCount || 0}</p></div>
              <LayoutGrid className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        {building.apartmentsDetail?.map((apt: any) => (
          <div key={apt.id} className="space-y-4">
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
                {apt.rooms?.map((room: any) => (
                  <Card key={room.roomNo} className="border-none shadow-sm overflow-hidden">
                    <div className="h-1.5 bg-primary/20 w-full" />
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Room {room.roomNo}</CardTitle>
                      <Badge variant="secondary" className="w-fit">{room.totalSeats} Seats</Badge>
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
