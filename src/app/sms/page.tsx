
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
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
  Filter,
  Cake,
  Gift,
  RefreshCw,
  XCircle,
  Key,
  ShieldCheck,
  Globe,
  Wallet,
  Info,
  Plus,
  Trash2,
  Building,
  RotateCcw,
  Eye,
  ChevronDown,
  Clock,
  ListFilter,
  UserCheck,
  MapPin,
  BellRing,
  Mail,
  Users2,
  ArrowRight,
  Save,
  DoorOpen,
  FileClock,
  TableProperties
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, setDoc, query, where, serverTimestamp, deleteDoc, limit, orderBy, writeBatch, getDocs } from "firebase/firestore"
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
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { sendSMS, getSMSBalance } from "@/app/actions/sms"

const DEFAULT_TEMPLATES = [
  { id: "admission", label: "Admission Success", text: "প্রিয় [নাম], [Hostel Name]-এ আপনার admission সফল হয়েছে। রুম: [রুম], বিল্ডিং: [building]। আমাদের সাথে থাকার জন্য ধন্যবাদ।" },
  { id: "payment", label: "Payment Receipt", text: "প্রিয় [নাম], আপনার পেমেন্ট সফলভাবে জমা হয়েছে। পরিমাণ: ৳[paid] টাকা। বর্তমান মোট বকেয়া: ৳[total_payable]। ধন্যবাদ। [Hostel Name]" },
  { id: "due_reminder", label: "Due Reminder", text: "প্রিয় [নাম], [মাস] মাসের ভাড়া/খাবার বাবদ আপনার ৳[total_payable] বকেয়া রয়েছে। অনুগ্রহ করে দ্রুত পরিশোধ করুন। [Hostel Name]" },
  { id: "low_food", label: "Low Food Balance", text: "প্রিয় [নাম], আপনার খাবার ব্যালেন্স কমে ৳[food_balance] হয়েছে। অনুগ্রহ করে দ্রুত রিচার্জ করুন। [Hostel Name]" },
  { id: "meal_summary", label: "Monthly Meal Summary", text: "প্রিয় [নাম], [মাস] মাসে আপনি মোট [meal_count] টি meal গ্রহণ করেছেন। মোট খাবার বিল ৳[meal_bill]। আপনার বর্তমান Food Balance ৳[food_balance] এবং খাবার বাবদ বকেয়া ৳[food_due]। [Hostel Name]" },
  { id: "birthday", label: "Birthday Wishes", text: "শুভ জন্মদিন [নাম]। আপনার দিনটি সুন্দর ও আনন্দময় হোক। [Hostel Name]-এর পক্ষ থেকে অনেক শুভকামনা।" },
  { id: "exit", label: "Exit Message", text: "প্রিয় [নাম], [Hostel Name]-এ থাকার জন্য আপনাকে ধন্যবাদ। আপনার আগামী দিনগুলো সুন্দর হোক। শুভকামনা।" }
]

