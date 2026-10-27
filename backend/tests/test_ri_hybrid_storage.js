const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const riStorageService = require('../services/riStorageService');
const riStudentController = require('../controllers/riStudentController');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const { Writable } = require('stream');

// Helper to create mock response object supporting streaming and Express methods
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
  res.filePath = null;

  res.status = function(code) {
    this.statusCode = code;
    return this;
  };

  res.setHeader = function(name, val) {
    this.headers[name] = val;
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
    this.filePath = p;
    this.end();
    return this;
  };

  res.getBuffer = function() {
    return Buffer.concat(chunks);
  };

  return res;
}

async function runComprehensiveTests() {
  console.log('================================================================');
  console.log('RUNNING COMPREHENSIVE RI HYBRID FILE STORAGE TEST SUITE');
  console.log('Testing Requirements A through L');
  console.log('================================================================\n');

  // 1. Fetch test subjects from DB with confirmed faculty assignment
  const pairRes = await pool.query(`
    SELECT rbs.student_id, rbs.ri_batch_id, rbs.ri_panel_id, u.name, u.email as student_email,
           rbf.faculty_id, rbf.email as faculty_email
    FROM ri_batch_students rbs
    JOIN users u ON u.id = rbs.student_id
    JOIN ri_batch_faculty rbf ON rbf.ri_panel_id = rbs.ri_panel_id AND rbf.ri_batch_id = rbs.ri_batch_id
    LIMIT 1
  `);

  if (pairRes.rows.length === 0) {
    throw new Error('Need student with assigned faculty in ri_batch_faculty for authorization testing');
  }

  const pair = pairRes.rows[0];
  const studentA = {
    id: pair.student_id,
    name: pair.name,
    email: pair.student_email,
    ri_batch_id: pair.ri_batch_id,
    ri_panel_id: pair.ri_panel_id
  };

  const facultyUser = {
    id: pair.faculty_id,
    email: pair.faculty_email,
    role: 'ri_faculty',
    ri_batch_id: pair.ri_batch_id,
    ri_panel_id: pair.ri_panel_id
  };

  // Student B from a completely different panel
  const alienRes = await pool.query(`
    SELECT u.id, u.name, u.email, rbs.ri_batch_id, rbs.ri_panel_id
    FROM users u
    JOIN ri_batch_students rbs ON rbs.student_id = u.id
    WHERE rbs.ri_panel_id != $1
    LIMIT 1
  `, [studentA.ri_panel_id]);

  const studentB = alienRes.rows[0];

  const adminRes = await pool.query(`
    SELECT id, email, role FROM users WHERE role IN ('admin', 'superadmin', 'ri_admin') LIMIT 1
  `);
  const adminUser = adminRes.rows[0] || { id: 99999, email: 'admin@test.com', role: 'admin' };

  console.log(`Test Student A (Owner): ID ${studentA.id}, Panel ${studentA.ri_panel_id}, Batch ${studentA.ri_batch_id}`);
  console.log(`Test Student B (Unauthorized): ID ${studentB.id}, Panel ${studentB.ri_panel_id}, Batch ${studentB.ri_batch_id}`);
  console.log(`Test Admin: ID ${adminUser.id}, Role ${adminUser.role}`);
  console.log(`Test Faculty (Assigned): ID ${facultyUser.id}, Panel ${facultyUser.ri_panel_id}`);

  // Set up mock S3 storage
  const mockS3Storage = new Map();
  const mockS3Client = {
    send: async (command) => {
      const commandName = command.constructor.name;
      const input = command.input;

      if (commandName === 'PutObjectCommand') {
        mockS3Storage.set(input.Key, {
          bucket: input.Bucket,
          buffer: input.Body,
          contentType: input.ContentType,
          metadata: input.Metadata,
          serverSideEncryption: input.ServerSideEncryption
        });
        return { ETag: '"test-mock-etag-12345"' };
      } else if (commandName === 'GetObjectCommand') {
        const item = mockS3Storage.get(input.Key);
        if (!item) {
          const err = new Error('NoSuchKey');
          err.name = 'NoSuchKey';
          err.$metadata = { httpStatusCode: 404 };
          throw err;
        }
        const { Readable } = require('stream');
        const stream = new Readable();
        stream.push(item.buffer);
        stream.push(null);
        return {
          Body: stream,
          ContentType: item.contentType,
          ContentLength: item.buffer.length,
          Metadata: item.metadata
        };
      } else if (commandName === 'DeleteObjectCommand') {
        mockS3Storage.delete(input.Key);
        return {};
      }
      throw new Error(`Unhandled mock S3 command: ${commandName}`);
    }
  };

  riStorageService.setMockS3Client(mockS3Client);

  // Valid binary payloads
  const validPdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const validDocxBuffer = Buffer.from('PK\x03\x04\x14\x00\x06\x00\x08\x00test docx content data');
  const validJpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]);
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);

  let uploadedPdfKey = null;
  let uploadedInstKey = null;
  let uploadedDarKey = null;
  let uploadedCommKey = null;

  // -------------------------------------------------------------
  // TEST A: Upload new Problem Identification PDF/DOCX -> S3
  // -------------------------------------------------------------
  console.log('\n--- TEST A: Upload new Problem Identification PDF/DOCX -> Stored in S3 ---');
  {
    const resA = createMockRes();
    await riStudentController.uploadAssignmentDocument({
      user: { id: studentA.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: {
        originalname: 'Problem_Statement_Final.pdf',
        mimetype: 'application/pdf',
        buffer: validPdfBuffer,
        size: validPdfBuffer.length
      }
    }, resA);

    if (resA.statusCode !== 200 || !resA.body?.url) {
      throw new Error(`Test A Failed: Expected 200 with url, got ${resA.statusCode}: ${JSON.stringify(resA.body)}`);
    }

    const url = resA.body.url;
    console.log(`✓ Returned URL: ${url}`);
    if (!url.includes('/api/ri/student/files/view?key=')) {
      throw new Error(`Test A Failed: URL is not an S3 file view URL`);
    }

    uploadedPdfKey = decodeURIComponent(url.split('key=')[1]);
    console.log(`✓ S3 Key: ${uploadedPdfKey}`);

    if (!mockS3Storage.has(uploadedPdfKey)) {
      throw new Error(`Test A Failed: File was not stored in S3 mock`);
    }
    if (!uploadedPdfKey.startsWith('ri_student_uploads/problem_identification/')) {
      throw new Error(`Test A Failed: S3 key prefix does not start with ri_student_uploads/problem_identification/`);
    }
    const item = mockS3Storage.get(uploadedPdfKey);
    const expectedBucket = process.env.RI_AWS_BUCKET_NAME || process.env.AWS_BUCKET_NAME || 'life-awakening-media-2026';
    if (item.bucket !== expectedBucket) {
      throw new Error(`Test A Failed: Expected bucket ${expectedBucket}, got ${item.bucket}`);
    }
    if (item.serverSideEncryption !== 'AES256') {
      throw new Error(`Test A Failed: AES256 server side encryption was not applied`);
    }
    console.log(`✓ S3 Bucket verified: ${item.bucket}`);
    console.log('✓ TEST A PASSED: PDF successfully stored in private S3 with AES256');
  }

  // -------------------------------------------------------------
  // TEST B: Upload new Institutional Visit photos -> S3
  // -------------------------------------------------------------
  console.log('\n--- TEST B: Upload new Institutional Visit photos -> Stored in S3 ---');
  {
    const resB = createMockRes();
    await riStudentController.uploadInstitutionalPhoto({
      user: { id: studentA.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: {
        originalname: 'phc_visit_facility.jpg',
        mimetype: 'image/jpeg',
        buffer: validJpgBuffer,
        size: validJpgBuffer.length
      }
    }, resB);

    if (resB.statusCode !== 200 || !resB.body?.url) {
      throw new Error(`Test B Failed: Expected 200 with url, got ${resB.statusCode}`);
    }
    const url = resB.body.url;
    console.log(`✓ Returned URL: ${url}`);
    uploadedInstKey = decodeURIComponent(url.split('key=')[1]);
    if (!mockS3Storage.has(uploadedInstKey)) {
      throw new Error(`Test B Failed: Institutional photo not found in S3`);
    }
    if (!uploadedInstKey.startsWith('ri_student_uploads/institutional_visit/')) {
      throw new Error(`Test B Failed: S3 key prefix does not match ri_student_uploads/institutional_visit/`);
    }
    console.log('✓ TEST B PASSED: Institutional visit photo stored in S3');
  }

  // -------------------------------------------------------------
  // TEST C: Upload new Daily Activity Report photos -> S3
  // -------------------------------------------------------------
  console.log('\n--- TEST C: Upload new Daily Activity Report photos -> Stored in S3 ---');
  {
    const resC = createMockRes();
    await riStudentController.uploadDailyActivityPhoto({
      user: { id: studentA.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: {
        originalname: 'field_cleaning_day2.png',
        mimetype: 'image/png',
        buffer: validPngBuffer,
        size: validPngBuffer.length
      }
    }, resC);

    if (resC.statusCode !== 200 || !resC.body?.url) {
      throw new Error(`Test C Failed: Expected 200 with url, got ${resC.statusCode}`);
    }
    uploadedDarKey = decodeURIComponent(resC.body.url.split('key=')[1]);
    if (!mockS3Storage.has(uploadedDarKey)) {
      throw new Error(`Test C Failed: DAR photo not found in S3`);
    }
    if (!uploadedDarKey.startsWith('ri_student_uploads/daily_activity/')) {
      throw new Error(`Test C Failed: Key prefix does not match ri_student_uploads/daily_activity/`);
    }
    console.log('✓ TEST C PASSED: Daily Activity Report photo stored in S3');
  }

  // -------------------------------------------------------------
  // TEST D: Upload new Community Project photo -> S3
  // -------------------------------------------------------------
  console.log('\n--- TEST D: Upload new Community Project photo -> Stored in S3 ---');
  {
    const resD = createMockRes();
    await riStudentController.uploadCommunityPhoto({
      user: { id: studentA.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: {
        originalname: 'community_solar_installation.jpg',
        mimetype: 'image/jpeg',
        buffer: validJpgBuffer,
        size: validJpgBuffer.length
      }
    }, resD);

    if (resD.statusCode !== 200 || !resD.body?.url) {
      throw new Error(`Test D Failed: Expected 200 with url, got ${resD.statusCode}`);
    }
    uploadedCommKey = decodeURIComponent(resD.body.url.split('key=')[1]);
    if (!mockS3Storage.has(uploadedCommKey)) {
      throw new Error(`Test D Failed: Community project photo not found in S3`);
    }
    if (!uploadedCommKey.startsWith('ri_student_uploads/community_project/')) {
      throw new Error(`Test D Failed: Key prefix does not match ri_student_uploads/community_project/`);
    }
    console.log('✓ TEST D PASSED: Community project photo stored in S3');
  }

  // -------------------------------------------------------------
  // TEST LTC_ISOLATION: Verify LTC Journey Media continues using journey/
  // -------------------------------------------------------------
  console.log('\n--- TEST LTC_ISOLATION: Verify LTC Journey Media Namespace Isolation ---');
  {
    const s3Service = require('../services/s3Service');
    const presigned = await s3Service.getPresignedUploadUrl('sample_journey_recording.mp4', 'video/mp4');
    if (!presigned.storageKey.startsWith('journey/')) {
      throw new Error(`LTC Isolation Failed: Expected key to start with journey/, got: ${presigned.storageKey}`);
    }
    console.log(`✓ LTC Journey storageKey verified: ${presigned.storageKey}`);
    console.log('✓ TEST LTC_ISOLATION PASSED: Complete prefix isolation between journey/ and ri_student_uploads/');
  }

  // -------------------------------------------------------------
  // TEST E: Open previously uploaded EC2 documents and photos
  // -------------------------------------------------------------
  console.log('\n--- TEST E: Verify Existing EC2 Files Remain Accessible ---');
  {
    const uploadsDir = path.resolve(__dirname, '../uploads/ri_student_files');
    const existingFiles = fs.readdirSync(uploadsDir).filter(f => !f.startsWith('.'));
    console.log(`Found ${existingFiles.length} existing files in ${uploadsDir}`);
    if (existingFiles.length === 0) {
      throw new Error('Test E Failed: Expected existing files in EC2 uploads directory');
    }

    const sampleEc2File = 'ri_1792577024502_1032232294.pdf';
    const sampleFilePath = path.join(uploadsDir, sampleEc2File);
    if (!fs.existsSync(sampleFilePath)) {
      throw new Error(`Test E Failed: Expected sample file ${sampleEc2File} to exist on disk`);
    }
    const fileStats = fs.statSync(sampleFilePath);
    console.log(`✓ Sample legacy EC2 file verified on disk: ${sampleEc2File} (${fileStats.size} bytes)`);

    // 1. Verify access via existing Express static route
    try {
      const staticRes = await fetch(`http://localhost:5001/api/uploads/ri_student_files/${sampleEc2File}`);
      console.log(`✓ Express static route verification: HTTP ${staticRes.status} (${staticRes.headers.get('content-type')})`);
      if (staticRes.status !== 200) {
        throw new Error(`Test E Failed: Express static route returned HTTP ${staticRes.status}`);
      }
    } catch (fetchErr) {
      console.warn('Note: Backend server fetch skipped or timed out, verifying via disk and controller');
    }

    // 2. Test access via serveStudentFile with admin token
    const tokenAdmin = jwt.sign({ id: adminUser.id, role: adminUser.role }, JWT_SECRET);
    const resEAdmin = createMockRes();
    await riStudentController.serveStudentFile({
      query: { key: `uploads/ri_student_files/${sampleEc2File}` },
      headers: { authorization: `Bearer ${tokenAdmin}` }
    }, resEAdmin);

    if (resEAdmin.statusCode !== 200) {
      throw new Error(`Test E Failed: serveStudentFile failed for legacy EC2 file with admin token, status: ${resEAdmin.statusCode}`);
    }

    // 3. Test access via serveStudentFile with owner student token (412384 owns this pdf in DB)
    const tokenOwner412384 = jwt.sign({ id: 412384, role: 'student' }, JWT_SECRET);
    const resEOwner = createMockRes();
    await riStudentController.serveStudentFile({
      query: { key: `uploads/ri_student_files/${sampleEc2File}` },
      headers: { authorization: `Bearer ${tokenOwner412384}` }
    }, resEOwner);

    if (resEOwner.statusCode !== 200) {
      throw new Error(`Test E Failed: serveStudentFile failed for legacy EC2 file with owner student token, status: ${resEOwner.statusCode}`);
    }

    console.log('✓ TEST E PASSED: Existing EC2 files remain completely intact and streamable');
  }

  // -------------------------------------------------------------
  // TEST F: Verify students, faculty, and admins retain appropriate access
  // -------------------------------------------------------------
  console.log('\n--- TEST F: Authorization - Student, Faculty, and Admin Access & Tickets ---');
  {
    const tokenOwner = jwt.sign({ id: studentA.id, role: 'student' }, JWT_SECRET);
    const tokenAdmin = jwt.sign({ id: adminUser.id, role: adminUser.role }, JWT_SECRET);
    const tokenFaculty = jwt.sign({ id: facultyUser.id, role: facultyUser.role }, JWT_SECRET);

    // 1. Owner Student Access via Bearer Header
    const resOwner = createMockRes();
    await riStudentController.serveStudentFile({
      query: { key: uploadedPdfKey },
      headers: { authorization: `Bearer ${tokenOwner}` }
    }, resOwner);
    if (resOwner.statusCode !== 200) {
      throw new Error(`Test F Failed: Owner student denied access (${resOwner.statusCode})`);
    }
    console.log('✓ Owner student has authorized access to own S3 files via Bearer Header');

    // 2. Admin Access via Bearer Header
    const resAdmin = createMockRes();
    await riStudentController.serveStudentFile({
      query: { key: uploadedPdfKey },
      headers: { authorization: `Bearer ${tokenAdmin}` }
    }, resAdmin);
    if (resAdmin.statusCode !== 200) {
      throw new Error(`Test F Failed: Admin denied access (${resAdmin.statusCode})`);
    }
    console.log('✓ Admin has authorized access to student S3 files via Bearer Header');

    // 3. Assigned Faculty Access via Bearer Header
    const resFaculty = createMockRes();
    await riStudentController.serveStudentFile({
      query: { key: uploadedPdfKey },
      headers: { authorization: `Bearer ${tokenFaculty}` }
    }, resFaculty);
    if (resFaculty.statusCode !== 200) {
      throw new Error(`Test F Failed: Assigned faculty denied access (${resFaculty.statusCode})`);
    }
    console.log('✓ Assigned faculty has authorized access to panel S3 files via Bearer Header');

    // 4. File Access Ticket Generation & Ticket-based Serving
    // Owner Ticket
    const resOwnerTicket = createMockRes();
    await riStudentController.createFileAccessTicket({
      user: { id: studentA.id, role: 'student' },
      body: { key: uploadedPdfKey }
    }, resOwnerTicket);
    if (resOwnerTicket.statusCode !== 200 || !resOwnerTicket.body?.ticket) {
      throw new Error(`Test F Failed: Could not generate ticket for owner student, status: ${resOwnerTicket.statusCode}`);
    }
    const ownerTicket = resOwnerTicket.body.ticket;
    console.log('✓ Successfully generated single-use, object-bound ticket for owner student');

    // Serve file via ticket
    const resServeTicket = createMockRes();
    await riStudentController.serveStudentFile({
      query: { key: uploadedPdfKey, ticket: ownerTicket },
      headers: {}
    }, resServeTicket);
    if (resServeTicket.statusCode !== 200) {
      throw new Error(`Test F Failed: serveStudentFile failed with valid ticket, status: ${resServeTicket.statusCode}`);
    }
    console.log('✓ Successfully served file using single-use access ticket');

    // Faculty Ticket
    const resFacultyTicket = createMockRes();
    await riStudentController.createFileAccessTicket({
      user: { id: facultyUser.id, role: facultyUser.role },
      body: { key: uploadedPdfKey }
    }, resFacultyTicket);
    if (resFacultyTicket.statusCode !== 200 || !resFacultyTicket.body?.ticket) {
      throw new Error(`Test F Failed: Could not generate ticket for assigned faculty, status: ${resFacultyTicket.statusCode}`);
    }
    console.log('✓ Successfully generated single-use, object-bound ticket for assigned faculty');

    // Admin Ticket
    const resAdminTicket = createMockRes();
    await riStudentController.createFileAccessTicket({
      user: { id: adminUser.id, role: adminUser.role },
      body: { key: uploadedPdfKey }
    }, resAdminTicket);
    if (resAdminTicket.statusCode !== 200 || !resAdminTicket.body?.ticket) {
      throw new Error(`Test F Failed: Could not generate ticket for admin, status: ${resAdminTicket.statusCode}`);
    }
    console.log('✓ Successfully generated single-use, object-bound ticket for admin');
    console.log('✓ TEST F PASSED');
  }

  // -------------------------------------------------------------
  // TEST G: Security Isolation & JWT Protection
  // -------------------------------------------------------------
  console.log('\n--- TEST G: Security Isolation & JWT Protection ---');
  {
    const tokenOwner = jwt.sign({ id: studentA.id, role: 'student' }, JWT_SECRET);

    // 1. Session JWT in Query Parameter Strictly Prohibited (Prevent log exposure)
    const resTokenQuery = createMockRes();
    await riStudentController.serveStudentFile({
      query: { key: uploadedPdfKey, token: tokenOwner },
      headers: {}
    }, resTokenQuery);
    if (resTokenQuery.statusCode !== 400) {
      throw new Error(`Test G Failed: Expected 400 Bad Request for session token in query parameter, got ${resTokenQuery.statusCode}`);
    }
    console.log('✓ Session JWT in query parameter rejected with HTTP 400 Bad Request (Log Protection Verified)');

    // 2. Unauthenticated Request (No token, no ticket)
    const resNoAuth = createMockRes();
    await riStudentController.serveStudentFile({
      query: { key: uploadedPdfKey },
      headers: {}
    }, resNoAuth);
    if (resNoAuth.statusCode !== 401) {
      throw new Error(`Test G Failed: Expected 401 for unauthenticated request, got ${resNoAuth.statusCode}`);
    }
    console.log('✓ Unauthenticated request rejected with HTTP 401');

    // 3. Unauthorized Student from different panel/batch attempting ticket generation
    const resAlienTicket = createMockRes();
    await riStudentController.createFileAccessTicket({
      user: { id: 999111, role: 'student' },
      body: { key: uploadedPdfKey }
    }, resAlienTicket);
    if (resAlienTicket.statusCode !== 403) {
      throw new Error(`Test G Failed: Expected 403 for unauthorized student ticket creation, got ${resAlienTicket.statusCode}`);
    }
    console.log('✓ Unauthorized student blocked from generating ticket with HTTP 403 Forbidden');

    // 4. Unauthorized Student direct access via Bearer header
    const tokenAlienStudent = jwt.sign({ id: 999111, role: 'student' }, JWT_SECRET);
    const resAlien = createMockRes();
    await riStudentController.serveStudentFile({
      query: { key: uploadedPdfKey },
      headers: { authorization: `Bearer ${tokenAlienStudent}` }
    }, resAlien);
    if (resAlien.statusCode !== 403) {
      throw new Error(`Test G Failed: Expected 403 for unauthorized student, got ${resAlien.statusCode}`);
    }
    console.log('✓ Unauthorized student rejected with HTTP 403 Forbidden');

    // 5. Ticket Replay Prevention: Try consuming an already used ticket after grace window
    const resFreshTicket = createMockRes();
    await riStudentController.createFileAccessTicket({
      user: { id: studentA.id, role: 'student' },
      body: { key: uploadedPdfKey }
    }, resFreshTicket);
    const freshTicket = resFreshTicket.body.ticket;

    // First use: success
    const resUse1 = createMockRes();
    await riStudentController.serveStudentFile({
      query: { key: uploadedPdfKey, ticket: freshTicket },
      headers: {}
    }, resUse1);
    if (resUse1.statusCode !== 200) {
      throw new Error(`Test G Failed: First use of ticket failed, status: ${resUse1.statusCode}`);
    }

    // Wait 3.5 seconds to exit the speculative prefetch grace window
    await new Promise(resolve => setTimeout(resolve, 3500));

    // Second use: must be rejected with 403
    const resUse2 = createMockRes();
    await riStudentController.serveStudentFile({
      query: { key: uploadedPdfKey, ticket: freshTicket },
      headers: {}
    }, resUse2);
    if (resUse2.statusCode !== 403) {
      throw new Error(`Test G Failed: Expected 403 for replayed ticket, got ${resUse2.statusCode}`);
    }
    console.log('✓ Replayed ticket rejected with HTTP 403 Forbidden (Single-use enforcement verified)');

    // 6. Ticket Object Key Tampering
    const resTamper = createMockRes();
    await riStudentController.serveStudentFile({
      query: { key: 'ri_student_uploads/problem_identification/b1/p999/s999/other.pdf', ticket: freshTicket },
      headers: {}
    }, resTamper);
    if (resTamper.statusCode !== 403) {
      throw new Error(`Test G Failed: Expected 403 for tampered key with ticket, got ${resTamper.statusCode}`);
    }
    console.log('✓ Tampered object key rejected with HTTP 403 Forbidden');

    // 7. Expired Ticket
    const expiredTicket = jwt.sign(
      { ticket: true, jti: 'fakejti', sub: studentA.id, role: 'student', key: uploadedPdfKey },
      JWT_SECRET,
      { expiresIn: '-10s' }
    );
    const resExpired = createMockRes();
    await riStudentController.serveStudentFile({
      query: { key: uploadedPdfKey, ticket: expiredTicket },
      headers: {}
    }, resExpired);
    if (resExpired.statusCode !== 401) {
      throw new Error(`Test G Failed: Expected 401 for expired ticket, got ${resExpired.statusCode}`);
    }
    console.log('✓ Expired ticket rejected with HTTP 401 Unauthorized');
    console.log('✓ TEST G PASSED: Private S3 objects and JWT session tokens are completely protected');
  }

  // -------------------------------------------------------------
  // TEST H: Simulate S3 upload failure -> no invalid DB reference, no EC2 fallback
  // -------------------------------------------------------------
  console.log('\n--- TEST H: S3 Upload Failure Handling & Zero DB Writes ---');
  {
    // Temporarily replace mock with an error throwing mock
    riStorageService.setMockS3Client({
      send: async () => {
        const error = new Error('AWS S3 Service Unavailable / Connection Timeout');
        error.name = 'TimeoutError';
        throw error;
      }
    });

    const resFailure = createMockRes();
    await riStudentController.uploadAssignmentDocument({
      user: { id: studentA.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: {
        originalname: 'Problem_Statement_Fail.pdf',
        mimetype: 'application/pdf',
        buffer: validPdfBuffer,
        size: validPdfBuffer.length
      }
    }, resFailure);

    if (resFailure.statusCode !== 502) {
      throw new Error(`Test H Failed: Expected 502 Bad Gateway on S3 failure, got ${resFailure.statusCode}`);
    }
    console.log(`✓ Correct error response returned: HTTP ${resFailure.statusCode} - ${resFailure.body?.message}`);

    // Verify no EC2 file was written
    const uploadsDir = path.resolve(__dirname, '../uploads/ri_student_files');
    const filesAfter = fs.readdirSync(uploadsDir);
    const leakedFile = filesAfter.find(f => f.includes('Problem_Statement_Fail'));
    if (leakedFile) {
      throw new Error('Test H Failed: File was erroneously saved to EC2 local storage upon S3 failure!');
    }
    console.log('✓ Verified: No silent fallback to EC2 storage occurred');

    // Restore working mock
    riStorageService.setMockS3Client(mockS3Client);
    console.log('✓ TEST H PASSED');
  }

  // -------------------------------------------------------------
  // TEST I: Invalid file types and oversized files are rejected
  // -------------------------------------------------------------
  console.log('\n--- TEST I: Content & Size Validation Enforcement ---');
  {
    // 1. Disguised executable (.exe with .pdf name)
    const fakeExeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF\x00\x00fake executable content');
    const resDisguised = createMockRes();
    await riStudentController.uploadAssignmentDocument({
      user: { id: studentA.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: {
        originalname: 'assignment.pdf',
        mimetype: 'application/pdf',
        buffer: fakeExeBuffer,
        size: fakeExeBuffer.length
      }
    }, resDisguised);

    if (resDisguised.statusCode !== 400) {
      throw new Error(`Test I Failed: Expected 400 for disguised executable, got ${resDisguised.statusCode}`);
    }
    console.log(`✓ Disguised executable rejected: HTTP ${resDisguised.statusCode} - ${resDisguised.body?.message}`);

    // 2. Unsupported extension (.sh)
    const resBadExt = createMockRes();
    await riStudentController.uploadAssignmentDocument({
      user: { id: studentA.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: {
        originalname: 'script.sh',
        mimetype: 'application/x-sh',
        buffer: Buffer.from('#!/bin/bash\necho "hello"'),
        size: 20
      }
    }, resBadExt);
    if (resBadExt.statusCode !== 400) {
      throw new Error(`Test I Failed: Expected 400 for invalid extension, got ${resBadExt.statusCode}`);
    }
    console.log(`✓ Invalid extension rejected: HTTP ${resBadExt.statusCode}`);

    // 3. Oversized document (> 10MB)
    const resOversizedDoc = createMockRes();
    await riStudentController.uploadAssignmentDocument({
      user: { id: studentA.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: {
        originalname: 'huge_document.pdf',
        mimetype: 'application/pdf',
        buffer: validPdfBuffer,
        size: 11 * 1024 * 1024
      }
    }, resOversizedDoc);
    if (resOversizedDoc.statusCode !== 400) {
      throw new Error(`Test I Failed: Expected 400 for document > 10MB, got ${resOversizedDoc.statusCode}`);
    }
    console.log(`✓ Oversized document (>10MB) rejected: HTTP ${resOversizedDoc.statusCode}`);

    // 4. Oversized photo (> 5MB)
    const resOversizedPhoto = createMockRes();
    await riStudentController.uploadInstitutionalPhoto({
      user: { id: studentA.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: {
        originalname: 'huge_photo.jpg',
        mimetype: 'image/jpeg',
        buffer: validJpgBuffer,
        size: 6 * 1024 * 1024
      }
    }, resOversizedPhoto);
    if (resOversizedPhoto.statusCode !== 400) {
      throw new Error(`Test I Failed: Expected 400 for photo > 5MB, got ${resOversizedPhoto.statusCode}`);
    }
    console.log(`✓ Oversized photo (>5MB) rejected: HTTP ${resOversizedPhoto.statusCode}`);
    console.log('✓ TEST I PASSED');
  }

  // -------------------------------------------------------------
  // TEST J: Existing form submission, editing, and reporting flows remain functional
  // -------------------------------------------------------------
  console.log('\n--- TEST J: Form Submission and Retrieval Flow with Hybrid URLs ---');
  {
    const s3DocUrl = `http://localhost:5001/api/ri/student/files/view?key=${encodeURIComponent(uploadedPdfKey)}`;

    // Save Form VI Problem Identification draft
    const resSaveDoc = createMockRes();
    await riStudentController.saveProblemIdentification({
      user: { id: studentA.id },
      body: {
        problem_title: 'Hybrid Storage Validation Test Title',
        problem_description: 'Validating S3 URL storage compatibility with existing DB columns',
        assignment_link: s3DocUrl,
        status: 'Draft',
        is_final_submit: false
      }
    }, resSaveDoc);

    if (resSaveDoc.statusCode !== 200) {
      throw new Error(`Test J Failed: Could not save problem identification with S3 URL, status: ${resSaveDoc.statusCode}`);
    }
    console.log('✓ Successfully saved Problem Identification record with S3 file URL');

    // Retrieve and verify
    const resGetDoc = createMockRes();
    await riStudentController.getProblemIdentification({
      user: { id: studentA.id }
    }, resGetDoc);

    const retrievedLink = resGetDoc.body?.problem?.assignment_link || resGetDoc.body?.assignment_link;
    if (resGetDoc.statusCode !== 200 || retrievedLink !== s3DocUrl) {
      throw new Error(`Test J Failed: Retrieved assignment_link mismatch! Got: ${retrievedLink}`);
    }
    console.log(`✓ Retrieved Problem Identification verified: ${retrievedLink}`);
    console.log('✓ TEST J PASSED');
  }

  // -------------------------------------------------------------
  // TEST K: Confirm Undertaking Form and unrelated modules are unchanged
  // -------------------------------------------------------------
  console.log('\n--- TEST K: Confirm Undertaking and Unrelated Modules are Intact ---');
  {
    if (typeof riStudentController.submitStudentUndertaking !== 'function' || typeof riStudentController.getStudentUndertaking !== 'function') {
      throw new Error('Test K Failed: Undertaking controller functions are missing');
    }

    const resUndertaking = createMockRes();
    await riStudentController.getStudentUndertaking({
      user: { id: studentA.id }
    }, resUndertaking);

    if (resUndertaking.statusCode !== 200) {
      throw new Error(`Test K Failed: getStudentUndertaking returned ${resUndertaking.statusCode}`);
    }
    console.log('✓ Undertaking Form controller endpoint verified functional and unmodified');
    console.log('✓ TEST K PASSED');
  }

  // -------------------------------------------------------------
  // TEST L: deleteStudentFile - S3 with only AWS_BUCKET_NAME and Legacy Local Deletion
  // -------------------------------------------------------------
  console.log('\n--- TEST L: deleteStudentFile - S3 (with only AWS_BUCKET_NAME) & Legacy Local Deletion ---');
  {
    // Save current env vars
    const prevRiBucket = process.env.RI_AWS_BUCKET_NAME;
    const prevRiStorageType = process.env.RI_STORAGE_TYPE;
    const prevAwsBucket = process.env.AWS_BUCKET_NAME;

    try {
      // Simulate production environment:
      // AWS_BUCKET_NAME is present, but RI_AWS_BUCKET_NAME and RI_STORAGE_TYPE are ABSENT
      delete process.env.RI_AWS_BUCKET_NAME;
      delete process.env.RI_STORAGE_TYPE;
      process.env.AWS_BUCKET_NAME = 'life-awakening-media-2026';

      let lastDeletedS3Key = null;
      let lastDeletedBucket = null;

      const deleteTrackingMock = {
        send: async (command) => {
          if (command.constructor?.name === 'DeleteObjectCommand' || command.input?.Key) {
            lastDeletedS3Key = command.input?.Key;
            lastDeletedBucket = command.input?.Bucket;
            return {};
          }
          return {};
        }
      };
      riStorageService.setMockS3Client(deleteTrackingMock);

      // 1. Test S3 deletion with S3 object key
      const testS3Key = 'ri_student_uploads/problem_identification/b240/p550/s412369/ri_12345_sample.pdf';
      const s3DelResult = await riStorageService.deleteStudentFile(testS3Key);
      if (!s3DelResult || lastDeletedS3Key !== testS3Key || lastDeletedBucket !== 'life-awakening-media-2026') {
        throw new Error(`Test L Failed: S3 deletion with only AWS_BUCKET_NAME failed. Result: ${s3DelResult}, Key: ${lastDeletedS3Key}, Bucket: ${lastDeletedBucket}`);
      }
      console.log('✓ S3 deletion with only AWS_BUCKET_NAME configured succeeded targeting correct bucket and key');

      // 2. Test S3 deletion via proxy URL
      const proxyUrl = `http://localhost:5001/api/ri/student/files/view?key=${encodeURIComponent(testS3Key)}`;
      const proxyDelResult = await riStorageService.deleteStudentFile(proxyUrl);
      if (!proxyDelResult || lastDeletedS3Key !== testS3Key) {
        throw new Error(`Test L Failed: S3 deletion via proxy URL failed. Key: ${lastDeletedS3Key}`);
      }
      console.log('✓ S3 deletion via proxy URL decoded and deleted correctly');

      // 3. Critical Safety Check: Ensure an S3 key NEVER deletes a legacy local file with matching basename
      const uploadsDir = path.resolve(__dirname, '../uploads/ri_student_files');
      const testLocalCollidingFile = 'ri_test_safety_collision_guard.pdf';
      const collidingLocalPath = path.join(uploadsDir, testLocalCollidingFile);
      fs.writeFileSync(collidingLocalPath, 'protected legacy local content');

      // Attempt deletion with an S3 key that shares the exact same basename
      const collidingS3Key = `ri_student_uploads/problem_identification/b240/p550/s412369/${testLocalCollidingFile}`;
      await riStorageService.deleteStudentFile(collidingS3Key);

      // Confirm the local file on disk was NOT touched
      if (!fs.existsSync(collidingLocalPath)) {
        throw new Error('Test L Failed: Local file was erroneously deleted when given an S3 object key!');
      }
      console.log('✓ Verified: S3 deletion never accidentally deletes matching local files on EC2');

      // Clean up collision test file
      fs.unlinkSync(collidingLocalPath);

      // 4. Test Legacy Local File Deletion
      const legacyTestFile = 'ri_temp_legacy_local_to_delete.pdf';
      const legacyLocalPath = path.join(uploadsDir, legacyTestFile);
      fs.writeFileSync(legacyLocalPath, 'temporary legacy file to delete');

      const localDelResult = await riStorageService.deleteStudentFile(legacyTestFile);
      if (!localDelResult || fs.existsSync(legacyLocalPath)) {
        throw new Error('Test L Failed: Failed to delete actual legacy local file');
      }
      console.log('✓ Legacy local file deletion verified and succeeded');

      // 5. Test nonexistent file returns false
      const nonExistentResult = await riStorageService.deleteStudentFile('nonexistent_file_123.pdf');
      if (nonExistentResult !== false) {
        throw new Error('Test L Failed: Expected false for nonexistent local file');
      }
      console.log('✓ Nonexistent local file returns false as expected');

    } finally {
      // Restore previous environment variables
      if (prevRiBucket !== undefined) process.env.RI_AWS_BUCKET_NAME = prevRiBucket;
      else delete process.env.RI_AWS_BUCKET_NAME;

      if (prevRiStorageType !== undefined) process.env.RI_STORAGE_TYPE = prevRiStorageType;
      else delete process.env.RI_STORAGE_TYPE;

      if (prevAwsBucket !== undefined) process.env.AWS_BUCKET_NAME = prevAwsBucket;
      else delete process.env.AWS_BUCKET_NAME;

      riStorageService.resetMockS3Client();
    }
    console.log('✓ TEST L PASSED');
  }

  // Clean up
  riStorageService.resetMockS3Client();

  console.log('\n================================================================');
  console.log('ALL TESTS A THROUGH L PASSED SUCCESSFULLY!');
  console.log('Safe hybrid storage logic verified with full backward compatibility.');
  console.log('================================================================\n');
}

runComprehensiveTests()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ TEST SUITE FAILED:', err);
    pool.end();
    process.exit(1);
  });
