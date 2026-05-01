
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  Coins
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

export default function PaymentEntryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const router = useRouter()
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    buildingId: "all",
    roomNumber: "all",
    studentId: "",
    month: "",
    year: "",
    seatAmount: "",
    foodAmount: "",
    addAdvanceAmount: "0",
    method: "cash",
    receiver: "",
    description: "",
    payFromAdvance: false
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

    // AUTO COLLECT DATE AND POPULATE RECEIVER
    const now = new Date()
    const currentMonth = MONTHS[now.getMonth()]
    const currentYear = now.getFullYear().toString()

    setFormData(prev => ({ 
      ...prev, 
      receiver: name,
      month: currentMonth,
      year: currentYear,
      buildingId: (role === 'Building Manager' && bId !== 'none') ? bId : prev.buildingId
    }))
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

  const mealConfigRef = useMemoFirebase(() => 
    userBranch ? doc(db, "configs", `mealRate_${userBranch}`) : null, 
    [db, userBranch]
  )
  const { data: mealConfig } = useDoc(mealConfigRef)

  const selectedStudent = useMemo(() => 
    students?.find(s => s.id === formData.studentId), 
    [students, formData.studentId]
  )

  // Auto-fill seat amount when "Pay from Advance" is toggled
  useEffect(() => {
    if (formData.payFromAdvance && selectedStudent) {
      setFormData(prev => ({
        ...prev,
        seatAmount: (selectedStudent.monthlyRent || 0).toString()
      }))
    }
  }, [formData.payFromAdvance, selectedStudent])

  const handleCreatePayment = async () => {
    if (!formData.studentId || !formData.receiver || !selectedStudent) {
      toast({ variant: "destructive", title: "Error", description: "Please complete all fields." })
      return
    }
    setIsSubmitting(true)
    try {
      const batch = writeBatch(db); // Use writeBatch for speed
      const seatPaid = Number(formData.seatAmount || 0)
      const foodPaid = Number(formData.foodAmount || 0)
      const extraAdvance = Number(formData.addAdvanceAmount || 0)
      
      // LOGIC: If payFromAdvance is true, the student isn't paying extra for rent.
      // The seatPaid amount is deducted from their advance instead of being added to wallet.
      const cashReceivedFromUser = foodPaid + extraAdvance + (formData.payFromAdvance ? 0 : seatPaid)
      const advanceBalanceChange = extraAdvance - (formData.payFromAdvance ? seatPaid : 0)
      
      const totalAmtToLog = seatPaid + foodPaid + extraAdvance

      // ROLE BASED BRANCHING: Request vs Direct Entry
      const isBM = userRole === 'Building Manager'
      const needsApproval = isBM && (staffData?.canRequestIncome === true || !staffData?.canDirectEntryIncome)

      if (needsApproval) {
        const reqId = doc(collection(db, "managerRequests")).id
        await setDoc(doc(db, "managerRequests", reqId), {
          id: reqId, requestType: "income", amount: totalAmtToLog, seatAmount: seatPaid, foodAmount: foodPaid,
          advanceAmount: extraAdvance, studentId: selectedStudent.id, studentName: selectedStudent.name,
          buildingId: selectedStudent.buildingId, buildingName: selectedStudent.buildingName,
          roomNumber: selectedStudent.roomNumber, branch: userBranch, month: formData.month,
          year: formData.year, method: formData.method, receiver: formData.receiver,
          description: formData.description, requestedBy: staffId, requestedByName: userName,
          payFromAdvance: formData.payFromAdvance,
          createdAt: serverTimestamp()
        })
        toast({ title: "Request Sent", description: "Your income entry is pending for Admin approval." })
        router.push('/students')
        return
      }

      // Direct Entry Optimization with Batch
      const pId = doc(collection(db, "payments")).id
      const pRecord = {
        id: pId, amount: totalAmtToLog, seatAmount: seatPaid, foodAmount: foodPaid, advanceAmount: extraAdvance,
        studentName: selectedStudent.name, studentId: selectedStudent.id, 
        buildingId: selectedStudent.buildingId, buildingName: selectedStudent.buildingName, 
        roomNumber: selectedStudent.roomNumber, branch: userBranch,
        type: "income", month: formData.month, year: formData.year, method: formData.payFromAdvance ? "adjustment" : formData.method, 
        receiver: formData.receiver, description: formData.payFromAdvance ? `Adjusted from advance. ${formData.description}` : formData.description, date: new Date().toISOString()
      }

      batch.set(doc(db, "payments", pId), { ...pRecord, date: serverTimestamp(), createdAt: serverTimestamp() })
      
      const currentDues = { ...(selectedStudent.duesBreakdown || {}) };
      const targetLabel = `${formData.month} ${formData.year}`;
      let remainingRentPaid = seatPaid;

      if (currentDues[targetLabel] && remainingRentPaid > 0) {
        const dueAmt = Number(currentDues[targetLabel].amount);
        if (remainingRentPaid >= dueAmt) {
          remainingRentPaid -= dueAmt;
          delete currentDues[targetLabel];
        } else {
          currentDues[targetLabel].amount = dueAmt - remainingRentPaid;
          remainingRentPaid = 0;
        }
      }

      if (remainingRentPaid > 0) {
        const sortedMonths = Object.keys(currentDues).sort((a, b) => {
          const [mA, yA] = a.split(' ');
          const [mB, yB] = b.split(' ');
          if (yA !== yB) return Number(yA) - Number(yB);
          return MONTHS.indexOf(mA) - MONTHS.indexOf(mB);
        });
        for (const m of sortedMonths) {
          if (remainingRentPaid <= 0) break;
          const dueAmt = Number(currentDues[m].amount);
          if (remainingRentPaid >= dueAmt) {
            remainingRentPaid -= dueAmt;
            delete currentDues[m];
          } else {
            currentDues[m].amount = dueAmt - remainingRentPaid;
            remainingRentPaid = 0;
          }
        }
      }

      const finalTotalDue = Object.values(currentDues).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);

      batch.update(doc(db, "students", selectedStudent.id), {
        paymentsHistory: arrayUnion(pRecord),
        advanceAmount: increment(advanceBalanceChange),
        totalDue: finalTotalDue,
        duesBreakdown: currentDues,
        foodDueAmount: increment(foodPaid),
        historicalTotalReceived: increment(totalAmtToLog),
        updatedAt: serverTimestamp()
      })

      // Update Synchronized Net Balance (Only actual cash received)
      if (cashReceivedFromUser > 0) {
        const balanceRef = doc(db, "netBalance", userBranch);
        const methodKeyMap: Record<string, string> = {
          'cash': 'totalCash', 'bkash': 'totalBkash', 'nagad': 'totalNagad', 'bank': 'totalBank'
        };
        const methodKey = methodKeyMap[formData.method] || 'totalCash';

        batch.set(balanceRef, {
          branchId: userBranch,
          [methodKey]: increment(cashReceivedFromUser),
          totalHandCash: increment(cashReceivedFromUser),
          lastUpdated: serverTimestamp()
        }, { merge: true });
      }

      // Execution of all DB tasks
      await batch.commit()

      // Non-blocking Background SMS
      if (apiConfig?.apikey) {
        (async () => {
          try {
            const template = templatesData?.templates?.find((t: any) => t.id === 'payment')?.text || 
                             "প্রিয় [নাম], আপনার পেমেন্ট সফলভাবে জমা হয়েছে। পরিমাণ: ৳[paid] টাকা। বর্তমান মোট বকেয়া: ৳[total_payable]। ধন্যবাদ। [Hostel Name]";
            
            const foodVal = Number(selectedStudent.foodDueAmount || 0) + foodPaid;
            const foodBalance = foodVal > 0 ? foodVal : 0;
            const foodDue = foodVal < 0 ? Math.abs(foodVal) : 0;
            const totalPayable = finalTotalDue + foodDue;
            const mealRate = Number(mealConfig?.rate || 0);

            const msg = template
              .replaceAll('[নাম]', selectedStudent.name)
              .replaceAll('[মাস]', `${formData.month} ${formData.year}`)
              .replaceAll('[total_payable]', totalPayable.toString())
              .replaceAll('[paid]', totalAmtToLog.toString())
              .replaceAll('[food_balance]', foodBalance.toString())
              .replaceAll('[food_due]', foodDue.toString())
              .replaceAll('[রুম]', selectedStudent.roomNumber)
              .replaceAll('[building]', selectedStudent.buildingName)
              .replaceAll('[meal_rate]', mealRate.toString())
              .replaceAll('[Hostel Name]', templatesData?.hostelName || userBranch);

            const smsResult = await sendSMS(apiConfig.apikey, apiConfig.senderid, selectedStudent.phone, msg);
            const logId = doc(collection(db, "smsLogs")).id;
            await setDoc(doc(db, "smsLogs", logId), { id: logId, to: selectedStudent.phone, message: msg, branch: userBranch, sentBy: userName, status: smsResult.error === 0 ? 'Success' : 'Failed', createdAt: serverTimestamp() });
          } catch (e) {
            console.error("SMS processing error", e)
          }
        })();
      }
      
      toast({ title: "Payment Successful" })
      router.push(`/receipts/${pId}`)
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message }) 
    } finally { 
      setIsSubmitting(false) 
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      {/* Sticky App Bar for Mobile */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:hidden">
        {userRole === 'Building Manager' ? (
          <SidebarTrigger className="-ml-2" />
        ) : (
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
            <ChevronLeft size={24} />
          </Button>
        )}
        <div className="flex-1 overflow-hidden">
          <h1 className="text-lg font-bold truncate">Payment Entry</h1>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-4">
        {userRole !== 'Building Manager' && (
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft />
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">Payment Entry</h1>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        <div className="h-2 bg-success w-full" />
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-success">
            <Wallet size={20}/> Transaction Details
          </CardTitle>
          <CardDescription>Select resident and enter amount.</CardDescription>
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
            <Select value={formData.studentId} onValueChange={val => setFormData({...formData, studentId: val, payFromAdvance: false})}>
              <SelectTrigger className="bg-slate-50 border-none h-12 rounded-xl shadow-inner font-black text-lg"><SelectValue placeholder="Choose Resident" /></SelectTrigger>
              <SelectContent>
                {students?.filter(s => 
                  (formData.buildingId === 'all' || s.buildingId === formData.buildingId) && 
                  (formData.roomNumber === 'all' || s.roomNumber === formData.roomNumber)
                ).map(s => <SelectItem key={s.id} value={s.id}>{s.name} (R-{s.roomNumber})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedStudent && (
            <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <p className="text-[8px] font-black uppercase text-success/70 tracking-widest">Monthly Rent</p>
                  <p className="text-xl font-black">৳{selectedStudent.monthlyRent || 0}</p>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[8px] font-black uppercase text-primary/70 tracking-widest">Security Advance</p>
                  <p className="text-xl font-black">৳{selectedStudent.advanceAmount || 0}</p>
                </div>
              </div>
              
              <Separator className="bg-white/10" />
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-[8px] font-black uppercase text-destructive tracking-widest">Outstanding Dues</p>
                  <Badge variant="destructive" className="text-[8px] h-4">৳{selectedStudent.totalDue || 0}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-[100px] overflow-y-auto pr-1">
                  {Object.entries(selectedStudent.duesBreakdown || {}).map(([label, data]: any) => (
                    <div key={label} className="bg-white/5 p-2 rounded-xl flex justify-between items-center border border-white/5">
                      <span className="text-[8px] font-medium">{label}</span>
                      <span className="text-[9px] font-black text-destructive">৳{data.amount}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedStudent.paymentSystem === 'non-package' && (
                <div className="pt-2 flex justify-between items-center border-t border-white/10">
                  <p className="text-[8px] font-black uppercase text-orange-400 tracking-widest">Food Balance</p>
                  <span className={cn("text-xs font-black", (selectedStudent.foodDueAmount || 0) < 0 ? "text-destructive" : "text-success")}>
                    ৳{selectedStudent.foodDueAmount || 0}
                  </span>
                </div>
              )}

              {/* SPECIAL OPTION: PAY RENT FROM ADVANCE */}
              {Number(selectedStudent.advanceAmount || 0) >= Number(selectedStudent.monthlyRent || 0) && (
                <div className="mt-4 pt-4 border-t border-white/10">
                   <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-2xl border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer group" onClick={() => setFormData({...formData, payFromAdvance: !formData.payFromAdvance})}>
                      <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center transition-all", formData.payFromAdvance ? "bg-primary text-white" : "bg-white/10 text-white/40")}>
                        <Coins size={14} className={cn(formData.payFromAdvance && "animate-bounce")} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-tight">Collect Rent from Advance</p>
                        <p className="text-[8px] text-white/50">Deduct ৳{selectedStudent.monthlyRent} from security deposit.</p>
                      </div>
                      <Checkbox 
                        id="payFromAdvance" 
                        checked={formData.payFromAdvance} 
                        onCheckedChange={(val) => setFormData({...formData, payFromAdvance: val === true})}
                        className="border-white/20 data-[state=checked]:bg-primary"
                      />
                   </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Month</Label><Select value={formData.month} onValueChange={v => setFormData({...formData, month: v})}><SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Year</Label><Select value={formData.year} onValueChange={v => setFormData({...formData, year: v})}><SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
          </div>

          <div className="p-6 border-2 border-success/10 bg-success/5 rounded-3xl space-y-4 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Rent Amount</Label>
                <Input 
                  type="number" 
                  value={formData.seatAmount} 
                  onChange={e => setFormData({...formData, seatAmount: e.target.value})} 
                  className={cn("bg-white h-12 text-xl font-black", formData.payFromAdvance && "opacity-60 border-primary/40 text-primary")} 
                  placeholder="0.00"
                  readOnly={formData.payFromAdvance}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Food Amount</Label>
                <Input disabled={selectedStudent?.paymentSystem === 'package'} type="number" value={formData.foodAmount} onChange={e => setFormData({...formData, foodAmount: e.target.value})} className="bg-white h-12 text-xl font-black" placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-primary">Add to Advance (Security)</Label>
              <Input type="number" value={formData.addAdvanceAmount} onChange={e => setFormData({...formData, addAdvanceAmount: e.target.value})} className="bg-white h-12 border-primary/20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Method</Label>
              <Select disabled={formData.payFromAdvance && Number(formData.foodAmount || 0) === 0 && Number(formData.addAdvanceAmount || 0) === 0} value={formData.method} onValueChange={v => setFormData({...formData, method: v})}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">Bkash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Receiver</Label>
              <Select value={formData.receiver} onValueChange={v => setFormData({...formData, receiver: v})}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Staff"/></SelectTrigger>
                <SelectContent>{managementStaff?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Additional notes..." className="rounded-2xl bg-slate-50 border-none shadow-inner min-h-[100px]" />
        </CardContent>
        <CardFooter className="p-8 bg-slate-50 border-t">
          <Button onClick={handleCreatePayment} disabled={isSubmitting || !formData.studentId} className="w-full h-16 rounded-2xl text-xl font-black bg-success hover:bg-success/90 shadow-2xl shadow-success/20 transition-all hover:scale-[1.01]">
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2"/>} {formData.payFromAdvance ? "Process Adjustment" : "Confirm Payment"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
