import React, { useState } from 'react';
import { X, Download, Printer, Mail, DollarSign, CheckCircle2, Calendar, FileText, ExternalLink, Edit3, Link as LinkIcon, CreditCard, Landmark, Check, Clock, AlertCircle, Loader2, Paperclip } from 'lucide-react';
import { Job, StaffUser, InvoiceStatus, EmailTemplate, AppNotification } from '../types';
import { calculateJobTotalSeconds, calculateJobBillableAmount, calculateJobDepositAmount, calculateJobNetInvoiceAmount, formatSecondsToReadable } from '../utils/timeUtils';
import { calculateBusinessDueDate, applyInvoiceStatusTransition, isJasonApproved } from '../utils/invoiceWorkflow';
import { generateInvoicePDF, triggerDownloadBlob } from '../utils/pdfGenerator';

interface OfficialInvoiceModalProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
  onUpdateJob: (updatedJob: Job) => void;
  onTriggerEmail?: (email: EmailTemplate) => void;
  onDispatchNotifications?: (notifications: AppNotification[]) => void;
  currentStaff?: StaffUser;
  nowTimestamp?: number;
}

export const OfficialInvoiceModal: React.FC<OfficialInvoiceModalProps> = ({
  job,
  isOpen,
  onClose,
  onUpdateJob,
  onTriggerEmail,
  onDispatchNotifications,
  currentStaff,
  nowTimestamp = Date.now()
}) => {
  const defaultInvoiceNumber = job.invoice_number || `INV-${new Date().getFullYear()}-${job.job_number.replace(/[^a-zA-Z0-9]/g, '')}`;
  const defaultInvoiceDate = job.invoice_date || new Date().toISOString().split('T')[0];
  const defaultDueDate = job.invoice_due_date || calculateBusinessDueDate(defaultInvoiceDate, 7);
  const defaultPayLink = job.online_payment_link || `https://pay.myplanstore.com/invoice/${defaultInvoiceNumber.toLowerCase()}`;

  const [invoiceNumber, setInvoiceNumber] = useState(defaultInvoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(defaultInvoiceDate);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [paymentLink, setPaymentLink] = useState(defaultPayLink);
  const [invoiceNotes, setInvoiceNotes] = useState(
    job.invoice_notes || 'Thank you for choosing My Plan Store for your custom architectural drafting. Please review billable details below.'
  );
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [showItemizedLogs, setShowItemizedLogs] = useState(true);
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  
  // PDF & Email Generation states
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalSeconds = calculateJobTotalSeconds(job, nowTimestamp);
  const totalHoursDecimal = totalSeconds / 3600;
  const hourlyRate = job.hourly_rate || 85;
  const grossBillableTotal = calculateJobBillableAmount(job, nowTimestamp);
  const depositCollected = calculateJobDepositAmount(job);
  const netBalanceDue = calculateJobNetInvoiceAmount(job, nowTimestamp);

  const handleInvoiceDateChange = (newDateStr: string) => {
    setInvoiceDate(newDateStr);
    setDueDate(calculateBusinessDueDate(newDateStr, 7));
  };

  const handleSaveInvoiceDetails = () => {
    const updatedJob: Job = {
      ...job,
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate,
      invoice_due_date: dueDate,
      online_payment_link: paymentLink.trim(),
      invoice_notes: invoiceNotes.trim(),
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Invoice Generated / Updated',
          performedBy: currentStaff?.name || 'Billing Admin',
          timestamp: new Date().toISOString(),
          details: `Invoice #${invoiceNumber} configured. Gross: $${grossBillableTotal.toFixed(2)}, Deposit: -$${depositCollected.toFixed(2)}, Net Due: $${netBalanceDue.toFixed(2)}. Online pay link: ${paymentLink}`
        },
        ...job.audit_logs
      ]
    };
    onUpdateJob(updatedJob);
    setIsEditingSettings(false);
  };

  const handleDownloadPDF = async () => {
    handleSaveInvoiceDetails();
    setIsGeneratingPDF(true);
    setStatusFeedback('Generating high-resolution invoice PDF...');

    try {
      const filename = `Invoice_${invoiceNumber}_${job.customer_name.replace(/\s+/g, '_')}.pdf`;
      const result = await generateInvoicePDF('official-invoice-sheet', filename);

      // Trigger download directly to user's device
      triggerDownloadBlob(result.blob, result.filename);
      
      setStatusFeedback(`PDF file "${result.filename}" downloaded successfully!`);
      setTimeout(() => setStatusFeedback(null), 4000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      setStatusFeedback('Unable to compile canvas to PDF. Fallback: opening system print dialogue.');
      setTimeout(() => window.print(), 300);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = () => {
    handleSaveInvoiceDetails();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleEmailCustomerInvoice = async () => {
    handleSaveInvoiceDetails();
    setIsGeneratingEmail(true);
    setStatusFeedback('Compiling official invoice PDF and attaching to customer notification email...');

    try {
      const filename = `Invoice_${invoiceNumber}_${job.customer_name.replace(/\s+/g, '_')}.pdf`;
      const pdfResult = await generateInvoicePDF('official-invoice-sheet', filename);

      if (onTriggerEmail) {
        onTriggerEmail({
          recipientEmail: job.customer_email,
          recipientName: job.customer_name,
          subject: `Official Invoice #${invoiceNumber} - My Plan Store (Plan #${job.job_number})`,
          body: `Hi ${job.customer_name},

Attached is your official architectural invoice #${invoiceNumber} for Plan #${job.job_number} (${job.style}, ${job.sq_ft} sq ft).

==================================================
MY PLAN STORE - OFFICIAL INVOICE #${invoiceNumber}
1813 Harkrider St, Conway, AR 72032 | (501) 291-3228
==================================================

Plan / Project Number: ${job.job_number}
Invoice Date: ${invoiceDate}
Payment Terms: Net 7 Business Days (Due by ${dueDate})

FINANCIAL SUMMARY:
--------------------------------------------------
Gross Billable Services: $${grossBillableTotal.toFixed(2)} (${totalHoursDecimal.toFixed(2)} hrs @ $${hourlyRate}/hr)
Upfront Deposit / Retainer: -$${depositCollected.toFixed(2)}
--------------------------------------------------
TOTAL NET AMOUNT DUE: $${netBalanceDue.toFixed(2)}

PAYMENT OPTIONS:
1. Pay Online (Credit Card / ACH):
   ${paymentLink}

2. Pay by Check:
   Payment terms are Net 7 business days. Please make checks payable to "My Plan Store" and mail to:
   My Plan Store
   1813 Harkrider St
   Conway, AR 72032
   Phone: (501) 291-3228

NOTE: Upon receipt of the payment in full, we will provide you with your prints to hand off to your builder.

Please review the attached PDF for itemized time session breakdowns and terms. If you have any questions regarding your invoice or house plan package, please contact our billing team at (501) 291-3228 or billing@myplanstore.com.

Best regards,
Billing & Accounting Team
My Plan Store`,
          timestamp: new Date().toISOString(),
          jobId: job.id,
          jobNumber: job.job_number,
          attachments: [
            {
              name: pdfResult.filename,
              type: 'application/pdf',
              sizeBytes: pdfResult.sizeBytes,
              dataUrl: pdfResult.dataUrl,
              downloadUrl: URL.createObjectURL(pdfResult.blob)
            }
          ]
        });

        // Close invoice modal to show the Email simulator modal seamlessly
        onClose();
      }
    } catch (err) {
      console.error('Failed to attach PDF to email:', err);
      // Fallback: trigger email without attachment if canvas compilation encountered an issue
      if (onTriggerEmail) {
        onTriggerEmail({
          recipientEmail: job.customer_email,
          recipientName: job.customer_name,
          subject: `Invoice #${invoiceNumber} for Plan #${job.job_number} - My Plan Store`,
          body: `Hi ${job.customer_name},\n\nPlease review your invoice #${invoiceNumber} for Plan #${job.job_number}.\nNet Amount Due: $${netBalanceDue.toFixed(2)}\nPay Online: ${paymentLink}`,
          timestamp: new Date().toISOString(),
          jobId: job.id,
          jobNumber: job.job_number
        });
        onClose();
      }
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(paymentLink);
      setIsCopiedLink(true);
      setTimeout(() => setIsCopiedLink(false), 2000);
    }
  };

  const timeLogs = job.time_logs || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      
      {/* Container */}
      <div className="bg-slate-100 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col h-[94vh] max-h-[96vh] print:h-auto print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none print:bg-white">
        
        {/* Top Control Toolbar (Hidden on Print) */}
        <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 text-blue-400 rounded-lg border border-blue-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Official Customer Invoice Generator</h3>
                <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded">
                  MPS #{job.job_number}
                </span>
                {job.invoice_status && (
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    job.invoice_status === 'Paid' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                    job.invoice_status === 'Invoiced' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                    job.invoice_status === 'Jason Approved' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                    'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}>
                    {job.invoice_status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Generate, brand, email, or download high-fidelity PDF invoices for {job.customer_name}.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditingSettings(!isEditingSettings)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-400" />
              <span>{isEditingSettings ? 'Close Settings' : 'Edit Invoice Data'}</span>
            </button>

            {/* Email with Attached PDF */}
            <button
              type="button"
              onClick={handleEmailCustomerInvoice}
              disabled={isGeneratingEmail || isGeneratingPDF}
              className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              title="Attach generated PDF invoice and compose email to customer"
            >
              {isGeneratingEmail ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Attaching PDF...</span>
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email to Customer</span>
                </>
              )}
            </button>

            {/* Direct PDF Download */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF || isGeneratingEmail}
              className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              title="Generate and download PDF directly to your device"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            {/* Browser Print Fallback */}
            <button
              type="button"
              onClick={handlePrint}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold px-2.5 py-2 rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              title="Open browser print dialogue"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer ml-1"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status / Feedback Banner */}
        {statusFeedback && (
          <div className="bg-emerald-950/90 text-emerald-200 px-4 py-2 text-xs font-medium border-b border-emerald-800 flex items-center justify-between shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{statusFeedback}</span>
            </div>
            <button 
              onClick={() => setStatusFeedback(null)} 
              className="text-emerald-400 hover:text-emerald-100 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Invoice Metadata Editor Panel (Expandable) */}
        {isEditingSettings && (
          <div className="bg-white p-4 border-b border-slate-200 shadow-inner shrink-0 print:hidden space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span>Invoice Customization & Online Payment Settings</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                Payment terms default to <strong>7 business days</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-1.5 font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Invoice Date
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => handleInvoiceDateChange(e.target.value)}
                  className="w-full px-3 py-1.5 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Due Date (Net 7 Business Days)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Invoice Status
                </label>
                <select
                  value={job.invoice_status || 'Invoiced'}
                  onChange={(e) => {
                    const newStat = e.target.value as InvoiceStatus;
                    const { updatedJob, newNotifications } = applyInvoiceStatusTransition(job, newStat, currentStaff);
                    onUpdateJob(updatedJob);
                    if (onDispatchNotifications && newNotifications.length > 0) {
                      onDispatchNotifications(newNotifications);
                    }
                  }}
                  className="w-full px-3 py-1.5 font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Uninvoiced">Uninvoiced</option>
                  <option value="Pending Invoicing">Pending Invoicing</option>
                  <option value="Jason Approved">Jason Approved</option>
                  <option value="Invoiced">Invoiced</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Online Payment Link URL (Stripe / QuickBooks / Portal)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="url"
                    value={paymentLink}
                    onChange={(e) => setPaymentLink(e.target.value)}
                    placeholder="https://pay.myplanstore.com/invoice/..."
                    className="w-full px-3 py-1.5 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg shrink-0 flex items-center gap-1 cursor-pointer"
                    title="Copy Link"
                  >
                    {isCopiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <LinkIcon className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Custom Notes & Terms
                </label>
                <input
                  type="text"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={showItemizedLogs}
                  onChange={(e) => setShowItemizedLogs(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Include individual itemized time sessions on invoice sheet</span>
              </label>

              <button
                type="button"
                onClick={handleSaveInvoiceDetails}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save Invoice Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* THE OFFICIAL PRINTABLE INVOICE SHEET (Standard Letter 8.5" x 11") */}
        {/* =================================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 pb-20 sm:pb-28 flex justify-center print:p-0 print:overflow-visible print:block min-h-0">
          
          <div 
            id="official-invoice-sheet" 
            className="bg-white w-full max-w-[820px] p-6 sm:p-8 rounded-xl shadow-lg border border-slate-200 text-slate-800 font-sans flex flex-col justify-between print:shadow-none print:border-none print:p-6 print:w-full print:max-w-none print:min-h-0 print:rounded-none mb-6"
          >
            <div className="space-y-5 sm:space-y-6">
              
              {/* TOP HEADER: BRANDING & INVOICE IDENTIFIER */}
              <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-6">
                {/* Brand Info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-sm tracking-tighter shadow-xs">
                      MPS
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase">
                        My Plan Store
                      </h1>
                      <p className="text-[11px] font-bold text-blue-700 tracking-wider uppercase">
                        Architectural Design & CAD Drafting Services
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-0.5 pt-1.5">
                    <p className="font-semibold text-slate-900">1813 Harkrider St, Conway, AR 72032</p>
                    <p className="flex items-center gap-2">
                      <span>Phone: <strong>(501) 291-3228</strong></span>
                      <span>•</span>
                      <span>Email: billing@myplanstore.com</span>
                    </p>
                    <p>Web: www.myplanstore.com</p>
                  </div>
                </div>

                {/* Invoice Meta Box */}
                <div className="sm:text-right space-y-1">
                  <div className="inline-block bg-slate-900 text-white px-3.5 py-1 rounded-lg">
                    <h2 className="text-lg sm:text-xl font-black font-mono tracking-wider uppercase">
                      INVOICE
                    </h2>
                  </div>

                  <div className="pt-1.5 text-xs space-y-0.5">
                    <p className="font-mono">
                      <span className="text-slate-500">Invoice #: </span>
                      <strong className="text-slate-950 font-bold text-sm">{invoiceNumber}</strong>
                    </p>
                    <p className="font-mono">
                      <span className="text-slate-500">Plan / Job #: </span>
                      <strong className="text-blue-700 font-bold">{job.job_number}</strong>
                    </p>
                    <p className="font-mono">
                      <span className="text-slate-500">Invoice Date: </span>
                      <strong className="text-slate-900">{invoiceDate}</strong>
                    </p>
                    <p className="font-mono bg-amber-50 text-amber-950 px-2 py-0.5 rounded border border-amber-200 inline-block font-bold">
                      Terms: Net 7 Business Days
                    </p>
                    <p className="font-mono">
                      <span className="text-slate-500">Due Date: </span>
                      <strong className="text-rose-700 font-bold">{dueDate}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* BILL TO & PROJECT SPECIFICATIONS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200">
                {/* Bill To */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider block">
                    BILL TO (CUSTOMER)
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    {job.customer_name}
                  </h3>
                  <div className="text-xs text-slate-600 space-y-0.5 pt-0.5">
                    {job.customer_email && (
                      <p className="font-mono text-slate-800">{job.customer_email}</p>
                    )}
                    {job.customer_phone && (
                      <p className="font-mono text-slate-800">{job.customer_phone}</p>
                    )}
                    {job.lot_details && (
                      <p className="text-slate-600">Site/Lot: {job.lot_details}</p>
                    )}
                  </div>
                </div>

                {/* Project Specs */}
                <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-5">
                  <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider block">
                    PROJECT / PLAN SPECIFICATIONS
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    {job.style} Plan Package
                  </h4>
                  <div className="text-xs text-slate-600 space-y-0.5 pt-0.5">
                    <p>Total Heated Area: <strong>{job.sq_ft.toLocaleString()} sq ft</strong></p>
                    <p>Current Phase: <strong>{job.current_status}</strong></p>
                    <p>Assigned Drafter / PM: <strong>{job.assigned_drafter}</strong></p>
                  </div>
                </div>
              </div>

              {/* ITEMIZED BILLABLE DETAILS TABLE */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Billable Services & Drafting Summary
                  </h3>
                  <span className="text-xs font-mono text-slate-500">
                    Billing Rate: ${hourlyRate}.00 / hr
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-white font-mono text-[10px] uppercase">
                      <tr>
                        <th className="p-2.5 sm:p-3">Description / Service Item</th>
                        <th className="p-2.5 sm:p-3 text-center">Drafter / Dept</th>
                        <th className="p-2.5 sm:p-3 text-center">Hours / Qty</th>
                        <th className="p-2.5 sm:p-3 text-right">Rate</th>
                        <th className="p-2.5 sm:p-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      
                      {/* Main Service Line */}
                      <tr className="bg-slate-50/50 font-medium">
                        <td className="p-2.5 sm:p-3">
                          <strong className="text-slate-950 font-bold block">Architectural Design & CAD Drafting</strong>
                          <span className="text-slate-500 text-[11px]">
                            Custom residential plan creation for {job.customer_name} (#{job.job_number} - {job.style}, {job.sq_ft} sq ft)
                          </span>
                        </td>
                        <td className="p-2.5 sm:p-3 text-center font-mono text-slate-600">
                          {job.assigned_drafter.split(',')[0]}
                        </td>
                        <td className="p-2.5 sm:p-3 text-center font-mono font-bold">
                          {totalHoursDecimal.toFixed(2)} hrs
                        </td>
                        <td className="p-2.5 sm:p-3 text-right font-mono text-slate-600">
                          ${hourlyRate.toFixed(2)}
                        </td>
                        <td className="p-2.5 sm:p-3 text-right font-mono font-bold text-slate-950">
                          ${grossBillableTotal.toFixed(2)}
                        </td>
                      </tr>

                      {/* Itemized Session Breakdown (If enabled & logs exist) */}
                      {showItemizedLogs && timeLogs.length > 0 && timeLogs.map((log, index) => {
                        const logSecs = log.durationSeconds || (log.rawInputHours ? log.rawInputHours * 3600 : 0);
                        const logHrs = logSecs / 3600;
                        const logRate = log.hourlyRate || hourlyRate;
                        const logTotal = log.billableAmount || (logHrs * logRate);

                        return (
                          <tr key={log.id || index} className="text-slate-600 text-[11px] bg-white hover:bg-slate-50/80">
                            <td className="py-2 px-3 pl-5">
                              <span className="font-medium text-slate-800">
                                • {log.taskDescription || log.billingCategory || `Session ${index + 1}`}
                              </span>
                              {log.startTime && (
                                <span className="text-slate-400 font-mono text-[10px] ml-2">
                                  ({new Date(log.startTime).toLocaleDateString()})
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-500 font-mono text-[10px]">
                              {log.drafterName}
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-[10px]">
                              {logHrs.toFixed(2)} hrs
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-[10px] text-slate-500">
                              ${logRate.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-medium text-slate-700">
                              ${logTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}

                    </tbody>
                  </table>
                </div>
              </div>

              {/* TOTALS & DEPOSIT DEDUCTION BREAKDOWN */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-6 pt-1">
                
                {/* Notes & Policy Statement */}
                <div className="w-full sm:w-1/2 space-y-1.5">
                  <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider block">
                    INVOICE NOTES & REMITTANCE
                  </span>
                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                    {invoiceNotes}
                  </p>
                </div>

                {/* Financial Breakdown Card */}
                <div className="w-full sm:w-1/2 max-w-sm ml-auto space-y-2 font-mono text-xs">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    
                    {/* Gross Total */}
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-sans font-medium">Gross Billable Subtotal:</span>
                      <strong className="font-bold text-slate-900 text-sm">
                        ${grossBillableTotal.toFixed(2)}
                      </strong>
                    </div>

                    {/* Upfront Retainer / Deposit Line */}
                    <div className={`flex justify-between items-center py-1 px-2 rounded-lg border ${
                      depositCollected > 0
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      <div className="font-sans">
                        <span className="font-bold block">Less Upfront Deposit:</span>
                        {job.deposit_notes && (
                          <span className="text-[10px] text-emerald-700 block font-normal">
                            ({job.deposit_notes})
                          </span>
                        )}
                      </div>
                      <strong className="font-bold text-sm">
                        {depositCollected > 0 ? `-$${depositCollected.toFixed(2)}` : '$0.00'}
                      </strong>
                    </div>

                    {/* Final Net Amount Due */}
                    <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-baseline text-slate-950">
                      <span className="font-sans font-black text-xs sm:text-sm uppercase">
                        Net Amount Due:
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-slate-950 font-mono tracking-tight">
                        ${netBalanceDue.toFixed(2)}
                      </span>
                    </div>

                  </div>
                </div>

              </div>

              {/* PAYMENT OPTIONS & CHECK REMITTANCE BOX */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 text-white p-5 rounded-2xl shadow-md border border-slate-800 space-y-3.5 print:bg-white print:text-slate-900 print:border-2 print:border-slate-800 print:shadow-none">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5 print:border-slate-300">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 print:text-slate-900" />
                    <h4 className="font-black text-xs uppercase tracking-wider text-white print:text-slate-950">
                      Payment Options & Terms
                    </h4>
                  </div>
                  <span className="text-[11px] sm:text-xs font-mono font-bold bg-blue-600/40 text-blue-200 border border-blue-400/40 px-2.5 py-0.5 rounded-full print:border-slate-400 print:bg-slate-100 print:text-slate-900">
                    Net 7 Business Days
                  </span>
                </div>

                {/* Special Hand-off Notice */}
                <div className="bg-amber-500/15 border border-amber-400/40 rounded-xl p-3 flex items-start gap-2.5 text-amber-100 print:bg-amber-50 print:text-amber-950 print:border-amber-300">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 print:text-amber-700" />
                  <p className="text-xs font-medium leading-relaxed">
                    <strong className="text-amber-300 print:text-amber-900 font-bold uppercase tracking-wide mr-1">NOTE:</strong>
                    Upon receipt of the payment in full, we will provide you with your prints to hand off to your builder.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-0.5">
                  {/* Option A: Online Invoice Pay Link */}
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-blue-900/60 space-y-2 flex flex-col justify-between print:bg-slate-50 print:border-slate-300">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-400 print:text-emerald-700" />
                        <strong className="text-white print:text-slate-950 text-xs uppercase font-bold">
                          Option 1: Pay Online (Card / ACH)
                        </strong>
                      </div>
                      <p className="text-slate-300 print:text-slate-700 text-[11px] leading-relaxed">
                        To pay securely online via Credit Card or direct Bank Transfer (ACH), please visit the link below:
                      </p>
                    </div>
                    <div className="space-y-1">
                      <a
                        href={paymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 bg-blue-950 hover:bg-blue-900 text-blue-300 hover:text-blue-100 font-mono text-[11px] rounded-lg border border-blue-500/40 break-all transition font-semibold print:bg-white print:text-blue-800 print:border-slate-400 text-center"
                      >
                        {paymentLink}
                      </a>
                    </div>
                  </div>

                  {/* Option B: Pay By Check */}
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2 flex flex-col justify-between print:bg-slate-50 print:border-slate-300">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400 print:text-amber-700" />
                        <strong className="text-white print:text-slate-950 text-xs uppercase font-bold">
                          Option 2: Pay by Check (Terms: 7 Days)
                        </strong>
                      </div>
                      <p className="text-slate-300 print:text-slate-700 text-[11px] leading-relaxed">
                        Payment terms are <strong>7 business days</strong> from invoice date. Please make checks payable to <strong>"My Plan Store"</strong> and mail to:
                      </p>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg text-[11px] font-medium text-slate-200 border border-slate-700/80 print:bg-white print:text-slate-900 print:border-slate-300">
                      <p className="font-bold text-white print:text-slate-950">My Plan Store</p>
                      <p>1813 Harkrider St, Conway, AR 72032</p>
                      <p>Phone: (501) 291-3228</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* FOOTER */}
            <div className="pt-6 border-t border-slate-200 text-center text-xs text-slate-500 space-y-0.5 print:pt-3">
              <p className="font-bold text-slate-700">
                Thank you for trusting My Plan Store with your custom residential design!
              </p>
              <p className="text-[11px]">
                Questions regarding this invoice? Contact our billing office at <strong>(501) 291-3228</strong> or email <strong>billing@myplanstore.com</strong>.
              </p>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
