
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { UserPlus, CheckCircle2, Building2, MapPin, GraduationCap, Phone, Info, Loader2 } from "lucide-react"

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
const GROUPS = ["Science", "Commerce", "Arts", "Other"]

export default function PublicRegisterPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const [formData, setFormData] = useState({
    type: "new", // new or old
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
    seatNumber: "",
    message: ""
  })

  const selectedBuilding = buildings?.find(b => b.id === formData.buildingId)
  const roomsInBuilding = useMemo(() => {
    if (!selectedBuilding) return []
    return selectedBuilding.apartmentsDetail?.flatMap((apt: any) => 
      apt.rooms?.map((r: any) => ({ ...r, aptName: apt.name }))
    ) || []
  }, [selectedBuilding])

  const selectedRoom = roomsInBuilding.find((r: any) => r.roomNo === formData.roomNumber)
  const emptySeats = selectedRoom?.seats?.filter((s: any) => s.status === 'empty') || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.phone || !formData.parentPhone) {
      toast({ variant: "destructive", title: "Error", description: "Required fields are missing." })
      return
    }

    setIsSubmitting(true)
    try {
      await addDoc(collection(db, "registrations"), {
        ...formData,
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

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full text-center p-8 space-y-6">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-success/10 text-success mb-2">
            <CheckCircle2 size={64} />
          </div>
          <h1 className="text-3xl font-bold text-primary">Registration Sent!</h1>
          <p className="text-muted-foreground">আপনার রেজিস্ট্রেশন রিকোয়েস্টটি সফলভাবে জমা হয়েছে। আমাদের এডমিন প্যানেল এটি যাচাই করে আপনার সাথে যোগাযোগ করবে। ধন্যবাদ!</p>
          <Button onClick={() => window.location.reload()} className="w-full">Submit Another</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-primary tracking-tight">SOMIKORON HOSTEL</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Student Registration Form</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-none shadow-lg overflow-hidden rounded-2xl">
            <div className="h-2 bg-primary w-full" />
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Info size={20} />
                <CardTitle>Basic Information (ব্যক্তিগত তথ্য)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="font-bold">Student Status</Label>
                <RadioGroup 
                  value={formData.type} 
                  onValueChange={val => setFormData({...formData, type: val})}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new" id="reg-new" />
                    <Label htmlFor="reg-new" className="cursor-pointer">New Student (নতুন ছাত্র)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="old" id="reg-old" />
                    <Label htmlFor="reg-old" className="cursor-pointer">Existing Student (বর্তমান ছাত্র)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name (নাম)</Label>
                  <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="আপনার পুরো নাম লিখুন" />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth (জন্ম তারিখ)</Label>
                  <Input required type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Father's Name (পিতার নাম)</Label>
                  <Input required value={formData.fatherName} onChange={e => setFormData({...formData, fatherName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Mother's Name (মাতার নাম)</Label>
                  <Input required value={formData.motherName} onChange={e => setFormData({...formData, motherName: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Blood Group (রক্তের গ্রুপ)</Label>
                  <Select value={formData.bloodGroup} onValueChange={val => setFormData({...formData, bloodGroup: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BLOOD_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Personal Phone (নিজস্ব মোবাইল)</Label>
                  <Input required maxLength={11} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="01XXXXXXXXX" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Guardian's Phone (অভিভাবকের মোবাইল)</Label>
                <Input required maxLength={11} value={formData.parentPhone} onChange={e => setFormData({...formData, parentPhone: e.target.value})} placeholder="জরুরী যোগাযোগের জন্য" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg overflow-hidden rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <MapPin size={20} />
                <CardTitle>Permanent Address (স্থায়ী ঠিকানা)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>District (জেলা)</Label>
                <Input required value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Upazila (উপজেলা)</Label>
                <Input required value={formData.upazila} onChange={e => setFormData({...formData, upazila: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Post Office (ডাকঘর)</Label>
                <Input required value={formData.postOffice} onChange={e => setFormData({...formData, postOffice: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Village/Area (গ্রাম/পাড়া)</Label>
                <Input required value={formData.village} onChange={e => setFormData({...formData, village: e.target.value})} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg overflow-hidden rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <GraduationCap size={20} />
                <CardTitle>Education Info (শিক্ষা প্রতিষ্ঠান)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Institute Name (প্রতিষ্ঠানের নাম)</Label>
                <Input required value={formData.institute} onChange={e => setFormData({...formData, institute: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Group/Department (বিভাগ)</Label>
                <Select value={formData.group} onValueChange={val => setFormData({...formData, group: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {formData.type === 'old' && (
            <Card className="border-none shadow-lg overflow-hidden rounded-2xl bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <Building2 size={20} />
                  <CardTitle>Room Allocation (রুমের তথ্য)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Building</Label>
                  <Select value={formData.buildingId} onValueChange={val => setFormData({...formData, buildingId: val, roomNumber: "", seatNumber: ""})}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Room No.</Label>
                  <Select disabled={!formData.buildingId} value={formData.roomNumber} onValueChange={val => setFormData({...formData, roomNumber: val, seatNumber: ""})}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{roomsInBuilding.map((r: any) => <SelectItem key={r.roomNo} value={r.roomNo}>Room {r.roomNo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Seat</Label>
                  <Select disabled={!formData.roomNumber} value={formData.seatNumber} onValueChange={val => setFormData({...formData, seatNumber: val})}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{emptySeats.map((s: any) => <SelectItem key={s.seatNo} value={s.seatNo}>Seat {s.seatNo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label>Additional Message (অতিরিক্ত কিছু বলার থাকলে)</Label>
            <Textarea value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} placeholder="আপনার কোনো বিশেষ অনুরোধ থাকলে এখানে লিখুন..." />
          </div>

          <Button type="submit" className="w-full h-14 text-xl font-bold rounded-2xl shadow-xl" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <UserPlus className="mr-2" />}
            Confirm Registration (রেজিস্ট্রেশন নিশ্চিত করুন)
          </Button>
        </form>
      </div>
    </div>
  )
}
