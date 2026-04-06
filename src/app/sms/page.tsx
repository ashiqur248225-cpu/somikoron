"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Send, 
  MessageSquare, 
  History, 
  Users, 
  Settings2, 
  Loader2, 
  Search, 
  CheckCircle2, 
  Smartphone, 
  AlertCircle,
  Building2,
  Filter
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, setDoc, query, where, serverTimestamp } from "firebase/firestore"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const DEFAULT_TEMPLATES = [
  { id: "admission", label: "Admission Success", text: "প্রিয় [নাম], [Hostel Name]-এ আপনার admission সফল হয়েছে। রুম: [রুম], সিট: [সিট]। আমাদের সাথে থাকার জন্য ধন্যবাদ।" },
  { id: "payment", label: "Payment Receipt", text: "প্রিয় [নাম], আপনার পেমেন্ট সফলভাবে জমা হয়েছে। পরিমাণ: ৳[পরিমাণ] টাকা। বর্তমান বকেয়া: ৳[বকেয়া]। ধন্যবাদ। [Hostel Name]" },
  { id: "due_reminder", label: "Due Reminder", text: "প্রিয় [নাম], [মাস] মাসের ভাড়া/খাবার বাবদ আপনার ৳[বকেয়া] বকেয়া রয়েছে। অনুগ্রহ করে দ্রুত পরিশোধ করুন। [Hostel Name]" },
  { id: "low_food", label: "Low Food Balance", text: "প্রিয় [নাম], আপনার খাবার ব্যালেন্স কমে ৳[ব্যালেন্স] হয়েছে। অনুগ্রহ করে দ্রুত রিচার্জ করুন। [Hostel Name]" },
  { id: "exit", label: "Exit Message", text: "প্রিয় [নাম], [Hostel Name]-এ থাকার জন্য আপনাকে ধন্যবাদ। আপনার আগামী দিনগুলো সুন্দর হোক। শুভকামনা।" }
]

