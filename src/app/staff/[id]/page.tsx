
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, collection } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Phone, MapPin, 
  History, Loader2, 
  ChevronLeft, Calendar, Shield, Briefcase,
  Lock
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"

export default function StaffProfilePage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<any>
}) {
  const { id } = React.use(params)
  const router = useRouter()
  const db = useFirestore()
  const [userRole, setUserRole] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Staff")
  }, [])

  const staffRef = useMemoFirebase(() => id ? doc(db, "staff", id) : null, [db, id])
  const { data: staff, isLoading } = useDoc(staffRef)

  const buildingsQuery = useMemoFirebase(() => {
    return collection(db, "buildings")
  }, [db])
  const { data: buildings } = useCollection(buildingsQuery)

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
  if (!staff) return <div className="text-center p-20">Employee not found.</div>

  const sortedHistory = [...(staff.salaryHistory || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ChevronLeft />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary tracking-tight">Staff Profile</h1>
            <p className="text-muted-foreground text-sm">Detailed information and payroll history.</p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => router.push("/staff")}>Back to List</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-1 border-none shadow-xl rounded-3xl overflow-hidden bg-white">
          <div className="h-24 bg-primary w-full relative">
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
              <div className="h-20 w-20 rounded-full border-4 border-white bg-secondary flex items-center justify-center text-primary shadow-lg">
                {staff.staffType === 'management' ? <Shield size={32}/> : <Briefcase size={32}/>}
              </div>
            </div>
          </div>
          <CardContent className="pt-14 pb-8 text-center space-y-4">
            <div>
              <h2 className="text-xl font-black text-slate-800">{staff.name}</h2>
              <Badge variant="secondary" className="mt-1 bg-primary/10 text-primary border-none font-bold uppercase text-[10px]">
                {staff.role}
              </Badge>
            </div>
            
            <Separator />
            
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Phone size={16} className="text-slate-400" />
                <span className="font-medium">{staff.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <MapPin size={16} className="text-slate-400" />
                <span className="font-medium">{staff.address || "Address not set"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Calendar size={16} className="text-slate-400" />
                <span className="font-medium">Joined: {staff.createdAt?.toDate ? staff.createdAt.toDate().toLocaleDateString() : 'N/A'}</span>
              </div>

              {userRole === 'Admin' && staff.password && (
                <div className="pt-4 border-t mt-2 space-y-1">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Lock size={10} /> Access Password
                  </p>
                  <div className="p-2 bg-slate-50 rounded border border-dashed border-primary/20 text-center">
                    <span className="font-mono text-sm font-bold text-primary select-all">{staff.password}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground italic text-center">Visible only to Administrators.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="border-none shadow-md bg-white border-l-[6px] border-l-orange-500 rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Monthly Salary</p>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-800">৳{staff.monthlySalary?.toLocaleString() || 0}</div>
                <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Contracted Base Pay</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white border-l-[6px] border-l-success rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-success">Total Paid</p>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-800">
                  ৳{(staff.salaryHistory || []).reduce((acc: number, curr: any) => acc + curr.amount, 0).toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Cumulative Payroll</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardHeader className="border-b bg-slate-50/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><History size={16}/> Salary Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHistory.map((h: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">{new Date(h.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-bold text-slate-700">{h.month} {h.year}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{h.method}</Badge></TableCell>
                      <TableCell className="text-right font-black text-slate-800">৳{h.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {sortedHistory.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">No payment records found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
