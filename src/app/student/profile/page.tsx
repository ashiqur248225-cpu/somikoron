
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
  ChevronRight,
  Eye,
  EyeOff,
  Edit,
  Key
} from "lucide-react"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export default function StudentProfilePage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [studentId, setStudentId] = useState("")
  const [isMounted, setIsMounted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isChangingPass, setIsChangingPass] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)

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

  const handleChangePassword = async () => {
    if (!newPassword || !studentRef) return
    setIsUpdating(true)
    try {
      await updateDoc(studentRef, {
        password: newPassword,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Password Updated", description: "Your portal login password has been changed." })
      setIsChangingPass(false)
      setNewPassword("")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) return <div className="flex justify-center p-20 animate-pulse text-sm font-bold text-muted-foreground uppercase">Syncing Profile...</div>
  if (!student) return <div className="text-center p-20">Access Denied.</div>

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500 w-full">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-6 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shrink-0 shadow-lg shadow-primary/20">
           <User size={20} />
        </div>
        <div className="flex-1 overflow-hidden">
          <h1 className="text-lg font-black text-slate-800 truncate">{student.name}</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">My Profile</p>
        </div>
      </div>

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

          {/* New Security & Account Access Section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Lock size={12}/> Account Access</h3>
            <div className="p-5 bg-slate-900 rounded-[2rem] text-white space-y-4 shadow-xl">
               <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase text-white/40 tracking-widest">Login Mobile Number</p>
                  <div className="flex items-center gap-2">
                    <Smartphone size={14} className="text-primary"/>
                    <p className="text-md font-bold">{student.phone}</p>
                  </div>
               </div>
               <Separator className="bg-white/10" />
               <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[8px] font-black uppercase text-white/40 tracking-widest">Portal Password</p>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-white/40 hover:text-white" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff size={14}/> : <Eye size={14}/>}
                    </Button>
                  </div>
                  <p className="text-lg font-mono font-black tracking-widest">
                    {showPassword ? student.password : "••••••••"}
                  </p>
               </div>
               
               <Dialog open={isChangingPass} onOpenChange={setIsChangingPass}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="w-full h-9 rounded-xl border border-white/10 text-[10px] font-black uppercase hover:bg-white/10">
                      <Edit size={12} className="mr-2"/> Change Password
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Update Portal Password</DialogTitle>
                      <DialogDescription>Enter a new password for your resident portal access.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">New Password</Label>
                        <Input 
                          type="text" 
                          value={newPassword} 
                          onChange={e => setNewPassword(e.target.value)} 
                          placeholder="Create new password"
                          className="h-11 rounded-xl"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleChangePassword} disabled={isUpdating || !newPassword} className="w-full h-12 rounded-xl font-bold">
                        {isUpdating ? <Loader2 className="animate-spin" /> : "Save Updates"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
               </Dialog>
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
             <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><ScrollText size={12}/> Documents</h3>
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
