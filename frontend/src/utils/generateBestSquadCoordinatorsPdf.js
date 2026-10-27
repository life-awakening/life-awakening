import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Helper to draw text with left/center/right alignment and optional max width
 */
function drawText(page, text, { x, y, size = 10, font, color = rgb(0, 0, 0), align = 'left', maxWidth }) {
  if (text === undefined || text === null) return;
  const str = String(text);
  let textWidth = font.widthOfTextAtSize(str, size);
  let finalStr = str;
  if (maxWidth && textWidth > maxWidth) {
    let truncated = str;
    while (truncated.length > 3 && font.widthOfTextAtSize(truncated + '...', size) > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    finalStr = truncated + '...';
    textWidth = font.widthOfTextAtSize(finalStr, size);
  }
  let drawX = x;
  if (align === 'center') {
    drawX = x - textWidth / 2;
  } else if (align === 'right') {
    drawX = x - textWidth;
  }
  page.drawText(finalStr, { x: drawX, y, size, font, color });
}

/**
 * generateBestSquadCoordinatorsPdf
 * Premium, clean institutional Best Squad Coordinators Leaderboard PDF report.
 * Contains: Rank, Squad Coordinator Name, and Total Best Squad Wins.
 */
export async function generateBestSquadCoordinatorsPdf({
  leaderboard = []
}) {
  const pdfDoc = await PDFDocument.create();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Standard A4 dimensions (595.28 x 841.89 pt)
  const A4_W = 595.28;
  const A4_H = 841.89;

  const reportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Color Palette - Institutional Theme matching LTC Leaderboard
  const cPrimaryBlue = rgb(0.082, 0.263, 0.533); // #154388 (LTC Primary Accent)
  const cDarkSlate = rgb(0.059, 0.090, 0.165); // #0f172a
  const cMutedSlate = rgb(0.392, 0.455, 0.545); // #64748b
  const cRowBorder = rgb(0.886, 0.910, 0.941); // #e2e8f0
  const cRowAltBg = rgb(0.973, 0.980, 0.988); // #f8fafc
  const cWhite = rgb(1, 1, 1);
  const cGold = rgb(0.706, 0.325, 0.035); // #b45309
  const cSilver = rgb(0.278, 0.333, 0.412); // #475569
  const cBronze = rgb(0.761, 0.255, 0.047); // #c2410c

  const contentX = 38;
  const contentW = A4_W - 76; // 519.28

  // Layout parameters
  const rowsPerPage = 12;
  const rowH = Math.min(48, Math.max(34, Math.floor(540 / Math.max(leaderboard.length, 1))));
  const totalPages = Math.max(1, Math.ceil(leaderboard.length / rowsPerPage));

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const page = pdfDoc.addPage([A4_W, A4_H]);

    // 1. Thick, Crisp LTC Blue Outer Border around the page
    const borderWidth = 3.5;
    page.drawRectangle({
      x: 22,
      y: 22,
      width: A4_W - 44,
      height: A4_H - 44,
      borderWidth: borderWidth,
      borderColor: cPrimaryBlue,
      color: cWhite
    });

    // 2. Minimal, High-End Centered Header
    const headerTopY = 774;
    const centerX = contentX + contentW / 2;

    drawText(page, 'Best Squad Coordinators', {
      x: centerX,
      y: headerTopY,
      size: 24,
      font: fontBold,
      align: 'center',
      color: cPrimaryBlue
    });

    drawText(page, `Championship Wins Leaderboard   •   Date: ${reportDate}`, {
      x: centerX,
      y: headerTopY - 22,
      size: 10,
      font: fontRegular,
      align: 'center',
      color: cMutedSlate
    });

    // Symmetrical Accent Line under header
    page.drawRectangle({
      x: contentX,
      y: headerTopY - 33,
      width: contentW,
      height: 2.5,
      color: cPrimaryBlue
    });

    // 3. Leaderboard Table
    const tableTopY = headerTopY - 44;
    const tableHeaderH = 34;

    // Table Header Background
    page.drawRectangle({
      x: contentX,
      y: tableTopY - tableHeaderH,
      width: contentW,
      height: tableHeaderH,
      color: cPrimaryBlue
    });

    // Column Coordinates (4 columns: Rank, Squad Coordinator, Best Squad Wins, Batches)
    const colX = {
      rank: contentX + 24,
      coordinator: contentX + 58,
      wins: contentX + 242,
      batches: contentX + 312
    };

    // Draw Table Headers
    const thTextY = tableTopY - tableHeaderH + 12;
    drawText(page, 'RANK', { x: colX.rank, y: thTextY, size: 9, font: fontBold, align: 'center', color: cWhite });
    drawText(page, 'SQUAD COORDINATOR', { x: colX.coordinator, y: thTextY, size: 9, font: fontBold, align: 'left', color: cWhite });
    drawText(page, 'BEST SQUAD WINS', { x: colX.wins, y: thTextY, size: 9, font: fontBold, align: 'center', color: cWhite });
    drawText(page, 'BATCHES', { x: colX.batches, y: thTextY, size: 9, font: fontBold, align: 'left', color: cWhite });

    // Page items slice
    const pageItems = leaderboard.slice(pIdx * rowsPerPage, (pIdx + 1) * rowsPerPage);

    pageItems.forEach((item, localIdx) => {
      const globalIdx = pIdx * rowsPerPage + localIdx;
      const rank = item.rank !== undefined ? item.rank : (globalIdx + 1);
      const rowY = tableTopY - tableHeaderH - (localIdx + 1) * rowH;
      const winsCount = item.winsCount || 0;
      const batchesList = (item.batches && item.batches.length > 0)
        ? item.batches
        : (item.winningBatches || []).map(wb => wb.batchName);
      const batchesText = batchesList.length > 0 ? batchesList.join(', ') : '—';

      // Row Background with subtle Gold, Silver, Bronze styling for top 3
      let rowBg = localIdx % 2 === 0 ? cWhite : cRowAltBg;
      let rankColor = cDarkSlate;

      if (rank === 1) {
        rowBg = rgb(1.0, 0.984, 0.933); // #fffbeb (Warm Gold tint)
        rankColor = cGold;
      } else if (rank === 2) {
        rowBg = rgb(0.965, 0.973, 0.984); // #f1f5f9 (Refined Silver tint)
        rankColor = cSilver;
      } else if (rank === 3) {
        rowBg = rgb(1.0, 0.969, 0.937); // #fff7ed (Soft Bronze tint)
        rankColor = cBronze;
      }

      page.drawRectangle({
        x: contentX,
        y: rowY,
        width: contentW,
        height: rowH,
        color: rowBg
      });

      // Row bottom separator line
      page.drawLine({
        start: { x: contentX, y: rowY },
        end: { x: contentX + contentW, y: rowY },
        thickness: 0.75,
        color: cRowBorder
      });

      const textY = rowY + Math.floor(rowH / 2) - 4;

      // Draw Rank, Coordinator Name, Wins Count, and Batches
      drawText(page, String(rank), { x: colX.rank, y: textY, size: 11, font: fontBold, align: 'center', color: rankColor });
      drawText(page, item.coordinatorName || 'Squad Coordinator', {
        x: colX.coordinator,
        y: textY,
        size: 11,
        font: fontBold,
        align: 'left',
        color: cDarkSlate,
        maxWidth: 175
      });
      drawText(page, String(winsCount), { x: colX.wins, y: textY, size: 12, font: fontBold, align: 'center', color: cPrimaryBlue });
      drawText(page, batchesText, {
        x: colX.batches,
        y: textY,
        size: 9.5,
        font: fontRegular,
        align: 'left',
        color: cDarkSlate,
        maxWidth: 195
      });
    });

    // Table Outer Box Border
    const pageTableH = tableHeaderH + pageItems.length * rowH;
    page.drawRectangle({
      x: contentX,
      y: tableTopY - pageTableH,
      width: contentW,
      height: pageTableH,
      borderWidth: 1.5,
      borderColor: cPrimaryBlue
    });

    // 4. Clean Institutional Footer
    const footerY = 46;
    page.drawLine({
      start: { x: contentX, y: footerY + 16 },
      end: { x: contentX + contentW, y: footerY + 16 },
      thickness: 0.75,
      color: cRowBorder
    });

    drawText(page, 'Life Transformation Centre', {
      x: contentX,
      y: footerY,
      size: 9,
      font: fontRegular,
      color: cMutedSlate
    });

    const pageText = totalPages > 1 ? `Page ${pIdx + 1} of ${totalPages}   •   Official Coordinator Leaderboard` : 'Official Coordinator Leaderboard';
    drawText(page, pageText, {
      x: contentX + contentW,
      y: footerY,
      size: 9,
      font: fontRegular,
      align: 'right',
      color: cMutedSlate
    });
  }

  const pdfBytes = await pdfDoc.save();
  if (!pdfBytes || pdfBytes.length === 0) {
    throw new Error('Generated PDF byte array is empty.');
  }

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `LTC_Best_Squad_Coordinators_Leaderboard_${new Date().toISOString().slice(0, 10)}.pdf`;
  if (a.style) {
    a.style.display = 'none';
  }
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    if (a.parentNode) {
      document.body.removeChild(a);
    }
    if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
      URL.revokeObjectURL(url);
    }
  }, 10000);

  return blob;
}
