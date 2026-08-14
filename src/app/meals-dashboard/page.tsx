
"use client"

import { useState, useMemo, useEffect } from "react"
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
  Soup
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, increment } from "firebase/firestore"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export default function AdminMealDashboardPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [userBranch, setUserBranch] = useState("")
  const [userRole, setUserRole] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null)
  const [viewDay, setViewDay] = useState<"yesterday" | "today" | "tomorrow">("today")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserRole(localStorage.getItem("user_role") || "Staff")
  }, [])

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "students"), where("branch", "==", userBranch), where("isActive", "==", true))
  }, [db, userBranch])
  const { data: students, isLoading: studentsLoading } = useCollection(studentsQuery)

  const routineQuery = useMemoFirebase(() => collection(db, "mealRoutines"), [db])
  const { data: routines } = useCollection(routineQuery)

  const mealConfigRef = useMemoFirebase(() => 
    userBranch ? doc(db, "configs", `mealConfig_${userBranch}`) : null, 
    [db, userBranch]
  )
  const { data: mealConfig, isLoading: configLoading } = useDoc(mealConfigRef)

  const viewContext = useMemo(() => {
    const now = new Date()
    const targetDate = new Date(now)
    
    if (viewDay === 'tomorrow') targetDate.setDate(now.getDate() + 1)
    if (viewDay === 'yesterday') targetDate.setDate(now.getDate() - 1)
    
    // The date when the student updated for this targetDate
    const updateDate = new Date(targetDate)
    updateDate.setDate(targetDate.getDate() - 1)
    
    const dayName = WEEKDAYS[targetDate.getDay()]
    const dateStr = targetDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const updateDateYMD = updateDate.toLocaleDateString('en-CA') // YYYY-MM-DD
    
    return { dayName, dateStr, updateDateYMD, targetDate }
  }, [viewDay])

  const currentMenu = useMemo(() => {
    if (!routines || !userBranch) return null
    return routines.find(r => r.day === viewContext.dayName && r.branch === userBranch)
  }, [routines, userBranch, viewContext.dayName])

  const mealStats = useMemo(() => {
    if (!students || configLoading) return { 
      totals: { breakfast: 0, lunch: 0, dinner: 0, totalPlates: 0 },
      choices: { lunch: {} as Record<string, number>, dinner: {} as Record<string, number> },
      buildingData: {} as Record<string, any>
    }
    
    let totals = { breakfast: 0, lunch: 0, dinner: 0, totalPlates: 0 }
    let choices = { lunch: {} as Record<string, number>, dinner: {} as Record<string, number> }
    let buildingData: Record<string, any> = {}

    const { dayName, updateDateYMD } = viewContext
    const bAvail = mealConfig?.breakfastAvailable !== false;
    const lAvail = mealConfig?.lunchAvailable !== false;
    const dAvail = mealConfig?.dinnerAvailable !== false;

    students.forEach(s => {
      let willEatB = false
      let willEatL = false
      let willEatD = false
      let choiceL = "Normal"
      let choiceD = "Normal"
      
      // Check if user updated their meals for THIS target date specifically on the expected update date
      const updatedOnTime = s.lastMealUpdateDate === updateDateYMD;

      // PRIORITY 1: Manual Update (Happened on the update date)
      if (updatedOnTime) {
        willEatB = !!s.mealStatus?.breakfast && bAvail
        willEatL = !!s.mealStatus?.lunch && lAvail
        willEatD = !!s.mealStatus?.dinner && dAvail
        choiceL = s.mealChoices?.lunch || "Normal"
        choiceD = s.mealChoices?.dinner || "Normal"
      } 
      // PRIORITY 2: Auto Mode (Based on Schedule)
      else if (s.mealStatus?.autoMode) {
        const sched = s.weeklySchedule?.[dayName] || { breakfast: false, lunch: false, dinner: false }
        willEatB = !!sched.breakfast && bAvail
        willEatL = !!sched.lunch && lAvail
        willEatD = !!sched.dinner && dAvail
        choiceL = sched.lunchChoice || "Normal"
        choiceD = sched.dinnerChoice || "Normal"
      }

      // GUEST MEALS: Only valid if updated on the correct date
      const gB = (updatedOnTime && bAvail) ? Number(s.tomorrowGuestMeals?.breakfast || 0) : 0;
      const gL = (updatedOnTime && lAvail) ? Number(s.tomorrowGuestMeals?.lunch || 0) : 0;
      const gD = (updatedOnTime && dAvail) ? Number(s.tomorrowGuestMeals?.dinner || 0) : 0;

      const combinedB = (willEatB ? 1 : 0) + gB;
      const combinedL = (willEatL ? 1 : 0) + gL;
      const combinedD = (willEatD ? 1 : 0) + gD;

      // Filter: Only include if they have at least one meal
      if (combinedB > 0 || combinedL > 0 || combinedD > 0) {
        totals.breakfast += combinedB;
        totals.lunch += combinedL;
        totals.dinner += combinedD;
        totals.totalPlates += (combinedB + combinedL + combinedD);

        const bId = s.buildingId || "unassigned"
        const bName = s.buildingName || "Unassigned"
        
        if (!buildingData[bId]) {
          buildingData[bId] = { 
            id: bId, 
            name: bName, 
            breakfast: 0, lunch: 0, dinner: 0, 
            rooms: {} as Record<string, any>,
            choiceCounts: { lunch: {} as Record<string, number>, dinner: {} as Record<string, number> }
          }
        }

        const bd = buildingData[bId]
        bd.breakfast += combinedB;
        bd.lunch += combinedL;
        bd.dinner += combinedD;

        if (combinedL > 0) {
          choices.lunch[choiceL] = (choices.lunch[choiceL] || 0) + combinedL
          bd.choiceCounts.lunch[choiceL] = (bd.choiceCounts.lunch[choiceL] || 0) + combinedL
        }
        if (combinedD > 0) {
          choices.dinner[choiceD] = (choices.dinner[choiceD] || 0) + combinedD
          bd.choiceCounts.dinner[choiceD] = (bd.choiceCounts.dinner[choiceD] || 0) + combinedD
        }

        const roomNo = s.roomNumber || "N/A"
        if (!bd.rooms[roomNo]) {
          bd.rooms[roomNo] = { 
            roomNo, 
            residents: [], 
            roomTotals: { b: 0, l: 0, d: 0, guests: 0 } 
          }
        }
        
        const rd = bd.rooms[roomNo]
        rd.roomTotals.b += combinedB
        rd.roomTotals.l += combinedL
        rd.roomTotals.d += combinedD
        rd.roomTotals.guests += (gB + gL + gD)

        rd.residents.push({
          id: s.id,
          name: s.name,
          isSelfB: willEatB,
          isSelfL: willEatL,
          isSelfD: willEatD,
          choiceL,
          choiceD,
          guests: updatedOnTime ? (s.tomorrowGuestMeals || { breakfast: 0, lunch: 0, dinner: 0 }) : { breakfast: 0, lunch: 0, dinner: 0 },
          isAuto: !updatedOnTime && s.mealStatus?.autoMode
        })
      }
    })

    return { totals, choices, buildingData }
  }, [students, viewContext, mealConfig, configLoading])

  const canOverride = (userRole === 'Admin' || userRole === 'Branch Manager') && viewDay === 'tomorrow';

  const handleToggleMeal = async (student: any, mealId: string) => {
    if (!canOverride) return;
    const isAvail = mealConfig?.[`${mealId}Available`] !== false;
    if (!isAvail) {
      toast({ variant: "destructive", title: "Meal Locked", description: "Admin has disabled this meal type." });
      return;
    }

    try {
      const currentVal = !!student.mealStatus?.[mealId];
      const sRef = doc(db, "students", student.id);
      const counterField = `currentMonth${mealId.charAt(0).toUpperCase() + mealId.slice(1)}`;
      
      await updateDoc(sRef, {
        [`mealStatus.${mealId}`]: !currentVal,
        [counterField]: increment(!currentVal ? 1 : -1),
        lastMealUpdateDate: new Date().toLocaleDateString('en-CA'),
        updatedAt: serverTimestamp()
      });
      toast({ title: "Updated", description: `${student.name}'s ${mealId} toggled for tomorrow.` });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  const handlePrint = () => { if (typeof window !== "undefined") window.print(); }

  if (studentsLoading || configLoading) return <div className="flex flex-col items-center justify-center p-20 gap-4"><Loader2 className="animate-spin h-10 w-10 text-primary" /><p className="text-sm font-bold text-muted-foreground uppercase">Kitchen Syncing...</p></div>

  return (
    <div className="space-y-8 pb-20 w-full max-w-full overflow-x-hidden">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Meal Analytics</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-xs mt-1">
              Data for <span className="font-bold text-foreground">{viewContext.dayName} ({viewContext.dateStr})</span>
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
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
              </SelectContent>
           </Select>
           <Button variant="outline" size="sm" className="gap-2 font-bold h-10 border-primary/20 text-primary rounded-xl" onClick={handlePrint}>
              <Printer size={16}/> <span className="hidden sm:inline">Print</span>
           </Button>
        </div>
      </div>

      <div className="hidden print:block text-center space-y-2 mb-8 border-b-2 border-slate-900 pb-4">
         <h1 className="text-3xl font-black uppercase">Somikoron Hostel Kitchen</h1>
         <p className="text-lg font-bold">Meal Distribution Sheet: {viewContext.dayName}, {viewContext.dateStr}</p>
         <div className="flex justify-center gap-8 mt-2 text-sm font-bold">
            <span>B: {mealStats.totals.breakfast}</span>
            <span>L: {mealStats.totals.lunch}</span>
            <span>D: {mealStats.totals.dinner}</span>
         </div>
      </div>

      <Tabs defaultValue="summary" className="w-full print:hidden">
        <TabsList className={cn(
          "bg-secondary/50 p-1 mb-6 rounded-2xl w-full max-w-md mx-auto grid",
          (userRole === 'Admin' || userRole === 'Branch Manager') ? "grid-cols-2" : "grid-cols-1"
        )}>
          <TabsTrigger value="summary" className="rounded-xl gap-2 font-bold h-10">Kitchen Prep</TabsTrigger>
          {(userRole === 'Admin' || userRole === 'Branch Manager') && (
            <TabsTrigger value="manager" className="rounded-xl gap-2 font-bold h-10">Manual Override</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="summary" className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-white border-l-4 border-l-orange-500 rounded-2xl group hover:shadow-md transition-all">
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

            <Card className="border-none shadow-sm bg-white border-l-4 border-l-success rounded-2xl group hover:shadow-md transition-all">
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

            <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-500 rounded-2xl group hover:shadow-md transition-all">
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
                  )) : <p className="text-xs text-white/40 italic">No custom choices requested.</p>}
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
                  )) : <p className="text-xs text-white/40 italic">No custom choices requested.</p>}
                </div>
             </div>
          </Card>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
               <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
                 <Truck size={24} className="text-primary"/> Distribution Sheet ({viewDay})
               </h2>
               <p className="text-[10px] font-bold text-muted-foreground uppercase">Showing active orders</p>
            </div>
            
            {Object.values(mealStats.buildingData).sort((a,b) => a.name.localeCompare(b.name)).map((b: any) => (
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
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-none">
                          <TableHead className="font-black uppercase text-[10px] w-20">Room</TableHead>
                          <TableHead className="font-black uppercase text-[10px]">Resident(s)</TableHead>
                          <TableHead className="font-black uppercase text-[10px] text-center">Breakfast</TableHead>
                          <TableHead className="font-black uppercase text-[10px] text-center">Lunch</TableHead>
                          <TableHead className="font-black uppercase text-[10px] text-center">Dinner</TableHead>
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
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {(userRole === 'Admin' || userRole === 'Branch Manager') && (
          <TabsContent value="manager" className="animate-in fade-in zoom-in-95 duration-300">
             {viewDay !== 'tomorrow' ? (
                <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-dashed text-center space-y-4">
                   <Lock size={48} className="text-slate-200" />
                   <div className="space-y-1">
                      <p className="font-black text-slate-800">Override Disabled</p>
                      <p className="text-xs text-muted-foreground uppercase font-bold">You can only manually override meals for "Tomorrow".</p>
                   </div>
                   <Button variant="outline" className="rounded-xl font-bold" onClick={() => setViewDay('tomorrow')}>Switch to Tomorrow</Button>
                </div>
             ) : (
                <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <CardTitle className="text-lg">Meal Override (Tomorrow)</CardTitle>
                      <CardDescription>Manually toggle meals for specific students for tomorrow.</CardDescription>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search name or room..." className="pl-10 h-10 border-none bg-white rounded-xl shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 h-[600px] overflow-y-auto">
                    <Table>
                        <TableBody>
                          {students?.filter(s => 
                              s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              String(s.roomNumber).includes(searchTerm)
                          ).map(s => (
                            <TableRow key={s.id} className="border-b">
                                <TableCell className="py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center text-primary font-black text-[10px]">R-{s.roomNumber}</div>
                                    <div>
                                      <p className="font-black text-slate-800 text-xs">{s.name}</p>
                                      <p className="text-[8px] font-bold text-muted-foreground uppercase">{s.buildingName}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex gap-2 justify-end">
                                      {['breakfast', 'lunch', 'dinner'].map(m => {
                                        const isAvail = mealConfig?.[`${m}Available`] !== false;
                                        const isActive = s.lastMealUpdateDate === viewContext.updateDateYMD ? !!s.mealStatus?.[m] : (s.mealStatus?.autoMode ? !!s.weeklySchedule?.[viewContext.dayName]?.[m] : false);
                                        return (
                                          <button 
                                            key={m} 
                                            onClick={() => handleToggleMeal(s, m)} 
                                            disabled={!canOverride || !isAvail} 
                                            className={cn(
                                              "h-9 w-9 rounded-xl flex items-center justify-center font-black text-[10px] transition-all shadow-sm", 
                                              (isActive && isAvail) ? "bg-primary text-white" : "bg-slate-100 text-slate-300",
                                              !isAvail && "opacity-20"
                                            )}
                                          >
                                            {m.charAt(0).toUpperCase()}
                                          </button>
                                        );
                                      })}
                                  </div>
                                </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                    </Table>
                  </CardContent>
                </Card>
             )}
          </TabsContent>
        )}
      </Tabs>

      <div className="hidden print:block space-y-8">
        {Object.values(mealStats.buildingData).sort((a,b) => a.name.localeCompare(b.name)).map((b: any) => (
          <div key={b.id} className="space-y-4 break-after-page">
             <div className="bg-slate-100 p-4 rounded-lg flex justify-between items-center">
                <h3 className="text-xl font-bold">{b.name}</h3>
                <div className="flex gap-4 font-bold text-sm">
                   <span>B: {b.breakfast}</span>
                   <span>L: {b.lunch}</span>
                   <span>D: {b.dinner}</span>
                </div>
             </div>
             <table className="w-full border-collapse border border-slate-300">
                <thead>
                   <tr className="bg-slate-50">
                      <th className="border border-slate-300 p-2 text-left text-xs uppercase">Room</th>
                      <th className="border border-slate-300 p-2 text-left text-xs uppercase">B</th>
                      <th className="border border-slate-300 p-2 text-left text-xs uppercase">L</th>
                      <th className="border border-slate-300 p-2 text-left text-xs uppercase">D</th>
                      <th className="border border-slate-300 p-2 text-left text-xs uppercase">G</th>
                      <th className="border border-slate-300 p-2 text-left text-xs uppercase">Notes</th>
                   </tr>
                </thead>
                <tbody>
                   {Object.values(b.rooms).sort((x: any, y: any) => x.roomNo.localeCompare(y.roomNo, undefined, {numeric: true})).map((room: any) => (
                     <tr key={room.roomNo}>
                        <td className="border border-slate-300 p-2 font-black text-sm">R-{room.roomNo}</td>
                        <td className="border border-slate-300 p-2 text-center font-bold">{room.roomTotals.b || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center font-bold">{room.roomTotals.l || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center font-bold">{room.roomTotals.d || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center font-bold">{room.roomTotals.guests || '-'}</td>
                        <td className="border border-slate-300 p-2 text-[10px]">
                           {room.residents.filter((r:any) => r.choiceL !== 'Normal' || r.choiceD !== 'Normal').map((r:any) => 
                             `${r.name.split(' ')[0]}: L-${r.choiceL}, D-${r.choiceD}`
                           ).join('; ')}
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
        ))}
      </div>
    </div>
  )
}
