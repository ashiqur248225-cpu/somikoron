"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, updateDoc, deleteDoc, serverTimestamp, collection } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  Receipt, Calendar, UserCheck, Building2, 
  MapPin, Wallet, Trash2, Edit, Loader2, 
  ArrowLeft, LayoutGrid, Info, Zap, UserCircle
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

const EXPENSE_CATEGORIES = [
  { id: "rent", label: "Building Rent" },
  { id: "electricity", label: "Electricity Bill" },
  { id: "water", label: "Water & Gas Bill" },
  { id: "maintenance", label: "Maintenance/Repair" },
  { id: "market", label: "Market/Food" },
  { id: "internet", label: "Internet Bill" },
  { id: "salary", label: "Staff Salary" },
  { id: "others", label: "Others" },
]

export default function ExpenseDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const id = params.id
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const expenseRef = useMemoFirebase(() => id ? doc(db, "expenses", id) : null, [db, id])
  const { data: expense, isLoading } = useDoc(expenseRef)

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const staffQuery = useMemoFirebase(() => collection(db, "staff"), [db])
  const { data: staffList } = useCollection(staffQuery)

  const [editForm, setEditForm] = useState<any>(null)

  useMemo(() => {
    if (expense) {
      setEditForm({
        category: expense.category,
        buildingId: expense.buildingId || "",
        apartmentName: expense.apartmentName || "",
        roomNumber: expense.roomNumber || "",
        amount: expense.amount.toString(),
        method: expense.method,
        expensePartyName: expense.expensePartyName,
        receiver: expense.receiver || "",
        description: expense.description || "",
        expenseDate: expense.expenseDate,
      })
    }
  }, [expense])

  const handleUpdate = async () => {
    if (!expenseRef || !editForm) return
    setIsUpdating(true)
    const building = buildings?.find(b => b.id === editForm.buildingId)
    try {
      await updateDoc(expenseRef, {
        ...editForm,
        amount: Number(editForm.amount),
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
  const apartmentsInBuilding = selectedBuildingForEdit?.apartmentsDetail || []

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="gap-2" onClick={() => router.push("/expenses")}>
          <ArrowLeft size={16} /> Back to History
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setIsEditDialogOpen(true)}>
            <Edit size={16} /> Edit
          </Button>
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
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <div className="h-2 bg-destructive w-full" />
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div>
              <Badge variant="secondary" className="capitalize mb-2">{expense.category}</Badge>
              <CardTitle className="text-3xl font-bold text-destructive">₹{expense.amount?.toLocaleString()}</CardTitle>
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
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5"><UserCheck size={10}/> Handled By (Expenser)</Label>
              <p className="font-semibold">{expense.expensePartyName}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5"><Wallet size={10}/> Payment Method</Label>
              <Badge variant="outline" className="uppercase font-bold">{expense.method}</Badge>
            </div>
            {expense.receiver && (
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5"><UserCircle size={10}/> Receiver / Medium</Label>
                <p className="font-semibold">{expense.receiver}</p>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-secondary/30 p-4 rounded-xl border">
              <div className="bg-primary/10 p-2 rounded-lg text-primary"><Building2 size={24} /></div>
              <div>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Allocation</Label>
                <h3 className="font-bold">{expense.buildingName}</h3>
                {expense.apartmentName && expense.apartmentName !== 'none' && (
                  <p className="text-xs text-muted-foreground">Unit: {expense.apartmentName} {expense.roomNumber ? `| Room ${expense.roomNumber}` : ''}</p>
                )}
              </div>
            </div>

            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-2">
              <Label className="text-[10px] uppercase font-bold text-primary flex items-center gap-1.5"><Info size={10}/> Description / Notes</Label>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{expense.description || "No additional details provided for this expense."}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Expense Record</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Expense Category</Label>
                <Select value={editForm.category} onValueChange={val => setEditForm({...editForm, category: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target Building</Label>
                <Select value={editForm.buildingId} onValueChange={val => setEditForm({...editForm, buildingId: val, apartmentName: "none"})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General / No Building</SelectItem>
                    {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {editForm.buildingId && editForm.buildingId !== "none" && (
                <div className="space-y-2">
                  <Label>Apartment / Room (Optional)</Label>
                  <Select value={editForm.apartmentName} onValueChange={val => setEditForm({...editForm, apartmentName: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Select Unit --</SelectItem>
                      {apartmentsInBuilding.map((a: any) => <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Expenser (Staff Name)</Label>
                <Select value={editForm.expensePartyName} onValueChange={val => setEditForm({...editForm, expensePartyName: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} /></div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={editForm.method} onValueChange={val => setEditForm({...editForm, method: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bkash">Bkash</SelectItem>
                      <SelectItem value="nagad">Nagad</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Expense Date</Label>
                <Input type="date" value={editForm.expenseDate} onChange={e => setEditForm({...editForm, expenseDate: e.target.value})} />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
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
