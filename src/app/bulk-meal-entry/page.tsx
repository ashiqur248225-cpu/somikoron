
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, serverTimestamp, doc, updateDoc, arrayUnion, increment, writeBatch, query, where, setDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Utensils, 
  Loader2, 
  CheckCircle2, 
  ChevronLeft,
  Calculator,
  RotateCcw
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { sendSMS } from "@/app/actions/sms"
import { SidebarTrigger } from "@/components/ui/sidebar"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = ["2024", "2025", "2026", "2027", "2028"];

export default function BulkMealEntryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const router = useRouter()
  
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [mealLogFilter, setMealLogFilter] = useState({
    month: "",
    year: "",
    buildingId: "all"
  })
  const [mealInputs, setMealInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    const branch = localStorage.getItem("user_branch") || "Main Branch"
    const name = localStorage.getItem("user_name") || "User"
    const role = localStorage.getItem("user_role") || "Manager"
    const bId = localStorage.getItem("assigned_building_id") || "none"

    setUserBranch(branch)
    setUserName(name)
    setUserRole(role)
    setAssignedBuildingId(bId)

    const now = new Date()
    const currentMonth = MONTHS[now.getMonth()]
    const currentYear = now.getFullYear().toString()

    setMealLogFilter({
      month: currentMonth,
      year: currentYear,
      buildingId: (role === 'Building Manager' && bId !== 'none') ? bId : "all"
    })
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
  const { data: students } = useCollection(studentsQuery)

  const mealConfigRef = useMemoFirebase(() => 
    userBranch ? doc(db, "configs", `mealRate_${userBranch}`) : null, 
    [db, userBranch]
  )
  const { data: mealConfig } = useDoc(mealConfigRef)

  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)
  
  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: apiConfig } = useDoc(apiConfigRef)

  const filteredStudents = useMemo(() => {
    if (!students) return []
    return students.filter(s => 
      (mealLogFilter.buildingId === 'all' || s.buildingId === mealLogFilter.buildingId) && 
      s.isActive && 
      s.paymentSystem === 'non-package'
    )
  }, [students, mealLogFilter.buildingId])

  // POPULATE MEAL INPUTS AUTOMATICALLY FROM STUDENT COUNTERS
  useEffect(() => {
    if (filteredStudents.length > 0) {
      const initialInputs: Record<string, string> = {};
      filteredStudents.forEach(s => {
        const total = (Number(s.currentMonthBreakfast) || 0) + (Number(s.currentMonthLunch) || 0) + (Number(s.currentMonthDinner) || 0);
        initialInputs[s.id] = total.toString();
      });
      setMealInputs(prev => ({...prev, ...initialInputs}));
    }
  }, [filteredStudents]);

  const handleBulkMealSubmit = async () => {
    if (!students || !mealConfig?.rate) {
      toast({ variant: "destructive", title: "Error", description: "Meal rate not configured for this branch." });
      return;
    }
    setIsSubmitting(true);
    const batch = writeBatch(db);
    const mealRate = Number(mealConfig.rate);
    const monthLabel = `${mealLogFilter.month} ${mealLogFilter.year}`;
    const updatedRecords: any[] = [];

    try {
      filteredStudents.forEach(s => {
        const count = Number(mealInputs[s.id] || 0);
        if (count <= 0) return;

        const totalCost = count * mealRate;
        const mealRecord = {
          month: monthLabel,
          totalMeals: count,
          perMealCost: mealRate,
          totalCost: totalCost,
          date: new Date().toISOString()
        };

        // Reset month counters upon successful submission to start fresh for next month
        batch.update(doc(db, "students", s.id), {
          mealsHistory: arrayUnion(mealRecord),
          foodDueAmount: increment(-totalCost),
          currentMonthBreakfast: 0,
          currentMonthLunch: 0,
          currentMonthDinner: 0,
          updatedAt: serverTimestamp()
        });

        // Send In-App Notice to Student
        const noticeId = doc(collection(db, "notices")).id;
        batch.set(doc(db, "notices", noticeId), {
          id: noticeId,
          studentId: s.id,
          title: "Monthly Meal Bill Generated",
          message: `Your meal bill for ${monthLabel} has been generated. Total Meals: ${count}, Total Bill: ${totalCost} Tk.`,
          type: "meal",
          isRead: false,
          createdAt: serverTimestamp(),
          branch: userBranch
        });

        updatedRecords.push({ student: s, count, bill: totalCost });
      });

      await batch.commit();

      // Non-blocking Background SMS Loop
      if (apiConfig?.apikey && updatedRecords.length > 0) {
        (async () => {
          const template = templatesData?.templates?.find((t: any) => t.id === 'meal_summary')?.text || 
                           "প্রিয় [নাম], [মাস] মাসে আপনি মোট [meal_count] টি meal গ্রহণ করেছেন। মোট খাবার বিল ৳[meal_bill]। ধন্যবাদ। [Hostel Name]";
          
          for (const item of updatedRecords) {
            try {
              const s = item.student;
              const count = item.count;
              const bill = item.bill;
              
              const currentFoodDue = Number(s.foodDueAmount || 0);
              const newFoodVal = currentFoodDue - bill;
              const foodBalance = newFoodVal > 0 ? newFoodVal : 0;
              const foodDue = newFoodVal < 0 ? Math.abs(newFoodVal) : 0;

              const msg = template
                .replaceAll('[নাম]', s.name)
                .replaceAll('[মাস]', monthLabel)
                .replaceAll('[meal_count]', count.toString())
                .replaceAll('[meal_rate]', mealRate.toString())
                .replaceAll('[meal_bill]', bill.toString())
                .replaceAll('[food_balance]', foodBalance.toString())
                .replaceAll('[food_due]', foodDue.toString())
                .replaceAll('[রুম]', s.roomNumber || '')
                .replaceAll('[building]', s.buildingName || '')
                .replaceAll('[Hostel Name]', templatesData?.hostelName || userBranch);

              const smsResult = await sendSMS(apiConfig.apikey, apiConfig.senderid, s.phone, msg);
              const logId = doc(collection(db, "smsLogs")).id;
              await setDoc(doc(db, "smsLogs", logId), { id: logId, to: s.phone, message: msg, branch: userBranch, sentBy: userName, status: smsResult.error === 0 ? 'Success' : 'Failed', createdAt: serverTimestamp() });
            } catch (e) {
              console.error("SMS error for student", item.student.id, e)
            }
          }
        })();
      }

      toast({ title: "Bulk Entries Submitted", description: "Student balances updated and counters reset." });
      router.push('/food-history');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const grandBillSum = Object.keys(mealInputs).reduce((acc, id) => {
    const s = students?.find(std => std.id === id)
    if (!s || s.paymentSystem === 'package') return acc
    return acc + (Number(mealInputs[id]) * Number(mealConfig?.rate || 0))
  }, 0)

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <SidebarTrigger className="-ml-2" />
        <div className="flex-1 overflow-hidden"><h1 className="text-lg font-bold truncate">Meal Entry</h1></div>
      </div>

      <div className="hidden md:flex items-center gap-4">
        {(userRole === 'Admin' || userRole === 'Branch Manager') && (
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ChevronLeft /></Button>
        )}
        <div><h1 className="text-3xl font-bold text-primary tracking-tight">Bulk Meal Entry</h1><p className="text-muted-foreground text-sm">Mass update meal counts for non-package residents.</p></div>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden flex flex-col bg-white">
        <div className="h-2 bg-primary w-full" />
        <CardHeader className="px-8 pt-8 pb-4">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
            <div><CardTitle className="text-2xl font-black flex items-center gap-2 text-primary"><Utensils size={24}/> Spreadsheet Entry</CardTitle><CardDescription>Update balances based on auto-calculated monthly meals.</CardDescription></div>
            <div className="flex items-center gap-3 px-6 py-3 bg-primary/5 rounded-2xl border border-primary/10 shadow-sm"><Calculator size={20} className="text-primary" /><div className="flex flex-col"><span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Global Meal Rate</span><span className="text-lg font-black text-primary">৳{mealConfig?.rate || 0} / Meal</span></div></div>
          </div>
        </CardHeader>

        <div className="px-8 py-6 bg-slate-50 border-y flex flex-wrap gap-6 items-end">
          <div className="flex-1 min-w-[150px] space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Select Month</Label><Select value={mealLogFilter.month} onValueChange={v => setMealLogFilter({...mealLogFilter, month: v})}><SelectTrigger className="h-12 rounded-2xl bg-white shadow-sm border-none font-bold"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex-1 min-w-[150px] space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Select Year</Label><Select value={mealLogFilter.year} onValueChange={v => setMealLogFilter({...mealLogFilter, year: v})}><SelectTrigger className="h-12 rounded-2xl bg-white shadow-sm border-none font-bold"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex-1 min-w-[200px] space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Filter Building</Label><Select value={mealLogFilter.buildingId} onValueChange={v => setMealLogFilter({...mealLogFilter, buildingId: v})}><SelectTrigger className="h-12 rounded-2xl bg-white shadow-sm border-none font-bold"><SelectValue /></SelectTrigger><SelectContent>{userRole !== 'Building Manager' && <SelectItem value="all">All Buildings</SelectItem>}{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
          <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl text-muted-foreground bg-white shadow-sm" onClick={() => { setMealInputs({}); toast({ title: "Inputs Cleared" }); }}><RotateCcw size={20}/></Button>
        </div>

        <div className="px-8">
          <Table>
            <TableHeader className="bg-white sticky top-0 z-10"><TableRow className="border-none hover:bg-transparent h-16"><TableHead className="font-black uppercase text-[11px] tracking-widest text-slate-500">Resident Details</TableHead><TableHead className="font-black uppercase text-[11px] tracking-widest text-center text-slate-500">Current Balance</TableHead><TableHead className="font-black uppercase text-[11px] tracking-widest text-right w-40 text-slate-500">Total Meals (Auto)</TableHead><TableHead className="font-black uppercase text-[11px] tracking-widest text-right w-40 text-slate-500">Meal Bill</TableHead><TableHead className="font-black uppercase text-[11px] tracking-widest text-right w-40 text-slate-500">New Balance</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredStudents.map(s => {
                const count = Number(mealInputs[s.id] || 0); const rate = Number(mealConfig?.rate || 0); const bill = count * rate; const currentBal = Number(s.foodDueAmount || 0); const newBal = currentBal - bill;
                return (
                  <TableRow key={s.id} className={cn("group transition-all hover:bg-slate-50 h-20", newBal < 0 && "bg-destructive/[0.03]")}>
                    <TableCell><div className="flex items-center gap-4"><div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs shadow-sm">{s.name.substring(0, 2).toUpperCase()}</div><div><p className="font-bold text-slate-800 text-sm leading-none">{s.name}</p><p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">{s.buildingName} • R-{s.roomNumber}</p></div></div></TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className={cn("font-black text-[11px] px-4 py-1 rounded-full", currentBal < 0 ? "text-destructive border-destructive/20 bg-destructive/5" : "text-success border-success/20 bg-success/5")}>৳{currentBal}</Badge></TableCell>
                    <TableCell className="text-right"><div className="relative inline-block w-full max-w-[100px]"><Input type="number" className="h-12 text-center text-lg font-black bg-slate-100 border-none shadow-inner rounded-2xl focus:ring-primary/20" value={mealInputs[s.id] || ""} onChange={e => setMealInputs({...mealInputs, [s.id]: e.target.value})} /></div></TableCell>
                    <TableCell className="text-right font-black text-slate-600 text-lg">৳{bill}</TableCell>
                    <TableCell className="text-right"><span className={cn("font-black text-xl", newBal < 0 ? "text-destructive" : "text-primary")}>৳{newBal}</span>{newBal < 0 && <p className="text-[9px] font-black uppercase text-destructive tracking-widest mt-1">Due Generated</p>}</TableCell>
                  </TableRow>
                )
              })}
              {filteredStudents.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-32 text-muted-foreground italic text-lg">No non-package residents found matching filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <CardFooter className="p-10 bg-slate-50 border-t flex flex-col md:flex-row items-center justify-between gap-8 mt-4">
          <div className="flex gap-16 text-center">
            <div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Recipients</p><p className="text-3xl font-black text-slate-800">{Object.keys(mealInputs).filter(id => Number(mealInputs[id]) > 0).length}</p></div>
            <div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Grand Total Bill</p><p className="text-3xl font-black text-primary">৳{grandBillSum.toLocaleString()}</p></div>
          </div>
          <Button onClick={handleBulkMealSubmit} disabled={isSubmitting || Object.keys(mealInputs).length === 0} className="w-full md:w-96 h-20 rounded-[2rem] text-2xl font-black shadow-2xl shadow-primary/20 gap-4 transition-transform active:scale-95">
            {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={32}/>} Confirm & Submit All
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
