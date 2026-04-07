
"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, Download, Share2, X, CheckCircle2, Building2, User, Phone, Wallet, Calendar, Calculator, Smartphone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface ReceiptDialogProps {
  isOpen: boolean
  onClose: () => void
  payment: any
  student: any
  branchInfo?: {
    name: string
    address: string
    contact: string
  }
}

export function ReceiptDialog({ isOpen, onClose, payment, student, branchInfo }: ReceiptDialogProps) {
  if (!payment || !student) return null

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print()
    }
  }

  const receiptNo = payment.id?.substring(0, 8).toUpperCase() || "N/A"
  const dateStr = payment.date?.toDate ? payment.date.toDate().toLocaleString() : (payment.date ? new Date(payment.date).toLocaleString() : new Date().toLocaleString())

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-3xl print:shadow-none print:border-none">
        {/* Accessibility Title (Hidden from view) */}
        <DialogHeader className="sr-only">
          <DialogTitle>Payment Receipt - {student.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-full bg-white">
          {/* Header Controls (Hidden in Print) */}
          <div className="flex items-center justify-between p-4 border-b bg-slate-50/50 print:hidden">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-success/10 text-success border-success/20 animate-pulse">
                <CheckCircle2 size={12} className="mr-1" /> Payment Recorded
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-2 font-bold" onClick={handlePrint}>
                <Printer size={16} /> Print Receipt
              </Button>
              <Button size="sm" className="gap-2 font-bold bg-primary" onClick={onClose}>
                <X size={16} /> Close
              </Button>
            </div>
          </div>

          {/* PRINTABLE AREA */}
          <div id="receipt-print-area" className="p-8 space-y-8 print:p-6 print:space-y-4">
            {/* Receipt Header */}
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-black uppercase text-primary tracking-tighter print:text-xl">SOMIKORON HOSTEL</h1>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest print:text-[8px]">
                {branchInfo?.name || student.branch} Branch • Official Records
              </p>
              <div className="pt-4 flex flex-col items-center">
                <div className="bg-primary text-white px-6 py-1.5 rounded-full text-sm font-black uppercase tracking-tighter print:text-xs">
                  Money Receipt
                </div>
                <div className="flex gap-8 text-[9px] font-bold text-muted-foreground mt-3 uppercase tracking-widest print:mt-2">
                  <span>No: <b className="text-slate-800">RCPT-{receiptNo}</b></span>
                  <span>Date: <b className="text-slate-800">{dateStr}</b></span>
                </div>
              </div>
            </div>

            {/* Student Info Grid - Forced 2 columns in print */}
            <div className="grid grid-cols-2 gap-6 p-6 rounded-3xl border-2 border-slate-50 bg-slate-50/30 print:p-4 print:gap-4 print:rounded-2xl">
              <div className="space-y-3 print:space-y-1">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white border flex items-center justify-center text-primary shadow-sm print:h-6 print:w-6"><User size={16}/></div>
                  <div><p className="text-[8px] uppercase font-bold text-muted-foreground print:text-[7px]">Resident Name</p><p className="text-sm font-black text-slate-800 print:text-xs">{student.name}</p></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white border flex items-center justify-center text-primary shadow-sm print:h-6 print:w-6"><Smartphone size={16}/></div>
                  <div><p className="text-[8px] uppercase font-bold text-muted-foreground print:text-[7px]">Phone Number</p><p className="text-sm font-bold text-slate-700 print:text-xs">{student.phone}</p></div>
                </div>
              </div>
              <div className="space-y-3 print:space-y-1">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white border flex items-center justify-center text-primary shadow-sm print:h-6 print:w-6"><Building2 size={16}/></div>
                  <div><p className="text-[8px] uppercase font-bold text-muted-foreground print:text-[7px]">Location & Room</p><p className="text-sm font-bold text-slate-700 print:text-xs">{student.buildingName} • R-{student.roomNumber}</p></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white border flex items-center justify-center text-primary shadow-sm print:h-6 print:w-6"><Calculator size={16}/></div>
                  <div><p className="text-[8px] uppercase font-bold text-muted-foreground print:text-[7px]">Package Type</p><Badge variant="secondary" className="text-[9px] font-black uppercase bg-white print:h-4 print:text-[7px]">{student.paymentSystem}</Badge></div>
                </div>
              </div>
            </div>

            {/* Payment Details Table */}
            <div className="border rounded-2xl overflow-hidden shadow-sm print:rounded-xl">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="p-3 text-left font-black text-[10px] uppercase text-slate-500 print:p-2 print:text-[8px]">Description</th>
                    <th className="p-3 text-center font-black text-[10px] uppercase text-slate-500 print:p-2 print:text-[8px]">Period</th>
                    <th className="p-3 text-right font-black text-[10px] uppercase text-slate-500 print:p-2 print:text-[8px]">Method</th>
                    <th className="p-3 text-right font-black text-[10px] uppercase text-slate-500 print:p-2 print:text-[8px]">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payment.seatAmount > 0 && (
                    <tr>
                      <td className="p-3 font-bold print:p-2 print:text-xs">Rent</td>
                      <td className="p-3 text-center text-xs print:p-2 print:text-[10px]">{payment.month} {payment.year}</td>
                      <td className="p-3 text-right uppercase text-[10px] font-bold print:p-2 print:text-[8px]">{payment.method}</td>
                      <td className="p-3 text-right font-black text-slate-800 print:p-2 print:text-sm">৳{payment.seatAmount.toLocaleString()}</td>
                    </tr>
                  )}
                  {payment.foodAmount > 0 && (
                    <tr>
                      <td className="p-3 font-bold print:p-2 print:text-xs">Food Deposit</td>
                      <td className="p-3 text-center text-xs print:p-2 print:text-[10px]">{payment.month} {payment.year}</td>
                      <td className="p-3 text-right uppercase text-[10px] font-bold print:p-2 print:text-[8px]">{payment.method}</td>
                      <td className="p-3 text-right font-black text-slate-800 print:p-2 print:text-sm">৳{payment.foodAmount.toLocaleString()}</td>
                    </tr>
                  )}
                  {payment.advanceAmount > 0 && (
                    <tr>
                      <td className="p-3 font-bold text-primary print:p-2 print:text-xs">Advance</td>
                      <td className="p-3 text-center text-xs print:p-2 print:text-[10px]">{payment.month} {payment.year}</td>
                      <td className="p-3 text-right uppercase text-[10px] font-bold print:p-2 print:text-[8px]">{payment.method}</td>
                      <td className="p-3 text-right font-black text-primary print:p-2 print:text-sm">৳{payment.advanceAmount.toLocaleString()}</td>
                    </tr>
                  )}
                  {payment.serviceCharge > 0 && (
                    <tr>
                      <td className="p-3 font-bold print:p-2 print:text-xs">Service Charge</td>
                      <td className="p-3 text-center text-xs print:p-2 print:text-[10px]">One-time</td>
                      <td className="p-3 text-right uppercase text-[10px] font-bold print:p-2 print:text-[8px]">{payment.method}</td>
                      <td className="p-3 text-right font-black text-slate-800 print:p-2 print:text-sm">৳{payment.serviceCharge.toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary & Signature */}
            <div className="grid grid-cols-2 gap-12 print:gap-6">
              <div className="space-y-4 print:space-y-2">
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 print:p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase print:text-[8px]">Received By:</span>
                    <span className="text-xs font-black text-primary print:text-[10px]">{payment.receiver}</span>
                  </div>
                  <Separator className="bg-primary/10 my-2 print:my-1" />
                  <p className="text-[9px] text-slate-500 leading-tight italic print:text-[7px]">
                    <b>Note:</b> {payment.description || 'Verified payment record.'}
                  </p>
                </div>
                <div className="pt-12 print:pt-6 text-center">
                  <div className="border-t border-slate-900 pt-2 w-40 mx-auto print:w-24">
                    <p className="text-[9px] font-black uppercase print:text-[7px]">Resident Signature</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 print:space-y-2">
                <div className="space-y-2 print:space-y-1">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-xs font-bold text-slate-500 uppercase print:text-[8px]">Total Received</span>
                    <span className="text-xl font-black text-slate-900 print:text-lg">৳{payment.amount.toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl shadow-slate-200 flex justify-between items-center print:p-2 print:rounded-xl">
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-bold text-white/60 uppercase print:text-[6px]">Sync Status</p>
                      <p className="text-sm font-bold print:text-[10px]">Verified</p>
                    </div>
                    <Badge className="bg-white text-slate-900 font-black h-8 px-4 text-sm print:h-6 print:px-2 print:text-xs">OK</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-8 text-center space-y-2 print:pt-4 print:space-y-1">
              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest print:text-[6px]">Thank you for staying with us at Somikoron</p>
              <div className="flex justify-center gap-4 text-[7px] text-slate-400 print:text-[5px]">
                <span>SYSTEM GENERATED</span>
                <span>•</span>
                <span>PROTECTED BY SOMIKORON SECURITY</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
