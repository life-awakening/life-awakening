import { PDFDocument, rgb, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// Text wrapping helper
function wrapText(text, width, font, fontSize) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > width) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

// Browser helper to fetch PNG and compile it on canvas to strip alpha/transparency and get clean JPEGs
async function fetchAndConvertToJpg(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        // Paint solid white background to strip transparency
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1];
        const binaryStr = window.atob(base64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        resolve(bytes.buffer);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image from ${url}`));
    img.src = url;
  });
}

const DIARY_DATA = {
  1: {
    pillar: 'Agriculture & Nature Connection',
    activity: 'Soil Connection & Sowing Seeds of Growth',
    reflection: 'Felt incredibly grounded touching the soil today. It made me realize how much patience goes into growing what we eat and caring for nature. I will nurture this seed inside me too.',
    blessing: 'You showed great care and curiosity today. Remember, just like these seeds, your potential takes time and patience to bloom. Keep nurturing it!',
    imageKey: 'agri',
    color: rgb(0.04, 0.35, 0.22)
  },
  2: {
    pillar: 'Physical Wellness & Sports',
    activity: 'Morning Yoga Alignment & Endurance drills',
    reflection: 'Waking up early was tough, but the morning breeze and deep stretching made me feel so energized and alive! Physical strength is the mirror of mental focus.',
    blessing: 'Your energy and discipline today were infectious. Keep pushing your limits, building physical strength, and living with vibrant energy!',
    imageKey: 'phy',
    color: rgb(0.80, 0.25, 0.18)
  },
  3: {
    pillar: 'Team Dynamics & Leadership',
    activity: 'Squad Obstacle Course & Bridge building',
    reflection: 'Learned that leading is sometimes about listening. Together, our squad crossed the obstacles faster and stronger than any single person could.',
    blessing: 'Excellent collaboration and empathy today. You proved that collective synergetic dynamics can overcome any challenge. Lead with kindness!',
    imageKey: 'team',
    color: rgb(0.15, 0.40, 0.75)
  },
  4: {
    pillar: 'Patriotism & Community Service',
    activity: 'War Memorial & Heritage Study walk',
    reflection: 'Felt deeply proud hearing stories of resilience and sacrifice. It makes me realize that we are part of something bigger, and our actions matter.',
    blessing: 'Your sense of responsibility towards society is inspiring. Keep that flame of duty and integrity burning high in all your future endeavors.',
    imageKey: 'patri',
    color: rgb(0.80, 0.50, 0.05)
  },
  5: {
    pillar: 'Spirituality & Inner Peace',
    activity: 'Silent Meditation & Self-Reflection circle',
    reflection: 'Sitting in silence helped me find a peace I did not know I possessed. I feel calm, centered, and hopeful about the journey ahead.',
    blessing: 'You have stilled your mind and found your focus. Carry this inner peace, clarity, and light wherever life takes you. You are transformed!',
    imageKey: 'spri',
    color: rgb(0.45, 0.20, 0.70)
  }
};

export async function generateJourneyReport(student, batch, evaluations) {
  const { fullName, ltcId, prn, squad, division } = student;
  const { startDate, endDate, batchName } = batch;

  // 1. Fetch Poppins fonts
  const [poppinsBoldBytes, poppinsRegularBytes, poppinsMediumBytes] = await Promise.all([
    fetch('/fonts/Poppins-Bold.ttf').then(res => res.arrayBuffer()),
    fetch('/fonts/Poppins-Regular.ttf').then(res => res.arrayBuffer()),
    fetch('/fonts/Poppins-Medium.ttf').then(res => res.arrayBuffer())
  ]);

  // 2. Create document and register fontkit
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const poppinsBold = await pdfDoc.embedFont(poppinsBoldBytes);
  const poppinsRegular = await pdfDoc.embedFont(poppinsRegularBytes);
  const poppinsMedium = await pdfDoc.embedFont(poppinsMediumBytes);

  const A4_W = 595.2756;
  const A4_H = 841.8898;

  // 3. Load PNG illustrations defensively, converting them to clean JPEGs
  let images = {};
  try {
    const [agriBytes, phyBytes, teamBytes, patriBytes, spriBytes, chartBytes] = await Promise.all([
      fetchAndConvertToJpg('/lrp_agri.png').catch(() => null),
      fetchAndConvertToJpg('/lrp_phy.png').catch(() => null),
      fetchAndConvertToJpg('/lrp_team.png').catch(() => null),
      fetchAndConvertToJpg('/lrp_patri.png').catch(() => null),
      fetchAndConvertToJpg('/lrp_spri.png').catch(() => null),
      fetchAndConvertToJpg('/five_pillars_chart.png').catch(() => null)
    ]);
    if (agriBytes) images.agri = await pdfDoc.embedJpg(agriBytes);
    if (phyBytes) images.phy = await pdfDoc.embedJpg(phyBytes);
    if (teamBytes) images.team = await pdfDoc.embedJpg(teamBytes);
    if (patriBytes) images.patri = await pdfDoc.embedJpg(patriBytes);
    if (spriBytes) images.spri = await pdfDoc.embedJpg(spriBytes);
    if (chartBytes) images.chart = await pdfDoc.embedJpg(chartBytes);
  } catch (err) {
    console.warn("JPEG conversion and loading failed:", err);
  }

  // Notebook Diary Background Drawer (Parchment ruled journal pages)
  const drawDiaryPageBackground = (page) => {
    // Fill Page Cream Background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: A4_W,
      height: A4_H,
      color: rgb(0.99, 0.98, 0.95)
    });

    // Draw spiral notebook coils on left edge
    const startY = 40;
    const endY = A4_H - 40;
    const step = 22;
    for (let y = startY; y < endY; y += step) {
      // Small hole dot
      page.drawCircle({
        x: 28,
        y: y + 2,
        size: 2,
        color: rgb(0.2, 0.2, 0.2)
      });
      // Back part of ring (darker gray)
      page.drawLine({
        start: { x: 14, y: y },
        end: { x: 28, y: y + 4 },
        color: rgb(0.45, 0.45, 0.45),
        thickness: 1.5
      });
      // Front part of ring loop (silver gray)
      page.drawLine({
        start: { x: 12, y: y + 4 },
        end: { x: 26, y: y },
        color: rgb(0.7, 0.7, 0.7),
        thickness: 1.2
      });
    }

    // Draw notebook vertical double pink margin line
    page.drawLine({
      start: { x: 50, y: 30 },
      end: { x: 50, y: A4_H - 30 },
      color: rgb(0.90, 0.55, 0.55),
      thickness: 1.2
    });
    page.drawLine({
      start: { x: 53, y: 30 },
      end: { x: 53, y: A4_H - 30 },
      color: rgb(0.95, 0.70, 0.70),
      thickness: 0.5
    });

    // Draw ruled lines (notebook horizontal lines)
    for (let y = 60; y < A4_H - 60; y += 22) {
      page.drawLine({
        start: { x: 54, y: y },
        end: { x: A4_W - 25, y: y },
        color: rgb(0.94, 0.92, 0.87),
        thickness: 0.5
      });
    }
  };

  // Helper to draw a photo styled as a polaroid card with a masking tape overlay
  const drawPolaroidPhoto = (page, img, x, y, width, height, labelText = '') => {
    const framePadding = 8;
    const bottomPadding = 24;
    const frameW = width + framePadding * 2;
    const frameH = height + framePadding + bottomPadding;

    // Polaroid card frame background (straight pasted photo)
    page.drawRectangle({
      x: x - framePadding,
      y: y - bottomPadding,
      width: frameW,
      height: frameH,
      color: rgb(1, 1, 0.98),
      borderColor: rgb(0.86, 0.84, 0.80),
      borderWidth: 1
    });

    // Masking tape overlay on top
    page.drawRectangle({
      x: x + (width / 2) - 22,
      y: y + height - 2,
      width: 44,
      height: 12,
      color: rgb(0.92, 0.88, 0.74, 0.5) // Transparent beige tape
    });

    if (img) {
      page.drawImage(img, {
        x: x,
        y: y,
        width: width,
        height: height
      });
    }

    if (labelText) {
      const labelW = poppinsRegular.widthOfTextAtSize(labelText, 8);
      page.drawText(labelText, {
        x: x + (width / 2) - (labelW / 2),
        y: y - 16,
        size: 8,
        font: poppinsRegular,
        color: rgb(0.45, 0.45, 0.45)
      });
    }
  };

  // Draw Star Doodles
  const drawStarDoodle = (page, x, y, size = 10) => {
    const r = size / 2;
    page.drawLine({ start: { x: x - r, y: y }, end: { x: x + r, y: y }, color: rgb(0.85, 0.53, 0.10), thickness: 1 });
    page.drawLine({ start: { x: x, y: y - r }, end: { x: x, y: y + r }, color: rgb(0.85, 0.53, 0.10), thickness: 1 });
    page.drawLine({ start: { x: x - r * 0.7, y: y - r * 0.7 }, end: { x: x + r * 0.7, y: y + r * 0.7 }, color: rgb(0.85, 0.53, 0.10), thickness: 1 });
    page.drawLine({ start: { x: x - r * 0.7, y: y + r * 0.7 }, end: { x: x + r * 0.7, y: y - r * 0.7 }, color: rgb(0.85, 0.53, 0.10), thickness: 1 });
  };

  // Draw Curved pointing arrow vector doodles
  const drawDoodleArrow = (page, startX, startY, endX, endY) => {
    page.drawLine({
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
      color: rgb(0.4, 0.4, 0.4),
      thickness: 1
    });

    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;
      page.drawLine({
        start: { x: endX, y: endY },
        end: { x: endX - ux * 6 + px * 4, y: endY - uy * 6 + py * 4 },
        color: rgb(0.4, 0.4, 0.4),
        thickness: 1
      });
      page.drawLine({
        start: { x: endX, y: endY },
        end: { x: endX - ux * 6 - px * 4, y: endY - uy * 6 - py * 4 },
        color: rgb(0.4, 0.4, 0.4),
        thickness: 1
      });
    }
  };

  // Format dates helper
  const formatDates = (startStr, endStr) => {
    try {
      const dStart = new Date(startStr);
      const dEnd = new Date(endStr);
      const startDay = dStart.getDate();
      const endDay = dEnd.getDate();
      const startMonth = dStart.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = dEnd.toLocaleDateString('en-US', { month: 'short' });
      const startYear = dStart.getFullYear();
      return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${startYear}`;
    } catch {
      return `${startStr} to ${endStr}`;
    }
  };
  const prefDates = formatDates(startDate, endDate);

  // ----------------------------------------------------
  // PAGE 1: DIARY COVER STICKERS
  // ----------------------------------------------------
  const page1 = pdfDoc.addPage([A4_W, A4_H]);
  drawDiaryPageBackground(page1);

  // Title sticker card
  const stickerX = 80;
  const stickerY = A4_H - 220;
  const stickerW = A4_W - 140;
  const stickerH = 130;

  page1.drawRectangle({
    x: stickerX,
    y: stickerY,
    width: stickerW,
    height: stickerH,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.18, 0.15, 0.12),
    borderWidth: 2
  });

  page1.drawRectangle({ x: stickerX + (stickerW / 2) - 25, y: stickerY + stickerH - 5, width: 50, height: 10, color: rgb(0.92, 0.88, 0.74, 0.6) });

  page1.drawText("MY LTC DIARY", {
    x: stickerX + 25,
    y: stickerY + stickerH - 45,
    size: 26,
    font: poppinsBold,
    color: rgb(0.18, 0.15, 0.12)
  });

  page1.drawText("A Journal of Growth, Values & Reflections", {
    x: stickerX + 25,
    y: stickerY + stickerH - 75,
    size: 12,
    font: poppinsMedium,
    color: rgb(0.85, 0.53, 0.10)
  });

  page1.drawText(`Batch: ${batchName || 'LTC Batch'} • ${prefDates}`, {
    x: stickerX + 25,
    y: stickerY + stickerH - 105,
    size: 9.5,
    font: poppinsRegular,
    color: rgb(0.4, 0.4, 0.4)
  });

  // Profile Sticker card
  const profileY = A4_H - 400;
  const profileH = 145;
  page1.drawRectangle({
    x: stickerX,
    y: profileY,
    width: stickerW,
    height: profileH,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.88, 0.86, 0.82),
    borderWidth: 1.5
  });

  page1.drawText("JOURNAL OWNER", {
    x: stickerX + 20,
    y: profileY + profileH - 30,
    size: 11,
    font: poppinsBold,
    color: rgb(0.18, 0.15, 0.12)
  });

  page1.drawLine({
    start: { x: stickerX + 20, y: profileY + profileH - 36 },
    end: { x: stickerX + stickerW - 20, y: profileY + profileH - 36 },
    color: rgb(0.88, 0.86, 0.82),
    thickness: 1
  });

  const rowFontSize = 10;
  page1.drawText(`Full Name:`, { x: stickerX + 20, y: profileY + profileH - 65, size: rowFontSize, font: poppinsBold, color: rgb(0.18, 0.15, 0.12) });
  page1.drawText(fullName, { x: stickerX + 110, y: profileY + profileH - 65, size: rowFontSize, font: poppinsRegular, color: rgb(0.25, 0.25, 0.25) });

  page1.drawText(`PRN:`, { x: stickerX + 20, y: profileY + profileH - 90, size: rowFontSize, font: poppinsBold, color: rgb(0.18, 0.15, 0.12) });
  page1.drawText(prn || 'N/A', { x: stickerX + 110, y: profileY + profileH - 90, size: rowFontSize, font: poppinsRegular, color: rgb(0.25, 0.25, 0.25) });

  page1.drawText(`LTC ID:`, { x: stickerX + 20, y: profileY + profileH - 115, size: rowFontSize, font: poppinsBold, color: rgb(0.18, 0.15, 0.12) });
  page1.drawText(ltcId || 'N/A', { x: stickerX + 110, y: profileY + profileH - 115, size: rowFontSize, font: poppinsBold, color: rgb(0.85, 0.53, 0.10) });

  page1.drawText(`Division:`, { x: stickerX + 220, y: profileY + profileH - 90, size: rowFontSize, font: poppinsBold, color: rgb(0.18, 0.15, 0.12) });
  page1.drawText(division || 'N/A', { x: stickerX + 290, y: profileY + profileH - 90, size: rowFontSize, font: poppinsRegular, color: rgb(0.25, 0.25, 0.25) });

  page1.drawText(`Squad:`, { x: stickerX + 220, y: profileY + profileH - 115, size: rowFontSize, font: poppinsBold, color: rgb(0.18, 0.15, 0.12) });
  page1.drawText(squad || 'N/A', { x: stickerX + 290, y: profileY + profileH - 115, size: rowFontSize, font: poppinsRegular, color: rgb(0.25, 0.25, 0.25) });

  // Preface Message
  const prefY = 90;
  const prefH = 260;
  page1.drawRectangle({
    x: stickerX,
    y: prefY,
    width: stickerW,
    height: prefH,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.88, 0.86, 0.82),
    borderWidth: 1.5
  });

  page1.drawText("Preface: The Transformation Journey", {
    x: stickerX + 20,
    y: prefY + prefH - 35,
    size: 12,
    font: poppinsBold,
    color: rgb(0.18, 0.15, 0.12)
  });

  const prefaceMsg = 
    "Dear student, this Keepsake Journal is a visual record of your experiences, reflections, and growth during the Life Transformation Camp (LTC).\n\n" +
    "Over 5 memorable days, you explored the coordinates of character, discipline, connection with nature, physical strength, collaborative leadership, duties to the nation, and the peace of self-reflection.\n\n" +
    "This journal contains your personal reflections alongside notes of blessing and encouragement from your mentors. May these memories remain a constant anchor as you continue your path of self-realization.";
  
  const wrappedPref = wrapText(prefaceMsg, stickerW - 40, poppinsRegular, 10);
  let prefLineY = prefY + prefH - 60;
  for (const line of wrappedPref) {
    page1.drawText(line, {
      x: stickerX + 20,
      y: prefLineY,
      size: 9.5,
      font: poppinsRegular,
      color: rgb(0.3, 0.3, 0.3),
      lineHeight: 14
    });
    prefLineY -= 14;
  }

  // ----------------------------------------------------
  // PAGE 2: THE 5 PILLARS OF LIFE TRANSFORMATION
  // ----------------------------------------------------
  const page2 = pdfDoc.addPage([A4_W, A4_H]);
  drawDiaryPageBackground(page2);

  page2.drawText("THE 5 PILLARS OF LIFE TRANSFORMATION", {
    x: 65,
    y: A4_H - 45,
    size: 15,
    font: poppinsBold,
    color: rgb(0.18, 0.15, 0.12)
  });
  page2.drawLine({
    start: { x: 65, y: A4_H - 51 },
    end: { x: A4_W - 25, y: A4_H - 51 },
    color: rgb(0.85, 0.53, 0.10),
    thickness: 1.5
  });

  // Draw 5-Pillar illustration as a taped card (Large format)
  const chartW = A4_W - 130; // 465pt wide
  const chartH = 270;
  const chartX = 80;
  const chartY = A4_H - 350;
  drawPolaroidPhoto(page2, images.chart, chartX, chartY, chartW, chartH, "Life Transformation Camp Core Alignment Chart");

  // Draw Pillars Overview descriptions below
  const descTitleY = chartY - 45;
  page2.drawText("Our 5 Pillars Foundations", {
    x: 80,
    y: descTitleY,
    size: 12,
    font: poppinsBold,
    color: rgb(0.18, 0.15, 0.12)
  });

  const pillarsSummaryList = [
    { name: '1. Agriculture & Nature Connection', desc: 'Sow seeds of patience, respect the soil, and appreciate the labor that feeds us.' },
    { name: '2. Physical Wellness & Sports', desc: 'Forge discipline, stamina, and team spirit through daily physical alignment.' },
    { name: '3. Team Dynamics & Leadership', desc: 'Learn the power of synergy, collaborative trust, and empathetic squad leadership.' },
    { name: '4. Patriotism & Nation Building', desc: 'Honor heritage, feel pride in community service, and build true integrity.' },
    { name: '5. Spirituality & Inner Peace', desc: 'Still the mind, cultivate mindfulness, and discover deeper life purposes.' }
  ];

  let pSumY = descTitleY - 20;
  for (const p of pillarsSummaryList) {
    page2.drawText(p.name, {
      x: 80,
      y: pSumY,
      size: 9.5,
      font: poppinsBold,
      color: rgb(0.85, 0.53, 0.10)
    });
    page2.drawText(p.desc, {
      x: 80,
      y: pSumY - 11,
      size: 9,
      font: poppinsRegular,
      color: rgb(0.3, 0.3, 0.3)
    });
    pSumY -= 26;
  }

  // ----------------------------------------------------
  // DAY PAGE COMPILER HELPER (IMAGE TOP / TEXT BOTTOM)
  // ----------------------------------------------------
  const compileDiaryDayPage = (d) => {
    const page = pdfDoc.addPage([A4_W, A4_H]);
    drawDiaryPageBackground(page);

    const staticData = DIARY_DATA[d];
    const dayEval = evaluations && evaluations.find(ev => ev.day === d);
    const mentorRemarks = (dayEval && dayEval.remarks && dayEval.remarks.trim()) || staticData.blessing;

    // Page Header Label
    page.drawText(`DIARY ENTRY: DAY ${d} OF 5`, {
      x: 65,
      y: A4_H - 45,
      size: 15,
      font: poppinsBold,
      color: rgb(0.18, 0.15, 0.12)
    });
    page.drawLine({
      start: { x: 65, y: A4_H - 51 },
      end: { x: A4_W - 25, y: A4_H - 51 },
      color: rgb(0.85, 0.53, 0.10),
      thickness: 1.5
    });

    // Large straight pasted Polaroid photo at the top
    const imgW = 380;
    const imgH = 220;
    const imgX = 107;
    const imgY = A4_H - 315;
    const embeddedImg = images[staticData.imageKey];

    drawPolaroidPhoto(page, embeddedImg, imgX, imgY, imgW, imgH, `Day ${d}: ${staticData.pillar}`);

    // Doodled curved arrow connecting the notes section to the top photo
    drawDoodleArrow(page, 75, A4_H - 350, 102, imgY + 20);
    drawStarDoodle(page, A4_W - 55, imgY + imgH + 10, 10);

    // Text Content at the bottom
    const textY = imgY - 55;
    const textW = A4_W - 105;

    // Title / Activity Header
    page.drawText(`${staticData.pillar} — ${staticData.activity}`, {
      x: 75,
      y: textY,
      size: 12,
      font: poppinsBold,
      color: staticData.color
    });

    // Part A: My Reflection
    page.drawText("My Reflection:", {
      x: 75,
      y: textY - 24,
      size: 9.5,
      font: poppinsBold,
      color: rgb(0.85, 0.53, 0.10)
    });

    const reflectionLines = wrapText(staticData.reflection, textW, poppinsRegular, 9.5);
    let rY = textY - 38;
    for (const line of reflectionLines) {
      page.drawText(line, {
        x: 75,
        y: rY,
        size: 9,
        font: poppinsRegular,
        color: rgb(0.2, 0.3, 0.35)
      });
      rY -= 13;
    }

    // Part B: Mentor's Blessing
    page.drawText("Mentor's Blessing:", {
      x: 75,
      y: rY - 10,
      size: 9.5,
      font: poppinsBold,
      color: rgb(0.85, 0.53, 0.10)
    });

    const blessingLines = wrapText(mentorRemarks, textW, poppinsRegular, 9.5);
    let bY = rY - 24;
    for (const line of blessingLines) {
      page.drawText(line, {
        x: 75,
        y: bY,
        size: 9,
        font: poppinsRegular,
        color: rgb(0.35, 0.3, 0.25)
      });
      bY -= 13;
    }
  };

  // ----------------------------------------------------
  // PAGES 3 TO 7: COMPILING EACH INDIVIDUAL DAY
  // ----------------------------------------------------
  compileDiaryDayPage(1); // Day 1 - Page 3
  compileDiaryDayPage(2); // Day 2 - Page 4
  compileDiaryDayPage(3); // Day 3 - Page 5
  compileDiaryDayPage(4); // Day 4 - Page 6
  compileDiaryDayPage(5); // Day 5 - Page 7

  // ----------------------------------------------------
  // PAGE 8: CONCLUDING BLESSINGS
  // ----------------------------------------------------
  const page8 = pdfDoc.addPage([A4_W, A4_H]);
  drawDiaryPageBackground(page8);

  page8.drawText("JOURNAL CONCLUSION & BLESSINGS", {
    x: 65,
    y: A4_H - 45,
    size: 15,
    font: poppinsBold,
    color: rgb(0.18, 0.15, 0.12)
  });
  page8.drawLine({
    start: { x: 65, y: A4_H - 51 },
    end: { x: A4_W - 25, y: A4_H - 51 },
    color: rgb(0.85, 0.53, 0.10),
    thickness: 1.5
  });

  // Center sticker blessings card
  const blessX = 80;
  const blessY = A4_H - 480;
  const blessW = A4_W - 160;
  const blessH = 360;

  page8.drawRectangle({
    x: blessX,
    y: blessY,
    width: blessW,
    height: blessH,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.53, 0.10),
    borderWidth: 2
  });

  // Tape sticker for blessings card
  page8.drawRectangle({
    x: blessX + (blessW / 2) - 35,
    y: blessY + blessH - 5,
    width: 70,
    height: 12,
    color: rgb(0.92, 0.88, 0.74, 0.6)
  });

  page8.drawText("OUR FINAL BLESSINGS FOR YOUR FUTURE", {
    x: blessX + 25,
    y: blessY + blessH - 40,
    size: 13,
    font: poppinsBold,
    color: rgb(0.18, 0.15, 0.12)
  });

  page8.drawLine({
    start: { x: blessX + 25, y: blessY + blessH - 48 },
    end: { x: blessX + blessW - 25, y: blessY + blessH - 48 },
    color: rgb(0.92, 0.90, 0.86),
    thickness: 1
  });

  const finalBlessingsText = 
    "As you look back at these diary pages, remember that the true transformation begins today. The virtues of agriculture connection, physical wellness, squad dynamics, patriotism, and stilled spirituality are now part of your character.\n\n" +
    "Let these values guide your everyday choices, build your integrity, and lead you to live a life of selfless service and excellence.\n\n" +
    "May you walk ahead with courage, integrity, and light, transforming every space you step into. Go forth and make this world a better place!";

  const wrappedFinal = wrapText(finalBlessingsText, blessW - 50, poppinsRegular, 10.5);
  let fLineY = blessY + blessH - 80;
  for (const line of wrappedFinal) {
    page8.drawText(line, {
      x: blessX + 25,
      y: fLineY,
      size: 10,
      font: poppinsRegular,
      color: rgb(0.3, 0.3, 0.3),
      lineHeight: 15
    });
    fLineY -= 15;
  }

  page8.drawText("— LAP Team & Mentors", {
    x: blessX + blessW - 190,
    y: blessY + 30,
    size: 11,
    font: poppinsBold,
    color: rgb(0.85, 0.53, 0.10)
  });

  drawStarDoodle(page8, blessX - 15, blessY + blessH + 15, 12);
  drawStarDoodle(page8, blessX + blessW + 10, blessY - 10, 10);

  // ----------------------------------------------------
  // SAVE & DOWNLOAD
  // ----------------------------------------------------
  const pdfBytes = await pdfDoc.save();
  const safeFileName = `LAP_Journey_Keepsake_${fullName.trim().replace(/\s+/g, '_')}.pdf`;

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
