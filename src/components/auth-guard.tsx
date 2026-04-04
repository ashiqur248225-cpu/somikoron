
"use client"

import { useState, useEffect } from "react"
import { useFirestore } from "@/firebase"
import { collection, query, where, getDocs, limit } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, Lock, Smartphone, ShieldCheck, ArrowRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({ number: "", password: "" })
  const db = useFirestore()
  const { toast } = useToast()

  useEffect(() => {
    const auth = localStorage.getItem("somikoron_auth")
    if (auth === "true") {
      setIsAuthenticated(true)
    } else {
      setIsAuthenticated(false)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.number || !formData.password) {
      toast({ variant: "destructive", title: "Error", description: "Please fill in all fields." })
      return
    }

    setIsLoading(true)
    try {
      const staffRef = collection(db, "staff")
      const q = query(staffRef, 
        where("phone", "==", formData.number), 
        where("password", "==", formData.password),
        limit(1)
      )
      
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data()
        
        localStorage.setItem("somikoron_auth", "true")
        localStorage.setItem("user_role", userData.role || "Manager")
        localStorage.setItem("user_branch", userData.branch || "Main Branch")
        localStorage.setItem("user_name", userData.name)
        localStorage.setItem("assigned_building_id", userData.assignedBuildingId || "none")
        
        setIsAuthenticated(true)
        toast({ title: "Welcome to Somikoron", description: `Logged in as ${userData.role}` })
      } else {
        toast({ variant: "destructive", title: "Unauthorized", description: "Incorrect number or password." })
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Connection Error", description: "Failed to connect to security server." })
    } finally {
      setIsLoading(false)
    }
  }

  if (isAuthenticated === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Verifying Security Session...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    const publicPaths = ['/register', '/hostel-registration']
    if (typeof window !== 'undefined' && publicPaths.some(path => window.location.pathname.startsWith(path))) {
      return <>{children}</>
    }

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 z-[9999]">
        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in zoom-in duration-300">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-primary/10 text-primary mb-2 shadow-inner">
              <ShieldCheck size={48} strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-primary">SOMIKORON</h1>
            <p className="text-muted-foreground text-sm font-medium tracking-wide">HOSTEL ERP & ACCOUNTING SYSTEM</p>
          </div>

          <Card className="border-none shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden rounded-2xl">
            <div className="h-2 bg-gradient-to-r from-primary/50 via-primary to-primary/50 w-full" />
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">User Login</CardTitle>
              <CardDescription>Verify your credentials to access your branch.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="number" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Mobile No.</Label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="number" type="text" placeholder="01XXXXXXXXX" className="pl-10 h-11 bg-secondary/20 border-none" value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="••••••••" className="pl-10 h-11 bg-secondary/20 border-none" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required />
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin mr-2" /> : "Verify & Access"}</Button>
              </form>

              <div className="pt-4 border-t text-center">
                <p className="text-xs text-muted-foreground mb-3">Don't have a hostel registered yet?</p>
                <Link href="/hostel-registration">
                  <Button variant="outline" className="w-full gap-2 text-xs font-bold uppercase tracking-wider h-10 border-primary/20 hover:bg-primary/5">
                    Register New Hostel <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
