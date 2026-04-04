
"use client"

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
import { 
  Users, Search, Plus, Phone, UserCircle, Loader2, 
  BedDouble, MapPin, Eye, Contact, Filter, XCircle, 
  Building2, DoorOpen, LayoutGrid, MoreVertical,
  Wallet, Utensils, Calendar, Trash2, FileSpreadsheet, Download, Share2, FileText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export default function StudentsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")

  // Filters State
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")
  const [planFilter, setPlanFilter] = useState("all")
  
  // User Context
  const [userBranch, setUserBranch] = useState("Main Branch")
  useEffect(() => {
    const branch = localStorage.getItem("user_branch") || "Main Branch"
    const role = localStorage.getItem("user_role") || "Manager"
    const assignedId = localStorage.getItem("assigned_building_id") || "none"
    
    setUserBranch(branch)

    // Auto-filter for Building Manager
    if (role === 'Building Manager' && assignedId !== 'none') {
      setBuildingFilter(assignedId)
    }
  }, [])

  // CRITICAL: Filter data by branch
  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "students"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: rawStudents, isLoading } = useCollection(studentsQuery)

  // Sort in-memory
  const students = useMemo(() => {
    if (!rawStudents) return []
    return [...rawStudents].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt)
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt)
      return dateB.getTime() - dateA.getTime()
    })
  }, [rawStudents])

  const roomOptions = useMemo(() => {
    if (buildingFilter === "all" || !buildings) return []
    const b = buildings.find(b => b.id === buildingFilter)
    return b?.apartmentsDetail?.flatMap((a: any) => a.rooms?.map((r: any) => r.roomNo)) || []
  }, [buildingFilter, buildings])

  const filteredStudents = useMemo(() => {
    if (!students) return []
    return students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || "").includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesRoom = roomFilter === "all" || s.roomNumber === roomFilter
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      const matchesPlan = planFilter === "all" || s.paymentSystem === planFilter
      return matchesSearch && matchesBuilding && matchesRoom && matchesStatus && matchesPlan
    })
  }, [students, searchTerm, buildingFilter, roomFilter, statusFilter, planFilter])

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="flex flex-col md:flex-row justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Residents</h1>
            <p className="text-muted-foreground mt-1">Manage occupants for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" className="gap-2"><Download size={16} /> Export / Share</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePrint} className="cursor-pointer"><FileText size={14} className="mr-2" /> Download PDF (Print)</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer"><Share2 size={14} className="mr-2" /> Share List</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 bg-secondary/20 p-4 rounded-xl border items-end print:hidden">
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Search size={10} /> Search Resident</Label><Input placeholder="Name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Building2 size={10} /> Building</Label><Select value={buildingFilter} onValueChange={val => { setBuildingFilter(val); setRoomFilter("all") }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><DoorOpen size={10} /> Room</Label><Select value={roomFilter} onValueChange={setRoomFilter} disabled={buildingFilter === "all"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Rooms</SelectItem>{roomOptions.map((r, idx) => <SelectItem key={`${r}-${idx}`} value={r}>Room {r}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="active">Active Only</SelectItem><SelectItem value="left">Ex-Residents</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Plan</Label><Select value={planFilter} onValueChange={setPlanFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Plans</SelectItem><SelectItem value="package">Package Only</SelectItem><SelectItem value="non-package">Non-Package</SelectItem></SelectContent></Select></div>
        <Button variant="ghost" className="h-10" onClick={() => { setSearchTerm(""); setBuildingFilter("all"); setRoomFilter("all"); setStatusFilter("active"); setPlanFilter("all") }}><XCircle size={14} className="mr-1" /> Reset</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden print:shadow-none print:border">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right print:hidden">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((s: any) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/students/${s.id}`)}>
                    <TableCell><div className="flex items-center gap-3"><UserCircle size={32} className="text-primary/40 print:hidden" /><div className="flex flex-col"><span className="font-bold">{s.name}</span><span className="text-[10px] text-muted-foreground">{s.phone}</span></div></div></TableCell>
                    <TableCell><div className="flex flex-col"><span className="text-sm font-medium">{s.buildingName}</span><span className="text-[10px] text-muted-foreground">Room {s.roomNumber} | Seat {s.seatNumber}</span></div></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{s.paymentSystem}</Badge></TableCell>
                    <TableCell><Badge variant={s.isActive ? "default" : "secondary"} className={s.isActive ? "bg-success text-white" : ""}>{s.isActive ? "Active" : "Left"}</Badge></TableCell>
                    <TableCell className="text-right print:hidden" onClick={(e) => e.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical size={16} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={() => router.push(`/students/${s.id}`)} className="cursor-pointer gap-2"><Eye size={14} /> View Profile</DropdownMenuItem><DropdownMenuItem onClick={() => router.push(`/students/${s.id}?action=payment`)} className="cursor-pointer gap-2"><Wallet size={14} className="text-success" /> Process Payment</DropdownMenuItem>{s.paymentSystem === 'non-package' && (<DropdownMenuItem onClick={() => router.push(`/students/${s.id}?action=meals`)} className="cursor-pointer gap-2"><Utensils size={14} className="text-primary" /> Log Meals</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></TableCell>
                  </TableRow>
                ))}
                {filteredStudents.length === 0 && !isLoading && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No students found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