const SMART_TAGS = [
  '[নাম]', '[মাস]', '[meal_count]', '[meal_rate]', '[meal_bill]', 
  '[rent]', '[previous_due]', '[total_payable]', '[paid]', 
  '[food_balance]', '[food_due]', '[রুম]', '[সিট]', '[building]', '[Hostel Name]'
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function SMSPanelPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const router = useRouter()
  const [userBranch, setUserBranch] = useState("")
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [smsBalance, setSmsBalance] = useState<string | null>(null)
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false)

  // API Config States
  const [apiConfig, setApiConfig] = useState({
    apikey: "",
    senderid: ""
  })

  // Broadcast States
  const [searchTerm, setSearchTerm] = useState("")
  const [branchFilter, setBranchFilter] = useState("all")
  const [buildingFilter, setBuildingFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all") 
  const [residentActiveFilter, setResidentStatusFilter] = useState("active") 
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [customMessage, setCustomMessage] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState("manual")

  // In-App Notice State
  const [noticeTarget, setNoticeTarget] = useState("everyone")
  const [noticeTitle, setNoticeTitle] = useState("")
  const [noticeBody, setNoticeBody] = useState("")

  // Birthday States
  const [birthdayStudents, setBirthdayStudents] = useState<any[]>([])
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    const storedBranch = localStorage.getItem("user_branch") || "Main Branch"
    setUserBranch(storedBranch)
    setUserName(localStorage.getItem("user_name") || "User")
    const role = localStorage.getItem("user_role") || "Manager"
    setUserRole(role)
    
    if (role !== 'Admin') {
      setBranchFilter(storedBranch)
    }
  }, [])

  // Templates Logic
  const templatesRef = useMemoFirebase(() => doc(db, "configs", "smsTemplates"), [db])
  const { data: templatesData } = useDoc(templatesRef)
  
  const [localTemplates, setLocalTemplates] = useState<any[]>(DEFAULT_TEMPLATES)
  const [hostelNameForSms, setHostelNameForSms] = useState("")

  useEffect(() => {
    if (templatesData?.templates) setLocalTemplates(templatesData.templates)
    if (templatesData?.hostelName) setHostelNameForSms(templatesData.hostelName)
    else setHostelNameForSms(userBranch)
  }, [templatesData, userBranch])

  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: storedApiConfig } = useDoc(apiConfigRef)

  useEffect(() => {
    if (storedApiConfig) {
      setApiConfig({ apikey: storedApiConfig.apikey || "", senderid: storedApiConfig.senderid || "" })
      fetchBalance(storedApiConfig.apikey)
    }
  }, [storedApiConfig])

  const fetchBalance = async (key?: string) => {
    const k = key || apiConfig.apikey
    if (!k) return
    setIsRefreshingBalance(true)
    try {
      const result = await getSMSBalance(k)
      if (result.error === 0) setSmsBalance(result.data.balance)
    } catch (e) { console.error(e) } finally { setIsRefreshingBalance(false) }
  }

  const mealConfigRef = useMemoFirebase(() => userBranch ? doc(db, "configs", `mealRate_${userBranch}`) : null, [db, userBranch])
  const { data: mealConfig } = useDoc(mealConfigRef)

  const branchesQuery = useMemoFirebase(() => collection(db, "branches"), [db])
  const { data: branches } = useCollection(branchesQuery)

  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Admin') {
      if (branchFilter === 'all') return query(collection(db, "students"))
      return query(collection(db, "students"), where("branch", "==", branchFilter))
    }
    return query(collection(db, "students"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, branchFilter])
  const { data: students, isLoading: studentsLoading } = useCollection(studentsQuery)

  // LOGS & HISTORY
  const logsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "smsLogs"), where("branch", "==", userBranch), limit(200))
  }, [db, userBranch])
  const { data: rawSmsLogs } = useCollection(logsQuery)

  const smsLogs = useMemo(() => {
    if (!rawSmsLogs) return []
    return [...rawSmsLogs].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0
      return dateB - dateA
    })
  }, [rawSmsLogs])

  const noticeLogsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "notices"), where("branch", "==", userBranch), limit(200))
  }, [db, userBranch])
  const { data: rawNoticeLogs } = useCollection(noticeLogsQuery)

  const noticeLogs = useMemo(() => {
    if (!rawNoticeLogs) return []
    return [...rawNoticeLogs].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0
      return dateB - dateA
    })
  }, [rawNoticeLogs])

  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Admin') {
      if (branchFilter === 'all') return query(collection(db, "buildings"))
      return query(collection(db, "buildings"), where("branch", "==", branchFilter))
    }
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, branchFilter])
  const { data: buildings } = useCollection(buildingsQuery)

  const filteredStudents = useMemo(() => {
    if (!students) return []
    const today = new Date(); const todayStr = `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
    return students.filter(s => {
      const search = searchTerm.toLowerCase()
      const matchesSearch = s.name.toLowerCase().includes(search) || (s.phone || "").includes(search)
      let matchesBuilding = buildingFilter === "all" || s.buildingId === buildingFilter
      let matchesStatus = true
      if (statusFilter === 'birthday') matchesStatus = s.dob?.endsWith(todayStr)
      if (statusFilter === 'due') matchesStatus = (s.totalDue || 0) > 0
      if (statusFilter === 'low_balance') matchesStatus = (s.foodDueAmount || 0) < 50 && s.paymentSystem === 'non-package'
      let matchesResidentActive = residentActiveFilter === 'all' ? true : (residentActiveFilter === 'active' ? s.isActive === true : s.isActive === false)
      return matchesSearch && matchesBuilding && matchesStatus && matchesResidentActive
    })
  }, [students, searchTerm, buildingFilter, statusFilter, residentActiveFilter])

  const roomTargets = useMemo(() => {
    if (!students || !buildings) return []
    const targets: { label: string, value: string }[] = []
    buildings.forEach(b => {
      const buildingStudents = students.filter(s => s.buildingId === b.id && s.isActive)
      const roomsInBuilding = Array.from(new Set(
        buildingStudents.map(s => String(s.roomNumber)).filter(r => r && r !== "undefined" && r !== "null")
      )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      
      roomsInBuilding.forEach(r => {
        targets.push({
          label: `${b.name} - R-${r}`,
          value: `room_${b.id}_${r}`
        })
      })
    })
    return targets
  }, [students, buildings])

  const replaceTags = (message: string, student: any) => {
    if (!message || !student) return message;
    const now = new Date(); const mealRate = Number(mealConfig?.rate || 0); const rentDue = Number(student.totalDue || 0); const foodVal = Number(student.foodDueAmount || 0);
    const foodBalance = foodVal > 0 ? foodVal : 0; const foodDue = foodVal < 0 ? Math.abs(foodVal) : 0; const totalPayable = rentDue + foodDue;
    return message.replaceAll('[নাম]', student.name || '').replaceAll('[মাস]', MONTHS[now.getMonth()]).replaceAll('[meal_rate]', mealRate.toString()).replaceAll('[rent]', (student.monthlyRent || 0).toString()).replaceAll('[total_payable]', totalPayable.toString()).replaceAll('[food_balance]', foodBalance.toString()).replaceAll('[food_due]', foodDue.toString()).replaceAll('[রুম]', student.roomNumber || '').replaceAll('[সিট]', student.seatNumber || '').replaceAll('[building]', student.buildingName || '').replaceAll('[Hostel Name]', hostelNameForSms || userBranch).replaceAll('[meal_count]', '0').replaceAll('[meal_bill]', '0').replaceAll('[previous_due]', rentDue.toString()).replaceAll('[paid]', '0');
  };

  const handleTemplateSelect = (val: string) => {
    setSelectedTemplateId(val); if (val === 'manual') setCustomMessage("");
    else { const template = localTemplates.find(t => t.id === val); if (template) setCustomMessage(template.text); }
  };

  const handleSaveApiConfig = async () => {
    if (!apiConfig.apikey) return
    setIsSubmitting(true)
    try { await setDoc(apiConfigRef, { apikey: apiConfig.apikey.trim(), senderid: apiConfig.senderid.trim(), updatedAt: serverTimestamp() }); toast({ title: "Config Saved" }); fetchBalance(apiConfig.apikey) }
    catch (e: any) { toast({ variant: "destructive", description: e.message }) } finally { setIsSubmitting(false) }
  }

  const handleSaveTemplates = async () => {
    setIsSubmitting(true)
    try { await setDoc(templatesRef, { templates: localTemplates, hostelName: hostelNameForSms, updatedAt: serverTimestamp() }); toast({ title: "Templates Updated" }) }
    catch (e: any) { toast({ variant: "destructive", description: e.message }) } finally { setIsSubmitting(false) }
  }

  const handleBroadcast = async () => {
    if (selectedStudents.length === 0 || !customMessage || !apiConfig.apikey) return
    setIsSubmitting(true)
    try {
      const hasTags = SMART_TAGS.some(tag => customMessage.includes(tag));
      if (hasTags) {
        for (const sid of selectedStudents) {
          const s = students?.find(std => std.id === sid); if (!s) continue;
          const msg = replaceTags(customMessage, s);
          const res = await sendSMS(apiConfig.apikey, apiConfig.senderid, s.phone, msg);
          const logId = doc(collection(db, "smsLogs")).id;
          await setDoc(doc(db, "smsLogs", logId), { id: logId, to: s.phone, message: msg, status: res.error === 0 ? 'Success' : 'Failed', branch: userBranch, sentBy: userName, createdAt: serverTimestamp() });
        }
      } else {
        const phones = students?.filter(s => selectedStudents.includes(s.id)).map(s => s.phone).join(',');
        const res = await sendSMS(apiConfig.apikey, apiConfig.senderid, phones || "", customMessage);
        const logId = doc(collection(db, "smsLogs")).id;
        await setDoc(doc(db, "smsLogs", logId), { id: logId, to: phones, message: customMessage, status: res.error === 0 ? 'Success' : 'Failed', branch: userBranch, sentBy: userName, createdAt: serverTimestamp() });
      }
      toast({ title: "Broadcast Sent" }); setSelectedStudents([]); fetchBalance();
    } catch (e: any) { toast({ variant: "destructive", description: e.message }) } finally { setIsSubmitting(false) }
  }

  const handleSendInAppNotice = async () => {
    if (!noticeTitle || !noticeBody) return
    setIsSubmitting(true)
    const batch = writeBatch(db)
    try {
      if (noticeTarget === 'everyone') {
        const nId = doc(collection(db, "notices")).id
        batch.set(doc(db, "notices", nId), { id: nId, studentId: "everyone", title: noticeTitle, message: noticeBody, type: "general", isRead: false, createdAt: serverTimestamp(), branch: userBranch })
      } else if (noticeTarget.startsWith('building_')) {
        const bId = noticeTarget.replace('building_', '')
        const targetStudents = students?.filter(s => s.buildingId === bId && s.isActive) || []
        targetStudents.forEach(s => {
          const nId = doc(collection(db, "notices")).id
          batch.set(doc(db, "notices", nId), { id: nId, studentId: s.id, title: noticeTitle, message: noticeBody, type: "general", isRead: false, createdAt: serverTimestamp(), branch: userBranch })
        })
      } else if (noticeTarget.startsWith('room_')) {
        const parts = noticeTarget.split('_')
        const bId = parts[1]
        const rNo = parts[2]
        const targetStudents = students?.filter(s => s.buildingId === bId && String(s.roomNumber) === rNo && s.isActive) || []
        targetStudents.forEach(s => {
          const nId = doc(collection(db, "notices")).id
          batch.set(doc(db, "notices", nId), { id: nId, studentId: s.id, title: noticeTitle, message: noticeBody, type: "general", isRead: false, createdAt: serverTimestamp(), branch: userBranch })
        })
      } else {
        const nId = doc(collection(db, "notices")).id
        batch.set(doc(db, "notices", nId), { id: nId, studentId: noticeTarget, title: noticeTitle, message: noticeBody, type: "general", isRead: false, createdAt: serverTimestamp(), branch: userBranch })
      }
      await batch.commit()
      toast({ title: "Notices Sent Successfully" })
      setNoticeTitle(""); setNoticeBody("");
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }) } finally { setIsSubmitting(false) }
  }

  const handleScanBirthdays = () => { if (!students) return; setIsScanning(true); setTimeout(() => { const today = new Date(); const tStr = `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`; setBirthdayStudents(students.filter(s => s.dob?.endsWith(tStr))); setIsScanning(false); }, 1000); }
  
  const handleSendBirthdayWishes = async () => {
    if (birthdayStudents.length === 0 || !apiConfig.apikey) return; setIsSubmitting(true)
    try { const bTpl = localTemplates.find(t => t.id === 'birthday')?.text || ""; for (const s of birthdayStudents) { const msg = replaceTags(bTpl, s); const res = await sendSMS(apiConfig.apikey, apiConfig.senderid, s.phone, msg); const logId = doc(collection(db, "smsLogs")).id; await setDoc(doc(db, "smsLogs", logId), { id: logId, to: s.phone, message: msg, status: res.error === 0 ? 'Success' : 'Failed', branch: userBranch, sentBy: userName, createdAt: serverTimestamp() }); } toast({ title: "Wishes Sent!" }); setBirthdayStudents([]); fetchBalance(); }
    catch (e: any) { toast({ variant: "destructive", description: e.message }) } finally { setIsSubmitting(false) }
  }

  const handleDeleteHistory = async (collName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete ALL ${collName} history for this branch?`)) return
    setIsSubmitting(true)
    try {
      const q = query(collection(db, collName), where("branch", "==", userBranch))
      const snap = await getDocs(q)
      const batch = writeBatch(db)
      snap.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
      toast({ title: "History Cleared", description: `All ${collName} records have been removed.` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 pb-20 w-full overflow-hidden">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2"><SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mr-2 h-4 md:hidden" /><div><h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Notifications</h1></div></div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-xl border border-primary/10">
            <Wallet size={14} className="text-primary" />
            <div className="flex flex-col">
              <span className="text-[8px] font-bold uppercase text-muted-foreground">Balance</span>
              <span className="text-xs font-black text-primary">{smsBalance !== null ? `৳${Number(smsBalance).toFixed(2)}` : 'N/A'}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={() => fetchBalance()} disabled={isRefreshingBalance}>
              <RefreshCw size={12} className={cn(isRefreshingBalance && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="broadcast" className="w-full">
        <TabsList className="bg-secondary/50 p-1 flex overflow-x-auto h-auto scrollbar-hide">
          <TabsTrigger value="broadcast" className="gap-2 flex-1 h-10 min-w-[120px]"><Send size={14} /> SMS Broadcast</TabsTrigger>
          <TabsTrigger value="inapp" className="gap-2 flex-1 h-10 min-w-[120px]"><BellRing size={14} /> In-App Notice</TabsTrigger>
          <TabsTrigger value="notice_history" className="gap-2 flex-1 h-10 min-w-[120px]"><FileClock size={14} /> Notice History</TabsTrigger>
          <TabsTrigger value="birthdays" className="gap-2 flex-1 h-10 min-w-[120px]"><Cake size={14} /> Birthdays</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2 flex-1 h-10 min-w-[120px]"><Settings2 size={14} /> Templates</TabsTrigger>
          <TabsTrigger value="api" className="gap-2 flex-1 h-10 min-w-[120px]"><Globe size={14} /> API</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2 flex-1 h-10 min-w-[120px]"><History size={14} /> SMS History</TabsTrigger>
        </TabsList>

        <TabsContent value="broadcast" className="space-y-6">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden bg-white rounded-3xl">
                 <CardHeader className="bg-slate-50/50 border-b">
                   <div className="flex justify-between items-center"><CardTitle className="text-lg">Recipient Selector</CardTitle><Button variant="outline" size="sm" onClick={() => setSelectedStudents(selectedStudents.length === filteredStudents.length ? [] : filteredStudents.map(s => s.id))} className="text-[10px] font-bold uppercase">{selectedStudents.length === filteredStudents.length ? 'Unselect All' : 'Select All'}</Button></div>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
                     {userRole === 'Admin' && <Select value={branchFilter} onValueChange={setBranchFilter}><SelectTrigger className="bg-white h-9 text-xs"><MapPin size={12} className="mr-2 text-primary"/><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Branches</SelectItem>{branches?.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent></Select>}
                     <Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger className="bg-white h-9 text-xs"><Building2 size={12} className="mr-2"/><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Buildings</SelectItem>{buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
                     <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/><Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..." className="pl-8 h-9 border-none bg-white text-xs"/></div>
                   </div>
                 </CardHeader>
                 <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                   <Table>
                     <TableHeader className="bg-slate-50 sticky top-0"><TableRow><TableHead className="w-12"></TableHead><TableHead>Name</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                     <TableBody>
                       {filteredStudents.map(s => (
                         <TableRow key={s.id} className={cn(selectedStudents.includes(s.id) && "bg-primary/5")}>
                           <TableCell><Checkbox checked={selectedStudents.includes(s.id)} onCheckedChange={() => setSelectedStudents(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])} /></TableCell>
                           <TableCell className="font-bold text-xs">{s.name}<br/><span className="text-[10px] text-muted-foreground">{s.phone}</span></TableCell>
                           <TableCell className="text-[10px]">{s.buildingName} R-{s.roomNumber}</TableCell>
                           <TableCell className="text-right font-bold text-xs">৳{s.totalDue}</TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </CardContent>
              </Card>
              <Card className="border-none shadow-lg bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-900 text-white"><CardTitle className="text-lg">SMS Composer</CardTitle></CardHeader>
                <CardContent className="p-6 space-y-4">
                  <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50"><SelectValue placeholder="Select Template"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual Message</SelectItem>
                      {localTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)} placeholder="Type your message here..." className="min-h-[150px] rounded-2xl bg-slate-50" />
                  <div className="p-3 bg-secondary/30 rounded-xl">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Message Preview Tag Summary</p>
                    <p className="text-[10px] leading-relaxed text-slate-600">SMART tags will be auto-replaced for each student during sending.</p>
                  </div>
                  <Button onClick={handleBroadcast} disabled={isSubmitting || selectedStudents.length === 0} className="w-full h-14 rounded-2xl font-bold shadow-xl">
                    {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Send className="mr-2" size={18}/>}
                    Send to {selectedStudents.length} Students
                  </Button>
                </CardContent>
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="inapp" className="animate-in fade-in zoom-in-95 duration-300">
           <div className="max-w-2xl mx-auto space-y-6">
              <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
                <div className="h-2 bg-primary w-full" />
                <CardHeader className="p-8">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="bg-primary/10 p-3 rounded-2xl text-primary"><BellRing size={28}/></div>
                    <div><CardTitle className="text-2xl font-black">In-App Notice Center</CardTitle><CardDescription>Send direct alerts to resident portals.</CardDescription></div>
                  </div>
                </CardHeader>
                <CardContent className="px-8 pb-8 space-y-8">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Select Audience Target</Label>
                    <Select value={noticeTarget} onValueChange={setNoticeTarget}>
                      <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-lg"><Users2 className="mr-2 h-5 w-5 text-primary" /><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="everyone">📢 Send to Everyone (Broadcast)</SelectItem>
                        <Separator className="my-1"/>
                        <SelectGroup><SelectLabel className="text-[10px] uppercase font-black px-2 pt-2 opacity-40">Buildings</SelectLabel>{buildings?.map(b => <SelectItem key={b.id} value={`building_${b.id}`}>🏢 {b.name} Residents</SelectItem>)}</SelectGroup>
                        <Separator className="my-1"/>
                        <SelectGroup><SelectLabel className="text-[10px] uppercase font-black px-2 pt-2 opacity-40">Rooms</SelectLabel>{roomTargets.map(rt => <SelectItem key={rt.value} value={rt.value}>🚪 {rt.label}</SelectItem>)}</SelectGroup>
                        <Separator className="my-1"/>
                        <SelectGroup><SelectLabel className="text-[10px] uppercase font-black px-2 pt-2 opacity-40">Individual Residents</SelectLabel>{students?.filter(s => s.isActive).slice(0, 50).map(s => <SelectItem key={s.id} value={s.id}>👤 {s.name} (R-{s.roomNumber})</SelectItem>)}</SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Notice Headline</Label><Input value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} placeholder="e.g. Water Tank Cleaning" className="h-12 bg-white rounded-xl border-none shadow-sm font-bold" /></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Detailed Message</Label><Textarea value={noticeBody} onChange={e => setNoticeBody(e.target.value)} placeholder="Type the information here..." className="min-h-[150px] bg-white rounded-2xl border-none shadow-sm" /></div>
                  </div>
                </CardContent>
                <CardFooter className="p-8 bg-slate-50 border-t">
                  <Button onClick={handleSendInAppNotice} disabled={isSubmitting || !noticeTitle} className="w-full h-16 rounded-3xl text-xl font-black shadow-2xl shadow-primary/20 transition-all hover:scale-[1.01] gap-3">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Send size={24}/>} Dispatch In-App Notice
                  </Button>
                </CardFooter>
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="notice_history" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden min-h-[500px]">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2"><TableProperties className="text-primary"/> Sent Notices History</CardTitle>
              <Button variant="destructive" size="sm" className="gap-2 font-bold rounded-xl" onClick={() => handleDeleteHistory("notices")}>
                <Trash2 size={14}/> Delete All
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Target Student</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {noticeLogs.map(log => (
                    <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-[10px] font-bold text-slate-400">{log.createdAt?.toDate?.().toLocaleString() || 'N/A'}</TableCell>
                      <TableCell className="font-bold text-[10px] text-slate-600">
                        {log.studentId === 'everyone' ? <Badge className="bg-primary text-[8px]">BROADCAST</Badge> : (log.studentId || 'N/A')}
                      </TableCell>
                      <TableCell className="font-black text-xs text-slate-800">{log.title}</TableCell>
                      <TableCell className="max-w-[300px] text-[10px] text-slate-500 line-clamp-1">{log.message}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[8px] uppercase", log.isRead ? 'text-success border-success/20' : 'text-orange-400 border-orange-200')}>
                          {log.isRead ? 'Read' : 'Unread'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {noticeLogs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No notice history found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden min-h-[500px]">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-lg">SMS Delivery Logs</CardTitle>
              <Button variant="destructive" size="sm" className="gap-2 font-bold rounded-xl" onClick={() => handleDeleteHistory("smsLogs")}>
                <Trash2 size={14}/> Delete All
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50"><TableRow><TableHead>Date</TableHead><TableHead>Recipient</TableHead><TableHead>Message</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {smsLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-[10px] font-bold text-slate-400">{log.createdAt?.toDate?.().toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-[10px]">{log.to}</TableCell>
                      <TableCell className="max-w-[200px] text-[10px] line-clamp-1">{log.message}</TableCell>
                      <TableCell><Badge variant="outline" className={cn("text-[8px] uppercase", log.status === 'Success' ? 'text-success' : 'text-destructive')}>{log.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {smsLogs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">No SMS logs found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="birthdays" className="space-y-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="flex flex-row justify-between items-center"><CardTitle>Today's Birthdays</CardTitle><Button onClick={handleScanBirthdays} className="gap-2 rounded-xl"><RefreshCw size={14}/> Scan Today</Button></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  {birthdayStudents.map(s => (
                    <TableRow key={s.id}><TableCell className="font-bold">{s.name}</TableCell><TableCell className="text-xs">{s.buildingName} R-{s.roomNumber}</TableCell><TableCell className="text-right text-primary font-black">{s.dob}</TableCell></TableRow>
                  ))}
                  {birthdayStudents.length === 0 && !isScanning && <TableRow><TableCell className="text-center py-12 text-muted-foreground italic">No birthdays found today.</TableCell></TableRow>}
                </TableBody>
              </Table>
              {birthdayStudents.length > 0 && <div className="p-6 border-t"><Button onClick={handleSendBirthdayWishes} className="w-full h-12 rounded-xl bg-primary">Send Wishes</Button></div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b"><div className="flex justify-between items-center"><CardTitle>Message Templates</CardTitle><Button onClick={handleSaveTemplates} className="rounded-xl h-10"><Save size={14} className="mr-2"/> Save All</Button></div></CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">{localTemplates.map((t, i) => (<div key={t.id} className="p-4 bg-slate-50 rounded-2xl border"><Label className="text-[10px] font-black uppercase mb-1 block">{t.label}</Label><Textarea value={t.text} onChange={e => { const n = [...localTemplates]; n[i].text = e.target.value; setLocalTemplates(n); }} className="bg-white text-xs" /></div>))}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card className="max-w-md mx-auto rounded-3xl shadow-lg border-none bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white"><CardTitle>Alpha Net SMS Gateway</CardTitle></CardHeader>
            <CardContent className="p-8 space-y-4">
              <div><Label>API Key</Label><Input type="password" value={apiConfig.apikey} onChange={e => setApiConfig({...apiConfig, apikey: e.target.value})} className="h-11" /></div>
              <div><Label>Sender ID (Optional)</Label><Input value={apiConfig.senderid} onChange={e => setApiConfig({...apiConfig, senderid: e.target.value})} className="h-11" placeholder="e.g. 88017..." /></div>
              <Button onClick={handleSaveApiConfig} disabled={isSubmitting} className="w-full h-12 rounded-xl font-bold">
                {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : "Update Configuration"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
