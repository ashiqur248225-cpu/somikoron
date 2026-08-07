"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, Search, Loader2, Eye, Printer, TrendingUp, Filter, MoreVertical, CircleDollarSign, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, updateDoc, increment, serverTimestamp } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function DuesPage() {
  const router = useRouter()
  const db = useFirestore()
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")
  const [dueCategoryFilter, setDueCategoryFilter] = useState("all")
  
  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    setAssignedBuildingId(localStorage.getItem("assigned_building_id") || "none")
  }, [])

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "buildings"), where("id", "==", assignedBuildingId))
    }
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: buildings } = useCollection(buildingsQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "students"), where("buildingId", "==", assignedBuildingId))
    }
    return query(collection(db, "students"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: students, isLoading: studentsLoading } = useCollection(studentsQuery)

  // AUTO DUE GENERATION LOGIC FOR ALL STUDENTS IN VIEW
  useEffect(() => {
    if (!students || !db) return;

    const syncMissingDues = async () => {
      const now = new Date();
      const todayLimit = new Date(now.getFullYear(), now.getMonth(), 1);

      students.forEach((s: any) => {
        if (!s.isActive) return;
        
        const billingDateStr = s.billingStartDate || "";
        const billingDate = new Date(billingDateStr);
        if (isNaN(billingDate.getTime())) return;

        const updatedDues = { ...(s.duesBreakdown || {}) };
        let totalDueIncrement = 0;
        let hasChanges = false;

        let checkDate = new Date(billingDate.getFullYear(), billingDate.getMonth(), 1);

        while (checkDate <= todayLimit) {
          const m = MONTHS[checkDate.getMonth()];
          const y = checkDate.getFullYear().toString();
          const label = `${m} ${y}`;

          const inBreakdown = updatedDues[label];
          const inHistory = s.paymentsHistory?.some((p: any) => 
            p.month === m && p.year === y && (Number(p.seatAmount) > 0 || p.method === 'adjustment')
          );

          if (!getDocData(inBreakdown) && !inHistory) {
            const rent = Number(s.monthlyRent || 0);
            if (rent > 0) {
              updatedDues[label] = { month: m, year: y, amount: rent };
              totalDueIncrement += rent;
              hasChanges = true;
            }
          }
          checkDate.setMonth(checkDate.getMonth() + 1);
        }

        if (hasChanges) {
          const sRef = doc(db, "students", s.id);
          updateDoc(sRef, {
            duesBreakdown: updatedDues,
            totalDue: increment(totalDueIncrement),
            updatedAt: serverTimestamp()
          }).catch(() => {});
        }
      });
    };

    const getDocData = (val: any) => val;

    syncMissingDues();
  }, [students, db]);

  const processedData = useMemo(() => {
    if (!students) return []
    return students.map(s => {
      const rentDue = Object.values(s.duesBreakdown || {}).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);
      const foodVal = Number(s.foodDueAmount || 0);
      const foodDue = foodVal < 0 ? Math.abs(foodVal) : 0;
      
      const cookVal = Number(s.cookingDueAmount || 0);
      const cookDue = cookVal < 0 ? Math.abs(cookVal) : 0;
      
      const displayTotalDue = rentDue + foodDue + cookDue;
      
      return { ...s, foodBalance: foodVal, cookingBalance: cookVal, rentDue, displayTotalDue, foodDue, cookDue }
    }).filter(s => {
      const matchesStatus = statusFilter === "all" ? true : (statusFilter === "active" ? s.isActive : !s.isActive)
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || "").includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      
      let matchesDueCategory = true;
      if (dueCategoryFilter === 'rent') matchesDueCategory = s.rentDue > 0;
      if (dueCategoryFilter === 'cooking') matchesDueCategory = s.cookDue > 0;
      if (dueCategoryFilter === 'food') matchesDueCategory = s.foodDue > 0;

      const hasDue = s.displayTotalDue > 0
      
      return matchesStatus && matchesSearch && matchesBuilding && matchesDueCategory && hasDue
    }).sort((a, b) => b.displayTotalDue - a.displayTotalDue)
  }, [students, searchTerm, buildingFilter, statusFilter, dueCategoryFilter])

  const stats = useMemo(() => {
    const totalDue = processedData.reduce((acc, curr) => acc + curr.displayTotalDue, 0)
    return { totalDue, count: processedData.length }
  }, [processedData])

  const handlePrint = () => { 
    if (typeof window !== "undefined") { 
      setTimeout(() => { window.print(); }, 500);
    } 
  }

  const handleReset = () => {
    setSearchTerm("")
    setBuildingFilter("all")
    setStatusFilter("active")
    setDueCategoryFilter("all")
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
          <div className="hidden md:flex items-center gap-3">
            <Button size="sm" variant="outline" className="gap-2 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold" onClick={() => setIsFilterDialogOpen(true)}><Filter size={16} /> Filter</Button>
            <Button size="sm" variant="outline" className="gap-2 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold" onClick={handlePrint}><Printer size={16} /> Print Report</Button>
          </div>

          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-primary">
                  <MoreVertical size={24}/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 shadow-xl border-slate-100">
                <DropdownMenuItem onClick={() => setIsFilterDialogOpen(true)} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                  <Filter size={16} className="text-primary" /> Filter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrint} className="gap-2 font-medium p-3 rounded-lg cursor-pointer">
                  <Printer size={16} className="text-primary" /> Print Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Link href="/profile"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarFallback className="bg-primary text-white font-bold">{userName.substring(0, 2)}</AvatarFallback></Avatar></Link>
        </div>
      </div>

      <div className="print-only print-report-container">
        <div className="report-header">
          <h1>সমীকরণ ছাত্রাবাস</h1>
          <p className="branch-title">{userBranch} Branch • Outstanding Due List</p>
          <div className="flex justify-between items-end mt-4 px-2 text-[8pt] font-bold text-slate-500">
            <div>
              <p>Filter: {buildingFilter === 'all' ? 'All Buildings' : buildings?.find(b => b.id === buildingFilter)?.name}</p>
              <p>Category: {dueCategoryFilter.toUpperCase()}</p>
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
              <th className="text-right">Food Due</th>
              <th className="text-right">Cook Due</th>
              <th className="text-right">Total Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {processedData.map((s: any) => (
              <tr key={s.id}>
                <td className="font-bold">{s.name}<br/><span className="text-[7pt] font-normal text-slate-500">{s.phone}</span></td>
                <td>{s.buildingName} • R-{s.roomNumber}</td>
                <td className="text-right">৳{s.rentDue.toLocaleString()}</td>
                <td className="text-right">৳{s.foodDue.toLocaleString()}</td>
                <td className="text-right">৳{s.cookDue.toLocaleString()}</td>
                <td className="text-right font-black">৳{s.displayTotalDue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={5} className="text-right uppercase">Grand Total Outstanding</td>
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
                  <TableHeader className="bg-secondary/30"><TableRow><TableHead>Resident</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Breakdown (R/F/C)</TableHead><TableHead className="text-right">Total Due</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>{processedData.map((s: any) => (
                    <TableRow 
                      key={s.id} 
                      className="cursor-pointer hover:bg-slate-50/50" 
                      onClick={() => router.push(`/students/${s.id}`)}
                    >
                      <TableCell className="font-bold">{s.name}<br/><span className="text-[10px] text-muted-foreground">{s.phone}</span></TableCell>
                      <TableCell className="text-xs">{s.buildingName} • R-{s.roomNumber}</TableCell>
                      <TableCell className="text-right text-[10px] font-bold text-slate-500">
                        R:{s.rentDue} | F:{s.foodDue} | C:{s.cookDue}
                      </TableCell>
                      <TableCell className="text-right font-black text-destructive text-lg">৳{s.displayTotalDue.toLocaleString()}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/students/${s.id}`)}>Profile</Button>
                      </TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </CardContent>
            </Card>
            <div className="md:hidden space-y-4">
              {processedData.map((s: any) => (
                <Card 
                  key={s.id} 
                  className="border-none shadow-sm rounded-2xl bg-white p-4 space-y-4 cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => router.push(`/students/${s.id}`)}
                >
                  <div className="flex justify-between items-start"><div><h3 className="font-black text-slate-800 text-lg leading-tight">{s.name}</h3><p className="text-xs text-muted-foreground font-medium mt-0.5">{s.phone}</p></div><Badge variant="destructive" className="text-[10px]">Due</Badge></div>
                  <div className="grid grid-cols-3 gap-2 bg-secondary/50 p-2 rounded-xl text-center">
                    <div className="space-y-0.5"><p className="text-[7px] font-bold uppercase opacity-60">Rent</p><p className="text-[10px] font-black">৳{s.rentDue}</p></div>
                    <div className="space-y-0.5"><p className="text-[7px] font-bold uppercase opacity-60">Food</p><p className="text-[10px] font-black">৳{s.foodDue}</p></div>
                    <div className="space-y-0.5"><p className="text-[7px] font-bold uppercase opacity-60">Cook</p><p className="text-[10px] font-black">৳{s.cookDue}</p></div>
                  </div>
                  <div className="bg-destructive/10 p-3 rounded-xl flex justify-between items-center"><span className="text-[10px] font-bold text-destructive uppercase">Total Outstanding</span><span className="text-xl font-black text-destructive">৳{s.displayTotalDue.toLocaleString()}</span></div>
                  <Button variant="outline" className="w-full h-10 rounded-xl font-bold" onClick={(e) => { e.stopPropagation(); router.push(`/students/${s.id}`); }}><Eye size={14} className="mr-2"/> Profile</Button>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Advanced Filter Dues</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5"><Label>Search Name/Phone</Label><Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Type to search..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Building</Label><Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Status</Label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active Residents</SelectItem><SelectItem value="left">Ex-Residents</SelectItem><SelectItem value="all">Both</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2"><CircleDollarSign size={14} className="text-primary" /> Due Category Filter</Label>
              <Select value={dueCategoryFilter} onValueChange={setDueCategoryFilter}>
                <SelectTrigger className="h-12 border-primary/20 bg-primary/5 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Combined Dues</SelectItem>
                  <SelectItem value="rent">Rent Due Only</SelectItem>
                  <SelectItem value="cooking">Cooking Bill Due Only</SelectItem>
                  <SelectItem value="food">Food Balance Due Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={handleReset} className="gap-2 font-bold"><RotateCcw size={14}/> Reset</Button>
            <Button onClick={() => setIsFilterDialogOpen(false)} className="rounded-xl font-bold">Apply Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
