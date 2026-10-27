import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UploadCloud,
  Camera,
  FileText,
  FileCheck,
  Search,
  Download,
  Trash2,
  Eye,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  MapPin,
  Users,
  Layers,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  RefreshCw,
  Maximize2,
  Video,
  PlayCircle
} from 'lucide-react';
import SecureImage from '../shared/SecureImage';
import SecureVideo from '../shared/SecureVideo';
import { downloadSecureFile, openSecureFile } from '../utils/secureFileHelpers';
import API_BASE_URL from '@/config/apiConfig';

const API = API_BASE_URL;

// Helper to format file size
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Helper to format date
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

export default function RiFacultyUploadsModule({ isMobile = false }) {
  // Batches dataset
  const [batches, setBatches] = useState([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);

  // Navigation State:
  // Level 1: selectedBatch === null, selectedPanel === null
  // Level 2: selectedBatch !== null, selectedPanel === null
  // Level 3: selectedBatch !== null, selectedPanel !== null
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedPanel, setSelectedPanel] = useState(null);

  // Panels dataset for selected batch
  const [batchPanels, setBatchPanels] = useState([]);
  const [isLoadingPanels, setIsLoadingPanels] = useState(false);

  // Filters & display state
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' | 'photo' | 'gram_panchayat_certificate' | 'stakeholder_feedback'
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [hoveredId, setHoveredId] = useState(null);

  // Uploads data state
  const [uploads, setUploads] = useState([]);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Lightbox Modal for Photo / Video Preview
  const [lightboxItem, setLightboxItem] = useState(null);

  // Delete Confirmation Modal
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Fetch batches
  const fetchBatches = useCallback(async () => {
    setIsLoadingBatches(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const batchesRes = await fetch(`${API}/api/ri/batches`, { headers });
      if (batchesRes.ok) {
        const bData = await batchesRes.json();
        setBatches(Array.isArray(bData) ? bData : (bData.batches || []));
      }
    } catch (err) {
      console.error('Failed to load batches for faculty uploads:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // 2. Fetch panels for selected batch
  const fetchPanelsForBatch = useCallback(async (batchId) => {
    if (!batchId) {
      setBatchPanels([]);
      return;
    }
    setIsLoadingPanels(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch(`${API}/api/ri/batches/${batchId}/panels`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBatchPanels(Array.isArray(data) ? data : (data.panels || []));
      }
    } catch (err) {
      console.error('Failed to load batch panels:', err);
    } finally {
      setIsLoadingPanels(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBatch && selectedBatch.id) {
      fetchPanelsForBatch(selectedBatch.id);
    } else {
      setBatchPanels([]);
    }
  }, [selectedBatch, fetchPanelsForBatch]);

  // 3. Fetch all uploads
  const fetchUploads = useCallback(async () => {
    setIsLoadingUploads(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/faculty-uploads`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUploads(data.uploads || []);
      } else {
        setError(data.message || 'Failed to fetch faculty uploads.');
      }
    } catch (err) {
      console.error('Error fetching faculty uploads:', err);
      setError('Network error while fetching faculty uploads. Please try again.');
    } finally {
      setIsLoadingUploads(false);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  // Delete an upload item
  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/faculty-uploads/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Upload deleted successfully.');
        setItemToDelete(null);
        fetchUploads();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(data.message || 'Failed to delete upload.');
      }
    } catch (err) {
      console.error('Error deleting upload:', err);
      setError('Network error while deleting upload. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Level 1: Batches with upload counts ──
  const batchesWithCounts = useMemo(() => {
    const map = new Map();

    batches.forEach(b => {
      const bId = String(b.id);
      map.set(bId, {
        id: b.id,
        name: b.name || `Batch ${b.id}`,
        academic_year: b.academic_year || b.year,
        uploadsCount: 0,
        photosCount: 0,
        certsCount: 0,
        videosCount: 0
      });
    });

    uploads.forEach(u => {
      const bId = u.ri_batch_id ? String(u.ri_batch_id) : 'unassigned';
      if (!map.has(bId)) {
        map.set(bId, {
          id: u.ri_batch_id || 'unassigned',
          name: u.batch_name || (bId === 'unassigned' ? 'Unassigned Batch' : `Batch ${bId}`),
          academic_year: u.batch_academic_year,
          uploadsCount: 0,
          photosCount: 0,
          certsCount: 0,
          videosCount: 0
        });
      }
      const bData = map.get(bId);
      bData.uploadsCount += 1;
      if (u.category === 'gram_panchayat_certificate') {
        bData.certsCount += 1;
      } else if (u.category === 'stakeholder_feedback' || u.category === 'stakeholder_feedback_video' || (u.mime_type && u.mime_type.startsWith('video/'))) {
        bData.videosCount += 1;
      } else {
        bData.photosCount += 1;
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (a.id === 'unassigned') return 1;
      if (b.id === 'unassigned') return -1;
      const numA = parseInt(a.id, 10);
      const numB = parseInt(b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    return list;
  }, [batches, uploads]);

  const filteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return batchesWithCounts;
    const q = searchQuery.trim().toLowerCase();
    return batchesWithCounts.filter(b =>
      b.name.toLowerCase().includes(q) ||
      String(b.academic_year || '').toLowerCase().includes(q)
    );
  }, [batchesWithCounts, searchQuery]);

  // ── Level 2: Panels with upload counts for selected batch ──
  const panelsWithCounts = useMemo(() => {
    if (!selectedBatch) return [];

    const batchUploads = uploads.filter(u => String(u.ri_batch_id) === String(selectedBatch.id));
    const map = new Map();

    batchPanels.forEach(p => {
      const pId = String(p.id);
      map.set(pId, {
        id: p.id,
        panel_number: p.panel_number,
        name: p.name || (p.panel_number ? `Panel #${p.panel_number}` : `Panel ${p.id}`),
        village_name: p.village_name || '',
        uploadsCount: 0,
        photosCount: 0,
        certsCount: 0,
        videosCount: 0
      });
    });

    batchUploads.forEach(u => {
      const pId = u.ri_panel_id ? String(u.ri_panel_id) : 'unassigned';
      if (!map.has(pId)) {
        map.set(pId, {
          id: u.ri_panel_id || 'unassigned',
          panel_number: u.panel_number,
          name: u.panel_name || (u.panel_number ? `Panel #${u.panel_number}` : (pId === 'unassigned' ? 'Unassigned Panel' : `Panel ${pId}`)),
          village_name: u.village_name || '',
          uploadsCount: 0,
          photosCount: 0,
          certsCount: 0,
          videosCount: 0
        });
      }
      const pData = map.get(pId);
      pData.uploadsCount += 1;
      if (u.category === 'gram_panchayat_certificate') {
        pData.certsCount += 1;
      } else if (u.category === 'stakeholder_feedback' || u.category === 'stakeholder_feedback_video' || (u.mime_type && u.mime_type.startsWith('video/'))) {
        pData.videosCount += 1;
      } else {
        pData.photosCount += 1;
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (a.id === 'unassigned') return 1;
      if (b.id === 'unassigned') return -1;
      const numA = parseInt(a.panel_number ?? a.id, 10);
      const numB = parseInt(b.panel_number ?? b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    return list;
  }, [selectedBatch, batchPanels, uploads]);

  const filteredPanels = useMemo(() => {
    if (!searchQuery.trim()) return panelsWithCounts;
    const q = searchQuery.trim().toLowerCase();
    return panelsWithCounts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.village_name && p.village_name.toLowerCase().includes(q))
    );
  }, [panelsWithCounts, searchQuery]);

  // ── Level 3: Uploads for selected panel ──
  const allCurrentPanelUploads = useMemo(() => {
    if (!selectedBatch || !selectedPanel) return [];
    return uploads.filter(u => {
      const matchBatch = String(u.ri_batch_id) === String(selectedBatch.id);
      const matchPanel = selectedPanel.id === 'unassigned'
        ? (!u.ri_panel_id || String(u.ri_panel_id) === 'unassigned')
        : String(u.ri_panel_id) === String(selectedPanel.id);
      return matchBatch && matchPanel;
    });
  }, [uploads, selectedBatch, selectedPanel]);

  const panelPhotosCount = useMemo(() => {
    return allCurrentPanelUploads.filter(u => u.category === 'photo' || !u.category || (u.file_name && /\.(jpg|jpeg|png|webp|gif)$/i.test(u.file_name))).length;
  }, [allCurrentPanelUploads]);

  const panelCertsCount = useMemo(() => {
    return allCurrentPanelUploads.filter(u => u.category === 'gram_panchayat_certificate').length;
  }, [allCurrentPanelUploads]);

  const panelVideosCount = useMemo(() => {
    return allCurrentPanelUploads.filter(u => u.category === 'stakeholder_feedback' || u.category === 'stakeholder_feedback_video' || (u.mime_type && u.mime_type.startsWith('video/'))).length;
  }, [allCurrentPanelUploads]);

  const filteredPanelUploads = useMemo(() => {
    let list = allCurrentPanelUploads;

    if (selectedCategory && selectedCategory !== 'all') {
      if (selectedCategory === 'photo') {
        list = list.filter(u => u.category === 'photo' || !u.category || (u.file_name && /\.(jpg|jpeg|png|webp|gif)$/i.test(u.file_name)));
      } else if (selectedCategory === 'gram_panchayat_certificate') {
        list = list.filter(u => u.category === 'gram_panchayat_certificate');
      } else if (selectedCategory === 'stakeholder_feedback') {
        list = list.filter(u => u.category === 'stakeholder_feedback' || u.category === 'stakeholder_feedback_video' || (u.mime_type && u.mime_type.startsWith('video/')));
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(u =>
        (u.file_name && u.file_name.toLowerCase().includes(q)) ||
        (u.caption && u.caption.toLowerCase().includes(q)) ||
        (u.panel_name && u.panel_name.toLowerCase().includes(q)) ||
        (u.uploaded_by_name && u.uploaded_by_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allCurrentPanelUploads, selectedCategory, searchQuery]);

  // Lightbox photo list
  const photoList = useMemo(() => {
    const sourceList = selectedPanel ? filteredPanelUploads : uploads;
    return sourceList.filter(u => u.category === 'photo' || !u.category || (u.file_name && /\.(jpg|jpeg|png|webp|gif)$/i.test(u.file_name)));
  }, [selectedPanel, filteredPanelUploads, uploads]);

  const currentPhotoIndex = useMemo(() => {
    if (!lightboxItem) return -1;
    return photoList.findIndex(p => p.id === lightboxItem.id);
  }, [lightboxItem, photoList]);

  const handlePrevPhoto = useCallback((e) => {
    e?.stopPropagation();
    if (photoList.length <= 1) return;
    if (currentPhotoIndex > 0) {
      setLightboxItem(photoList[currentPhotoIndex - 1]);
    } else {
      setLightboxItem(photoList[photoList.length - 1]);
    }
  }, [currentPhotoIndex, photoList]);

  const handleNextPhoto = useCallback((e) => {
    e?.stopPropagation();
    if (photoList.length <= 1) return;
    if (currentPhotoIndex >= 0 && currentPhotoIndex < photoList.length - 1) {
      setLightboxItem(photoList[currentPhotoIndex + 1]);
    } else {
      setLightboxItem(photoList[0]);
    }
  }, [currentPhotoIndex, photoList]);

  useEffect(() => {
    if (!lightboxItem) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setLightboxItem(null);
      if (e.key === 'ArrowLeft') handlePrevPhoto();
      if (e.key === 'ArrowRight') handleNextPhoto();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxItem, handlePrevPhoto, handleNextPhoto]);

  return (
    <div style={{ padding: isMobile ? '12px' : '20px 24px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'inherit' }}>

      {/* Notifications */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13.5px'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: '#991b1b', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13.5px'
        }}>
          <CheckCircle size={18} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'transparent', border: 'none', color: '#065f46', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Three-Level Breadcrumbs & Control Bar ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        padding: isMobile ? '12px 14px' : '14px 18px',
        border: '1px solid #e2e8f0',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: '12px'
      }}>
        {/* Navigation Breadcrumb / Return Path */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {selectedBatch ? (
            <button
              onClick={() => {
                if (selectedPanel) {
                  setSelectedPanel(null);
                  setSearchQuery('');
                } else {
                  setSelectedBatch(null);
                  setSelectedPanel(null);
                  setSearchQuery('');
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#334155',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <ChevronLeft size={16} />
              {selectedPanel ? 'Back to Panels' : 'Back to Batches'}
            </button>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', color: '#64748b' }}>
            <span
              onClick={() => {
                if (selectedBatch) {
                  setSelectedBatch(null);
                  setSelectedPanel(null);
                  setSearchQuery('');
                }
              }}
              style={{
                cursor: selectedBatch ? 'pointer' : 'default',
                color: selectedBatch ? '#047857' : '#0f172a',
                fontWeight: selectedBatch ? '600' : '800',
                fontSize: selectedBatch ? '13px' : (isMobile ? '16px' : '18px')
              }}
            >
              Batches
            </span>

            {selectedBatch && (
              <>
                <ChevronRight size={14} style={{ color: '#94a3b8' }} />
                <span
                  onClick={() => {
                    if (selectedPanel) {
                      setSelectedPanel(null);
                      setSearchQuery('');
                    }
                  }}
                  style={{
                    cursor: selectedPanel ? 'pointer' : 'default',
                    color: selectedPanel ? '#047857' : '#0f172a',
                    fontWeight: selectedPanel ? '600' : '800',
                    fontSize: selectedPanel ? '13px' : (isMobile ? '16px' : '18px')
                  }}
                >
                  {selectedBatch.name}
                </span>
              </>
            )}

            {selectedPanel && (
              <>
                <ChevronRight size={14} style={{ color: '#94a3b8' }} />
                <span style={{ fontWeight: '800', color: '#0f172a', fontSize: isMobile ? '16px' : '18px' }}>
                  {selectedPanel.name}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right Tools: Search, Refresh, View Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: isMobile ? 1 : 'none', minWidth: isMobile ? '140px' : '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder={
                selectedPanel
                  ? "Search uploads..."
                  : selectedBatch
                  ? "Search panels..."
                  : "Search batches..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 30px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                background: '#ffffff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => {
              fetchUploads();
              if (selectedBatch?.id) fetchPanelsForBatch(selectedBatch.id);
            }}
            title="Refresh"
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            <RefreshCw size={14} />
            <span style={{ display: isMobile ? 'none' : 'inline' }}>Refresh</span>
          </button>

          {/* Grid / Table Toggle on Level 3 */}
          {selectedPanel && (
            <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setViewMode('grid')}
                title="Grid view"
                style={{
                  padding: '6px 10px',
                  border: 'none',
                  background: viewMode === 'grid' ? '#047857' : '#ffffff',
                  color: viewMode === 'grid' ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Grid size={15} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Table view"
                style={{
                  padding: '6px 10px',
                  border: 'none',
                  background: viewMode === 'table' ? '#047857' : '#ffffff',
                  color: viewMode === 'table' ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <List size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Level 3 Quick Category Pills */}
      {selectedBatch && selectedPanel && (
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '18px',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setSelectedCategory('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: '700',
              border: selectedCategory === 'all' ? '1px solid #047857' : '1px solid #e2e8f0',
              background: selectedCategory === 'all' ? '#ecfdf5' : '#ffffff',
              color: selectedCategory === 'all' ? '#047857' : '#64748b',
              cursor: 'pointer'
            }}
          >
            All Uploads ({allCurrentPanelUploads.length})
          </button>
          <button
            onClick={() => setSelectedCategory('photo')}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: '700',
              border: selectedCategory === 'photo' ? '1px solid #047857' : '1px solid #e2e8f0',
              background: selectedCategory === 'photo' ? '#ecfdf5' : '#ffffff',
              color: selectedCategory === 'photo' ? '#047857' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Camera size={13} /> Field Visit Photos ({panelPhotosCount})
          </button>
          <button
            onClick={() => setSelectedCategory('gram_panchayat_certificate')}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: '700',
              border: selectedCategory === 'gram_panchayat_certificate' ? '1px solid #047857' : '1px solid #e2e8f0',
              background: selectedCategory === 'gram_panchayat_certificate' ? '#ecfdf5' : '#ffffff',
              color: selectedCategory === 'gram_panchayat_certificate' ? '#047857' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <FileCheck size={13} /> GP Certificates ({panelCertsCount})
          </button>
          <button
            onClick={() => setSelectedCategory('stakeholder_feedback')}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: '700',
              border: selectedCategory === 'stakeholder_feedback' ? '1px solid #047857' : '1px solid #e2e8f0',
              background: selectedCategory === 'stakeholder_feedback' ? '#ecfdf5' : '#ffffff',
              color: selectedCategory === 'stakeholder_feedback' ? '#047857' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Video size={13} /> Stakeholder Videos ({panelVideosCount})
          </button>
        </div>
      )}

      {/* ── Main View Area Based on Active Level ── */}
      {isLoadingUploads || isLoadingBatches ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#047857', margin: '0 auto 12px auto' }} />
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>Loading faculty uploads...</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Fetching batches and upload records</div>
        </div>
      ) : !selectedBatch ? (
        /* ════════════════════════════════════════════════════════════════
           LEVEL 1 — BATCHES
           ════════════════════════════════════════════════════════════════ */
        filteredBatches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <UploadCloud size={44} style={{ color: '#cbd5e1', margin: '0 auto 12px auto' }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
              No batches found
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              {searchQuery ? 'No batches match your search query.' : 'No RI batches are currently available.'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: isMobile ? '12px' : '16px'
          }}>
            {filteredBatches.map(b => {
              const isHovered = hoveredId === `batch-${b.id}`;
              return (
                <div
                  key={b.id}
                  onClick={() => {
                    setSelectedBatch(b);
                    setSelectedPanel(null);
                    setSearchQuery('');
                  }}
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    border: '1.5px solid #e2e8f0',
                    padding: '20px',
                    cursor: 'pointer',
                    boxShadow: isHovered ? '0 10px 24px -4px rgba(4, 120, 87, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
                    borderColor: isHovered ? '#059669' : '#e2e8f0',
                    transition: 'all 0.2s ease',
                    transform: isHovered ? 'translateY(-2px)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '140px'
                  }}
                  onMouseEnter={() => setHoveredId(`batch-${b.id}`)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Layers size={20} />
                      </div>
                      <span style={{
                        background: b.uploadsCount > 0 ? '#ecfdf5' : '#f1f5f9',
                        color: b.uploadsCount > 0 ? '#047857' : '#64748b',
                        border: b.uploadsCount > 0 ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '4px 10px',
                        borderRadius: '999px'
                      }}>
                        {b.uploadsCount} {b.uploadsCount === 1 ? 'upload' : 'uploads'}
                      </span>
                    </div>

                    <h3 style={{
                      fontSize: '17px',
                      fontWeight: '800',
                      color: '#0f172a',
                      margin: '0 0 4px 0',
                      lineHeight: '1.3',
                      wordBreak: 'break-word'
                    }}>
                      {b.name}
                    </h3>
                    {b.academic_year && (
                      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', marginBottom: '6px' }}>
                        Academic Year: {b.academic_year}
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#64748b',
                      marginTop: '6px',
                      flexWrap: 'wrap'
                    }}>
                      <span>{b.photosCount} photos</span>
                      <span style={{ color: '#cbd5e1' }}>•</span>
                      <span>{b.certsCount} certs</span>
                      <span style={{ color: '#cbd5e1' }}>•</span>
                      <span>{b.videosCount} videos</span>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '16px',
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#047857'
                  }}>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '500' }}>
                      {b.uploadsCount > 0 ? `${b.uploadsCount} files` : 'No files'}
                    </span>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      color: '#047857'
                    }}>
                      <span>View Panels</span>
                      <ChevronRight size={14} style={{
                        transition: 'transform 0.15s ease',
                        transform: isHovered ? 'translateX(2px)' : 'none'
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : !selectedPanel ? (
        /* ════════════════════════════════════════════════════════════════
           LEVEL 2 — PANELS
           ════════════════════════════════════════════════════════════════ */
        isLoadingPanels ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: '#047857', margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>Loading panels for {selectedBatch.name}...</div>
          </div>
        ) : filteredPanels.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <UploadCloud size={44} style={{ color: '#cbd5e1', margin: '0 auto 12px auto' }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
              No panels found
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              {searchQuery ? 'No panels match your search.' : `No panels are associated with ${selectedBatch.name}.`}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: isMobile ? '12px' : '16px'
          }}>
            {filteredPanels.map(p => {
              const isHovered = hoveredId === `panel-${p.id}`;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedPanel(p);
                    setSearchQuery('');
                  }}
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    border: '1.5px solid #e2e8f0',
                    padding: '20px',
                    cursor: 'pointer',
                    boxShadow: isHovered ? '0 10px 24px -4px rgba(4, 120, 87, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
                    borderColor: isHovered ? '#059669' : '#e2e8f0',
                    transition: 'all 0.2s ease',
                    transform: isHovered ? 'translateY(-2px)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '135px'
                  }}
                  onMouseEnter={() => setHoveredId(`panel-${p.id}`)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Users size={20} />
                      </div>
                      <span style={{
                        background: p.uploadsCount > 0 ? '#ecfdf5' : '#f1f5f9',
                        color: p.uploadsCount > 0 ? '#047857' : '#64748b',
                        border: p.uploadsCount > 0 ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '4px 10px',
                        borderRadius: '999px'
                      }}>
                        {p.uploadsCount} {p.uploadsCount === 1 ? 'upload' : 'uploads'}
                      </span>
                    </div>

                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '800',
                      color: '#0f172a',
                      margin: '0 0 4px 0',
                      lineHeight: '1.3',
                      wordBreak: 'break-word'
                    }}>
                      {p.name}
                    </h3>
                    {p.village_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                        <MapPin size={12} style={{ color: '#047857', flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.village_name}
                        </span>
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#64748b',
                      marginTop: '6px',
                      flexWrap: 'wrap'
                    }}>
                      <span>{p.photosCount} photos</span>
                      <span style={{ color: '#cbd5e1' }}>•</span>
                      <span>{p.certsCount} certs</span>
                      <span style={{ color: '#cbd5e1' }}>•</span>
                      <span>{p.videosCount} videos</span>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '16px',
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#047857'
                  }}>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '500' }}>
                      {p.uploadsCount > 0 ? `${p.uploadsCount} files` : 'No files'}
                    </span>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      color: '#047857'
                    }}>
                      <span>View Uploads</span>
                      <ChevronRight size={14} style={{
                        transition: 'transform 0.15s ease',
                        transform: isHovered ? 'translateX(2px)' : 'none'
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ════════════════════════════════════════════════════════════════
           LEVEL 3 — UPLOADS (SIMPLIFIED CARDS)
           ════════════════════════════════════════════════════════════════ */
        filteredPanelUploads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <UploadCloud size={44} style={{ color: '#cbd5e1', margin: '0 auto 12px auto' }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
              No uploads found
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              {searchQuery
                ? 'No files match your search in this panel.'
                : selectedCategory !== 'all'
                ? 'No files match the selected upload type in this panel.'
                : `No faculty uploads have been submitted yet for ${selectedPanel.name}.`}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View of Simplified Upload Cards */
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(160px, 1fr))' : 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: isMobile ? '12px' : '16px'
          }}>
            {filteredPanelUploads.map(item => {
              const isCert = item.category === 'gram_panchayat_certificate';
              const isVideo = item.category === 'stakeholder_feedback' || item.category === 'stakeholder_feedback_video' || (item.mime_type && item.mime_type.startsWith('video/'));
              const isDoc = isCert && item.file_name && !/\.(jpg|jpeg|png|webp|gif)$/i.test(item.file_name);
              const isHovered = hoveredId === item.id;
              const panelDisplayName = item.panel_name || selectedPanel?.name || (item.panel_number ? `Panel #${item.panel_number}` : 'Panel');

              return (
                <div
                  key={item.id}
                  style={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: isHovered ? '0 8px 20px -4px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'all 0.2s ease',
                    transform: isHovered ? 'translateY(-2px)' : 'none'
                  }}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Media Preview Box */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '16 / 10',
                      background: isDoc ? '#f8fafc' : '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      overflow: 'hidden'
                    }}
                    onClick={() => isDoc ? openSecureFile(item.file_url) : setLightboxItem(item)}
                  >
                    {isVideo ? (
                      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <SecureVideo
                          src={item.file_url}
                          preload="metadata"
                          controls={false}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                        />
                        <div style={{
                          position: 'absolute',
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: 'rgba(4, 120, 87, 0.95)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          backdropFilter: 'blur(4px)'
                        }}>
                          <PlayCircle size={22} />
                        </div>
                      </div>
                    ) : isDoc ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px' }}>
                        <div style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '12px',
                          background: '#ecfdf5',
                          color: '#047857',
                          border: '1px solid #a7f3d0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <FileCheck size={26} />
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                          GP Certificate (PDF)
                        </span>
                      </div>
                    ) : (
                      <SecureImage
                        src={item.file_url}
                        alt={panelDisplayName}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          transition: 'transform 0.3s ease',
                          transform: isHovered ? 'scale(1.04)' : 'scale(1.0)'
                        }}
                      />
                    )}

                    {/* File-type Badge */}
                    <div style={{ position: 'absolute', top: '8px', left: '8px' }}>
                      {isVideo ? (
                        <span style={{
                          background: 'rgba(2, 132, 199, 0.95)',
                          color: '#ffffff',
                          fontSize: '10.5px',
                          fontWeight: '700',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backdropFilter: 'blur(4px)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>
                          <Video size={11} /> Video
                        </span>
                      ) : isCert ? (
                        <span style={{
                          background: 'rgba(194, 65, 12, 0.95)',
                          color: '#ffffff',
                          fontSize: '10.5px',
                          fontWeight: '700',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backdropFilter: 'blur(4px)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>
                          <FileCheck size={11} /> GP Certificate
                        </span>
                      ) : (
                        <span style={{
                          background: 'rgba(15, 23, 42, 0.85)',
                          color: '#ffffff',
                          fontSize: '10.5px',
                          fontWeight: '700',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backdropFilter: 'blur(4px)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>
                          <Camera size={11} /> Photo
                        </span>
                      )}
                    </div>

                    {/* File Size Badge */}
                    {item.file_size && (
                      <span style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(0,0,0,0.65)',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backdropFilter: 'blur(4px)'
                      }}>
                        {formatFileSize(item.file_size)}
                      </span>
                    )}
                  </div>

                  {/* Card Body: Show ONLY Associated Panel Name and Action Buttons */}
                  <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13.5px',
                      fontWeight: '700',
                      color: '#0f172a',
                      marginBottom: '10px'
                    }}>
                      <Users size={14} style={{ color: '#047857', flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {panelDisplayName}
                      </span>
                    </div>

                    {/* Actions: View, Download, Delete */}
                    <div style={{
                      display: 'flex',
                      gap: '6px',
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: '10px'
                    }}>
                      <button
                        type="button"
                        onClick={() => isDoc ? openSecureFile(item.file_url) : setLightboxItem(item)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '7px',
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          color: '#1e293b',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px'
                        }}
                      >
                        <Eye size={13} /> View
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadSecureFile(item.file_url, item.file_name)}
                        title="Download"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '7px',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#047857',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        <Download size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        title="Delete"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '7px',
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          color: '#dc2626',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View of Simplified Records (No file title, no filename, no village) */
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '12px 16px' }}>Type</th>
                    <th style={{ padding: '12px 16px' }}>Associated Panel</th>
                    <th style={{ padding: '12px 16px' }}>File Size</th>
                    <th style={{ padding: '12px 16px' }}>Upload Date</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPanelUploads.map(item => {
                    const isCert = item.category === 'gram_panchayat_certificate';
                    const isVideo = item.category === 'stakeholder_feedback' || item.category === 'stakeholder_feedback_video' || (item.mime_type && item.mime_type.startsWith('video/'));
                    const isDoc = isCert && item.file_name && !/\.(jpg|jpeg|png|webp|gif)$/i.test(item.file_name);
                    const panelDisplayName = item.panel_name || selectedPanel?.name || (item.panel_number ? `Panel #${item.panel_number}` : 'Panel');

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: isVideo ? '#f0f9ff' : (isCert ? '#fff7ed' : '#ecfdf5'),
                            color: isVideo ? '#0284c7' : (isCert ? '#c2410c' : '#047857'),
                            border: isVideo ? '1px solid #bae6fd' : (isCert ? '1px solid #fed7aa' : '1px solid #a7f3d0'),
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {isVideo ? <Video size={12} /> : (isCert ? <FileCheck size={12} /> : <Camera size={12} />)}
                            {isVideo ? 'Video' : (isCert ? 'GP Certificate' : 'Photo')}
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0f172a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Users size={14} style={{ color: '#047857', flexShrink: 0 }} />
                            <span>{panelDisplayName}</span>
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                          {formatFileSize(item.file_size)}
                        </td>

                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                          {formatDate(item.created_at)}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (isDoc) {
                                  openSecureFile(item.file_url);
                                } else {
                                  setLightboxItem(item);
                                }
                              }}
                              title="View"
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#334155',
                                cursor: 'pointer'
                              }}
                            >
                              <Eye size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => downloadSecureFile(item.file_url, item.file_name)}
                              title="Download"
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1px solid #a7f3d0',
                                background: '#ecfdf5',
                                color: '#047857',
                                display: 'inline-flex',
                                alignItems: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <Download size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setItemToDelete(item)}
                              title="Delete"
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1px solid #fecaca',
                                background: '#fef2f2',
                                color: '#dc2626',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── Photo / Video Lightbox Modal with Next / Prev Navigation ── */}
      {lightboxItem && (
        <div
          onClick={() => setLightboxItem(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.94)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          {/* Top Bar with counter & close */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '16px',
              left: '20px',
              right: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#ffffff'
            }}
          >
            <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>
              {currentPhotoIndex >= 0 ? `Photo ${currentPhotoIndex + 1} of ${photoList.length}` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => downloadSecureFile(lightboxItem.file_url, lightboxItem.file_name)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                <Download size={14} /> Download
              </button>
              <button
                onClick={() => setLightboxItem(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Close (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Navigation Arrows (for photos) */}
          {!((lightboxItem.category === 'stakeholder_feedback' || lightboxItem.category === 'stakeholder_feedback_video' || (lightboxItem.mime_type && lightboxItem.mime_type.startsWith('video/')))) && photoList.length > 1 && (
            <>
              <button
                onClick={handlePrevPhoto}
                style={{
                  position: 'absolute',
                  left: isMobile ? '10px' : '24px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(6px)',
                  transition: 'background 0.15s ease',
                  zIndex: 10
                }}
                title="Previous photo (Left arrow)"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={handleNextPhoto}
                style={{
                  position: 'absolute',
                  right: isMobile ? '10px' : '24px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(6px)',
                  transition: 'background 0.15s ease',
                  zIndex: 10
                }}
                title="Next photo (Right arrow)"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Main Media */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '88vw',
              maxHeight: '76vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {lightboxItem.category === 'stakeholder_feedback' || lightboxItem.category === 'stakeholder_feedback_video' || (lightboxItem.mime_type && lightboxItem.mime_type.startsWith('video/')) ? (
              <SecureVideo
                src={lightboxItem.file_url}
                controls
                autoPlay
                playsInline
                style={{ maxWidth: '90vw', maxHeight: '76vh', borderRadius: '8px', background: '#000000', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
              />
            ) : (
              <SecureImage
                src={lightboxItem.file_url}
                alt={lightboxItem.caption || lightboxItem.file_name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '76vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                }}
                title=""
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>

          {/* Bottom Info */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              textAlign: 'center',
              color: '#ffffff',
              marginTop: '16px',
              maxWidth: '680px',
              padding: '0 16px'
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: '700' }}>
              {lightboxItem.panel_name ? lightboxItem.panel_name : (lightboxItem.caption || lightboxItem.file_name)}
            </div>
            <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {lightboxItem.village_name && (
                <span>Village: <strong>{lightboxItem.village_name}</strong></span>
              )}
              {lightboxItem.panel_name && (
                <span>• Panel: {lightboxItem.panel_name}</span>
              )}
              {lightboxItem.uploaded_by_name && (
                <span>• Mentor: {lightboxItem.uploaded_by_name}</span>
              )}
              {lightboxItem.created_at && (
                <span>• {formatDate(lightboxItem.created_at)}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -- Delete Confirmation Modal -- */}
      {itemToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '420px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <Trash2 size={22} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', textAlign: 'center', color: '#0f172a' }}>
              Delete Faculty Upload
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13.5px', color: '#64748b', textAlign: 'center', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete this {
                itemToDelete.category === 'gram_panchayat_certificate'
                  ? 'Gram Panchayat Certificate'
                  : (itemToDelete.category === 'stakeholder_feedback' || itemToDelete.category === 'stakeholder_feedback_video'
                    ? 'stakeholder feedback video'
                    : 'field visit photo')
              }? The physical file will also be removed.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
