
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

      {/* SCREEN VIEW RECEIPT CARD (Always visible on screen) */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 print:hidden">
        <div className="h-2 bg-primary w-full" />
        <div className="p-8 md:p-12 space-y-8">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black uppercase text-primary tracking-tighter">SOMIKORON HOSTEL</h1>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
              {payment.branch} Branch • Official Records
            </p>
            <div className="pt-4 flex flex-col items-center">
              <div className="bg-primary text-white px-8 py-2 rounded-full text-lg font-black uppercase tracking-tighter shadow-lg shadow-primary/20">
                Money Receipt
              </div>
              <div className="flex gap-12 text-[10px] font-bold text-muted-foreground mt-4 uppercase tracking-widest">
                <span>Receipt No: <b className="text-slate-800">RCPT-{receiptNo}</b></span>
                <span>Date: <b className="text-slate-800">{dateStr}</b></span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 rounded-3xl border-2 border-slate-50 bg-slate-50/30">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shadow-sm"><User size={20}/></div>
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Resident Name</p><p className="text-lg font-black text-slate-800">{payment.studentName}</p></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shadow-sm"><Smartphone size={20}/></div>
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Phone Number</p><p className="text-md font-bold text-slate-700">{student?.phone || 'N/A'}</p></div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shadow-sm"><Building2 size={20}/></div>
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Location & Room</p><p className="text-md font-bold text-slate-700">{payment.buildingName} • R-{payment.roomNumber}</p></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shadow-sm"><Calculator size={20}/></div>
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Package Type</p><Badge variant="secondary" className="text-[10px] font-black uppercase bg-white border-none">{student?.paymentSystem || 'N/A'}</Badge></div>
              </div>
            </div>
          </div>

          <div className="border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="p-4 text-left font-black text-[11px] uppercase text-slate-500">Description</th>
                  <th className="p-4 text-center font-black text-[11px] uppercase text-slate-500">Period</th>
                  <th className="p-4 text-right font-black text-[11px] uppercase text-slate-500">Method</th>
                  <th className="p-4 text-right font-black text-[11px] uppercase text-slate-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payment.seatAmount > 0 && (
                  <tr>
                    <td className="p-4 font-bold text-slate-700">Rent</td>
                    <td className="p-4 text-center text-xs text-muted-foreground">{payment.month} {payment.year}</td>
                    <td className="p-4 text-right uppercase text-[11px] font-bold text-slate-600">{payment.method}</td>
                    <td className="p-4 text-right font-black text-slate-800">৳{payment.seatAmount.toLocaleString()}</td>
                  </tr>
                )}
                {payment.foodAmount > 0 && (
                  <tr>
                    <td className="p-4 font-bold text-slate-700">Food Deposit</td>
                    <td className="p-4 text-center text-xs text-muted-foreground">{payment.month} {payment.year}</td>
                    <td className="p-4 text-right uppercase text-[11px] font-bold text-slate-600">{payment.method}</td>
                    <td className="p-4 text-right font-black text-slate-800">৳{payment.foodAmount.toLocaleString()}</td>
                  </tr>
                )}
                {payment.advanceAmount > 0 && (
                  <tr>
                    <td className="p-4 font-bold text-primary">Advance</td>
                    <td className="p-4 text-center text-xs text-muted-foreground">{payment.month} {payment.year}</td>
                    <td className="p-4 text-right uppercase text-[11px] font-bold text-primary">{payment.method}</td>
                    <td className="p-4 text-right font-black text-primary">৳{payment.advanceAmount.toLocaleString()}</td>
                  </tr>
                )}
                {payment.serviceCharge > 0 && (
                  <tr>
                    <td className="p-4 font-bold text-slate-700">Service Charge</td>
                    <td className="p-4 text-center text-xs text-muted-foreground">One-time</td>
                    <td className="p-4 text-right uppercase text-[11px] font-bold text-slate-600">{payment.method}</td>
                    <td className="p-4 text-right font-black text-slate-800">৳{payment.serviceCharge.toLocaleString()}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Collected By:</span>
                <span className="text-sm font-black text-primary">{payment.receiver}</span>
              </div>
              <Separator className="bg-primary/10 my-3" />
              <p className="text-[10px] text-slate-500 leading-tight italic">
                <b>Note:</b> {payment.description || 'Verified payment record.'}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-2">
                <span className="text-sm font-bold text-slate-500 uppercase">Total Received</span>
                <span className="text-3xl font-black text-slate-900">৳{payment.amount.toLocaleString()}</span>
              </div>
              <div className="bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-white/60 uppercase">System Status</p>
                  <p className="text-md font-bold">Payment Verified</p>
                </div>
                <CheckCircle2 className="text-success h-10 w-10" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OFFICIAL PROFESSIONAL PRINT RECEIPT (Visible ONLY when printing) */}
      <div className="print-only print-report-container">
        <div className="report-header text-center">
          <h1 className="text-2xl font-black uppercase text-primary">SOMIKORON HOSTEL</h1>
          <p className="text-sm font-bold">{payment.branch} Branch • Money Receipt</p>
          <div className="mt-4 border-y-2 border-slate-200 py-3 grid grid-cols-2 text-left text-[9pt] font-medium bg-slate-50/50">
            <div className="pl-4">
              <p><b>Receipt No:</b> RCPT-{receiptNo}</p>
              <p><b>Date:</b> {dateStr}</p>
            </div>
            <div className="text-right pr-4">
              <p><b>Status:</b> Payment Verified</p>
              <p><b>Branch:</b> {payment.branch}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 my-6 px-4">
          <div className="space-y-1">
            <p className="text-[7pt] uppercase font-bold text-muted-foreground tracking-widest">Resident Information</p>
            <p className="text-md font-black text-slate-900">{payment.studentName}</p>
            <p className="text-[9pt] font-medium text-slate-600">Phone: {student?.phone || 'N/A'}</p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-[7pt] uppercase font-bold text-muted-foreground tracking-widest">Location Allocation</p>
            <p className="text-md font-bold text-slate-800">{payment.buildingName}</p>
            <p className="text-[9pt] font-medium text-slate-600">Room: {payment.roomNumber} | Seat: {student?.seatNumber || 'N/A'}</p>
          </div>
        </div>

        <table className="w-full border-collapse border mt-4 text-[9pt]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 p-2 text-left font-black uppercase text-slate-700">Description</th>
              <th className="border border-slate-300 p-2 text-center font-black uppercase text-slate-700">Period</th>
              <th className="border border-slate-300 p-2 text-center font-black uppercase text-slate-700">Method</th>
              <th className="border border-slate-300 p-2 text-right font-black uppercase text-slate-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            {payment.seatAmount > 0 && (
              <tr>
                <td className="border border-slate-200 p-2 font-bold">Seat Rent Payment</td>
                <td className="border border-slate-200 p-2 text-center">{payment.month} {payment.year}</td>
                <td className="border border-slate-200 p-2 text-center uppercase">{payment.method}</td>
                <td className="border border-slate-200 p-2 text-right font-bold">৳{payment.seatAmount.toLocaleString()}</td>
              </tr>
            )}
            {payment.foodAmount > 0 && (
              <tr>
                <td className="border border-slate-200 p-2 font-bold">Food Deposit</td>
                <td className="border border-slate-200 p-2 text-center">{payment.month} {payment.year}</td>
                <td className="border border-slate-200 p-2 text-center uppercase">{payment.method}</td>
                <td className="border border-slate-200 p-2 text-right font-bold">৳{payment.foodAmount.toLocaleString()}</td>
              </tr>
            )}
            {payment.advanceAmount > 0 && (
              <tr>
                <td className="border border-slate-200 p-2 font-bold text-primary">Security Advance</td>
                <td className="border border-slate-200 p-2 text-center">{payment.month} {payment.year}</td>
                <td className="border border-slate-200 p-2 text-center uppercase">{payment.method}</td>
                <td className="border border-slate-200 p-2 text-right font-bold text-primary">৳{payment.advanceAmount.toLocaleString()}</td>
              </tr>
            )}
            {payment.serviceCharge > 0 && (
              <tr>
                <td className="border border-slate-200 p-2 font-bold">Admission Service Charge</td>
                <td className="border border-slate-200 p-2 text-center">One-time</td>
                <td className="border border-slate-200 p-2 text-center uppercase">{payment.method}</td>
                <td className="border border-slate-200 p-2 text-right font-bold">৳{payment.serviceCharge.toLocaleString()}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white font-black">
              <td colSpan={3} className="p-3 text-right uppercase text-[10pt]">Grand Total Received</td>
              <td className="p-3 text-right text-[11pt]">৳{payment.amount.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-6 px-4">
          <p className="text-[8pt] text-slate-500 leading-relaxed italic">
            <b>Important Note:</b> {payment.description || 'This is an official system-generated payment receipt for the mentioned hostel resident.'}
          </p>
        </div>

        <div className="print-footer mt-24 flex justify-between px-10">
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[8pt] font-black uppercase text-slate-800">Receiver: {payment.receiver}</p>
          </div>
          <div className="signature-box w-48 text-center border-t border-slate-900 pt-2">
            <p className="text-[8pt] font-black uppercase text-slate-800">Resident Signature</p>
          </div>
        </div>

        <div className="text-center mt-12 space-y-1">
          <p className="text-[8pt] font-bold text-slate-500 uppercase tracking-widest">Thank you for staying with us at Somikoron</p>
          <div className="flex justify-center gap-6 text-[7pt] text-slate-400 font-bold">
            <span>SYSTEM GENERATED</span>
            <span>•</span>
            <span>PROTECTED BY SOMIKORON SECURITY</span>
          </div>
        </div>
      </div>
    </div>
  )
}
