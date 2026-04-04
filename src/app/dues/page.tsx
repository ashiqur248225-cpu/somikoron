
"use client"

import { useState, useMemo, useEffect } from "react"
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
import { collection, query, where } from "firebase/firestore"
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
  const [statusFilter, setStatusFilter] = useState("active")
  
  // User Context
  const [userBranch, setUserBranch] = useState("Main Branch")
  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
  }, [])

  // CRITICAL: Filter data by branch
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

  const processedStudents = useMemo(() => {
    if (!students) return []
    return students.map(s => {
      const billingStart = s.billingStartDate ? new Date(s.billingStartDate) : (s.createdAt?.toDate?.() || new Date())
      const now = new Date()
      const endDate = s.isActive ? now : (s.leftAt?.toDate?.() || now)
      const monthsElapsed = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth())
      const historicalRentDue = Number(s.dueAmount) || 0
      const generatedRent = (monthsElapsed > 0 ? monthsElapsed : 0) * (s.monthlyRent || 0)
      const totalRentPaid = s.paymentsHistory?.reduce((acc: number, curr: any) => {
        const isRefund = curr.type === 'refund'
        const rentPortion = (curr.seatAmount !== undefined) ? Number(curr.seatAmount) : (s.paymentSystem === 'package' ? Number(curr.amount) : 0)
        return acc + (isRefund ? -rentPortion : rentPortion)
      }, 0) || 0
      const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)
      return { ...s, totalDue: rentDue, isPaid: rentDue <= 0 }
    })
  }, [students])

  const filteredDues = useMemo(() => {
    return processedStudents.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || "").includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      return matchesSearch && matchesBuilding && matchesStatus && s.totalDue > 0
    })
  }, [processedStudents, searchTerm, buildingFilter, statusFilter])

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Dues Tracking</h1>
          <p className="text-muted-foreground mt-1">Outstanding payments for <span className="font-bold text-foreground">{userBranch}</span>.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-secondary/20 p-4 rounded-xl border">
        <Input placeholder="Search resident..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <Select value={buildingFilter} onValueChange={setBuildingFilter}>
          <SelectTrigger><SelectValue placeholder="All Buildings" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow><TableHead>Resident</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Total Due</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {filteredDues.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.buildingName} - R: {s.roomNumber}</TableCell>
                  <TableCell className="text-right font-bold text-destructive">৳{s.totalDue.toLocaleString()}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => router.push(`/students/${s.id}`)}>Profile</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
