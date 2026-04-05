
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, Search, Building2, DoorOpen, Loader2, Eye, CircleAlert, XCircle, Printer, TrendingUp, UserCheck, UserMinus, FileSpreadsheet, Phone, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"

const formatCompactDate = (date: any) => {
  if (!date) return 'N/A'
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function DuesPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  // States
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)
  
  const [userBranch, setUserBranch] = useState("")
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

  const processedData = useMemo(() => {
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

      const historicalFoodDue = Number(s.foodDueAmount) || 0
      const generatedFoodCost = s.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
      const totalFoodPaid = s.paymentsHistory?.reduce((acc: number, curr: any) => acc + (curr.foodAmount || 0), 0) || 0
      const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)

      return { ...s, rentDue, foodBalance, totalDue: rentDue + (foodBalance < 0 ? Math.abs(foodBalance) : 0), isPaid: (rentDue <= 0 && foodBalance >= 0) }
    }).filter(s => {
      if (!s.isActive) return false // Due only for active by default
      const search = searchTerm.toLowerCase()
      const matchesSearch = s.name.toLowerCase().includes(search) || (s.phone || "").includes(search)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesRoom = roomFilter === "all" || s.roomNumber === roomFilter
      return matchesSearch && matchesBuilding && matchesRoom
    }).sort((a, b) => b.totalDue - a.totalDue)
  }, [students, searchTerm, buildingFilter, roomFilter])

  const stats = useMemo(() => {
    const totalDue = processedData.reduce((acc, curr) => acc + curr.totalDue, 0)
    const negativeFoodTotal = processedData.reduce((acc, curr) => acc + (curr.foodBalance < 0 ? Math.abs(curr.foodBalance) : 0), 0)
    const pendingRentTotal = processedData.reduce((acc, curr) => acc + curr.rentDue, 0)
    return { totalDue, negativeFoodTotal, pendingRentTotal, count: processedData.length }
  }, [processedData])

  const availableRooms = useMemo(() => {
    if (!buildings) return []
    let rooms: string[] = []
    buildings.forEach(b => {
      if (buildingFilter === "all" || b.id === buildingFilter) {
        b.apartmentsDetail?.forEach((apt: any) => {
          apt.rooms?.forEach((room: any) => { if (room.roomNo && !rooms.includes(room.roomNo)) rooms.push(room.roomNo) })
        })
      }
    })
    return rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [buildings, buildingFilter])

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  const handleExportCSV = () => {
    try {
      const headers = ["Student Name", "Building & Room", "Total Due", "Food Balance", "Monthly Rent"];
      const rows = processedData.map(s => [s.name, `${s.buildingName} R${s.roomNumber}`, s.totalDue, s.foodBalance, s.monthlyRent]);
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `dues_report_${new Date().getTime()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) { toast({ variant: "destructive", title: "Export Failed" }) }
  }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Due</h1><p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Outstanding receivables for <span className="font-bold text-foreground">{userBranch}</span>.</p></div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={handleExportCSV}><FileSpreadsheet size={16} /> <span className="hidden sm:inline">Export CSV</span></Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Download PDF</span></Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* Official Ledger Print Format */}
      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">SOMIKORON HOSTEL</h1>
          <p className="text-sm font-bold">{userBranch} Branch • Outstanding Dues Summary</p>
          <div className="mt-4 border-y py-2 grid grid-cols-2 text-left text-[10pt]">
            <div><p><b>Filter Building:</b> {buildingFilter === 'all' ? 'All Buildings' : buildings?.find(b => b.id === buildingFilter)?.name}</p><p><b>Room:</b> {roomFilter}</p></div>
            <div className="text-right"><p><b>Total Outstanding:</b> ৳{stats.totalDue.toLocaleString()}</p><p><b>Generated By:</b> {userName}</p></div>
          </div>
        </div>
        <table>
          <thead>
            <TableRow><TableHead className="w-[25%]">Student Name</TableHead><TableHead className="w-[20%]">Building & Room</TableHead><TableHead className="w-[15%] text-right">Rent Due</TableHead><TableHead className="w-[15%] text-right">Food Balance</TableHead><TableHead className="w-[10%] text-right">Rent</TableHead><TableHead className="w-[15%] text-right">Total Due</TableHead></TableRow>
          </thead>
          <TableBody>
            {processedData.map((s: any) => (
              <TableRow key={s.id}><TableCell className="font-bold">{s.name}<br/><span className="text-[7pt] font-normal">{s.phone}</span></TableCell><TableCell>{s.buildingName} - R{s.roomNumber}</TableCell><TableCell className="text-right">৳{s.rentDue.toLocaleString()}</TableCell><TableCell className={cn("text-right", s.foodBalance < 0 ? "text-destructive font-bold" : "")}>৳{s.foodBalance.toLocaleString()}</TableCell><TableCell className="text-right">৳{s.monthlyRent}</TableCell><TableCell className="text-right font-black">৳{s.totalDue.toLocaleString()}</TableCell></TableRow>
            ))}
          </TableBody>
        </table>
        <div className="summary-section"><div className="bg-slate-50 p-4 border rounded-xl grid grid-cols-3 gap-4"><div><p className="text-[8pt] uppercase font-bold text-muted-foreground">Pending Rent</p><p className="text-lg font-bold">৳{stats.pendingRentTotal.toLocaleString()}</p></div><div><p className="text-[8pt] uppercase font-bold text-destructive">Food Receivables</p><p className="text-lg font-bold text-destructive">৳{stats.negativeFoodTotal.toLocaleString()}</p></div><div className="text-right"><p className="text-[8pt] uppercase font-bold text-primary">Total Outstanding</p><p className="text-2xl font-black text-primary">৳{stats.totalDue.toLocaleString()}</p></div></div><div className="print-footer mt-10"><div className="signature-box">Accountant Signature</div><div className="text-center self-end print-page-number"></div><div className="signature-box">Manager Signature</div></div></div>
      </div>

      {/* GLOBAL FILTER BAR (Desktop) */}
      <div className="hidden md:flex bg-secondary/20 p-4 rounded-xl border items-end gap-4 print:hidden">
        <div className="flex-1 space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Search Student</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Name or phone..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>
        <div className="w-[180px] space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Building</Label><Select value={buildingFilter} onValueChange={val => { setBuildingFilter(val); setRoomFilter("all"); }}><SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="w-[150px] space-y-1.5"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Room</Label><Select value={roomFilter} onValueChange={setRoomFilter}><SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{availableRooms.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}</SelectContent></Select></div>
        <Button variant="ghost" className="h-10 text-xs font-bold uppercase" onClick={() => { setSearchTerm(""); setBuildingFilter("all"); setRoomFilter("all"); }}>Reset</Button>
      </div>

      {/* MOBILE FILTER PANEL */}
      <div className="md:hidden space-y-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." className="pl-9 h-9 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
          <Dialog open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="h-9 gap-2"><Filter size={14} /> Filter</Button></DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-2xl">
              <DialogHeader><DialogTitle>Due Filters</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2"><Label>Building</Label><Select value={buildingFilter} onValueChange={val => { setBuildingFilter(val); setRoomFilter("all"); }}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Room</Label><Select value={roomFilter} onValueChange={setRoomFilter}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{availableRooms.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <DialogFooter className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => { setSearchTerm(""); setBuildingFilter("all"); setRoomFilter("all"); setIsMobileFilterOpen(false); }}>Reset</Button><Button onClick={() => setIsMobileFilterOpen(false)}>Apply</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-3 print:hidden">
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-bold uppercase text-destructive">Total Outstanding</CardTitle><TrendingUp className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-black text-slate-900">৳{stats.totalDue.toLocaleString()}</div><p className="text-[10px] text-muted-foreground">Across {stats.count} accounts</p></CardContent></Card>
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-bold uppercase text-success">Low Dues</CardTitle><UserCheck className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-black text-slate-900">{processedData.filter(s => s.totalDue < 1000).length}</div></CardContent></Card>
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-orange-500 rounded-2xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-bold uppercase text-orange-600">High Dues</CardTitle><UserMinus className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-2xl font-black text-slate-900">{processedData.filter(s => s.totalDue >= 5000).length}</div></CardContent></Card>
      </div>

      {studentsLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW */}
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl print:hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30"><TableRow><TableHead>Resident</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Total Due</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>{processedData.map((s: any) => (<TableRow key={s.id}><TableCell className="font-bold">{s.name}<br/><span className="text-[10px] text-muted-foreground">{s.phone}</span></TableCell><TableCell className="text-xs">{s.buildingName} • R-{s.roomNumber}</TableCell><TableCell className="text-right font-black text-destructive text-lg">৳{s.totalDue.toLocaleString()}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => router.push(`/students/${s.id}`)}>Profile</Button></TableCell></TableRow>))}</TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* MOBILE CARD VIEW */}
          <div className="md:hidden space-y-4 print:hidden">
            {processedData.map((s: any) => (
              <Card key={s.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start"><div><h3 className="font-black text-slate-800 text-lg leading-tight">{s.name}</h3><p className="text-xs text-muted-foreground font-medium mt-0.5">{s.phone}</p></div><Badge variant="destructive" className="text-[10px]">Due</Badge></div>
                  <div className="bg-secondary/30 p-3 rounded-xl border border-secondary"><div className="flex justify-between items-center mb-2"><span className="text-[10px] font-bold text-muted-foreground uppercase">Property</span><span className="text-xs font-bold text-slate-700">{s.buildingName} • R-{s.roomNumber}</span></div><div className="flex justify-between items-center pt-2 border-t border-white/50"><span className="text-[10px] font-bold text-destructive uppercase">Total Outstanding</span><span className="text-xl font-black text-destructive">৳{s.totalDue.toLocaleString()}</span></div></div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-slate-500"><p>Rent Due: ৳{s.rentDue.toLocaleString()}</p><p className={cn("text-right", s.foodBalance < 0 ? "text-destructive font-bold" : "")}>Food Bal: ৳{s.foodBalance.toLocaleString()}</p></div>
                  <Button variant="outline" className="w-full h-10 rounded-xl font-bold gap-2 text-xs" onClick={() => router.push(`/students/${s.id}`)}><Eye size={14} /> View Full Profile</Button>
                </CardContent>
              </Card>
            ))}
            {processedData.length === 0 && <div className="text-center py-12 text-muted-foreground italic text-sm">No accounts found.</div>}
          </div>
        </>
      )}
    </div>
  )
}
