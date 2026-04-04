
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
import { Button } from "@/components/ui/button"
import { MapPin, Plus, Loader2, Trash2, Search } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, deleteDoc } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export default function BranchesPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  const userRole = typeof window !== 'undefined' ? localStorage.getItem("user_role") : "Manager"

  const [formData, setFormData] = useState({ name: "", address: "" })

  const branchesQuery = useMemoFirebase(() => collection(db, "branches"), [db])
  const { data: branches, isLoading } = useCollection(branchesQuery)

  const handleCreate = async () => {
    if (!formData.name) {
      toast({ variant: "destructive", title: "Error", description: "Branch Name is required." })
      return
    }
    setIsSubmitting(true)
    try {
      const branchId = doc(collection(db, "branches")).id
      await setDoc(doc(db, "branches", branchId), {
        id: branchId,
        ...formData,
        createdAt: serverTimestamp()
      })
      toast({ title: "Success", description: "Branch created." })
      setFormData({ name: "", address: "" })
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
      await deleteDoc(doc(db, "branches", id))
      toast({ title: "Deleted", description: "Branch removed." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    }
  }

  const filteredBranches = branches?.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Branches</h1>
            <p className="text-muted-foreground mt-1">Manage multiple hostel locations.</p>
          </div>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus size={18} /> Add New Branch</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create New Branch</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Branch Name</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Arambagh Branch" /></div>
              <div className="space-y-2"><Label>Full Address</Label><Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Location Details" /></div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Save Branch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search branches..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Branch Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBranches?.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell><div className="flex items-center gap-3 font-bold text-primary"><MapPin size={18}/>{b.name}</div></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{b.address}</TableCell>
                    <TableCell className="text-right">
                      {userRole === 'Admin' && (
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(b.id)}><Trash2 size={16} /></Button>
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
