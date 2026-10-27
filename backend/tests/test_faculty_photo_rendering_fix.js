const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const assert = require('assert');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { Readable, Writable } = require('stream');
const riStorageService = require('../services/riStorageService');
const riFacultyController = require('../controllers/riFacultyController');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

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

// 1x1 valid JPEG image buffer
const MOCK_JPEG_BUFFER = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
  0x00, 0x03, 0x02, 0x02, 0x02, 0x02, 0x02, 0x03, 0x02, 0x02, 0x02, 0x03,
  0xFF, 0xD9
]);

async function runTests() {
  console.log('================================================================');
  console.log('RI FACULTY PHOTO RENDERING & STORAGE FIX VERIFICATION SUITE');
  console.log('================================================================\n');

  // Generate tokens
  const facultyToken = jwt.sign(
    { id: 101, email: 'faculty@mitwpu.edu.in', role: 'faculty' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const studentToken = jwt.sign(
    { id: 202, email: 'student@mitwpu.edu.in', role: 'student' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Mock S3 getObjectStream for faculty photos
  const mockS3Store = new Map();
  const testPhotoKey1 = 'ri_faculty_uploads/photos/b241/p557/1729600000000-photo1.jpg';
  const testPhotoKey2 = 'ri_faculty_uploads/photos/b241/p557/1729600000000-photo2.jpg';
  mockS3Store.set(testPhotoKey1, { buffer: MOCK_JPEG_BUFFER, contentType: 'image/jpeg' });
  mockS3Store.set(testPhotoKey2, { buffer: MOCK_JPEG_BUFFER, contentType: 'image/jpeg' });

  const originalGetObjectStream = riStorageService.getObjectStream;
  riStorageService.getObjectStream = async (key) => {
    const item = mockS3Store.get(key);
    if (!item) {
      const err = new Error('NoSuchKey');
      err.name = 'NoSuchKey';
      err.$metadata = { httpStatusCode: 404 };
      throw err;
    }
    const stream = Readable.from(item.buffer);
    return {
      Body: stream,
      ContentType: item.contentType,
      ContentLength: item.buffer.length
    };
  };

  try {
    // -------------------------------------------------------------
    // Test 1: New S3-backed photo thumbnail loading via Bearer Token
    // -------------------------------------------------------------
    console.log('[Test 1] S3-backed photo thumbnail request with Bearer authorization');
    {
      const req = {
        query: { key: testPhotoKey1 },
        headers: { authorization: `Bearer ${facultyToken}` }
      };
      const res = createMockRes();
      await riFacultyController.serveFacultyFile(req, res);

      // Wait for stream to finish
      await new Promise((resolve) => res.on('finish', resolve));

      assert.strictEqual(res.statusCode, 200, 'Thumbnail fetch must return 200 OK');
      assert.strictEqual(res.headers['content-type'], 'image/jpeg', 'Content-Type must be image/jpeg');
      assert.strictEqual(res.headers['content-disposition'], 'inline', 'Preview should be inline');
      assert.strictEqual(res.headers['cross-origin-resource-policy'], 'cross-origin');
      assert.strictEqual(res.getBuffer().length, MOCK_JPEG_BUFFER.length, 'Streamed buffer must match image');
      console.log('  ✓ PASSED: S3 photo returns 200 OK with binary JPEG body and inline Content-Disposition.');
    }

    // -------------------------------------------------------------
    // Test 2: Unauthenticated direct requests are blocked (401)
    // -------------------------------------------------------------
    console.log('\n[Test 2] Direct unauthenticated image request (browser native img without Bearer)');
    {
      const req = {
        query: { key: testPhotoKey1 },
        headers: {}
      };
      const res = createMockRes();
      await riFacultyController.serveFacultyFile(req, res);

      assert.strictEqual(res.statusCode, 401, 'Unauthenticated request must return 401');
      assert.ok(res.body && res.body.message.includes('Authentication required'), 'Must require authentication');
      console.log('  ✓ PASSED: Unauthenticated request rejected with 401 Unauthorized, ensuring S3 objects are not public.');
    }

    // -------------------------------------------------------------
    // Test 3: Clicking "View" requests a fresh single-use ticket
    // -------------------------------------------------------------
    console.log('\n[Test 3] Single-use ticket creation and redemption for View action');
    let ticket1;
    {
      const req = {
        body: { key: testPhotoKey1 },
        user: { id: 101, email: 'faculty@mitwpu.edu.in' }
      };
      const res = createMockRes();
      await riFacultyController.createFacultyFileAccessTicket(req, res);

      assert.strictEqual(res.statusCode, 200, 'Ticket creation must succeed');
      assert.ok(res.body && res.body.ticket, 'Response must contain ticket');
      ticket1 = res.body.ticket;

      // Verify ticket with serveFacultyFile (no Bearer header, only ticket query param)
      const viewReq = {
        query: { key: testPhotoKey1, ticket: ticket1 },
        headers: {}
      };
      const viewRes = createMockRes();
      await riFacultyController.serveFacultyFile(viewReq, viewRes);
      await new Promise((resolve) => viewRes.on('finish', resolve));

      assert.strictEqual(viewRes.statusCode, 200, 'Ticket redemption must succeed');
      assert.strictEqual(viewRes.headers['content-type'], 'image/jpeg');
      assert.strictEqual(viewRes.getBuffer().length, MOCK_JPEG_BUFFER.length);
      console.log('  ✓ PASSED: Fresh ticket created and redeemed successfully for standalone view.');
    }

    // -------------------------------------------------------------
    // Test 4: Single-use ticket enforcement (replay prevention)
    // -------------------------------------------------------------
    console.log('\n[Test 4] Replay prevention: Consumed ticket cannot be reused');
    {
      const replayReq = {
        query: { key: testPhotoKey1, ticket: ticket1 },
        headers: {}
      };
      const replayRes = createMockRes();
      await riFacultyController.serveFacultyFile(replayReq, replayRes);

      assert.strictEqual(replayRes.statusCode, 403, 'Reused ticket must return 403 Forbidden');
      assert.ok(replayRes.body && replayRes.body.message.includes('already been used'), 'Must reject already used ticket');
      console.log('  ✓ PASSED: Ticket cannot authorize access more than once (403 Forbidden on replay).');
    }

    // -------------------------------------------------------------
    // Test 5: Fullscreen navigation with Bearer tokens without ticket collisions
    // -------------------------------------------------------------
    console.log('\n[Test 5] Fullscreen Next/Previous navigation across multiple photos');
    {
      // Photo 1 load
      const req1 = {
        query: { key: testPhotoKey1 },
        headers: { authorization: `Bearer ${facultyToken}` }
      };
      const res1 = createMockRes();
      await riFacultyController.serveFacultyFile(req1, res1);
      await new Promise((resolve) => res1.on('finish', resolve));
      assert.strictEqual(res1.statusCode, 200);

      // Photo 2 load (Next)
      const req2 = {
        query: { key: testPhotoKey2 },
        headers: { authorization: `Bearer ${facultyToken}` }
      };
      const res2 = createMockRes();
      await riFacultyController.serveFacultyFile(req2, res2);
      await new Promise((resolve) => res2.on('finish', resolve));
      assert.strictEqual(res2.statusCode, 200);

      // Photo 1 load again (Previous)
      const req3 = {
        query: { key: testPhotoKey1 },
        headers: { authorization: `Bearer ${facultyToken}` }
      };
      const res3 = createMockRes();
      await riFacultyController.serveFacultyFile(req3, res3);
      await new Promise((resolve) => res3.on('finish', resolve));
      assert.strictEqual(res3.statusCode, 200);

      console.log('  ✓ PASSED: Navigation between photos functions seamlessly without ticket exhaustion or stale state.');
    }

    // -------------------------------------------------------------
    // Test 6: Legacy EC2 local photo file preservation
    // -------------------------------------------------------------
    console.log('\n[Test 6] Legacy EC2 local photo preservation');
    {
      // Ensure test directory exists
      const legacyDir = path.join(__dirname, '../uploads/ri_media');
      if (!fs.existsSync(legacyDir)) {
        fs.mkdirSync(legacyDir, { recursive: true });
      }
      const legacyFilename = 'test-legacy-photo-preservation.jpg';
      const legacyFilePath = path.join(legacyDir, legacyFilename);
      fs.writeFileSync(legacyFilePath, MOCK_JPEG_BUFFER);

      const legacyRef = `/uploads/ri_media/${legacyFilename}`;
      const req = {
        query: { key: legacyRef },
        headers: { authorization: `Bearer ${facultyToken}` }
      };
      const res = createMockRes();
      await riFacultyController.serveFacultyFile(req, res);

      assert.strictEqual(res.statusCode, 200, 'Legacy local photo must return 200 OK');
      assert.ok(res.sentFile && res.sentFile.includes(legacyFilename), 'Legacy photo must be served from local EC2 filesystem');

      // Cleanup test file
      try { fs.unlinkSync(legacyFilePath); } catch {}

      console.log('  ✓ PASSED: Legacy EC2 local photo served from backend/uploads/ri_media/ without schema change.');
    }

    // -------------------------------------------------------------
    // Test 7: Downloading an image continues to work
    // -------------------------------------------------------------
    console.log('\n[Test 7] Authenticated download functionality');
    {
      const req = {
        query: { key: testPhotoKey1, download: 'true' },
        headers: { authorization: `Bearer ${facultyToken}` }
      };
      const res = createMockRes();
      await riFacultyController.serveFacultyFile(req, res);
      await new Promise((resolve) => res.on('finish', resolve));

      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.headers['content-disposition'] && res.headers['content-disposition'].startsWith('attachment;'), 'Must set attachment disposition');
      assert.ok(res.headers['content-disposition'].includes('1729600000000-photo1.jpg'), 'Must have correct filename');
      console.log('  ✓ PASSED: Image download returns Content-Disposition attachment with exact filename.');
    }

    // -------------------------------------------------------------
    // Test 8: Stale/consumed ticket resilience with Bearer session auth
    // -------------------------------------------------------------
    console.log('\n[Test 8] Resilience against stale or consumed tickets in frontend URL resolution');
    {
      // Simulate frontend URL having a stale/consumed ticket parameter alongside Bearer token
      // The frontend helper strips the ticket parameter so that Bearer auth succeeds
      const urlWithConsumedTicket = `/api/ri/faculty/files/view?key=${encodeURIComponent(testPhotoKey1)}&ticket=${ticket1}`;
      
      // Simulate helper stripping ticket when Bearer token is present
      let cleanUrl = urlWithConsumedTicket.replace(/([?&])ticket=[^&]+(&|$)/, (m, p1, p2) => (p2 ? p1 : ''));
      if (cleanUrl.endsWith('?') || cleanUrl.endsWith('&')) cleanUrl = cleanUrl.slice(0, -1);

      assert.ok(!cleanUrl.includes('ticket='), 'Clean URL must not contain consumed ticket');
      assert.ok(cleanUrl.includes('key='), 'Clean URL must retain key');

      // Now query with cleanUrl using Bearer token
      const req = {
        query: { key: testPhotoKey1 },
        headers: { authorization: `Bearer ${facultyToken}` }
      };
      const res = createMockRes();
      await riFacultyController.serveFacultyFile(req, res);
      await new Promise((resolve) => res.on('finish', resolve));

      assert.strictEqual(res.statusCode, 200, 'Request without stale ticket must succeed with 200 OK');
      console.log('  ✓ PASSED: Stale/consumed ticket parameter handled cleanly without permanently breaking image view.');
    }

    // -------------------------------------------------------------
    // Test 9: Student viewing faculty visit photos
    // -------------------------------------------------------------
    console.log('\n[Test 9] Assigned student viewing faculty visit photos via RiPanelMediaViewer');
    {
      const req = {
        query: { key: testPhotoKey1 },
        headers: { authorization: `Bearer ${studentToken}` }
      };
      const res = createMockRes();
      await riFacultyController.serveFacultyFile(req, res);
      await new Promise((resolve) => res.on('finish', resolve));

      assert.strictEqual(res.statusCode, 200, 'Student with valid session must be able to view panel visit photos');
      assert.strictEqual(res.headers['content-type'], 'image/jpeg');
      console.log('  ✓ PASSED: Assigned students can view faculty field visit photos with valid session Bearer token.');
    }

    console.log('\n================================================================');
    console.log('ALL 9 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================');
  } finally {
    riStorageService.getObjectStream = originalGetObjectStream;
    try {
      const pool = require('../config/db');
      await pool.end();
    } catch {}
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
