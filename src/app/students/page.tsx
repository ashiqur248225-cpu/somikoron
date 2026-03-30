"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Users, Search, Plus, Phone, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

const studentsData = [
  { id: "S101", name: "John Doe", building: "Blue Heights", room: "201", type: "package", status: "active", phone: "123-456-7890" },
  { id: "S102", name: "Alice Smith", building: "Serene Residency", room: "105", type: "non-package", status: "active", phone: "234-567-8901" },
  { id: "S103", name: "Robert Brown", building: "Victory Hostel", room: "302", type: "package", status: "active", phone: "345-678-9012" },
  { id: "S104", name: "Emily White", building: "Blue Heights", room: "202", type: "package", status: "inactive", phone: "456-789-0123" },
]

export default function StudentsPage() {
  const { toast } = useToast()
  const [paymentSystem, setPaymentSystem] = useState<string>("package")

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Student Management</h1>
          <p className="text-muted-foreground mt-1">Register and manage residents across all buildings.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="flex gap-2">
              <Plus size={18} /> Register Student
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Student Registration</DialogTitle>
              <DialogDescription>Create a student profile and assign to a building.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input placeholder="Student's legal name" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input placeholder="Contact number" />
              </div>
              <div className="space-y-2">
                <Label>Building</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Assign building" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="b1">Blue Heights</SelectItem>
                    <SelectItem value="b2">Serene Residency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input placeholder="e.g. 201-B" />
              </div>
              <div className="space-y-2">
                <Label>Payment System</Label>
                <Select value={paymentSystem} onValueChange={setPaymentSystem}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="package">Package (Combined)</SelectItem>
                    <SelectItem value="non-package">Non-Package (Separate)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monthly Amount</Label>
                <Input type="number" placeholder="Fixed monthly fee" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => toast({ title: "Student Registered", description: "Profile has been successfully created." })}>
                Save Profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search students by name, building or room..." className="pl-8" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Building & Room</TableHead>
                <TableHead>Payment Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentsData.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-1.5 rounded-full text-primary">
                        <UserCircle size={24} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold">{student.name}</span>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase">
                          <Phone size={10} /> {student.phone}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{student.building}</span>
                      <span className="text-xs text-muted-foreground">Room {student.room}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize font-normal border-primary/30 text-primary bg-primary/5">
                      {student.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={student.status === 'active' ? 'secondary' : 'destructive'} className="capitalize font-normal">
                      {student.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">View Ledger</Button>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}