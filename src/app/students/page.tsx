
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

  const processedStudents = useMemo(() => {
    if (!students) return []
    return students.map(s => {
      const rentDue = s.totalDue || 0;
      const historicalFoodDue = Number(s.foodDueAmount) || 0
      const foodBalance = historicalFoodDue 
      const totalReceived = s.historicalTotalReceived || 0
      const totalDue = rentDue + (foodBalance < 0 ? Math.abs(foodBalance) : 0)
      return { ...s, rentDue, foodBalance, totalDue, totalReceived }
    }).filter(s => {
      const search = searchTerm.toLowerCase()
      const matchesSearch = s.name.toLowerCase().includes(search) || (s.phone || "").includes(search)
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

  const handlePrint = () => { 
    if (typeof window !== "undefined") { 
      setTimeout(() => {
        window.print(); 
      }, 500);
    } 
  }

  return (
    <div className="space-y-8 pb-20 print:p-0 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Residents</h1></div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsFilterDialogOpen(true)}><Filter size={16} /> Filter</Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> Download PDF</Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* OFFICIAL PRINT REPORT SECTION */}
      <div className="print-only print-report-container">
        <div className="report-header">
          <h1 className="text-2xl font-black uppercase text-primary">সমীকরণ ছাত্রাবাস</h1>
          <p className="text-sm font-bold text-slate-600">{userBranch} Branch • Resident Directory Report</p>
        </div>

        <table className="w-full border-collapse mt-6">
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th className="text-right">Monthly Rent</th>
              <th className="text-right">Total Due</th>
            </tr>
          </thead>
          <tbody>
            {processedStudents.map((s: any) => (
              <tr key={s.id}>
                <td className="font-bold">{s.name}</td>
                <td>{s.buildingName} - R{s.roomNumber}</td>
                <td className="text-right">৳{s.monthlyRent}</td>
                <td className="text-right font-black">৳{s.totalDue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="print:hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : (
          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30"><TableRow><TableHead>Student</TableHead><TableHead>Location</TableHead><TableHead>Monthly Rent</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{processedStudents.map((s: any) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => router.push(`/students/${s.id}`)}><TableCell><div className="font-bold">{s.name}</div><div className="text-[10px] text-muted-foreground">{s.phone}</div></TableCell><TableCell className="text-xs">{s.buildingName} • R-{s.roomNumber}</TableCell><TableCell className="font-black text-slate-700">৳{s.monthlyRent?.toLocaleString()}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon"><Eye size={16}/></Button></TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
