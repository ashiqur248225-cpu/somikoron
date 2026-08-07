"use client"

import * as React from "react"
import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, updateDoc, deleteDoc, serverTimestamp, collection, query, where } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  Receipt, Calendar, UserCheck, Building2, 
  MapPin, Wallet, Trash2, Edit, Loader2, 
  ArrowLeft, LayoutGrid, Info, Zap, UserCircle, DoorOpen, Utensils, Apple
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: "rent", label: "Building Rent" },
  { id: "electricity", label: "Electricity Bill" },
  { id: "water", label: "Water & Gas Bill" },
  { id: "maintenance", label: "Maintenance/Repair" },
  { id: "food", label: "Food / Meal Cost" },
  { id: "market", label: "General Market" },
  { id: "internet", label: "Internet Bill" },
  { id: "salary", label: "Staff Salary" },
  { id: "others", label: "Others" },
]

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function ExpenseDetailsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = React.use(props.params)
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [userRole, setUserRole] = useState("")

  const expenseCatsRef = useMemoFirebase(() => doc(db, "configs", "expenseCategories"), [db])
  const { data: expenseCatsStore } = useDoc(expenseCatsRef)
  const categories = useMemo(() => expenseCatsStore?.categories || DEFAULT_EXPENSE_CATEGORIES, [expenseCatsStore])

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
  }, [])

  const expenseRef = useMemoFirebase(() => id ? doc(db, "expenses", id) : null, [db, id])
  const { data: expense, isLoading } = useDoc(expenseRef)

  const buildingsQuery = useMemoFirebase(() => {
    if (!expense?.branch) return null
    return query(collection(db, "buildings"), where("branch", "==", expense.branch))
  }, [db, expense?.branch])
  const { data: buildings } = useCollection(buildingsQuery)

  const staffQuery = useMemoFirebase(() => {
    if (!expense?.branch) return null
    return query(collection(db, "staff"), where("branch", "==", expense.branch))
  }, [db, expense?.branch])
  const { data: staffList } = useCollection(staffQuery)

  const [editForm, setEditForm] = useState<any>(null)

  useMemo(() => {
    if (expense) {
      setEditForm({
        category: expense.category,
        buildingId: expense.buildingId || "none",
        apartmentName: expense.apartmentName || "",
        roomNumber: expense.roomNumber || "",
        meterNo: expense.meterNo || "",
        amount: expense.amount.toString(),
        totalMeals: expense.totalMeals?.toString() || "",
        method: expense.method,
        expensePartyName: expense.expensePartyName,
        receiver: expense.receiver || "",
        month: expense.month || MONTHS[new Date().getMonth()],
        year: expense.year || new Date().getFullYear().toString(),
        description: expense.description || "",
        expenseDate: expense.expenseDate,
      })
    }
  }, [expense])

  const handleUpdate = async () => {
    if (!expenseRef || !editForm) return
    
    if (editForm.category === 'others' && !editForm.description) {
      toast({ variant: "destructive", title: "Error", description: "Description is mandatory for 'Others' category." })
      return
    }

    setIsUpdating(true)
    const building = buildings?.find(b => b.id === editForm.buildingId)
    try {
      await updateDoc(expenseRef, {
        ...editForm,
        amount: Number(editForm.amount),
        totalMeals: editForm.category === 'food' ? Number(editForm.totalMeals || 0) : 0,
        buildingName: building?.name || "General",
        updatedAt: serverTimestamp()
      })
      toast({ title: "Updated", description: "Expense record saved." })
      setIsEditDialogOpen(false)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!expenseRef) return
    setIsUpdating(true)
    try {
      await deleteDoc(expenseRef)
      toast({ title: "Deleted", description: "Expense record removed." })
      router.push("/expenses")
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
  if (!expense) return <div className="text-center p-20">Expense not found.</div>

  const selectedBuildingForEdit = buildings?.find(b => b.id === editForm?.buildingId)
  const apartmentList = selectedBuildingForEdit?.apartmentsDetail || []
  const roomList = (() => {
    if (!selectedBuildingForEdit) return []
    const rooms: string[] = []
    selectedBuildingForEdit.apartmentsDetail?.forEach((apt: any) => {
      apt.rooms?.forEach((room: any) => {
        if (room.roomNo && !rooms.includes(String(room.roomNo))) rooms.push(String(room.roomNo))
      })
    })
    return rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  })()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="gap-2" onClick={() => router.push("/expenses")}>
          <ArrowLeft size={16} /> Back to History
        </Button>
        <div className="flex gap-2">
          {userRole !== 'Branch Manager' && (
            <Button variant="outline" className="gap-2" onClick={() => setIsEditDialogOpen(true)}>
              <Edit size={16} /> Edit
            </Button>
          )}
          {(userRole === 'Admin' || userRole === 'Branch Manager') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon"><Trash2 size={16}/></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this expense record?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone. The accounting history will be modified.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete Permanently</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <div className="h-2 bg-destructive w-full" />
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div>
              <Badge variant="secondary" className="capitalize mb-2">{expense.category}</Badge>
              <CardTitle className="text-3xl font-bold text-destructive">৳{expense.amount?.toLocaleString()}</CardTitle>
              {expense.category === 'food' && expense.totalMeals > 0 && (
                <p className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-1">
                  <Utensils size={12}/> {expense.totalMeals} Meals Running
                </p>
              )}
            </div>
            <div className="bg-destructive/10 p-3 rounded-xl text-destructive"><Receipt size={32} /></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5"><Calendar size={10}/> Date of Expense</Label>
              <p className="font-semibold">{new Date(expense.expenseDate).toLocaleDateString('en-IN', { dateStyle: 'full' })}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5"><UserCheck size={10}/> Spent By (Staff)</Label>
              <p className="font-semibold">{expense.expensePartyName}</p>
            </div>
            {(expense.category === 'salary' || expense.category === 'market' || expense.category === 'food') && (
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5"><UserCircle size={10}/> {expense.category === 'salary' ? 'Paid To' : 'Received By'}</Label>
                <p className="font-semibold text-primary">{expense.receiver || "N/A"}</p>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5"><Wallet size={10}/> Payment Method</Label>
              <Badge variant="outline" className="uppercase font-bold">{expense.method}</Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-secondary/30 p-4 rounded-xl border">
              <div className="bg-primary/10 p-2 rounded-lg text-primary"><Building2 size={24} /></div>
              <div>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Allocation</Label>
                <h3 className="font-bold">{expense.buildingName}</h3>
                <div className="flex flex-wrap gap-4 mt-1">
                  {expense.apartmentName && <p className="text-xs text-muted-foreground flex items-center gap-1"><LayoutGrid size={12}/> Unit: {expense.apartmentName}</p>}
                  {expense.roomNumber && <p className="text-xs text-muted-foreground flex items-center gap-1"><DoorOpen size={12}/> Room: {expense.roomNumber}</p>}
                  {expense.meterNo && <p className="text-xs text-primary font-bold flex items-center gap-1"><Zap size={12}/> Meter: {expense.meterNo}</p>}
                </div>
              </div>
            </div>

            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-2">
              <Label className="text-[10px] uppercase font-bold text-primary flex items-center gap-1.5"><Info size={10}/> Note / Description</Label>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{expense.description || "No additional details provided."}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Expense Record</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Expense Category</Label>
                  <Select value={editForm.category} onValueChange={val => setEditForm({...editForm, category: val, buildingId: 'none', apartmentName: '', roomNumber: '', meterNo: '', receiver: ''})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map((cat: any) => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Spent By (Staff)</Label>
                  <Select value={editForm.expensePartyName} onValueChange={val => setEditForm({...editForm, expensePartyName: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Dynamic Fields Section */}
              <div className="space-y-4">
                {!['salary', 'food'].includes(editForm.category) && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase">Target Building</Label>
                      <Select value={editForm.buildingId} onValueChange={val => setEditForm({...editForm, buildingId: val, apartmentName: "", roomNumber: "", meterNo: ""})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">General / No Building</SelectItem>
                          {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {(editForm.category === 'electricity' || editForm.category === 'internet' || editForm.category === 'maintenance') && editForm.buildingId !== 'none' && (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">Apartment (Optional)</Label>
                        <Select value={editForm.apartmentName} onValueChange={val => {
                          const apt = apartmentList.find((a: any) => a.name === val);
                          setEditForm({...editForm, apartmentName: val, meterNo: apt?.meterNo || ""});
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {apartmentList.map((apt: any) => <SelectItem key={apt.name} value={apt.name}>{apt.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {(editForm.category === 'maintenance' || editForm.category === 'others' || editForm.category === 'internet') && editForm.buildingId !== 'none' && (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">Room Number (Optional)</Label>
                        <Select 
                          value={editForm.roomNumber} 
                          onValueChange={val => setEditForm({...editForm, roomNumber: val})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Room" />
                          </SelectTrigger>
                          <SelectContent>
                            {roomList.map(r => <SelectItem key={r} value={r}>Room {r}</SelectItem>)}
                            {roomList.length === 0 && <SelectItem disabled value="none">No rooms found</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {editForm.category === 'electricity' && (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase flex items-center gap-1"><Zap size={12}/> Meter Number</Label>
                        <Select 
                          disabled={editForm.buildingId === 'none'} 
                          value={editForm.meterNo} 
                          onValueChange={val => setEditForm({...editForm, meterNo: val})}
                        >
                          <SelectTrigger className="bg-white"><SelectValue placeholder="Select Meter" /></SelectTrigger>
                          <SelectContent>
                            {selectedBuildingForEdit?.apartmentsDetail?.map((apt: any, idx: number) => (
                              <SelectItem key={idx} value={apt.meterNo || `meter-${idx}`}>{apt.meterNo} ({apt.name})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {(editForm.category === 'market' || editForm.category === 'food') && (
                  <div className="space-y-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <Label className="text-xs font-bold uppercase text-orange-700">{editForm.category === 'food' ? 'Food Cost Details' : 'Market Info'}</Label>
                    <Select value={editForm.receiver} onValueChange={val => setEditForm({...editForm, receiver: val})}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Receiver Staff" /></SelectTrigger>
                      <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {editForm.category === 'food' && (
                      <div className="space-y-2">
                        <Label className="text-xs">Total Meals Running Today (Optional)</Label>
                        <Input type="number" placeholder="e.g. 120" value={editForm.totalMeals} onChange={e => setEditForm({...editForm, totalMeals: e.target.value})} className="bg-white" />
                      </div>
                    )}
                  </div>
                )}

                {editForm.category === 'salary' && (
                  <div className="space-y-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <Label className="text-xs font-bold uppercase text-primary">Salary Info</Label>
                    <Select value={editForm.receiver} onValueChange={val => setEditForm({...editForm, receiver: val})}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Employee" /></SelectTrigger>
                      <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={editForm.month} onValueChange={val => setEditForm({...editForm, month: val})}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={editForm.year} onValueChange={val => setEditForm({...editForm, year: val})}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-xs font-bold uppercase">Amount (৳)</Label><Input type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} /></div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Method</Label>
                  <Select value={editForm.method} onValueChange={val => setEditForm({...editForm, method: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="bkash">Bkash</SelectItem>
                      <SelectItem value="nagad">Nagad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Expense Date</Label>
                <Input type="date" value={editForm.expenseDate} onChange={e => setEditForm({...editForm, expenseDate: e.target.value})} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Note / Description</Label>
                <Textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
              </div>

              <Button onClick={handleUpdate} className="w-full h-12" disabled={isUpdating}>
                {isUpdating ? <Loader2 className="animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
