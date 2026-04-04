
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, UserCog, ShieldCheck, MapPin, Loader2, CheckCircle2, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore } from "@/firebase"
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore"
import Link from "next/link"

export default function HostelRegistrationPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const [formData, setFormData] = useState({
    adminName: "",
    adminPhone: "",
    adminPassword: "",
    branchName: "",
    branchAddress: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.adminName || !formData.adminPhone || !formData.adminPassword || !formData.branchName) {
      toast({ variant: "destructive", title: "Error", description: "All fields are required." })
      return
    }

    if (formData.adminPhone.length !== 11) {
      toast({ variant: "destructive", title: "Invalid Phone", description: "Mobile number must be 11 digits." })
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Create the Branch
      const branchId = doc(collection(db, "branches")).id
      await setDoc(doc(db, "branches", branchId), {
        id: branchId,
        name: formData.branchName,
        address: formData.branchAddress,
        createdAt: serverTimestamp()
      })

      // 2. Create the Admin Staff
      const staffId = doc(collection(db, "staff")).id
      await setDoc(doc(db, "staff", staffId), {
        id: staffId,
        name: formData.adminName,
        phone: formData.adminPhone,
        password: formData.adminPassword,
        role: "Admin",
        branch: formData.branchName,
        assignedBuildingId: "none",
        createdAt: serverTimestamp()
      })

      setIsSuccess(true)
      toast({ title: "Registration Successful", description: "Your hostel and admin account are ready." })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full text-center p-8 space-y-6 rounded-3xl border-none shadow-2xl">
          <div className="inline-flex items-center justify-center p-6 rounded-full bg-success/10 text-success mb-2">
            <CheckCircle2 size={64} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-primary">Setup Complete!</h1>
            <p className="text-muted-foreground">আপনার হোস্টেল এবং এডমিন অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে। এখন আপনি লগইন করতে পারবেন।</p>
          </div>
          <Link href="/">
            <Button className="w-full h-12 text-lg font-bold rounded-xl shadow-lg">Go to Login</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <ArrowLeft size={16} /> Back to Login
            </Button>
          </Link>
          <div className="text-right">
            <h1 className="text-2xl font-black text-primary tracking-tighter">SOMIKORON</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Hostel Onboarding</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-none shadow-xl overflow-hidden rounded-3xl">
            <div className="h-2 bg-primary w-full" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-primary mb-1">
                <UserCog size={20} />
                <CardTitle className="text-xl">Admin Information</CardTitle>
              </div>
              <CardDescription>আপনার পার্সোনাল এডমিন প্রোফাইল তৈরি করুন।</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name (নাম)</Label>
                <Input required value={formData.adminName} onChange={e => setFormData({...formData, adminName: e.target.value})} placeholder="Owner Name" className="bg-secondary/20 border-none h-11" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mobile Number (মোবাইল)</Label>
                  <Input required maxLength={11} value={formData.adminPhone} onChange={e => setFormData({...formData, adminPhone: e.target.value})} placeholder="01XXXXXXXXX" className="bg-secondary/20 border-none h-11" />
                </div>
                <div className="space-y-2">
                  <Label>Password (পাসওয়ার্ড)</Label>
                  <Input required type="password" value={formData.adminPassword} onChange={e => setFormData({...formData, adminPassword: e.target.value})} placeholder="••••••••" className="bg-secondary/20 border-none h-11" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl overflow-hidden rounded-3xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Building2 size={20} />
                <CardTitle className="text-xl">First Branch Details</CardTitle>
              </div>
              <CardDescription>আপনার হোস্টেলের প্রথম ব্রাঞ্চের তথ্য দিন।</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Branch Name (ব্রাঞ্চের নাম)</Label>
                <Input required value={formData.branchName} onChange={e => setFormData({...formData, branchName: e.target.value})} placeholder="e.g. Main Branch" className="bg-secondary/20 border-none h-11" />
              </div>
              <div className="space-y-2">
                <Label>Address (ঠিকানা)</Label>
                <Input required value={formData.branchAddress} onChange={e => setFormData({...formData, branchAddress: e.target.value})} placeholder="Full Address" className="bg-secondary/20 border-none h-11" />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full h-14 text-xl font-bold rounded-2xl shadow-xl transition-all hover:scale-[1.02]" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck className="mr-2" />}
            Confirm Registration & Setup
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          By registering, you agree to our terms and conditions.
        </p>
      </div>
    </div>
  )
}
