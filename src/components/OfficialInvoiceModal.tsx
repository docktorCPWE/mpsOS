import React, { useState, useEffect } from 'react';
import { 
  X, Download, Printer, Mail, DollarSign, CheckCircle2, Calendar, FileText, 
  ExternalLink, Edit3, Link as LinkIcon, CreditCard, Landmark, Check, Clock, 
  AlertCircle, Loader2, Paperclip, Plus, Trash2, RotateCcw, User, Home, 
  Receipt, Layers, Sliders, ChevronDown, ChevronUp, Sparkles, Tag, ArrowRight
} from 'lucide-react';
import { Job, StaffUser, InvoiceStatus, EmailTemplate, AppNotification, TimeLog, JobPhase, AdditionalBillingCategory } from '../types';
import { calculateBusinessDueDate, applyInvoiceStatusTransition, isJasonApproved } from '../utils/invoiceWorkflow';
import { generateInvoicePDF, triggerDownloadBlob } from '../utils/pdfGenerator';
import { formatSecondsToReadable } from '../utils/timeUtils';

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

type EditTabType = 'time_entries' | 'financials' | 'invoice_terms' | 'customer_plan';

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

  // Invoice Metadata State
  const [invoiceNumber, setInvoiceNumber] = useState(defaultInvoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(defaultInvoiceDate);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [paymentLink, setPaymentLink] = useState(defaultPayLink);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>(job.invoice_status || 'Invoiced');
  const [invoiceNotes, setInvoiceNotes] = useState(
    job.invoice_notes || 'Thank you for choosing My Plan Store for your custom architectural drafting. Please review billable details below.'
  );

  // Financials & Rates State
  const [hourlyRate, setHourlyRate] = useState<number>(job.hourly_rate || 85);
  const [depositCollected, setDepositCollected] = useState<boolean>(Boolean(job.deposit_collected));
  const [depositAmount, setDepositAmount] = useState<number>(job.deposit_amount || 0);
  const [depositDate, setDepositDate] = useState<string>(job.deposit_date || defaultInvoiceDate);
  const [depositNotes, setDepositNotes] = useState<string>(job.deposit_notes || '');

  // Customer & Plan Specifications State
  const [customerName, setCustomerName] = useState<string>(job.customer_name || '');
  const [customerEmail, setCustomerEmail] = useState<string>(job.customer_email || '');
  const [customerPhone, setCustomerPhone] = useState<string>(job.customer_phone || '');
  const [lotDetails, setLotDetails] = useState<string>(job.lot_details || '');
  const [planStyle, setPlanStyle] = useState<string>(job.style || '');
  const [sqFt, setSqFt] = useState<number>(job.sq_ft || 0);
  const [currentPhase, setCurrentPhase] = useState<JobPhase>(job.current_status || 'Construction Prints');
  const [assignedDrafter, setAssignedDrafter] = useState<string>(job.assigned_drafter || '');

  // Editable Time Logs Array
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>(() => {
    if (job.time_logs && job.time_logs.length > 0) {
      return JSON.parse(JSON.stringify(job.time_logs));
    }
    // If no logs exist yet, create an initial default drafting session so user can edit it
    return [
      {
        id: `t-init-${Date.now()}`,
        drafterName: (job.assigned_drafter || 'Sarah Jenkins').split(',')[0].trim(),
        startTime: new Date().toISOString(),
        durationSeconds: 37800, // 10.5 hours
        taskDescription: 'Architectural Design & CAD Drafting Services',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: job.hourly_rate || 85,
        billableHours: 10.5,
        billableAmount: 10.5 * (job.hourly_rate || 85)
      }
    ];
  });

  // Editor Panel & Tabs UI State
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<EditTabType>('time_entries');
  const [showItemizedLogs, setShowItemizedLogs] = useState(true);
  const [isCopiedLink, setIsCopiedLink] = useState(false);

  // Time Entry Add/Edit Sub-form State
  const [isAddingTimeLog, setIsAddingTimeLog] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Time entry form inputs
  const [formDrafterName, setFormDrafterName] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Standard Offline CAD Drafting');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formHours, setFormHours] = useState('1.0');
  const [formRate, setFormRate] = useState('85');

  // Adjust Total Hours Modal/Input State
  const [isAdjustingTotalHours, setIsAdjustingTotalHours] = useState(false);
  const [adjustTotalHoursValue, setAdjustTotalHoursValue] = useState('');

  // PDF & Email Generation states
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Sync state if job prop updates from outside
  useEffect(() => {
    if (job) {
      setInvoiceNumber(job.invoice_number || `INV-${new Date().getFullYear()}-${job.job_number.replace(/[^a-zA-Z0-9]/g, '')}`);
      setInvoiceDate(job.invoice_date || new Date().toISOString().split('T')[0]);
      setDueDate(job.invoice_due_date || calculateBusinessDueDate(job.invoice_date || new Date().toISOString().split('T')[0], 7));
      setPaymentLink(job.online_payment_link || `https://pay.myplanstore.com/invoice/${(job.invoice_number || '').toLowerCase()}`);
      setInvoiceStatus(job.invoice_status || 'Invoiced');
      setHourlyRate(job.hourly_rate || 85);
      setDepositCollected(Boolean(job.deposit_collected));
      setDepositAmount(job.deposit_amount || 0);
      setDepositDate(job.deposit_date || new Date().toISOString().split('T')[0]);
      setDepositNotes(job.deposit_notes || '');
      setCustomerName(job.customer_name || '');
      setCustomerEmail(job.customer_email || '');
      setCustomerPhone(job.customer_phone || '');
      setLotDetails(job.lot_details || '');
      setPlanStyle(job.style || '');
      setSqFt(job.sq_ft || 0);
      setCurrentPhase(job.current_status || 'Construction Prints');
      setAssignedDrafter(job.assigned_drafter || '');
      if (job.time_logs && job.time_logs.length > 0) {
        setTimeLogs(JSON.parse(JSON.stringify(job.time_logs)));
      }
    }
  }, [job.id]);

  if (!isOpen) return null;

  // Real-time calculations based on currently edited time entries and financials
  const calculateTotalSeconds = () => {
    return timeLogs.reduce((sum, log) => {
      if (typeof log.billableHours === 'number') {
        return sum + Math.round(log.billableHours * 3600);
      }
      return sum + (log.durationSeconds || 0);
    }, 0);
  };

  const totalCalculatedSeconds = calculateTotalSeconds();
  const totalCalculatedHours = totalCalculatedSeconds / 3600;

  const calculateGrossBillable = () => {
    if (timeLogs.length === 0) {
      return (job.estimated_cost || 0);
    }
    return timeLogs.reduce((sum, log) => {
      const rate = log.hourlyRate || hourlyRate || 85;
      if (typeof log.billableAmount === 'number') {
        return sum + log.billableAmount;
      }
      if (typeof log.billableHours === 'number') {
        return sum + (log.billableHours * rate);
      }
      const hrs = (log.durationSeconds || 0) / 3600;
      return sum + (hrs * rate);
    }, 0);
  };

  const grossBillableTotal = calculateGrossBillable();
  const effectiveDepositAmount = depositCollected ? (Number(depositAmount) || 0) : 0;
  const netBalanceDue = Math.max(0, Math.round((grossBillableTotal - effectiveDepositAmount) * 100) / 100);

  const handleInvoiceDateChange = (newDateStr: string) => {
    setInvoiceDate(newDateStr);
    setDueDate(calculateBusinessDueDate(newDateStr, 7));
  };

  // Reset to Job's original values
  const handleResetToOriginal = () => {
    setInvoiceNumber(job.invoice_number || `INV-${new Date().getFullYear()}-${job.job_number.replace(/[^a-zA-Z0-9]/g, '')}`);
    setInvoiceDate(job.invoice_date || new Date().toISOString().split('T')[0]);
    setDueDate(job.invoice_due_date || calculateBusinessDueDate(job.invoice_date || new Date().toISOString().split('T')[0], 7));
    setPaymentLink(job.online_payment_link || `https://pay.myplanstore.com/invoice/${(job.invoice_number || '').toLowerCase()}`);
    setInvoiceNotes(job.invoice_notes || 'Thank you for choosing My Plan Store for your custom architectural drafting. Please review billable details below.');
    setInvoiceStatus(job.invoice_status || 'Invoiced');
    setHourlyRate(job.hourly_rate || 85);
    setDepositCollected(Boolean(job.deposit_collected));
    setDepositAmount(job.deposit_amount || 0);
    setDepositDate(job.deposit_date || '');
    setDepositNotes(job.deposit_notes || '');
    setCustomerName(job.customer_name || '');
    setCustomerEmail(job.customer_email || '');
    setCustomerPhone(job.customer_phone || '');
    setLotDetails(job.lot_details || '');
    setPlanStyle(job.style || '');
    setSqFt(job.sq_ft || 0);
    setCurrentPhase(job.current_status || 'Construction Prints');
    setAssignedDrafter(job.assigned_drafter || '');
    setTimeLogs(job.time_logs && job.time_logs.length > 0 ? JSON.parse(JSON.stringify(job.time_logs)) : []);
    setIsAddingTimeLog(false);
    setEditingLogId(null);
    setStatusFeedback('Reset all invoice and time entry values to original project data.');
    setTimeout(() => setStatusFeedback(null), 3000);
  };

  // Open Form to Add New Time Entry
  const handleOpenAddTimeLog = () => {
    setEditingLogId(null);
    setFormDrafterName((currentStaff?.name || assignedDrafter.split(',')[0] || 'Sarah Jenkins').trim());
    setFormCategory('Standard Offline CAD Drafting');
    setFormDescription('Architectural plan drafting & redline updates');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormHours('1.5');
    setFormRate(String(hourlyRate || 85));
    setIsAddingTimeLog(true);
  };

  // Open Form to Edit Existing Time Entry
  const handleOpenEditTimeLog = (log: TimeLog) => {
    setIsAddingTimeLog(false);
    setEditingLogId(log.id);
    setFormDrafterName(log.drafterName || assignedDrafter.split(',')[0] || 'Sarah Jenkins');
    setFormCategory(log.billingCategory || 'Standard Offline CAD Drafting');
    setFormDescription(log.taskDescription || '');
    setFormDate(log.startTime ? log.startTime.split('T')[0] : new Date().toISOString().split('T')[0]);
    
    const hrs = typeof log.billableHours === 'number' 
      ? log.billableHours 
      : (log.durationSeconds ? log.durationSeconds / 3600 : (log.rawInputHours || 1.0));
    setFormHours(hrs.toFixed(2).replace(/\.00$/, ''));
    setFormRate(String(log.hourlyRate || hourlyRate || 85));
  };

  // Save Add/Edit Time Entry
  const handleSaveTimeEntryForm = (e: React.FormEvent) => {
    e.preventDefault();
    const hoursNum = Math.max(0.01, parseFloat(formHours) || 1.0);
    const rateNum = Math.max(0.01, parseFloat(formRate) || hourlyRate || 85);
    const calculatedDurationSeconds = Math.round(hoursNum * 3600);
    const calculatedBillableAmount = Math.round(hoursNum * rateNum * 100) / 100;
    const startIso = formDate ? `${formDate}T12:00:00.000Z` : new Date().toISOString();

    if (editingLogId) {
      // Update existing
      setTimeLogs(prev => prev.map(log => {
        if (log.id === editingLogId) {
          return {
            ...log,
            drafterName: formDrafterName.trim() || 'Drafter',
            billingCategory: formCategory,
            taskDescription: formDescription.trim() || formCategory,
            startTime: startIso,
            durationSeconds: calculatedDurationSeconds,
            billableHours: hoursNum,
            hourlyRate: rateNum,
            billableAmount: calculatedBillableAmount,
            rawInputHours: hoursNum
          };
        }
        return log;
      }));
      setEditingLogId(null);
      setStatusFeedback(`Updated time entry: ${hoursNum} hrs @ $${rateNum}/hr`);
    } else {
      // Add new
      const newEntry: TimeLog = {
        id: `t-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        drafterName: formDrafterName.trim() || 'Drafter',
        billingCategory: formCategory,
        taskDescription: formDescription.trim() || formCategory,
        startTime: startIso,
        durationSeconds: calculatedDurationSeconds,
        billableHours: hoursNum,
        hourlyRate: rateNum,
        billableAmount: calculatedBillableAmount,
        rawInputHours: hoursNum
      };
      setTimeLogs(prev => [newEntry, ...prev]);
      setIsAddingTimeLog(false);
      setStatusFeedback(`Added new billable time entry: ${hoursNum} hrs @ $${rateNum}/hr ($${calculatedBillableAmount.toFixed(2)})`);
    }
    setTimeout(() => setStatusFeedback(null), 3500);
  };

  // Delete Individual Time Entry
  const handleDeleteTimeLog = (logId: string) => {
    const target = timeLogs.find(l => l.id === logId);
    setTimeLogs(prev => prev.filter(l => l.id !== logId));
    if (editingLogId === logId) {
      setEditingLogId(null);
    }
    setStatusFeedback(`Removed time session "${target?.taskDescription || target?.billingCategory || 'Entry'}".`);
    setTimeout(() => setStatusFeedback(null), 3000);
  };

  // Direct Total Hours Adjustment
  const handleApplyAdjustTotalHours = (e: React.FormEvent) => {
    e.preventDefault();
    const newTotal = parseFloat(adjustTotalHoursValue);
    if (isNaN(newTotal) || newTotal < 0) return;

    if (timeLogs.length === 0) {
      // Create single log
      const newEntry: TimeLog = {
        id: `t-adj-${Date.now()}`,
        drafterName: assignedDrafter.split(',')[0] || 'Sarah Jenkins',
        startTime: new Date().toISOString(),
        durationSeconds: Math.round(newTotal * 3600),
        taskDescription: 'Architectural Drafting & Plan Package',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: hourlyRate,
        billableHours: newTotal,
        billableAmount: newTotal * hourlyRate
      };
      setTimeLogs([newEntry]);
    } else if (timeLogs.length === 1) {
      // Update single log
      setTimeLogs(prev => [{
        ...prev[0],
        durationSeconds: Math.round(newTotal * 3600),
        billableHours: newTotal,
        billableAmount: newTotal * (prev[0].hourlyRate || hourlyRate)
      }]);
    } else {
      // Scale all proportionally or adjust primary
      const currentTotal = totalCalculatedHours;
      if (currentTotal > 0) {
        const ratio = newTotal / currentTotal;
        setTimeLogs(prev => prev.map(l => {
          const lHrs = (typeof l.billableHours === 'number' ? l.billableHours : (l.durationSeconds / 3600)) * ratio;
          const roundedHrs = Math.round(lHrs * 100) / 100;
          return {
            ...l,
            durationSeconds: Math.round(roundedHrs * 3600),
            billableHours: roundedHrs,
            billableAmount: roundedHrs * (l.hourlyRate || hourlyRate)
          };
        }));
      } else {
        setTimeLogs(prev => [{
          ...prev[0],
          durationSeconds: Math.round(newTotal * 3600),
          billableHours: newTotal,
          billableAmount: newTotal * (prev[0].hourlyRate || hourlyRate)
        }, ...prev.slice(1)]);
      }
    }

    setIsAdjustingTotalHours(false);
    setStatusFeedback(`Total project drafting hours adjusted to ${newTotal.toFixed(2)} hrs.`);
    setTimeout(() => setStatusFeedback(null), 3500);
  };

  // Save All Changes to the Job State and Invoice
  const handleSaveInvoiceDetails = () => {
    const updatedJob: Job = {
      ...job,
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate,
      invoice_due_date: dueDate,
      online_payment_link: paymentLink.trim(),
      invoice_notes: invoiceNotes.trim(),
      invoice_status: invoiceStatus,
      hourly_rate: hourlyRate,
      deposit_collected: depositCollected,
      deposit_amount: effectiveDepositAmount,
      deposit_date: depositDate,
      deposit_notes: depositNotes.trim(),
      customer_name: customerName.trim() || job.customer_name,
      customer_email: customerEmail.trim() || job.customer_email,
      customer_phone: customerPhone.trim() || job.customer_phone,
      lot_details: lotDetails.trim() || job.lot_details,
      style: planStyle.trim() || job.style,
      sq_ft: Number(sqFt) || job.sq_ft,
      current_status: currentPhase,
      assigned_drafter: assignedDrafter.trim() || job.assigned_drafter,
      time_logs: timeLogs,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Invoice Data & Time Entries Edited',
          performedBy: currentStaff?.name || 'Billing Specialist',
          timestamp: new Date().toISOString(),
          details: `Invoice #${invoiceNumber} updated. Hours: ${totalCalculatedHours.toFixed(2)} hrs, Gross: $${grossBillableTotal.toFixed(2)}, Deposit: -$${effectiveDepositAmount.toFixed(2)}, Net Balance: $${netBalanceDue.toFixed(2)}. (${timeLogs.length} time entries saved).`
        },
        ...job.audit_logs
      ]
    };

    onUpdateJob(updatedJob);
    setIsEditingSettings(false);
    setStatusFeedback(`Invoice #${invoiceNumber} & ${timeLogs.length} time entries saved successfully!`);
    setTimeout(() => setStatusFeedback(null), 4000);
  };

  // Download PDF Handler
  const handleDownloadPDF = async () => {
    handleSaveInvoiceDetails();
    setIsGeneratingPDF(true);
    setStatusFeedback('Generating high-resolution invoice PDF with edited data...');

    try {
      const filename = `Invoice_${invoiceNumber}_${customerName.replace(/\s+/g, '_')}.pdf`;
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

  // Print Handler
  const handlePrint = () => {
    handleSaveInvoiceDetails();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Email Customer Invoice Handler
  const handleEmailCustomerInvoice = async () => {
    handleSaveInvoiceDetails();
    setIsGeneratingEmail(true);
    setStatusFeedback('Compiling official invoice PDF and attaching to customer notification email...');

    try {
      const filename = `Invoice_${invoiceNumber}_${customerName.replace(/\s+/g, '_')}.pdf`;
      const pdfResult = await generateInvoicePDF('official-invoice-sheet', filename);

      if (onTriggerEmail) {
        onTriggerEmail({
          recipientEmail: customerEmail,
          recipientName: customerName,
          subject: `Official Invoice #${invoiceNumber} - My Plan Store (Plan #${job.job_number})`,
          body: `Hi ${customerName},

Attached is your official architectural invoice #${invoiceNumber} for Plan #${job.job_number} (${planStyle}, ${sqFt} sq ft).

==================================================
MY PLAN STORE - OFFICIAL INVOICE #${invoiceNumber}
1813 Harkrider St, Conway, AR 72032 | (501) 291-3228
==================================================

Plan / Project Number: ${job.job_number}
Invoice Date: ${invoiceDate}
Payment Terms: Net 7 Business Days (Due by ${dueDate})

FINANCIAL SUMMARY:
--------------------------------------------------
Gross Billable Services: $${grossBillableTotal.toFixed(2)} (${totalCalculatedHours.toFixed(2)} hrs @ $${hourlyRate}/hr)
Upfront Deposit / Retainer: -$${effectiveDepositAmount.toFixed(2)}
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

        onClose();
      }
    } catch (err) {
      console.error('Failed to attach PDF to email:', err);
      if (onTriggerEmail) {
        onTriggerEmail({
          recipientEmail: customerEmail,
          recipientName: customerName,
          subject: `Invoice #${invoiceNumber} for Plan #${job.job_number} - My Plan Store`,
          body: `Hi ${customerName},\n\nPlease review your invoice #${invoiceNumber} for Plan #${job.job_number}.\nNet Amount Due: $${netBalanceDue.toFixed(2)}\nPay Online: ${paymentLink}`,
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      
      {/* Main Modal Container */}
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
                {invoiceStatus && (
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    invoiceStatus === 'Paid' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                    invoiceStatus === 'Invoiced' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                    invoiceStatus === 'Jason Approved' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                    'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}>
                    {invoiceStatus}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Generate, edit individual time entries, brand, email, or download high-fidelity PDF invoices for {customerName}.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-edit-invoice-data"
              onClick={() => setIsEditingSettings(!isEditingSettings)}
              className={`text-xs font-semibold px-3.5 py-2 rounded-xl border transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                isEditingSettings
                  ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Edit3 className={`w-3.5 h-3.5 ${isEditingSettings ? 'text-white' : 'text-blue-400'}`} />
              <span>{isEditingSettings ? 'Hide Edit Panel' : 'Edit Invoice Data'}</span>
              <span className="text-[10px] bg-slate-900/60 text-slate-200 px-1.5 py-0.2 rounded-full font-mono">
                {timeLogs.length} logs
              </span>
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
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
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

        {/* =================================================================== */}
        {/* COMPREHENSIVE EDIT INVOICE DATA DRAWER / PANEL                      */}
        {/* =================================================================== */}
        {isEditingSettings && (
          <div className="bg-white border-b-2 border-blue-600 shadow-xl shrink-0 print:hidden overflow-y-auto max-h-[50vh] sm:max-h-[55vh] animate-in fade-in slide-in-from-top-2 duration-150">
            
            {/* Header & Tabs Bar */}
            <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-600/30 text-blue-400 rounded-md border border-blue-500/30">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <span>Invoice Data & Time Entries Editor</span>
                    <span className="text-[10px] font-mono font-normal text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                      Live Preview Active
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Adjust individual time sessions, rates, deposit retainer, customer specs, or terms before generating the invoice.
                  </p>
                </div>
              </div>

              {/* Summary Live Calculation Pill */}
              <div className="flex items-center gap-2 text-xs font-mono bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-800">
                <div className="flex items-center gap-1 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span><strong>{totalCalculatedHours.toFixed(2)}</strong> hrs</span>
                </div>
                <span className="text-slate-600">•</span>
                <div className="text-slate-300">
                  <span>Gross: <strong>${grossBillableTotal.toFixed(2)}</strong></span>
                </div>
                <span className="text-slate-600">•</span>
                <div className="text-emerald-400 font-bold">
                  <span>Net Due: <strong>${netBalanceDue.toFixed(2)}</strong></span>
                </div>
              </div>
            </div>

            {/* Sub-Tab Navigation Bar */}
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveEditTab('time_entries')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeEditTab === 'time_entries'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Time Entries & Sessions</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeEditTab === 'time_entries' ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {timeLogs.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveEditTab('financials')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeEditTab === 'financials'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Rates & Upfront Deposit</span>
                  {depositCollected && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveEditTab('invoice_terms')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeEditTab === 'invoice_terms'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Invoice #, Dates & Pay Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveEditTab('customer_plan')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeEditTab === 'customer_plan'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Customer & Plan Specs</span>
                </button>
              </div>

              {/* Action Controls inside toolbar */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToOriginal}
                  className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                  title="Reset edits to original job data"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveInvoiceDetails}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Changes to Job & Invoice</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT AREA */}
            <div className="p-4 sm:p-5">

              {/* ========================================================= */}
              {/* SUB-TAB 1: TIME ENTRIES & SESSIONS                        */}
              {/* ========================================================= */}
              {activeEditTab === 'time_entries' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <h5 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span>Individual Billable Time Sessions & Line Items ({timeLogs.length})</span>
                      </h5>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Edit individual hours, drafter rates, task notes, or insert custom revision & consultation sessions.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustTotalHoursValue(totalCalculatedHours.toFixed(2));
                          setIsAdjustingTotalHours(true);
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        title="Directly adjust total drafting hours across project"
                      >
                        <Edit3 className="w-3 h-3 text-slate-500" />
                        <span>Adjust Total Hours</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenAddTimeLog}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Time Session</span>
                      </button>
                    </div>
                  </div>

                  {/* Adjust Total Hours Quick Modal/Box */}
                  {isAdjustingTotalHours && (
                    <form onSubmit={handleApplyAdjustTotalHours} className="bg-amber-50/80 border border-amber-300 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                        <div>
                          <strong className="text-xs text-amber-950 font-bold block">Quick Total Hours Adjustment:</strong>
                          <span className="text-[11px] text-amber-800">Set the target total drafting hours for this project (currently {totalCalculatedHours.toFixed(2)} hrs).</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={adjustTotalHoursValue}
                          onChange={(e) => setAdjustTotalHoursValue(e.target.value)}
                          className="w-24 px-3 py-1 text-xs font-mono font-bold bg-white border border-amber-400 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500"
                          placeholder="e.g. 10.5"
                          required
                        />
                        <button
                          type="submit"
                          className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-lg shadow-2xs transition"
                        >
                          Apply Adjustment
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAdjustingTotalHours(false)}
                          className="px-2.5 py-1 text-slate-600 hover:text-slate-800 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Add / Edit Time Entry Form Box */}
                  {(isAddingTimeLog || editingLogId) && (
                    <form onSubmit={handleSaveTimeEntryForm} className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                        <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                          {editingLogId ? <Edit3 className="w-4 h-4 text-blue-600" /> : <Plus className="w-4 h-4 text-blue-600" />}
                          <span>{editingLogId ? 'Edit Time Session / Line Item' : 'Add New Billable Time Session'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingTimeLog(false);
                            setEditingLogId(null);
                          }}
                          className="text-blue-600 hover:text-blue-900 p-0.5 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {/* Drafter Name */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Drafter / Staff Name
                          </label>
                          <input
                            type="text"
                            value={formDrafterName}
                            onChange={(e) => setFormDrafterName(e.target.value)}
                            placeholder="e.g. Sarah Jenkins"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* Category Dropdown */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Billing Category
                          </label>
                          <select
                            value={formCategory}
                            onChange={(e) => {
                              const cat = e.target.value;
                              setFormCategory(cat);
                              if (cat.includes('Jason') || cat.includes('Kyle')) {
                                setFormRate('125');
                              } else if (cat.includes('Custom Work')) {
                                setFormRate('95');
                              }
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          >
                            <option value="Standard Offline CAD Drafting">Standard Offline CAD Drafting ($85/hr)</option>
                            <option value="Revisions Exceeded Plan Scope">Revisions Exceeded Plan Scope ($85/hr)</option>
                            <option value="1-on-1 Consultation with Jason">1-on-1 Consultation with Jason ($125/hr)</option>
                            <option value="1-on-1 Consultation with Kyle">1-on-1 Consultation with Kyle ($125/hr)</option>
                            <option value="Out-of-Scope Custom Work">Out-of-Scope Custom Work ($95/hr)</option>
                            <option value="Structural Details & Foundation">Structural Details & Foundation ($85/hr)</option>
                            <option value="Electrical & Reflected Ceiling">Electrical & Reflected Ceiling ($85/hr)</option>
                            <option value="Other Additional Work">Other Additional Work</option>
                          </select>
                        </div>

                        {/* Hours */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Hours Worked
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            min="0.05"
                            value={formHours}
                            onChange={(e) => setFormHours(e.target.value)}
                            placeholder="e.g. 2.50"
                            className="w-full px-3 py-1.5 font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* Rate */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Rate ($/hr)
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold">$</span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={formRate}
                              onChange={(e) => setFormRate(e.target.value)}
                              placeholder="85"
                              className="w-full pl-6 pr-3 py-1.5 font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quick Hours Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="text-slate-500 font-mono">Quick Hours:</span>
                        {['0.5', '1.0', '1.5', '2.0', '2.5', '3.0', '4.0', '8.0'].map(h => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setFormHours(h)}
                            className={`px-2 py-0.5 rounded font-mono border transition ${
                              formHours === h
                                ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {h}h
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const cur = parseFloat(formHours) || 1.0;
                            setFormHours((cur + 0.25).toFixed(2));
                          }}
                          className="px-2 py-0.5 rounded font-mono bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 font-semibold"
                        >
                          +0.25h
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                        {/* Task Description */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Task Description / Line Item Label
                          </label>
                          <input
                            type="text"
                            value={formDescription}
                            onChange={(e) => setFormDescription(e.target.value)}
                            placeholder="e.g. Master bath layout expansion & plumbing relocated via Zoom consult"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* Date */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Logged Date
                          </label>
                          <input
                            type="date"
                            value={formDate}
                            onChange={(e) => setFormDate(e.target.value)}
                            className="w-full px-3 py-1.5 font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Summary & Submit */}
                      <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                        <div className="text-xs font-mono text-blue-950 font-bold">
                          Line Total: ${( (parseFloat(formHours) || 0) * (parseFloat(formRate) || 0) ).toFixed(2)}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingTimeLog(false);
                              setEditingLogId(null);
                            }}
                            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{editingLogId ? 'Update Session' : 'Add to Invoice'}</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  {/* Time Entries Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 text-white font-mono text-[10px] uppercase">
                        <tr>
                          <th className="p-2.5 sm:p-3">Drafter / Staff</th>
                          <th className="p-2.5 sm:p-3">Session Description & Category</th>
                          <th className="p-2.5 sm:p-3 text-center">Date</th>
                          <th className="p-2.5 sm:p-3 text-center">Hours</th>
                          <th className="p-2.5 sm:p-3 text-right">Rate</th>
                          <th className="p-2.5 sm:p-3 text-right">Total</th>
                          <th className="p-2.5 sm:p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {timeLogs.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                              No individual time sessions currently recorded. Click "+ Add Time Session" to insert drafting time.
                            </td>
                          </tr>
                        ) : (
                          timeLogs.map((log, index) => {
                            const logSecs = typeof log.billableHours === 'number' 
                              ? Math.round(log.billableHours * 3600) 
                              : (log.durationSeconds || (log.rawInputHours ? log.rawInputHours * 3600 : 0));
                            const logHrs = logSecs / 3600;
                            const logRate = log.hourlyRate || hourlyRate || 85;
                            const logTotal = log.billableAmount || (logHrs * logRate);

                            const isKyleOrJason = (log.billingCategory || '').includes('Jason') || (log.billingCategory || '').includes('Kyle');

                            return (
                              <tr key={log.id || index} className="hover:bg-slate-50 transition text-slate-800">
                                <td className="p-2.5 sm:p-3 font-semibold whitespace-nowrap">
                                  {log.drafterName}
                                </td>

                                <td className="p-2.5 sm:p-3">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-900">
                                        {log.taskDescription || 'CAD Drafting'}
                                      </span>
                                      {log.billingCategory && (
                                        <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded border ${
                                          isKyleOrJason
                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                          {log.billingCategory}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                <td className="p-2.5 sm:p-3 text-center font-mono text-slate-500 text-[11px] whitespace-nowrap">
                                  {log.startTime ? new Date(log.startTime).toLocaleDateString() : 'N/A'}
                                </td>

                                <td className="p-2.5 sm:p-3 text-center font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {logHrs.toFixed(2)} hrs
                                </td>

                                <td className="p-2.5 sm:p-3 text-right font-mono text-slate-600 whitespace-nowrap">
                                  ${logRate.toFixed(2)}/hr
                                </td>

                                <td className="p-2.5 sm:p-3 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
                                  ${logTotal.toFixed(2)}
                                </td>

                                <td className="p-2.5 sm:p-3 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditTimeLog(log)}
                                      className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded-md transition"
                                      title="Edit this time entry"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTimeLog(log.id)}
                                      className="p-1 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-md transition"
                                      title="Delete this time entry"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={showItemizedLogs}
                        onChange={(e) => setShowItemizedLogs(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Print itemized time session table on official customer invoice</span>
                    </label>

                    <span className="font-mono text-[11px] text-slate-500">
                      Total {timeLogs.length} line items • Sum: ${grossBillableTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* SUB-TAB 2: RATES & UPFRONT DEPOSIT                        */}
              {/* ========================================================= */}
              {activeEditTab === 'financials' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-200 pb-2">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>Billing Rates, Deposit Retainer & Payment Calculations</span>
                    </h5>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure base drafting rates and record any upfront deposit collected from the client to deduct from the net due.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Hourly Rate Box */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Default Drafting Hourly Rate ($/hr)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 font-mono font-bold text-slate-400">$</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 85)}
                          className="w-full pl-7 pr-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Default company rate for standard drafting is $85/hr. 1-on-1 consultations with Jason or Kyle bill at $125/hr.
                      </p>
                    </div>

                    {/* Deposit Retainer Box */}
                    <div className={`p-4 rounded-xl border space-y-3 ${
                      depositCollected ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={depositCollected}
                            onChange={(e) => setDepositCollected(e.target.checked)}
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-900">
                            Upfront Retainer / Deposit Collected
                          </span>
                        </label>
                        {depositCollected && (
                          <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                            Deduct from Net Due
                          </span>
                        )}
                      </div>

                      {depositCollected && (
                        <div className="space-y-3 pt-2 animate-in fade-in">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                Deposit Amount ($)
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 font-mono font-bold text-slate-400">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={depositAmount}
                                  onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                                  className="w-full pl-7 pr-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                Date Collected
                              </label>
                              <input
                                type="date"
                                value={depositDate}
                                onChange={(e) => setDepositDate(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                              Payment Reference / Notes
                            </label>
                            <input
                              type="text"
                              value={depositNotes}
                              onChange={(e) => setDepositNotes(e.target.value)}
                              placeholder="e.g. Check #1042 / Stripe 50% retainer"
                              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Breakdown Live Summary */}
                  <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Gross Billable Subtotal</span>
                      <strong className="text-sm font-bold text-white">${grossBillableTotal.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-400 block text-[10px] uppercase font-semibold">Less Deposit Retainer</span>
                      <strong className="text-sm font-bold text-emerald-300">
                        {depositCollected ? `-$${effectiveDepositAmount.toFixed(2)}` : '$0.00'}
                      </strong>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg border border-slate-700">
                      <span className="text-blue-400 block text-[10px] uppercase font-bold">Net Balance Due</span>
                      <strong className="text-base font-bold text-white">${netBalanceDue.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* SUB-TAB 3: INVOICE TERMS & PAYMENT LINK                   */}
              {/* ========================================================= */}
              {activeEditTab === 'invoice_terms' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-200 pb-2">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Invoice Metadata, Payment Terms & Online Links</span>
                    </h5>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Edit the official invoice number, issue date, due date terms, and online payment destination URL.
                    </p>
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
                        Due Date
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
                        value={invoiceStatus}
                        onChange={(e) => {
                          const newStat = e.target.value as InvoiceStatus;
                          setInvoiceStatus(newStat);
                          if (onDispatchNotifications) {
                            const { newNotifications } = applyInvoiceStatusTransition(job, newStat, currentStaff);
                            if (newNotifications.length > 0) {
                              onDispatchNotifications(newNotifications);
                            }
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

                  {/* Due Date Quick Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="text-slate-500 font-mono">Payment Terms Preset:</span>
                    {[
                      { label: 'Net 7 Business Days (Standard)', days: 7 },
                      { label: 'Net 14 Days', days: 14 },
                      { label: 'Net 30 Days', days: 30 },
                      { label: 'Due On Receipt (0 Days)', days: 0 }
                    ].map((term) => (
                      <button
                        key={term.days}
                        type="button"
                        onClick={() => {
                          setDueDate(calculateBusinessDueDate(invoiceDate, term.days));
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md font-medium transition cursor-pointer"
                      >
                        {term.label}
                      </button>
                    ))}
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
                        Custom Remittance Notes & Terms
                      </label>
                      <input
                        type="text"
                        value={invoiceNotes}
                        onChange={(e) => setInvoiceNotes(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* SUB-TAB 4: CUSTOMER & PLAN SPECS                          */}
              {/* ========================================================= */}
              {activeEditTab === 'customer_plan' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-200 pb-2">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-blue-600" />
                      <span>Customer Contact Info & Plan Package Specifications</span>
                    </h5>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Adjust client billing details or house plan package specifications printed on this invoice sheet.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Customer Info Card */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <h6 className="font-bold text-xs text-slate-900 uppercase">Customer Information</h6>
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Customer / Entity Name</label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Customer Email</label>
                          <input
                            type="email"
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Customer Phone</label>
                          <input
                            type="text"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Site / Lot Description</label>
                          <input
                            type="text"
                            value={lotDetails}
                            onChange={(e) => setLotDetails(e.target.value)}
                            placeholder="e.g. Lot 14, Whispering Pines Subdivision"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Plan Specs Card */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <h6 className="font-bold text-xs text-slate-900 uppercase">Plan & Project Specifications</h6>
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">House Style / Package Title</label>
                          <input
                            type="text"
                            value={planStyle}
                            onChange={(e) => setPlanStyle(e.target.value)}
                            placeholder="e.g. Modern Farmhouse Plan Package"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Total Heated Area (sq ft)</label>
                          <input
                            type="number"
                            value={sqFt}
                            onChange={(e) => setSqFt(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Current Phase</label>
                          <input
                            type="text"
                            value={currentPhase}
                            onChange={(e) => setCurrentPhase(e.target.value as JobPhase)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Assigned Drafter / PM</label>
                          <input
                            type="text"
                            value={assignedDrafter}
                            onChange={(e) => setAssignedDrafter(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                    {customerName}
                  </h3>
                  <div className="text-xs text-slate-600 space-y-0.5 pt-0.5">
                    {customerEmail && (
                      <p className="font-mono text-slate-800">{customerEmail}</p>
                    )}
                    {customerPhone && (
                      <p className="font-mono text-slate-800">{customerPhone}</p>
                    )}
                    {lotDetails && (
                      <p className="text-slate-600">Site/Lot: {lotDetails}</p>
                    )}
                  </div>
                </div>

                {/* Project Specs */}
                <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-5">
                  <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider block">
                    PROJECT / PLAN SPECIFICATIONS
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    {planStyle} Plan Package
                  </h4>
                  <div className="text-xs text-slate-600 space-y-0.5 pt-0.5">
                    <p>Total Heated Area: <strong>{sqFt.toLocaleString()} sq ft</strong></p>
                    <p>Current Phase: <strong>{currentPhase}</strong></p>
                    <p>Assigned Drafter / PM: <strong>{assignedDrafter}</strong></p>
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
                            Custom residential plan creation for {customerName} (#{job.job_number} - {planStyle}, {sqFt} sq ft)
                          </span>
                        </td>
                        <td className="p-2.5 sm:p-3 text-center font-mono text-slate-600">
                          {assignedDrafter.split(',')[0]}
                        </td>
                        <td className="p-2.5 sm:p-3 text-center font-mono font-bold">
                          {totalCalculatedHours.toFixed(2)} hrs
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
                        const logSecs = typeof log.billableHours === 'number' 
                          ? Math.round(log.billableHours * 3600) 
                          : (log.durationSeconds || (log.rawInputHours ? log.rawInputHours * 3600 : 0));
                        const logHrs = logSecs / 3600;
                        const logRate = log.hourlyRate || hourlyRate || 85;
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
                      depositCollected && effectiveDepositAmount > 0
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      <div className="font-sans">
                        <span className="font-bold block">Less Upfront Deposit:</span>
                        {depositNotes && (
                          <span className="text-[10px] text-emerald-700 block font-normal">
                            ({depositNotes})
                          </span>
                        )}
                      </div>
                      <strong className="font-bold text-sm">
                        {depositCollected && effectiveDepositAmount > 0 ? `-$${effectiveDepositAmount.toFixed(2)}` : '$0.00'}
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
