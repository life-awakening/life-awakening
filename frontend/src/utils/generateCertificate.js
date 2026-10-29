import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

/**
 * generateCertificate(student, batch, pdfTemplate)
 *
 * Loads the Certificate_-_Life_Awakening_Program_signed_final.pdf background template,
 * overlays the student's full name in the dedicated area centered horizontally,
 * and triggers an instant high-quality PDF download.
 *
 * @param {Object} student  - { fullName: string, ltcId?: string }
 * @param {Object} batch    - { startDate?: string, endDate?: string }
 * @param {string} pdfTemplate - default 'Certificate_-_Life_Awakening_Program_signed_final.pdf'
 */
export async function generateCertificate(
  student,
  batch = {},
  pdfTemplate = 'Certificate_-_Life_Awakening_Program_signed_final.pdf'
) {
  const rawFullName = student?.fullName || student?.name || 'Student';
  // Strip common salutations cleanly
  const fullName = rawFullName
    .replace(/^(mr\.|ms\.|mrs\.|dr\.|prof\.|shri\.|smt\.|mr|ms|mrs|dr|prof|shri|smt)\s+/i, '')
    .trim();

  // 1. Fetch the certificate template PDF
  // Try preferred template, fallback to Participants.pdf if needed
  let response = await fetch(`/${pdfTemplate}`);
  if (!response.ok) {
    response = await fetch('/Certificate_-_Life_Awakening_Program_signed_final.pdf');
  }
  if (!response.ok) {
    response = await fetch('/Participants.pdf');
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch certificate template: ${pdfTemplate}`);
  }
  const arrayBuffer = await response.arrayBuffer();

  // 2. Load the source PDF and register fontkit
  const sourceDoc = await PDFDocument.load(new Uint8Array(arrayBuffer));
  sourceDoc.registerFontkit(fontkit);
  const [page] = sourceDoc.getPages();
  const { width: pageWidth, height: pageHeight } = page.getSize();

  // 3. Fetch and embed Poppins fonts
  let poppinsFont = null;
  try {
    const [mediumBytes, boldBytes] = await Promise.all([
      fetch('/fonts/Poppins-Medium.ttf').then(res => res.ok ? res.arrayBuffer() : null).catch(() => null),
      fetch('/fonts/Poppins-Bold.ttf').then(res => res.ok ? res.arrayBuffer() : null).catch(() => null)
    ]);
    if (mediumBytes) {
      poppinsFont = await sourceDoc.embedFont(mediumBytes);
    } else if (boldBytes) {
      poppinsFont = await sourceDoc.embedFont(boldBytes);
    }
  } catch (fontErr) {
    console.warn('Failed to load custom Poppins font, using standard font fallback:', fontErr);
  }

  // 4. Calculate student name size and coordinates
  // On Certificate_-_Life_Awakening_Program_signed_final.pdf:
  // "This is to certify that" baseline is Y ≈ 543.9
  // "has actively participated in the" baseline is Y ≈ 490.0
  // Midpoint is ~517, baseline at Y = 514 provides perfect vertical balance.
  let nameSize = 24;
  let nameWidth = poppinsFont ? poppinsFont.widthOfTextAtSize(fullName, nameSize) : (fullName.length * 12);
  const maxAllowedWidth = 440;

  if (poppinsFont) {
    while (nameWidth > maxAllowedWidth && nameSize > 13) {
      nameSize -= 0.5;
      nameWidth = poppinsFont.widthOfTextAtSize(fullName, nameSize);
    }
  }

  const nameX = (pageWidth - nameWidth) / 2;
  const nameY = 514;

  const fontColor = rgb(0.06, 0.05, 0.17); // Rich dark navy (#0f0d2b) matching template typography

  if (poppinsFont) {
    page.drawText(fullName, {
      x: nameX,
      y: nameY,
      size: nameSize,
      font: poppinsFont,
      color: fontColor
    });
  } else {
    page.drawText(fullName, {
      x: nameX,
      y: nameY,
      size: nameSize,
      color: fontColor
    });
  }

  // 5. Save and trigger download
  const pdfBytes = await sourceDoc.save();
  const safeFileName = `Certificate_Life_Awakening_Program_${fullName.trim().replace(/\s+/g, '_')}.pdf`;

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
