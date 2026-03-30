
"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, MapPin, Plus, DoorOpen, Loader2, Users, UserCheck, UserMinus } from "lucide-react"
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

export default function BuildingsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [newBuilding, setNewBuilding] = useState({ 
    name: "", 
    address: "", 
    rooms: "",
    totalSeats: "",
    occupiedSeats: "0",
    emptySeats: ""
  })

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings, isLoading } = useCollection(buildingsQuery)

  const handleCreate = () => {
    if (!newBuilding.name || !newBuilding.address || !newBuilding.rooms || !newBuilding.totalSeats) {
      toast({ variant: "destructive", title: "Error", description: "Please fill all required fields." })
      return
    }

    const rooms = Number(newBuilding.rooms)
    const totalSeats = Number(newBuilding.totalSeats)
    const occupiedSeats = Number(newBuilding.occupiedSeats)
    const emptySeats = totalSeats - occupiedSeats

    addDocumentNonBlocking(collection(db, "buildings"), {
      ...newBuilding,
      rooms,
      totalSeats,
      occupiedSeats,
      emptySeats,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    setNewBuilding({ 
      name: "", 
      address: "", 
      rooms: "", 
      totalSeats: "", 
      occupiedSeats: "0", 
      emptySeats: "" 
    })
    setOpen(false)
    toast({ title: "Building Created", description: "Property successfully added to database." })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Building Management</h1>
          <p className="text-muted-foreground mt-1">Organize and track your hostel properties.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex gap-2">
              <Plus size={18} /> Add New Building
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Building</DialogTitle>
              <DialogDescription>Create a new hostel building record.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Building Name</Label>
                <Input 
                  value={newBuilding.name} 
                  onChange={(e) => setNewBuilding({...newBuilding, name: e.target.value})}
                  placeholder="e.g. Blue Heights" 
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input 
                  value={newBuilding.address} 
                  onChange={(e) => setNewBuilding({...newBuilding, address: e.target.value})}
                  placeholder="Full street address" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Rooms</Label>
                  <Input 
                    type="number" 
                    value={newBuilding.rooms} 
                    onChange={(e) => setNewBuilding({...newBuilding, rooms: e.target.value})}
                    placeholder="Rooms" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total Seats</Label>
                  <Input 
                    type="number" 
                    value={newBuilding.totalSeats} 
                    onChange={(e) => setNewBuilding({...newBuilding, totalSeats: e.target.value})}
                    placeholder="Total Seats" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Occupied Seats</Label>
                  <Input 
                    type="number" 
                    value={newBuilding.occupiedSeats} 
                    onChange={(e) => setNewBuilding({...newBuilding, occupiedSeats: e.target.value})}
                    placeholder="Occupied" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Empty Seats (Auto)</Label>
                  <Input 
                    type="number" 
                    disabled 
                    value={Number(newBuilding.totalSeats || 0) - Number(newBuilding.occupiedSeats || 0)}
                    placeholder="Empty" 
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} className="w-full">Create Building</Button>
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
                      {building.rooms}
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
                    <p className="text-[10px] text-destructive/80 uppercase font-bold">Vacant</p>
                    <div className="flex items-center gap-1.5 mt-0.5 font-bold text-sm text-destructive">
                      <UserMinus size={14} />
                      {(building.totalSeats || 0) - (building.occupiedSeats || 0)}
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
