"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, MapPin, Plus, DoorOpen } from "lucide-react"
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

const buildings = [
  { id: "1", name: "Blue Heights", address: "123 Academic St, Zone A", rooms: 15, students: 12 },
  { id: "2", name: "Serene Residency", address: "45 Garden Rd, Zone B", rooms: 10, students: 8 },
  { id: "3", name: "Victory Hostel", address: "12 Victory Lane, Zone A", rooms: 20, students: 20 },
  { id: "4", name: "Park Side", address: "5 Green Park, Zone C", rooms: 8, students: 4 },
]

export default function BuildingsPage() {
  const { toast } = useToast()

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Building Management</h1>
          <p className="text-muted-foreground mt-1">Organize and track your hostel properties.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="flex gap-2">
              <Plus size={18} /> Add New Building
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Building</DialogTitle>
              <DialogDescription>Create a new hostel building record.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Building Name</Label>
                <Input placeholder="e.g. Blue Heights" />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input placeholder="Full street address" />
              </div>
              <div className="space-y-2">
                <Label>Total Rooms</Label>
                <Input type="number" placeholder="Number of available rooms" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => toast({ title: "Building Created", description: "Property successfully added." })}>
                Create Building
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {buildings.map((building) => (
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
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-secondary/50 p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Total Rooms</p>
                  <div className="flex items-center justify-center gap-1 mt-1 font-bold text-lg">
                    <DoorOpen size={16} />
                    {building.rooms}
                  </div>
                </div>
                <div className="bg-secondary/50 p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Occupied</p>
                  <div className="flex items-center justify-center gap-1 mt-1 font-bold text-lg text-primary">
                    {building.students}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-0">
              <Button variant="outline" className="w-full">Manage Residents</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}