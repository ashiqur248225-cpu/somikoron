
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Utensils, 
  Users, 
  Building2, 
  Calendar, 
  Search,
  Filter,
  Loader2,
  Table as TableIcon,
  ChefHat,
  ArrowUpRight,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  MoreVertical,
  SidebarTrigger
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

export default function AdminMealDashboardPage() {
  const db = useFirestore()
  const [userBranch, setUserBranch] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")

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

  const mealStats = useMemo(() => {
    if (!students) return { totalB: 0, totalL: 0, totalD: 0, activeCount: 0, offCount: 0, chartData: [] }
    
    let totalB = 0, totalL = 0, totalD = 0
    let activeCount = 0, offCount = 0

    const buildingMap: Record<string, any> = {}

    students.forEach(s => {
      const isB = s.mealStatus?.breakfast || false
      const isL = s.mealStatus?.lunch || false
      const isD = s.mealStatus?.dinner || false

      if (isB) totalB++;
      if (isL) totalL++;
      if (isD) totalD++;

      if (isB || isL || isD) activeCount++;
      else offCount++;

      const bName = s.buildingName || "General"
      if (!buildingMap[bName]) buildingMap[bName] = { name: bName, breakfast: 0, lunch: 0, dinner: 0 }
      if (isB) buildingMap[bName].breakfast++;
      if (isL) buildingMap[bName].lunch++;
      if (isD) buildingMap[bName].dinner++;
    })

    const chartData = Object.values(buildingMap)

    return { totalB, totalL, totalD, activeCount, offCount, chartData }
  }, [students])

  const filteredStudents = useMemo(() => {
    if (!students) return []
    return students.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || "").includes(searchTerm)
      const matchBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      return matchSearch && matchBuilding
    })
  }, [students, searchTerm, buildingFilter])

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

  if (isLoading) return <div className="flex justify-center p-20 animate-pulse"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-8 pb-20 w-full">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Meal Analytics</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Real-time catering statistics for <span className="font-bold text-foreground">{userBranch}</span>.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-orange-500 rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Breakfast</p>
            <div className="flex justify-between items-end mt-1">
              <h2 className="text-3xl font-black text-slate-800">{mealStats.totalB}</h2>
              <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-100">Today</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-success rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Lunch</p>
            <div className="flex justify-between items-end mt-1">
              <h2 className="text-3xl font-black text-slate-800">{mealStats.totalL}</h2>
              <Badge variant="outline" className="text-success bg-success/5 border-success/10">Today</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-500 rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Dinner</p>
            <div className="flex justify-between items-end mt-1">
              <h2 className="text-3xl font-black text-slate-800">{mealStats.totalD}</h2>
              <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-100">Today</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-primary rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Residents ON Meal</p>
            <div className="flex justify-between items-end mt-1">
              <h2 className="text-3xl font-black text-slate-800">{mealStats.activeCount}</h2>
              <p className="text-[10px] font-bold text-slate-400">Total: {students?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-lg flex items-center gap-2 text-primary">
              <LayoutGrid size={20}/> Building-wise Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mealStats.chartData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                <Bar dataKey="breakfast" fill="#f97316" radius={[4, 4, 0, 0]} name="Breakfast" />
                <Bar dataKey="lunch" fill="#22c55e" radius={[4, 4, 0, 0]} name="Lunch" />
                <Bar dataKey="dinner" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Dinner" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden flex flex-col">
          <CardHeader className="bg-slate-50/50 border-b flex flex-col sm:flex-row justify-between sm:items-center gap-4">
             <div>
               <CardTitle className="text-lg flex items-center gap-2 text-primary">
                 <ChefHat size={20}/> Meal Manager (Manual Override)
               </CardTitle>
               <CardDescription>Emergency toggle for student meals.</CardDescription>
             </div>
             <div className="flex gap-2">
               <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                 <SelectTrigger className="w-[140px] h-9 bg-white text-xs font-bold">
                   <SelectValue placeholder="All Buildings" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Buildings</SelectItem>
                   {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                 </SelectContent>
               </Select>
             </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search resident..." 
                  className="pl-10 h-10 border-none bg-slate-50 shadow-inner rounded-xl"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <ScrollArea className="h-[400px]">
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
                   {filteredStudents.map(s => (
                     <TableRow key={s.id} className="hover:bg-slate-50/50 transition-colors">
                       <TableCell className="py-3">
                         <div className="font-bold text-slate-700 text-xs">{s.name}</div>
                         <div className="text-[9px] text-muted-foreground uppercase">{s.buildingName} • R-{s.roomNumber}</div>
                       </TableCell>
                       <TableCell className="text-center">
                         <button 
                           onClick={() => handleToggleMeal(s.id, 'breakfast', s.mealStatus?.breakfast)}
                           className={cn("h-6 w-6 rounded-lg mx-auto flex items-center justify-center transition-all", s.mealStatus?.breakfast ? "bg-orange-100 text-orange-600 scale-110" : "bg-slate-100 text-slate-300")}
                         >
                           {s.mealStatus?.breakfast ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                         </button>
                       </TableCell>
                       <TableCell className="text-center">
                         <button 
                           onClick={() => handleToggleMeal(s.id, 'lunch', s.mealStatus?.lunch)}
                           className={cn("h-6 w-6 rounded-lg mx-auto flex items-center justify-center transition-all", s.mealStatus?.lunch ? "bg-success/10 text-success scale-110" : "bg-slate-100 text-slate-300")}
                         >
                           {s.mealStatus?.lunch ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                         </button>
                       </TableCell>
                       <TableCell className="text-center">
                         <button 
                           onClick={() => handleToggleMeal(s.id, 'dinner', s.mealStatus?.dinner)}
                           className={cn("h-6 w-6 rounded-lg mx-auto flex items-center justify-center transition-all", s.mealStatus?.dinner ? "bg-blue-50 text-blue-600 scale-110" : "bg-slate-100 text-slate-300")}
                         >
                           {s.mealStatus?.dinner ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                         </button>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
