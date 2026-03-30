
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Wallet, Info, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, doc, setDoc, increment, updateDoc, arrayUnion } from "firebase/firestore"

export default function IncomeEntryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("")
  
  const studentsQuery = useMemoFirebase(() => collection(db, "students"), [db])
  const { data: students } = useCollection(studentsQuery)

  const filteredStudents = students?.filter(s => s.buildingId === selectedBuildingId)

  const [formData, setFormData] = useState({
    studentId: "",
    paymentType: "full",
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    amount: "",
    method: "cash",
    receiver: "",
    description: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.studentId || !formData.amount || !selectedBuildingId) return

    setIsSubmitting(true)
    const student = students?.find(s => s.id === formData.studentId)
    const building = buildings?.find(b => b.id === selectedBuildingId)

    const amount = Number(formData.amount)
    const paymentId = doc(collection(db, "payments")).id
    const summaryId = `${formData.year}-${formData.month}`

    const paymentRecord = {
      amount,
      buildingId: selectedBuildingId,
      buildingName: building?.name || "Unknown",
      studentName: student?.name || "Unknown",
      type: "income",
      paymentType: formData.paymentType,
      month: formData.month,
      year: formData.year,
      method: formData.method,
      receiver: formData.receiver,
      description: formData.description,
      date: new Date().toISOString()
    }

    // 1. Save to Global Payments Collection
    const paymentRef = doc(db, "payments", paymentId)
    setDoc(paymentRef, {
      ...paymentRecord,
      date: serverTimestamp(),
      createdAt: serverTimestamp(),
    })

    // 2. Mirror to Student's paymentsHistory map field
    const studentRef = doc(db, "students", formData.studentId)
    updateDoc(studentRef, {
      paymentsHistory: arrayUnion(paymentRecord),
      updatedAt: serverTimestamp()
    })

    // 3. Update Summary
    const summaryRef = doc(db, "summaries", summaryId)
    setDoc(summaryRef, {
      totalIncome: increment(amount),
      [`buildingIncome.${building?.name || 'Unknown'}`]: increment(amount),
      updatedAt: serverTimestamp()
    }, { merge: true })

    toast({
      title: "Success",
      description: "Payment record saved to ledger and student history.",
    })
    
    setFormData(prev => ({...prev, amount: "", description: ""}))
    setIsSubmitting(false)
  }

  const selectedStudent = students?.find(s => s.id === formData.studentId)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary">Income Entry</h1>
        <p className="text-muted-foreground mt-1">Record rent and meal payments from students.</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <Wallet size={20} />
            <CardTitle>Payment Details</CardTitle>
          </div>
          <CardDescription>Enter the financial transaction details below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="building">Building</Label>
                <Select required onValueChange={setSelectedBuildingId}>
                  <SelectTrigger id="building">
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings?.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="student">Student</Label>
                <Select 
                  required
                  disabled={!selectedBuildingId}
                  onValueChange={(val) => setFormData({...formData, studentId: val})}
                >
                  <SelectTrigger id="student">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStudents?.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.paymentSystem})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentType">Payment For</Label>
                <Select defaultValue="full" onValueChange={val => setFormData({...formData, paymentType: val})}>
                  <SelectTrigger id="paymentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Payment</SelectItem>
                    <SelectItem value="partial">Partial Payment</SelectItem>
                    <SelectItem value="advance">Advance Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Month & Year</Label>
                <div className="flex gap-2">
                  <Select value={formData.month} onValueChange={val => setFormData({...formData, month: val})}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input 
                    type="number" 
                    value={formData.year} 
                    onChange={e => setFormData({...formData, year: e.target.value})}
                    className="w-24" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input 
                  id="amount" 
                  type="number" 
                  placeholder="0.00" 
                  required 
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="method">Payment Method</Label>
                <Select defaultValue="cash" onValueChange={val => setFormData({...formData, method: val})}>
                  <SelectTrigger id="method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="mobile">Mobile Banking</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiver">Receiver Name</Label>
                <Input 
                  id="receiver" 
                  placeholder="Staff name" 
                  required 
                  value={formData.receiver}
                  onChange={e => setFormData({...formData, receiver: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Notes / Description</Label>
              <Textarea 
                id="description" 
                placeholder="Any additional notes..." 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>

            {selectedStudent && (
              <div className="bg-secondary/50 p-4 rounded-lg flex gap-3 items-start">
                <Info className="text-primary mt-0.5" size={18} />
                <div className="text-sm">
                  <p className="font-semibold text-primary">Student Info</p>
                  <p className="text-muted-foreground">
                    Current plan: <span className="font-bold">{selectedStudent.paymentSystem}</span>. 
                    Standard Rent: ₹{selectedStudent.monthlyRent}
                  </p>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full h-12 text-lg" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Record Payment"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
