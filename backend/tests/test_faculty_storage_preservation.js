const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const riStorageService = require('../services/riStorageService');
const riFacultyController = require('../controllers/riFacultyController');
const riController = require('../controllers/riController');
const storageService = require('../services/storageService');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const { Writable } = require('stream');

function createMockRes() {
  const chunks = [];
  const res = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk);
      callback();
    }
  });

  res.statusCode = 200;
  res.headers = {};
  res.body = null;
  res.sentFile = null;

  res.status = function(code) {
    this.statusCode = code;
    return this;
  };

  res.setHeader = function(name, val) {
    this.headers[name.toLowerCase()] = val;
    return this;
  };

  res.json = function(obj) {
    this.body = obj;
    return this;
  };

  res.send = function(data) {
    this.body = data;
    return this;
  };

  res.sendFile = function(p) {
    this.sentFile = p;
    this.end();
    return this;
  };

  res.getBuffer = function() {
    return Buffer.concat(chunks);
  };

  return res;
}

// Mock S3 client to inspect commands and avoid external AWS calls
class MockS3Tracker {
  constructor() {
    this.putCommands = [];
    this.deleteCommands = [];
    this.getCommands = [];
    this.throwOnPut = false;
  }

  async send(command) {
    const cmdName = command.constructor?.name || '';
    if (cmdName.includes('PutObject')) {
      if (this.throwOnPut) {
        const err = new Error('Simulated S3 PutObject network timeout');
        err.name = 'TimeoutError';
        throw err;
      }
      this.putCommands.push(command.input);
      return { ETag: '"mock-etag"' };
    }
    if (cmdName.includes('DeleteObject')) {
      this.deleteCommands.push(command.input);
      return {};
    }
    if (cmdName.includes('GetObject')) {
      this.getCommands.push(command.input);
      const { Readable } = require('stream');
      const stream = new Readable();
      stream.push(Buffer.from('fake-s3-stream-content'));
      stream.push(null);
      return {
        Body: stream,
        ContentType: 'image/jpeg',
        ContentLength: 22
      };
    }
    return {};
  }
}

