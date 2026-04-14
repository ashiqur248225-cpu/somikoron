
"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Printer, ChevronLeft, User, Building2, Calculator, Smartphone, CheckCircle2, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export default function ReceiptPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const db = useFirestore()

  const paymentRef = useMemoFirebase(() => id ? doc(db, "payments", id) : null, [db, id])
  const { data: payment, isLoading: pLoading } = useDoc(paymentRef)

  const studentRef = useMemoFirebase(() => payment?.studentId ? doc(db, "students", payment.studentId) : null, [db, payment?.studentId])
  const { data: student, isLoading: sLoading } = useDoc(studentRef)

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      setTimeout(() => {
        window.print()
      }, 500);
    }
  }

  if (pLoading || sLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
  if (!payment) return <div className="text-center p-20">Payment record not found.</div>

  const receiptNo = payment.id?.substring(0, 8).toUpperCase() || "N/A"
  const dateStr = payment.date?.toDate ? payment.date.toDate().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (payment.date ? new Date(payment.date).toLocaleString() : 'N/A')

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 pt-4 px-4 print:p-0 print:m-0">
      {/* Screen Controls */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" className="gap-2 hover:bg-primary/5 text-muted-foreground" onClick={() => router.back()}>
          <ChevronLeft size={16} /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 font-bold border-primary/20 text-primary" onClick={handlePrint}>
            <Printer size={16} /> Print Receipt
          </Button>
        </div>
      </div>

      {/* SCREEN VIEW RECEIPT CARD */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 print:hidden">
        <div className="h-2 bg-primary w-full" />
        <div className="p-8 md:p-12 space-y-8">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black uppercase text-primary tracking-tighter">সমীকরণ ছাত্রাবাস</h1>
            <p className="text-xs font-bold text-slate-600">মানি রিসিট (Money Receipt)</p>
          </div>
          {/* ... Receipt Content ... */}
          <div className="p-6 bg-slate-50 rounded-3xl border space-y-4">
            <div className="flex justify-between items-center"><span className="text-xs font-bold">Resident:</span><span className="font-black">{payment.studentName}</span></div>
            <div className="flex justify-between items-center"><span className="text-xs font-bold">Amount:</span><span className="text-2xl font-black">৳{payment.amount.toLocaleString()}</span></div>
          </div>
        </div>
      </div>

      {/* OFFICIAL PROFESSIONAL PRINT RECEIPT */}
      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">সমীকরণ ছাত্রাবাস</h1>
          <p className="text-sm font-bold">{payment.branch} ব্রাঞ্চ • মানি রিসিট (Money Receipt)</p>
          <div className="mt-4 border-y-2 border-slate-200 py-3 grid grid-cols-2 text-left text-[9pt] font-medium bg-slate-50/50">
            <div className="pl-4">
              <p><b>Receipt No:</b> RCPT-{receiptNo}</p>
              <p><b>Date:</b> {dateStr}</p>
            </div>
            <div className="text-right pr-4">
              <p><b>Status:</b> Payment Verified</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 my-6 px-4">
          <div className="space-y-1">
            <p className="text-[7pt] uppercase font-bold text-muted-foreground tracking-widest">Resident Information</p>
            <p className="text-md font-black text-slate-900">{payment.studentName}</p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-[7pt] uppercase font-bold text-muted-foreground tracking-widest">Location Allocation</p>
            <p className="text-md font-bold text-slate-800">{payment.buildingName}</p>
            <p className="text-[9pt] font-medium text-slate-600">Room: {payment.roomNumber}</p>
          </div>
        </div>

        <table className="w-full border-collapse border mt-4 text-[9pt]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 p-2 text-left font-black uppercase text-slate-700">Description</th>
              <th className="border border-slate-300 p-2 text-center font-black uppercase text-slate-700">Period</th>
              <th className="border border-slate-300 p-2 text-right font-black uppercase text-slate-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-200 p-2 font-bold">Total Payment Received</td>
              <td className="border border-slate-200 p-2 text-center">{payment.month} {payment.year}</td>
              <td className="border border-slate-200 p-2 text-right font-bold">৳{payment.amount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div className="print-footer mt-24 flex justify-between px-10">
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[8pt] font-black uppercase">Receiver: {payment.receiver}</p>
          </div>
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[8pt] font-black uppercase">Resident Signature</p>
          </div>
        </div>
      </div>
    </div>
  )
}
