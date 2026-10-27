import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

/**
 * Helper to split text into wrapped lines given a max width and font
 */
function wrapText(text, font, size, maxWidth) {
  if (!text || String(text).trim() === '') return ['—']
  const str = String(text).trim()
  
  // If no spaces (like long emails), split by characters
  if (!str.includes(' ')) {
    if (font.widthOfTextAtSize(str, size) <= maxWidth) return [str]
    const lines = []
    let current = ''
    for (const char of str) {
      if (font.widthOfTextAtSize(current + char, size) > maxWidth) {
        lines.push(current)
        current = char
      } else {
        current += char
      }
    }
    if (current) lines.push(current)
    return lines
  }

  const words = str.split(/\s+/)
  const lines = []
  let currentLine = ''

  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      if (currentLine) {
        lines.push(currentLine)
        currentLine = ''
      }
      let sub = ''
      for (const char of word) {
        if (font.widthOfTextAtSize(sub + char, size) > maxWidth) {
          lines.push(sub)
          sub = char
        } else {
          sub += char
        }
      }
      if (sub) currentLine = sub
      continue
    }

    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (font.widthOfTextAtSize(testLine, size) <= maxWidth) {
      currentLine = testLine
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines.length > 0 ? lines : ['—']
}

/**
 * generateFailedEmailsPdf
 * Generates a clean, professional vector PDF report using pdf-lib.
 * 100% reliable: no blank pages, real selectable text, automatic pagination.
 */
