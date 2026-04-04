
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
  CheckCircle2, Clock, Wallet, LayoutGrid, RotateCcw, ArrowDownRight, AlertTriangle
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
  
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all")
  
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
      return matchesSearch && matchesBuilding && matchesStatus && s.isActive
    })
  }, [processedStudents, searchTerm, buildingFilter, paymentStatusFilter])

  return (
    <div className="space-y-8 pb-20 print:p-0">
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
          <Button size="sm" variant="outline" className="gap-2"><Download size={16} /> <span className="hidden sm:inline">Export</span></Button>
          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">{userName ? userName.substring(0, 2) : "U"}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      <div className="bg-secondary/20 p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-end print:hidden">
        <div className="flex-1 space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Search Resident</Label><Input placeholder="Name..." className="bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        <div className="w-full md:w-48 space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
        <Button variant="ghost" className="h-10 font-bold uppercase text-xs" onClick={() => { setSearchTerm(""); setBuildingFilter("all"); }}><XCircle size={14} className="mr-1" /> Reset</Button>
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
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Total Due</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-bold text-slate-800">{s.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.buildingName} • R-{s.roomNumber}</TableCell>
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
                      <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1 uppercase tracking-widest">
                        <Building2 size={10} /> {s.buildingName} • R-{s.roomNumber}
                      </p>
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
                    <p className="text-[10px] font-medium text-slate-400">Monthly Rent: ৳{s.monthlyRent}</p>
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase gap-1" onClick={() => router.push(`/students/${s.id}`)}>
                      Profile <Eye size={12} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredData.length === 0 && <div className="text-center py-12 text-muted-foreground italic">No residents with dues found.</div>}
          </div>
        </>
      )}
    </div>
  )
}
