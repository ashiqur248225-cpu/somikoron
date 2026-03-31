"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, Search, Filter, Building2, DoorOpen, Loader2, Eye, CircleAlert, XCircle, Info, FileSpreadsheet, Printer, Calendar, Download, Share2, FileText, CheckCircle2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function DuesPage() {
  const router = useRouter()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all") // all, paid, pending

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students, isLoading } = useCollection(studentsQuery)

  const roomOptions = useMemo(() => {
    if (buildingFilter === "all" || !buildings) return []
    const b = buildings.find(b => b.id === buildingFilter)
    return b?.apartmentsDetail?.flatMap((a: any) => a.rooms?.map((r: any) => r.roomNo)) || []
  }, [buildingFilter, buildings])

  const processedStudents = useMemo(() => {
    if (!students) return []
    
    return students.map(s => {
      const billingStart = s.billingStartDate ? new Date(s.billingStartDate) : (s.createdAt?.toDate?.() || new Date())
      const now = new Date()
      // Stop months counting if student has exited
      const endDate = s.isActive ? now : (s.leftAt?.toDate?.() || now)
      
      const monthsElapsed = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth())
      
      const historicalRentDue = Number(s.dueAmount) || 0
      const generatedRent = (monthsElapsed > 0 ? monthsElapsed : 0) * (s.monthlyRent || 0)
      
      const totalRentPaid = s.paymentsHistory?.reduce((acc: number, curr: any) => {
        const isRefund = curr.type === 'refund'
        const rentPortion = (curr.seatAmount !== undefined) 
          ? Number(curr.seatAmount) 
          : (s.paymentSystem === 'package' ? Number(curr.amount) : 0)
        return acc + (isRefund ? -rentPortion : rentPortion)
      }, 0) || 0
      
      const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

      const historicalFoodDue = Number(s.foodDueAmount) || 0
      const generatedFoodCost = s.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
      
      const totalFoodPaid = s.paymentsHistory?.reduce((acc: number, curr: any) => {
        const isRefund = curr.type === 'refund'
        const foodPortion = (curr.foodAmount !== undefined) 
          ? Number(curr.foodAmount) 
          : (s.paymentSystem === 'non-package' ? Number(curr.amount) : 0)
        return acc + (isRefund ? -foodPortion : foodPortion)
      }, 0) || 0
      
      const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)
      const foodDue = foodBalance < 0 ? Math.abs(foodBalance) : 0
      const totalDue = rentDue + foodDue

      // Updated logic: Paid means Total Due and Rent Due are both 0
      const isPaid = totalDue <= 0 && rentDue <= 0

      return {
        ...s,
        totalDue,
        rentDue,
        foodDue,
        foodBalance,
        monthsElapsed,
        historicalRentDue,
        generatedRent,
        totalRentPaid,
        isPaid
      }
    })
  }, [students])

  const filteredDues = useMemo(() => {
    return processedStudents.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || "").includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesRoom = roomFilter === "all" || s.roomNumber === roomFilter
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      
      const matchesPaymentStatus = paymentStatusFilter === "all" 
        ? true 
        : (paymentStatusFilter === "paid" ? s.isPaid : !s.isPaid);

      const hasDues = paymentStatusFilter === "all" && searchTerm === "" && buildingFilter === "all" && roomFilter === "all" 
        ? s.totalDue > 0 
        : true;

      return matchesSearch && matchesBuilding && matchesRoom && matchesStatus && matchesPaymentStatus && hasDues
    })
  }, [processedStudents, searchTerm, buildingFilter, roomFilter, statusFilter, paymentStatusFilter])

  const stats = useMemo(() => {
    const active = processedStudents.filter(s => s.isActive);
    return {
      totalDue: filteredDues.reduce((acc, curr) => acc + curr.totalDue, 0),
      paidCount: active.filter(s => s.isPaid).length,
      pendingCount: active.filter(s => !s.isPaid).length,
      totalActive: active.length
    }
  }, [filteredDues, processedStudents])

  const handleExportCSV = () => {
    const headers = ["Student Name", "Phone", "Building", "Room No", "Rent Due", "Food Due", "Total Outstanding", "Status"]
    const rows = filteredDues.map(s => [
      s.name,
      s.phone,
      s.buildingName,
      s.roomNumber,
      s.rentDue,
      s.foodDue,
      s.totalDue,
      s.isPaid ? "Paid" : "Pending"
    ])

    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += "SOMIKORON OUTSTANDING DUES & COLLECTION REPORT\n"
    csvContent += `Generated on: ${new Date().toLocaleString()}\n\n`
    csvContent += headers.join(",") + "\n"
    rows.forEach(row => { csvContent += row.join(",") + "\n" })
    csvContent += `\n,,,,,GRAND TOTAL OUTSTANDING,${stats.totalDue}`

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Dues_Report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.focus();
      window.print();
    }
  }

  const handleShare = async () => {
    if (typeof window !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Somikoron Dues Report',
          text: `Check out the outstanding dues report for ${buildingFilter === 'all' ? 'All Buildings' : 'selected property'}.`,
          url: window.location.href,
        });
      } catch (err) { }
    } else {
      toast({ title: "Share not supported", description: "Sharing is not supported on this browser." });
    }
  }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Dues & Collection</h1>
            <p className="text-muted-foreground mt-1">Track monthly payments and outstanding dues.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <FileSpreadsheet size={16} /> Export CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Download size={16} /> Export / Share
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePrint} className="cursor-pointer">
                <FileText size={14} className="mr-2" /> Download PDF (Print)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShare} className="cursor-pointer">
                <Share2 size={14} className="mr-2" /> Share Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
        <Card className="bg-success/5 border-none shadow-sm border-l-4 border-l-success">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-success flex items-center gap-2">
              <CheckCircle2 size={14} /> Fully Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">{stats.paidCount} / {stats.totalActive} <span className="text-xs font-normal text-muted-foreground">Residents</span></p>
          </CardContent>
        </Card>
        
        <Card className="bg-orange-500/5 border-none shadow-sm border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-orange-600 flex items-center gap-2">
              <Clock size={14} /> Pending Dues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{stats.pendingCount} <span className="text-xs font-normal text-muted-foreground">Residents</span></p>
          </CardContent>
        </Card>

        <Card className="bg-destructive/5 border-none shadow-sm border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-destructive flex items-center gap-2">
              <CircleAlert size={14} /> Total Dues (Filtered)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">৳{stats.totalDue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 bg-secondary/20 p-4 rounded-xl border print:hidden items-end">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Search Resident</Label>
          <Input placeholder="Name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Building</Label>
          <Select value={buildingFilter} onValueChange={val => { setBuildingFilter(val); setRoomFilter("all") }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Room</Label>
          <Select value={roomFilter} onValueChange={setRoomFilter} disabled={buildingFilter === "all"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rooms</SelectItem>
              {roomOptions.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Payment (This Month)</Label>
          <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid Only</SelectItem>
              <SelectItem value="pending">Pending Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Resident Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="left">Ex-Residents</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" className="h-10" onClick={() => { setSearchTerm(""); setBuildingFilter("all"); setRoomFilter("all"); setStatusFilter("active"); setPaymentStatusFilter("all") }}>
          <XCircle size={14} className="mr-1" /> Reset
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden print:hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Resident</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rent Due</TableHead>
                <TableHead>Food Balance</TableHead>
                <TableHead className="text-right">Total Due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
              ) : filteredDues.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground">Room {s.roomNumber} | {s.buildingName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {s.isPaid ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
                        <CheckCircle2 size={10} /> Paid
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                        <Clock size={10} /> Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                     <div className="flex items-center gap-1">
                      ৳{s.rentDue?.toLocaleString()}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info size={10} className="text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px] p-3">
                            <div className="space-y-1">
                              <p className="flex justify-between gap-4"><span>Historical Starting Debt:</span> <span>৳{s.historicalRentDue}</span></p>
                              <p className="flex justify-between gap-4"><span>Billing Months ({s.monthsElapsed}):</span> <span>+৳{(s.monthsElapsed > 0 ? s.monthsElapsed : 0) * (s.monthlyRent || 0)}</span></p>
                              <p className="flex justify-between gap-4 text-success font-medium"><span>Rent Paid So Far:</span> <span>-৳{(Number(s.historicalRentDue) || 0) + ((s.monthsElapsed > 0 ? s.monthsElapsed : 0) * (s.monthlyRent || 0)) - s.rentDue}</span></p>
                              <Separator className="my-1" />
                              <p className="font-bold flex justify-between gap-4"><span>Total Rent Due:</span> <span>৳{s.rentDue}</span></p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                     </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className={cn(s.foodBalance >= 0 ? "text-success" : "text-destructive")}>
                      ৳{Math.abs(s.foodBalance || 0).toLocaleString()} {s.foodBalance < 0 ? '(Due)' : '(Credit)'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-destructive">৳{s.totalDue?.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/students/${s.id}`)}>
                      <Eye size={14} className="mr-1" /> Profile
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredDues.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No matching records found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="hidden print:block space-y-6">
        <div className="text-center space-y-2 border-b pb-4">
          <h1 className="text-2xl font-bold text-primary">Somikoron Hostel Ledger</h1>
          <h2 className="text-xl font-semibold">Dues & Collection Report</h2>
          <div className="text-sm text-muted-foreground flex justify-center gap-4">
            <span>Date: {new Date().toLocaleString()}</span>
            <span>Building: {buildingFilter === 'all' ? 'All Properties' : buildings?.find(b => b.id === buildingFilter)?.name}</span>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Resident</th>
              <th>Room</th>
              <th>Status</th>
              <th className="text-right">Rent Due</th>
              <th className="text-right">Food Due</th>
              <th className="text-right">Total Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {filteredDues.map((s, i) => (
              <tr key={i}>
                <td className="font-medium">{s.name}</td>
                <td>{s.buildingName} - {s.roomNumber}</td>
                <td>{s.isPaid ? 'Paid' : 'Pending'}</td>
                <td className="text-right">৳{s.rentDue?.toLocaleString()}</td>
                <td className="text-right">৳{s.foodDue?.toLocaleString()}</td>
                <td className="text-right font-bold text-destructive">৳{s.totalDue?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td colSpan={5} className="text-right font-bold py-4">GRAND TOTAL OUTSTANDING:</td>
              <td className="text-right font-bold text-lg text-destructive py-4">৳{stats.totalDue.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="pt-20 flex justify-between px-10">
          <div className="border-t border-black px-8 pt-2 text-center text-sm">Accountant Signature</div>
          <div className="border-t border-black px-8 pt-2 text-center text-sm">Manager Signature</div>
        </div>
      </div>
    </div>
  )
}