export async function generateFailedEmailsPdf({ failedList = [] }) {
  const pdfDoc = await PDFDocument.create()

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier)

  // A4 Landscape dimensions (841.89 x 595.28 pt)
  const PAGE_W = 841.89
  const PAGE_H = 595.28
  const MARGIN_X = 32
  const MARGIN_TOP = 36
  const MARGIN_BOTTOM = 36
  const CONTENT_W = PAGE_W - MARGIN_X * 2 // 777.89 pt

  // Colors
  const cNavyHeader = rgb(0.118, 0.227, 0.541) // #1e3a8a
  const cDarkSlate = rgb(0.059, 0.090, 0.165) // #0f172a
  const cSlate = rgb(0.278, 0.333, 0.412) // #475569
  const cMuted = rgb(0.580, 0.639, 0.722) // #94a3b8
  const cBlueText = rgb(0.114, 0.306, 0.847) // #1d4ed8
  const cRedText = rgb(0.863, 0.149, 0.149) // #dc2626
  const cBorder = rgb(0.886, 0.910, 0.941) // #e2e8f0
  const cAltBg = rgb(0.973, 0.980, 0.988) // #f8fafc
  const cWhite = rgb(1, 1, 1)

  // Column layout definition
  const columns = [
    { id: 'idx', label: '#', width: 32, align: 'center', font: fontBold, color: cMuted },
    { id: 'name', label: 'Name', width: 145, align: 'left', font: fontBold, color: cDarkSlate },
    { id: 'prn', label: 'PRN', width: 95, align: 'left', font: fontMono, color: cSlate },
    { id: 'email', label: 'Email', width: 195, align: 'left', font: fontRegular, color: cBlueText },
    { id: 'department', label: 'Department', width: 165, align: 'left', font: fontRegular, color: cSlate },
    { id: 'panel', label: 'Panel', width: 45, align: 'center', font: fontBold, color: cDarkSlate },
    { id: 'phone', label: 'Mobile Number', width: 100, align: 'left', font: fontMono, color: cSlate }
  ]

  const timestamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })

  let currentPage = null
  let currentY = 0

  function drawHeader(page) {
    // Top banner
    page.drawText('MIT WORLD PEACE UNIVERSITY • LIFE TRANSFORMATION CAMP (LTC)', {
      x: MARGIN_X,
      y: PAGE_H - MARGIN_TOP,
      size: 8.5,
      font: fontBold,
      color: cNavyHeader
    })

    // Document Title
    page.drawText('Failed & Suppressed Emails Audit Report', {
      x: MARGIN_X,
      y: PAGE_H - MARGIN_TOP - 18,
      size: 16,
      font: fontBold,
      color: cDarkSlate
    })

    // Subtitle
    page.drawText('Official record of undelivered, bounced, and suppressed student email dispatches', {
      x: MARGIN_X,
      y: PAGE_H - MARGIN_TOP - 32,
      size: 9,
      font: fontRegular,
      color: cSlate
    })

    // Stats Box on Right
    const statsBoxW = 230
    const statsBoxH = 38
    const statsBoxX = PAGE_W - MARGIN_X - statsBoxW
    const statsBoxY = PAGE_H - MARGIN_TOP - 34

    page.drawRectangle({
      x: statsBoxX,
      y: statsBoxY,
      width: statsBoxW,
      height: statsBoxH,
      color: cAltBg,
      borderColor: cBorder,
      borderWidth: 1
    })

    page.drawText(`Generated: ${timestamp}`, {
      x: statsBoxX + 10,
      y: statsBoxY + 22,
      size: 8.5,
      font: fontRegular,
      color: cSlate
    })

    page.drawText('Failed Records: ', {
      x: statsBoxX + 10,
      y: statsBoxY + 9,
      size: 8.5,
      font: fontBold,
      color: cDarkSlate
    })

    page.drawText(`${failedList.length}`, {
      x: statsBoxX + 85,
      y: statsBoxY + 9,
      size: 9,
      font: fontBold,
      color: cRedText
    })

    // Divider
    page.drawLine({
      start: { x: MARGIN_X, y: PAGE_H - MARGIN_TOP - 44 },
      end: { x: PAGE_W - MARGIN_X, y: PAGE_H - MARGIN_TOP - 44 },
      thickness: 1.5,
      color: cNavyHeader
    })
  }

  function drawTableHeaders(page, tableHeaderY) {
    const headerHeight = 22
    page.drawRectangle({
      x: MARGIN_X,
      y: tableHeaderY - headerHeight,
      width: CONTENT_W,
      height: headerHeight,
      color: cNavyHeader
    })

    let curX = MARGIN_X
    for (const col of columns) {
      let textX = curX + 6
      if (col.align === 'center') {
        const tw = fontBold.widthOfTextAtSize(col.label, 9)
        textX = curX + (col.width - tw) / 2
      }
      page.drawText(col.label, {
        x: textX,
        y: tableHeaderY - 14,
        size: 9,
        font: fontBold,
        color: cWhite
      })
      curX += col.width
    }
  }

  function addNewPage() {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H])
    drawHeader(page)
    const tableHeaderY = PAGE_H - MARGIN_TOP - 56
    drawTableHeaders(page, tableHeaderY)
    currentY = tableHeaderY - 22
    currentPage = page
    return page
  }

  // Add initial page
  addNewPage()

  const fontSize = 8.5
  const lineHeight = 11.5
  const rowPadV = 5

  for (let i = 0; i < failedList.length; i++) {
    const entry = failedList[i]

    // Calculate wrapped lines for all multi-line fields
    const nameLines = wrapText(entry.recipient_name, fontBold, fontSize, columns[1].width - 12)
    const prnLines = wrapText(entry.recipient_prn, fontMono, fontSize - 0.5, columns[2].width - 10)
    const emailLines = wrapText(entry.to_email, fontRegular, fontSize - 0.5, columns[3].width - 12)
    const deptLines = wrapText(entry.recipient_department, fontRegular, fontSize - 0.5, columns[4].width - 12)
    const panelLines = wrapText(entry.recipient_panel, fontBold, fontSize, columns[5].width - 8)
    const phoneLines = wrapText(entry.recipient_phone, fontMono, fontSize - 0.5, columns[6].width - 10)

    const maxLines = Math.max(
      nameLines.length,
      prnLines.length,
      emailLines.length,
      deptLines.length,
      panelLines.length,
      phoneLines.length,
      1
    )

    const rowHeight = maxLines * lineHeight + rowPadV * 2

    // Check if row fits on current page; if not, create new page
    if (currentY - rowHeight < MARGIN_BOTTOM + 20) {
      addNewPage()
    }

    const rowY = currentY - rowHeight

    // Alternating row background
    if (i % 2 === 1) {
      currentPage.drawRectangle({
        x: MARGIN_X,
        y: rowY,
        width: CONTENT_W,
        height: rowHeight,
        color: cAltBg
      })
    }

    // Row bottom border
    currentPage.drawLine({
      start: { x: MARGIN_X, y: rowY },
      end: { x: MARGIN_X + CONTENT_W, y: rowY },
      thickness: 0.5,
      color: cBorder
    })

    // Draw row content for each column
    let curX = MARGIN_X

    // 1. Index
    const idxStr = String(i + 1)
    const idxW = fontBold.widthOfTextAtSize(idxStr, fontSize)
    currentPage.drawText(idxStr, {
      x: curX + (columns[0].width - idxW) / 2,
      y: currentY - rowPadV - fontSize,
      size: fontSize,
      font: fontBold,
      color: cMuted
    })
    curX += columns[0].width

    // 2. Name
    for (let l = 0; l < nameLines.length; l++) {
      currentPage.drawText(nameLines[l], {
        x: curX + 6,
        y: currentY - rowPadV - (l + 1) * lineHeight + (lineHeight - fontSize),
        size: fontSize,
        font: fontBold,
        color: cDarkSlate
      })
    }
    curX += columns[1].width

    // 3. PRN
    for (let l = 0; l < prnLines.length; l++) {
      currentPage.drawText(prnLines[l], {
        x: curX + 6,
        y: currentY - rowPadV - (l + 1) * lineHeight + (lineHeight - (fontSize - 0.5)),
        size: fontSize - 0.5,
        font: fontMono,
        color: cSlate
      })
    }
    curX += columns[2].width

    // 4. Email
    for (let l = 0; l < emailLines.length; l++) {
      currentPage.drawText(emailLines[l], {
        x: curX + 6,
        y: currentY - rowPadV - (l + 1) * lineHeight + (lineHeight - (fontSize - 0.5)),
        size: fontSize - 0.5,
        font: fontRegular,
        color: cBlueText
      })
    }
    curX += columns[3].width

    // 5. Department
    for (let l = 0; l < deptLines.length; l++) {
      currentPage.drawText(deptLines[l], {
        x: curX + 6,
        y: currentY - rowPadV - (l + 1) * lineHeight + (lineHeight - (fontSize - 0.5)),
        size: fontSize - 0.5,
        font: fontRegular,
        color: cSlate
      })
    }
    curX += columns[4].width

    // 6. Panel
    for (let l = 0; l < panelLines.length; l++) {
      const pStr = panelLines[l]
      const pW = fontBold.widthOfTextAtSize(pStr, fontSize)
      currentPage.drawText(pStr, {
        x: curX + (columns[5].width - pW) / 2,
        y: currentY - rowPadV - (l + 1) * lineHeight + (lineHeight - fontSize),
        size: fontSize,
        font: fontBold,
        color: cDarkSlate
      })
    }
    curX += columns[5].width

    // 7. Mobile Phone
    for (let l = 0; l < phoneLines.length; l++) {
      currentPage.drawText(phoneLines[l], {
        x: curX + 6,
        y: currentY - rowPadV - (l + 1) * lineHeight + (lineHeight - (fontSize - 0.5)),
        size: fontSize - 0.5,
        font: fontMono,
        color: cSlate
      })
    }

    currentY = rowY
  }

  // Draw Page numbers and footer on all pages
  const totalPages = pdfDoc.getPageCount()
  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const p = pdfDoc.getPage(pIdx)

    // Top & Bottom bounding outer line on table (optional clean touch)
    p.drawLine({
      start: { x: MARGIN_X, y: MARGIN_BOTTOM + 16 },
      end: { x: PAGE_W - MARGIN_X, y: MARGIN_BOTTOM + 16 },
      thickness: 0.5,
      color: cBorder
    })

    // Footer Left
    p.drawText('LTC Automated Delivery & Audit System • MIT-WPU', {
      x: MARGIN_X,
      y: MARGIN_BOTTOM + 4,
      size: 8,
      font: fontRegular,
      color: cMuted
    })

    // Footer Right
    const pageStr = `Page ${pIdx + 1} of ${totalPages}   •   Confidential Audit Document`
    const pageW = fontRegular.widthOfTextAtSize(pageStr, 8)
    p.drawText(pageStr, {
      x: PAGE_W - MARGIN_X - pageW,
      y: MARGIN_BOTTOM + 4,
      size: 8,
      font: fontRegular,
      color: cMuted
    })
  }

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}
