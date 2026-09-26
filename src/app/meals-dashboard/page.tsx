
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Utensils, 
  Users, 
  Building2, 
  Search,
  Loader2,
  ChefHat,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  MoreVertical,
  ArrowRight,
  ClipboardList,
  Printer,
  ChevronDown,
  ChevronUp,
  Hash,
  ShoppingBag,
  ListOrdered,
  Truck,
  Calendar,
  Soup,
  Lock,
  RefreshCw,
  Plus,
  Minus,
  DoorOpen,
  User,
  ShieldAlert,
  History,
  MessageCircle,
  AlertCircle
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, increment, writeBatch } from "firebase/firestore"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { syncMissingAutoMeals } from "@/lib/meal-sync-service"

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const getLocYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AdminMealDashboardPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [userBranch, setUserBranch] = useState("")
  const [userRole, setUserRole] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [roomFilter, setRoomFilter] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null)
  const [viewDay, setViewDay] = useState<"yesterday" | "today" | "tomorrow">("today")
  const [isMounted, setIsMounted] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const branch = localStorage.getItem("user_branch") || "Main Branch"
    const role = localStorage.getItem("user_role") || "Staff"
    const bId = localStorage.getItem("assigned_building_id") || "none"
    
    setUserBranch(branch)
    setUserRole(role)
    if ((role === 'Building Manager' || role === 'Staff' || role === 'Worker' || role === 'General Staff') && bId !== 'none') {
      setBuildingFilter(bId)
    }
  }, [])

  const isKitchenStaff = useMemo(() => ['Staff', 'Worker', 'General Staff', 'Branch Manager'].includes(userRole), [userRole]);

  useEffect(() => {
    if (!userBranch || isSyncing) return;
    const runGlobalSync = async () => {
      setIsSyncing(true);
      await syncMissingAutoMeals(db, userBranch);
      setIsSyncing(false);
    }
    runGlobalSync();
  }, [userBranch, db]);

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "students"), where("branch", "==", userBranch), where("isActive", "==", true))
  }, [db, userBranch])
  const { data: students, isLoading: studentsLoading } = useCollection(studentsQuery)

  const routineQuery = useMemoFirebase(() => collection(db, "mealRoutines"), [db])
  const { data: routines } = useCollection(routineQuery)

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const mealConfigRef = useMemoFirebase(() => 
    userBranch ? doc(db, "configs", `mealConfig_${userBranch}`) : null, 
    [db, userBranch]
  )
  const { data: mealConfig, isLoading: configLoading } = useDoc(mealConfigRef)

  const mealRateRef = useMemoFirebase(() => 
    userBranch ? doc(db, "configs", `mealRate_${userBranch}`) : null, 
    [db, userBranch]
  )
  const { data: mealRateData } = useDoc(mealRateRef)

  const viewContext = useMemo(() => {
    if (!isMounted) return { dayName: "", dateStr: "", targetDateYMD: "", todayYMD: "", yesterdayYMD: "", tomorrowYMD: "" }
    
    const now = new Date()
    const targetDate = new Date(now)
    
    if (viewDay === 'tomorrow') targetDate.setDate(now.getDate() + 1)
    if (viewDay === 'yesterday') targetDate.setDate(now.getDate() - 1)
    
    const dayName = WEEKDAYS[targetDate.getDay()]
    const dateStr = targetDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const todayYMD = getLocYMD(now)
    
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const yesterdayYMD = getLocYMD(yesterday);

    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const tomorrowYMD = getLocYMD(tomorrow);

    const targetDateYMD = getLocYMD(targetDate);
    
    return { dayName, dateStr, targetDateYMD, todayYMD, yesterdayYMD, tomorrowYMD }
  }, [viewDay, isMounted])

  const currentMenu = useMemo(() => {
    if (!routines || !userBranch || !viewContext.dayName) return null
    return routines.find(r => r.day === viewContext.dayName && r.branch === userBranch) || 
           routines.find(r => r.id === `${viewContext.dayName}_${userBranch}`);
  }, [routines, userBranch, viewContext.dayName])

  const getDynamicOptions = (menuStr: string) => {
    const defaults = ["Normal"];
    if (!menuStr) return defaults;
    
    const items = menuStr.split(',').map(i => i.trim());
    let options: string[] = [...defaults];
    
    items.forEach(item => {
      if (item.includes('/')) {
        options = [...options, ...item.split('/').map(c => c.trim())];
      } else {
        const lower = item.toLowerCase();
        const staples = ["rice", "dal", "daal", "vat", "sobji", "vegetable", "vorta", "plain"];
        const isStaple = staples.some(s => lower.includes(s));
        if (!isStaple && item.length > 1) {
          options.push(item);
        }
      }
    });
    
    return Array.from(new Set(options));
  };

  const lunchOptions = useMemo(() => getDynamicOptions(currentMenu?.lunch || ""), [currentMenu]);
  const dinnerOptions = useMemo(() => getDynamicOptions(currentMenu?.dinner || ""), [currentMenu]);

  const mealStats = useMemo(() => {
    if (!students || !isMounted || !mealConfig) return { 
      totals: { breakfast: 0, lunch: 0, dinner: 0, totalPlates: 0 },
      choices: { lunch: {} as Record<string, number>, dinner: {} as Record<string, number> },
      buildingData: {} as Record<string, any>
    }
    
    let totals = { breakfast: 0, lunch: 0, dinner: 0, totalPlates: 0 }
    let choices = { lunch: {} as Record<string, number>, dinner: {} as Record<string, number> }
    let buildingData: Record<string, any> = {}

    const { dayName, targetDateYMD } = viewContext
    const bAvail = mealConfig.breakfastAvailable !== false;
    const lAvail = mealConfig.lunchAvailable !== false;
    const dAvail = mealConfig.dinnerAvailable !== false;

    students.forEach(s => {
      let willEatB = false; let willEatL = false; let willEatD = false;
      let choiceL = s.mealChoices?.lunch || "Normal";
      let choiceD = s.mealChoices?.dinner || "Normal";
      
      const isTomorrow = viewDay === 'tomorrow';
      const isToday = viewDay === 'today';

      const decisionField = isTomorrow ? 'lastMealUpdateDateTomorrow' : 'lastMealUpdateDateToday';
      const statusObj = isTomorrow ? s.tomorrowMealStatus : s.mealStatus;
      const guestObj = isTomorrow ? s.tomorrowGuestMeals : s.guestMeals;

      const isDecided = s[decisionField] === targetDateYMD;

      if (isDecided) {
        willEatB = !!statusObj?.breakfast && bAvail;
        willEatL = !!statusObj?.lunch && lAvail;
        willEatD = !!statusObj?.dinner && dAvail;
      } else if ((isToday || isTomorrow) && s.mealStatus?.autoMode) {
        // Correctly handle Auto-Mode for both today and tomorrow if not manually decided
        const sched = s.weeklySchedule?.[dayName] || { breakfast: true, lunch: true, dinner: true }
        willEatB = !!sched.breakfast && bAvail;
        willEatL = !!sched.lunch && lAvail;
        willEatD = !!sched.dinner && dAvail;
      }

      const guestB = isDecided ? (Number(guestObj?.breakfast) || 0) : 0;
      const guestL = isDecided ? (Number(guestObj?.lunch) || 0) : 0;
      const guestD = isDecided ? (Number(guestObj?.dinner) || 0) : 0;

      const combinedB = (willEatB ? 1 : 0) + guestB;
      const combinedL = (willEatL ? 1 : 0) + guestL;
      const combinedD = (willEatD ? 1 : 0) + guestD;

      if (combinedB > 0 || combinedL > 0 || combinedD > 0) {
        totals.breakfast += combinedB; 
        totals.lunch += combinedL; 
        totals.dinner += combinedD;
        totals.totalPlates += (combinedB + combinedL + combinedD);

        const bId = s.buildingId || "unassigned";
        const bName = s.buildingName || "Unassigned";
        
        if (!buildingData[bId]) buildingData[bId] = { id: bId, name: bName, breakfast: 0, lunch: 0, dinner: 0, rooms: {} as Record<string, any>, choiceCounts: { lunch: {} as Record<string, number>, dinner: {} as Record<string, number> } }

        const bd = buildingData[bId]
        bd.breakfast += combinedB; bd.lunch += combinedL; bd.dinner += combinedD;

        // Apply choice counts for the entire combined meal count (Self + Guests)
        if (combinedL > 0) { 
          choices.lunch[choiceL] = (choices.lunch[choiceL] || 0) + combinedL; 
          bd.choiceCounts.lunch[choiceL] = (bd.choiceCounts.lunch[choiceL] || 0) + combinedL; 
        }
        if (combinedD > 0) { 
          choices.dinner[choiceD] = (choices.dinner[choiceD] || 0) + combinedD; 
          bd.choiceCounts.dinner[choiceD] = (bd.choiceCounts.dinner[choiceD] || 0) + combinedD; 
        }

        const roomNo = s.roomNumber || "N/A"
        if (!bd.rooms[roomNo]) bd.rooms[roomNo] = { roomNo, residents: [], roomTotals: { b: 0, l: 0, d: 0, guests: 0 } }
        const rd = bd.rooms[roomNo]
        rd.roomTotals.b += combinedB; rd.roomTotals.l += combinedL; rd.roomTotals.d += combinedD;
        rd.roomTotals.guests += (guestB + guestL + guestD);

        rd.residents.push({ 
          id: s.id, 
          name: s.name, 
          phone: s.phone, 
          isSelfB: willEatB, isSelfL: willEatL, isSelfD: willEatD, 
          choiceL, choiceD, 
          guests: { breakfast: guestB, lunch: guestL, dinner: guestD }, 
          isAuto: s.mealStatus?.autoMode && !isDecided
        })
      }
    })

    return { totals, choices, buildingData }
  }, [students, viewContext, mealConfig, viewDay, isMounted])

  const canOverride = useMemo(() => {
    return userRole === 'Admin' || userRole === 'Branch Manager' || userRole === 'Building Manager' || isKitchenStaff;
  }, [userRole, isKitchenStaff]);

  const handleToggleMeal = async (student: any, mealId: string) => {
    if (!canOverride) return;
    const isAvail = mealConfig?.[`${mealId}Available`] !== false;
    if (!isAvail) { toast({ variant: "destructive", title: "Meal Locked" }); return; }

    try {
      const targetDateYMD = viewContext.targetDateYMD;
      const isTomorrow = viewDay === 'tomorrow';
      const decisionField = isTomorrow ? 'lastMealUpdateDateTomorrow' : 'lastMealUpdateDateToday';
      const statusField = isTomorrow ? `tomorrowMealStatus.${mealId}` : `mealStatus.${mealId}`;
      
      const isAlreadyDecided = student[decisionField] === targetDateYMD;
      const statusObj = isTomorrow ? student.tomorrowMealStatus : student.mealStatus;

      let currentVal = false;
      if (isAlreadyDecided) {
        currentVal = !!statusObj?.[mealId];
      }
      
      const sRef = doc(db, "students", student.id);
      const counterField = `currentMonth${mealId.charAt(0).toUpperCase() + mealId.slice(1)}`;
      
      const updateData: any = {
        [statusField]: !currentVal,
        [counterField]: increment(!currentVal ? 1 : -1),
        [decisionField]: targetDateYMD,
        updatedAt: serverTimestamp()
      }

      if (!isAlreadyDecided) {
        updateData["mealStatus.autoMode"] = false;
        ['breakfast', 'lunch', 'dinner'].forEach(m => {
          if (m !== mealId) {
             const f = isTomorrow ? `tomorrowMealStatus.${m}` : `mealStatus.${m}`;
             updateData[f] = false;
          }
        });
        const guestField = isTomorrow ? "tomorrowGuestMeals" : "guestMeals";
        updateData[guestField] = { breakfast: 0, lunch: 0, dinner: 0 };
      }

      await updateDoc(sRef, updateData);
      toast({ title: "Attendance Marked", description: `${student.name}'s ${mealId} is now ${!currentVal ? 'ON' : 'OFF'}` });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  const handleUpdateGuestMeal = async (student: any, mealId: string, delta: number) => {
    if (!canOverride) return;
    try {
      const targetDateYMD = viewContext.targetDateYMD;
      const isTomorrow = viewDay === 'tomorrow';
      const decisionField = isTomorrow ? 'lastMealUpdateDateTomorrow' : 'lastMealUpdateDateToday';
      const guestObjField = isTomorrow ? "tomorrowGuestMeals" : "guestMeals";
      
      const isAlreadyDecided = student[decisionField] === targetDateYMD;
      const guestObj = isTomorrow ? student.tomorrowGuestMeals : student.guestMeals;
      
      const currentGuestCount = isAlreadyDecided ? Number(guestObj?.[mealId] || 0) : 0;
      const newGuestCount = Math.max(0, currentGuestCount + delta);
      const diff = newGuestCount - currentGuestCount;

      const sRef = doc(db, "students", student.id);
      const updateData: any = { 
        [`${guestObjField}.${mealId}`]: newGuestCount, 
        currentMonthGuestMeals: increment(diff),
        [decisionField]: targetDateYMD,
        updatedAt: serverTimestamp() 
      };

      if (!isAlreadyDecided) {
        updateData["mealStatus.autoMode"] = false;
        ['breakfast', 'lunch', 'dinner'].forEach(m => {
           const f = isTomorrow ? `tomorrowMealStatus.${m}` : `mealStatus.${m}`;
           updateData[f] = false;
        });
      }

      await updateDoc(sRef, updateData);
      toast({ title: "Guest Count Updated" });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  const handleUpdateChoice = async (studentId: string, mealType: 'lunch' | 'dinner', choice: string) => {
    if (!canOverride) return;
    try {
      const sRef = doc(db, "students", studentId);
      await updateDoc(sRef, {
        [`mealChoices.${mealType}`]: choice,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Choice Saved" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  }

  const handlePrint = () => { if (typeof window !== "undefined") window.print(); }

  const filteredOverrideStudents = students?.filter(s => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = s.name.toLowerCase().includes(search) || (s.phone || "").includes(search);
    const matchesRoom = !roomFilter || String(s.roomNumber).includes(roomFilter);
    const matchesBuilding = buildingFilter === 'all' || s.buildingId === buildingFilter;
    return matchesSearch && matchesRoom && matchesBuilding;
  }) || [];

  if (!isMounted || studentsLoading || configLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="space-y-8 pb-20 w-full max-w-full overflow-x-hidden">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-6 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          {['Admin', 'Branch Manager', 'Building Manager', 'Staff', 'Worker', 'General Staff'].includes(userRole) && <SidebarTrigger className="-ml-1" />}
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Meal Analytics</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-xs mt-1">
              Target: <span className="font-bold text-foreground">{viewContext.dayName} ({viewContext.dateStr})</span>
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={viewDay} onValueChange={(v: any) => setViewDay(v)}>
              <SelectTrigger className="w-[130px] h-10 bg-white font-bold text-xs rounded-xl shadow-sm border-primary/20">
                <Calendar className="mr-2 h-4 w-4 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canOverride && <SelectItem value="yesterday">Yesterday</SelectItem>}
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
              </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2 font-bold h-10 border-primary/20 text-primary rounded-xl" onClick={handlePrint}>
              <Printer size={16}/> <span className="hidden sm:inline">Print</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full print:hidden">
        <TabsList className="bg-secondary/50 p-1 mb-6 rounded-2xl w-full max-w-md mx-auto grid grid-cols-2">
          <TabsTrigger value="summary" className="rounded-xl gap-2 font-bold h-10">Kitchen Prep</TabsTrigger>
          <TabsTrigger value="manager" className="rounded-xl gap-2 font-bold h-10">Manual Overrides</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-white border-l-4 border-l-orange-500 rounded-2xl">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Breakfast ({viewDay})</p>
                      <h2 className="text-4xl font-black text-slate-800">{mealStats.totals.breakfast}</h2>
                      <p className="text-[10px] font-bold text-orange-600 flex items-center gap-1">
                          <Soup size={10}/> {currentMenu?.breakfast || 'Menu not set'}
                      </p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-2xl text-orange-500"><Utensils size={24}/></div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white border-l-4 border-l-success rounded-2xl">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Lunch ({viewDay})</p>
                      <h2 className="text-4xl font-black text-slate-800">{mealStats.totals.lunch}</h2>
                      <p className="text-[10px] font-bold text-success flex items-center gap-1">
                          <ChefHat size={10}/> {currentMenu?.lunch || 'Menu not set'}
                      </p>
                    </div>
                    <div className="bg-success/5 p-3 rounded-2xl text-success"><ChefHat size={24}/></div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-500 rounded-2xl">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Dinner ({viewDay})</p>
                      <h2 className="text-4xl font-black text-slate-800">{mealStats.totals.dinner}</h2>
                      <p className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                          <ShoppingBag size={10}/> {currentMenu?.dinner || 'Menu not set'}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-2xl text-blue-500"><ShoppingBag size={24}/></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
                <div className="text-[10px] font-black uppercase text-success tracking-[0.3em] border-b border-white/10 pb-2">Lunch Prep Breakdown</div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(mealStats.choices.lunch).length > 0 ? Object.entries(mealStats.choices.lunch).map(([choice, count]) => (
                    <div key={choice} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center shadow-inner">
                      <span className="text-xs font-bold text-white/80">{choice}</span>
                      <span className="text-2xl font-black text-success">{count}</span>
                    </div>
                  )) : <p className="text-xs text-white/40 italic">No custom choices.</p>}
                </div>
            </div>
            <div className="space-y-4">
                <div className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em] border-b border-white/10 pb-2">Dinner Prep Breakdown</div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(mealStats.choices.dinner).length > 0 ? Object.entries(mealStats.choices.dinner).map(([choice, count]) => (
                    <div key={choice} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center shadow-inner">
                      <span className="text-xs font-bold text-white/80">{choice}</span>
                      <span className="text-2xl font-black text-blue-400">{count}</span>
                    </div>
                  )) : <p className="text-xs text-white/40 italic">No custom choices.</p>}
                </div>
            </div>
          </Card>

          <div className="space-y-6">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
                <Truck size={24} className="text-primary"/> Distribution Sheet ({viewDay})
            </h2>
            {Object.values(mealStats.buildingData).sort((a: any,b: any) => a.name.localeCompare(b.name)).map((b: any) => (
              <Card key={b.id} className="border-none shadow-sm rounded-3xl bg-white overflow-hidden border-t-4 border-t-primary/10">
                <div 
                  className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors" 
                  onClick={() => setExpandedBuilding(expandedBuilding === b.id ? null : b.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black shadow-sm text-lg">
                      {b.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">{b.name}</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Building Total Delivery</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Badge className="bg-orange-50 text-orange-600 border-none font-black h-8 px-4 text-xs">B: {b.breakfast}</Badge>
                    <Badge className="bg-success/5 text-success border-none font-black h-8 px-4 text-xs">L: {b.lunch}</Badge>
                    <Badge className="bg-blue-50 text-blue-600 border-none font-black h-8 px-4 text-xs">D: {b.dinner}</Badge>
                    <div className="bg-slate-100 h-8 w-8 rounded-xl flex items-center justify-center text-slate-400">
                        {expandedBuilding === b.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                    </div>
                  </div>
                </div>

                {expandedBuilding === b.id && (
                  <div className="border-t animate-in slide-in-from-top-2 duration-300">
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader className="bg-slate-50/50">
                          <TableRow className="border-none">
                            <TableHead className="font-black uppercase text-[10px] w-20">Room</TableHead>
                            <TableHead className="font-black uppercase text-[10px]">Resident(s)</TableHead>
                            <TableHead className="font-black uppercase text-[10px] text-center">B</TableHead>
                            <TableHead className="font-black uppercase text-[10px] text-center">L</TableHead>
                            <TableHead className="font-black uppercase text-[10px] text-center">D</TableHead>
                            <TableHead className="font-black uppercase text-[10px] text-right">Guests</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.values(b.rooms).sort((x: any, y: any) => x.roomNo.localeCompare(y.roomNo, undefined, {numeric: true})).map((room: any) => (
                            <TableRow key={room.roomNo} className="hover:bg-slate-50/30 border-b border-dashed last:border-none">
                                <TableCell className="font-black text-primary py-4">R-{room.roomNo}</TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    {room.residents.map((r: any) => (
                                      <div key={r.id} className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700">{r.name}</span>
                                        {r.isAuto && <Badge variant="outline" className="text-[7px] h-3 px-1 border-primary/20 text-primary uppercase font-bold">Auto</Badge>}
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center font-black text-orange-600">{room.roomTotals.b || '-'}</TableCell>
                                <TableCell className="text-center font-black text-success">{room.roomTotals.l || '-'}</TableCell>
                                <TableCell className="text-center font-black text-blue-600">{room.roomTotals.d || '-'}</TableCell>
                                <TableCell className="text-right">
                                  {room.roomTotals.guests > 0 ? (
                                    <Badge className="bg-primary text-[10px] font-black">{room.roomTotals.guests}G</Badge>
                                  ) : <span className="text-slate-200">-</span>}
                                </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="md:hidden space-y-3 p-4 bg-slate-50/30">
                       {Object.values(b.rooms).sort((x: any, y: any) => x.roomNo.localeCompare(y.roomNo, undefined, {numeric: true})).map((room: any) => (
                         <div key={room.roomNo} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                            <div className="flex justify-between items-center">
                               <Badge className="bg-primary text-[10px] font-black uppercase h-6 px-3">Room {room.roomNo}</Badge>
                               <div className="flex gap-1.5">
                                  <Badge className="bg-orange-50 text-orange-600 border-none font-black text-[9px] h-5">B: {room.roomTotals.b}</Badge>
                                  <Badge className="bg-success/5 text-success border-none font-black text-[9px] h-5">L: {room.roomTotals.l}</Badge>
                                  <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[9px] h-5">D: {room.roomTotals.d}</Badge>
                               </div>
                            </div>
                            <Separator className="opacity-50" />
                            <div className="space-y-2">
                               {room.residents.map((r: any) => (
                                 <div key={r.id} className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-2">
                                       <span className="text-[11px] font-black text-slate-700">{r.name.split(' ')[0]}</span>
                                    </div>
                                    <div className="flex gap-1">
                                       {r.isSelfB && <span className="text-[8px] font-black text-orange-500 bg-orange-50 px-1.5 rounded-md">B</span>}
                                       {r.isSelfL && <span className="text-[8px] font-black text-success bg-success/5 px-1.5 rounded-md">L</span>}
                                       {r.isSelfD && <span className="text-[8px] font-black text-blue-500 bg-blue-50 px-1.5 rounded-md">D</span>}
                                    </div>
                                 </div>
                               ))}
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="manager" className="space-y-6">
          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg">Manual Overrides ({viewDay})</CardTitle>
                  <CardDescription>
                    {viewDay === 'tomorrow' ? "Attendance Sheet: Everything OFF by default." : "Daily Management: Review decisions."}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="h-7 px-4 rounded-full border-primary text-primary font-black uppercase text-[10px]">
                  Date: {viewContext.dateStr}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Building</Label>
                  <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                    <SelectTrigger className="h-10 bg-white rounded-xl border-none shadow-inner font-bold text-xs"><Building2 size={14} className="mr-2 text-primary"/><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Entire Branch</SelectItem>
                        {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Room No.</Label>
                  <div className="relative"><DoorOpen className="absolute left-3 top-2.5 h-4 w-4 text-primary"/><Input placeholder="Room..." className="pl-10 h-10 border-none bg-white rounded-xl shadow-inner text-xs font-bold" value={roomFilter} onChange={e => setRoomFilter(e.target.value)}/></div>
                </div>
                <div className="lg:col-span-2 space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Resident Search</Label>
                  <div className="relative"><User className="absolute left-3 top-2.5 h-4 w-4 text-primary"/><Input placeholder="Name or phone..." className="pl-10 h-10 border-none bg-white rounded-xl shadow-inner text-xs font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-none h-12">
                      <TableHead className="font-black uppercase text-[10px] text-slate-500 pl-6">Student & Location</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-slate-500 text-center">Self Meals (B/L/D)</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-slate-500 text-center">Custom Choices</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-slate-500 text-right pr-6">Guests</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOverrideStudents.map(s => {
                      const targetDateYMD = viewContext.targetDateYMD;
                      const isTomorrow = viewDay === 'tomorrow';
                      const decisionField = isTomorrow ? 'lastMealUpdateDateTomorrow' : 'lastMealUpdateDateToday';
                      const isDecisionLocked = s[decisionField] === targetDateYMD;
                      const statusObj = isTomorrow ? s.tomorrowMealStatus : s.mealStatus;
                      const guestObj = isTomorrow ? s.tomorrowGuestMeals : s.guestMeals;

                      let isActiveB = false; let isActiveL = false; let isActiveD = false;
                      if (isDecisionLocked) {
                          isActiveB = !!statusObj?.breakfast; isActiveL = !!statusObj?.lunch; isActiveD = !!statusObj?.dinner;
                      }
                      
                      const gCountB = isDecisionLocked ? (Number(guestObj?.breakfast) || 0) : 0;
                      const gCountL = isDecisionLocked ? (Number(guestObj?.lunch) || 0) : 0;
                      const gCountD = isDecisionLocked ? (Number(guestObj?.dinner) || 0) : 0;

                      // Estimated Balance Calculation
                      const foodVal = Number(s.foodDueAmount || 0);
                      const b = s.currentMonthBreakfast || 0;
                      const l = s.currentMonthLunch || 0;
                      const d = s.currentMonthDinner || 0;
                      const g = s.currentMonthGuestMeals || 0;
                      const mealRate = Number(mealRateData?.rate || 0);
                      const effectiveMeals = (b * 0.5) + l + d + g;
                      const estimatedFoodBalance = Math.round(foodVal - (effectiveMeals * mealRate));
                      const isLowBalance = estimatedFoodBalance < 50;

                      return (
                        <TableRow key={s.id} className="hover:bg-slate-50/50 transition-colors border-b last:border-none">
                          <TableCell className="py-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-black text-xs shadow-sm">{s.roomNumber}</div>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-black text-slate-800 text-sm">{s.name}</p>
                                  {s.mealChoices?.lunch && s.mealChoices.lunch !== "Normal" && (
                                    <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-md border border-orange-100 uppercase">
                                      {s.mealChoices.lunch}
                                    </span>
                                  )}
                                  {s.mealChoices?.dinner && s.mealChoices.dinner !== "Normal" && (
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100 uppercase">
                                      {s.mealChoices.dinner}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="text-[9px] font-bold text-muted-foreground uppercase">{s.buildingName}</p>
                                  <div className={cn("flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full", isLowBalance ? "bg-destructive/10 text-destructive animate-pulse" : "bg-success/5 text-success")}>
                                    {isLowBalance && <AlertCircle size={8} />}
                                    Est. Bal: ৳{estimatedFoodBalance}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                                {[{ id: 'breakfast', active: isActiveB, label: 'B' }, { id: 'lunch', active: isActiveL, label: 'L' }, { id: 'dinner', active: isActiveD, label: 'D' }].map(m => (
                                  <button key={m.id} onClick={() => handleToggleMeal(s, m.id)} className={cn("h-9 w-9 rounded-lg flex items-center justify-center font-black text-xs shadow-sm transition-all", m.active ? "bg-primary text-white scale-105" : "bg-slate-100 text-slate-300 hover:bg-slate-200")}>
                                    {m.label}
                                  </button>
                                ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                             <div className="flex gap-2 justify-center">
                                <Select value={s.mealChoices?.lunch || "Normal"} onValueChange={(v) => handleUpdateChoice(s.id, 'lunch', v)}>
                                   <SelectTrigger className="h-8 text-[10px] w-24"><SelectValue/></SelectTrigger>
                                   <SelectContent>{lunchOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={s.mealChoices?.dinner || "Normal"} onValueChange={(v) => handleUpdateChoice(s.id, 'dinner', v)}>
                                   <SelectTrigger className="h-8 text-[10px] w-24"><SelectValue/></SelectTrigger>
                                   <SelectContent>{dinnerOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                </Select>
                             </div>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                {['breakfast', 'lunch', 'dinner'].map(mId => {
                                  const val = mId === 'breakfast' ? gCountB : (mId === 'lunch' ? gCountL : gCountD);
                                  return (
                                    <div key={mId} className="flex flex-col items-center bg-slate-50 rounded-lg p-1 border">
                                        <span className="text-[6px] font-black text-muted-foreground uppercase">{mId[0]}G</span>
                                        <div className="flex items-center gap-2">
                                          <button onClick={() => handleUpdateGuestMeal(s, mId, -1)} disabled={val <= 0} className="h-5 w-4 flex items-center justify-center text-slate-300"><Minus size={8}/></button>
                                          <span className="text-[10px] font-black text-primary">{val}</span>
                                          <button onClick={() => handleUpdateGuestMeal(s, mId, 1)} className="h-5 w-4 flex items-center justify-center text-slate-300"><Plus size={8}/></button>
                                        </div>
                                    </div>
                                  )
                                })}
                              </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* MOBILE VIEW - COLUMNAR CARDS */}
              <div className="md:hidden space-y-4 p-4 bg-slate-50/50">
                  {filteredOverrideStudents.map(s => {
                    const targetDateYMD = viewContext.targetDateYMD;
                    const isTomorrow = viewDay === 'tomorrow';
                    const decisionField = isTomorrow ? 'lastMealUpdateDateTomorrow' : 'lastMealUpdateDateToday';
                    const isDecisionLocked = s[decisionField] === targetDateYMD;
                    const statusObj = isTomorrow ? s.tomorrowMealStatus : s.mealStatus;
                    const guestObj = isTomorrow ? s.tomorrowGuestMeals : s.guestMeals;

                    let isActiveB = false; let isActiveL = false; let isActiveD = false;
                    if (isDecisionLocked) {
                        isActiveB = !!statusObj?.breakfast; isActiveL = !!statusObj?.lunch; isActiveD = !!statusObj?.dinner;
                    }

                    const gCountB = isDecisionLocked ? (Number(guestObj?.breakfast) || 0) : 0;
                    const gCountL = isDecisionLocked ? (Number(guestObj?.lunch) || 0) : 0;
                    const gCountD = isDecisionLocked ? (Number(guestObj?.dinner) || 0) : 0;

                    // Estimated Balance Calculation
                    const foodVal = Number(s.foodDueAmount || 0);
                    const bCount = s.currentMonthBreakfast || 0;
                    const lCount = s.currentMonthLunch || 0;
                    const dCount = s.currentMonthDinner || 0;
                    const gCount = s.currentMonthGuestMeals || 0;
                    const mealRateValue = Number(mealRateData?.rate || 0);
                    const effectiveTotalMeals = (bCount * 0.5) + lCount + dCount + gCount;
                    const estimatedBalanceMobile = Math.round(foodVal - (effectiveTotalMeals * mealRateValue));
                    const isLowBalanceMobile = estimatedBalanceMobile < 50;

                    return (
                      <Card key={s.id} className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                          <CardContent className="p-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs shadow-sm">{s.roomNumber}</div>
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="font-black text-slate-800 text-sm">{s.name}</h3>
                                      {s.mealChoices?.lunch && s.mealChoices.lunch !== "Normal" && (
                                        <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-md border border-orange-100 uppercase">
                                          {s.mealChoices.lunch}
                                        </span>
                                      )}
                                      {s.mealChoices?.dinner && s.mealChoices.dinner !== "Normal" && (
                                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100 uppercase">
                                          {s.mealChoices.dinner}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-[9px] font-bold text-muted-foreground uppercase">{s.buildingName}</p>
                                      <div className={cn("flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-full", isLowBalanceMobile ? "bg-destructive/10 text-destructive" : "bg-success/5 text-success")}>
                                        {isLowBalanceMobile && <AlertCircle size={8} />}
                                        Est. Bal: ৳{estimatedBalanceMobile}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                {isDecisionLocked && <Badge className="bg-success text-[8px] font-black uppercase h-5 px-2 rounded-full">✓ Locked</Badge>}
                            </div>

                            <div className="space-y-3">
                              {[
                                { id: 'breakfast', label: 'Breakfast', icon: '🌅', menu: currentMenu?.breakfast, active: isActiveB, guests: gCountB, options: [] },
                                { id: 'lunch', label: 'Lunch', icon: '☀️', menu: currentMenu?.lunch, active: isActiveL, guests: gCountL, options: lunchOptions },
                                { id: 'dinner', label: 'Dinner', icon: '🌙', menu: currentMenu?.dinner, active: isActiveD, guests: gCountD, options: dinnerOptions }
                              ].map((m) => (
                                <div key={m.id} className={cn("p-3 rounded-2xl border transition-all space-y-3", m.active || m.guests > 0 ? "bg-primary/[0.03] border-primary/10" : "bg-slate-50/50 border-slate-100")}>
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">{m.icon}</span>
                                      <div>
                                        <p className="text-[10px] font-black text-slate-800 uppercase leading-none">{m.label}</p>
                                        <p className="text-[8px] text-muted-foreground font-bold truncate max-w-[100px]">{m.menu || 'No Menu'}</p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center bg-white rounded-lg border p-1 h-8 shadow-sm">
                                         <button onClick={() => handleUpdateGuestMeal(s, m.id, -1)} disabled={m.guests <= 0} className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-destructive transition-colors"><Minus size={10}/></button>
                                         <span className="text-xs font-black text-primary w-5 text-center">{m.guests}</span>
                                         <button onClick={() => handleUpdateGuestMeal(s, m.id, 1)} className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"><Plus size={10}/></button>
                                      </div>
                                      <button 
                                        onClick={() => handleToggleMeal(s, m.id)} 
                                        className={cn(
                                          "h-8 w-12 rounded-lg flex items-center justify-center font-black text-xs shadow-sm transition-all", 
                                          m.active ? "bg-primary text-white" : "bg-white text-slate-300 border"
                                        )}
                                      >
                                        {m.active ? 'ON' : 'OFF'}
                                      </button>
                                    </div>
                                  </div>

                                  {(m.id === 'lunch' || m.id === 'dinner') && (m.active || m.guests > 0) && (
                                    <div className="pt-2 border-t border-dashed border-primary/10">
                                       <Select value={(m.id === 'lunch' ? s.mealChoices?.lunch : s.mealChoices?.dinner) || "Normal"} onValueChange={(v) => handleUpdateChoice(s.id, m.id as any, v)}>
                                          <SelectTrigger className="h-8 rounded-xl bg-white border-none text-[10px] font-bold shadow-sm w-full">
                                            <ChefHat size={12} className="mr-2 text-primary" />
                                            <SelectValue placeholder="Select Choice"/>
                                          </SelectTrigger>
                                          <SelectContent>
                                             {m.options.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                                          </SelectContent>
                                       </Select>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                      </Card>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
