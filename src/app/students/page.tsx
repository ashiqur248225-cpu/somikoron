
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Users, 
  Search, 
  Building2, 
  Loader2, 
  Eye, 
  Printer, 
  Filter, 
  RotateCcw, 
  Smartphone, 
  MapPin, 
  ChevronRight,
  MoreVertical,
  Wallet,
  Receipt
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function StudentsPage() {
  const router = useRouter()
  const db = useFirestore()
  
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")
  const [planFilter, setPlanFilter] = useState("all")
  
  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    setAssignedBuildingId(localStorage.getItem("assigned_building_id") || "none")
  }, [])

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "buildings"), where("id", "==", assignedBuildingId))
    }
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "students"), where("buildingId", "==", assignedBuildingId))
    }
    return query(collection(db, "students"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: students, isLoading } = useCollection(studentsQuery)

  const uniqueRooms = useMemo(() => {
    if (!students) return []
    const rooms = Array.from(new Set(students.map(s => s.roomNumber))).filter(Boolean).sort()
    return rooms
  }, [students])

  const processedStudents = useMemo(() => {
    if (!students) return []
    return students.map(s => {
      const rentDue = s.totalDue || 0;
      const foodDue = Number(s.foodDueAmount) || 0;
      const totalReceived = s.historicalTotalReceived || 0;
      const totalDue = rentDue + (foodDue < 0 ? Math.abs(foodDue) : 0);
      return { ...s, totalReceived, rentDue, foodBalance: foodDue, totalDue }
    }).filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || "").includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesRoom = roomFilter === "all" || String(s.roomNumber) === roomFilter
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      const matchesPlan = planFilter === "all" || s.paymentSystem === planFilter
      return matchesSearch && matchesBuilding && matchesRoom && matchesStatus && matchesPlan
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [students, searchTerm, buildingFilter, roomFilter, statusFilter, planFilter])

  const handlePrint = () => { 
    if (typeof window !== "undefined") { 
      setTimeout(() => { window.print(); }, 500);
    } 
  }

  const handleReset = () => {
    setSearchTerm("")
    setBuildingFilter("all")
    setRoomFilter("all")
    setStatusFilter("active")
    setPlanFilter("all")
  }

  return (
    <div className="space-y-8 pb-20 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2"><SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mr-2 h-4 md:hidden" /><div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Students</h1></div></div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3">
            <Button size="sm" variant="outline" className="gap-2 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold" onClick={() => setIsFilterDialogOpen(true)}>
              <Filter size={16} /> Filter
            </Button>
            <Button size="sm" variant="outline" className="gap-2 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold" onClick={handlePrint}>
              <Printer size={16} /> Print Report
            </Button>
          </div>

          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-primary">
                  <MoreVertical size={24}/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 shadow-xl border-slate-100">
                <DropdownMenuItem onClick={() => setIsFilterDialogOpen(true)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                  <Filter size={16} className="text-primary" /> Filter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrint} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                  <Printer size={16} className="text-primary" /> Print Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      <div className="print-only print-report-container">
        <div className="report-header">
          <h1>সমীকরণ ছাত্রাবাস</h1>
          <p className="branch-title">{userBranch} Branch • Student Directory Report</p>
          <div className="flex justify-between items-end mt-4 px-2 text-[8pt] font-bold text-slate-500">
            <div>
              <p>Filter: {buildingFilter === 'all' ? 'Entire Branch' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
              <p>Count: {processedStudents.length} Students</p>
            </div>
            <div className="text-right">
              <p>Generated: {new Date().toLocaleString()}</p>
              <p>Staff: {userName}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th className="text-right">Monthly Rent</th>
              <th className="text-right">Total Received</th>
              <th className="text-right">Rent Due</th>
              {planFilter !== 'package' && <th className="text-right">Food Balance</th>}
            </tr>
          </thead>
          <tbody>
            {processedStudents.map((s: any) => (
              <tr key={s.id}>
                <td className="font-bold">{s.name}<br/><span className="text-[7pt] font-normal text-slate-500">{s.phone}</span></td>
                <td>{s.buildingName} • R-{s.roomNumber}</td>
                <td className="text-right">৳{s.monthlyRent}</td>
                <td className="text-right">৳{s.totalReceived.toLocaleString()}</td>
                <td className="text-right font-bold text-destructive">৳{s.rentDue.toLocaleString()}</td>
                {planFilter !== 'package' && (
                  <td className="text-right">
                    {s.paymentSystem === 'non-package' ? "৳" + s.foodBalance.toLocaleString() : "-"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={4} className="text-right uppercase">Total Due Overview</td>
              <td className="text-right">৳{processedStudents.reduce((a, b) => a + b.rentDue, 0).toLocaleString()}</td>
              {planFilter !== 'package' && <td className="text-right"></td>}
            </tr>
          </tfoot>
        </table>

        <div className="print-footer">
          <div className="page-number"></div>
          <div className="signature-box">Manager Signature</div>
        </div>
      </div>

      <div className="print:hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-secondary/30">
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Monthly Rent</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedStudents.map((s: any) => (
                      <TableRow 
                        key={s.id} 
                        className="cursor-pointer hover:bg-slate-50/50" 
                        onClick={() => router.push(`/students/${s.id}`)}
                      >
                        <TableCell>
                          <div className="font-bold text-slate-800">{s.name}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Smartphone size={10}/> {s.phone}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium text-slate-600">{s.buildingName}</div>
                          <div className="text-[10px] text-muted-foreground uppercase font-bold">Room {s.roomNumber}</div>
                        </TableCell>
                        <TableCell className="font-black text-slate-700">৳{s.monthlyRent?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[9px] uppercase font-bold", s.paymentSystem === 'package' ? "text-primary border-primary/20" : "text-orange-600 border-orange-200")}>
                            {s.paymentSystem}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-[9px] font-black uppercase rounded-full", s.isActive ? "bg-success" : "bg-destructive")}>
                            {s.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                                <MoreVertical size={16}/>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 shadow-xl border-slate-100">
                              <DropdownMenuItem onClick={() => router.push(`/students/${s.id}`)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                                <Eye size={14} className="text-primary" /> View Profile
                              </DropdownMenuItem>
                              {userRole === 'Building Manager' && (
                                <>
                                  <Separator className="my-1" />
                                  <DropdownMenuItem onClick={() => router.push(`/payment-entry?studentId=${s.id}`)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                                    <Wallet size={14} className="text-success" /> Payment Entry
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => router.push('/expense-entry')} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                                    <Receipt size={14} className="text-destructive" /> Expense Entry
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="md:hidden space-y-4">
              {processedStudents.map((s: any) => (
                <Card 
                  key={s.id} 
                  className="border-none shadow-sm rounded-2xl overflow-hidden bg-white group active:scale-[0.98] transition-transform cursor-pointer"
                  onClick={() => router.push(`/students/${s.id}`)}
                >
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black uppercase text-xs">
                          {s.name.substring(0, 2)}
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 leading-tight">{s.name}</h3>
                          <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1 mt-0.5"><Smartphone size={10}/> {s.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Badge className={cn("text-[8px] font-black uppercase rounded-full", s.isActive ? "bg-success" : "bg-destructive")}>
                          {s.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                              <MoreVertical size={16} className="text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 shadow-xl border-slate-100">
                            <DropdownMenuItem onClick={() => router.push(`/students/${s.id}`)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                              <Eye size={14} className="text-primary" /> View Profile
                            </DropdownMenuItem>
                            {userRole === 'Building Manager' && (
                              <>
                                <Separator className="my-1" />
                                <DropdownMenuItem onClick={() => router.push(`/payment-entry?studentId=${s.id}`)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                                  <Wallet size={14} className="text-success" /> Payment Entry
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push('/expense-entry')} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                                  <Receipt size={14} className="text-destructive" /> Expense Entry
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-secondary/30 p-3 rounded-xl border border-secondary">
                      <div className="space-y-1">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Location</p>
                        <div className="flex items-center gap-1 text-[10px] font-black text-slate-700">
                          <Building2 size={10} className="text-primary"/> {s.buildingName} • R-{s.roomNumber}
                        </div>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Monthly Rent</p>
                        <p className="text-xs font-black text-slate-900">৳{s.monthlyRent?.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <Badge variant="secondary" className="text-[8px] font-black uppercase bg-primary/5 text-primary border-none">
                        {s.paymentSystem} PLAN
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase gap-1 text-primary">
                        View Profile <ChevronRight size={12}/>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {processedStudents.length === 0 && (
                <div className="text-center py-12 text-muted-foreground italic">No students found matching filters.</div>
              )}
            </div>
          </>
        )}
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Filter Students</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5"><Label>Search</Label><Input placeholder="Name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Room No.</Label><Select value={roomFilter} onValueChange={setRoomFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Rooms</SelectItem>{uniqueRooms.map(r => <SelectItem key={r} value={String(r)}>Room {r}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Status</Label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="left">Left</SelectItem><SelectItem value="all">Both</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Plan Type</Label><Select value={planFilter} onValueChange={setPlanFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Plans</SelectItem><SelectItem value="package">Package</SelectItem><SelectItem value="non-package">Non-Package</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" className="gap-2 font-bold" onClick={handleReset}><RotateCcw size={14}/> Reset</Button>
            <Button className="rounded-xl px-8" onClick={() => setIsFilterDialogOpen(false)}>Apply Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
