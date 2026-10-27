import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { 
  Upload, Compass, RefreshCw, X, Download, Trash2, Folder, 
  ChevronRight, ChevronLeft, Play, CheckCircle, AlertCircle, AlertTriangle, Sparkles, Image as ImageIcon, Video, Eye, Plus, CheckSquare, Square, Check, RotateCcw, Pause, StopCircle,
  Camera, UploadCloud, Clock
} from 'lucide-react'
import { useLanguage } from './context/LanguageContext'

const SQUAD_OPTIONS = ['All Squads', 'Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi']

// ─── CLIENT-SIDE IMAGE COMPRESSION (Canvas WebP/JPEG at 85% quality) ─────────
async function compressImageClientSide(file) {
  if (!file || !file.type.startsWith('image/')) return file
  // Skip compression for small images (< 1.5 MB) or GIFs
  if (file.size <= 1.5 * 1024 * 1024 || file.type === 'image/gif') return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const maxDim = 2560
      let { width, height } = img

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      const outputType = file.type === 'image/png' ? 'image/webp' : file.type
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            const compressedFile = new File([blob], file.name, {
              type: outputType,
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            resolve(file)
          }
        },
        outputType,
        0.85
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}

// ─── CLIENT-SIDE VIDEO THUMBNAIL EXTRACTION (HTML5 Canvas) ────────────────────
async function extractVideoThumbnailClientSide(file) {
  if (!file || !file.type.startsWith('video/')) return null
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, video.duration / 2 || 0)
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 360
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const posterUrl = canvas.toDataURL('image/jpeg', 0.8)
        URL.revokeObjectURL(url)
        resolve(posterUrl)
      } catch (e) {
        URL.revokeObjectURL(url)
        resolve(null)
      }
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }

    video.src = url
  })
}

