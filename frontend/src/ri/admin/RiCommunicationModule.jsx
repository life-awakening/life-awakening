import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API_BASE_URL from '@/config/apiConfig';
import {
  Mail, Send, Eye, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw,
  Search, Filter, Calendar, Users, User, ShieldCheck, MapPin, Compass,
  Award, Clock, ArrowRight, RotateCcw, X, Check, ChevronLeft, ChevronRight,
  FileText, History, Info, Sparkles, Building, Layers, CheckCircle
} from 'lucide-react';

const API = API_BASE_URL;

const RI_TEMPLATES = {
  welcome: {
    id: 'welcome',
    name: 'Welcome & Portal Access',
    desc: 'Student & Faculty Onboarding',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    subject: 'Welcome to Rural Immersion Program - Batch {{batch_name}}',
    body: `Dear {{name}},

Welcome to the Rural Immersion Program for {{batch_name}}.

Rural Immersion is a transformative experiential learning curriculum organized by the School of Government at MIT World Peace University. You have been assigned to Panel {{panel}}, allocated to Village {{village}}.

Program Schedule:
• Start Date: {{start_date}}
• End Date: {{end_date}}
• Student ID / Code: {{ri_id}}

To access your student portal, view your village assignments, complete the pre-departure checklist, and review essential guidelines, please log in below:
{{login_url}}

Please ensure you review all instructions and submit the required undertakings prior to departure.

Warm regards,
Rural Immersion Administration
MIT World Peace University, Pune`
  },
  travel: {
    id: 'travel',
    name: 'Travel & Departure Info',
    desc: 'Departure & Bus Logistics',
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
    subject: 'Rural Immersion Travel & Departure Details - Batch {{batch_name}}',
    body: `Dear {{name}},

This is an important update regarding travel and departure for your upcoming Rural Immersion journey for {{batch_name}}.

Reporting & Departure Details:
• Reporting Venue: MIT-WPU Kothrud Campus (Bus Bay Area)
• Departure Date: {{start_date}}
• Allocated Village: {{village}}
• Panel: {{panel}}

Key Travel Instructions:
• Please report promptly at the assigned assembly point 45 minutes before departure.
• Keep your university ID card and government photo identification accessible.
• Carry minimal luggage (one duffel/backpack and one personal kit).
• Review the Things to Carry checklist on your student portal: {{login_url}}

If you have any emergency queries, contact your designated Faculty Mentor or Nodal Officer immediately.

Best regards,
Travel & Logistics Desk, Rural Immersion
MIT-WPU Pune`
  },
  instructions: {
    id: 'instructions',
    name: 'Pre-Departure Guidelines',
    desc: 'Field Protocols & Conduct',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    subject: 'Rural Immersion Pre-Departure Guidelines & Protocols - Batch {{batch_name}}',
    body: `Dear {{name}},

As you prepare for the Rural Immersion Program in {{village}}, please carefully read and adhere to the following field study guidelines:

Field Conduct & Safety:
• Respect the cultural traditions and social norms of the village community.
• Maintain professional decorum during interactions with villagers, Sarpanch, and local leaders.
• Follow all instructions given by your Faculty Mentor and local coordinator.
• Adhere to village curfew timings and never leave your designated village area alone.
• Strictly maintain field diaries and complete daily activity documentation.

Access your portal to verify readiness and complete all preparatory verifications:
{{login_url}}

Rural Immersion Academic Committee
MIT World Peace University`
  },
  reminders: {
    id: 'reminders',
    name: 'Readiness Reminders',
    desc: 'Undertaking & Form Alerts',
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
    subject: 'Urgent Reminder: Complete Rural Immersion Verifications - Batch {{batch_name}}',
    body: `Dear {{name}},

This is a reminder that the Rural Immersion program for {{batch_name}} commences on {{start_date}}.

Our records indicate that you may still have pending items on your preparatory checklist. Please complete the following as soon as possible:
1. Sign and submit your Student Undertaking Form.
2. Verify emergency contact details and medical information.
3. Complete the Pre-Departure Readiness Checklist on the student portal.

Portal Link:
{{login_url}}

Failure to submit mandatory undertakings may lead to withholding of field departure clearance.

Regards,
RI Administrative Office
MIT-WPU Pune`
  },
  announcement: {
    id: 'announcement',
    name: 'General Announcement',
    desc: 'Custom Program Notice',
    color: '#0d9488',
    bg: '#f0fdfa',
    border: '#99f6e4',
    subject: 'Important Announcement: Rural Immersion Program - Batch {{batch_name}}',
    body: `Dear {{name}},

We would like to share an important announcement regarding your Rural Immersion Program for {{batch_name}} (Village: {{village}}).

[Enter announcement details here]

Please log in to your portal for further information and updates:
{{login_url}}

Sincerely,
Rural Immersion Program Office
MIT World Peace University`
  }
};

