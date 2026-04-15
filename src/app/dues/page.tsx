
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, Search, Loader2, Eye, Printer, TrendingUp, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function DuesPage() {
  const router = useRouter()
  const db = useFirestore()
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")
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
      const rentDue = s.totalDue || 0;
      const foodBalance = s.foodDueAmount || 0;
      const displayTotalDue = rentDue + (foodBalance < 0 ? Math.abs(foodBalance) : 0);
      return { ...s, foodBalance, displayTotalDue }
    }).filter(s => {
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || "").includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      
      // Strict rule: Show only if has due
      const hasDue = s.displayTotalDue > 0
      
      return matchesStatus && matchesSearch && matchesBuilding && hasDue
    }).sort((a, b) => b.displayTotalDue - a.displayTotalDue)
  }, [students, searchTerm, buildingFilter, statusFilter])

  const stats = useMemo(() => {
    const totalDue = processedData.reduce((acc, curr) => acc + curr.displayTotalDue, 0)
    return { totalDue, count: processedData.length }
  }, [processedData])

  const handlePrint = () => { 
    if (typeof window !== "undefined") { 
      setTimeout(() => { window.print(); }, 500);
    } 
  }

  return (
    <div className="space-y-8 pb-20 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Due</h1></div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsFilterDialogOpen(true)}><Filter size={16} /> Filter</Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} /> Print Report</Button>
          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      {/* OFFICIAL A4 PRINT REPORT */}
      <div className="print-only print-report-container">
        <div className="report-header">
          <h1>সমীকরণ ছাত্রাবাস</h1>
          <p className="branch-title">{userBranch} Branch • Outstanding Due List</p>
          <div className="flex justify-between items-end mt-4 px-2 text-[8pt] font-bold text-slate-500">
            <div>
              <p>Filter: {buildingFilter === 'all' ? 'All Buildings' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
              <p>Resident Status: {statusFilter.toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p>Generated: {new Date().toLocaleString()}</p>
              <p>Total Records: {stats.count}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th className="text-right">Rent Due</th>
              <th className="text-right">Food Balance</th>
              <th className="text-right">Total Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {processedData.map((s: any) => (
              <tr key={s.id}>
                <td className="font-bold">{s.name}<br/><span className="text-[7pt] text-slate-500 font-normal">{s.phone}</span></td>
                <td>{s.buildingName} • R-{s.roomNumber}</td>
                <td className="text-right">৳{(s.totalDue || 0).toLocaleString()}</td>
                <td className={cn("text-right", s.foodBalance < 0 ? "text-destructive font-bold" : "text-success")}>
                  ৳{s.foodBalance.toLocaleString()}
                </td>
                <td className="text-right font-black">৳{s.displayTotalDue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={4} className="text-right uppercase">Grand Total Outstanding</td>
              <td className="text-right">৳{stats.totalDue.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="print-footer">
          <div className="page-number"></div>
          <div className="signature-box">Manager Signature</div>
        </div>
      </div>

      <div className="print:hidden space-y-8">
        <Card className="shadow-sm border-none bg-white border-l-[6px] border-l-destructive rounded-2xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-bold uppercase text-destructive">Total Outstanding</CardTitle><TrendingUp className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-black text-slate-900">৳{stats.totalDue.toLocaleString()}</div></CardContent></Card>

        {studentsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            <Card className="hidden md:block border-none shadow-sm overflow-hidden bg-white rounded-2xl">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-secondary/30"><TableRow><TableHead>Resident</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Total Due</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>{processedData.map((s: any) => (<TableRow key={s.id}><TableCell className="font-bold">{s.name}<br/><span className="text-[10px] text-muted-foreground">{s.phone}</span></TableCell><TableCell className="text-xs">{s.buildingName} • R-{s.roomNumber}</TableCell><TableCell className="text-right font-black text-destructive text-lg">৳{s.displayTotalDue.toLocaleString()}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => router.push(`/students/${s.id}`)}>Profile</Button></TableCell></TableRow>))}</TableBody>
                </Table>
              </CardContent>
            </Card>
            <div className="md:hidden space-y-4">
              {processedData.map((s: any) => (
                <Card key={s.id} className="border-none shadow-sm rounded-2xl bg-white p-4 space-y-4">
                  <div className="flex justify-between items-start"><div><h3 className="font-black text-slate-800 text-lg leading-tight">{s.name}</h3><p className="text-xs text-muted-foreground font-medium mt-0.5">{s.phone}</p></div><Badge variant="destructive" className="text-[10px]">Due</Badge></div>
                  <div className="bg-secondary/30 p-3 rounded-xl flex justify-between items-center"><span className="text-[10px] font-bold text-destructive uppercase">Outstanding</span><span className="text-xl font-black text-destructive">৳{s.displayTotalDue.toLocaleString()}</span></div>
                  <Button variant="outline" className="w-full h-10 rounded-xl font-bold" onClick={() => router.push(`/students/${s.id}`)}><Eye size={14} className="mr-2"/> Profile</Button>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Filter Dues</DialogTitle></DialogHeader>
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
