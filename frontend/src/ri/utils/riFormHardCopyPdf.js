import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  COMMUNITY_PROJECT_OPTIONS,
  YES_NO_OPTIONS,
  FORM_IIIB_META
} from '../shared/riDailyActivitySchema.js';
import {
  INSTITUTION_FORM_SECTIONS,
  INSTITUTION_TYPES_OPTIONS
} from '../shared/riInstitutionSchema.js';
import {
  FAMILY_SURVEY_SECTIONS
} from '../shared/riFamilySurveySchema.js';
import {
  FORM_VI_SECTIONS,
  FORM_VI_META,
  COMMITTEE_REMARKS_OPTIONS
} from '../shared/riProblemIdentificationSchema.js';

// ── Text Sanitization for pdf-lib Standard Fonts ──────────────────────────────
export function sanitizeText(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes
    .replace(/\u2013/g, '-')         // en dash
    .replace(/\u2014/g, '--')        // em dash
    .replace(/\u2022/g, '-')         // bullet
    .replace(/\u00A0/g, ' ')         // non-breaking space
    .replace(/[^\x20-\x7E\n\r\t]/g, ''); // filter out non-WinAnsi characters
}

// ── Helper to resolve current student details ──────────────────────────────────
export function getActiveStudentContext(providedContext = {}) {
  let user = {};
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      user = JSON.parse(window.localStorage.getItem('user') || '{}');
    } catch {
      user = {};
    }
  }
  return {
    student_name: providedContext.student_name || user.name || '',
    prn: providedContext.prn || providedContext.roll_number || user.prn || user.roll_no || '',
    school_name: providedContext.school_name || user.school_name || '',
    degree_program: providedContext.degree_program || user.degree_program || user.department || '',
    village_name: providedContext.village_name || providedContext.village_visited || '',
    batch_name: providedContext.batch_name || '',
    panel_name: providedContext.panel_name || (providedContext.panel_number ? `Panel #${providedContext.panel_number}` : ''),
    date: providedContext.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    ...providedContext
  };
}

// ── Word Wrapping Utility ──────────────────────────────────────────────────────
function wrapText(text, font, size, maxWidth) {
  const clean = sanitizeText(text).trim();
  if (!clean) return [];

  const paragraphs = clean.split('\n');
  const allLines = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      allLines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(testLine, size) <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) allLines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) allLines.push(currentLine);
  }

  return allLines;
}

// ── Printable PDF Document Engine ──────────────────────────────────────────────
export class PrintablePdfDoc {
  constructor({ title, formCode, annexure, studentContext = {} }) {
    this.title = title;
    this.formCode = formCode;
    this.annexure = annexure;
    this.studentContext = getActiveStudentContext(studentContext);

    // A4 Portrait dimensions in points
    this.PAGE_W = 595.28;
    this.PAGE_H = 841.89;
    this.MARGIN_X = 40;
    this.MARGIN_TOP = 42;
    this.MARGIN_BOTTOM = 44;
    this.CONTENT_W = this.PAGE_W - this.MARGIN_X * 2; // 515.28 pt

    // Institutional Color Palette
    this.cGreen = rgb(0.04, 0.42, 0.28);      // #0a6c47 - primary institutional green
    this.cDarkGreen = rgb(0.02, 0.31, 0.23);  // #064e3b - deep green
    this.cDark = rgb(0.08, 0.1, 0.14);        // #141923 - black/charcoal text
    this.cText = rgb(0.18, 0.22, 0.28);       // #2e3847 - standard body text
    this.cMuted = rgb(0.42, 0.48, 0.55);      // #6b7a8d - subtitles / instructions
    this.cBorder = rgb(0.8, 0.83, 0.86);      // #cbd5e1 - soft borders
    this.cLightBorder = rgb(0.9, 0.92, 0.94); // #e5e7eb - writing lines
    this.cLightBg = rgb(0.96, 0.97, 0.98);    // #f4f6f8 - section heading fills
    this.cWhite = rgb(1, 1, 1);
  }

