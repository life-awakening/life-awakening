import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save,
  Send,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  AlertCircle,
  Home,
  Info,
  ShieldCheck,
  RefreshCw,
  Download,
  Edit3,
  X,
  CheckCircle2
} from 'lucide-react';
import {
  FAMILY_SURVEY_SECTIONS,
  createNewFamilyTemplate,
  getFamilyFieldValue,
  setFamilyFieldValue,
  validateFamilyRecord
} from '../shared/riFamilySurveySchema';
import { downloadFamilySurveyPdf } from '../utils/riFormHardCopyPdf';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';
// Legacy key was shared by ALL users of a browser (cross-student data leak). It is purged, never read.
const LEGACY_LOCAL_STORAGE_DRAFT_KEY = 'ri_family_surveys_offline_draft_v1';
const LOCAL_STORAGE_DRAFT_PREFIX = 'ri_family_surveys_offline_draft_v2';

// Resolve the authenticated student's id so local drafts are namespaced per student
const getCurrentUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u?.id ? String(u.id) : null;
  } catch {
    return null;
  }
};

export default function RiFamilySurveyForm({ data, authHeaders, onClose, toast }) {
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const existingForm = data?.family || {};
  const isSubmitted = existingForm.status === 'Submitted' || existingForm.status === 'Reviewed';
  const isCorrection = existingForm.status === 'Requires Correction' || data?.is_correction_requested;
  const canEdit = (!isSubmitted || isCorrection || isEditingResponse) && existingForm.status !== 'Reviewed';

  // List of all families recorded for this student
  const [families, setFamilies] = useState([]);
  const [activeRecord, setActiveRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingRecord, setSavingRecord] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [batchVillages, setBatchVillages] = useState(
    Array.isArray(data?.villages) ? data.villages : (data?.context?.village_name ? [{ name: data.context.village_name }] : [])
  );
  const [showCustomVillage, setShowCustomVillage] = useState(false);

  const defaultVillageName = data?.context?.village_name || '';
  const defaultVillageId = data?.context?.ri_village_id || null;

  const isDirtyRef = useRef(false);
  const activeRecordRef = useRef(null);
  activeRecordRef.current = activeRecord;
  const familiesRef = useRef(families);
  familiesRef.current = families;

  // Dynamically compute completed and saved family records
  const completedFamilies = React.useMemo(() => {
    return (families || []).filter(f => {
      const vName = (f.village_name || f.survey_data?.village_name || '').trim();
      const headName = (f.head_of_family_name || '').trim();
      const respName = (f.respondent_name || f.survey_data?.respondent_name || '').trim();
      const members = parseInt(f.total_family_members, 10);
      return Boolean(f.id) && Boolean(vName) && Boolean(headName) && !headName.startsWith('Draft Family #') && members >= 1 && Boolean(respName);
    });
  }, [families]);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadHardCopy = async () => {
    try {
      setIsDownloadingPdf(true);
      const targetFamily = activeRecord || families[0] || {};
      await downloadFamilySurveyPdf({
        family: targetFamily,
        context: data?.context
      });
      toast?.(`Family Visits (Form V${targetFamily.family_serial_number ? ` - Family #${targetFamily.family_serial_number}` : ''}) PDF downloaded!`, 'success');
    } catch (err) {
      console.error('Failed to generate Family Survey PDF:', err);
      toast?.('Failed to generate PDF. Please try again.', 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const targetCount = 3;

  // Per-student draft key (null when identity unknown => local drafts disabled)
  const draftKey = (() => {
    const uid = getCurrentUserId();
    return uid ? `${LOCAL_STORAGE_DRAFT_PREFIX}_${uid}` : null;
  })();

  // Helper to persist families locally in localStorage (scoped to this student)
  const persistLocally = (famList) => {
    if (!draftKey) return;
    try {
      if (Array.isArray(famList) && famList.length > 0) {
        localStorage.setItem(draftKey, JSON.stringify(famList));
      }
    } catch {
      // Storage quota or private mode fallback
    }
  };

  // Helper to read local drafts from localStorage (this student only)
  const readLocalDrafts = () => {
    if (!draftKey) return null;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  };

  // Fetch all families on mount & merge with offline local drafts
  const fetchFamilies = useCallback(async () => {
    try {
      setLoading(true);
      let serverFamilies = [];
      let serverOk = false;

      // Purge the old shared (unscoped) draft key so it can never leak across students
      try { localStorage.removeItem(LEGACY_LOCAL_STORAGE_DRAFT_KEY); } catch { /* ignore */ }

      try {
        const res = await fetch(`${API}/api/ri/student/forms/family-surveys`, {
          headers: authHeaders
        });
        if (res.ok) {
          const json = await res.json();
          serverFamilies = json.families || [];
          if (Array.isArray(json.villages) && json.villages.length > 0) {
            setBatchVillages(json.villages);
          }
          serverOk = true;
        }
      } catch {
        // If offline or network error, proceed with local draft
      }

      let localDrafts = readLocalDrafts();
      // When the server answered, a local draft carrying a DB id that the server did not return
      // is stale/foreign (deleted, reset DB, other batch) and must be discarded.
      if (localDrafts && serverOk) {
        const serverIds = new Set(serverFamilies.map(sf => sf.id));
        localDrafts = localDrafts.filter(lf => !lf.id || serverIds.has(lf.id));
        if (localDrafts.length === 0) localDrafts = null;
      }
      let resolvedList = [];

      if (serverFamilies.length > 0) {
        resolvedList = serverFamilies;
        // Merge any unpersisted fields from local draft if same family serial exists
        if (localDrafts && canEdit) {
          resolvedList = serverFamilies.map(sf => {
            const matchLocal = localDrafts.find(lf => lf.id === sf.id || lf.family_serial_number === sf.family_serial_number);
            if (matchLocal) {
              const mergedSd = {
                ...(sf.survey_data || {}),
                ...(matchLocal.survey_data || {})
              };
              return {
                ...sf,
                ...matchLocal,
                id: sf.id,
                survey_data: mergedSd
              };
            }
            return sf;
          });

          // Also keep any local family that wasn't saved to server yet
          localDrafts.forEach(lf => {
            if (!resolvedList.some(rf => rf.family_serial_number === lf.family_serial_number || (lf.id && rf.id === lf.id))) {
              resolvedList.push(lf);
            }
          });
        }

        // Ensure at least 3 family records are available when student can edit
        if (canEdit && resolvedList.length < 3) {
          const existingSerials = new Set(resolvedList.map(f => parseInt(f.family_serial_number, 10)));
          for (let s = 1; s <= 3; s++) {
            if (!existingSerials.has(s)) {
              resolvedList.push(createNewFamilyTemplate(s, defaultVillageName, defaultVillageId));
            }
          }
          resolvedList.sort((a, b) => (parseInt(a.family_serial_number, 10) || 0) - (parseInt(b.family_serial_number, 10) || 0));
        }
      } else if (localDrafts && localDrafts.length > 0) {
        resolvedList = localDrafts;
        if (canEdit && resolvedList.length < 3) {
          const existingSerials = new Set(resolvedList.map(f => parseInt(f.family_serial_number, 10)));
          for (let s = 1; s <= 3; s++) {
            if (!existingSerials.has(s)) {
              resolvedList.push(createNewFamilyTemplate(s, defaultVillageName, defaultVillageId));
            }
          }
          resolvedList.sort((a, b) => (parseInt(a.family_serial_number, 10) || 0) - (parseInt(b.family_serial_number, 10) || 0));
        }
      } else {
        // Automatically initialize 3 family records for new student
        resolvedList = [
          createNewFamilyTemplate(1, defaultVillageName, defaultVillageId),
          createNewFamilyTemplate(2, defaultVillageName, defaultVillageId),
          createNewFamilyTemplate(3, defaultVillageName, defaultVillageId)
        ];
      }

      // Default empty village_name to student's assigned panel village if available
      if (defaultVillageName) {
        resolvedList = resolvedList.map(f => {
          if (!f.village_name && !f.survey_data?.village_name) {
            return {
              ...f,
              village_name: defaultVillageName,
              ri_village_id: f.ri_village_id || defaultVillageId
            };
          }
          return f;
        });
      }

      setFamilies(resolvedList);
      setActiveRecord(resolvedList[0] || null);
      persistLocally(resolvedList);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, canEdit]);

  useEffect(() => {
    fetchFamilies();
  }, [fetchFamilies]);

  // Switch to a new blank family
  const startNewFamily = () => {
    if (isDirtyRef.current && activeRecord && canEdit) {
      saveActiveFamilyQuietly(activeRecord);
    }

    const nextSr = families.length > 0
      ? Math.max(...families.map(f => parseInt(f.family_serial_number, 10) || 0)) + 1
      : 1;

    if (nextSr > 10) {
      toast('Maximum 10 families can be recorded per pair.', 'info');
      return;
    }

    const newFam = createNewFamilyTemplate(nextSr, defaultVillageName, defaultVillageId);
    setFamilies(prev => {
      const updated = [...prev, newFam];
      persistLocally(updated);
      return updated;
    });
    isDirtyRef.current = false;
    setShowCustomVillage(false);
    setActiveRecord(newFam);
    toast(`Started Family #${nextSr} record.`, 'info');
  };

  // Switch active family record cleanly, saving dirty work quietly first
  const handleSelectFamily = (targetFam) => {
    if (!targetFam) return;
    const isSame = (activeRecord?.id && targetFam.id && activeRecord.id === targetFam.id) ||
      (activeRecord?.family_serial_number === targetFam.family_serial_number);
    if (isSame) return;

    if (isDirtyRef.current && activeRecord && canEdit) {
      saveActiveFamilyQuietly(activeRecord);
    }

    isDirtyRef.current = false;
    setShowCustomVillage(false);
    const latest = families.find(f =>
      (targetFam.id && f.id === targetFam.id) ||
      f.family_serial_number === targetFam.family_serial_number
    ) || targetFam;
    setActiveRecord(latest);
  };

  // Field updater: saves immediately to localStorage and triggers debounced server save
  const updateActiveRecordField = (fieldId, value) => {
    if (!canEdit) return;
    setActiveRecord(prev => {
      if (!prev) return prev;
      const updated = setFamilyFieldValue(prev, fieldId, value);
      isDirtyRef.current = true;
      setAutoSaveStatus('idle');

      setFamilies(currList => {
        const nextList = currList.map(f => {
          if (f.id && prev.id && f.id === prev.id) return updated;
          if (f.family_serial_number === prev.family_serial_number) return updated;
          return f;
        });
        persistLocally(nextList);
        return nextList;
      });

      return updated;
    });
  };

  // Quiet server auto-save (only runs when active record was actually modified)
  const saveActiveFamilyQuietly = useCallback(async (currentRecord) => {
    if (!currentRecord || !canEdit || !isDirtyRef.current) return;
    try {
      setAutoSaveStatus('saving');
      const serialNum = parseInt(currentRecord.family_serial_number, 10) || 1;
      const isExistingInDb = Boolean(currentRecord.id);

      // Ensure fallback name so server draft insert succeeds even during early typing
      const payload = {
        ...currentRecord,
        head_of_family_name: currentRecord.head_of_family_name?.trim() || `Draft Family #${serialNum}`,
        is_editing_submitted: isEditingResponse
      };

      const url = isExistingInDb
        ? `${API}/api/ri/student/forms/family-surveys/${currentRecord.id}`
        : `${API}/api/ri/student/forms/family-surveys`;

      const method = isExistingInDb ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        if (result.family?.id && !currentRecord.id) {
          currentRecord.id = result.family.id;
          setActiveRecord(prev => {
            if (!prev) return prev;
            if (prev.family_serial_number === currentRecord.family_serial_number) {
              return { ...prev, id: result.family.id };
            }
            return prev;
          });
          setFamilies(curr => {
            const nextList = curr.map(f => f.family_serial_number === currentRecord.family_serial_number ? { ...f, id: result.family.id } : f);
            persistLocally(nextList);
            return nextList;
          });
        }
        isDirtyRef.current = false;
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2500);
      } else {
        setAutoSaveStatus('idle');
      }
    } catch {
      setAutoSaveStatus('idle');
    }
  }, [authHeaders, canEdit, isEditingResponse]);

  // Debounced auto-save to server (1.2s debounce)
  useEffect(() => {
    if (!isDirtyRef.current || !canEdit || !activeRecord) return;
    const timer = setTimeout(() => {
      saveActiveFamilyQuietly(activeRecord);
    }, 1200);
    return () => clearTimeout(timer);
  }, [activeRecord, canEdit, saveActiveFamilyQuietly]);

  // Window beforeunload and document visibilitychange listeners
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (familiesRef.current && familiesRef.current.length > 0) {
        persistLocally(familiesRef.current);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBeforeUnload();
        if (isDirtyRef.current && activeRecordRef.current && canEdit) {
          saveActiveFamilyQuietly(activeRecordRef.current);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (isDirtyRef.current && canEdit && activeRecordRef.current) {
        saveActiveFamilyQuietly(activeRecordRef.current);
      }
    };
  }, [canEdit, saveActiveFamilyQuietly]);

  const handleSaveActiveFamily = async () => {
    const errorMsg = validateFamilyRecord(activeRecord);
    if (errorMsg) {
      toast(errorMsg, 'error');
      return;
    }

    setSavingRecord(true);
    try {
      const serialNum = parseInt(activeRecord.family_serial_number, 10) || 1;
      const isExistingInDb = Boolean(activeRecord.id);

      const payload = {
        ...activeRecord,
        is_editing_submitted: isEditingResponse
      };

      let res;
      if (isExistingInDb) {
        res = await fetch(`${API}/api/ri/student/forms/family-surveys/${activeRecord.id}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API}/api/ri/student/forms/family-surveys`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
      }

      const result = await res.json();
      if (res.ok) {
        toast(`Family #${serialNum} survey saved successfully.`, 'success');
        isDirtyRef.current = false;
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2500);

        const assignedId = result.family?.id || activeRecord.id;
        const updatedFam = { ...activeRecord, id: assignedId };
        setActiveRecord(updatedFam);
        setFamilies(curr => {
          const nextList = curr.map(f => f.family_serial_number === serialNum ? updatedFam : f);
          persistLocally(nextList);
          return nextList;
        });
      } else {
        toast(result.message || 'Failed to save family record', 'error');
      }
    } catch {
      toast('Network error saving family visit', 'error');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleDeleteFamily = async (famRecord) => {
    if (!famRecord) return;
    const serialNum = famRecord.family_serial_number;
    if (!window.confirm(`Are you sure you want to delete Family #${serialNum} record?`)) return;

    if (!famRecord.id) {
      const remaining = families.filter(f => f.family_serial_number !== serialNum);
      const nextRemaining = remaining.length > 0 ? remaining : [
        createNewFamilyTemplate(1, defaultVillageName, defaultVillageId),
        createNewFamilyTemplate(2, defaultVillageName, defaultVillageId),
        createNewFamilyTemplate(3, defaultVillageName, defaultVillageId)
      ];
      setFamilies(nextRemaining);
      if (activeRecord?.family_serial_number === serialNum) {
        isDirtyRef.current = false;
        setShowCustomVillage(false);
        setActiveRecord(nextRemaining[0]);
      }
      persistLocally(nextRemaining);
      toast(`Draft Family #${serialNum} removed`, 'info');
      return;
    }

    try {
      const res = await fetch(`${API}/api/ri/student/forms/family-surveys/${famRecord.id || serialNum}?is_editing_submitted=${isEditingResponse ? 'true' : 'false'}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
          'X-Is-Editing-Response': isEditingResponse ? 'true' : 'false'
        }
      });
      if (res.ok) {
        toast(`Family #${serialNum} record deleted from database`, 'info');
        const remaining = families.filter(f => f.id !== famRecord.id && f.family_serial_number !== serialNum);
        const nextRemaining = remaining.length > 0 ? remaining : [
          createNewFamilyTemplate(1, defaultVillageName, defaultVillageId),
          createNewFamilyTemplate(2, defaultVillageName, defaultVillageId),
          createNewFamilyTemplate(3, defaultVillageName, defaultVillageId)
        ];
        setFamilies(nextRemaining);
        if (activeRecord?.id === famRecord.id || activeRecord?.family_serial_number === serialNum) {
          isDirtyRef.current = false;
          setShowCustomVillage(false);
          setActiveRecord(nextRemaining[0]);
        }
        persistLocally(nextRemaining);
      } else {
        toast('Failed to delete family record', 'error');
      }
    } catch {
      toast('Failed to delete family record', 'error');
    }
  };

  const handleSubmitAllFamilies = async () => {
    if (families.length < 1) {
      toast('Please add and record at least one family visit.', 'error');
      return;
    }

    for (let i = 0; i < families.length; i++) {
      const errorMsg = validateFamilyRecord(families[i]);
      if (errorMsg) {
        toast(`Family #${families[i].family_serial_number || i + 1}: ${errorMsg}`, 'error');
        handleSelectFamily(families[i]);
        return;
      }
    }

    // Minimum 3 completed and saved family records enforcement
    if (completedFamilies.length < 3) {
      toast('You must complete and save at least 3 family visit records before submitting.', 'error');
      return;
    }

    const confirmPrompt = isEditingResponse
      ? `Confirm update & resubmission of all ${families.length} Family Visit Survey records?`
      : `Confirm final submission of all ${families.length} Family Visit Survey records? After submission, records will be locked for faculty evaluation.`;

    if (!window.confirm(confirmPrompt)) {
      return;
    }

    setSavingRecord(true);
    try {
      const res = await fetch(`${API}/api/ri/student/forms/family-surveys/submit-all`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
          'X-Is-Editing-Response': isEditingResponse ? 'true' : 'false'
        },
        body: JSON.stringify({
          is_editing_submitted: Boolean(isEditingResponse),
          is_update_response: Boolean(isEditingResponse)
        })
      });
      const result = await res.json();
      if (res.ok) {
        toast(isEditingResponse ? 'All Family Visits updated and resubmitted successfully!' : 'All Family Visits submitted officially!', 'success');
        try {
          if (draftKey) localStorage.removeItem(draftKey);
        } catch {}
        setIsEditingResponse(false);
        onClose();
      } else {
        toast(result.message || 'Submission failed', 'error');
      }
    } catch {
      toast('Network error submitting surveys', 'error');
    } finally {
      setSavingRecord(false);
    }
  };

  // Helper to test if question is visible based on conditional logic
  const isQuestionVisible = (q) => {
    if (!q.conditionalOn) return true;
    const parentVal = getFamilyFieldValue(activeRecord, q.conditionalOn);
    if (typeof q.conditionalValue === 'function') {
      return q.conditionalValue(parentVal);
    }
    return Boolean(parentVal);
  };

  // Helper to detect 2-option choices (e.g. Yes/No, Owned/Hired, Adequate/Inadequate)
  const isBinaryOptions = (opts) => {
    if (!Array.isArray(opts) || opts.length !== 2) return false;
    return opts.every(o => typeof o === 'string' && o.length <= 18);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 10px', textAlign: 'center' }}>
        <RefreshCw size={26} className="ri-spin" style={{ margin: '0 auto 10px', color: '#047857' }} />
        <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Loading family visits...</p>
      </div>
    );
  }

  return (
    <div className="ri-mobile-wrapper">
      {/* Scoped CSS for Clean Layout & Full Mobile Responsiveness */}
      <style>{`
        .ri-mobile-wrapper {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          -webkit-tap-highlight-color: transparent;
        }

        .ri-spin {
          animation: ri-spin-anim 1s linear infinite;
        }
        @keyframes ri-spin-anim {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Top Family Pills Bar + Compact Status */
        .ri-family-nav-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid #e2e8f0;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .ri-family-nav-bar::-webkit-scrollbar {
          height: 3px;
        }
        .ri-family-nav-bar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }

        .ri-family-scroller {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          flex: 1;
        }

        .ri-family-pill-btn {
          padding: 6px 12px;
          border-radius: 7px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
          touch-action: manipulation;
          transition: all 0.15s ease;
          min-height: 36px;
        }
        .ri-family-pill-btn.active {
          border: 1.5px solid #047857;
          background-color: #ecfdf5;
          color: #065f46;
          font-weight: 800;
          box-shadow: 0 1px 4px rgba(4, 120, 87, 0.12);
        }
        .ri-family-pill-btn.inactive {
          border: 1px solid #cbd5e1;
          background-color: #ffffff;
          color: #334155;
        }

        .ri-add-family-btn {
          padding: 6px 12px;
          border-radius: 7px;
          border: 1.5px dashed #047857;
          background-color: #f0fdf4;
          color: #047857;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
          min-height: 36px;
          touch-action: manipulation;
        }

        .ri-nav-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11.5px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 6px;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .ri-nav-status-pill.saving {
          background-color: #fef3c7;
          color: #b45309;
        }
        .ri-nav-status-pill.saved {
          background-color: #ecfdf5;
          color: #047857;
        }

        /* Active Family Card: On mobile use almost full width, minimal padding */
        .ri-active-family-card {
          background-color: #ffffff;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          padding: 8px 6px;
          margin-bottom: 10px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          box-sizing: border-box;
          width: 100%;
        }
        @media (min-width: 640px) {
          .ri-active-family-card {
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
          }
        }

        /* Active Family Header */
        .ri-family-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          padding-bottom: 8px;
          margin-bottom: 8px;
          border-bottom: 1.5px solid #f1f5f9;
        }

        .ri-family-title-row h3 {
          margin: 1px 0 0 0;
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
        }
        @media (min-width: 640px) {
          .ri-family-title-row h3 {
            font-size: 17px;
          }
        }

        .ri-family-badge-tag {
          font-size: 10.5px;
          font-weight: 800;
          color: #047857;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Section Container - Always Open */
        .ri-section-container {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          background-color: #ffffff;
          margin-bottom: 8px;
        }
        @media (min-width: 640px) {
          .ri-section-container {
            border-radius: 10px;
            margin-bottom: 14px;
          }
        }

        .ri-section-header {
          padding: 8px 10px;
          background-color: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e2e8f0;
          min-height: 38px;
        }
        @media (min-width: 640px) {
          .ri-section-header {
            padding: 12px 14px;
            min-height: 44px;
          }
        }

        .ri-section-title-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          flex: 1;
        }

        .ri-section-code-badge {
          font-size: 10px;
          font-weight: 800;
          color: #047857;
          background-color: #ecfdf5;
          border: 1px solid #a7f3d0;
          padding: 2px 5px;
          border-radius: 4px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .ri-section-title-text {
          margin: 0;
          font-size: 13px;
          font-weight: 750;
          color: #0f172a;
          line-height: 1.3;
        }
        @media (min-width: 640px) {
          .ri-section-title-text {
            font-size: 14px;
          }
        }

        .ri-section-progress-pill {
          font-size: 10.5px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 10px;
          white-space: nowrap;
        }
        .ri-section-progress-pill.done {
          background-color: #d1fae5;
          color: #065f46;
        }
        .ri-section-progress-pill.pending {
          background-color: #f1f5f9;
          color: #64748b;
        }

        .ri-section-body {
          padding: 8px 6px;
        }
        @media (min-width: 640px) {
          .ri-section-body {
            padding: 18px;
          }
        }

        /* Question Layout: 1 col on mobile, 2 cols on desktop */
        .ri-questions-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        @media (min-width: 680px) {
          .ri-questions-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
        }

        .ri-question-card {
          border: 1px solid #f1f5f9;
          background-color: #fcfcfd;
          border-radius: 6px;
          padding: 8px 8px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 6px;
          box-sizing: border-box;
          width: 100%;
        }
        @media (min-width: 640px) {
          .ri-question-card {
            border-radius: 10px;
            padding: 12px 14px;
            gap: 8px;
          }
        }

        .ri-question-label {
          font-size: 12.5px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.35;
          display: block;
        }
        @media (min-width: 640px) {
          .ri-question-label {
            font-size: 13px;
            font-weight: 750;
          }
        }

        .ri-question-instruction {
          margin: 2px 0 0 0;
          font-size: 11px;
          color: #64748b;
          font-style: italic;
          line-height: 1.3;
        }

        /* Mobile Inputs: 16px font-size to strictly prevent iOS viewport auto-zoom */
        .ri-mobile-input {
          width: 100%;
          min-height: 42px;
          padding: 8px 10px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          font-size: 16px;
          line-height: 1.4;
          box-sizing: border-box;
          background-color: #ffffff;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          font-family: inherit;
        }
        .ri-mobile-input:focus {
          border-color: #047857;
          box-shadow: 0 0 0 2px rgba(4, 120, 87, 0.12);
        }
        .ri-mobile-input:disabled {
          background-color: #f8fafc;
          color: #64748b;
          cursor: not-allowed;
        }

        /* Dropdown with custom arrow and no preselected default */
        .ri-select-wrapper {
          position: relative;
          width: 100%;
        }
        .ri-mobile-select {
          width: 100%;
          min-height: 42px;
          padding: 8px 32px 8px 10px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          font-size: 16px;
          box-sizing: border-box;
          background-color: #ffffff;
          appearance: none;
          -webkit-appearance: none;
          outline: none;
          cursor: pointer;
          font-family: inherit;
        }
        .ri-mobile-select:focus {
          border-color: #047857;
          box-shadow: 0 0 0 2px rgba(4, 120, 87, 0.12);
        }
        .ri-select-chevron {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: #64748b;
        }

        /* 2-Option Binary Segmented Button (Yes/No, Owned/Hired) */
        .ri-binary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }
        .ri-binary-btn {
          min-height: 40px;
          padding: 6px 8px;
          border-radius: 6px;
          font-size: 13.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          touch-action: manipulation;
          transition: all 0.12s ease;
          border: 1px solid #cbd5e1;
          background-color: #ffffff;
          color: #334155;
          text-align: center;
        }
        .ri-binary-btn.active {
          border-color: #047857;
          background-color: #ecfdf5;
          color: #065f46;
          font-weight: 800;
          box-shadow: 0 1px 3px rgba(4, 120, 87, 0.15);
        }
        .ri-binary-btn:active {
          transform: scale(0.98);
        }

        /* Sticky Action Bar for Mobile Thumb Ergonomics */
        .ri-sticky-bottom-bar {
          position: sticky;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-top: 1px solid #e2e8f0;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          z-index: 40;
          box-shadow: 0 -3px 10px rgba(0, 0, 0, 0.05);
          border-radius: 0 0 8px 8px;
          margin-top: 8px;
        }
        @media (min-width: 640px) {
          .ri-sticky-bottom-bar {
            padding: 12px 20px;
            margin-top: 14px;
            border-radius: 0 0 12px 12px;
          }
        }

        .ri-save-primary-btn {
          min-height: 40px;
          padding: 8px 16px;
          border-radius: 7px;
          border: none;
          background-color: #047857;
          color: #ffffff;
          font-weight: 750;
          font-size: 13px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          touch-action: manipulation;
          box-shadow: 0 2px 5px rgba(4, 120, 87, 0.2);
        }
        .ri-save-primary-btn:active {
          transform: scale(0.98);
        }

        .ri-delete-family-btn {
          min-height: 36px;
          padding: 5px 10px;
          border-radius: 6px;
          border: 1px solid #fecaca;
          background-color: #ffffff;
          color: #dc2626;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          touch-action: manipulation;
        }

        .ri-final-submit-box {
          border-top: 1.5px solid #e2e8f0;
          padding-top: 12px;
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        @media (min-width: 640px) {
          .ri-final-submit-box {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            padding-top: 16px;
            margin-top: 16px;
            border-top: 2px solid #e2e8f0;
          }
        }

        .ri-final-submit-btn {
          min-height: 44px;
          padding: 10px 18px;
          border-radius: 8px;
          border: none;
          background-color: #0f172a;
          color: #ffffff;
          font-weight: 800;
          font-size: 13.5px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 3px 8px rgba(15, 23, 42, 0.25);
          touch-action: manipulation;
          width: 100%;
        }
        @media (min-width: 640px) {
          .ri-final-submit-btn {
            width: auto;
            min-height: 46px;
            padding: 12px 20px;
            font-size: 14px;
          }
        }
      `}</style>

      {/* Mentor Correction Alert if active */}
      {isCorrection && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1.5px solid #fecaca',
          borderRadius: '8px',
          padding: '10px 12px',
          marginBottom: '10px',
          fontSize: '12.5px',
          color: '#991b1b',
          display: 'flex',
          gap: '8px'
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>⚠️ Mentor Correction Request:</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px' }}>
              {data?.faculty_remarks || 'Please update family visit observations as advised by your faculty mentor and resubmit.'}
            </p>
          </div>
        </div>
      )}

      {/* Submitted Status & Edit Response Banner */}
      {existingForm.status === 'Reviewed' ? (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '10px 12px',
          marginBottom: '10px',
          fontSize: '12.5px',
          color: '#1e40af',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <ShieldCheck size={16} style={{ flexShrink: 0 }} />
          <span>This Family Visits survey has been officially evaluated and reviewed by faculty. Responses are finalized and read-only.</span>
        </div>
      ) : isSubmitted && !isCorrection ? (
        !isEditingResponse ? (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1.5px solid #bbf7d0',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#15803d' }}>
                  Family Visit Observations Submitted
                </div>
                <div style={{ fontSize: '12px', color: '#166534', marginTop: '1px' }}>
                  {families.length} families recorded ({completedFamilies.length} completed). You can edit your responses anytime before faculty evaluation.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingResponse(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#047857',
                color: '#ffffff',
                border: 'none',
                padding: '7px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(4,120,87,0.2)'
              }}
            >
              <Edit3 size={14} />
              <span>Edit Response</span>
            </button>
          </div>
        ) : (
          <div style={{
            backgroundColor: '#fffbeb',
            border: '1.5px solid #fde68a',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={18} style={{ color: '#d97706', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#b45309' }}>
                  Editing Submitted Response
                </div>
                <div style={{ fontSize: '12px', color: '#92400e', marginTop: '1px' }}>
                  You are editing your family visit records. When done, click "Update & Resubmit All Families" below.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsEditingResponse(false);
                isDirtyRef.current = false;
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <X size={13} />
              <span>Cancel Editing</span>
            </button>
          </div>
        )
      ) : null}

      {/* Dynamic Family Progress Indicator Banner */}
      <div style={{
        background: completedFamilies.length >= 3
          ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        border: `1.5px solid ${completedFamilies.length >= 3 ? '#a7f3d0' : '#cbd5e1'}`,
        borderRadius: '10px',
        padding: '12px 14px',
        marginBottom: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: completedFamilies.length >= 3 ? '#10b981' : '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '14px',
              flexShrink: 0
            }}>
              {completedFamilies.length >= 3 ? <Check size={18} /> : `${completedFamilies.length}/3`}
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                Family Requirement: {completedFamilies.length} of 3 families completed
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                {completedFamilies.length >= 3
                  ? 'All 3 required family visits completed! Ready for final submission.'
                  : `Complete and save at least ${3 - completedFamilies.length} more family visit${3 - completedFamilies.length > 1 ? 's' : ''} to unlock final submission.`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {completedFamilies.length >= 3 ? (
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                backgroundColor: '#d1fae5',
                color: '#065f46',
                border: '1px solid #6ee7b7',
                padding: '3px 9px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Check size={12} /> Requirement Met
              </span>
            ) : (
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                padding: '3px 9px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <AlertCircle size={12} /> Min 3 Families Required
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Visual Progress Bar */}
        <div style={{
          marginTop: '8px',
          width: '100%',
          height: '6px',
          backgroundColor: '#e2e8f0',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.round((completedFamilies.length / 3) * 100))}%`,
            backgroundColor: completedFamilies.length >= 3 ? '#10b981' : '#2563eb',
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }} />
        </div>

        {/* Completed Families Pills List */}
        {completedFamilies.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Completed Families:</span>
            {completedFamilies.map((f, i) => (
              <span key={f.id || i} style={{
                fontSize: '11px',
                fontWeight: '700',
                backgroundColor: '#ffffff',
                border: '1px solid #a7f3d0',
                color: '#047857',
                padding: '2px 8px',
                borderRadius: '5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Check size={11} /> Family #{f.family_serial_number || i + 1}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Family Pills Selector Bar & Status */}
      <div className="ri-family-nav-bar">
        <div className="ri-family-scroller">
          {families.map((f, idx) => {
            const isSelected =
              (activeRecord?.id && activeRecord.id === f.id) ||
              activeRecord?.family_serial_number === f.family_serial_number;
            const hasSavedId = Boolean(f.id);
            const rawHead = (f.head_of_family_name || '').trim();
            const isEmail = rawHead.includes('@') || /^[^\s@]+@[^\s@]+\.[^\s@]+/.test(rawHead);
            const isDraft = !rawHead || rawHead.toLowerCase().startsWith('draft');
            const headName = (!isEmail && !isDraft) ? rawHead.split(' ')[0] : '';
            const vName = (f.village_name || f.survey_data?.village_name || '').trim();

            return (
              <button
                key={f.id || f.family_serial_number || idx}
                onClick={() => handleSelectFamily(f)}
                type="button"
                className={`ri-family-pill-btn ${isSelected ? 'active' : 'inactive'}`}
              >
                <Home size={13} style={{ color: isSelected ? '#047857' : '#64748b' }} />
                <span>Family #{f.family_serial_number || idx + 1}{headName ? `: ${headName}` : ''}</span>
                {vName && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    color: isSelected ? '#065f46' : '#64748b',
                    backgroundColor: isSelected ? '#d1fae5' : '#f1f5f9',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    marginLeft: '2px'
                  }}>
                    {vName.split(',')[0]}
                  </span>
                )}
                {hasSavedId && (
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10b919' }} title="Saved in DB" />
                )}
              </button>
            );
          })}

          {canEdit && (
            <button
              onClick={startNewFamily}
              type="button"
              className="ri-add-family-btn"
              title="Add another family record"
            >
              <Plus size={13} /> Add Family
            </button>
          )}
        </div>

        {/* Compact Auto-Save status badge */}
        <div>
          {autoSaveStatus === 'saving' && (
            <span className="ri-nav-status-pill saving">
              <RefreshCw size={11} className="ri-spin" /> Saving...
            </span>
          )}
          {autoSaveStatus === 'saved' && (
            <span className="ri-nav-status-pill saved">
              <Check size={11} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Active Family Form Container */}
      {activeRecord ? (
        <div className="ri-active-family-card">
          {/* Active Family Top Header Bar */}
          <div className="ri-family-title-row">
            <div>
              <span className="ri-family-badge-tag">
                Family #{activeRecord.family_serial_number || 1}
                {(activeRecord.village_name || activeRecord.survey_data?.village_name) ? ` • ${activeRecord.village_name || activeRecord.survey_data?.village_name}` : ''}
              </span>
              <h3>
                {activeRecord.head_of_family_name ? activeRecord.head_of_family_name : `Family #${activeRecord.family_serial_number || 1} (Draft)`}
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleDownloadHardCopy}
                disabled={isDownloadingPdf}
                style={{
                  minHeight: '36px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1.5px solid #a7f3d0',
                  backgroundColor: '#ffffff',
                  color: '#065f46',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: isDownloadingPdf ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}
                title="Download printable A4 blank/filled hard copy PDF"
              >
                {isDownloadingPdf ? (
                  <>
                    <RefreshCw size={12} className="ri-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Download size={13} />
                    <span>Download Hard Copy</span>
                  </>
                )}
              </button>

              {canEdit && (activeRecord.id || families.length > 1) && (
                <button
                  type="button"
                  onClick={() => handleDeleteFamily(activeRecord)}
                  className="ri-delete-family-btn"
                >
                  <Trash2 size={12} /> Delete
                </button>
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={handleSaveActiveFamily}
                  disabled={savingRecord}
                  className="ri-save-primary-btn"
                >
                  <Save size={13} />
                  {savingRecord ? 'Saving...' : 'Save Record'}
                </button>
              )}
            </div>
          </div>

          {/* Form Sections A through M + Initial Details (Always Open) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {FAMILY_SURVEY_SECTIONS.map((sec) => {
              const totalQ = sec.questions.filter(isQuestionVisible).length;
              const answeredQ = sec.questions.filter(q => {
                if (!isQuestionVisible(q)) return false;
                const v = getFamilyFieldValue(activeRecord, q.id);
                return v !== '' && v !== null && v !== undefined && v !== 'Not applicable';
              }).length;

              const isComplete = totalQ > 0 && answeredQ === totalQ;

              return (
                <div key={sec.key} className="ri-section-container">
                  {/* Section Header */}
                  <div className="ri-section-header">
                    <div className="ri-section-title-wrap">
                      <span className="ri-section-code-badge">
                        {sec.code}
                      </span>
                      <h4 className="ri-section-title-text">
                        {sec.title}
                      </h4>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span className={`ri-section-progress-pill ${isComplete ? 'done' : 'pending'}`}>
                        {answeredQ}/{totalQ}
                      </span>
                    </div>
                  </div>

                  {/* Section Body - Always Open */}
                  <div className="ri-section-body">
                    {/* Optional Scheme Note */}
                    {sec.schemeNote && (
                      <div style={{
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        marginBottom: '10px',
                        fontSize: '11.5px',
                        color: '#166534',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px'
                      }}>
                        <Info size={14} style={{ flexShrink: 0, marginTop: '2px', color: '#047857' }} />
                        <div style={{ lineHeight: 1.4 }}>{sec.schemeNote}</div>
                      </div>
                    )}

                    {/* Question Layout: 1 col on mobile, 2 cols tablet+ */}
                    <div className="ri-questions-grid">
                      {sec.questions.map((q) => {
                        const visible = isQuestionVisible(q);
                        if (!visible) return null;

                        const val = getFamilyFieldValue(activeRecord, q.id);
                        const isBinary = isBinaryOptions(q.options);

                        return (
                          <div key={q.id} className="ri-question-card">
                            <div>
                              <label className="ri-question-label">
                                {q.label} {q.required && <span style={{ color: '#dc2626' }}>*</span>}
                              </label>
                              {q.instruction && (
                                <p className="ri-question-instruction">
                                  {q.instruction}
                                </p>
                              )}
                            </div>

                            {/* Input or Options Field */}
                            <div>
                              {q.type === 'village_select' ? (
                                <div>
                                  <div className="ri-select-wrapper">
                                    <select
                                      value={
                                        val && !batchVillages.some(bv => bv.name.toLowerCase() === String(val).trim().toLowerCase())
                                          ? '__OTHER__'
                                          : (val || '')
                                      }
                                      disabled={!canEdit}
                                      onChange={(e) => {
                                        const selected = e.target.value;
                                        if (selected === '__OTHER__') {
                                          setShowCustomVillage(true);
                                          updateActiveRecordField('village_name', '');
                                        } else {
                                          setShowCustomVillage(false);
                                          const matched = batchVillages.find(bv => bv.name === selected);
                                          updateActiveRecordField('village_name', selected);
                                          if (matched?.id) {
                                            updateActiveRecordField('ri_village_id', matched.id);
                                          }
                                        }
                                      }}
                                      className="ri-mobile-select"
                                      style={{
                                        color: val ? '#0f172a' : '#94a3b8',
                                        fontWeight: val ? '600' : '400'
                                      }}
                                    >
                                      <option value="">-- Select Village --</option>
                                      {batchVillages.map((v) => (
                                        <option key={v.id || v.name} value={v.name}>
                                          {v.name}{v.district ? ` (${v.district})` : ''}
                                        </option>
                                      ))}
                                      <option value="__OTHER__">+ Other / Enter Village Name...</option>
                                    </select>
                                    <ChevronDown size={16} className="ri-select-chevron" />
                                  </div>

                                  {(showCustomVillage || (val && !batchVillages.some(bv => bv.name.toLowerCase() === String(val).trim().toLowerCase()))) && (
                                    <input
                                      type="text"
                                      placeholder="Type village name here"
                                      value={val || ''}
                                      disabled={!canEdit}
                                      onChange={(e) => updateActiveRecordField('village_name', e.target.value)}
                                      className="ri-mobile-input"
                                      style={{ marginTop: '8px' }}
                                    />
                                  )}
                                </div>
                              ) : q.type === 'textarea' ? (
                                <textarea
                                  rows={3}
                                  placeholder={q.placeholder || ''}
                                  value={val || ''}
                                  disabled={!canEdit}
                                  onChange={(e) => updateActiveRecordField(q.id, e.target.value)}
                                  className="ri-mobile-input"
                                  style={{ minHeight: '76px', resize: 'vertical' }}
                                />
                              ) : q.type === 'number' ? (
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={q.min ?? 0}
                                  max={q.max ?? 999}
                                  placeholder="0"
                                  value={val !== undefined && val !== null ? val : ''}
                                  disabled={!canEdit}
                                  onChange={(e) => updateActiveRecordField(q.id, e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 0))}
                                  className="ri-mobile-input"
                                />
                              ) : q.type === 'text' || q.type === 'tel' ? (
                                <input
                                  type={q.type}
                                  inputMode={q.type === 'tel' ? 'tel' : 'text'}
                                  placeholder={q.placeholder || ''}
                                  value={val || ''}
                                  disabled={!canEdit}
                                  onChange={(e) => updateActiveRecordField(q.id, e.target.value)}
                                  className="ri-mobile-input"
                                />
                              ) : isBinary ? (
                                /* Clean 2-option mobile touch segmented buttons (No preselection) */
                                <div className="ri-binary-grid">
                                  {q.options.map((opt, oIdx) => {
                                    const isOptActive = val === opt;
                                    return (
                                      <button
                                        key={oIdx}
                                        type="button"
                                        disabled={!canEdit}
                                        onClick={() => updateActiveRecordField(q.id, opt)}
                                        className={`ri-binary-btn ${isOptActive ? 'active' : ''}`}
                                      >
                                        {isOptActive && <Check size={13} />}
                                        <span>{opt}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                /* Select with clean styled chevron (No preselection by default) */
                                <div className="ri-select-wrapper">
                                  <select
                                    value={val || ''}
                                    disabled={!canEdit}
                                    onChange={(e) => updateActiveRecordField(q.id, e.target.value)}
                                    className="ri-mobile-select"
                                    style={{
                                      color: val ? '#0f172a' : '#94a3b8',
                                      fontWeight: val ? '600' : '400'
                                    }}
                                  >
                                    <option value="">-- Select Option --</option>
                                    {q.options?.map((opt, oIdx) => (
                                      <option key={oIdx} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown size={16} className="ri-select-chevron" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky Mobile Bottom Save Bar */}
          {canEdit && (
            <div className="ri-sticky-bottom-bar">
              <div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>
                  Family #{activeRecord.family_serial_number || 1}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {activeRecord.head_of_family_name ? activeRecord.head_of_family_name : 'Draft Record'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleDownloadHardCopy}
                  disabled={isDownloadingPdf}
                  style={{
                    minHeight: '36px',
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#065f46',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: isDownloadingPdf ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Download size={13} />
                  <span>{isDownloadingPdf ? 'Generating...' : 'Hard Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveActiveFamily}
                  disabled={savingRecord}
                  className="ri-save-primary-btn"
                >
                  <Save size={14} />
                  {savingRecord ? 'Saving...' : `Save Family #${activeRecord.family_serial_number || 1}`}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          padding: '30px 10px',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px dashed #cbd5e1',
          marginBottom: '14px'
        }}>
          <Home size={28} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
          <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
            No family visit records found. Click <strong>"Add Family"</strong> above to record your first household.
          </p>
        </div>
      )}

      {/* Global Final Submit Bar */}
      {isSubmitted && !isCorrection && !isEditingResponse && existingForm.status !== 'Reviewed' ? (
        <div className="ri-final-submit-box">
          <div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              <span>Status: Family Visit Survey Submitted</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: '600' }}>
              {families.length} {families.length === 1 ? 'Family' : 'Families'} Recorded ({completedFamilies.length} completed).
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditingResponse(true)}
            className="ri-final-submit-btn"
            style={{ backgroundColor: '#047857' }}
          >
            <Edit3 size={15} />
            <span>Edit Response</span>
          </button>
        </div>
      ) : isEditingResponse ? (
        <div className="ri-final-submit-box">
          <div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
              {families.length} {families.length === 1 ? 'Family' : 'Families'} Recorded • {completedFamilies.length} of 3 Completed
            </div>
            <div style={{
              fontSize: '11px',
              color: completedFamilies.length >= 3 ? '#047857' : '#b45309',
              marginTop: '2px',
              fontWeight: '600'
            }}>
              {completedFamilies.length >= 3
                ? 'All minimum 3 required family visits completed. You can update and resubmit.'
                : 'Minimum 3 completed family visits required before submission.'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setIsEditingResponse(false);
                isDirtyRef.current = false;
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitAllFamilies}
              disabled={savingRecord}
              className="ri-final-submit-btn"
            >
              <Send size={15} />
              Update & Resubmit All Families
            </button>
          </div>
        </div>
      ) : canEdit && families.length > 0 ? (
        <div className="ri-final-submit-box">
          <div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
              {families.length} {families.length === 1 ? 'Family' : 'Families'} Recorded • {completedFamilies.length} of 3 Completed
            </div>
            <div style={{
              fontSize: '11px',
              color: completedFamilies.length >= 3 ? '#047857' : '#b45309',
              marginTop: '2px',
              fontWeight: '600'
            }}>
              {completedFamilies.length >= 3
                ? 'All minimum 3 required family visits completed. You can proceed with final submission.'
                : 'Minimum 3 completed family visits required before final submission. Drafts are safely saved.'}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmitAllFamilies}
            disabled={savingRecord}
            className="ri-final-submit-btn"
          >
            <Send size={15} />
            Submit All Completed Families
          </button>
        </div>
      ) : null}
    </div>
  );
}
