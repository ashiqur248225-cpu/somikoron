
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  BellRing, 
  MailOpen,
  Mail,
  X,
  Calendar,
  Clock
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, updateDoc, query, where } from "firebase/firestore"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function StudentNoticePage() {
  const db = useFirestore()
  const [studentId, setStudentId] = useState("")
  const [isMounted, setIsMounted] = useState(false)
  const [selectedNotice, setSelectedNotice] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    setStudentId(localStorage.getItem("somikoron_auth_id") || "")
    setIsMounted(true)
  }, [])

  const studentRef = useMemoFirebase(() => studentId ? doc(db, "students", studentId) : null, [db, studentId])
  const { data: student } = useDoc(studentRef)

  const noticesQuery = useMemoFirebase(() => {
    if (!studentId || !student?.branch) return null
    // Fetching targeted notices and global branch notices
    return query(
      collection(db, "notices"), 
      where("studentId", "in", [studentId, "everyone"]),
      where("branch", "==", student.branch)
    )
  }, [db, studentId, student?.branch])
  
  const { data: rawNotices, isLoading } = useCollection(noticesQuery)

  const notices = useMemo(() => {
    if (!rawNotices) return []
    return [...rawNotices].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0
      return dateB - dateA
    })
  }, [rawNotices])

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notices", id), { isRead: true })
    } catch (e) {
      console.error(e)
    }
  }

  const handleCardClick = (notice: any) => {
    setSelectedNotice(notice)
    setIsDialogOpen(true)
    if (!notice.isRead) {
      handleMarkAsRead(notice.id)
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
              "border-none shadow-sm rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-md active:scale-[0.99]",
              notice.isRead ? "bg-white opacity-80" : "bg-white border-l-4 border-l-primary shadow-md scale-[1.02]"
            )}
            onClick={() => handleCardClick(notice)}
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
                  {isMounted && notice.createdAt?.toDate ? new Date(notice.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                </Badge>
              </div>

              <p className="text-xs leading-relaxed text-slate-600 font-medium line-clamp-2">
                {notice.message}
              </p>

              <div className="pt-2 border-t border-slate-50 flex justify-between items-center">
                {!notice.isRead ? (
                  <span className="text-[8px] font-black text-primary uppercase animate-pulse">New Message • Click to read</span>
                ) : (
                  <span className="text-[8px] font-bold text-slate-300 uppercase">Seen</span>
                )}
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

      {/* Notice Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="h-2 bg-primary w-full" />
          <DialogHeader className="p-8 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <BellRing size={20} />
              </div>
              <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-primary/20 text-primary">
                {selectedNotice?.type || 'Official Notice'}
              </Badge>
            </div>
            <DialogTitle className="text-xl font-black text-slate-800 tracking-tight leading-tight">
              {selectedNotice?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="px-8 pb-8 space-y-6">
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-sm leading-relaxed text-slate-600 font-medium whitespace-pre-wrap">
                {selectedNotice?.message}
              </p>
            </div>
            
            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2">
              <div className="flex items-center gap-1.5">
                <Calendar size={12} className="text-primary" />
                <span>{selectedNotice?.createdAt?.toDate ? new Date(selectedNotice.createdAt.toDate()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-primary" />
                <span>{selectedNotice?.createdAt?.toDate ? new Date(selectedNotice.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button 
              className="w-full h-14 rounded-2xl font-black text-sm uppercase shadow-lg shadow-primary/10 transition-transform active:scale-95" 
              onClick={() => setIsDialogOpen(false)}
            >
              Close Notice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
