
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
  Loader2
} from "lucide-react"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { Separator } from "@/components/ui/separator"

export default function ProfilePage() {
  const router = useRouter()
  const db = useFirestore()
  
  const [userInfo, setUserInfo] = useState({
    id: "",
    name: "",
    role: "",
    branch: "",
  })

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Loading profile data...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
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
                  <div className="bg-white p-2 rounded-lg shadow-sm text-primary border border-slate-100"><Phone size={18} /></div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Mobile Number</p>
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
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <div className="bg-white p-2 rounded-lg shadow-sm text-primary border border-slate-100"><Lock size={18} /></div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">System Password</p>
                    <p className="font-bold text-slate-700">••••••••</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest ml-1">Administrative Tenure</p>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <div className="bg-white p-2 rounded-lg shadow-sm text-primary border border-slate-100"><Calendar size={18} /></div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Registered On</p>
                    <p className="font-bold text-slate-700 tracking-tight">
                      {staffData?.createdAt?.toDate ? staffData.createdAt.toDate().toLocaleDateString('en-IN', { dateStyle: 'long' }) : 'Verified Staff'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-primary/5 rounded-2xl p-6 border border-primary/10">
        <div className="flex gap-4 items-start">
          <div className="p-2 bg-white rounded-lg shadow-sm text-primary"><Shield size={20} /></div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800">Permissions & Access</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your account has <b>{userInfo.role}</b> privileges. This allows you to manage data for the <b>{userInfo.branch}</b>. 
              {staffData?.canRequestIncome !== false && " You can submit income requests for approval."}
              {staffData?.canRequestExpense !== false && " You can log building expenses."}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
