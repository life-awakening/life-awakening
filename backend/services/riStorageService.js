const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let customS3Client = null;

/**
 * Resolve S3 Client configuration.
 * Prefers the EC2 IAM role / default credential provider chain.
 * Falls back to explicit environment credentials only if provided.
 */
const getS3Config = () => {
  const region = process.env.RI_AWS_REGION || process.env.AWS_REGION || 'ap-south-1';
  const bucketName = process.env.RI_AWS_BUCKET_NAME || process.env.AWS_BUCKET_NAME || 'life-awakening-media-2026';

  if (customS3Client) {
    return { s3Client: customS3Client, region, bucketName };
  }

  const s3ClientConfig = { region };

  // Only attach explicit credentials if explicitly provided in environment;
  // otherwise AWS SDK automatically uses EC2 Instance Profile IAM role.
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    s3ClientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
    if (process.env.AWS_SESSION_TOKEN) {
      s3ClientConfig.credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
    }
  }

  const s3Client = new S3Client(s3ClientConfig);
  return { s3Client, region, bucketName };
};

/**
 * Validate binary file buffer signatures (magic numbers) to prevent
 * disguised or malicious file uploads.
 */
function validateFileBuffer(buffer, category) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { valid: false, error: 'Empty or invalid file payload.' };
  }

  if (category === 'problem_identification' || category === 'document') {
    // 1. PDF: %PDF (25 50 44 46)
    const isPdf = buffer.length >= 4 &&
      buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

    // 2. DOCX (ZIP container): PK\x03\x04 (50 4B 03 04)
    const isZipOrDocx = buffer.length >= 4 &&
      buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;

    // 3. Legacy DOC (OLE Compound File): D0 CF 11 E0 A1 B1 1A E1
    const isOleDoc = buffer.length >= 8 &&
      buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0 &&
      buffer[4] === 0xA1 && buffer[5] === 0xB1 && buffer[6] === 0x1A && buffer[7] === 0xE1;

    if (isPdf || isZipOrDocx || isOleDoc) {
      return { valid: true, detectedType: isPdf ? 'pdf' : isZipOrDocx ? 'docx' : 'doc' };
    }
    return { valid: false, error: 'File content does not match allowed document types (PDF, DOC, DOCX).' };
  }

  if (['photo', 'institutional_visit', 'daily_activity', 'community_project'].includes(category)) {
    // 1. JPEG: FF D8 FF
    const isJpeg = buffer.length >= 3 &&
      buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

    // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPng = buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;

    // 3. WebP: RIFF at 0, WEBP at 8
    const isWebP = buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

    if (isJpeg || isPng || isWebP) {
      return { valid: true, detectedType: isJpeg ? 'jpeg' : isPng ? 'png' : 'webp' };
    }
    return { valid: false, error: 'File content does not match allowed image types (JPG, JPEG, PNG, WEBP).' };
  }

  return { valid: false, error: 'Invalid validation category specified.' };
}

/**
 * Generate a safe, collision-resistant object key for S3.
 */
function generateStorageKey(category, studentId, batchId, panelId, originalName) {
  const ext = (path.extname(originalName) || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  const safeBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) || 'file';
  return `ri_student_uploads/${category}/b${batchId || 0}/p${panelId || 0}/s${studentId || 0}/ri_${timestamp}_${randomSuffix}_${safeBase}${ext}`;
}

/**
 * Main upload handler for RI student files.
 */
