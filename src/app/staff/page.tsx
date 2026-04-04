
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { UserCog, Search, Plus, Phone, Loader2, Trash2, Shield, Building2, MapPin, CheckCircle2, XCircle, Wallet, UserCircle, Briefcase, Eye } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, deleteDoc, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function StaffPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  const currentTab = searchParams.get('type') || "management"

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    password: "",
    role: "Branch Manager",
    staffType: "management",
    monthlySalary: "0",
    branch: "",
    assignedBuildingId: "none",
    canRequestIncome: true,
    canRequestExpense: true
  })

  useEffect(() => {
    if (userBranch) {
      setFormData(prev => ({ ...prev, branch: userBranch }))
    }
  }, [userBranch])

  const staffQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "staff"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: staff, isLoading } = useCollection(staffQuery)

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const branchesQuery = useMemoFirebase(() => collection(db, "branches"), [db])
  const { data: branches } = useCollection(branchesQuery)

  const filteredStaff = useMemo(() => {
    if (!staff) return []
    return staff.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone?.includes(searchTerm)
      const matchesType = s.staffType === currentTab || (!s.staffType && currentTab === 'management')
      return matchesSearch && matchesType
    })
  }, [staff, searchTerm, currentTab])

  const handleCreate = async () => {
    if (!formData.name || !formData.phone || !formData.branch || (formData.staffType === 'management' && !formData.password)) {
      toast({ variant: "destructive", title: "Error", description: "Required fields are missing." })
      return
    }
    setIsSubmitting(true)
    try {
      const staffId = doc(collection(db, "staff")).id
      await setDoc(doc(db, "staff", staffId), {
        ...formData,
        id: staffId,
        staffType: formData.staffType,
        monthlySalary: Number(formData.monthlySalary),
        createdAt: serverTimestamp(),
        salaryHistory: []
      })
      toast({ title: "Success", description: "Staff member added." })
      setFormData({ 
        name: "", phone: "", address: "", password: "", role: formData.staffType === 'management' ? "Branch Manager" : "Cook", 
        staffType: formData.staffType, monthlySalary: "0",
        branch: userBranch, assignedBuildingId: "none",
        canRequestIncome: true, canRequestExpense: true
      })
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
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Staff Management</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">
              Managing staff for <span className="font-bold text-foreground">{userBranch}</span>.
            </p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus size={18} /> <span className="hidden sm:inline">Add Staff</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New Staff Enrollment</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Assign to Branch</Label>
                  <Select value={formData.branch} onValueChange={val => setFormData({...formData, branch: val})}>
                    <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
                    <SelectContent>
                      {branches?.map(b => (
                        <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Staff Category</Label>
                  <Select value={formData.staffType} onValueChange={val => setFormData({...formData, staffType: val, role: val === 'management' ? 'Branch Manager' : 'Cook'})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="management">Management Staff (System Access)</SelectItem>
                      <SelectItem value="working">Working Staff (Utility/Service)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2"><Label>Full Name</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Employee Name" /></div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Phone Number</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} maxLength={11} placeholder="01XXXXXXXXX" /></div>
                  <div className="space-y-2"><Label>Monthly Salary (৳)</Label><Input type="number" value={formData.monthlySalary} onChange={e => setFormData({...formData, monthlySalary: e.target.value})} /></div>
                </div>

                <div className="space-y-2"><Label>Home Address</Label><Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Village, Post, Dist" /></div>

                {formData.staffType === 'management' ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>System Role</Label>
                        <Select value={formData.role} onValueChange={val => setFormData({...formData, role: val})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Branch Manager">Branch Manager</SelectItem>
                            <SelectItem value="Building Manager">Building Manager</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Login Password</Label><Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" /></div>
                    </div>

                    {formData.role === 'Building Manager' && (
                      <div className="space-y-2">
                        <Label>Assign Building</Label>
                        <Select value={formData.assignedBuildingId} onValueChange={val => setFormData({...formData, assignedBuildingId: val})}>
                          <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Building (Floating)</SelectItem>
                            {buildings?.map(b => (
                              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <Label>Worker Role</Label>
                    <Select value={formData.role} onValueChange={val => setFormData({...formData, role: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cook">Head Cook</SelectItem>
                        <SelectItem value="Assistant Cook">Assistant Cook</SelectItem>
                        <SelectItem value="Cleaner">Cleaner</SelectItem>
                        <SelectItem value="Security">Security Guard</SelectItem>
                        <SelectItem value="Electrician">Electrician</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={isSubmitting} className="w-full h-12 text-lg font-bold">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Save Staff Member"}
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

      <Tabs defaultValue={currentTab} onValueChange={(val) => router.push(`/staff?type=${val}`)}>
        <TabsList className="bg-secondary/50 p-1 mb-6">
          <TabsTrigger value="management" className="gap-2"><Shield size={14} /> Management Staff</TabsTrigger>
          <TabsTrigger value="working" className="gap-2"><Briefcase size={14} /> Working Staff</TabsTrigger>
        </TabsList>

        <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
          <CardHeader className="pb-4 border-b">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or phone..." className="pl-10 bg-slate-50 border-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading staff data...</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="py-4 font-bold text-slate-600">Employee</TableHead>
                    <TableHead className="py-4 font-bold text-slate-600">Role & Assignment</TableHead>
                    <TableHead className="py-4 font-bold text-slate-600">Salary (Monthly)</TableHead>
                    <TableHead className="py-4 font-bold text-slate-600">Contact</TableHead>
                    <TableHead className="py-4 font-bold text-slate-600 text-right pr-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff?.map((s) => (
                    <TableRow key={s.id} className="group border-b last:border-0 cursor-pointer hover:bg-slate-50/50" onClick={() => router.push(`/staff/${s.id}`)}>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            {s.staffType === 'management' ? <Shield size={20}/> : <UserCircle size={20}/>}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{s.name}</span>
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">{s.address || 'No address'}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={s.role === 'Admin' ? 'default' : 'secondary'} className="w-fit text-[10px] uppercase font-bold px-2">{s.role}</Badge>
                          {s.assignedBuildingId && s.assignedBuildingId !== 'none' && (
                            <span className="text-[9px] text-primary flex items-center gap-1 font-bold"><Building2 size={10} /> {buildings?.find(b => b.id === s.assignedBuildingId)?.name || 'Assigned Property'}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 font-black text-slate-700">
                          ৳{s.monthlySalary?.toLocaleString() || 0}
                        </div>
                      </TableCell>
                      <TableCell><div className="flex items-center gap-1.5 text-sm font-medium text-slate-600"><Phone size={14} className="text-slate-400" />{s.phone}</div></TableCell>
                      <TableCell className="text-right pr-8" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" className="gap-2 text-slate-600 font-bold" onClick={() => router.push(`/staff/${s.id}`)}><Eye size={14}/> Profile</Button>
                          {userRole === 'Admin' && (
                            <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDelete(s.id)}><Trash2 size={14} /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredStaff?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-24 bg-slate-50/20">
                        <div className="flex flex-col items-center justify-center opacity-30">
                          <UserCog size={48} strokeWidth={1} />
                          <p className="mt-4 font-bold text-sm">No Staff Found in this Category</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  )
}
