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
import { Receipt, Search, UserPlus } from "lucide-react"
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

export default function ExpenseEntryPage() {
  const { toast } = useToast()
  const [category, setCategory] = useState<string>("market")
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    toast({
      title: "Expense Logged",
      description: "Transaction has been saved to the ledger.",
    })
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
                <Select value={category} onValueChange={setCategory} required>
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
                <Select required>
                  <SelectTrigger id="building">
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Buildings (General)</SelectItem>
                    <SelectItem value="b1">Blue Heights</SelectItem>
                    <SelectItem value="b2">Serene Residency</SelectItem>
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
                          <Input placeholder="Electrician Name, Vendor Name, etc." />
                        </div>
                        <div className="space-y-2">
                          <Label>Role / Type</Label>
                          <Input placeholder="e.g. Electrician, Market Vendor" />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input placeholder="Phone number" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={() => toast({ title: "Party Added", description: "New party created successfully." })}>
                          Save Party
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search party..." className="pl-8" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" type="number" placeholder="0.00" required />
              </div>

              {category === "utility" && (
                <div className="space-y-2">
                  <Label htmlFor="meter">Meter Number</Label>
                  <Input id="meter" placeholder="Enter meter number for tracking" />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="date">Transaction Date</Label>
                <Input id="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Notes / Details</Label>
              <Textarea id="description" placeholder="Specify items, bill months, or repair details..." />
            </div>

            <Button type="submit" variant="destructive" className="w-full h-12 text-lg bg-expense">Log Expense</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}