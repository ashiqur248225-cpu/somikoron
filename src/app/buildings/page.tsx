
"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, MapPin, Plus, DoorOpen, Loader2, Users, UserCheck, UserMinus, Trash2, Info } from "lucide-react"
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

interface RoomDetail {
  roomNo: string;
  seats: string;
}

export default function BuildingsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [newBuilding, setNewBuilding] = useState({ 
    name: "", 
    address: "", 
    occupiedSeats: "0"
  })
  const [rooms, setRooms] = useState<RoomDetail[]>([{ roomNo: "", seats: "" }])

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings, isLoading } = useCollection(buildingsQuery)

  const addRoomField = () => {
    setRooms([...rooms, { roomNo: "", seats: "" }])
  }

  const removeRoomField = (index: number) => {
    if (rooms.length > 1) {
      setRooms(rooms.filter((_, i) => i !== index))
    }
  }

  const updateRoomField = (index: number, field: keyof RoomDetail, value: string) => {
    const updatedRooms = [...rooms]
    updatedRooms[index][field] = value
    setRooms(updatedRooms)
  }

  const totalSeats = rooms.reduce((acc, curr) => acc + Number(curr.seats || 0), 0)
  const occupiedCount = Number(newBuilding.occupiedSeats || 0)
  const emptyCount = totalSeats - occupiedCount

  const handleCreate = () => {
    if (!newBuilding.name || !newBuilding.address) {
      toast({ variant: "destructive", title: "Error", description: "Please fill building name and address." })
      return
    }

    const validRooms = rooms.filter(r => r.roomNo && r.seats)
    if (validRooms.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Please add at least one room with seat count." })
      return
    }

    addDocumentNonBlocking(collection(db, "buildings"), {
      ...newBuilding,
      roomsCount: validRooms.length,
      roomsDetail: validRooms.map(r => ({ roomNo: r.roomNo, totalSeats: Number(r.seats), occupiedSeats: 0 })),
      totalSeats,
      occupiedSeats: occupiedCount,
      emptySeats: emptyCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    setNewBuilding({ name: "", address: "", occupiedSeats: "0" })
    setRooms([{ roomNo: "", seats: "" }])
    setOpen(false)
    toast({ title: "Building Created", description: "Hostel property successfully added." })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Building Management</h1>
          <p className="text-muted-foreground mt-1">Manage rooms, seats and occupancy for each hostel.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex gap-2">
              <Plus size={18} /> Add New Building
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md md:max-w-xl">
            <DialogHeader>
              <DialogTitle>Add New Building</DialogTitle>
              <DialogDescription>Define rooms and seats. Occupancy is auto-calculated.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
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

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-bold">Room & Seat Configuration</Label>
                  <Button variant="outline" size="sm" onClick={addRoomField} className="flex gap-1 h-8">
                    <Plus size={14} /> Add Room
                  </Button>
                </div>
                
                <ScrollArea className="h-[250px] pr-4 border rounded-md p-2">
                  <div className="space-y-3">
                    {rooms.map((room, idx) => (
                      <div key={idx} className="flex gap-2 items-end p-2 bg-secondary/20 rounded-lg">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Room No.</Label>
                          <Input 
                            value={room.roomNo}
                            placeholder="e.g. 101"
                            onChange={(e) => updateRoomField(idx, "roomNo", e.target.value)}
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Total Seats</Label>
                          <Input 
                            type="number"
                            value={room.seats}
                            placeholder="1, 2, 4..."
                            onChange={(e) => updateRoomField(idx, "seats", e.target.value)}
                          />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive" 
                          onClick={() => removeRoomField(idx)}
                          disabled={rooms.length === 1}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t pt-4">
                <div className="bg-primary/5 p-3 rounded-lg text-center">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold">Total Seats</p>
                  <p className="text-lg font-bold text-primary">{totalSeats}</p>
                </div>
                <div className="bg-success/5 p-3 rounded-lg text-center">
                  <p className="text-[10px] uppercase text-success/80 font-bold">Occupied</p>
                  <Input 
                    type="number" 
                    value={newBuilding.occupiedSeats} 
                    onChange={(e) => setNewBuilding({...newBuilding, occupiedSeats: e.target.value})}
                    className="h-7 text-center font-bold mt-1"
                  />
                </div>
                <div className="bg-destructive/5 p-3 rounded-lg text-center">
                  <p className="text-[10px] uppercase text-destructive/80 font-bold">Empty (Auto)</p>
                  <p className="text-lg font-bold text-destructive">{emptyCount}</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} className="w-full">Save Building & Rooms</Button>
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
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Rooms</p>
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
                    <p className="text-[10px] text-success/80 uppercase font-bold">Occupied</p>
                    <div className="flex items-center gap-1.5 mt-0.5 font-bold text-sm text-success">
                      <UserCheck size={14} />
                      {building.occupiedSeats || 0}
                    </div>
                  </div>
                  <div className="bg-destructive/10 p-2.5 rounded-lg">
                    <p className="text-[10px] text-destructive/80 uppercase font-bold">Empty</p>
                    <div className="flex items-center gap-1.5 mt-0.5 font-bold text-sm text-destructive">
                      <UserMinus size={14} />
                      {building.emptySeats || 0}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button variant="outline" className="w-full">Manage Residents</Button>
              </CardFooter>
            </Card>
          ))}
          {buildings?.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No buildings found. Add your first building to get started.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
