"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, Search, Building2, DoorOpen, Loader2, Eye, CircleAlert, XCircle, Printer, TrendingUp, UserCheck, UserMinus, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"

const formatCompactDate = (date: any) => {
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function DuesPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all")
  const [residentStatusFilter, setResidentStatusFilter] = useState("active")
  
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
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesStatus = paymentStatusFilter === "all" || (paymentStatusFilter === "paid" ? s.isPaid : !s.isPaid)
      const matchesRes = residentStatusFilter === "all" ? true : (residentStatusFilter === "active" ? s.isActive : !s.isActive)
      return matchesSearch && matchesBuilding && matchesStatus && matchesRes
    }).sort((a, b) => b.totalDue - a.totalDue)
  }, [students, searchTerm, buildingFilter, paymentStatusFilter, residentStatusFilter])

  const stats = useMemo(() => {
    const totalDue = processedData.reduce((acc, curr) => acc + curr.totalDue, 0)
    const negativeFoodTotal = processedData.reduce((acc, curr) => acc + (curr.foodBalance < 0 ? Math.abs(curr.foodBalance) : 0), 0)
    const pendingRentTotal = processedData.reduce((acc, curr) => acc + curr.rentDue, 0)
    return { totalDue, negativeFoodTotal, pendingRentTotal, count: processedData.length }
  }, [processedData])

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  const handleExportCSV = () => {
    try {
      const headers = ["Student Name", "Building & Room", "Total Due", "Food Balance", "Monthly Rent", "Status"];
      const rows = processedData.map(s => [s.name, `${s.buildingName} R${s.roomNumber}`, s.totalDue, s.foodBalance, s.monthlyRent, s.isActive ? 'Active' : 'Left']);
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
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Due</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Rent receivables for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={handleExportCSV}><FileSpreadsheet size={16} /> <span className="hidden sm:inline">Export CSV</span></Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> <span className="hidden sm:inline">Print</span></Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">SOMIKORON HOSTEL</h1>
          <p className="text-sm font-bold">{userBranch} Branch • Outstanding Dues Summary</p>
          <div className="mt-4 border-y py-2 grid grid-cols-2 text-left text-[10pt]">
            <div>
              <p><b>Property:</b> {buildingFilter === 'all' ? 'All Buildings' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
              <p><b>Resident Status:</b> {residentStatusFilter === 'active' ? 'Active Only' : 'All History'}</p>
            </div>
            <div className="text-right">
              <p><b>Generated By:</b> {userName}</p>
              <p><b>Current Date:</b> {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <TableRow>
              <TableHead className="w-[25%]">Student Name</TableHead>
              <TableHead className="w-[20%]">Building & Room</TableHead>
              <TableHead className="w-[15%] text-right">Rent Due</TableHead>
              <TableHead className="w-[15%] text-right">Food Balance</TableHead>
              <TableHead className="w-[10%] text-right">Monthly Rent</TableHead>
              <TableHead className="w-[15%] text-right">Total Payable</TableHead>
            </TableRow>
          </thead>
          <TableBody>
            {processedData.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-bold">{s.name}</div>
                  <div className="text-[7pt] text-slate-500">{s.phone}</div>
                </TableCell>
                <TableCell>{s.buildingName} - R{s.roomNumber}</TableCell>
                <TableCell className="text-right">৳{s.rentDue.toLocaleString()}</TableCell>
                <TableCell className={cn("text-right", s.foodBalance < 0 ? "text-destructive font-bold" : "")}>
                  ৳{s.foodBalance.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">৳{s.monthlyRent}</TableCell>
                <TableCell className="text-right font-black">৳{s.totalDue.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>

        <div className="summary-section">
          <div className="bg-slate-50 p-4 border rounded-xl grid grid-cols-3 gap-4">
            <div className="border-r">
              <p className="text-[8pt] uppercase font-bold text-muted-foreground">Pending Rent</p>
              <p className="text-lg font-bold">৳{stats.pendingRentTotal.toLocaleString()}</p>
            </div>
            <div className="border-r">
              <p className="text-[8pt] uppercase font-bold text-destructive">Food Receivables</p>
              <p className="text-lg font-bold text-destructive">৳{stats.negativeFoodTotal.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[8pt] uppercase font-bold text-primary">Total Outstanding</p>
              <p className="text-2xl font-black text-primary">৳{stats.totalDue.toLocaleString()}</p>
            </div>
          </div>
          <div className="print-footer mt-10">
            <div className="signature-box">Accountant Signature</div>
            <div className="text-center self-end print-page-number"></div>
            <div className="signature-box">Manager Signature</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-3 print:hidden">
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-bold uppercase text-destructive">Total Outstanding</CardTitle><TrendingUp className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-slate-900">৳{stats.totalDue.toLocaleString()}</div><p className="text-[10px] text-muted-foreground">Across {stats.count} accounts</p></CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-bold uppercase text-success">Paid Residents</CardTitle><UserCheck className="h-4 w-4 text-success" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-slate-900">{processedData.filter(s => s.isPaid).length}</div></CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-orange-500 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-bold uppercase text-orange-600">Pending Dues</CardTitle><UserMinus className="h-4 w-4 text-orange-600" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-slate-900">{processedData.filter(s => !s.isPaid).length}</div></CardContent>
        </Card>
      </div>

      <div className="bg-secondary/20 p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-center print:hidden">
        <div className="relative flex-1 w-full"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search residents..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        <Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger className="w-full md:w-[160px] bg-white"><SelectValue placeholder="Building" /></SelectTrigger><SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
        <Select value={residentStatusFilter} onValueChange={setResidentStatusFilter}><SelectTrigger className="w-full md:w-[160px] bg-white"><SelectValue placeholder="Resident Status" /></SelectTrigger><SelectContent><SelectItem value="active">Active Residents</SelectItem><SelectItem value="left">Ex-Residents</SelectItem><SelectItem value="all">All Records</SelectItem></SelectContent></Select>
      </div>

      {studentsLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl print:hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Resident</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Total Due</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedData.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell><div className="flex flex-col"><span className="font-bold">{s.name}</span><span className="text-[10px] text-muted-foreground">{s.phone}</span></div></TableCell>
                    <TableCell className="text-xs">{s.buildingName} • R-{s.roomNumber}</TableCell>
                    <TableCell className="text-right font-black text-destructive text-lg">৳{s.totalDue.toLocaleString()}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => router.push(`/students/${s.id}`)}>Profile</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
