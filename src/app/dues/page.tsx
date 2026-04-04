
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
  CheckCircle2, Clock, Wallet, LayoutGrid, RotateCcw
} from "lucide-react"
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
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function DuesPage() {
  const router = useRouter()
  const db = useFirestore()
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all")
  const [residentStatusFilter, setResidentStatusFilter] = useState("active")
  
  // User Context
  const [userBranch, setUserBranch] = useState("Main Branch")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    const branch = localStorage.getItem("user_branch") || "Main Branch"
    const role = localStorage.getItem("user_role") || "Manager"
    const name = localStorage.getItem("user_name") || "User"
    const assignedId = localStorage.getItem("assigned_building_id") || "none"
    
    setUserBranch(branch)
    setUserName(name)

    // Auto-filter for Building Manager
    if (role === 'Building Manager' && assignedId !== 'none') {
      setBuildingFilter(assignedId)
    }
  }, [])

  // Queries
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

  // Room options based on building
  const roomOptions = useMemo(() => {
    if (buildingFilter === "all" || !buildings) return []
    const b = buildings.find(b => b.id === buildingFilter)
    return b?.apartmentsDetail?.flatMap((a: any) => a.rooms?.map((r: any) => r.roomNo)) || []
  }, [buildingFilter, buildings])

  // Financial Processing Logic
  const processedStudents = useMemo(() => {
    if (!students) return []
    return students.map(s => {
      // 1. Rent Calculation
      const billingStart = s.billingStartDate ? new Date(s.billingStartDate) : (s.createdAt?.toDate?.() || new Date())
      const now = new Date()
      const endDate = s.isActive ? now : (s.leftAt?.toDate?.() || now)
      
      const monthsElapsed = (endDate.getFullYear() - billingStart.getFullYear()) * 12 + (endDate.getMonth() - billingStart.getMonth())
      const generatedRent = (monthsElapsed >= 0 ? monthsElapsed + 1 : 0) * (s.monthlyRent || 0)
      
      // Historical Dues from Breakdown Map
      const historicalRentDue = s.duesBreakdown ? Object.values(s.duesBreakdown as Record<string, number>).reduce((a, b) => a + b, 0) : 0
      
      const totalRentPaid = s.paymentsHistory?.reduce((acc: number, curr: any) => {
        const isRefund = curr.type === 'refund'
        const rentPortion = (curr.seatAmount !== undefined) ? Number(curr.seatAmount) : (s.paymentSystem === 'package' ? Number(curr.amount) : 0)
        return acc + (isRefund ? -rentPortion : rentPortion)
      }, 0) || 0

      const rentDue = Math.max(0, (historicalRentDue + generatedRent) - totalRentPaid)

      // 2. Food Balance Calculation
      const historicalFoodDue = Number(s.foodDueAmount) || 0
      const generatedFoodCost = s.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
      const totalFoodPaid = s.paymentsHistory?.reduce((acc: number, curr: any) => {
        const isRefund = curr.type === 'refund'
        const foodPortion = (curr.foodAmount !== undefined) ? Number(curr.foodAmount) : (s.paymentSystem === 'non-package' ? Number(curr.amount) : 0)
        return acc + (isRefund ? -foodPortion : foodPortion)
      }, 0) || 0
      const foodBalance = totalFoodPaid - (historicalFoodDue + generatedFoodCost)

      return { 
        ...s, 
        rentDue, 
        foodBalance, 
        totalDue: Math.max(0, rentDue + (foodBalance < 0 ? Math.abs(foodBalance) : 0)),
        isPaid: rentDue <= 0 && foodBalance >= 0
      }
    })
  }, [students])

  const filteredData = useMemo(() => {
    return processedStudents.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || "").includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesRoom = roomFilter === "all" || s.roomNumber === roomFilter
      const matchesResidentStatus = residentStatusFilter === "all" ? true : (residentStatusFilter === "active" ? s.isActive : !s.isActive)
      
      let matchesPaymentStatus = true
      if (paymentStatusFilter === "pending") matchesPaymentStatus = !s.isPaid
      if (paymentStatusFilter === "paid") matchesPaymentStatus = s.isPaid

      return matchesSearch && matchesBuilding && matchesRoom && matchesResidentStatus && matchesPaymentStatus
    })
  }, [processedStudents, searchTerm, buildingFilter, roomFilter, residentStatusFilter, paymentStatusFilter])

  const stats = useMemo(() => {
    const totalCount = filteredData.length || 1
    const paidCount = filteredData.filter(s => s.isPaid).length
    const totalDues = filteredData.reduce((acc, s) => acc + s.totalDue, 0)
    return { paidCount, totalCount, totalDues, pendingCount: filteredData.filter(s => !s.isPaid).length }
  }, [filteredData])

  const handleReset = () => {
    setSearchTerm(""); setBuildingFilter("all"); setRoomFilter("all"); setPaymentStatusFilter("all"); setResidentStatusFilter("active");
  }

  const handlePrint = () => { if (typeof window !== "undefined") { window.print(); } }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Dues & Collection</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">
              Track monthly payments and outstanding dues.
            </p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" size="sm" className="gap-2"><FileSpreadsheet size={16} /> Export</Button>
          </div>
          <Button size="sm" onClick={handlePrint} className="gap-2 shadow-lg">
            <Download size={16} /> <span className="hidden sm:inline">Export</span>
          </Button>

          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">
                {userName ? userName.substring(0, 2) : "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-success flex items-center gap-2">
              <CheckCircle2 size={14} /> Fully Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              <span className="text-success">{stats.paidCount}</span> / {stats.totalCount}
            </div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Residents</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-orange-400 rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-orange-500 flex items-center gap-2">
              <Clock size={14} /> Pending Dues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.pendingCount}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Residents</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-destructive flex items-center gap-2">
              <CircleAlert size={14} /> Total Dues (Filtered)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">৳{stats.totalDues.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Current outstanding</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 bg-secondary/20 p-6 rounded-2xl border items-end print:hidden">
        <div className="space-y-1.5 lg:col-span-1">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Search size={10} /> Search Resident</Label>
          <Input placeholder="Name or phone..." className="h-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Building2 size={10} /> Building</Label>
          <Select value={buildingFilter} onValueChange={val => { setBuildingFilter(val); setRoomFilter("all") }}>
            <SelectTrigger className="h-10 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><DoorOpen size={10} /> Room</Label>
          <Select value={roomFilter} onValueChange={setRoomFilter} disabled={buildingFilter === "all"}>
            <SelectTrigger className="h-10 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rooms</SelectItem>
              {roomOptions.map((r, idx) => <SelectItem key={`${r}-${idx}`} value={r}>Room {r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Payment (This Month)</Label>
          <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
            <SelectTrigger className="h-10 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Resident Status</Label>
          <Select value={residentStatusFilter} onValueChange={setResidentStatusFilter}>
            <SelectTrigger className="h-10 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="left">Ex-Residents</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" className="h-10 font-bold text-xs uppercase" onClick={handleReset}>
          <XCircle size={14} className="mr-1" /> Reset
        </Button>
      </div>

      {/* Table Section */}
      <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
        <CardContent className="p-0">
          {studentsLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="py-4 font-bold text-slate-600">Resident</TableHead>
                  <TableHead className="py-4 font-bold text-slate-600 text-center">Status</TableHead>
                  <TableHead className="py-4 font-bold text-slate-600 text-center">Rent Due</TableHead>
                  <TableHead className="py-4 font-bold text-slate-600 text-center">Food Balance</TableHead>
                  <TableHead className="py-4 font-bold text-slate-600 text-center">Total Due</TableHead>
                  <TableHead className="py-4 font-bold text-slate-600 text-right pr-8">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((s: any) => (
                  <TableRow key={s.id} className="group border-b last:border-0">
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{s.name}</span>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                          Room {s.roomNumber} | {s.buildingName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={cn(
                        "font-bold text-[10px] px-2 h-6 uppercase tracking-wider",
                        s.isPaid 
                          ? "bg-success/10 text-success border-success/20" 
                          : "bg-destructive/5 text-destructive border-destructive/20"
                      )}>
                        {s.isPaid ? <CheckCircle2 size={10} className="mr-1" /> : <Clock size={10} className="mr-1" />}
                        {s.isPaid ? "Paid" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5 font-bold text-slate-700">
                        ৳{s.rentDue.toLocaleString()}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger><Info size={12} className="text-slate-300 hover:text-primary transition-colors" /></TooltipTrigger>
                            <TooltipContent className="bg-slate-800 text-white text-[10px] p-2 border-none">
                              <p>Calculation based on Joining Date + History Map</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={cn(
                        "font-bold flex items-center justify-center gap-1",
                        s.foodBalance >= 0 ? "text-success" : "text-destructive"
                      )}>
                        ৳{Math.abs(s.foodBalance).toLocaleString()}
                        <span className="text-[9px] font-medium opacity-70">
                          ({s.foodBalance >= 0 ? "Credit" : "Due"})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-black text-destructive text-base">
                      ৳{s.totalDue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="font-bold gap-2 text-slate-600 hover:text-primary hover:bg-primary/5 rounded-xl h-9"
                        onClick={() => router.push(`/students/${s.id}`)}
                      >
                        <Eye size={16} /> Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 bg-slate-50/20">
                      <div className="flex flex-col items-center justify-center opacity-30">
                        <Users size={48} strokeWidth={1} />
                        <p className="mt-4 font-bold text-sm">No Resident Records Found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
