
"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useFirestore } from "@/firebase"
import { collection, query, where, getDocs, limit, doc, getDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, Lock, Smartphone, ShieldCheck, UserCircle, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from 'next/image';
import logoIcon from '../../public/icon.png';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isPublicPage = pathname?.startsWith('/register') || pathname?.startsWith('/hostel-registration')
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({ number: "", password: "" })
  const db = useFirestore()
  const { toast } = useToast()

  useEffect(() => {
    if (isPublicPage) {
      setIsAuthenticated(true)
      return
    }

    const checkPersistence = async () => {
      // 1. Check Local Storage first for immediate access
      const auth = localStorage.getItem("somikoron_auth")
      if (auth === "true") {
        setIsAuthenticated(true)
        return
      }

      // 2. Check for security session only if not authenticated
      try {
        const secSnap = await getDoc(doc(db, "configs", "securityConfig"));
        const isEnhanced = secSnap.exists() ? secSnap.data().enhancedSecurity : false;

        if (isEnhanced) {
          const sessionActive = sessionStorage.getItem("somikoron_session_active");
          if (!sessionActive && auth !== "true") {
            setIsAuthenticated(false);
            return;
          }
        }
      } catch (e) {
        console.warn("Security config fetch failed, defaulting to local state.");
      }

      setIsAuthenticated(auth === "true")
    }

    checkPersistence()
  }, [db, isPublicPage])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.number || !formData.password) {
      toast({ variant: "destructive", title: "Error", description: "Please fill in all fields." })
      return
    }

    setIsLoading(true)
    try {
      // 1. Try Staff Login
      const staffRef = collection(db, "staff")
      const staffQ = query(staffRef, 
        where("phone", "==", formData.number), 
        where("password", "==", formData.password),
        limit(1)
      )
      const staffSnap = await getDocs(staffQ)

      if (!staffSnap.empty) {
        const userData = staffSnap.docs[0].data()
        
        // SECURITY CHECK: IF STAFF IS INACTIVE
        if (userData.isActive === false) {
          toast({ variant: "destructive", title: "Access Denied", description: "আপনার স্টাফ অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে। এডমিনের সাথে যোগাযোগ করুন।" })
          setIsLoading(false)
          return
        }

        localStorage.setItem("somikoron_auth", "true")
        localStorage.setItem("somikoron_auth_id", staffSnap.docs[0].id)
        localStorage.setItem("user_role", userData.role || "Manager")
        localStorage.setItem("user_branch", userData.branch || "Main Branch")
        localStorage.setItem("user_name", userData.name)
        localStorage.setItem("assigned_building_id", userData.assignedBuildingId || "none")
        sessionStorage.setItem("somikoron_session_active", "true");
        setIsAuthenticated(true)
        toast({ title: "Welcome to Somikoron", description: `Logged in as ${userData.role}` })
        return
      }

      // 2. Try Student Login
      const studentRef = collection(db, "students")
      const studentQ = query(studentRef,
        where("phone", "==", formData.number),
        where("password", "==", formData.password),
        limit(1)
      )
      const studentSnap = await getDocs(studentQ)

      if (!studentSnap.empty) {
        const userData = studentSnap.docs[0].data()
        
        // SECURITY CHECK: IF STUDENT IS INACTIVE (EXITED)
        if (!userData.isActive) {
          toast({ variant: "destructive", title: "Access Denied", description: "এই অ্যাকাউন্টটি বর্তমানে সচল নেই।" })
          setIsLoading(false)
          return
        }

        localStorage.setItem("somikoron_auth", "true")
        localStorage.setItem("somikoron_auth_id", studentSnap.docs[0].id)
        localStorage.setItem("user_role", "Student")
        localStorage.setItem("user_branch", userData.branch)
        localStorage.setItem("user_name", userData.name)
        sessionStorage.setItem("somikoron_session_active", "true");
        setIsAuthenticated(true)
        toast({ title: "Welcome", description: "Successfully logged into student portal." })
        router.push('/student/dashboard')
        return
      }

      toast({ variant: "destructive", title: "Unauthorized", description: "Incorrect number or password." })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Connection Error", description: "Failed to connect to security server." })
    } finally {
      setIsLoading(false)
    }
  }

  if (isPublicPage) {
    return <>{children}</>
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
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 z-[9999]">
        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in zoom-in duration-300">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center">
              <Image 
                src={logoIcon}
                width={80} 
                height={80} 
                alt="Somikoron Logo" 
                className="object-contain"
                priority
              />
            </div>
            <h2 className="text-3xl font-black tracking-tighter text-primary">SOMIKORON</h2>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Hostel ERP & Accounting</p>
          </div>
  
          <Card className="border-none shadow-2xl overflow-hidden rounded-3xl bg-white">
            <div className="h-2 bg-primary w-full" />
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold">Portal Access</CardTitle>
              <CardDescription>Login with your verified mobile number.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="number" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Mobile / Student ID</Label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="number" type="text" placeholder="01XXXXXXXXX" className="pl-10 h-12 bg-slate-50 border-none rounded-xl" value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="password" 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      className="pl-10 pr-10 h-12 bg-slate-50 border-none rounded-xl" 
                      value={formData.password} 
                      onChange={e => setFormData({ ...formData, password: e.target.value })} 
                      required 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-primary transition-all active:scale-90"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck className="mr-2" />} 
                  Verify & Access
                </Button>
              </form>
            </CardContent>
            <CardFooter className="bg-slate-50 py-4 justify-center">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <UserCircle size={10}/> Admin, Manager & Student Login supported
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