export default function SMSPanelPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Broadcast States
  const [searchTerm, setSearchTerm] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [customMessage, setCustomMessage] = useState("")

  useEffect(() => {
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
  }, [])

  // Templates Logic
  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData, isLoading: templatesLoading } = useDoc(templatesRef)
  
  // Use local state for editing templates to avoid mutating read-only document data or triggering crash on null
  const [localTemplates, setLocalTemplates] = useState<any[]>(DEFAULT_TEMPLATES)

  // Initialize local templates when Firestore data is loaded
  useEffect(() => {
    if (templatesData?.templates) {
      setLocalTemplates(templatesData.templates)
    }
  }, [templatesData])

  // Student Query
  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "students"), where("branch", "==", userBranch), where("isActive", "==", true))
  }, [db, userBranch])
  const { data: students, isLoading: studentsLoading } = useCollection(studentsQuery)

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  const { data: buildings } = useCollection(buildingsQuery)

  const filteredStudents = useMemo(() => {
    if (!students) return []
    return students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone?.includes(searchTerm)
      const matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      return matchesSearch && matchesBuilding
    })
  }, [students, searchTerm, buildingFilter])

  const handleSaveTemplates = async () => {
    setIsSubmitting(true)
    try {
      await setDoc(templatesRef, {
        templates: localTemplates,
        updatedAt: serverTimestamp(),
        updatedBy: userName
      })
      toast({ title: "Success", description: "SMS Templates updated successfully." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBroadcast = async () => {
    if (selectedStudents.length === 0 || !customMessage) {
      toast({ variant: "destructive", title: "Error", description: "Please select students and type a message." })
      return
    }

    setIsSubmitting(true)
    try {
      // Simulation of SMS Sending
      console.log(`Sending SMS to ${selectedStudents.length} recipients: ${customMessage}`)
      
      toast({ 
        title: "Broadcast Sent", 
        description: `SMS queue started for ${selectedStudents.length} students.`,
        action: <CheckCircle2 className="text-success" />
      })
      
      setSelectedStudents([])
      setCustomMessage("")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    if (selectedStudents.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id))
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">SMS Panel</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Manage notifications and broadcasts for <span className="text-foreground font-bold">{userBranch}</span>.</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="broadcast" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-6">
          <TabsTrigger value="broadcast" className="gap-2 flex-1"><Send size={14} /> Send Broadcast</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2 flex-1"><Settings2 size={14} /> Message Templates</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2 flex-1"><History size={14} /> Sending History</TabsTrigger>
        </TabsList>

        <TabsContent value="broadcast" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recipient Selector */}
            <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden bg-white rounded-3xl">
              <CardHeader className="bg-slate-50/50 border-b">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div>
                    <CardTitle className="text-lg">Recipient Selector</CardTitle>
                    <CardDescription>Select students to receive the broadcast message.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                      <SelectTrigger className="w-[150px] bg-white h-9 text-xs">
                        <Filter size={12} className="mr-2" />
                        <SelectValue placeholder="All Buildings" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Buildings</SelectItem>
                        {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={selectAll} className="h-9 font-bold text-[10px] uppercase">
                      {selectedStudents.length === filteredStudents.length && filteredStudents.length > 0 ? 'Unselect All' : 'Select All Filtered'}
                    </Button>
                  </div>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name or phone..." 
                    className="pl-8 bg-white border-none shadow-inner h-10"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Building & Room</TableHead>
                        <TableHead>Phone</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((s) => (
                        <TableRow key={s.id} className={cn("cursor-pointer", selectedStudents.includes(s.id) && "bg-primary/5")}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedStudents.includes(s.id)}
                              onCheckedChange={() => toggleStudent(s.id)}
                            />
                          </TableCell>
                          <TableCell className="font-bold text-slate-700">{s.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.buildingName} • R-{s.roomNumber}</TableCell>
                          <TableCell className="font-mono text-xs">{s.phone}</TableCell>
                        </TableRow>
                      ))}
                      {filteredStudents.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">No students found.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Message Composer */}
            <div className="space-y-6">
              <Card className="border-none shadow-lg bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-primary text-primary-foreground">
                  <CardTitle className="text-lg flex items-center gap-2"><Smartphone size={20}/> Composer</CardTitle>
                  <CardDescription className="text-primary-foreground/70">Type your custom message below.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recipients</Label>
                    <div className="p-3 bg-secondary/30 rounded-xl border border-dashed flex items-center justify-between">
                      <span className="text-sm font-black text-primary">{selectedStudents.length} Students selected</span>
                      <Users size={16} className="text-primary/40" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Message Body</Label>
                    <Textarea 
                      value={customMessage}
                      onChange={e => setCustomMessage(e.target.value)}
                      placeholder="Type something important..."
                      className="min-h-[200px] bg-slate-50 border-none shadow-inner resize-none rounded-2xl p-4 text-sm leading-relaxed"
                    />
                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground px-1">
                      <span>{customMessage.length} Characters</span>
                      <span>{Math.ceil(customMessage.length / 160)} SMS Part(s)</span>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-2">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-700 leading-tight">
                      ব্রডকাস্ট পাঠানোর আগে নিশ্চিত হয়ে নিন। একবার সেন্ড করলে এটি ফেরত আনা যাবে না।
                    </p>
                  </div>

                  <Button 
                    onClick={handleBroadcast} 
                    disabled={isSubmitting || selectedStudents.length === 0} 
                    className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                    Launch Broadcast
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle>System SMS Templates</CardTitle>
              <CardDescription>Edit automated messages triggered by system events.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {localTemplates.map((template: any, idx: number) => (
                  <div key={template.id} className="space-y-3 p-6 rounded-3xl bg-slate-50 border border-slate-100 group hover:border-primary/20 transition-all">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-black uppercase tracking-wider text-primary">{template.label}</Label>
                      <Badge variant="outline" className="text-[8px] bg-white">#{template.id}</Badge>
                    </div>
                    <Textarea 
                      value={template.text}
                      onChange={(e) => {
                        const newT = [...localTemplates]
                        newT[idx] = { ...newT[idx], text: e.target.value }
                        setLocalTemplates(newT)
                      }}
                      className="min-h-[100px] bg-white border-slate-200 text-sm leading-relaxed"
                    />
                    <div className="flex gap-2 flex-wrap">
                      {['[নাম]', '[পরিমাণ]', '[বকেয়া]', '[রুম]', '[সিট]', '[Hostel Name]'].map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[8px] cursor-pointer hover:bg-primary hover:text-white" onClick={() => {
                          const newT = [...localTemplates]
                          newT[idx] = { ...newT[idx], text: newT[idx].text + ` ${tag}` }
                          setLocalTemplates(newT)
                        }}>{tag}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex justify-end">
                <Button onClick={handleSaveTemplates} disabled={isSubmitting} className="h-12 px-10 font-bold rounded-xl gap-2">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
                  Save All Template Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden min-h-[400px] flex items-center justify-center">
            <div className="text-center space-y-4 opacity-30">
              <History size={64} className="mx-auto" />
              <div>
                <h3 className="text-lg font-bold">No History Found</h3>
                <p className="text-xs">Once you start sending SMS, logs will appear here.</p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
