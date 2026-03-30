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
import { Wallet, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function IncomeEntryPage() {
  const { toast } = useToast()
  const [studentType, setStudentType] = useState<"package" | "non-package">("package")
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    toast({
      title: "Success",
      description: "Payment record saved successfully.",
    })
  }

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
                <Select required>
                  <SelectTrigger id="building">
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="b1">Blue Heights</SelectItem>
                    <SelectItem value="b2">Serene Residency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="student">Student</Label>
                <Select 
                  required
                  onValueChange={(val) => {
                    // Logic to set student type based on selection
                    setStudentType(val === "s1" ? "package" : "non-package")
                  }}
                >
                  <SelectTrigger id="student">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="s1">John Doe (Package)</SelectItem>
                    <SelectItem value="s2">Alice Smith (Non-Package)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentType">Payment For</Label>
                <Select defaultValue="full">
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
                  <Select defaultValue="May">
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" defaultValue={2024} className="w-24" />
                </div>
              </div>

              {studentType === "package" ? (
                <div className="space-y-2">
                  <Label htmlFor="amount">Package Amount (Rent + Meals)</Label>
                  <Input id="amount" type="number" placeholder="0.00" required />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="rentAmount">Rent Amount</Label>
                    <Input id="rentAmount" type="number" placeholder="0.00" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mealAmount">Meal Amount</Label>
                    <Input id="mealAmount" type="number" placeholder="0.00" required />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="method">Payment Method</Label>
                <Select defaultValue="cash">
                  <SelectTrigger id="method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="mobile">Mobile Banking (bKash/UPI)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiver">Receiver Name</Label>
                <Input id="receiver" placeholder="Staff name" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Notes / Description</Label>
              <Textarea id="description" placeholder="Any additional notes..." />
            </div>

            <div className="bg-secondary/50 p-4 rounded-lg flex gap-3 items-start">
              <Info className="text-primary mt-0.5" size={18} />
              <div className="text-sm">
                <p className="font-semibold text-primary">System Logic Applied</p>
                <p className="text-muted-foreground">
                  Student is currently on <span className="font-bold">{studentType}</span> plan. 
                  {studentType === "package" 
                    ? " Payments are recorded as a single combined unit." 
                    : " Rent and meal amounts are tracked separately for reporting."}
                </p>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-lg">Record Payment</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}