export default function FacultyJourneyTab({ token, facultyInfo, isAdmin = false, isSuperAdmin = false, isReadOnly = false, isLtcMember = false, isStudent = false, isGallery = false, user = null, batches = [], onGalleryStateChange = null }) {
  const { t } = useLanguage()
  const isGalleryUser = isGallery || user?.role === 'gallery'
  const isSuperOrAdmin = isAdmin || isSuperAdmin || isReadOnly || isGalleryUser || user?.role === 'superadmin' || user?.role === 'readonly_superadmin' || user?.role === 'superadmin_readonly' || user?.role === 'admin'
  const canManageGroupPhotos = !isGalleryUser && (isSuperAdmin || isReadOnly || user?.role === 'superadmin' || user?.role === 'readonly_superadmin' || user?.role === 'superadmin_readonly')
  
  const [mediaList, setMediaList] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePreviewIndex, setActivePreviewIndex] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(false)

  // Official Batch Group Photos state
  const [groupBatchId, setGroupBatchId] = useState('')
  const [batchList, setBatchList] = useState(batches || [])
  const [groupPhotos, setGroupPhotos] = useState([])
  const [loadingGroupPhotos, setLoadingGroupPhotos] = useState(false)
  const [uploadingGroupSlot, setUploadingGroupSlot] = useState(null)
  const [uploadingGroupProgress, setUploadingGroupProgress] = useState({})
  const [stagedGroupPhotos, setStagedGroupPhotos] = useState({})
  const [groupCaptions, setGroupCaptions] = useState({ 1: '', 2: '' })
  const [batchComplianceSummary, setBatchComplianceSummary] = useState(null)
  const [loadingCompliance, setLoadingCompliance] = useState(false)
  const [showGroupPhotoManager, setShowGroupPhotoManager] = useState(false)

  // Zoom & Pan State for Lightbox
  const [zoomScale, setZoomScale] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

  // Touch Swipe Gesture State for Mobile Lightbox
  const touchStartRef = useRef({ x: 0, y: 0 })
  const touchEndRef = useRef({ x: 0, y: 0 })

  // Upload Modal & Enterprise Queue State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadQueue, setUploadQueue] = useState([])
  const [isUploadingQueue, setIsUploadingQueue] = useState(false)
  const [uploadQuota, setUploadQuota] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)
  const fileInputRef = useRef(null)
  const activeXhrsRef = useRef({})

  // Track dynamic natural aspect ratios (width / height) with RAF-batched cache
  const [aspectRatios, setAspectRatios] = useState({})
  const aspectRatioCacheRef = useRef({})
  const batchUpdateRafRef = useRef(null)

  const scheduleAspectRatioBatchUpdate = useCallback(() => {
    if (batchUpdateRafRef.current) return
    batchUpdateRafRef.current = requestAnimationFrame(() => {
      batchUpdateRafRef.current = null
      setAspectRatios({ ...aspectRatioCacheRef.current })
    })
  }, [])

  const handleImageLoad = useCallback((id, e) => {
    const w = e?.target?.naturalWidth
    const h = e?.target?.naturalHeight
    if (w && h) {
      const r = w / h
      if (aspectRatioCacheRef.current[id] !== r) {
        aspectRatioCacheRef.current[id] = r
        scheduleAspectRatioBatchUpdate()
      }
    }
  }, [scheduleAspectRatioBatchUpdate])

  useEffect(() => {
    return () => {
      if (batchUpdateRafRef.current) {
        cancelAnimationFrame(batchUpdateRafRef.current)
      }
    }
  }, [])

  const galleryContainerRef = useRef(null)
  const gridListRef = useRef(null)
  const [scrollPosition, setScrollPosition] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(() => typeof window !== 'undefined' ? window.innerHeight : 800)

  // Track scroll position for virtualized row windowing
  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (gridListRef.current) {
            const rect = gridListRef.current.getBoundingClientRect()
            setScrollPosition(Math.max(0, -rect.top))
          }
          setViewportHeight(window.innerHeight || 800)
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  const [containerWidth, setContainerWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return Math.max(300, window.innerWidth >= 1024 ? window.innerWidth - 320 : window.innerWidth - 32)
    }
    return 1000
  })

  // Lock body scroll when upload modal is open
  useEffect(() => {
    if (isUploadModalOpen) {
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prevOverflow
      }
    }
  }, [isUploadModalOpen])

  // Folder & View & Filter States (Enforcing Batch -> Squad -> Media Gallery Hierarchy)
  const [currentView, setCurrentView] = useState(isStudent ? 'gallery' : 'batches') // 'batches' | 'squads' | 'gallery'
  const [selectedBatch, setSelectedBatch] = useState(isStudent ? 'ALL' : '')
  const [selectedSquad, setSelectedSquad] = useState(isStudent ? 'All Squads' : '')
  const [mediaTypeFilter, setMediaTypeFilter] = useState('ALL') // 'ALL' | 'PHOTO' | 'VIDEO'

  // Selection Mode State (Apple Photos / Google Photos style)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedMediaIds, setSelectedMediaIds] = useState(new Set())
  const [deletingMediaIds, setDeletingMediaIds] = useState(new Set())

  // Infinite Scroll Pagination State
  const [displayedCount, setDisplayedCount] = useState(28)
  const observerSentinelRef = useRef(null)
  const isLoadingMoreRef = useRef(false)

  // Helper to trigger toast notifications
  const showToast = useCallback((msg, type = 'success') => {
    setToastMessage({ msg, type, id: Date.now() })
    setTimeout(() => {
      setToastMessage((prev) => (prev && prev.msg === msg ? null : prev))
    }, 3500)
  }, [])

  const isVideoItem = (item) => {
    if (!item) return false
    const mediaType = item.media_type || item.mediaType
    if (mediaType === 'video') return true
    if (mediaType === 'photo' || mediaType === 'image') return false

    const mime = item.mimeType || item.mime_type
    if (mime) {
      if (mime.startsWith('video/')) return true
      if (mime.startsWith('image/')) return false
    }

    const url = item.imageUrl || item.media_url || ''
    if (url.startsWith('data:video/')) return true
    if (url.startsWith('data:image/')) return false

    const ext = url.split('?')[0].split('.').pop().toLowerCase()
    if (['mp4', 'mov', 'webm', 'ogg', 'mkv', 'avi'].includes(ext)) return true

    return false
  }

  const getMediaUrl = useCallback((url) => {
    if (!url) return ''
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001'
    return `${apiUrl}${url.startsWith('/') ? '' : '/'}${url}`
  }, [])

  const fetchMedia = useCallback(() => {
    setLoading(true)
    let endpoint = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/faculty/journey-media`
    if (isAdmin || isSuperAdmin || isReadOnly || isGalleryUser) {
      endpoint = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/admin/journey-media`
    } else if (isStudent) {
      endpoint = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/student/journey-media?limit=200`
    }

    const headers = { Authorization: `Bearer ${token}` }
    const selectedChildId = localStorage.getItem('selectedStudentId') || localStorage.getItem('selected_student_id')
    if (isStudent && selectedChildId) {
      headers['x-student-id'] = selectedChildId
    }

    fetch(endpoint, {
      headers
    })
      .then((r) => r.json())
      .then((d) => {
        const items = d.data || d.media || []
        setMediaList(items)
        if (d.uploadQuota) {
          setUploadQuota(d.uploadQuota)
        }
        // Auto-resolve groupBatchId if not already set
        const detectedBatchId = d.batch_id || d.batchId || d.uploadQuota?.batchId || facultyInfo?.batch_id || user?.batch_id || (items.length > 0 && items.find(m => m.batch_id)?.batch_id)
        if (detectedBatchId && !groupBatchId) {
          setGroupBatchId(String(detectedBatchId))
        }

        // For student, automatically set batch and squad to their assigned memories
        if (isStudent) {
          setSelectedBatch('ALL')
          if (items.length > 0) {
            const firstItem = items[0]
            const sName = firstItem.squadName || firstItem.squad_name || firstItem.squad || d.squad || 'All Squads'
            setSelectedSquad(sName)
          } else if (d.squad) {
            setSelectedSquad(d.squad)
          } else {
            setSelectedSquad('All Squads')
          }
          setCurrentView('gallery')
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [token, isAdmin, isSuperAdmin, isReadOnly, isStudent, facultyInfo?.batch_id, user?.batch_id, groupBatchId])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  // Expose gallery actions to parent (e.g. GalleryDashboard navbar in desktop view)
  useEffect(() => {
    if (typeof onGalleryStateChange === 'function') {
      onGalleryStateChange({
        isSelectionMode,
        selectedCount: selectedMediaIds.size,
        toggleSelection: () => {
          setIsSelectionMode(prev => {
            const next = !prev;
            if (!next) setSelectedMediaIds(new Set());
            return next;
          });
        },
        fetchMedia,
        loading
      });
    }
  }, [isSelectionMode, selectedMediaIds.size, loading, fetchMedia, onGalleryStateChange])

  // Fetch batches if needed for group photo assignment
  useEffect(() => {
    if (batches && batches.length > 0) {
      setBatchList(batches)
      if (!groupBatchId) setGroupBatchId(String(batches[0].id))
    } else if (isSuperOrAdmin || isGalleryUser) {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/superadmin/batches`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          if (d.batches && d.batches.length > 0) {
            setBatchList(d.batches)
            if (!groupBatchId) setGroupBatchId(String(d.batches[0].id))
          }
        })
        .catch(() => {})
    }
  }, [batches, isSuperOrAdmin, token, groupBatchId])

  // Automatically update groupBatchId when selectedBatch filter changes
  useEffect(() => {
    if (selectedBatch && selectedBatch !== 'ALL') {
      const match = batchList.find(b => String(b.id) === String(selectedBatch) || b.name === selectedBatch)
      if (match) {
        setGroupBatchId(String(match.id))
      } else {
        const itemMatch = mediaList.find(m => (m.batchName === selectedBatch || m.batch_name === selectedBatch) && m.batch_id)
        if (itemMatch) {
          setGroupBatchId(String(itemMatch.batch_id))
        }
      }
    }
  }, [selectedBatch, batchList, mediaList])

  // Fetch Group Photos for selected batch
  const fetchBatchGroupPhotos = useCallback((batchId) => {
    if (!batchId || batchId === 'undefined' || batchId === 'null' || !token) return
    setLoadingGroupPhotos(true)
    const endpoint = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/superadmin/batch-group-photos/${batchId}`
    fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        setGroupPhotos(d.groupPhotos || [])
        setLoadingGroupPhotos(false)
      })
      .catch(() => setLoadingGroupPhotos(false))
  }, [token])

  // Fetch batch compliance summary for SuperAdmin / Read-only SuperAdmin
  const fetchBatchComplianceSummary = useCallback(() => {
    if (!canManageGroupPhotos || !token) return
    setLoadingCompliance(true)
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/superadmin/batch-group-photos/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d && Array.isArray(d.summary)) {
          setBatchComplianceSummary(d)
          if (batchList.length === 0 && d.summary.length > 0) {
            setBatchList(d.summary.map(s => ({ id: s.batch_id, name: s.batch_name, year: s.year })))
          }
          if ((!groupBatchId || groupBatchId === 'undefined') && d.summary.length > 0 && d.summary[0].batch_id) {
            setGroupBatchId(String(d.summary[0].batch_id))
          }
        }
        setLoadingCompliance(false)
      })
      .catch(() => setLoadingCompliance(false))
  }, [canManageGroupPhotos, token, batchList.length, groupBatchId])

  useEffect(() => {
    if (canManageGroupPhotos) {
      fetchBatchComplianceSummary()
    }
  }, [canManageGroupPhotos, fetchBatchComplianceSummary])

  useEffect(() => {
    if (groupBatchId && groupBatchId !== 'undefined' && groupBatchId !== 'null') {
      fetchBatchGroupPhotos(groupBatchId)
    }
  }, [groupBatchId, fetchBatchGroupPhotos])

  // Clear staged group photos whenever switching batches
  useEffect(() => {
    setStagedGroupPhotos((prev) => {
      Object.values(prev).forEach(st => {
        if (st?.previewUrl) URL.revokeObjectURL(st.previewUrl)
      })
      return {}
    })
  }, [groupBatchId])

  // Universal batch group photos for current viewer (guarantees instant zero-delay fallback)
  const batchGroupPhotos = useMemo(() => {
    if (groupPhotos && groupPhotos.length > 0) return groupPhotos
    return mediaList.filter(m => {
      const isGp = !!m.is_group_photo || !!m.isGroupPhoto || m.squad === 'Batch Group'
      if (!isGp) return false
      if (groupBatchId) {
        return String(m.batch_id) === String(groupBatchId) || String(m.batchId) === String(groupBatchId)
      }
      return true
    })
  }, [groupPhotos, mediaList, groupBatchId])

  const currentBatchObj = batchList.find(b => String(b.id) === String(groupBatchId)) || batchComplianceSummary?.summary?.find(s => String(s.batch_id) === String(groupBatchId))
  const currentBatchName = currentBatchObj?.name || currentBatchObj?.batch_name || (mediaList.find(m => String(m.batch_id) === String(groupBatchId) || String(m.batchId) === String(groupBatchId))?.batch_name) || (mediaList.find(m => String(m.batch_id) === String(groupBatchId) || String(m.batchId) === String(groupBatchId))?.batchName) || (selectedBatch !== 'ALL' ? selectedBatch : 'Current Batch')
  const currentBatchPhotoCount = (groupPhotos && groupPhotos.length > 0) ? groupPhotos.length : batchGroupPhotos.length
  const currentBatchHasPhoto = currentBatchPhotoCount > 0

  // Stage group photo selection for preview & confirmation (exact same UX as rest of photos)
  const handleStageGroupPhoto = async (slot, rawFile) => {
    if (!rawFile) return
    try {
      const processed = rawFile.type.startsWith('image/') ? await compressImageClientSide(rawFile) : rawFile
      const previewUrl = URL.createObjectURL(processed)
      setStagedGroupPhotos((prev) => {
        if (prev[slot]?.previewUrl) URL.revokeObjectURL(prev[slot].previewUrl)
        return {
          ...prev,
          [slot]: {
            file: processed,
            previewUrl,
            name: rawFile.name || processed.name,
            size: processed.size
          }
        }
      })
      if (!groupCaptions[slot]) {
        setGroupCaptions((prev) => ({
          ...prev,
          [slot]: `Official Batch Group Photo ${slot}`
        }))
      }
    } catch (err) {
      showToast(t('Error reading image file'), 'error')
    }
  }

  const handleCancelStagedGroupPhoto = (slot) => {
    setStagedGroupPhotos((prev) => {
      if (prev[slot]?.previewUrl) URL.revokeObjectURL(prev[slot].previewUrl)
      const next = { ...prev }
      delete next[slot]
      return next
    })
  }

  // Upload group photo using presigned S3 / storageService pipeline (exact same manner as rest of photos)
  const handleUploadGroupPhoto = async (slot, optionalFile = null) => {
    const staged = stagedGroupPhotos[slot]
    const fileToUpload = optionalFile || staged?.file
    if (!fileToUpload) {
      showToast(t('Please choose a photo first'), 'error')
      return
    }
    if (!groupBatchId) {
      showToast(t('Please select a batch first'), 'error')
      return
    }

    setUploadingGroupSlot(slot)
    setUploadingGroupProgress(prev => ({
      ...prev,
      [slot]: { progress: 0, speed: '', eta: t('Initializing session...'), status: 'uploading' }
    }))

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001'
    const fileName = staged?.name || fileToUpload.name || `group_photo_slot_${slot}.jpg`
    const mimeType = fileToUpload.type || 'image/jpeg'
    const fileSize = fileToUpload.size

    try {
      // 1. Request presigned upload session like the rest of photos
      const presignedRes = await fetch(`${apiUrl}/api/superadmin/batch-group-photos/presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName,
          mimeType,
          fileSize,
          batch_id: groupBatchId,
          slot
        })
      })

      let initData = null
      if (presignedRes.ok) {
        initData = await presignedRes.json().catch(() => null)
      }

      const performGroupPhotoBinaryUpload = (slotNumber, fileObj, customFileName) => {
        const formData = new FormData()
        formData.append('file', fileObj)
        formData.append('batch_id', groupBatchId)
        formData.append('slot', slotNumber)
        formData.append('caption', groupCaptions[slotNumber] || `Official Batch Group Photo ${slotNumber}`)
        formData.append('original_file_name', customFileName)

        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          activeXhrsRef.current[`group_${slotNumber}`] = xhr
          xhr.open('POST', `${apiUrl}/api/superadmin/batch-group-photos`, true)
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)

          let lastLoaded = 0
          let lastTime = Date.now()

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.min(95, Math.round((e.loaded / e.total) * 100))
              const now = Date.now()
              const timeDiff = (now - lastTime) / 1000

              if (timeDiff >= 0.2) {
                const loadedDiff = e.loaded - lastLoaded
                const bps = loadedDiff / timeDiff
                const speedStr = bps > 1024 * 1024
                  ? `${(bps / (1024 * 1024)).toFixed(1)} MB/s`
                  : `${Math.round(bps / 1024)} KB/s`

                const remaining = e.total - e.loaded
                const etaSec = bps > 0 ? Math.ceil(remaining / bps) : 0
                const etaStr = etaSec > 60
                  ? `ETA: ${Math.floor(etaSec / 60)}m ${etaSec % 60}s`
                  : `ETA: ${etaSec}s`

                lastLoaded = e.loaded
                lastTime = now

                setUploadingGroupProgress(prev => ({
                  ...prev,
                  [slotNumber]: { progress: percent, speed: speedStr, eta: etaStr, status: 'uploading' }
                }))
              } else {
                setUploadingGroupProgress(prev => ({
                  ...prev,
                  [slotNumber]: { ...(prev[slotNumber] || {}), progress: percent, status: 'uploading' }
                }))
              }
            }
          }

          xhr.onload = () => {
            delete activeXhrsRef.current[`group_${slotNumber}`]
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
            } else {
              let errorMsg = t('Failed to upload group photo')
              try {
                const d = JSON.parse(xhr.responseText)
                if (d.message) errorMsg = d.message
              } catch (_) {}
              reject(new Error(errorMsg))
            }
          }

          xhr.onerror = () => {
            delete activeXhrsRef.current[`group_${slotNumber}`]
            reject(new Error(t('Network error uploading group photo.')))
          }

          xhr.onabort = () => {
            delete activeXhrsRef.current[`group_${slotNumber}`]
            reject(new Error(t('Upload cancelled.')))
          }

          xhr.send(formData)
        })
      }

      let uploadHandled = false

      if (initData && initData.uploadType === 'presigned') {
        try {
          // S3 Direct PUT Upload with live progress, speed & ETA
          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            activeXhrsRef.current[`group_${slot}`] = xhr
            xhr.open('PUT', initData.uploadUrl, true)
            xhr.setRequestHeader('Content-Type', mimeType)

            let lastLoaded = 0
            let lastTime = Date.now()

            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const percent = Math.min(95, Math.round((e.loaded / e.total) * 100))
                const now = Date.now()
                const timeDiff = (now - lastTime) / 1000

                if (timeDiff >= 0.2) {
                  const loadedDiff = e.loaded - lastLoaded
                  const bps = loadedDiff / timeDiff
                  const speedStr = bps > 1024 * 1024
                    ? `${(bps / (1024 * 1024)).toFixed(1)} MB/s`
                    : `${Math.round(bps / 1024)} KB/s`

                  const remaining = e.total - e.loaded
                  const etaSec = bps > 0 ? Math.ceil(remaining / bps) : 0
                  const etaStr = etaSec > 60
                    ? `ETA: ${Math.floor(etaSec / 60)}m ${etaSec % 60}s`
                    : `ETA: ${etaSec}s`

                  lastLoaded = e.loaded
                  lastTime = now

                  setUploadingGroupProgress(prev => ({
                    ...prev,
                    [slot]: { progress: percent, speed: speedStr, eta: etaStr, status: 'uploading' }
                  }))
                } else {
                  setUploadingGroupProgress(prev => ({
                    ...prev,
                    [slot]: { ...(prev[slot] || {}), progress: percent, status: 'uploading' }
                  }))
                }
              }
            }

            xhr.onload = () => {
              delete activeXhrsRef.current[`group_${slot}`]
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve()
              } else {
                reject(new Error(`Direct S3 upload failed with status ${xhr.status}`))
              }
            }

            xhr.onerror = () => {
              delete activeXhrsRef.current[`group_${slot}`]
              reject(new Error(t('Network error during direct upload.')))
            }

            xhr.onabort = () => {
              delete activeXhrsRef.current[`group_${slot}`]
              reject(new Error(t('Upload cancelled.')))
            }

            xhr.send(fileToUpload)
          })

          // Finalize metadata in database
          setUploadingGroupProgress(prev => ({
            ...prev,
            [slot]: { progress: 98, speed: '', eta: t('Finalizing...'), status: 'processing' }
          }))

          const saveRes = await fetch(`${apiUrl}/api/superadmin/batch-group-photos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              batch_id: groupBatchId,
              slot,
              storage_key: initData.storageKey,
              caption: groupCaptions[slot] || `Official Batch Group Photo ${slot}`,
              original_file_name: fileName,
              mime_type: mimeType,
              file_size: fileSize
            })
          })

          if (!saveRes.ok) {
            const d = await saveRes.json().catch(() => ({}))
            throw new Error(d.message || t('Failed to save group photo metadata'))
          }
          uploadHandled = true
        } catch (s3Err) {
          if (s3Err.message === t('Upload cancelled.')) throw s3Err
          console.warn('Direct S3 group photo upload blocked/failed (CSP connect-src or network), automatically falling back to server binary upload:', s3Err.message)
          setUploadingGroupProgress(prev => ({
            ...prev,
            [slot]: { progress: 10, speed: '', eta: t('Uploading via server...'), status: 'uploading' }
          }))
          await performGroupPhotoBinaryUpload(slot, fileToUpload, fileName)
          uploadHandled = true
        }
      }

      if (!uploadHandled) {
        await performGroupPhotoBinaryUpload(slot, fileToUpload, fileName)
      }

      setUploadingGroupProgress(prev => ({
        ...prev,
        [slot]: { progress: 100, speed: '', eta: t('Completed'), status: 'completed' }
      }))

      // Clean up staged photo
      if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl)
      setStagedGroupPhotos((prev) => {
        const next = { ...prev }
        delete next[slot]
        return next
      })

      showToast(t(`Official Batch Group Photo ${slot} uploaded successfully!`))
      fetchBatchGroupPhotos(groupBatchId)
      if (canManageGroupPhotos) fetchBatchComplianceSummary()
      fetchMedia()
    } catch (err) {
      showToast(err.message || t('Error processing or uploading image'), 'error')
      setUploadingGroupProgress(prev => ({
        ...prev,
        [slot]: { progress: 0, speed: '', eta: '', status: 'failed' }
      }))
    } finally {
      setTimeout(() => {
        setUploadingGroupSlot(null)
        setUploadingGroupProgress(prev => {
          const next = { ...prev }
          delete next[slot]
          return next
        })
      }, 700)
    }
  }

  const handleDeleteGroupPhoto = async (photoId) => {
    if (!window.confirm(t('Are you sure you want to delete this Official Batch Group Photo?'))) return
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/superadmin/batch-group-photos/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        showToast(t('Group photo deleted successfully.'))
        fetchBatchGroupPhotos(groupBatchId)
        if (canManageGroupPhotos) fetchBatchComplianceSummary()
        fetchMedia()
      } else {
        const d = await res.json()
        showToast(d.message || t('Failed to delete group photo'), 'error')
      }
    } catch (err) {
      showToast(t('Error deleting group photo'), 'error')
    }
  }

  // Measure container width dynamically on load & via ResizeObserver for instant sidebar toggle reflow
  useEffect(() => {
    const updateWidth = () => {
      if (galleryContainerRef.current) {
        const computedStyle = window.getComputedStyle(galleryContainerRef.current)
        const paddingX = (parseFloat(computedStyle.paddingLeft) || 0) + (parseFloat(computedStyle.paddingRight) || 0)
        const availableWidth = Math.max(280, (galleryContainerRef.current.clientWidth || 1000) - paddingX)
        setContainerWidth(availableWidth)
      }
    }
    updateWidth()

    let resizeObserver = null
    if (window.ResizeObserver && galleryContainerRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect && entry.contentRect.width > 0) {
            setContainerWidth(Math.max(280, Math.floor(entry.contentRect.width)))
          }
        }
      })
      resizeObserver.observe(galleryContainerRef.current)
    }

    window.addEventListener('resize', updateWidth)
    return () => {
      window.removeEventListener('resize', updateWidth)
      if (resizeObserver && galleryContainerRef.current) {
        resizeObserver.unobserve(galleryContainerRef.current)
      }
    }
  }, [])

  // Group media into batches for folder view
  const batchFolders = useMemo(() => {
    const counts = {}
    mediaList.forEach((m) => {
      const b = m.batchName || m.batch_name || 'Unassigned Batch'
      counts[b] = (counts[b] || 0) + 1
    })
    return Object.keys(counts).map((name) => ({
      name,
      count: counts[name]
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [mediaList])

  // Group media into dynamic squad folders for the selected batch
  const squadFolders = useMemo(() => {
    const batchMedia = mediaList.filter((m) => {
      const b = m.batchName || m.batch_name || m.batch_id || ''
      if (selectedBatch === 'ALL') return true
      return b === selectedBatch || String(m.batch_id) === String(selectedBatch)
    })

    const counts = {}
    batchMedia.forEach((m) => {
      const rawSquad = m.squadName || m.squad_name || m.squad || 'Unassigned Squad'
      counts[rawSquad] = (counts[rawSquad] || 0) + 1
    })

    return Object.keys(counts).map((name) => {
      const title = name === 'Batch Group' ? 'Batch Group Photos' : (name.toLowerCase().startsWith('squad') ? name : `Squad ${name}`)
      return {
        name,
        formattedTitle: name === 'Unassigned Squad' ? 'Unassigned Squad' : title,
        count: counts[name]
      }
    }).sort((a, b) => {
      if (a.name === 'Batch Group') return -1
      if (b.name === 'Batch Group') return 1
      if (a.name.includes('Unassigned')) return 1
      if (b.name.includes('Unassigned')) return -1
      return a.formattedTitle.localeCompare(b.formattedTitle)
    })
  }, [mediaList, selectedBatch])

  // Filter media by Batch, Squad, and Media Type
  const filteredMedia = useMemo(() => {
    return mediaList.filter((item) => {
      if (!isStudent) {
        const b = item.batchName || item.batch_name || 'Unassigned Batch'
        if (selectedBatch !== 'ALL' && b !== selectedBatch && String(item.batch_id) !== String(selectedBatch)) return false
      }

      if (selectedSquad !== 'All Squads') {
        const s = item.squadName || item.squad_name || item.squad || ''
        const cleanS = s.replace(/^squad\s+/i, '').trim().toLowerCase()
        const cleanSelected = selectedSquad.replace(/^squad\s+/i, '').trim().toLowerCase()
        if (cleanS !== cleanSelected && !item.isGroupPhoto && !item.is_group_photo && cleanS !== 'batch group') return false
      }

      if (mediaTypeFilter === 'PHOTO' && isVideoItem(item)) return false
      if (mediaTypeFilter === 'VIDEO' && !isVideoItem(item)) return false

      return true
    })
  }, [mediaList, selectedBatch, selectedSquad, mediaTypeFilter, isStudent])

  // Paginated media for infinite scrolling
  const visibleMedia = useMemo(() => {
    return filteredMedia.slice(0, displayedCount)
  }, [filteredMedia, displayedCount])

  // APPLE PHOTOS JUSTIFIED ROW ALGORITHM WITH DYNAMIC ADAPTIVE COLUMNS
  const justifiedRows = useMemo(() => {
    if (!visibleMedia || visibleMedia.length === 0) return []

    const gap = 8 // fixed 8px clean image spacing
    const isMobileScreen = containerWidth < 480
    const isSmallTablet = containerWidth >= 480 && containerWidth < 768
    const isSmallDesktop = containerWidth >= 768 && containerWidth < 1100
    const targetRowHeight = isMobileScreen ? 135 : isSmallTablet ? 165 : isSmallDesktop ? 195 : 230

    const rows = []
    let currentRow = []
    let currentAspectRatioSum = 0

    visibleMedia.forEach((item) => {
      const ratio = aspectRatios[item.id] || (isVideoItem(item) ? 1.777 : 1.333)
      currentRow.push({ ...item, ratio })
      currentAspectRatioSum += ratio

      const gapsWidth = (currentRow.length - 1) * gap
      const calculatedHeight = (containerWidth - gapsWidth) / currentAspectRatioSum

      if (calculatedHeight <= targetRowHeight) {
        rows.push({
          items: currentRow.map((i) => ({
            ...i,
            width: Math.floor(i.ratio * calculatedHeight),
            height: Math.floor(calculatedHeight)
          })),
          height: Math.floor(calculatedHeight),
          isJustified: true
        })
        currentRow = []
        currentAspectRatioSum = 0
      }
    })

    if (currentRow.length > 0) {
      const gapsWidth = (currentRow.length - 1) * gap
      const calculatedHeight = (containerWidth - gapsWidth) / currentAspectRatioSum
      const finalHeight = calculatedHeight > targetRowHeight * 1.35 ? targetRowHeight : Math.floor(calculatedHeight)

      rows.push({
        items: currentRow.map((i) => ({
          ...i,
          width: Math.floor(i.ratio * finalHeight),
          height: Math.floor(finalHeight)
        })),
        height: Math.floor(finalHeight),
        isJustified: calculatedHeight <= targetRowHeight * 1.35
      })
    }

    return rows
  }, [visibleMedia, aspectRatios, containerWidth])

  // Cumulative row geometry for exact spacer calculations & windowing
  const { rowOffsets, totalGalleryHeight } = useMemo(() => {
    const offsets = []
    let currentOffset = 0
    for (let i = 0; i < justifiedRows.length; i++) {
      offsets.push(currentOffset)
      currentOffset += (justifiedRows[i].height || 180) + 8
    }
    return { rowOffsets: offsets, totalGalleryHeight: currentOffset }
  }, [justifiedRows])

  // Compute virtual row window
  const { startRowIndex, endRowIndex, topSpacerHeight, bottomSpacerHeight, renderedRows } = useMemo(() => {
    const totalRows = justifiedRows.length
    if (totalRows <= 12) {
      return {
        startRowIndex: 0,
        endRowIndex: totalRows,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
        renderedRows: justifiedRows
      }
    }

    const OVERSCAN = 800 // px buffer above & below viewport
    const minVisibleY = Math.max(0, scrollPosition - OVERSCAN)
    const maxVisibleY = scrollPosition + viewportHeight + OVERSCAN

    let start = 0
    let end = totalRows

    for (let i = 0; i < totalRows; i++) {
      const rowTop = rowOffsets[i]
      const rowBottom = rowTop + (justifiedRows[i].height || 180)
      if (rowBottom >= minVisibleY) {
        start = i
        break
      }
    }

    for (let i = start; i < totalRows; i++) {
      const rowTop = rowOffsets[i]
      if (rowTop > maxVisibleY) {
        end = i
        break
      }
    }

    const topSpacer = rowOffsets[start] || 0
    const endRowOffset = end < totalRows ? rowOffsets[end] : totalGalleryHeight
    const bottomSpacer = Math.max(0, totalGalleryHeight - endRowOffset)

    return {
      startRowIndex: start,
      endRowIndex: end,
      topSpacerHeight: topSpacer,
      bottomSpacerHeight: bottomSpacer,
      renderedRows: justifiedRows.slice(start, end)
    }
  }, [justifiedRows, rowOffsets, totalGalleryHeight, scrollPosition, viewportHeight])

  // Active Lightbox Media item
  const activePreviewMedia = useMemo(() => {
    if (activePreviewIndex === null || activePreviewIndex < 0 || activePreviewIndex >= filteredMedia.length) {
      return null
    }
    return filteredMedia[activePreviewIndex]
  }, [activePreviewIndex, filteredMedia])

  useEffect(() => {
    if (activePreviewMedia) {
      setPreviewLoading(true)
      setPreviewError(false)
      setZoomScale(1)
      setPanOffset({ x: 0, y: 0 })

      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prevOverflow
      }
    }
  }, [activePreviewMedia])

  // Toggle selection for a media item
  const toggleSelectMedia = useCallback((id, e) => {
    if (e) e.stopPropagation()
    setSelectedMediaIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Lightbox Navigation Functions
  const navigatePrev = useCallback(() => {
    if (filteredMedia.length === 0) return
    setActivePreviewIndex((prev) => (prev > 0 ? prev - 1 : filteredMedia.length - 1))
  }, [filteredMedia.length])

  const navigateNext = useCallback(() => {
    if (filteredMedia.length === 0) return
    setActivePreviewIndex((prev) => (prev < filteredMedia.length - 1 ? prev + 1 : 0))
  }, [filteredMedia.length])

  // Keyboard Navigation for Lightbox Modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activePreviewIndex === null) return
      if (e.key === 'Escape') {
        setActivePreviewIndex(null)
      } else if (e.key === 'ArrowLeft') {
        navigatePrev()
      } else if (e.key === 'ArrowRight') {
        navigateNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePreviewIndex, navigatePrev, navigateNext])

  // Touch Swipe Gesture Handlers
  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  const handleTouchMove = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchEndRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  const handleTouchEnd = () => {
    const diffX = touchStartRef.current.x - touchEndRef.current.x
    const diffY = touchStartRef.current.y - touchEndRef.current.y
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        navigateNext()
      } else {
        navigatePrev()
      }
    }
  }

  // Zoom & Drag Handlers for Lightbox
  const handleDoubleClickZoom = (e) => {
    e.stopPropagation()
    if (zoomScale > 1) {
      setZoomScale(1)
      setPanOffset({ x: 0, y: 0 })
    } else {
      setZoomScale(2)
    }
  }

  const handleWheelZoom = (e) => {
    e.stopPropagation()
    if (e.deltaY < 0) {
      setZoomScale((prev) => Math.min(prev + 0.2, 3))
    } else {
      setZoomScale((prev) => {
        const next = Math.max(prev - 0.2, 1)
        if (next === 1) setPanOffset({ x: 0, y: 0 })
        return next
      })
    }
  }

  const handleMouseDownPan = (e) => {
    if (zoomScale > 1) {
      setIsDragging(true)
      dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y }
    }
  }

  const handleMouseMovePan = (e) => {
    if (isDragging && zoomScale > 1) {
      setPanOffset({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      })
    }
  }

  const handleMouseUpPan = () => {
    setIsDragging(false)
  }

  // Infinite Scroll Sentinel with Concurrency Guard
  useEffect(() => {
    const sentinel = observerSentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMoreRef.current) {
          if (displayedCount < filteredMedia.length) {
            isLoadingMoreRef.current = true
            setDisplayedCount((prev) => Math.min(filteredMedia.length, prev + 24))
            requestAnimationFrame(() => {
              isLoadingMoreRef.current = false
            })
          }
        }
      },
      { rootMargin: '400px' }
    )

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
      isLoadingMoreRef.current = false
    }
  }, [displayedCount, filteredMedia.length])

  const handleDownload = async (item, e) => {
    if (e) e.stopPropagation()
    const url = getMediaUrl(item.imageUrl || item.media_url)
    let filename = item.originalFileName || item.original_file_name || 'squad_memory'
    
    if (item.mimeType && !filename.includes('.')) {
      let ext = 'jpg'
      if (item.mimeType === 'image/png') ext = 'png'
      else if (item.mimeType === 'image/webp') ext = 'webp'
      else if (item.mimeType === 'video/mp4') ext = 'mp4'
      filename = `${filename}.${ext}`
    } else if (!filename.includes('.')) {
      filename = `${filename}.${isVideoItem(item) ? 'mp4' : 'jpg'}`
    }

    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
      showToast(t("Download started..."))
    } catch (err) {
      window.open(url, '_blank')
    }
  }

  // Bulk Download Selected Items
  const handleBulkDownload = async () => {
    if (selectedMediaIds.size === 0) return
    showToast(t("Downloading {{count}} items...").replace('{{count}}', selectedMediaIds.size))
    const selectedList = mediaList.filter((m) => selectedMediaIds.has(m.id))
    for (const item of selectedList) {
      await handleDownload(item)
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  // Bulk Delete Selected Items with Smooth Card Fade-out Animation
  const handleBulkDelete = async () => {
    if (selectedMediaIds.size === 0) return
    if (!window.confirm(t("Are you sure you want to delete {{count}} selected items?").replace('{{count}}', selectedMediaIds.size))) return

    const selectedList = Array.from(selectedMediaIds)
    setDeletingMediaIds(new Set(selectedList))

    setTimeout(async () => {
      setMediaList((prev) => prev.filter((m) => !selectedMediaIds.has(m.id)))
      setSelectedMediaIds(new Set())
      setDeletingMediaIds(new Set())
      setIsSelectionMode(false)

      const endpointPrefix = isAdmin
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/admin/journey-media/`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/faculty/journey-media/`

      let deletedCount = 0
      for (const id of selectedList) {
        try {
          const res = await fetch(`${endpointPrefix}${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          })
          if (res.ok) deletedCount++
        } catch (err) {
          console.error(err)
        }
      }

      showToast(t("{{count}} items deleted successfully.").replace('{{count}}', deletedCount))
      fetchMedia()
    }, 220)
  }

  // ENTERPRISE FILE PICKER WITH CLIENT-SIDE COMPRESSION & INSTANT VIDEO THUMBNAILS
  const handleFileChange = async (e) => {
    const rawFiles = Array.from(e.target.files || [])
    if (rawFiles.length === 0) return

    const isCoordinator = !!uploadQuota?.isSquadCoordinator
    const queuePhotos = uploadQueue.filter(
      (i) => i.type === 'photo' && i.status !== 'completed' && i.status !== 'failed' && i.status !== 'cancelled'
    ).length
    const queueVideos = uploadQueue.filter(
      (i) => i.type === 'video' && i.status !== 'completed' && i.status !== 'failed' && i.status !== 'cancelled'
    ).length

    let availablePhotoSlots = isCoordinator ? Math.max(0, (uploadQuota.remainingPhotos ?? 5) - queuePhotos) : Infinity
    let availableVideoSlots = isCoordinator ? Math.max(0, (uploadQuota.remainingVideos ?? 2) - queueVideos) : Infinity

    if (isCoordinator && availablePhotoSlots <= 0 && availableVideoSlots <= 0) {
      showToast(t('Upload limit reached: Squad Coordinators can upload a maximum of 5 photos and 2 videos per batch.'), 'error')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    let invalidCount = 0
    let oversizedCount = 0
    let quotaSkippedPhotos = 0
    let quotaSkippedVideos = 0
    const preparedItems = []

    for (const rawFile of rawFiles) {
      const isImage = rawFile.type.startsWith('image/')
      const isVideo = rawFile.type.startsWith('video/')

      if (!isImage && !isVideo) {
        invalidCount++
        continue
      }

      // Check coordinator quota limits
      if (isCoordinator) {
        if (isImage && availablePhotoSlots <= 0) {
          quotaSkippedPhotos++
          continue
        }
        if (isVideo && availableVideoSlots <= 0) {
          quotaSkippedVideos++
          continue
        }
      }

      const maxSize = isImage ? 50 * 1024 * 1024 : 500 * 1024 * 1024
      if (rawFile.size > maxSize) {
        oversizedCount++
        continue
      }

      // Decrement available slots as item is accepted
      if (isCoordinator) {
        if (isImage) availablePhotoSlots--
        if (isVideo) availableVideoSlots--
      }

      // Pre-compress image client-side if > 1.5MB
      const processedFile = isImage ? await compressImageClientSide(rawFile) : rawFile
      const id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
      const previewUrl = URL.createObjectURL(processedFile)

      // Extract video poster frame client-side
      let posterPreviewUrl = null
      if (isVideo) {
        posterPreviewUrl = await extractVideoThumbnailClientSide(processedFile)
      }

      preparedItems.push({
        id,
        file: processedFile,
        name: processedFile.name,
        size: processedFile.size,
        type: isImage ? 'photo' : 'video',
        mimeType: processedFile.type,
        previewUrl,
        posterPreviewUrl,
        progress: 0,
        bytesUploaded: 0,
        speed: '',
        eta: '',
        status: 'pending', // 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled'
        error: null,
        created_at: new Date().toISOString()
      })
    }

    if (quotaSkippedPhotos > 0 || quotaSkippedVideos > 0) {
      showToast(
        t('Squad Coordinator limit: Only 5 photos and 2 videos allowed per batch. {{photos}} photo(s) and {{videos}} video(s) were omitted.')
          .replace('{{photos}}', quotaSkippedPhotos)
          .replace('{{videos}}', quotaSkippedVideos),
        'error'
      )
    }

    if (invalidCount > 0) {
      showToast(t('Some files were ignored (only JPEG/PNG/WEBP images and MP4/MOV videos allowed).'), 'error')
    }

    if (oversizedCount > 0) {
      showToast(t('Some files exceeded size limits (50MB photos, 500MB videos).'), 'error')
    }

    if (preparedItems.length > 0) {
      setUploadQueue((prev) => [...prev, ...preparedItems])
      showToast(t('{{count}} items added to upload queue.').replace('{{count}}', preparedItems.length))
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Cancel all active uploads
  const cancelAllUploads = (e) => {
    if (e) e.stopPropagation()
    Object.keys(activeXhrsRef.current).forEach((id) => {
      try { activeXhrsRef.current[id].abort() } catch (err) {}
      delete activeXhrsRef.current[id]
    })
    setUploadQueue((prev) =>
      prev.map((i) => (i.status === 'uploading' ? { ...i, status: 'cancelled', speed: '', eta: 'ETA: --', error: 'Upload cancelled by user.' } : i))
    )
    setIsUploadingQueue(false)
  }

  // Cancel individual active upload
  const cancelUploadItem = (id, e) => {
    if (e) e.stopPropagation()
    if (activeXhrsRef.current[id]) {
      try {
        activeXhrsRef.current[id].abort()
      } catch (err) {}
      delete activeXhrsRef.current[id]
    }
    setUploadQueue((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'cancelled', speed: '', eta: 'ETA: --', error: 'Upload cancelled by user.' } : i))
    )
  }

  // Retry individual failed/cancelled upload
  const retryUploadItem = (id, e) => {
    if (e) e.stopPropagation()
    setUploadQueue((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'pending', progress: 0, bytesUploaded: 0, speed: '', eta: '', error: null } : i))
    )
  }

  const removeFromQueue = (id, e) => {
    if (e) e.stopPropagation()
    if (activeXhrsRef.current[id]) {
      try { activeXhrsRef.current[id].abort() } catch (err) {}
      delete activeXhrsRef.current[id]
    }
    setUploadQueue((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      }
      return prev.filter((i) => i.id !== id)
    })
  }

  const clearCompleted = () => {
    setUploadQueue((prev) => {
      prev.filter((i) => i.status === 'completed').forEach((i) => {
        if (i.previewUrl) URL.revokeObjectURL(i.previewUrl)
      })
      return prev.filter((i) => i.status !== 'completed')
    })
  }

  const performBinaryFallbackUpload = async (item) => {
    const file = item.file
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001'

    return new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('media_type', item.type)

      const xhr = new XMLHttpRequest()
      activeXhrsRef.current[item.id] = xhr

      xhr.open('POST', `${apiUrl}/api/faculty/journey-media/binary-upload`, true)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      let lastLoaded = 0
      let lastTime = Date.now()

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.min(95, Math.round((e.loaded / e.total) * 100))
          const now = Date.now()
          const timeDiff = (now - lastTime) / 1000

          if (timeDiff >= 0.25) {
            const loadedDiff = e.loaded - lastLoaded
            const bps = loadedDiff / timeDiff
            const speedStr = bps > 1024 * 1024
              ? `${(bps / (1024 * 1024)).toFixed(1)} MB/s`
              : `${Math.round(bps / 1024)} KB/s`

            const remaining = e.total - e.loaded
            const etaSec = bps > 0 ? Math.ceil(remaining / bps) : 0
            const etaStr = etaSec > 60
              ? `ETA: ${Math.floor(etaSec / 60)}m ${etaSec % 60}s`
              : `ETA: ${etaSec} seconds`

            lastLoaded = e.loaded
            lastTime = now

            setUploadQueue((prev) =>
              prev.map((i) => (i.id === item.id ? { ...i, progress: percent, bytesUploaded: e.loaded, speed: speedStr, eta: etaStr } : i))
            )
          } else {
            setUploadQueue((prev) =>
              prev.map((i) => (i.id === item.id ? { ...i, progress: percent, bytesUploaded: e.loaded } : i))
            )
          }
        }
      }

      xhr.onload = () => {
        delete activeXhrsRef.current[item.id]
        if (xhr.status >= 200 && xhr.status < 300) {
          let responseData = {}
          try { responseData = JSON.parse(xhr.responseText) } catch (e) {}
          resolve(responseData.data || responseData.media || null)
        } else {
          reject(new Error(`Server binary upload failed with status ${xhr.status}`))
        }
      }

      xhr.onerror = () => {
        delete activeXhrsRef.current[item.id]
        reject(new Error('Network connection error during file upload.'))
      }

      xhr.onabort = () => {
        delete activeXhrsRef.current[item.id]
        reject(new Error('Upload cancelled by user.'))
      }

      xhr.send(formData)
    })
  }

  const uploadSingleFile = async (item) => {
    const file = item.file
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001'

    const presignedRes = await fetch(`${apiUrl}/api/faculty/journey-media/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fileName: item.name,
        mimeType: item.mimeType,
        fileSize: item.size,
        media_type: item.type
      })
    })

    if (!presignedRes.ok) {
      const errData = await presignedRes.json().catch(() => ({}))
      throw new Error(errData.message || 'Failed to initialize upload session.')
    }

    const initData = await presignedRes.json()

    if (initData.uploadType === 'presigned') {
      try {
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          activeXhrsRef.current[item.id] = xhr
          xhr.open('PUT', initData.uploadUrl, true)
          xhr.setRequestHeader('Content-Type', item.mimeType)

          let lastLoaded = 0
          let lastTime = Date.now()

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.min(95, Math.round((e.loaded / e.total) * 100))
              const now = Date.now()
              const timeDiff = (now - lastTime) / 1000

              if (timeDiff >= 0.25) {
                const loadedDiff = e.loaded - lastLoaded
                const bps = loadedDiff / timeDiff
                const speedStr = bps > 1024 * 1024
                  ? `${(bps / (1024 * 1024)).toFixed(1)} MB/s`
                  : `${Math.round(bps / 1024)} KB/s`

                const remaining = e.total - e.loaded
                const etaSec = bps > 0 ? Math.ceil(remaining / bps) : 0
                const etaStr = etaSec > 60
                  ? `ETA: ${Math.floor(etaSec / 60)}m ${etaSec % 60}s`
                  : `ETA: ${etaSec} seconds`

                lastLoaded = e.loaded
                lastTime = now

                setUploadQueue((prev) =>
                  prev.map((i) => (i.id === item.id ? { ...i, progress: percent, bytesUploaded: e.loaded, speed: speedStr, eta: etaStr } : i))
                )
              } else {
                setUploadQueue((prev) =>
                  prev.map((i) => (i.id === item.id ? { ...i, progress: percent, bytesUploaded: e.loaded } : i))
                )
              }
            }
          }

          xhr.onload = () => {
            delete activeXhrsRef.current[item.id]
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
            } else {
              reject(new Error(`Direct S3 upload failed with status ${xhr.status}`))
            }
          }

          xhr.onerror = () => {
            delete activeXhrsRef.current[item.id]
            reject(new Error('Network error during direct upload.'))
          }

          xhr.onabort = () => {
            delete activeXhrsRef.current[item.id]
            reject(new Error('Upload cancelled by user.'))
          }

          xhr.send(file)
        })

        // Transition to Finalizing... state (Upload finished, saving metadata)
        setUploadQueue((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'processing', progress: 98, speed: '', eta: 'Finalizing...' } : i))
        )

        const saveRes = await fetch(`${apiUrl}/api/faculty/journey-media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            media_type: item.type,
            storage_key: initData.storageKey,
            mime_type: item.mimeType,
            file_size: item.size,
            original_file_name: item.name
          })
        })

        if (!saveRes.ok) {
          const d = await saveRes.json().catch(() => ({}))
          throw new Error(d.message || 'Failed to save media metadata.')
        }

        const savedData = await saveRes.json()
        return savedData.data || savedData.media || null
      } catch (err) {
        if (err.message === 'Upload cancelled by user.') throw err
        console.warn('Direct S3 presigned upload failed, falling back to server binary upload:', err.message)
        return await performBinaryFallbackUpload(item)
      }
    } else {
      return await performBinaryFallbackUpload(item)
    }
  }

  // PARALLEL MULTI-FILE WORKER QUEUE (Concurrency Limit = 3)
  const handleUploadQueue = async (e) => {
    if (e) e.preventDefault()
    const pendingItems = uploadQueue.filter((i) => i.status === 'pending' || i.status === 'failed' || i.status === 'cancelled')
    if (pendingItems.length === 0) {
      showToast(t('Please select files to upload.'), 'error')
      return
    }

    setIsUploadingQueue(true)
    let successCount = 0
    const concurrencyLimit = 3
    const queueToProcess = [...pendingItems]

    const processNext = async () => {
      if (queueToProcess.length === 0) return

      const item = queueToProcess.shift()

      setUploadQueue((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'uploading', progress: 0, bytesUploaded: 0, error: null } : i))
      )

      try {
        const createdMediaItem = await uploadSingleFile(item)
        
        setUploadQueue((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'completed', progress: 100, bytesUploaded: i.size, speed: '', eta: '' } : i))
        )
        successCount++

        // OPTIMISTIC INSTANT GALLERY UPDATE (Append newly created media directly to state!)
        if (createdMediaItem && createdMediaItem.id) {
          setMediaList((prev) => [createdMediaItem, ...prev])
        }
      } catch (err) {
        const isCancel = err.message === 'Upload cancelled by user.'
        setUploadQueue((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: isCancel ? 'cancelled' : 'failed', speed: '', eta: '', error: isCancel ? 'Cancelled' : err.message || 'Upload failed.' }
              : i
          )
        )
      }

      await processNext()
    }

    const workers = []
    for (let i = 0; i < Math.min(concurrencyLimit, pendingItems.length); i++) {
      workers.push(processNext())
    }

    await Promise.all(workers)

    setIsUploadingQueue(false)

    // AUTOMATIC SUCCESS & AUTO-CLOSE MODAL AFTER 1.2 SECONDS
    if (successCount > 0) {
      const typeLabel = pendingItems.some((i) => i.type === 'video') ? t('Media') : t('Photo')
      showToast(
        successCount === 1 
          ? t('{{type}} uploaded successfully.').replace('{{type}}', typeLabel)
          : t('{{count}} items uploaded successfully.').replace('{{count}}', successCount)
      )
      
      // Auto-close modal after 1.2 seconds on complete success
      setTimeout(() => {
        setIsUploadModalOpen(false)
        clearCompleted()
      }, 1200)

      fetchMedia() // Sync with backend in background
    }
  }

  // Calculate Overall Progress Metrics for Multiple Files
  const overallQueueMetrics = useMemo(() => {
    if (uploadQueue.length === 0) return { totalBytes: 0, uploadedBytes: 0, percent: 0, completedCount: 0 }
    let totalBytes = 0
    let uploadedBytes = 0
    let completedCount = 0

    uploadQueue.forEach((item) => {
      totalBytes += item.size || 0
      if (item.status === 'completed') {
        uploadedBytes += item.size || 0
        completedCount++
      } else {
        uploadedBytes += item.bytesUploaded || 0
      }
    })

    const percent = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0
    return { totalBytes, uploadedBytes, percent, completedCount }
  }, [uploadQueue])

  const handleDeleteMedia = async (mediaId, e) => {
    if (e) e.stopPropagation()
    if (!window.confirm(t('Are you sure you want to delete this memory?'))) return

    // Smooth card deletion fade transition
    setDeletingMediaIds((prev) => new Set([...prev, mediaId]))

    setTimeout(async () => {
      setMediaList((prev) => prev.filter((m) => m.id !== mediaId))
      setDeletingMediaIds((prev) => {
        const next = new Set(prev)
        next.delete(mediaId)
        return next
      })
      if (activePreviewMedia?.id === mediaId) {
        setActivePreviewIndex(null)
      }

      const endpointPrefix = isAdmin
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/admin/journey-media/`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/faculty/journey-media/`

      try {
        const res = await fetch(`${endpointPrefix}${mediaId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          showToast(t('Media deleted successfully.'))
          fetchMedia()
        } else {
          const d = await res.json()
          showToast(t(d.message) || t('Failed to delete media.'), 'error')
          fetchMedia()
        }
      } catch (err) {
        console.error(err)
        showToast(t('Error deleting media.'), 'error')
        fetchMedia()
      }
    }, 220)
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  return (
    <div 
      ref={galleryContainerRef}
      style={{
        background: isGalleryUser ? 'transparent' : '#1C1C1E',
        width: '100%',
        minHeight: isGalleryUser ? 'calc(100vh - 64px)' : '100vh',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        borderRadius: isGalleryUser ? '0px' : '24px',
        overflow: 'hidden',
        padding: isGalleryUser
          ? (containerWidth < 640 ? '16px 12px 32px' : '20px 24px 40px')
          : (containerWidth < 640 ? '16px' : '24px'),
        boxSizing: 'border-box',
        boxShadow: isGalleryUser ? 'none' : '0 20px 50px rgba(0,0,0,0.3)',
        border: isGalleryUser ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* CSS Keyframe Animations & Dark Theme Styles */}
      <style>{`
        @keyframes cardEntrance {
          0% { opacity: 0; transform: scale(0.96); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes lightboxFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes checkPop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes floatingBarSlideUp {
          0% { transform: translate(-50%, 28px) scale(0.95); opacity: 0; }
          100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
        }
        @keyframes toastSlideUp {
          0% { opacity: 0; transform: translateY(20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .apple-photo-card {
          animation: cardEntrance 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s ease, border-color 0.22s, opacity 0.22s;
          border-radius: 12px;
          overflow: hidden;
          background: #2C2C2E;
          position: relative;
          cursor: pointer;
        }
        .apple-photo-card:hover {
          transform: scale(1.02);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
          z-index: 10;
        }
        .apple-photo-card.selected {
          transform: scale(1.02) !important;
          border: 2.5px solid #2563EB !important;
          box-shadow: 0 0 20px rgba(37, 99, 235, 0.45) !important;
          z-index: 10;
        }
        .apple-photo-card.deleting {
          opacity: 0 !important;
          transform: scale(0.88) !important;
          pointer-events: none !important;
        }
        .check-badge-animated {
          animation: checkPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, #2C2C2E 25%, #3A3A3C 50%, #2C2C2E 75%);
          background-size: 200% 100%;
          animation: shimmer 1.6s infinite linear;
          border-radius: 12px;
        }
        .upload-btn-gradient {
          background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .upload-btn-gradient:hover {
          transform: scale(1.03);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4);
          filter: brightness(1.1);
        }
        .upload-btn-gradient:active {
          transform: scale(0.97);
        }
        .toolbar-refresh-btn {
          height: 38px;
          padding: 0 14px;
          border-radius: 10px;
          background: #2C2C2E;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94A3B8;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .toolbar-refresh-btn:hover {
          color: #FFFFFF;
          border-color: rgba(255, 255, 255, 0.2);
          background: #3A3A3C;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .toolbar-refresh-btn:hover .spin-icon {
          transform: rotate(180deg);
        }
        .spin-icon {
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .journey-filter-scroll {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }
        .journey-filter-scroll::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }

        /* ── Modern Responsive Gallery Toolbar ── */
        .gallery-main-toolbar {
          display: flex;
          width: 100%;
          box-sizing: border-box;
        }

        /* Desktop View (>= 769px) */
        @media (min-width: 769px) {
          .gallery-main-toolbar {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            padding-bottom: 4px;
          }
          .gallery-toolbar-desktop-left {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
          }
          .gallery-mobile-tier1 {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .gallery-mobile-view-tabs {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .gallery-toolbar-row-type {
            display: inline-flex;
            align-items: center;
          }
          .gallery-type-segmented-bar {
            display: inline-flex;
            align-items: center;
            background: #2C2C2E;
            border-radius: 50px;
            padding: 3px;
          }
          .gallery-type-segment {
            padding: 4px 14px;
            min-height: 28px;
            font-size: 11px;
            font-weight: 700;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .gallery-toolbar-desktop-right {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          .gallery-toolbar-row-filters {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .gallery-filter-dropdown {
            padding: 6px 12px;
            border-radius: 50px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            font-size: 11.5px;
            font-weight: 600;
            color: #FFFFFF;
            background: #2C2C2E;
            outline: none;
            cursor: pointer;
            min-height: 34px;
            max-width: 140px;
          }
          .gallery-toolbar-actions-mobile {
            display: none !important;
          }
        }

        /* Mobile & Tablet View (<= 768px: 360px, 390px, 430px) */
        @media (max-width: 768px) {
          .gallery-main-toolbar {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            padding-bottom: 6px;
          }
          .gallery-toolbar-desktop-left,
          .gallery-toolbar-desktop-right {
            display: flex;
            flex-direction: column;
            width: 100%;
            gap: 10px;
          }
          .gallery-mobile-tier1 {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            flex-wrap: wrap;
            gap: 8px;
          }
          .gallery-mobile-view-tabs {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .gallery-toolbar-actions-mobile {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .gallery-toolbar-row-type {
            width: 100%;
          }
          .gallery-type-segmented-bar {
            display: flex;
            width: 100%;
            background: #242426;
            border-radius: 50px;
            padding: 3px;
            box-sizing: border-box;
            border: 1px solid rgba(255, 255, 255, 0.08);
          }
          .gallery-type-segment {
            flex: 1;
            padding: 0 8px;
            min-height: 34px;
            font-size: 12px;
            font-weight: 700;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.15s ease;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .gallery-toolbar-row-filters {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            box-sizing: border-box;
          }
          .gallery-filter-dropdown {
            flex: 1;
            min-width: 0;
            height: 38px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            font-size: 12px;
            font-weight: 600;
            color: #FFFFFF;
            background: #242426;
            outline: none;
            cursor: pointer;
            padding: 0 10px;
            box-sizing: border-box;
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
          }
        }
      `}</style>

      {/* Floating Success / Error Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 18px',
            borderRadius: '50px',
            background: toastMessage.type === 'error' ? '#DC2626' : '#2C2C2E',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#FFFFFF',
            boxShadow: '0 12px 36px -6px rgba(0,0,0,0.6)',
            fontSize: '13px',
            fontWeight: '600',
            animation: 'toastSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle size={16} style={{ color: '#FCA5A5' }} />
          ) : (
            <CheckCircle size={16} style={{ color: '#22C55E' }} />
          )}
          <span>{toastMessage.msg}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px', marginLeft: '4px' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 1. CLEAN MODERN HEADER WITH ACTIONS */}
      {!isGalleryUser && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 16px rgba(37,99,235,0.3)',
            flexShrink: 0
          }}>
            <Compass size={22} style={{ color: '#FFFFFF' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF', margin: 0, letterSpacing: '-0.4px', lineHeight: 1.2 }}>
              {t("LAP Journey Media")}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#94A3B8', fontWeight: '500' }}>
              {isGalleryUser
                ? t("Official LAP Journey Media Gallery (View & Download)")
                : (isSuperAdmin || isReadOnly 
                  ? t("Explore Journey Memories & Squad Moments (View Only)") 
                  : (isAdmin ? t("Manage Journey Memories & Squad Moments") : t("Your Squad Memories & Journey Highlights")))}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Select Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsSelectionMode(!isSelectionMode)
              if (isSelectionMode) setSelectedMediaIds(new Set())
            }}
            style={{
              height: '38px',
              padding: '0 14px',
              borderRadius: '10px',
              background: isSelectionMode ? '#2563EB' : '#27272A',
              border: isSelectionMode ? '1px solid #3B82F6' : '1px solid rgba(255,255,255,0.1)',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            className="hover:bg-slate-700 active:scale-95"
          >
            <CheckSquare size={15} />
            <span>{isSelectionMode ? t("Done") : t("Select")}</span>
            {isSelectionMode && selectedMediaIds.size > 0 && (
              <span style={{ background: '#FFFFFF', color: '#2563EB', fontSize: '11px', fontWeight: '700', borderRadius: '20px', padding: '1px 6px', marginLeft: '2px' }}>
                {selectedMediaIds.size}
              </span>
            )}
          </button>

          {/* Squad Coordinator Quota Badge */}
          {uploadQuota?.isSquadCoordinator && (
            <div
              title={t("Squad Coordinator upload quota for current batch")}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                height: '38px',
                padding: '0 12px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                fontSize: '12px',
                fontWeight: '600',
                color: '#E2E8F0',
                userSelect: 'none'
              }}
            >
              <span style={{ color: '#94A3B8' }}>{t("Batch Quota")}:</span>
              <span style={{ color: uploadQuota.remainingPhotos === 0 ? '#F87171' : '#60A5FA', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <ImageIcon size={13} /> {uploadQuota.photoCount}/5
              </span>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
              <span style={{ color: uploadQuota.remainingVideos === 0 ? '#F87171' : '#A78BFA', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Video size={13} /> {uploadQuota.videoCount}/2
              </span>
            </div>
          )}

          {/* [+ Upload Photos] Button (Hidden for Students, Admins, SuperAdmins, and Gallery) */}
          {!isStudent && !isAdmin && !isSuperAdmin && !isReadOnly && !isGalleryUser && (
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="upload-btn-gradient"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                padding: '0 16px',
                borderRadius: '10px',
                color: '#FFFFFF',
                fontSize: '12.5px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(37,99,235,0.3)'
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>{t("Upload Photos & Videos")}</span>
            </button>
          )}

          {/* Superadmin Upload Batch Group Photo Toggle Button */}
          {canManageGroupPhotos && (
            <button
              type="button"
              onClick={() => setShowGroupPhotoManager(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                padding: '0 14px',
                borderRadius: '10px',
                background: showGroupPhotoManager 
                  ? 'linear-gradient(135deg, #C99A44 0%, #A97C2E 100%)' 
                  : 'rgba(201, 154, 68, 0.15)',
                border: '1px solid rgba(201, 154, 68, 0.4)',
                color: showGroupPhotoManager ? '#FFF7E6' : '#E0B565',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Camera size={15} />
              <span>{showGroupPhotoManager ? t("Close Group Photo Uploader") : t("Upload Group Photo")}</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchMedia}
            disabled={loading}
            className="toolbar-refresh-btn"
            title={t("Refresh")}
          >
            <RefreshCw size={14} className={`spin-icon ${loading ? 'animate-spin' : ''}`} />
            <span>{t("Refresh")}</span>
          </button>
        </div>
      </div>
      )}

      {/* OFFICIAL BATCH GROUP PHOTOS MANAGEMENT CARD (SUPERADMIN, READ-ONLY SUPERADMIN) */}
      {canManageGroupPhotos && showGroupPhotoManager && (
        <div style={{
          background: 'linear-gradient(145deg, #242426 0%, #1E1E20 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(201, 154, 68, 0.3)',
          padding: containerWidth < 640 ? '14px' : '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(201,154,68,0.12) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          {/* Section Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #C99A44 0%, #A97C2E 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(201,154,68,0.35)',
                flexShrink: 0
              }}>
                <Camera size={22} color="#FFF7E6" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#FFFFFF', margin: 0, letterSpacing: '-0.2px' }}>
                    {t("Official Batch Group Photos")}
                  </h3>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                  {t("Every batch must have at least one official group photo. Uploaded photos are published batch-wise to students, squad coordinators, faculty & admins.")}
                </p>
              </div>
            </div>

            {/* Batch Selector & Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>{t("Batch")}:</span>
              <select
                value={groupBatchId}
                onChange={(e) => setGroupBatchId(e.target.value)}
                style={{
                  background: '#2C2C2E',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {batchList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (groupBatchId) fetchBatchGroupPhotos(groupBatchId)
                }}
                disabled={loadingGroupPhotos}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  color: '#CBD5E1',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}
                title={t("Refresh")}
              >
                <RefreshCw size={12} className={loadingGroupPhotos ? 'animate-spin' : ''} />
                <span>{t("Refresh")}</span>
              </button>
            </div>
          </div>



          {/* 2 Slots Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: containerWidth < 768 ? '1fr' : '1fr 1fr',
            gap: '14px'
          }}>
            {[1, 2].map((slotNumber) => {
              const photo = groupPhotos.find((p) => p.slot === slotNumber) || groupPhotos[slotNumber - 1]
              const staged = stagedGroupPhotos[slotNumber]
              const isUploadingThis = uploadingGroupSlot === slotNumber

              return (
                <div
                  key={slotNumber}
                  style={{
                    background: '#2A2A2D',
                    borderRadius: '12px',
                    border: (photo || staged) 
                      ? '1px solid rgba(201,154,68,0.35)' 
                      : '1.5px dashed rgba(255,255,255,0.15)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative'
                  }}
                >
                  {/* Slot Top Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: (photo || staged) ? '#E0B565' : '#94A3B8',
                        background: (photo || staged) ? 'rgba(201,154,68,0.15)' : 'rgba(255,255,255,0.06)',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        {t(`Slot #${slotNumber}`)}
                      </span>
                      {staged ? (
                        <span style={{ fontSize: '11px', color: '#60A5FA', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '700' }}>
                          <Clock size={12} /> {t("Ready to Upload")}
                        </span>
                      ) : photo ? (
                        <span style={{ fontSize: '11px', color: '#22C55E', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '600' }}>
                          <CheckCircle size={12} /> {t("Uploaded")}
                        </span>
                      ) : null}
                    </div>

                    {/* Delete Active Photo if exists and not staging */}
                    {photo && !staged && (
                      <button
                        onClick={() => handleDeleteGroupPhoto(photo.id)}
                        title={t("Delete this group photo")}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#EF4444',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Trash2 size={12} /> {t("Delete")}
                      </button>
                    )}

                    {/* Cancel Staged File */}
                    {staged && !isUploadingThis && (
                      <button
                        onClick={() => handleCancelStagedGroupPhoto(slotNumber)}
                        title={t("Cancel and remove selected file")}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#CBD5E1',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <X size={12} /> {t("Cancel")}
                      </button>
                    )}
                  </div>

                  {/* STAGED FILE PREVIEW & CONFIRMATION (SAME MANNER AS REST OF PHOTOS) */}
                  {staged ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '160px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#18181B',
                        border: '1px solid rgba(201,154,68,0.4)'
                      }}>
                        <img
                          src={staged.previewUrl}
                          alt={staged.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          background: 'rgba(0,0,0,0.75)',
                          backdropFilter: 'blur(4px)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: '#60A5FA',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <ImageIcon size={12} />
                          <span>{photo ? t("Replacement Preview") : t("Selected Photo Preview")}</span>
                        </div>
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: '6px 10px',
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                          fontSize: '11px',
                          color: '#E2E8F0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                            {staged.name}
                          </span>
                          <span style={{ fontSize: '10.5px', color: '#CBD5E1' }}>
                            {formatFileSize(staged.size)}
                          </span>
                        </div>
                      </div>

                      {/* Caption Input */}
                      <div>
                        <span style={{ fontSize: '11px', color: '#94A3B8', display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                          {t("Photo Caption")}:
                        </span>
                        <input
                          type="text"
                          placeholder={t(`Caption (e.g. Official Batch Group Photo ${slotNumber})`)}
                          value={groupCaptions[slotNumber] ?? `Official Batch Group Photo ${slotNumber}`}
                          disabled={isUploadingThis}
                          onChange={(e) => setGroupCaptions(prev => ({ ...prev, [slotNumber]: e.target.value }))}
                          style={{
                            width: '100%',
                            background: '#1E1E20',
                            border: '1px solid rgba(255,255,255,0.14)',
                            borderRadius: '6px',
                            padding: '7px 10px',
                            fontSize: '12px',
                            color: '#FFFFFF',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      {/* Explicit Start Upload Action Button */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleUploadGroupPhoto(slotNumber)}
                          disabled={isUploadingThis}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '9px 14px',
                            background: isUploadingThis ? '#3A3A3C' : 'linear-gradient(135deg, #C99A44 0%, #A97C2E 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#FFF7E6',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            cursor: isUploadingThis ? 'wait' : 'pointer',
                            boxShadow: isUploadingThis ? 'none' : '0 4px 14px rgba(201,154,68,0.3)',
                            transition: 'all 0.15s'
                          }}
                        >
                          {isUploadingThis ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                          <span>{isUploadingThis ? (uploadingGroupProgress[slotNumber]?.eta || t("Uploading...")) : (photo ? t("Upload Replacement Photo") : t("Start Upload Group Photo"))}</span>
                        </button>

                        {!isUploadingThis && (
                          <button
                            type="button"
                            onClick={() => handleCancelStagedGroupPhoto(slotNumber)}
                            style={{
                              padding: '9px 14px',
                              background: '#1E1E20',
                              border: '1px solid rgba(255,255,255,0.12)',
                              borderRadius: '8px',
                              color: '#94A3B8',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            {t("Cancel")}
                          </button>
                        )}
                      </div>

                      {/* Real-time Progress Bar & Speed Tracking */}
                      {isUploadingThis && (
                        <div style={{ width: '100%', marginTop: '2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#E0B565', marginBottom: '4px', fontWeight: '600' }}>
                            <span>{uploadingGroupProgress[slotNumber]?.status === 'processing' ? t('Finalizing metadata...') : `${uploadingGroupProgress[slotNumber]?.progress || 0}%`}</span>
                            <span>{uploadingGroupProgress[slotNumber]?.speed} {uploadingGroupProgress[slotNumber]?.eta}</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.12)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${uploadingGroupProgress[slotNumber]?.progress || 5}%`,
                              background: 'linear-gradient(90deg, #C99A44, #F59E0B)',
                              borderRadius: '3px',
                              transition: 'width 0.2s ease-out'
                            }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : photo ? (
                    /* ALREADY UPLOADED PHOTO */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '160px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#18181B',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }}>
                        <img
                          src={photo.imageUrl}
                          alt={`Batch group photo ${slotNumber}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>

                      {/* Replace Photo Control -> triggers handleStageGroupPhoto */}
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        background: '#3A3A3C',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#E2E8F0',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}>
                        <Upload size={13} />
                        <span>{t("Change / Replace Photo")}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleStageGroupPhoto(slotNumber, e.target.files[0])
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  ) : (
                    /* EMPTY SLOT -> PICK PHOTO TO STAGE (NOT UPLOADED DIRECTLY) */
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '22px 14px',
                      textAlign: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94A3B8'
                      }}>
                        <Camera size={22} />
                      </div>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#FFFFFF' }}>
                        {t(`Upload Group Photo ${slotNumber}`)}
                      </div>
                      <p style={{ fontSize: '11.5px', color: '#94A3B8', margin: 0, maxWidth: '240px' }}>
                        {t("JPEG, PNG, or WEBP high-resolution photo up to 50MB.")}
                      </p>

                      <div style={{ width: '100%', maxWidth: '280px', marginTop: '6px' }}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '9px 14px',
                          background: 'linear-gradient(135deg, #C99A44 0%, #A97C2E 100%)',
                          borderRadius: '8px',
                          color: '#FFF7E6',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(201,154,68,0.25)',
                          transition: 'all 0.15s'
                        }}>
                          <Upload size={13} />
                          <span>{t("Select Group Photo")}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleStageGroupPhoto(slotNumber, e.target.files[0])
                              }
                            }}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}



      {/* 2. GALLERY FIRST SECTION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* RESPONSIVE FILTER & ACTION BAR */}
        <div className="gallery-main-toolbar">
          {/* Left Block: Hierarchical Breadcrumb & Navigation Actions */}
          <div className="gallery-toolbar-desktop-left">
            {/* Tier 1: Breadcrumb & View Navigation */}
            <div className="gallery-mobile-tier1">
              <div className="gallery-mobile-view-tabs" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {currentView === 'batches' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#2563EB', color: '#FFFFFF', padding: '6px 14px', borderRadius: '50px', fontSize: '12px', fontWeight: '700' }}>
                    <Folder size={14} />
                    <span>{t("Batches")} ({batchFolders.length})</span>
                  </div>
                ) : currentView === 'squads' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBatch('')
                        setSelectedSquad('')
                        setCurrentView('batches')
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '50px',
                        fontSize: '12px',
                        fontWeight: '700',
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: '#2C2C2E',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      className="hover:text-white hover:bg-zinc-700"
                    >
                      <ChevronLeft size={14} />
                      <span>{t("Batches")}</span>
                    </button>
                    <span style={{ color: '#64748B', fontSize: '12px' }}>/</span>
                    <span style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: '700', background: '#2563EB', padding: '6px 12px', borderRadius: '50px' }}>
                      {selectedBatch} ({squadFolders.length} {squadFolders.length === 1 ? t('Squad') : t('Squads')})
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {!isStudent && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBatch('')
                            setSelectedSquad('')
                            setCurrentView('batches')
                          }}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '50px',
                            fontSize: '11.5px',
                            fontWeight: '600',
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: '#2C2C2E',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          className="hover:text-white"
                        >
                          <Folder size={12} />
                          <span>{t("Batches")}</span>
                        </button>
                        <span style={{ color: '#64748B', fontSize: '11px' }}>/</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSquad('')
                            setCurrentView('squads')
                          }}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '50px',
                            fontSize: '11.5px',
                            fontWeight: '600',
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: '#2C2C2E',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          className="hover:text-white"
                        >
                          <ChevronLeft size={12} />
                          <span>{selectedBatch}</span>
                        </button>
                        <span style={{ color: '#64748B', fontSize: '11px' }}>/</span>
                      </>
                    )}
                    <span style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: '700', background: 'rgba(37, 99, 235, 0.25)', border: '1px solid #3B82F6', padding: '5px 12px', borderRadius: '50px' }}>
                      {selectedSquad === 'Batch Group' ? t('Batch Group Photos') : (selectedSquad.toLowerCase().startsWith('squad') ? selectedSquad : `Squad ${selectedSquad}`)}
                    </span>
                  </div>
                )}
              </div>

              {/* Mobile Actions: Select & Refresh (displayed in Tier 1 on mobile, hidden on desktop) */}
              {isGalleryUser && (
                <div className="gallery-toolbar-actions-mobile">
                  {/* Select Mode Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSelectionMode(!isSelectionMode)
                      if (isSelectionMode) setSelectedMediaIds(new Set())
                    }}
                    style={{
                      height: '34px',
                      padding: '0 12px',
                      borderRadius: '50px',
                      background: isSelectionMode ? '#2563EB' : '#27272A',
                      border: isSelectionMode ? '1px solid #3B82F6' : '1px solid rgba(255,255,255,0.12)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <CheckSquare size={13} />
                    <span>{isSelectionMode ? t("Done") : t("Select")}</span>
                    {isSelectionMode && selectedMediaIds.size > 0 && (
                      <span style={{ background: '#FFFFFF', color: '#2563EB', fontSize: '10.5px', fontWeight: '800', borderRadius: '20px', padding: '1px 6px', marginLeft: '2px' }}>
                        {selectedMediaIds.size}
                      </span>
                    )}
                  </button>

                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={fetchMedia}
                    disabled={loading}
                    title={t("Refresh")}
                    style={{
                      height: '34px',
                      width: '34px',
                      borderRadius: '50%',
                      background: '#27272A',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <RefreshCw size={13} className={`spin-icon ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Tier 2: Media Type Pills (Visible only in Squad Gallery View) */}
            {currentView === 'gallery' && (
              <div className="gallery-toolbar-row-type">
                <div className="gallery-type-segmented-bar">
                  <button
                    type="button"
                    onClick={() => setMediaTypeFilter('ALL')}
                    className="gallery-type-segment"
                    style={{
                      background: mediaTypeFilter === 'ALL' ? '#3A3A3C' : 'transparent',
                      color: mediaTypeFilter === 'ALL' ? '#FFFFFF' : '#94A3B8'
                    }}
                  >
                    {t("All")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaTypeFilter('PHOTO')}
                    className="gallery-type-segment"
                    style={{
                      background: mediaTypeFilter === 'PHOTO' ? '#3A3A3C' : 'transparent',
                      color: mediaTypeFilter === 'PHOTO' ? '#FFFFFF' : '#94A3B8'
                    }}
                  >
                    {t("Photos")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaTypeFilter('VIDEO')}
                    className="gallery-type-segment"
                    style={{
                      background: mediaTypeFilter === 'VIDEO' ? '#3A3A3C' : 'transparent',
                      color: mediaTypeFilter === 'VIDEO' ? '#FFFFFF' : '#94A3B8'
                    }}
                  >
                    {t("Videos")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Block: Squad quick-switch dropdown within current batch */}
          <div className="gallery-toolbar-desktop-right">
            <div className="gallery-toolbar-row-filters">
              {currentView === 'gallery' && squadFolders.length > 0 && !isStudent && (
                <select
                  value={selectedSquad}
                  onChange={(e) => setSelectedSquad(e.target.value)}
                  className="gallery-filter-dropdown"
                >
                  {squadFolders.map((sq) => (
                    <option key={sq.name} value={sq.name}>
                      {sq.formattedTitle} ({sq.count})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* VIEW 1: BATCH FOLDERS VIEW (SELECT BATCH) */}
        {currentView === 'batches' ? (
          <div>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: '800', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Folder size={18} style={{ color: '#3B82F6' }} />
                  <span>{t("Select a Batch")}</span>
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                  {t("Choose a batch to explore squad memories and official photos")}
                </p>
              </div>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#94A3B8', background: '#27272A', border: '1px solid rgba(255,255,255,0.08)', padding: '4px 12px', borderRadius: '20px' }}>
                {batchFolders.length} {batchFolders.length === 1 ? t('Batch') : t('Batches')}
              </span>
            </div>

            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton-shimmer" style={{ height: '72px', borderRadius: '12px' }} />
                ))}
              </div>
            ) : batchFolders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748B' }}>
                <Folder size={36} style={{ margin: '0 auto 12px', color: '#3A3A3C' }} />
                <p style={{ margin: 0, fontSize: '13.5px', fontWeight: '600', color: '#FFFFFF' }}>{t("No batches found.")}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                {batchFolders.map((folder) => (
                  <div
                    key={folder.name}
                    onClick={() => {
                      setSelectedBatch(folder.name)
                      setSelectedSquad('')
                      setCurrentView('squads')
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #27272A 0%, #1C1C1E 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}
                    className="hover:border-blue-500 hover:scale-[1.01]"
                  >
                    <div style={{ width: '40px', height: '40px', background: 'rgba(37, 99, 235, 0.15)', border: '1px solid rgba(37, 99, 235, 0.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Folder size={18} style={{ color: '#3B82F6' }} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: '#FFFFFF', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {folder.name}
                      </h4>
                      <span style={{ fontSize: '11.5px', color: '#94A3B8', fontWeight: '500' }}>
                        {folder.count} {folder.count === 1 ? t('item') : t('items')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : currentView === 'squads' ? (
          /* VIEW 2: SQUAD FOLDERS VIEW (SELECT SQUAD UNDER SELECTED BATCH) */
          <div>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: '800', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Folder size={18} style={{ color: '#3B82F6' }} />
                  <span>{t("Select a Squad in")} {selectedBatch}</span>
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                  {t("Click a squad to view its photos and videos")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBatch('')
                  setSelectedSquad('')
                  setCurrentView('batches')
                }}
                style={{
                  background: '#27272A',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '5px 12px',
                  color: '#94A3B8',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                className="hover:text-white hover:bg-zinc-700"
              >
                <ChevronLeft size={14} />
                <span>{t("Change Batch")}</span>
              </button>
            </div>

            {squadFolders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748B' }}>
                <Folder size={36} style={{ margin: '0 auto 12px', color: '#3A3A3C' }} />
                <p style={{ margin: 0, fontSize: '13.5px', fontWeight: '600', color: '#FFFFFF' }}>{t("No squad folders found in this batch.")}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                {squadFolders.map((squad) => {
                  const isGroup = squad.name === 'Batch Group'
                  return (
                    <div
                      key={squad.name}
                      onClick={() => {
                        setSelectedSquad(squad.name)
                        setCurrentView('gallery')
                      }}
                      style={{
                        background: isGroup ? 'linear-gradient(135deg, rgba(201,154,68,0.15) 0%, #1C1C1E 100%)' : 'linear-gradient(135deg, #27272A 0%, #1C1C1E 100%)',
                        border: isGroup ? '1px solid rgba(201,154,68,0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '14px',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                      }}
                      className="hover:border-blue-500 hover:scale-[1.01]"
                    >
                      <div style={{
                        width: '40px',
                        height: '40px',
                        background: isGroup ? 'rgba(201,154,68,0.2)' : 'rgba(37, 99, 235, 0.15)',
                        border: isGroup ? '1px solid rgba(201,154,68,0.4)' : '1px solid rgba(37, 99, 235, 0.3)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isGroup ? <Sparkles size={18} style={{ color: '#EAB308' }} /> : <Folder size={18} style={{ color: '#3B82F6' }} />}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: '#FFFFFF', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {squad.formattedTitle}
                        </h4>
                        <span style={{ fontSize: '11.5px', color: isGroup ? '#FCD34D' : '#94A3B8', fontWeight: '500' }}>
                          {squad.count} {squad.count === 1 ? t('item') : t('items')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* VIEW 3: APPLE PHOTOS JUSTIFIED ROW GALLERY (FOR SELECTED SQUAD) */
          <div>
            {/* Breadcrumb Navigation Bar in Gallery View */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {!isStudent && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBatch('')
                        setSelectedSquad('')
                        setCurrentView('batches')
                      }}
                      style={{
                        background: '#2C2C2E',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '5px 12px',
                        color: '#94A3B8',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      className="hover:text-white hover:bg-zinc-700"
                    >
                      <Folder size={13} style={{ color: '#3B82F6' }} />
                      <span>{t("Batches")}</span>
                    </button>
                    <span style={{ color: '#64748B', fontSize: '12px' }}>/</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSquad('')
                        setCurrentView('squads')
                      }}
                      style={{
                        background: '#2C2C2E',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '5px 12px',
                        color: '#94A3B8',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      className="hover:text-white hover:bg-zinc-700"
                    >
                      <ChevronLeft size={13} />
                      <span>{selectedBatch || t("Current Batch")}</span>
                    </button>
                    <span style={{ color: '#64748B', fontSize: '12px' }}>/</span>
                  </>
                )}
                <span style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: '800', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.35)', padding: '4px 10px', borderRadius: '8px' }}>
                  {selectedSquad === 'Batch Group' ? t("Batch Group Photos") : (selectedSquad.toLowerCase().startsWith('squad') ? selectedSquad : `Squad ${selectedSquad}`)}
                </span>
                <span style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '600' }}>
                  ({filteredMedia.length} {filteredMedia.length === 1 ? t('item') : t('items')})
                </span>
              </div>

              {!isStudent && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSquad('')
                    setCurrentView('squads')
                  }}
                  style={{
                    background: '#27272A',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: '5px 12px',
                    color: '#E4E4E7',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  className="hover:border-blue-500/50"
                >
                  <ChevronLeft size={14} />
                  <span>{t("Change Squad")}</span>
                </button>
              )}
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', width: '100%' }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="skeleton-shimmer"
                    style={{
                      width: `${150 + (i % 5) * 50}px`,
                      height: '200px',
                      borderRadius: '12px'
                    }}
                  />
                ))}
              </div>
            ) : mediaList.length === 0 && uploadQueue.length === 0 ? (
              /* Empty Gallery State */
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748B' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#27272A', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#52525B' }}>
                  <ImageIcon size={26} />
                </div>
                <h4 style={{ margin: '0 0 4px', fontSize: '14.5px', fontWeight: '700', color: '#FFFFFF' }}>
                  {t("Your squad memories will appear here.")}
                </h4>
                <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#94A3B8' }}>
                  {t("Click [+ Upload Photos] above to add your first memory.")}
                </p>
              </div>
            ) : (
              /* APPLE PHOTOS JUSTIFIED ROWS (Equal height per row, natural widths, 8px spacing, ZERO letterboxing) */
              <div ref={gridListRef} style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                {topSpacerHeight > 0 && <div style={{ height: `${topSpacerHeight}px`, width: '100%' }} />}
                {renderedRows.map((row, relIndex) => {
                  const rowIndex = startRowIndex + relIndex
                  return (
                    <div 
                      key={`row-${rowIndex}`}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        width: '100%',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        justifyContent: row.isJustified ? 'space-between' : 'flex-start'
                      }}
                    >
                      {row.items.map((item) => {
                        const globalIndex = filteredMedia.findIndex((m) => m.id === item.id)
                        const displayUrl = getMediaUrl(item.imageUrl || item.media_url)
                        const isVideo = isVideoItem(item)
                        const isSelected = selectedMediaIds.has(item.id)
                        const isDeleting = deletingMediaIds.has(item.id)

                        return (
                          <div
                            key={item.id}
                            onClick={(e) => {
                              if (isSelectionMode) {
                                toggleSelectMedia(item.id, e)
                              } else {
                                setActivePreviewIndex(globalIndex >= 0 ? globalIndex : 0)
                              }
                            }}
                            className={`apple-photo-card ${isSelected ? 'selected' : ''} ${isDeleting ? 'deleting' : ''}`}
                            style={{
                              width: `${item.width}px`,
                              height: `${item.height}px`,
                              maxWidth: '100%',
                              flexGrow: row.isJustified ? item.ratio : 0,
                              flexShrink: row.isJustified ? 1 : 0
                            }}
                          >
                            {/* Image = Card: 100% natural photo aspect ratio, zero letterboxing */}
                            {!isVideo ? (
                              <img
                                src={displayUrl}
                                alt={item.caption || t('Squad photo')}
                                loading="lazy"
                                decoding="async"
                                className="img-zoom"
                                onLoad={(e) => handleImageLoad(item.id, e)}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  borderRadius: '12px',
                                  display: 'block'
                                }}
                                onError={(e) => {
                                  e.target.onerror = null
                                  e.target.src = '/placeholder-media.png'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '100%',
                                height: '100%',
                                position: 'relative',
                                background: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid rgba(255,255,255,0.06)'
                              }}>
                                <div style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '50%',
                                  background: 'rgba(255, 255, 255, 0.9)',
                                  backdropFilter: 'blur(8px)',
                                  color: '#0F172A',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                                  paddingLeft: '3px'
                                }}>
                                  <Play size={16} fill="#0F172A" />
                                </div>
                                <div style={{
                                  position: 'absolute',
                                  bottom: 8,
                                  left: 8,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'rgba(0,0,0,0.65)',
                                  backdropFilter: 'blur(4px)',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  color: '#E4E4E7',
                                  letterSpacing: '0.4px'
                                }}>
                                  <Video size={11} />
                                  <span>{t('VIDEO')}</span>
                                </div>
                              </div>
                            )}

                            {/* Official Batch Group Photo Badge */}
                            {(item.is_group_photo || item.isGroupPhoto || item.squad === 'Batch Group' || item.squadName === 'Batch Group') && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 8,
                                  left: (isSelectionMode || isSelected) ? 36 : 8,
                                  zIndex: 4,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'linear-gradient(135deg, rgba(201,154,68,0.95) 0%, rgba(169,124,46,0.95) 100%)',
                                  color: '#FFF7E6',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '10.5px',
                                  fontWeight: '700',
                                  backdropFilter: 'blur(4px)',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                  letterSpacing: '0.2px'
                                }}
                              >
                                <Sparkles size={11} color="#FFF7E6" />
                                <span>{t("Group Photo")}</span>
                              </div>
                            )}

                            {/* Multi-Selection Checkbox Indicator with Animated Pop */}
                            {(isSelectionMode || isSelected) && (
                              <div 
                                onClick={(e) => toggleSelectMedia(item.id, e)}
                                className={isSelected ? 'check-badge-animated' : ''}
                                style={{
                                  position: 'absolute', top: 8, left: 8, zIndex: 5,
                                  width: '22px', height: '22px', borderRadius: '50%',
                                  background: isSelected ? '#2563EB' : 'rgba(0,0,0,0.5)',
                                  border: isSelected ? 'none' : '1.5px solid rgba(255,255,255,0.7)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                {isSelected && <Check size={13} strokeWidth={3} color="#FFF" />}
                              </div>
                            )}

                            {/* Hover Action Overlay */}
                            {!isSelectionMode && (
                              <div style={{
                                position: 'absolute', inset: 0, zIndex: 3,
                                background: 'linear-gradient(to top, rgba(24,24,27,0.92) 0%, rgba(24,24,27,0.15) 60%, transparent 100%)',
                                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                                padding: '8px 10px', color: '#FFFFFF', opacity: 0, transition: 'opacity 0.2s ease',
                                borderRadius: '12px'
                              }}
                              className="hover:opacity-100"
                              >
                                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: '4px' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDownload(item, e)}
                                    title={t("Download")}
                                    style={{
                                      width: '26px', height: '26px', borderRadius: '50%',
                                      background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)',
                                      border: 'none', color: '#0F172A', display: 'flex',
                                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                    }}
                                  >
                                    <Download size={11} />
                                  </button>

                                  {!isStudent && !isSuperAdmin && !isReadOnly && !isGalleryUser && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeleteMedia(item.id, e)}
                                      title={t("Delete")}
                                      style={{
                                        width: '26px', height: '26px', borderRadius: '50%',
                                        background: 'rgba(239,68,68,0.85)', backdropFilter: 'blur(4px)',
                                        border: 'none', color: '#FFFFFF', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                      }}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#E4E4E7', fontWeight: '500' }}>
                                  <span>{item.uploaderName || item.uploader_name || t('Faculty/LTC')}</span>
                                  <span>{new Date(item.uploadedAt || item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
                {bottomSpacerHeight > 0 && <div style={{ height: `${bottomSpacerHeight}px`, width: '100%' }} />}
              </div>
            )}

            {/* Infinite Scroll Sentinel */}
            <div ref={observerSentinelRef} style={{ height: '20px', marginTop: '16px' }} />
          </div>
        )}
      </div>

      {/* 3. REDESIGNED MODERN FLOATING SELECTION ACTION BAR (APPLE / GOOGLE PHOTOS STYLE) */}
      {selectedMediaIds.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99995,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 18px',
            borderRadius: '30px',
            background: 'rgba(28, 28, 30, 0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1)',
            animation: 'floatingBarSlideUp 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#FFFFFF', paddingRight: '4px', whiteSpace: 'nowrap' }}>
            {selectedMediaIds.size} {t("Selected")}
          </span>

          <div style={{ height: '18px', width: '1px', background: 'rgba(255, 255, 255, 0.18)' }} />

          {/* Download Button = Blue */}
          <button
            type="button"
            onClick={handleBulkDownload}
            style={{
              height: '36px',
              padding: '0 16px',
              borderRadius: '50px',
              background: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'transform 0.15s ease'
            }}
            className="hover:scale-105"
          >
            <Download size={14} />
            <span>{t("Download")}</span>
          </button>

          {/* Delete Button = Red (Hidden for Students, SuperAdmins, ReadOnly, and Gallery) */}
          {!isStudent && !isSuperAdmin && !isReadOnly && !isGalleryUser && (
            <button
              type="button"
              onClick={handleBulkDelete}
              style={{
                height: '36px',
                padding: '0 16px',
                borderRadius: '50px',
                background: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'transform 0.15s ease'
              }}
              className="hover:scale-105"
            >
              <Trash2 size={14} />
              <span>{t("Delete")}</span>
            </button>
          )}

          {/* Cancel Button = Neutral Dark */}
          <button
            type="button"
            onClick={() => { setSelectedMediaIds(new Set()); setIsSelectionMode(false) }}
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '50px',
              background: '#3A3A3C',
              color: '#E4E4E7',
              border: 'none',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'transform 0.15s ease'
            }}
            className="hover:scale-105"
          >
            <X size={14} />
            <span>{t("Cancel")}</span>
          </button>
        </div>
      )}

      {/* 4. PORTAL-MOUNTED FLOATING VIEWPORT-CENTERED UPLOAD MODAL */}
      {isUploadModalOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("Upload Photos & Videos")}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            height: '100dvh',
            zIndex: 999998,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
            animation: 'lightboxFadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            overflowY: 'auto'
          }}
          onClick={() => { if (!isUploadingQueue) setIsUploadModalOpen(false) }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              maxHeight: '90dvh',
              background: '#242426',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '24px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 30px 60px -12px rgba(0,0,0,0.85)',
              boxSizing: 'border-box',
              margin: 'auto',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#2563EB', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,99,235,0.35)' }}>
                  <Upload size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '-0.3px' }}>
                    {t("Upload Photos & Videos")}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#94A3B8' }}>
                    {t("Add high quality photos and videos to your batch and squad memories")}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={isUploadingQueue}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)', color: '#FFFFFF',
                  border: 'none', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: isUploadingQueue ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s ease'
                }}
                className="hover:bg-white/20"
                aria-label={t("Close")}
              >
                <X size={16} />
              </button>
            </div>

            {/* Squad Coordinator Quota Summary Banner */}
            {uploadQuota?.isSquadCoordinator && (
              <div
                style={{
                  background: (uploadQuota.remainingPhotos === 0 && uploadQuota.remainingVideos === 0)
                    ? 'rgba(239, 68, 68, 0.12)'
                    : 'rgba(37, 99, 235, 0.12)',
                  border: `1px solid ${(uploadQuota.remainingPhotos === 0 && uploadQuota.remainingVideos === 0) ? 'rgba(239, 68, 68, 0.3)' : 'rgba(37, 99, 235, 0.3)'}`,
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#FFFFFF' }}>
                    {t("Squad Coordinator Batch Limit")} {uploadQuota.batchName ? `· ${uploadQuota.batchName}` : ''}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: (uploadQuota.remainingPhotos === 0 && uploadQuota.remainingVideos === 0) ? '#EF4444' : '#2563EB',
                      color: '#FFFFFF'
                    }}
                  >
                    {(uploadQuota.remainingPhotos === 0 && uploadQuota.remainingVideos === 0) ? t("Limit Reached") : t("Active Limit")}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#CBD5E1', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <ImageIcon size={14} style={{ color: '#60A5FA' }} />
                    {t("Photos")}: <strong style={{ color: uploadQuota.remainingPhotos === 0 ? '#F87171' : '#60A5FA' }}>{uploadQuota.photoCount}/5</strong> ({uploadQuota.remainingPhotos} {t("remaining")})
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Video size={14} style={{ color: '#A78BFA' }} />
                    {t("Videos")}: <strong style={{ color: uploadQuota.remainingVideos === 0 ? '#F87171' : '#A78BFA' }}>{uploadQuota.videoCount}/2</strong> ({uploadQuota.remainingVideos} {t("remaining")})
                  </span>
                </div>
              </div>
            )}

            {/* Dropzone & Picker */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileChange}
                disabled={isUploadingQueue || (uploadQuota?.isSquadCoordinator && uploadQuota.remainingPhotos === 0 && uploadQuota.remainingVideos === 0)}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0,
                  cursor: (isUploadingQueue || (uploadQuota?.isSquadCoordinator && uploadQuota.remainingPhotos === 0 && uploadQuota.remainingVideos === 0)) ? 'not-allowed' : 'pointer', zIndex: 2
                }}
              />
              <div style={{
                padding: '24px 20px',
                background: '#18181B',
                border: '2px dashed rgba(255,255,255,0.18)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                textAlign: 'center',
                cursor: (isUploadingQueue || (uploadQuota?.isSquadCoordinator && uploadQuota.remainingPhotos === 0 && uploadQuota.remainingVideos === 0)) ? 'not-allowed' : 'pointer',
                transition: 'border-color 0.2s ease, background 0.2s ease',
                opacity: (uploadQuota?.isSquadCoordinator && uploadQuota.remainingPhotos === 0 && uploadQuota.remainingVideos === 0) ? 0.6 : 1
              }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(37,99,235,0.15)', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={20} />
                </div>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: '700', color: '#FFFFFF' }}>
                    {uploadQuota?.isSquadCoordinator && uploadQuota.remainingPhotos === 0 && uploadQuota.remainingVideos === 0
                      ? t("Upload limit reached for this batch (5 photos, 2 videos)")
                      : (uploadQueue.length > 0 ? `${uploadQueue.length} files selected in queue` : t("Drag & drop files or click to browse"))}
                  </p>
                  <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                    {uploadQuota?.isSquadCoordinator
                      ? t("Squad coordinators can upload up to 5 photos and 2 videos")
                      : "JPEG, PNG, WEBP, MP4 & MOV supported"}
                  </span>
                </div>
              </div>
            </div>

            {/* OVERALL QUEUE PROGRESS BAR (WHEN MULTIPLE FILES ARE SELECTED) */}
            {uploadQueue.length > 1 && (
              <div style={{ background: '#18181B', padding: '12px 14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: '700', color: '#FFF' }}>
                    {t("Overall Progress")}: {overallQueueMetrics.completedCount} of {uploadQueue.length} files uploaded
                  </span>
                  <span style={{ fontWeight: '700', color: '#60A5FA' }}>
                    {formatFileSize(overallQueueMetrics.uploadedBytes)} / {formatFileSize(overallQueueMetrics.totalBytes)} ({overallQueueMetrics.percent}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${overallQueueMetrics.percent}%`, 
                      background: 'linear-gradient(90deg, #2563EB, #60A5FA)', 
                      transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)' 
                    }} 
                  />
                </div>
              </div>
            )}

            {/* ENTERPRISE UPLOAD QUEUE CARDS WITH REAL TIME PROGRESS & SPEED */}
            {uploadQueue.length > 0 && (
              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
                {uploadQueue.map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#18181B', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {/* Instant Client-side Canvas Poster / Image Preview */}
                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: '#27272A', position: 'relative' }}>
                      {item.posterPreviewUrl ? (
                        <img src={item.posterPreviewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : item.previewUrl && item.type === 'photo' ? (
                        <img src={item.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                          <Video size={18} />
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <p style={{ margin: 0, fontSize: '12.5px', fontWeight: '700', color: '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '210px' }}>
                          {item.name}
                        </p>
                        <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700' }}>
                          {formatFileSize(item.bytesUploaded || 0)} / {formatFileSize(item.size)}
                        </span>
                      </div>

                      {/* Precise Multi-State Progress Bar */}
                      <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            height: '100%', 
                            width: `${item.progress}%`, 
                            background: item.status === 'failed' ? '#EF4444' : item.status === 'cancelled' ? '#F59E0B' : item.status === 'completed' ? '#22C55E' : 'linear-gradient(90deg, #2563EB, #3B82F6)',
                            transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)' 
                          }} 
                        />
                      </div>

                      {/* Real Speed, ETA & Status Metrics Line */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '10.5px' }}>
                        <span style={{
                          fontWeight: '700',
                          color: item.status === 'completed' ? '#22C55E' : item.status === 'failed' ? '#EF4444' : item.status === 'cancelled' ? '#F59E0B' : '#60A5FA'
                        }}>
                          {item.status === 'uploading' && `Uploading... ${item.progress}%`}
                          {item.status === 'processing' && `Finalizing...`}
                          {item.status === 'completed' && `Completed `}
                          {item.status === 'pending' && `Queued`}
                          {item.status === 'cancelled' && `Cancelled`}
                          {item.status === 'failed' && `Failed (${item.error || 'Network error'})`}
                        </span>

                        <div style={{ display: 'flex', gap: '8px', color: '#94A3B8', fontWeight: '600' }}>
                          {item.speed && <span>{item.speed}</span>}
                          {item.eta && <span>{item.eta}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Cancel / Retry / Remove */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {item.status === 'uploading' && (
                        <button
                          type="button"
                          onClick={(e) => cancelUploadItem(item.id, e)}
                          title={t("Cancel upload")}
                          style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                        >
                          <X size={15} />
                        </button>
                      )}

                      {(item.status === 'failed' || item.status === 'cancelled') && (
                        <button
                          type="button"
                          onClick={(e) => retryUploadItem(item.id, e)}
                          title={t("Retry upload")}
                          style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', padding: '4px' }}
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}

                      {item.status !== 'uploading' && (
                        <button
                          type="button"
                          onClick={(e) => removeFromQueue(item.id, e)}
                          title={t("Remove")}
                          style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ACTION BAR: [ CLOSE ] | [ START PARALLEL UPLOAD ] */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '4px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={isUploadingQueue}
                style={{
                  padding: '9px 18px', borderRadius: '50px', background: '#18181B',
                  color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '12.5px', fontWeight: '600', cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                className="hover:bg-zinc-800 hover:text-white"
              >
                {t("Close")}
              </button>

              <button
                type="button"
                onClick={handleUploadQueue}
                disabled={isUploadingQueue || uploadQueue.length === 0}
                className="upload-btn-gradient"
                style={{
                  padding: '9px 22px', borderRadius: '50px',
                  color: '#FFFFFF', fontSize: '12.5px', fontWeight: '700',
                  border: 'none', cursor: isUploadingQueue || uploadQueue.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: isUploadingQueue || uploadQueue.length === 0 ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.3)'
                }}
              >
                {isUploadingQueue && <RefreshCw size={13} className="animate-spin" />}
                <span>{isUploadingQueue ? t('Uploading in Parallel...') : t('Start Parallel Upload')}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 5. PORTAL-MOUNTED IMMERSIVE FULLSCREEN LIGHTBOX VIEWER */}
      {activePreviewMedia && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("Media Viewer")}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            height: '100dvh',
            zIndex: 999999,
            background: 'rgba(0, 0, 0, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            userSelect: 'none',
            boxSizing: 'border-box',
            animation: 'lightboxFadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={() => { setActivePreviewIndex(null); setZoomScale(1); setPanOffset({ x: 0, y: 0 }); }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top-Right Fixed 44px Circular Glass Close Button */}
          <button
            type="button"
            onClick={() => { setActivePreviewIndex(null); setZoomScale(1); setPanOffset({ x: 0, y: 0 }); }}
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 1000002,
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'rgba(28, 28, 30, 0.8)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              transition: 'transform 0.2s ease, background 0.2s ease'
            }}
            className="hover:scale-110 hover:bg-white/20 active:scale-95"
            title={t("Close (Esc)")}
            aria-label={t("Close")}
          >
            <X size={22} />
          </button>

          {/* Perfectly Centered Media Container */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: containerWidth < 768 ? '64px 16px 110px 16px' : '64px 84px 100px 84px',
              boxSizing: 'border-box',
              cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={handleDoubleClickZoom}
            onWheel={handleWheelZoom}
            onMouseDown={handleMouseDownPan}
            onMouseMove={handleMouseMovePan}
            onMouseUp={handleMouseUpPan}
          >
            {/* Loading Spinner */}
            {previewLoading && (
              <div
                style={{
                  position: 'absolute',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '50%',
                  padding: '16px'
                }}
              >
                <RefreshCw size={28} className="animate-spin" style={{ color: '#60A5FA' }} />
              </div>
            )}

            {/* Error Fallback */}
            {previewError && (
              <div
                style={{
                  color: '#F87171',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  padding: '24px 32px',
                  borderRadius: '16px',
                  border: '1px solid rgba(239, 68, 68, 0.3)'
                }}
              >
                <AlertCircle size={32} />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>{t("Failed to load media")}</span>
              </div>
            )}

            {!isVideoItem(activePreviewMedia) ? (
              <img
                src={getMediaUrl(activePreviewMedia.imageUrl || activePreviewMedia.media_url)}
                alt="Full view"
                style={{
                  maxWidth: containerWidth < 768 ? 'calc(100vw - 32px)' : 'min(calc(100vw - 170px), 1400px)',
                  maxHeight: containerWidth < 768 ? 'calc(100dvh - 180px)' : 'calc(100vh - 170px)',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  boxShadow: '0 25px 60px -15px rgba(0,0,0,0.85)',
                  transform: `scale(${zoomScale}) translate(${panOffset.x / zoomScale}px, ${panOffset.y / zoomScale}px)`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  userSelect: 'none',
                  WebkitUserDrag: 'none',
                  display: previewError ? 'none' : 'block',
                  margin: 'auto'
                }}
                onLoad={() => setPreviewLoading(false)}
                onError={() => {
                  setPreviewLoading(false)
                  setPreviewError(true)
                }}
              />
            ) : (
              <video
                src={getMediaUrl(activePreviewMedia.imageUrl || activePreviewMedia.media_url)}
                controls
                autoPlay
                playsInline
                style={{
                  maxWidth: containerWidth < 768 ? 'calc(100vw - 32px)' : 'min(calc(100vw - 170px), 1400px)',
                  maxHeight: containerWidth < 768 ? 'calc(100dvh - 180px)' : 'calc(100vh - 170px)',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  boxShadow: '0 25px 60px -15px rgba(0,0,0,0.85)',
                  display: previewError ? 'none' : 'block',
                  margin: 'auto'
                }}
                onLoadedData={() => setPreviewLoading(false)}
                onError={() => {
                  setPreviewLoading(false)
                  setPreviewError(true)
                }}
              />
            )}
          </div>

          {/* Vertically Centered Previous Arrow Button (Fixed 24px from left edge) */}
          {filteredMedia.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigatePrev(); }}
              style={{
                position: 'fixed',
                left: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 1000001,
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(28, 28, 30, 0.8)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                transition: 'all 0.2s ease'
              }}
              className="hover:scale-110 hover:bg-white/20 active:scale-95"
              title={t("Previous (Left Arrow)")}
              aria-label={t("Previous")}
            >
              <ChevronLeft size={26} strokeWidth={2.2} />
            </button>
          )}

          {/* Vertically Centered Next Arrow Button (Fixed 24px from right edge) */}
          {filteredMedia.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigateNext(); }}
              style={{
                position: 'fixed',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 1000001,
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(28, 28, 30, 0.8)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                transition: 'all 0.2s ease'
              }}
              className="hover:scale-110 hover:bg-white/20 active:scale-95"
              title={t("Next (Right Arrow)")}
              aria-label={t("Next")}
            >
              <ChevronRight size={26} strokeWidth={2.2} />
            </button>
          )}

          {/* Responsive Floating Bottom Bar & Information Chip */}
          <div
            style={{
              position: 'fixed',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000001,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              maxWidth: 'calc(100vw - 32px)',
              pointerEvents: 'auto',
              userSelect: 'none'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Uploader Info Chip */}
            <div
              style={{
                padding: '6px 16px',
                borderRadius: '30px',
                background: 'rgba(20, 20, 22, 0.85)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: '12px',
                color: '#E4E4E7',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
              }}
            >
              <span style={{ fontWeight: '700', color: '#60A5FA' }}>
                {activePreviewIndex + 1} / {filteredMedia.length}
              </span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span style={{ fontWeight: '600', color: '#FFF' }}>
                {activePreviewMedia.uploaderName || activePreviewMedia.uploader_name || 'Faculty / LTC'}
              </span>
              {activePreviewMedia.squad && activePreviewMedia.squad !== 'All Squads' && (
                <>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <span style={{ color: '#FCD34D', fontWeight: '600' }}>
                    {activePreviewMedia.squad}
                  </span>
                </>
              )}
              {(activePreviewMedia.is_group_photo || activePreviewMedia.isGroupPhoto || activePreviewMedia.squad === 'Batch Group' || activePreviewMedia.squadName === 'Batch Group') && (
                <>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <span style={{ 
                    color: '#FFF7E6', 
                    fontWeight: '700', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    background: 'linear-gradient(135deg, #C99A44 0%, #A97C2E 100%)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                  }}>
                    <Sparkles size={11} color="#FFF7E6" />
                    {t("Group Photo")}
                  </span>
                </>
              )}
              <span style={{ opacity: 0.4 }}>•</span>
              <span>
                {new Date(activePreviewMedia.uploadedAt || activePreviewMedia.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>

            {/* Action Bar (Download pill on mobile, full controls on desktop) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 14px',
                borderRadius: '50px',
                background: 'rgba(28, 28, 30, 0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
              }}
            >
              <button
                type="button"
                onClick={(e) => handleDownload(activePreviewMedia, e)}
                title={t("Download")}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '50px',
                  background: '#2563EB',
                  color: '#FFF',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                className="hover:scale-105 hover:bg-blue-500 active:scale-95"
              >
                <Download size={14} />
                <span>{t("Download")}</span>
              </button>

              {!isStudent && !isSuperAdmin && !isReadOnly && !isGalleryUser && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteMedia(activePreviewMedia.id, e)}
                  title={t("Delete")}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#EF4444',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  className="hover:bg-red-600 hover:text-white hover:scale-110 active:scale-95"
                >
                  <Trash2 size={16} />
                </button>
              )}

              {!isVideoItem(activePreviewMedia) && (
                <button
                  type="button"
                  onClick={() => {
                    if (zoomScale > 1) {
                      setZoomScale(1)
                      setPanOffset({ x: 0, y: 0 })
                    } else {
                      setZoomScale(2)
                    }
                  }}
                  title={zoomScale === 1 ? t("Zoom In") : t("Reset Zoom")}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: zoomScale > 1 ? 'rgba(37, 99, 235, 0.35)' : 'rgba(255,255,255,0.15)',
                    color: zoomScale > 1 ? '#60A5FA' : '#FFF',
                    border: zoomScale > 1 ? '1px solid rgba(96, 165, 250, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  className="hover:bg-white/30 hover:scale-110 active:scale-95"
                >
                  <Eye size={16} />
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
