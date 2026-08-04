
"use client"

import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, collection, updateDoc, serverTimestamp, query, where } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Phone, MapPin, 
  History, Loader2, 
  ChevronLeft, Calendar, Shield, Briefcase,
  Lock, Edit, Save, CheckCircle2, Building2, ShieldCheck, RefreshCw, Utensils, AlertCircle
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export default function StaffProfilePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [userRole, setUserRole] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Staff")
  }, [])

  const staffRef = useMemoFirebase(() => id ? doc(db, "staff", id) : null, [db, id])
  const { data: staff, isLoading: staffLoading } = useDoc(staffRef)

  // Form State
  const [editForm, setEditForm] = useState<any>(null)

  useEffect(() => {
    if (staff) {
      setEditForm({
        ...staff,
        monthlySalary: staff.monthlySalary?.toString() || "0",
        isActive: staff.isActive !== false
      })
    }
  }, [staff])

  // Queries for Edit Dialog
  const branchesQuery = useMemoFirebase(() => collection(db, "branches"), [db])
  const { data: branches } = useCollection(branchesQuery)

  const buildingsQuery = useMemoFirebase(() => {
    if (!editForm?.branch) return null
    return query(collection(db, "buildings"), where("branch", "==", editForm.branch))
  }, [db, editForm?.branch])
  const { data: buildings } = useCollection(buildingsQuery)

  const allBuildingsQuery = useMemoFirebase(() => {
    return collection(db, "buildings")
  }, [db])
  const { data: allBuildings } = useCollection(allBuildingsQuery)

  const handleUpdate = async () => {
    if (!staffRef || !editForm) return
    setIsUpdating(true)
    try {
      await updateDoc(staffRef, {
        ...editForm,
        monthlySalary: Number(editForm.monthlySalary),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Updated", description: "Staff profile saved successfully." })
      setIsEditDialogOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const generateRandomPassword = () => {
    setEditForm({ ...editForm, password: Math.random().toString(36).slice(-8) })
  }

  if (staffLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
  if (!staff) return <div className="text-center p-20">Employee not found.</div>

  const sortedHistory = [...(staff.salaryHistory || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const getBuildingName = (bid: string) => {
    if (!bid || bid === 'none') return null
    return allBuildings?.find(b => b.id === bid)?.name || bid
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">Staff Profile</h1>
          <p className="text-muted-foreground text-sm">Detailed information and payroll history.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className={cn("md:col-span-1 border-none shadow-xl rounded-3xl overflow-hidden bg-white", staff.isActive === false && "border-t-8 border-t-destructive")}>
          <div className={cn("h-24 w-full relative", staff.isActive === false ? "bg-destructive/10" : "bg-primary")}>
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
              <div className="h-20 w-20 rounded-full border-4 border-white bg-secondary flex items-center justify-center text-primary shadow-lg">
                {staff.staffType === 'management' ? <Shield size={32}/> : <Briefcase size={32}/>}
              </div>
            </div>
            {staff.isActive === false && (
              <div className="absolute top-2 right-2">
                 <Badge variant="destructive" className="uppercase font-black text-[8px]">Inactive / Exited</Badge>
              </div>
            )}
          </div>
          <CardContent className="pt-14 pb-8 text-center space-y-4">
            <div>
              <h2 className="text-xl font-black text-slate-800">{staff.name}</h2>
              <Badge variant="secondary" className="mt-1 bg-primary/10 text-primary border-none font-bold uppercase text-[10px]">
                {staff.role}
              </Badge>
            </div>
            
            <Separator />
            
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Phone size={16} className="text-slate-400" />
                <span className="font-medium">{staff.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <MapPin size={16} className="text-slate-400" />
                <span className="font-medium">{staff.address || "Address not set"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Building2 size={16} className="text-slate-400" />
                <span className="font-medium">{getBuildingName(staff.assignedBuildingId) || staff.branch}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Calendar size={16} className="text-slate-400" />
                <span className="font-medium">Joined: {staff.createdAt?.toDate ? staff.createdAt.toDate().toLocaleDateString() : 'N/A'}</span>
              </div>

              {userRole === 'Admin' && staff.password && (
                <div className="pt-4 border-t mt-2 space-y-1">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Lock size={10} /> Access Password
                  </p>
                  <div className="p-2 bg-slate-50 rounded border border-dashed border-primary/20 text-center">
                    <span className="font-mono text-sm font-bold text-primary select-all">{staff.password}</span>
                  </div>
                </div>
              )}
            </div>

            {staff.role === 'Building Manager' && (
              <div className="pt-4 space-y-2">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest text-left ml-1">Workflow Mode</p>
                <div className="flex flex-col gap-2">
                  <Badge variant="outline" className={cn("text-[8px] justify-center py-1", staff.canDirectEntryIncome ? "bg-success/5 text-success border-success/20" : "bg-orange-50 text-orange-600 border-orange-200")}>
                    Income: {staff.canDirectEntryIncome ? 'Direct' : 'Request'}
                  </Badge>
                  <Badge variant="outline" className={cn("text-[8px] justify-center py-1", staff.canDirectEntryExpense ? "bg-success/5 text-success border-success/20" : "bg-orange-50 text-orange-600 border-orange-200")}>
                    Expense: {staff.canDirectEntryExpense ? 'Direct' : 'Request'}
                  </Badge>
                </div>
              </div>
            )}
            
            <div className="pt-4">
              {userRole === 'Admin' && (
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full gap-2 font-bold rounded-xl h-10 border-primary/20 text-primary">
                      <Edit size={16} /> Edit Profile
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl">
                    <DialogHeader>
                      <DialogTitle>Edit Staff Member</DialogTitle>
                      <DialogDescription>Update credentials and access permissions.</DialogDescription>
                    </DialogHeader>
                    
                    {editForm && (
                      <div className="space-y-6 py-4">
                        {/* Account Status Toggle */}
                        <div className="p-4 bg-destructive/5 rounded-2xl border border-destructive/20 flex items-center justify-between">
                           <div className="space-y-0.5">
                              <Label className="text-sm font-black flex items-center gap-2 text-destructive">
                                <AlertCircle size={16}/> Account Status
                              </Label>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                                {editForm.isActive ? 'Active - Can Login' : 'Inactive - Login Disabled'}
                              </p>
                           </div>
                           <Switch 
                             checked={editForm.isActive} 
                             onCheckedChange={v => setEditForm({...editForm, isActive: v})} 
                             className="data-[state=checked]:bg-success"
                           />
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">Basic Info</h3>
                          <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Phone Number</Label>
                              <Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label>Password</Label>
                              <div className="flex gap-2">
                                <Input value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} />
                                <Button variant="outline" size="icon" onClick={generateRandomPassword}><RefreshCw size={14}/></Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                          <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">Role & Assignment</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Role</Label>
                              <Select value={editForm.role} onValueChange={v => setEditForm({...editForm, role: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Admin">Super Admin</SelectItem>
                                  <SelectItem value="Branch Manager">Branch Manager</SelectItem>
                                  <SelectItem value="Building Manager">Building Manager</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Monthly Salary</Label>
                              <Input type="number" value={editForm.monthlySalary} onChange={e => setEditForm({...editForm, monthlySalary: e.target.value})} />
                            </div>
                          </div>
                        </div>

                        {editForm.role === 'Building Manager' && (
                          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
                            <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">Approval Workflow</h3>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Direct Income Entry</Label>
                                <Switch checked={editForm.canDirectEntryIncome} onCheckedChange={v => setEditForm({...editForm, canDirectEntryIncome: v, canRequestIncome: !v})} />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Direct Expense Entry</Label>
                                <Switch checked={editForm.canDirectEntryExpense} onCheckedChange={v => setEditForm({...editForm, canDirectEntryExpense: v, canRequestExpense: !v})} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <DialogFooter>
                      <Button onClick={handleUpdate} className="w-full h-12 text-lg font-bold" disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18} className="mr-2" />} Save Changes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="border-none shadow-md bg-white border-l-[6px] border-l-orange-500 rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Monthly Salary</p>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-800">৳{staff.monthlySalary?.toLocaleString() || 0}</div>
                <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Contracted Base Pay</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-success">Total Paid</p>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-800">
                  ৳{(staff.salaryHistory || []).reduce((acc: number, curr: any) => acc + curr.amount, 0).toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Cumulative Payroll</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardHeader className="border-b bg-slate-50/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><History size={16}/> Salary Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHistory.map((h: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">{new Date(h.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-bold text-slate-700">{h.month} {h.year}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{h.method}</Badge></TableCell>
                      <TableCell className="text-right font-black text-slate-800">৳{h.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {sortedHistory.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">No payment records found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
