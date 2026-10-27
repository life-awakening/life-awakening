const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generatePDF() {
  const outputPath = path.resolve(__dirname, '../../frontend/public/documents/Faculty_Undertaking_Form.pdf');
  
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LTC Faculty Mentor Undertaking & Honor Code</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 12px;
    }
    .container {
      border: 2px solid #154388;
      border-radius: 12px;
      padding: 24px;
      position: relative;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #154388;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header-title {
      text-align: center;
    }
    .header-title h1 {
      font-size: 18px;
      font-weight: 800;
      color: #154388;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .header-title h2 {
      font-size: 13px;
      font-weight: 700;
      color: #b45309;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
    }
    .header-title .sub-header {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
    }
    .doc-badge {
      display: inline-block;
      background: #154388;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      padding: 3px 12px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-top: 6px;
    }
    .section-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 14px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      color: #154388;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
    }
    .grid-table {
      width: 100%;
      border-collapse: collapse;
    }
    .grid-table td {
      padding: 4px 6px;
      font-size: 11px;
      vertical-align: middle;
    }
    .field-label {
      font-weight: 700;
      color: #475569;
      width: 22%;
    }
    .field-value {
      color: #0f172a;
      font-weight: 600;
      border-bottom: 1px dotted #94a3b8;
      width: 28%;
    }
    .code-list {
      padding-left: 18px;
      margin: 6px 0;
    }
    .code-list li {
      margin-bottom: 6px;
      color: #334155;
      font-size: 11px;
      text-align: justify;
    }
    .code-list li strong {
      color: #0f172a;
    }
    .consent-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
    }
    .consent-table th {
      background: #e2e8f0;
      color: #0f172a;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 5px 8px;
      text-align: left;
      border: 1px solid #cbd5e1;
    }
    .consent-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      font-size: 10.5px;
    }
    .checkbox-cell {
      text-align: center;
      width: 35px;
      font-weight: 800;
      color: #15803d;
    }
    .sign-section {
      display: table;
      width: 100%;
      margin-top: 14px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 12px;
    }
    .sign-col {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding: 0 10px;
    }
    .sign-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      background: #fafafa;
      min-height: 70px;
    }
    .sign-line {
      margin-top: 35px;
      border-top: 1px solid #475569;
      text-align: center;
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
      padding-top: 4px;
    }
    .footer-notice {
      text-align: center;
      font-size: 9.5px;
      color: #64748b;
      margin-top: 10px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td class="header-title">
          <h1>MIT WORLD PEACE UNIVERSITY</h1>
          <h2>Life Transformation Centre (LTC)</h2>
          <div class="sub-header">Life Awakening Program (LAP) · Residential Immersion</div>
          <div class="doc-badge">Faculty Mentor Undertaking & Conduct Honor Code</div>
        </td>
      </tr>
    </table>

    <!-- Faculty Details Section -->
    <div class="section-box">
      <div class="section-title">1. Faculty Mentor Profile</div>
      <table class="grid-table">
        <tr>
          <td class="field-label">Faculty Name:</td>
          <td class="field-value">_________________________</td>
          <td class="field-label">Faculty PRN / ID:</td>
          <td class="field-value">_________________________</td>
        </tr>
        <tr>
          <td class="field-label">Department / School:</td>
          <td class="field-value">_________________________</td>
          <td class="field-label">Designation:</td>
          <td class="field-value">_________________________</td>
        </tr>
        <tr>
          <td class="field-label">Mobile Number:</td>
          <td class="field-value">_________________________</td>
          <td class="field-label">Email ID:</td>
          <td class="field-value">_________________________</td>
        </tr>
        <tr>
          <td class="field-label">Assigned Batch / Squad:</td>
          <td class="field-value">_________________________</td>
          <td class="field-label">T-Shirt Size:</td>
          <td class="field-value">[ S / M / L / XL / 2XL ]</td>
        </tr>
      </table>
    </div>

    <!-- Honor Code Declaration -->
    <div class="section-box">
      <div class="section-title">2. LTC Honor Code & Conduct Undertaking</div>
      <p style="font-size: 11px; margin-bottom: 6px; color: #1e293b; font-weight: 600;">
        As a designated representative and faculty mentor of MIT World Peace University participating in the Life Awakening Program (LTC), I solemnly declare and agree that:
      </p>
      <ol class="code-list">
        <li><strong>Mentorship & Squad Guidance:</strong> I will actively mentor, monitor, and guide all students assigned to my squad throughout the immersion, facilitating their active participation across all sessions and milestone achievements.</li>
        <li><strong>Punctuality & Objective Evaluation:</strong> I will be present at all scheduled activities and evaluation pillars on time, and evaluate student performances objectively and fairly according to the official LTC Rubric.</li>
        <li><strong>Student Welfare & Duty of Care:</strong> I will maintain the highest standard of discipline, safety, and care for my students, proactively reporting any medical issues, behavioural anomalies, or emergency incidents immediately to the LTC Coordination Desk.</li>
        <li><strong>Institutional Decorum & Role:</strong> I will uphold exemplary professional decorum, adhere to camp regulations, and contribute positively to the transformative character development of all students.</li>
      </ol>
    </div>

    <!-- Mandatory Consents Checklist -->
    <div class="section-box" style="margin-bottom: 10px;">
      <div class="section-title">3. Mandatory Declarations & Acknowledgements</div>
      <table class="consent-table">
        <thead>
          <tr>
            <th style="width: 25px;">#</th>
            <th>Category / Clause</th>
            <th style="width: 80px; text-align: center;">Consent Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center;">1</td>
            <td><strong>Photo & Video Media Consent:</strong> Permission for official educational, documentation, and archival coverage during LTC camp.</td>
            <td class="checkbox-cell">[ ✓ ] Accepted</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td><strong>Health & Emergency Data Privacy:</strong> Authorization to store and utilize emergency medical contact and health particulars for safety.</td>
            <td class="checkbox-cell">[ ✓ ] Accepted</td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td><strong>Campus Discipline & Security Checks:</strong> Agreement to camp safety protocol, prohibited items policy, and room/bag checking norms.</td>
            <td class="checkbox-cell">[ ✓ ] Accepted</td>
          </tr>
          <tr>
            <td style="text-align: center;">4</td>
            <td><strong>Do's & Don'ts Policy Adherence:</strong> Full commitment to camp guidelines, alcohol/substance-free campus policy, and session schedule.</td>
            <td class="checkbox-cell">[ ✓ ] Accepted</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Signatures -->
    <div class="sign-section">
      <div class="sign-col">
        <div class="sign-box">
          <div style="font-size: 10px; color: #64748b; font-weight: 700;">DIGITAL / PHYSICAL SIGNATURE</div>
          <div class="sign-line">Faculty Mentor Signature & Date</div>
        </div>
      </div>
      <div class="sign-col">
        <div class="sign-box">
          <div style="font-size: 10px; color: #64748b; font-weight: 700;">VERIFICATION & AUTHORIZATION</div>
          <div class="sign-line">LTC Organizing Committee / Head Coordinator</div>
        </div>
      </div>
    </div>

    <div class="footer-notice">
      Official Document · Life Transformation Centre (LTC) · MIT World Peace University, Pune · Confidential & Archival Copy
    </div>
  </div>
</body>
</html>
  `;

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '10mm',
      bottom: '10mm',
      left: '10mm',
      right: '10mm'
    }
  });

  await browser.close();
  console.log('PDF successfully generated at:', outputPath);
}

generatePDF().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
