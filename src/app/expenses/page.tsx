
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
import { Receipt, Search, UserPlus, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from "@/firebase"
import { collection, serverTimestamp } from "firebase/firestore"

export default function ExpenseEntryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingParty, setIsAddingParty] = useState(false)
  
  // Data Fetching
  const buildingsQuery = useMemoFirebase(() => collection(db, "buildings"), [db])
  const { data: buildings } = useCollection(buildingsQuery)

  const partiesQuery = useMemoFirebase(() => collection(db, "expenseParties"), [db])
  const { data: parties } = useCollection(partiesQuery)

  const [formData, setFormData] = useState({
    category: "market",
    buildingId: "",
    expensePartyId: "",
    amount: "",
    description: "",
    expenseDate: new Date().toISOString().split('T')[0],
    meterNumber: ""
  })

  const [newParty, setNewParty] = useState({ name: "", role: "", phone: "" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.buildingId || !formData.amount) {
      toast({ variant: "destructive", title: "Error", description: "Please fill required fields." })
      return
    }

    setIsSubmitting(true)
    const building = buildings?.find(b => b.id === formData.buildingId)
    const party = parties?.find(p => p.id === formData.expensePartyId)

    addDocumentNonBlocking(collection(db, "expenses"), {
      ...formData,
      amount: Number(formData.amount),
      buildingName: building?.name || "General",
      expensePartyName: party?.name || "Anonymous",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    toast({ title: "Expense Logged", description: "Transaction saved to ledger." })
    setFormData(prev => ({ ...prev, amount: "", description: "", meterNumber: "" }))
    setIsSubmitting(false)
  }

  const handleAddParty = () => {
    if (!newParty.name) return
    setIsAddingParty(true)
    addDocumentNonBlocking(collection(db, "expenseParties"), {
      ...newParty,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    setNewParty({ name: "", role: "", phone: "" })
    setIsAddingParty(false)
    toast({ title: "Party Added", description: "New vendor/worker profile created." })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary">Expense Entry</h1>
        <p className="text-muted-foreground mt-1">Log all outgoing payments and operational costs.</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <Receipt size={20} />
            <CardTitle>Expense Details</CardTitle>
          </div>
          <CardDescription>Track money outflow with specific categorizations.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="category">Expense Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={val => setFormData({...formData, category: val})}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utility">Utility Bills (Elec/Water)</SelectItem>
                    <SelectItem value="market">Market / Groceries</SelectItem>
                    <SelectItem value="salary">Staff Salaries</SelectItem>
                    <SelectItem value="rent">Building Rent</SelectItem>
                    <SelectItem value="maintenance">Maintenance/Repairs</SelectItem>
                    <SelectItem value="other">Other Expenses</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="building">Building</Label>
                <Select 
                  value={formData.buildingId} 
                  onValueChange={val => setFormData({...formData, buildingId: val})}
                >
                  <SelectTrigger id="building">
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">All Buildings (General)</SelectItem>
                    {buildings?.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="party">Party / Person</Label>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs flex gap-1 items-center">
                        <UserPlus size={12} /> Add New Party
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Party</DialogTitle>
                        <DialogDescription>Create a person or entity for future expenses.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input 
                            value={newParty.name}
                            onChange={e => setNewParty({...newParty, name: e.target.value})}
                            placeholder="Electrician, Vendor, etc." 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Role / Type</Label>
                          <Input 
                            value={newParty.role}
                            onChange={e => setNewParty({...newParty, role: e.target.value})}
                            placeholder="e.g. Electrician, Market Vendor" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input 
                            value={newParty.phone}
                            onChange={e => setNewParty({...newParty, phone: e.target.value})}
                            placeholder="Phone number" 
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddParty} disabled={isAddingParty}>
                          {isAddingParty ? <Loader2 className="animate-spin" /> : "Save Party"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <Select 
                  value={formData.expensePartyId} 
                  onValueChange={val => setFormData({...formData, expensePartyId: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    {parties?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {formData.category === "utility" && (
                <div className="space-y-2">
                  <Label htmlFor="meter">Meter Number</Label>
                  <Input 
                    id="meter" 
                    placeholder="Enter meter number" 
                    value={formData.meterNumber}
                    onChange={e => setFormData({...formData, meterNumber: e.target.value})}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="date">Transaction Date</Label>
                <Input 
                  id="date" 
                  type="date" 
                  required 
                  value={formData.expenseDate}
                  onChange={e => setFormData({...formData, expenseDate: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Notes / Details</Label>
              <Textarea 
                id="description" 
                placeholder="Specify items, bill months, or repair details..." 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>

            <Button type="submit" variant="destructive" className="w-full h-12 text-lg bg-expense" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Log Expense"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