async function uploadStudentFile({
  fileBuffer,
  originalName,
  mimeType,
  category,
  studentId,
  batchId,
  panelId
}) {
  // 1. Content validation via binary magic numbers
  const validation = validateFileBuffer(fileBuffer, category);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.code = 'INVALID_FILE_CONTENT';
    throw err;
  }

  // 2. Determine storage target (default is s3 for all new uploads)
  const storageType = customS3Client ? 's3' : (process.env.RI_STORAGE_TYPE || 's3');

  if (storageType === 's3') {
    const { s3Client, bucketName } = getS3Config();
    if (!bucketName) {
      const err = new Error('AWS S3 bucket is not configured. Set AWS_BUCKET_NAME or RI_AWS_BUCKET_NAME in environment.');
      err.code = 'S3_BUCKET_NOT_CONFIGURED';
      throw err;
    }

    const storageKey = generateStorageKey(category, studentId, batchId, panelId, originalName);

    const safeFilenameHeader = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
      Body: fileBuffer,
      ContentType: mimeType || 'application/octet-stream',
      ServerSideEncryption: 'AES256',
      Metadata: {
        'original-filename': encodeURIComponent(safeFilenameHeader),
        'category': String(category),
        'student-id': String(studentId || 0),
        'batch-id': String(batchId || 0),
        'panel-id': String(panelId || 0)
      }
    });

    await s3Client.send(putCommand);

    return {
      storageProvider: 's3',
      storageKey,
      url: `/api/ri/student/files/view?key=${encodeURIComponent(storageKey)}`,
      fileName: originalName,
      fileSize: fileBuffer.length,
      mimeType
    };
  }

  // Local fallback (Only active when RI_STORAGE_TYPE is explicitly configured to 'local' for offline dev)
  const uploadsDir = path.join(__dirname, '..', 'uploads', 'ri_student_files');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const ext = path.extname(originalName).toLowerCase();
  const cleanBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const localFileName = `ri_${Date.now()}_${cleanBase || 'upload'}${ext}`;
  const localPath = path.join(uploadsDir, localFileName);

  await fs.promises.writeFile(localPath, fileBuffer);

  return {
    storageProvider: 'local',
    storageKey: localFileName,
    url: `/api/uploads/ri_student_files/${localFileName}`,
    fileName: originalName,
    fileSize: fileBuffer.length,
    mimeType
  };
}

/**
 * Stream an S3 object body for secure authorized proxy serving.
 */
async function getObjectStream(storageKey) {
  const { s3Client, bucketName } = getS3Config();
  if (!bucketName) {
    const err = new Error('AWS S3 bucket not configured. Set AWS_BUCKET_NAME or RI_AWS_BUCKET_NAME in environment.');
    err.code = 'S3_BUCKET_NOT_CONFIGURED';
    throw err;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: storageKey
  });

  const response = await s3Client.send(command);
  return {
    Body: response.Body,
    ContentType: response.ContentType,
    ContentLength: response.ContentLength,
    ETag: response.ETag,
    Metadata: response.Metadata
  };
}

/**
 * Delete a student file from S3 or legacy EC2 local storage.
 * Consistently identifies S3 objects under ri_student_uploads/ regardless of
 * whether RI_AWS_BUCKET_NAME or RI_STORAGE_TYPE are set.
 * Never deletes a local file when given an S3 object key.
 */
async function deleteStudentFile(storageKey) {
  if (!storageKey || typeof storageKey !== 'string') return false;

  let cleanKey = storageKey.trim();
  if (cleanKey.includes('/api/ri/student/files/view') && cleanKey.includes('key=')) {
    try {
      const match = cleanKey.match(/[?&]key=([^&]+)/);
      if (match && match[1]) {
        cleanKey = decodeURIComponent(match[1]);
      }
    } catch {
      /* ignore */
    }
  }

  // 1. S3 Objects: Any key under ri_student_uploads/ is unequivocally an S3 object
  if (cleanKey.startsWith('ri_student_uploads/')) {
    const { s3Client, bucketName } = getS3Config();
    if (!bucketName) return false;

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: cleanKey
    });
    await s3Client.send(command);
    return true;
  }

  // 2. Legacy Local EC2 files: Only non-S3 keys can be resolved against local disk
  const baseName = path.basename(cleanKey);
  if (!baseName || baseName.includes('..') || baseName.includes('/') || baseName.includes('\\')) {
    return false;
  }

  const localPath = path.join(__dirname, '..', 'uploads', 'ri_student_files', baseName);
  if (fs.existsSync(localPath)) {
    await fs.promises.unlink(localPath);
    return true;
  }
  return false;
}

