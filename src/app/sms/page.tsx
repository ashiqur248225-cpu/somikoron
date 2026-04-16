
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
  MapPin
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, setDoc, query, where, serverTimestamp, deleteDoc, limit, orderBy, writeBatch } from "firebase/firestore"
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

  // Selection States for Logs
  const [selectedLogs, setSelectedLogs] = useState<string[]>([])

  // New Template Dialog State
  const [isNewTemplateOpen, setIsNewTemplateOpen] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ label: "", text: "" })

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
    if (templatesData?.templates) {
      setLocalTemplates(templatesData.templates)
    }
    if (templatesData?.hostelName) {
      setHostelNameForSms(templatesData.hostelName)
    } else {
      setHostelNameForSms(userBranch)
    }
  }, [templatesData, userBranch])

  // API Config Logic
  const apiConfigRef = useMemoFirebase(() => doc(db, "smsservice", "config"), [db])
  const { data: storedApiConfig } = useDoc(apiConfigRef)

  useEffect(() => {
    if (storedApiConfig) {
      setApiConfig({
        apikey: storedApiConfig.apikey || "",
        senderid: storedApiConfig.senderid || ""
      })
      fetchBalance(storedApiConfig.apikey)
    }
  }, [storedApiConfig])

  const fetchBalance = async (key?: string) => {
    const k = key || apiConfig.apikey
    if (!k) return
    setIsRefreshingBalance(true)
    try {
      const result = await getSMSBalance(k)
      if (result.error === 0) {
        setSmsBalance(result.data.balance)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsRefreshingBalance(false)
    }
  }

  // Meal Rate Config
  const mealConfigRef = useMemoFirebase(() => doc(db, "configs", "mealRate"), [db])
  const { data: mealConfig } = useDoc(mealConfigRef)

  // Branches Query
  const branchesQuery = useMemoFirebase(() => collection(db, "branches"), [db])
  const { data: branches } = useCollection(branchesQuery)

  // Student Query
  const studentsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    if (userRole === 'Admin') {
      if (branchFilter === 'all') return query(collection(db, "students"))
      return query(collection(db, "students"), where("branch", "==", branchFilter))
    }
    return query(collection(db, "students"), where("branch", "==", userBranch))
  }, [db, userBranch, userRole, branchFilter])
  const { data: students, isLoading: studentsLoading } = useCollection(studentsQuery)

  // Logs Query
  const logsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "smsLogs"), where("branch", "==", userBranch), limit(200))
  }, [db, userBranch])
  const { data: rawSmsLogs, isLoading: logsLoading } = useCollection(logsQuery)

  const smsLogs = useMemo(() => {
    if (!rawSmsLogs) return []
    return [...rawSmsLogs].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0
      return dateB - dateA
    })
  }, [rawSmsLogs])

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
    const today = new Date()
    const todayStr = `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`

    return students.filter(s => {
      const search = searchTerm.toLowerCase()
      const matchesSearch = s.name.toLowerCase().includes(search) || (s.phone || "").includes(search)
      
      let matchesBuilding = true
      if (buildingFilter !== "all") {
        matchesBuilding = s.buildingId === buildingFilter
      }
      
      let matchesStatus = true
      if (statusFilter === 'birthday') matchesStatus = s.dob?.endsWith(todayStr)
      if (statusFilter === 'due') matchesStatus = (s.totalDue || 0) > 0
      if (statusFilter === 'low_balance') matchesStatus = (s.foodDueAmount || 0) < 50 && s.paymentSystem === 'non-package'

      let matchesResidentActive = true
      if (residentActiveFilter === 'active') matchesResidentActive = s.isActive === true
      if (residentActiveFilter === 'inactive') matchesResidentActive = s.isActive === false

      return matchesSearch && matchesBuilding && matchesStatus && matchesResidentActive
    })
  }, [students, searchTerm, buildingFilter, statusFilter, residentActiveFilter])

  const replaceTags = (message: string, student: any) => {
    if (!message || !student) return message;
    
    const now = new Date();
    const mealRate = Number(mealConfig?.rate || 0);
    const rentDue = Number(student.totalDue || 0);
    const foodVal = Number(student.foodDueAmount || 0);
    
    const foodBalance = foodVal > 0 ? foodVal : 0;
    const foodDue = foodVal < 0 ? Math.abs(foodVal) : 0;
    const totalPayable = rentDue + foodDue;

    return message
      .replaceAll('[নাম]', student.name || '')
      .replaceAll('[মাস]', MONTHS[now.getMonth()])
      .replaceAll('[meal_rate]', mealRate.toString())
      .replaceAll('[rent]', (student.monthlyRent || 0).toString())
      .replaceAll('[total_payable]', totalPayable.toString())
      .replaceAll('[food_balance]', foodBalance.toString())
      .replaceAll('[food_due]', foodDue.toString())
      .replaceAll('[রুম]', student.roomNumber || '')
      .replaceAll('[সিট]', student.seatNumber || '')
      .replaceAll('[building]', student.buildingName || '')
      .replaceAll('[Hostel Name]', hostelNameForSms || userBranch)
      .replaceAll('[meal_count]', '0')
      .replaceAll('[meal_bill]', '0')
      .replaceAll('[previous_due]', rentDue.toString())
      .replaceAll('[paid]', '0');
  };

  const messagePreview = useMemo(() => {
    if (!customMessage || filteredStudents.length === 0) return "";
    const firstStudent = filteredStudents[0];
    return replaceTags(customMessage, firstStudent);
  }, [customMessage, filteredStudents, mealConfig, hostelNameForSms]);

  const handleTemplateSelect = (val: string) => {
    setSelectedTemplateId(val);
    if (val === 'manual') {
      setCustomMessage("");
    } else {
      const template = localTemplates.find(t => t.id === val);
      if (template) setCustomMessage(template.text);
    }
  };

  const handleSaveApiConfig = async () => {
    if (!apiConfig.apikey) {
      toast({ variant: "destructive", title: "Error", description: "API Key is required." })
      return
    }
    setIsSubmitting(true)
    try {
      await setDoc(apiConfigRef, {
        apikey: apiConfig.apikey.trim(),
        senderid: apiConfig.senderid.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: userName
      })
      toast({ title: "API Config Saved", description: "Alpha Net BD API settings updated." })
      fetchBalance(apiConfig.apikey)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveTemplates = async () => {
    setIsSubmitting(true)
    try {
      await setDoc(templatesRef, {
        templates: localTemplates,
        hostelName: hostelNameForSms,
        updatedAt: serverTimestamp(),
        updatedBy: userName
      })
      toast({ title: "Success", description: "SMS Templates and Hostel Name updated." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddCustomTemplate = () => {
    if (!newTemplate.label || !newTemplate.text) return
    const id = "custom_" + Math.random().toString(36).substr(2, 5)
    setLocalTemplates([...localTemplates, { ...newTemplate, id }])
    setNewTemplate({ label: "", text: "" })
    setIsNewTemplateOpen(false)
    toast({ title: "Added", description: "New custom template added to your list." })
  }

  const handleRemoveTemplate = (id: string) => {
    setLocalTemplates(localTemplates.filter(t => t.id !== id))
    toast({ title: "Removed", description: "Template removed from list." })
  }

  const logSMSToDatabase = async (to: string, msg: string, status: 'Success' | 'Failed', errorMsg?: string) => {
    try {
      const logId = doc(collection(db, "smsLogs")).id
      await setDoc(doc(db, "smsLogs", logId), {
        id: logId,
        to,
        message: msg,
        status,
        error: errorMsg || null,
        branch: userBranch,
        sentBy: userName,
        createdAt: serverTimestamp()
      })
    } catch (e) {
      console.error("Failed to log SMS", e)
    }
  }

  const handleBroadcast = async () => {
    if (selectedStudents.length === 0) {
      toast({ variant: "destructive", title: "Selection Required", description: "Please check/select the students from the list first." })
      return
    }
    if (!customMessage) {
      toast({ variant: "destructive", title: "Message Required", description: "Please type a message or select a template." })
      return
    }

    if (!apiConfig.apikey) {
      toast({ variant: "destructive", title: "API Key Missing", description: "Please configure Alpha Net API Key in settings." })
      return
    }

    setIsSubmitting(true)
    let lastError = "Unknown gateway rejection.";
    try {
      const hasTags = SMART_TAGS.some(tag => customMessage.includes(tag));
      
      let successCount = 0;
      let failureCount = 0;

      if (hasTags) {
        for (const studentId of selectedStudents) {
          const student = students?.find(s => s.id === studentId);
          if (!student) continue;
          
          const personalizedMsg = replaceTags(customMessage, student);
          const result = await sendSMS(apiConfig.apikey, apiConfig.senderid, student.phone, personalizedMsg);
          
          if (result.error === 0) {
            successCount++;
            await logSMSToDatabase(student.phone, personalizedMsg, 'Success');
          } else {
            failureCount++;
            lastError = result.msg;
            await logSMSToDatabase(student.phone, personalizedMsg, 'Failed', result.msg);
          }
        }
      } else {
        const selectedPhones = students?.filter(s => selectedStudents.includes(s.id)).map(s => s.phone) || [];
        const toNumbers = selectedPhones.join(',');
        const result = await sendSMS(apiConfig.apikey, apiConfig.senderid, toNumbers, customMessage);
        
        if (result.error === 0) {
          successCount = selectedPhones.length;
          await logSMSToDatabase(toNumbers, customMessage, 'Success');
        } else {
          failureCount = selectedPhones.length;
          lastError = result.msg;
          await logSMSToDatabase(toNumbers, customMessage, 'Failed', result.msg);
        }
      }

      if (successCount > 0) {
        toast({ 
          title: "Broadcast Complete", 
          description: `Successfully sent to ${successCount} recipients. ${failureCount > 0 ? `${failureCount} failed.` : ''}`,
          action: <CheckCircle2 className="text-success" />
        })
        setSelectedStudents([])
        fetchBalance()
        router.refresh()
      } else {
        toast({ 
          variant: "destructive", 
          title: "Broadcast Failed", 
          description: `Gateway Error: ${lastError}.` 
        })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "System Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleScanBirthdays = () => {
    if (!students) return
    setIsScanning(true)
    
    setTimeout(() => {
      const today = new Date()
      const todayStr = `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
      
      const winners = students.filter(s => {
        if (!s.dob) return false
        return s.dob.endsWith(todayStr)
      })
      
      setBirthdayStudents(winners)
      setIsScanning(false)
      
      if (winners.length > 0) {
        toast({ title: "Scan Complete", description: `Found ${winners.length} students with birthday today!` })
      } else {
        toast({ variant: "outline", title: "Scan Result", description: "No birthdays found for today." })
      }
    }, 1000)
  }

  const handleSendBirthdayWishes = async () => {
    if (birthdayStudents.length === 0) return
    if (!apiConfig.apikey) {
      toast({ variant: "destructive", title: "API Key Missing", description: "Configure API settings first." })
      return
    }
    
    setIsSubmitting(true)
    try {
      const bTemplate = localTemplates.find(t => t.id === 'birthday')?.text || ""
      
      for (const s of birthdayStudents) {
        const msg = replaceTags(bTemplate, s);
        const result = await sendSMS(apiConfig.apikey, apiConfig.senderid, s.phone, msg)
        await logSMSToDatabase(s.phone, msg, result.error === 0 ? 'Success' : 'Failed', result.error !== 0 ? result.msg : undefined)
      }

      toast({ title: "Wishes Sent!", description: `Process complete. Check logs for delivery status.` })
      setBirthdayStudents([])
      fetchBalance()
      router.refresh()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async (log: any) => {
    if (!apiConfig.apikey) return
    setIsSubmitting(true)
    try {
      const result = await sendSMS(apiConfig.apikey, apiConfig.senderid, log.to, log.message)
      if (result.error === 0) {
        toast({ title: "Resent Successfully" })
        await logSMSToDatabase(log.to, log.message, 'Success')
        router.refresh()
      } else {
        toast({ variant: "destructive", title: "Resend Failed", description: result.msg })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteLog = async (id: string) => {
    try {
      await deleteDoc(doc(db, "smsLogs", id))
      toast({ title: "Log Deleted" })
      router.refresh()
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete log" })
    }
  }

  const handleDeleteSelectedLogs = async () => {
    if (selectedLogs.length === 0) return;
    const confirm = window.confirm(`Delete ${selectedLogs.length} selected logs?`);
    if (!confirm) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      selectedLogs.forEach(id => {
        batch.delete(doc(db, "smsLogs", id));
      });
      await batch.commit();
      toast({ title: "Deleted", description: `${selectedLogs.length} logs removed.` });
      setSelectedLogs([]);
      router.refresh();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAllLogs = async () => {
    if (!smsLogs || smsLogs.length === 0) return;
    const confirm = window.confirm("Delete ALL logs in this view? This action is permanent.");
    if (!confirm) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      smsLogs.forEach(log => {
        batch.delete(doc(db, "smsLogs", log.id));
      });
      await batch.commit();
      toast({ title: "History Cleared", description: "All logs removed successfully." });
      setSelectedLogs([]);
      router.refresh();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const selectAllStudents = () => {
    if (selectedStudents.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id))
    }
  }

  const toggleLog = (id: string) => {
    setSelectedLogs(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const selectAllLogs = () => {
    if (!smsLogs) return;
    if (selectedLogs.length === smsLogs.length && smsLogs.length > 0) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(smsLogs.map(l => l.id));
    }
  };

  return (
    <div className="space-y-8 pb-20 w-full overflow-hidden">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none print:hidden">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">SMS Panel</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">Broadcast notifications for <span className="text-foreground font-bold">{userBranch}</span>.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 sm:px-4 py-2 bg-primary/5 rounded-xl border border-primary/10">
            <Wallet size={14} className="text-primary hidden xs:block" />
            <div className="flex flex-col">
              <span className="text-[8px] font-bold uppercase text-muted-foreground">Balance</span>
              <span className="text-xs font-black text-primary">
                {smsBalance !== null ? `৳${Number(smsBalance).toFixed(2)}` : 'N/A'}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={() => fetchBalance()} disabled={isRefreshingBalance}>
              <RefreshCw size={12} className={cn(isRefreshingBalance && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="broadcast" className="w-full">
        <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="bg-secondary/50 p-1 flex w-max min-w-full h-auto">
            <TabsTrigger value="broadcast" className="gap-2 flex-1 h-10 px-4 whitespace-nowrap"><Send size={14} /> Send Broadcast</TabsTrigger>
            <TabsTrigger value="birthdays" className="gap-2 flex-1 h-10 px-4 whitespace-nowrap"><Cake size={14} /> Birthday Wishes</TabsTrigger>
            <TabsTrigger value="templates" className="gap-2 flex-1 h-10 px-4 whitespace-nowrap"><Settings2 size={14} /> Message Templates</TabsTrigger>
            <TabsTrigger value="api" className="gap-2 flex-1 h-10 px-4 whitespace-nowrap"><Globe size={14} /> API Configuration</TabsTrigger>
            <TabsTrigger value="logs" className="gap-2 flex-1 h-10 px-4 whitespace-nowrap"><History size={14} /> Sending History</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="broadcast" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden bg-white rounded-3xl">
              <CardHeader className="bg-slate-50/50 border-b p-4 md:p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <CardTitle className="text-lg">Recipient Selector</CardTitle>
                      <CardDescription>Filter and select residents for broadcast.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={selectAllStudents} className="font-bold text-[10px] uppercase h-9 border-primary/30 text-primary">
                      {selectedStudents.length === filteredStudents.length && filteredStudents.length > 0 ? 'Unselect All' : 'Select All Filtered'}
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {userRole === 'Admin' && (
                      <Select value={branchFilter} onValueChange={setBranchFilter}>
                        <SelectTrigger className="bg-white h-9 text-xs">
                          <MapPin size={12} className="mr-2 text-primary" />
                          <SelectValue placeholder="All Branches" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Branches</SelectItem>
                          {branches?.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}

                    <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                      <SelectTrigger className="bg-white h-9 text-xs">
                        <Building2 size={12} className="mr-2" />
                        <SelectValue placeholder="All Buildings" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Buildings</SelectItem>
                        {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    
                    <Select value={residentActiveFilter} onValueChange={setResidentStatusFilter}>
                      <SelectTrigger className="bg-white h-9 text-xs">
                        <UserCheck size={12} className="mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active Residents</SelectItem>
                        <SelectItem value="inactive">Inactive (Left)</SelectItem>
                        <SelectItem value="all">Both Status</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="bg-white h-9 text-xs">
                        <Filter size={12} className="mr-2" />
                        <SelectValue placeholder="Quick Filters" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any Account Status</SelectItem>
                        <SelectItem value="birthday">Today's Birthday</SelectItem>
                        <SelectItem value="due">Total Due &gt; 0</SelectItem>
                        <SelectItem value="low_balance">Low Food Bal (&lt; 50)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search by name or phone..." 
                      className="pl-10 h-10 border-none bg-white shadow-inner"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="hidden md:block overflow-x-auto">
                  <Table className="min-w-[600px]">
                    <TableHeader className="bg-white sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Building & Room</TableHead>
                        <TableHead>Balance Status</TableHead>
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
                          <TableCell className="font-bold text-slate-700">
                            <div className="flex items-center gap-2">
                              {s.name}
                              {!s.isActive && <Badge variant="destructive" className="text-[7px] h-3 px-1 uppercase">Left</Badge>}
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground">{s.phone}</div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {s.buildingName} • R-{s.roomNumber}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className={cn("text-[8px] font-black uppercase", (s.totalDue || 0) > 0 ? "text-destructive border-destructive/20" : "text-success border-success/20")}>
                                Rent: ৳{s.totalDue || 0}
                              </Badge>
                              {s.paymentSystem === 'non-package' && (
                                <Badge variant="outline" className={cn("text-[8px] font-black uppercase", (s.foodDueAmount || 0) < 50 ? "text-orange-600 border-orange-200" : "text-primary border-primary/20")}>
                                  Food: ৳{s.foodDueAmount || 0}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden p-4 space-y-3">
                  {filteredStudents.map((s) => (
                    <Card key={s.id} className={cn("border shadow-none rounded-2xl overflow-hidden bg-white", selectedStudents.includes(s.id) && "border-primary ring-1 ring-primary/20")}>
                      <CardContent className="p-4 flex items-start gap-4">
                        <Checkbox 
                          checked={selectedStudents.includes(s.id)}
                          onCheckedChange={() => toggleStudent(s.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm">{s.name}</h4>
                              <p className="text-[10px] font-mono text-muted-foreground">{s.phone}</p>
                            </div>
                            {!s.isActive && <Badge variant="destructive" className="text-[7px] px-1 uppercase">Left</Badge>}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                            <Building2 size={10} /> {s.buildingName} • Room {s.roomNumber}
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Badge variant="outline" className={cn("text-[8px] font-black uppercase", (s.totalDue || 0) > 0 ? "text-destructive" : "text-success")}>
                              Rent: ৳{s.totalDue || 0}
                            </Badge>
                            {s.paymentSystem === 'non-package' && (
                              <Badge variant="outline" className={cn("text-[8px] font-black uppercase", (s.foodDueAmount || 0) < 50 ? "text-orange-600" : "text-primary")}>
                                Food: ৳{s.foodDueAmount || 0}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredStudents.length === 0 && (
                  <div className="text-center py-20 text-muted-foreground italic">No students match current filters.</div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-none shadow-lg bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-900 text-white p-4 md:p-6">
                  <CardTitle className="text-lg flex items-center gap-2"><Smartphone size={20}/> SMS Composer</CardTitle>
                  <CardDescription className="text-slate-400">Personalized broadcast setup.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Select Template</Label>
                    <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                      <SelectTrigger className="bg-slate-50 border-none h-11 rounded-xl shadow-inner font-bold">
                        <SelectValue placeholder="Manual Message" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Write Manual Message</SelectItem>
                        {localTemplates.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Message Body</Label>
                      <span className={cn("text-[10px] font-black", selectedStudents.length > 0 ? "text-primary" : "text-destructive")}>
                        {selectedStudents.length} Students selected
                      </span>
                    </div>
                    <Textarea 
                      value={customMessage}
                      onChange={e => setCustomMessage(e.target.value)}
                      placeholder="Type your message here... Use tags like [নাম] for personalization."
                      className="min-h-[150px] bg-slate-50 border-none shadow-inner resize-none rounded-2xl p-4 text-sm"
                    />
                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground px-1">
                      <span>{customMessage.length} Characters</span>
                      <span>{Math.ceil(customMessage.length / 160)} SMS Part(s)</span>
                    </div>
                  </div>

                  {messagePreview && (
                    <div className="p-4 bg-primary/5 rounded-2xl border border-dashed border-primary/20 space-y-2">
                      <span className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1"><Eye size={10}/> Sample Preview</span>
                      <p className="text-xs leading-relaxed text-slate-600 font-medium italic">
                        "{messagePreview}"
                      </p>
                    </div>
                  )}

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-2">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[9px] text-amber-700 leading-tight">
                      ব্রডকাস্ট পাঠানোর আগে নিশ্চিত হয়ে নিন। একবার সেন্ড করলে এটি গেটওয়ে থেকে ফেরত আনা যাবে না।
                    </p>
                  </div>

                  <Button 
                    onClick={handleBroadcast} 
                    disabled={isSubmitting || selectedStudents.length === 0} 
                    className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                    Launch to {selectedStudents.length} Students
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="birthdays" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden bg-white rounded-3xl">
              <CardHeader className="bg-primary/5 border-b p-4 md:p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Cake className="text-primary" size={20} /> Birthday Scanner
                  </CardTitle>
                  <CardDescription>Find students celebrating birthday today.</CardDescription>
                </div>
                <Button 
                  onClick={handleScanBirthdays} 
                  disabled={isScanning || studentsLoading} 
                  className="gap-2 font-bold h-11 px-6 rounded-xl w-full sm:w-auto"
                >
                  {isScanning ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
                  Scan for Today
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="hidden md:block overflow-x-auto">
                  <Table className="min-w-[500px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-right">Birth Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {birthdayStudents.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-bold flex items-center gap-2">
                            <Gift className="h-4 w-4 text-primary" /> {s.name}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.buildingName} • R-{s.roomNumber}</TableCell>
                          <TableCell className="text-xs">{s.phone}</TableCell>
                          <TableCell className="text-right font-bold text-primary">{s.dob || 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden p-4 space-y-3">
                  {birthdayStudents.map((s) => (
                    <Card key={s.id} className="border shadow-none rounded-2xl bg-white">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <div className="bg-primary/10 p-2 rounded-lg text-primary"><Gift size={16}/></div>
                            <h4 className="font-bold text-sm">{s.name}</h4>
                          </div>
                          <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-bold">Today</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-bold uppercase">
                          <div className="flex items-center gap-1"><Building2 size={10}/> {s.buildingName} • R-{s.roomNumber}</div>
                          <div className="flex items-center gap-1 justify-end"><Smartphone size={10}/> {s.phone}</div>
                        </div>
                        <div className="pt-2 border-t flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400">BIRTH DATE</span>
                          <span className="text-xs font-black text-primary">{s.dob || 'N/A'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {birthdayStudents.length === 0 && !isScanning && (
                  <div className="text-center py-24 text-muted-foreground italic">No birthdays found for today.</div>
                )}
                {isScanning && (
                  <div className="text-center py-24">
                    <Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" />
                    <p className="text-xs mt-2 font-bold animate-pulse">Scanning records...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-white rounded-3xl overflow-hidden">
              <CardHeader className="bg-primary text-white p-4 md:p-6">
                <CardTitle className="text-lg">Send Wishes</CardTitle>
                <CardDescription className="text-primary-foreground/70">Automated wishes for today.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-6">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Birthday Template</Label>
                  <p className="text-xs leading-relaxed text-slate-600 font-medium italic">
                    "{localTemplates.find(t => t.id === 'birthday')?.text}"
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Target Recipients</Label>
                    <span className="text-xl font-black text-primary">{birthdayStudents.length}</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: birthdayStudents.length > 0 ? '100%' : '0%' }} />
                  </div>
                </div>

                <Button 
                  onClick={handleSendBirthdayWishes} 
                  disabled={isSubmitting || birthdayStudents.length === 0} 
                  className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <Gift size={20} />}
                  Send Birthday Wishes
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardHeader className="border-b bg-slate-50/50 p-4 md:p-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2"><Settings2 className="text-primary"/> Templates Setup</CardTitle>
                <CardDescription>Customize automated messages and brand name.</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Dialog open={isNewTemplateOpen} onOpenChange={setIsNewTemplateOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 h-10 rounded-xl font-bold border-primary/30 text-primary">
                      <Plus size={16}/> New Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md w-[95vw] rounded-3xl">
                    <DialogHeader>
                      <DialogTitle>New Custom Template</DialogTitle>
                      <DialogDescription>Define a reusable message.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Label</Label>
                        <Input 
                          placeholder="e.g. Festival Wish" 
                          value={newTemplate.label}
                          onChange={e => setNewTemplate({...newTemplate, label: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Content</Label>
                        <Textarea 
                          placeholder="Your message..." 
                          className="min-h-[120px]"
                          value={newTemplate.text}
                          onChange={e => setNewTemplate({...newTemplate, text: e.target.value})}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button className="w-full h-12 text-lg font-bold" onClick={handleAddCustomTemplate}>Add Template</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button onClick={handleSaveTemplates} disabled={isSubmitting} className="h-10 px-6 font-bold rounded-xl gap-2 shadow-lg shadow-primary/20">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
                  Save All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-8">
              <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold uppercase text-[10px] tracking-widest">
                  <Building size={14} /> Hostel Brand Name
                </div>
                <div className="flex flex-col md:flex-row gap-6 items-end">
                  <div className="space-y-2 flex-1 w-full">
                    <Label className="text-xs font-bold text-slate-600">Replaces [Hostel Name] tag</Label>
                    <Input 
                      value={hostelNameForSms}
                      onChange={e => setHostelNameForSms(e.target.value)}
                      placeholder="Official Name"
                      className="bg-white h-12 text-lg font-bold border-primary/20"
                    />
                  </div>
                  <div className="p-3 bg-white/50 rounded-xl border border-dashed border-primary/20 flex-1 w-full">
                    <p className="text-[10px] text-slate-500 italic">
                      <b>Example:</b> "Welcome to {hostelNameForSms || 'Your Hostel'}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Available Intelligent Tags</Label>
                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  {SMART_TAGS.map(tag => (
                    <Badge key={tag} variant="secondary" className="px-3 py-1 cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors text-xs font-bold font-mono">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground italic ml-1">* Use these tags inside templates to auto-fill resident specific data.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {localTemplates.map((template: any, idx: number) => (
                  <div key={template.id} className="relative space-y-3 p-5 rounded-3xl bg-slate-50 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-black uppercase text-primary">{template.label}</Label>
                      <div className="flex items-center gap-2">
                        {template.id.startsWith('custom_') && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveTemplate(template.id)}>
                            <Trash2 size={12}/>
                          </Button>
                        )}
                      </div>
                    </div>
                    <Textarea 
                      value={template.text}
                      onChange={(e) => {
                        const newT = [...localTemplates]
                        newT[idx] = { ...newT[idx], text: e.target.value }
                        setLocalTemplates(newT)
                      }}
                      className="min-h-[100px] bg-white border-slate-200 text-xs leading-relaxed rounded-xl shadow-inner"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card className="max-w-2xl mx-auto border-none shadow-lg bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-4 md:p-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-xl"><Key size={24} className="text-white" /></div>
                <div>
                  <CardTitle className="text-xl">Gateway Settings</CardTitle>
                  <CardDescription className="text-slate-400">Alpha Net BD API credentials.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-muted-foreground ml-1">API Key</Label>
                  <Input 
                    type="password"
                    placeholder="Your API Key" 
                    className="h-12 bg-slate-50 border-none shadow-inner"
                    value={apiConfig.apikey}
                    onChange={e => setApiConfig({...apiConfig, apikey: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-muted-foreground ml-1">Sender ID (Optional)</Label>
                  <Input 
                    placeholder="e.g. 8801XXXX" 
                    className="h-12 bg-slate-50 border-none shadow-inner"
                    value={apiConfig.senderid}
                    onChange={e => setApiConfig({...apiConfig, senderid: e.target.value})}
                  />
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-2">
                <h4 className="font-bold text-xs text-primary flex items-center gap-2">
                  <ShieldCheck size={14} /> System Logic
                </h4>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  সিস্টেম কনফার্মেশন বা পেমেন্ট রিসিভ করার সময় এই apikey ব্যবহার করে স্বয়ংক্রিয়ভাবে মেসেজ পাঠাবে।
                </p>
              </div>

              <Button 
                onClick={handleSaveApiConfig} 
                disabled={isSubmitting} 
                className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                Save API Credentials
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden min-h-[500px]">
            <CardHeader className="border-b bg-slate-50/50 p-4 md:p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <CardTitle className="text-lg">Sending History</CardTitle>
                <CardDescription>Recent messages sent from branch.</CardDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                {selectedLogs.length > 0 && (
                  <Button variant="destructive" size="sm" className="h-9 px-4 rounded-xl gap-2 font-bold animate-in zoom-in-95" onClick={handleDeleteSelectedLogs} disabled={isSubmitting}>
                    <Trash2 size={14}/> Delete Selected ({selectedLogs.length})
                  </Button>
                )}
                {smsLogs && smsLogs.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl gap-2 font-bold text-destructive hover:bg-destructive/10" onClick={handleDeleteAllLogs} disabled={isSubmitting}>
                    <XCircle size={14}/> Clear All History
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {logsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <Loader2 className="animate-spin text-primary" />
                  <p className="text-xs font-bold text-muted-foreground">Loading history...</p>
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <Table className="min-w-[700px]">
                      <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox 
                              checked={smsLogs && selectedLogs.length === smsLogs.length && smsLogs.length > 0}
                              onCheckedChange={selectAllLogs}
                            />
                          </TableHead>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {smsLogs?.map((log) => (
                          <TableRow key={log.id} className={cn(selectedLogs.includes(log.id) && "bg-primary/5")}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedLogs.includes(log.id)}
                                onCheckedChange={() => toggleLog(log.id)}
                              />
                            </TableCell>
                            <TableCell className="text-[10px] font-medium text-slate-500 whitespace-nowrap">
                              {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'N/A'}
                            </TableCell>
                            <TableCell className="font-mono text-[10px] font-bold text-slate-700">{log.to}</TableCell>
                            <TableCell className="max-w-[200px]"><p className="text-[10px] line-clamp-2">{log.message}</p></TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn(
                                "text-[8px] uppercase font-bold",
                                log.status === 'Success' ? "bg-success/5 text-success border-success/20" : "bg-destructive/5 text-destructive border-destructive/20"
                              )}>
                                {log.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-1 whitespace-nowrap">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleResend(log)} disabled={isSubmitting}>
                                <RotateCcw size={12} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteLog(log.id)} disabled={isSubmitting}>
                                <Trash2 size={12} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="md:hidden p-4 space-y-3">
                    {smsLogs?.map((log) => (
                      <Card key={log.id} className={cn("border shadow-none rounded-2xl overflow-hidden bg-white", selectedLogs.includes(log.id) && "border-primary ring-1 ring-primary/20")}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={selectedLogs.includes(log.id)}
                                onCheckedChange={() => toggleLog(log.id)}
                              />
                              <span className="text-[10px] font-medium text-slate-400">
                                {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'N/A'}
                              </span>
                            </div>
                            <Badge variant="outline" className={cn(
                              "text-[8px] uppercase font-bold",
                              log.status === 'Success' ? "text-success border-success/30 bg-success/5" : "text-destructive border-destructive/30 bg-destructive/5"
                            )}>
                              {log.status}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-700">RECIPIENT: {log.to}</p>
                            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed italic">"{log.message}"</p>
                          </div>
                          <div className="pt-2 border-t flex justify-end gap-2">
                            <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-bold gap-1" onClick={() => handleResend(log)} disabled={isSubmitting}>
                              <RotateCcw size={12}/> Resend
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-destructive text-[10px] font-bold" onClick={() => handleDeleteLog(log.id)} disabled={isSubmitting}>
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
              {(!smsLogs || smsLogs.length === 0) && !logsLoading && (
                <div className="text-center py-24 text-muted-foreground italic">No logs found.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
