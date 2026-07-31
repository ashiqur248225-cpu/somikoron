"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  User, 
  Shield, 
  MapPin, 
  Phone, 
  LogOut, 
  ChevronLeft,
  Calendar,
  Building2,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  Edit,
  Save,
  History,
  Smartphone,
  Key
} from "lucide-react"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function ProfilePage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [userInfo, setUserInfo] = useState({
    id: "",
    name: "",
    role: "",
    branch: "",
  })

  const [showPassword, setShowPassword] = useState(false)
  const [isChangingPass, setIsChangingPass] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    setUserInfo({
      id: localStorage.getItem("somikoron_auth_id") || "",
      name: localStorage.getItem("user_name") || "User",
      role: localStorage.getItem("user_role") || "Staff",
      branch: localStorage.getItem("user_branch") || "Main Branch",
    })
  }, [])

  const staffRef = useMemoFirebase(() => userInfo.id ? doc(db, "staff", userInfo.id) : null, [db, userInfo.id])
  const { data: staffData, isLoading } = useDoc(staffRef)

  const handleLogout = () => {
    localStorage.clear()
    window.location.href = "/"
  }

  const handleChangePassword = async () => {
    if (!newPassword || !staffRef) return
    setIsUpdating(true)
    try {
      await updateDoc(staffRef, {
        password: newPassword,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Password Updated", description: "Your login password has been changed successfully." })
      setIsChangingPass(false)
      setNewPassword("")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Loading profile data...</p>
      </div>
    )
  }

  const sortedSalaryHistory = [...(staffData?.salaryHistory || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => router.back()}>
          <ChevronLeft />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">My Profile</h1>
          <p className="text-muted-foreground text-sm">Manage your account information and preferences.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden rounded-3xl bg-white">
        <div className="h-32 bg-primary w-full relative">
          <div className="absolute -bottom-12 left-8">
            <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
              <AvatarFallback className="bg-secondary text-primary text-2xl font-black">
                {userInfo.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        <CardContent className="pt-16 pb-8 px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-800">{userInfo.name}</h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold uppercase text-[10px]">
                  <Shield size={12} className="mr-1" /> {userInfo.role}
                </Badge>
                <Badge variant="outline" className="border-slate-200 font-bold uppercase text-[10px]">
                  <MapPin size={12} className="mr-1" /> {userInfo.branch}
                </Badge>
              </div>
            </div>
            <Button variant="destructive" className="gap-2 rounded-xl h-11 px-6 shadow-lg shadow-destructive/20 font-bold uppercase text-xs" onClick={handleLogout}>
              <LogOut size={18} /> Logout Session
            </Button>
          </div>

          <Separator className="my-8" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest ml-1">Contact Information</p>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <div className="bg-white p-2 rounded-lg shadow-sm text-primary border border-slate-100"><Smartphone size={18} /></div>
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Login Mobile Number</p>
                    <p className="font-bold text-slate-700 tracking-tight">{staffData?.phone || "N/A"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest ml-1">Work Assignment</p>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <div className="bg-white p-2 rounded-lg shadow-sm text-primary border border-slate-100"><Building2 size={18} /></div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Assigned Location</p>
                    <p className="font-bold text-slate-700">
                      {staffData?.assignedBuildingId === 'none' ? 'Global Access (Full Branch)' : 'Restricted Property'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest ml-1">Account Security</p>
                <div className="p-4 bg-slate-900 rounded-3xl text-white space-y-3 shadow-xl">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-white/50 font-bold uppercase flex items-center gap-2"><Lock size={12}/> Current Password</p>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-white/60 hover:text-white" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff size={14}/> : <Eye size={14}/>}
                    </Button>
                  </div>
                  <p className="text-lg font-mono font-black tracking-widest">
                    {showPassword ? (staffData?.password || "N/A") : "••••••••"}
                  </p>
                  <Separator className="bg-white/10" />
                  <Dialog open={isChangingPass} onOpenChange={setIsChangingPass}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" className="w-full h-8 text-[10px] font-bold uppercase text-primary hover:bg-white/10">
                        <Edit size={12} className="mr-2"/> Change Password
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-3xl max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Update Password</DialogTitle>
                        <DialogDescription>Enter a new secure password for your account.</DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">New Password</Label>
                          <Input 
                            type="text" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
                            placeholder="Min 6 characters"
                            className="h-11 rounded-xl"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleChangePassword} disabled={isUpdating || !newPassword} className="w-full h-12 rounded-xl font-bold">
                          {isUpdating ? <Loader2 className="animate-spin" /> : "Save New Password"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 space-y-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <History className="text-primary" size={20} /> Salary Payment Records
            </h3>
            <Card className="border-none shadow-sm overflow-hidden bg-slate-50 rounded-2xl">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/50">
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold">Month</TableHead>
                      <TableHead className="font-bold">Method</TableHead>
                      <TableHead className="text-right font-bold">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSalaryHistory.map((h: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs text-muted-foreground">{new Date(h.date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-bold text-slate-700">{h.month} {h.year}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{h.method}</Badge></TableCell>
                        <TableCell className="text-right font-black text-slate-900">৳{h.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {sortedSalaryHistory.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">No salary records found yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
