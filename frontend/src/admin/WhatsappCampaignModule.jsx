import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Users, Search, Send, RefreshCw, CheckCircle, 
  Smartphone, UploadCloud, CheckSquare 
} from 'lucide-react';

export default function WhatsappCampaignModule({ token, API, toast, batches }) {
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  // Filtering & Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [squadFilter, setSquadFilter] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

  // Manual Entry & Channel Mode
  const [recipientMode, setRecipientMode] = useState('list'); // 'list' or 'manual'
  const [manualPhones, setManualPhones] = useState('');
  const [sendTo, setSendTo] = useState('student'); // 'student', 'parent', 'both'

  // Program Date Inputs
  const [programDates, setProgramDates] = useState({
    ri_start: '',
    ri_end: '',
    lrp_start: '',
    lrp_end: '',
    report_date: '',
    report_time: '04:00 PM',
    collect_date: '',
    return_date: '',
    start_date: '18/02/2026',
    end_date: '12/02/2026',
    channel: 'https://whatsapp.com/channel/0029Vb8jqDQ5PO0u8OM6820h'
  });

  // Media Config
  const [selectedTemplateName, setSelectedTemplateName] = useState('lrp_welcome_marketing');
  const [mediaId, setMediaId] = useState('4596515303953703');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [buttonParam] = useState('');

  // Marketing Template Variables State
  const [marketingVars, setMarketingVars] = useState({
    var1Mode: 'student_name', // 'student_name', 'name_and_parents', 'literal', 'custom'
    var1Custom: 'student and parents',
    var1CustomText: 'students and parents',
    var2Batch: '',
    var3Role: 'Student'
  });

  // Campaign Progress State
  const [, setActiveCampaignId] = useState(null);
  const [campaignStatus, setCampaignStatus] = useState(null);
  const pollingIntervalRef = useRef(null);
  const [submittingCampaign, setSubmittingCampaign] = useState(false);

  // Campaign History & Logs State
  const [, setRecentCampaigns] = useState([]);
  const [, setLoadingRecentCampaigns] = useState(false);
  const [receiptTab, setReceiptTab] = useState('all'); // 'all', 'sent', 'failed'
  const [logTemplateFilter, setLogTemplateFilter] = useState('all');
  const [templateLogs, setTemplateLogs] = useState([]);
  const [, setLoadingTemplateLogs] = useState(false);

  // Keep latest batches in ref to prevent background poll triggers
  const batchesRef = useRef(batches);
  useEffect(() => {
    batchesRef.current = batches;
  }, [batches]);

  const prevBatchIdRef = useRef(null);

  // Get active batch objects for select dropdown
  const activeBatches = useMemo(() => {
    return (batches || []).filter(b => !b.is_deleted);
  }, [batches]);

  // Load batch data ONLY when user explicitly changes selectedBatchId
  useEffect(() => {
    let isMounted = true;

    // If batch selection hasn't changed, do not reset UI or refetch
    if (prevBatchIdRef.current === selectedBatchId) {
      return;
    }
    prevBatchIdRef.current = selectedBatchId;

    if (!selectedBatchId) {
      queueMicrotask(() => {
        if (isMounted) {
          setStudents([]);
          setSelectedStudentIds(new Set());
        }
      });
      return;
    }

    const currentBatches = (batchesRef.current || []).filter(b => !b.is_deleted);
    const selectedBatch = currentBatches.find(b => String(b.id) === String(selectedBatchId));
    if (selectedBatch) {
      queueMicrotask(() => {
        if (isMounted) {
          setProgramDates({
            batch_name: selectedBatch.name || '',
            ri_start: selectedBatch.ri_start || '',
            ri_end: selectedBatch.ri_end || '',
            lrp_start: selectedBatch.lrp_start || '',
            lrp_end: selectedBatch.lrp_end || '',
            report_date: selectedBatch.report_date || '',
            report_time: selectedBatch.report_time || '04:00 PM',
            collect_date: selectedBatch.collect_date || '',
            return_date: selectedBatch.return_date || '',
            start_date: selectedBatch.ri_start || selectedBatch.lrp_start || '18/02/2026',
            end_date: selectedBatch.ri_end || selectedBatch.lrp_end || '12/02/2026',
            channel: 'https://whatsapp.com/channel/0029Vb8jqDQ5PO0u8OM6820h'
          });
          setMarketingVars(v => ({
            ...v,
            var2Batch: selectedBatch.name || ''
          }));
          setSelectedStudentIds(new Set());
        }
      });
    }

    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        const res = await fetch(`${API}/api/admin/batches/${selectedBatchId}/students?limit=5000`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (isMounted) {
          if (res.ok) {
            setStudents(data.students || []);
          } else {
            toast(data.message || 'Failed to fetch batch students.', 'error');
          }
        }
      } catch (err) {
        console.error('Error fetching students:', err);
        if (isMounted) toast('Error loading students.', 'error');
      } finally {
        if (isMounted) setLoadingStudents(false);
      }
    };

    fetchStudents();

    return () => { isMounted = false; };
  }, [selectedBatchId, API, token, toast]);

  // Filter students in memory
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const nameMatch = s.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const emailMatch = s.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const phoneMatch = s.phone?.toLowerCase().includes(searchQuery.toLowerCase());
      const parentPhoneMatch = s.parent_mobile?.toLowerCase().includes(searchQuery.toLowerCase());
      const prnMatch = s.prn?.toLowerCase().includes(searchQuery.toLowerCase());
      const squadMatch = !squadFilter || s.squad === squadFilter;

      return (nameMatch || emailMatch || phoneMatch || parentPhoneMatch || prnMatch) && squadMatch;
    });
  }, [students, searchQuery, squadFilter]);

  // List of unique squads for filtering
  const squadsList = useMemo(() => {
    const squads = new Set();
    students.forEach(s => {
      if (s.squad) squads.add(s.squad);
    });
    return Array.from(squads).sort();
  }, [students]);

  // Handle Select All Filtered Checkbox
  const isAllFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every(s => selectedStudentIds.has(s.id));
  }, [filteredStudents, selectedStudentIds]);

  const handleSelectAllToggle = () => {
    const updated = new Set(selectedStudentIds);
    if (isAllFilteredSelected) {
      filteredStudents.forEach(s => updated.delete(s.id));
    } else {
      filteredStudents.forEach(s => updated.add(s.id));
    }
    setSelectedStudentIds(updated);
  };

  const handleStudentSelect = (id) => {
    const updated = new Set(selectedStudentIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedStudentIds(updated);
  };

  // Welcome banner image upload handler
  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadingBanner(true);
    try {
      const res = await fetch(`${API}/api/admin/whatsapp/media/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setMediaId(data.mediaId);
        toast('Banner uploaded to Meta successfully!', 'success');
      } else {
        toast(data.message || 'Meta banner upload failed.', 'error');
      }
    } catch (err) {
      console.error('Error uploading banner:', err);
      toast('Error uploading banner to Meta.', 'error');
    } finally {
      setUploadingBanner(false);
    }
  };

  // Preview data generation (uses first selected student or fallback)
  const previewStudent = useMemo(() => {
    if (selectedStudentIds.size > 0) {
      const firstId = Array.from(selectedStudentIds)[0];
      return students.find(s => s.id === firstId) || { name: 'Rahul Sharma' };
    }
    return { name: 'Rahul Sharma' };
  }, [selectedStudentIds, students]);

  // WhatsApp template body formatting matching lrp_welcome_marketing / ltc_program_welcome / lrp_welcome_student_v1
  const formattedPreviewText = useMemo(() => {
    const sName = previewStudent.name || 'Rahul Sharma';
    const activeBatchName = activeBatches.find(b => String(b.id) === String(selectedBatchId))?.name || 'LAP-01-1026';
    const bName = marketingVars.var2Batch !== '' ? marketingVars.var2Batch : activeBatchName;
    const role = marketingVars.var3Role !== '' ? marketingVars.var3Role : 'Student';
    const squad = previewStudent.squad || 'Surya';
    
    if (selectedTemplateName === 'ltc_notification') {
      let v1Text = sName;
      if (marketingVars.var1Mode === 'students_and_parents') {
        v1Text = 'students and parents';
      } else if (marketingVars.var1Mode === 'student_and_parents') {
        v1Text = 'student and parents';
      } else if (marketingVars.var1Mode === 'name_and_parents') {
        v1Text = `${sName} and parents`;
      } else if (marketingVars.var1Mode === 'literal') {
        v1Text = 'Student';
      } else if (marketingVars.var1Mode === 'custom') {
        v1Text = marketingVars.var1CustomText !== undefined ? marketingVars.var1CustomText : 'students and parents';
      }

      const msgBody = marketingVars.var1Custom !== ''
        ? marketingVars.var1Custom
        : `Welcome to Life Awakening Program (LAP). We are delighted to have you join ${bName}.`;

      return `Hello *${v1Text}*,

This is a notification from Life Transformation Centre (MIT-WPU).

${msgBody}

Thank you,
Life Transformation Centre
MIT-WPU`;
    }

    if (selectedTemplateName === 'lrp_welcome_marketing') {
      let v1Text = sName;
      if (marketingVars.var1Mode === 'literal' || marketingVars.var1Mode === 'custom') {
        v1Text = marketingVars.var1Custom !== '' ? marketingVars.var1Custom : 'student and parents';
      } else if (marketingVars.var1Mode === 'name_and_parents') {
        v1Text = `${sName} and parents`;
      }

      return `Dear *${v1Text}*,

Welcome to the Life Awakening Program (LAP)!

We are delighted to have you join *${bName}* as a *${role}*.

Your journey of learning, leadership, and personal growth begins soon.

Stay connected with the LTC Management Portal for important announcements, schedules, and program updates.

We look forward to seeing you at the program.

Best regards,
LAP Administration`;
    }

    if (selectedTemplateName === 'ltc_program_welcome') {
      const startDate = programDates.start_date || programDates.ri_start || '18/02/2026';
      const endDate = programDates.end_date || programDates.ri_end || '12/02/2026';
      const channelUrl = programDates.channel || 'https://whatsapp.com/channel/0029Vb8jqDQ5PO0u8OM6820h';

      return `Dear *${sName}* and Parents,

Greetings from the Life Transformation Center (LTC), MIT World Peace University.

We are delighted to welcome you to the Life Awakening Program, *${bName}*.

*PROGRAM SCHEDULE*
• Program Dates: ${startDate} – ${endDate}

Please report to the Life Transformation Center on the program start date by 4:00 PM.

*MOBILE PHONE POLICY*
• Mobile phones will be collected after dinner on day 1.
• Mobile phones will be returned after lunch on the final day.

*OFFICIAL WHATSAPP CHANNEL*
${channelUrl}

All official communications, daily updates, and photographs from the program will be shared exclusively through this channel. We kindly request all students and parents to join the channel.

We look forward to welcoming you to the Life Awakening Program!

Warm regards,
Life Transformation Center (LTC)
MIT World Peace University`;
    }

    return `Dear *${sName}*,

Welcome to the Life Awakening Program (LAP) as a *Student*!

We are excited to welcome you to Batch *${bName}*.

*Program Details*

• Squad: ${squad}
• Start Date: ${programDates.ri_start || '01 Aug 2026'}
• End Date: ${programDates.ri_end || '15 Aug 2026'}

Please use the buttons below to:

• Access your LTC Portal
• View the installation guide

Log in to your dashboard to complete your profile, submit your undertaking form, and review the program guidelines.

If you need any assistance, please contact the LTC Administration.`;
  }, [selectedTemplateName, previewStudent, selectedBatchId, activeBatches, programDates, marketingVars]);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Fetch logs for template filter
  const fetchTemplateLogs = useCallback(async (tplName = 'all') => {
    setLoadingTemplateLogs(true);
    try {
      const res = await fetch(`${API}/api/admin/whatsapp/template-logs?template_name=${tplName}&limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.logs) {
        setTemplateLogs(data.logs);
      }
    } catch (err) {
      console.error('Error fetching template logs:', err);
    } finally {
      setLoadingTemplateLogs(false);
    }
  }, [API, token]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchTemplateLogs(logTemplateFilter);
    });
  }, [logTemplateFilter, fetchTemplateLogs]);

  // Poll campaign status from backend API for active campaign
  const startStatusPolling = useCallback((campaignId) => {
    if (!campaignId) return;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    setActiveCampaignId(campaignId);

    const poll = async () => {
      try {
        const res = await fetch(`${API}/api/admin/whatsapp/campaign/${campaignId}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setCampaignStatus(data);
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }
          fetchTemplateLogs(logTemplateFilter);
        }
      } catch (err) {
        console.error('Error polling campaign status:', err);
      }
    };

    poll();
    pollingIntervalRef.current = setInterval(poll, 2000);
  }, [API, token, fetchTemplateLogs, logTemplateFilter]);

  // Fetch recent campaigns list from backend API
  const fetchRecentCampaigns = useCallback(async () => {
    setLoadingRecentCampaigns(true);
    try {
      const res = await fetch(`${API}/api/admin/whatsapp/campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.campaigns) {
        setRecentCampaigns(data.campaigns);
        
        const ongoing = data.campaigns.find(c => c.status === 'processing' || c.status === 'pending');
        if (ongoing) {
          startStatusPolling(ongoing.id);
        }
      }
    } catch (err) {
      console.error('Error loading recent WhatsApp campaigns:', err);
    } finally {
      setLoadingRecentCampaigns(false);
    }
  }, [API, token, startStatusPolling]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchRecentCampaigns();
    });
  }, [fetchRecentCampaigns]);

  // Parse manual numbers count
  const parsedManualCount = useMemo(() => {
    if (!manualPhones) return 0;
    return manualPhones.split(/[\s,\n]+/).map(n => n.trim()).filter(Boolean).length;
  }, [manualPhones]);

  // Total count for current mode
  const queueLabelCount = useMemo(() => {
    if (recipientMode === 'list') {
      return selectedStudentIds.size;
    } else {
      return parsedManualCount;
    }
  }, [recipientMode, selectedStudentIds, parsedManualCount]);

  // Button disabled states checks
  const isTestDisabled = useMemo(() => {
    if (submittingCampaign) return true;
    if (recipientMode === 'list') {
      return !selectedBatchId || selectedStudentIds.size !== 1;
    } else {
      return parsedManualCount !== 1;
    }
  }, [recipientMode, selectedStudentIds, parsedManualCount, selectedBatchId, submittingCampaign]);

  const isQueueDisabled = useMemo(() => {
    if (submittingCampaign) return true;
    if (recipientMode === 'list') {
      return !selectedBatchId || selectedStudentIds.size === 0;
    } else {
      return parsedManualCount === 0;
    }
  }, [recipientMode, selectedStudentIds, parsedManualCount, selectedBatchId, submittingCampaign]);

  // Send campaign dispatch trigger - Sends ALL selected recipients at once!
  const handleStartCampaign = async (isTest = false) => {
    if (recipientMode === 'list' && !selectedBatchId) {
      toast('Please select a batch first.', 'error');
      return;
    }

    let payload = {
      batchId: selectedBatchId || null,
      templateName: selectedTemplateName,
      programDates,
      mediaId,
      buttonParam,
      sendTo,
      marketingVars
    };

    if (recipientMode === 'manual') {
      if (parsedManualCount === 0) {
        toast('Please enter at least one phone number.', 'error');
        return;
      }
      payload.manualPhones = manualPhones;
    } else {
      if (selectedStudentIds.size === 0) {
        toast('Please select at least one student.', 'error');
        return;
      }
      if (isTest && selectedStudentIds.size !== 1) {
        toast('Test dispatch requires selecting exactly ONE student.', 'error');
        return;
      }
      payload.studentIds = Array.from(selectedStudentIds);
    }

    setSubmittingCampaign(true);
    try {
      const res = await fetch(`${API}/api/admin/whatsapp/send-lrp-welcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        toast(data.message || `WhatsApp messages queued for all ${queueLabelCount} recipients!`, 'success');
        if (!isTest) {
          setActiveCampaignId(data.campaignId);
          setCampaignStatus({
            id: data.campaignId,
            status: 'pending',
            total_count: data.totalCount || queueLabelCount,
            sent_count: 0,
            failed_count: data.failedCount || 0,
            processed_count: data.failedCount || 0,
            progress: 0,
            failures: []
          });
          startStatusPolling(data.campaignId);
        }
      } else {
        toast(data.message || 'Failed to dispatch messages.', 'error');
      }
    } catch (err) {
      toast(err.message || 'Error queueing messages.', 'error');
    } finally {
      setSubmittingCampaign(false);
    }
  };

  return (
    <div className="wa-communication-root">
      {/* ── Responsive Mobile & Layout Style Block ── */}
      <style>{`
        .wa-communication-root {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 0;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          overflow-x: hidden;
          word-break: break-word;
        }

        .wa-layout-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 16px;
          align-items: start;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .wa-card {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background-color: #ffffff;
          padding: 18px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.03);
          box-sizing: border-box;
          width: 100%;
          max-width: 100%;
          overflow: hidden;
        }

        .wa-form-row-2col {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          width: 100%;
          box-sizing: border-box;
        }

        .wa-table-responsive {
          max-height: 320px;
          overflow-y: auto;
          overflow-x: auto;
          border: 1px solid #f1f5f9;
          border-radius: 10px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          -webkit-overflow-scrolling: touch;
        }

        .wa-receipts-table-responsive {
          max-height: 340px;
          overflow-y: auto;
          overflow-x: auto;
          border: 1px solid #e0f2fe;
          border-radius: 10px;
          background-color: #ffffff;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          -webkit-overflow-scrolling: touch;
        }

        .wa-btn-all {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 14px 18px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 800;
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
          color: #ffffff;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(22, 163, 74, 0.25);
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .wa-btn-all:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(22, 163, 74, 0.35);
          background: linear-gradient(135deg, #15803d 0%, #166534 100%);
        }

        .wa-btn-all:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* ── Mobile Adaptation Breakpoints ── */
        @media (max-width: 900px) {
          .wa-layout-grid {
            grid-template-columns: 1fr !important;
          }

          .wa-form-row-2col {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 600px) {
          .wa-card {
            padding: 12px !important;
            border-radius: 10px;
          }

          .wa-receipt-header-flex {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }

          .wa-stats-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }

          .wa-btn-all {
            font-size: 13px !important;
            padding: 12px 10px !important;
          }
        }
      `}</style>
      


      {/* ── Main Campaign Panel Grid ── */}
      <div className="wa-layout-grid">
        
        {/* Left Column: Configuration, Recipient Selector, & Student List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Step 1: Template & Schedule Configuration */}
          <div className="wa-card">
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>
              Step 1: Template & Schedule Configuration
            </h3>

            {/* Template Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#475569', textTransform: 'uppercase', marginBottom: '5px' }}>Meta Approved WhatsApp Template</label>
              <select 
                className="input-field" 
                value={selectedTemplateName} 
                onChange={e => setSelectedTemplateName(e.target.value)}
                style={{ marginBottom: 0 }}
              >
                <option value="lrp_welcome_marketing">lrp_welcome_marketing</option>
                <option value="lrp_welcome_student_v1">lrp_welcome_student_v1</option>
                <option value="ltc_notification">ltc_notification</option>
                <option value="ltc_program_welcome">ltc_program_welcome</option>
              </select>
            </div>
            
            {selectedTemplateName === 'ltc_notification' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>
                    Template Variables Configuration (2 Meta Approved Variables)
                  </h4>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '50px' }}>
                    Utility Approved
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>
                  Configure variables for <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>ltc_notification</code>:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginTop: '4px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#334155', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Variable {'{{1}}'} – Recipient Greeting / Name
                    </label>
                    <select 
                      className="input-field" 
                      value={marketingVars.var1Mode} 
                      onChange={e => setMarketingVars(v => ({ ...v, var1Mode: e.target.value }))}
                      style={{ marginBottom: marketingVars.var1Mode === 'custom' ? '8px' : 0 }}
                    >
                      <option value="student_name">Dynamic Student Name (e.g. "Rahul Sharma")</option>
                      <option value="name_and_parents">Dynamic Student Name & Parents (e.g. "Rahul Sharma and parents")</option>
                      <option value="students_and_parents">Literal "students and parents"</option>
                      <option value="student_and_parents">Literal "student and parents"</option>
                      <option value="literal">Literal ("Student")</option>
                      <option value="custom">Custom Text Write-In...</option>
                    </select>
                    {marketingVars.var1Mode === 'custom' && (
                      <input 
                        className="input-field" 
                        value={marketingVars.var1CustomText ?? 'students and parents'} 
                        onChange={e => setMarketingVars(v => ({ ...v, var1CustomText: e.target.value }))}
                        placeholder="e.g. students and parents" 
                        style={{ marginTop: '6px', marginBottom: 0 }}
                      />
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#334155', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Variable {'{{2}}'} – Custom Notification Message Content
                    </label>
                    <textarea 
                      className="input-field" 
                      rows={3}
                      value={marketingVars.var1Custom || ''} 
                      onChange={e => setMarketingVars(v => ({ ...v, var1Custom: e.target.value }))}
                      placeholder="e.g. Welcome to Life Awakening Program (LAP). We are delighted to have you join LAP-01-1026." 
                      style={{ marginBottom: 0, fontSize: '12.5px' }}
                    />
                  </div>
                </div>
              </div>
            ) : selectedTemplateName === 'lrp_welcome_marketing' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>
                    Template Variables Configuration (3 Meta Approved Variables)
                  </h4>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '50px' }}>
                    Meta Approved
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginTop: '4px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#334155', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Variable {'{{1}}'} – Recipient Greeting / Name
                    </label>
                    <select 
                      className="input-field" 
                      value={marketingVars.var1Mode} 
                      onChange={e => setMarketingVars(v => ({ ...v, var1Mode: e.target.value }))}
                      style={{ marginBottom: marketingVars.var1Mode === 'custom' ? '8px' : 0 }}
                    >
                      <option value="student_name">Dynamic Student Name (e.g. "Rahul Sharma")</option>
                      <option value="name_and_parents">Dynamic Student Name & Parents (e.g. "Rahul Sharma and parents")</option>
                      <option value="literal">Literal Meta Sample Text ("student and parents")</option>
                      <option value="custom">Custom Text...</option>
                    </select>
                    {marketingVars.var1Mode === 'custom' && (
                      <input 
                        className="input-field" 
                        value={marketingVars.var1Custom || ''} 
                        onChange={e => setMarketingVars(v => ({ ...v, var1Custom: e.target.value }))}
                        placeholder="e.g. student and parents" 
                        style={{ marginBottom: 0 }}
                      />
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#334155', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Variable {'{{2}}'} – Batch / Program Name
                    </label>
                    <input 
                      className="input-field" 
                      value={marketingVars.var2Batch} 
                      onChange={e => setMarketingVars(v => ({ ...v, var2Batch: e.target.value }))}
                      placeholder="e.g. LAP-01-1026" 
                      style={{ marginBottom: 0 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#334155', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Variable {'{{3}}'} – Role / Participant Type
                    </label>
                    <input 
                      className="input-field" 
                      value={marketingVars.var3Role} 
                      onChange={e => setMarketingVars(v => ({ ...v, var3Role: e.target.value }))}
                      placeholder="e.g. Student" 
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                </div>
              </div>
            ) : selectedTemplateName === 'ltc_program_welcome' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>
                    Template Variables Configuration (5 Meta Approved Variables)
                  </h4>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '50px' }}>
                    Meta Approved
                  </span>
                </div>

                <div className="wa-form-row-2col">
                  <div style={{ width: '100%', boxSizing: 'border-box' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#475569', textTransform: 'uppercase', marginBottom: '5px' }}>
                      Program Start Date ({'{{start_date}}'})
                    </label>
                    <input 
                      className="input-field" 
                      value={programDates.start_date || programDates.ri_start || ''} 
                      onChange={e => setProgramDates(p => ({ ...p, start_date: e.target.value, ri_start: e.target.value }))}
                      placeholder="e.g. 18/02/2026" 
                      style={{ width: '100%', boxSizing: 'border-box', marginBottom: 0 }}
                    />
                  </div>
                  <div style={{ width: '100%', boxSizing: 'border-box' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#475569', textTransform: 'uppercase', marginBottom: '5px' }}>
                      Program End Date ({'{{end_date}}'})
                    </label>
                    <input 
                      className="input-field" 
                      value={programDates.end_date || programDates.ri_end || ''} 
                      onChange={e => setProgramDates(p => ({ ...p, end_date: e.target.value, ri_end: e.target.value }))}
                      placeholder="e.g. 12/02/2026" 
                      style={{ width: '100%', boxSizing: 'border-box', marginBottom: 0 }}
                    />
                  </div>
                </div>

                <div style={{ width: '100%', boxSizing: 'border-box' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#475569', textTransform: 'uppercase', marginBottom: '5px' }}>
                    Official WhatsApp Channel Link ({'{{channel}}'})
                  </label>
                  <input 
                    className="input-field" 
                    value={programDates.channel || ''} 
                    onChange={e => setProgramDates(p => ({ ...p, channel: e.target.value }))}
                    placeholder="https://whatsapp.com/channel/..." 
                    style={{ width: '100%', boxSizing: 'border-box', marginBottom: 0 }}
                  />
                </div>
              </div>
            ) : (
              <div className="wa-form-row-2col">
                <div style={{ width: '100%', boxSizing: 'border-box' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#475569', textTransform: 'uppercase', marginBottom: '5px' }}>LAP Program Start Date</label>
                  <input 
                    className="input-field" 
                    value={programDates.ri_start} 
                    onChange={e => setProgramDates(p => ({ ...p, ri_start: e.target.value }))}
                    placeholder="e.g. 01 Aug 2026" 
                    style={{ width: '100%', boxSizing: 'border-box', marginBottom: 0 }}
                  />
                </div>
                <div style={{ width: '100%', boxSizing: 'border-box' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#475569', textTransform: 'uppercase', marginBottom: '5px' }}>LAP Program End Date</label>
                  <input 
                    className="input-field" 
                    value={programDates.ri_end} 
                    onChange={e => setProgramDates(p => ({ ...p, ri_end: e.target.value }))}
                    placeholder="e.g. 15 Aug 2026" 
                    style={{ width: '100%', boxSizing: 'border-box', marginBottom: 0 }}
                  />
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '16px', paddingTop: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#475569', textTransform: 'uppercase', marginBottom: '5px' }}>Meta Media Image ID</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    className="input-field" 
                    value={mediaId} 
                    onChange={e => setMediaId(e.target.value)}
                    placeholder="e.g. 4596515303953703" 
                    style={{ flex: 1, marginBottom: 0 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', cursor: 'pointer', flexShrink: 0 }} title="Upload new banner to Meta">
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerUpload} disabled={uploadingBanner} />
                    {uploadingBanner ? <RefreshCw size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Recipient Selection */}
          <div className="wa-card">
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>
              Step 2: Recipient Selection
            </h3>

            {/* Selection Mode Toggle Tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
              <button 
                type="button" 
                onClick={() => setRecipientMode('list')} 
                style={{ 
                  flex: 1, padding: '9px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', border: 'none', cursor: 'pointer',
                  backgroundColor: recipientMode === 'list' ? '#ffffff' : 'transparent',
                  color: recipientMode === 'list' ? '#1e293b' : '#64748b',
                  boxShadow: recipientMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                Select from Batch Students
              </button>
              <button 
                type="button" 
                onClick={() => setRecipientMode('manual')} 
                style={{ 
                  flex: 1, padding: '9px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', border: 'none', cursor: 'pointer',
                  backgroundColor: recipientMode === 'manual' ? '#ffffff' : 'transparent',
                  color: recipientMode === 'manual' ? '#1e293b' : '#64748b',
                  boxShadow: recipientMode === 'manual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                Enter Custom Phone Numbers
              </button>
            </div>

            {recipientMode === 'list' ? (
              <>
                {/* Batch Selector & Target Channel */}
                <div className="wa-form-row-2col" style={{ marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#475569', textTransform: 'uppercase', marginBottom: '5px' }}>LAP Program Batch</label>
                    <select 
                      className="input-field" 
                      value={selectedBatchId} 
                      onChange={e => setSelectedBatchId(e.target.value)}
                      style={{ marginBottom: 0 }}
                    >
                      <option value="">-- Select Batch --</option>
                      {activeBatches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#475569', textTransform: 'uppercase', marginBottom: '5px' }}>WhatsApp Target Channel</label>
                    <select 
                      className="input-field" 
                      value={sendTo} 
                      onChange={e => setSendTo(e.target.value)}
                      style={{ marginBottom: 0 }}
                      disabled={!selectedBatchId}
                    >
                      <option value="student">Send to Student Mobile Only</option>
                      <option value="parent">Send to Parent Mobile Only</option>
                      <option value="both">Send to Both Student and Parent</option>
                    </select>
                  </div>
                </div>
                {/* Filters */}
                <div className="wa-form-row-2col" style={{ marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#475569', textTransform: 'uppercase', marginBottom: '5px' }}>Filter by Squad</label>
                    <select 
                      className="input-field" 
                      value={squadFilter} 
                      onChange={e => setSquadFilter(e.target.value)}
                      style={{ marginBottom: 0 }}
                      disabled={!selectedBatchId}
                    >
                      <option value="">-- All Squads --</option>
                      {squadsList.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '850', color: '#475569', textTransform: 'uppercase', marginBottom: '5px' }}>Search Student</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        className="input-field" 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search name, phone, PRN..." 
                        style={{ paddingLeft: '32px', marginBottom: 0 }}
                        disabled={!selectedBatchId}
                      />
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: '#94a3b8' }} />
                    </div>
                  </div>
                </div>

                {/* Recipient Selection Bar with Direct "Select All" Actions */}
                {selectedBatchId && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '10px', marginBottom: '14px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckSquare size={18} color="#2563eb" />
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>
                          Matching Students: {filteredStudents.length}
                        </span>
                        <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#2563eb', marginLeft: '12px' }}>
                          Selected Recipients: <strong>{selectedStudentIds.size}</strong>
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      {(() => {
                        const total = filteredStudents.length;
                        const buttons = [];
                        for (let i = 0; i < total; i += 200) {
                          const startNum = i + 1;
                          const endNum = Math.min(i + 200, total);
                          const rangeIds = filteredStudents.slice(i, i + 200).map(s => s.id);
                          const isRangeSelected = rangeIds.length > 0 && rangeIds.every(id => selectedStudentIds.has(id));

                          buttons.push(
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                const updated = new Set(selectedStudentIds);
                                if (isRangeSelected) {
                                  rangeIds.forEach(id => updated.delete(id));
                                } else {
                                  rangeIds.forEach(id => updated.add(id));
                                }
                                setSelectedStudentIds(updated);
                              }}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                border: isRangeSelected ? '1px solid #0284c7' : '1px solid #7dd3fc',
                                backgroundColor: isRangeSelected ? '#0284c7' : '#ffffff',
                                color: isRangeSelected ? '#ffffff' : '#0369a1',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                              }}
                            >
                              {isRangeSelected ? `${startNum}–${endNum} Selected` : `Select ${startNum}–${endNum} (200)`}
                            </button>
                          );
                        }

                        return (
                          <>
                            {buttons}
                            <button
                              type="button"
                              onClick={() => {
                                const allIds = new Set(filteredStudents.map(s => s.id));
                                setSelectedStudentIds(allIds);
                              }}
                              style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '800', border: '1px solid #059669', backgroundColor: '#059669', color: '#ffffff', cursor: 'pointer' }}
                            >
                              Select All ({total})
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedStudentIds(new Set())}
                              style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', cursor: 'pointer' }}
                            >
                              Clear
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Mobile Responsive Students Table */}
                {!selectedBatchId ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: '13.5px' }}>Please select a batch from the dropdown above to view enrolled students.</p>
                  </div>
                ) : loadingStudents ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                    <p style={{ margin: 0, fontSize: '13px' }}>Loading enrolled students...</p>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>No students match your search filter criteria.</p>
                  </div>
                ) : (
                  <div className="wa-table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '550px' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ padding: '10px', width: '40px', textAlign: 'center' }}>
                            <input type="checkbox" checked={isAllFilteredSelected} onChange={handleSelectAllToggle} style={{ cursor: 'pointer' }} />
                          </th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '800' }}>PRN</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '800' }}>Name</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '800' }}>Student Mobile</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '800' }}>Parent Mobile</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '800' }}>Squad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map(s => {
                          const isSelected = selectedStudentIds.has(s.id);
                          return (
                            <tr 
                              key={s.id} 
                              onClick={() => handleStudentSelect(s.id)}
                              style={{ 
                                borderBottom: '1px solid #f1f5f9', 
                                cursor: 'pointer', 
                                backgroundColor: isSelected ? '#eff6ff' : 'transparent' 
                              }}
                            >
                              <td style={{ padding: '10px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  checked={isSelected} 
                                  onChange={() => handleStudentSelect(s.id)} 
                                  style={{ cursor: 'pointer' }}
                                />
                              </td>
                              <td style={{ padding: '10px', fontWeight: '600', color: '#475569' }}>{s.prn || '—'}</td>
                              <td style={{ padding: '10px', fontWeight: '700', color: '#1e293b' }}>{s.name}</td>
                              <td style={{ padding: '10px', color: s.phone ? '#334155' : '#94a3b8' }}>
                                {s.phone || '—'}
                              </td>
                              <td style={{ padding: '10px', color: s.parent_mobile ? '#334155' : '#94a3b8' }}>
                                {s.parent_mobile || '—'}
                              </td>
                              <td style={{ padding: '10px', color: '#64748b' }}>
                                <span style={{ backgroundColor: s.squad ? '#f1f5f9' : 'transparent', color: '#475569', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                                  {s.squad || '—'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              /* Custom Phone Numbers Entry Mode */
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '700', color: '#475569', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #e2e8f0' }}>
                  <span>Parsed Phone Numbers: <strong>{parsedManualCount}</strong></span>
                  {parsedManualCount > 0 && (
                    <span style={{ fontSize: '11.5px', color: '#059669', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                      Ready to Send
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '850', color: '#475569', textTransform: 'uppercase' }}>Manual Phone Numbers (WhatsApp format)</label>
                  <textarea 
                    className="input-field" 
                    rows={6}
                    value={manualPhones}
                    onChange={e => setManualPhones(e.target.value)}
                    placeholder="Enter numbers separated by commas, spaces, or newlines (e.g. 919876543210, 919876543211...)"
                    style={{ fontFamily: 'monospace', fontSize: '13px', width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }}
                  />
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                    * Enter recipient mobile numbers directly. No batch selection required.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Mobile Adaptive Chat Preview & Single-Click Action Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* WhatsApp Style Chat Preview */}
          <div className="wa-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#075e54', color: '#ffffff', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '12px' }}>
                LTC
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', lineHeight: '1.2' }}>MIT-WPU LTC</p>
                <p style={{ margin: 0, fontSize: '10px', opacity: 0.8 }}>Official Channel</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#efeae2', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '300px', maxHeight: '420px', overflowY: 'auto' }}>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px 8px 8px 0', padding: '12px', alignSelf: 'flex-start', maxWidth: '95%', fontSize: '12px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                
                {selectedTemplateName !== 'lrp_welcome_marketing' && (
                  mediaId ? (
                    <div style={{ backgroundColor: '#f1f5f9', borderRadius: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 10px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                      <CheckCircle size={20} style={{ color: '#2563eb', marginBottom: '4px' }} />
                      <span style={{ fontWeight: '700', fontSize: '11px' }}>Welcome Banner Active</span>
                      <span style={{ fontSize: '9px', opacity: 0.8 }}>ID: {mediaId.substring(0, 10)}...</span>
                    </div>
                  ) : (
                    <div style={{ height: '100px', backgroundColor: '#e2e8f0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '700', border: '1px dashed #cbd5e1' }}>
                      No Welcome Banner Image
                    </div>
                  )
                )}

                <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#111b21', fontFamily: 'inherit', lineHeight: '1.4' }}>
                  {formattedPreviewText}
                </p>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '6px', color: '#667781', fontSize: '10px' }}>
                  Official communication from MIT-WPU LTC.
                </div>
              </div>

              {selectedTemplateName === 'lrp_welcome_student_v1' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '95%' }}>
                  <div style={{ backgroundColor: '#ffffff', color: '#008069', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>
                    Access your LTC Portal
                  </div>
                  <div style={{ backgroundColor: '#ffffff', color: '#008069', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>
                    View the installation guide
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Console: Single Click Send to All Selected Recipients */}
          <div className="wa-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>Broadcast Console</h4>
              <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: '50px' }}>
                {queueLabelCount} Selected
              </span>
            </div>

            {/* Direct Send All at Once Button */}
            <button 
              type="button"
              className="wa-btn-all"
              onClick={() => handleStartCampaign(false)}
              disabled={isQueueDisabled}
            >
              <Send size={18} />
              <span>
                {submittingCampaign ? 'Queueing Messages...' : `Send to All ${queueLabelCount} Selected Recipients`}
              </span>
            </button>

            <button 
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleStartCampaign(true)}
              disabled={isTestDisabled}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', fontSize: '12px', padding: '10px' }}
              title="Select exactly 1 student or 1 manual number to send a test message"
            >
              <Smartphone size={14} />
              <span>Send Test Message (1 Selected Only)</span>
            </button>

            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
              All queued messages will be dispatched automatically via Meta Cloud API without size limits.
            </p>
          </div>
        </div>
      </div>

      {/* ── WhatsApp Delivery Receipts & Logs (STRICTLY MOBILE ADAPTIVE FOOTER) ── */}
      <div className="wa-card">
        {campaignStatus ? (
          <div style={{ border: '1px solid #bae6fd', borderRadius: '12px', backgroundColor: '#f0f9ff', padding: '20px' }}>
            <div className="wa-receipt-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: '800', color: '#0369a1' }}>
                  Real-Time WhatsApp Delivery Receipts <span style={{ color: '#2563eb' }}>({campaignStatus.batch_name || 'Selected Batch'})</span>
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#0284c7' }}>
                  Live delivery receipts for all phone numbers in this broadcast
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() => startStatusPolling(campaignStatus.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 10px', backgroundColor: '#ffffff' }}
                >
                  <RefreshCw size={12} />
                  <span>Refresh</span>
                </button>
                <span style={{ 
                  backgroundColor: campaignStatus.status === 'completed' ? '#dcfce7' : campaignStatus.status === 'failed' ? '#fef2f2' : '#dbeafe', 
                  color: campaignStatus.status === 'completed' ? '#15803d' : campaignStatus.status === 'failed' ? '#dc2626' : '#1d4ed8',
                  fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '50px', textTransform: 'uppercase'
                }}>
                  {campaignStatus.status}
                </span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="wa-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '18px' }}>
              <div style={{ background: '#ffffff', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e0f2fe' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Total Recipients</p>
                <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: '850', color: '#0f172a' }}>{campaignStatus.total_count}</p>
              </div>
              <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #a7f3d0' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#059669', fontWeight: '700', textTransform: 'uppercase' }}>Delivered</p>
                <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: '850', color: '#059669' }}>{campaignStatus.sent_count}</p>
              </div>
              <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #fecaca' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#dc2626', fontWeight: '700', textTransform: 'uppercase' }}>Failed / Not Sent</p>
                <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: '850', color: '#dc2626' }}>{campaignStatus.failed_count}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                <span>Delivery Progress</span>
                <span>{campaignStatus.progress}%</span>
              </div>
              <div style={{ height: '8px', width: '100%', backgroundColor: '#e2e8f0', borderRadius: '50px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${campaignStatus.progress}%`, backgroundColor: campaignStatus.status === 'completed' ? '#16a34a' : '#2563eb', borderRadius: '50px', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {/* Receipts Log Filters */}
            <div style={{ marginTop: '16px', borderTop: '1px solid #bae6fd', paddingTop: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#1e293b' }}>Receipts Status Logs</h4>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #bae6fd', padding: '4px 10px', borderRadius: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>Template:</label>
                    <select
                      value={logTemplateFilter}
                      onChange={e => setLogTemplateFilter(e.target.value)}
                      style={{ border: 'none', background: 'transparent', fontSize: '11.5px', fontWeight: '800', color: '#0284c7', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="all">All Templates</option>
                      <option value="ltc_notification">ltc_notification</option>
                      <option value="lrp_welcome_marketing">lrp_welcome_marketing</option>
                      <option value="lrp_welcome_student_v1">lrp_welcome_student_v1</option>
                      <option value="ltc_program_welcome">ltc_program_welcome</option>
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '4px', backgroundColor: '#e0f2fe', padding: '3px', borderRadius: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setReceiptTab('all')}
                    style={{
                      padding: '5px 12px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '700', border: 'none', cursor: 'pointer',
                      backgroundColor: receiptTab === 'all' ? '#ffffff' : 'transparent',
                      color: receiptTab === 'all' ? '#1e293b' : '#64748b'
                    }}
                  >
                    All ({templateLogs.length > 0 ? templateLogs.length : (campaignStatus?.logs?.length || 0)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptTab('sent')}
                    style={{
                      padding: '5px 12px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '700', border: 'none', cursor: 'pointer',
                      backgroundColor: receiptTab === 'sent' ? '#ffffff' : 'transparent',
                      color: receiptTab === 'sent' ? '#059669' : '#64748b'
                    }}
                  >
                    Delivered
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptTab('failed')}
                    style={{
                      padding: '5px 12px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '700', border: 'none', cursor: 'pointer',
                      backgroundColor: receiptTab === 'failed' ? '#ffffff' : 'transparent',
                      color: receiptTab === 'failed' ? '#dc2626' : '#64748b'
                    }}
                  >
                    Failed / Not Sent
                  </button>
                </div>
              </div>

              {/* Mobile Adaptive Receipts Log Table */}
              {(() => {
                let baseSource = templateLogs.length > 0 ? templateLogs : (campaignStatus?.logs || []);
                
                if (logTemplateFilter !== 'all') {
                  baseSource = baseSource.filter(l => (l.template_name || '').toLowerCase() === logTemplateFilter.toLowerCase());
                }

                const displayLogs = receiptTab === 'sent' 
                  ? baseSource.filter(l => l.status === 'sent' || l.status === 'delivered')
                  : receiptTab === 'failed' 
                  ? baseSource.filter(l => l.status === 'failed' || l.status === 'permanent_fail')
                  : baseSource;

                if (displayLogs.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '12.5px', backgroundColor: '#ffffff', borderRadius: '8px' }}>
                      No receipts match your selected filter criteria.
                    </div>
                  );
                }

                return (
                  <div className="wa-receipts-table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '600px' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', zIndex: 1 }}>
                        <tr>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '700' }}>Recipient Name</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '700' }}>Phone Number</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '700' }}>Template</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '700' }}>Role</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '700' }}>Delivery Status</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '700' }}>Details / Reason</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '700' }}>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayLogs.map(l => {
                          const isSent = l.status === 'sent' || l.status === 'delivered';
                          const displayRole = l.role || (sendTo === 'parent' ? 'Parent' : sendTo === 'both' ? 'Parent / Student' : 'Student');
                          const isParentRole = displayRole.toLowerCase().includes('parent');
                          return (
                            <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px', fontWeight: '700', color: '#1e293b' }}>{l.student_name || 'Student'}</td>
                              <td style={{ padding: '10px', color: '#334155', fontFamily: 'monospace', fontWeight: '600' }}>{l.phone}</td>
                              <td style={{ padding: '10px' }}>
                                <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', fontFamily: 'monospace' }}>
                                  {l.template_name || campaignStatus?.template_name || 'ltc_notification'}
                                </span>
                              </td>
                              <td style={{ padding: '10px' }}>
                                <span style={{ 
                                  backgroundColor: isParentRole ? '#fef3c7' : '#e0e7ff', 
                                  color: isParentRole ? '#92400e' : '#3730a3', 
                                  padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '800' 
                                }}>
                                  {displayRole}
                                </span>
                              </td>
                              <td style={{ padding: '10px' }}>
                                <span style={{ 
                                  backgroundColor: isSent ? '#dcfce7' : '#fef2f2', 
                                  color: isSent ? '#15803d' : '#dc2626', 
                                  padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase' 
                                }}>
                                  {isSent ? 'DELIVERED' : 'NOT SENT'}
                                </span>
                              </td>
                              <td style={{ padding: '10px', color: isSent ? '#059669' : '#dc2626', fontWeight: '500' }}>
                                {isSent ? (l.meta_message_id ? `Delivered (ID: ${l.meta_message_id.substring(0, 15)}...)` : 'Delivered successfully') : (l.reason || 'Message failed to send')}
                              </td>
                              <td style={{ padding: '10px', color: '#94a3b8', fontSize: '11px' }}>
                                {l.sent_at ? new Date(l.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Just now'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button 
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setActiveCampaignId(null);
                  setCampaignStatus(null);
                }}
                disabled={campaignStatus.status === 'processing'}
                style={{ backgroundColor: '#ffffff' }}
              >
                Close Delivery Receipts
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            No active broadcast status active. Select recipients and click <strong>Send to All Selected Recipients</strong> above to view real-time delivery receipts.
          </div>
        )}
      </div>

    </div>
  );
}
