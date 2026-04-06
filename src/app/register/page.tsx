
"use client"

import * as React from "react"
import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, addDoc, serverTimestamp, query, where, doc } from "firebase/firestore"
import { UserPlus, CheckCircle2, Building2, MapPin, GraduationCap, Loader2, AlertTriangle, UserCircle, ScrollText, ShieldCheck } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
const GROUPS = ["Science", "Commerce", "Arts", "Other"]
const OCCUPATIONS = [
  { id: "student", label: "Student" },
  { id: "job_holder", label: "Job Holder" }
]

export default function PublicRegisterPage({ searchParams }: { searchParams: Promise<{ branch?: string, type?: string }> }) {
  const { toast } = useToast()
  const db = useFirestore()
  const resolvedSearchParams = React.use(searchParams)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [agreedToRules, setAgreedToRules] = useState(false)

  // Get Branch and Type from URL
  const urlBranch = resolvedSearchParams.branch || ""
  const urlType = resolvedSearchParams.type || "new"

  const buildingsQuery = useMemoFirebase(() => {
    if (!urlBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", urlBranch))
  }, [db, urlBranch])
  
  const { data: buildings } = useCollection(buildingsQuery)

  const rulesRef = useMemoFirebase(() => doc(db, "configs", "hostelRules"), [db])
  const { data: rulesData } = useDoc(rulesRef)

  const [formData, setFormData] = useState({
    type: urlType,
    occupation: "student",
    name: "",
    fatherName: "",
    motherName: "",
    dob: "",
    bloodGroup: "O+",
    phone: "",
    parentPhone: "",
    district: "",
    upazila: "",
    postOffice: "",
    village: "",
    institute: "",
    group: "Science",
    buildingId: "",
    roomNumber: "",
    seatNumber: ""
  })

  // Sync type if URL changes
  useEffect(() => {
    if (urlType) setFormData(prev => ({ ...prev, type: urlType }))
  }, [urlType])

  const selectedBuilding = buildings?.find(b => b.id === formData.buildingId)
  const roomsInBuilding = useMemo(() => {
    if (!selectedBuilding) return []
    return selectedBuilding.apartmentsDetail?.flatMap((apt: any) => 
      apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))
    ) || []
  }, [selectedBuilding])

  const selectedRoom = roomsInBuilding.find((r: any) => r.roomNo === formData.roomNumber)
  const emptySeats = selectedRoom?.seats?.filter((s: any) => s.status === 'empty') || []

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>, field: 'phone' | 'parentPhone') => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 11)
    setFormData({ ...formData, [field]: val })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!urlBranch) {
      toast({ variant: "destructive", title: "Error", description: "Invalid Branch Link." })
      return
    }

    if (!agreedToRules) {
      toast({ variant: "destructive", title: "নির্দেশাবলী মেনে নিন", description: "ভর্তি সম্পন্ন করতে নিয়মাবলীতে সম্মত হওয়া বাধ্যতামূলক।" })
      return
    }

    // Strict Field Validation
    const requiredFields = [
      'name', 'fatherName', 'motherName', 'dob', 'bloodGroup', 'phone', 
      'parentPhone', 'district', 'upazila', 'postOffice', 'village', 
      'institute', 'group', 'occupation'
    ]

    for (const field of requiredFields) {
      if (!formData[field as keyof typeof formData]) {
        toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "অনুগ্রহ করে ফর্মে থাকা প্রতিটি তথ্য প্রদান করুন।" })
        return
      }
    }

    // MANDATORY check for old students
    if (formData.type === 'old') {
      if (!formData.buildingId || !formData.roomNumber || !formData.seatNumber) {
        toast({ variant: "destructive", title: "রুমের তথ্য প্রয়োজন", description: "পুরাতন স্টুডেন্টদের জন্য বর্তমান বিল্ডিং, রুম এবং সিট সিলেক্ট করা বাধ্যতামূলক।" })
        return
      }
    }

    // Phone Number Validation (Exactly 11 digits)
    if (formData.phone.length !== 11 || formData.parentPhone.length !== 11) {
      toast({ variant: "destructive", title: "ভুল মোবাইল নাম্বার", description: "ফোন নাম্বার অবশ্যই ১১ সংখ্যার হতে হবে।" })
      return
    }

    setIsSubmitting(true)
    try {
      await addDoc(collection(db, "registrations"), {
        ...formData,
        branch: urlBranch,
        status: "pending",
        createdAt: serverTimestamp(),
        buildingName: selectedBuilding?.name || "Assign Later",
        apartmentName: selectedRoom?.aptName || "Assign Later"
      })
      setIsSuccess(true)
      toast({ title: "Submitted!", description: "Your registration request is sent for review." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!urlBranch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full text-center p-8 space-y-4 border-destructive bg-destructive/5">
          <AlertTriangle size={48} className="text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Invalid Link!</h1>
          <p className="text-muted-foreground">This registration link is incomplete. Please contact the hostel manager for a valid link.</p>
        </Card>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full text-center p-8 space-y-6 rounded-3xl border-none shadow-2xl">
          <div className="inline-flex items-center justify-center p-6 rounded-full bg-success/10 text-success mb-2">
            <CheckCircle2 size={64} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-primary">Request Sent!</h1>
            <p className="text-muted-foreground">আপনার রেজিস্ট্রেশন রিকোয়েস্টটি সফলভাবে জমা হয়েছে। আমাদের এডমিন প্যানেল এটি যাচাই করে আপনার সাথে যোগাযোগ করবে। ধন্যবাদ!</p>
          </div>
          <Button onClick={() => window.location.reload()} className="w-full h-12 rounded-xl">Submit Another</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-primary tracking-tighter uppercase">SOMIKORON HOSTEL</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2">
            <MapPin size={12} className="text-primary" /> {urlBranch} Branch
          </p>
          <div className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-black uppercase mt-2">
            {formData.type === 'new' ? 'New Admission Form' : 'Existing Resident Registration'}
          </div>
        </div>

        {/* Mobile Rules Accordion */}
        <div className="lg:hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="rules" className="border-none">
              <AccordionTrigger className="bg-white px-6 rounded-2xl shadow-sm hover:no-underline py-4">
                <div className="flex items-center gap-3 text-primary">
                  <ScrollText size={20} />
                  <span className="font-bold">হোস্টেল নিয়মাবলী ও শর্তাবলী</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="bg-white mt-2 p-6 rounded-2xl shadow-sm">
                <div 
                  className="prose prose-sm max-w-none text-slate-600 font-medium leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: rulesData?.rulesText || "No rules defined by admin." }}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form Section */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <Card className="border-none shadow-xl overflow-hidden rounded-3xl">
                <div className="h-2 bg-primary w-full" />
                <CardHeader>
                  <div className="flex items-center gap-2 text-primary">
                    <UserCircle size={20} />
                    <CardTitle className="text-xl">Basic Information (ব্যক্তিগত তথ্য)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Occupation (পেশা)</Label>
                      <Select value={formData.occupation} onValueChange={val => setFormData({...formData, occupation: val})}>
                        <SelectTrigger className="border-2 border-slate-200 h-11"><SelectValue placeholder="Select occupation" /></SelectTrigger>
                        <SelectContent>
                          {OCCUPATIONS.map(occ => <SelectItem key={occ.id} value={occ.id}>{occ.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Full Name (নাম)</Label>
                      <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="আপনার পুরো নাম লিখুন" className="border-2 border-slate-200 h-11" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date of Birth (জন্ম তারিখ)</Label>
                      <Input required type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="border-2 border-slate-200 h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label>Blood Group (রক্তের গ্রুপ)</Label>
                      <Select value={formData.bloodGroup} onValueChange={val => setFormData({...formData, bloodGroup: val})}>
                        <SelectTrigger className="border-2 border-slate-200 h-11"><SelectValue placeholder="Select blood group" /></SelectTrigger>
                        <SelectContent>{BLOOD_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Father's Name (পিতার নাম)</Label>
                      <Input required value={formData.fatherName} onChange={e => setFormData({...formData, fatherName: e.target.value})} placeholder="পিতার নাম লিখুন" className="border-2 border-slate-200 h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label>Mother's Name (মাতার নাম)</Label>
                      <Input required value={formData.motherName} onChange={e => setFormData({...formData, motherName: e.target.value})} placeholder="মাতার নাম লিখুন" className="border-2 border-slate-200 h-11" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Personal Phone (নিজস্ব মোবাইল)</Label>
                      <Input required type="tel" value={formData.phone} onChange={e => handlePhoneInput(e, 'phone')} placeholder="01XXXXXXXXX (১১ ডিজিট)" className="border-2 border-slate-200 h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label>Guardian's Phone (অভিভাগকের মোবাইল)</Label>
                      <Input required type="tel" value={formData.parentPhone} onChange={e => handlePhoneInput(e, 'parentPhone')} placeholder="১১ ডিজিটের সঠিক নাম্বার দিন" className="border-2 border-slate-200 h-11" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-xl overflow-hidden rounded-3xl">
                <CardHeader>
                  <div className="flex items-center gap-2 text-primary">
                    <MapPin size={20} />
                    <CardTitle className="text-xl">Permanent Address (স্থায়ী ঠিকানা)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>District (জেলা)</Label>
                    <Input required value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} placeholder="জেলার নাম" className="border-2 border-slate-200 h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label>Upazila (উপজেলা)</Label>
                    <Input required value={formData.upazila} onChange={e => setFormData({...formData, upazila: e.target.value})} placeholder="উপজেলার নাম" className="border-2 border-slate-200 h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label>Post Office (ডাকঘর)</Label>
                    <Input required value={formData.postOffice} onChange={e => setFormData({...formData, postOffice: e.target.value})} placeholder="ডাকঘরের নাম" className="border-2 border-slate-200 h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label>Village/Area (গ্রাম/পাড়া)</Label>
                    <Input required value={formData.village} onChange={e => setFormData({...formData, village: e.target.value})} placeholder="গ্রাম বা এলাকার নাম" className="border-2 border-slate-200 h-11" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-xl overflow-hidden rounded-3xl">
                <CardHeader>
                  <div className="flex items-center gap-2 text-primary">
                    <GraduationCap size={20} />
                    <CardTitle className="text-xl">{formData.occupation === 'student' ? 'Education Info (শিক্ষা প্রতিষ্ঠান)' : 'Work Info (কর্মসংস্থান)'}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{formData.occupation === 'student' ? 'Institute Name (প্রতিষ্ঠানের নাম)' : 'Company Name (প্রতিষ্ঠানের নাম)'}</Label>
                    <Input required value={formData.institute} onChange={e => setFormData({...formData, institute: e.target.value})} placeholder="প্রতিষ্ঠানের নাম লিখুন" className="border-2 border-slate-200 h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label>{formData.occupation === 'student' ? 'Group/Department (বিভাগ)' : 'Designation (পদবী)'}</Label>
                    {formData.occupation === 'student' ? (
                      <Select value={formData.group} onValueChange={val => setFormData({...formData, group: val})}>
                        <SelectTrigger className="border-2 border-slate-200 h-11"><SelectValue placeholder="বিভাগ সিলেক্ট করুন" /></SelectTrigger>
                        <SelectContent>{GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input required value={formData.group} onChange={e => setFormData({...formData, group: e.target.value})} placeholder="আপনার পদবী লিখুন" className="border-2 border-slate-200 h-11" />
                    )}
                  </div>
                </CardContent>
              </Card>

              {formData.type === 'old' && (
                <Card className="border-none shadow-xl overflow-hidden rounded-3xl bg-primary/5 border-2 border-primary/20">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-primary">
                      <Building2 size={20} />
                      <CardTitle className="text-xl">Room Allocation (রুমের তথ্য)</CardTitle>
                    </div>
                    <CardDescription>পুরাতন স্টুডেন্টদের জন্য বর্তমান বিল্ডিং, রুম এবং সিট সিলেক্ট করা বাধ্যতামূলক।</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Building</Label>
                      <Select value={formData.buildingId} onValueChange={val => setFormData({...formData, buildingId: val, roomNumber: "", seatNumber: ""})}>
                        <SelectTrigger className="bg-white border-2 border-slate-200 h-11 shadow-sm"><SelectValue placeholder="সিলেক্ট করুন" /></SelectTrigger>
                        <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Room No.</Label>
                      <Select disabled={!formData.buildingId} value={formData.roomNumber} onValueChange={val => setFormData({...formData, roomNumber: val, seatNumber: ""})}>
                        <SelectTrigger className="bg-white border-2 border-slate-200 h-11 shadow-sm"><SelectValue placeholder="রুম নম্বর" /></SelectTrigger>
                        <SelectContent>{roomsInBuilding.map((r: any, idx: number) => <SelectItem key={`${r.aptName}-${r.roomNo}-${idx}`} value={r.roomNo}>Room {r.roomNo} ({r.aptName})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Seat</Label>
                      <Select disabled={!formData.roomNumber} value={formData.seatNumber} onValueChange={val => setFormData({...formData, seatNumber: val})}>
                        <SelectTrigger className="bg-white border-2 border-slate-200 h-11 shadow-sm"><SelectValue placeholder="সিট নম্বর" /></SelectTrigger>
                        <SelectContent>{emptySeats.map((s: any) => <SelectItem key={s.seatNo} value={s.seatNo}>Seat {s.seatNo}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Agreement Section */}
              <div className="p-6 bg-white rounded-3xl shadow-lg border-2 border-primary/10 space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id="agreed" 
                    checked={agreedToRules} 
                    onCheckedChange={(val) => setAgreedToRules(val === true)}
                    className="mt-1 h-5 w-5 rounded-md border-2 border-primary"
                  />
                  <Label htmlFor="agreed" className="text-sm font-bold text-slate-700 leading-relaxed cursor-pointer">
                    আমি উপরের সকল নিয়ম ও শর্তাবলী পড়েছি এবং মেনে চলতে সম্মত।
                  </Label>
                </div>
              </div>

              <Button type="submit" className="w-full h-16 text-2xl font-black rounded-3xl shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <UserPlus className="mr-2" size={24} />}
                Confirm Registration
              </Button>
            </form>
          </div>

          {/* Desktop Rules Sidebar */}
          <div className="hidden lg:block">
            <Card className="sticky top-8 border-none shadow-xl rounded-3xl overflow-hidden h-[calc(100vh-100px)] flex flex-col">
              <div className="h-2 bg-primary w-full" />
              <CardHeader className="bg-slate-50/50 border-b pb-4">
                <div className="flex items-center gap-2 text-primary">
                  <ScrollText size={20} />
                  <CardTitle className="text-lg">হোস্টেল নিয়মাবলী ও শর্তাবলী</CardTitle>
                </div>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">ভর্তি সম্পন্ন করার আগে অনুগ্রহ করে সব নিয়ম পড়ুন</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-primary/20">
                <div 
                  className="prose prose-sm max-w-none text-slate-600 font-medium leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: rulesData?.rulesText || "No rules defined by admin." }}
                />
              </CardContent>
              <div className="p-4 bg-primary/5 border-t">
                <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase text-center justify-center">
                  <ShieldCheck size={14} /> Somikoron Trust Security Verified
                </div>
              </div>
            </Card>
          </div>
        </div>
        
        <p className="text-center text-xs text-muted-foreground font-medium pb-8">
          By submitting this form, you certify that the information provided is correct and all fields are filled.
        </p>
      </div>
    </div>
  )
}
