import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

/**
 * generateCertificate(student, batch)
 *
 * Loads the Participants.pdf background template,
 * embeds and scales the pages to fit within clean A4 margins (preventing print clipping),
 * overlays the student name and batch dates using the custom Poppins font,
 * and triggers a PDF download.
 *
 * @param {Object} student  - { fullName: string }
 * @param {Object} batch    - { startDate: string, endDate: string }
 */
export async function generateCertificate(student, batch, pdfTemplate = 'Participants.pdf') {
  const rawFullName = student.fullName || '';
  const fullName = rawFullName.replace(/^(mr\.|ms\.|mrs\.|dr\.|prof\.|shri\.|smt\.|mr|ms|mrs|dr|prof|shri|smt)\s+/i, '').trim();
  const { ltcId } = student;
  const { startDate, endDate } = batch;

  // 1. Fetch the certificate template PDF
  const response = await fetch(`/${pdfTemplate}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch certificate template: ${pdfTemplate}`);
  }
  const arrayBuffer = await response.arrayBuffer();

  // 2. Load the source PDF and register fontkit
  const sourceDoc = await PDFDocument.load(new Uint8Array(arrayBuffer));
  const [sourcePage] = sourceDoc.getPages();

  // 3. Create a brand-new A4 printable document
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Add blank A4 page: Width = 595.2756, Height = 841.8898
  const A4_W = 595.2756;
  const A4_H = 841.8898;
  const page = pdfDoc.addPage([A4_W, A4_H]);

  // Embed the source page
  const [embeddedPage] = await pdfDoc.embedPages([sourcePage]);

  // 4. Scale down to fit margins (0.94 scale factor leaves safe print margins of 17.86pt left/right, 25.26pt top/bottom)
  const scale = 0.94;
  const drawWidth = A4_W * scale;
  const drawHeight = A4_H * scale;
  const dx = (A4_W - drawWidth) / 2;
  const dy = (A4_H - drawHeight) / 2;

  // Draw the original certificate centered and scaled
  page.drawPage(embeddedPage, {
    x: dx,
    y: dy,
    width: drawWidth,
    height: drawHeight
  });

  // 5. Fetch and embed Poppins fonts
  const [poppinsBoldBytes, poppinsRegularBytes, poppinsMediumBytes] = await Promise.all([
    fetch('/fonts/Poppins-Bold.ttf').then(res => res.arrayBuffer()),
    fetch('/fonts/Poppins-Regular.ttf').then(res => res.arrayBuffer()),
    fetch('/fonts/Poppins-Medium.ttf').then(res => res.arrayBuffer())
  ]);

  const poppinsBold = await pdfDoc.embedFont(poppinsBoldBytes);
  const poppinsRegular = await pdfDoc.embedFont(poppinsRegularBytes);
  const poppinsMedium = await pdfDoc.embedFont(poppinsMediumBytes);

  // 6. Format dates cleanly with ordinals, e.g. "19th to 23rd April 2026."
  const formatBatchDates = (startStr, endStr) => {
    try {
      const dStart = new Date(startStr);
      const dEnd = new Date(endStr);
      
      const getOrdinal = (d) => {
        if (d > 3 && d < 21) return 'th';
        switch (d % 10) {
          case 1:  return "st";
          case 2:  return "nd";
          case 3:  return "rd";
          default: return "th";
        }
      };

      const startDay = dStart.getDate();
      const startOrd = getOrdinal(startDay);
      const endDay = dEnd.getDate();
      const endOrd = getOrdinal(endDay);

      const startMonth = dStart.toLocaleDateString('en-US', { month: 'long' });
      const endMonth = dEnd.toLocaleDateString('en-US', { month: 'long' });
      const startYear = dStart.getFullYear();
      const endYear = dEnd.getFullYear();

      if (dStart.toDateString() === dEnd.toDateString()) {
        return `${startDay}${startOrd} ${startMonth} ${startYear}.`;
      }

      if (startYear !== endYear) {
        return `${startDay}${startOrd} ${startMonth} ${startYear} to ${endDay}${endOrd} ${endMonth} ${endYear}.`;
      } else if (startMonth !== endMonth) {
        return `${startDay}${startOrd} ${startMonth} to ${endDay}${endOrd} ${endMonth} ${startYear}.`;
      } else {
        return `${startDay}${startOrd} to ${endDay}${endOrd} ${startMonth} ${startYear}.`;
      }
    } catch {
      return `${startStr} to ${endStr}`;
    }
  };

  const dateText = formatBatchDates(startDate, endDate);

  // 7. Draw Student Name (Centered on the scaled canvas, base coordinate Y: 512)
  let nameSize = 25 * scale;
  let nameWidth = poppinsMedium.widthOfTextAtSize(fullName, nameSize);
  // Cap name width to 400pt to prevent overflow
  while (nameWidth > (400 * scale) && nameSize > (15 * scale)) {
    nameSize -= 0.5 * scale;
    nameWidth = poppinsMedium.widthOfTextAtSize(fullName, nameSize);
  }
  const nameX = (A4_W / 2) - (nameWidth / 2);
  const nameY = dy + 512 * scale;

  page.drawText(fullName, {
    x: nameX,
    y: nameY,
    size: nameSize,
    font: poppinsMedium,
    color: rgb(0.06, 0.05, 0.17)
  });

  // 7.5. Draw Student LTC ID in the top right, in small font, if available
  if (ltcId) {
    const ltcText = `LTC ID: ${ltcId}`;
    const ltcSize = 8.5;
    const ltcWidth = poppinsRegular.widthOfTextAtSize(ltcText, ltcSize);
    const ltcX = A4_W - ltcWidth - 35;
    const ltcY = A4_H - 30;
    page.drawText(ltcText, {
      x: ltcX,
      y: ltcY,
      size: ltcSize,
      font: poppinsRegular,
      color: rgb(0.06, 0.05, 0.17)
    });
  }

  // 8. Cover the old date placeholder and draw dynamic batch dates in Poppins font
  // Draw white rectangle to erase "19  to 23  April 2026."
  page.drawRectangle({
    x: dx + 258 * scale,
    y: dy + 375 * scale,
    width: 250 * scale,
    height: 22 * scale,
    color: rgb(1, 1, 1)
  });

  // Draw dynamic batch dates at X: dx + 258*scale, Y: dy + 386.0*scale (scaled and raised for perfect alignment)
  const datesSize = 13.5 * scale;
  const datesX = dx + 258 * scale;
  const datesY = dy + 386.0 * scale;
  page.drawText(dateText, {
    x: datesX,
    y: datesY,
    size: datesSize,
    font: poppinsRegular,
    color: rgb(0.06, 0.05, 0.17)
  });

  // 8.5 Draw LTC ID at the bottom center of the certificate
  if (ltcId) {
    const ltcIdText = `LTC ID: ${ltcId}`;
    const ltcIdSize = 10 * scale;
    const ltcIdWidth = poppinsRegular.widthOfTextAtSize(ltcIdText, ltcIdSize);
    const ltcIdX = (A4_W / 2) - (ltcIdWidth / 2);
    const ltcIdY = dy + 70 * scale; // Clean distance from the bottom margin of the certificate card
    page.drawText(ltcIdText, {
      x: ltcIdX,
      y: ltcIdY,
      size: ltcIdSize,
      font: poppinsRegular,
      color: rgb(0.06, 0.05, 0.17)
    });
  }

  // 9. Save and trigger download
  const pdfBytes = await pdfDoc.save();
  const safeFileName = `Certificate_${fullName.trim().replace(/\s+/g, '_')}.pdf`;

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
