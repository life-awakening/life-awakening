const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PDFDocument, rgb } = require('pdf-lib');
const { convertPdfBufferToImages } = require('../controllers/ltcReportController');

function assert(condition, msg) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(msg);
  } else {
    console.log(`✅ PASSED: ${msg}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('TESTING PDF-TO-IMAGE CONVERSION (NODE.JS + PUPPETEER)');
  console.log('====================================================\n');

  // Test 1: Empty or null buffer returns []
  console.log('--- 1. Testing Empty / Null Buffer ---');
  const emptyRes1 = await convertPdfBufferToImages(null);
  assert(Array.isArray(emptyRes1) && emptyRes1.length === 0, 'null buffer returns empty array');
  const emptyRes2 = await convertPdfBufferToImages(Buffer.alloc(0));
  assert(Array.isArray(emptyRes2) && emptyRes2.length === 0, 'empty buffer returns empty array');

  // Test 2: Invalid / Corrupt PDF throws diagnostic error
  console.log('\n--- 2. Testing Invalid / Corrupted PDF Buffer ---');
  let threw = false;
  try {
    await convertPdfBufferToImages(Buffer.from('not a real pdf content'));
  } catch (err) {
    threw = true;
    assert(err.message.includes('Failed to parse PDF document'), `Throws clear diagnostic: "${err.message}"`);
  }
  assert(threw, 'Invalid PDF buffer properly throws error');

  // Test 3: Multi-page sample PDF conversion
  console.log('\n--- 3. Testing Real Sample Multi-Page PDF Conversion ---');
  const pdfDoc = await PDFDocument.create();

  // Page 1
  const page1 = pdfDoc.addPage([595, 842]); // A4
  page1.drawRectangle({
    x: 40,
    y: 750,
    width: 515,
    height: 50,
    color: rgb(0.1, 0.4, 0.8)
  });
  page1.drawText('ANNEXURE 1: SAMPLE ATTENDANCE REGISTER - PAGE 1', {
    x: 60,
    y: 770,
    size: 14,
    color: rgb(1, 1, 1)
  });
  page1.drawText('Student 101: Present', { x: 60, y: 700, size: 12 });
  page1.drawText('Student 102: Present', { x: 60, y: 670, size: 12 });

  // Page 2
  const page2 = pdfDoc.addPage([595, 842]); // A4
  page2.drawRectangle({
    x: 40,
    y: 750,
    width: 515,
    height: 50,
    color: rgb(0.1, 0.6, 0.3)
  });
  page2.drawText('ANNEXURE 1: SAMPLE ATTENDANCE REGISTER - PAGE 2', {
    x: 60,
    y: 770,
    size: 14,
    color: rgb(1, 1, 1)
  });
  page2.drawText('Student 103: Present', { x: 60, y: 700, size: 12 });
  page2.drawText('Student 104: Present', { x: 60, y: 670, size: 12 });

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);
  console.log(`Generated sample 2-page PDF (${pdfBuffer.length} bytes)`);

  const startTime = Date.now();
  const pageImages = await convertPdfBufferToImages(pdfBuffer);
  const elapsed = Date.now() - startTime;

  console.log(`Conversion completed in ${elapsed}ms. Pages converted: ${pageImages.length}`);
  assert(pageImages.length === 2, `Should convert exactly 2 pages, got ${pageImages.length}`);

  pageImages.forEach((imgUri, idx) => {
    assert(typeof imgUri === 'string', `Page ${idx + 1} output is string`);
    assert(imgUri.startsWith('data:image/png;base64,'), `Page ${idx + 1} has data:image/png;base64 prefix`);
    const base64Data = imgUri.replace('data:image/png;base64,', '');
    assert(base64Data.length > 1000, `Page ${idx + 1} base64 payload is non-trivial (${base64Data.length} chars)`);
  });

  console.log('\n====================================================');
  console.log('🎉 ALL PDF-TO-IMAGE CONVERSION TESTS PASSED!');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
