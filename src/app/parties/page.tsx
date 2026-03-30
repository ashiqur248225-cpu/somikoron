
"use client"

import { useState } from "react"
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
import { Contact, Search, Plus, Phone, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"

export default function PartiesPage() {
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  
  const partiesQuery = useMemoFirebase(() => collection(db, "expenseParties"), [db])
  const { data: parties, isLoading } = useCollection(partiesQuery)

  const filteredParties = parties?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.role?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
            <Input 
              placeholder="Search parties..." 
              className="pl-8" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : (
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
                {filteredParties?.map((party) => (
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
                        {party.phone || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">History</Button>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredParties?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No parties found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