export default function RiCommunicationModule({ initialView = 'sender', isMobile = false }) {
  const [currentView, setCurrentView] = useState(initialView); // 'sender' | 'logs'
  const token = localStorage.getItem('token') || '';

  // Auth fetch helper
  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }), [token]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SENDER CONSOLE STATE
  // ─────────────────────────────────────────────────────────────────────────────
  const [sendMode, setSendMode] = useState('batch'); // 'batch' | 'manual'
  const [riBatches, setRiBatches] = useState([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [batchRecipients, setBatchRecipients] = useState({ students: [], faculty: [], parents: [] });
  const [recipientCounts, setRecipientCounts] = useState({ total_unique: 0, students: 0, faculty: 0, parents: 0 });
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);

  // Target Role Filters for batch send
  const [targetRoles, setTargetRoles] = useState({
    student: true,
    faculty: true,
    parent: false
  });

  // Template & Message Content
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('welcome');
  const [emailSubject, setEmailSubject] = useState(RI_TEMPLATES.welcome.subject);
  const [emailBody, setEmailBody] = useState(RI_TEMPLATES.welcome.body);
  const [isTemplateDirty, setIsTemplateDirty] = useState(false);

  // Manual Email Sender State
  const [manualEmailsInput, setManualEmailsInput] = useState('');
  const [manualInputCurrent, setManualInputCurrent] = useState('');

  // Preview Role Switcher
  const [previewRole, setPreviewRole] = useState('student'); // 'student' | 'faculty' | 'parent'

  // Sending State & Feedback
  const [isSending, setIsSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sendResults, setSendResults] = useState(null);
  const [sendError, setSendError] = useState('');

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. EMAIL AUDIT LOGS STATE
  // ─────────────────────────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditSummary, setAuditSummary] = useState({ total_logs: 0, total_sent: 0, total_failed: 0 });
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsStatusFilter, setLogsStatusFilter] = useState('all');
  const [logsTemplateFilter, setLogsTemplateFilter] = useState('all');
  const [logsDateFilter, setLogsDateFilter] = useState('all');
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsTotalCount, setLogsTotalCount] = useState(0);

  // Update view when prop changes
  useEffect(() => {
    if (initialView) {
      setCurrentView(initialView === 'logs' || initialView === 'communication_logs' ? 'logs' : 'sender');
    }
  }, [initialView]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH RI-ONLY BATCHES
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchRiBatches = useCallback(async () => {
    setIsLoadingBatches(true);
    try {
      const res = await fetch(`${API}/api/ri/communication/batches`, { headers: authHeaders });
      const data = await res.json();
      if (res.ok && data.batches) {
        setRiBatches(data.batches);
        if (data.batches.length > 0 && !selectedBatchId) {
          setSelectedBatchId(String(data.batches[0].id));
        }
      }
    } catch (err) {
      console.error('Failed to load RI batches:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  }, [authHeaders, selectedBatchId]);

  useEffect(() => {
    fetchRiBatches();
  }, [fetchRiBatches]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH BATCH RECIPIENTS (WHEN BATCH ID CHANGES)
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchBatchRecipients = useCallback(async (bId) => {
    if (!bId) {
      setBatchRecipients({ students: [], faculty: [], parents: [] });
      setRecipientCounts({ total_unique: 0, students: 0, faculty: 0, parents: 0 });
      return;
    }
    setIsLoadingRecipients(true);
    try {
      const res = await fetch(`${API}/api/ri/communication/recipients?batch_id=${bId}`, { headers: authHeaders });
      const data = await res.json();
      if (res.ok && data.recipients) {
        setBatchRecipients(data.recipients);
        setRecipientCounts(data.counts || { total_unique: 0, students: 0, faculty: 0, parents: 0 });
      } else {
        setBatchRecipients({ students: [], faculty: [], parents: [] });
        setRecipientCounts({ total_unique: 0, students: 0, faculty: 0, parents: 0 });
      }
    } catch (err) {
      console.error('Failed to load batch recipients:', err);
    } finally {
      setIsLoadingRecipients(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (selectedBatchId) {
      fetchBatchRecipients(selectedBatchId);
    }
  }, [selectedBatchId, fetchBatchRecipients]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH EMAIL AUDIT LOGS
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchAuditLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(logsPage),
        limit: '15',
        search: logsSearch,
        status: logsStatusFilter,
        template: logsTemplateFilter,
        dateRange: logsDateFilter
      });

      const res = await fetch(`${API}/api/ri/communication/logs?${queryParams.toString()}`, {
        headers: authHeaders
      });
      const data = await res.json();
      if (res.ok && data.logs) {
        setAuditLogs(data.logs);
        setLogsTotalPages(data.totalPages || 1);
        setLogsTotalCount(data.total || 0);
        if (data.summary) setAuditSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to load RI email logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [authHeaders, logsPage, logsSearch, logsStatusFilter, logsTemplateFilter, logsDateFilter]);

  useEffect(() => {
    if (currentView === 'logs') {
      fetchAuditLogs();
    }
  }, [currentView, fetchAuditLogs]);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEMPLATE SELECTION HANDLER
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSelectTemplate = (templateKey) => {
    const t = RI_TEMPLATES[templateKey];
    if (t) {
      setSelectedTemplateKey(templateKey);
      setEmailSubject(t.subject);
      setEmailBody(t.body);
      setIsTemplateDirty(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // MANUAL EMAIL INPUT PARSER & VALIDATOR
  // ─────────────────────────────────────────────────────────────────────────────
  const parsedManualEmails = useMemo(() => {
    if (!manualEmailsInput.trim()) return { valid: [], invalid: [] };
    const rawTokens = manualEmailsInput.split(/[\s,;\n\r\t]+/).filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = [];
    const invalid = [];
    const seen = new Set();

    rawTokens.forEach(token => {
      const cleaned = token.trim().toLowerCase();
      if (!cleaned) return;
      if (emailRegex.test(cleaned)) {
        if (!seen.has(cleaned)) {
          seen.add(cleaned);
          valid.push(cleaned);
        }
      } else {
        if (!invalid.includes(cleaned)) {
          invalid.push(cleaned);
        }
      }
    });

    return { valid, invalid };
  }, [manualEmailsInput]);

  const addManualEmailChip = (val) => {
    const trimmed = (val || '').trim();
    if (!trimmed) return;
    const currentList = parsedManualEmails.valid;
    const itemsToAdd = trimmed.split(/[\s,;\n\r\t]+/).filter(Boolean);
    const updated = [...new Set([...currentList, ...itemsToAdd])];
    setManualEmailsInput(updated.join(', '));
    setManualInputCurrent('');
  };

  const removeManualEmailChip = (emailToRemove) => {
    const updated = parsedManualEmails.valid.filter(e => e !== emailToRemove);
    setManualEmailsInput(updated.join(', '));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPUTED RECIPIENTS TO SEND
  // ─────────────────────────────────────────────────────────────────────────────
  const eligibleRecipientsList = useMemo(() => {
    if (sendMode === 'manual') {
      return parsedManualEmails.valid.map(email => ({
        email,
        name: email.split('@')[0],
        role: 'manual'
      }));
    }

    const list = [];
    const seen = new Set();

    if (targetRoles.student && batchRecipients.students) {
      batchRecipients.students.forEach(s => {
        if (s.email && !seen.has(s.email.toLowerCase())) {
          seen.add(s.email.toLowerCase());
          list.push(s);
        }
      });
    }

    if (targetRoles.faculty && batchRecipients.faculty) {
      batchRecipients.faculty.forEach(f => {
        if (f.email && !seen.has(f.email.toLowerCase())) {
          seen.add(f.email.toLowerCase());
          list.push(f);
        }
      });
    }

    if (targetRoles.parent && batchRecipients.parents) {
      batchRecipients.parents.forEach(p => {
        if (p.email && !seen.has(p.email.toLowerCase())) {
          seen.add(p.email.toLowerCase());
          list.push(p);
        }
      });
    }

    return list;
  }, [sendMode, parsedManualEmails, targetRoles, batchRecipients]);

  // Selected Batch Object
  const currentBatchObj = useMemo(() => {
    return riBatches.find(b => String(b.id) === String(selectedBatchId)) || null;
  }, [riBatches, selectedBatchId]);

  // ─────────────────────────────────────────────────────────────────────────────
  // LIVE EMAIL PREVIEW PARSING
  // ─────────────────────────────────────────────────────────────────────────────
  const sampleRecipient = useMemo(() => {
    if (sendMode === 'manual') {
      return {
        name: parsedManualEmails.valid[0] ? parsedManualEmails.valid[0].split('@')[0] : 'Manual Recipient',
        role: 'manual',
        email: parsedManualEmails.valid[0] || 'recipient@example.com',
        village_name: 'Village Example',
        panel_name: 'Panel P-01',
        ri_id: 'RI-2026-001'
      };
    }

    if (previewRole === 'faculty') {
      return batchRecipients.faculty[0] || {
        name: 'Dr. Faculty Mentor',
        role: 'faculty',
        email: 'faculty.mentor@mitwpu.edu.in',
        village_name: 'Velhe Village',
        panel_name: 'Panel P-01',
        ri_id: 'N/A'
      };
    }

    if (previewRole === 'parent') {
      return batchRecipients.parents[0] || {
        name: 'Parent of Student',
        role: 'parent',
        email: 'parent.contact@gmail.com',
        village_name: 'Velhe Village',
        panel_name: 'Panel P-01',
        ri_id: 'RI-01'
      };
    }

    return batchRecipients.students[0] || {
      name: 'Aditya Deshpande',
      role: 'student',
      email: 'aditya.deshpande@mitwpu.edu.in',
      village_name: 'Velhe Village',
      panel_name: 'Panel P-01',
      ri_id: 'RI-01'
    };
  }, [sendMode, parsedManualEmails, previewRole, batchRecipients]);

  const previewSubject = useMemo(() => {
    const roleName = sampleRecipient.role === 'student' ? 'Student' : (sampleRecipient.role === 'faculty' ? 'Faculty Mentor' : (sampleRecipient.role === 'parent' ? 'Parent' : 'Participant'));
    const batchName = currentBatchObj?.name || 'RI Direct Cohort';
    return (emailSubject || '')
      .replace(/{{name}}/g, sampleRecipient.name || '')
      .replace(/{{role}}/g, roleName)
      .replace(/{{batch_name}}/g, batchName)
      .replace(/{{village}}/g, sampleRecipient.village_name || 'Assigned Village')
      .replace(/{{panel}}/g, sampleRecipient.panel_name || 'Assigned Panel')
      .replace(/{{ri_id}}/g, sampleRecipient.ri_id || 'RI-01')
      .replace(/{{email}}/g, sampleRecipient.email || '')
      .replace(/{{start_date}}/g, currentBatchObj?.start_date ? new Date(currentBatchObj.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '01 Aug 2026')
      .replace(/{{end_date}}/g, currentBatchObj?.end_date ? new Date(currentBatchObj.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '15 Aug 2026')
      .replace(/{{login_url}}/g, typeof window !== 'undefined' ? `${window.location.origin}/login` : 'http://13.207.119.57/login');
  }, [emailSubject, sampleRecipient, currentBatchObj]);

  const previewBodyFormatted = useMemo(() => {
    const roleName = sampleRecipient.role === 'student' ? 'Student' : (sampleRecipient.role === 'faculty' ? 'Faculty Mentor' : (sampleRecipient.role === 'parent' ? 'Parent' : 'Participant'));
    const batchName = currentBatchObj?.name || 'RI Direct Cohort';
    const text = (emailBody || '')
      .replace(/{{name}}/g, sampleRecipient.name || '')
      .replace(/{{role}}/g, roleName)
      .replace(/{{batch_name}}/g, batchName)
      .replace(/{{village}}/g, sampleRecipient.village_name || 'Assigned Village')
      .replace(/{{panel}}/g, sampleRecipient.panel_name || 'Assigned Panel')
      .replace(/{{ri_id}}/g, sampleRecipient.ri_id || 'RI-01')
      .replace(/{{email}}/g, sampleRecipient.email || '')
      .replace(/{{start_date}}/g, currentBatchObj?.start_date ? new Date(currentBatchObj.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '01 Aug 2026')
      .replace(/{{end_date}}/g, currentBatchObj?.end_date ? new Date(currentBatchObj.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '15 Aug 2026')
      .replace(/{{login_url}}/g, typeof window !== 'undefined' ? `${window.location.origin}/login` : 'http://13.207.119.57/login');

    return text.split('\n\n').map((para, idx) => (
      <p key={idx} style={{ margin: '0 0 12px 0', lineHeight: 1.6, whiteSpace: 'pre-line', fontSize: '13.5px', color: '#334155' }}>
        {para}
      </p>
    ));
  }, [emailBody, sampleRecipient, currentBatchObj]);

  // ─────────────────────────────────────────────────────────────────────────────
  // DISPATCH EMAILS (SEND ACTION)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleTriggerSend = async () => {
    setSendError('');
    setIsSending(true);

    try {
      const activeRoles = Object.keys(targetRoles).filter(r => targetRoles[r]);

      const payload = {
        subject: emailSubject,
        body: emailBody,
        templateKey: selectedTemplateKey,
        dryRun: false // Uses standard Resend service with safety/mock guards if email disabled
      };

      if (sendMode === 'manual') {
        payload.manualEmails = parsedManualEmails.valid.join(', ');
      } else {
        payload.batchId = parseInt(selectedBatchId, 10);
        payload.targetRoles = activeRoles;
      }

      const res = await fetch(`${API}/api/ri/communication/send`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send emails.');
      }

      setSendResults(data);
      setShowConfirmModal(false);
      // Refresh audit logs in background
      fetchAuditLogs();
    } catch (err) {
      setSendError(err.message || 'An error occurred during email transmission.');
    } finally {
      setIsSending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Top Header & View Switcher */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: isMobile ? '14px 16px' : '18px 24px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: '#ecfdf5',
            color: '#047857',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #a7f3d0'
          }}>
            <Mail size={22} />
          </div>
        </div>

        {/* View Switcher Pills */}
        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          gap: '4px'
        }}>
          <button
            type="button"
            onClick={() => setCurrentView('sender')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '8px',
              border: 'none',
              background: currentView === 'sender' ? '#ffffff' : 'transparent',
              color: currentView === 'sender' ? '#047857' : '#64748b',
              fontWeight: currentView === 'sender' ? '700' : '600',
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: currentView === 'sender' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Send size={14} />
            <span>Sender Console</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('logs')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '8px',
              border: 'none',
              background: currentView === 'logs' ? '#ffffff' : 'transparent',
              color: currentView === 'logs' ? '#047857' : '#64748b',
              fontWeight: currentView === 'logs' ? '700' : '600',
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: currentView === 'logs' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <History size={14} />
            <span>Email Audit Logs</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* VIEW 1: SENDER CONSOLE */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {currentView === 'sender' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Success / Result Feedback Banner */}
          {sendResults && (
            <div style={{
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              borderRadius: '14px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <CheckCircle2 size={22} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#166534' }}>
                    Email Dispatch Completed!
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#15803d' }}>
                    Total Processed: <strong>{sendResults.total}</strong> | Successfully Dispatched: <strong>{sendResults.sent}</strong>
                    {sendResults.failed > 0 && ` | Failed: ${sendResults.failed}`}
                    {sendResults.isMock && ' (Delivered via Mock/Simulated Provider Mode)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSendResults(null)}
                style={{ background: 'transparent', border: 'none', color: '#15803d', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Template Selection Carousel / Grid */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: isMobile ? '14px' : '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Choose Rural Immersion Email Template
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Select an official template to prefill standard subjects, instructions, and placeholder variables.
                </span>
              </div>
              {isTemplateDirty && (
                <button
                  type="button"
                  onClick={() => handleSelectTemplate(selectedTemplateKey)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#047857',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    padding: '5px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Reset Template</span>
                </button>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px'
            }}>
              {Object.keys(RI_TEMPLATES).map(key => {
                const t = RI_TEMPLATES[key];
                const isSelected = selectedTemplateKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectTemplate(key)}
                    style={{
                      background: isSelected ? t.bg : '#ffffff',
                      borderRadius: '12px',
                      border: isSelected ? `2px solid ${t.color}` : '1px solid #e2e8f0',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '85px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: isSelected ? `0 4px 12px ${t.color}20` : 'none',
                      transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                      transform: isSelected ? 'translateY(-2px)' : 'none'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: isSelected ? '#0f172a' : '#334155' }}>
                          {t.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', display: 'block', marginTop: '3px' }}>
                        {t.desc}
                      </span>
                    </div>

                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                      {isSelected && (
                        <span style={{
                          fontSize: '9.5px',
                          fontWeight: '800',
                          background: t.color,
                          color: '#ffffff',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px'
                        }}>
                          Selected
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode Selector: Batch vs Manual Entry */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#ffffff',
            padding: '8px 12px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            width: 'fit-content'
          }}>
            <span style={{ fontSize: '12px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Dispatch Mode:
            </span>
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '2px' }}>
              <button
                type="button"
                onClick={() => setSendMode('batch')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: sendMode === 'batch' ? '#047857' : 'transparent',
                  color: sendMode === 'batch' ? '#ffffff' : '#64748b',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Batch Dispatch (RI-Only)
              </button>
              <button
                type="button"
                onClick={() => setSendMode('manual')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: sendMode === 'manual' ? '#047857' : 'transparent',
                  color: sendMode === 'manual' ? '#ffffff' : '#64748b',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Manual Recipient Entry
              </button>
            </div>
          </div>

          {/* Main Two-Column Layout: Form (Left) & Live Preview (Right) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(340px, 1.15fr) minmax(320px, 0.85fr)',
            gap: '20px',
            alignItems: 'start'
          }}>
            {/* LEFT COLUMN: Sender Configuration Form */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: isMobile ? '16px' : '22px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                {sendMode === 'batch' ? 'Cohort Recipient Selection' : 'Direct Manual Recipient Entry'}
              </h3>

              {/* MODE A: BATCH SELECTOR & FILTERS */}
              {sendMode === 'batch' ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Target RI-Only Batch *
                    </label>
                    {isLoadingBatches ? (
                      <div style={{ padding: '10px', fontSize: '13px', color: '#64748b' }}>Loading RI cohorts...</div>
                    ) : riBatches.length === 0 ? (
                      <div style={{
                        background: '#fef3c7',
                        border: '1px solid #fde68a',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        fontSize: '12.5px',
                        color: '#92400e',
                        lineHeight: 1.5
                      }}>
                        <strong>Notice:</strong> No RI-only batches found. Batches synced from LTC are strictly excluded from this module. Please create a direct RI batch under <em>Batches</em> to dispatch cohort emails.
                      </div>
                    ) : (
                      <select
                        value={selectedBatchId}
                        onChange={(e) => setSelectedBatchId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#0f172a',
                          background: '#f8fafc',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {riBatches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.batch_code || `ID: ${b.id}`}) — {b.total_students || 0} Students, {b.total_faculty || 0} Faculty
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Recipient Roles Filter */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Target Recipient Groups *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        background: targetRoles.student ? '#ecfdf5' : '#f8fafc',
                        border: targetRoles.student ? '1.5px solid #059669' : '1px solid #e2e8f0',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: targetRoles.student ? '#065f46' : '#64748b',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="checkbox"
                          checked={targetRoles.student}
                          onChange={(e) => setTargetRoles(prev => ({ ...prev, student: e.target.checked }))}
                          style={{ accentColor: '#047857', cursor: 'pointer' }}
                        />
                        <span>Students ({recipientCounts.students})</span>
                      </label>

                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        background: targetRoles.faculty ? '#ecfdf5' : '#f8fafc',
                        border: targetRoles.faculty ? '1.5px solid #059669' : '1px solid #e2e8f0',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: targetRoles.faculty ? '#065f46' : '#64748b',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="checkbox"
                          checked={targetRoles.faculty}
                          onChange={(e) => setTargetRoles(prev => ({ ...prev, faculty: e.target.checked }))}
                          style={{ accentColor: '#047857', cursor: 'pointer' }}
                        />
                        <span>Faculty ({recipientCounts.faculty})</span>
                      </label>

                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        background: targetRoles.parent ? '#ecfdf5' : '#f8fafc',
                        border: targetRoles.parent ? '1.5px solid #059669' : '1px solid #e2e8f0',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: targetRoles.parent ? '#065f46' : '#64748b',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="checkbox"
                          checked={targetRoles.parent}
                          onChange={(e) => setTargetRoles(prev => ({ ...prev, parent: e.target.checked }))}
                          style={{ accentColor: '#047857', cursor: 'pointer' }}
                        />
                        <span>Parents ({recipientCounts.parents})</span>
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                /* MODE B: MANUAL EMAIL RECIPIENT INPUT */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                      Recipient Email Address(es) *
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {parsedManualEmails.invalid.length > 0 && (
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', background: '#fee2e2', padding: '1px 7px', borderRadius: '4px' }}>
                          {parsedManualEmails.invalid.length} Invalid
                        </span>
                      )}
                      {parsedManualEmails.valid.length > 0 && (
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', background: '#dcfce7', padding: '1px 7px', borderRadius: '4px' }}>
                          {parsedManualEmails.valid.length} Valid Recipient{parsedManualEmails.valid.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chip Box */}
                  <div style={{
                    minHeight: '60px',
                    padding: '8px',
                    borderRadius: '10px',
                    border: parsedManualEmails.invalid.length > 0 ? '1.5px solid #f87171' : '1px solid #cbd5e1',
                    background: '#ffffff',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    alignItems: 'center'
                  }}>
                    {parsedManualEmails.valid.map(email => (
                      <span
                        key={email}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#065f46',
                          padding: '3px 8px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => removeManualEmailChip(email)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#059669',
                            cursor: 'pointer',
                            padding: 0,
                            lineHeight: 1,
                            fontSize: '13px'
                          }}
                        >
                          &times;
                        </button>
                      </span>
                    ))}

                    <input
                      type="text"
                      value={manualInputCurrent}
                      onChange={(e) => setManualInputCurrent(e.target.value)}
                      onKeyDown={(e) => {
                        if (['Enter', ',', ';'].includes(e.key)) {
                          e.preventDefault();
                          addManualEmailChip(manualInputCurrent);
                        }
                      }}
                      onBlur={() => {
                        if (manualInputCurrent.trim()) {
                          addManualEmailChip(manualInputCurrent);
                        }
                      }}
                      placeholder={parsedManualEmails.valid.length === 0 ? 'Type email and press Enter or Comma...' : 'Add another email...'}
                      style={{
                        flex: 1,
                        minWidth: '160px',
                        border: 'none',
                        outline: 'none',
                        fontSize: '13px',
                        padding: '4px',
                        color: '#0f172a'
                      }}
                    />
                  </div>

                  <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block', marginTop: '6px' }}>
                    Tip: You can paste multiple emails separated by commas, semicolons, or line breaks.
                  </span>
                </div>
              )}

              {/* Subject Input */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Email Subject Line *
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => {
                    setEmailSubject(e.target.value);
                    setIsTemplateDirty(true);
                  }}
                  placeholder="e.g. Welcome to Rural Immersion Program"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    color: '#0f172a',
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Body Textarea */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                    Email Body Content *
                  </label>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                    Available: {'{{name}}, {{village}}, {{panel}}, {{ri_id}}, {{start_date}}'}
                  </span>
                </div>
                <textarea
                  rows={10}
                  value={emailBody}
                  onChange={(e) => {
                    setEmailBody(e.target.value);
                    setIsTemplateDirty(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    lineHeight: '1.55',
                    color: '#0f172a',
                    background: '#ffffff',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Error Alert */}
              {sendError && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: '#991b1b',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} />
                  <span>{sendError}</span>
                </div>
              )}

              {/* Submit Trigger Button */}
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={isSending || eligibleRecipientsList.length === 0}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: eligibleRecipientsList.length === 0 ? '#94a3b8' : '#047857',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: eligibleRecipientsList.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: eligibleRecipientsList.length === 0 ? 'none' : '0 4px 12px rgba(4, 120, 87, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Send size={16} />
                <span>
                  {sendMode === 'manual'
                    ? `Send to ${eligibleRecipientsList.length} Manual Recipient${eligibleRecipientsList.length === 1 ? '' : 's'}`
                    : `Queue Bulk Emails (${eligibleRecipientsList.length} Recipients)`}
                </span>
              </button>
            </div>

            {/* RIGHT COLUMN: Live Branded Email Inbox Preview Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Preview Card Header */}
              <div style={{
                padding: '12px 18px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={16} color="#047857" />
                  <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                    Live Email Inbox Preview
                  </span>
                </div>

                {sendMode === 'batch' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e2e8f0', padding: '2px', borderRadius: '8px' }}>
                    {['student', 'faculty', 'parent'].map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setPreviewRole(role)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: 'none',
                          background: previewRole === role ? '#047857' : 'transparent',
                          color: previewRole === role ? '#ffffff' : '#475569',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          textTransform: 'capitalize'
                        }}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Simulated Email Envelope Bar */}
              <div style={{ padding: '12px 18px', background: '#ffffff', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  <strong>From:</strong> Life Awakening Program &lt;no-reply@lifeawakening.in&gt;
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  <strong>To:</strong> {sampleRecipient.name} &lt;{sampleRecipient.email}&gt;
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                  <strong>Subject:</strong> {previewSubject}
                </div>
              </div>

              {/* Simulated Rendered HTML Canvas */}
              <div style={{ padding: '20px', background: '#f8fafc', overflowY: 'auto', maxHeight: '520px' }}>
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  overflow: 'hidden'
                }}>
                  {/* Branded Banner */}
                  <div style={{
                    background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%)',
                    padding: '24px 20px',
                    textAlign: 'center',
                    color: '#ffffff'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', color: '#a7f3d0' }}>
                      MIT World Peace University
                    </div>
                    <h2 style={{ margin: '4px 0 2px 0', fontSize: '16px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.5px' }}>
                      RURAL IMMERSION PROGRAM
                    </h2>
                    <div style={{ fontSize: '12px', color: '#d1fae5', fontWeight: '500' }}>
                      Official Notification Desk
                    </div>
                  </div>

                  {/* Body Text */}
                  <div style={{ padding: '24px 20px' }}>
                    {previewBodyFormatted}
                  </div>

                  {/* Footer */}
                  <div style={{
                    backgroundColor: '#f8fafc',
                    padding: '14px 20px',
                    textAlign: 'center',
                    fontSize: '11px',
                    color: '#64748b',
                    borderTop: '1px solid #e2e8f0',
                    lineHeight: 1.5
                  }}>
                    This is an official communication from <strong>Rural Immersion Administration</strong>.<br />
                    School of Government & MIT World Peace University, Pune.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CONFIRMATION MODAL TO PREVENT ACCIDENTAL DISPATCH */}
          {showConfirmModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px'
            }}>
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                maxWidth: '460px',
                width: '100%',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#ecfdf5',
                    color: '#047857',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Send size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                      Confirm Email Transmission
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                      Please review recipient counts before dispatching.
                    </p>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Target Cohort / Mode:</span>
                    <strong>{sendMode === 'manual' ? 'Direct Manual Entry' : currentBatchObj?.name || 'RI Direct Batch'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Template:</span>
                    <strong>{RI_TEMPLATES[selectedTemplateKey]?.name || 'Custom'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Unique Recipients:</span>
                    <strong style={{ color: '#047857', fontSize: '14px' }}>{eligibleRecipientsList.length} Recipients</strong>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                  Emails will be logged directly into the RI Email Audit Log. Duplicate addresses will be automatically de-duplicated.
                </p>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    disabled={isSending}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleTriggerSend}
                    disabled={isSending}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isSending ? '#94a3b8' : '#047857',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: isSending ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isSending ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Proceed & Send</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* VIEW 2: EMAIL AUDIT LOGS */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {currentView === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Summary Metric Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
            gap: '14px'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <span style={{ fontSize: '11.5px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                Total RI Emails Sent
              </span>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                {auditSummary.total_logs}
              </div>
              <span style={{ fontSize: '11px', color: '#047857', fontWeight: '600' }}>
                Logged in RI Audit Database
              </span>
            </div>

            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <span style={{ fontSize: '11.5px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                Delivered / Sent
              </span>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a', marginTop: '6px' }}>
                {auditSummary.total_sent}
              </div>
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600' }}>
                Successful Dispatches
              </span>
            </div>

            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <span style={{ fontSize: '11.5px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                Failed / Suppressed
              </span>
              <div style={{ fontSize: '24px', fontWeight: '800', color: auditSummary.total_failed > 0 ? '#dc2626' : '#64748b', marginTop: '6px' }}>
                {auditSummary.total_failed}
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                Provider Rejections or Errors
              </span>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '16px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            {/* Search Box */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '8px 12px',
              minWidth: isMobile ? '100%' : '260px'
            }}>
              <Search size={15} color="#64748b" />
              <input
                type="text"
                value={logsSearch}
                onChange={(e) => {
                  setLogsSearch(e.target.value);
                  setLogsPage(1);
                }}
                placeholder="Search recipient, subject, batch..."
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  width: '100%',
                  color: '#0f172a'
                }}
              />
              {logsSearch && (
                <button
                  type="button"
                  onClick={() => { setLogsSearch(''); setLogsPage(1); }}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
              {/* Status Filter */}
              <select
                value={logsStatusFilter}
                onChange={(e) => { setLogsStatusFilter(e.target.value); setLogsPage(1); }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  color: '#334155',
                  outline: 'none'
                }}
              >
                <option value="all">All Statuses</option>
                <option value="sent">Sent / Delivered</option>
                <option value="failed">Failed</option>
              </select>

              {/* Date Filter */}
              <select
                value={logsDateFilter}
                onChange={(e) => { setLogsDateFilter(e.target.value); setLogsPage(1); }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  color: '#334155',
                  outline: 'none'
                }}
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>

              <button
                type="button"
                onClick={fetchAuditLogs}
                disabled={isLoadingLogs}
                title="Refresh audit logs"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={14} className={isLoadingLogs ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Recipient & Role
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Subject
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Template
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Cohort / Batch
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Timestamp
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Delivery Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingLogs ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block', color: '#047857' }} />
                        <span>Loading RI audit trail records...</span>
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px 24px', textAlign: 'center' }}>
                        <Mail size={36} color="#94a3b8" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: '#334155' }}>
                          No Email Logs Found
                        </h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                          {logsSearch || logsStatusFilter !== 'all'
                            ? 'No delivery records match the specified filters.'
                            : 'No emails have been dispatched from the RI Communication module yet.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => {
                      const isSent = log.status === 'sent' || log.delivery_status === 'sent' || log.delivery_status === 'delivered';
                      const roleBadgeColor = log.recipient_role === 'student' ? '#047857' : (log.recipient_role === 'faculty' ? '#0284c7' : '#7c3aed');

                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover:bg-slate-50">
                          {/* Recipient */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
                              {log.recipient_name}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                              {log.recipient_email}
                            </div>
                            <span style={{
                              display: 'inline-block',
                              marginTop: '3px',
                              fontSize: '10px',
                              fontWeight: '700',
                              color: roleBadgeColor,
                              background: `${roleBadgeColor}15`,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              textTransform: 'uppercase'
                            }}>
                              {log.recipient_role}
                            </span>
                          </td>

                          {/* Subject */}
                          <td style={{ padding: '12px 16px', maxWidth: '240px' }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.subject}>
                              {log.subject}
                            </div>
                          </td>

                          {/* Template */}
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                              {log.template_name}
                            </span>
                          </td>

                          {/* Batch */}
                          <td style={{ padding: '12px 16px', fontSize: '12.5px', color: '#475569' }}>
                            {log.batch_name || '—'}
                          </td>

                          {/* Timestamp */}
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            }) : '—'}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              padding: '3px 9px',
                              borderRadius: '6px',
                              background: isSent ? '#f0fdf4' : '#fef2f2',
                              color: isSent ? '#166534' : '#991b1b',
                              border: isSent ? '1px solid #bbf7d0' : '1px solid #fecaca'
                            }}>
                              {isSent ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                              <span>{isSent ? 'Sent' : 'Failed'}</span>
                            </span>
                            {log.error_message && (
                              <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.error_message}>
                                {log.error_message}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {logsTotalPages > 1 && (
              <div style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc'
              }}>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                  Showing Page <strong>{logsPage}</strong> of <strong>{logsTotalPages}</strong> ({logsTotalCount} total logs)
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                    disabled={logsPage <= 1}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: logsPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: logsPage <= 1 ? 0.6 : 1
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))}
                    disabled={logsPage >= logsTotalPages}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: logsPage >= logsTotalPages ? 'not-allowed' : 'pointer',
                      opacity: logsPage >= logsTotalPages ? 0.6 : 1
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
