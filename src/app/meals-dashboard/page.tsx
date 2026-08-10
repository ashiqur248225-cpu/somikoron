
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
  Truck
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, increment } from "firebase/firestore"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

export default function AdminMealDashboardPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [userBranch, setUserBranch] = useState("")
  const [userRole, setUserRole] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null)

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserRole(localStorage.getItem("user_role") || "Staff")
  }, [])

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "students"), where("branch", "==", userBranch), where("isActive", "==", true))
  }, [db, userBranch])
  const { data: students, isLoading } = useCollection(studentsQuery)

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  // ADVANCED ANALYTICS LOGIC (INC. GUESTS FOR TOMORROW)
  const mealStats = useMemo(() => {
    if (!students) return { 
      totals: { breakfast: 0, lunch: 0, dinner: 0, totalPlates: 0 },
      choices: { lunch: {} as Record<string, number>, dinner: {} as Record<string, number>, breakfast: {} as Record<string, number> },
      buildingData: {} as Record<string, any>
    }
    
    let totals = { breakfast: 0, lunch: 0, dinner: 0, totalPlates: 0 }
    let choices = { 
      lunch: {} as Record<string, number>, 
      dinner: {} as Record<string, number>, 
      breakfast: {} as Record<string, number> 
    }
    let buildingData: Record<string, any> = {}

    students.forEach(s => {
      const isB = s.mealStatus?.breakfast || false
      const isL = s.mealStatus?.lunch || false
      const isD = s.mealStatus?.dinner || false
      
      const gB = Number(s.tomorrowGuestMeals?.breakfast || 0);
      const gL = Number(s.tomorrowGuestMeals?.lunch || 0);
      const gD = Number(s.tomorrowGuestMeals?.dinner || 0);

      const combinedB = (isB ? 1 : 0) + gB;
      const combinedL = (isL ? 1 : 0) + gL;
      const combinedD = (isD ? 1 : 0) + gD;

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
        const choice = s.mealChoices?.lunch || "Normal"
        choices.lunch[choice] = (choices.lunch[choice] || 0) + combinedL
        bd.choiceCounts.lunch[choice] = (bd.choiceCounts.lunch[choice] || 0) + combinedL
      }
      if (combinedD > 0) {
        const choice = s.mealChoices?.dinner || "Normal"
        choices.dinner[choice] = (choices.dinner[choice] || 0) + combinedD
        bd.choiceCounts.dinner[choice] = (bd.choiceCounts.dinner[choice] || 0) + combinedD
      }

      // Room Level
      const roomNo = s.roomNumber || "N/A"
      if (!bd.rooms[roomNo]) bd.rooms[roomNo] = { roomNo, students: [] }
      if (combinedB > 0 || combinedL > 0 || combinedD > 0) {
        bd.rooms[roomNo].students.push({
          id: s.id,
          name: s.name,
          phone: s.phone,
          status: s.mealStatus,
          choices: s.mealChoices,
          guestMeals: s.tomorrowGuestMeals || { breakfast: 0, lunch: 0, dinner: 0 }
        })
      }
    })

    return { totals, choices, buildingData }
  }, [students])

  const canOverride = userRole === 'Admin' || userRole === 'Branch Manager';

  const handleToggleMeal = async (student: any, mealId: string) => {
    if (!canOverride) return;
    try {
      const currentVal = !!student.mealStatus?.[mealId];
      const sRef = doc(db, "students", student.id);
      const counterField = `currentMonth${mealId.charAt(0).toUpperCase() + mealId.slice(1)}`;
      
      await updateDoc(sRef, {
        [`mealStatus.${mealId}`]: !currentVal,
        [counterField]: increment(!currentVal ? 1 : -1),
        updatedAt: serverTimestamp()
      });
      toast({ title: "Updated", description: `${student.name}'s ${mealId} toggled.` });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  const handlePrint = () => { if (typeof window !== "undefined") window.print(); }

  if (isLoading) return <div className="flex flex-col items-center justify-center p-20 gap-4"><Loader2 className="animate-spin h-10 w-10 text-primary" /><p className="text-sm font-bold text-muted-foreground uppercase">Kitchen Syncing...</p></div>

  return (
    <div className="space-y-8 pb-20 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Meal Analytics</h1></div>
        </div>
        <div className="ml-auto">
           <Button variant="outline" size="sm" className="gap-2 font-bold h-10 border-primary/20 text-primary" onClick={handlePrint}>
              <Printer size={16}/> <span className="hidden sm:inline">Print Distribution</span>
           </Button>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full print:hidden">
        <TabsList className="bg-secondary/50 p-1 mb-6 rounded-2xl w-full max-w-md mx-auto grid grid-cols-2">
          <TabsTrigger value="summary" className="rounded-xl gap-2 font-bold h-10">Kitchen Summary</TabsTrigger>
          <TabsTrigger value="manager" className="rounded-xl gap-2 font-bold h-10">Manual Toggle</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-white border-l-4 border-l-orange-500 rounded-2xl"><CardContent className="pt-6 flex justify-between items-center"><div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground">Breakfast (Inc. Guests)</p><h2 className="text-3xl font-black">{mealStats.totals.breakfast}</h2></div><Utensils size={24} className="text-orange-500"/></CardContent></Card>
            <Card className="border-none shadow-sm bg-white border-l-4 border-l-success rounded-2xl"><CardContent className="pt-6 flex justify-between items-center"><div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground">Lunch (Inc. Guests)</p><h2 className="text-3xl font-black">{mealStats.totals.lunch}</h2></div><ChefHat size={24} className="text-success"/></CardContent></Card>
            <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-500 rounded-2xl"><CardContent className="pt-6 flex justify-between items-center"><div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground">Dinner (Inc. Guests)</p><h2 className="text-3xl font-black">{mealStats.totals.dinner}</h2></div><ShoppingBag size={24} className="text-blue-500"/></CardContent></Card>
          </div>

          <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <div className="text-[10px] font-black uppercase text-success tracking-widest border-b border-white/10 pb-2">Lunch Prep Counts</div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(mealStats.choices.lunch).map(([choice, count]) => (
                    <div key={choice} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center"><span className="text-sm font-bold text-white/80">{choice}</span><span className="text-2xl font-black text-success">{count}</span></div>
                  ))}
                </div>
             </div>
             <div className="space-y-4">
                <div className="text-[10px] font-black uppercase text-blue-400 tracking-widest border-b border-white/10 pb-2">Dinner Prep Counts</div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(mealStats.choices.dinner).map(([choice, count]) => (
                    <div key={choice} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center"><span className="text-sm font-bold text-white/80">{choice}</span><span className="text-2xl font-black text-blue-400">{count}</span></div>
                  ))}
                </div>
             </div>
          </Card>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight"><Building2 size={24} className="text-primary"/> Distribution Sheet (Student + Guest)</h2>
            {Object.values(mealStats.buildingData).map((b: any) => (
              <Card key={b.id} className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpandedBuilding(expandedBuilding === b.id ? null : b.id)}>
                  <div className="flex items-center gap-4"><div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black shadow-sm">{b.name.substring(0, 2).toUpperCase()}</div><h3 className="text-xl font-black text-slate-800">{b.name}</h3></div>
                  <div className="flex gap-4">
                     <Badge className="bg-orange-50 text-orange-600 border-none font-black">B: {b.breakfast}</Badge>
                     <Badge className="bg-success/5 text-success border-none font-black">L: {b.lunch}</Badge>
                     <Badge className="bg-blue-50 text-blue-600 border-none font-black">D: {b.dinner}</Badge>
                  </div>
                </div>
                {expandedBuilding === b.id && (
                  <div className="border-t">
                    <Table>
                      <TableHeader className="bg-slate-50/50"><TableRow><TableHead>Room</TableHead><TableHead>Name</TableHead><TableHead className="text-center">B (+G)</TableHead><TableHead className="text-center">L (+G)</TableHead><TableHead className="text-center">D (+G)</TableHead></TableRow></TableHeader>
                      <TableBody>
                         {Object.values(b.rooms).sort((x: any, y: any) => x.roomNo.localeCompare(y.roomNo, undefined, {numeric: true})).map((room: any) => room.students.map((s: any, idx: number) => (
                           <TableRow key={s.id} className="hover:bg-slate-50/30">
                              <TableCell className="font-black text-primary">{idx === 0 ? `R-${room.roomNo}` : ""}</TableCell>
                              <TableCell><p className="font-bold text-xs">{s.name}</p><p className="text-[9px] text-muted-foreground">{s.phone}</p></TableCell>
                              <TableCell className="text-center">
                                 {s.status?.breakfast ? <span className="font-black text-xs text-orange-600">1</span> : <span className="text-slate-200">0</span>}
                                 {s.guestMeals?.breakfast > 0 && <span className="text-[10px] font-black text-primary ml-1">+{s.guestMeals.breakfast}G</span>}
                              </TableCell>
                              <TableCell className="text-center">
                                 {s.status?.lunch ? <span className="font-black text-xs text-success">1</span> : <span className="text-slate-200">0</span>}
                                 {s.guestMeals?.lunch > 0 && <span className="text-[10px] font-black text-primary ml-1">+{s.guestMeals.lunch}G</span>}
                                 {s.status?.lunch && <p className="text-[8px] font-bold uppercase opacity-60">{s.choices?.lunch || 'Normal'}</p>}
                              </TableCell>
                              <TableCell className="text-center">
                                 {s.status?.dinner ? <span className="font-black text-xs text-blue-600">1</span> : <span className="text-slate-200">0</span>}
                                 {s.guestMeals?.dinner > 0 && <span className="text-[10px] font-black text-primary ml-1">+{s.guestMeals.dinner}G</span>}
                                 {s.status?.dinner && <p className="text-[8px] font-bold uppercase opacity-60">{s.choices?.dinner || 'Normal'}</p>}
                              </TableCell>
                           </TableRow>
                         )))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="manager" className="animate-in fade-in zoom-in-95 duration-300">
           <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                 <div><CardTitle className="text-lg">Override Control</CardTitle><CardDescription>Force toggle student meals only.</CardDescription></div>
                 <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." className="pl-10 h-10 border-none bg-white rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
              </CardHeader>
              <CardContent className="p-0 h-[600px] overflow-y-auto">
                 <Table>
                    <TableBody>
                       {students?.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
                         <TableRow key={s.id} className="border-b">
                            <TableCell className="py-4"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center text-primary font-black text-[10px]">R-{s.roomNumber}</div><p className="font-black text-slate-800 text-xs">{s.name}</p></div></TableCell>
                            <TableCell className="text-right">
                               <div className="flex gap-2 justify-end">
                                  {['breakfast', 'lunch', 'dinner'].map(m => (
                                    <button key={m} onClick={() => handleToggleMeal(s, m)} disabled={!canOverride} className={cn("h-9 w-9 rounded-xl flex items-center justify-center font-black text-[10px] transition-all", s.mealStatus?.[m] ? "bg-primary text-white" : "bg-slate-100 text-slate-300")}>{m.charAt(0).toUpperCase()}</button>
                                  ))}
                               </div>
                            </TableCell>
                         </TableRow>
                       ))}
                    </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
