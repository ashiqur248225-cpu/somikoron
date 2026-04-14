
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Users, Search, Building2, Loader2, Eye, Printer, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function StudentsPage() {
  const router = useRouter()
  const db = useFirestore()
  
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
      const foodDue = Number(s.foodDueAmount) || 0;
      const totalReceived = s.historicalTotalReceived || 0;
      const totalDue = rentDue + (foodDue < 0 ? Math.abs(foodDue) : 0);
      return { ...s, totalReceived, rentDue, foodBalance: foodDue, totalDue }
    }).filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || "").includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      const matchesPlan = planFilter === "all" || s.paymentSystem === planFilter
      return matchesSearch && matchesBuilding && matchesStatus && matchesPlan
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [students, searchTerm, buildingFilter, statusFilter, planFilter])

  const handlePrint = () => { 
    if (typeof window !== "undefined") { 
      setTimeout(() => { window.print(); }, 500);
    } 
  }

  return (
    <div className="space-y-8 pb-20 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2"><SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mr-2 h-4 md:hidden" /><div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Students</h1></div></div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsFilterDialogOpen(true)}><Filter size={16} /> Filter</Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> Download PDF</Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* OFFICIAL A4 PRINT REPORT */}
      <div className="print-only print-report-container">
        <div className="report-header">
          <h1>সমীকরণ ছাত্রাবাস</h1>
          <p className="branch-title">{userBranch} Branch • Student Directory Report</p>
          <div className="flex justify-between items-end mt-4 px-2 text-[8pt] font-bold text-slate-500">
            <div>
              <p>Filter: {buildingFilter === 'all' ? 'Entire Branch' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
              <p>Count: {processedStudents.length} Students</p>
            </div>
            <div className="text-right">
              <p>Generated: {new Date().toLocaleString()}</p>
              <p>Staff: {userName}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th className="text-right">Monthly Rent</th>
              <th className="text-right">Total Received</th>
              <th className="text-right">Rent Due</th>
              <th className="text-right">Food Balance</th>
            </tr>
          </thead>
          <tbody>
            {processedStudents.map((s: any) => (
              <tr key={s.id}>
                <td className="font-bold">{s.name}<br/><span className="text-[7pt] font-normal text-slate-500">{s.phone}</span></td>
                <td>{s.buildingName} • R-{s.roomNumber}</td>
                <td className="text-right">৳{s.monthlyRent}</td>
                <td className="text-right">৳{s.totalReceived.toLocaleString()}</td>
                <td className="text-right font-bold text-destructive">৳{s.rentDue.toLocaleString()}</td>
                <td className="text-right">
                  {s.paymentSystem === 'non-package' ? `৳${s.foodBalance.toLocaleString()}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={4} className="text-right uppercase">Total Due Overview</td>
              <td className="text-right">৳{processedStudents.reduce((a, b) => a + b.rentDue, 0).toLocaleString()}</td>
              <td className="text-right"></td>
            </tr>
          </tfoot>
        </table>

        <div className="print-footer">
          <div className="page-number"></div>
          <div className="signature-box">Manager Signature</div>
        </div>
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

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Filter Students</DialogTitle></DialogHeader>
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
