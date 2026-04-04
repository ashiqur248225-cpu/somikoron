
"use client"

import { useState, useEffect } from "react"
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
import { MapPin, Plus, Loader2, Trash2, Search, MoreVertical, Building2 } from "lucide-react"
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
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function BranchesPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [userRole, setUserRole] = useState("Manager")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

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
    <div className="space-y-8 pb-20">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Branches</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Manage multiple hostel locations.</p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus size={18} /> <span className="hidden sm:inline">New Branch</span></Button>
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

          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">
                {userName ? userName.substring(0, 2) : "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      <div className="bg-secondary/20 p-4 rounded-xl border flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search branches..." className="pl-8 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* Table for Desktop */}
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0">
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
            </CardContent>
          </Card>

          {/* Cards for Mobile */}
          <div className="md:hidden space-y-4">
            {filteredBranches?.map((b) => (
              <Card key={b.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg text-primary"><Building2 size={20} /></div>
                      <div>
                        <h3 className="font-bold text-slate-800">{b.name}</h3>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">Hostel Branch</p>
                      </div>
                    </div>
                    {userRole === 'Admin' && (
                      <Button variant="ghost" size="icon" className="text-destructive -mt-1 -mr-2" onClick={() => handleDelete(b.id)}>
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                  <Separator className="opacity-50" />
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin size={14} className="mt-0.5 shrink-0" />
                    <p className="leading-relaxed">{b.address || 'Address not set'}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredBranches?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground italic">No branches found.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