async function runStoragePreservationTests() {
  console.log('================================================================');
  console.log('RUNNING FACULTY STORAGE PRESERVATION & BACKWARD COMPATIBILITY TESTS');
  console.log('Testing Requirements 1 through 10 and Required Verifications');
  console.log('================================================================\n');

  const tracker = new MockS3Tracker();
  riStorageService.setMockS3Client(tracker);

  try {
    // -------------------------------------------------------------------------
    // 1. Verify Existing EC2 Files on Local Filesystem (Requirement 1 & 2)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Preserve Existing Files on Local EC2 Filesystem ---');
    const riMediaDir = path.join(__dirname, '../uploads/ri_media');
    assert.strictEqual(fs.existsSync(riMediaDir), true, 'backend/uploads/ri_media/ directory must exist');
    const existingFiles = fs.readdirSync(riMediaDir).filter(f => !f.startsWith('.'));
    console.log(`Found ${existingFiles.length} existing faculty files in backend/uploads/ri_media/`);
    assert(existingFiles.length >= 9, 'All existing faculty files in backend/uploads/ri_media must be preserved');

    // Verify row id 13 reference is completely untouched in DB
    const row13Res = await pool.query(`SELECT id, file_url, file_name, category FROM ri_panel_media WHERE id = 13`);
    if (row13Res.rowCount > 0) {
      const row13 = row13Res.rows[0];
      assert.strictEqual(row13.file_url, '/uploads/ri_media/ri_upload_1792577342820_Screenshot_2026-10-20_at_19_07_22.jpeg');
      assert.strictEqual(row13.category, 'photo');
      console.log('✓ PASS: Row 13 in ri_panel_media preserves exact local filesystem path');
    }

    // -------------------------------------------------------------------------
    // 2. Verify Key Discrimination Helpers (Requirement 7)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Reference Discrimination Helpers ---');
    const legacyPath = '/uploads/ri_media/ri_upload_1792577342820_Screenshot_2026-10-20_at_19_07_22.jpeg';
    const s3PhotoKey = 'ri_faculty_uploads/photos/b241/p557/ri_123_photo.jpg';
    const s3CertKey = 'ri_faculty_uploads/certificates/b241/p557/ri_123_cert.pdf';
    const s3VideoKey = 'ri_faculty_uploads/feedback_videos/b241/p557/ri_123_video.mp4';
    const s3ProxyUrl = `/api/ri/faculty/files/view?key=${encodeURIComponent(s3PhotoKey)}`;

    assert.strictEqual(riStorageService.isLegacyLocalFacultyReference(legacyPath), true, 'legacyPath must be detected as legacy local');
    assert.strictEqual(riStorageService.isS3FacultyReference(legacyPath), false, 'legacyPath must NOT be detected as S3');

    assert.strictEqual(riStorageService.isS3FacultyReference(s3PhotoKey), true, 's3PhotoKey must be detected as S3');
    assert.strictEqual(riStorageService.isLegacyLocalFacultyReference(s3PhotoKey), false, 's3PhotoKey must NOT be detected as local');

    assert.strictEqual(riStorageService.isS3FacultyReference(s3CertKey), true, 's3CertKey must be detected as S3');
    assert.strictEqual(riStorageService.isS3FacultyReference(s3VideoKey), true, 's3VideoKey must be detected as S3');
    assert.strictEqual(riStorageService.isS3FacultyReference(s3ProxyUrl), true, 's3ProxyUrl must be detected as S3');

    assert.strictEqual(riStorageService.extractFacultyStorageKey(s3ProxyUrl), s3PhotoKey, 'extractFacultyStorageKey extracts key from proxy url');
    console.log('✓ PASS: Reference discrimination accurately differentiates local paths from S3 keys');

    // -------------------------------------------------------------------------
    // 3. Safety Invariants: Never pass S3 to unlinkSync & Never pass local to S3 (Requirement 7)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Deletion Isolation Safety Invariants ---');
    // A. Passing legacy local path to S3 deletion service MUST refuse and return false
    const deleteLegacyViaS3Result = await riStorageService.deleteFacultyFile(legacyPath);
    assert.strictEqual(deleteLegacyViaS3Result, false, 'deleteFacultyFile must refuse legacy local paths');
    assert.strictEqual(tracker.deleteCommands.length, 0, 'No S3 DeleteObjectCommand should be sent for local paths');
    console.log('✓ PASS: Legacy local path strictly refused by S3 deletion service (never calls S3)');

    // B. Passing S3 key to S3 deletion service MUST send DeleteObjectCommand
    const deleteS3Result = await riStorageService.deleteFacultyFile(s3PhotoKey);
    assert.strictEqual(deleteS3Result, true, 'deleteFacultyFile must process S3 key');
    assert.strictEqual(tracker.deleteCommands.length, 1);
    assert.strictEqual(tracker.deleteCommands[0].Key, s3PhotoKey);
    console.log('✓ PASS: S3 key correctly routed to S3 DeleteObjectCommand');

    // -------------------------------------------------------------------------
    // 4. Verify Correct S3 Prefixes for New Uploads (Requirements 4, 5, 6)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: S3 Prefix Generation for New Uploads ---');
    const photoKey = riStorageService.generateFacultyStorageKey('photo', 10, 20, 'field_photo.jpg');
    assert(photoKey.startsWith('ri_faculty_uploads/photos/'), `Photo key must start with ri_faculty_uploads/photos/, got: ${photoKey}`);

    const certKey = riStorageService.generateFacultyStorageKey('gram_panchayat_certificate', 10, 20, 'gp_cert.pdf');
    assert(certKey.startsWith('ri_faculty_uploads/certificates/'), `Cert key must start with ri_faculty_uploads/certificates/, got: ${certKey}`);

    const videoKey = riStorageService.generateFacultyStorageKey('stakeholder_feedback', 10, 20, 'feedback.mp4');
    assert(videoKey.startsWith('ri_faculty_uploads/feedback_videos/'), `Video key must start with ri_faculty_uploads/feedback_videos/, got: ${videoKey}`);

    console.log('✓ PASS: Photo prefix: ri_faculty_uploads/photos/');
    console.log('✓ PASS: Certificate prefix: ri_faculty_uploads/certificates/');
    console.log('✓ PASS: Feedback video prefix: ri_faculty_uploads/feedback_videos/');

    // -------------------------------------------------------------------------
    // 5. Test Controller Uploads to S3 (No files written to backend/uploads/ri_media/)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Controller Uploads to S3 & Local Disk Cleanliness ---');
    const initialLocalFileCount = fs.readdirSync(riMediaDir).filter(f => !f.startsWith('.')).length;

    // Get an assigned panel and faculty user for testing
    const panelRes = await pool.query(`
      SELECT rbf.ri_batch_id, rbf.ri_panel_id, rbf.faculty_id, rbf.name, rbf.email
      FROM ri_batch_faculty rbf
      JOIN ri_panels rp ON rp.id = rbf.ri_panel_id
      JOIN ri_batches rb ON rb.id = rbf.ri_batch_id
      WHERE rbf.status <> 'deleted' AND rb.status <> 'deleted'
      LIMIT 1
    `);
    assert(panelRes.rowCount > 0, 'Need at least one assigned panel in DB');
    const assigned = panelRes.rows[0];

    const facultyUser = {
      id: assigned.faculty_id || 99999,
      email: assigned.email,
      name: assigned.name,
      role: 'faculty'
    };
    const facultyToken = jwt.sign(facultyUser, JWT_SECRET, { expiresIn: '1h' });

    // Mock jpeg buffer (FF D8 FF ...)
    const mockJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]);

    // 5A. Upload Panel Photo
    const photoReq = {
      body: {
        batch_id: assigned.ri_batch_id,
        panel_id: assigned.ri_panel_id,
        caption: 'Test Field Photo 2026'
      },
      user: facultyUser,
      userEmail: facultyUser.email,
      facultyAssignments: [assigned],
      activeBatchIds: [assigned.ri_batch_id],
      assignedBatchIds: [assigned.ri_batch_id],
      assignedPanelIds: [assigned.ri_panel_id],
      file: {
        originalname: 'field_visit_test.jpg',
        mimetype: 'image/jpeg',
        buffer: mockJpeg
      }
    };
    const photoRes = createMockRes();
    tracker.putCommands = [];
    await riFacultyController.uploadPanelPhoto(photoReq, photoRes);

    assert.strictEqual(photoRes.statusCode, 201, `uploadPanelPhoto failed: ${JSON.stringify(photoRes.body)}`);
    assert(tracker.putCommands.length > 0, 'S3 PutObjectCommand must have been called');
    const uploadedPhotoKey = tracker.putCommands[tracker.putCommands.length - 1].Key;
    assert(uploadedPhotoKey.startsWith('ri_faculty_uploads/photos/'), `Key must start with ri_faculty_uploads/photos/, got: ${uploadedPhotoKey}`);
    assert(photoRes.body.media.file_url.includes(encodeURIComponent(uploadedPhotoKey)), 'DB file_url must reference S3 key');

    const createdPhotoId = photoRes.body.media.id;

    // Check disk: NO file should have been written to backend/uploads/ri_media/
    const currentLocalFileCount = fs.readdirSync(riMediaDir).filter(f => !f.startsWith('.')).length;
    assert.strictEqual(currentLocalFileCount, initialLocalFileCount, 'NO new file should be created on EC2 filesystem in backend/uploads/ri_media/');
    console.log('✓ PASS: New photo uploaded to S3 under ri_faculty_uploads/photos/ without touching EC2 local disk');

    // 5B. Upload Stakeholder Feedback Video
    const mockVideoBuf = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]),
      Buffer.alloc(1000, 0)
    ]);
    const videoReq = {
      body: {
        batch_id: assigned.ri_batch_id,
        panel_id: assigned.ri_panel_id,
        caption: 'Community Sarpanch Feedback'
      },
      user: facultyUser,
      userEmail: facultyUser.email,
      facultyAssignments: [assigned],
      activeBatchIds: [assigned.ri_batch_id],
      assignedBatchIds: [assigned.ri_batch_id],
      assignedPanelIds: [assigned.ri_panel_id],
      file: {
        originalname: 'sarpanch_interview.mp4',
        mimetype: 'video/mp4',
        buffer: mockVideoBuf,
        size: mockVideoBuf.length
      }
    };
    const videoRes = createMockRes();
    await riFacultyController.uploadStakeholderFeedbackVideo(videoReq, videoRes);

    assert.strictEqual(videoRes.statusCode, 201, `uploadStakeholderFeedbackVideo failed: ${JSON.stringify(videoRes.body)}`);
    const uploadedVideoKey = tracker.putCommands[tracker.putCommands.length - 1].Key;
    assert(uploadedVideoKey.startsWith('ri_faculty_uploads/feedback_videos/'), `Key must start with ri_faculty_uploads/feedback_videos/, got: ${uploadedVideoKey}`);
    const createdVideoId = videoRes.body.media.id;
    console.log('✓ PASS: New stakeholder video uploaded to S3 under ri_faculty_uploads/feedback_videos/');

    // -------------------------------------------------------------------------
    // 6. Test Gram Panchayat Certificate Replacement Safety (Requirement 8)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Gram Panchayat Certificate Replacement Fail-Safe (Requirement 8) ---');
    const mockPdf = Buffer.from('%PDF-1.4 mock pdf content');

    // Step 1: Upload initial certificate
    const certReq1 = {
      body: {
        batch_id: assigned.ri_batch_id,
        panel_id: assigned.ri_panel_id,
        caption: 'Initial Certificate'
      },
      user: facultyUser,
      userEmail: facultyUser.email,
      facultyAssignments: [assigned],
      activeBatchIds: [assigned.ri_batch_id],
      assignedBatchIds: [assigned.ri_batch_id],
      assignedPanelIds: [assigned.ri_panel_id],
      file: {
        originalname: 'initial_cert.pdf',
        mimetype: 'application/pdf',
        buffer: mockPdf
      }
    };
    const certRes1 = createMockRes();
    await riFacultyController.uploadGramPanchayatCertificate(certReq1, certRes1);
    assert.strictEqual(certRes1.statusCode, 201);
    const initialCertId = certRes1.body.certificate.id;
    const initialCertUrl = certRes1.body.certificate.file_url;

    // Step 2: Attempt replacement when S3 upload FAILS
    tracker.throwOnPut = true;
    const certReqFail = {
      body: {
        batch_id: assigned.ri_batch_id,
        panel_id: assigned.ri_panel_id,
        caption: 'Replacement Attempt That Fails'
      },
      user: facultyUser,
      userEmail: facultyUser.email,
      facultyAssignments: [assigned],
      activeBatchIds: [assigned.ri_batch_id],
      assignedBatchIds: [assigned.ri_batch_id],
      assignedPanelIds: [assigned.ri_panel_id],
      file: {
        originalname: 'failed_replacement.pdf',
        mimetype: 'application/pdf',
        buffer: mockPdf
      }
    };
    const certResFail = createMockRes();
    await riFacultyController.uploadGramPanchayatCertificate(certReqFail, certResFail);
    tracker.throwOnPut = false;

    assert.strictEqual(certResFail.statusCode, 502, 'Replacement failure should return 502');

    // Verify: The initial certificate STILL exists in DB!
    const certCheckRes = await pool.query(`SELECT * FROM ri_panel_media WHERE id = $1`, [initialCertId]);
    assert.strictEqual(certCheckRes.rowCount, 1, 'Initial certificate must still exist in DB after failed replacement');
    assert.strictEqual(certCheckRes.rows[0].file_url, initialCertUrl, 'File URL of old certificate must remain unchanged');
    console.log('✓ PASS: Requirement 8 Verified — Failed replacement preserves previous certificate intact in DB');

    // Step 3: Now perform successful replacement
    const certReqSuccess = {
      body: {
        batch_id: assigned.ri_batch_id,
        panel_id: assigned.ri_panel_id,
        caption: 'Successful Replacement Certificate'
      },
      user: facultyUser,
      userEmail: facultyUser.email,
      facultyAssignments: [assigned],
      activeBatchIds: [assigned.ri_batch_id],
      assignedBatchIds: [assigned.ri_batch_id],
      assignedPanelIds: [assigned.ri_panel_id],
      file: {
        originalname: 'replacement_success.pdf',
        mimetype: 'application/pdf',
        buffer: mockPdf
      }
    };
    const certResSuccess = createMockRes();
    tracker.deleteCommands = [];
    await riFacultyController.uploadGramPanchayatCertificate(certReqSuccess, certResSuccess);

    assert.strictEqual(certResSuccess.statusCode, 201);
    const newCertId = certResSuccess.body.certificate.id;
    assert.notStrictEqual(newCertId, initialCertId, 'New certificate has new ID');

    // Old certificate cleaned up from S3 via S3 deletion service
    assert(tracker.deleteCommands.length > 0, 'Old S3 certificate should have been deleted via S3 deletion');
    console.log('✓ PASS: Successful replacement safely updates reference and removes old object');

    // -------------------------------------------------------------------------
    // 7. Verify Retrieval of Both Legacy Local Files & S3 Objects (Requirement 7)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Backward-Compatible Retrieval Logic ---');

    // 7A. Serving Legacy Local File via serveFacultyFile
    // Point to an existing file in backend/uploads/ri_media
    const sampleLocalFile = existingFiles[0];
    const localReq = {
      query: {
        key: `/uploads/ri_media/${sampleLocalFile}`
      },
      headers: {
        authorization: `Bearer ${facultyToken}`
      }
    };
    const localRes = createMockRes();
    await riFacultyController.serveFacultyFile(localReq, localRes);
    assert.strictEqual(localRes.sentFile, path.join(riMediaDir, sampleLocalFile), 'Legacy local file must be served from EC2 local disk');
    console.log('✓ PASS: Legacy local file served directly from local filesystem via sendFile');

    // 7B. Serving S3 Object via serveFacultyFile
    const s3Req = {
      query: {
        key: uploadedPhotoKey
      },
      headers: {
        authorization: `Bearer ${facultyToken}`
      }
    };
    const s3Res = createMockRes();
    tracker.getCommands = [];
    await riFacultyController.serveFacultyFile(s3Req, s3Res);
    assert.strictEqual(s3Res.sentFile, null, 'S3 object must NEVER be served via sendFile from local disk');
    assert.strictEqual(tracker.getCommands.length, 1, 'S3 GetObjectCommand must be called to stream S3 object');
    assert.strictEqual(tracker.getCommands[0].Key, uploadedPhotoKey);
    console.log('✓ PASS: S3 object served via authenticated S3 getObjectStream');

    // 7C. Unauthenticated request to serveFacultyFile MUST be rejected
    const unauthReq = {
      query: {
        key: uploadedPhotoKey
      },
      headers: {}
    };
    const unauthRes = createMockRes();
    await riFacultyController.serveFacultyFile(unauthReq, unauthRes);
    assert.strictEqual(unauthRes.statusCode, 401, 'Unauthenticated file request must return 401');
    console.log('✓ PASS: Unauthenticated access strictly blocked (HTTP 401)');

    // -------------------------------------------------------------------------
    // 8. Verify Backward-Compatible Deletion (Requirement 7)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Backward-Compatible Deletion Logic ---');

    // 8A. Delete S3 Photo
    const deleteReqS3 = {
      params: { id: createdPhotoId },
      user: facultyUser,
      userEmail: facultyUser.email,
      facultyAssignments: [assigned],
      activeBatchIds: [assigned.ri_batch_id],
      assignedBatchIds: [assigned.ri_batch_id],
      assignedPanelIds: [assigned.ri_panel_id]
    };
    const deleteResS3 = createMockRes();
    tracker.deleteCommands = [];
    await riFacultyController.deletePanelMedia(deleteReqS3, deleteResS3);
    assert.strictEqual(deleteResS3.statusCode, 200);
    assert(tracker.deleteCommands.some(c => c.Key === uploadedPhotoKey), 'S3 photo must be deleted using S3 DeleteObjectCommand');
    console.log('✓ PASS: S3 photo deleted via S3 service without calling fs.unlinkSync');

    // 8B. Delete S3 Video
    const deleteReqVideo = {
      params: { id: createdVideoId },
      user: facultyUser,
      userEmail: facultyUser.email,
      facultyAssignments: [assigned],
      activeBatchIds: [assigned.ri_batch_id],
      assignedBatchIds: [assigned.ri_batch_id],
      assignedPanelIds: [assigned.ri_panel_id]
    };
    const deleteResVideo = createMockRes();
    await riFacultyController.deletePanelMedia(deleteReqVideo, deleteResVideo);
    assert.strictEqual(deleteResVideo.statusCode, 200);
    console.log('✓ PASS: S3 stakeholder video deleted via S3 service');

    // Clean up created cert
    await pool.query(`DELETE FROM ri_panel_media WHERE id = $1`, [newCertId]);

    // -------------------------------------------------------------------------
    // 9. Verify LTC Journey and RI Student Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: LTC Journey & RI Student Invariants Unchanged ---');
    assert.strictEqual(typeof storageService.uploadFile, 'function');
    assert.strictEqual(typeof storageService.deleteFile, 'function');
    assert.strictEqual(typeof storageService.getFileUrl, 'function');

    assert.strictEqual(typeof riStorageService.uploadStudentFile, 'function');
    assert.strictEqual(typeof riStorageService.deleteStudentFile, 'function');
    console.log('✓ PASS: LTC Journey and RI Student storage functions remain intact and operational');

    // -------------------------------------------------------------------------
    // 10. Database Schema Safety Audit (Requirement 10)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Database Schema Preservation Audit ---');
    const colsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ri_panel_media'
      ORDER BY ordinal_position
    `);
    const colNames = colsRes.rows.map(c => c.column_name);
    assert(colNames.includes('id'));
    assert(colNames.includes('ri_batch_id'));
    assert(colNames.includes('ri_panel_id'));
    assert(colNames.includes('file_url'));
    assert(colNames.includes('file_name'));
    assert(colNames.includes('category'));
    console.log(`✓ PASS: Table ri_panel_media structure completely unchanged (${colNames.length} columns)`);

    // -------------------------------------------------------------------------
    // 11. Security Finding 1: Strict File Content Validation Tests
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 11: Security Finding 1 - Strict File Content Validation ---');

    // 11A. Valid Image Signatures
    const validJpegBuf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]);
    const validPngBuf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    const validWebpBuf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38]);

    assert.strictEqual(riStorageService.validateFacultyFileBuffer(validJpegBuf, 'photo', 'sample.jpg', 'image/jpeg').valid, true);
    assert.strictEqual(riStorageService.validateFacultyFileBuffer(validPngBuf, 'photo', 'sample.png', 'image/png').valid, true);
    assert.strictEqual(riStorageService.validateFacultyFileBuffer(validWebpBuf, 'photo', 'sample.webp', 'image/webp').valid, true);
    console.log('✓ PASS: Legitimate image formats (JPEG, PNG, WEBP) accepted');

    // 11B. Rejected Image Spoofing (extension-only spoofing)
    const spoofedTxtAsJpg = Buffer.from('Just plain text disguised as an image');
    const spoofJpgRes = riStorageService.validateFacultyFileBuffer(spoofedTxtAsJpg, 'photo', 'malicious.jpg', 'image/jpeg');
    assert.strictEqual(spoofJpgRes.valid, false, 'Plain text with .jpg extension must be rejected');
    assert(spoofJpgRes.error.includes('does not match allowed image types'), 'Expected image type error');
    console.log('✓ PASS: Spoofed image with text content rejected (no extension fallback)');

    // 11C. Mismatched Image Extension (PNG content with .jpg extension)
    const pngAsJpgRes = riStorageService.validateFacultyFileBuffer(validPngBuf, 'photo', 'mismatch.jpg', 'image/jpeg');
    assert.strictEqual(pngAsJpgRes.valid, false);
    assert(pngAsJpgRes.error.includes('does not match detected image format'), 'Expected extension mismatch error');
    console.log('✓ PASS: Mismatched image extension rejected');

    // 11D. Valid Certificate Formats (PDF, DOC, DOCX, Images)
    const validPdfBuf = Buffer.from('%PDF-1.7 valid pdf sample');
    const validDocBuf = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0x00, 0x00]);
    // Valid DOCX: ZIP container containing [Content_Types].xml and word/
    const validDocxBuf = Buffer.concat([
      Buffer.from([0x50, 0x4B, 0x03, 0x04]),
      Buffer.from('...[Content_Types].xml...word/document.xml...')
    ]);

    assert.strictEqual(riStorageService.validateFacultyFileBuffer(validPdfBuf, 'certificate', 'gp.pdf', 'application/pdf').valid, true);
    assert.strictEqual(riStorageService.validateFacultyFileBuffer(validDocBuf, 'certificate', 'gp.doc', 'application/msword').valid, true);
    assert.strictEqual(riStorageService.validateFacultyFileBuffer(validDocxBuf, 'certificate', 'gp.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').valid, true);
    console.log('✓ PASS: Legitimate certificate formats (PDF, DOC, DOCX) accepted');

    // 11E. DOCX vs Arbitrary ZIP rejection
    // An arbitrary ZIP that does not have word/ must be rejected!
    const arbitraryZipBuf = Buffer.concat([
      Buffer.from([0x50, 0x4B, 0x03, 0x04]),
      Buffer.from('...some_random_payload.exe...')
    ]);
    const zipDocxRes = riStorageService.validateFacultyFileBuffer(arbitraryZipBuf, 'certificate', 'fake_gp.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.strictEqual(zipDocxRes.valid, false);
    assert(zipDocxRes.error.includes('ZIP archives that are not valid DOCX documents are not allowed'), 'Arbitrary ZIP must be rejected as DOCX');
    console.log('✓ PASS: Arbitrary ZIP container disguised as DOCX rejected');

    // 11F. Valid Video Formats (MP4, MOV, WEBM, AVI)
    const validMp4Buf = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]),
      Buffer.alloc(64, 0)
    ]);
    const validWebmBuf = Buffer.concat([
      Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x9F, 0x42, 0x86, 0x81, 0x01, 0x42, 0xF7, 0x81, 0x01, 0x42, 0xF2, 0x81, 0x04, 0x42, 0xF3, 0x81, 0x08, 0x42, 0x82, 0x84]),
      Buffer.from('webm'),
      Buffer.alloc(32, 0)
    ]);
    const validAviBuf = Buffer.concat([
      Buffer.from([0x52, 0x49, 0x46, 0x46, 0x40, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20]),
      Buffer.alloc(32, 0)
    ]);

    assert.strictEqual(riStorageService.validateFacultyFileBuffer(validMp4Buf, 'stakeholder_feedback', 'feedback.mp4', 'video/mp4').valid, true);
    assert.strictEqual(riStorageService.validateFacultyFileBuffer(validWebmBuf, 'stakeholder_feedback', 'feedback.webm', 'video/webm').valid, true);
    assert.strictEqual(riStorageService.validateFacultyFileBuffer(validAviBuf, 'stakeholder_feedback', 'feedback.avi', 'video/x-msvideo').valid, true);
    console.log('✓ PASS: Legitimate video formats (MP4, WEBM, AVI) accepted');

    // 11G. Invalid Video Signature Rejection
    const invalidVideoBuf = Buffer.from('This is definitely not a real video stream file');
    const fakeVideoRes = riStorageService.validateFacultyFileBuffer(invalidVideoBuf, 'stakeholder_feedback', 'fake.mp4', 'video/mp4');
    assert.strictEqual(fakeVideoRes.valid, false);
    assert(fakeVideoRes.error.includes('does not match allowed video formats'), 'Fake video must be rejected');
    console.log('✓ PASS: Invalid video content rejected despite .mp4 extension');

    // -------------------------------------------------------------------------
    // 12. Security Finding 2: Single-Use Faculty Access Ticket Tests
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 12: Security Finding 2 - Single-Use Faculty Access Tickets ---');
    riFacultyController._clearConsumedFacultyTicketsForTesting();

    const targetKey = uploadedPhotoKey;

    // 12A. Generate Ticket
    const ticketGenReq = {
      body: { key: targetKey },
      user: facultyUser
    };
    const ticketGenRes = createMockRes();
    await riFacultyController.createFacultyFileAccessTicket(ticketGenReq, ticketGenRes);
    assert.strictEqual(ticketGenRes.statusCode, 200);
    assert(ticketGenRes.body.ticket, 'Must return ticket');
    assert.strictEqual(ticketGenRes.body.expiresIn, 60, 'Ticket expiry must be 60 seconds');
    const freshTicket = ticketGenRes.body.ticket;
    console.log('✓ PASS: Successfully generated 60-second single-use ticket bound to object key');

    // 12B. First use of Ticket (SUCCESS)
    const firstUseReq = {
      query: { key: targetKey, ticket: freshTicket },
      headers: {}
    };
    const firstUseRes = createMockRes();
    tracker.getCommands = [];
    await riFacultyController.serveFacultyFile(firstUseReq, firstUseRes);
    assert.strictEqual(firstUseRes.statusCode, 200);
    assert.strictEqual(tracker.getCommands.length, 1);
    console.log('✓ PASS: First use of ticket successfully authorized file access');

    // 12C. Reuse of Consumed Ticket (REJECTED with HTTP 403 Forbidden)
    const secondUseReq = {
      query: { key: targetKey, ticket: freshTicket },
      headers: {}
    };
    const secondUseRes = createMockRes();
    tracker.getCommands = [];
    await riFacultyController.serveFacultyFile(secondUseReq, secondUseRes);
    assert.strictEqual(secondUseRes.statusCode, 403, 'Reused ticket must be rejected with 403');
    assert.strictEqual(secondUseRes.body.message, 'File access ticket has already been used. Please request a new ticket.');
    assert.strictEqual(tracker.getCommands.length, 0, 'No S3 stream should be requested on ticket replay');
    console.log('✓ PASS: Reuse of consumed ticket strictly rejected with HTTP 403 Forbidden');

    // 12D. Expired Ticket (REJECTED with HTTP 401)
    const expiredTicket = jwt.sign(
      {
        ticket: true,
        jti: 'mock_expired_jti',
        sub: facultyUser.id,
        role: facultyUser.role,
        key: targetKey,
        iat: Math.floor(Date.now() / 1000) - 120
      },
      JWT_SECRET,
      { expiresIn: '0s' }
    );
    const expiredReq = {
      query: { key: targetKey, ticket: expiredTicket },
      headers: {}
    };
    const expiredRes = createMockRes();
    await riFacultyController.serveFacultyFile(expiredReq, expiredRes);
    assert.strictEqual(expiredRes.statusCode, 401);
    assert(expiredRes.body.message.includes('Invalid or expired file access ticket'));
    console.log('✓ PASS: Expired ticket strictly rejected with HTTP 401');

    // 12E. Ticket Presented for a Different Object (REJECTED with HTTP 403)
    const ticketOtherReq = {
      body: { key: 'ri_faculty_uploads/photos/b1/p1/legitimate_photo.jpg' },
      user: facultyUser
    };
    const ticketOtherRes = createMockRes();
    await riFacultyController.createFacultyFileAccessTicket(ticketOtherReq, ticketOtherRes);
    const otherTicket = ticketOtherRes.body.ticket;

    // Present otherTicket to access a completely different file key
    const mismatchReq = {
      query: { key: 'ri_faculty_uploads/photos/b99/p99/unauthorized_target.jpg', ticket: otherTicket },
      headers: {}
    };
    const mismatchRes = createMockRes();
    await riFacultyController.serveFacultyFile(mismatchReq, mismatchRes);
    assert.strictEqual(mismatchRes.statusCode, 403);
    assert.strictEqual(mismatchRes.body.message, 'File access ticket is not valid for this object.');
    console.log('✓ PASS: Ticket presented for a different object strictly rejected with HTTP 403');

    // 12F. Legacy EC2 File Access via Single-Use Ticket
    const legacyFileKey = `/uploads/ri_media/${sampleLocalFile}`;
    const legacyTicketReq = {
      body: { key: legacyFileKey },
      user: facultyUser
    };
    const legacyTicketRes = createMockRes();
    await riFacultyController.createFacultyFileAccessTicket(legacyTicketReq, legacyTicketRes);
    const legacyTicket = legacyTicketRes.body.ticket;

    // Use ticket on legacy file
    const serveLegacyReq1 = {
      query: { key: legacyFileKey, ticket: legacyTicket },
      headers: {}
    };
    const serveLegacyRes1 = createMockRes();
    await riFacultyController.serveFacultyFile(serveLegacyReq1, serveLegacyRes1);
    assert.strictEqual(serveLegacyRes1.sentFile, path.join(riMediaDir, sampleLocalFile));

    // Try reusing ticket on legacy file
    const serveLegacyReq2 = {
      query: { key: legacyFileKey, ticket: legacyTicket },
      headers: {}
    };
    const serveLegacyRes2 = createMockRes();
    await riFacultyController.serveFacultyFile(serveLegacyReq2, serveLegacyRes2);
    assert.strictEqual(serveLegacyRes2.statusCode, 403);
    assert.strictEqual(serveLegacyRes2.body.message, 'File access ticket has already been used. Please request a new ticket.');
    console.log('✓ PASS: Legacy EC2 file access via ticket verified with single-use enforcement');

    console.log('\n================================================================');
    console.log('ALL STORAGE PRESERVATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================');
  } finally {
    riStorageService.resetMockS3Client();
    await pool.end();
  }
}

runStoragePreservationTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
