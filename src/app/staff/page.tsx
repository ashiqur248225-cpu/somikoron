
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

  const filteredStaff = useMemo(() => {
    if (!staff) return []
    return staff.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone?.includes(searchTerm)
      const matchesType = s.staffType === currentTab || (!s.staffType && currentTab === 'management')
      return matchesSearch && matchesType
    })
  }, [staff, searchTerm, currentTab])

  const handleCreate = async () => {
    if (!formData.name || !formData.phone || !formData.branch) {
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
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Managing staff for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" className="gap-2" onClick={() => setIsAddOpen(true)}><Plus size={18} /> <span className="hidden sm:inline">Add Staff</span></Button>
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
            {/* Table for Desktop */}
            <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Salary</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((s) => (
                      <TableRow key={s.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => router.push(`/staff/${s.id}`)}>
                        <TableCell className="font-bold text-slate-800">{s.name}</TableCell>
                        <TableCell><Badge variant="secondary" className="uppercase text-[9px]">{s.role}</Badge></TableCell>
                        <TableCell className="font-black text-slate-700">৳{s.monthlySalary?.toLocaleString()}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); router.push(`/staff/${s.id}`); }}><Eye size={16} /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Cards for Mobile */}
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
                      <Badge className="text-[8px] font-bold uppercase bg-primary">{s.role}</Badge>
                    </div>
                    
                    <div className="bg-secondary/30 p-3 rounded-xl border border-secondary flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Wallet size={14} className="text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Monthly Salary</span>
                      </div>
                      <span className="text-lg font-black text-slate-800">৳{s.monthlySalary?.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-end pt-1">
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

      {/* Enroll Dialog Omitted for brevity */}
    </div>
  )
}
