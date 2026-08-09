"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Printer, ChevronLeft, User, Building2, Calculator, Smartphone, CheckCircle2, Loader2, X, Wallet, History, Info, Zap, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export default function ReceiptPage(props: { params: React.Promise<{ id: string }> }) {
  const { id } = React.use(props.params)
  const router = useRouter()
  const db = useFirestore()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const paymentRef = useMemoFirebase(() => id ? doc(db, "payments", id) : null, [db, id])
  const { data: payment, isLoading: pLoading } = useDoc(paymentRef)

  const studentRef = useMemoFirebase(() => payment?.studentId ? doc(db, "students", payment.studentId) : null, [db, payment?.studentId])
  const { data: student, isLoading: sLoading } = useDoc(studentRef)

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      setTimeout(() => { window.print(); }, 500);
    }
  }

  if (pLoading || sLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
  if (!payment) return <div className="text-center p-20">Payment record not found.</div>

  const receiptNo = payment.id?.substring(0, 8).toUpperCase() || "N/A"
  const dateStr = isMounted ? (payment.date?.toDate ? payment.date.toDate().toLocaleString() : (payment.date ? new Date(payment.date).toLocaleString() : 'N/A')) : 'Loading date...'

  // Resulting statuses for display
  const currentFoodVal = Number(student?.foodDueAmount || 0);
  const currentCookVal = Number(student?.cookingDueAmount || 0);
  const totalRentDue = Object.values(student?.duesBreakdown || {}).reduce((a: any, b: any) => a + Number(b.amount || 0), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 pt-4 px-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" className="gap-2 text-muted-foreground" onClick={() => router.back()}>
          <ChevronLeft size={16} /> Back to History
        </Button>
        <Button variant="outline" className="gap-2 font-bold border-primary/20 text-primary" onClick={handlePrint}>
          <Printer size={16} /> Print Receipt
        </Button>
      </div>

      {/* OFFICIAL A4 RECEIPT LAYOUT */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 print:shadow-none print:border-none print:p-0">
        <div className="h-2 bg-primary w-full print:hidden" />
        
        <div className="print-only print-report-container">
          <div className="report-header">
            <h1>সমীকরণ ছাত্রাবাস</h1>
            <p className="branch-title">{payment.branch} Branch • Money Receipt</p>
            <div className="flex justify-center mt-4">
              <div className="bg-slate-900 text-white px-8 py-1 rounded-full text-[10pt] font-black uppercase tracking-tighter">
                Payment Receipt
              </div>
            </div>
            <div className="flex justify-between items-end mt-6 px-4 text-[8pt] font-black text-slate-500 uppercase">
              <span>Receipt No: RCPT-{receiptNo}</span>
              <span>Date: {dateStr}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 p-6 rounded-3xl border-2 border-slate-100 bg-slate-50/30 my-6 mx-2">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[7pt] uppercase font-bold text-slate-400">Resident Name</p>
                <p className="text-sm font-black text-slate-800">{payment.studentName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[7pt] uppercase font-bold text-slate-400">Phone Number</p>
                <p className="text-sm font-bold text-slate-700">{student?.phone || 'N/A'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[7pt] uppercase font-bold text-slate-400">Location & Room</p>
                <p className="text-sm font-bold text-slate-700">{payment.buildingName} • R-{payment.roomNumber}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[7pt] uppercase font-bold text-slate-400">Package Type</p>
                <p className="text-xs font-black uppercase text-primary">{student?.paymentSystem || 'N/A'}</p>
              </div>
            </div>
          </div>

          <table className="mx-2">
            <thead>
              <tr>
                <th>Description</th>
                <th>Details / Balance</th>
                <th>Method</th>
                <th className="text-right">Paid Amount</th>
              </tr>
            </thead>
            <tbody>
              {payment.seatAmount > 0 && (
                <tr>
                  <td className="font-bold">Rent & Arrears</td>
                  <td>{payment.month} {payment.year}</td>
                  <td className="uppercase">{payment.method}</td>
                  <td className="text-right font-bold">৳{payment.seatAmount.toLocaleString()}</td>
                </tr>
              )}
              {payment.serviceCharge > 0 && (
                <tr>
                  <td className="font-bold">Service Charge</td>
                  <td>System Fee</td>
                  <td className="uppercase">{payment.method}</td>
                  <td className="text-right font-bold">৳{payment.serviceCharge.toLocaleString()}</td>
                </tr>
              )}
              {payment.advanceAmount > 0 && (
                <tr>
                  <td className="font-bold">Security Advance</td>
                  <td>One-time Deposit</td>
                  <td className="uppercase">{payment.method}</td>
                  <td className="text-right font-bold">৳{payment.advanceAmount.toLocaleString()}</td>
                </tr>
              )}
              {payment.foodAmount > 0 && (
                <tr>
                  <td className="font-bold text-primary">Food Purse Deposit</td>
                  <td className="font-black text-primary">Final Balance: ৳{currentFoodVal}</td>
                  <td className="uppercase">{payment.method}</td>
                  <td className="text-right font-bold">৳{payment.foodAmount.toLocaleString()}</td>
                </tr>
              )}
              {payment.cookingBill > 0 && (
                <tr>
                  <td className="font-bold">Cooking Service Bill</td>
                  <td>Final Bal: ৳{currentCookVal}</td>
                  <td className="uppercase">{payment.method}</td>
                  <td className="text-right font-bold">৳{payment.cookingBill.toLocaleString()}</td>
                </tr>
              )}
              {payment.wifiBill > 0 && (
                <tr>
                  <td className="font-bold">WiFi Service Bill</td>
                  <td>Monthly Utility</td>
                  <td className="uppercase">{payment.method}</td>
                  <td className="text-right font-bold">৳{payment.wifiBill.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan={3} className="text-right uppercase">Total Amount Received</td>
                <td className="text-right text-[11pt]">৳{payment.amount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>

          <div className="grid grid-cols-2 gap-4 mx-2 mt-6">
             <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
               <p className="text-[7pt] font-black uppercase text-slate-400 mb-2">Current Ledger Overview</p>
               <div className="space-y-2">
                 <div className="flex justify-between items-center text-[8pt]">
                   <span className="font-bold text-slate-500">Current Food Balance:</span>
                   <span className={cn("font-black", currentFoodVal < 0 ? "text-destructive" : "text-success")}>৳{currentFoodVal}</span>
                 </div>
                 <div className="flex justify-between items-center text-[8pt]">
                   <span className="font-bold text-slate-500">Total Rent Due:</span>
                   <span className="font-black text-destructive">৳{totalRentDue}</span>
                 </div>
               </div>
             </div>
             <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-between">
                <div className="flex justify-between items-center text-[8pt]">
                  <span className="font-bold text-slate-500">Received By:</span>
                  <span className="font-black text-primary">{payment.receiver}</span>
                </div>
                {payment.description && (
                  <p className="text-[7pt] text-slate-400 italic mt-2">Note: {payment.description}</p>
                )}
             </div>
          </div>

          <div className="print-footer px-10">
            <div className="signature-box">Student Signature</div>
            <div className="signature-box">Authorized Signature</div>
          </div>
          
          <div className="text-center mt-12 text-[7pt] font-black text-slate-300 tracking-[0.3em] uppercase">
            System Generated Receipt • Somikoron Hostel
          </div>
        </div>

        {/* SCREEN PREVIEW DESIGN */}
        <div className="p-8 md:p-12 space-y-8 print:hidden">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black uppercase text-primary tracking-tighter">SOMIKORON HOSTEL</h1>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">{payment.branch} Branch</p>
            <div className="pt-6 flex flex-col items-center">
              <div className="bg-primary text-white px-8 py-2 rounded-full text-lg font-black uppercase tracking-tighter">Money Receipt</div>
              <div className="flex gap-12 text-[10px] font-bold text-muted-foreground mt-6 uppercase tracking-widest">
                <span>Receipt No: <b className="text-slate-800">RCPT-{receiptNo}</b></span>
                <span>Date: <b className="text-slate-800">{dateStr}</b></span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 rounded-3xl border-2 border-slate-50 bg-slate-50/30">
            <div className="space-y-4">
              <div className="flex items-center gap-4"><div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shadow-sm"><User size={20}/></div><div><p className="text-[10px] uppercase font-bold text-muted-foreground">Resident Name</p><p className="text-lg font-black text-slate-800">{payment.studentName}</p></div></div>
              <div className="flex items-center gap-4"><div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shadow-sm"><Smartphone size={20}/></div><div><p className="text-[10px] uppercase font-bold text-muted-foreground">Phone Number</p><p className="text-md font-bold text-slate-700">{student?.phone || 'N/A'}</p></div></div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4"><div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shadow-sm"><Building2 size={20}/></div><div><p className="text-[10px] uppercase font-bold text-muted-foreground">Location & Room</p><p className="text-md font-bold text-slate-700">{payment.buildingName} • R-{payment.roomNumber}</p></div></div>
              <div className="flex items-center gap-4"><div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shadow-sm"><Calculator size={20}/></div><div><p className="text-[10px] uppercase font-bold text-muted-foreground">Package Type</p><Badge variant="secondary" className="text-[10px] font-black uppercase bg-white border-none">{student?.paymentSystem || 'N/A'}</Badge></div></div>
            </div>
          </div>

          <div className="border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-slate-50 border-b"><th className="p-4 text-left font-black text-[11px] uppercase text-slate-500">Description</th><th className="p-4 text-center font-black text-[11px] uppercase text-slate-500">Period / Final Balance</th><th className="p-4 text-right font-black text-[11px] uppercase text-slate-500">Paid Amount</th></tr></thead>
              <tbody className="divide-y">
                {payment.seatAmount > 0 && (<tr><td className="p-4 font-bold text-slate-700">Rent Adjustment</td><td className="p-4 text-center text-xs text-muted-foreground">{payment.month} {payment.year}</td><td className="p-4 text-right font-black text-slate-800">৳{payment.seatAmount.toLocaleString()}</td></tr>)}
                {payment.serviceCharge > 0 && (<tr><td className="p-4 font-bold text-purple-600">Service Charge</td><td className="p-4 text-center text-xs text-muted-foreground">System Fee</td><td className="p-4 text-right font-black text-slate-800">৳{payment.serviceCharge.toLocaleString()}</td></tr>)}
                {payment.advanceAmount > 0 && (<tr><td className="p-4 font-bold text-primary">Security Advance</td><td className="p-4 text-center text-xs text-muted-foreground">Deposit</td><td className="p-4 text-right font-black text-primary">৳{payment.advanceAmount.toLocaleString()}</td></tr>)}
                {payment.foodAmount > 0 && (<tr><td className="p-4 font-bold text-success">Food Purse Deposit</td><td className="p-4 text-center text-xs font-black text-success uppercase">Final Balance: ৳{currentFoodVal}</td><td className="p-4 text-right font-black text-slate-800">৳{payment.foodAmount.toLocaleString()}</td></tr>)}
                {payment.cookingBill > 0 && (<tr><td className="p-4 font-bold text-orange-600">Cooking Service</td><td className="p-4 text-center text-xs font-black text-orange-600 uppercase">Balance: ৳{currentCookVal}</td><td className="p-4 text-right font-black text-orange-700">৳{payment.cookingBill.toLocaleString()}</td></tr>)}
                {payment.wifiBill > 0 && (<tr><td className="p-4 font-bold text-blue-600">WiFi Service</td><td className="p-4 text-center text-xs text-muted-foreground">Monthly Utility</td><td className="p-4 text-right font-black text-blue-700">৳{payment.wifiBill.toLocaleString()}</td></tr>)}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-4 shadow-xl">
                <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Post-Payment Account Status</p>
                <div className="space-y-3">
                   <div className="flex justify-between items-center"><span className="text-xs font-bold opacity-60">Current Food Balance:</span><span className={cn("text-lg font-black", currentFoodVal < 0 ? "text-red-400" : "text-green-400")}>৳{currentFoodVal}</span></div>
                   <div className="flex justify-between items-center"><span className="text-xs font-bold opacity-60">Remaining Rent Due:</span><span className="text-lg font-black text-red-400">৳{totalRentDue}</span></div>
                </div>
             </div>
             <div className="flex flex-col justify-end space-y-4">
                <div className="flex justify-between items-center px-4"><span className="text-sm font-bold text-slate-500 uppercase">Total Received</span><span className="text-4xl font-black text-slate-900">৳{payment.amount.toLocaleString()}</span></div>
                <div className="bg-success text-white p-6 rounded-3xl flex justify-between items-center shadow-lg shadow-success/20">
                   <div className="space-y-0.5"><p className="text-[10px] font-bold text-white/60 uppercase">Sync Status</p><p className="text-lg font-black">Verified & Synced</p></div>
                   <CheckCircle2 className="h-12 w-12" />
                </div>
             </div>
          </div>

          <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 flex justify-between items-center">
             <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shadow-sm"><Info size={20}/></div><div><p className="text-[11px] font-bold text-slate-500 uppercase">Received By</p><p className="text-md font-black text-primary">{payment.receiver}</p></div></div>
             <div className="text-right hidden sm:block"><p className="text-[9px] text-slate-500 font-medium italic">"{payment.description || 'Smart auto-split entry processed.'}"</p></div>
          </div>
        </div>
      </div>
    </div>
  )
}
