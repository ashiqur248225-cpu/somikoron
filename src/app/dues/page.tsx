
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, Search, Filter, Building2, DoorOpen, Loader2, Eye, CircleAlert, XCircle, Info, FileSpreadsheet, Printer, Calendar } from "lucide-react"
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

export default function DuesPage() {
  const router = useRouter()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students, isLoading } = useCollection(studentsQuery)

  const roomOptions = useMemo(() => {
    if (buildingFilter === "all" || !buildings) return []
    const b = buildings.find(b => b.id === buildingFilter)
    return b?.apartmentsDetail?.flatMap((a: any) => a.rooms?.map((r: any) => r.roomNo)) || []
  }, [buildingFilter, buildings])

  const studentsWithDues = useMemo(() => {
    if (!students) return []
    
    return students.map(student => {
      // Logic alignment with Student Profile and Dashboard
      const billingStart = student.billingStartDate ? new Date(student.billingStartDate) : (student.createdAt?.toDate?.() || new Date())
      const now = new Date()
      const monthsElapsed = (now.getFullYear() - billingStart.getFullYear()) * 12 + (now.getMonth() - billingStart.getMonth())
      
      const historicalRentDue = Number(student.dueAmount) || 0
      const generatedRent = (monthsElapsed > 0 ? monthsElapsed : 0) * (student.monthlyRent || 0)
      
      const totalRentPaid = student.paymentsHistory?.reduce((acc: number, curr: any) => {
        const rentPortion = (curr.seatAmount !== undefined) 
          ? Number(curr.seatAmount) 
          : (student.paymentSystem === 'package' ? Number(curr.amount) : 0)
        return acc + rentPortion
      }, 0) || 0
      
      const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

      const historicalFoodDue = Number(student.foodDueAmount) || 0
      const generatedFoodCost = student.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
      
      const totalFoodPaid = student.paymentsHistory?.reduce((acc: number, curr: any) => {
        const foodPortion = (curr.foodAmount !== undefined) 
          ? Number(curr.foodAmount) 
          : (student.paymentSystem === 'non-package' ? Number(curr.amount) : 0)
        return acc + foodPortion
      }, 0) || 0
      
      const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)
      const foodDue = foodBalance < 0 ? Math.abs(foodBalance) : 0

      return {
        ...student,
        totalDue: rentDue + foodDue,
        rentDue,
        foodDue,
        foodBalance,
        monthsElapsed,
        historicalRentDue,
        generatedRent,
        totalRentPaid
      }
    }).filter(s => s.totalDue > 0)
  }, [students])

  const filteredDues = useMemo(() => {
    return studentsWithDues.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || "").includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesRoom = roomFilter === "all" || s.roomNumber === roomFilter
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      return matchesSearch && matchesBuilding && matchesRoom && matchesStatus
    })
  }, [studentsWithDues, searchTerm, buildingFilter, roomFilter, statusFilter])

  const grandTotalDue = useMemo(() => {
    return filteredDues.reduce((acc, curr) => acc + curr.totalDue, 0)
  }, [filteredDues])

  const handleExportCSV = () => {
    const headers = ["Student Name", "Phone", "Building", "Room No", "Rent Due", "Food Due", "Total Outstanding"]
    const rows = filteredDues.map(s => [
      s.name,
      s.phone,
      s.buildingName,
      s.roomNumber,
      s.rentDue,
      s.foodDue,
      s.totalDue
    ])

    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += "SOMIKORON OUTSTANDING DUES REPORT\n"
    csvContent += `Generated on: ${new Date().toLocaleString()}\n\n`
    csvContent += headers.join(",") + "\n"
    rows.forEach(row => { csvContent += row.join(",") + "\n" })
    csvContent += `\n,,,,,GRAND TOTAL OUTSTANDING,${grandTotalDue}`

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Outstanding_Dues_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print()
    }
  }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Dues Tracking</h1>
            <p className="text-muted-foreground mt-1">Monitor outstanding payments from residents.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <FileSpreadsheet size={16} /> Export CSV
          </Button>
          <Button className="gap-2" onClick={handlePrint}>
            <Printer size={16} /> Print Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
        <Card className="bg-destructive/5 border-none shadow-sm border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
              <CircleAlert size={16} /> Total Outstanding (Filtered)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">৳{grandTotalDue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 bg-secondary/20 p-4 rounded-xl border print:hidden">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <Input placeholder="Name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Building</Label>
          <Select value={buildingFilter} onValueChange={val => { setBuildingFilter(val); setRoomFilter("all") }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Room</Label>
          <Select value={roomFilter} onValueChange={setRoomFilter} disabled={buildingFilter === "all"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rooms</SelectItem>
              {roomOptions.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="left">Ex-Residents</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" className="h-10 mt-auto" onClick={() => { setSearchTerm(""); setBuildingFilter("all"); setRoomFilter("all"); setStatusFilter("active") }}>
          <XCircle size={14} className="mr-1" /> Reset
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden print:hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Resident</TableHead>
                <TableHead>Billing Start</TableHead>
                <TableHead>Rent Due</TableHead>
                <TableHead>Food Balance/Due</TableHead>
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
                    <div className="flex items-center gap-1.5 text-xs">
                      <Calendar size={12} className="text-muted-foreground" />
                      {s.billingStartDate || 'N/A'}
                    </div>
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
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No pending dues found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Hidden print section */}
      <div className="hidden print:block space-y-6">
        <h2 className="text-2xl font-bold text-center">Somikoron Outstanding Dues Report</h2>
        <div className="flex justify-between text-sm border-b pb-2">
          <div>
            <p><strong>Property:</strong> {buildingFilter === 'all' ? 'All' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
            <p><strong>Room:</strong> {roomFilter}</p>
          </div>
          <div className="text-right">
            <p><strong>Report Date:</strong> {new Date().toLocaleString()}</p>
          </div>
        </div>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Resident</th>
              <th className="border p-2 text-left">Phone</th>
              <th className="border p-2 text-left">Building</th>
              <th className="border p-2 text-left">Room</th>
              <th className="border p-2 text-right">Rent Due</th>
              <th className="border p-2 text-right">Food Due</th>
              <th className="border p-2 text-right">Total Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {filteredDues.map((s, i) => (
              <tr key={i}>
                <td className="border p-2 font-medium">{s.name}</td>
                <td className="border p-2">{s.phone}</td>
                <td className="border p-2">{s.buildingName}</td>
                <td className="border p-2">{s.roomNumber}</td>
                <td className="border p-2 text-right">৳{s.rentDue?.toLocaleString()}</td>
                <td className="border p-2 text-right">৳{s.foodDue?.toLocaleString()}</td>
                <td className="border p-2 text-right font-bold text-red-600">৳{s.totalDue?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold bg-gray-50">
              <td colSpan={6} className="border p-2 text-right">GRAND TOTAL OUTSTANDING</td>
              <td className="border p-2 text-right">৳{grandTotalDue.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
