"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, MapPin, Plus, DoorOpen, Loader2, Users, UserCheck, UserMinus, Trash2, CheckCircle2, XCircle, Zap, LayoutGrid } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from "@/firebase"
import { collection, serverTimestamp } from "firebase/firestore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

interface SeatDetail {
  seatNo: string;
  status: 'empty' | 'occupied';
}

interface RoomDetail {
  roomNo: string;
  seatCount: string;
  seats: SeatDetail[];
}

interface ApartmentDetail {
  name: string;
  meterNo: string;
  rooms: RoomDetail[];
}

export default function BuildingsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [newBuilding, setNewBuilding] = useState({ 
    name: "", 
    address: ""
  })
  
  const [apartments, setApartments] = useState<ApartmentDetail[]>([
    { name: "", meterNo: "", rooms: [{ roomNo: "", seatCount: "", seats: [] }] }
  ])

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings, isLoading } = useCollection(buildingsQuery)

  const addApartment = () => {
    setApartments([...apartments, { name: "", meterNo: "", rooms: [{ roomNo: "", seatCount: "", seats: [] }] }])
  }

  const removeApartment = (idx: number) => {
    if (apartments.length > 1) setApartments(apartments.filter((_, i) => i !== idx))
  }

  const addRoomToApartment = (aptIdx: number) => {
    const updated = [...apartments]
    updated[aptIdx].rooms.push({ roomNo: "", seatCount: "", seats: [] })
    setApartments(updated)
  }

  const removeRoomFromApartment = (aptIdx: number, roomIdx: number) => {
    const updated = [...apartments]
    if (updated[aptIdx].rooms.length > 1) {
      updated[aptIdx].rooms = updated[aptIdx].rooms.filter((_, i) => i !== roomIdx)
      setApartments(updated)
    }
  }

  const updateApartmentField = (aptIdx: number, field: keyof ApartmentDetail, value: string) => {
    const updated = [...apartments]
    ;(updated[aptIdx] as any)[field] = value
    setApartments(updated)
  }

  const updateRoomField = (aptIdx: number, roomIdx: number, field: keyof RoomDetail, value: string) => {
    const updated = [...apartments]
    const room = updated[aptIdx].rooms[roomIdx]
    
    if (field === "seatCount") {
      const count = parseInt(value) || 0
      room.seats = Array.from({ length: count }, (_, i) => ({
        seatNo: (i + 1).toString(),
        status: 'empty'
      }))
      room.seatCount = value
    } else {
      (room as any)[field] = value
    }
    setApartments(updated)
  }

  const toggleSeatStatus = (aptIdx: number, roomIdx: number, seatIdx: number) => {
    const updated = [...apartments]
    const current = updated[aptIdx].rooms[roomIdx].seats[seatIdx].status
    updated[aptIdx].rooms[roomIdx].seats[seatIdx].status = current === 'empty' ? 'occupied' : 'empty'
    setApartments(updated)
  }

  const stats = useMemo(() => {
    let total = 0
    let occupied = 0
    apartments.forEach(apt => {
      apt.rooms.forEach(room => {
        room.seats.forEach(seat => {
          total++
          if (seat.status === 'occupied') occupied++
        })
      })
    })
    return { total, occupied, empty: total - occupied }
  }, [apartments])

  const handleCreate = () => {
    if (!newBuilding.name || !newBuilding.address) {
      toast({ variant: "destructive", title: "Error", description: "Name and Address are required." })
      return
    }

    const validApts = apartments.filter(a => a.name && a.rooms.length > 0)
    if (validApts.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Add at least one apartment with rooms." })
      return
    }

    addDocumentNonBlocking(collection(db, "buildings"), {
      ...newBuilding,
      apartmentsCount: validApts.length,
      apartmentsDetail: validApts.map(apt => ({
        id: Math.random().toString(36).substr(2, 9),
        name: apt.name,
        meterNo: apt.meterNo,
        rooms: apt.rooms.filter(r => r.roomNo).map(r => ({
          roomNo: r.roomNo,
          totalSeats: r.seats.length,
          seats: r.seats
        }))
      })),
      totalSeats: stats.total,
      occupiedSeats: stats.occupied,
      emptySeats: stats.empty,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    setOpen(false)
    setNewBuilding({ name: "", address: "" })
    setApartments([{ name: "", meterNo: "", rooms: [{ roomNo: "", seatCount: "", seats: [] }] }])
    toast({ title: "Building Created", description: "Hierarchy Apartment -> Room -> Seat saved." })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Buildings</h1>
            <p className="text-muted-foreground mt-1">Manage Apartment &rarr; Room &rarr; Seat hierarchy.</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex gap-2">
              <Plus size={18} /> Add New Building
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Building</DialogTitle>
              <DialogDescription>Define apartments with meters, rooms, and seats.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Building Name</Label>
                  <Input value={newBuilding.name} onChange={e => setNewBuilding({...newBuilding, name: e.target.value})} placeholder="Dream Haven" />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={newBuilding.address} onChange={e => setNewBuilding({...newBuilding, address: e.target.value})} placeholder="Location" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="font-bold">Apartment Configuration</Label>
                  <Button variant="outline" size="sm" onClick={addApartment} className="h-8"><Plus size={14} className="mr-1" /> Add Apartment</Button>
                </div>

                <ScrollArea className="h-[400px] border rounded-md p-4">
                  <div className="space-y-8">
                    {apartments.map((apt, aptIdx) => (
                      <div key={aptIdx} className="p-4 border-2 rounded-xl bg-secondary/5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase">Apt Name/No</Label>
                            <Input value={apt.name} placeholder="e.g. C2" onChange={e => updateApartmentField(aptIdx, "name", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase flex items-center gap-1"><Zap size={10} className="text-primary"/> Meter No.</Label>
                            <Input value={apt.meterNo} placeholder="Meter ID" onChange={e => updateApartmentField(aptIdx, "meterNo", e.target.value)} />
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeApartment(aptIdx)} className="text-destructive h-10">
                            <Trash2 size={16} />
                          </Button>
                        </div>

                        <div className="ml-4 space-y-4 pl-4 border-l-2 border-primary/20">
                          {apt.rooms.map((room, roomIdx) => (
                            <div key={roomIdx} className="space-y-3 bg-background p-3 rounded-lg border">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-bold">Room No.</Label>
                                  <Input value={room.roomNo} placeholder="301" onChange={e => updateRoomField(aptIdx, roomIdx, "roomNo", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-bold">Seat Count</Label>
                                  <Input type="number" value={room.seatCount} placeholder="Seats" onChange={e => updateRoomField(aptIdx, roomIdx, "seatCount", e.target.value)} />
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeRoomFromApartment(aptIdx, roomIdx)} className="text-destructive">
                                  <XCircle size={16} />
                                </Button>
                              </div>

                              <div className="flex flex-wrap gap-1.5">
                                {room.seats.map((seat, sIdx) => (
                                  <button
                                    key={sIdx}
                                    onClick={() => toggleSeatStatus(aptIdx, roomIdx, sIdx)}
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
                          <Button variant="ghost" size="sm" onClick={() => addRoomToApartment(aptIdx)} className="text-primary h-8"><Plus size={14} className="mr-1"/> Add Room to {apt.name || 'Apt'}</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                 <div className="text-center bg-primary/5 p-2 rounded border">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold">Total Seats</p>
                    <p className="text-xl font-bold text-primary">{stats.total}</p>
                 </div>
                 <div className="text-center bg-success/5 p-2 rounded border">
                    <p className="text-[10px] uppercase text-success font-bold">Occupied</p>
                    <p className="text-xl font-bold text-success">{stats.occupied}</p>
                 </div>
                 <div className="text-center bg-destructive/5 p-2 rounded border">
                    <p className="text-[10px] uppercase text-destructive font-bold">Empty</p>
                    <p className="text-xl font-bold text-destructive">{stats.empty}</p>
                 </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} className="w-full h-12 text-lg">Save Building Configuration</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {buildings?.map((building: any) => (
            <Card key={building.id} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all">
              <div className="h-2 bg-primary w-full" />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">{building.name}</CardTitle>
                  <Building2 className="text-primary/40" />
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin size={12} /> <span>{building.address}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 mt-2">
                   <div className="bg-secondary/50 p-2 rounded flex items-center gap-2">
                      <LayoutGrid size={14} className="text-primary" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Apartments</p>
                        <p className="text-sm font-bold">{building.apartmentsCount || 0}</p>
                      </div>
                   </div>
                   <div className="bg-secondary/50 p-2 rounded flex items-center gap-2">
                      <Users size={14} className="text-primary" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Seats</p>
                        <p className="text-sm font-bold">{building.totalSeats}</p>
                      </div>
                   </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => router.push(`/buildings/${building.id}`)}>View Details</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
