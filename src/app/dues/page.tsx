
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, Search, Filter, Building2, DoorOpen, Loader2, Eye, CircleAlert, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export default function DuesPage() {
  const router = useRouter()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")

  // Data Fetching
  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students, isLoading } = useCollection(studentsQuery)

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  // Room Options based on building filter
  const roomOptions = useMemo(() => {
    if (buildingFilter === "all" || !buildings) return []
    const b = buildings.find(b => b.id === buildingFilter)
    return b?.roomsDetail?.map((r: any) => r.roomNo) || []
  }, [buildingFilter, buildings])

  // Unified Due Calculation Logic
  const studentsWithDues = useMemo(() => {
    if (!students) return []
    
    return students.map(student => {
      const joinDate = student.createdAt?.toDate?.() || new Date()
      const joinMonth = joinDate.getMonth()
      const joinYear = joinDate.getFullYear()
      const now = new Date()
      
      let totalExpectedRent = 0
      let checkDate = new Date(joinYear, joinMonth, 1)
      
      while (checkDate <= now) {
        totalExpectedRent += (student.monthlyRent || 0)
        checkDate.setMonth(checkDate.getMonth() + 1)
      }

      const startingDebt = student.type === 'old' ? (Number(student.dueAmount) || 0) : 0
      const totalPayments = student.paymentsHistory?.reduce((acc: number, curr: any) => {
        return acc + (curr.seatAmount || (student.paymentSystem === 'package' ? curr.amount : 0) || 0)
      }, 0) || 0

      const rentDue = Math.max(0, (totalExpectedRent + startingDebt) - totalPayments)
      
      let foodDebt = 0
      if (student.paymentSystem === 'non-package') {
        const totalMealCost = student.mealsHistory?.reduce((acc: number, curr: any) => acc + (curr.totalCost || 0), 0) || 0
        const totalFoodPaid = Number(student.foodCost) || 0
        const foodBalance = totalFoodPaid - totalMealCost
        foodDebt = foodBalance < 0 ? Math.abs(foodBalance) : 0
      }

      return {
        ...student,
        totalDue: rentDue + foodDebt,
        rentDue,
        foodDebt
      }
    }).filter(s => s.totalDue > 0)
  }, [students])

  const filteredDues = useMemo(() => {
    return studentsWithDues.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (s.phone || "").includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesRoom = roomFilter === "all" || s.roomNumber === roomFilter
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      return matchesSearch && matchesBuilding && matchesRoom && matchesStatus
    })
  }, [studentsWithDues, searchTerm, buildingFilter, roomFilter, statusFilter])

  const grandTotalDue = useMemo(() => {
    return filteredDues.reduce((acc, curr) => acc + curr.totalDue, 0)
  }, [filteredDues])

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Dues Tracking</h1>
            <p className="text-muted-foreground mt-1">Monitor outstanding payments from residents.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-destructive/5 border-none shadow-sm border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
              <CircleAlert size={16} /> Total Outstanding (Filtered)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">₹{grandTotalDue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 bg-secondary/20 p-4 rounded-xl border">
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

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Resident</TableHead>
                  <TableHead>Building / Room</TableHead>
                  <TableHead>Rent Due</TableHead>
                  <TableHead>Food Due</TableHead>
                  <TableHead className="text-right">Total Due</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDues.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{s.name}</span>
                        <span className="text-[10px] text-muted-foreground">{s.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{s.buildingName}</span>
                        <span className="text-[10px] text-muted-foreground">Room {s.roomNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">₹{s.rentDue?.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">₹{s.foodDebt?.toLocaleString() || 0}</TableCell>
                    <TableCell className="text-right font-bold text-destructive">₹{s.totalDue?.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/students/${s.id}`)}>
                        <Eye size={14} className="mr-1" /> Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredDues.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No pending dues found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
