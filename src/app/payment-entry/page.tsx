
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
  Home,
  AlertCircle,
  History,
  CircleDollarSign,
  User,
  ListOrdered,
  Info,
  Scale
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

  const studentSnapshot = useMemo(() => {
    if (!selectedStudent) return null;
    const dues = Object.entries(selectedStudent.duesBreakdown || {}).map(([label, data]: any) => ({
      label,
      amount: Number(data.amount)
    })).sort((a, b) => {
      const [mA, yA] = a.label.split(' ');
      const [mB, yB] = b.label.split(' ');
      if (yA !== yB) return Number(yA) - Number(yB);
      return MONTHS.indexOf(mA) - MONTHS.indexOf(mB);
    });

    const rentDueTotal = dues.reduce((a, b) => a + b.amount, 0);
    const foodVal = Number(selectedStudent.foodDueAmount || 0);
    const cookVal = Number(selectedStudent.cookingDueAmount || 0);

    return { dues, rentDueTotal, foodVal, cookVal };
  }, [selectedStudent]);

  const distributionResult = useMemo(() => {
    if (!selectedStudent) return { rentPaid: 0, foodDebtCleared: 0, cookDebtCleared: 0, cookingBill: 0, wifiBill: 0, foodAdvance: 0, total: 0, appliedDues: [] };
    
    let remaining = Number(formData.totalReceived) || 0;
    const total = remaining;
    
    let rentPaid = 0;
    let foodDebtCleared = 0;
    let cookDebtCleared = 0;
    let cookingPaid = 0;
    let wifiPaid = 0;
    let foodAdvance = 0;
    const appliedDues: string[] = [];

    // 1. PRIORITY: Arrears (Oldest Rent first)
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
      appliedDues.push(`${label}: ৳${toPay}`);
    }

    // 2. PRIORITY: Food Debt clearing (if balance < 0)
    const currentFoodVal = Number(selectedStudent.foodDueAmount || 0);
    if (currentFoodVal < 0 && remaining > 0) {
      const debt = Math.abs(currentFoodVal);
      const toPay = Math.min(remaining, debt);
      foodDebtCleared = toPay;
      remaining -= toPay;
    }

    // 3. PRIORITY: Cooking Debt clearing (if balance < 0)
    const currentCookVal = Number(selectedStudent.cookingDueAmount || 0);
    if (currentCookVal < 0 && remaining > 0) {
      const debt = Math.abs(currentCookVal);
      const toPay = Math.min(remaining, debt);
      cookDebtCleared = toPay;
      remaining -= toPay;
    }

    // 4. PRIORITY: New Cooking Bill (if enabled)
    if (formData.applyCookingBill && remaining > 0) {
      const billAmt = Number(billingConfig?.cookingBill || 500);
      const toPay = Math.min(remaining, billAmt);
      cookingPaid = toPay;
      remaining -= toPay;
    }

    // 5. PRIORITY: WiFi Bill (if enabled)
    if (formData.applyWifiBill && remaining > 0) {
      const billAmt = Number(billingConfig?.wifiBill || 300);
      const toPay = Math.min(remaining, billAmt);
      wifiPaid = toPay;
      remaining -= toPay;
    }

    // 6. PRIORITY: Final remainder -> Food Advance
    foodAdvance = remaining;

    return { rentPaid, foodDebtCleared, cookDebtCleared, cookingBill: cookingPaid, wifiBill: wifiPaid, foodAdvance, total, appliedDues };
  }, [selectedStudent, formData.totalReceived, formData.applyCookingBill, formData.applyWifiBill, billingConfig]);

  const handleCreatePayment = async () => {
    if (!formData.studentId || !formData.receiver || !selectedStudent || Number(formData.totalReceived) <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid amount and resident." })
      return
    }
    setIsSubmitting(true)
    try {
      const batch = writeBatch(db); 
      const { rentPaid, foodDebtCleared, cookDebtCleared, cookingBill, wifiBill, foodAdvance, total } = distributionResult;

      const isBM = userRole === 'Building Manager'
      const needsApproval = isBM && (staffData?.canRequestIncome === true || !staffData?.canDirectEntryIncome)

      if (needsApproval) {
        const reqId = doc(collection(db, "managerRequests")).id
        await setDoc(doc(db, "managerRequests", reqId), {
          id: reqId, requestType: "income", amount: total, seatAmount: rentPaid, 
          foodAmount: foodDebtCleared + foodAdvance,
          cookingBill: cookDebtCleared + cookingBill, wifiBill, 
          studentId: selectedStudent.id, studentName: selectedStudent.name,
          buildingId: selectedStudent.buildingId, buildingName: selectedStudent.buildingName,
          roomNumber: selectedStudent.roomNumber, branch: userBranch, month: MONTHS[new Date().getMonth()],
          year: new Date().getFullYear().toString(), method: formData.method, receiver: formData.receiver,
          description: `Smart Auto-Split Payment. ${formData.description}`, requestedBy: staffId, 
          requestedByName: userName, createdAt: serverTimestamp()
        })
        toast({ title: "Request Sent", description: "Pending for Admin approval." })
        router.push('/students')
        return
      }

      const pId = doc(collection(db, "payments")).id
      const pRecord = {
        id: pId, amount: total, seatAmount: rentPaid, foodAmount: foodDebtCleared + foodAdvance, advanceAmount: 0,
        cookingBill: cookDebtCleared + cookingBill, wifiBill, studentName: selectedStudent.name, studentId: selectedStudent.id, 
        buildingId: selectedStudent.buildingId, buildingName: selectedStudent.buildingName, 
        roomNumber: selectedStudent.roomNumber, branch: userBranch, type: "income", 
        month: MONTHS[new Date().getMonth()], year: new Date().getFullYear().toString(), 
        method: formData.method, receiver: formData.receiver, 
        description: `Smart Split Entry. TXID: SYSTEM_${Date.now()}. ${formData.description}`, 
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
        if (remainingToApply >= dueAmt) { remainingToApply -= dueAmt; delete currentDues[m]; }
        else { currentDues[m].amount = dueAmt - remainingToApply; remainingToApply = 0; }
      }

      const finalTotalDue = Object.values(currentDues).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);

      batch.update(doc(db, "students", selectedStudent.id), {
        paymentsHistory: arrayUnion(pRecord),
        totalDue: finalTotalDue,
        duesBreakdown: currentDues,
        foodDueAmount: increment(foodDebtCleared + foodAdvance),
        cookingDueAmount: increment(cookDebtCleared + cookingBill),
        historicalTotalReceived: increment(total),
        updatedAt: serverTimestamp()
      })

      const balanceRef = doc(db, "netBalance", userBranch);
      const methodKeyMap: Record<string, string> = { 'cash': 'totalCash', 'bkash': 'totalBkash', 'nagad': 'totalNagad', 'bank': 'totalBank' };
      const methodKey = methodKeyMap[formData.method] || 'totalCash';
      batch.set(balanceRef, { [methodKey]: increment(total), totalHandCash: increment(total), lastUpdated: serverTimestamp() }, { merge: true });

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
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Smart Collection</h1></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
            <div className="h-2 bg-success w-full" />
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-success"><Wallet size={24}/> Auto-Split Collection</CardTitle>
              <CardDescription>System calculates distribution priorities automatically.</CardDescription>
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
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Resident Search</Label>
                <Select value={formData.studentId} onValueChange={val => setFormData({...formData, studentId: val})}>
                  <SelectTrigger className="bg-slate-50 border-none h-14 rounded-2xl shadow-inner font-black text-lg"><SelectValue placeholder="Find student..." /></SelectTrigger>
                  <SelectContent>
                    {students?.filter(s => 
                      (formData.buildingId === 'all' || s.buildingId === formData.buildingId) && 
                      (formData.roomNumber === 'all' || s.roomNumber === formData.roomNumber)
                    ).map(s => <SelectItem key={s.id} value={s.id}>{s.name} (R-{s.roomNumber})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {selectedStudent && (
                <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-black uppercase text-primary tracking-widest ml-1">Total Amount Received (৳)</Label>
                    <div className="relative">
                      <HandCoins className="absolute left-4 top-4 h-8 w-8 text-primary/40" />
                      <Input 
                        type="number" 
                        value={formData.totalReceived} 
                        onChange={e => setFormData({...formData, totalReceived: e.target.value})} 
                        className="h-16 pl-14 text-4xl font-black rounded-3xl bg-primary/5 border-primary/20 text-primary shadow-inner" 
                        placeholder="0.00"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* SMART SPLIT PREVIEW */}
                  {Number(formData.totalReceived) > 0 && (
                    <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white space-y-6 shadow-2xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><Calculator size={100}/></div>
                       <div className="flex justify-between items-center relative z-10">
                          <p className="text-[10px] font-black uppercase text-primary/70 tracking-[0.3em]">Smart Distribution Preview</p>
                          <Badge className="bg-success text-white font-bold h-5 text-[8px] animate-pulse">AUTO-SPLIT ACTIVE</Badge>
                       </div>
                       
                       <div className="space-y-4 relative z-10">
                          <div className="flex justify-between items-center">
                             <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center"><Home size={20} className="text-blue-400"/></div><div className="space-y-0.5"><span className="text-xs font-black text-white/90">Rent Adjustment</span><p className="text-[8px] text-white/30 uppercase font-bold">Includes Arrears & Current</p></div></div>
                             <span className="text-2xl font-black text-blue-400">৳{distributionResult.rentPaid}</span>
                          </div>
                          {distributionResult.appliedDues.length > 0 && (
                            <div className="ml-14 flex flex-wrap gap-2">
                               {distributionResult.appliedDues.map((d, i) => <Badge key={i} variant="outline" className="text-[7px] border-white/10 text-white/40 h-4">{d}</Badge>)}
                            </div>
                          )}

                          {distributionResult.foodDebtCleared > 0 && (
                            <div className="flex justify-between items-center">
                               <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center"><UtensilsCrossed size={20} className="text-destructive"/></div><div className="space-y-0.5"><span className="text-xs font-black text-white/90">Food Debt Cleared</span><p className="text-[8px] text-white/30 uppercase font-bold">Adjusting negative balance</p></div></div>
                               <span className="text-2xl font-black text-destructive">৳{distributionResult.foodDebtCleared}</span>
                            </div>
                          )}

                          {distributionResult.cookDebtCleared > 0 && (
                            <div className="flex justify-between items-center">
                               <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center"><ChefHat size={20} className="text-destructive"/></div><div className="space-y-0.5"><span className="text-xs font-black text-white/90">Cooking Debt Cleared</span><p className="text-[8px] text-white/30 uppercase font-bold">Adjusting negative balance</p></div></div>
                               <span className="text-2xl font-black text-destructive">৳{distributionResult.cookDebtCleared}</span>
                            </div>
                          )}

                          {distributionResult.cookingBill > 0 && (
                            <div className="flex justify-between items-center">
                               <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center"><Soup size={20} className="text-orange-400"/></div><div className="space-y-0.5"><span className="text-xs font-black text-white/90">Cooking Service Bill</span><p className="text-[8px] text-white/30 uppercase font-bold">Monthly Maintenance</p></div></div>
                               <span className="text-2xl font-black text-orange-400">৳{distributionResult.cookingBill}</span>
                            </div>
                          )}

                          <Separator className="bg-white/10" />
                          
                          <div className="flex justify-between items-center bg-white/5 p-4 rounded-3xl border border-white/5">
                             <div className="flex items-center gap-3"><div className="h-12 w-12 rounded-2xl bg-success/20 flex items-center justify-center"><UtensilsCrossed size={24} className="text-success"/></div><div className="space-y-0.5"><span className="text-sm font-black text-success">Net Food Advance</span><p className="text-[8px] text-white/30 uppercase font-black">Added to resident's purse</p></div></div>
                             <span className="text-3xl font-black text-success">৳{distributionResult.foodAdvance}</span>
                          </div>
                       </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer group" onClick={() => setFormData({...formData, applyCookingBill: !formData.applyCookingBill})}>
                        <div className={cn("p-2 rounded-xl transition-all", formData.applyCookingBill ? "bg-orange-100 text-orange-600" : "bg-white text-slate-300")}><Soup size={18}/></div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black uppercase text-slate-500">Apply Cooking Bill</p>
                          <p className="text-xs font-black text-slate-800">৳{billingConfig?.cookingBill || 500}</p>
                        </div>
                        <Checkbox checked={formData.applyCookingBill} onCheckedChange={(v) => setFormData({...formData, applyCookingBill: !!v})} />
                     </div>
                     <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer group" onClick={() => setFormData({...formData, applyWifiBill: !formData.applyWifiBill})}>
                        <div className={cn("p-2 rounded-xl transition-all", formData.applyWifiBill ? "bg-blue-100 text-blue-600" : "bg-white text-slate-300")}><Wifi size={18}/></div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black uppercase text-slate-500">Apply WiFi Bill</p>
                          <p className="text-xs font-black text-slate-800">৳{billingConfig?.wifiBill || 300}</p>
                        </div>
                        <Checkbox checked={formData.applyWifiBill} onCheckedChange={(v) => setFormData({...formData, applyWifiBill: !!v})} />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Payment Method</Label><Select value={formData.method} onValueChange={v => setFormData({...formData, method: v})}><SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Collector</Label><Select value={formData.receiver} onValueChange={v => setFormData({...formData, receiver: v})}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Staff"/></SelectTrigger><SelectContent>{managementStaff?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                </div>
              )}
            </CardContent>
            {selectedStudent && (
              <CardFooter className="p-8 bg-slate-50 border-t">
                <Button onClick={handleCreatePayment} disabled={isSubmitting || Number(formData.totalReceived) <= 0} className="w-full h-20 rounded-[2.5rem] text-2xl font-black bg-success hover:bg-success/90 shadow-2xl shadow-success/20 gap-4">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={32}/>} Confirm Smart Distribution
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 ml-2"><History size={16}/> Resident Snapshot</h3>
           {selectedStudent && studentSnapshot ? (
             <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                   <CardHeader className="bg-primary/5 pb-4"><div className="flex justify-between items-center"><p className="text-[10px] font-black uppercase text-primary">Core Rent Details</p><Badge variant="secondary" className="text-[8px] font-black">৳{selectedStudent.monthlyRent}/mo</Badge></div></CardHeader>
                   <CardContent className="p-6 space-y-4">
                      <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500 uppercase">Rent Due (Total)</span><span className="text-xl font-black text-destructive">৳{studentSnapshot.rentDueTotal}</span></div>
                      <Separator className="opacity-50" />
                      <div className="space-y-2">
                        <p className="text-[8px] font-black uppercase text-slate-400 mb-2">Month-wise Arrears</p>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                           {studentSnapshot.dues.map((d, i) => (
                             <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-600">{d.label}</span>
                                <span className="text-[10px] font-black text-destructive">৳{d.amount}</span>
                             </div>
                           ))}
                           {studentSnapshot.dues.length === 0 && <p className="text-xs text-success font-bold text-center py-4">No rent dues found! 🎉</p>}
                        </div>
                      </div>
                   </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                   <Card className={cn("border-none shadow-sm rounded-3xl p-4 text-center", studentSnapshot.foodVal < 0 ? "bg-red-50" : "bg-green-50")}>
                      <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Food Purse</p>
                      <p className={cn("text-lg font-black", studentSnapshot.foodVal < 0 ? "text-destructive" : "text-success")}>৳{studentSnapshot.foodVal}</p>
                   </Card>
                   <Card className={cn("border-none shadow-sm rounded-3xl p-4 text-center", studentSnapshot.cookVal < 0 ? "bg-red-50" : "bg-green-50")}>
                      <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Cook Wallet</p>
                      <p className={cn("text-lg font-black", studentSnapshot.cookVal < 0 ? "text-destructive" : "text-success")}>৳{studentSnapshot.cookVal}</p>
                   </Card>
                </div>

                <div className="p-5 bg-indigo-50 rounded-3xl border border-indigo-100 space-y-2">
                   <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase"><Info size={14}/> Processing Info</div>
                   <p className="text-[10px] leading-relaxed text-indigo-800 font-medium">
                     System will prioritize <b>Oldest Rent Dues</b>, then <b>Pending Debts</b>, then <b>Fixed Utility Bills</b>, and finally credit remaining to <b>Food Advance</b>.
                   </p>
                </div>
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed opacity-40">
                <User size={48} className="mb-2" strokeWidth={1} />
                <p className="text-xs font-bold uppercase">Select a resident to view stats</p>
             </div>
           )}
        </div>
      </div>
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
