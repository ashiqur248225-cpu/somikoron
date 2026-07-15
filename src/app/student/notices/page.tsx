
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  BellRing, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Info, 
  AlertCircle,
  MailOpen,
  Mail
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, deleteDoc, updateDoc, query, where, orderBy, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function StudentNoticePage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [studentId, setStudentId] = useState("")

  useEffect(() => {
    setStudentId(localStorage.getItem("somikoron_auth_id") || "")
  }, [])

  const noticesQuery = useMemoFirebase(() => {
    if (!studentId) return null
    return query(
      collection(db, "notices"), 
      where("studentId", "in", [studentId, "everyone"]),
      orderBy("createdAt", "desc")
    )
  }, [db, studentId])
  
  const { data: notices, isLoading } = useCollection(noticesQuery)

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notices", id), { isRead: true })
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notices", id))
      toast({ title: "Notice Deleted" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete." })
    }
  }

  if (isLoading) return <div className="flex justify-center p-20 animate-pulse text-sm font-bold text-muted-foreground uppercase">Syncing Notices...</div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex justify-between items-end mb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-800">Notice Center</h1>
          <p className="text-muted-foreground text-sm font-medium">Important updates and alerts.</p>
        </div>
        <div className="bg-primary/10 h-10 w-10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
           <BellRing size={20} />
        </div>
      </header>

      <div className="space-y-4">
        {notices?.map((notice) => (
          <Card 
            key={notice.id} 
            className={cn(
              "border-none shadow-sm rounded-3xl overflow-hidden transition-all duration-300",
              notice.isRead ? "bg-white opacity-80" : "bg-white border-l-4 border-l-primary shadow-md scale-[1.02]"
            )}
            onClick={() => !notice.isRead && handleMarkAsRead(notice.id)}
          >
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className={cn("p-2 rounded-xl", notice.isRead ? "bg-slate-50 text-slate-400" : "bg-primary/10 text-primary")}>
                    {notice.isRead ? <MailOpen size={16}/> : <Mail size={16}/>}
                  </div>
                  <h3 className={cn("font-black text-sm uppercase tracking-tight", notice.isRead ? "text-slate-500" : "text-slate-800")}>
                    {notice.title}
                  </h3>
                </div>
                <Badge variant="ghost" className="text-[8px] font-bold text-slate-400 uppercase">
                  {notice.createdAt?.toDate ? new Date(notice.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                </Badge>
              </div>

              <p className="text-xs leading-relaxed text-slate-600 font-medium">
                {notice.message}
              </p>

              <div className="pt-2 border-t border-slate-50 flex justify-between items-center">
                {!notice.isRead ? (
                  <span className="text-[8px] font-black text-primary uppercase animate-pulse">New Message</span>
                ) : (
                  <span className="text-[8px] font-bold text-slate-300 uppercase">Seen</span>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-destructive/40 hover:text-destructive hover:bg-destructive/5 rounded-xl"
                  onClick={(e) => { e.stopPropagation(); handleDelete(notice.id); }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!notices || notices.length === 0) && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4 opacity-30">
             <BellRing size={64} strokeWidth={1} />
             <p className="text-sm font-bold uppercase tracking-widest">Your inbox is empty</p>
          </div>
        )}
      </div>
    </div>
  )
}