  async init() {
    this.pdfDoc = await PDFDocument.create();
    this.fontReg = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);
    this.fontItalic = await this.pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    this.pages = [];
    this.addNewPage();
  }

  addNewPage() {
    const page = this.pdfDoc.addPage([this.PAGE_W, this.PAGE_H]);
    this.pages.push(page);
    this.currentPage = page;
    this.currentY = this.PAGE_H - this.MARGIN_TOP;

    // Running top header line on subsequent pages
    if (this.pages.length > 1) {
      page.drawLine({
        start: { x: this.MARGIN_X, y: this.currentY + 14 },
        end: { x: this.PAGE_W - this.MARGIN_X, y: this.currentY + 14 },
        color: this.cBorder,
        thickness: 0.5
      });
      const topTitle = sanitizeText(`${this.annexure ? this.annexure + ' • ' : ''}${this.formCode || ''}: ${this.title}`.trim());
      page.drawText(topTitle, {
        x: this.MARGIN_X,
        y: this.currentY + 18,
        size: 7.5,
        font: this.fontItalic,
        color: this.cMuted
      });
      page.drawText('MIT-WPU Rural Immersion Program', {
        x: this.PAGE_W - this.MARGIN_X - 135,
        y: this.currentY + 18,
        size: 7.5,
        font: this.fontReg,
        color: this.cMuted
      });
    }
  }

  checkPageBreak(neededHeight) {
    if (this.currentY - neededHeight < this.MARGIN_BOTTOM) {
      this.addNewPage();
      return true;
    }
    return false;
  }

  // Draw University Header and Student Details Box
  drawDocumentHeader({ purpose = '' } = {}) {
    const p = this.currentPage;

    // University Title
    const uni1 = 'MAHARASHTRA INSTITUTE OF TECHNOLOGY - WORLD PEACE UNIVERSITY, PUNE';
    const uni2 = 'CENTRE FOR RURAL IMMERSION & SOCIAL OUTREACH';
    
    const w1 = this.fontBold.widthOfTextAtSize(uni1, 9.5);
    p.drawText(uni1, {
      x: (this.PAGE_W - w1) / 2,
      y: this.currentY,
      size: 9.5,
      font: this.fontBold,
      color: this.cDarkGreen
    });
    this.currentY -= 12;

    const w2 = this.fontBold.widthOfTextAtSize(uni2, 8);
    p.drawText(uni2, {
      x: (this.PAGE_W - w2) / 2,
      y: this.currentY,
      size: 8,
      font: this.fontBold,
      color: this.cMuted
    });
    this.currentY -= 12;

    // Institutional Green Accent Line
    p.drawLine({
      start: { x: this.MARGIN_X, y: this.currentY },
      end: { x: this.PAGE_W - this.MARGIN_X, y: this.currentY },
      color: this.cGreen,
      thickness: 1.5
    });
    this.currentY -= 16;

    // Form Title Banner Box
    p.drawRectangle({
      x: this.MARGIN_X,
      y: this.currentY - 26,
      width: this.CONTENT_W,
      height: 32,
      color: this.cLightBg,
      borderColor: this.cBorder,
      borderWidth: 0.75
    });

    const badgeText = sanitizeText(`${this.annexure ? this.annexure + ' | ' : ''}${this.formCode || ''}`.trim());
    if (badgeText) {
      p.drawText(badgeText, {
        x: this.MARGIN_X + 10,
        y: this.currentY - 8,
        size: 7.5,
        font: this.fontBold,
        color: this.cGreen
      });
    }

    p.drawText(sanitizeText(this.title), {
      x: this.MARGIN_X + 10,
      y: this.currentY - 21,
      size: 11,
      font: this.fontBold,
      color: this.cDark
    });
    this.currentY -= 34;

    // Purpose / Instructions note
    if (purpose) {
      const purpLines = wrapText(`Purpose: ${purpose}`, this.fontItalic, 8, this.CONTENT_W - 16);
      p.drawRectangle({
        x: this.MARGIN_X,
        y: this.currentY - (purpLines.length * 10 + 6),
        width: this.CONTENT_W,
        height: purpLines.length * 10 + 8,
        color: rgb(0.98, 0.99, 1),
        borderColor: this.cLightBorder,
        borderWidth: 0.5
      });
      let py = this.currentY - 9;
      for (const pline of purpLines) {
        p.drawText(pline, {
          x: this.MARGIN_X + 8,
          y: py,
          size: 8,
          font: this.fontItalic,
          color: this.cMuted
        });
        py -= 10;
      }
      this.currentY -= (purpLines.length * 10 + 14);
    }

    // Student Identification Grid
    this.drawStudentMetadataGrid();
  }

  drawStudentMetadataGrid() {
    this.checkPageBreak(52);
    const p = this.currentPage;
    const ctx = this.studentContext;

    const rowH = 16;
    const totalH = rowH * 3 + 6;
    const boxY = this.currentY - totalH;

    p.drawRectangle({
      x: this.MARGIN_X,
      y: boxY,
      width: this.CONTENT_W,
      height: totalH,
      color: this.cWhite,
      borderColor: this.cBorder,
      borderWidth: 0.75
    });

    // Row lines
    p.drawLine({
      start: { x: this.MARGIN_X, y: boxY + rowH * 2 + 2 },
      end: { x: this.PAGE_W - this.MARGIN_X, y: boxY + rowH * 2 + 2 },
      color: this.cLightBorder,
      thickness: 0.5
    });
    p.drawLine({
      start: { x: this.MARGIN_X, y: boxY + rowH + 2 },
      end: { x: this.PAGE_W - this.MARGIN_X, y: boxY + rowH + 2 },
      color: this.cLightBorder,
      thickness: 0.5
    });

    // Col division
    const col2X = this.MARGIN_X + this.CONTENT_W * 0.55;
    p.drawLine({
      start: { x: col2X, y: boxY },
      end: { x: col2X, y: boxY + totalH },
      color: this.cLightBorder,
      thickness: 0.5
    });

    const drawField = (label, val, x, y, maxW) => {
      p.drawText(`${label}:`, { x, y, size: 8, font: this.fontBold, color: this.cDarkGreen });
      const labelW = this.fontBold.widthOfTextAtSize(`${label}:`, 8);
      const valX = x + labelW + 4;
      if (val) {
        const valLines = wrapText(val, this.fontReg, 8, maxW - labelW - 6);
        p.drawText(valLines[0] || '', { x: valX, y, size: 8, font: this.fontReg, color: this.cDark });
      } else {
        // blank underline for writing
        p.drawLine({
          start: { x: valX, y: y - 1 },
          end: { x: x + maxW - 4, y: y - 1 },
          color: this.cBorder,
          thickness: 0.5
        });
      }
    };

    const halfW = this.CONTENT_W * 0.52;
    const r1Y = boxY + rowH * 2 + 5;
    const r2Y = boxY + rowH + 5;
    const r3Y = boxY + 5;

    drawField('Student Name', ctx.student_name, this.MARGIN_X + 6, r1Y, halfW);
    drawField('Roll No / PRN', ctx.prn, col2X + 6, r1Y, this.CONTENT_W * 0.42);

    drawField('Degree Program', ctx.degree_program, this.MARGIN_X + 6, r2Y, halfW);
    drawField('School / Dept', ctx.school_name, col2X + 6, r2Y, this.CONTENT_W * 0.42);

    drawField('Village Visited', ctx.village_name, this.MARGIN_X + 6, r3Y, halfW);
    drawField('Panel / Batch', `${ctx.panel_name || ''} ${ctx.batch_name ? '(' + ctx.batch_name + ')' : ''}`.trim(), col2X + 6, r3Y, this.CONTENT_W * 0.42);

    this.currentY = boxY - 14;
  }

  // Section Heading
  drawSectionHeader(title, subtitle = '') {
    this.checkPageBreak(36);
    const p = this.currentPage;
    const h = subtitle ? 28 : 20;
    const boxY = this.currentY - h;

    p.drawRectangle({
      x: this.MARGIN_X,
      y: boxY,
      width: this.CONTENT_W,
      height: h,
      color: this.cLightBg,
      borderColor: this.cBorder,
      borderWidth: 0.5
    });

    // Left vertical green accent bar
    p.drawRectangle({
      x: this.MARGIN_X,
      y: boxY,
      width: 3.5,
      height: h,
      color: this.cGreen
    });

    p.drawText(sanitizeText(title), {
      x: this.MARGIN_X + 10,
      y: subtitle ? boxY + 14 : boxY + 6,
      size: 9.5,
      font: this.fontBold,
      color: this.cDarkGreen
    });

    if (subtitle) {
      p.drawText(sanitizeText(subtitle), {
        x: this.MARGIN_X + 10,
        y: boxY + 4,
        size: 7.5,
        font: this.fontItalic,
        color: this.cMuted
      });
    }

    this.currentY = boxY - 10;
  }

  // Question Heading
  drawQuestion(sr, text, instruction = '', required = false) {
    const qText = `${sr ? sr + '. ' : ''}${sanitizeText(text)}${required ? ' *' : ''}`;
    const qLines = wrapText(qText, this.fontBold, 8.5, this.CONTENT_W);
    const instLines = instruction ? wrapText(`Instruction: ${instruction}`, this.fontItalic, 7.5, this.CONTENT_W - 8) : [];
    
    const needed = (qLines.length * 11) + (instLines.length * 9) + 16;
    this.checkPageBreak(needed);

    const p = this.currentPage;

    // Draw question lines
    for (const ql of qLines) {
      p.drawText(ql, {
        x: this.MARGIN_X,
        y: this.currentY,
        size: 8.5,
        font: this.fontBold,
        color: this.cDark
      });
      this.currentY -= 11;
    }

    // Draw instruction lines
    if (instLines.length > 0) {
      this.currentY -= 1;
      for (const il of instLines) {
        p.drawText(il, {
          x: this.MARGIN_X + 6,
          y: this.currentY,
          size: 7.5,
          font: this.fontItalic,
          color: this.cMuted
        });
        this.currentY -= 9;
      }
    }

    this.currentY -= 4;
  }

  // Draw Checkbox (square)
  drawCheckbox(x, y, isChecked = false) {
    const p = this.currentPage;
    p.drawRectangle({
      x,
      y: y - 1,
      width: 9,
      height: 9,
      borderColor: this.cDark,
      borderWidth: 0.8,
      color: isChecked ? rgb(0.92, 0.98, 0.94) : this.cWhite
    });

    if (isChecked) {
      // Vector checkmark
      p.drawLine({
        start: { x: x + 1.8, y: y + 3 },
        end: { x: x + 3.8, y: y + 1 },
        color: this.cGreen,
        thickness: 1.4
      });
      p.drawLine({
        start: { x: x + 3.8, y: y + 1 },
        end: { x: x + 7.5, y: y + 6.5 },
        color: this.cGreen,
        thickness: 1.4
      });
    }
  }

  // Draw Radio Button (circle)
  drawRadio(x, y, isSelected = false) {
    const p = this.currentPage;
    p.drawEllipse({
      x: x + 4.5,
      y: y + 3.5,
      xScale: 4.5,
      yScale: 4.5,
      borderColor: this.cDark,
      borderWidth: 0.8,
      color: this.cWhite
    });

    if (isSelected) {
      p.drawEllipse({
        x: x + 4.5,
        y: y + 3.5,
        xScale: 2.5,
        yScale: 2.5,
        color: this.cGreen
      });
    }
  }

  // Draw printable options (converts dropdowns or choices to printable items)
  drawOptions(options = [], selectedValue = null, { isMulti = false, inline = false } = {}) {
    if (!options || options.length === 0) return;

    // Normalize selected value
    const isSelected = (opt) => {
      if (selectedValue === null || selectedValue === undefined || selectedValue === '') return false;
      if (Array.isArray(selectedValue)) {
        return selectedValue.some(v => String(v).trim().toLowerCase() === String(opt).trim().toLowerCase() ||
          String(v).includes(opt) || String(opt).includes(v));
      }
      const s1 = String(selectedValue).trim().toLowerCase();
      const s2 = String(opt).trim().toLowerCase();
      return s1 === s2 || s1.startsWith(s2) || s2.startsWith(s1);
    };

    // Determine if inline is feasible (all options very short)
    const canInline = inline || (options.length <= 4 && options.every(o => String(o).length <= 20));

    if (canInline) {
      this.checkPageBreak(18);
      const p = this.currentPage;
      let curX = this.MARGIN_X + 10;
      const optY = this.currentY;

      for (const opt of options) {
        const textStr = sanitizeText(String(opt));
        const checked = isSelected(opt);
        if (isMulti) {
          this.drawCheckbox(curX, optY, checked);
        } else {
          this.drawRadio(curX, optY, checked);
        }
        p.drawText(textStr, {
          x: curX + 13,
          y: optY,
          size: 8,
          font: checked ? this.fontBold : this.fontReg,
          color: checked ? this.cDarkGreen : this.cText
        });
        const w = (checked ? this.fontBold : this.fontReg).widthOfTextAtSize(textStr, 8);
        curX += w + 26;
      }
      this.currentY -= 16;
      return;
    }

    // Vertical listing of options
    for (const opt of options) {
      const optStr = sanitizeText(String(opt));
      const checked = isSelected(opt);
      const isOther = optStr.toLowerCase().startsWith('other') || optStr.toLowerCase().includes('other:');

      const maxTextW = this.CONTENT_W - 24;
      const lines = wrapText(optStr, checked ? this.fontBold : this.fontReg, 8, maxTextW);
      const optH = Math.max(13, lines.length * 10 + 3);

      this.checkPageBreak(optH + 2);
      const p = this.currentPage;

      // Draw box or circle
      if (isMulti) {
        this.drawCheckbox(this.MARGIN_X + 10, this.currentY, checked);
      } else {
        this.drawRadio(this.MARGIN_X + 10, this.currentY, checked);
      }

      // Draw option text
      let lineY = this.currentY;
      for (let i = 0; i < lines.length; i++) {
        p.drawText(lines[i], {
          x: this.MARGIN_X + 23,
          y: lineY,
          size: 8,
          font: checked ? this.fontBold : this.fontReg,
          color: checked ? this.cDarkGreen : this.cText
        });
        lineY -= 10;
      }

      // If "Other" option, draw a writing line for handwritten details
      if (isOther) {
        const lastLineW = (checked ? this.fontBold : this.fontReg).widthOfTextAtSize(lines[lines.length - 1] || '', 8);
        const lineStartX = this.MARGIN_X + 26 + lastLineW;
        if (lineStartX < this.PAGE_W - this.MARGIN_X - 10) {
          p.drawLine({
            start: { x: lineStartX, y: lineY + 10 },
            end: { x: this.PAGE_W - this.MARGIN_X - 10, y: lineY + 10 },
            color: this.cBorder,
            thickness: 0.6
          });
        }
      }

      this.currentY -= (optH + 1);
    }
    this.currentY -= 4;
  }

  // Draw Text Field (single line answer or writing line)
  drawTextField(value = '', { label = '', placeholder = '' } = {}) {
    const p = this.currentPage;
    const cleanVal = sanitizeText(value);

    this.checkPageBreak(20);
    const y = this.currentY;

    if (label) {
      p.drawText(sanitizeText(label) + ':', {
        x: this.MARGIN_X + 8,
        y: y + 2,
        size: 8,
        font: this.fontBold,
        color: this.cDarkGreen
      });
    }

    const labelW = label ? this.fontBold.widthOfTextAtSize(sanitizeText(label) + ':', 8) + 6 : 0;
    const startX = this.MARGIN_X + 8 + labelW;
    const endX = this.PAGE_W - this.MARGIN_X - 10;

    if (cleanVal) {
      p.drawRectangle({
        x: startX,
        y: y - 2,
        width: endX - startX,
        height: 15,
        color: rgb(0.98, 0.99, 1),
        borderColor: this.cBorder,
        borderWidth: 0.5
      });
      p.drawText(cleanVal, {
        x: startX + 4,
        y: y + 1.5,
        size: 8,
        font: this.fontBold,
        color: this.cDark
      });
    } else {
      // Solid writing line for handwriting
      p.drawLine({
        start: { x: startX, y: y },
        end: { x: endX, y: y },
        color: this.cBorder,
        thickness: 0.6
      });
      if (placeholder) {
        p.drawText(sanitizeText(placeholder), {
          x: startX + 4,
          y: y + 2,
          size: 7,
          font: this.fontItalic,
          color: rgb(0.7, 0.75, 0.8)
        });
      }
    }

    this.currentY -= 17;
  }

  // Draw Multi-line Text Area (boxed text or ruled notebook writing lines)
  drawTextArea(value = '', { numBlankLines = 3, placeholder = '' } = {}) {
    const cleanVal = sanitizeText(value);

    if (cleanVal) {
      const lines = wrapText(cleanVal, this.fontReg, 8, this.CONTENT_W - 20);
      const boxH = Math.max(lines.length * 11 + 10, numBlankLines * 16);
      this.checkPageBreak(boxH + 8);

      const boxY = this.currentY - boxH;
      this.currentPage.drawRectangle({
        x: this.MARGIN_X + 6,
        y: boxY,
        width: this.CONTENT_W - 12,
        height: boxH,
        color: rgb(0.99, 0.99, 1),
        borderColor: this.cBorder,
        borderWidth: 0.6
      });

      let ty = boxY + boxH - 10;
      for (const line of lines) {
        this.currentPage.drawText(line, {
          x: this.MARGIN_X + 12,
          y: ty,
          size: 8,
          font: this.fontReg,
          color: this.cDark
        });
        ty -= 11;
      }
      this.currentY = boxY - 10;
    } else {
      // Blank ruled notebook-style writing lines
      const totalH = numBlankLines * 16;
      this.checkPageBreak(totalH + 6);

      const boxY = this.currentY - totalH;
      // Bordered container
      this.currentPage.drawRectangle({
        x: this.MARGIN_X + 6,
        y: boxY,
        width: this.CONTENT_W - 12,
        height: totalH,
        color: this.cWhite,
        borderColor: this.cBorder,
        borderWidth: 0.5
      });

      // Internal horizontal ruled lines
      for (let i = 1; i < numBlankLines; i++) {
        const lineY = boxY + (i * 16);
        this.currentPage.drawLine({
          start: { x: this.MARGIN_X + 8, y: lineY },
          end: { x: this.PAGE_W - this.MARGIN_X - 8, y: lineY },
          color: this.cLightBorder,
          thickness: 0.5
        });
      }

      if (placeholder) {
        this.currentPage.drawText(sanitizeText(placeholder), {
          x: this.MARGIN_X + 12,
          y: boxY + totalH - 12,
          size: 7.5,
          font: this.fontItalic,
          color: rgb(0.7, 0.75, 0.8)
        });
      }

      this.currentY = boxY - 10;
    }
  }

  // Draw 5-Star Rating Scales (for Feedback Form)
  drawRatingScale(value = 0, { label = '', subtitle = '' } = {}) {
    const val = parseInt(value, 10) || 0;
    this.checkPageBreak(40);
    const p = this.currentPage;

    if (label) {
      p.drawText(sanitizeText(label), {
        x: this.MARGIN_X + 8,
        y: this.currentY,
        size: 8.5,
        font: this.fontBold,
        color: this.cDark
      });
      this.currentY -= 10;
    }
    if (subtitle) {
      p.drawText(sanitizeText(subtitle), {
        x: this.MARGIN_X + 8,
        y: this.currentY,
        size: 7.5,
        font: this.fontItalic,
        color: this.cMuted
      });
      this.currentY -= 11;
    }

    const ratings = [
      { num: 1, label: '1 - Poor' },
      { num: 2, label: '2 - Fair' },
      { num: 3, label: '3 - Good' },
      { num: 4, label: '4 - Very Good' },
      { num: 5, label: '5 - Excellent' }
    ];

    let startX = this.MARGIN_X + 10;
    const boxW = 86;
    const boxH = 16;
    const boxY = this.currentY - boxH;

    for (const r of ratings) {
      const isSelected = val === r.num;
      p.drawRectangle({
        x: startX,
        y: boxY,
        width: boxW,
        height: boxH,
        color: isSelected ? rgb(0.92, 0.98, 0.94) : this.cWhite,
        borderColor: isSelected ? this.cGreen : this.cBorder,
        borderWidth: isSelected ? 1 : 0.6
      });

      // Selection box icon
      this.drawCheckbox(startX + 4, boxY + 4, isSelected);

      p.drawText(r.label, {
        x: startX + 17,
        y: boxY + 4,
        size: 7.5,
        font: isSelected ? this.fontBold : this.fontReg,
        color: isSelected ? this.cDarkGreen : this.cText
      });

      startX += boxW + 8;
    }

    this.currentY = boxY - 10;
  }

  // Draw Signatures Block at end of form
  drawSignatureBlock(signers = ['Student Signature', 'Accompanying Faculty Mentor', 'Institutional Head / Sarpanch']) {
    this.checkPageBreak(50);
    const p = this.currentPage;
    const colW = (this.CONTENT_W - 20) / signers.length;
    const lineY = this.currentY - 26;

    for (let i = 0; i < signers.length; i++) {
      const sx = this.MARGIN_X + 10 + (i * colW);
      p.drawLine({
        start: { x: sx, y: lineY },
        end: { x: sx + colW - 20, y: lineY },
        color: this.cDark,
        thickness: 0.75
      });
      p.drawText(sanitizeText(signers[i]), {
        x: sx,
        y: lineY - 11,
        size: 8,
        font: this.fontBold,
        color: this.cDarkGreen
      });
      p.drawText('Date: ____ / ____ / ________', {
        x: sx,
        y: lineY - 22,
        size: 7.5,
        font: this.fontReg,
        color: this.cMuted
      });
    }

    this.currentY = lineY - 32;
  }

  // Finalize PDF: Add running footer with page numbers and trigger download
  async finalizeAndDownload(filename) {
    const totalPages = this.pages.length;

    for (let i = 0; i < totalPages; i++) {
      const page = this.pages[i];
      const pageNumStr = `Page ${i + 1} of ${totalPages}`;

      // Footer divider line
      page.drawLine({
        start: { x: this.MARGIN_X, y: this.MARGIN_BOTTOM + 8 },
        end: { x: this.PAGE_W - this.MARGIN_X, y: this.MARGIN_BOTTOM + 8 },
        color: this.cBorder,
        thickness: 0.5
      });

      // Left: Program info
      page.drawText('MIT-WPU Rural Immersion Program • Official Hard Copy Document', {
        x: this.MARGIN_X,
        y: this.MARGIN_BOTTOM - 2,
        size: 7.5,
        font: this.fontReg,
        color: this.cMuted
      });

      // Right: Page number
      const pw = this.fontBold.widthOfTextAtSize(pageNumStr, 7.5);
      page.drawText(pageNumStr, {
        x: this.PAGE_W - this.MARGIN_X - pw,
        y: this.MARGIN_BOTTOM - 2,
        size: 7.5,
        font: this.fontBold,
        color: this.cDark
      });
    }

    const pdfBytes = await this.pdfDoc.save();
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    return pdfBytes;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DAILY ACTIVITY REPORT (FORM IIIB / ANNEX G-5)
// ─────────────────────────────────────────────────────────────────────────────
export async function downloadDailyActivityReportPdf({ form = {}, context = {} }) {
  const doc = new PrintablePdfDoc({
    title: FORM_IIIB_META.title,
    formCode: FORM_IIIB_META.formCode,
    annexure: FORM_IIIB_META.annexure,
    studentContext: { ...context, ...form }
  });
  await doc.init();

  doc.drawDocumentHeader({ purpose: FORM_IIIB_META.purpose });

  // Section 5.1 Seven-day visit plan
  doc.drawSectionHeader('5. VISIT INFORMATION', 'Details of planned and executed activities during village immersion');
  doc.drawQuestion('5.1', 'Seven-day visit plan', 'Whether the plan prepared prior to the visit was completed successfully', true);
  doc.drawOptions(YES_NO_OPTIONS, form.seven_day_plan_completed, { inline: true });
  doc.drawQuestion('', 'Improvements or observations regarding seven-day visit plan:');
  doc.drawTextArea(form.seven_day_plan_improvements, { numBlankLines: 3 });

  // Section 5.2 Community project
  doc.drawQuestion('5.2', 'Community action project implemented in village', 'Select all types of community projects conducted with the village community', true);
  doc.drawOptions(COMMUNITY_PROJECT_OPTIONS, form.community_project_types, { isMulti: true });
  if (form.community_project_other_text) {
    doc.drawTextField(form.community_project_other_text, { label: 'Other community project details' });
  }
  doc.drawQuestion('', 'Brief details of work done during community project:');
  doc.drawTextArea(form.community_project_work_done, { numBlankLines: 3 });
  doc.drawQuestion('', 'Suggestions or reflections regarding community project:');
  doc.drawTextArea(form.community_project_suggestions, { numBlankLines: 2 });

  // Section 5.3 In depth study of one problem
  doc.drawQuestion('5.3', 'In-depth study of one village problem / issue', 'Field problem identification and solution development', true);
  doc.drawQuestion('', 'Did all team members actively participate in problem study?');
  doc.drawOptions(YES_NO_OPTIONS, form.study_group_included, { inline: true });
  doc.drawQuestion('', 'Title / subject of problem studied in depth:');
  doc.drawTextField(form.study_problem_title, { placeholder: 'Enter problem statement title' });
  doc.drawQuestion('', 'Was the developed solution formally submitted?');
  doc.drawOptions(YES_NO_OPTIONS, form.study_solution_submitted, { inline: true });
  doc.drawQuestion('', 'Was the solution presented to the faculty / expert committee?');
  doc.drawOptions(YES_NO_OPTIONS, form.study_presented_to_committee, { inline: true });
  doc.drawQuestion('', 'Suggestions or key findings from problem study:');
  doc.drawTextArea(form.study_suggestions, { numBlankLines: 2 });

  // Section 5.4 Institutional visits
  doc.drawQuestion('5.4', 'Institutional visits conducted in the village', 'Minimum 2 village institutions required (Gram Panchayat, School, PHC, Anganwadi, etc.)');
  doc.drawTextField(String(form.institutions_visited_count ?? '2'), { label: 'Number of institutions visited' });
  doc.drawQuestion('', 'Key findings and suggestions from institutional visits:');
  doc.drawTextArea(form.institutional_visits_suggestions, { numBlankLines: 2 });

  // Section 5.5 Home visits
  doc.drawQuestion('5.5', 'Household socio-economic surveys & family visits', 'Detailed family visits conducted across village households');
  doc.drawTextField(String(form.homes_visited_count ?? '5'), { label: 'Number of households / families surveyed' });
  doc.drawQuestion('', 'Key observations and suggestions from family visits:');
  doc.drawTextArea(form.home_visits_suggestions, { numBlankLines: 2 });

  // Section 6. Best practices
  doc.drawSectionHeader('6. BEST PRACTICES OBSERVED IN VILLAGE', 'Traditional knowledge, cooperative efforts, water conservation, community cleanliness');
  doc.drawTextArea(form.best_practices_observed, { numBlankLines: 4 });

  // Section 7. Other activities
  doc.drawSectionHeader('7. ANY OTHER IMPORTANT ACTIVITY IMPLEMENTED', 'Cultural programs, youth engagement, sports, medical or awareness sessions');
  doc.drawTextArea(form.other_activities_implemented, { numBlankLines: 3 });

  // Section 8. Issues / Suggestions
  doc.drawSectionHeader('8. ISSUES AND SUGGESTIONS FOR PROGRAM IMPROVEMENT');
  doc.drawQuestion('8.1', 'Issues that affected implementation of the program:');
  doc.drawTextArea(form.issues_affecting_implementation, { numBlankLines: 3 });
  doc.drawQuestion('8.2', 'Suggestions to improve the Rural Immersion Program for future batches:');
  doc.drawTextArea(form.suggestions_to_improve_program, { numBlankLines: 3 });

  // Section 9. General remarks
  doc.drawSectionHeader('9. REMARKS & REFLECTIONS');
  doc.drawTextArea(form.remarks, { numBlankLines: 3 });

  // Signatures
  doc.drawSignatureBlock(['Student Signature', 'Accompanying Faculty Mentor', 'RI Cell Coordinator']);

  const cleanName = (context.student_name || form.student_name || 'Student').replace(/\s+/g, '_');
  return await doc.finalizeAndDownload(`Daily_Activity_Report_Form_IIIB_${cleanName}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. INSTITUTIONAL VISITS (FORM IV / ANNEX G-6)
// ─────────────────────────────────────────────────────────────────────────────
export async function downloadInstitutionalVisitsPdf({ visits = [], formSections = {}, context = {} }) {
  const doc = new PrintablePdfDoc({
    title: 'INSTITUTIONAL VISIT OBSERVATIONS (ANNEX G-6, FORM IV)',
    formCode: 'FORM – IV',
    annexure: 'ANNEX – G-6',
    studentContext: context
  });
  await doc.init();

  doc.drawDocumentHeader({
    purpose: 'To record comprehensive observations during institutional visits (Gram Panchayat, Schools, Anganwadi, PHC, PDS, Banking, Cooperatives, SHGs).'
  });

  // Part A: Summary of Visited Institutions
  doc.drawSectionHeader('PART A: SUMMARY OF VISITED INSTITUTIONS', 'Minimum 2 village institutions visited and studied by students');

  const visitsToRender = visits && visits.length > 0 ? visits : [
    { institution_type: 'Gram Panchayat Office', institution_name: '', official_contact_person: '', services_provided: '', observations: '', challenges_identified: '', recommendations: '', has_electricity: true, has_drinking_water: true, has_separate_toilets: true },
    { institution_type: 'Zilla Parishad Primary / High School', institution_name: '', official_contact_person: '', services_provided: '', observations: '', challenges_identified: '', recommendations: '', has_electricity: true, has_drinking_water: true, has_separate_toilets: true }
  ];

  visitsToRender.forEach((v, idx) => {
    doc.drawQuestion(`Inst #${idx + 1}`, `${v.institution_type || 'Institution'} Details`);
    doc.drawTextField(v.institution_name, { label: 'Name of Institution' });
    doc.drawTextField(v.official_contact_person, { label: 'Official Met / Designation' });
    doc.drawQuestion('', 'Services / Functions Provided:');
    doc.drawTextArea(v.services_provided, { numBlankLines: 2 });
    doc.drawQuestion('', 'Key Observations & Infrastructure:');
    doc.drawTextArea(v.observations, { numBlankLines: 2 });

    // Amenities inline
    const amenities = [
      v.has_electricity ? 'Electricity: Yes' : 'Electricity: No',
      v.has_drinking_water ? 'Water: Yes' : 'Water: No',
      v.has_separate_toilets ? 'Toilets: Yes' : 'Toilets: No'
    ];
    doc.drawOptions(amenities, amenities, { inline: true });

    doc.drawQuestion('', 'Challenges Identified:');
    doc.drawTextArea(v.challenges_identified, { numBlankLines: 2 });
    doc.drawQuestion('', 'Student Recommendations:');
    doc.drawTextArea(v.recommendations, { numBlankLines: 2 });
  });

  // Part B: Detailed 9-Section Questionnaire (All questions from schema)
  doc.drawSectionHeader('PART B: DETAILED INSTITUTIONAL QUESTIONNAIRE', 'Comprehensive field observations across 9 village sectors');

  INSTITUTION_FORM_SECTIONS.forEach((section) => {
    doc.drawSectionHeader(`SECTION ${section.sr}: ${section.title.toUpperCase()}`, section.subtitle || '');
    const secData = formSections[section.key] || {};

    section.questions.forEach((q) => {
      const qVal = secData[q.id];
      doc.drawQuestion(q.sr, q.label, q.instruction || '', q.required);

      if (q.type === 'select' && Array.isArray(q.options)) {
        doc.drawOptions(q.options, qVal);
      } else if (q.type === 'textarea') {
        doc.drawTextArea(qVal, { numBlankLines: 3, placeholder: q.placeholder });
      } else {
        doc.drawTextField(qVal, { placeholder: q.placeholder });
      }
    });
  });

  doc.drawSignatureBlock(['Student Signature', 'Accompanying Faculty Mentor', 'Sarpanch / Gram Sevak Seal']);

  const cleanName = (context.student_name || 'Student').replace(/\s+/g, '_');
  return await doc.finalizeAndDownload(`Institutional_Visits_Form_IV_${cleanName}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FAMILY VISITS (FORM V / ANNEX G-7)
// ─────────────────────────────────────────────────────────────────────────────
export async function downloadFamilySurveyPdf({ family = {}, context = {} }) {
  const serial = family.family_serial_number || 1;
  const doc = new PrintablePdfDoc({
    title: `FAMILY VISIT OBSERVATIONS - HOUSEHOLD #${serial}`,
    formCode: 'FORM – V',
    annexure: 'ANNEX – G-7',
    studentContext: context
  });
  await doc.init();

  doc.drawDocumentHeader({
    purpose: 'To record comprehensive demographic, housing, amenity, agriculture, economic, and health patterns of rural households.'
  });

  // Initial Details
  doc.drawSectionHeader('INITIAL DETAILS: HOUSEHOLD IDENTIFICATION');
  doc.drawTextField(String(serial), { label: 'Family Serial Number' });
  const vName = family.village_name || family.survey_data?.village_name || context.village_name || '';
  doc.drawTextField(vName, { label: 'Village Name' });
  doc.drawTextField(family.head_of_family_name, { label: 'Name of Head of Family' });
  doc.drawTextField(String(family.total_family_members ?? ''), { label: 'Total Family Members' });
  doc.drawTextField(String(family.male_members ?? ''), { label: 'Male Members' });
  doc.drawTextField(String(family.female_members ?? ''), { label: 'Female Members' });
  doc.drawTextField(family.respondent_name, { label: 'Respondent Name (Person Interviewed)' });
  doc.drawTextField(family.contact_number, { label: 'Contact Number' });

  // Iterate over all formal sections from FAMILY_SURVEY_SECTIONS
  const surveyData = family.survey_data && typeof family.survey_data === 'object' ? family.survey_data : {};

  FAMILY_SURVEY_SECTIONS.forEach((sec) => {
    if (sec.key === 'INITIAL') return; // already rendered in header box

    doc.drawSectionHeader(`${sec.code}: ${sec.title.toUpperCase()}`, sec.subtitle || sec.instruction || '');

    sec.questions.forEach((q) => {
      // Resolve value from direct family column or nested survey_data
      const val = family[q.id] !== undefined ? family[q.id] : surveyData[q.id];

      doc.drawQuestion(q.sr, q.label, q.instruction || '', q.required);

      if (Array.isArray(q.options) && q.options.length > 0) {
        doc.drawOptions(q.options, val);
      } else if (q.type === 'textarea') {
        doc.drawTextArea(val, { numBlankLines: 3, placeholder: q.placeholder });
      } else {
        doc.drawTextField(val !== undefined && val !== null ? String(val) : '', { placeholder: q.placeholder });
      }
    });
  });

  doc.drawSignatureBlock(['Head of Family / Respondent Signature', 'Student Interviewer Signature', 'Accompanying Faculty Mentor']);

  const cleanHead = (family.head_of_family_name || `Family_${serial}`).replace(/\s+/g, '_');
  return await doc.finalizeAndDownload(`Family_Visit_Observations_Form_V_${cleanHead}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PROBLEM IDENTIFICATION & DEVELOPING SOLUTION (FORM VI / ANNEX G-8)
// ─────────────────────────────────────────────────────────────────────────────
export async function downloadProblemIdentificationPdf({ form = {}, context = {} }) {
  const doc = new PrintablePdfDoc({
    title: FORM_VI_META.title,
    formCode: FORM_VI_META.formCode,
    annexure: FORM_VI_META.annexure,
    studentContext: { ...context, ...form }
  });
  await doc.init();

  doc.drawDocumentHeader({ purpose: FORM_VI_META.purpose });

  // 1 to 5: Background info
  doc.drawSectionHeader('1 - 5. INSTITUTIONAL & PROGRAM DETAILS');
  doc.drawTextField(form.school_name || context.school_name, { label: '1. Name of School' });
  doc.drawTextField(form.department_name || context.degree_program, { label: '2. Department' });
  doc.drawTextField(form.degree_program || context.degree_program, { label: '3. Degree Program' });
  doc.drawTextField(form.village_visited || context.village_name, { label: '4. Name of Village Visited' });
  doc.drawQuestion('5', 'Students Participated in the Study', 'Names and roll numbers of all participating team members');
  doc.drawTextArea(form.students_participated, { numBlankLines: 3 });

  // 6: Team Information
  doc.drawSectionHeader('6. TEAM INFORMATION');
  doc.drawTextField(form.team_leader_name, { label: 'Name of Team Leader' });
  doc.drawTextField(String(form.total_team_members || '5'), { label: 'Total Team Members' });

  // 7: Problem / Issue Identified
  doc.drawSectionHeader('7. PROBLEM / ISSUE IDENTIFIED IN VILLAGE');
  doc.drawQuestion('7.1', 'Title of Problem / Issue Identified in Village:', '', true);
  doc.drawTextField(form.problem_title);
  doc.drawQuestion('7.2', 'Is the problem identified in line with Sustainable Development Goals (SDGs)?', '', true);
  doc.drawOptions(['Yes', 'No'], form.is_aligned_with_sdg, { inline: true });
  if (form.sdg_goal_title || form.sdg_goal_number) {
    doc.drawTextField(`${form.sdg_goal_number ? 'SDG ' + form.sdg_goal_number + ': ' : ''}${form.sdg_goal_title || ''}`, { label: 'Aligned SDG' });
  }
  doc.drawQuestion('7.3', 'Is the problem / issue related to your Degree Program?', '', true);
  doc.drawOptions(['Yes', 'No'], form.is_related_to_degree, { inline: true });

  // 8: Solution to Problem / Issue
  doc.drawSectionHeader('8. SOLUTION TO PROBLEM / ISSUE DEVELOPED BY STUDENTS');
  doc.drawQuestion('8.1', 'Detailed Solution Offered to Address Problem:', '', true);
  doc.drawTextArea(form.solution_offered, { numBlankLines: 5 });
  doc.drawTextField(form.helping_faculty_name, { label: 'Name of Helping Faculty Mentor' });
  doc.drawTextField(form.helping_faculty_dept, { label: 'Faculty Mentor Department' });
  doc.drawQuestion('8.2', 'Is the developed solution practical and implementable by the village / Gram Panchayat?');
  doc.drawOptions(['Yes', 'No'], form.solution_is_practical_implementable, { inline: true });

  // 9: Presentation to Committee
  doc.drawSectionHeader('9. PRESENTATION TO EXPERT COMMITTEE');
  doc.drawTextField(form.committee_chairperson, { label: 'Name and Designation of Chairperson' });
  doc.drawTextField(form.presentation_date, { label: 'Date of Presentation to Committee' });
  doc.drawQuestion('9.1', 'Remarks by Expert Committee:');
  doc.drawOptions(COMMITTEE_REMARKS_OPTIONS, form.committee_remarks, { inline: true });

  // 10 & 11: Sarpanch informed & RI cell submission
  doc.drawSectionHeader('10 - 11. SUBMISSION & DISSEMINATION');
  doc.drawQuestion('10', 'Details of informing Sarpanch & Gram Panchayat regarding problem and solution:');
  doc.drawTextArea(form.sarpanch_informed_details, { numBlankLines: 3 });
  doc.drawQuestion('11', 'Details of formal submission of presentation and report to RI Cell:');
  doc.drawTextArea(form.ri_cell_submission_details, { numBlankLines: 3 });

  if (form.assignment_file_name || form.assignment_link) {
    doc.drawTextField(form.assignment_file_name || form.assignment_link, { label: 'Attached 1500-Word Report Deliverable' });
  }

  doc.drawSignatureBlock(['Team Leader Signature', 'Committee Chairperson Signature', 'Accompanying Faculty Mentor']);

  const cleanName = (form.team_leader_name || context.student_name || 'Team').replace(/\s+/g, '_');
  return await doc.finalizeAndDownload(`Problem_Identification_and_Solution_Form_VI_${cleanName}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. RI FEEDBACK & REFLECTION FORM (FORM VIII)
// ─────────────────────────────────────────────────────────────────────────────
export async function downloadFeedbackFormPdf({ form = {}, context = {} }) {
  const doc = new PrintablePdfDoc({
    title: 'STUDENT FEEDBACK & REFLECTION FORM (FORM VIII)',
    formCode: 'FORM – VIII',
    annexure: 'ANNEX – G-9',
    studentContext: context
  });
  await doc.init();

  doc.drawDocumentHeader({
    purpose: 'To record comprehensive student reflections, activity ratings, best practices, and suggestions for future Rural Immersion batches.'
  });

  // Section 1: 4 Core Activities Rating
  doc.drawSectionHeader('1. IMMERSION ACTIVITIES RATING (RATE 4 CORE ACTIVITIES)', 'Compulsory: 1 (Poor) to 5 (Excellent) rating for each village activity');

  doc.drawRatingScale(form.rating_institutional_visits, {
    label: 'Activity 1: Institutional Visits & Governance Interaction',
    subtitle: 'Visits to Gram Panchayat, Anganwadi, Primary Health Centre (PHC), and Village School'
  });

  doc.drawRatingScale(form.rating_household_surveys, {
    label: 'Activity 2: Household Socio-Economic Surveys & Family Visits',
    subtitle: 'Field interviews with families, housing, livelihood, agriculture, and government scheme awareness'
  });

  doc.drawRatingScale(form.rating_community_project, {
    label: 'Activity 3: Community Action Project & Shramdaan Activity',
    subtitle: 'Village cleanliness drives, tree plantation, soak-pit digging, wall painting, or social initiatives'
  });

  doc.drawRatingScale(form.rating_debrief_school_activity, {
    label: 'Activity 4: Debriefing, School / Youth Activity & Immersion',
    subtitle: 'Youth interactions, sports, street plays (nukkad natak), daily mentor briefings, and village assembly'
  });

  // Section 2: Best practices
  doc.drawSectionHeader('2. BEST PRACTICES OBSERVED IN VILLAGE', 'Positive traditions, water management systems, cooperative societies, cleanliness habits');
  doc.drawQuestion('6', 'Best practices of village observed during visit:', '', true);
  doc.drawTextArea(form.best_practices_observed, { numBlankLines: 4 });

  // Section 3: Other activities
  doc.drawSectionHeader('3. OTHER IMPORTANT ACTIVITIES CONDUCTED');
  doc.drawQuestion('7', 'Any other important activity implemented in the village:');
  doc.drawTextArea(form.other_activities_implemented, { numBlankLines: 3 });

  // Section 4: Issues and suggestions
  doc.drawSectionHeader('4. ISSUES AND RECOMMENDATIONS FOR PROGRAM IMPROVEMENT');
  doc.drawQuestion('8.1', 'Issues that affected implementation of the program (Transport, weather, language, time):');
  doc.drawTextArea(form.issues_affecting_implementation, { numBlankLines: 3 });
  doc.drawQuestion('8.2', 'Suggestions to improve the Rural Immersion Program:');
  doc.drawTextArea(form.suggestions_to_improve_program, { numBlankLines: 3 });

  // Section 5: General program ratings & follow-up
  doc.drawSectionHeader('5. GENERAL PROGRAM RATINGS & VOLUNTARY FOLLOW-UP');
  doc.drawRatingScale(form.overall_rating || 5, { label: 'Overall Rural Immersion Experience Rating' });
  doc.drawRatingScale(form.mentorship_rating || 5, { label: 'Faculty Mentorship & Guidance Rating' });
  doc.drawRatingScale(form.village_reception_rating || 5, { label: 'Village Community Reception & Cooperation' });
  doc.drawRatingScale(form.logistics_rating || 4, { label: 'Food, Accommodation & Transport Logistics' });

  doc.drawQuestion('9', 'Are you willing to participate in follow-up village development projects?');
  doc.drawOptions(['Yes, willing for follow-up initiatives', 'No'], form.willing_for_followup ? 'Yes, willing for follow-up initiatives' : 'No', { inline: true });

  doc.drawSignatureBlock(['Student Signature', 'Faculty Mentor Signature', 'RI Cell Coordinator']);

  const cleanName = (context.student_name || 'Student').replace(/\s+/g, '_');
  return await doc.finalizeAndDownload(`RI_Student_Feedback_Form_VIII_${cleanName}.pdf`);
}
