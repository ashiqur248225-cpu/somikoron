
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Users, Search, Building2, DoorOpen, Loader2, Eye, XCircle, Printer, FileSpreadsheet, Filter, CheckCircle2, UserMinus, UserCheck, LayoutGrid, Bed, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
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

export default function StudentsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  
  // States
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")
  const [planFilter, setPlanFilter] = useState("all")
  
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
  const { data: students, isLoading } = useCollection(studentsQuery)

  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)

  const processedStudents = useMemo(() => {
    if (!students) return []
    return students.map(s => {
      // Directly use the totalDue from DB (Admin-dependent)
      const rentDue = s.totalDue || 0;

      const historicalFoodDue = Number(s.foodDueAmount) || 0
      const generatedFoodCost = s.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
      const totalFoodPaid = s.paymentsHistory?.reduce((acc: number, curr: any) => acc + Number(curr.foodAmount || 0), 0) || 0
      const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)
      
      const totalReceived = s.historicalTotalReceived || 0
      const totalDue = rentDue + (foodBalance < 0 ? Math.abs(foodBalance) : 0)

      return { ...s, rentDue, foodBalance, totalDue, totalReceived }
    }).filter(s => {
      const search = searchTerm.toLowerCase()
      const matchesSearch = 
        s.name.toLowerCase().includes(search) || 
        (s.phone || "").includes(search) || 
        (s.buildingName || "").toLowerCase().includes(search) ||
        (s.roomNumber || "").includes(search)
      
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      const matchesPlan = planFilter === "all" || s.paymentSystem === planFilter
      
      return matchesSearch && matchesBuilding && matchesStatus && matchesPlan
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [students, searchTerm, buildingFilter, statusFilter, planFilter])

  const printStats = useMemo(() => {
    return {
      totalCount: processedStudents.length,
      totalRent: processedStudents.reduce((acc, curr) => acc + (curr.monthlyRent || 0), 0),
      totalReceived: processedStudents.reduce((acc, curr) => acc + (curr.totalReceived || 0), 0),
      totalDue: processedStudents.reduce((acc, curr) => acc + (curr.totalDue || 0), 0),
    }
  }, [processedStudents])

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  const handleExportCSV = () => {
    try {
      const headers = ["Name", "Phone", "Building", "Room", "Seat", "Monthly Rent", "Plan", "Status"];
      const rows = processedStudents.map(s => [
        s.name, s.phone, s.buildingName, s.roomNumber, s.seatNumber, s.monthlyRent, s.paymentSystem, s.isActive ? 'Active' : 'Left'
      ]);
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `residents_report_${new Date().getTime()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) { toast({ variant: "destructive", title: "Export Failed" }) }
  }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Residents</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Directory for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
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

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Filter className="text-primary" size={20}/> Filter Residents</DialogTitle>
            <DialogDescription>Search and filter your hostel members.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Name, phone, room..." className="pl-8 bg-slate-50" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Building</Label>
              <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                <SelectTrigger className="bg-slate-50"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buildings</SelectItem>
                  {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Plan</Label>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="package">Package</SelectItem>
                    <SelectItem value="non-package">Non-Package</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Staying</SelectItem>
                    <SelectItem value="left">Left Hostel</SelectItem>
                    <SelectItem value="all">All Records</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button variant="ghost" className="gap-2 font-bold text-xs" onClick={() => { setSearchTerm(""); setBuildingFilter("all"); setStatusFilter("active"); setPlanFilter("all"); }}>
              <RotateCcw size={14}/> Reset
            </Button>
            <Button className="rounded-xl px-8" onClick={() => setIsFilterDialogOpen(false)}>Apply Filters</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="print-only print-report-container">
        <div className="report-header">
          <h1>{templatesData?.hostelName || "SOMIKORON HOSTEL"}</h1>
          <p className="text-sm font-bold text-slate-600">{userBranch} Branch • Resident Directory Report</p>
          <div className="mt-4 border-y-2 border-slate-200 py-3 grid grid-cols-2 text-left text-[9pt] font-medium">
            <div>
              <p><b>Filter Building:</b> {buildingFilter === 'all' ? 'All Buildings' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
              <p><b>Resident Plan:</b> {planFilter.toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p><b>Generated At:</b> {new Date().toLocaleString()}</p>
              <p><b>Generated By:</b> {userName}</p>
            </div>
          </div>
        </div>

        <div className="summary-section grid grid-cols-4 gap-4 mb-8">
          <div className="summary-box">
            <p className="text-[7pt] font-black uppercase text-muted-foreground mb-1">Total Residents</p>
            <p className="text-lg font-black text-slate-800">{printStats.totalCount}</p>
          </div>
          <div className="summary-box">
            <p className="text-[7pt] font-black uppercase text-muted-foreground mb-1">Monthly Rent</p>
            <p className="text-lg font-black text-slate-800">৳{printStats.totalRent.toLocaleString()}</p>
          </div>
          <div className="summary-box">
            <p className="text-[7pt] font-black uppercase text-success mb-1">Total Received</p>
            <p className="text-lg font-black text-success">৳{printStats.totalReceived.toLocaleString()}</p>
          </div>
          <div className="summary-box">
            <p className="text-[7pt] font-black uppercase text-destructive mb-1">Total Outstanding</p>
            <p className="text-lg font-black text-destructive">৳{printStats.totalDue.toLocaleString()}</p>
          </div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-[20%]">Name</th>
              <th className="w-[20%]">Location</th>
              <th className="w-[15%] text-right">Monthly Rent</th>
              <th className="w-[15%] text-right">Food Bal</th>
              <th className="w-[15%] text-right">Received</th>
              <th className="w-[15%] text-right">Total Due</th>
            </tr>
          </thead>
          <tbody>
            {processedStudents.map((s: any) => (
              <tr key={s.id} className="break-inside-avoid">
                <td className="font-bold">{s.name}</td>
                <td>{s.buildingName} - R{s.roomNumber}</td>
                <td className="text-right">৳{s.monthlyRent}</td>
                <td className={cn("text-right", s.foodBalance < 0 && "text-destructive font-bold")}>
                  {s.paymentSystem === 'package' ? '-' : `৳${s.foodBalance}`}
                </td>
                <td className="text-right">৳{s.totalReceived.toLocaleString()}</td>
                <td className="text-right font-black">৳{s.totalDue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white font-black">
              <td colSpan={2} className="uppercase p-3">Grand Total</td>
              <td className="text-right p-3">৳{printStats.totalRent.toLocaleString()}</td>
              <td className="text-right p-3">-</td>
              <td className="text-right p-3">৳{printStats.totalReceived.toLocaleString()}</td>
              <td className="text-right p-3">৳{printStats.totalDue.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="print-footer">
          <div className="signature-box">Accountant Signature</div>
          <div className="text-center">
            <p className="text-[7pt] font-medium text-slate-400">Page <span className="page-number"></span></p>
          </div>
          <div className="signature-box">Manager Signature</div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl print:hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Monthly Rent</TableHead>
                    <TableHead>Plan & Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedStudents.map((s: any) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => router.push(`/students/${s.id}`)}>
                      <TableCell><div className="font-bold">{s.name}</div><div className="text-[10px] text-muted-foreground">{s.phone}</div></TableCell>
                      <TableCell className="text-xs">{s.buildingName} • R-{s.roomNumber}</TableCell>
                      <TableCell className="font-black text-slate-700">৳{s.monthlyRent?.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="text-[8px] uppercase w-fit">{s.paymentSystem}</Badge>
                          <Badge variant={s.isActive ? "default" : "destructive"} className={cn("text-[8px] uppercase w-fit", s.isActive ? "bg-success" : "")}>
                            {s.isActive ? "Staying" : "Left"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="icon"><Eye size={16}/></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="md:hidden space-y-4 print:hidden">
            {processedStudents.map((s: any) => (
              <Card key={s.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white" onClick={() => router.push(`/students/${s.id}`)}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg leading-tight">{s.name}</h3>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">{s.phone}</p>
                    </div>
                    <Badge variant={s.isActive ? "default" : "destructive"} className={cn("text-[10px]", s.isActive ? "bg-success" : "")}>
                      {s.isActive ? "Staying" : "Left"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary/30 p-2.5 rounded-xl border border-secondary">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground mb-1">Location</p>
                      <p className="text-xs font-bold text-slate-700 truncate">{s.buildingName} • R-{s.roomNumber}</p>
                    </div>
                    <div className="bg-primary/5 p-2.5 rounded-xl border border-primary/10">
                      <p className="text-[9px] uppercase font-bold text-primary mb-1">Monthly Rent</p>
                      <p className="text-xs font-black text-primary">৳{s.monthlyRent?.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Badge variant="outline" className="text-[8px] h-4 uppercase font-bold">Plan: {s.paymentSystem}</Badge>
                    <Badge variant="outline" className="text-[8px] h-4 uppercase font-bold">Seat: {s.seatNumber}</Badge>
                  </div>
                  <Button variant="outline" className="w-full h-10 rounded-xl font-bold gap-2 text-xs" onClick={() => router.push(`/students/${s.id}`)}>
                    <Eye size={14} /> View Full Profile
                  </Button>
                </CardContent>
              </Card>
            ))}
            {processedStudents.length === 0 && <div className="text-center py-12 text-muted-foreground italic text-sm">No residents found.</div>}
          </div>
        </>
      )}
    </div>
  )
}