/**
 * Validate binary file buffer signatures and content types for faculty uploads.
 * Rejects extension spoofing, verifies format magic bytes, matches claimed extensions,
 * validates MIME types, and specifically checks Word container structure for DOCX.
 */
function validateFacultyFileBuffer(buffer, category, originalName = '', mimeType = '') {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { valid: false, error: 'Empty or invalid file payload.' };
  }

  const cat = String(category || '').toLowerCase();
  const ext = (path.extname(originalName) || '').toLowerCase();
  const normMime = String(mimeType || '').toLowerCase().trim();

  // Helper: check standard image signatures
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;
  const isWebP = buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

  // 1. Photos (JPG, JPEG, PNG, WEBP)
  if (cat === 'photo' || cat === 'photos') {
    let detectedType = null;
    if (isJpeg) detectedType = 'jpeg';
    else if (isPng) detectedType = 'png';
    else if (isWebP) detectedType = 'webp';

    if (!detectedType) {
      return { valid: false, error: 'File content does not match allowed image types (JPG, JPEG, PNG, WEBP).' };
    }

    // Verify extension matches actual detected image type
    if (detectedType === 'jpeg' && !['.jpg', '.jpeg'].includes(ext)) {
      return { valid: false, error: `File extension '${ext}' does not match detected image format (JPEG).` };
    }
    if (detectedType === 'png' && ext !== '.png') {
      return { valid: false, error: `File extension '${ext}' does not match detected image format (PNG).` };
    }
    if (detectedType === 'webp' && ext !== '.webp') {
      return { valid: false, error: `File extension '${ext}' does not match detected image format (WEBP).` };
    }

    // Verify MIME type if provided and not generic octet-stream
    if (normMime && normMime !== 'application/octet-stream') {
      if (detectedType === 'jpeg' && !['image/jpeg', 'image/jpg', 'image/pjpeg'].includes(normMime)) {
        return { valid: false, error: `MIME type '${mimeType}' does not match detected image format (JPEG).` };
      }
      if (detectedType === 'png' && normMime !== 'image/png') {
        return { valid: false, error: `MIME type '${mimeType}' does not match detected image format (PNG).` };
      }
      if (detectedType === 'webp' && normMime !== 'image/webp') {
        return { valid: false, error: `MIME type '${mimeType}' does not match detected image format (WEBP).` };
      }
    }

    return { valid: true, detectedType };
  }

  // 2. Gram Panchayat Certificates (PDF, DOC, DOCX, JPG, PNG, WEBP)
  if (['gram_panchayat_certificate', 'certificate', 'certificates'].includes(cat)) {
    const isPdf = buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    const isOleDoc = buffer.length >= 8 && buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0 &&
      buffer[4] === 0xA1 && buffer[5] === 0xB1 && buffer[6] === 0x1A && buffer[7] === 0xE1;
    const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
    // WordprocessingML DOCX requirement: Must be a ZIP container AND contain word/ and [Content_Types].xml
    // Rejects arbitrary ZIPs, JARs, or malicious payloads packaged in ZIP containers.
    const isDocx = isZip && buffer.includes('word/') && buffer.includes('[Content_Types].xml');

    let detectedType = null;
    if (isPdf) detectedType = 'pdf';
    else if (isDocx) detectedType = 'docx';
    else if (isOleDoc) detectedType = 'doc';
    else if (isJpeg) detectedType = 'jpeg';
    else if (isPng) detectedType = 'png';
    else if (isWebP) detectedType = 'webp';

    if (!detectedType) {
      if (isZip && !isDocx) {
        return { valid: false, error: 'ZIP archives that are not valid DOCX documents are not allowed.' };
      }
      return { valid: false, error: 'File content does not match allowed certificate types (PDF, DOC, DOCX, JPG, PNG, WEBP).' };
    }

    // Verify extension matches actual detected type
    if (detectedType === 'pdf' && ext !== '.pdf') {
      return { valid: false, error: `File extension '${ext}' does not match detected format (PDF).` };
    }
    if (detectedType === 'docx' && ext !== '.docx') {
      return { valid: false, error: `File extension '${ext}' does not match detected format (DOCX).` };
    }
    if (detectedType === 'doc' && ext !== '.doc') {
      return { valid: false, error: `File extension '${ext}' does not match detected format (DOC).` };
    }
    if (detectedType === 'jpeg' && !['.jpg', '.jpeg'].includes(ext)) {
      return { valid: false, error: `File extension '${ext}' does not match detected image format (JPEG).` };
    }
    if (detectedType === 'png' && ext !== '.png') {
      return { valid: false, error: `File extension '${ext}' does not match detected image format (PNG).` };
    }
    if (detectedType === 'webp' && ext !== '.webp') {
      return { valid: false, error: `File extension '${ext}' does not match detected image format (WEBP).` };
    }

    // Verify MIME type if provided and not generic octet-stream
    if (normMime && normMime !== 'application/octet-stream') {
      if (detectedType === 'pdf' && !['application/pdf', 'application/x-pdf'].includes(normMime)) {
        return { valid: false, error: `MIME type '${mimeType}' does not match detected format (PDF).` };
      }
      if (detectedType === 'docx' && !['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/zip', 'application/x-zip-compressed'].includes(normMime)) {
        return { valid: false, error: `MIME type '${mimeType}' does not match detected format (DOCX).` };
      }
      if (detectedType === 'doc' && !['application/msword', 'application/doc'].includes(normMime)) {
        return { valid: false, error: `MIME type '${mimeType}' does not match detected format (DOC).` };
      }
      if (detectedType === 'jpeg' && !['image/jpeg', 'image/jpg', 'image/pjpeg'].includes(normMime)) {
        return { valid: false, error: `MIME type '${mimeType}' does not match detected image format (JPEG).` };
      }
      if (detectedType === 'png' && normMime !== 'image/png') {
        return { valid: false, error: `MIME type '${mimeType}' does not match detected image format (PNG).` };
      }
      if (detectedType === 'webp' && normMime !== 'image/webp') {
        return { valid: false, error: `MIME type '${mimeType}' does not match detected image format (WEBP).` };
      }
    }

    return { valid: true, detectedType };
  }

  // 3. Stakeholder Feedback Video (MP4, MOV, WEBM, M4V, 3GP, AVI, MKV)
  // Note: Magic-byte and container header validation ensures structural format compliance,
  // but does not guarantee that video content is completely free of malicious codecs or payloads;
  // downstream transcoding or isolated playback environments provide defense in depth.
  if (['stakeholder_feedback', 'stakeholder_feedback_video', 'feedback_videos', 'feedback_video', 'video'].includes(cat)) {
    let detectedVideo = null;

    // AVI: 'RIFF'....'AVI ' or 'AVIX'
    if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x41 && buffer[9] === 0x56 && buffer[10] === 0x49 && (buffer[11] === 0x20 || buffer[11] === 0x58)) {
      detectedVideo = 'avi';
    }
    // Matroska / WebM: EBML ID 1A 45 DF A3
    else if (buffer.length >= 12 && buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
      const headerSnippet = buffer.slice(0, Math.min(buffer.length, 128)).toString('binary');
      detectedVideo = headerSnippet.includes('webm') ? 'webm' : 'mkv';
    }
    // ISO BMFF / QuickTime (MP4, MOV, 3GP, M4V)
    else if (buffer.length >= 12) {
      const boxType = buffer.slice(4, 8).toString('ascii');
      if (boxType === 'ftyp') {
        const brand = buffer.slice(8, 12).toString('ascii');
        if (brand.startsWith('3gp') || brand.startsWith('3g2')) {
          detectedVideo = '3gp';
        } else if (brand.startsWith('qt')) {
          detectedVideo = 'mov';
        } else if (brand.startsWith('M4V')) {
          detectedVideo = 'm4v';
        } else {
          detectedVideo = 'mp4';
        }
      } else if (['moov', 'mdat', 'wide', 'skip', 'free'].includes(boxType)) {
        detectedVideo = 'mov';
      }
    }

    if (!detectedVideo) {
      return { valid: false, error: 'File content does not match allowed video formats (MP4, MOV, WEBM, 3GP, MKV, AVI).' };
    }

    // Verify extension matches detected video type
    const allowedVideoExts = ['.mp4', '.mov', '.webm', '.m4v', '.3gp', '.avi', '.mkv'];
    if (!allowedVideoExts.includes(ext)) {
      return { valid: false, error: `File extension '${ext}' is not an allowed video extension.` };
    }

    if (detectedVideo === 'mp4' && !['.mp4', '.m4v'].includes(ext)) {
      return { valid: false, error: `File extension '${ext}' does not match detected MP4 container.` };
    }
    if (detectedVideo === 'm4v' && !['.m4v', '.mp4'].includes(ext)) {
      return { valid: false, error: `File extension '${ext}' does not match detected M4V video.` };
    }
    if (detectedVideo === 'mov' && !['.mov', '.mp4'].includes(ext)) {
      return { valid: false, error: `File extension '${ext}' does not match detected MOV video.` };
    }
    if (detectedVideo === '3gp' && !['.3gp', '.mp4'].includes(ext)) {
      return { valid: false, error: `File extension '${ext}' does not match detected 3GP video.` };
    }
    if (detectedVideo === 'webm' && ext !== '.webm') {
      return { valid: false, error: `File extension '${ext}' does not match detected WEBM video.` };
    }
    if (detectedVideo === 'mkv' && !['.mkv', '.webm'].includes(ext)) {
      return { valid: false, error: `File extension '${ext}' does not match detected MKV video.` };
    }
    if (detectedVideo === 'avi' && ext !== '.avi') {
      return { valid: false, error: `File extension '${ext}' does not match detected AVI video.` };
    }

    // Verify MIME type if provided and not generic octet-stream
    if (normMime && normMime !== 'application/octet-stream') {
      if (!normMime.startsWith('video/')) {
        return { valid: false, error: `MIME type '${mimeType}' is not an allowed video MIME type.` };
      }
    }

    return { valid: true, detectedType: detectedVideo };
  }

  return { valid: false, error: `Unsupported upload category: ${category}` };
}

