
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, Search, Building2, DoorOpen, Loader2, Eye, CircleAlert, XCircle, Printer, TrendingUp, UserCheck, UserMinus, FileSpreadsheet, Phone, Filter, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
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
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")
  
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
      const totalDueFromDB = s.totalDue || 0;
      const foodBalance = s.foodDueAmount || 0;
      const displayTotalDue = totalDueFromDB + (foodBalance < 0 ? Math.abs(foodBalance) : 0);
      return { ...s, foodBalance, displayTotalDue, isPaid: displayTotalDue <= 0 }
    }).filter(s => {
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      if (!matchesStatus) return false
      const search = searchTerm.toLowerCase()
      const matchesSearch = s.name.toLowerCase().includes(search) || (s.phone || "").includes(search)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesRoom = roomFilter === "all" || s.roomNumber === roomFilter
      return matchesSearch && matchesBuilding && matchesRoom && s.displayTotalDue > 0
    }).sort((a, b) => b.displayTotalDue - a.displayTotalDue)
  }, [students, searchTerm, buildingFilter, roomFilter, statusFilter])

  const stats = useMemo(() => {
    const totalDue = processedData.reduce((acc, curr) => acc + curr.displayTotalDue, 0)
    const negativeFoodTotal = processedData.reduce((acc, curr) => acc + (curr.foodBalance < 0 ? Math.abs(curr.foodBalance) : 0), 0)
    return { totalDue, negativeFoodTotal, count: processedData.length }
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

  const handlePrint = () => { 
    if (typeof window !== "undefined") { 
      setTimeout(() => {
        window.print(); 
      }, 500);
    } 
  }

  const handleExportCSV = () => {
    try {
      const headers = ["Student Name", "Building & Room", "Total Due", "Food Balance", "Monthly Rent", "Status"];
      const rows = processedData.map(s => [s.name, `${s.buildingName} R${s.roomNumber}`, s.displayTotalDue, s.foodBalance, s.monthlyRent, s.isActive ? 'Active' : 'Left']);
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
    <div className="space-y-8 pb-20 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Due</h1><p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Outstanding receivables for <span className="font-bold text-foreground">{userBranch}</span>.</p></div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsFilterDialogOpen(true)}>
            <Filter size={16} /> <span className="hidden sm:inline">Filter</span>
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handleExportCSV}><FileSpreadsheet size={16} /> <span className="hidden sm:inline">Export CSV</span></Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Download PDF</span></Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* OFFICIAL PRINT REPORT SECTION */}
      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">সমীকরণ ছাত্রাবাস</h1>
          <p className="text-sm font-bold text-slate-600">{userBranch} ব্রাঞ্চ • বকেয়া রিপোর্ট (Dues Summary)</p>
          <div className="mt-4 border-y-2 border-slate-200 py-3 grid grid-cols-2 text-left text-[9pt] font-medium bg-slate-50/50 px-4">
            <div>
              <p><b>Filter Building:</b> {buildingFilter === 'all' ? 'All' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
              <p><b>Status:</b> {statusFilter.toUpperCase()}</p>
              <p><b>Generated At:</b> {new Date().toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p><b>Total Records:</b> {stats.count}</p>
              <p><b>Staff:</b> {userName}</p>
            </div>
          </div>
        </div>

        <table className="w-full border-collapse border mt-6 text-[9pt]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 p-2 text-left font-black uppercase text-slate-700">Resident Name</th>
              <th className="border border-slate-300 p-2 text-left font-black uppercase text-slate-700">Location</th>
              <th className="border border-slate-300 p-2 text-right font-black uppercase text-slate-700">Rent Due</th>
              <th className="border border-slate-300 p-2 text-right font-black uppercase text-slate-700">Food Bal</th>
              <th className="border border-slate-300 p-2 text-right font-black uppercase text-slate-700">Total Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {processedData.map((s: any) => (
              <tr key={s.id}>
                <td className="border border-slate-200 p-2">
                  <div className="font-bold">{s.name}</div>
                  <div className="text-[7pt] text-slate-500">{s.phone} {!s.isActive && "(LEFT)"}</div>
                </td>
                <td className="border border-slate-200 p-2 text-xs">{s.buildingName} • R-{s.roomNumber}</td>
                <td className="border border-slate-200 p-2 text-right">৳{(s.totalDue || 0).toLocaleString()}</td>
                <td className={cn("border border-slate-200 p-2 text-right", s.foodBalance < 0 ? "text-destructive font-bold" : "text-success")}>
                  ৳{s.foodBalance.toLocaleString()}
                </td>
                <td className="border border-slate-200 p-2 text-right font-black">৳{s.displayTotalDue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white font-black">
              <td colSpan={4} className="p-3 text-right uppercase text-[10pt]">Grand Total Outstanding</td>
              <td className="p-3 text-right text-[11pt]">৳{stats.totalDue.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="print-footer mt-24 flex justify-between px-10">
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[8pt] font-black uppercase text-slate-800">Accountant Signature</p>
          </div>
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[8pt] font-black uppercase text-slate-800">Manager Signature</p>
          </div>
        </div>
      </div>

      <div className="print:hidden space-y-8">
        <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
          <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-bold uppercase text-destructive">Total Outstanding</CardTitle><TrendingUp className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-black text-slate-900">৳{stats.totalDue.toLocaleString()}</div><p className="text-[10px] text-muted-foreground">Across {stats.count} accounts</p></CardContent></Card>
          <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-bold uppercase text-success">Low Dues</CardTitle><UserCheck className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-black text-slate-900">{processedData.filter(s => s.displayTotalDue < 1000).length}</div></CardContent></Card>
          <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-orange-500 rounded-2xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-bold uppercase text-orange-600">High Dues</CardTitle><UserMinus className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-2xl font-black text-slate-900">{processedData.filter(s => s.displayTotalDue >= 5000).length}</div></CardContent></Card>
        </div>

        {studentsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-secondary/30"><TableRow><TableHead>Resident</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Total Due</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>{processedData.map((s: any) => (<TableRow key={s.id}><TableCell className="font-bold">{s.name}<br/><span className="text-[10px] text-muted-foreground">{s.phone} {!s.isActive && <Badge variant="destructive" className="h-3 px-1 text-[7px]">LEFT</Badge>}</span></TableCell><TableCell className="text-xs">{s.buildingName} • R-{s.roomNumber}</TableCell><TableCell className="text-right font-black text-destructive text-lg">৳{s.displayTotalDue.toLocaleString()}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => router.push(`/students/${s.id}`)}>Profile</Button></TableCell></TableRow>))}</TableBody>
                </Table>
              </CardContent>
            </Card>
            <div className="md:hidden space-y-4">
              {processedData.map((s: any) => (
                <Card key={s.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div><h3 className="font-black text-slate-800 text-lg leading-tight">{s.name}</h3><p className="text-xs text-muted-foreground font-medium mt-0.5">{s.phone}</p></div>
                      <Badge variant={s.isActive ? "destructive" : "secondary"} className="text-[10px]">{s.isActive ? "Due" : "Left & Due"}</Badge>
                    </div>
                    <div className="bg-secondary/30 p-3 rounded-xl border border-secondary flex justify-between items-center"><span className="text-[10px] font-bold text-destructive uppercase">Total Outstanding</span><span className="text-xl font-black text-destructive">৳{s.displayTotalDue.toLocaleString()}</span></div>
                    <Button variant="outline" className="w-full h-10 rounded-xl font-bold gap-2 text-xs" onClick={() => router.push(`/students/${s.id}`)}><Eye size={14} /> Profile</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Filter Dues</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5"><Label>Search</Label><Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Status</Label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="left">Left</SelectItem><SelectItem value="all">Both</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setIsFilterDialogOpen(false)}>Apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
