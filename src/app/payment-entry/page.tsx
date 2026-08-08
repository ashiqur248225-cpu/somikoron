"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, increment, updateDoc, arrayUnion, query, where, getDoc, writeBatch } from "firebase/firestore"
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
  Wallet, 
  Loader2, 
  CheckCircle2, 
  ChevronLeft,
  Smartphone,
  RefreshCw,
  Coins,
  Wifi,
  UtensilsCrossed,
  ArrowRight,
  Calculator,
  HandCoins,
  Soup,
  Home
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { sendSMS } from "@/app/actions/sms"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Checkbox } from "@/components/ui/checkbox"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2024", "2025", "2026", "2027", "2028", "2029", "2030", "2031", "2032", "2033" ,"2034", "2035", "2036", "2037", "2038"];

function PaymentEntryForm() {
  const { toast } = useToast()
  const db = useFirestore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlStudentId = searchParams.get('studentId')
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    buildingId: "all",
    roomNumber: "all",
    studentId: "",
    totalReceived: "",
    method: "cash",
    receiver: "",
    description: "",
    applyCookingBill: true,
    applyWifiBill: false
  })

  useEffect(() => {
    const branch = localStorage.getItem("user_branch") || "Main Branch"
    const name = localStorage.getItem("user_name") || "User"
    const role = localStorage.getItem("user_role") || "Manager"
    const bId = localStorage.getItem("assigned_building_id") || "none"

    setUserBranch(branch)
    setUserName(name)
    setUserRole(role)
    setAssignedBuildingId(bId)

    setFormData(prev => ({ 
      ...prev, 
      receiver: name,
      buildingId: (role === 'Building Manager' && bId !== 'none') ? bId : prev.buildingId,
      studentId: urlStudentId || prev.studentId
    }))
  }, [urlStudentId])

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

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Building Manager' && assignedBuildingId !== 'none') {
      return query(collection(db, "students"), where("buildingId", "==", assignedBuildingId), where("isActive", "==", true))
    }
    return query(collection(db, "students"), where("branch", "==", userBranch), where("isActive", "==", true))
  }, [db, userBranch, userRole, assignedBuildingId])
  const { data: students } = useCollection(studentsQuery)

  const staffQuery = useMemoFirebase(() => {
    return collection(db, "staff")
  }, [db])
  const { data: staffList } = useCollection(staffQuery)

  const managementStaff = useMemo(() => {
    if (!staffList) return []
    return staffList.filter(s => {
      if (s.role === 'Admin') return true;
      return s.branch === userBranch && (s.staffType === 'management' || !s.staffType);
    })
  }, [staffList, userBranch])

  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)
  
  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: apiConfig } = useDoc(apiConfigRef)

  const billingConfigRef = useMemoFirebase(() => 
    userBranch ? doc(db, "configs", `billingConfig_${userBranch}`) : null, 
    [db, userBranch]
  )
  const { data: billingConfig } = useDoc(billingConfigRef)

  const selectedStudent = useMemo(() => 
    students?.find(s => s.id === formData.studentId), 
    [students, formData.studentId]
  )

  // SMART AUTO-DISTRIBUTION LOGIC
  const distributionResult = useMemo(() => {
    if (!selectedStudent) return { rentPaid: 0, cookingBill: 0, wifiBill: 0, foodPaid: 0, total: 0 };
    
    let remaining = Number(formData.totalReceived) || 0;
    const total = remaining;
    
    let rentPaid = 0;
    let cookingPaid = 0;
    let wifiPaid = 0;
    let foodPaid = 0;

    // 1. Pay Rent Dues (Arrears First)
    const currentDues = { ...(selectedStudent.duesBreakdown || {}) };
    const sortedDueMonths = Object.keys(currentDues).sort((a, b) => {
      const [mA, yA] = a.split(' '); const [mB, yB] = b.split(' ');
      if (yA !== yB) return Number(yA) - Number(yB);
      return MONTHS.indexOf(mA) - MONTHS.indexOf(mB);
    });

    for (const label of sortedDueMonths) {
      if (remaining <= 0) break;
      const dueAmt = Number(currentDues[label].amount);
      const toPay = Math.min(remaining, dueAmt);
      rentPaid += toPay;
      remaining -= toPay;
    }

    // 2. Pay Cooking Bill (if enabled)
    if (formData.applyCookingBill && remaining > 0) {
      const billAmt = Number(billingConfig?.cookingBill || 500);
      const toPay = Math.min(remaining, billAmt);
      cookingPaid = toPay;
      remaining -= toPay;
    }

    // 3. Pay WiFi Bill (if enabled)
    if (formData.applyWifiBill && remaining > 0) {
      const billAmt = Number(billingConfig?.wifiBill || 300);
      const toPay = Math.min(remaining, billAmt);
      wifiPaid = toPay;
      remaining -= toPay;
    }

    // 4. Everything else goes to Food
    foodPaid = remaining;

    return { rentPaid, cookingBill: cookingPaid, wifiBill: wifiPaid, foodPaid, total };
  }, [selectedStudent, formData.totalReceived, formData.applyCookingBill, formData.applyWifiBill, billingConfig]);

  const handleCreatePayment = async () => {
    if (!formData.studentId || !formData.receiver || !selectedStudent || Number(formData.totalReceived) <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid amount and resident." })
      return
    }
    setIsSubmitting(true)
    try {
      const batch = writeBatch(db); 
      const { rentPaid, cookingBill, wifiBill, foodPaid, total } = distributionResult;

      const isBM = userRole === 'Building Manager'
      const needsApproval = isBM && (staffData?.canRequestIncome === true || !staffData?.canDirectEntryIncome)

      if (needsApproval) {
        const reqId = doc(collection(db, "managerRequests")).id
        await setDoc(doc(db, "managerRequests", reqId), {
          id: reqId, 
          requestType: "income", 
          amount: total, 
          seatAmount: rentPaid, 
          foodAmount: foodPaid,
          cookingBill, 
          wifiBill, 
          studentId: selectedStudent.id, 
          studentName: selectedStudent.name,
          buildingId: selectedStudent.buildingId, 
          buildingName: selectedStudent.buildingName,
          roomNumber: selectedStudent.roomNumber, 
          branch: userBranch, 
          month: MONTHS[new Date().getMonth()],
          year: new Date().getFullYear().toString(), 
          method: formData.method, 
          receiver: formData.receiver,
          description: `Smart Entry. ${formData.description}`, 
          requestedBy: staffId, 
          requestedByName: userName,
          createdAt: serverTimestamp()
        })
        toast({ title: "Request Sent", description: "Your income entry is pending for Admin approval." })
        router.push('/students')
        return
      }

      const pId = doc(collection(db, "payments")).id
      const pRecord = {
        id: pId, 
        amount: total, 
        seatAmount: rentPaid, 
        foodAmount: foodPaid, 
        advanceAmount: 0,
        cookingBill, 
        wifiBill,
        studentName: selectedStudent.name, 
        studentId: selectedStudent.id, 
        buildingId: selectedStudent.buildingId, 
        buildingName: selectedStudent.buildingName, 
        roomNumber: selectedStudent.roomNumber, 
        branch: userBranch,
        type: "income", 
        month: MONTHS[new Date().getMonth()], 
        year: new Date().getFullYear().toString(), 
        method: formData.method, 
        receiver: formData.receiver, 
        description: `Smart Auto-Split. ${formData.description}`, 
        date: new Date().toISOString()
      }

      batch.set(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp(), createdAt: serverTimestamp() })
      
      const currentDues = { ...(selectedStudent.duesBreakdown || {}) };
      let remainingToApply = rentPaid;
      const sortedMonths = Object.keys(currentDues).sort((a, b) => {
        const [mA, yA] = a.split(' '); const [mB, yB] = b.split(' ');
        if (yA !== yB) return Number(yA) - Number(yB);
        return MONTHS.indexOf(mA) - MONTHS.indexOf(mB);
      });

      for (const m of sortedMonths) {
        if (remainingToApply <= 0) break;
        const dueAmt = Number(currentDues[m].amount);
        if (remainingToApply >= dueAmt) {
          remainingToApply -= dueAmt;
          delete currentDues[m];
        } else {
          currentDues[m].amount = dueAmt - remainingToApply;
          remainingToApply = 0;
        }
      }

      const finalTotalDue = Object.values(currentDues).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);

      batch.update(doc(db, "students", selectedStudent.id), {
        paymentsHistory: arrayUnion(pRecord),
        totalDue: finalTotalDue,
        duesBreakdown: currentDues,
        foodDueAmount: increment(foodPaid),
        cookingDueAmount: increment(cookingBill),
        historicalTotalReceived: increment(total),
        updatedAt: serverTimestamp()
      })

      // Update Net Balance
      const balanceRef = doc(db, "netBalance", userBranch);
      const methodKeyMap: Record<string, string> = { 'cash': 'totalCash', 'bkash': 'totalBkash', 'nagad': 'totalNagad', 'bank': 'totalBank' };
      const methodKey = methodKeyMap[formData.method] || 'totalCash';

      batch.set(balanceRef, {
        branchId: userBranch,
        [methodKey]: increment(total),
        totalHandCash: increment(total),
        lastUpdated: serverTimestamp()
      }, { merge: true });

      await batch.commit()
      toast({ title: "Payment Recorded Successfully" })
      router.push(`/receipts/${pId}`)
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message }) 
    } finally { 
      setIsSubmitting(false) 
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Smart Payment</h1>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        <div className="h-2 bg-success w-full" />
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-success">
            <Wallet size={20}/> Automatic Distribution
          </CardTitle>
          <CardDescription>Enter total amount and let system split it for you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Building</Label>
              <Select value={formData.buildingId} onValueChange={val => setFormData({...formData, buildingId: val, roomNumber: "all", studentId: ""})}>
                <SelectTrigger className="bg-slate-50 border-none h-11 rounded-xl shadow-inner font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {userRole !== 'Building Manager' && <SelectItem value="all">Any Building</SelectItem>}
                  {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Room</Label>
              <Select value={formData.roomNumber} onValueChange={val => setFormData({...formData, roomNumber: val, studentId: ""})}>
                <SelectTrigger className="bg-slate-50 border-none h-11 rounded-xl shadow-inner font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Room</SelectItem>
                  {Array.from(new Set(students?.filter(s => (formData.buildingId === 'all' || s.buildingId === formData.buildingId)).map(s => s.roomNumber))).sort().map(r => (
                    <SelectItem key={r} value={r}>Room {r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Select Student</Label>
            <Select value={formData.studentId} onValueChange={val => setFormData({...formData, studentId: val})}>
              <SelectTrigger className="bg-slate-50 border-none h-12 rounded-xl shadow-inner font-black text-lg"><SelectValue placeholder="Choose Resident" /></SelectTrigger>
              <SelectContent>
                {students?.filter(s => 
                  (formData.buildingId === 'all' || s.buildingId === formData.buildingId) && 
                  (formData.roomNumber === 'all' || s.roomNumber === formData.roomNumber)
                ).map(s => <SelectItem key={s.id} value={s.id}>{s.name} (R-{s.roomNumber})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-6">
             <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-primary tracking-widest ml-1">Total Amount Received (৳)</Label>
                <div className="relative">
                   <HandCoins className="absolute left-4 top-4 h-6 w-6 text-primary/40" />
                   <Input 
                     type="number" 
                     value={formData.totalReceived} 
                     onChange={e => setFormData({...formData, totalReceived: e.target.value})} 
                     className="h-16 pl-14 text-3xl font-black rounded-3xl bg-primary/5 border-primary/20 text-primary shadow-inner" 
                     placeholder="0.00"
                   />
                </div>
             </div>

             {/* PREVIEW BREAKDOWN */}
             {selectedStudent && Number(formData.totalReceived) > 0 && (
               <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">Calculated Split Preview</p>
                    <Badge className="bg-success text-white">AUTO SPLIT ON</Badge>
                  </div>
                  
                  <div className="space-y-3">
                     <div className="flex justify-between items-center group">
                        <div className="flex items-center gap-3"><div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center"><Home size={14} className="text-blue-400"/></div><span className="text-xs font-bold text-white/70">Rent Adjustment</span></div>
                        <span className="text-lg font-black text-blue-400">৳{distributionResult.rentPaid}</span>
                     </div>
                     {distributionResult.cookingBill > 0 && (
                       <div className="flex justify-between items-center group">
                          <div className="flex items-center gap-3"><div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center"><Soup size={14} className="text-orange-400"/></div><span className="text-xs font-bold text-white/70">Cooking Bill Payment</span></div>
                          <span className="text-lg font-black text-orange-400">৳{distributionResult.cookingBill}</span>
                       </div>
                     )}
                     {distributionResult.wifiBill > 0 && (
                       <div className="flex justify-between items-center group">
                          <div className="flex items-center gap-3"><div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center"><Wifi size={14} className="text-blue-300"/></div><span className="text-xs font-bold text-white/70">WiFi Bill Payment</span></div>
                          <span className="text-lg font-black text-blue-300">৳{distributionResult.wifiBill}</span>
                       </div>
                     )}
                     <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                        <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-2xl bg-success/20 flex items-center justify-center"><UtensilsCrossed size={18} className="text-success"/></div><div className="space-y-0.5"><span className="text-xs font-black text-success">Net Food Deposit</span><p className="text-[8px] text-white/30 uppercase">Added to current balance</p></div></div>
                        <span className="text-2xl font-black text-success">৳{distributionResult.foodPaid}</span>
                     </div>
                  </div>
               </div>
             )}

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer group" onClick={() => setFormData({...formData, applyCookingBill: !formData.applyCookingBill})}>
                   <UtensilsCrossed size={18} className={cn("transition-all", formData.applyCookingBill ? "text-orange-500" : "text-slate-300")} />
                   <div className="flex-1">
                     <p className="text-[10px] font-bold uppercase leading-none">Apply Cooking Bill</p>
                     <p className="text-[9px] text-muted-foreground mt-1">৳{billingConfig?.cookingBill || 500}</p>
                   </div>
                   <Checkbox checked={formData.applyCookingBill} onCheckedChange={(val) => setFormData({...formData, applyCookingBill: !!val})} />
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer group" onClick={() => setFormData({...formData, applyWifiBill: !formData.applyWifiBill})}>
                   <Wifi size={18} className={cn("transition-all", formData.applyWifiBill ? "text-blue-500" : "text-slate-300")} />
                   <div className="flex-1">
                     <p className="text-[10px] font-bold uppercase leading-none">Apply WiFi Bill</p>
                     <p className="text-[9px] text-muted-foreground mt-1">৳{billingConfig?.wifiBill || 300}</p>
                   </div>
                   <Checkbox checked={formData.applyWifiBill} onCheckedChange={(val) => setFormData({...formData, applyWifiBill: !!val})} />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <Label className="text-xs">Payment Method</Label>
                 <Select value={formData.method} onValueChange={v => setFormData({...formData, method: v})}><SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select>
               </div>
               <div className="space-y-1">
                 <Label className="text-xs">Received By</Label>
                 <Select value={formData.receiver} onValueChange={v => setFormData({...formData, receiver: v})}>
                   <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Staff"/></SelectTrigger>
                   <SelectContent>{managementStaff?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                 </Select>
               </div>
             </div>
             <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Additional notes (Optional)..." className="rounded-2xl bg-slate-50 border-none shadow-inner min-h-[80px]" />
          </div>
        </CardContent>
        <CardFooter className="p-8 bg-slate-50 border-t">
          <Button onClick={handleCreatePayment} disabled={isSubmitting || !formData.studentId || Number(formData.totalReceived) <= 0} className="w-full h-16 rounded-[2rem] text-xl font-black bg-success hover:bg-success/90 shadow-2xl shadow-success/20 transition-all hover:scale-[1.01] gap-3">
            {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24}/>} 
            {isSubmitting ? "Processing Entry..." : "Confirm & Apply Payment"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function PaymentEntryPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>}>
      <PaymentEntryForm />
    </Suspense>
  )
}