/**
 * Resolve canonical S3 folder prefix for faculty uploads based on category.
 * Strict adherence to requirements:
 * - photos: ri_faculty_uploads/photos/
 * - certificates: ri_faculty_uploads/certificates/
 * - feedback videos: ri_faculty_uploads/feedback_videos/
 */
function getFacultyCategoryPrefix(category) {
  const cat = String(category || '').toLowerCase();
  if (['gram_panchayat_certificate', 'certificate', 'certificates'].includes(cat)) {
    return 'ri_faculty_uploads/certificates/';
  }
  if (['stakeholder_feedback', 'stakeholder_feedback_video', 'feedback_videos', 'feedback_video', 'video'].includes(cat)) {
    return 'ri_faculty_uploads/feedback_videos/';
  }
  return 'ri_faculty_uploads/photos/';
}

/**
 * Generate a safe, collision-resistant object key for faculty uploads in S3.
 */
function generateFacultyStorageKey(category, batchId, panelId, originalName) {
  const prefix = getFacultyCategoryPrefix(category);
  const ext = (path.extname(originalName) || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  const safeBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) || 'file';
  return `${prefix}b${batchId || 0}/p${panelId || 0}/ri_${timestamp}_${randomSuffix}_${safeBase}${ext}`;
}

/**
 * Upload a new faculty file to S3.
 * Guarantees that only NEW uploads reach S3 under the correct prefix.
 */
