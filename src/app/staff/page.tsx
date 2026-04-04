
"use client"

import { useState, useMemo } from "react"
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
import { UserCog, Search, Plus, Phone, Loader2, Trash2, Shield, Building2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, deleteDoc } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export default function StaffPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const userRole = typeof window !== 'undefined' ? localStorage.getItem("user_role") : "Manager"

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    password: "",
    role: "Branch Manager",
    branch: "Main Branch",
    assignedBuildingId: "none"
  })

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staff, isLoading } = useCollection(staffQuery)

  const branchesQuery = useMemoFirebase(() => collection(db, "branches"), [db])
  const { data: branches } = useCollection(branchesQuery)

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const filteredStaff = staff?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.role?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreate = async () => {
    if (!formData.name || !formData.phone || !formData.password) {
      toast({ variant: "destructive", title: "Error", description: "Required fields are missing." })
      return
    }
    setIsSubmitting(true)
    try {
      const staffId = doc(collection(db, "staff")).id
      await setDoc(doc(db, "staff", staffId), {
        ...formData,
        createdAt: serverTimestamp()
      })
      toast({ title: "Success", description: "Staff member added." })
      setFormData({ name: "", phone: "", password: "", role: "Branch Manager", branch: "Main Branch", assignedBuildingId: "none" })
      setIsAddOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (userRole !== 'Admin') return
    try {
      await deleteDoc(doc(db, "staff", id))
      toast({ title: "Deleted", description: "Staff member removed." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Staff & Roles</h1>
            <p className="text-muted-foreground mt-1">Manage system access levels and assignments.</p>
          </div>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus size={18} /> Add New Staff</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Full Name</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} maxLength={11} /></div>
                <div className="space-y-2"><Label>Password</Label><Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={val => setFormData({...formData, role: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin (Full Access)</SelectItem>
                    <SelectItem value="Branch Manager">Branch Manager</SelectItem>
                    <SelectItem value="Building Manager">Building Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={formData.branch} onValueChange={val => setFormData({...formData, branch: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {branches?.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {formData.role === 'Building Manager' && (
                <div className="space-y-2">
                  <Label>Assign Building</Label>
                  <Select value={formData.assignedBuildingId} onValueChange={val => setFormData({...formData, assignedBuildingId: val})}>
                    <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                    <SelectContent>
                      {buildings?.filter(b => b.branch === formData.branch).map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Save Staff Member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search staff..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Staff Name</TableHead>
                  <TableHead>Role & Assignment</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><div className="flex items-center gap-3"><Shield size={20} className="text-primary"/><span className="font-semibold">{s.name}</span></div></TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={s.role === 'Admin' ? 'default' : 'secondary'} className="w-fit">{s.role}</Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin size={10} /> {s.branch}</span>
                        {s.assignedBuildingId && s.assignedBuildingId !== 'none' && (
                          <span className="text-[9px] text-primary flex items-center gap-1 font-bold"><Building2 size={10} /> Assigned Building ID: {s.assignedBuildingId}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><div className="flex items-center gap-1.5 text-sm"><Phone size={14} className="text-muted-foreground" />{s.phone}</div></TableCell>
                    <TableCell className="text-right">
                      {userRole === 'Admin' && (
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(s.id)}><Trash2 size={16} /></Button>
                      )}
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
