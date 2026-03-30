
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, MapPin, Plus, DoorOpen, Loader2, Users, UserCheck, UserMinus, Trash2, CheckCircle2, Circle, XCircle } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface SeatDetail {
  seatNo: string;
  status: 'empty' | 'occupied';
}

interface RoomDetail {
  roomNo: string;
  seatCount: string;
  seats: SeatDetail[];
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
  const [rooms, setRooms] = useState<RoomDetail[]>([{ roomNo: "", seatCount: "", seats: [] }])

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings, isLoading } = useCollection(buildingsQuery)

  const addRoomField = () => {
    setRooms([...rooms, { roomNo: "", seatCount: "", seats: [] }])
  }

  const removeRoomField = (index: number) => {
    if (rooms.length > 1) {
      setRooms(rooms.filter((_, i) => i !== index))
    }
  }

  const updateRoomField = (index: number, field: keyof RoomDetail, value: string) => {
    const updatedRooms = [...rooms]
    if (field === "seatCount") {
      const count = parseInt(value) || 0
      const currentSeats = updatedRooms[index].seats
      
      // Generate or update seats
      const newSeats: SeatDetail[] = Array.from({ length: count }, (_, i) => ({
        seatNo: (i + 1).toString(),
        status: currentSeats[i]?.status || 'empty'
      }))
      
      updatedRooms[index].seats = newSeats
      updatedRooms[index].seatCount = value
    } else if (field === "roomNo") {
      updatedRooms[index].roomNo = value
    }
    setRooms(updatedRooms)
  }

  const toggleSeatStatus = (roomIdx: number, seatIdx: number) => {
    const updatedRooms = [...rooms]
    const currentStatus = updatedRooms[roomIdx].seats[seatIdx].status
    updatedRooms[roomIdx].seats[seatIdx].status = currentStatus === 'empty' ? 'occupied' : 'empty'
    setRooms(updatedRooms)
  }

  const stats = useMemo(() => {
    let total = 0
    let occupied = 0
    rooms.forEach(room => {
      room.seats.forEach(seat => {
        total++
        if (seat.status === 'occupied') occupied++
      })
    })
    return { total, occupied, empty: total - occupied }
  }, [rooms])

  const handleCreate = () => {
    if (!newBuilding.name || !newBuilding.address) {
      toast({ variant: "destructive", title: "Error", description: "Please fill building name and address." })
      return
    }

    const validRooms = rooms.filter(r => r.roomNo && r.seats.length > 0)
    if (validRooms.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Please add at least one room with seats." })
      return
    }

    addDocumentNonBlocking(collection(db, "buildings"), {
      ...newBuilding,
      roomsCount: validRooms.length,
      roomsDetail: validRooms.map(r => ({ 
        roomNo: r.roomNo, 
        totalSeats: r.seats.length,
        seats: r.seats 
      })),
      totalSeats: stats.total,
      occupiedSeats: stats.occupied,
      emptySeats: stats.empty,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    setNewBuilding({ name: "", address: "" })
    setRooms([{ roomNo: "", seatCount: "", seats: [] }])
    setOpen(false)
    toast({ title: "Building Created", description: "Hostel property successfully added." })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Building Management</h1>
          <p className="text-muted-foreground mt-1">Manage rooms and seat assignments.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex gap-2">
              <Plus size={18} /> Add New Building
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Building</DialogTitle>
              <DialogDescription>Define rooms, auto-generate seats, and mark their current status.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Building Name</Label>
                  <Input 
                    value={newBuilding.name} 
                    onChange={(e) => setNewBuilding({...newBuilding, name: e.target.value})}
                    placeholder="e.g. Dream Haven" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input 
                    value={newBuilding.address} 
                    onChange={(e) => setNewBuilding({...newBuilding, address: e.target.value})}
                    placeholder="Location details" 
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-bold">Room & Seat Configuration</Label>
                  <Button variant="outline" size="sm" onClick={addRoomField} className="flex gap-1 h-8">
                    <Plus size={14} /> Add Room
                  </Button>
                </div>
                
                <ScrollArea className="h-[350px] pr-4 border rounded-md p-4">
                  <div className="space-y-6">
                    {rooms.map((room, roomIdx) => (
                      <div key={roomIdx} className="space-y-4 p-4 border rounded-lg bg-secondary/10">
                        <div className="flex gap-4 items-end">
                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px] uppercase font-bold">Room No.</Label>
                            <Input 
                              value={room.roomNo}
                              placeholder="e.g. 101"
                              onChange={(e) => updateRoomField(roomIdx, "roomNo", e.target.value)}
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px] uppercase font-bold">No. of Seats</Label>
                            <Input 
                              type="number"
                              value={room.seatCount}
                              placeholder="Enter count"
                              onChange={(e) => updateRoomField(roomIdx, "seatCount", e.target.value)}
                            />
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive" 
                            onClick={() => removeRoomField(roomIdx)}
                            disabled={rooms.length === 1}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>

                        {room.seats.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold">Generated Seats (Click to toggle status)</Label>
                            <div className="flex flex-wrap gap-2">
                              {room.seats.map((seat, seatIdx) => (
                                <button
                                  key={seatIdx}
                                  type="button"
                                  onClick={() => toggleSeatStatus(roomIdx, seatIdx)}
                                  className={cn(
                                    "flex flex-col items-center justify-center p-2 rounded-md border w-14 transition-all",
                                    seat.status === 'occupied' 
                                      ? "bg-success/10 border-success text-success" 
                                      : "bg-destructive/10 border-destructive text-destructive"
                                  )}
                                >
                                  <span className="text-[10px] font-bold">S-{seat.seatNo}</span>
                                  {seat.status === 'occupied' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t pt-4">
                <div className="bg-primary/5 p-3 rounded-lg text-center border">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold">Total Seats</p>
                  <p className="text-xl font-bold text-primary">{stats.total}</p>
                </div>
                <div className="bg-success/5 p-3 rounded-lg text-center border">
                  <p className="text-[10px] uppercase text-success font-bold">Occupied</p>
                  <p className="text-xl font-bold text-success">{stats.occupied}</p>
                </div>
                <div className="bg-destructive/5 p-3 rounded-lg text-center border">
                  <p className="text-[10px] uppercase text-destructive font-bold">Empty</p>
                  <p className="text-xl font-bold text-destructive">{stats.empty}</p>
                </div>
              </div>
            </div>
            <DialogFooter className="sticky bottom-0 bg-background pt-2">
              <Button onClick={handleCreate} className="w-full h-12 text-lg">Save Building & Configuration</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {buildings?.map((building: any) => (
            <Card key={building.id} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all">
              <div className="h-2 bg-primary w-full" />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl font-headline group-hover:text-primary transition-colors">
                    {building.name}
                  </CardTitle>
                  <div className="bg-primary/10 p-2 rounded-lg text-primary">
                    <Building2 size={20} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                  <MapPin size={14} />
                  <span>{building.address}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-secondary/50 p-2.5 rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Rooms</p>
                    <div className="flex items-center gap-1.5 mt-0.5 font-bold text-sm">
                      <DoorOpen size={14} className="text-primary" />
                      {building.roomsCount}
                    </div>
                  </div>
                  <div className="bg-secondary/50 p-2.5 rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Seats</p>
                    <div className="flex items-center gap-1.5 mt-0.5 font-bold text-sm">
                      <Users size={14} className="text-primary" />
                      {building.totalSeats}
                    </div>
                  </div>
                  <div className="bg-success/10 p-2.5 rounded-lg">
                    <p className="text-[10px] text-success font-bold uppercase">Occupied</p>
                    <div className="flex items-center gap-1.5 mt-0.5 font-bold text-sm text-success">
                      <UserCheck size={14} />
                      {building.occupiedSeats || 0}
                    </div>
                  </div>
                  <div className="bg-destructive/10 p-2.5 rounded-lg">
                    <p className="text-[10px] text-destructive font-bold uppercase">Empty</p>
                    <div className="flex items-center gap-1.5 mt-0.5 font-bold text-sm text-destructive">
                      <UserMinus size={14} />
                      {building.emptySeats || 0}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button variant="outline" className="w-full" onClick={() => router.push(`/buildings/${building.id}`)}>View Details</Button>
              </CardFooter>
            </Card>
          ))}
          {buildings?.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              No buildings found. Add your first building to start managing rooms.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
