
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
  ListOrdered
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AdminMealDashboardPage() {
  const db = useFirestore()
  const [userBranch, setUserBranch] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null)

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
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

  // ADVANCED ANALYTICS LOGIC
  const mealStats = useMemo(() => {
    if (!students) return { 
      totals: { breakfast: 0, lunch: 0, dinner: 0 },
      choices: { lunch: {} as Record<string, number>, dinner: {} as Record<string, number>, breakfast: {} as Record<string, number> },
      buildingData: {} as Record<string, any>
    }
    
    let totals = { breakfast: 0, lunch: 0, dinner: 0 }
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

      if (isB) totals.breakfast++
      if (isL) totals.lunch++
      if (isD) totals.dinner++

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
      if (isB) bd.breakfast++
      if (isL) {
        bd.lunch++
        const choice = s.mealChoices?.lunch || "Normal"
        choices.lunch[choice] = (choices.lunch[choice] || 0) + 1
        bd.choiceCounts.lunch[choice] = (bd.choiceCounts.lunch[choice] || 0) + 1
      }
      if (isD) {
        bd.dinner++
        const choice = s.mealChoices?.dinner || "Normal"
        choices.dinner[choice] = (choices.dinner[choice] || 0) + 1
        bd.choiceCounts.dinner[choice] = (bd.choiceCounts.dinner[choice] || 0) + 1
      }

      // Room Level
      const roomNo = s.roomNumber || "N/A"
      if (!bd.rooms[roomNo]) bd.rooms[roomNo] = { roomNo, students: [] }
      if (isB || isL || isD) {
        bd.rooms[roomNo].students.push({
          id: s.id,
          name: s.name,
          phone: s.phone,
          status: s.mealStatus,
          choices: s.mealChoices
        })
      }
    })

    return { totals, choices, buildingData }
  }, [students])

  const handleToggleMeal = async (studentId: string, mealId: string, currentVal: boolean) => {
    try {
      const sRef = doc(db, "students", studentId)
      await updateDoc(sRef, {
        [`mealStatus.${mealId}`]: !currentVal,
        updatedAt: serverTimestamp()
      })
    } catch (e) {
      console.error(e)
    }
  }

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="animate-spin h-10 w-10 text-primary" />
      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Syncing Kitchen Data...</p>
    </div>
  )

  return (
    <div className="space-y-8 pb-20 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Meal Analytics</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Catering & Delivery management for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
           <Button variant="outline" size="sm" className="gap-2 font-bold rounded-xl h-10 border-primary/20 text-primary" onClick={handlePrint}>
              <Printer size={16}/> <span className="hidden sm:inline">Print Delivery Sheet</span>
           </Button>
        </div>
      </div>

      {/* PRINT ONLY HEADER */}
      <div className="hidden print:block text-center border-b-2 border-primary pb-4 mb-6">
         <h1 className="text-3xl font-black text-primary uppercase">সমীকরণ ছাত্রাবাস</h1>
         <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{userBranch} • Daily Food Distribution Sheet</p>
         <p className="text-xs font-medium mt-2">Date: {new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}</p>
      </div>

      <Tabs defaultValue="summary" className="w-full print:hidden">
        <TabsList className="bg-secondary/50 p-1 mb-6 rounded-2xl w-full max-w-md mx-auto grid grid-cols-2">
          <TabsTrigger value="summary" className="rounded-xl gap-2 h-10 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <ClipboardList size={14}/> Kitchen Overview
          </TabsTrigger>
          <TabsTrigger value="manager" className="rounded-xl gap-2 h-10 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Users size={14}/> Manual Override
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-8 animate-in fade-in duration-500">
          {/* Main Totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-white border-l-4 border-l-orange-500 rounded-2xl">
              <CardContent className="pt-6 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Breakfast Total</p>
                  <h2 className="text-3xl font-black text-slate-800">{mealStats.totals.breakfast}</h2>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center"><Utensils size={24}/></div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-white border-l-4 border-l-success rounded-2xl">
              <CardContent className="pt-6 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Lunch Total</p>
                  <h2 className="text-3xl font-black text-slate-800">{mealStats.totals.lunch}</h2>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-success/5 text-success flex items-center justify-center"><ChefHat size={24}/></div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-500 rounded-2xl">
              <CardContent className="pt-6 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Dinner Total</p>
                  <h2 className="text-3xl font-black text-slate-800">{mealStats.totals.dinner}</h2>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><ShoppingBag size={24}/></div>
              </CardContent>
            </Card>
          </div>

          {/* Cooking Breakdown (Choice Counts) */}
          <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10"><Utensils size={120}/></div>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl"><ListOrdered size={20}/></div>
                <div>
                  <CardTitle className="text-lg">Kitchen Production Summary</CardTitle>
                  <CardDescription className="text-white/40">Item-wise breakdown for cooking.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase text-success tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-success"/> Lunch Prep
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(mealStats.choices.lunch).length > 0 ? Object.entries(mealStats.choices.lunch).map(([choice, count]) => (
                      <div key={choice} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center">
                        <span className="text-sm font-bold text-white/80">{choice}</span>
                        <span className="text-2xl font-black text-success">{count}</span>
                      </div>
                    )) : <p className="text-xs text-white/30 italic col-span-2">No lunch data logged today.</p>}
                  </div>
               </div>
               <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"/> Dinner Prep
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(mealStats.choices.dinner).length > 0 ? Object.entries(mealStats.choices.dinner).map(([choice, count]) => (
                      <div key={choice} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center">
                        <span className="text-sm font-bold text-white/80">{choice}</span>
                        <span className="text-2xl font-black text-blue-400">{count}</span>
                      </div>
                    )) : <p className="text-xs text-white/30 italic col-span-2">No dinner data logged today.</p>}
                  </div>
               </div>
            </CardContent>
          </Card>

          {/* Building Distribution List */}
          <div className="space-y-4">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
              <Building2 size={24} className="text-primary"/> Distribution Sheet
            </h2>
            <div className="grid grid-cols-1 gap-6">
              {Object.values(mealStats.buildingData).map((b: any) => (
                <Card key={b.id} className="border-none shadow-sm rounded-3xl bg-white overflow-hidden group">
                  <div 
                    className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedBuilding(expandedBuilding === b.id ? null : b.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black shadow-sm">
                        {b.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800 leading-none">{b.name}</h3>
                        <div className="flex gap-4 mt-2">
                           <Badge variant="outline" className="text-[9px] font-black uppercase bg-orange-50/50 border-orange-200 text-orange-600">B: {b.breakfast}</Badge>
                           <Badge variant="outline" className="text-[9px] font-black uppercase bg-success/5 border-success/20 text-success">L: {b.lunch}</Badge>
                           <Badge variant="outline" className="text-[9px] font-black uppercase bg-blue-50/50 border-blue-200 text-blue-600">D: {b.dinner}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                       <div className="flex-1 md:text-right">
                          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Lunch Choices</p>
                          <div className="flex gap-2 justify-end mt-1">
                             {Object.entries(b.choiceCounts.lunch).map(([choice, count]: any) => (
                               <span key={choice} className="text-[10px] font-bold text-slate-500">
                                 {choice}: <b className="text-slate-800">{count}</b>
                               </span>
                             ))}
                          </div>
                       </div>
                       <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full group-hover:bg-white shadow-sm border border-transparent group-hover:border-slate-100 transition-all">
                          {expandedBuilding === b.id ? <ChevronUp /> : <ChevronDown />}
                       </Button>
                    </div>
                  </div>

                  {expandedBuilding === b.id && (
                    <div className="border-t animate-in slide-in-from-top-2 duration-300">
                       <Table>
                          <TableHeader className="bg-slate-50/50">
                             <TableRow>
                                <TableHead className="w-24">Room</TableHead>
                                <TableHead>Student Name</TableHead>
                                <TableHead className="text-center">B</TableHead>
                                <TableHead className="text-center">Lunch Choice</TableHead>
                                <TableHead className="text-center">Dinner Choice</TableHead>
                             </TableRow>
                          </TableHeader>
                          <TableBody>
                             {Object.values(b.rooms).sort((x: any, y: any) => x.roomNo.localeCompare(y.roomNo, undefined, {numeric: true})).map((room: any) => (
                               room.students.map((s: any, idx: number) => (
                                 <TableRow key={s.id} className={cn("hover:bg-slate-50/30", idx === 0 && "border-t-2 border-slate-100")}>
                                    <TableCell className="font-black text-primary py-4">{idx === 0 ? `R-${room.roomNo}` : ""}</TableCell>
                                    <TableCell>
                                       <p className="font-bold text-slate-800 text-xs">{s.name}</p>
                                       <p className="text-[10px] text-muted-foreground">{s.phone}</p>
                                    </TableCell>
                                    <TableCell className="text-center">
                                       {s.status?.breakfast ? <CheckCircle2 className="text-success h-4 w-4 mx-auto" /> : <XCircle className="text-slate-200 h-4 w-4 mx-auto" />}
                                    </TableCell>
                                    <TableCell className="text-center">
                                       {s.status?.lunch ? (
                                         <Badge className="bg-success/10 text-success border-success/20 text-[8px] font-black h-5 px-2">
                                           {s.choices?.lunch || 'NORMAL'}
                                         </Badge>
                                       ) : <span className="text-[8px] font-black text-slate-300">OFF</span>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                       {s.status?.dinner ? (
                                         <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-[8px] font-black h-5 px-2">
                                           {s.choices?.dinner || 'NORMAL'}
                                         </Badge>
                                       ) : <span className="text-[8px] font-black text-slate-300">OFF</span>}
                                    </TableCell>
                                 </TableRow>
                               ))
                             ))}
                          </TableBody>
                       </Table>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manager" className="animate-in fade-in zoom-in-95 duration-300">
           <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden flex flex-col">
              <CardHeader className="bg-slate-50/50 border-b flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                 <div>
                   <CardTitle className="text-lg flex items-center gap-2 text-primary">
                     <ChefHat size={20}/> Meal Manager (Emergency Override)
                   </CardTitle>
                   <CardDescription>Manually toggle meals for students in real-time.</CardDescription>
                 </div>
                 <div className="flex gap-2">
                   <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                     <SelectTrigger className="w-[180px] h-9 bg-white text-xs font-bold">
                       <LayoutGrid size={14} className="mr-2 text-primary"/>
                       <SelectValue placeholder="Filter Building" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="all">All Buildings</SelectItem>
                       {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search name or phone..." 
                      className="pl-10 h-11 border-none bg-slate-50 shadow-inner rounded-xl"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <ScrollArea className="h-[500px]">
                   <Table>
                     <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                       <TableRow>
                         <TableHead>Student</TableHead>
                         <TableHead className="text-center">B</TableHead>
                         <TableHead className="text-center">L</TableHead>
                         <TableHead className="text-center">D</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {students?.filter(s => {
                         const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone?.includes(searchTerm)
                         const matchBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
                         return matchSearch && matchBuilding && s.isActive
                       }).map(s => (
                         <TableRow key={s.id} className="hover:bg-slate-50/50 transition-colors">
                           <TableCell className="py-3">
                             <div className="font-bold text-slate-700 text-xs">{s.name}</div>
                             <div className="text-[9px] text-muted-foreground uppercase font-black">{s.buildingName} • R-{s.roomNumber}</div>
                           </TableCell>
                           <TableCell className="text-center">
                             <button 
                               onClick={() => handleToggleMeal(s.id, 'breakfast', s.mealStatus?.breakfast)}
                               className={cn("h-7 w-7 rounded-xl mx-auto flex items-center justify-center transition-all", s.mealStatus?.breakfast ? "bg-orange-100 text-orange-600 scale-110 shadow-sm" : "bg-slate-100 text-slate-300")}
                             >
                               {s.mealStatus?.breakfast ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
                             </button>
                           </TableCell>
                           <TableCell className="text-center">
                             <button 
                               onClick={() => handleToggleMeal(s.id, 'lunch', s.mealStatus?.lunch)}
                               className={cn("h-7 w-7 rounded-xl mx-auto flex items-center justify-center transition-all", s.mealStatus?.lunch ? "bg-success/10 text-success scale-110 shadow-sm" : "bg-slate-100 text-slate-300")}
                             >
                               {s.mealStatus?.lunch ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
                             </button>
                           </TableCell>
                           <TableCell className="text-center">
                             <button 
                               onClick={() => handleToggleMeal(s.id, 'dinner', s.mealStatus?.dinner)}
                               className={cn("h-7 w-7 rounded-xl mx-auto flex items-center justify-center transition-all", s.mealStatus?.dinner ? "bg-blue-50 text-blue-600 scale-110 shadow-sm" : "bg-slate-100 text-slate-300")}
                             >
                               {s.mealStatus?.dinner ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
                             </button>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                </ScrollArea>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* PRINT VERSION (Simplified List) */}
      <div className="hidden print:block space-y-8">
         <div className="grid grid-cols-3 gap-8 mb-8 text-center bg-slate-50 p-4 border rounded-2xl">
            <div><p className="text-[10px] font-black uppercase text-slate-400">Total Breakfast</p><p className="text-2xl font-black">{mealStats.totals.breakfast}</p></div>
            <div><p className="text-[10px] font-black uppercase text-slate-400">Total Lunch</p><p className="text-2xl font-black">{mealStats.totals.lunch}</p></div>
            <div><p className="text-[10px] font-black uppercase text-slate-400">Total Dinner</p><p className="text-2xl font-black">{mealStats.totals.dinner}</p></div>
         </div>

         {Object.values(mealStats.buildingData).map((b: any) => (
           <div key={b.id} className="page-break-inside-avoid mb-8">
             <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-4">
                <h2 className="text-xl font-black uppercase">{b.name} Distribution</h2>
                <div className="flex gap-4 text-xs font-bold uppercase">
                   <span>B: {b.breakfast}</span>
                   <span>L: {b.lunch}</span>
                   <span>D: {b.dinner}</span>
                </div>
             </div>
             <table className="w-full text-xs border-collapse">
                <thead>
                   <tr className="bg-slate-100">
                      <th className="border p-2 text-left">Room</th>
                      <th className="border p-2 text-left">Student</th>
                      <th className="border p-2 text-center">Breakfast</th>
                      <th className="border p-2 text-center">Lunch Choice</th>
                      <th className="border p-2 text-center">Dinner Choice</th>
                   </tr>
                </thead>
                <tbody>
                   {Object.values(b.rooms).sort((x: any, y: any) => x.roomNo.localeCompare(y.roomNo, undefined, {numeric: true})).map((room: any) => (
                     room.students.map((s: any, idx: number) => (
                       <tr key={s.id}>
                          <td className="border p-2 font-bold">{idx === 0 ? room.roomNo : ""}</td>
                          <td className="border p-2">{s.name}</td>
                          <td className="border p-2 text-center">{s.status?.breakfast ? "ON" : "OFF"}</td>
                          <td className="border p-2 text-center font-black">{s.status?.lunch ? (s.choices?.lunch || "NORMAL") : "-"}</td>
                          <td className="border p-2 text-center font-black">{s.status?.dinner ? (s.choices?.dinner || "NORMAL") : "-"}</td>
                       </tr>
                     ))
                   ))}
                </tbody>
             </table>
           </div>
         ))}
      </div>
    </div>
  )
}
