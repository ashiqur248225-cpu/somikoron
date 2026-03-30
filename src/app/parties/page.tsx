"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Contact, Search, Plus, Phone, Tool } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

const partiesData = [
  { id: "P001", name: "Electric Supply Co", role: "Utility Provider", phone: "N/A" },
  { id: "P002", name: "Green Grocers", role: "Market Vendor", phone: "555-0101" },
  { id: "P003", name: "Maria", role: "Cook / Staff", phone: "555-0102" },
  { id: "P004", name: "Super Power Electric", role: "Electrician", phone: "555-0103" },
  { id: "P005", name: "City Municipal", role: "Water Utility", phone: "N/A" },
]

export default function PartiesPage() {
  const { toast } = useToast()

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Expense Party Master</h1>
          <p className="text-muted-foreground mt-1">Maintain a directory of vendors, workers, and utility providers.</p>
        </div>
        <Button className="flex gap-2">
          <Plus size={18} /> Add New Party
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search parties by name or role..." className="pl-8" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Party Name</TableHead>
                <TableHead>Role / Category</TableHead>
                <TableHead>Contact info</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partiesData.map((party) => (
                <TableRow key={party.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-full text-primary">
                        <Contact size={20} />
                      </div>
                      <span className="font-semibold">{party.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal capitalize">
                      {party.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Phone size={14} className="text-muted-foreground" />
                      {party.phone}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Transactions</Button>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}