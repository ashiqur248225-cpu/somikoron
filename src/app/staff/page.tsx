
"use client"

import * as React from "react"
import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { UserCog, Search, Plus, Phone, Loader2, Trash2, Shield, Building2, MapPin, CheckCircle2, XCircle, Wallet, UserCircle, Briefcase, Eye, ShieldCheck, Lock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/tabs"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function StaffPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { toast } = useToast()
  const db = useFirestore()
  const router = useRouter()
  const resolvedSearchParams = React.use(searchParams)
  const currentTab = resolvedSearchParams.type || "management"
  
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
    canRequestIncome: false,
    canRequestExpense: false
  })

  // Queries
  const branchesQuery = useMemoFirebase(() => collection(db, "branches"), [db])
  const { data: branches } = useCollection(branchesQuery)

  const staffQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "staff"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: staff, isLoading } = useCollection(staffQuery)

  const buildingsQuery = useMemoFirebase(() => {
    if (!formData.branch) return null
    return query(collection(db, "buildings"), where("branch", "==", formData.branch))
  }, [db, formData.branch])
  const { data: buildings } = useCollection(buildingsQuery)

  const filteredStaff = useMemo(() => {
    if (!staff) return []
    return staff.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone?.includes(searchTerm)
      const matchesType = s.staffType === currentTab || (!s.staffType && currentTab === 'management')
      return matchesSearch && matchesType
    })
  }, [staff, searchTerm, currentTab])

  const generateRandomPassword = () => {
    return Math.random().toString(36).slice(-8);
  }

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 11)
    setFormData({ ...formData, phone: val })
  }

  const handleOpenAddDialog = () => {
    setFormData({
      name: "",
      phone: "",
      address: "",
      password: generateRandomPassword(),
      role: "Branch Manager",
      staffType: "management",
      monthlySalary: "0",
      branch: userBranch,
      assignedBuildingId: "none",
      canRequestIncome: false,
      canRequestExpense: false
    })
    setIsAddOpen(true)
  }

  const handleCreate = async () => {
    if (!formData.name || !formData.phone || !formData.address || (formData.role !== 'Admin' && !formData.branch)) {
      toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "অনুগ্রহ করে সব তথ্য সম্পূর্ণভাবে পূরণ করুন।" })
      return
    }

    if (formData.phone.length !== 11) {
      toast({ variant: "destructive", title: "ভুল মোবাইল নাম্বার", description: "ফোন নাম্বার অবশ্যই ১১ সংখ্যার হতে হবে।" })
      return
    }
    
    setIsSubmitting(true)
    try {
      const staffId = doc(collection(db, "staff")).id
      await setDoc(doc(db, "staff", staffId), {
        ...formData,
        id: staffId,
        monthlySalary: Number(formData.monthlySalary),
        createdAt: serverTimestamp(),
        salaryHistory: [],
        canRequestIncome: formData.role === 'Building Manager' ? formData.canRequestIncome : true,
        canRequestExpense: formData.role === 'Building Manager' ? formData.canRequestExpense : true,
      })
      toast({ title: "Success", description: "Staff member added." })
      setIsAddOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Staff Directory</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Managing personnel for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" className="gap-2" onClick={handleOpenAddDialog}><Plus size={18} /> <span className="hidden sm:inline">Add Staff</span></Button>
          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">{userName ? userName.substring(0, 2) : "U"}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={(val) => router.push(`/staff?type=${val}`)} className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-6">
          <TabsTrigger value="management" className="gap-2 flex-1"><Shield size={14} /> Management</TabsTrigger>
          <TabsTrigger value="working" className="gap-2 flex-1"><Briefcase size={14} /> Workers</TabsTrigger>
        </TabsList>

        <div className="bg-secondary/20 p-4 rounded-xl border flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name or phone..." className="pl-8 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Role / Designation</TableHead>
                      <TableHead>Branch / Building</TableHead>
                      <TableHead>Salary</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((s) => (
                      <TableRow key={s.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => router.push(`/staff/${s.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{s.name.substring(0, 2).toUpperCase()}</div>
                            <span className="font-bold text-slate-800">{s.name}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="uppercase text-[9px]">{s.role || (s.staffType === 'working' ? 'General Worker' : 'N/A')}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-600">{s.branch}</span>
                            {s.assignedBuildingId !== 'none' && <span className="text-[10px] text-muted-foreground">Building: {buildings?.find(b => b.id === s.assignedBuildingId)?.name || 'Loading...'}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="font-black text-slate-700">৳{s.monthlySalary?.toLocaleString()}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="icon"><Eye size={16} /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {filteredStaff.map((s) => (
                <Card key={s.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white" onClick={() => router.push(`/staff/${s.id}`)}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">{s.name.substring(0, 2).toUpperCase()}</div>
                        <div>
                          <h3 className="font-black text-slate-800 text-lg leading-tight">{s.name}</h3>
                          <p className="text-xs font-bold text-slate-400 mt-0.5">{s.phone}</p>
                        </div>
                      </div>
                      <Badge className="text-[8px] font-bold uppercase bg-primary">{s.role || 'Worker'}</Badge>
                    </div>
                    
                    <div className="flex justify-between items-center pt-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase">
                        <MapPin size={10} /> {s.branch}
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase gap-1">
                        Profile <Eye size={12} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredStaff.length === 0 && <div className="text-center py-12 text-muted-foreground italic">No staff found in this category.</div>}
            </div>
          </>
        )}
      </Tabs>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enroll New Staff</DialogTitle>
            <DialogDescription>Setup profile, roles, and administrative permissions.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><UserCircle size={14}/> Basic Information</h3>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Full Name" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input required type="tel" value={formData.phone} onChange={handlePhoneInput} placeholder="01XXXXXXXXX (১১ ডিজিট)" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">System Password <Lock size={10}/></Label>
                  <div className="flex gap-2">
                    <Input readOnly value={formData.password} className="bg-secondary/30 font-mono" />
                    <Button type="button" variant="outline" size="icon" onClick={() => setFormData({...formData, password: generateRandomPassword()})}>
                      <RefreshCw size={14} />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Auto-generated for security.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Current Address" />
              </div>
            </div>

            <Separator />

            {/* Role & Model */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><ShieldCheck size={14}/> Role & Assignment</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Staff Category</Label>
                  <Select value={formData.staffType} onValueChange={val => setFormData({...formData, staffType: val, role: val === 'management' ? 'Branch Manager' : 'General Staff'})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="management">Management (App Access)</SelectItem>
                      <SelectItem value="working">Working Staff (General)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.staffType === 'management' && (
                  <div className="space-y-2">
                    <Label>Responsibility Role</Label>
                    <Select value={formData.role} onValueChange={val => setFormData({...formData, role: val, branch: val === 'Admin' ? 'all' : formData.branch})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Super Admin (All Branches)</SelectItem>
                        <SelectItem value="Branch Manager">Branch Manager</SelectItem>
                        <SelectItem value="Building Manager">Building Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Conditional Location Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.role !== 'Admin' && (
                  <div className="space-y-2">
                    <Label>Assigned Branch</Label>
                    <Select value={formData.branch} onValueChange={val => setFormData({...formData, branch: val, assignedBuildingId: 'none'})}>
                      <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
                      <SelectContent>
                        {branches?.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.role === 'Building Manager' && (
                  <div className="space-y-2">
                    <Label>Assigned Building</Label>
                    <Select disabled={!formData.branch} value={formData.assignedBuildingId} onValueChange={val => setFormData({...formData, assignedBuildingId: val})}>
                      <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                      <SelectContent>
                        {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        {!buildings?.length && <SelectItem disabled value="none">No buildings in branch</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Monthly Salary (৳)</Label>
                <Input required type="number" value={formData.monthlySalary} onChange={e => setFormData({...formData, monthlySalary: e.target.value})} placeholder="0.00" />
              </div>
            </div>

            {/* Special Permissions for Building Manager */}
            {formData.role === 'Building Manager' && (
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-4 animate-in fade-in slide-in-from-top-2">
                <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">Approval Workflow Access</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Can Request Income</Label>
                      <p className="text-[10px] text-muted-foreground">Allows sending collection requests for approval.</p>
                    </div>
                    <Switch checked={formData.canRequestIncome} onCheckedChange={val => setFormData({...formData, canRequestIncome: val})} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Can Request Expense</Label>
                      <p className="text-[10px] text-muted-foreground">Allows sending spending requests for approval.</p>
                    </div>
                    <Switch checked={formData.canRequestExpense} onCheckedChange={val => setFormData({...formData, canRequestExpense: val})} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleCreate} className="w-full h-12 text-lg font-bold shadow-lg" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirm Enrollment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
