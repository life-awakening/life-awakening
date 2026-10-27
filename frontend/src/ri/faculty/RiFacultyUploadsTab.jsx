import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  UploadCloud,
  Camera,
  FileText,
  Trash2,
  Eye,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Download,
  Calendar,
  User,
  Image as ImageIcon,
  Sparkles,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Lock,
  FileCheck,
  RefreshCw,
  ExternalLink,
  Video,
  PlayCircle,
  Film,
  Clock,
  Table,
  Grid,
  List,
  CheckCircle2,
  PlusCircle,
  Layers,
  ArrowRight,
  MapPin
} from 'lucide-react';
import SecureImage from '../shared/SecureImage';
import SecureVideo from '../shared/SecureVideo';
import { downloadSecureFile, openSecureFile } from '../utils/secureFileHelpers';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Single primary brand color tokens (Emerald)
const PRIMARY = '#047857';
const PRIMARY_LIGHT = '#ecfdf5';
const PRIMARY_BORDER = '#a7f3d0';

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

// Robust URL resolver for files (routes uploaded assets through /api/uploads for CloudFront compatibility)
const resolveFileUrl = (url) => {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('/uploads/') && !trimmed.includes('/api/uploads/')) {
      return trimmed.replace('/uploads/', '/api/uploads/');
    }
    return trimmed;
  }
  let clean = trimmed;
  if (clean.startsWith('/uploads/')) {
    clean = `/api${clean}`;
  } else if (clean.startsWith('uploads/')) {
    clean = `/api/${clean}`;
  } else if (clean.startsWith('ri_faculty_uploads/')) {
    clean = `/api/ri/faculty/files/view?key=${encodeURIComponent(clean)}`;
  } else if (!clean.startsWith('/api/')) {
    clean = `/api/uploads/${clean.startsWith('/') ? clean.slice(1) : clean}`;
  }
  const base = API && API.trim() ? API.trim().replace(/\/+$/, '') : '';
  return base ? `${base}${clean.startsWith('/') ? '' : '/'}${clean}` : clean;
};

