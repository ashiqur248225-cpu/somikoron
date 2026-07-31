
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  User, 
  MapPin, 
  Phone, 
  LogOut, 
  Calendar,
  Building2,
  Lock,
  Loader2,
  ScrollText,
  ShieldCheck,
  Smartphone,
  ChevronRight
} from "lucide-react"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function StudentProfilePage() {
  const router = useRouter()
  const db = useFirestore()
  const [studentId, setStudentId] = useState("")
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setStudentId(localStorage.getItem("somikoron_auth_id") || "")
    setIsMounted(true)
  }, [])

  const studentRef = useMemoFirebase(() => studentId ? doc(db, "students", studentId) : null, [db, studentId])
  const { data: student, isLoading } = useDoc(studentRef)

  const rulesRef = useMemoFirebase(() => doc(db, "configs", "hostelRules"), [db])
  const { data: rulesData } = useDoc(rulesRef)

  const handleLogout = () => {
    localStorage.clear()
    window.location.href = "/"
  }

  if (isLoading) return <div className="flex justify-center p-20 animate-pulse text-sm font-bold text-muted-foreground uppercase">Syncing Profile...</div>
  if (!student) return <div className="text-center p-20">Access Denied.</div>

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/20">
           <User size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800">{student.name}</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{student.branch} Resident</p>
        </div>
      </header>

      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><MapPin size={12}/> Allocation Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">Building</p>
                <p className="text-xs font-black text-slate-700">{student.buildingName}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">Room / Seat</p>
                <p className="text-xs font-black text-slate-700">R-{student.roomNumber} | S-{student.seatNumber}</p>
              </div>
            </div>
          </div>

          <Separator className="opacity-50" />

          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Smartphone size={12}/> Contacts</h3>
            <div className="space-y-3">
               <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3"><Phone size={16} className="text-primary"/><span className="text-xs font-bold text-slate-600">Personal</span></div>
                  <span className="text-xs font-black">{student.phone}</span>
               </div>
               <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3"><ShieldCheck size={16} className="text-primary"/><span className="text-xs font-bold text-slate-600">Guardian</span></div>
                  <span className="text-xs font-black">{student.parentPhone || 'N/A'}</span>
               </div>
            </div>
          </div>

          <Separator className="opacity-50" />

          <div className="space-y-4">
             <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Lock size={12}/> Security</h3>
             <Dialog>
               <DialogTrigger asChild>
                 <Button variant="outline" className="w-full h-12 rounded-2xl gap-3 font-bold border-primary/20 text-primary">
                   <ScrollText size={18}/> Rules & Regulations <ChevronRight size={16}/>
                 </Button>
               </DialogTrigger>
               <DialogContent className="max-w-md h-[80vh] overflow-y-auto rounded-3xl">
                 <DialogHeader><DialogTitle>Hostel Rules</DialogTitle></DialogHeader>
                 <div className="rich-text p-4 text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: rulesData?.rulesText || "No rules defined." }} />
               </DialogContent>
             </Dialog>

             <Button variant="destructive" className="w-full h-14 rounded-2xl gap-3 font-black shadow-xl shadow-destructive/10" onClick={handleLogout}>
                <LogOut size={20}/> Logout from Portal
             </Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="text-center space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Version 2.5.0 Stable</p>
        <p className="text-[8px] font-bold text-primary/50 uppercase">Managed by {student.branch} Administration</p>
      </div>
    </div>
  )
}
