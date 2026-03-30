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
import { Users, Search, Plus, Phone, UserCircle, Loader2 } from "lucide-react"
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
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from "@/firebase"
import { collection, query, where, serverTimestamp } from "firebase/firestore"

export default function StudentsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  // Fetch buildings for the dropdown
  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  // Fetch all students
  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students, isLoading } = useCollection(studentsQuery)

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    buildingId: "",
    roomNumber: "",
    paymentSystem: "package",
    monthlyAmount: ""
  })

  const handleRegister = () => {
    if (!formData.name || !formData.buildingId) return

    const selectedBuilding = buildings?.find(b => b.id === formData.buildingId)

    addDocumentNonBlocking(collection(db, "students"), {
      ...formData,
      buildingName: selectedBuilding?.name || "Unknown",
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    setFormData({
      name: "",
      phone: "",
      buildingId: "",
      roomNumber: "",
      paymentSystem: "package",
      monthlyAmount: ""
    })
    setOpen(false)
    toast({ title: "Student Registered", description: "Profile created in the database." })
  }

  const filteredStudents = students?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.buildingName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Student Management</h1>
          <p className="text-muted-foreground mt-1">Register and manage residents across all buildings.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
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
                <Input 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Student's legal name" 
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  placeholder="Contact number" 
                />
              </div>
              <div className="space-y-2">
                <Label>Building</Label>
                <Select onValueChange={val => setFormData({...formData, buildingId: val})}>
                  <SelectTrigger><SelectValue placeholder="Assign building" /></SelectTrigger>
                  <SelectContent>
                    {buildings?.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input 
                  value={formData.roomNumber}
                  onChange={e => setFormData({...formData, roomNumber: e.target.value})}
                  placeholder="e.g. 201-B" 
                />
              </div>
              <div className="space-y-2">
                <Label>Payment System</Label>
                <Select value={formData.paymentSystem} onValueChange={val => setFormData({...formData, paymentSystem: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="package">Package (Combined)</SelectItem>
                    <SelectItem value="non-package">Non-Package (Separate)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monthly Amount</Label>
                <Input 
                  type="number" 
                  value={formData.monthlyAmount}
                  onChange={e => setFormData({...formData, monthlyAmount: e.target.value})}
                  placeholder="Fixed monthly fee" 
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleRegister}>Save Profile</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search students..." 
              className="pl-8" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
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
                {filteredStudents?.map((student: any) => (
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
                        <span className="text-sm font-medium">{student.buildingName}</span>
                        <span className="text-xs text-muted-foreground">Room {student.roomNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize font-normal border-primary/30 text-primary bg-primary/5">
                        {student.paymentSystem}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.isActive ? 'secondary' : 'destructive'} className="capitalize font-normal">
                        {student.isActive ? 'Active' : 'Inactive'}
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