export default function RiFacultyUploadsTab({
  selectedBatchId,
  selectedPanelId,
  panelData,
  isMobile = false,
  addToast
}) {
  // Navigation: 'all' | 'photos' | 'certificate' | 'video'
  const [activeUploadTab, setActiveUploadTab] = useState('all');

  // Sub-view mode for Photos and Videos (table vs grid)
  const [photosViewMode, setPhotosViewMode] = useState('table');
  const [videosViewMode, setVideosViewMode] = useState('table');

  // Uploaded Datasets
  const [photosList, setPhotosList] = useState([]);
  const [certificate, setCertificate] = useState(null);
  const [stakeholderVideos, setStakeholderVideos] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Photo Upload State
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const photoInputRef = useRef(null);

  // Certificate Upload State
  const [certFile, setCertFile] = useState(null);
  const [certCaption, setCertCaption] = useState('');
  const [isCertUploading, setIsCertUploading] = useState(false);
  const [isCertDragging, setIsCertDragging] = useState(false);
  const certInputRef = useRef(null);

  // Stakeholder Feedback Video State
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoDuration, setVideoDuration] = useState(null);
  const [videoDurationWarning, setVideoDurationWarning] = useState(null);
  const [videoCaption, setVideoCaption] = useState('');
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [isVideoDragging, setIsVideoDragging] = useState(false);
  const videoInputRef = useRef(null);

  // Modals
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [videoModalItem, setVideoModalItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const maxPhotos = 5;
  const currentPhotosCount = photosList.length;
  const isPhotosLimitReached = currentPhotosCount >= maxPhotos;

  const maxVideos = 3;
  const currentVideosCount = stakeholderVideos.length;
  const isVideosLimitReached = currentVideosCount >= maxVideos;

  // Fetch Panel Uploads
  const fetchUploads = useCallback(async () => {
    if (!selectedBatchId || !selectedPanelId) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/faculty-portal/uploads?batch_id=${selectedBatchId}&panel_id=${selectedPanelId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPhotosList(data.photos || []);
        setCertificate(data.certificate || null);
        setStakeholderVideos(data.stakeholder_feedback || (data.stakeholder_feedback_video ? [data.stakeholder_feedback_video] : []));
      } else {
        setError(data.message || 'Failed to load panel uploads.');
      }
    } catch (err) {
      console.error('Error fetching uploads:', err);
      setError('Network error while loading uploads. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBatchId, selectedPanelId]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  // Combined all uploads dataset for master tabular view
  const allUploads = useMemo(() => {
    const list = [];
    photosList.forEach(p => list.push({ ...p, uploadType: 'photo' }));
    if (certificate) list.push({ ...certificate, uploadType: 'certificate' });
    stakeholderVideos.forEach(v => list.push({ ...v, uploadType: 'video' }));
    return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [photosList, certificate, stakeholderVideos]);

  // Handle Photo Selection
  const handlePhotoSelect = (file) => {
    setError(null);
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setError('Please select a valid image file (JPG, JPEG, PNG, or WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Photo exceeds 10MB limit. Please choose a smaller image.');
      return;
    }

    setPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
  };

  // Handle Certificate Selection
  const handleCertSelect = (file) => {
    setError(null);
    if (!file) return;

    const validExts = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) {
      setError('Please select a valid document or image (PDF, DOC, DOCX, JPG, PNG).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('Certificate file exceeds 15MB limit. Please upload a smaller file.');
      return;
    }

    setCertFile(file);
  };

  // Handle Stakeholder Feedback Video Selection
  const handleVideoSelect = (file) => {
    setError(null);
    setVideoDurationWarning(null);
    setVideoDuration(null);
    if (!file) return;

    const validExts = ['.mp4', '.mov', '.webm', '.m4v', '.3gp', '.avi', '.mkv'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isVideoMime = file.type && file.type.startsWith('video/');
    if (!validExts.includes(ext) && !isVideoMime) {
      setError('Please select a valid video file (MP4, MOV, WebM, M4V, 3GP, AVI, MKV).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Video file exceeds 10MB limit. Please upload a shorter or compressed video.');
      return;
    }

    setVideoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setVideoPreview(objectUrl);

    // Read video duration with temporary video element
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.onloadedmetadata = () => {
      window.URL.revokeObjectURL(tempVideo.src);
      const durationSec = Math.round(tempVideo.duration || 0);
      setVideoDuration(durationSec);
      if (durationSec > 125) {
        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        setVideoDurationWarning(`Selected video is ${mins}m ${secs}s long. Please note the instruction: stakeholder video should be max 2 minutes.`);
      }
    };
    tempVideo.src = objectUrl;
  };

  // Submit Photo Upload
  const handlePhotoUpload = async (e) => {
    e.preventDefault();
    if (!photoFile) {
      setError('Please select a photo to upload.');
      return;
    }

    if (isPhotosLimitReached) {
      setError('Maximum 5 visit photos allowed. Please delete an existing photo to upload a new one.');
      return;
    }

    setIsPhotoUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', photoFile);
      formData.append('batch_id', selectedBatchId);
      formData.append('panel_id', selectedPanelId);
      if (photoCaption.trim()) {
        formData.append('caption', photoCaption.trim());
      }

      const res = await fetch(`${API}/api/ri/faculty-portal/uploads/photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Visit photo uploaded successfully.');
        setPhotoFile(null);
        setPhotoPreview(null);
        setPhotoCaption('');
        if (photoInputRef.current) photoInputRef.current.value = '';
        fetchUploads();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || 'Failed to upload photo.');
      }
    } catch (err) {
      console.error('Error uploading photo:', err);
      setError('Network error during upload. Please try again.');
    } finally {
      setIsPhotoUploading(false);
    }
  };

  // Submit Certificate Upload
  const handleCertUpload = async (e) => {
    e.preventDefault();
    if (!certFile) {
      setError('Please select a Gram Panchayat certificate file.');
      return;
    }

    setIsCertUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', certFile);
      formData.append('batch_id', selectedBatchId);
      formData.append('panel_id', selectedPanelId);
      formData.append('caption', certCaption.trim() || 'Gram Panchayat Certificate');

      const res = await fetch(`${API}/api/ri/faculty-portal/uploads/certificate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Gram Panchayat Certificate uploaded successfully.');
        setCertFile(null);
        setCertCaption('');
        if (certInputRef.current) certInputRef.current.value = '';
        fetchUploads();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || 'Failed to upload certificate.');
      }
    } catch (err) {
      console.error('Error uploading certificate:', err);
      setError('Network error during upload. Please try again.');
    } finally {
      setIsCertUploading(false);
    }
  };

  // Submit Stakeholder Video Upload
  const handleVideoUpload = async (e) => {
    e.preventDefault();
    if (!videoFile) {
      setError('Please select a stakeholder feedback video to upload.');
      return;
    }

    if (isVideosLimitReached) {
      setError('Maximum 3 stakeholder feedback videos allowed. Please delete an existing video to upload a new one.');
      return;
    }

    setIsVideoUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', videoFile);
      formData.append('batch_id', selectedBatchId);
      formData.append('panel_id', selectedPanelId);
      formData.append('caption', videoCaption.trim() || 'Stakeholder Feedback Video');

      const res = await fetch(`${API}/api/ri/faculty-portal/uploads/stakeholder-feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Stakeholder feedback video uploaded successfully.');
        setVideoFile(null);
        setVideoPreview(null);
        setVideoCaption('');
        setVideoDuration(null);
        setVideoDurationWarning(null);
        if (videoInputRef.current) videoInputRef.current.value = '';
        fetchUploads();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || 'Failed to upload stakeholder feedback video.');
      }
    } catch (err) {
      console.error('Error uploading stakeholder video:', err);
      setError('Network error during video upload. Please try again.');
    } finally {
      setIsVideoUploading(false);
    }
  };

  // Delete Item
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/faculty-portal/uploads/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        let label = 'Photo';
        if (itemToDelete.category === 'gram_panchayat_certificate' || itemToDelete.uploadType === 'certificate') {
          label = 'Certificate';
        } else if (itemToDelete.category === 'stakeholder_feedback' || itemToDelete.category === 'stakeholder_feedback_video' || itemToDelete.uploadType === 'video') {
          label = 'Stakeholder feedback video';
        }
        setSuccessMsg(`${label} deleted successfully.`);
        setItemToDelete(null);
        fetchUploads();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(data.message || 'Failed to delete file.');
      }
    } catch (err) {
      console.error('Error deleting upload:', err);
      setError('Network error while deleting. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight' && photosList.length > 0) {
        setLightboxIndex((prev) => (prev + 1) % photosList.length);
      }
      if (e.key === 'ArrowLeft' && photosList.length > 0) {
        setLightboxIndex((prev) => (prev - 1 + photosList.length) % photosList.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, photosList.length]);

  // Handle template file downloads with robust fetch and fallback
  const handleDownloadTemplate = async (lang) => {
    const isMarathi = lang === 'marathi' || lang === 'mar';
    const fileName = isMarathi ? 'cert-mar.docx' : 'cert-eng.docx';
    const fallbackName = isMarathi ? 'Certificate_Marathi.docx' : 'Certificate_English.docx';

    try {
      // 1. Try public root
      let response = await fetch(`/${fileName}`);
      if (!response.ok) {
        // 2. Try public documents directory
        response = await fetch(`/documents/${fileName}`);
      }
      if (!response.ok) {
        // 3. Try backend template endpoint
        response = await fetch(`${API}/api/ri/faculty-portal/templates/certificate/${lang}`);
      }
      if (!response.ok) {
        // 4. Try backend alternate template endpoint
        response = await fetch(`${API}/api/ri/faculty/templates/certificate/${lang}`);
      }
      if (!response.ok) {
        // 5. Try fallback name
        response = await fetch(`/${fallbackName}`);
      }

      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        if (typeof addToast === 'function') {
          addToast(`Downloaded ${fileName}`, 'success');
        } else {
          setSuccessMsg(`Downloaded ${fileName}`);
        }
        return;
      }
    } catch (err) {
      console.warn('Template download fetch error:', err);
    }

    // Direct fallback
    const a = document.createElement('a');
    a.href = `/${fileName}`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (typeof addToast === 'function') {
      addToast(`Downloaded ${fileName}`, 'success');
    } else {
      setSuccessMsg(`Downloaded ${fileName}`);
    }
  };

  return (
    <div style={{ padding: isMobile ? '12px' : '20px', maxWidth: '1360px', margin: '0 auto', fontFamily: 'inherit' }}>
      
      {/* Top Header with Single Color Design */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '18px 22px',
        border: '1px solid #e2e8f0',
        marginBottom: '18px',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: PRIMARY,
              backgroundColor: PRIMARY_LIGHT,
              padding: '2px 8px',
              borderRadius: '6px',
              border: `1px solid ${PRIMARY_BORDER}`
            }}>
              Field Uploads
            </span>
            {panelData?.panel_name && (
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                {panelData.panel_name}
              </span>
            )}
            {panelData?.village_name && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                <MapPin size={12} style={{ color: PRIMARY }} />
                {panelData.village_name}
              </span>
            )}
          </div>
          <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: '#0f172a', margin: '2px 0 3px 0' }}>
            Field Uploads Management
          </h2>
          <p style={{ margin: 0, fontSize: isMobile ? '12px' : '13px', color: '#64748b', lineHeight: 1.45 }}>
            Upload visit photos, Gram Panchayat certificate, and stakeholder feedback videos.
          </p>
        </div>

        {/* Clean Status Indicators in Single Color */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Camera size={13} style={{ color: PRIMARY }} />
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>Photos:</span>
            <strong style={{ fontSize: '12px', color: PRIMARY }}>
              {currentPhotosCount}/{maxPhotos}
            </strong>
          </div>

          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <FileText size={13} style={{ color: PRIMARY }} />
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>GP Cert:</span>
            <strong style={{ fontSize: '12px', color: certificate ? PRIMARY : '#64748b' }}>
              {certificate ? 'Uploaded' : 'Pending'}
            </strong>
          </div>

          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Video size={13} style={{ color: PRIMARY }} />
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>Video:</span>
            <strong style={{ fontSize: '12px', color: currentVideosCount > 0 ? PRIMARY : '#64748b' }}>
              {currentVideosCount}/{maxVideos}
            </strong>
          </div>

          <button
            onClick={fetchUploads}
            title="Refresh upload records"
            style={{
              padding: '7px 11px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            {!isMobile && 'Refresh'}
          </button>
        </div>
      </div>

      {/* Notification Banners */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          padding: '11px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px'
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: '#991b1b', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: PRIMARY_LIGHT,
          border: `1px solid ${PRIMARY_BORDER}`,
          color: PRIMARY,
          padding: '11px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px'
        }}>
          <CheckCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'transparent', border: 'none', color: PRIMARY, cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Tab Navigation Bar (Single Color) */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '5px',
        marginBottom: '18px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
      }}>
        {/* Tab 1: All Uploads Table */}
        <button
          onClick={() => setActiveUploadTab('all')}
          style={{
            flex: isMobile ? '1 0 auto' : 1,
            padding: '9px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeUploadTab === 'all' ? PRIMARY : 'transparent',
            color: activeUploadTab === 'all' ? '#ffffff' : '#475569',
            fontSize: '13px',
            fontWeight: activeUploadTab === 'all' ? '700' : '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Table size={14} />
          <span>All Uploads</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '999px',
            backgroundColor: activeUploadTab === 'all' ? 'rgba(255,255,255,0.22)' : '#f1f5f9',
            color: activeUploadTab === 'all' ? '#ffffff' : '#475569',
            fontWeight: '700'
          }}>
            {allUploads.length}
          </span>
        </button>

        {/* Tab 2: Photos */}
        <button
          onClick={() => setActiveUploadTab('photos')}
          style={{
            flex: isMobile ? '1 0 auto' : 1,
            padding: '9px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeUploadTab === 'photos' ? PRIMARY : 'transparent',
            color: activeUploadTab === 'photos' ? '#ffffff' : '#475569',
            fontSize: '13px',
            fontWeight: activeUploadTab === 'photos' ? '700' : '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Camera size={14} />
          <span>Field Visit Photos</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '999px',
            backgroundColor: activeUploadTab === 'photos' ? 'rgba(255,255,255,0.22)' : '#f1f5f9',
            color: activeUploadTab === 'photos' ? '#ffffff' : '#475569',
            fontWeight: '700'
          }}>
            {currentPhotosCount}/{maxPhotos}
          </span>
        </button>

        {/* Tab 3: GP Certificate */}
        <button
          onClick={() => setActiveUploadTab('certificate')}
          style={{
            flex: isMobile ? '1 0 auto' : 1,
            padding: '9px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeUploadTab === 'certificate' ? PRIMARY : 'transparent',
            color: activeUploadTab === 'certificate' ? '#ffffff' : '#475569',
            fontSize: '13px',
            fontWeight: activeUploadTab === 'certificate' ? '700' : '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <FileText size={14} />
          <span>GP Certificate</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '999px',
            backgroundColor: activeUploadTab === 'certificate' ? 'rgba(255,255,255,0.22)' : '#f1f5f9',
            color: activeUploadTab === 'certificate' ? '#ffffff' : '#475569',
            fontWeight: '700'
          }}>
            {certificate ? '1/1' : '0/1'}
          </span>
        </button>

        {/* Tab 4: Stakeholder Video */}
        <button
          onClick={() => setActiveUploadTab('video')}
          style={{
            flex: isMobile ? '1 0 auto' : 1,
            padding: '9px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeUploadTab === 'video' ? PRIMARY : 'transparent',
            color: activeUploadTab === 'video' ? '#ffffff' : '#475569',
            fontSize: '13px',
            fontWeight: activeUploadTab === 'video' ? '700' : '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Video size={14} />
          <span>Stakeholder Video</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '999px',
            backgroundColor: activeUploadTab === 'video' ? 'rgba(255,255,255,0.22)' : '#f1f5f9',
            color: activeUploadTab === 'video' ? '#ffffff' : '#475569',
            fontWeight: '700'
          }}>
            {currentVideosCount}/{maxVideos}
          </span>
        </button>
      </div>

      {/* TAB 1: ALL UPLOADS TABLE */}
      {activeUploadTab === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Checklist & Status Table */}
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                  Upload Checklist
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Field documentation requirements for this panel
                </span>
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: '700', color: PRIMARY, background: PRIMARY_LIGHT, padding: '3px 8px', borderRadius: '6px', border: `1px solid ${PRIMARY_BORDER}` }}>
                {allUploads.length} Total Files
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '10px 16px' }}>Requirement</th>
                    <th style={{ padding: '10px 16px' }}>Guidelines &amp; Limits</th>
                    <th style={{ padding: '10px 16px' }}>Status</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Photos */}
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: PRIMARY_LIGHT, color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Camera size={14} />
                        </div>
                        <span>1. Field Visit Photos</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                      Up to 5 photos showing student engagement (JPG, PNG, WEBP, max 10MB)
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        background: isPhotosLimitReached ? PRIMARY_LIGHT : '#f8fafc',
                        color: isPhotosLimitReached ? PRIMARY : '#475569',
                        border: `1px solid ${isPhotosLimitReached ? PRIMARY_BORDER : '#e2e8f0'}`
                      }}>
                        {currentPhotosCount} / {maxPhotos} Uploaded
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => setActiveUploadTab('photos')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${PRIMARY_BORDER}`,
                          background: PRIMARY_LIGHT,
                          color: PRIMARY,
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {isPhotosLimitReached ? 'Manage' : 'Upload'}
                        <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>

                  {/* Row 2: Certificate */}
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: PRIMARY_LIGHT, color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={14} />
                        </div>
                        <span>2. Gram Panchayat Certificate</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                      <div>1 official signed &amp; stamped completion certificate (PDF, DOC, JPG, max 15MB)</div>
                      <div style={{ marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Templates:</span>
                        <button
                          type="button"
                          onClick={() => handleDownloadTemplate('english')}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            color: '#1d4ed8',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            padding: '2px 8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Download size={11} /> cert-eng.docx (English)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadTemplate('marathi')}
                          style={{
                            background: '#fef3c7',
                            border: '1px solid #fde68a',
                            borderRadius: '4px',
                            color: '#b45309',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            padding: '2px 8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Download size={11} /> cert-mar.docx (मराठी)
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        background: certificate ? PRIMARY_LIGHT : '#f8fafc',
                        color: certificate ? PRIMARY : '#64748b',
                        border: `1px solid ${certificate ? PRIMARY_BORDER : '#e2e8f0'}`
                      }}>
                        {certificate ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => setActiveUploadTab('certificate')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${PRIMARY_BORDER}`,
                          background: PRIMARY_LIGHT,
                          color: PRIMARY,
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {certificate ? 'Manage' : 'Upload'}
                        <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>

                  {/* Row 3: Video */}
                  <tr>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: PRIMARY_LIGHT, color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Video size={14} />
                        </div>
                        <span>3. Stakeholder Feedback Video</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                      Testimonial from Sarpanch or authority (Max 2 Minutes, MP4/MOV/WebM up to 10MB)
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        background: currentVideosCount > 0 ? PRIMARY_LIGHT : '#f8fafc',
                        color: currentVideosCount > 0 ? PRIMARY : '#64748b',
                        border: `1px solid ${currentVideosCount > 0 ? PRIMARY_BORDER : '#e2e8f0'}`
                      }}>
                        {currentVideosCount} / {maxVideos} Uploaded
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => setActiveUploadTab('video')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${PRIMARY_BORDER}`,
                          background: PRIMARY_LIGHT,
                          color: PRIMARY,
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {currentVideosCount > 0 ? 'Manage' : 'Upload'}
                        <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Master Uploaded Files Table */}
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                  Uploaded Files
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  All media and documents uploaded for this panel
                </span>
              </div>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                {allUploads.length} records
              </span>
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '36px 16px' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: PRIMARY, margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '13px', color: '#64748b' }}>Loading records...</div>
              </div>
            ) : allUploads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <UploadCloud size={36} style={{ color: '#cbd5e1', margin: '0 auto 8px auto' }} />
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14.5px', fontWeight: '700', color: '#1e293b' }}>
                  No Files Uploaded Yet
                </h4>
                <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#64748b' }}>
                  Select an upload category from the tabs above to begin.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '10px 14px', width: '35px' }}>#</th>
                      <th style={{ padding: '10px 14px' }}>Category</th>
                      <th style={{ padding: '10px 14px' }}>Preview</th>
                      <th style={{ padding: '10px 14px' }}>Title / Caption</th>
                      <th style={{ padding: '10px 14px' }}>Uploaded By</th>
                      <th style={{ padding: '10px 14px' }}>Date &amp; Size</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUploads.map((item, idx) => {
                      const isCert = item.uploadType === 'certificate';
                      const isVid = item.uploadType === 'video';
                      const fileUrl = resolveFileUrl(item.file_url);

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '12px' }}>
                            {idx + 1}
                          </td>

                          {/* Category Badge */}
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: PRIMARY_LIGHT,
                              color: PRIMARY,
                              border: `1px solid ${PRIMARY_BORDER}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {isVid ? <Video size={11} /> : (isCert ? <FileCheck size={11} /> : <Camera size={11} />)}
                              {isVid ? 'Stakeholder Video' : (isCert ? 'GP Certificate' : 'Visit Photo')}
                            </span>
                          </td>

                          {/* Preview Box */}
                          <td style={{ padding: '10px 14px' }}>
                            {isVid ? (
                              <div
                                onClick={() => setVideoModalItem(item)}
                                style={{
                                  width: '44px',
                                  height: '34px',
                                  borderRadius: '6px',
                                  background: '#090d16',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                                title="Play video"
                              >
                                <PlayCircle size={16} style={{ color: '#ffffff' }} />
                              </div>
                            ) : isCert ? (
                              <button
                                type="button"
                                onClick={() => openSecureFile(item.file_url)}
                                style={{
                                  width: '44px',
                                  height: '34px',
                                  borderRadius: '6px',
                                  background: '#f8fafc',
                                  color: PRIMARY,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '1px solid #e2e8f0',
                                  cursor: 'pointer'
                                }}
                                title="Open certificate document"
                              >
                                <FileText size={16} />
                              </button>
                            ) : (
                              <SecureImage
                                src={item.file_url}
                                alt={item.caption || item.file_name}
                                onClick={() => {
                                  const photoIndex = photosList.findIndex(p => p.id === item.id);
                                  setLightboxIndex(photoIndex !== -1 ? photoIndex : 0);
                                }}
                                style={{
                                  width: '44px',
                                  height: '34px',
                                  objectFit: 'cover',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  border: '1px solid #e2e8f0'
                                }}
                                title="View photo"
                              />
                            )}
                          </td>

                          {/* Title & File Name */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: '600', color: '#0f172a', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.caption || item.file_name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.file_name}
                            </div>
                          </td>

                          {/* Uploaded By */}
                          <td style={{ padding: '10px 14px', color: '#334155', fontSize: '12px' }}>
                            <div>{item.uploaded_by_name || 'Faculty Mentor'}</div>
                          </td>

                          {/* Date & Size */}
                          <td style={{ padding: '10px 14px', fontSize: '11.5px', color: '#64748b' }}>
                            <div>{formatDate(item.created_at)}</div>
                            <div style={{ color: '#94a3b8' }}>{formatFileSize(item.file_size)}</div>
                          </td>

                          {/* Action Buttons */}
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isVid) {
                                    setVideoModalItem(item);
                                  } else if (isCert) {
                                    openSecureFile(item.file_url);
                                  } else {
                                    const photoIndex = photosList.findIndex(p => p.id === item.id);
                                    setLightboxIndex(photoIndex !== -1 ? photoIndex : 0);
                                  }
                                }}
                                title="View file"
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#334155',
                                  fontSize: '11.5px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <Eye size={12} /> View
                              </button>

                              <button
                                type="button"
                                onClick={() => downloadSecureFile(item.file_url, item.file_name)}
                                title="Download file"
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: `1px solid ${PRIMARY_BORDER}`,
                                  background: PRIMARY_LIGHT,
                                  color: PRIMARY,
                                  fontSize: '11.5px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <Download size={12} />
                              </button>

                              <button
                                type="button"
                                onClick={() => setItemToDelete(item)}
                                title="Delete file"
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #fecaca',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  fontSize: '11.5px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: FIELD VISIT PHOTOS */}
      {activeUploadTab === 'photos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Photos Upload Form Card */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: '700', color: '#0f172a' }}>
                  Upload Field Visit Photographs
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Photos are visible to assigned students, admins, and superadmins.
                </span>
              </div>
              <span style={{
                background: isPhotosLimitReached ? '#fef2f2' : PRIMARY_LIGHT,
                color: isPhotosLimitReached ? '#991b1b' : PRIMARY,
                border: `1px solid ${isPhotosLimitReached ? '#fecaca' : PRIMARY_BORDER}`,
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700'
              }}>
                {currentPhotosCount} / {maxPhotos} Uploaded
              </span>
            </div>

            {!isPhotosLimitReached ? (
              <form onSubmit={handlePhotoUpload}>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsPhotoDragging(true); }}
                  onDragLeave={() => setIsPhotoDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsPhotoDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handlePhotoSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => photoInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isPhotoDragging ? PRIMARY : '#cbd5e1'}`,
                    borderRadius: '8px',
                    padding: '20px 16px',
                    textAlign: 'center',
                    background: isPhotoDragging ? PRIMARY_LIGHT : '#f8fafc',
                    cursor: 'pointer',
                    marginBottom: '12px'
                  }}
                >
                  <input
                    type="file"
                    ref={photoInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handlePhotoSelect(e.target.files[0]);
                      }
                    }}
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    style={{ display: 'none' }}
                  />

                  {photoPreview ? (
                    <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '280px', margin: '0 auto' }}>
                      <img
                        src={photoPreview}
                        alt="Preview"
                        style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
                        {photoFile.name} ({formatFileSize(photoFile.size)})
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Camera size={24} style={{ color: PRIMARY, margin: '0 auto 6px auto' }} />
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                        Click to select visit photo or drag &amp; drop
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                        Supports JPG, PNG, WEBP (Max 10MB per photo)
                      </div>
                    </div>
                  )}
                </div>

                {photoFile && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Photo caption (optional)"
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                      maxLength={120}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '12.5px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoCaption(''); }}
                      style={{ padding: '8px 14px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', borderRadius: '6px', fontSize: '12.5px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPhotoUploading}
                      style={{
                        padding: '8px 18px',
                        border: 'none',
                        background: PRIMARY,
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {isPhotoUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                      {isPhotoUploading ? 'Uploading...' : 'Upload Photo'}
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <div style={{ background: PRIMARY_LIGHT, border: `1px solid ${PRIMARY_BORDER}`, borderRadius: '6px', padding: '10px 14px', fontSize: '12.5px', color: PRIMARY, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} />
                <span>Maximum limit of 5 visit photos reached for this panel. Delete a photo below to upload another.</span>
              </div>
            )}
          </div>

          {/* Uploaded Photos Table */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                Uploaded Photos ({photosList.length})
              </div>
              <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                <button
                  onClick={() => setPhotosViewMode('table')}
                  style={{ padding: '4px 8px', border: 'none', background: photosViewMode === 'table' ? PRIMARY : '#ffffff', color: photosViewMode === 'table' ? '#ffffff' : '#64748b', cursor: 'pointer' }}
                  title="Table view"
                >
                  <List size={13} />
                </button>
                <button
                  onClick={() => setPhotosViewMode('grid')}
                  style={{ padding: '4px 8px', border: 'none', background: photosViewMode === 'grid' ? PRIMARY : '#ffffff', color: photosViewMode === 'grid' ? '#ffffff' : '#64748b', cursor: 'pointer' }}
                  title="Grid view"
                >
                  <Grid size={13} />
                </button>
              </div>
            </div>

            {photosList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', fontSize: '12.5px' }}>
                No visit photos uploaded yet. Use the upload box above to submit photographs.
              </div>
            ) : photosViewMode === 'table' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 14px', width: '30px' }}>#</th>
                      <th style={{ padding: '10px 14px' }}>Photo Preview</th>
                      <th style={{ padding: '10px 14px' }}>Caption / Title</th>
                      <th style={{ padding: '10px 14px' }}>Date Uploaded</th>
                      <th style={{ padding: '10px 14px' }}>Size</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {photosList.map((photo, index) => {
                      const fileUrl = resolveFileUrl(photo.file_url);

                      return (
                        <tr key={photo.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '12px' }}>{index + 1}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <SecureImage
                              src={photo.file_url}
                              alt={photo.caption || photo.file_name}
                              onClick={() => setLightboxIndex(index)}
                              style={{ width: '48px', height: '34px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #e2e8f0' }}
                            />
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>{photo.caption || photo.file_name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{photo.file_name}</div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>
                            {formatDate(photo.created_at)}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>
                            {formatFileSize(photo.file_size)}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '5px' }}>
                              <button
                                type="button"
                                onClick={() => setLightboxIndex(index)}
                                style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer', fontSize: '11.5px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}
                              >
                                <Eye size={12} /> View
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadSecureFile(photo.file_url, photo.file_name)}
                                title="Download photo"
                                style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${PRIMARY_BORDER}`, background: PRIMARY_LIGHT, color: PRIMARY, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                              >
                                <Download size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemToDelete(photo)}
                                style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', padding: '16px' }}>
                {photosList.map((photo, index) => {
                  return (
                    <div key={photo.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
                      <SecureImage
                        src={photo.file_url}
                        alt={photo.caption || photo.file_name}
                        onClick={() => setLightboxIndex(index)}
                        style={{ width: '100%', height: '120px', objectFit: 'cover', cursor: 'pointer' }}
                      />
                      <div style={{ padding: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {photo.caption || photo.file_name}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                          <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>{formatFileSize(photo.file_size)}</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => downloadSecureFile(photo.file_url, photo.file_name)}
                              title="Download photo"
                              style={{ padding: '4px 6px', background: PRIMARY_LIGHT, color: PRIMARY, border: `1px solid ${PRIMARY_BORDER}`, borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                            >
                              <Download size={11} />
                            </button>
                            <button onClick={() => setItemToDelete(photo)} style={{ padding: '4px 6px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={11} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 3: GRAM PANCHAYAT CERTIFICATE */}
      {activeUploadTab === 'certificate' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Information Banner (Single Color) */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <FileText size={18} style={{ color: PRIMARY, flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: '0 0 3px 0', fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                Gram Panchayat Certificate Instructions
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                Upload the completion certificate signed and stamped by the village Gram Panchayat authority (Sarpanch / Gram Sevak). Visible to Admins and SuperAdmins.
              </p>
            </div>
          </div>

          {/* Certificate Card / Dropzone */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                Certificate Status
              </div>
              <span style={{
                background: certificate ? PRIMARY_LIGHT : '#f8fafc',
                color: certificate ? PRIMARY : '#64748b',
                border: `1px solid ${certificate ? PRIMARY_BORDER : '#e2e8f0'}`,
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700'
              }}>
                {certificate ? 'Uploaded' : 'Pending Upload'}
              </span>
            </div>

            <div style={{ padding: isMobile ? '14px' : '20px' }}>
              {/* ── DOWNLOAD CERTIFICATE TEMPLATES ── */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '14px 16px',
                marginBottom: '18px'
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    Download Gram Panchayat Certificate Template
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>
                    Download either template, fill the details, get it signed/stamped by Sarpanch or Gram Sevak, and upload below.
                  </div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    marginTop: '6px',
                    padding: '3px 8px',
                    backgroundColor: '#fefce8',
                    border: '1px solid #fde047',
                    borderRadius: '5px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#854d0e'
                  }}>
                    Note: The certificate must be issued on the letterhead of the Gram Panchayat.
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {/* English Template */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <FileText size={16} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                          cert-eng.docx
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          English Template (Word)
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadTemplate('english')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                    >
                      <Download size={13} /> Download
                    </button>
                  </div>

                  {/* Marathi Template */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: '#fef3c7',
                        color: '#b45309',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <FileText size={16} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                          cert-mar.docx
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          मराठी नमुना (Word)
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadTemplate('marathi')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                    >
                      <Download size={13} /> Download
                    </button>
                  </div>
                </div>
              </div>

              {/* If Certificate Already Uploaded, Show Card */}
              {certificate && (
                <div style={{
                  border: '1px solid #a7f3d0',
                  background: '#f0fdf4',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '18px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', minWidth: 0 }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '8px',
                        background: '#047857',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <FileText size={20} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#065f46', wordBreak: 'break-word' }}>
                          {certificate.caption || 'Gram Panchayat Certificate'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px', wordBreak: 'break-all' }}>
                          {certificate.file_name} ({formatFileSize(certificate.file_size)})
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                          Uploaded on {formatDate(certificate.created_at)} by {certificate.uploaded_by_name || 'Faculty Mentor'}
                        </div>
                      </div>
                    </div>

                    <span style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      flexShrink: 0
                    }}>
                      Active
                    </span>
                  </div>

                  {/* Actions Row */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginTop: '14px',
                    paddingTop: '12px',
                    borderTop: '1px solid #bbf7d0'
                  }}>
                    <button
                      type="button"
                      onClick={() => openSecureFile(certificate.file_url)}
                      style={{
                        flex: isMobile ? '1 1 100%' : '1 1 auto',
                        padding: '8px 14px',
                        background: '#047857',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        textAlign: 'center',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      <Eye size={13} /> View Certificate
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadSecureFile(certificate.file_url, certificate.file_name)}
                      style={{
                        flex: isMobile ? '1 1 auto' : 'initial',
                        padding: '8px 14px',
                        background: '#ffffff',
                        border: '1px solid #a7f3d0',
                        color: '#047857',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        textAlign: 'center',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <Download size={13} /> Download
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemToDelete(certificate)}
                      style={{
                        flex: isMobile ? '1 1 auto' : 'initial',
                        padding: '8px 14px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Certificate Upload Form (always allows uploading or replacing) */}
              <form onSubmit={handleCertUpload}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>
                  {certificate ? 'Replace Gram Panchayat Certificate' : 'Upload Gram Panchayat Certificate'}
                </div>

                <div
                  onDragOver={(e) => { e.preventDefault(); setIsCertDragging(true); }}
                  onDragLeave={() => setIsCertDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsCertDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleCertSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => certInputRef.current?.click()}
                  style={{
                    border: `1.5px dashed ${isCertDragging ? '#047857' : '#cbd5e1'}`,
                    borderRadius: '8px',
                    padding: '20px 16px',
                    textAlign: 'center',
                    background: isCertDragging ? PRIMARY_LIGHT : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    marginBottom: '10px'
                  }}
                >
                  <input
                    type="file"
                    ref={certInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleCertSelect(e.target.files[0]);
                      }
                    }}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                    style={{ display: 'none' }}
                  />

                  {certFile ? (
                    <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '340px', margin: '0 auto' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: PRIMARY_LIGHT, color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px auto' }}>
                        <FileText size={18} />
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                        Selected: {certFile.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {formatFileSize(certFile.size)} • Click to choose a different file
                      </div>
                    </div>
                  ) : (
                    <div>
                      <UploadCloud size={24} style={{ color: '#64748b', margin: '0 auto 6px auto' }} />
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                        Click to select Certificate or drag &amp; drop here
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                        Supports PDF, DOC, DOCX, JPG, PNG (Max 15MB)
                      </div>
                    </div>
                  )}
                </div>

                {certFile && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Certificate description (optional)"
                      value={certCaption}
                      onChange={(e) => setCertCaption(e.target.value)}
                      maxLength={150}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '12.5px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => { setCertFile(null); setCertCaption(''); }}
                      style={{ padding: '8px 14px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', borderRadius: '6px', fontSize: '12.5px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCertUploading}
                      style={{
                        padding: '8px 18px',
                        border: 'none',
                        background: PRIMARY,
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {isCertUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                      {isCertUploading ? 'Uploading...' : 'Upload Certificate'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: STAKEHOLDER FEEDBACK VIDEO */}
      {activeUploadTab === 'video' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Instructions Box (Single Color & No Emojis) */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: PRIMARY_LIGHT, color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Video size={13} />
              </div>
              <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                Guidelines for Recording Stakeholder Feedback Video
              </h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', fontSize: '12px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                <strong style={{ color: PRIMARY, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                  <Clock size={12} /> 1. Max 2-Minute Limit
                </strong>
                <span style={{ color: '#64748b' }}>Video duration must not exceed 2 minutes (120 seconds). Keep discussion concise.</span>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                <strong style={{ color: PRIMARY, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                  <User size={12} /> 2. Eligible Stakeholders
                </strong>
                <span style={{ color: '#64748b' }}>Sarpanch, Up-Sarpanch, Gram Sevak, School Principal, Anganwadi/ASHA worker, or SHG Leader.</span>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                <strong style={{ color: PRIMARY, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                  <PlayCircle size={12} /> 3. Recommended Prompts
                </strong>
                <span style={{ color: '#64748b' }}>Student activity impact on village, discipline &amp; engagement, feedback for MIT-WPU.</span>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                <strong style={{ color: PRIMARY, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                  <Film size={12} /> 4. Formats &amp; Quality
                </strong>
                <span style={{ color: '#64748b' }}>Record in landscape mode with clear audio. Supports MP4, MOV, WebM (up to 10MB).</span>
              </div>
            </div>
          </div>

          {/* Video Upload Form Card */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: '700', color: '#0f172a' }}>
                  Upload Stakeholder Video Testimonial
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Maximum 3 feedback videos per panel. Visible to Admins and SuperAdmins.
                </span>
              </div>
              <span style={{
                background: isVideosLimitReached ? '#fef2f2' : PRIMARY_LIGHT,
                color: isVideosLimitReached ? '#991b1b' : PRIMARY,
                border: `1px solid ${isVideosLimitReached ? '#fecaca' : PRIMARY_BORDER}`,
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700'
              }}>
                {currentVideosCount} / {maxVideos} Uploaded
              </span>
            </div>

            {!isVideosLimitReached ? (
              <form onSubmit={handleVideoUpload}>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsVideoDragging(true); }}
                  onDragLeave={() => setIsVideoDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsVideoDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleVideoSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => videoInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isVideoDragging ? PRIMARY : '#cbd5e1'}`,
                    borderRadius: '8px',
                    padding: '20px 16px',
                    textAlign: 'center',
                    background: isVideoDragging ? PRIMARY_LIGHT : '#f8fafc',
                    cursor: 'pointer',
                    marginBottom: '12px'
                  }}
                >
                  <input
                    type="file"
                    ref={videoInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleVideoSelect(e.target.files[0]);
                      }
                    }}
                    accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/*,.mp4,.mov,.webm,.m4v,.3gp,.avi,.mkv"
                    style={{ display: 'none' }}
                  />

                  {videoPreview ? (
                    <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '340px', margin: '0 auto' }}>
                      <video
                        src={videoPreview}
                        controls
                        playsInline
                        style={{ width: '100%', maxHeight: '170px', borderRadius: '6px', background: '#000000' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>{videoFile.name}</span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>({formatFileSize(videoFile.size)})</span>
                        {videoDuration !== null && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: videoDuration > 125 ? '#dc2626' : PRIMARY,
                            backgroundColor: videoDuration > 125 ? '#fef2f2' : PRIMARY_LIGHT,
                            border: `1px solid ${videoDuration > 125 ? '#fecaca' : PRIMARY_BORDER}`,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Clock size={10} /> {Math.floor(videoDuration / 60)}m {videoDuration % 60}s {videoDuration > 125 ? '(Exceeds 2 min)' : '(Within 2 min)'}
                          </span>
                        )}
                      </div>
                      {videoDurationWarning && (
                        <div style={{ marginTop: '6px', fontSize: '11.5px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertCircle size={13} style={{ flexShrink: 0 }} />
                          <span>{videoDurationWarning}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Video size={24} style={{ color: PRIMARY, margin: '0 auto 6px auto' }} />
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                        Click to select Stakeholder Video or drag &amp; drop
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                        Max 2 minutes duration - Supports MP4, MOV, WebM (Max 10MB)
                      </div>
                    </div>
                  )}
                </div>

                {videoFile && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Stakeholder Name & Role (e.g., Sarpanch Mrs. Sunita Patil)"
                      value={videoCaption}
                      onChange={(e) => setVideoCaption(e.target.value)}
                      maxLength={150}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '12.5px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setVideoFile(null);
                        setVideoPreview(null);
                        setVideoCaption('');
                        setVideoDuration(null);
                        setVideoDurationWarning(null);
                      }}
                      style={{ padding: '8px 14px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', borderRadius: '6px', fontSize: '12.5px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isVideoUploading}
                      style={{
                        padding: '8px 18px',
                        border: 'none',
                        background: PRIMARY,
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {isVideoUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                      {isVideoUploading ? 'Uploading Video...' : 'Upload Video'}
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <div style={{ background: PRIMARY_LIGHT, border: `1px solid ${PRIMARY_BORDER}`, borderRadius: '6px', padding: '10px 14px', fontSize: '12.5px', color: PRIMARY, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} />
                <span>Maximum limit of 3 stakeholder feedback videos reached. Delete an existing video below to upload another.</span>
              </div>
            )}
          </div>

          {/* Uploaded Videos Table */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                Uploaded Feedback Videos ({stakeholderVideos.length})
              </div>
              <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                <button
                  onClick={() => setVideosViewMode('table')}
                  style={{ padding: '4px 8px', border: 'none', background: videosViewMode === 'table' ? PRIMARY : '#ffffff', color: videosViewMode === 'table' ? '#ffffff' : '#64748b', cursor: 'pointer' }}
                  title="Table view"
                >
                  <List size={13} />
                </button>
                <button
                  onClick={() => setVideosViewMode('grid')}
                  style={{ padding: '4px 8px', border: 'none', background: videosViewMode === 'grid' ? PRIMARY : '#ffffff', color: videosViewMode === 'grid' ? '#ffffff' : '#64748b', cursor: 'pointer' }}
                  title="Grid view"
                >
                  <Grid size={13} />
                </button>
              </div>
            </div>

            {stakeholderVideos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', fontSize: '12.5px' }}>
                No stakeholder feedback videos uploaded yet. Use the upload box above to record and upload a video (max 2 mins).
              </div>
            ) : videosViewMode === 'table' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 14px', width: '30px' }}>#</th>
                      <th style={{ padding: '10px 14px' }}>Video Play</th>
                      <th style={{ padding: '10px 14px' }}>Stakeholder &amp; Role</th>
                      <th style={{ padding: '10px 14px' }}>Uploaded By</th>
                      <th style={{ padding: '10px 14px' }}>Date &amp; Size</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stakeholderVideos.map((video, index) => {
                      const fileUrl = resolveFileUrl(video.file_url);

                      return (
                        <tr key={video.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '12px' }}>{index + 1}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div
                              onClick={() => setVideoModalItem(video)}
                              style={{
                                width: '48px',
                                height: '34px',
                                borderRadius: '4px',
                                background: '#090d16',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                              title="Play video"
                            >
                              <PlayCircle size={16} style={{ color: '#ffffff' }} />
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>
                              {video.caption || 'Stakeholder Feedback Video'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{video.file_name}</div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#334155', fontSize: '12px' }}>
                            {video.uploaded_by_name || 'Faculty Mentor'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '11.5px' }}>
                            <div>{formatDate(video.created_at)}</div>
                            <div style={{ color: '#94a3b8' }}>{formatFileSize(video.file_size)}</div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '5px' }}>
                              <button
                                type="button"
                                onClick={() => setVideoModalItem(video)}
                                style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer', fontSize: '11.5px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}
                              >
                                <PlayCircle size={12} /> Play
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadSecureFile(video.file_url, video.file_name)}
                                title="Download video"
                                style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${PRIMARY_BORDER}`, background: PRIMARY_LIGHT, color: PRIMARY, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                              >
                                <Download size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemToDelete(video)}
                                style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px', padding: '16px' }}>
                {stakeholderVideos.map((video) => {
                  return (
                    <div key={video.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
                      <div style={{ width: '100%', height: '160px', background: '#090d16' }}>
                        <SecureVideo src={video.file_url} controls preload="metadata" playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <div style={{ padding: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>
                          {video.caption || 'Stakeholder Feedback Video'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {formatDate(video.created_at)} - {formatFileSize(video.file_size)}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                          <button
                            type="button"
                            onClick={() => downloadSecureFile(video.file_url, video.file_name)}
                            style={{ flex: 1, padding: '5px', background: PRIMARY_LIGHT, border: `1px solid ${PRIMARY_BORDER}`, color: PRIMARY, borderRadius: '4px', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
                          >
                            <Download size={11} /> Download
                          </button>
                          <button onClick={() => setItemToDelete(video)} style={{ padding: '5px 8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Photo Fullscreen Lightbox Modal */}
      {lightboxIndex !== null && photosList[lightboxIndex] && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.92)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <button
            onClick={() => setLightboxIndex(null)}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              padding: '8px',
              borderRadius: '50%',
              cursor: 'pointer'
            }}
          >
            <X size={22} />
          </button>

          <SecureImage
            src={photosList[lightboxIndex].file_url}
            alt={photosList[lightboxIndex].caption || photosList[lightboxIndex].file_name || 'Fullscreen'}
            style={{ maxWidth: '90vw', maxHeight: '75vh', objectFit: 'contain', borderRadius: '8px' }}
            title=""
            onClick={(e) => e.stopPropagation()}
          />

          <div style={{ textAlign: 'center', color: '#ffffff', marginTop: '16px', maxWidth: '600px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700' }}>
              {photosList[lightboxIndex].caption || photosList[lightboxIndex].file_name}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Photo {lightboxIndex + 1} of {photosList.length} - {formatDate(photosList[lightboxIndex].created_at)}
            </div>
            <div style={{ marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => downloadSecureFile(photosList[lightboxIndex].file_url, photosList[lightboxIndex].file_name)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={13} /> Download Photo
              </button>
            </div>
          </div>

          {photosList.length > 1 && (
            <>
              <button
                onClick={() => setLightboxIndex((prev) => (prev - 1 + photosList.length) % photosList.length)}
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '12px',
                  borderRadius: '50%',
                  cursor: 'pointer'
                }}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={() => setLightboxIndex((prev) => (prev + 1) % photosList.length)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '12px',
                  borderRadius: '50%',
                  cursor: 'pointer'
                }}
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Video Player Modal */}
      {videoModalItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.92)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <button
            onClick={() => setVideoModalItem(null)}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              padding: '8px',
              borderRadius: '50%',
              cursor: 'pointer'
            }}
          >
            <X size={22} />
          </button>

          <SecureVideo
            src={videoModalItem.file_url}
            controls
            autoPlay
            playsInline
            style={{ maxWidth: '90vw', maxHeight: '78vh', borderRadius: '8px', background: '#000000', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
          />

          <div style={{ textAlign: 'center', color: '#ffffff', marginTop: '16px', maxWidth: '600px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700' }}>
              {videoModalItem.caption || 'Stakeholder Feedback Video'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              By: {videoModalItem.uploaded_by_name || 'Faculty Mentor'} - {formatDate(videoModalItem.created_at)} - {formatFileSize(videoModalItem.file_size)}
            </div>
            <div style={{ marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => downloadSecureFile(videoModalItem.file_url, videoModalItem.file_name || 'feedback-video.mp4')}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={13} /> Download Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
            borderRadius: '12px',
            maxWidth: '400px',
            width: '100%',
            padding: '22px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
              <Trash2 size={20} />
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', textAlign: 'center', color: '#0f172a' }}>
              Confirm Deletion
            </h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: '#64748b', textAlign: 'center', lineHeight: 1.5 }}>
              Are you sure you want to delete this {
                itemToDelete.category === 'gram_panchayat_certificate' || itemToDelete.uploadType === 'certificate'
                  ? 'Gram Panchayat Certificate'
                  : (itemToDelete.category === 'stakeholder_feedback' || itemToDelete.category === 'stakeholder_feedback_video' || itemToDelete.uploadType === 'video'
                    ? 'Stakeholder Feedback Video'
                    : 'visit photo')
              }? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                style={{
                  flex: 1,
                  padding: '9px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '9px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
