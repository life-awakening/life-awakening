import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

/**
 * Helper to draw text with left/center/right alignment and optional max width
 */
function drawText(page, text, { x, y, size = 10, font, color = rgb(0, 0, 0), align = 'left', maxWidth }) {
  if (text === undefined || text === null) return
  const str = String(text)
  let textWidth = font.widthOfTextAtSize(str, size)
  let finalStr = str
  if (maxWidth && textWidth > maxWidth) {
    let truncated = str
    while (truncated.length > 3 && font.widthOfTextAtSize(truncated + '...', size) > maxWidth) {
      truncated = truncated.slice(0, -1)
    }
    finalStr = truncated + '...'
    textWidth = font.widthOfTextAtSize(finalStr, size)
  }
  let drawX = x
  if (align === 'center') {
    drawX = x - textWidth / 2
  } else if (align === 'right') {
    drawX = x - textWidth
  }
  page.drawText(finalStr, { x: drawX, y, size, font, color })
}

/**
 * generateSquadLeaderboardPdf
 * Premium, clean institutional LTC Squad Performance Leaderboard PDF report.
 * Contains: Rank, Squad Name, and Overall Score.
 */
export async function generateSquadLeaderboardPdf({
  currentBatch,
  leaderboard = []
}) {
  const pdfDoc = await PDFDocument.create()

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Standard A4 dimensions (595.28 x 841.89 pt)
  const A4_W = 595.28
  const A4_H = 841.89
  const page = pdfDoc.addPage([A4_W, A4_H])

  const batchName = currentBatch?.name || 'Active Batch'
  const reportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  // Color Palette - Institutional Professional Theme
  const cPrimaryBlue = rgb(0.082, 0.263, 0.533) // #154388 (LTC Primary Accent)
  const cDarkSlate = rgb(0.059, 0.090, 0.165) // #0f172a
  const cMutedSlate = rgb(0.392, 0.455, 0.545) // #64748b
  const cRowBorder = rgb(0.886, 0.910, 0.941) // #e2e8f0
  const cRowAltBg = rgb(0.973, 0.980, 0.988) // #f8fafc
  const cWhite = rgb(1, 1, 1)
  const cGold = rgb(0.706, 0.325, 0.035) // #b45309
  const cSilver = rgb(0.278, 0.333, 0.412) // #475569
  const cBronze = rgb(0.761, 0.255, 0.047) // #c2410c

  // 1. Thick, Crisp LTC Blue Outer Border around the page
  const borderWidth = 3.5
  page.drawRectangle({
    x: 22,
    y: 22,
    width: A4_W - 44,
    height: A4_H - 44,
    borderWidth: borderWidth,
    borderColor: cPrimaryBlue,
    color: cWhite
  })

  const contentX = 38
  const contentW = A4_W - 76 // 519.28

  // 2. Minimal, High-End Centered Header
  const headerTopY = 774
  const centerX = contentX + contentW / 2

  drawText(page, 'LTC Leaderboard', {
    x: centerX,
    y: headerTopY,
    size: 25,
    font: fontBold,
    align: 'center',
    color: cPrimaryBlue
  })

  drawText(page, `Batch: ${batchName}   •   Date: ${reportDate}`, {
    x: centerX,
    y: headerTopY - 22,
    size: 10,
    font: fontRegular,
    align: 'center',
    color: cMutedSlate
  })

  // Symmetrical Accent Line under header
  page.drawRectangle({
    x: contentX,
    y: headerTopY - 33,
    width: contentW,
    height: 2.5,
    color: cPrimaryBlue
  })

  // 3. Leaderboard Table
  const tableTopY = headerTopY - 44
  const tableHeaderH = 34

  // Table Header Background
  page.drawRectangle({
    x: contentX,
    y: tableTopY - tableHeaderH,
    width: contentW,
    height: tableHeaderH,
    color: cPrimaryBlue
  })

  // Column X Coordinates across 519.28pt content width (3 columns: Rank, Squad Name, Overall Score)
  const colX = {
    rank: contentX + 35,
    squad: contentX + 90,
    score: contentX + contentW - 25
  }

  // Draw Table Headers
  const thTextY = tableTopY - tableHeaderH + 12
  drawText(page, 'RANK', { x: colX.rank, y: thTextY, size: 9.5, font: fontBold, align: 'center', color: cWhite })
  drawText(page, 'SQUAD NAME', { x: colX.squad, y: thTextY, size: 9.5, font: fontBold, align: 'left', color: cWhite })
  drawText(page, 'OVERALL SCORE', { x: colX.score, y: thTextY, size: 9.5, font: fontBold, align: 'right', color: cWhite })

  // 10 Rows with 59pt height filling the page cleanly
  const rowH = 59
  leaderboard.forEach((item, idx) => {
    const hasActivity = (item.overall_score || 0) > 0 || (item.first_count || 0) > 0 || (item.count || 0) > 0;
    let rank = null;
    if (hasActivity) {
      if (idx === 0) {
        rank = 1;
      } else {
        const prev = leaderboard[idx - 1];
        const scoreDiff = Math.abs((item.overall_score || 0) - (prev.overall_score || 0));
        const samePunc = (item.punctuality_rank ?? 99) === (prev.punctuality_rank ?? 99);
        const sameFirst = (item.first_count || 0) === (prev.first_count || 0);
        if (scoreDiff < 0.0001 && samePunc && sameFirst) {
          const firstMatch = leaderboard.findIndex(x =>
            Math.abs((x.overall_score || 0) - (item.overall_score || 0)) < 0.0001 &&
            (x.punctuality_rank ?? 99) === (item.punctuality_rank ?? 99) &&
            (x.first_count || 0) === (item.first_count || 0)
          );
          rank = firstMatch >= 0 ? firstMatch + 1 : 1;
        } else {
          rank = idx + 1;
        }
      }
    }
    const rowY = tableTopY - tableHeaderH - (idx + 1) * rowH
    const scoreStr = (item.overall_score ?? 0).toFixed(2)

    // Clean squad name without "Squad " prefix
    const cleanSquadName = (item.squad || '').replace(/^squad\s+/i, '').trim()

    // Row Background with subtle elegant Gold, Silver, Bronze styling for top 3
    let rowBg = idx % 2 === 0 ? cWhite : cRowAltBg
    let rankColor = cDarkSlate

    if (rank === 1) {
      rowBg = rgb(1.0, 0.984, 0.933) // #fffbeb (Warm Gold tint)
      rankColor = cGold
    } else if (rank === 2) {
      rowBg = rgb(0.965, 0.973, 0.984) // #f1f5f9 (Refined Silver tint)
      rankColor = cSilver
    } else if (rank === 3) {
      rowBg = rgb(1.0, 0.969, 0.937) // #fff7ed (Soft Bronze tint)
      rankColor = cBronze
    }

    page.drawRectangle({
      x: contentX,
      y: rowY,
      width: contentW,
      height: rowH,
      color: rowBg
    })

    // Row bottom separator line
    page.drawLine({
      start: { x: contentX, y: rowY },
      end: { x: contentX + contentW, y: rowY },
      thickness: 0.75,
      color: cRowBorder
    })

    const textY = rowY + 23

    // Rank, Squad Name & Overall Score
    drawText(page, rank ? String(rank) : '-', { x: colX.rank, y: textY, size: 14, font: fontBold, align: 'center', color: rankColor })
    drawText(page, cleanSquadName, { x: colX.squad, y: textY, size: 14.5, font: fontBold, align: 'left', color: cDarkSlate })
    drawText(page, scoreStr, { x: colX.score, y: textY, size: 16, font: fontBold, align: 'right', color: cPrimaryBlue })
  })

  // Table Outer Box Border
  const tableTotalH = tableHeaderH + 10 * rowH
  page.drawRectangle({
    x: contentX,
    y: tableTopY - tableTotalH,
    width: contentW,
    height: tableTotalH,
    borderWidth: 1.5,
    borderColor: cPrimaryBlue
  })

  // 4. Clean Footer
  const footerY = 46
  page.drawLine({
    start: { x: contentX, y: footerY + 16 },
    end: { x: contentX + contentW, y: footerY + 16 },
    thickness: 0.75,
    color: cRowBorder
  })

  drawText(page, 'Life Transformation Centre', {
    x: contentX,
    y: footerY,
    size: 9,
    font: fontRegular,
    color: cMutedSlate
  })

  drawText(page, 'Official Standings Report', {
    x: contentX + contentW,
    y: footerY,
    size: 9,
    font: fontRegular,
    align: 'right',
    color: cMutedSlate
  })

  const pdfBytes = await pdfDoc.save()
  if (!pdfBytes || pdfBytes.length === 0) {
    throw new Error('Generated PDF byte array is empty.')
  }

  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const batchNameClean = (currentBatch?.name || 'Batch').replace(/[^a-zA-Z0-9_-]/g, '_')
  a.href = url
  a.download = `LTC_Squad_Leaderboard_${batchNameClean}_${new Date().toISOString().slice(0, 10)}.pdf`
  if (a.style) {
    a.style.display = 'none'
  }
  document.body.appendChild(a)
  a.click()

  setTimeout(() => {
    if (a.parentNode) {
      document.body.removeChild(a)
    }
    if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
      URL.revokeObjectURL(url)
    }
  }, 10000)

  return blob
}
