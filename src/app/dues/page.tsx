
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Users, Search, Filter, Building2, DoorOpen, Loader2, Eye, 
  CircleAlert, XCircle, Info, FileSpreadsheet, Download, 
  CheckCircle2, Clock, Wallet, LayoutGrid, RotateCcw, ArrowDownRight, AlertTriangle, Briefcase, GraduationCap
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function DuesPage() {
  const router = useRouter()
  const db = useFirestore()
  
  // Search & Basic Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all")
  
  // New Advanced Filters
  const [roomFilter, setRoomFilter] = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  const [residentStatusFilter, setResidentStatusFilter] = useState("active") // Default to active residents
  
  const [userBranch, setUserBranch] = useState("Main Branch")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
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
  const { data: students, isLoading: studentsLoading } = useCollection(studentsQuery)

  const processedStudents = useMemo(() => {
    if (!students) return []
    return students.map(s => {
      const billingStart = s.billingStartDate ? new Date(s.billingStartDate) : (s.createdAt?.toDate?.() || new Date())
      const now = new Date()
      const endDate = s.isActive ? now : (s.leftAt?.toDate?.() || now)
      const monthsElapsed = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth())
      const generatedRent = (monthsElapsed >= 0 ? monthsElapsed + 1 : 0) * (s.monthlyRent || 0)
      const historicalRentDue = s.duesBreakdown ? Object.values(s.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
      const totalRentPaid = s.paymentsHistory?.reduce((acc: number, curr: any) => acc + (curr.seatAmount || 0), 0) || 0
      const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)
      return { ...s, rentDue, totalDue: rentDue, isPaid: rentDue <= 0 }
    })
  }, [students])

  const filteredData = useMemo(() => {
    return processedStudents.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesStatus = paymentStatusFilter === "all" || (paymentStatusFilter === "paid" ? s.isPaid : !s.isPaid)
      const matchesRoom = !roomFilter || s.roomNumber?.toLowerCase().includes(roomFilter.toLowerCase())
      const matchesPlan = planFilter === "all" || s.paymentSystem === planFilter
      const matchesResidentStatus = residentStatusFilter === "all" ? true : (residentStatusFilter === "active" ? s.isActive : !s.isActive)
      
      return matchesSearch && matchesBuilding && matchesStatus && matchesRoom && matchesPlan && matchesResidentStatus
    })
  }, [processedStudents, searchTerm, buildingFilter, paymentStatusFilter, roomFilter, planFilter, residentStatusFilter])

  const totalOutstanding = useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + (curr.totalDue || 0), 0)
  }, [filteredData])

  return (
    <div className="space-y-8 pb-20 print:p-0">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Outstanding Dues</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Rent receivables for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right mr-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Filtered Dues</p>
            <p className="text-sm font-black text-destructive">৳{totalOutstanding.toLocaleString()}</p>
          </div>
          <Button size="sm" variant="outline" className="gap-2"><Download size={16} /> <span className="hidden sm:inline">Export</span></Button>
          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">{userName ? userName.substring(0, 2) : "U"}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      <div className="bg-secondary/20 p-4 rounded-xl border space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Search size={10}/> Search Resident</Label>
            <Input placeholder="Name..." className="bg-white h-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
            <Select value={residentStatusFilter} onValueChange={setResidentStatusFilter}>
              <SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="active">Active Residents</SelectItem>
                <SelectItem value="left">Left Residents</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Due Status</Label>
            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Status</SelectItem>
                <SelectItem value="due">Only Pending Dues</SelectItem>
                <SelectItem value="paid">Fully Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" className="h-10 font-bold uppercase text-xs" onClick={() => { 
            setSearchTerm(""); 
            setBuildingFilter("all"); 
            setRoomFilter(""); 
            setPlanFilter("all"); 
            setResidentStatusFilter("active"); 
            setPaymentStatusFilter("all"); 
          }}>
            <XCircle size={14} className="mr-1" /> Reset Filters
          </Button>
        </div>
      </div>

      {studentsLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* Table for Desktop */}
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Resident</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Total Due</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{s.name}</span>
                          {!s.isActive && <Badge variant="secondary" className="w-fit h-4 text-[8px] uppercase">Former Resident</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.buildingName} • R-{s.roomNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold border-primary/20 text-primary">
                          {s.paymentSystem}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center"><Badge variant={s.isPaid ? "default" : "destructive"} className={cn("text-[9px] uppercase", s.isPaid && "bg-success")}>{s.isPaid ? "Paid" : "Pending"}</Badge></TableCell>
                      <TableCell className="text-right font-black text-destructive text-lg">৳{s.totalDue?.toLocaleString()}</TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => router.push(`/students/${s.id}`)}>Profile</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cards for Mobile */}
          <div className="md:hidden space-y-4">
            {filteredData.map((s: any) => (
              <Card key={s.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white" onClick={() => router.push(`/students/${s.id}`)}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="font-black text-slate-800 text-lg leading-tight">{s.name}</h3>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1 uppercase tracking-widest">
                          <Building2 size={10} /> {s.buildingName} • R-{s.roomNumber}
                        </p>
                        {!s.isActive && <Badge variant="secondary" className="text-[7px] h-3.5 px-1 uppercase">Left</Badge>}
                      </div>
                    </div>
                    <Badge variant={s.isPaid ? "default" : "destructive"} className={cn("text-[8px] px-1 font-bold", s.isPaid && "bg-success")}>
                      {s.isPaid ? "PAID" : "DUE"}
                    </Badge>
                  </div>
                  
                  <div className="bg-destructive/5 p-3 rounded-xl border border-destructive/10 flex justify-between items-center">
                    <div>
                      <p className="text-[8px] font-bold text-destructive uppercase tracking-widest">Outstanding Amount</p>
                      <p className="text-xl font-black text-destructive">৳{s.totalDue?.toLocaleString()}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                      <AlertTriangle size={20} />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[8px] uppercase">{s.paymentSystem}</Badge>
                      <p className="text-[10px] font-medium text-slate-400">Rent: ৳{s.monthlyRent}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase gap-1" onClick={() => router.push(`/students/${s.id}`)}>
                      Profile <Eye size={12} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredData.length === 0 && (
              <div className="text-center py-20 bg-secondary/10 rounded-2xl border-2 border-dashed">
                <Users size={48} className="mx-auto text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground italic">No residents found matching your filter criteria.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
