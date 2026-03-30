
"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase"
import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Building2, MapPin, DoorOpen, Users, UserCheck, UserMinus, Trash2, Edit, Loader2, Plus, CheckCircle2, XCircle, Zap } from "lucide-react"
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
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface SeatDetail {
  seatNo: string;
  status: 'empty' | 'occupied';
}

interface RoomDetail {
  roomNo: string;
  meterNo?: string;
  totalSeats: number;
  seats: SeatDetail[];
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
  const [editRooms, setEditRooms] = useState<RoomDetail[]>([])

  useMemo(() => {
    if (building) {
      setEditForm({ name: building.name, address: building.address })
      setEditRooms(building.roomsDetail || [])
    }
  }, [building])

  const handleUpdate = async () => {
    if (!buildingRef || !editForm.name || !editForm.address) return
    setIsUpdating(true)
    
    let total = 0
    let occupied = 0
    editRooms.forEach(room => {
      room.seats.forEach(seat => {
        total++
        if (seat.status === 'occupied') occupied++
      })
    })

    try {
      await updateDoc(buildingRef, {
        ...editForm,
        roomsDetail: editRooms,
        roomsCount: editRooms.length,
        totalSeats: total,
        occupiedSeats: occupied,
        emptySeats: total - occupied,
        updatedAt: serverTimestamp()
      })
      setIsEditDialogOpen(false)
      toast({ title: "Updated", description: "Building details saved." })
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
      toast({ title: "Deleted", description: "Building removed successfully." })
      router.push("/buildings")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const toggleSeatStatus = (roomIdx: number, seatIdx: number) => {
    const updated = [...editRooms]
    const current = updated[roomIdx].seats[seatIdx].status
    updated[roomIdx].seats[seatIdx].status = current === 'empty' ? 'occupied' : 'empty'
    setEditRooms(updated)
  }

  const updateRoomField = (idx: number, field: keyof RoomDetail, val: string) => {
    const updated = [...editRooms]
    (updated[idx] as any)[field] = val
    setEditRooms(updated)
  }

  const removeRoom = (idx: number) => {
    setEditRooms(editRooms.filter((_, i) => i !== idx))
  }

  const addRoom = () => {
    setEditRooms([...editRooms, { roomNo: "", meterNo: "", totalSeats: 1, seats: [{ seatNo: "1", status: "empty" }] }])
  }

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
  if (!building) return <div className="text-center p-20">Building not found.</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-xl text-primary">
            <Building2 size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{building.name}</h1>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <MapPin size={14} />
              <span>{building.address}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Edit size={16} /> Edit Building
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Building Information</DialogTitle>
                <DialogDescription>Update rooms, meter numbers, or seat configurations.</DialogDescription>
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

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="font-bold">Rooms & Meter Configuration</Label>
                    <Button variant="outline" size="sm" onClick={addRoom} className="h-8 gap-1">
                      <Plus size={14} /> Add Room
                    </Button>
                  </div>
                  <ScrollArea className="h-[350px] border rounded-md p-4">
                    <div className="space-y-6">
                      {editRooms.map((room, rIdx) => (
                        <div key={rIdx} className="p-4 border rounded-lg bg-secondary/10 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold">Room/Apt #</Label>
                              <Input 
                                value={room.roomNo} 
                                onChange={e => updateRoomField(rIdx, "roomNo", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold flex items-center gap-1">
                                <Zap size={10} className="text-primary" /> Meter No.
                              </Label>
                              <Input 
                                value={room.meterNo || ""} 
                                onChange={e => updateRoomField(rIdx, "meterNo", e.target.value)}
                                placeholder="Meter ID"
                              />
                            </div>
                            <div className="flex items-center justify-end">
                               <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeRoom(rIdx)}>
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {room.seats.map((seat, sIdx) => (
                              <button
                                key={sIdx}
                                onClick={() => toggleSeatStatus(rIdx, sIdx)}
                                className={cn(
                                  "p-2 border rounded text-[10px] font-bold transition-all",
                                  seat.status === 'occupied' 
                                    ? "bg-success/20 border-success text-success" 
                                    : "bg-destructive/10 border-destructive text-destructive"
                                )}
                              >
                                S-{seat.seatNo}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleUpdate} disabled={isUpdating} className="w-full h-12 text-lg">
                  {isUpdating ? <Loader2 className="animate-spin" /> : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <Button variant="destructive" asChild className="gap-2">
              <Trash2 size={16} />
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the building and all its room data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  Confirm Delete
                </AlertDialogAction>
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
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold">Total Seats</p>
                <p className="text-2xl font-bold">{building.totalSeats}</p>
              </div>
              <Users className="text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-none">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-success uppercase font-bold">Occupied</p>
                <p className="text-2xl font-bold text-success">{building.occupiedSeats}</p>
              </div>
              <UserCheck className="text-success" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-none">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-destructive uppercase font-bold">Empty</p>
                <p className="text-2xl font-bold text-destructive">{building.emptySeats}</p>
              </div>
              <UserMinus className="text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-secondary/50 border-none">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold">Rooms</p>
                <p className="text-2xl font-bold">{building.roomsCount}</p>
              </div>
              <DoorOpen className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {building.roomsDetail?.map((room: any, idx: number) => (
          <Card key={idx} className="border-none shadow-sm overflow-hidden">
            <div className="h-1.5 bg-primary/20 w-full" />
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">Room {room.roomNo}</CardTitle>
                <Badge variant="secondary">{room.totalSeats} Seats</Badge>
              </div>
              {room.meterNo && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <Zap size={12} className="text-primary" />
                  <span>Meter: {room.meterNo}</span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mt-2">
                {room.seats?.map((seat: any, sIdx: number) => (
                  <div 
                    key={sIdx}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-md border w-14",
                      seat.status === 'occupied' 
                        ? "bg-success/10 border-success text-success" 
                        : "bg-destructive/10 border-destructive text-destructive"
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
  )
}