async function uploadFacultyFile({
  fileBuffer,
  originalName,
  mimeType,
  category,
  batchId,
  panelId
}) {
  const validation = validateFacultyFileBuffer(fileBuffer, category, originalName, mimeType);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.code = 'INVALID_FILE_CONTENT';
    throw err;
  }

  const { s3Client, bucketName } = getS3Config();
  if (!bucketName) {
    const err = new Error('AWS S3 bucket is not configured. Set AWS_BUCKET_NAME or RI_AWS_BUCKET_NAME in environment.');
    err.code = 'S3_BUCKET_NOT_CONFIGURED';
    throw err;
  }

  const storageKey = generateFacultyStorageKey(category, batchId, panelId, originalName);
  const safeFilenameHeader = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');

  const putCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
    Body: fileBuffer,
    ContentType: mimeType || 'application/octet-stream',
    ServerSideEncryption: 'AES256',
    Metadata: {
      'original-filename': encodeURIComponent(safeFilenameHeader),
      'category': String(category),
      'batch-id': String(batchId || 0),
      'panel-id': String(panelId || 0)
    }
  });

  await s3Client.send(putCommand);

  return {
    storageProvider: 's3',
    storageKey,
    url: `/api/ri/faculty/files/view?key=${encodeURIComponent(storageKey)}`,
    fileName: originalName,
    fileSize: fileBuffer.length,
    mimeType
  };
}

