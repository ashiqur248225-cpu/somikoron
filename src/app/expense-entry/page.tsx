"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, query, where, increment, updateDoc, arrayUnion } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { 
  Receipt, 
  Loader2, 
  ChevronLeft,
  LayoutGrid,
  Wallet,
  Zap
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2024", "2025", "2026", "2027", "2028"];

const EXPENSE_CATEGORIES = [
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

export default function ExpenseEntryPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const getLocalYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }

  const [formData, setFormData] = useState({
    category: "others",
    amount: "",
    expenseDate: getLocalYMD(),
    method: "cash",
    spentBy: "",
    buildingId: "none",
    apartmentName: "",
    roomNumber: "",
    meterNo: "",
    receiver: "",
    totalMeals: "",
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    description: ""
  })

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setAssignedBuildingId(localStorage.getItem("assigned_building_id") || "none")
  }, [])

  // Check permissions for Building Manager
  const staffId = typeof window !== 'undefined' ? localStorage.getItem("somikoron_auth_id") : ""
  const staffRef = useMemoFirebase(() => staffId ? doc(db, "staff", staffId) : null, [db, staffId])
  const { data: staffData } = useDoc(staffRef)

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "buildings"), where("id", "==", assignedBuildingId))
    }
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: buildings } = useCollection(buildingsQuery)

  const staffQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "staff"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: staffList } = useCollection(staffQuery)

  const managementStaff = useMemo(() => {
    if (!staffList) return []
    return staffList.filter(s => s.staffType === 'management' || !s.staffType)
  }, [staffList])

  const receiverStaffList = useMemo(() => {
    if (!staffList) return []
    if (formData.category === 'salary' || formData.category === 'food') return staffList
    return managementStaff
  }, [staffList, managementStaff, formData.category])

  // Helper to get rooms from selected building
  const roomList = useMemo(() => {
    const selectedB = buildings?.find(b => b.id === formData.buildingId)
    if (!selectedB) return []
    const rooms: string[] = []
    selectedB.apartmentsDetail?.forEach((apt: any) => {
      apt.rooms?.forEach((room: any) => {
        if (room.roomNo && !rooms.includes(String(room.roomNo))) rooms.push(String(room.roomNo))
      })
    })
    return rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [buildings, formData.buildingId])

  const handleCreateExpense = async () => {
    if (!formData.amount || !formData.spentBy) {
      toast({ variant: "destructive", title: "Error", description: "Amount and Spent By are required." })
      return
    }
    setIsSubmitting(true)
    try {
      const selectedB = buildings?.find(b => b.id === formData.buildingId)
      const amount = Number(formData.amount)

      // ROLE BASED BRANCHING
      const isBM = userRole === 'Building Manager'
      const needsApproval = isBM && (staffData?.canRequestExpense === true || !staffData?.canDirectEntryExpense)

      if (needsApproval) {
        const reqId = doc(collection(db, "managerRequests")).id
        await setDoc(doc(db, "managerRequests", reqId), {
          id: reqId,
          requestType: "expense",
          amount,
          category: formData.category,
          expenseDate: formData.expenseDate,
          method: formData.method,
          spentBy: formData.spentBy,
          buildingId: formData.buildingId,
          buildingName: selectedB?.name || "General",
          meterNo: formData.meterNo,
          roomNumber: formData.roomNumber,
          receiver: formData.receiver,
          totalMeals: Number(formData.totalMeals || 0),
          month: formData.month,
          year: formData.year,
          description: formData.description,
          branch: userBranch,
          requestedBy: staffId,
          requestedByName: userName,
          createdAt: serverTimestamp()
        })
        toast({ title: "Request Sent", description: "Your expense entry is pending for Admin approval." })
        router.push('/')
        return
      }

      // Direct Entry
      const expenseId = doc(collection(db, "expenses")).id
      const expenseData = { 
        ...formData, 
        id: expenseId,
        amount, 
        totalMeals: formData.category === 'food' ? Number(formData.totalMeals || 0) : 0,
        branch: userBranch, 
        buildingName: selectedB?.name || "General", 
        expensePartyName: formData.spentBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp() 
      }

      await setDoc(doc(db, "expenses", expenseId), expenseData)

      // Update Salary History if applicable
      if (formData.category === 'salary' && formData.receiver) {
        const targetStaff = staffList?.find(s => s.name === formData.receiver)
        if (targetStaff) {
          await updateDoc(doc(db, "staff", targetStaff.id), {
            salaryHistory: arrayUnion({
              amount,
              month: formData.month,
              year: formData.year,
              date: new Date().toISOString(),
              method: formData.method
            })
          })
        }
      }

      // Update balance
      const balanceRef = doc(db, "netBalance", userBranch);
      const methodKeyMap: Record<string, string> = {
        'cash': 'totalCash', 'bkash': 'totalBkash', 'nagad': 'totalNagad', 'bank': 'totalBank'
      };
      const methodKey = methodKeyMap[formData.method] || 'totalCash';

      await setDoc(balanceRef, {
        branchId: userBranch,
        [methodKey]: increment(-amount),
        totalHandCash: increment(-amount),
        lastUpdated: serverTimestamp()
      }, { merge: true });

      if (formData.category === 'food') {
        const breakdownId = doc(collection(db, "foodCostBreakdown")).id
        await setDoc(doc(db, "foodCostBreakdown", breakdownId), {
          id: breakdownId, expenseId, branch: userBranch, date: formData.expenseDate,
          amount, totalMeals: Number(formData.totalMeals || 0), createdBy: staffId, createdByName: userName, createdAt: serverTimestamp()
        })
      }

      toast({ title: "Expense Recorded" })
      router.push('/expenses')
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) } 
    finally { setIsSubmitting(false) }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        {userRole === 'Building Manager' ? (
          <SidebarTrigger className="-ml-2 md:hidden" />
        ) : (
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft />
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">Expense Entry</h1>
          <p className="text-muted-foreground text-sm">Record operational expense for {userBranch}.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        <div className="h-2 bg-destructive w-full" />
        <CardHeader><CardTitle className="text-xl font-bold flex items-center gap-2 text-destructive"><Receipt size={24}/> New Expense Record</CardTitle></CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><LayoutGrid size={14}/> Core Details</Label>
                <div className="space-y-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="space-y-1.5"><Label className="text-xs">Expense Date</Label><Input type="date" value={formData.expenseDate} onChange={e => setFormData({...formData, expenseDate: e.target.value})} className="bg-white h-12 rounded-xl shadow-sm" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Category</Label><Select value={formData.category} onValueChange={v => setFormData({...formData, category: v, buildingId: "none", apartmentName: "", roomNumber: "", meterNo: "", receiver: "", totalMeals: ""})}><SelectTrigger className="bg-white h-12 rounded-xl font-bold shadow-sm"><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label className="text-xs">Amount (৳)</Label><Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="bg-white h-14 rounded-xl text-2xl font-black text-destructive shadow-sm" placeholder="0.00" /></div>
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Wallet size={14}/> Payment Info</Label>
                <div className="grid grid-cols-1 gap-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="space-y-1.5"><Label className="text-xs">Method</Label><Select value={formData.method} onValueChange={v => setFormData({...formData, method: v})}><SelectTrigger className="bg-white h-12 rounded-xl shadow-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1.5"><Label className="text-xs">Spent By (Staff)</Label><Select value={formData.spentBy} onValueChange={v => setFormData({...formData, spentBy: v})}><SelectTrigger className="bg-white h-12 rounded-xl shadow-sm"><SelectValue placeholder="Staff Name" /></SelectTrigger><SelectContent>{managementStaff?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Zap size={14}/> Context Fields</Label>
                <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 space-y-5 min-h-[400px] shadow-inner">
                  {['rent', 'electricity', 'water', 'maintenance', 'others', 'internet'].includes(formData.category) && (
                    <div className="space-y-4">
                      <div className="space-y-1.5"><Label className="text-xs">Target Building</Label><Select value={formData.buildingId} onValueChange={v => setFormData({...formData, buildingId: v, apartmentName: "", roomNumber: "", meterNo: ""})}><SelectTrigger className="bg-white h-11 rounded-xl shadow-sm"><SelectValue placeholder="Building" /></SelectTrigger><SelectContent><SelectItem value="none">General / No Building</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                      {formData.category === 'electricity' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Meter Number</Label>
                          <Select 
                            disabled={formData.buildingId === 'none'} 
                            value={formData.meterNo} 
                            onValueChange={v => setFormData({...formData, meterNo: v})}
                          >
                            <SelectTrigger className="bg-white h-11 rounded-xl shadow-sm">
                              <SelectValue placeholder="Select Meter" />
                            </SelectTrigger>
                            <SelectContent>
                              {buildings?.find(b => b.id === formData.buildingId)?.apartmentsDetail?.map((apt: any, idx: number) => (
                                <SelectItem key={idx} value={apt.meterNo || `meter-${idx}`}>
                                  {apt.meterNo} ({apt.name})
                                </SelectItem>
                              ))}
                              {(!buildings?.find(b => b.id === formData.buildingId)?.apartmentsDetail || buildings?.find(b => b.id === formData.buildingId)?.apartmentsDetail.length === 0) && formData.buildingId !== 'none' && (
                                <SelectItem disabled value="none">No meters configured</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {formData.category === 'internet' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Apartment (Optional)</Label>
                          <Select 
                            disabled={formData.buildingId === 'none'} 
                            value={formData.apartmentName} 
                            onValueChange={v => setFormData({...formData, apartmentName: v})}
                          >
                            <SelectTrigger className="bg-white h-11 rounded-xl shadow-sm">
                              <SelectValue placeholder="Select Apartment" />
                            </SelectTrigger>
                            <SelectContent>
                              {buildings?.find(b => b.id === formData.buildingId)?.apartmentsDetail?.map((apt: any, idx: number) => (
                                <SelectItem key={idx} value={apt.name}>
                                  {apt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {['maintenance', 'others', 'internet'].includes(formData.category) && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Room / Unit (Optional)</Label>
                          <Select 
                            disabled={formData.buildingId === 'none'} 
                            value={formData.roomNumber} 
                            onValueChange={v => setFormData({...formData, roomNumber: v})}
                          >
                            <SelectTrigger className="bg-white h-11 rounded-xl shadow-sm">
                              <SelectValue placeholder="Select Room" />
                            </SelectTrigger>
                            <SelectContent>
                              {roomList.map(r => (
                                <SelectItem key={r} value={r}>Room {r}</SelectItem>
                              ))}
                              {roomList.length === 0 && <SelectItem disabled value="none">No rooms found</SelectItem>}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                  {formData.category === 'salary' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5"><Label className="text-xs">Staff Member</Label><Select value={formData.receiver} onValueChange={v => setFormData({...formData, receiver: v})}><SelectTrigger className="bg-white h-11 rounded-xl shadow-sm"><SelectValue placeholder="Recipient" /></SelectTrigger><SelectContent>{receiverStaffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                      <div className="grid grid-cols-2 gap-2"><Select value={formData.month} onValueChange={v => setFormData({...formData, month: v})}><SelectTrigger className="bg-white h-11 rounded-xl shadow-sm"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><Select value={formData.year} onValueChange={v => setFormData({...formData, year: v})}><SelectTrigger className="bg-white h-11 rounded-xl shadow-sm"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                  )}
                  {formData.category === 'food' && (
                    <div className="space-y-4">
                      <p className="text-[10px] text-primary font-bold bg-primary/10 p-3 rounded-xl leading-tight">Dual record in Expense and Food Cost Breakdown.</p>
                      <div className="space-y-1.5"><Label className="text-xs font-bold text-primary">Total Meals Logged</Label><Input type="number" placeholder="Optional" value={formData.totalMeals} onChange={e => setFormData({...formData, totalMeals: e.target.value})} className="bg-white h-12 rounded-xl text-lg font-black border-primary/20 shadow-sm" /></div>
                      <div className="space-y-1.5"><Label className="text-xs">Received By</Label><Select value={formData.receiver} onValueChange={v => setFormData({...formData, receiver: v})}><SelectTrigger className="bg-white h-11 rounded-xl shadow-sm"><SelectValue placeholder="Market Manager / Cook" /></SelectTrigger><SelectContent>{receiverStaffList?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                  )}
                  <div className="space-y-1.5 pt-4"><Label className="text-xs">Description / Notes</Label><Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Details..." className="bg-white rounded-2xl resize-none min-h-[120px] shadow-sm" /></div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="p-10 bg-slate-50 border-t"><Button onClick={handleCreateExpense} disabled={isSubmitting} className="w-full h-20 rounded-3xl text-2xl font-black bg-destructive hover:bg-destructive/90 shadow-2xl shadow-destructive/20 gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Receipt size={32}/>} Record Final Expense</Button></CardFooter>
      </Card>
    </div>
  )
}
