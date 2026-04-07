
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
      window.print()
    }
  }

  if (pLoading || sLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
  if (!payment) return <div className="text-center p-20">Payment record not found.</div>

  const receiptNo = payment.id?.substring(0, 8).toUpperCase() || "N/A"
  const dateStr = payment.date?.toDate ? payment.date.toDate().toLocaleString() : (payment.date ? new Date(payment.date).toLocaleString() : 'N/A')

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 pt-4 px-4 print:p-0 print:m-0">
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

      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 print:shadow-none print:border-none print:rounded-none">
        <div className="h-2 bg-primary w-full print:hidden" />
        <div id="receipt-print-area" className="p-8 md:p-12 space-y-8 print:p-6 print:space-y-4">
          {/* Receipt Header */}
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black uppercase text-primary tracking-tighter print:text-2xl">SOMIKORON HOSTEL</h1>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest print:text-[10px]">
              {payment.branch} Branch • Official Records
            </p>
            <div className="pt-4 flex flex-col items-center">
              <div className="bg-primary text-white px-8 py-2 rounded-full text-lg font-black uppercase tracking-tighter shadow-lg shadow-primary/20 print:shadow-none print:text-base print:py-1 print:px-6">
                Money Receipt
              </div>
              <div className="flex gap-12 text-[10px] font-bold text-muted-foreground mt-4 uppercase tracking-widest print:mt-2">
                <span>Receipt No: <b className="text-slate-800">RCPT-{receiptNo}</b></span>
                <span>Date: <b className="text-slate-800">{dateStr}</b></span>
              </div>
            </div>
          </div>

          {/* Student Info Grid - Side by side in print */}
          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-8 p-8 rounded-3xl border-2 border-slate-50 bg-slate-50/30 print:p-4 print:gap-4 print:rounded-2xl">
            <div className="space-y-4 print:space-y-2">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shadow-sm print:h-8 print:w-8"><User size={20}/></div>
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground print:text-[8px]">Resident Name</p><p className="text-lg font-black text-slate-800 print:text-sm">{payment.studentName}</p></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shadow-sm print:h-8 print:w-8"><Smartphone size={20}/></div>
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground print:text-[8px]">Phone Number</p><p className="text-md font-bold text-slate-700 print:text-xs">{student?.phone || 'N/A'}</p></div>
              </div>
            </div>
            <div className="space-y-4 print:space-y-2">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shadow-sm print:h-8 print:w-8"><Building2 size={20}/></div>
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground print:text-[8px]">Location & Room</p><p className="text-md font-bold text-slate-700 print:text-xs">{payment.buildingName} • R-{payment.roomNumber}</p></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shadow-sm print:h-8 print:w-8"><Calculator size={20}/></div>
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground print:text-[8px]">Package Type</p><Badge variant="secondary" className="text-[10px] font-black uppercase bg-white border-none print:text-[8px] print:h-5">{student?.paymentSystem || 'N/A'}</Badge></div>
              </div>
            </div>
          </div>

          {/* Payment Details Table */}
          <div className="border rounded-2xl overflow-hidden shadow-sm print:rounded-xl">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="p-4 text-left font-black text-[11px] uppercase text-slate-500 print:p-2 print:text-[9px]">Description</th>
                  <th className="p-4 text-center font-black text-[11px] uppercase text-slate-500 print:p-2 print:text-[9px]">Period</th>
                  <th className="p-4 text-right font-black text-[11px] uppercase text-slate-500 print:p-2 print:text-[9px]">Method</th>
                  <th className="p-4 text-right font-black text-[11px] uppercase text-slate-500 print:p-2 print:text-[9px]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payment.seatAmount > 0 && (
                  <tr>
                    <td className="p-4 font-bold text-slate-700 print:p-2 print:text-xs">Rent</td>
                    <td className="p-4 text-center text-xs text-muted-foreground print:p-2 print:text-[10px]">{payment.month} {payment.year}</td>
                    <td className="p-4 text-right uppercase text-[11px] font-bold text-slate-600 print:p-2 print:text-[9px]">{payment.method}</td>
                    <td className="p-4 text-right font-black text-slate-800 print:p-2 print:text-sm">৳{payment.seatAmount.toLocaleString()}</td>
                  </tr>
                )}
                {payment.foodAmount > 0 && (
                  <tr>
                    <td className="p-4 font-bold text-slate-700 print:p-2 print:text-xs">Food Deposit</td>
                    <td className="p-4 text-center text-xs text-muted-foreground print:p-2 print:text-[10px]">{payment.month} {payment.year}</td>
                    <td className="p-4 text-right uppercase text-[11px] font-bold text-slate-600 print:p-2 print:text-[9px]">{payment.method}</td>
                    <td className="p-4 text-right font-black text-slate-800 print:p-2 print:text-sm">৳{payment.foodAmount.toLocaleString()}</td>
                  </tr>
                )}
                {payment.advanceAmount > 0 && (
                  <tr>
                    <td className="p-4 font-bold text-primary print:p-2 print:text-xs">Advance</td>
                    <td className="p-4 text-center text-xs text-muted-foreground print:p-2 print:text-[10px]">{payment.month} {payment.year}</td>
                    <td className="p-4 text-right uppercase text-[11px] font-bold text-primary print:p-2 print:text-[9px]">{payment.method}</td>
                    <td className="p-4 text-right font-black text-primary print:p-2 print:text-sm">৳{payment.advanceAmount.toLocaleString()}</td>
                  </tr>
                )}
                {payment.serviceCharge > 0 && (
                  <tr>
                    <td className="p-4 font-bold text-slate-700 print:p-2 print:text-xs">Service Charge</td>
                    <td className="p-4 text-center text-xs text-muted-foreground print:p-2 print:text-[10px]">One-time</td>
                    <td className="p-4 text-right uppercase text-[11px] font-bold text-slate-600 print:p-2 print:text-[9px]">{payment.method}</td>
                    <td className="p-4 text-right font-black text-slate-800 print:p-2 print:text-sm">৳{payment.serviceCharge.toLocaleString()}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary & Signatures */}
          <div className="space-y-8 print:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start print:gap-4">
              <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 print:p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase print:text-[9px]">Collected By:</span>
                  <span className="text-sm font-black text-primary print:text-xs">{payment.receiver}</span>
                </div>
                <Separator className="bg-primary/10 my-3 print:my-1" />
                <p className="text-[10px] text-slate-500 leading-tight italic print:text-[8px]">
                  <b>Note:</b> {payment.description || 'Verified payment record.'}
                </p>
              </div>

              <div className="space-y-3 print:space-y-1">
                <div className="flex justify-between items-center px-2">
                  <span className="text-sm font-bold text-slate-500 uppercase print:text-xs">Total Received</span>
                  <span className="text-3xl font-black text-slate-900 print:text-xl">৳{payment.amount.toLocaleString()}</span>
                </div>
                <div className="bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center print:p-3 print:bg-slate-800">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-white/60 uppercase print:text-[8px]">System Status</p>
                    <p className="text-md font-bold print:text-sm">Payment Verified</p>
                  </div>
                  <CheckCircle2 className="text-success h-10 w-10 print:h-6 print:w-6" />
                </div>
              </div>
            </div>

            {/* Signature Area - Only Resident Signature as requested */}
            <div className="grid grid-cols-1 pt-12 print:pt-8">
              <div className="text-center space-y-2">
                <div className="border-t border-slate-900 pt-2 w-48 mx-auto print:w-32">
                  <p className="text-[10px] font-black uppercase print:text-[8px]">Resident Signature</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-8 text-center space-y-2 border-t border-slate-50 print:pt-4 print:space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest print:text-[8px]">Thank you for staying with us at Somikoron</p>
            <div className="flex justify-center gap-6 text-[8px] text-slate-400 font-bold print:text-[7px]">
              <span>SYSTEM GENERATED</span>
              <span>•</span>
              <span>PROTECTED BY SOMIKORON SECURITY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