/**
 * Check if a file reference corresponds to an S3 faculty upload.
 */
function isS3FacultyReference(fileRef) {
  if (!fileRef || typeof fileRef !== 'string') return false;
  const clean = fileRef.trim();
  if (clean.startsWith('ri_faculty_uploads/')) return true;
  if (clean.includes('key=')) {
    const match = clean.match(/[?&]key=([^&]+)/);
    if (match && decodeURIComponent(match[1]).startsWith('ri_faculty_uploads/')) {
      return true;
    }
  }
  return false;
}

/**
 * Extract clean S3 object key from an S3 reference.
 */
function extractFacultyStorageKey(fileRef) {
  if (!fileRef || typeof fileRef !== 'string') return null;
  let clean = fileRef.trim();
  if (clean.includes('key=')) {
    const match = clean.match(/[?&]key=([^&]+)/);
    if (match && match[1]) {
      clean = decodeURIComponent(match[1]);
    }
  }
  if (clean.includes('.amazonaws.com/')) {
    clean = clean.split('.amazonaws.com/')[1];
  }
  if (clean.startsWith('ri_faculty_uploads/')) {
    return clean;
  }
  return null;
}

/**
 * Check if a file reference corresponds to a legacy local file on EC2.
 */
function isLegacyLocalFacultyReference(fileRef) {
  if (!fileRef || typeof fileRef !== 'string') return false;
  const clean = fileRef.trim();
  if (isS3FacultyReference(clean)) return false;
  return clean.startsWith('/uploads/ri_media/') || clean.startsWith('uploads/ri_media/');
}

/**
 * Delete a faculty file from S3.
 * STRICT SAFETY RULE:
 * - Only keys starting with ri_faculty_uploads/ are processed.
 * - NEVER pass a legacy local path to the S3 deletion service!
 */
async function deleteFacultyFile(storageKey) {
  if (!storageKey || typeof storageKey !== 'string') return false;

  const cleanKey = extractFacultyStorageKey(storageKey) || (storageKey.trim().startsWith('ri_faculty_uploads/') ? storageKey.trim() : null);

  // If not an S3 key under ri_faculty_uploads/, refuse immediately without touching AWS
  if (!cleanKey || !cleanKey.startsWith('ri_faculty_uploads/')) {
    return false;
  }

  const { s3Client, bucketName } = getS3Config();
  if (!bucketName) return false;

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cleanKey
  });
  await s3Client.send(command);
  return true;
}

/**
 * Helpers for testing and dependency injection.
 */
function setMockS3Client(mock) {
  customS3Client = mock;
}

function resetMockS3Client() {
  customS3Client = null;
}

module.exports = {
  uploadStudentFile,
  getObjectStream,
  deleteStudentFile,
  validateFileBuffer,
  generateStorageKey,
  getS3Config,
  setMockS3Client,
  resetMockS3Client,
  // Faculty S3 methods
  uploadFacultyFile,
  deleteFacultyFile,
  generateFacultyStorageKey,
  getFacultyCategoryPrefix,
  validateFacultyFileBuffer,
  isS3FacultyReference,
  extractFacultyStorageKey,
  isLegacyLocalFacultyReference
};
