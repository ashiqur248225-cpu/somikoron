
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
  Wallet, Utensils, Calendar, Trash2, FileSpreadsheet, Download, Share2, FileText, Printer
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
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function StudentsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")
  const [roomFilter, setRoomFilter] = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  
  const [userBranch, setUserBranch] = useState("Main Branch")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    const role = localStorage.getItem("user_role")
    const assignedId = localStorage.getItem("assigned_building_id")
    if (role === 'Building Manager' && assignedId !== 'none') {
      setBuildingFilter(assignedId)
    }
  }, [])

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

  const students = useMemo(() => {
    if (!rawStudents) return []
    return [...rawStudents].sort((a, b) => (b.createdAt?.toDate?.().getTime() || 0) - (a.createdAt?.toDate?.().getTime() || 0))
  }, [rawStudents])

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || "").includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      const matchesRoom = !roomFilter || s.roomNumber?.toLowerCase().includes(roomFilter.toLowerCase())
      const matchesPlan = planFilter === "all" || s.paymentSystem === planFilter
      
      return matchesSearch && matchesBuilding && matchesStatus && matchesRoom && matchesPlan
    })
  }, [students, searchTerm, buildingFilter, statusFilter, roomFilter, planFilter])

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  const handleExportCSV = () => {
    try {
      const headers = ["Name", "Phone", "Building", "Room", "Seat", "Plan", "Status"];
      const rows = filteredStudents.map(s => [
        s.name,
        s.phone,
        s.buildingName,
        s.roomNumber,
        s.seatNumber,
        s.paymentSystem,
        s.isActive ? 'Active' : 'Left'
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `resident_list_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Export Success", description: "CSV file downloaded." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export Failed", description: err.message });
    }
  }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Residents</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Manage occupants for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={handleExportCSV}><Download size={16} /> <span className="hidden sm:inline">Export CSV</span></Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Print</span></Button>
          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">{userName ? userName.substring(0, 2) : "U"}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      <div className="bg-secondary/20 p-4 rounded-xl border space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Search size={10}/> Name or Phone</Label>
            <Input placeholder="Search..." className="bg-white h-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Building2 size={10}/> Building</Label>
            <Select value={buildingFilter} onValueChange={setBuildingFilter}>
              <SelectTrigger className="bg-white h-10"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buildings</SelectItem>
                {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><DoorOpen size={10}/> Room No.</Label>
            <Input placeholder="e.g. 301" className="bg-white h-10" value={roomFilter} onChange={e => setRoomFilter(e.target.value)} />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Payment Plan</Label>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="package">Package Plan</SelectItem>
                <SelectItem value="non-package">Non-Package</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Resident Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="active">Active Residents</SelectItem>
                <SelectItem value="left">Left Residents</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button variant="ghost" className="h-10 font-bold uppercase text-xs" onClick={() => { 
              setSearchTerm(""); 
              setBuildingFilter("all"); 
              setRoomFilter(""); 
              setPlanFilter("all"); 
              setStatusFilter("active"); 
            }}>
              <XCircle size={14} className="mr-1" /> Reset Filters
            </Button>
          </div>
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
                    <TableHead>Student</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((s: any) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/students/${s.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                            {s.name.substring(0, 2)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold">{s.name}</span>
                            <span className="text-[10px] text-muted-foreground">{s.phone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{s.buildingName}</span>
                          <span className="text-[10px] text-muted-foreground">Room {s.roomNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.isActive ? "default" : "secondary"} className={cn("text-[9px] uppercase", s.isActive && "bg-success")}>
                          {s.isActive ? "Active" : "Left"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); router.push(`/students/${s.id}`); }}>
                          <Eye size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cards for Mobile */}
          <div className="md:hidden space-y-4">
            {filteredStudents.map((s: any) => (
              <Card key={s.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white" onClick={() => router.push(`/students/${s.id}`)}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">{s.name.substring(0, 2).toUpperCase()}</div>
                      <div>
                        <h3 className="font-black text-slate-800 text-lg leading-tight">{s.name}</h3>
                        <p className="text-xs font-bold text-slate-400 mt-0.5">{s.phone}</p>
                      </div>
                    </div>
                    <Badge variant={s.isActive ? "default" : "secondary"} className={cn("text-[8px] px-1 font-bold", s.isActive && "bg-success")}>
                      {s.isActive ? "ACTIVE" : "LEFT"}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary/30 p-2 rounded-xl border border-secondary text-center">
                      <p className="text-[8px] font-bold text-muted-foreground uppercase mb-0.5">Building</p>
                      <p className="text-xs font-black text-slate-700">{s.buildingName}</p>
                    </div>
                    <div className="bg-secondary/30 p-2 rounded-xl border border-secondary text-center">
                      <p className="text-[8px] font-bold text-muted-foreground uppercase mb-0.5">Room/Seat</p>
                      <p className="text-xs font-black text-slate-700">{s.roomNumber}/{s.seatNumber}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <Badge variant="outline" className="capitalize text-[10px] h-5">{s.paymentSystem} Plan</Badge>
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase gap-1">
                      View Profile <Eye size={12} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredStudents.length === 0 && <div className="text-center py-12 text-muted-foreground italic">No residents found.</div>}
          </div>
        </>
      )}
    </div>
  )
}
