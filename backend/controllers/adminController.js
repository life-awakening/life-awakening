const bcrypt = require('bcryptjs');
const fs = require('fs');
const XLSX = require('xlsx');
const pool = require('../config/db');
const { sendLtcBatchEmail, sendSquadNotificationEmail, assertManualAdminTrigger } = require('../config/mailer');
const { seedImmersionSchedulesForBatch } = require('../config/initDb');
const { withLtcId, writeAudit, createSystemNotification } = require('../utils/helpers');
const { SQUAD_NAMES } = require('../utils/constants');
const { getCanonicalSchool, getCanonicalDepartment, OFFICIAL_HIERARCHY } = require('../utils/hierarchy');
const storageService = require('../services/storageService');
const { getAvailableRoomsForBatch, validateRoomAssignment } = require('../utils/roomHelper');
const { computeAggregatedFeedbackAnalytics } = require('../utils/feedbackRatingExtractor');
const { normalizeClassGrade, CANONICAL_CLASSES, isValidCanonicalClass } = require('../utils/classNormalizer');


// ─── Official Template Header Mapping ───────────────────────────────────────
// Maps verbose Excel column headers (lowercased+trimmed) to internal field names.
// This is purely additive — old CSVs with "name/email/role" columns still work.
const OFFICIAL_HEADER_MAP = {
  // Exact 25 Student Bulk Upload Headers & variations
  'sr.no': '_sr_no',
  'sr.no.': '_sr_no',
  'sr. no': '_sr_no',
  'sr. no.': '_sr_no',
  'sr no': '_sr_no',
  'prn no': '_prn_raw',
  'prn no.': '_prn_raw',
  'prn number': '_prn_raw',
  'prn': '_prn_raw',
  'student prn': '_prn_raw',
  'student id': '_prn_raw',
  'student name': 'name',
  'salutation - mr / ms': 'salutation',
  'salutation': 'salutation',
  'first name ( as per aadhar card )': 'first_name',
  'first name (as per aadhar card)': 'first_name',
  'first name': 'first_name',
  'name': 'first_name',
  'middle name ( as per aadhar card)': 'middle_name',
  'middle name ( as per aadhar card )': 'middle_name',
  'middle name (as per aadhar card)': 'middle_name',
  'middle name': 'middle_name',
  'last name ( as per aadhar card )': 'last_name',
  'last name (as per aadhar card)': 'last_name',
  'last name': 'last_name',
  'surname': 'last_name',
  'mobile no': 'phone',
  'mobile no.': 'phone',
  'mobile number': 'phone',
  'date of birth (dd/mm/yyyy)': 'dob',
  'date of birth (dd/mmm/yyyy)': 'dob',
  'date of birth': 'dob',
  'gender': 'gender',
  'age': 'age',
  'age on date': 'age',
  'nationality': 'nationality',
  'aadhar card no': 'aadhar_no',
  'aadhar card no.': 'aadhar_no',
  'nominee name': 'nominee_name',
  'nominee name ( as per aadhar card )': 'nominee_name',
  'nominee relationship': 'nominee_relationship',
  'email address': 'email',
  'student email address': 'email',
  'student email id': 'email',
  'student email': 'email',
  'faculty email address': 'email',
  'email id': 'email',
  'email': 'email',
  'complete address with pincode': 'address',
  'panel': 'panel',
  'roll number': 'roll_number',
  'school': 'school',
  'department': 'department',
  'nominee email id': 'nominee_email',
  'parent/guardian mobile (preferably whatsapp number)': 'parent_mobile',
  'parent / guardian mobile (preferably whatsapp number)': 'parent_mobile',
  'parent/guardian mobile': 'parent_mobile',
  'parent / guardian mobile': 'parent_mobile',
  'parent/guardian mobile no': 'parent_mobile',
  'parent/guardian mobile no.': 'parent_mobile',
  'parent / guardian mobile no': 'parent_mobile',
  'parent / guardian mobile no.': 'parent_mobile',
  'parent/guardian mobile number': 'parent_mobile',
  'parent / guardian mobile number': 'parent_mobile',
  'parent/guardian contact': 'parent_mobile',
  'parent / guardian contact': 'parent_mobile',
  'parent/guardian contact no': 'parent_mobile',
  'parent / guardian contact no': 'parent_mobile',
  'parent/guardian contact number': 'parent_mobile',
  'parent / guardian contact number': 'parent_mobile',
  'parent mobile': 'parent_mobile',
  'parent mobile no': 'parent_mobile',
  'parent mobile no.': 'parent_mobile',
  'parent mobile number': 'parent_mobile',
  'parents mobile': 'parent_mobile',
  'parents mobile no': 'parent_mobile',
  'parents mobile no.': 'parent_mobile',
  'parents mobile number': 'parent_mobile',
  'guardian mobile': 'parent_mobile',
  'guardian mobile no': 'parent_mobile',
  'guardian mobile no.': 'parent_mobile',
  'guardian mobile number': 'parent_mobile',
  'email id parent': 'parent_email',
  'parent email id': 'parent_email',
  'parent email': 'parent_email',
  'parent email address': 'parent_email',
  'parents email': 'parent_email',
  'division': 'division',
  'faculty': 'faculty',
  // IDs & Faculty
  'employee id': '_faculty_id_raw',
  'emp id': '_faculty_id_raw',
  'emp id.': '_faculty_id_raw',
  'designation': 'designation',
  'lateral entry (yes/no)': 'lateral_entry',
  'lateral entry': 'lateral_entry',
  'personal email': 'personal_email',
  'personal email address': 'personal_email',
  // LTC Member bulk upload format
  'full name': 'name',
  'email (official)': 'email',
  'email(official)': 'email',
  'official email': 'email',
  'email(personal)': 'personal_email',
  'email (personal)': 'personal_email',
  'contact number': 'phone',
  'contact no': 'phone',
  'contact no.': 'phone',
  'phone number': 'phone',
  'role': 'role',
  // Life Awakening School Registration 2026 Format
  'timestamp': 'timestamp',
  'parent_email_1': 'parent_email_1',
  'parent_email_2': 'parent_email_2',
  'parent_email': 'parent_email',
  'email address1': 'parent_email_1',
  'email address 1': 'parent_email_1',
  'email address2': 'parent_email_2',
  'email address 2': 'parent_email_2',
  'email 1': 'parent_email_1',
  'email 2': 'parent_email_2',
  'parent email 1': 'parent_email_1',
  'parent email 2': 'parent_email_2',
  'parent email': 'parent_email',
  'student full name': 'name',
  'student full name ': 'name',
  'blood group': 'blood_group',
  'blood group ': 'blood_group',
  'name of the school': 'school',
  'name of school': 'school',
  'school name': 'school',
  'school branch': 'school_branch',
  'class / standard': 'class_grade',
  'class / standard ': 'class_grade',
  'class/standard': 'class_grade',
  'prn/ roll no.': 'prn',
  'prn / roll no.': 'prn',
  'prn/ roll no': 'prn',
  'prn / roll no': 'prn',
  'prn/roll no.': 'prn',
  'prn/roll no': 'prn',
  'parent/guardian name': 'nominee_name',
  'parent/guardian name ': 'nominee_name',
  'parent / guardian name': 'nominee_name',
  'relationship with student': 'nominee_relationship',
  'relationship with student ': 'nominee_relationship',
  'contact number (valid what\'s app mobile number)': 'phone',
  'contact number (valid whats app mobile number)': 'phone',
  'contact number (valid whatsapp mobile number)': 'phone',
  'alternate contact number': 'emergency_contact_alt_mobile',
  'alternate contact number ': 'emergency_contact_alt_mobile',
  'residential address': 'address',
  'residential address ': 'address',
  'upload payment screenshot': 'payment_screenshot_url',
  'does your child have any medical condition?': 'has_medical_condition',
  'does your child have any medical condition? ': 'has_medical_condition',
  'does your child have any medical condition': 'has_medical_condition',
  'if yes - please specify details': 'medical_conditions',
  'if yes - please specify details ': 'medical_conditions',
  'if yes please specify details': 'medical_conditions',
  'any allergies': 'known_allergies',
  'parent/guardian consent confirmation': 'parent_consent_text',
  'parent/guardian consent confirmation ': 'parent_consent_text',
  'parent / guardian consent confirmation': 'parent_consent_text',
  'upload digital signature as a confirmation': 'digital_signature_url',
  'upload digital signature as confirmation': 'digital_signature_url',
  'upload digital signature': 'digital_signature_url',
  'digital signature': 'digital_signature_url',
  'student_email_raw': 'email',
  'parent_email_raw': 'parent_email',
};

/**
 * Detect whether a row's keys look like an official Student, School Registration, or Faculty template.
 * Returns 'life_awakening_student', 'student', 'faculty', or null.
 */
const detectTemplateType = (normalizedKeys) => {
  const keys = normalizedKeys.map(k => k.toLowerCase().trim());
  if (keys.some(k => k.includes('name of the school') || k.includes('student full name') || k.includes('school branch') || k.includes('class / standard') || k.includes('upload payment screenshot') || k.includes('medical condition') || k.includes('email address1') || k.includes('email address 1') || k.includes('email address 2'))) {
    return 'life_awakening_student';
  }
  if (keys.includes('prn no') || keys.includes('prn no.') || keys.includes('prn number')) return 'student';
  if (keys.includes('employee id')) return 'faculty';
  return null;
};

/**
 * Smart Sheet Parser:
 * Detects the actual header row by scanning rows for recognizable header keywords.
 * Skips empty leading title/banner rows (e.g. empty row 1).
 */
const parseExcelSheetSmart = (worksheet) => {
  if (!worksheet) return [];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  if (!rawRows || rawRows.length === 0) return [];

  let headerIndex = -1;
  const headerKeywords = [
    'prn', 'first name', 'last name', 'salutation', 'mobile', 'date of birth',
    'sr.no', 'sr no', 's.no', 'email', 'name', 'employee id', 'emp id', 'full name',
    'student id', 'roll number', 'division', 'faculty', 'panel',
    'student full name', 'name of the school', 'school branch', 'upload payment screenshot',
    'does your child have any medical condition', 'email address1', 'email address 1', 'email address 2'
  ];

  for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;
    const rowStr = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
    if (headerKeywords.some(kw => rowStr.includes(kw))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    headerIndex = rawRows.findIndex(r => Array.isArray(r) && r.some(c => String(c || '').trim() !== ''));
    if (headerIndex === -1) headerIndex = 0;
  }

  const headerRow = rawRows[headerIndex].map(c => String(c || '').trim());
  const dataRows = rawRows.slice(headerIndex + 1);

  // Identify column indices for school registration format
  let parentEmail1ColIdx = -1;
  let parentEmail2ColIdx = -1;
  let genericEmailColIdx1 = -1;
  let genericEmailColIdx2 = -1;

  for (let c = 0; c < headerRow.length; c++) {
    const h = headerRow[c].toLowerCase().replace(/\s+/g, ' ').trim();
    if (h === 'email address1' || h === 'email address 1' || h === 'parent email 1') {
      parentEmail1ColIdx = c;
    } else if (h === 'email address 2' || h === 'email address2' || h === 'parent email 2') {
      parentEmail2ColIdx = c;
    } else if (h === 'email address' || h === 'email' || h === 'email id') {
      if (genericEmailColIdx1 === -1) {
        genericEmailColIdx1 = c;
      } else if (genericEmailColIdx2 === -1) {
        genericEmailColIdx2 = c;
      }
    }
  }

  const result = [];
  for (const row of dataRows) {
    if (!Array.isArray(row) || !row.some(c => String(c || '').trim() !== '')) continue;
    const obj = {};
    for (let c = 0; c < headerRow.length; c++) {
      const header = headerRow[c];
      if (header) {
        const val = row[c] !== undefined ? row[c] : "";
        if (c === parentEmail1ColIdx) {
          obj['parent_email_1'] = val;
        } else if (c === parentEmail2ColIdx) {
          obj['parent_email_2'] = val;
        } else if (parentEmail1ColIdx === -1 && parentEmail2ColIdx === -1 && genericEmailColIdx1 !== -1 && genericEmailColIdx2 !== -1) {
          if (c === genericEmailColIdx1) obj['parent_email_1'] = val;
          else if (c === genericEmailColIdx2) obj['parent_email_2'] = val;
          else obj[header] = val;
        } else {
          obj[header] = val;
        }
      }
    }
    obj._rawRowArray = row;
    result.push(obj);
  }
  return result;
};

/**
 * Apply official header mapping to a raw row object.
 * Trims leading/trailing spaces from string values, collapses multiple spaces in headers, and ignores extra blank columns.
 * Returns a new normalized object with internal field names.
 */
const mapOfficialHeaders = (rawRow) => {
  const out = {};
  if (!rawRow || typeof rawRow !== 'object') return out;
  for (const key in rawRow) {
    if (!key || key === '_rawRowArray') continue;
    const cleanKey = key.replace(/^\uFEFF/, '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!cleanKey || cleanKey.startsWith('__empty')) continue;

    let rawVal = rawRow[key];
    if (typeof rawVal === 'string') {
      rawVal = rawVal.trim();
    }

    let mappedKey = OFFICIAL_HEADER_MAP[cleanKey];
    if (!mappedKey) {
      if (cleanKey.startsWith('parent/guardian consent') || cleanKey.startsWith('parent / guardian consent')) {
        mappedKey = 'parent_consent_text';
      } else {
        // Smart regex fallback for parent/guardian mobile and email
        const normKey = cleanKey.replace(/[^a-z0-9]/g, ' ');
        if ((normKey.includes('parent') || normKey.includes('guardian')) &&
          (normKey.includes('mobile') || normKey.includes('phone') || normKey.includes('contact') || normKey.includes('whatsapp') || normKey.includes('cell')) &&
          !normKey.includes('email')) {
          mappedKey = 'parent_mobile';
        } else if ((normKey.includes('parent') || normKey.includes('guardian') || normKey.includes('email')) && (normKey.includes('email') || normKey.includes('address'))) {
          if (normKey.includes('1') || normKey.includes('one') || normKey.includes('first')) {
            mappedKey = 'parent_email_1';
          } else if (normKey.includes('2') || normKey.includes('two') || normKey.includes('second')) {
            mappedKey = 'parent_email_2';
          } else if (normKey.includes('parent') || normKey.includes('guardian')) {
            mappedKey = 'parent_email';
          }
        } else if (normKey.includes('email') && !normKey.includes('parent') && !normKey.includes('nominee') && !normKey.includes('personal')) {
          mappedKey = 'email';
        } else if (normKey === 'prn' || normKey.startsWith('prn ') || normKey.endsWith(' prn')) {
          mappedKey = '_prn_raw';
        } else if (normKey.includes('payment') && normKey.includes('screenshot')) {
          mappedKey = 'payment_screenshot_url';
        } else if (normKey.includes('digital') && normKey.includes('signature')) {
          mappedKey = 'digital_signature_url';
        } else if (normKey.includes('medical') && (normKey.includes('condition') || normKey.includes('details'))) {
          mappedKey = 'has_medical_condition';
        } else if (normKey.includes('allerg')) {
          mappedKey = 'known_allergies';
        }
      }
    }

    if (mappedKey) {
      out[mappedKey] = rawVal;
    } else {
      out[cleanKey] = rawVal;
    }
  }

  // Parse consent declaration
  if (out.parent_consent_text !== undefined) {
    const consentVal = String(out.parent_consent_text || '').toLowerCase().trim();
    out.parent_consent_confirmed = (consentVal === 'confirmed' || consentVal === 'yes' || consentVal === 'true' || consentVal === 'agree' || consentVal.includes('confirm') || consentVal.includes('agree'));
  }

  // School registration: WhatsApp contact serves as phone and parent mobile
  if (out.phone && !out.parent_mobile) {
    out.parent_mobile = out.phone;
  }

  // PRN also serves as roll number if roll number is not separately provided
  if (out.prn && !out.roll_number) {
    out.roll_number = String(out.prn).trim();
  }

  // Payment status
  if (out.payment_screenshot_url) {
    const urlStr = String(out.payment_screenshot_url).trim();
    out.payment_status = urlStr.length > 0 ? 'submitted' : 'pending';
  } else {
    out.payment_status = 'pending';
  }

  if (out.class_grade) {
    out._raw_class_grade = out.class_grade;
    const normalizedClass = normalizeClassGrade(out.class_grade);
    if (normalizedClass) {
      out.class_grade = normalizedClass;
    }
  }

  if (out.school) {
    out.school = getCanonicalSchool(out.school);
  }
  if (out.department) {
    out.department = getCanonicalDepartment(out.department);
  }

  return out;
};

/**
 * Flexible Date of Birth parser accepting:
 * - 01/01/2005 (DD/MM/YYYY) or 1/1/2005
 * - 01-Jan-2005 / 01/Jan/2005 / 1 Jan 2005
 * - 2005-01-01 (YYYY-MM-DD)
 * - Excel date cells (serial number / Date object)
 * Normalizes all valid dates to YYYY-MM-DD string format before saving.
 */
const parseExcelDate = (val) => {
  if (val === undefined || val === null || val === '') return null;

  // 1. If already a JS Date object
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getUTCFullYear() || val.getFullYear();
    const m = String((val.getUTCMonth() !== undefined ? val.getUTCMonth() : val.getMonth()) + 1).padStart(2, '0');
    const d = String(val.getUTCDate() || val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. If number (Excel serial date)
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return null;
    try {
      if (XLSX && XLSX.SSF && typeof XLSX.SSF.parse_date_code === 'function') {
        const parsed = XLSX.SSF.parse_date_code(val);
        if (parsed && parsed.y && parsed.m && parsed.d) {
          const y = String(parsed.y).padStart(4, '0');
          const m = String(parsed.m).padStart(2, '0');
          const d = String(parsed.d).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
      }
    } catch (_) { }
    const date = new Date((val - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return null;
  }

  // 3. String date formats
  let str = String(val).trim();
  if (!str) return null;

  // 3a. ISO format YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 3b. Text Month formats: DD-MMM-YYYY, DD/MMM/YYYY, D MMM YYYY, etc.
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const monthTextMatch = str.match(/^(\d{1,2})[\s\-\/\.]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-\/\.]+(\d{2,4})$/i);
  if (monthTextMatch) {
    const d = parseInt(monthTextMatch[1], 10);
    const mStr = monthTextMatch[2].toLowerCase();
    let y = parseInt(monthTextMatch[3], 10);
    if (y < 100) y += (y > 30 ? 1900 : 2000);
    const mIdx = months.indexOf(mStr);
    if (mIdx !== -1 && d >= 1 && d <= 31) {
      const m = mIdx + 1;
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 3c. Numeric DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{2,4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += (y > 30 ? 1900 : 2000);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 3d. Fallback to Date.parse
  const timestamp = Date.parse(str);
  if (!isNaN(timestamp)) {
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
};
// ────────────────────────────────────────────────────────────────────────────

const processLifeAwakeningStudentUploadJob = async (
  jobId,
  parsedData,
  batchId = null,
  adminUserId = null,
  adminUserName = 'Admin',
  duplicateAction = 'replace'
) => {
  let processed = 0;
  let success = 0;
  let failed = 0;
  let skipped = 0;
  const errorsList = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const totalRecords = parsedData.length;
  if (jobId) {
    await pool.query(
      "UPDATE upload_jobs SET total_records = $1, status = 'importing', updated_at = NOW() WHERE id = $2",
      [totalRecords, jobId]
    );
  }

  const defaultParentHash = await bcrypt.hash('student123', 10);

  const cleanStr = (val, maxLen = 250) => {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    if (!str) return null;
    return str.length > maxLen ? str.substring(0, maxLen) : str;
  };

  let targetBatch = null;
  if (batchId) {
    const bRes = await pool.query("SELECT id, name, capacity, class_grade FROM batches WHERE id = $1 AND is_deleted IS NOT TRUE", [batchId]);
    if (bRes.rowCount > 0) {
      targetBatch = bRes.rows[0];
    }
  }

  for (let idx = 0; idx < parsedData.length; idx++) {
    const rawRow = parsedData[idx];
    const rowNum = idx + 2;
    if (!rawRow || typeof rawRow !== 'object' || Object.keys(rawRow).length === 0) continue;

    const r = mapOfficialHeaders(rawRow);

    // 1. Student Name
    let nameVal = r.name || r.full_name || r.student_name;
    if (!nameVal) {
      const parts = [
        String(r.salutation || '').trim(),
        String(r.first_name || '').trim(),
        String(r.middle_name || '').trim(),
        String(r.last_name || '').trim(),
      ].filter(Boolean);
      if (parts.length > 0) nameVal = parts.join(' ');
    } else if (r.last_name && !nameVal.includes(r.last_name)) {
      nameVal = `${nameVal} ${r.last_name}`.trim();
    }
    const studentName = cleanStr(nameVal, 255);

    if (!studentName) {
      failed++;
      errorsList.push({ row: `Row ${rowNum}`, error: 'Missing required field: Student Full Name' });
      continue;
    }

    // 2. Class / Standard canonical validation
    const rawClass = r.class_grade || r._raw_class_grade;
    const canonicalClass = normalizeClassGrade(rawClass);
    if (!canonicalClass) {
      failed++;
      errorsList.push({
        row: studentName || `Row ${rowNum}`,
        error: `Invalid or unsupported Class / Standard: "${rawClass || 'empty'}". Allowed canonical classes: 6th, 7th, 8th, 9th, 10th.`
      });
      continue;
    }

    // 3. Parent Emails
    const p1Raw = r.parent_email_1 || (r.parent_email && !r.parent_email_2 ? r.parent_email : null) || r.email;
    const p2Raw = r.parent_email_2 || (r.parent_email && r.parent_email !== p1Raw ? r.parent_email : null);
    const p1 = p1Raw ? String(p1Raw).toLowerCase().trim() : null;
    const p2 = p2Raw ? String(p2Raw).toLowerCase().trim() : null;

    const validParentEmails = [];
    if (p1) {
      if (!emailRegex.test(p1)) {
        errorsList.push({ row: studentName, error: `Invalid email format for Email Address1: "${p1}"` });
      } else {
        validParentEmails.push(p1);
      }
    }
    if (p2) {
      if (!emailRegex.test(p2)) {
        errorsList.push({ row: studentName, error: `Invalid email format for Email Address 2: "${p2}"` });
      } else if (!validParentEmails.includes(p2)) {
        validParentEmails.push(p2);
      }
    }

    if (validParentEmails.length === 0) {
      failed++;
      errorsList.push({
        row: studentName || `Row ${rowNum}`,
        error: 'At least one valid parent email address is required (Email Address1 or Email Address 2).'
      });
      continue;
    }

    // 4. DOB
    let dobParsed = null;
    if (r.dob) {
      dobParsed = parseExcelDate(r.dob);
      if (!dobParsed) {
        errorsList.push({ row: studentName, error: `Warning: Invalid date format for DOB: "${r.dob}"` });
      }
    }

    // 5. Transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Duplicate detection: name + class_grade
      const candRes = await client.query(
        `SELECT u.id, u.name, u.class_grade, u.school, u.school_branch, u.dob, u.email
         FROM users u
         WHERE u.role = 'student'
           AND LOWER(TRIM(u.name)) = LOWER(TRIM($1))
           AND (u.class_grade = $2 OR u.class_grade IS NULL)`,
        [studentName, canonicalClass]
      );

      let matchedStudentId = null;
      for (const cand of candRes.rows) {
        const candDob = cand.dob ? new Date(cand.dob).toISOString().slice(0, 10) : null;
        const inputDob = dobParsed ? new Date(dobParsed).toISOString().slice(0, 10) : null;
        const sameDob = candDob && inputDob && candDob === inputDob;
        const candSchool = (cand.school || '').toLowerCase().trim();
        const inputSchool = (r.school || '').toLowerCase().trim();
        const sameSchool = candSchool && inputSchool && candSchool === inputSchool;

        const linkCheck = await client.query(
          `SELECT 1 FROM parent_students ps
           JOIN users p ON ps.parent_id = p.id
           WHERE ps.student_id = $1 AND LOWER(TRIM(p.email)) = ANY($2)`,
          [cand.id, validParentEmails]
        );
        const linkedToParent = linkCheck.rowCount > 0;

        if (sameDob || sameSchool || linkedToParent) {
          matchedStudentId = cand.id;
          break;
        }
      }

      // Safe PRN & Classroom Roll Number handling
      const rawPrn = cleanStr(r.prn, 100);
      const rawRollNo = cleanStr(r.roll_number || r.prn, 100);

      let safePrn = null;
      if (rawPrn) {
        const prnCheck = await client.query(
          "SELECT id, name, role, class_grade, school FROM users WHERE prn = $1",
          [rawPrn]
        );
        if (prnCheck.rowCount === 0) {
          safePrn = rawPrn;
        } else {
          const existingPrnOwner = prnCheck.rows[0];
          if (matchedStudentId && existingPrnOwner.id === matchedStudentId) {
            safePrn = rawPrn;
          } else {
            safePrn = null;
            errorsList.push({
              row: studentName,
              error: `Notice: PRN/Roll No. "${rawPrn}" is already assigned to "${existingPrnOwner.name}" (${existingPrnOwner.role}). Preserved in roll_number column; PRN left unassigned to avoid collision.`
            });
          }
        }
      }

      let studentId = matchedStudentId;

      if (studentId) {
        if (duplicateAction === 'skip') {
          skipped++;
          errorsList.push({ row: studentName, error: `Duplicate student detected and skipped: "${studentName}" (${canonicalClass})` });
        } else {
          await client.query(
            `UPDATE users SET
              school = COALESCE($1, school),
              school_branch = COALESCE($2, school_branch),
              division = COALESCE($3, division),
              phone = COALESCE($4, phone),
              parent_mobile = COALESCE($5, parent_mobile),
              emergency_contact_alt_mobile = COALESCE($6, emergency_contact_alt_mobile),
              address = COALESCE($7, address),
              gender = COALESCE($8, gender),
              blood_group = COALESCE($9, blood_group),
              has_medical_condition = COALESCE($10, has_medical_condition),
              medical_conditions = COALESCE($11, medical_conditions),
              known_allergies = COALESCE($12, known_allergies),
              payment_screenshot_url = COALESCE($13, payment_screenshot_url),
              payment_status = COALESCE($14, payment_status),
              digital_signature_url = COALESCE($15, digital_signature_url),
              parent_consent_text = COALESCE($16, parent_consent_text),
              parent_consent_confirmed = COALESCE($17, parent_consent_confirmed),
              nominee_name = COALESCE($18, nominee_name),
              nominee_relationship = COALESCE($19, nominee_relationship),
              prn = CASE WHEN $20::text IS NOT NULL THEN $20::text ELSE prn END,
              roll_number = COALESCE($21, roll_number)
             WHERE id = $22`,
            [
              cleanStr(r.school, 255),
              cleanStr(r.school_branch, 255),
              cleanStr(r.division, 255),
              cleanStr(r.phone, 255),
              cleanStr(r.parent_mobile || r.phone, 255),
              cleanStr(r.emergency_contact_alt_mobile, 255),
              cleanStr(r.address, 1000),
              cleanStr(r.gender, 100),
              cleanStr(r.blood_group, 50),
              cleanStr(r.has_medical_condition, 50),
              cleanStr(r.medical_conditions, 1000),
              cleanStr(r.known_allergies, 1000),
              cleanStr(r.payment_screenshot_url, 2000),
              cleanStr(r.payment_status || (r.payment_screenshot_url ? 'submitted' : 'pending'), 50),
              cleanStr(r.digital_signature_url, 2000),
              cleanStr(r.parent_consent_text, 2000),
              r.parent_consent_confirmed === true,
              cleanStr(r.nominee_name, 255),
              cleanStr(r.nominee_relationship, 100),
              safePrn,
              rawRollNo,
              studentId
            ]
          );
          success++;
        }
      } else {
        const internalEmail = `student_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@lifeawakening.internal`;
        const insertRes = await client.query(
          `INSERT INTO users (
            name, email, role, class_grade, school, school_branch, division,
            phone, parent_mobile, emergency_contact_alt_mobile, address, dob, gender, blood_group,
            has_medical_condition, medical_conditions, known_allergies,
            payment_screenshot_url, payment_status, digital_signature_url,
            parent_consent_text, parent_consent_confirmed,
            nominee_name, nominee_relationship, prn, roll_number, status, password
          ) VALUES (
            $1, $2, 'student', $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16,
            $17, $18, $19,
            $20, $21,
            $22, $23, $24, $25, 'active', $26
          ) RETURNING id`,
          [
            studentName,
            internalEmail,
            canonicalClass,
            cleanStr(r.school, 255),
            cleanStr(r.school_branch, 255),
            cleanStr(r.division, 255),
            cleanStr(r.phone, 255),
            cleanStr(r.parent_mobile || r.phone, 255),
            cleanStr(r.emergency_contact_alt_mobile, 255),
            cleanStr(r.address, 1000),
            dobParsed,
            cleanStr(r.gender, 100),
            cleanStr(r.blood_group, 50),
            cleanStr(r.has_medical_condition, 50),
            cleanStr(r.medical_conditions, 1000),
            cleanStr(r.known_allergies, 1000),
            cleanStr(r.payment_screenshot_url, 2000),
            cleanStr(r.payment_status || (r.payment_screenshot_url ? 'submitted' : 'pending'), 50),
            cleanStr(r.digital_signature_url, 2000),
            cleanStr(r.parent_consent_text, 2000),
            r.parent_consent_confirmed === true,
            cleanStr(r.nominee_name, 255),
            cleanStr(r.nominee_relationship, 100),
            safePrn,
            rawRollNo,
            defaultParentHash
          ]
        );
        studentId = insertRes.rows[0].id;
        success++;
      }

      // Link parents
      for (let pIdx = 0; pIdx < validParentEmails.length; pIdx++) {
        const parentEmail = validParentEmails[pIdx];
        const pCheck = await client.query(
          "SELECT id, role, password FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))",
          [parentEmail]
        );

        let parentId = null;
        if (pCheck.rowCount > 0) {
          parentId = pCheck.rows[0].id;
        } else {
          const pName = cleanStr(r.nominee_name) || 'Parent / Guardian';
          const pPhone = cleanStr(r.parent_mobile || r.phone, 255);
          const pInsertRes = await client.query(
            `INSERT INTO users (name, email, password, role, phone, status)
             VALUES ($1, $2, $3, 'parent', $4, 'active')
             RETURNING id`,
            [pName, parentEmail, defaultParentHash, pPhone]
          );
          parentId = pInsertRes.rows[0].id;
        }

        const relationship = cleanStr(r.nominee_relationship, 100) || (pIdx === 0 ? 'Parent' : 'Secondary Parent');
        const isPrimary = (pIdx === 0);
        await client.query(
          `INSERT INTO parent_students (parent_id, student_id, relationship, is_primary)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (parent_id, student_id) DO NOTHING`,
          [parentId, studentId, relationship, isPrimary]
        );
      }

      // Batch assignment if targetBatch
      // Life Awakening batches are mixed-class: batches.class_grade is informational only
      // and must never block enrolment of a 6th–10th student.
      if (targetBatch && studentId) {
        // Enforce: A student can belong to only one batch
        const otherBatchCheck = await client.query(
          `SELECT b.id, b.name
           FROM batch_students bs
           JOIN batches b ON b.id = bs.batch_id AND (b.is_deleted = false OR b.is_deleted IS NULL)
           WHERE bs.student_id = $1 AND bs.batch_id != $2
           LIMIT 1`,
          [studentId, targetBatch.id]
        );

        if (otherBatchCheck.rowCount > 0) {
          const ob = otherBatchCheck.rows[0];
          errorsList.push({
            row: studentName,
            error: `Student already belongs to batch "${ob.name}" (ID: ${ob.id}). A student can belong to only one batch.`
          });
        } else {
          const capCheck = await client.query("SELECT COUNT(*)::int FROM batch_students WHERE batch_id = $1", [targetBatch.id]);
          const currentCount = capCheck.rows[0].count;
          const limit = targetBatch.capacity || 350;
          if (currentCount < limit) {
            const barcode = `LA-${targetBatch.id}-${studentId}-${Math.floor(Math.random() * 10000)}`;
            await client.query(
              `INSERT INTO batch_students (batch_id, student_id, barcode)
               VALUES ($1, $2, $3)
               ON CONFLICT (batch_id, student_id) DO NOTHING`,
              [targetBatch.id, studentId, barcode]
            );
          } else {
            errorsList.push({
              row: studentName,
              error: `Batch "${targetBatch.name}" capacity of ${limit} students reached. Student saved but not enrolled in batch.`
            });
          }
        }
      }

      await client.query('COMMIT');
    } catch (rowErr) {
      await client.query('ROLLBACK');
      failed++;
      errorsList.push({ row: studentName || `Row ${rowNum}`, error: `Processing error: ${rowErr.message}` });
    } finally {
      client.release();
    }

    processed++;

    if (jobId && (processed % 25 === 0 || processed === totalRecords)) {
      await pool.query(
        `UPDATE upload_jobs
         SET processed_records = $1, success_count = $2, failed_count = $3, errors = $4, updated_at = NOW()
         WHERE id = $5`,
        [processed, success, failed, JSON.stringify(errorsList), jobId]
      );
    }
  }

  if (jobId) {
    await pool.query(
      `UPDATE upload_jobs
       SET status = 'completed', processed_records = $1, success_count = $2, failed_count = $3, errors = $4, updated_at = NOW()
       WHERE id = $5`,
      [processed, success, failed, JSON.stringify(errorsList), jobId]
    );
  }

  return {
    success: true,
    totalRecords,
    processed,
    imported: success,
    skipped,
    failed,
    errors: errorsList
  };
};

const processUploadJobInBackground = async (
  jobId,
  filePath,
  batchId = null,
  isBatchSpecific = false,
  adminUserId = null,
  adminUserName = 'Admin',
  duplicateAction = 'replace',
  isLtcOnly = false
) => {
  let processed = 0;
  let success = 0;
  let failed = 0;
  let errorsList = [];

  try {
    // 1. Update status to 'parsing'
    await pool.query(
      "UPDATE upload_jobs SET status = 'parsing', updated_at = NOW() WHERE id = $1",
      [jobId]
    );

    let parsedData = [];
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      parsedData = parseExcelSheetSmart(worksheet);
    } catch (parseErr) {
      throw new Error(`Failed to parse file: ${parseErr.message}`);
    }

    // 2. Update status to 'validating'
    await pool.query(
      "UPDATE upload_jobs SET status = 'validating', updated_at = NOW() WHERE id = $1",
      [jobId]
    );

    // Fetch existing divisions from database
    let dbDivisions = [];
    try {
      const divisionDbRes = await pool.query(
        "SELECT DISTINCT division FROM users WHERE division IS NOT NULL AND division != ''"
      );
      dbDivisions = divisionDbRes.rows.map(row => row.division);
    } catch (dbErr) {
      console.error("Failed to fetch divisions from database:", dbErr);
    }

    const divisionMap = {};
    const getDivisionNumber = (val) => {
      if (val === undefined || val === null) return null;
      let str = String(val).toLowerCase().trim();
      str = str.replace(/[^a-z0-9]/g, '');
      if (!str) return null;

      const wordsMap = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
      };
      for (const [word, num] of Object.entries(wordsMap)) {
        if (str === word || str.endsWith(word)) {
          return num;
        }
      }

      const arabicMatch = str.match(/\d+/);
      if (arabicMatch) {
        return parseInt(arabicMatch[0], 10);
      }

      let cleanRoman = str;
      if (cleanRoman.startsWith('division')) {
        cleanRoman = cleanRoman.substring(8);
      } else if (cleanRoman.startsWith('div')) {
        cleanRoman = cleanRoman.substring(3);
      } else if (cleanRoman.startsWith('d') && cleanRoman.length > 1) {
        cleanRoman = cleanRoman.substring(1);
      }

      const romanMap = {
        'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
        'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10
      };

      if (romanMap[cleanRoman]) {
        return romanMap[cleanRoman];
      }

      return null;
    };

    const standardDivisions = (OFFICIAL_HIERARCHY && Object.keys(OFFICIAL_HIERARCHY).length > 0)
      ? Object.keys(OFFICIAL_HIERARCHY)
      : ['Division I', 'Division II', 'Division III', 'Division IV'];

    const activeDivisions = Array.from(new Set([...standardDivisions, ...dbDivisions]));

    for (const div of activeDivisions) {
      const num = getDivisionNumber(div);
      if (num !== null) {
        divisionMap[num] = div;
      }
      const clean = String(div).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean) {
        divisionMap[clean] = div;
      }
    }

    // Detect template type from first non-empty record

    let detectedTemplate = null;
    for (const r of parsedData) {
      if (r && typeof r === 'object' && Object.keys(r).length > 0) {
        detectedTemplate = detectTemplateType(Object.keys(r));
        break;
      }
    }

    if (detectedTemplate === 'life_awakening_student' && !isLtcOnly) {
      return await processLifeAwakeningStudentUploadJob(
        jobId,
        parsedData,
        batchId,
        adminUserId,
        adminUserName,
        duplicateAction
      );
    }

    const uniqueRecords = [];
    const seenPrnsInFile = new Set();
    const seenEmailsInFile = new Set();
    const seenFacultyIdsInFile = new Set();

    // Regular expressions for validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9\s\-()]{10,15}$/;

    for (let idx = 0; idx < parsedData.length; idx++) {
      const r = parsedData[idx];
      const rowNum = idx + 2; // Excel row numbering starts at 1, header is row 1, so row is idx + 2

      if (!r || typeof r !== 'object' || Object.keys(r).length === 0) continue;

      const normalized = mapOfficialHeaders(r);

      // Resolve fields
      const prn = String(
        normalized._prn_raw || normalized.prn || normalized['student id'] || normalized.student_id || ''
      ).trim();
      const email = String(normalized.email || '').trim().toLowerCase();
      const facultyId = String(
        normalized._faculty_id_raw || normalized.faculty_id || normalized['faculty id'] || ''
      ).trim();

      let role = String(normalized.role || '').toLowerCase().trim();
      // Normalize human-readable role variants
      if (role === 'ltc member') role = 'ltc_member';
      if (role === 'faculty member') role = 'faculty';
      if (isLtcOnly) {
        role = 'ltc_member';
      } else {
        if (!role && detectedTemplate) role = detectedTemplate;
        if (!role && prn) role = 'student';
        if (!role && facultyId) role = 'faculty';
      }

      const isFaculty = role === 'faculty' || role === 'ltc_member' || (!prn && facultyId);
      const isStudent = !isFaculty;

      // Validate role
      const validRoles = ['student', 'faculty', 'ltc_member', 'admin'];
      const resolvedRole = role === 'ltc_member' ? 'ltc_member' : (isFaculty ? 'faculty' : 'student');
      if (!validRoles.includes(resolvedRole)) {
        failed++;
        errorsList.push({ row: `Row ${rowNum}`, error: `Invalid role: "${role || resolvedRole}"` });
        continue;
      }

      // Reconstruct name if missing or combine if surname/last_name exists
      let nameVal = normalized.name || normalized.full_name || normalized.student_name;
      if (!nameVal) {
        const parts = [
          String(normalized.first_name || '').trim(),
          String(normalized.middle_name || '').trim(),
          String(normalized.last_name || '').trim(),
        ].filter(Boolean);
        if (parts.length > 0) {
          const sal = String(normalized.salutation || '').trim();
          nameVal = sal ? `${sal} ${parts.join(' ')}` : parts.join(' ');
        }
      } else if (normalized.last_name && !nameVal.includes(normalized.last_name)) {
        nameVal = `${nameVal} ${normalized.last_name}`.trim();
      }
      normalized.name = nameVal || '';

      const name = nameVal;
      const prnLower = prn.toLowerCase();
      const isLeftOrEmptyPRN = !prn || prnLower.includes('left') || prnLower.includes('cancelled') || prnLower.includes('n/a');

      // ── Silently skip completely empty / withdrawn placeholder rows ──
      if ((!name || String(name).trim() === '') && (!email && isLeftOrEmptyPRN && !facultyId)) {
        continue;
      }

      // ── Validation: Missing name ──
      if (!name || String(name).trim() === '') {
        failed++;
        errorsList.push({ row: `Row ${rowNum}`, error: 'Missing required field: Name' });
        continue;
      }

      // ── Validation: Missing required identifier ──
      if (isStudent && !email) {
        failed++;
        errorsList.push({ row: name || `Row ${rowNum}`, error: 'Missing required field: Email Address (Student Login Email)' });
        continue;
      }
      if (!email && isLeftOrEmptyPRN && !facultyId) {
        failed++;
        errorsList.push({ row: name || `Row ${rowNum}`, error: 'Missing required identifier: at least one of Email, PRN, or Faculty ID must be present.' });
        continue;
      }

      // ── Validation: Invalid Email format ──
      if (email && !emailRegex.test(email)) {
        failed++;
        errorsList.push({ row: name || `Row ${rowNum}`, error: `Invalid email format: "${email}"` });
        continue;
      }

      // ── Validation: Invalid Phone format ──
      const phone = String(normalized.phone || '').trim();
      if (phone) {
        const cleanDigits = phone.replace(/[^0-9]/g, '');
        if (cleanDigits.length < 7 || cleanDigits.length > 15) {
          if (isStudent && cleanDigits.length < 5) {
            failed++;
            errorsList.push({ row: name || `Row ${rowNum}`, error: `Invalid phone number format: "${phone}"` });
            continue;
          }
          errorsList.push({ row: name || `Row ${rowNum}`, error: `Warning: Phone number format may be unusual: "${phone}" (row still imported)` });
        }
      }

      // ── Validation: Invalid Date format ──
      let dobParsed = null;
      if (normalized.dob) {
        const parsedDateStr = parseExcelDate(normalized.dob);
        if (!parsedDateStr) {
          failed++;
          errorsList.push({ row: name || `Row ${rowNum}`, error: `Invalid date format for DOB: "${normalized.dob}"` });
          continue;
        } else {
          dobParsed = parsedDateStr;
        }
      }

      // ── Validation: Age (allow ages 3 to 100 for school children) ──
      if (normalized.age !== undefined && normalized.age !== null && normalized.age !== '') {
        const parsedAge = parseInt(normalized.age, 10);
        if (isNaN(parsedAge) || parsedAge < 3 || parsedAge > 100) {
          failed++;
          errorsList.push({ row: name, error: `Invalid age: "${normalized.age}". Must be a number between 3 and 100.` });
          continue;
        }
        normalized.age = parsedAge;
      } else if (dobParsed) {
        const birthDate = new Date(dobParsed);
        if (!isNaN(birthDate.getTime())) {
          const ageDifMs = Date.now() - birthDate.getTime();
          const ageDate = new Date(ageDifMs);
          normalized.age = Math.abs(ageDate.getUTCFullYear() - 1970);
        } else {
          normalized.age = null;
        }
      } else {
        normalized.age = null;
      }

      // ── Validation: Department format ──
      const dept = String(normalized.department || '').trim();
      if (normalized.department !== undefined && normalized.department !== null && normalized.department !== '' && dept === '') {
        failed++;
        errorsList.push({ row: name, error: `Invalid department: Department cannot be empty.` });
        continue;
      }

      // Resolve missing hierarchy values if department or school is present
      const { findHierarchyPathByDepartment, findHierarchyPathBySchool } = require('../utils/hierarchy');
      let resolvedPath = findHierarchyPathByDepartment(dept);
      if (!resolvedPath && normalized.school) {
        resolvedPath = findHierarchyPathBySchool(normalized.school);
      }
      if (resolvedPath) {
        normalized.division = normalized.division || resolvedPath.division;
        normalized.faculty = normalized.faculty || resolvedPath.faculty;
        normalized.school = normalized.school || resolvedPath.school;
        normalized.department = resolvedPath.department || normalized.department;
      }

      // ── Validation: Division format ──
      const rawDivision = normalized.division;
      if (rawDivision !== undefined && rawDivision !== null && String(rawDivision).trim() !== '') {
        const inputStr = String(rawDivision).trim();
        const num = getDivisionNumber(inputStr);
        const cleanInput = inputStr.toLowerCase().replace(/[^a-z0-9]/g, '');

        let matchedDivision = null;
        if (num !== null && divisionMap[num]) {
          matchedDivision = divisionMap[num];
        } else if (divisionMap[cleanInput]) {
          matchedDivision = divisionMap[cleanInput];
        }

        // For school students (e.g. "Griffin", "Auriga", "Albatross", "Cygnus"), accept division as-is
        normalized.division = matchedDivision || inputStr;
      }


      // ── Validation: Duplicate check in current file ──
      if (isFaculty) {
        if (facultyId) {
          if (seenFacultyIdsInFile.has(facultyId)) {
            failed++;
            errorsList.push({ row: name, error: `Duplicate Faculty ID within file: "${facultyId}"` });
            continue;
          }
          seenFacultyIdsInFile.add(facultyId);
        }
        if (email) {
          if (seenEmailsInFile.has(email)) {
            failed++;
            errorsList.push({ row: name, error: `Duplicate Email within file: "${email}"` });
            continue;
          }
          seenEmailsInFile.add(email);
        }
      } else {
        if (prn) {
          if (seenPrnsInFile.has(prn)) {
            failed++;
            errorsList.push({ row: name, error: `Duplicate PRN within file: "${prn}"` });
            continue;
          }
          seenPrnsInFile.add(prn);
        }
        if (email) {
          if (seenEmailsInFile.has(email)) {
            failed++;
            errorsList.push({ row: name, error: `Duplicate Email within file: "${email}"` });
            continue;
          }
          seenEmailsInFile.add(email);
        }
      }

      // Auto-generate placeholder email if missing (student with PRN)
      const resolvedEmail = email || (prn ? `${prn.replace(/\s+/g, '').toLowerCase()}@ltc.edu` : null);

      // Normalize lateral entry
      let lateralEntry = false;
      if (normalized.lateral_entry !== undefined) {
        const le = String(normalized.lateral_entry).toLowerCase().trim();
        lateralEntry = le === 'yes' || le === 'true' || le === '1';
      }

      // Re-assign normalized attributes back
      normalized._isFaculty = isFaculty;
      normalized._isStudent = isStudent;
      normalized._prn = prn || null;
      normalized._email = resolvedEmail || null;
      normalized._facultyId = facultyId || null;
      normalized._role = resolvedRole;
      normalized.name = name;
      normalized.dob = dobParsed;
      normalized.lateral_entry = lateralEntry;

      uniqueRecords.push(normalized);
    }

    const totalRecords = uniqueRecords.length + failed;
    await pool.query(
      "UPDATE upload_jobs SET total_records = $1, status = 'importing', updated_at = NOW() WHERE id = $2",
      [totalRecords, jobId]
    );

    const defaultStudentHash = await bcrypt.hash('student123', 10);
    const defaultFacultyHash = await bcrypt.hash('password123', 10);
    const defaultMemberHash = await bcrypt.hash('ltc123', 10);

    const cleanStr = (val, maxLen = 250) => {
      if (val === undefined || val === null) return null;
      const str = String(val).trim();
      if (!str) return null;
      return str.length > maxLen ? str.substring(0, maxLen) : str;
    };

    const CHUNK_SIZE = 250;
    for (let i = 0; i < uniqueRecords.length; i += CHUNK_SIZE) {
      const chunk = uniqueRecords.slice(i, i + CHUNK_SIZE);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const chunkEmails = chunk.map(r => r._email).filter(Boolean);
        const chunkPrns = chunk.map(r => r._prn).filter(Boolean);
        const chunkFacultyIds = chunk.map(r => r._facultyId).filter(Boolean);

        let existingUsers = [];
        if (chunkEmails.length > 0 || chunkPrns.length > 0 || chunkFacultyIds.length > 0) {
          const res = await client.query(
            `SELECT id, email, prn, faculty_id FROM users
             WHERE email = ANY($1) OR prn = ANY($2) OR faculty_id = ANY($3)`,
            [chunkEmails, chunkPrns, chunkFacultyIds]
          );
          existingUsers = res.rows;
        }

        const existingByEmail = new Map();
        const existingByPrn = new Map();
        const existingByFacultyId = new Map();

        for (const u of existingUsers) {
          if (u.email) existingByEmail.set(u.email.toLowerCase(), u);
          if (u.prn) existingByPrn.set(u.prn, u);
          if (u.faculty_id) existingByFacultyId.set(u.faculty_id, u);
        }

        const toInsert = [];
        const toUpdate = [];
        const skippedDuplicates = [];

        for (const r of chunk) {
          let matchedUser = null;
          if (r._email && existingByEmail.has(r._email)) matchedUser = existingByEmail.get(r._email);
          else if (r._prn && existingByPrn.has(r._prn)) matchedUser = existingByPrn.get(r._prn);
          else if (r._facultyId && existingByFacultyId.has(r._facultyId)) matchedUser = existingByFacultyId.get(r._facultyId);

          if (matchedUser) {
            if (duplicateAction === 'skip') {
              skippedDuplicates.push({ id: matchedUser.id, record: r });
            } else {
              toUpdate.push({ id: matchedUser.id, record: r });
            }
          } else {
            toInsert.push(r);
          }
        }

        let insertedRows = [];
        if (toInsert.length > 0) {
          const insertParams = [];
          const insertValueRows = [];
          let paramIdx = 1;

          for (const r of toInsert) {
            const passHash = r._role === 'faculty' ? defaultFacultyHash : (r._role === 'ltc_member' ? defaultMemberHash : defaultStudentHash);
            const rawEmail = r._email ? String(r._email).trim().toLowerCase() : null;
            const values = [
              cleanStr(r.name, 255),
              cleanStr(rawEmail || `temp_${Date.now()}_${Math.floor(Math.random() * 100000)}@ltc.edu`, 255),
              passHash,
              cleanStr(r._role, 50),
              cleanStr(r.department, 255),
              cleanStr(r.semester || r.year, 100),
              cleanStr(r.division, 255),
              cleanStr(r.school, 255),
              cleanStr((r.panel || '').trim().toUpperCase(), 100),
              r.is_primary === 'true' || r.is_primary === true || r.role === 'primary',
              cleanStr(r._prn, 100),
              cleanStr(r._facultyId, 100),
              cleanStr(r.phone, 255),
              cleanStr(r.dob, 50),
              cleanStr(r.gender, 100),
              cleanStr(r.program, 255),
              cleanStr(r.year || r.semester, 100),
              cleanStr(r.designation, 255),
              cleanStr(r.status || 'active', 100),
              r.nri === true || r.nri === 1 || String(r.nri).toLowerCase().trim() === 'yes' || String(r.nri).toLowerCase().trim() === 'true',
              cleanStr(r.salutation, 100),
              cleanStr(r.first_name, 100),
              cleanStr(r.middle_name, 100),
              cleanStr(r.last_name, 100),
              r.age || null,
              cleanStr(r.nationality, 100),
              cleanStr(r.aadhar_no, 100),
              cleanStr(r.nominee_name, 255),
              cleanStr(r.nominee_relationship, 100),
              cleanStr(r.nominee_email, 255),
              cleanStr(r.address, 1000),
              cleanStr(r.roll_number, 100),
              r.lateral_entry === true || false,
              cleanStr(r.parent_mobile, 255),
              cleanStr(r.parent_email, 255),
              cleanStr(r.faculty, 255),
              cleanStr(r.personal_email, 255),
              // School registration fields
              cleanStr(r.blood_group, 50),
              cleanStr(r.known_allergies, 1000),
              cleanStr(r.medical_conditions, 1000),
              cleanStr(r.emergency_contact_alt_mobile, 255),
              cleanStr(r.school_branch, 255),
              cleanStr(r.class_grade, 100),
              cleanStr(r.has_medical_condition, 50),
              cleanStr(r.payment_screenshot_url, 2000),
              cleanStr(r.payment_status || 'submitted', 50),
              cleanStr(r.digital_signature_url, 2000),
              cleanStr(r.parent_consent_text, 2000),
              r.parent_consent_confirmed === true,
              false // password_changed is false
            ];

            const placeholders = [];
            for (let j = 0; j < values.length; j++) {
              placeholders.push(`$${paramIdx++}`);
            }
            insertValueRows.push(`(${placeholders.join(', ')})`);
            insertParams.push(...values);
          }

          const insertRes = await client.query(
            `INSERT INTO users (
               name, email, password, role, department, semester, division, school, panel,
               is_primary, prn, faculty_id, phone, dob, gender, program, year, designation,
               status, nri,
               salutation, first_name, middle_name, last_name, age, nationality, aadhar_no,
               nominee_name, nominee_relationship, nominee_email, address, roll_number,
               lateral_entry, parent_mobile, parent_email, faculty, personal_email,
               blood_group, known_allergies, medical_conditions, emergency_contact_alt_mobile,
               school_branch, class_grade, has_medical_condition, payment_screenshot_url,
               payment_status, digital_signature_url, parent_consent_text, parent_consent_confirmed,
               password_changed
             )
             VALUES ${insertValueRows.join(', ')}
             RETURNING id, email, prn, faculty_id, role, name`,
            insertParams
          );
          insertedRows = insertRes.rows;
          success += insertedRows.length;
        }

        if (toUpdate.length > 0) {
          const updateParams = [];
          const updateValueRows = [];
          let paramIdx = 1;

          for (const item of toUpdate) {
            const r = item.record;
            const rawEmail = r._email ? String(r._email).trim().toLowerCase() : null;
            const values = [
              item.id,
              cleanStr(r.name, 255),
              cleanStr(r.department, 255),
              cleanStr(r.semester || r.year, 100),
              cleanStr(r.division, 255),
              cleanStr(r.school, 255),
              cleanStr((r.panel || '').trim().toUpperCase(), 100),
              cleanStr(r.phone, 255),
              cleanStr(r.dob, 50),
              cleanStr(r.gender, 100),
              cleanStr(r.program, 255),
              cleanStr(r.year || r.semester, 100),
              cleanStr(r.designation, 255),
              cleanStr(r.status || 'active', 100),
              r.nri === true || r.nri === 1 || String(r.nri).toLowerCase().trim() === 'yes' || String(r.nri).toLowerCase().trim() === 'true',
              cleanStr(r.salutation, 100),
              cleanStr(r.first_name, 100),
              cleanStr(r.middle_name, 100),
              cleanStr(r.last_name, 100),
              r.age || null,
              cleanStr(r.nationality, 100),
              cleanStr(r.aadhar_no, 100),
              cleanStr(r.nominee_name, 255),
              cleanStr(r.nominee_relationship, 100),
              cleanStr(r.nominee_email, 255),
              cleanStr(r.address, 1000),
              cleanStr(r.roll_number, 100),
              r.lateral_entry === true || false,
              cleanStr(r.parent_mobile, 255),
              cleanStr(r.parent_email, 255),
              cleanStr(r.faculty, 255),
              cleanStr(r.personal_email, 255),
              cleanStr(r._role, 50),
              cleanStr(rawEmail, 255),
              cleanStr(r.blood_group, 50),
              cleanStr(r.known_allergies, 1000),
              cleanStr(r.medical_conditions, 1000),
              cleanStr(r.emergency_contact_alt_mobile, 255),
              cleanStr(r.school_branch, 255),
              cleanStr(r.class_grade, 100),
              cleanStr(r.has_medical_condition, 50),
              cleanStr(r.payment_screenshot_url, 2000),
              cleanStr(r.payment_status || 'submitted', 50),
              cleanStr(r.digital_signature_url, 2000),
              cleanStr(r.parent_consent_text, 2000),
              r.parent_consent_confirmed === true
            ];

            const placeholders = [
              `$${paramIdx++}::int`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::boolean`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::int`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::text`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::boolean`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::text`,
              `$${paramIdx++}::text`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::text`,
              `$${paramIdx++}::varchar`,
              `$${paramIdx++}::text`,
              `$${paramIdx++}::text`,
              `$${paramIdx++}::boolean`,
            ];

            updateValueRows.push(`(${placeholders.join(', ')})`);
            updateParams.push(...values);
          }

          await client.query(
            `UPDATE users AS u SET
              name = v.name,
              department = COALESCE(v.department, u.department),
              semester = COALESCE(v.semester, u.semester),
              division = COALESCE(v.division, u.division),
              school = COALESCE(v.school, u.school),
              panel = COALESCE(v.panel, u.panel),
              phone = COALESCE(v.phone, u.phone),
              dob = COALESCE(v.dob, u.dob),
              gender = COALESCE(v.gender, u.gender),
              program = COALESCE(v.program, u.program),
              year = COALESCE(v.year, u.year),
              designation = COALESCE(v.designation, u.designation),
              status = COALESCE(v.status, u.status),
              nri = COALESCE(v.nri, u.nri),
              salutation = COALESCE(v.salutation, u.salutation),
              first_name = COALESCE(v.first_name, u.first_name),
              middle_name = COALESCE(v.middle_name, u.middle_name),
              last_name = COALESCE(v.last_name, u.last_name),
              age = COALESCE(v.age, u.age),
              nationality = COALESCE(v.nationality, u.nationality),
              aadhar_no = COALESCE(v.aadhar_no, u.aadhar_no),
              nominee_name = COALESCE(v.nominee_name, u.nominee_name),
              nominee_relationship = COALESCE(v.nominee_relationship, u.nominee_relationship),
              nominee_email = COALESCE(v.nominee_email, u.nominee_email),
              address = COALESCE(v.address, u.address),
              roll_number = COALESCE(v.roll_number, u.roll_number),
              lateral_entry = COALESCE(v.lateral_entry, u.lateral_entry),
              parent_mobile = COALESCE(v.parent_mobile, u.parent_mobile),
              parent_email = COALESCE(v.parent_email, u.parent_email),
              faculty = COALESCE(v.faculty, u.faculty),
              personal_email = COALESCE(v.personal_email, u.personal_email),
              email = COALESCE(NULLIF(LOWER(TRIM(v.email)), ''), u.email),
              role = v.role,
              blood_group = COALESCE(v.blood_group, u.blood_group),
              known_allergies = COALESCE(v.known_allergies, u.known_allergies),
              medical_conditions = COALESCE(v.medical_conditions, u.medical_conditions),
              emergency_contact_alt_mobile = COALESCE(v.emergency_contact_alt_mobile, u.emergency_contact_alt_mobile),
              school_branch = COALESCE(v.school_branch, u.school_branch),
              class_grade = COALESCE(v.class_grade, u.class_grade),
              has_medical_condition = COALESCE(v.has_medical_condition, u.has_medical_condition),
              payment_screenshot_url = COALESCE(v.payment_screenshot_url, u.payment_screenshot_url),
              payment_status = COALESCE(v.payment_status, u.payment_status),
              digital_signature_url = COALESCE(v.digital_signature_url, u.digital_signature_url),
              parent_consent_text = COALESCE(v.parent_consent_text, u.parent_consent_text),
              parent_consent_confirmed = COALESCE(v.parent_consent_confirmed, u.parent_consent_confirmed)
            FROM (VALUES ${updateValueRows.join(', ')}) AS v(
              id, name, department, semester, division, school, panel, phone, dob, gender,
              program, year, designation, status, nri,
              salutation, first_name, middle_name, last_name, age, nationality, aadhar_no,
              nominee_name, nominee_relationship, nominee_email, address, roll_number,
              lateral_entry, parent_mobile, parent_email, faculty, personal_email, role, email,
              blood_group, known_allergies, medical_conditions, emergency_contact_alt_mobile,
              school_branch, class_grade, has_medical_condition, payment_screenshot_url,
              payment_status, digital_signature_url, parent_consent_text, parent_consent_confirmed
            )
            WHERE u.id = v.id`,
            updateParams
          );
          success += toUpdate.length;
        }

        if (skippedDuplicates.length > 0) {
          success += skippedDuplicates.length;
        }

        if (isBatchSpecific && batchId) {
          const allProcessedUsers = [
            ...insertedRows.map(u => ({ id: u.id, role: u.role, email: u.email, prn: u.prn, faculty_id: u.faculty_id, name: u.name })),
            ...toUpdate.map(item => {
              const r = item.record;
              return { id: item.id, role: r._role, email: r._email, prn: r._prn, faculty_id: r._facultyId, name: r.name };
            }),
            ...skippedDuplicates.map(item => {
              const r = item.record;
              return { id: item.id, role: r._role, email: r._email, prn: r._prn, faculty_id: r._facultyId, name: r.name };
            })
          ];

          const studentsAlloc = allProcessedUsers.filter(u => u.role === 'student');
          const facultyAlloc = allProcessedUsers.filter(u => u.role === 'faculty' || u.role === 'ltc_member');

          if (studentsAlloc.length > 0) {
            const studentIds = studentsAlloc.map(s => s.id);

            const checkAllocRes = await client.query(
              `SELECT bs.student_id, b.name AS batch_name
               FROM batch_students bs
               JOIN batches b ON bs.batch_id = b.id
               WHERE bs.student_id = ANY($1) AND bs.batch_id <> $2 AND b.is_deleted IS NOT TRUE`,
              [studentIds, batchId]
            );

            const activeBatchMap = new Map();
            for (const row of checkAllocRes.rows) {
              activeBatchMap.set(row.student_id, row.batch_name);
            }

            const validStudents = [];
            for (const s of studentsAlloc) {
              if (activeBatchMap.has(s.id)) {
                failed++;
                success--;
                errorsList.push({ row: s.name, error: `Student already allocated to batch: ${activeBatchMap.get(s.id)}` });
              } else {
                validStudents.push(s);
              }
            }

            if (validStudents.length > 0) {
              const batchCapRes = await client.query(`SELECT capacity FROM batches WHERE id = $1`, [batchId]);
              const bulkBatchCap = batchCapRes.rows[0]?.capacity || 350;
              const countRes = await client.query(
                `SELECT COUNT(*)::int FROM batch_students WHERE batch_id = $1`,
                [batchId]
              );
              const currentStudentCount = countRes.rows[0].count;
              let remainingSlots = Math.max(0, bulkBatchCap - currentStudentCount);

              const studentsToInsert = [];
              for (const s of validStudents) {
                if (remainingSlots > 0) {
                  studentsToInsert.push(s);
                  remainingSlots--;
                } else {
                  failed++;
                  success--;
                  errorsList.push({ row: s.name, error: `Batch capacity limit of ${bulkBatchCap} students reached. Student will be enrolled in a later batch.` });
                }
              }

              if (studentsToInsert.length > 0) {
                const studentParams = [];
                const studentValueRows = [];
                let studentParamIdx = 1;

                for (const s of studentsToInsert) {
                  const barcode = `LTC-${batchId}-${s.id}-${Math.floor(Math.random() * 10000)}`;
                  const origRecord = chunk.find(r => r._email === s.email || r._prn === s.prn);
                  const room = origRecord ? origRecord.room : null;

                  studentValueRows.push(`($${studentParamIdx++}, $${studentParamIdx++}, $${studentParamIdx++}, $${studentParamIdx++}, $${studentParamIdx++})`);
                  studentParams.push(batchId, s.id, barcode, null, room || null);
                }

                await client.query(
                  `INSERT INTO batch_students (batch_id, student_id, barcode, squad, room)
                   VALUES ${studentValueRows.join(', ')}
                   ON CONFLICT (batch_id, student_id)
                   DO UPDATE SET room = COALESCE(EXCLUDED.room, batch_students.room)`,
                  studentParams
                );
              }
            }
          }

          if (facultyAlloc.length > 0) {
            const facultyIds = facultyAlloc.map(f => f.id);
            const checkFacAllocRes = await client.query(
              `SELECT bf.faculty_id, b.name AS batch_name
               FROM batch_faculty bf
               JOIN batches b ON bf.batch_id = b.id
               WHERE bf.faculty_id = ANY($1) AND bf.batch_id <> $2 AND b.is_deleted IS NOT TRUE`,
              [facultyIds, batchId]
            );
            const activeFacBatchMap = new Map();
            for (const row of checkFacAllocRes.rows) {
              activeFacBatchMap.set(row.faculty_id, row.batch_name);
            }

            const validFaculty = [];
            for (const f of facultyAlloc) {
              if (activeFacBatchMap.has(f.id)) {
                failed++;
                success--;
                errorsList.push({ row: f.name, error: `${f.role === 'ltc_member' ? 'LTC Member' : 'Faculty'} already allocated to batch: ${activeFacBatchMap.get(f.id)}` });
              } else {
                validFaculty.push(f);
              }
            }

            if (validFaculty.length > 0) {
              const facultyParams = [];
              const facultyValueRows = [];
              let facultyParamIdx = 1;

              for (const f of validFaculty) {
                facultyValueRows.push(`($${facultyParamIdx++}, $${facultyParamIdx++})`);
                facultyParams.push(batchId, f.id);
              }

              await client.query(
                `INSERT INTO batch_faculty (batch_id, faculty_id)
                 VALUES ${facultyValueRows.join(', ')}
                 ON CONFLICT (batch_id, faculty_id) DO NOTHING`,
                facultyParams
              );
            }
          }
        }

        await client.query('COMMIT');
      } catch (chunkErr) {
        await client.query('ROLLBACK');
        console.error(`Error processing chunk at index ${i}:`, chunkErr);
        failed += chunk.length;
        errorsList.push({ row: `Chunk [${i} - ${i + chunk.length}]`, error: `Database transaction rollback: ${chunkErr.message}` });
      } finally {
        client.release();
      }

      processed += chunk.length;

      await pool.query(
        `UPDATE upload_jobs
         SET processed_records = $1, success_count = $2, failed_count = $3, errors = $4, updated_at = NOW()
         WHERE id = $5`,
        [processed, success, failed, JSON.stringify(errorsList), jobId]
      );

      await new Promise(resolve => setImmediate(resolve));
    }

    await pool.query(
      `UPDATE upload_jobs
       SET status = 'completed', updated_at = NOW()
       WHERE id = $1`,
      [jobId]
    );

    if (isBatchSpecific && batchId) {
      try {
        const { syncLtcBatchToRiCore } = require('../services/riSyncService');
        await syncLtcBatchToRiCore(batchId);
      } catch (syncErr) {
        console.error(`[riSyncService] Error auto-syncing batch ${batchId} after bulk upload:`, syncErr);
      }
    }

    writeAudit(adminUserId, adminUserName, 'BULK_UPLOAD_COMPLETED', 'upload_job', jobId, {
      total_records: processed,
      success_count: success,
      failed_count: failed
    });

  } catch (fatalErr) {
    console.error('Fatal bulk upload error:', fatalErr);
    errorsList.push({ row: 'Fatal Job', error: fatalErr.message });
    await pool.query(
      `UPDATE upload_jobs
       SET status = 'failed', errors = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(errorsList), jobId]
    );
  } finally {
    if (filePath) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) { }
    }
  }
};

const createFaculty = async (req, res) => {
  const { name, email, department, division, school, panel, is_primary, gender, role, faculty, personal_email, designation, phone, faculty_id } = req.body;
  try {
    const isLtcRoute = req.originalUrl.includes('ltc-member');
    if (isLtcRoute) {
      if (role && role !== 'ltc_member') {
        return res.status(400).json({ message: 'Only LTC Members can be created from this section.' });
      }
    } else {
      if (role === 'ltc_member') {
        return res.status(400).json({ message: 'LTC Members can only be added from the LTC Member section.' });
      }
    }
    const finalRole = isLtcRoute ? 'ltc_member' : 'faculty';
    const defaultPassword = finalRole === 'ltc_member' ? 'ltc123' : 'faculty123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const newFaculty = await pool.query(
      "INSERT INTO users (name, email, password, role, department, division, school, panel, is_primary, gender, faculty, personal_email, designation, phone, faculty_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id, name, email, role, department, division, school, panel, is_primary, gender, faculty, personal_email, designation, phone, faculty_id",
      [name, cleanEmail, hashedPassword, finalRole, department || null, division || null, school || null, panel || null, is_primary === true || is_primary === 'true', gender || null, faculty || null, personal_email ? String(personal_email).trim().toLowerCase() : null, designation || null, phone || null, faculty_id || null]
    );
    await createSystemNotification(
      newFaculty.rows[0].id,
      'Welcome to Life Awakening Program',
      `Welcome ${name}! Your profile has been created by an administrator. Please log in and review your profile details.`,
      'info',
      req.user.id
    );
    res.status(201).json({ message: `${finalRole === 'ltc_member' ? 'LTC Member' : 'Faculty'} created. Default password: ${defaultPassword}.`, faculty: newFaculty.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      if (err.detail && err.detail.includes('email')) {
        return res.status(400).json({ message: 'Email is already in use by another user.' });
      }
      return res.status(400).json({ message: 'User already exists' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const createStudent = async (req, res) => {
  const {
    name, email, semester, department, division, school, panel, prn, gender, faculty,
    phone, dob, roll_number, program, year, lateral_entry, personal_email, parent_email,
    parent_mobile, address, age, nationality, aadhar_no, nominee_name, nominee_relationship, nominee_email
  } = req.body;
  try {
    const hashedPassword = await bcrypt.hash('student123', 10);
    const finalPrn = prn && prn.trim() ? prn.trim() : 'PRN-STU-' + Date.now() + Math.floor(Math.random() * 1000);
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const newStudent = await pool.query(
      `INSERT INTO users (
        name, email, password, role, semester, department, division, school, panel, prn, gender, faculty,
        phone, dob, roll_number, program, year, lateral_entry, personal_email, parent_email,
        parent_mobile, address, age, nationality, aadhar_no, nominee_name, nominee_relationship, nominee_email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28) 
      RETURNING id, name, email, role, semester, department, division, school, panel, prn, gender, faculty`,
      [
        name, cleanEmail, hashedPassword, 'student', semester, department, division || null, school || null, panel || null, finalPrn, gender || null, faculty || null,
        phone || null, dob || null, roll_number || null, program || null, year || null, lateral_entry === true || lateral_entry === 'true', personal_email ? String(personal_email).trim().toLowerCase() : null, parent_email ? String(parent_email).trim().toLowerCase() : null,
        parent_mobile || null, address || null, age ? parseInt(age) : null, nationality || null, aadhar_no || null, nominee_name || null, nominee_relationship || null, nominee_email ? String(nominee_email).trim().toLowerCase() : null
      ]
    );
    await createSystemNotification(
      newStudent.rows[0].id,
      'Welcome to Life Awakening Program',
      `Welcome ${name}! Your student profile has been created by an administrator. Please log in and review your profile details.`,
      'info',
      req.user.id
    );
    res.status(201).json({ message: 'Student created. Default password: student123.', student: newStudent.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      if (err.detail && err.detail.includes('email')) {
        return res.status(400).json({ message: 'Email is already in use by another user.' });
      }
      return res.status(400).json({ message: 'User already exists' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const buildHierarchyWhereClause = (divisions, faculties, schools, departments, initialParamIdx = 1) => {
  const conditions = [];
  const params = [];
  let paramIdx = initialParamIdx;

  if (Array.isArray(divisions) && divisions.length > 0) {
    conditions.push(`division = ANY($${paramIdx++})`);
    params.push(divisions);
  }
  if (Array.isArray(faculties) && faculties.length > 0) {
    conditions.push(`faculty = ANY($${paramIdx++})`);
    params.push(faculties);
  }
  if (Array.isArray(schools) && schools.length > 0) {
    conditions.push(`school = ANY($${paramIdx++})`);
    params.push(schools);
  }
  if (Array.isArray(departments) && departments.length > 0) {
    conditions.push(`department = ANY($${paramIdx++})`);
    params.push(departments);
  }

  return {
    whereSql: conditions.length > 0 ? `(${conditions.join(' OR ')})` : 'FALSE',
    params,
    nextParamIdx: paramIdx
  };
};

const getStudents = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const division = req.query.division || '';
  const faculty = req.query.faculty || '';
  const school = req.query.school || '';
  const department = req.query.department || '';
  const class_grade = req.query.class_grade || '';

  try {
    let whereClause = `WHERE u.role = 'student' AND NOT (
      EXISTS (SELECT 1 FROM ri_batch_students rbs WHERE rbs.student_id = u.id AND rbs.source_program = 'RI_DIRECT')
      AND NOT EXISTS (SELECT 1 FROM batch_students bs WHERE bs.student_id = u.id)
    )`;
    const params = [];
    let paramIdx = 1;

    if (search) {
      whereClause += ` AND (u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.prn ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (division) {
      if (division === 'UNASSIGNED') {
        whereClause += ` AND (u.division IS NULL OR u.division = '' OR LOWER(TRIM(u.division)) IN ('unassigned', 'n/a', 'none', '-'))`;
      } else {
        whereClause += ` AND u.division = $${paramIdx}`;
        params.push(division);
        paramIdx++;
      }
    }
    if (faculty) {
      whereClause += ` AND u.faculty = $${paramIdx}`;
      params.push(faculty);
      paramIdx++;
    }
    if (school) {
      whereClause += ` AND u.school = $${paramIdx}`;
      params.push(school);
      paramIdx++;
    }
    if (department) {
      whereClause += ` AND u.department = $${paramIdx}`;
      params.push(department);
      paramIdx++;
    }
    if (class_grade) {
      const normClass = normalizeClassGrade(class_grade);
      if (normClass) {
        whereClause += ` AND u.class_grade = $${paramIdx}`;
        params.push(normClass);
        paramIdx++;
      }
    }

    const countRes = await pool.query(`SELECT COUNT(*) FROM users u ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.semester, u.division, u.school, u.panel, u.faculty, u.prn, u.phone, u.gender, u.nri, u.status,
              u.tshirt_size, u.photo_video_consent, u.tshirt_consent, u.data_consent, u.bag_check_consent,
              (i.prn IS NOT NULL) as insured, u.undertaking_submitted, u.undertaking_signed_name, u.undertaking_signed_date,
              u.school_branch, u.class_grade, u.has_medical_condition, u.payment_screenshot_url, u.payment_status,
              u.payment_verified_at, u.payment_verified_by, u.digital_signature_url, u.parent_consent_confirmed,
              u.parent_consent_text, u.blood_group, u.roll_number, u.parent_mobile, u.parent_email,
              u.emergency_contact_alt_mobile, u.medical_conditions, u.known_allergies, u.address
       FROM users u
       LEFT JOIN insurance i ON u.prn = i.prn
       ${whereClause}
       ORDER BY u.name ASC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      students: await withLtcId(dataRes.rows),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getFacultyList = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const roleFilter = req.query.role || ''; // 'faculty', 'ltc_member', or '' for both
  const division = req.query.division || '';
  const faculty = req.query.faculty || '';
  const school = req.query.school || '';
  const department = req.query.department || '';

  try {
    let whereClause;
    const params = [];
    let paramIdx = 1;

    if (roleFilter === 'faculty') {
      whereClause = "WHERE (role = 'faculty' OR (role = 'superadmin_readonly' AND (base_role = 'faculty' OR base_role IS NULL)))";
    } else if (roleFilter === 'ltc_member') {
      whereClause = "WHERE (role = 'ltc_member' OR (role = 'superadmin_readonly' AND base_role = 'ltc_member'))";
    } else {
      whereClause = "WHERE (role = 'faculty' OR role = 'ltc_member' OR role = 'superadmin_readonly')";
    }

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR department ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (division) {
      if (division === 'UNASSIGNED') {
        whereClause += ` AND (division IS NULL OR division = '' OR LOWER(TRIM(division)) IN ('unassigned', 'n/a', 'none', '-'))`;
      } else {
        whereClause += ` AND division = $${paramIdx}`;
        params.push(division);
        paramIdx++;
      }
    }
    if (faculty) {
      whereClause += ` AND faculty = $${paramIdx}`;
      params.push(faculty);
      paramIdx++;
    }
    if (school) {
      whereClause += ` AND school = $${paramIdx}`;
      params.push(school);
      paramIdx++;
    }
    if (department) {
      whereClause += ` AND department = $${paramIdx}`;
      params.push(department);
      paramIdx++;
    }

    const countRes = await pool.query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await pool.query(
      `SELECT id, name, email, role, department, division, school, panel, faculty, is_primary, gender, faculty_id, phone, status, designation,
              undertaking_submitted, undertaking_signed_name, undertaking_signed_date
       FROM users ${whereClause} ORDER BY name ASC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      faculty: dataRes.rows,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getFilterOptions = async (req, res) => {
  try {
    const ltcWhere = `WHERE role='student' AND NOT (
      EXISTS (SELECT 1 FROM ri_batch_students rbs WHERE rbs.student_id = users.id AND rbs.source_program = 'RI_DIRECT')
      AND NOT EXISTS (SELECT 1 FROM batch_students bs WHERE bs.student_id = users.id)
    )`;
    const schoolsRes = await pool.query(`SELECT DISTINCT school FROM users ${ltcWhere} AND school IS NOT NULL ORDER BY school`);
    const deptRes = await pool.query(`SELECT DISTINCT department FROM users ${ltcWhere} AND department IS NOT NULL ORDER BY department`);
    res.json({
      schools: schoolsRes.rows.map(r => r.school),
      departments: deptRes.rows.map(r => r.department),
      classes: CANONICAL_CLASSES
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getBatches = async (req, res) => {
  try {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const yIST = nowIST.getFullYear();
    const mIST = String(nowIST.getMonth() + 1).padStart(2, '0');
    const dIST = String(nowIST.getDate()).padStart(2, '0');
    const todayStr = `${yIST}-${mIST}-${dIST}`;

    // Manual status management: Background auto-updates removed per Admin control rules

    const result = await pool.query(`
      SELECT b.*,
        COUNT(DISTINCT bs.student_id) as student_count,
        COUNT(DISTINCT bf.faculty_id) as faculty_count,
        COUNT(DISTINCT bs.student_id) FILTER (WHERE LOWER(TRIM(u.gender)) IN ('male', 'm')) as boys_count,
        COUNT(DISTINCT bs.student_id) FILTER (WHERE LOWER(TRIM(u.gender)) IN ('female', 'f')) as girls_count
      FROM batches b
      LEFT JOIN batch_students bs ON b.id = bs.batch_id
      LEFT JOIN users u ON bs.student_id = u.id
      LEFT JOIN batch_faculty bf ON b.id = bf.batch_id
      WHERE b.is_deleted IS NOT TRUE
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `);
    res.json({ batches: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const formatEmailBodyToHtml = (text) => {
  if (!text) return '';

  // Security sanitization: strip script, iframe, javascript: URLs, and inline on* event handlers
  let clean = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    .replace(/href\s*=\s*["']?\s*javascript:[^"'>]*["']?/gi, 'href="#"');

  // Separate block-level elements (<div...</div>, <table...</table>) from plain text blocks
  const blocks = clean.split(/(<(?:div|table)[\s\S]*?<\/(?:div|table)>)/gi);

  const formattedBlocks = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';

    // If it's an HTML block tag (<div...</div> or <table...</table>), leave it intact as HTML
    if (/^<(?:div|table)[\s\S]*/i.test(trimmed)) {
      return trimmed;
    }

    // Process non-block text paragraph by paragraph (split by double newlines)
    const paragraphs = trimmed.split(/\n\s*\n/);
    return paragraphs.map(p => {
      const pTrimmed = p.trim();
      if (!pTrimmed) return '';

      // For lines within a paragraph, convert newlines to <br/> if line doesn't end with an HTML tag/break
      const lines = pTrimmed.split('\n');
      const formattedLines = lines.map((line, idx) => {
        if (idx === lines.length - 1) return line;
        const lTrim = line.trim();
        if (/<br\s*\/?>$/i.test(lTrim) || /<\/(?:p|div|h[1-6]|li|tr|table|ul|ol)>$/i.test(lTrim)) {
          return line;
        }
        return line + '<br/>';
      }).join('\n');

      // If the paragraph already starts with a block-level HTML tag, don't wrap in <p>
      if (/^<(?:p|h[1-6]|ul|ol|blockquote|div|table)/i.test(pTrimmed)) {
        return formattedLines;
      }

      return `<p style="margin: 0 0 12px 0; font-size: 14.5px; color: #334155; line-height: 1.6;">${formattedLines}</p>`;
    }).filter(Boolean).join('\n');
  });

  return formattedBlocks.filter(Boolean).join('\n');
};

// Helper to extract, validate, and deduplicate email addresses from array or delimited string
const extractCleanEmailList = (input) => {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : String(input).split(/[\s,;\t\r\n]+/);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    const trimmed = String(item).trim();
    if (trimmed && emailRegex.test(trimmed)) {
      const lower = trimmed.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(trimmed);
      }
    }
  }
  return result;
};

const sendOrientationEmail = async (req, res) => {
  assertManualAdminTrigger(req);
  const { id } = req.params;
  const { subject, body, targetRoles, cc, bcc, attachments } = req.body;
  if (!subject || !body) {
    return res.status(400).json({ message: 'Subject and Body are required' });
  }
  const roles = targetRoles || ['student', 'faculty'];
  try {
    let queries = [];
    let params = [id];

    if (roles.includes('student')) {
      queries.push(`
        SELECT u.id, u.name, u.email, u.role, bs.squad, b.name as batch_name, b.start_date::text, b.end_date::text
        FROM batch_students bs
        JOIN users u ON bs.student_id = u.id
        JOIN batches b ON bs.batch_id = b.id
        WHERE bs.batch_id = $1
      `);
    }

    if (roles.includes('faculty')) {
      queries.push(`
        SELECT u.id, u.name, u.email, u.role, bf.squad, b.name as batch_name, b.start_date::text, b.end_date::text
        FROM batch_faculty bf
        JOIN users u ON bf.faculty_id = u.id
        JOIN batches b ON bf.batch_id = b.id
        WHERE bf.batch_id = $1 AND (u.role IS NULL OR u.role != 'ltc_member')
      `);
    }

    if (roles.includes('ltc_member')) {
      queries.push(`
        SELECT u.id, u.name, u.email, u.role, bf.squad, b.name as batch_name, b.start_date::text, b.end_date::text
        FROM batch_faculty bf
        JOIN users u ON bf.faculty_id = u.id
        JOIN batches b ON bf.batch_id = b.id
        WHERE bf.batch_id = $1 
          AND u.role = 'ltc_member' 
          AND bf.squad IS NOT NULL AND TRIM(bf.squad) != ''
          AND u.designation ILIKE '%Squad Coordinator%'
      `);
    }

    if (roles.includes('parent')) {
      queries.push(`
        SELECT u.id, CONCAT('Parent of ', u.name) as name, u.parent_email as email, 'parent' as role, bs.squad, b.name as batch_name, b.start_date::text, b.end_date::text
        FROM batch_students bs
        JOIN users u ON bs.student_id = u.id
        JOIN batches b ON bs.batch_id = b.id
        WHERE bs.batch_id = $1 AND u.parent_email IS NOT NULL AND TRIM(u.parent_email) != ''
      `);
    }

    if (queries.length === 0) {
      return res.status(400).json({ message: 'Please select at least one recipient group.' });
    }

    const unifiedQuery = queries.join(' UNION ALL ');
    const usersRes = await pool.query(unifiedQuery, params);

    if (usersRes.rowCount === 0) {
      return res.status(400).json({ message: 'No recipients found for the selected roles in this batch.' });
    }

    // Deduplicate recipients by email to guarantee single dispatch per recipient
    const seenEmails = new Set();
    const uniqueUsers = [];
    for (const u of usersRes.rows) {
      if (u.email && !seenEmails.has(u.email)) {
        seenEmails.add(u.email);
        uniqueUsers.push(u);
      }
    }

    const { queueEmail } = require('../config/mailer');
    const portalLoginUrl = process.env.PORTAL_LOGIN_URL || (req.get('host') ? `${req.protocol}://${req.get('host')}/login` : 'http://13.207.119.57/login');

    for (const u of uniqueUsers) {
      const startDateStr = u.start_date ? new Date(u.start_date).toLocaleDateString() : 'N/A';
      const endDateStr = u.end_date ? new Date(u.end_date).toLocaleDateString() : 'N/A';
      const defaultPassword = u.role === 'student' ? 'student123' : (u.role === 'ltc_member' ? 'ltc123' : 'faculty123');
      const roleName = u.role === 'student' ? 'Student' : (u.role === 'ltc_member' ? 'LTC Member' : (u.role === 'parent' ? 'Parent' : 'Faculty'));

      // Conditionally filter role-based content (Faculty Instructions visible only to faculty recipients)
      let recipientBody = body;
      if (u.role !== 'faculty') {
        recipientBody = recipientBody.replace(/Faculty Instructions:\s*(\n\s*•[^\n]*)+/gi, '');
        recipientBody = recipientBody.replace(/\n{3,}/g, '\n\n').trim();
      }

      // Function to replace placeholders
      const replaceVars = (str) => {
        const squadDisplay = (u.squad && u.squad !== 'LTC Admin') ? u.squad : 'Surya';
        const deadlineVal = req.body.deadline || (req.body.extraFieldValues && req.body.extraFieldValues.deadline) || '';
        let resStr = str
          .replace(/{{name}}/g, u.name || '')
          .replace(/{{role}}/g, roleName)
          .replace(/{{batch_name}}/g, u.batch_name || '')
          .replace(/{{squad}}/g, squadDisplay)
          .replace(/{{email}}/g, u.email || '')
          .replace(/{{password}}/g, defaultPassword)
          .replace(/{{start_date}}/g, startDateStr)
          .replace(/{{end_date}}/g, endDateStr)
          .replace(/{{login_url}}/g, portalLoginUrl);
        if (deadlineVal) {
          resStr = resStr.replace(/{{deadline}}/g, deadlineVal);
        }
        if (req.body.extraFieldValues && typeof req.body.extraFieldValues === 'object') {
          for (const [k, v] of Object.entries(req.body.extraFieldValues)) {
            if (v !== undefined && v !== null) {
              resStr = resStr.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
            }
          }
        }
        return resStr;
      };

      const personalizedSubject = replaceVars(subject);
      const personalizedBody = replaceVars(recipientBody);

      const formattedBodyHtml = formatEmailBodyToHtml(personalizedBody);

      // Determine if template uses default global header
      const useDefaultHeader = req.body.useDefaultHeader !== undefined
        ? (req.body.useDefaultHeader === true || req.body.useDefaultHeader === 'true')
        : (req.body.templateKey === 'ltc_day_welcome' || (req.body.body && (req.body.body.includes('background-color: #1E40AF;') || req.body.body.includes('background-color: #1e3a8a;'))) ? false : true);

      let html;
      if (!useDefaultHeader) {
        html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${personalizedSubject}</title>
</head>
<body style="margin: 0; padding: 20px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; -webkit-font-smoothing: antialiased;">
  ${formattedBodyHtml}
</body>
</html>`;
      } else {
        html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${personalizedSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
          <!-- Branded Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); background-color: #ea580c; padding: 36px 28px; text-align: center; color: #ffffff;">
              <div style="font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #ffedd5; margin-bottom: 8px;">
                MIT WORLD PEACE UNIVERSITY, PUNE
              </div>
              <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; line-height: 1.3; text-transform: uppercase;">
                LIFE AWAKENING PROGRAM (LAP)
              </h1>
              <div style="font-size: 14px; font-weight: 600; color: #fed7aa; letter-spacing: 0.3px;">
                Experiential Learning &amp; Transformation
              </div>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              ${formattedBodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.5;">
              This is an official communication from <strong>Life Awakening Program (LAP) Administration</strong>.<br/>
              MIT World Peace University, Pune.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
      }

      // Queue individual email to To recipient (without CC/BCC so recipients are not duplicated per To contact)
      await queueEmail(u.email, personalizedSubject, personalizedBody, html, { attachments });
    }

    // Deduplicate CC and BCC recipients so each receives the email only once per bulk send operation
    const seenToEmails = new Set(uniqueUsers.map(u => (u.email || '').toLowerCase()).filter(Boolean));

    const seenCc = new Set();
    const cleanCc = [];
    for (const rawCc of extractCleanEmailList(cc)) {
      const lower = rawCc.toLowerCase();
      if (!seenToEmails.has(lower) && !seenCc.has(lower)) {
        seenCc.add(lower);
        cleanCc.push(rawCc);
      }
    }

    const seenBcc = new Set();
    const cleanBcc = [];
    for (const rawBcc of extractCleanEmailList(bcc)) {
      const lower = rawBcc.toLowerCase();
      if (!seenToEmails.has(lower) && !seenCc.has(lower) && !seenBcc.has(lower)) {
        seenBcc.add(lower);
        cleanBcc.push(rawBcc);
      }
    }

    if (cleanCc.length > 0 || cleanBcc.length > 0) {
      const batchName = uniqueUsers[0]?.batch_name || 'Orientation Batch';
      const batchStartDateStr = uniqueUsers[0]?.start_date ? new Date(uniqueUsers[0].start_date).toLocaleDateString() : 'N/A';
      const batchEndDateStr = uniqueUsers[0]?.end_date ? new Date(uniqueUsers[0].end_date).toLocaleDateString() : 'N/A';

      const buildCcBccOrientationContent = async (targetEmail) => {
        const userRes = await pool.query(
          `SELECT u.name, u.role, bf.squad
           FROM users u
           LEFT JOIN batch_faculty bf ON bf.faculty_id = u.id AND bf.batch_id = $1
           WHERE LOWER(u.email) = LOWER($2)
           LIMIT 1`,
          [id, targetEmail]
        );
        const user = userRes.rowCount > 0 ? userRes.rows[0] : null;
        const recipientName = user ? user.name : targetEmail.split('@')[0];
        const recipientRole = user ? (user.role === 'student' ? 'Student' : (user.role === 'ltc_member' ? 'LTC Member' : (user.role === 'parent' ? 'Parent' : 'Faculty'))) : 'Faculty';
        const squadDisplay = (user && user.squad && user.squad !== 'LTC Admin') ? user.squad : 'General';
        const defaultPassword = (user && user.role === 'student') ? 'student123' : 'faculty123';

        let recipientBody = body;
        if (recipientRole !== 'Faculty') {
          recipientBody = recipientBody.replace(/Faculty Instructions:\s*(\n\s*•[^\n]*)+/gi, '');
          recipientBody = recipientBody.replace(/\n{3,}/g, '\n\n').trim();
        }

        const replaceVars = (str) => {
          const deadlineVal = req.body.deadline || (req.body.extraFieldValues && req.body.extraFieldValues.deadline) || '';
          let resStr = str
            .replace(/{{name}}/g, recipientName)
            .replace(/{{role}}/g, recipientRole)
            .replace(/{{batch_name}}/g, batchName)
            .replace(/{{squad}}/g, squadDisplay)
            .replace(/{{email}}/g, targetEmail)
            .replace(/{{password}}/g, defaultPassword)
            .replace(/{{start_date}}/g, batchStartDateStr)
            .replace(/{{end_date}}/g, batchEndDateStr)
            .replace(/{{login_url}}/g, portalLoginUrl);
          if (deadlineVal) {
            resStr = resStr.replace(/{{deadline}}/g, deadlineVal);
          }
          return resStr;
        };

        const personalizedSubject = replaceVars(subject);
        const personalizedBody = replaceVars(recipientBody);
        const formattedBodyHtml = formatEmailBodyToHtml(personalizedBody);

        const useDefaultHeader = req.body.useDefaultHeader !== undefined
          ? (req.body.useDefaultHeader === true || req.body.useDefaultHeader === 'true')
          : (req.body.templateKey === 'ltc_day_welcome' || (req.body.body && (req.body.body.includes('background-color: #1E40AF;') || req.body.body.includes('background-color: #1e3a8a;'))) ? false : true);

        let html;
        if (!useDefaultHeader) {
          html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${personalizedSubject}</title>
</head>
<body style="margin: 0; padding: 20px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; -webkit-font-smoothing: antialiased;">
  ${formattedBodyHtml}
</body>
</html>`;
        } else {
          html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${personalizedSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
          <!-- Branded Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); background-color: #ea580c; padding: 36px 28px; text-align: center; color: #ffffff;">
              <div style="font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #ffedd5; margin-bottom: 8px;">
                MIT WORLD PEACE UNIVERSITY, PUNE
              </div>
              <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; line-height: 1.3; text-transform: uppercase;">
                LIFE AWAKENING PROGRAM (LAP)
              </h1>
              <div style="font-size: 14px; font-weight: 600; color: #fed7aa; letter-spacing: 0.3px;">
                Experiential Learning &amp; Transformation
              </div>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              ${formattedBodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.5;">
              This is an official communication from <strong>Life Awakening Program (LAP) Administration</strong>.<br/>
              MIT World Peace University, Pune.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
        }

        return { personalizedSubject, personalizedBody, html };
      };

      // Each CC recipient receives the email only once
      for (const ccEmail of cleanCc) {
        const { personalizedSubject, personalizedBody, html } = await buildCcBccOrientationContent(ccEmail);
        await queueEmail(ccEmail, personalizedSubject, personalizedBody, html, { attachments });
      }

      // Each BCC recipient receives the email only once
      for (const bccEmail of cleanBcc) {
        const { personalizedSubject, personalizedBody, html } = await buildCcBccOrientationContent(bccEmail);
        await queueEmail(bccEmail, personalizedSubject, personalizedBody, html, { attachments });
      }
    }

    const extraMsg = [];
    if (cleanCc.length > 0) extraMsg.push(`${cleanCc.length} CC`);
    if (cleanBcc.length > 0) extraMsg.push(`${cleanBcc.length} BCC`);
    const extraText = extraMsg.length > 0 ? ` (plus ${extraMsg.join(', ')})` : '';

    writeAudit(req.user.id, req.user.name || 'Admin', 'ORIENTATION_EMAIL_SENT', 'batch', parseInt(id), {
      subject,
      recipient_count: uniqueUsers.length,
      cc_count: cleanCc.length,
      bcc_count: cleanBcc.length,
      roles
    });

    res.json({ message: `Emails queued successfully for ${uniqueUsers.length} recipients${extraText}.` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const sendManualEmail = async (req, res) => {
  assertManualAdminTrigger(req);
  const { recipientEmail, recipientEmails, subject, body, cc, bcc, attachments } = req.body;

  const rawInput = recipientEmails || recipientEmail;
  if (!rawInput || !subject || !body) {
    return res.status(400).json({ message: 'Recipient email address(es), subject, and body are required.' });
  }

  let rawList = [];
  if (Array.isArray(rawInput)) {
    rawList = rawInput;
  } else if (typeof rawInput === 'string') {
    rawList = rawInput.split(/[\s,;\t\r\n]+/);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const cleanEmailsMap = new Map();
  const invalidEmailsSet = new Set();

  for (const item of rawList) {
    const trimmed = String(item).trim();
    if (!trimmed) continue;
    if (emailRegex.test(trimmed)) {
      const lower = trimmed.toLowerCase();
      if (!cleanEmailsMap.has(lower)) {
        cleanEmailsMap.set(lower, trimmed);
      }
    } else {
      invalidEmailsSet.add(trimmed);
    }
  }

  const invalidEmails = Array.from(invalidEmailsSet);
  if (invalidEmails.length > 0) {
    return res.status(400).json({ message: `Invalid email address format found: ${invalidEmails.join(', ')}` });
  }

  const uniqueEmails = Array.from(cleanEmailsMap.values());
  if (uniqueEmails.length === 0) {
    return res.status(400).json({ message: 'No valid recipient email addresses provided.' });
  }

  try {
    const { queueEmail } = require('../config/mailer');

    // Deduplicate CC and BCC recipients so each receives the email only once per bulk send operation
    const seenToEmails = new Set(uniqueEmails.map(e => e.toLowerCase()));

    const seenCc = new Set();
    const cleanCc = [];
    for (const rawCc of extractCleanEmailList(cc)) {
      const lower = rawCc.toLowerCase();
      if (!seenToEmails.has(lower) && !seenCc.has(lower)) {
        seenCc.add(lower);
        cleanCc.push(rawCc);
      }
    }

    const seenBcc = new Set();
    const cleanBcc = [];
    for (const rawBcc of extractCleanEmailList(bcc)) {
      const lower = rawBcc.toLowerCase();
      if (!seenToEmails.has(lower) && !seenCc.has(lower) && !seenBcc.has(lower)) {
        seenBcc.add(lower);
        cleanBcc.push(rawBcc);
      }
    }

    // Function to build personalized email content for a given email address
    const buildManualEmailContent = async (targetEmail) => {
      const userRes = await pool.query(
        `SELECT u.name, u.email, u.role, u.squad, u.prn, u.division, 
                (SELECT b.name FROM batch_students bs JOIN batches b ON bs.batch_id = b.id WHERE bs.student_id = u.id ORDER BY b.id DESC LIMIT 1) as batch_name,
                (SELECT b.start_date::text FROM batch_students bs JOIN batches b ON bs.batch_id = b.id WHERE bs.student_id = u.id ORDER BY b.id DESC LIMIT 1) as start_date,
                (SELECT b.end_date::text FROM batch_students bs JOIN batches b ON bs.batch_id = b.id WHERE bs.student_id = u.id ORDER BY b.id DESC LIMIT 1) as end_date
         FROM users u WHERE LOWER(u.email) = LOWER($1)`,
        [targetEmail]
      );

      const user = userRes.rowCount > 0 ? userRes.rows[0] : null;
      const recipientName = user ? user.name : targetEmail.split('@')[0];
      const recipientRole = user ? (user.role === 'student' ? 'Student' : (user.role === 'ltc_member' ? 'LTC Member' : (user.role === 'parent' ? 'Parent' : 'Faculty'))) : (req.body.role === 'faculty' ? 'Faculty' : 'Student');
      const squadName = (user && user.squad && user.squad !== 'LTC Admin') ? user.squad : 'Surya';
      const batchName = (user && user.batch_name) ? user.batch_name : 'Batch 1';
      const startDateStr = (user && user.start_date && !isNaN(new Date(user.start_date).getTime())) ? new Date(user.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '01 Aug 2026';
      const endDateStr = (user && user.end_date && !isNaN(new Date(user.end_date).getTime())) ? new Date(user.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '15 Aug 2026';
      const defaultPassword = (user && user.role === 'student') ? 'student123' : ((user && user.role === 'ltc_member') ? 'ltc123' : 'faculty123');
      const portalLoginUrl = process.env.PORTAL_LOGIN_URL || (req.get('host') ? `${req.protocol}://${req.get('host')}/login` : 'http://13.207.119.57/login');
      const deadlineVal = req.body.deadline || (req.body.extraFieldValues && req.body.extraFieldValues.deadline) || '26 July, 11:55 PM';

      // Function to resolve placeholders on custom admin subject and body
      const resolvePlaceholders = (str) => {
        if (!str) return '';
        let resStr = str
          .replace(/{{name}}/g, recipientName)
          .replace(/{{role}}/g, recipientRole)
          .replace(/{{batch_name}}/g, batchName)
          .replace(/{{squad}}/g, squadName)
          .replace(/{{email}}/g, targetEmail)
          .replace(/{{password}}/g, defaultPassword)
          .replace(/{{start_date}}/g, startDateStr)
          .replace(/{{end_date}}/g, endDateStr)
          .replace(/{{deadline}}/g, deadlineVal)
          .replace(/{{login_url}}/g, portalLoginUrl);
        if (req.body.extraFieldValues && typeof req.body.extraFieldValues === 'object') {
          for (const [k, v] of Object.entries(req.body.extraFieldValues)) {
            if (v !== undefined && v !== null) {
              resStr = resStr.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
            }
          }
        }
        return resStr;
      };

      const personalizedSubject = resolvePlaceholders(subject);
      let personalizedBody = resolvePlaceholders(body);

      const formattedBodyHtml = formatEmailBodyToHtml(personalizedBody);

      // Determine if template uses default global header
      const useDefaultHeader = req.body.useDefaultHeader !== undefined
        ? (req.body.useDefaultHeader === true || req.body.useDefaultHeader === 'true')
        : (req.body.templateKey === 'ltc_day_welcome' || (req.body.body && (req.body.body.includes('background-color: #1E40AF;') || req.body.body.includes('background-color: #1e3a8a;'))) ? false : true);

      let html;
      if (!useDefaultHeader) {
        html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${personalizedSubject}</title>
</head>
<body style="margin: 0; padding: 20px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; -webkit-font-smoothing: antialiased;">
  ${formattedBodyHtml}
</body>
</html>`;
      } else {
        html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${personalizedSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
          <!-- Branded Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); background-color: #ea580c; padding: 36px 28px; text-align: center; color: #ffffff;">
              <div style="font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #ffedd5; margin-bottom: 8px;">
                MIT WORLD PEACE UNIVERSITY, PUNE
              </div>
              <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; line-height: 1.3; text-transform: uppercase;">
                LIFE AWAKENING PROGRAM (LAP)
              </h1>
              <div style="font-size: 14px; font-weight: 600; color: #fed7aa; letter-spacing: 0.3px;">
                Experiential Learning &amp; Transformation
              </div>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              ${formattedBodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.5;">
              This is an official communication from <strong>Life Awakening Program (LAP) Administration</strong>.<br/>
              MIT World Peace University, Pune.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
      }

      return { personalizedSubject, personalizedBody, html };
    };

    const isBulkManual = uniqueEmails.length > 1;

    if (isBulkManual) {
      // 1. Send individual emails to all To contacts (without CC/BCC so they don't multiply per To contact)
      for (const targetEmail of uniqueEmails) {
        const { personalizedSubject, personalizedBody, html } = await buildManualEmailContent(targetEmail);
        await queueEmail(targetEmail, personalizedSubject, personalizedBody, html, { attachments });
      }

      // 2. Each CC recipient receives the email only once
      for (const ccEmail of cleanCc) {
        const { personalizedSubject, personalizedBody, html } = await buildManualEmailContent(ccEmail);
        await queueEmail(ccEmail, personalizedSubject, personalizedBody, html, { attachments });
      }

      // 3. Each BCC recipient receives the email only once
      for (const bccEmail of cleanBcc) {
        const { personalizedSubject, personalizedBody, html } = await buildManualEmailContent(bccEmail);
        await queueEmail(bccEmail, personalizedSubject, personalizedBody, html, { attachments });
      }
    } else {
      // Single recipient email: attach CC and BCC to this single email
      const targetEmail = uniqueEmails[0];
      const { personalizedSubject, personalizedBody, html } = await buildManualEmailContent(targetEmail);
      await queueEmail(targetEmail, personalizedSubject, personalizedBody, html, {
        cc: cleanCc.length > 0 ? cleanCc.join(', ') : null,
        bcc: cleanBcc.length > 0 ? cleanBcc.join(', ') : null,
        attachments
      });
    }

    const extraMsg = [];
    if (cleanCc.length > 0) extraMsg.push(`${cleanCc.length} CC`);
    if (cleanBcc.length > 0) extraMsg.push(`${cleanBcc.length} BCC`);
    const extraText = extraMsg.length > 0 ? ` (plus ${extraMsg.join(', ')})` : '';

    writeAudit(req.user.id, req.user.name || 'Admin', 'MANUAL_EMAIL_SENT', 'email', 0, {
      recipient_emails: uniqueEmails,
      recipient_count: uniqueEmails.length,
      cc_count: cleanCc.length,
      bcc_count: cleanBcc.length,
      subject
    });

    const msg = uniqueEmails.length === 1
      ? `Manual email queued successfully for ${uniqueEmails[0]}${extraText}.`
      : `Manual email queued successfully for ${uniqueEmails.length} recipients${extraText}.`;

    res.json({ message: msg });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getOrientationRecipients = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, u.parent_mobile, u.prn, u.panel, u.division, u.parent_email, u.role, bs.squad, b.name as batch_name
      FROM batch_students bs
      JOIN users u ON bs.student_id = u.id
      JOIN batches b ON bs.batch_id = b.id
      WHERE bs.batch_id = $1
      UNION ALL
      SELECT u.id, u.name, u.email, u.phone, NULL as parent_mobile, u.prn, u.panel, u.division, NULL as parent_email, u.role, bf.squad, b.name as batch_name
      FROM batch_faculty bf
      JOIN users u ON bf.faculty_id = u.id
      JOIN batches b ON bf.batch_id = b.id
      WHERE bf.batch_id = $1 AND (u.role IS NULL OR u.role != 'ltc_member')
      UNION ALL
      SELECT u.id, u.name, u.email, u.phone, NULL as parent_mobile, u.prn, u.panel, u.division, NULL as parent_email, u.role, bf.squad, b.name as batch_name
      FROM batch_faculty bf
      JOIN users u ON bf.faculty_id = u.id
      JOIN batches b ON bf.batch_id = b.id
      WHERE bf.batch_id = $1 
        AND u.role = 'ltc_member' 
        AND bf.squad IS NOT NULL AND TRIM(bf.squad) != ''
        AND u.designation ILIKE '%Squad Coordinator%'
      ORDER BY role DESC, name ASC
    `, [id]);

    const seenRecipients = new Set();
    const uniqueRecipients = [];
    for (const r of result.rows) {
      const key = `${r.email || r.id}`;
      if (!seenRecipients.has(key)) {
        seenRecipients.add(key);
        uniqueRecipients.push(r);
      }
    }

    res.json({ recipients: uniqueRecipients });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getNextLapBatchInfo = async (clientOrPool, startDateInput, customBatchNum = null) => {
  const result = await clientOrPool.query(
    "SELECT id, name, batch_code, created_at FROM batches WHERE is_deleted IS NOT TRUE ORDER BY id ASC"
  );
  let maxNum = 0;
  for (const b of result.rows) {
    const lapMatch = (b.name || '').match(/^LAP-(\d+)-/i);
    const nameMatch = (b.name || '').match(/(?:LAP|LRP|LTC|BATCH)[\s-_]*(\d+)/i);
    const codeMatch = (b.batch_code || '').match(/^(\d+)/);
    let n = 0;
    if (lapMatch) {
      n = parseInt(lapMatch[1], 10);
    } else if (nameMatch) {
      n = parseInt(nameMatch[1], 10);
    } else if (codeMatch) {
      n = parseInt(codeMatch[1], 10);
    }
    if (n > maxNum && n < 1000) {
      maxNum = n;
    }
  }
  if (maxNum === 0 && result.rows.length > 0) {
    maxNum = result.rows.length;
  }
  let nextNum = customBatchNum || (maxNum + 1);
  const d = startDateInput ? new Date(startDateInput) : new Date();
  const validDate = !isNaN(d.getTime()) ? d : new Date();
  const mm = String(validDate.getMonth() + 1).padStart(2, '0');
  const yy = String(validDate.getFullYear()).slice(-2);
  const fullYear = String(validDate.getFullYear());

  let bb = String(nextNum).padStart(2, '0');
  let generatedName = `LAP-${bb}-${mm}${yy}`;
  let generatedCode = `${bb}-${mm}${yy}`;

  // Ensure unique batch name across existing batches
  const existingNames = new Set(result.rows.map(r => (r.name || '').trim().toUpperCase()));
  while (existingNames.has(generatedName.toUpperCase())) {
    nextNum += 1;
    bb = String(nextNum).padStart(2, '0');
    generatedName = `LAP-${bb}-${mm}${yy}`;
    generatedCode = `${bb}-${mm}${yy}`;
  }

  return { nextNum, bb, mm, yy, fullYear, generatedName, generatedCode };
};

const createBatch = async (req, res) => {
  let { name, location, start_date, end_date, status, description, batch_code, year, capacity, divisions, faculties, schools, departments, class_grade } = req.body;

  let canonicalBatchClass = null;
  if (class_grade) {
    canonicalBatchClass = normalizeClassGrade(class_grade);
    if (!canonicalBatchClass) {
      return res.status(400).json({ message: `Invalid class_grade: "${class_grade}". Allowed canonical classes: 6th, 7th, 8th, 9th, 10th.` });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const batchInfo = await getNextLapBatchInfo(client, start_date);
    let finalName = (name || '').trim();
    if (!finalName || /^BATCH\s*\d*$/i.test(finalName)) {
      finalName = batchInfo.generatedName;
    } else {
      // Ensure name uniqueness if already taken
      const existingNameCheck = await client.query(
        "SELECT id FROM batches WHERE is_deleted IS NOT TRUE AND UPPER(TRIM(name)) = UPPER(TRIM($1))",
        [finalName]
      );
      if (existingNameCheck.rowCount > 0) {
        finalName = batchInfo.generatedName;
      }
    }

    let finalCode = (batch_code || '').trim();
    if (!finalCode || finalCode.startsWith('LTC')) {
      finalCode = batchInfo.generatedCode;
    }
    const finalYear = year || batchInfo.fullYear;

    const result = await client.query(
      `INSERT INTO batches (name, location, start_date, end_date, status, description, batch_code, year, capacity, class_grade)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [finalName, location || null, start_date || null, end_date || null, status || 'upcoming', description || null, finalCode, finalYear || null, capacity || null, canonicalBatchClass]
    );
    const newBatchId = result.rows[0].id;

    if (['active', 'Immersion'].includes(result.rows[0].status)) {
      await client.query(
        "UPDATE batches SET status = 'completed' WHERE status IN ('active', 'Immersion') AND id <> $1 AND is_deleted IS NOT TRUE",
        [newBatchId]
      );
    }

    // Seed schedules
    await seedImmersionSchedulesForBatch(client, newBatchId);

    // Resolve hierarchy selections
    const { whereSql, params } = buildHierarchyWhereClause(divisions, faculties, schools, departments, 1);
    if (whereSql !== 'FALSE') {
      // Find all matching student and faculty ids
      const matchedUsersRes = await client.query(
        `SELECT id, role, email, name, class_grade FROM users 
         WHERE ${whereSql} 
           AND (
             (role = 'student' AND id NOT IN (SELECT student_id FROM ri_batch_students WHERE source_program = 'RI_DIRECT'))
             OR role = 'faculty'
           )`,
        params
      );

      // Find currently assigned users in other batches
      const assignedStudentsRes = await client.query(
        `SELECT student_id FROM batch_students bs
         JOIN batches b ON bs.batch_id = b.id
         WHERE b.is_deleted IS NOT TRUE`
      );
      const assignedStudentIds = new Set(assignedStudentsRes.rows.map(r => r.student_id));

      const assignedFacultyRes = await client.query(
        `SELECT faculty_id FROM batch_faculty bf
         JOIN batches b ON bf.batch_id = b.id
         WHERE b.is_deleted IS NOT TRUE`
      );
      const assignedFacultyIds = new Set(assignedFacultyRes.rows.map(r => r.faculty_id));

      // Mixed-class batches: class_grade is informational and not an eligibility filter.
      const students = matchedUsersRes.rows.filter(u => u.role === 'student' && !assignedStudentIds.has(u.id));
      const faculty = matchedUsersRes.rows.filter(u => u.role === 'faculty' && !assignedFacultyIds.has(u.id));

      // Bulk-insert students (respect batch capacity, default 350)
      const batchCapacity = result.rows[0].capacity || 350;
      const studentsToAssign = students.slice(0, batchCapacity);
      if (studentsToAssign.length > 0) {
        const valueRows = [];
        const insertParams = [];
        let idx = 1;
        for (const s of studentsToAssign) {
          const barcode = `LTC-${newBatchId}-${s.id}-${Math.floor(Math.random() * 10000)}`;
          valueRows.push(`($${idx++}, $${idx++}, $${idx++})`);
          insertParams.push(newBatchId, s.id, barcode);
        }
        await client.query(
          `INSERT INTO batch_students (batch_id, student_id, barcode)
           VALUES ${valueRows.join(', ')}
           ON CONFLICT (batch_id, student_id) DO NOTHING`,
          insertParams
        );
      }

      // Bulk-insert faculty
      if (faculty.length > 0) {
        const valueRows = [];
        const insertParams = [];
        let idx = 1;
        for (const f of faculty) {
          valueRows.push(`($${idx++}, $${idx++})`);
          insertParams.push(newBatchId, f.id);
        }
        await client.query(
          `INSERT INTO batch_faculty (batch_id, faculty_id)
           VALUES ${valueRows.join(', ')}
           ON CONFLICT (batch_id, faculty_id) DO NOTHING`,
          insertParams
        );
      }
    }

    await client.query('COMMIT');

    try {
      const { syncLtcBatchToRiCore } = require('../services/riSyncService');
      await syncLtcBatchToRiCore(newBatchId);
    } catch (syncErr) {
      console.error(`[riSyncService] Error auto-syncing new batch ${newBatchId} to RI:`, syncErr);
    }

    writeAudit(req.user.id, req.user.name || 'Admin', 'BATCH_CREATED', 'batch', newBatchId, { name, batch_code: finalCode });
    res.status(201).json({ message: 'Batch created', batch: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
};

const previewHierarchy = async (req, res) => {
  const { divisions, faculties, schools, departments, limit } = req.body;
  const previewLimit = Math.min(5000, Math.max(1, parseInt(limit) || 350));

  try {
    const { whereSql, params } = buildHierarchyWhereClause(divisions, faculties, schools, departments, 1);

    if (whereSql === 'FALSE') {
      return res.json({
        totalStudents: 0,
        totalFaculty: 0,
        divisionBreakdown: {},
        schoolBreakdown: {},
        departmentBreakdown: {},
        previewStudents: [],
        previewFaculty: []
      });
    }

    // 1. Get counts (exclude assigned students)
    const countRes = await pool.query(
      `SELECT role, COUNT(*) as count 
       FROM users 
       WHERE ${whereSql} AND (
         (role = 'student' AND id NOT IN (SELECT student_id FROM batch_students) AND id NOT IN (SELECT student_id FROM ri_batch_students WHERE source_program = 'RI_DIRECT'))
         OR role = 'faculty'
       )
       GROUP BY role`,
      params
    );

    let totalStudents = 0;
    let totalFaculty = 0;
    for (const row of countRes.rows) {
      if (row.role === 'student') totalStudents = parseInt(row.count);
      if (row.role === 'faculty') totalFaculty = parseInt(row.count);
    }

    // 2. Get breakdowns by division, school, department
    const breakdownRes = await pool.query(
      `SELECT division, school, department, role, COUNT(*) as count
       FROM users
       WHERE ${whereSql} AND (
         (role = 'student' AND id NOT IN (SELECT student_id FROM batch_students) AND id NOT IN (SELECT student_id FROM ri_batch_students WHERE source_program = 'RI_DIRECT'))
         OR role = 'faculty'
       )
       GROUP BY division, school, department, role`,
      params
    );

    const divisionBreakdown = {};
    const schoolBreakdown = {};
    const departmentBreakdown = {};

    for (const r of breakdownRes.rows) {
      const r_div = r.division;
      const r_sch = r.school;
      const r_dept = r.department;
      const cnt = parseInt(r.count);
      if (r_div) divisionBreakdown[r_div] = (divisionBreakdown[r_div] || 0) + cnt;
      if (r_sch) schoolBreakdown[r_sch] = (schoolBreakdown[r_sch] || 0) + cnt;
      if (r_dept) departmentBreakdown[r_dept] = (departmentBreakdown[r_dept] || 0) + cnt;
    }

    // 3. Get student preview (limit dynamically)
    const studentPreviewRes = await pool.query(
      `SELECT id, name, prn, email, department, school, division
       FROM users
       WHERE ${whereSql} AND role = 'student'
       AND id NOT IN (SELECT student_id FROM batch_students)
       AND id NOT IN (SELECT student_id FROM ri_batch_students WHERE source_program = 'RI_DIRECT')
       ORDER BY name ASC LIMIT ${previewLimit}`,
      params
    );

    // 4. Get faculty preview (limit dynamically)
    const facultyPreviewRes = await pool.query(
      `SELECT id, name, faculty_id, email, department, school, division
       FROM users
       WHERE ${whereSql} AND role = 'faculty'
       ORDER BY name ASC LIMIT ${previewLimit}`,
      params
    );

    res.json({
      totalStudents,
      totalFaculty,
      divisionBreakdown,
      schoolBreakdown,
      departmentBreakdown,
      previewStudents: studentPreviewRes.rows,
      previewFaculty: facultyPreviewRes.rows
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateBatch = async (req, res) => {
  const { id } = req.params;
  const { name, location, start_date, end_date, status, description, batch_code, year, capacity, class_grade } = req.body;
  try {
    let finalStartDate = start_date || null;
    let canonicalBatchClass = undefined;
    if (class_grade !== undefined) {
      if (class_grade === '' || class_grade === null) {
        canonicalBatchClass = null;
      } else {
        canonicalBatchClass = normalizeClassGrade(class_grade);
        if (!canonicalBatchClass) {
          return res.status(400).json({ message: `Invalid class_grade: "${class_grade}". Allowed canonical classes: 6th, 7th, 8th, 9th, 10th.` });
        }
      }
    }

    const result = await pool.query(
      `UPDATE batches SET name=$1, location=$2, start_date=$3, end_date=$4, status=$5, description=$6,
        batch_code=COALESCE($7, batch_code), year=COALESCE($8, year), capacity=COALESCE($9, capacity),
        class_grade = (CASE WHEN $10::boolean THEN $11::varchar ELSE class_grade END)
       WHERE id=$12 AND is_deleted IS NOT TRUE RETURNING *`,
      [name, location || null, finalStartDate, end_date || null, status || 'upcoming', description || null,
        batch_code || null, year || null, capacity || null, (class_grade !== undefined), canonicalBatchClass, id]
    );
    if (['active', 'Immersion'].includes(result.rows[0].status)) {
      await pool.query(
        "UPDATE batches SET status = 'completed' WHERE status IN ('active', 'Immersion') AND id <> $1 AND is_deleted IS NOT TRUE",
        [id]
      );
    }

    try {
      const { syncLtcBatchToRiCore } = require('../services/riSyncService');
      await syncLtcBatchToRiCore(id);
    } catch (syncErr) {
      console.error(`[riSyncService] Error auto-syncing updated batch ${id} to RI:`, syncErr);
    }

    writeAudit(req.user.id, req.user.name || 'Admin', 'BATCH_UPDATED', 'batch', parseInt(id), { name });
    res.json({ message: 'Batch updated', batch: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// In-memory store for Batch Deletion OTPs: Map<batchId, { hash, salt, adminId, expiresAt, attemptsLeft, lastRequestedAt, resendCount, requestHourStart }>
const batchDeleteOtpStore = new Map();
const BATCH_DELETE_NOTIFICATION_EMAIL = 'ahsanimamkhan06@gmail.com';

const buildBatchDeleteOtpHtml = (batchName, batchId, user, otp) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Batch Deletion OTP Verification</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.05);">
          <tr>
            <td style="background: linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #ea580c 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
              <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #fecaca; margin-bottom: 6px;">
                SECURITY VERIFICATION REQUIRED
              </div>
              <h2 style="margin: 0; font-size: 21px; font-weight: 800; color: #ffffff; line-height: 1.3;">
                Authorize LTC Batch Deletion
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 24px;">
              <p style="font-size: 14.5px; color: #1e293b; margin: 0 0 14px 0; line-height: 1.5; font-weight: 600;">
                Hello Administrator,
              </p>
              <p style="font-size: 13.5px; color: #475569; margin: 0 0 18px 0; line-height: 1.6;">
                A request has been initiated by <strong>${user?.name || 'Admin'}</strong> (${user?.email || 'admin'}) to delete the following LTC cohort:
              </p>

              <div style="background-color: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px; padding: 14px 18px; margin-bottom: 22px;">
                <div style="font-size: 14px; font-weight: 800; color: #991b1b; margin-bottom: 4px;">
                  Cohort: ${batchName}
                </div>
                <div style="font-size: 12.5px; color: #b91c1c;">
                  Batch ID: #${batchId} | Requested At: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </div>
              </div>

              <div style="text-align: center; margin-bottom: 22px;">
                <div style="font-size: 12px; font-weight: 750; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px;">
                  Your Deletion Verification Code
                </div>
                <div style="display: inline-block; background-color: #f8fafc; border: 2px dashed #dc2626; border-radius: 12px; padding: 12px 28px; font-size: 30px; font-weight: 800; letter-spacing: 8px; color: #dc2626; font-family: monospace;">
                  ${otp}
                </div>
                <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
                  Valid for <strong>5 minutes</strong>. Strictly single use.
                </div>
              </div>

              <div style="background-color: #f8fafc; border-radius: 10px; padding: 12px 14px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5;">
                <strong>Security Notice:</strong> Deleting a batch unassigns all student and faculty enrollments for this cohort. If you did not initiate this deletion, contact platform administration immediately.
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 14px 24px; text-align: center; font-size: 11.5px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              MIT-WPU Life Transformation Center (LTC) Security System
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * Generates and sends a cryptographically secure OTP to ahsanimamkhan06@gmail.com
 * for authorizing LTC batch deletion.
 */
const requestBatchDeleteOtp = async (req, res) => {
  const { id } = req.params;
  const batchId = parseInt(id, 10);
  if (isNaN(batchId)) {
    return res.status(400).json({ message: 'Invalid batch ID' });
  }

  try {
    const batchRes = await pool.query("SELECT id, name FROM batches WHERE id = $1 AND is_deleted IS NOT TRUE", [batchId]);
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'Batch not found or already deleted' });
    }
    const batch = batchRes.rows[0];

    const now = Date.now();
    const existing = batchDeleteOtpStore.get(batchId);

    // Rate limiting: 60s cooldown between requests
    if (existing && (now - existing.lastRequestedAt < 60000)) {
      const waitSec = Math.ceil((existing.lastRequestedAt + 60000 - now) / 1000);
      return res.status(429).json({ message: `Please wait ${waitSec}s before requesting another verification code.` });
    }

    // Rate limiting: max 5 requests per hour
    if (existing) {
      if (now - existing.requestHourStart < 3600000) {
        if (existing.resendCount >= 5) {
          return res.status(429).json({ message: 'Rate limit reached: Maximum 5 OTP requests allowed per hour.' });
        }
      } else {
        existing.resendCount = 0;
        existing.requestHourStart = now;
      }
    }

    // Cryptographically secure 6-digit OTP
    const crypto = require('crypto');
    const otp = String(crypto.randomInt(100000, 1000000));
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');

    batchDeleteOtpStore.set(batchId, {
      hash,
      salt,
      adminId: req.user.id,
      batchId,
      expiresAt: now + 5 * 60 * 1000, // 5 minutes
      attemptsLeft: 5,
      lastRequestedAt: now,
      resendCount: ((existing?.resendCount) || 0) + 1,
      requestHourStart: existing?.requestHourStart || now
    });

    const destinationEmail = BATCH_DELETE_NOTIFICATION_EMAIL;
    const isMock = process.env.DISABLE_EMAIL === 'true' || req.body?.dryRun || process.env.NODE_ENV === 'test';

    if (!isMock) {
      const { sendEmail } = require('../services/emailService');
      await sendEmail({
        to: destinationEmail,
        subject: `[LTC Security] Batch Deletion OTP: ${batch.name}`,
        html: buildBatchDeleteOtpHtml(batch.name, batch.id, req.user, otp),
        text: `Your OTP for deleting batch "${batch.name}" (ID: ${batch.id}) is: ${otp}. It expires in 5 minutes.`
      });
      console.log(`[Batch Delete OTP] Sent OTP to ${destinationEmail} for batch #${batchId} by admin #${req.user.id}`);
    } else {
      console.log(`[Batch Delete OTP (Mock/Dev)] Generated OTP for batch "${batch.name}" (#${batchId}) to ${destinationEmail}`);
    }

    return res.json({
      success: true,
      message: `Security OTP sent to ${destinationEmail}`,
      targetEmail: 'ahsanimamkhan06@gmail.com',
      expiresIn: 300,
      resendCooldown: 60
    });
  } catch (err) {
    console.error('[Batch Delete OTP Error]:', err);
    return res.status(500).json({ message: 'Failed to generate deletion OTP', error: err.message });
  }
};

const deleteBatch = async (req, res) => {
  const { id } = req.params;
  const { hard } = req.query;
  const batchId = parseInt(id, 10);

  if (!Number.isInteger(batchId) || batchId <= 0) {
    return res.status(400).json({ message: 'Invalid batch id' });
  }

  try {
    const batchCheck = await pool.query(
      "SELECT id, name FROM batches WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)",
      [batchId]
    );
    if (batchCheck.rowCount === 0) {
      return res.status(404).json({ message: 'Batch not found or already deleted.' });
    }
    const batchName = batchCheck.rows[0].name;

    if (hard === 'true') {
      // Unassign in_current_batch flag before deleting relationships
      await pool.query(
        "UPDATE users SET in_current_batch = false WHERE id IN (SELECT student_id FROM batch_students WHERE batch_id = $1)",
        [batchId]
      );
      await pool.query(
        "UPDATE users SET in_current_batch = false WHERE id IN (SELECT faculty_id FROM batch_faculty WHERE batch_id = $1)",
        [batchId]
      );
      await pool.query("DELETE FROM batch_students WHERE batch_id = $1", [batchId]);
      await pool.query("DELETE FROM batch_faculty WHERE batch_id = $1", [batchId]);
      await pool.query("DELETE FROM batches WHERE id = $1", [batchId]);
      try {
        const { syncLtcBatchToRiCore } = require('../services/riSyncService');
        await syncLtcBatchToRiCore(batchId);
      } catch (syncErr) {
        console.error(`[riSyncService] Error auto-syncing deleted batch ${batchId} to RI:`, syncErr);
      }
      writeAudit(req.user.id, req.user.name || 'Admin', 'BATCH_HARD_DELETED', 'batch', batchId, { name: batchName });
      return res.json({ message: `Batch "${batchName}" permanently deleted. Enrolled students and faculty have been unassigned.` });
    }

    // For soft delete (archive), update the batch status
    const result = await pool.query(
      "UPDATE batches SET is_deleted = true, status = 'archived' WHERE id = $1 RETURNING id, name",
      [batchId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Batch not found' });

    // Clear student/faculty active batch assignments (undo)
    await pool.query(
      "UPDATE users SET in_current_batch = false WHERE id IN (SELECT student_id FROM batch_students WHERE batch_id = $1)",
      [batchId]
    );
    await pool.query(
      "UPDATE users SET in_current_batch = false WHERE id IN (SELECT faculty_id FROM batch_faculty WHERE batch_id = $1)",
      [batchId]
    );
    await pool.query("DELETE FROM batch_students WHERE batch_id = $1", [batchId]);
    await pool.query("DELETE FROM batch_faculty WHERE batch_id = $1", [batchId]);

    try {
      const { syncLtcBatchToRiCore } = require('../services/riSyncService');
      await syncLtcBatchToRiCore(batchId);
    } catch (syncErr) {
      console.error(`[riSyncService] Error auto-syncing archived batch ${batchId} to RI:`, syncErr);
    }

    writeAudit(req.user.id, req.user.name || 'Admin', 'BATCH_ARCHIVED', 'batch', batchId, { name: batchName });

    return res.json({ message: `Batch "${batchName}" successfully deleted and archived.` });
    await pool.query("DELETE FROM batch_students WHERE batch_id = $1", [id]);
    await pool.query("DELETE FROM batch_faculty WHERE batch_id = $1", [id]);

    try {
      const { syncLtcBatchToRiCore } = require('../services/riSyncService');
      await syncLtcBatchToRiCore(id);
    } catch (syncErr) {
      console.error(`[riSyncService] Error auto-syncing archived batch ${id} to RI:`, syncErr);
    }

    writeAudit(req.user.id, req.user.name || 'Admin', 'BATCH_ARCHIVED_OTP_VERIFIED', 'batch', parseInt(id), { name: result.rows[0].name });
    res.json({ message: 'Batch archived successfully after OTP verification. Enrolled students and faculty have been unassigned.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const restoreBatch = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE batches SET is_deleted = false, status = 'upcoming' WHERE id = $1 RETURNING id, name",
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Batch not found' });
    try {
      const { syncLtcBatchToRiCore } = require('../services/riSyncService');
      await syncLtcBatchToRiCore(id);
    } catch (syncErr) {
      console.error(`[riSyncService] Error auto-syncing restored batch ${id} to RI:`, syncErr);
    }
    writeAudit(req.user.id, req.user.name || 'Admin', 'BATCH_RESTORED', 'batch', parseInt(id), { name: result.rows[0].name });
    res.json({ message: 'Batch restored.', batch: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getBatchDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const batchRes = await pool.query(`
      SELECT b.*,
        COUNT(DISTINCT bs.student_id) as student_count,
        COUNT(DISTINCT bf.faculty_id) as faculty_count,
        COUNT(DISTINCT bs.student_id) FILTER (WHERE LOWER(TRIM(u.gender)) IN ('male', 'm')) as boys_count,
        COUNT(DISTINCT bs.student_id) FILTER (WHERE LOWER(TRIM(u.gender)) IN ('female', 'f')) as girls_count
      FROM batches b
      LEFT JOIN batch_students bs ON b.id = bs.batch_id
      LEFT JOIN users u ON bs.student_id = u.id
      LEFT JOIN batch_faculty bf ON b.id = bf.batch_id
      WHERE b.id = $1
      GROUP BY b.id
    `, [id]);
    if (batchRes.rowCount === 0) return res.status(404).json({ message: 'Batch not found' });
    const squadRes = await pool.query(
      `SELECT squad, COUNT(*) as count FROM batch_students WHERE batch_id = $1 AND squad IS NOT NULL GROUP BY squad ORDER BY squad`,
      [id]
    );
    res.json({ batch: batchRes.rows[0], squads: squadRes.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getBatchStudents = async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const division = req.query.division || '';
  const faculty = req.query.faculty || '';
  const school = req.query.school || '';
  const department = req.query.department || '';
  const gender = req.query.gender || '';
  const sortByRoom = req.query.sortByRoom === 'true';
  const squad = req.query.squad || '';

  try {
    let whereExtra = '';
    const params = [parseInt(id)];
    let paramIdx = 2;

    if (squad) {
      whereExtra += ` AND bs.squad = $${paramIdx}`;
      params.push(squad);
      paramIdx++;
    }

    if (search) {
      whereExtra += ` AND (u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.prn ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (division) {
      if (division === 'UNASSIGNED') {
        whereExtra += ` AND (u.division IS NULL OR u.division = '' OR LOWER(TRIM(u.division)) IN ('unassigned', 'n/a', 'none', '-'))`;
      } else {
        whereExtra += ` AND u.division = $${paramIdx}`;
        params.push(division);
        paramIdx++;
      }
    }
    if (faculty) {
      whereExtra += ` AND u.faculty = $${paramIdx}`;
      params.push(faculty);
      paramIdx++;
    }
    if (school) {
      whereExtra += ` AND u.school = $${paramIdx}`;
      params.push(school);
      paramIdx++;
    }
    if (department) {
      whereExtra += ` AND u.department = $${paramIdx}`;
      params.push(department);
      paramIdx++;
    }
    if (gender === 'male') {
      whereExtra += ` AND LOWER(TRIM(u.gender)) IN ('male', 'm')`;
    } else if (gender === 'female') {
      whereExtra += ` AND LOWER(TRIM(u.gender)) IN ('female', 'f')`;
    }

    const class_grade = req.query.class_grade || '';

    if (class_grade) {
      whereExtra += ` AND u.class_grade = $${paramIdx}`;
      params.push(class_grade);
      paramIdx++;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM batch_students bs JOIN users u ON bs.student_id = u.id WHERE bs.batch_id = $1${whereExtra}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    let orderBy = 'u.id ASC';
    if (sortByRoom) {
      orderBy = 'bs.room ASC NULLS LAST, u.id ASC';
    }

    const dataRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.prn, u.roll_number, u.class_grade, u.school_branch, u.parent_email,
              u.is_locked, u.department, u.semester, u.school, u.division, u.gender, u.phone, u.parent_mobile, u.nri, u.red_flag, u.tshirt_size, u.jain_food, u.monday_fast,
              u.photo_video_consent, u.tshirt_consent, u.data_consent, u.bag_check_consent, u.undertaking_signed_date, u.undertaking_signed_name,
              bs.squad, bs.room, bs.barcode, bs.is_squad_leader, bs.is_dnr, bs.dnr_marked_at, bs.dnr_marked_by_name, bs.dnr_reason,
              (ins.prn IS NOT NULL) as insured, u.undertaking_submitted
       FROM batch_students bs
       JOIN users u ON bs.student_id = u.id
       LEFT JOIN insurance ins ON u.prn = ins.prn
       WHERE bs.batch_id = $1${whereExtra}
       ORDER BY ${orderBy}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      students: await withLtcId(dataRes.rows),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getBatchStudentsExport = async (req, res) => {
  const { id } = req.params;
  try {
    const batchRes = await pool.query('SELECT * FROM batches WHERE id = $1', [id]);
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    const batch = batchRes.rows[0];

    const studentsRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.prn, u.department, u.semester, u.school, u.division, u.panel,
              u.gender, u.phone, u.dob, u.age, u.nationality, u.aadhar_no, u.salutation,
              u.first_name, u.middle_name, u.last_name, u.nominee_name, u.nominee_relationship,
              u.nominee_email, u.address, u.roll_number, u.parent_mobile, u.parent_email, u.faculty,
              bs.squad, bs.room, bs.barcode, bs.is_squad_leader, bs.is_dnr, bs.dnr_marked_at, bs.dnr_marked_by_name, bs.dnr_reason, bs.added_at
       FROM batch_students bs
       JOIN users u ON bs.student_id = u.id
       WHERE bs.batch_id = $1
       ORDER BY u.id ASC`,
      [id]
    );

    const studentIds = studentsRes.rows.map(s => s.id);
    const parentMap = {};
    if (studentIds.length > 0) {
      try {
        const psRes = await pool.query(
          `SELECT ps.student_id, ps.parent_id, ps.is_primary, ps.relationship,
                  p.name, p.email, p.phone
           FROM parent_students ps
           JOIN users p ON ps.parent_id = p.id
           WHERE ps.student_id = ANY($1::int[])
           ORDER BY ps.student_id, ps.is_primary DESC NULLS LAST, ps.created_at ASC NULLS LAST, p.id ASC`,
          [studentIds]
        );
        for (const pr of psRes.rows) {
          if (!parentMap[pr.student_id]) parentMap[pr.student_id] = [];
          parentMap[pr.student_id].push(pr);
        }
      } catch (pErr) {
        console.error('[getBatchStudentsExport parentLookup]', pErr.message);
      }
    }

    const formatExportDob = (dob) => {
      if (!dob) return '';
      const str = String(dob).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, d] = str.split('-');
        return `${d}/${m}/${y}`;
      }
      return str;
    };

    const extractExportNameComponents = (user) => {
      let salutation = user.salutation || '';
      let firstName = user.first_name || '';
      let middleName = user.middle_name || '';
      let lastName = user.last_name || '';

      if (!firstName && !lastName && user.name) {
        let cleanName = user.name.trim();
        const salutationMatch = cleanName.match(/^(Mr\.?|Ms\.?|Mrs\.?|Dr\.?|Prof\.?)\s+/i);
        if (salutationMatch) {
          if (!salutation) {
            salutation = salutationMatch[1].replace('.', '');
          }
          cleanName = cleanName.substring(salutationMatch[0].length).trim();
        }
        const tokens = cleanName.split(/\s+/).filter(Boolean);
        if (tokens.length === 1) {
          firstName = tokens[0];
        } else if (tokens.length === 2) {
          firstName = tokens[0];
          lastName = tokens[1];
        } else if (tokens.length >= 3) {
          firstName = tokens[0];
          middleName = tokens.slice(1, tokens.length - 1).join(' ');
          lastName = tokens[tokens.length - 1];
        }
      }

      if (!salutation && user.gender) {
        const g = String(user.gender).toLowerCase().trim();
        if (g.startsWith('m')) salutation = 'Mr';
        else if (g.startsWith('f')) salutation = 'Ms';
      }

      return { salutation, firstName, middleName, lastName };
    };

    const exportRows = studentsRes.rows.map((s, index) => {
      const { salutation, firstName, middleName, lastName } = extractExportNameComponents(s);
      const studentEmail = (s.email && !s.email.toLowerCase().endsWith('@lifeawakening.internal')) ? s.email : 'Not provided';
      const parents = parentMap[s.id] || [];
      const p1 = parents[0] || null;
      const p2 = parents[1] || null;
      const p1Email = p1?.email || (s.parent_email && !s.parent_email.toLowerCase().endsWith('@lifeawakening.internal') ? s.parent_email : '');
      const p2Email = p2?.email || '';
      const parentMobile = p1?.phone || s.parent_mobile || '';

      return {
        'Sr.No': index + 1,
        'PRN No': s.prn || '',
        'Salutation - Mr / Ms': salutation || '',
        'First Name ( As per Aadhar Card )': firstName || '',
        'Middle name ( As per Aadhar Card)': middleName || '',
        'Last name ( As per Aadhar Card )': lastName || '',
        'Mobile No': s.phone || '',
        'Date of Birth (DD/MMM/YYYY)': formatExportDob(s.dob),
        'Gender': s.gender || '',
        'Age': s.age !== null && s.age !== undefined && s.age !== '' ? Number(s.age) : '',
        'Nationality': s.nationality || 'Indian',
        'Aadhar Card no': s.aadhar_no || '',
        'Nominee  Name ( As per Aadhar Card )': s.nominee_name || '',
        'Nominee  Relationship': s.nominee_relationship || '',
        'Email Address': studentEmail,
        'Complete Address with pincode': s.address || '',
        'Division': s.division || '',
        'Panel': s.panel || '',
        'Roll Number': s.roll_number || '',
        'School': s.school || '',
        'Department': s.department || '',
        'Nominee Email ID': s.nominee_email || '',
        'Parent / Guardian Mobile ( preferably WhatsApp Number)': parentMobile,
        'Email ID Parent': p1Email,
        'Parent 2 Email': p2Email,
        'Faculty': s.faculty || '',
        'Source File': '',
        'Remarks': ''
      };
    });

    if (req.query.format === 'json') {
      return res.json({
        batch,
        students: exportRows,
        count: exportRows.length
      });
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Students Combined');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const safeName = (batch.name || `BATCH_${id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}_Students.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Student-Count', exportRows.length);
    return res.send(buffer);
  } catch (err) {
    console.error('Batch student export error:', err);
    res.status(500).json({ message: 'Server error during batch student export', error: err.message });
  }
};

const getBatchHardCopyPdf = async (req, res) => {
  const { id } = req.params;
  try {
    const batchRes = await pool.query('SELECT * FROM batches WHERE id = $1', [id]);
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    const batch = batchRes.rows[0];

    const studentsRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.prn, u.gender, u.panel, u.division, u.school, u.department, bs.squad, bs.room,
              (CASE 
                WHEN u.undertaking_submitted = true OR u.ri_undertaking_submitted = true THEN true
                WHEN EXISTS (
                  SELECT 1 FROM ri_undertakings ru 
                  WHERE ru.student_id = u.id AND (ru.status = 'Submitted' OR ru.status = 'approved')
                ) THEN true
                WHEN EXISTS (
                  SELECT 1 FROM ri_student_forms sf 
                  WHERE sf.student_id = u.id AND sf.form_type = 'UNDERTAKING' AND (sf.status = 'Submitted' OR sf.status = 'approved')
                ) THEN true
                ELSE false
              END) as has_undertaking
       FROM batch_students bs
       JOIN users u ON bs.student_id = u.id
       WHERE bs.batch_id = $1
       ORDER BY COALESCE(NULLIF(TRIM(u.panel), ''), NULLIF(TRIM(bs.squad), ''), NULLIF(TRIM(u.division), ''), 'Unassigned Panel') ASC, u.name ASC`,
      [id]
    );

    const rawStudents = studentsRes.rows;
    const students = await withLtcId(rawStudents);

    // Group students panel-wise (prioritize u.panel -> bs.squad -> u.division)
    const panelGroups = {};
    students.forEach(s => {
      let panelName = 'Unassigned Panel';
      if (s.panel && s.panel.trim()) {
        panelName = s.panel.trim();
      } else if (s.squad && s.squad.trim()) {
        panelName = s.squad.trim();
      } else if (s.division && s.division.trim()) {
        const divTrim = s.division.trim();
        if (/^[A-F]$/i.test(divTrim)) {
          panelName = `Panel-${divTrim.toUpperCase()}`;
        } else {
          panelName = divTrim;
        }
      }

      if (!panelGroups[panelName]) {
        panelGroups[panelName] = [];
      }
      panelGroups[panelName].push(s);
    });

    const panelKeys = Object.keys(panelGroups).sort();

    const startDateStr = batch.start_date ? new Date(batch.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const endDateStr = batch.end_date ? new Date(batch.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const puppeteer = require('puppeteer');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${batch.name} - Panel-Wise Attendance Hard Copy</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 10px;
      line-height: 1.35;
    }
    .panel-section {
      page-break-after: always;
    }
    .panel-section:last-child {
      page-break-after: auto;
    }
    .header-bar {
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .org-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 3px 0;
    }
    .doc-title {
      font-size: 12px;
      font-weight: 800;
      color: #2563eb;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .info-table {
      width: 100%;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      margin-bottom: 12px;
      border-collapse: collapse;
    }
    .info-table td {
      padding: 6px 10px;
      font-size: 10.5px;
    }
    .lbl {
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      font-size: 9px;
    }
    .val {
      font-weight: 700;
      color: #0f172a;
    }
    .att-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
    }
    .att-table th {
      background-color: #0f172a;
      color: #ffffff;
      padding: 6px 5px;
      border: 1px solid #0f172a;
      font-weight: 700;
      font-size: 9px;
      text-transform: uppercase;
      text-align: center;
      letter-spacing: 0.3px;
    }
    .att-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
      vertical-align: middle;
    }
    .att-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .center {
      text-align: center;
    }
    .chk-box {
      display: inline-block;
      width: 10px;
      height: 10px;
      border: 1.5px solid #334155;
      border-radius: 2px;
      margin-right: 3px;
      vertical-align: middle;
    }
    .sign-line {
      border-bottom: 1px dashed #94a3b8;
      height: 14px;
      width: 85%;
      margin: 0 auto;
    }
    .footer-section {
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      font-weight: 700;
      color: #334155;
      page-break-inside: avoid;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  ${panelKeys.length === 0 ? `
    <div class="panel-section">
      <div class="header-bar">
        <div>
          <div class="org-title">MIT World Peace University — LTC Portal</div>
          <div class="doc-title">Panel Attendance Sheet (Hard Copy)</div>
        </div>
        <div style="text-align: right; font-size: 9.5px; color: #64748b; font-weight: 600;">
          Generated: ${todayStr}
        </div>
      </div>
      <table class="info-table">
        <tr>
          <td width="35%"><span class="lbl">Batch Name:</span> <span class="val">${batch.name}</span></td>
          <td width="40%"><span class="lbl">Batch Dates:</span> <span class="val">${startDateStr} – ${endDateStr}</span></td>
          <td width="25%"><span class="lbl">Total Enrolled:</span> <span class="val">0 Students</span></td>
        </tr>
      </table>
      <div style="text-align: center; padding: 40px; color: #64748b; font-style: italic;">No students enrolled in this batch yet.</div>
    </div>
  ` : panelKeys.map((pName) => {
      const pStudents = panelGroups[pName];
      return `
      <div class="panel-section">
        <div class="header-bar">
          <div>
            <div class="org-title">MIT World Peace University — LTC Portal</div>
            <div class="doc-title">PANEL ATTENDANCE SHEET: <span style="color: #0f172a;">${pName}</span></div>
          </div>
          <div style="text-align: right; font-size: 9.5px; color: #64748b; font-weight: 600;">
            Generated: ${todayStr}
          </div>
        </div>

        <table class="info-table">
          <tr>
            <td width="24%"><span class="lbl">Batch Name:</span> <span class="val">${batch.name}</span></td>
            <td width="24%"><span class="lbl">Panel / Squad:</span> <span class="val" style="color: #2563eb; font-weight: 800;">${pName}</span></td>
            <td width="24%"><span class="lbl">Batch Dates:</span> <span class="val">${startDateStr} – ${endDateStr}</span></td>
            <td width="14%"><span class="lbl">Students:</span> <span class="val">${pStudents.length}</span></td>
            <td width="14%"><span class="lbl">Undertakings:</span> <span class="val" style="color: #166534;">${pStudents.filter(s => s.has_undertaking).length}/${pStudents.length}</span></td>
          </tr>
        </table>

        <table class="att-table">
          <thead>
            <tr>
              <th width="4%">#</th>
              <th width="16%">PRN / LTC ID</th>
              <th width="26%">Student Name</th>
              <th width="8%">Gender</th>
              <th width="13%">Panel / Squad</th>
              <th width="14%">Undertaking</th>
              <th width="19%">Signature</th>
            </tr>
          </thead>
          <tbody>
            ${pStudents.map((s, idx) => `
              <tr>
                <td class="center" style="font-weight: 700;">${idx + 1}</td>
                <td class="center" style="font-family: monospace; font-weight: 700;">${s.ltc_id || s.prn || 'N/A'}</td>
                <td style="font-weight: 700; color: #0f172a;">${s.name}</td>
                <td class="center" style="text-transform: capitalize;">${s.gender || '—'}</td>
                <td class="center" style="font-weight: 600; color: #1e40af;">${s.panel || s.squad || pName}</td>
                <td class="center">
                  ${s.has_undertaking 
                    ? '<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 8.5px; background: #dcfce7; color: #166534; border: 1px solid #86efac;">Submitted</span>' 
                    : '<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 8.5px; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;">Pending</span>'}
                </td>
                <td>
                  <div class="sign-line"></div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer-section" style="display: flex; flex-direction: column; gap: 10px; margin-top: 16px; border-top: 1.5px solid #0f172a; padding-top: 10px; font-size: 10px; font-weight: 700; color: #0f172a; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>Bus Detail: ________________________</div>
            <div>Faculty Name: ________________________</div>
            <div>Total Present: _________</div>
            <div>Total Absent: _________</div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <div>Faculty / Class Teacher Signature: _______________________</div>
            <div>Date: __________________</div>
          </div>
        </div>
      </div>
    `;
    }).join('')}
</body>
</html>`;

    let browser;
    let pdfBytes;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '8mm', bottom: '10mm', left: '8mm' }
      });
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeErr) {
          console.error('[getBatchHardCopyPdf Puppeteer Close Error]', closeErr);
        }
      }
    }

    const fileName = `${batch.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_PanelWise_Attendance_HardCopy.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('[getBatchHardCopyPdf Error]', err);
    res.status(500).json({ message: 'Failed to generate Hard Copy PDF', error: err.message });
  }
};

const getBatchAttendanceErpExcel = async (req, res) => {
  const { id } = req.params;
  const format = String(req.query.format || 'squad').toLowerCase();
  try {
    const batchRes = await pool.query('SELECT * FROM batches WHERE id = $1', [id]);
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    const batch = batchRes.rows[0];

    const studentsRes = await pool.query(
      `SELECT 
        u.name,
        u.prn,
        u.division,
        u.department,
        u.faculty,
        u.school,
        u.panel,
        bs.squad,
        bs.is_dnr,
        COALESCE(att_v2.pct, att_v1.pct, 0) as attendance_percentage
       FROM batch_students bs
       JOIN users u ON bs.student_id = u.id
       LEFT JOIN (
         SELECT student_id,
           ROUND((COUNT(CASE WHEN LOWER(status) = 'present' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 1) as pct
         FROM attendance_records_v2
         WHERE batch_id = $1
         GROUP BY student_id
       ) att_v2 ON att_v2.student_id = u.id
       LEFT JOIN (
         SELECT a.student_id,
           ROUND((COUNT(CASE WHEN LOWER(a.status) = 'present' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 1) as pct
         FROM attendance a
         LEFT JOIN schedules s ON a.schedule_id = s.id
         WHERE a.batch_id = $1 OR s.batch_id = $1
         GROUP BY a.student_id
       ) att_v1 ON att_v1.student_id = u.id
       WHERE bs.batch_id = $1`,
      [id]
    );

    const rows = studentsRes.rows;

    const SQUAD_ORDER = ['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi'];
    const getSquadRank = (sq) => {
      const clean = String(sq || '').trim();
      const idx = SQUAD_ORDER.findIndex(s => s.toLowerCase() === clean.toLowerCase());
      return idx !== -1 ? idx : 999;
    };

    if (format === 'panel') {
      rows.sort((a, b) => {
        const panelA = String(a.panel || '').trim();
        const panelB = String(b.panel || '').trim();
        const panelCmp = panelA.localeCompare(panelB, undefined, { numeric: true, sensitivity: 'base' });
        if (panelCmp !== 0) return panelCmp;

        const divA = String(a.division || '').trim();
        const divB = String(b.division || '').trim();
        const divCmp = divA.localeCompare(divB, undefined, { numeric: true, sensitivity: 'base' });
        if (divCmp !== 0) return divCmp;

        const nameA = String(a.name || '').trim();
        const nameB = String(b.name || '').trim();
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      });
    } else {
      // Default: squad-wise (Mitra before Martand per SQUAD_ORDER)
      rows.sort((a, b) => {
        const rankA = getSquadRank(a.squad);
        const rankB = getSquadRank(b.squad);
        if (rankA !== rankB) return rankA - rankB;

        const squadA = String(a.squad || '').trim();
        const squadB = String(b.squad || '').trim();
        const squadCmp = squadA.localeCompare(squadB, undefined, { numeric: true, sensitivity: 'base' });
        if (squadCmp !== 0) return squadCmp;

        const divA = String(a.division || '').trim();
        const divB = String(b.division || '').trim();
        const divCmp = divA.localeCompare(divB, undefined, { numeric: true, sensitivity: 'base' });
        if (divCmp !== 0) return divCmp;

        const nameA = String(a.name || '').trim();
        const nameB = String(b.name || '').trim();
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    const columns = [
      'Name',
      'PRN',
      'Division',
      'Department',
      'Faculty',
      'School',
      format === 'panel' ? 'Panel' : 'Squad',
      'Attendance Percentage',
      'Status / Remarks'
    ];

    const dataRows = rows.map(r => [
      r.name || '',
      r.prn || '',
      r.division || '',
      r.department || '',
      r.faculty || '',
      r.school || '',
      format === 'panel' ? (r.panel || '—') : (r.squad || '—'),
      `${Number(r.attendance_percentage || 0)}%`,
      r.is_dnr ? 'DNR (Did Not Report - Permanent Absentee)' : (Number(r.attendance_percentage || 0) < 30 ? 'Low Attendance (<30%)' : 'Regular')
    ]);

    const summaryRows = [
      [],
      ['Bus Detail: __________'],
      ['Faculty Name: __________'],
      ['Total Present: ______'],
      ['Total Absent: ______']
    ];

    const wsData = [columns, ...dataRows, ...summaryRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 25 },
      { wch: 18 },
      { wch: 12 },
      { wch: 20 },
      { wch: 25 },
      { wch: 25 },
      { wch: 18 },
      { wch: 22 }
    ];

    const wb = XLSX.utils.book_new();
    const sheetTitle = format === 'panel' ? 'Attendance_Panel_Wise' : 'Attendance_Squad_Wise';
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const sanitizeName = (batch.name || 'Batch').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateStr = `${dd}-${mm}-${yyyy}`;
    const filenameLabel = format === 'panel' ? 'Panel_Wise' : 'Squad_Wise';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Attendance_${filenameLabel}_${sanitizeName}_${dateStr}.xlsx`);
    return res.send(buffer);
  } catch (err) {
    console.error('Error generating Attendance for ERP Excel:', err);
    return res.status(500).json({ message: 'Failed to generate Attendance for ERP Excel', error: err.message });
  }
};


const addBatchStudents = async (req, res) => {
  const { id } = req.params;
  const { identifiers, matchType, student_ids } = req.body;
  const targetList = identifiers || student_ids;
  if (!Array.isArray(targetList) || targetList.length === 0) {
    return res.status(400).json({ message: 'identifiers or student_ids must be a non-empty array' });
  }
  try {
    const batchCheck = await pool.query("SELECT id, name, capacity, class_grade FROM batches WHERE id = $1", [id]);
    if (batchCheck.rowCount === 0) return res.status(404).json({ message: 'Batch not found' });
    const batchCapacityLimit = batchCheck.rows[0].capacity || 350;
    const batchClass = batchCheck.rows[0].class_grade;

    let column = 'email';
    if (student_ids && !identifiers) {
      column = 'id';
    } else if (matchType === 'prn') {
      column = 'prn';
    }

    const matchRes = await pool.query(
      `SELECT id, name, email, class_grade FROM users 
       WHERE role = 'student' 
         AND NOT (EXISTS (SELECT 1 FROM ri_batch_students rbs WHERE rbs.student_id = users.id AND rbs.source_program = 'RI_DIRECT') AND NOT EXISTS (SELECT 1 FROM batch_students bs WHERE bs.student_id = users.id))
         AND ${column} = ANY($1)`,
      [targetList]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*)::int FROM batch_students WHERE batch_id = $1`,
      [id]
    );
    const currentStudentCount = countRes.rows[0].count;
    let remainingSlots = Math.max(0, batchCapacityLimit - currentStudentCount);

    let added = 0;
    let skipped = 0;
    const errors = [];

    for (const student of matchRes.rows) {
      try {
        // batchClass (batches.class_grade) is informational only — mixed-class batches are allowed.

        const checkBatch = await pool.query(
          `SELECT b.name FROM batch_students bs
           JOIN batches b ON bs.batch_id = b.id
           WHERE bs.student_id = $1 AND bs.batch_id <> $2 AND (b.is_deleted = false OR b.is_deleted IS NULL)
           LIMIT 1`,
          [student.id, id]
        );
        if (checkBatch.rowCount > 0) {
          skipped++;
          errors.push({ email: student.email, error: `Student is already allocated to batch: ${checkBatch.rows[0].name}` });
          continue;
        }

        if (remainingSlots <= 0) {
          skipped++;
          errors.push({ email: student.email, error: `Batch capacity limit of ${batchCapacityLimit} students reached.` });
          continue;
        }

        const barcode = `LTC-${id}-${student.id}-${Math.floor(Math.random() * 10000)}`;
        const insertRes = await pool.query(
          `INSERT INTO batch_students (batch_id, student_id, barcode)
           VALUES ($1, $2, $3)
           ON CONFLICT (batch_id, student_id) DO NOTHING`,
          [id, student.id, barcode]
        );
        if (insertRes.rowCount > 0) {
          added++;
          remainingSlots--;
          const batchName = batchCheck.rows[0].name;
          await createSystemNotification(
            student.id,
            'Enrolled in Batch',
            `You have been enrolled in batch "${batchName}" by an administrator.`,
            'info',
            req.user.id
          );
        } else {
          skipped++;
        }
      } catch (e) {
        skipped++;
        errors.push({ email: student.email, error: e.message });
      }
    }

    if (added > 0) {
      try {
        const { syncLtcBatchToRiCore } = require('../services/riSyncService');
        await syncLtcBatchToRiCore(id);
      } catch (syncErr) {
        console.error(`[riSyncService] Error auto-syncing batch ${id} after addBatchStudents:`, syncErr);
      }
    }

    res.json({
      message: `Added ${added} students to batch. ${skipped} skipped (already in a batch or capacity reached).`,
      matched: matchRes.rowCount,
      added,
      skipped,
      unmatched: targetList.length - matchRes.rowCount,
      errors
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const removeBatchStudent = async (req, res) => {
  const { id, studentId } = req.params;
  try {
    const batchRes = await pool.query("SELECT name FROM batches WHERE id = $1", [id]);
    const batchName = batchRes.rows[0]?.name || 'Unknown Batch';

    await pool.query("DELETE FROM batch_students WHERE batch_id = $1 AND student_id = $2", [id, studentId]);

    try {
      const { syncLtcBatchToRiCore } = require('../services/riSyncService');
      await syncLtcBatchToRiCore(id);
    } catch (syncErr) {
      console.error(`[riSyncService] Error auto-syncing batch ${id} after removeBatchStudent:`, syncErr);
    }

    await createSystemNotification(
      studentId,
      'Removed from Batch',
      `You have been removed from batch "${batchName}" by an administrator.`,
      'info',
      req.user.id
    );

    res.json({ message: 'Student removed from batch. Master record preserved.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const addOneBatchStudent = async (req, res) => {
  const { id } = req.params;
  const { student_id } = req.body;
  try {
    const batchCapRes = await pool.query(`SELECT id, name, capacity, class_grade FROM batches WHERE id = $1`, [id]);
    if (batchCapRes.rowCount === 0) return res.status(404).json({ message: 'Batch not found' });
    const batch = batchCapRes.rows[0];

    const studentRes = await pool.query(
      `SELECT id, name, email, class_grade FROM users 
       WHERE id = $1 AND role = 'student'
         AND NOT (EXISTS (SELECT 1 FROM ri_batch_students rbs WHERE rbs.student_id = users.id AND rbs.source_program = 'RI_DIRECT') AND NOT EXISTS (SELECT 1 FROM batch_students bs WHERE bs.student_id = users.id))`,
      [student_id]
    );
    if (studentRes.rowCount === 0) return res.status(404).json({ message: 'Student not found' });
    const student = studentRes.rows[0];

    // batch.class_grade is informational only — students of any class may join.
    const checkBatch = await pool.query(
      `SELECT b.name FROM batch_students bs
       JOIN batches b ON bs.batch_id = b.id
       WHERE bs.student_id = $1 AND bs.batch_id <> $2 AND (b.is_deleted = false OR b.is_deleted IS NULL)
       LIMIT 1`,
      [student_id, id]
    );
    if (checkBatch.rowCount > 0) {
      return res.status(400).json({ message: `Student is already allocated to batch: ${checkBatch.rows[0].name}` });
    }

    const batchCapacityLimit = batch.capacity || 350;

    const countRes = await pool.query(
      `SELECT COUNT(*)::int FROM batch_students WHERE batch_id = $1`,
      [id]
    );
    const currentStudentCount = countRes.rows[0].count;
    if (currentStudentCount >= batchCapacityLimit) {
      return res.status(400).json({ message: `Batch capacity limit of ${batchCapacityLimit} students reached.` });
    }

    const barcode = `LTC-${id}-${student_id}-${Math.floor(Math.random() * 10000)}`;
    const insertRes = await pool.query(
      `INSERT INTO batch_students (batch_id, student_id, barcode) VALUES ($1, $2, $3) ON CONFLICT (batch_id, student_id) DO NOTHING`,
      [id, student_id, barcode]
    );
    if (insertRes.rowCount > 0) {
      const batchRes = await pool.query("SELECT name FROM batches WHERE id = $1", [id]);
      const batchName = batchRes.rows[0]?.name || 'Unknown Batch';
      try {
        const { syncLtcBatchToRiCore } = require('../services/riSyncService');
        await syncLtcBatchToRiCore(id);
      } catch (syncErr) {
        console.error(`[riSyncService] Error auto-syncing batch ${id} after addOneBatchStudent:`, syncErr);
      }
      await createSystemNotification(
        student_id,
        'Enrolled in Batch',
        `You have been enrolled in batch "${batchName}" by an administrator.`,
        'info',
        req.user.id
      );
    }
    res.json({ message: 'Student added to batch.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getBatchFaculty = async (req, res) => {
  const { id } = req.params;
  const search = req.query.search || '';
  const roleFilter = req.query.role || ''; // 'faculty', 'ltc_member', or '' for all
  const squad = req.query.squad || '';
  try {
    const params = [parseInt(id)];
    let paramIdx = 2;
    let whereExtra = '';

    if (squad) {
      whereExtra += ` AND bf.squad = $${paramIdx}`;
      params.push(squad);
      paramIdx++;
    }

    if (roleFilter === 'faculty') {
      whereExtra += ` AND (u.role = 'faculty' OR (u.role = 'superadmin_readonly' AND (u.base_role = 'faculty' OR u.base_role IS NULL)))`;
    } else if (roleFilter === 'ltc_member') {
      whereExtra += ` AND (u.role = 'ltc_member' OR (u.role = 'superadmin_readonly' AND u.base_role = 'ltc_member'))`;
    }

    if (search) {
      whereExtra += ` AND (u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.department ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
    }
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.division, u.school, u.panel, u.is_primary, u.gender, u.phone, u.tshirt_size, u.undertaking_submitted, u.designation,
              bf.squad
       FROM batch_faculty bf
       JOIN users u ON bf.faculty_id = u.id
       WHERE bf.batch_id = $1${whereExtra}
       ORDER BY u.name ASC`,
      params
    );
    res.json({ faculty: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const addBatchFaculty = async (req, res) => {
  const { id } = req.params;
  const { faculty_ids } = req.body;
  if (!Array.isArray(faculty_ids) || faculty_ids.length === 0) {
    return res.status(400).json({ message: 'faculty_ids must be a non-empty array' });
  }
  try {
    let added = 0;
    let skipped = 0;
    const errors = [];
    for (const fid of faculty_ids) {
      // Multi-batch allowed: same faculty/LTC member may be in multiple batches.
      // Intra-batch duplicate is prevented by the DB PRIMARY KEY (batch_id, faculty_id)
      // via ON CONFLICT below. No cross-batch check needed.

      const insertRes = await pool.query(
        `INSERT INTO batch_faculty (batch_id, faculty_id) VALUES ($1, $2) ON CONFLICT (batch_id, faculty_id) DO NOTHING`,
        [id, fid]
      );
      if (insertRes.rowCount > 0) {
        added++;
        const batchRes = await pool.query("SELECT name FROM batches WHERE id = $1", [id]);
        const batchName = batchRes.rows[0]?.name || 'Unknown Batch';
        await createSystemNotification(
          fid,
          'Assigned to Batch',
          `You have been assigned to batch "${batchName}" as a Faculty Advisor by an administrator.`,
          'info',
          req.user.id
        );
      } else {
        skipped++;
      }
    }
    try {
      const { syncLtcBatchToRiCore } = require('../services/riSyncService');
      await syncLtcBatchToRiCore(id);
    } catch (syncErr) {
      console.error(`[riSyncService] Error auto-syncing batch ${id} after addBatchFaculty:`, syncErr);
    }

    if (errors.length > 0) {
      res.json({ message: `Assigned ${added} members. ${skipped} skipped (already assigned to other batches). Details: ${errors.join(', ')}` });
    } else {
      res.json({ message: `${added} members assigned to batch.` });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const bulkVerifyBatchFaculty = async (req, res) => {
  const { id } = req.params;
  const { emails } = req.body;
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ message: 'emails must be a non-empty array' });
  }

  const cleanEmails = emails.map(e => String(e).trim().toLowerCase()).filter(Boolean);
  if (cleanEmails.length === 0) {
    return res.status(400).json({ message: 'No valid emails provided' });
  }

  try {
    const { role } = req.query;
    const roleVal = role === 'ltc_member' ? 'ltc_member' : 'faculty';

    // Get matching master faculty who are not already in this batch
    const matchRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department 
       FROM users u
       WHERE u.role = $1 AND LOWER(u.email) = ANY($2)
       AND u.id NOT IN (
         SELECT faculty_id FROM batch_faculty WHERE batch_id = $3
       )`,
      [roleVal, cleanEmails, id]
    );

    const matchedEmails = matchRes.rows.map(r => r.email.toLowerCase());
    const unmatched = cleanEmails.filter(e => !matchedEmails.includes(e));

    res.json({
      matched: matchRes.rows,
      unmatched
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const removeBatchFaculty = async (req, res) => {
  const { id, facultyId } = req.params;
  try {
    const batchRes = await pool.query("SELECT name FROM batches WHERE id = $1", [id]);
    const batchName = batchRes.rows[0]?.name || 'Unknown Batch';

    await pool.query("DELETE FROM batch_faculty WHERE batch_id = $1 AND faculty_id = $2", [id, facultyId]);

    await createSystemNotification(
      facultyId,
      'Removed from Batch',
      `You have been removed from batch "${batchName}" by an administrator.`,
      'info',
      req.user.id
    );

    try {
      const { syncLtcBatchToRiCore } = require('../services/riSyncService');
      await syncLtcBatchToRiCore(id);
    } catch (syncErr) {
      console.error(`[riSyncService] Error auto-syncing batch ${id} after removeBatchFaculty:`, syncErr);
    }

    res.json({ message: 'Faculty removed from batch. Master record preserved.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const batchBulkUpload = async (req, res) => {
  const { id } = req.params;
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const { duplicateAction } = req.body;

  try {
    const batchCheck = await pool.query("SELECT id, name FROM batches WHERE id = $1", [id]);
    if (batchCheck.rowCount === 0) {
      try { fs.unlinkSync(req.file.path); } catch (_) { }
      return res.status(404).json({ message: 'Batch not found' });
    }

    const jobRes = await pool.query(
      `INSERT INTO upload_jobs (batch_id, filename, status, total_records)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [id, req.file.originalname || `Batch ${batchCheck.rows[0].name} Ingestion`, 'pending', 0]
    );
    const jobId = jobRes.rows[0].id;

    setImmediate(() => {
      processUploadJobInBackground(jobId, req.file.path, parseInt(id), true, req.user.id, req.user.name || 'Admin', duplicateAction || 'replace');
    });

    res.json({ jobId, message: 'Bulk upload started in the background.' });
  } catch (err) {
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) { }
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const enrollExistingBatchUsers = async (req, res) => {
  const { id } = req.params;
  const { records } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ message: 'records must be a non-empty array' });
  }

  try {
    const batchCheck = await pool.query("SELECT id, name, status, capacity FROM batches WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)", [id]);
    if (batchCheck.rowCount === 0) return res.status(404).json({ message: 'Batch not found' });
    const batchCapacityLimit = batchCheck.rows[0].capacity || 350;

    const emails = new Set();
    const prns = new Set();
    const facultyIds = new Set();

    for (const raw of records) {
      if (!raw || typeof raw !== 'object') continue;
      const r = {};
      for (const key in raw) {
        r[key.replace(/^\uFEFF/, '').toLowerCase().trim()] = String(raw[key] || '').trim();
      }
      const email = r.email?.toLowerCase() || '';
      const prn = r.prn || r['student id'] || r.student_id || '';
      const fid = r.faculty_id || r['faculty id'] || '';
      if (email) emails.add(email);
      if (prn) prns.add(prn);
      if (fid) facultyIds.add(fid);
    }

    if (emails.size === 0 && prns.size === 0 && facultyIds.size === 0) {
      return res.status(400).json({ message: 'No valid email, PRN, or faculty_id found in the uploaded file.' });
    }

    const matchRes = await pool.query(
      `SELECT id, name, email, prn, faculty_id, role
       FROM users
       WHERE email = ANY($1) OR prn = ANY($2) OR faculty_id = ANY($3)`,
      [[...emails], [...prns], [...facultyIds]]
    );

    const allUsers = matchRes.rows;
    const students = allUsers.filter(u => u.role === 'student');
    const faculty = allUsers.filter(u => u.role === 'faculty' || u.role === 'ltc_member');

    let enrolled = 0;
    let alreadyInBatch = 0;
    const notFoundCount = records.length - allUsers.length;

    const skippedOtherBatch = [];
    const skippedCapacity = [];
    const skippedFacOtherBatch = [];

    if (students.length > 0) {
      const studentIds = students.map(s => s.id);

      const alreadyRes = await pool.query(
        `SELECT student_id FROM batch_students WHERE batch_id = $1 AND student_id = ANY($2)`,
        [id, studentIds]
      );
      const alreadySet = new Set(alreadyRes.rows.map(r => r.student_id));

      const otherBatchRes = await pool.query(
        `SELECT bs.student_id, b.name AS batch_name
         FROM batch_students bs
         JOIN batches b ON bs.batch_id = b.id
         WHERE bs.student_id = ANY($1) AND bs.batch_id <> $2 AND (b.is_deleted = false OR b.is_deleted IS NULL)`,
        [studentIds, id]
      );
      const otherBatchMap = new Map();
      for (const row of otherBatchRes.rows) {
        otherBatchMap.set(row.student_id, row.batch_name);
      }

      const toAdd = [];
      for (const s of students) {
        if (alreadySet.has(s.id)) {
          alreadyInBatch++;
        } else if (otherBatchMap.has(s.id)) {
          skippedOtherBatch.push({ name: s.name, batch: otherBatchMap.get(s.id) });
        } else {
          toAdd.push(s);
        }
      }

      const countRes = await pool.query(
        `SELECT COUNT(*)::int FROM batch_students WHERE batch_id = $1`,
        [id]
      );
      const currentStudentCount = countRes.rows[0].count;
      let remainingSlots = Math.max(0, batchCapacityLimit - currentStudentCount);

      const studentsToInsert = [];
      for (const s of toAdd) {
        if (remainingSlots > 0) {
          studentsToInsert.push(s);
          remainingSlots--;
        } else {
          skippedCapacity.push(s.name);
        }
      }

      if (studentsToInsert.length > 0) {
        const valueRows = [];
        const params = [];
        let idx = 1;
        for (const s of studentsToInsert) {
          const barcode = `LTC-${id}-${s.id}-${Math.floor(Math.random() * 10000)}`;
          valueRows.push(`($${idx++}, $${idx++}, $${idx++})`);
          params.push(id, s.id, barcode);
        }
        await pool.query(
          `INSERT INTO batch_students (batch_id, student_id, barcode)
           VALUES ${valueRows.join(', ')}
           ON CONFLICT (batch_id, student_id) DO NOTHING`,
          params
        );
        enrolled += studentsToInsert.length;

        const batchName = batchCheck.rows[0].name;
        for (const s of studentsToInsert) {
          await createSystemNotification(
            s.id,
            'Enrolled in Batch',
            `You have been enrolled in batch "${batchName}" by an administrator.`,
            'info',
            req.user.id
          );
        }
      }
    }

    if (enrolled > 0) {
      try {
        const { syncLtcBatchToRiCore } = require('../services/riSyncService');
        await syncLtcBatchToRiCore(id);
      } catch (syncErr) {
        console.error(`[riSyncService] Error auto-syncing batch ${id} after enrollExistingBatchUsers:`, syncErr);
      }
    }

    if (faculty.length > 0) {
      const facultyUserIds = faculty.map(f => f.id);

      // Intra-batch duplicate check: skip faculty already in THIS batch.
      const alreadyFacRes = await pool.query(
        `SELECT faculty_id FROM batch_faculty WHERE batch_id = $1 AND faculty_id = ANY($2)`,
        [id, facultyUserIds]
      );
      const alreadyFacSet = new Set(alreadyFacRes.rows.map(r => r.faculty_id));

      // Multi-batch allowed: faculty/LTC in another batch may also join this one.
      // No cross-batch skip. Build insert list from those not already in THIS batch.
      const facultyToInsert = [];
      for (const f of faculty) {
        if (alreadyFacSet.has(f.id)) {
          alreadyInBatch++;
        } else {
          facultyToInsert.push(f);
        }
      }

      if (facultyToInsert.length > 0) {
        const valueRows = [];
        const params = [];
        let idx = 1;
        for (const f of facultyToInsert) {
          valueRows.push(`($${idx++}, $${idx++})`);
          params.push(id, f.id);
        }
        await pool.query(
          `INSERT INTO batch_faculty (batch_id, faculty_id)
           VALUES ${valueRows.join(', ')}
           ON CONFLICT (batch_id, faculty_id) DO NOTHING`,
          params
        );
        enrolled += facultyToInsert.length;

        const batchName = batchCheck.rows[0].name;
        for (const f of facultyToInsert) {
          await createSystemNotification(
            f.id,
            'Assigned to Batch',
            `You have been assigned to batch "${batchName}" as a Faculty Advisor by an administrator.`,
            'info',
            req.user.id
          );
        }
      }
    }

    let detailMsg = 'Enrollment complete.';
    const details = [];
    if (skippedOtherBatch && skippedOtherBatch.length > 0) {
      details.push(`${skippedOtherBatch.length} students skipped (already assigned to other batches)`);
    }
    if (skippedCapacity && skippedCapacity.length > 0) {
      details.push(`${skippedCapacity.length} students skipped (batch capacity limit of ${batchCapacityLimit} reached)`);
    }
    // skippedFacOtherBatch removed: multi-batch assignment is now allowed.
    if (details.length > 0) {
      detailMsg += ` Note: ${details.join(', ')}.`;
    }

    res.json({
      message: detailMsg,
      enrolled,
      alreadyInBatch,
      notFound: notFoundCount < 0 ? 0 : notFoundCount,
      total: records.length
    });
  } catch (err) {
    console.error('Enroll-existing error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getBatchSquads = async (req, res) => {
  const { id } = req.params;
  try {
    const lockKey = `batch_${id}_squads_locked`;
    const lockCheck = await pool.query("SELECT value FROM system_settings WHERE key = $1", [lockKey]);
    const isLocked = lockCheck.rowCount > 0 && lockCheck.rows[0].value === 'true';

    const welcomeKey = `batch_${id}_welcome_emails_sent`;
    const welcomeCheck = await pool.query("SELECT value FROM system_settings WHERE key = $1", [welcomeKey]);
    const welcomeEmailsSent = welcomeCheck.rowCount > 0 && welcomeCheck.rows[0].value === 'true';

    const studentsRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.gender, u.prn, u.panel, u.undertaking_submitted, u.tshirt_size, u.jain_food, u.monday_fast, u.division, u.faculty, u.school, u.department, bs.squad, bs.room, bs.barcode, bs.is_squad_leader, bs.room_designation, bs.squad_designation
       FROM batch_students bs
       JOIN users u ON bs.student_id = u.id
       WHERE bs.batch_id = $1
       ORDER BY bs.squad ASC, u.name ASC`,
      [id]
    );

    const facultyRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.undertaking_submitted, bf.squad
       FROM batch_faculty bf
       JOIN users u ON bf.faculty_id = u.id
       WHERE bf.batch_id = $1
       ORDER BY bf.squad ASC, u.name ASC`,
      [id]
    );

    res.json({
      locked: isLocked,
      welcomeEmailsSent,
      students: studentsRes.rows,
      faculty: facultyRes.rows,
      squadNames: SQUAD_NAMES
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const autoAllocateBatchSquads = async (req, res) => {
  const { id } = req.params;
  try {
    const lockKey = `batch_${id}_squads_locked`;
    const lockCheck = await pool.query("SELECT value FROM system_settings WHERE key = $1", [lockKey]);
    if (lockCheck.rowCount > 0 && lockCheck.rows[0].value === 'true') {
      return res.status(400).json({ message: 'Squad allocation is locked for this batch.' });
    }

    const studentsRes = await pool.query(
      "SELECT u.id, u.gender FROM batch_students bs JOIN users u ON bs.student_id = u.id WHERE bs.batch_id = $1",
      [id]
    );
    const students = studentsRes.rows;
    const total = students.length;

    if (total === 0) return res.status(400).json({ message: 'No students in this batch.' });

    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    const girls = shuffle(students.filter(s => {
      const g = s.gender ? s.gender.trim().toLowerCase() : '';
      return g === 'female' || g === 'f';
    }));
    const boys = shuffle(students.filter(s => {
      const g = s.gender ? s.gender.trim().toLowerCase() : '';
      return g === 'male' || g === 'm';
    }));
    const others = shuffle(students.filter(s => {
      const g = s.gender ? s.gender.trim().toLowerCase() : '';
      return g !== 'female' && g !== 'f' && g !== 'male' && g !== 'm';
    }));
    const allStudents = [...girls, ...boys, ...others];

    // Assign squads & barcodes in memory first
    for (let i = 0; i < allStudents.length; i++) {
      allStudents[i].squad = SQUAD_NAMES[i % SQUAD_NAMES.length];
      allStudents[i].barcode = `LTC-${id}-${allStudents[i].id}-${Math.floor(Math.random() * 10000)}`;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update the database with squads and room=NULL (preserving existing squad_designation)
      for (let i = 0; i < allStudents.length; i++) {
        const student = allStudents[i];
        await client.query(
          "UPDATE batch_students SET squad = $1, barcode = $2, room = NULL WHERE batch_id = $3 AND student_id = $4",
          [student.squad, student.barcode, id, student.id]
        );
      }

      // Get normal faculty
      const normalRes = await client.query(
        `SELECT u.id FROM batch_faculty bf
         JOIN users u ON bf.faculty_id = u.id
         WHERE bf.batch_id = $1 AND u.role = 'faculty'`,
        [id]
      );
      // Set all batch LTC faculty squad to NULL first to reset (others stay spare)
      await client.query(
        `UPDATE batch_faculty bf 
         SET squad = NULL 
         FROM users u 
         WHERE bf.faculty_id = u.id AND bf.batch_id = $1 AND u.role = 'ltc_member'`,
        [id]
      );

      // Get LTC faculty who are Squad Coordinators
      const ltcRes = await client.query(
        `SELECT u.id FROM batch_faculty bf
         JOIN users u ON bf.faculty_id = u.id
         WHERE bf.batch_id = $1 AND u.role = 'ltc_member' AND u.designation ILIKE 'Squad Coordinator'`,
        [id]
      );

      const normalFaculty = shuffle(normalRes.rows);
      const ltcFaculty = shuffle(ltcRes.rows);

      // Allocate normal faculty: max 1 per squad, rest get null (Spare)
      for (let i = 0; i < normalFaculty.length; i++) {
        const squadName = i < SQUAD_NAMES.length ? SQUAD_NAMES[i] : null;
        await client.query(
          "UPDATE batch_faculty SET squad = $1 WHERE batch_id = $2 AND faculty_id = $3",
          [squadName, id, normalFaculty[i].id]
        );
      }

      // Allocate LTC Squad Coordinator faculty: max 1 per squad, rest get null (Spare)
      for (let i = 0; i < ltcFaculty.length; i++) {
        const squadName = i < SQUAD_NAMES.length ? SQUAD_NAMES[i] : null;
        await client.query(
          "UPDATE batch_faculty SET squad = $1 WHERE batch_id = $2 AND faculty_id = $3",
          [squadName, id, ltcFaculty[i].id]
        );
      }

      await client.query('COMMIT');
      res.json({ message: `Squads allocated successfully for ${allStudents.length} students.` });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getBatchUnavailableRooms = async (req, res) => {
  const { id } = req.params;
  try {
    const batchRes = await pool.query(
      "SELECT id, unavailable_rooms FROM batches WHERE id = $1",
      [id]
    );
    if (batchRes.rowCount === 0) return res.status(404).json({ message: 'Batch not found' });

    let allRooms = [];
    try {
      const { all } = require('../utils/roomHelper').getRoomsFromExcel();
      allRooms = all || [];
    } catch (err) {
      console.warn('Could not read roomHelper rooms:', err.message);
    }

    const unavailable = batchRes.rows[0].unavailable_rooms || [];
    return res.json({
      unavailable_rooms: Array.isArray(unavailable) ? unavailable : [],
      all_rooms: allRooms
    });
  } catch (err) {
    console.error('Error in getBatchUnavailableRooms:', err);
    return res.status(500).json({ message: 'Failed to fetch unavailable rooms', error: err.message });
  }
};

const updateBatchUnavailableRooms = async (req, res) => {
  const { id } = req.params;
  const { unavailable_rooms } = req.body;
  try {
    const sanitized = Array.isArray(unavailable_rooms)
      ? unavailable_rooms.map(r => String(r).trim()).filter(Boolean)
      : [];

    await pool.query(
      "UPDATE batches SET unavailable_rooms = $1 WHERE id = $2",
      [sanitized, id]
    );

    return res.json({
      success: true,
      message: 'Unavailable rooms updated successfully',
      unavailable_rooms: sanitized
    });
  } catch (err) {
    console.error('Error in updateBatchUnavailableRooms:', err);
    return res.status(500).json({ message: 'Failed to save unavailable rooms', error: err.message });
  }
};

function canonicalizeStandard(rawGrade) {
  if (!rawGrade) return 'Unassigned';
  const clean = String(rawGrade).trim().toLowerCase();
  if (/^6(\D|$)|6th|sixth|vi(\b|$)/i.test(clean)) return '6th';
  if (/^7(\D|$)|7th|seventh|vii(\b|$)/i.test(clean)) return '7th';
  if (/^8(\D|$)|8th|eighth|viii(\b|$)/i.test(clean)) return '8th';
  if (/^9(\D|$)|9th|ninth|ix(\b|$)/i.test(clean)) return '9th';
  if (/^10(\D|$)|10th|tenth|x(\b|$)/i.test(clean)) return '10th';
  return String(rawGrade).trim();
}

const autoAllocateBatchRooms = async (req, res) => {
  const { id } = req.params;
  const { mode = 'random', preview = false } = req.body || {};
  const isClassWise = (mode === 'class-wise' || mode === 'class_wise');

  try {
    const studentsRes = await pool.query(
      `SELECT u.id, u.gender, u.name, u.prn, u.class_grade, bs.squad, bs.room, bs.room_designation 
       FROM batch_students bs 
       JOIN users u ON bs.student_id = u.id 
       WHERE bs.batch_id = $1`,
      [id]
    );
    const rawStudents = studentsRes.rows;
    if (rawStudents.length === 0) return res.status(400).json({ message: 'No students in this batch.' });

    // For random mode, check if students have squad assignments
    if (!isClassWise) {
      const unassignedSquadCount = rawStudents.filter(s => !s.squad).length;
      if (unassignedSquadCount === rawStudents.length) {
        return res.status(400).json({ message: 'Please allocate squads first before allocating rooms.' });
      }
    }

    // Attach canonical standard to each student
    const students = rawStudents.map(s => ({
      ...s,
      standard: canonicalizeStandard(s.class_grade)
    }));

    // Load and parse rooms Excel file
    let sinhgadRooms = [];
    let pratapgadRooms = [];
    try {
      const XLSX = require('xlsx');
      const path = require('path');
      const fs = require('fs');
      let xlsxPath = path.join(__dirname, '..', '..', 'LTC Rooms Availability.xlsx');
      if (!fs.existsSync(xlsxPath)) {
        xlsxPath = path.join(__dirname, '..', 'LTC Rooms Availability.xlsx');
      }
      if (fs.existsSync(xlsxPath)) {
        const workbook = XLSX.readFile(xlsxPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        let currentFloor = '';
        for (let i = 2; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          if (row[0]) {
            currentFloor = String(row[0]).trim();
          }
          // Sinhgad room
          if (row[1] && String(row[1]).trim() !== 'Room No') {
            const roomNo = String(row[1]).trim();
            const allottedTo = row[2] ? String(row[2]).trim() : '';
            const capacity = parseInt(row[3]) || 0;
            sinhgadRooms.push({ floor: currentFloor, roomNo, allottedTo, capacity, building: 'Sinhgad' });
          }
          // Pratapgad room
          if (row[5] && String(row[5]).trim() !== 'Room No') {
            const roomNo = String(row[5]).trim();
            const allottedTo = row[6] ? String(row[6]).trim() : '';
            const capacity = parseInt(row[7]) || 0;
            pratapgadRooms.push({ floor: currentFloor, roomNo, allottedTo, capacity, building: 'Pratapgad' });
          }
        }
      }
    } catch (excelErr) {
      console.error('Error loading rooms Excel:', excelErr);
    }

    // Fetch unavailable rooms for this batch to exclude them from the room allocation pool
    const batchInfoRes = await pool.query(
      "SELECT unavailable_rooms FROM batches WHERE id = $1",
      [id]
    );
    const rawUnavailable = (batchInfoRes.rows[0]?.unavailable_rooms || []);
    const unavailableSet = new Set(
      rawUnavailable.map(r => String(r).trim().toLowerCase())
    );

    const isRoomUnavailable = (roomNo, building) => {
      const rNo = String(roomNo || '').trim().toLowerCase();
      const bName = String(building || '').trim().toLowerCase();
      const combined = `${bName}-${rNo}`.toLowerCase();
      return unavailableSet.has(rNo) || unavailableSet.has(combined);
    };

    const filterStudentRooms = (rooms, building) => rooms.filter(r => r.allottedTo.toLowerCase() !== 'faculty' && !isRoomUnavailable(r.roomNo, building));
    const floorPriority = (floorName) => {
      const name = String(floorName).toLowerCase();
      if (name.includes('ground')) return 0;
      if (name.includes('first')) return 1;
      if (name.includes('second')) return 2;
      if (name.includes('third')) return 3;
      return 4;
    };
    const sortRooms = (rooms) => {
      return [...rooms].sort((a, b) => {
        const fpA = floorPriority(a.floor);
        const fpB = floorPriority(b.floor);
        if (fpA !== fpB) return fpA - fpB;
        return parseInt(a.roomNo, 10) - parseInt(b.roomNo, 10);
      });
    };

    const sortedSinhgad = sortRooms(filterStudentRooms(sinhgadRooms, 'Sinhgad'));
    const sortedPratapgad = sortRooms(filterStudentRooms(pratapgadRooms, 'Pratapgad'));

    // Segregate lists for room allocation
    const girlsList = students.filter(s => {
      const g = s.gender ? s.gender.trim().toLowerCase() : '';
      return g === 'female' || g === 'f';
    });
    const boysAndOthersList = students.filter(s => {
      const g = s.gender ? s.gender.trim().toLowerCase() : '';
      return g !== 'female' && g !== 'f';
    });

    const girlsCount = girlsList.length;
    const boysCount = boysAndOthersList.length;

    let girlsBuildingRooms = [];
    let boysBuildingRooms = [];
    let girlsBuildingName = '';
    let boysBuildingName = '';

    // Assign building based on counts: larger gender group gets Sinhgad (41 rooms), smaller gets Pratapgad (27 rooms)
    if (girlsCount > boysCount) {
      girlsBuildingRooms = sortedSinhgad;
      boysBuildingRooms = sortedPratapgad;
      girlsBuildingName = 'Sinhgad';
      boysBuildingName = 'Pratapgad';
    } else {
      girlsBuildingRooms = sortedPratapgad;
      boysBuildingRooms = sortedSinhgad;
      girlsBuildingName = 'Pratapgad';
      boysBuildingName = 'Sinhgad';
    }

    const getSquadOrder = (squadName) => {
      const idx = SQUAD_NAMES.indexOf(squadName);
      return idx === -1 ? 999 : idx;
    };

    const warnings = [];
    const proposedRooms = [];
    const unallocatedStudents = [];

    if (isClassWise) {
      // ═════════════════════════════════════════════════════════════════════
      // CLASS-WISE ROOM ALLOCATION:
      // - Classes 6, 7 and 8 may share rooms with each other.
      // - Classes 9 and 10 may share rooms with each other.
      // - Classes 6–8 must NEVER share rooms with classes 9–10.
      // - Empty beds or partially occupied rooms are acceptable to maintain separation.
      // - Existing gender-separation rules are strictly preserved.
      // ═════════════════════════════════════════════════════════════════════
      const STANDARD_ORDER = ['6th', '7th', '8th', '9th', '10th', 'Unassigned'];

      const allocateClassWise = (studentList, roomList, buildingName, genderLabel) => {
        const isGroup68 = (std) => ['6th', '7th', '8th'].includes(std);
        const isGroup910 = (std) => ['9th', '10th'].includes(std);

        const group68 = [];
        const group910 = [];
        const groupOther = [];

        for (const s of studentList) {
          const std = s.standard || 'Unassigned';
          if (isGroup68(std)) {
            group68.push(s);
          } else if (isGroup910(std)) {
            group910.push(s);
          } else {
            groupOther.push(s);
          }
        }

        // Sort students within each group: first by standard order, then squad order, then name
        const sortGroupStudents = (list) => {
          return list.sort((a, b) => {
            const stdIdxA = STANDARD_ORDER.indexOf(a.standard);
            const stdIdxB = STANDARD_ORDER.indexOf(b.standard);
            if (stdIdxA !== stdIdxB) return (stdIdxA === -1 ? 99 : stdIdxA) - (stdIdxB === -1 ? 99 : stdIdxB);
            const sqA = getSquadOrder(a.squad);
            const sqB = getSquadOrder(b.squad);
            if (sqA !== sqB) return sqA - sqB;
            return (a.name || '').localeCompare(b.name || '');
          });
        };

        const groups = [
          { label: 'Classes 6–8', students: sortGroupStudents(group68) },
          { label: 'Classes 9–10', students: sortGroupStudents(group910) }
        ];
        if (groupOther.length > 0) {
          groups.push({ label: 'Other/Unassigned', students: sortGroupStudents(groupOther) });
        }

        let currentRoomIdx = 0;

        for (const grp of groups) {
          const grpStudents = grp.students;
          if (grpStudents.length === 0) continue;

          let studentIdx = 0;
          while (studentIdx < grpStudents.length) {
            if (currentRoomIdx >= roomList.length) {
              // Insufficient rooms in this building for this gender
              const remaining = grpStudents.slice(studentIdx);
              remaining.forEach(st => {
                st.room = 'Overfilled';
                unallocatedStudents.push({ ...st, reason: `No suitable room available in ${buildingName} for ${genderLabel} (${grp.label})` });
              });
              warnings.push(
                `Warning: Insufficient rooms in ${buildingName} for ${genderLabel} in ${grp.label} (${remaining.length} student${remaining.length > 1 ? 's' : ''} unassigned). Separation rules were maintained.`
              );
              break;
            }

            const roomObj = roomList[currentRoomIdx];
            const capacity = roomObj.capacity || 6;
            const assignedForThisRoom = grpStudents.slice(studentIdx, studentIdx + capacity);
            const fullRoomName = `${buildingName}-${roomObj.roomNo}`;

            assignedForThisRoom.forEach(st => {
              st.room = fullRoomName;
            });

            const distinctStandards = [...new Set(assignedForThisRoom.map(st => st.standard))].sort((a, b) => {
              return STANDARD_ORDER.indexOf(a) - STANDARD_ORDER.indexOf(b);
            });

            proposedRooms.push({
              room: fullRoomName,
              building: buildingName,
              floor: roomObj.floor,
              gender: genderLabel,
              standard: distinctStandards.join(', '),
              standardGroup: grp.label,
              capacity: capacity,
              occupied: assignedForThisRoom.length,
              students: assignedForThisRoom
            });

            studentIdx += assignedForThisRoom.length;
            // ADVANCE TO NEXT ROOM: ENSURES CLASSES 6-8 AND 9-10 NEVER SHARE ROOMS
            currentRoomIdx++;
          }
        }
      };

      allocateClassWise(girlsList, girlsBuildingRooms, girlsBuildingName, 'Female');
      allocateClassWise(boysAndOthersList, boysBuildingRooms, boysBuildingName, 'Male');

    } else {
      // ═════════════════════════════════════════════════════════════════════
      // RANDOM ROOM ALLOCATION (EXISTING): Boys/Girls + Squad adjacency
      // ═════════════════════════════════════════════════════════════════════

      // Allocate rooms to Girls (by squad with adjacency)
      const girlsBySquad = {};
      for (const s of girlsList) {
        const sq = s.squad || 'Spare';
        if (!girlsBySquad[sq]) girlsBySquad[sq] = [];
        girlsBySquad[sq].push(s);
      }
      const girlsSquadNames = Object.keys(girlsBySquad).sort((a, b) => getSquadOrder(a) - getSquadOrder(b));
      for (const sq of girlsSquadNames) {
        girlsBySquad[sq].sort((a, b) => a.name.localeCompare(b.name));
      }

      let girlsRoomIdx = 0;
      let girlsRemainingCapacity = girlsBuildingRooms.length > 0 ? girlsBuildingRooms[0].capacity : 0;
      for (const sq of girlsSquadNames) {
        const squadGirls = girlsBySquad[sq];
        for (const girl of squadGirls) {
          if (girlsRoomIdx >= girlsBuildingRooms.length) {
            girl.room = 'Overfilled';
            unallocatedStudents.push({ ...girl, reason: `Insufficient capacity in ${girlsBuildingName} for Female students` });
            continue;
          }
          let roomObj = girlsBuildingRooms[girlsRoomIdx];
          if (girlsRemainingCapacity === 0) {
            girlsRoomIdx++;
            if (girlsRoomIdx >= girlsBuildingRooms.length) {
              girl.room = 'Overfilled';
              unallocatedStudents.push({ ...girl, reason: `Insufficient capacity in ${girlsBuildingName} for Female students` });
              continue;
            }
            roomObj = girlsBuildingRooms[girlsRoomIdx];
            girlsRemainingCapacity = roomObj.capacity;
          }
          girl.room = `${girlsBuildingName}-${roomObj.roomNo}`;
          girlsRemainingCapacity--;
        }
      }

      // Allocate rooms to Boys & Others (by squad with adjacency)
      const boysBySquad = {};
      for (const s of boysAndOthersList) {
        const sq = s.squad || 'Spare';
        if (!boysBySquad[sq]) boysBySquad[sq] = [];
        boysBySquad[sq].push(s);
      }
      const boysSquadNames = Object.keys(boysBySquad).sort((a, b) => getSquadOrder(a) - getSquadOrder(b));
      for (const sq of boysSquadNames) {
        boysBySquad[sq].sort((a, b) => a.name.localeCompare(b.name));
      }

      let boysRoomIdx = 0;
      let boysRemainingCapacity = boysBuildingRooms.length > 0 ? boysBuildingRooms[0].capacity : 0;
      for (const sq of boysSquadNames) {
        const squadBoys = boysBySquad[sq];
        for (const boy of squadBoys) {
          if (boysRoomIdx >= boysBuildingRooms.length) {
            boy.room = 'Overfilled';
            unallocatedStudents.push({ ...boy, reason: `Insufficient capacity in ${boysBuildingName} for Male students` });
            continue;
          }
          let roomObj = boysBuildingRooms[boysRoomIdx];
          if (boysRemainingCapacity === 0) {
            boysRoomIdx++;
            if (boysRoomIdx >= boysBuildingRooms.length) {
              boy.room = 'Overfilled';
              unallocatedStudents.push({ ...boy, reason: `Insufficient capacity in ${boysBuildingName} for Male students` });
              continue;
            }
            roomObj = boysBuildingRooms[boysRoomIdx];
            boysRemainingCapacity = roomObj.capacity;
          }
          boy.room = `${boysBuildingName}-${roomObj.roomNo}`;
          boysRemainingCapacity--;
        }
      }

      if (unallocatedStudents.length > 0) {
        warnings.push(`Warning: Insufficient rooms to accommodate ${unallocatedStudents.length} student(s). Marked as Overfilled.`);
      }

      // Group for random mode proposedRooms output
      const roomMap = {};
      students.forEach(s => {
        if (s.room && s.room !== 'Overfilled') {
          if (!roomMap[s.room]) {
            const bName = s.room.split('-')[0];
            const rNo = s.room.split('-')[1];
            const foundRoom = (bName === 'Sinhgad' ? sinhgadRooms : pratapgadRooms).find(r => r.roomNo === rNo);
            roomMap[s.room] = {
              room: s.room,
              building: bName,
              floor: foundRoom?.floor || '—',
              gender: ['female', 'f'].includes((s.gender || '').toLowerCase()) ? 'Female' : 'Male',
              standard: 'Mixed Standards',
              capacity: foundRoom?.capacity || 6,
              occupied: 0,
              students: []
            };
          }
          roomMap[s.room].students.push(s);
          roomMap[s.room].occupied++;
        }
      });
      Object.values(roomMap).forEach(r => proposedRooms.push(r));
    }

    // Helper function to shuffle array
    const shuffleArray = (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    // Group students by allocated room (ignore Overfilled and unassigned)
    const studentsByRoom = {};
    for (const student of students) {
      if (student.room && student.room !== 'Overfilled') {
        if (!studentsByRoom[student.room]) {
          studentsByRoom[student.room] = [];
        }
        studentsByRoom[student.room].push(student);
      }
    }

    const designations = [
      'Room Leader',
      'Room Handover Incharge',
      'Cleanliness Incharge',
      'Punctuality Incharge',
      'Wake up Incharge',
      'Light Off Incharge'
    ];

    // Assign designations randomly per room
    for (const roomKey in studentsByRoom) {
      const roomStudents = studentsByRoom[roomKey];
      const shuffled = shuffleArray(roomStudents);
      shuffled.forEach((student, idx) => {
        if (idx < designations.length) {
          student.room_designation = designations[idx];
        } else {
          student.room_designation = null;
        }
      });
    }

    // Also update designations in proposedRooms for preview display
    proposedRooms.forEach(pr => {
      pr.students.forEach(st => {
        const match = students.find(s => s.id === st.id);
        if (match) {
          st.room_designation = match.room_designation;
        }
      });
    });

    const allocatedStudentsCount = students.filter(s => s.room && s.room !== 'Overfilled').length;
    const existingAllocatedCount = rawStudents.filter(s => s.room && s.room !== 'Overfilled').length;

    // Build class breakdown summary
    const classBreakdown = {};
    students.forEach(s => {
      const std = s.standard || 'Unassigned';
      if (!classBreakdown[std]) {
        classBreakdown[std] = { standard: std, girls: 0, boys: 0, total: 0, roomsCount: 0 };
      }
      const isF = ['female', 'f'].includes((s.gender || '').toLowerCase());
      if (isF) classBreakdown[std].girls++;
      else classBreakdown[std].boys++;
      classBreakdown[std].total++;
    });

    proposedRooms.forEach(pr => {
      if (pr.standard && classBreakdown[pr.standard]) {
        classBreakdown[pr.standard].roomsCount++;
      }
    });

    // If preview mode, return simulation data without writing to database
    if (preview) {
      return res.json({
        success: true,
        preview: true,
        mode: isClassWise ? 'class-wise' : 'random',
        summary: {
          totalStudents: students.length,
          allocatedCount: allocatedStudentsCount,
          unallocatedCount: unallocatedStudents.length,
          existingAllocatedCount,
          girlsCount,
          boysCount,
          girlsBuilding: girlsBuildingName,
          boysBuilding: boysBuildingName,
          girlsRoomsUsed: proposedRooms.filter(r => r.gender === 'Female').length,
          boysRoomsUsed: proposedRooms.filter(r => r.gender === 'Male').length,
          totalRoomsUsed: proposedRooms.length,
          availableRoomsPool: sortedSinhgad.length + sortedPratapgad.length,
          hasShortage: warnings.length > 0 || unallocatedStudents.length > 0
        },
        warnings,
        classBreakdown: Object.values(classBreakdown),
        roomAssignments: proposedRooms,
        unallocatedStudents
      });
    }

    // Persist to database inside a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const student of students) {
        await client.query(
          "UPDATE batch_students SET room = $1, room_designation = $2 WHERE batch_id = $3 AND student_id = $4",
          [student.room || null, student.room_designation || null, id, student.id]
        );
      }
      await client.query('COMMIT');
      res.json({
        success: true,
        message: isClassWise 
          ? 'Class-wise room allocation completed successfully. Classes 6–8 and classes 9–10 are allocated in separate rooms.'
          : 'Rooms allocated successfully based on gender and squad adjacency rules.',
        mode: isClassWise ? 'class-wise' : 'random',
        allocatedCount: allocatedStudentsCount,
        unallocatedCount: unallocatedStudents.length,
        warnings
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getBatchStudentsBreakdown = async (req, res) => {
  const { id } = req.params;
  try {
    const studentsRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.gender, u.prn, u.class_grade, bs.squad, bs.room, bs.room_designation
       FROM batch_students bs
       JOIN users u ON bs.student_id = u.id
       WHERE bs.batch_id = $1
       ORDER BY bs.room ASC, u.name ASC`,
      [id]
    );

    const rawStudents = studentsRes.rows;
    const STANDARD_ORDER = ['6th', '7th', '8th', '9th', '10th'];

    const students = rawStudents.map(s => {
      const standard = canonicalizeStandard(s.class_grade);
      const g = (s.gender || '').trim().toLowerCase();
      const isFemale = g === 'female' || g === 'f';
      const gender = isFemale ? 'Female' : 'Male';
      const room = (s.room && s.room !== 'Overfilled' && s.room.trim() !== '') ? s.room.trim() : null;
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        prn: s.prn,
        gender,
        rawGrade: s.class_grade,
        standard,
        squad: s.squad || '—',
        room,
        isAllocated: room !== null,
        roomDesignation: s.room_designation || null
      };
    });

    // Collect all unique standards present in data
    const presentStandards = [...new Set(students.map(s => s.standard))];
    const sortedStandards = [...STANDARD_ORDER];
    presentStandards.forEach(std => {
      if (!sortedStandards.includes(std)) sortedStandards.push(std);
    });

    // Class-wise breakdown
    const classBreakdown = sortedStandards.map(std => {
      const classStudents = students.filter(s => s.standard === std);
      const boys = classStudents.filter(s => s.gender === 'Male');
      const girls = classStudents.filter(s => s.gender === 'Female');

      const boysRooms = [...new Set(boys.filter(s => s.isAllocated).map(s => s.room))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const girlsRooms = [...new Set(girls.filter(s => s.isAllocated).map(s => s.room))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const unallocatedBoys = boys.filter(s => !s.isAllocated).length;
      const unallocatedGirls = girls.filter(s => !s.isAllocated).length;

      return {
        standard: std,
        boysCount: boys.length,
        girlsCount: girls.length,
        totalStudents: classStudents.length,
        boysRooms,
        girlsRooms,
        allocatedBoys: boys.length - unallocatedBoys,
        allocatedGirls: girls.length - unallocatedGirls,
        unallocatedBoys,
        unallocatedGirls,
        totalAllocated: classStudents.length - (unallocatedBoys + unallocatedGirls),
        totalUnallocated: unallocatedBoys + unallocatedGirls
      };
    }).filter(row => row.totalStudents > 0 || STANDARD_ORDER.includes(row.standard));

    // Room-wise breakdown
    const roomMap = {};
    students.forEach(s => {
      if (s.isAllocated) {
        if (!roomMap[s.room]) {
          const parts = s.room.split('-');
          const building = parts[0] || 'Unknown';
          roomMap[s.room] = {
            room: s.room,
            building,
            gender: s.gender,
            totalStudents: 0,
            classCounts: {},
            students: []
          };
        }
        roomMap[s.room].totalStudents++;
        roomMap[s.room].classCounts[s.standard] = (roomMap[s.room].classCounts[s.standard] || 0) + 1;
        roomMap[s.room].students.push(s);
      }
    });

    const roomBreakdown = Object.values(roomMap).sort((a, b) => {
      if (a.building !== b.building) return a.building.localeCompare(b.building);
      return a.room.localeCompare(b.room, undefined, { numeric: true });
    }).map(r => {
      const classSummaryParts = Object.entries(r.classCounts)
        .sort((a, b) => {
          let idxA = STANDARD_ORDER.indexOf(a[0]);
          let idxB = STANDARD_ORDER.indexOf(b[0]);
          if (idxA === -1) idxA = 99;
          if (idxB === -1) idxB = 99;
          return idxA - idxB;
        })
        .map(([std, count]) => `${std} (${count})`);

      return {
        room: r.room,
        building: r.building,
        gender: r.gender,
        totalStudents: r.totalStudents,
        classCounts: r.classCounts,
        classesSummary: classSummaryParts.join(', '),
        students: r.students
      };
    });

    const unallocatedStudents = students.filter(s => !s.isAllocated);

    const summary = {
      totalStudents: students.length,
      totalBoys: students.filter(s => s.gender === 'Male').length,
      totalGirls: students.filter(s => s.gender === 'Female').length,
      totalAllocated: students.filter(s => s.isAllocated).length,
      totalUnallocated: unallocatedStudents.length,
      totalRoomsUsed: roomBreakdown.length,
      boysRoomsUsed: roomBreakdown.filter(r => r.gender === 'Male').length,
      girlsRoomsUsed: roomBreakdown.filter(r => r.gender === 'Female').length
    };

    res.json({
      success: true,
      summary,
      classBreakdown,
      roomBreakdown,
      unallocatedStudents
    });
  } catch (err) {
    console.error('Error in getBatchStudentsBreakdown:', err);
    res.status(500).json({ message: 'Server error fetching students breakdown', error: err.message });
  }
};

const updateBatchStudentSquad = async (req, res) => {
  const { id } = req.params;
  const { student_id, squad } = req.body;
  try {
    await pool.query(
      "UPDATE batch_students SET squad = $1 WHERE batch_id = $2 AND student_id = $3",
      [squad, id, student_id]
    );
    await createSystemNotification(
      student_id,
      'Squad Assignment Updated',
      `Your squad has been updated to "${squad || 'Not Assigned'}" by an administrator.`,
      'info',
      req.user.id
    );
    res.json({ message: 'Squad updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getAvailableBatchRooms = async (req, res) => {
  const { id } = req.params;
  const { gender } = req.query;
  try {
    const rooms = await getAvailableRoomsForBatch(id, gender);
    res.json({ message: 'Available rooms retrieved successfully.', rooms });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve available rooms', error: err.message });
  }
};

const updateStudentRoom = async (req, res) => {
  const { id, studentId } = req.params;
  const { room } = req.body;
  try {
    const studentRes = await pool.query(
      `SELECT bs.student_id, bs.room, u.name, u.gender 
       FROM batch_students bs
       JOIN users u ON bs.student_id = u.id
       WHERE bs.batch_id = $1 AND bs.student_id = $2`,
      [id, studentId]
    );

    if (studentRes.rowCount === 0) {
      return res.status(404).json({ message: 'Student not found in this batch.' });
    }

    const valResult = await validateRoomAssignment(id, room);
    if (!valResult.valid) {
      return res.status(400).json({ message: valResult.error });
    }

    const newRoom = valResult.room;

    await pool.query(
      `UPDATE batch_students SET room = $1 WHERE batch_id = $2 AND student_id = $3`,
      [newRoom, id, studentId]
    );

    await createSystemNotification(
      studentId,
      'Room Allocation Updated',
      `Your room assignment has been updated to "${newRoom}" by an administrator.`,
      'info',
      req.user.id
    );

    res.json({
      message: `Room updated to ${newRoom} successfully.`,
      room: newRoom,
      student_id: studentId
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update student room', error: err.message });
  }
};

const updateBatchFacultySquad = async (req, res) => {
  const { id } = req.params;
  const { faculty_id, squad } = req.body;
  try {
    // 1. Get faculty role
    const facRes = await pool.query("SELECT id, role, name FROM users WHERE id = $1", [faculty_id]);
    if (facRes.rowCount === 0) return res.status(404).json({ message: 'Faculty not found' });
    const faculty = facRes.rows[0];

    if (squad && squad !== 'Spare') {
      // 2. Check how many of the same type are in the target squad
      const checkRes = await pool.query(
        `SELECT u.id, u.name FROM batch_faculty bf
         JOIN users u ON bf.faculty_id = u.id
         WHERE bf.batch_id = $1 AND bf.squad = $2 AND u.role = $3 AND bf.faculty_id <> $4`,
        [id, squad, faculty.role, faculty_id]
      );
      if (checkRes.rowCount >= 1) {
        const typeLabel = faculty.role === 'ltc_member' ? 'LTC Faculty' : 'Normal Faculty';
        return res.status(400).json({
          message: `Squad ${squad} already has a ${typeLabel} assigned (${checkRes.rows[0].name}). Allocate them to Spare first.`
        });
      }
    }

    const targetSquad = (squad === 'Spare' || !squad) ? null : squad;

    await pool.query(
      "UPDATE batch_faculty SET squad = $1 WHERE batch_id = $2 AND faculty_id = $3",
      [targetSquad, id, faculty_id]
    );
    await createSystemNotification(
      faculty_id,
      'Squad Assignment Updated',
      `Your squad assignment has been updated to "${targetSquad || 'Spare/Not Assigned'}" by an administrator.`,
      'info',
      req.user.id
    );
    res.json({ message: 'Faculty squad updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const lockBatchSquads = async (req, res) => {
  const { id } = req.params;
  const { locked } = req.body;
  try {
    const lockKey = `batch_${id}_squads_locked`;
    await pool.query(
      `INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [lockKey, locked ? 'true' : 'false']
    );
    res.json({ message: `Squad allocation ${locked ? 'locked' : 'unlocked'}.` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const notifyBatchSquads = async (req, res) => {
  assertManualAdminTrigger(req);
  const { id } = req.params;
  const { type } = req.body;
  try {
    // 1. Verify that squad allocation is completed/locked for this batch
    const lockKey = `batch_${id}_squads_locked`;
    const lockCheck = await pool.query("SELECT value FROM system_settings WHERE key = $1", [lockKey]);
    const isLocked = lockCheck.rowCount > 0 && lockCheck.rows[0].value === 'true';
    if (!isLocked) {
      return res.status(400).json({ message: 'Squad allocation must be locked/completed first.' });
    }

    if (type === 'email') {
      const studentsRes = await pool.query(
        `SELECT u.name, u.email, u.role, b.name as batch_name, b.start_date, b.end_date, bs.squad 
         FROM batch_students bs
         JOIN users u ON bs.student_id = u.id
         JOIN batches b ON bs.batch_id = b.id
         WHERE bs.batch_id = $1`,
        [id]
      );
      const facultyRes = await pool.query(
        `SELECT u.name, u.email, u.role, b.name as batch_name, b.start_date, b.end_date, bf.squad 
         FROM batch_faculty bf
         JOIN users u ON bf.faculty_id = u.id
         JOIN batches b ON bf.batch_id = b.id
         WHERE bf.batch_id = $1`,
        [id]
      );

      const students = studentsRes.rows;
      const faculty = facultyRes.rows;
      const allMembers = [...students, ...faculty];

      const failures = [];
      let successCount = 0;
      const portalLoginUrl = process.env.PORTAL_LOGIN_URL || (req.get('host') ? `${req.protocol}://${req.get('host')}/login` : 'http://13.207.119.57/login');

      for (const u of allMembers) {
        if (u.email) {
          const startDateStr = u.start_date ? new Date(u.start_date).toLocaleDateString() : 'N/A';
          const endDateStr = u.end_date ? new Date(u.end_date).toLocaleDateString() : 'N/A';
          const roleName = u.role === 'student' ? 'Student' : (u.role === 'ltc_member' ? 'LTC Member' : 'Faculty');
          const defaultPassword = u.role === 'student' ? 'student123' : (u.role === 'ltc_member' ? 'ltc123' : 'faculty123');

          const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
          <!-- Branded Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); background-color: #ea580c; padding: 36px 28px; text-align: center; color: #ffffff;">
              <div style="font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #ffedd5; margin-bottom: 8px;">
                MIT WORLD PEACE UNIVERSITY, PUNE
              </div>
              <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; line-height: 1.3; text-transform: uppercase;">
                LIFE AWAKENING PROGRAM (LAP)
              </h1>
              <div style="font-size: 14px; font-weight: 600; color: #fed7aa; letter-spacing: 0.3px;">
                Experiential Learning &amp; Transformation
              </div>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-top: 0;">Dear <strong>${u.name}</strong>,</p>
              <p style="font-size: 14.5px; line-height: 1.6; color: #334155;">We are excited to welcome you to <strong>${u.batch_name}</strong> and be a part of your transformative journey towards personal growth, awareness, and excellence.</p>
              
              <h3 style="color: #0f172a; margin-top: 24px; font-size: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Your Program Details</h3>
              <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; width: 140px; color: #475569; font-size: 13.5px;">Batch Name:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${u.batch_name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #475569; font-size: 13.5px;">Squad Assigned:</td>
                  <td style="padding: 6px 0; color: #c2410c; font-weight: bold; font-size: 14px;">${u.squad || 'Not Assigned'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #475569; font-size: 13.5px;">Start Date:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${startDateStr}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #475569; font-size: 13.5px;">End Date:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${endDateStr}</td>
                </tr>
              </table>

              <h3 style="color: #0f172a; margin-top: 24px; font-size: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Portal Installation Guide</h3>
              <p style="font-size: 14px; color: #475569; margin: 8px 0 12px 0;">Please watch the installation video for your device before accessing the portal:</p>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
                <div style="margin-bottom: 10px;">
                  <strong style="color: #0f172a; font-size: 13.5px;">📱 Android Users:</strong><br/>
                  <a href="https://youtube.com/shorts/E1JWTgeaidA?si=NotUiH9RHAn0_x6r" target="_blank" style="color: #ea580c; text-decoration: none; font-size: 13px; font-weight: 600;">Watch Android Installation Guide &rarr;</a>
                </div>
                <div>
                  <strong style="color: #0f172a; font-size: 13.5px;">🍎 iPhone (iOS) Users:</strong><br/>
                  <a href="https://youtube.com/shorts/d4ou4uwonho?si=lM3RZIayS0-k42r5" target="_blank" style="color: #ea580c; text-decoration: none; font-size: 13px; font-weight: 600;">Watch iOS Installation Guide &rarr;</a>
                </div>
              </div>

              <h3 style="color: #0f172a; margin-top: 24px; font-size: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Your Portal Login Credentials</h3>
              <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; width: 140px; color: #475569; font-size: 13.5px;">Role:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${roleName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #475569; font-size: 13.5px;">Login Email:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${u.email}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #475569; font-size: 13.5px;">Default Password:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-size: 14px; font-weight: bold;">${defaultPassword}</td>
                </tr>
              </table>
              
              <p style="margin-top: 16px; font-size: 13.5px; color: #475569; line-height: 1.6;">
                Please log in to your dashboard to complete your profile, submit your undertaking form, and review the initial program guidelines.<br/><br/>
                <strong style="color: #0f172a;">Need Assistance?</strong><br/>
                For any login-related issues, kindly contact our support team at <a href="mailto:ltcmitwpu@gmail.com" style="color: #ea580c; text-decoration: none; font-weight: 600;">ltcmitwpu@gmail.com</a>.<br/><br/>
                For personal information or profile-related queries, please raise a ticket through your dashboard for appropriate assistance.<br/><br/>
                Thank you for your cooperation.
              </p>

              <div style="text-align: center; margin: 24px 0 16px 0;">
                <a href="${portalLoginUrl}" target="_blank" style="background-color: #ea580c; color: #ffffff; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; font-size: 14px; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.25);">
                  Log In to Portal &rarr;
                </a>
              </div>
              
              <p style="margin-top: 20px; font-size: 14px; color: #475569;">Best regards,<br/><strong>Life Awakening Program (LAP) Administration</strong></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.5;">
              This is an official communication from <strong>Life Awakening Program (LAP) Administration</strong>.<br/>
              MIT World Peace University, Pune.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

          try {
            const { queueEmail } = require('../config/mailer');
            const subject = `Welcome to Life Awakening Program (LAP) - ${u.batch_name}`;
            const text = `Dear ${u.name},\n\nWelcome to the Life Awakening Program (LAP) as a ${roleName}!\n\nWe are excited to welcome you to ${u.batch_name} and be a part of your transformative journey towards personal growth, awareness, and excellence.\n\nProgram Details\n* Batch Name: ${u.batch_name}\n* Squad: ${u.squad || 'Not Assigned'}\n* Start Date: ${startDateStr}\n* End Date: ${endDateStr}\n\nPortal Installation Guide\nPlease watch the installation video for your device before accessing the portal:\n* Android Users: https://youtube.com/shorts/E1JWTgeaidA?si=NotUiH9RHAn0_x6r\n* iPhone (iOS) Users: https://youtube.com/shorts/d4ou4uwonho?si=lM3RZIayS0-k42r5\n\nPortal Credentials\n* Login URL: ${portalLoginUrl}\n* Email: ${u.email}\n* Password: ${defaultPassword}\n\nPlease log in to your dashboard to complete your profile, submit your undertaking form, and review the initial program guidelines.\n\nNeed Assistance?\nFor any login-related issues, kindly contact our support team at ltcmitwpu@gmail.com.\n\nFor personal information or profile-related queries, please raise a ticket through your dashboard for appropriate assistance.\n\nThank you for your cooperation.\n\nBest regards,\n\nLAP Administration`;
            const queued = await queueEmail(u.email, subject, text, html);
            if (queued) {
              successCount++;
            } else {
              failures.push({ email: u.email, name: u.name, error: 'Duplicate or queued email skipped' });
            }
          } catch (sendErr) {
            console.error(`Failed to queue welcome email to ${u.email}:`, sendErr.message);
            failures.push({ email: u.email, name: u.name, error: sendErr.message });
          }
        }
      }

      // Mark welcome emails as sent for this batch
      const welcomeKey = `batch_${id}_welcome_emails_sent`;
      await pool.query(
        `INSERT INTO system_settings (key, value) VALUES ($1, 'true') 
         ON CONFLICT (key) DO UPDATE SET value = 'true'`,
        [welcomeKey]
      );

      writeAudit(req.user.id, req.user.name || 'Admin', 'WELCOME_EMAILS_SENT', 'batch', parseInt(id), { recipient_count: successCount, failures: failures.length, triggerSource: 'MANUAL_ADMIN_ACTION' });

      res.json({
        message: `Successfully sent welcome emails to ${successCount} members. Failures: ${failures.length}.`,
        studentsCount: students.length,
        facultyCount: faculty.length,
        notifiedCount: successCount,
        failures
      });
    } else if (type === 'whatsapp') {
      const studentsRes = await pool.query(
        `SELECT u.name, u.email, u.phone, bs.squad FROM batch_students bs
         JOIN users u ON bs.student_id = u.id
         WHERE bs.batch_id = $1`,
        [id]
      );
      const facultyRes = await pool.query(
        `SELECT u.name, u.email, u.phone, bf.squad FROM batch_faculty bf
         JOIN users u ON bf.faculty_id = u.id
         WHERE bf.batch_id = $1`,
        [id]
      );

      const students = studentsRes.rows;
      const faculty = facultyRes.rows;
      let successCount = 0;

      for (const u of [...students, ...faculty]) {
        if (u.phone && u.squad) {
          console.log(`[WhatsApp Mock] Sending squad assignment notification to ${u.name} (${u.phone}): You are assigned to Squad ${u.squad}`);
          successCount++;
        }
      }

      res.json({
        message: `Successfully notified ${successCount} members via WHATSAPP.`,
        studentsCount: students.length,
        facultyCount: faculty.length,
        notifiedCount: successCount,
        failures: []
      });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getDashboard = async (req, res) => {
  try {
    const activeBatchRes = await pool.query(
      "SELECT id FROM batches WHERE status IN ('active', 'Immersion') AND is_deleted IS NOT TRUE LIMIT 1"
    );
    let allFaculties, allStudents;
    if (activeBatchRes.rowCount > 0) {
      const activeBatchId = activeBatchRes.rows[0].id;
      allFaculties = await pool.query(
        `SELECT u.id, u.name, u.email, u.department FROM users u
         JOIN batch_faculty bf ON u.id = bf.faculty_id
         WHERE bf.batch_id = $1`,
        [activeBatchId]
      );
      allStudents = await pool.query(
        `SELECT u.id, u.name, u.email, u.semester, u.department FROM users u
         JOIN batch_students bs ON u.id = bs.student_id
         WHERE bs.batch_id = $1`,
        [activeBatchId]
      );
    } else {
      allFaculties = await pool.query("SELECT id, name, email, department FROM users WHERE role = 'faculty'");
      allStudents = await pool.query(
        `SELECT id, name, email, semester, department FROM users 
         WHERE role = 'student'
           AND NOT (EXISTS (SELECT 1 FROM ri_batch_students rbs WHERE rbs.student_id = users.id AND rbs.source_program = 'RI_DIRECT') AND NOT EXISTS (SELECT 1 FROM batch_students bs WHERE bs.student_id = users.id))`
      );
    }
    res.json({ message: 'Welcome Admin', faculties: allFaculties.rows, students: allStudents.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const allUsers = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.base_role, u.department, u.semester,
             u.division, u.school, u.panel, u.is_primary, u.prn, u.faculty,
             u.personal_email, u.faculty_id, u.designation, u.gender,
             COALESCE(bs.squad, u.squad) as squad,
             COALESCE(bs.room, u.room) as room,
             COALESCE(bs.barcode, u.barcode) as barcode,
             u.in_current_batch,
             u.undertaking_submitted, u.undertaking_signed_name, u.undertaking_signed_date,
             COALESCE(bs.is_squad_leader, u.is_squad_leader) as is_squad_leader, u.phone,
             (i.prn IS NOT NULL) as insured, i.policy_number, i.provider,
             bs.batch_id as active_batch_id
      FROM users u
      LEFT JOIN insurance i ON u.prn = i.prn
      LEFT JOIN batch_students bs ON u.id = bs.student_id AND bs.batch_id = (
        SELECT id FROM batches WHERE status IN ('active', 'Immersion') AND is_deleted IS NOT TRUE LIMIT 1
      )
      WHERE u.role != 'student'
         OR NOT (
           EXISTS (SELECT 1 FROM ri_batch_students rbs WHERE rbs.student_id = u.id AND rbs.source_program = 'RI_DIRECT')
           AND NOT EXISTS (SELECT 1 FROM batch_students bs2 WHERE bs2.student_id = u.id)
         )
      ORDER BY u.id ASC
    `);
    const squadLeadersRes = await pool.query("SELECT * FROM squad_leaders");
    res.json({ users: allUsers.rows, squadLeaders: squadLeadersRes.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updatePanel = async (req, res) => {
  const { user_id, panel } = req.body;
  try {
    await pool.query("UPDATE users SET panel = $1 WHERE id = $2", [panel, user_id]);
    await createSystemNotification(
      user_id,
      'Panel Updated',
      `Your panel assignment has been updated to: "${panel || 'None'}" by an administrator.`,
      'info',
      req.user.id
    );
    res.json({ message: 'Panel updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateDivision = async (req, res) => {
  const { user_id, division } = req.body;
  try {
    await pool.query("UPDATE users SET division = $1 WHERE id = $2", [division || null, user_id]);
    try {
      const batchRes = await pool.query("SELECT batch_id FROM batch_students WHERE student_id = $1", [user_id]);
      const { syncLtcBatchToRiCore } = require('../services/riSyncService');
      for (const b of batchRes.rows) {
        await syncLtcBatchToRiCore(b.batch_id);
      }
    } catch (syncErr) {
      console.error(`[riSyncService] Error auto-syncing after updateDivision:`, syncErr);
    }
    await createSystemNotification(
      user_id,
      'Division Updated',
      `Your division assignment has been updated to: "${division || 'None'}" by an administrator.`,
      'info',
      req.user.id
    );
    res.json({ message: 'Division updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateInsurance = async (req, res) => {
  const { user_id, insurance } = req.body;
  try {
    const userRes = await pool.query("SELECT prn FROM users WHERE id = $1", [user_id]);
    if (userRes.rowCount === 0) return res.status(404).json({ message: 'User not found' });
    const prn = userRes.rows[0].prn;
    if (!prn) return res.status(400).json({ message: 'User has no PRN' });
    if (insurance) {
      await pool.query(
        "INSERT INTO insurance (prn, policy_number, provider) VALUES ($1, $2, $3) ON CONFLICT (prn) DO NOTHING",
        [prn, 'POLICY-' + user_id, 'LTC Provider']
      );
    } else {
      await pool.query("DELETE FROM insurance WHERE prn = $1", [prn]);
    }
    await createSystemNotification(
      user_id,
      'Insurance Details Updated',
      `Your insurance details have been updated to: ${insurance ? 'Insured' : 'Not Insured'} by an administrator.`,
      'info',
      req.user.id
    );
    res.json({ message: 'Insurance status updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const validateBulkUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const filePath = req.file.path;
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const parsedData = parseExcelSheetSmart(worksheet);

    // Detect template type
    let detectedTemplate = null;
    if (parsedData.length > 0) {
      detectedTemplate = detectTemplateType(Object.keys(parsedData[0]));
    }

    const isLtc = req.query.isLtc === 'true' || req.body.isLtc === 'true';

    if (detectedTemplate === 'life_awakening_student' && !isLtc) {
      const duplicates = [];
      const preview = [];
      const errors = [];
      let validCount = 0;
      let invalidCount = 0;

      const studentKeys = [];
      for (let i = 0; i < parsedData.length; i++) {
        const raw = parsedData[i];
        const rowNum = i + 2;
        if (!raw || typeof raw !== 'object') continue;
        const normalized = mapOfficialHeaders(raw);
        let nameVal = normalized.name || normalized.full_name || normalized.student_name;
        if (!nameVal) {
          const parts = [
            String(normalized.salutation || '').trim(),
            String(normalized.first_name || '').trim(),
            String(normalized.middle_name || '').trim(),
            String(normalized.last_name || '').trim(),
          ].filter(Boolean);
          if (parts.length > 0) nameVal = parts.join(' ');
        } else if (normalized.last_name && !nameVal.includes(normalized.last_name)) {
          nameVal = `${nameVal} ${normalized.last_name}`.trim();
        }

        const studentName = (nameVal || '').trim();
        const rawClass = normalized.class_grade || normalized._raw_class_grade;
        const canonicalClass = normalizeClassGrade(rawClass);

        const p1 = (normalized.parent_email_1 || (normalized.parent_email && !normalized.parent_email_2 ? normalized.parent_email : '') || normalized.email || '').toLowerCase().trim();
        const p2 = (normalized.parent_email_2 || (normalized.parent_email && normalized.parent_email !== p1 ? normalized.parent_email : '') || '').toLowerCase().trim();

        const rowErrors = [];
        if (!studentName) rowErrors.push('Missing Student Name');
        if (!canonicalClass) rowErrors.push(`Invalid Class / Standard: "${rawClass || 'empty'}"`);
        if (!p1 && !p2) rowErrors.push('Missing parent email (Email Address1 or 2 required)');

        if (rowErrors.length > 0) {
          invalidCount++;
          errors.push({ row: studentName || `Row ${rowNum}`, error: rowErrors.join('; ') });
        } else {
          validCount++;
        }

        if (preview.length < 10) {
          preview.push({
            name: studentName,
            class_grade: canonicalClass || rawClass,
            school: normalized.school,
            school_branch: normalized.school_branch,
            division: normalized.division,
            parent_email_1: p1,
            parent_email_2: p2,
            phone: normalized.phone || normalized.parent_mobile,
            payment_status: normalized.payment_status || 'pending'
          });
        }

        if (studentName && canonicalClass) {
          studentKeys.push({ name: studentName, class_grade: canonicalClass, rawRow: normalized });
        }
      }

      const rawBatch = req.query.batchId || req.body.batchId;
      let targetBatchId = null;
      if (rawBatch) {
        const str = typeof rawBatch === 'object' ? (rawBatch.id || '') : String(rawBatch).trim();
        if (str && str !== '[object Object]') {
          const num = parseInt(str, 10);
          if (!isNaN(num) && num > 0) targetBatchId = num;
        }
      }

      if (studentKeys.length > 0) {
        const names = studentKeys.map(k => k.name.toLowerCase());
        const dbRes = await pool.query(
          `SELECT u.id, u.name, u.class_grade, u.school,
                  (SELECT json_build_object('id', b.id, 'name', b.name)
                   FROM batch_students bs
                   JOIN batches b ON b.id = bs.batch_id AND (b.is_deleted = false OR b.is_deleted IS NULL)
                   WHERE bs.student_id = u.id
                   LIMIT 1) as current_batch
           FROM users u WHERE role = 'student' AND LOWER(TRIM(name)) = ANY($1)`,
          [names]
        );
        for (const sk of studentKeys) {
          const matched = dbRes.rows.find(u =>
            u.name.toLowerCase().trim() === sk.name.toLowerCase().trim() &&
            (u.class_grade === sk.class_grade || !u.class_grade)
          );
          if (matched) {
            if (targetBatchId && matched.current_batch && matched.current_batch.id !== targetBatchId) {
              errors.push({
                row: sk.name,
                error: `Student already belongs to "${matched.current_batch.name}" (Batch #${matched.current_batch.id}). Cannot be assigned to another batch.`
              });
              invalidCount++;
              validCount = Math.max(0, validCount - 1);
            }
            duplicates.push({
              uploadRecord: {
                name: sk.name,
                class_grade: sk.class_grade,
                school: sk.rawRow.school,
                parent_email_1: sk.rawRow.parent_email_1,
                parent_email_2: sk.rawRow.parent_email_2,
                role: 'student'
              },
              existingRecord: {
                name: matched.name,
                class_grade: matched.class_grade,
                school: matched.school,
                role: 'student'
              }
            });
          }
        }
      }

      return res.json({
        isLifeAwakening: true,
        duplicates,
        preview,
        total: parsedData.length,
        validCount,
        invalidCount,
        errors
      });
    }

    const emails = [];
    const prns = [];
    const facultyIds = [];
    const rowsToValidate = [];

    for (const r of parsedData) {
      if (!r || typeof r !== 'object') continue;

      const normalized = mapOfficialHeaders(r);

      const prn = String(
        normalized._prn_raw || normalized.prn || normalized['student id'] || normalized.student_id || ''
      ).trim();
      const email = String(normalized.email || '').trim().toLowerCase();
      const facultyId = String(
        normalized._faculty_id_raw || normalized.faculty_id || normalized['faculty id'] || ''
      ).trim();
      let role = String(normalized.role || '').toLowerCase().trim();
      // Normalize human-readable role variants
      if (role === 'ltc member') role = 'ltc_member';
      if (role === 'faculty member') role = 'faculty';
      const isLtc = req.query.isLtc === 'true' || req.body.isLtc === 'true';
      if (isLtc) {
        role = 'ltc_member';
      } else {
        if (!role && detectedTemplate) role = detectedTemplate;
        if (!role && prn) role = 'student';
        if (!role && facultyId) role = 'faculty';
      }

      const isFaculty = role === 'faculty' || role === 'ltc_member' || (!prn && facultyId);

      // Reconstruct name if missing or combine if surname/last_name exists
      let nameVal = normalized.name || normalized.full_name || normalized.student_name;
      if (!nameVal) {
        const parts = [
          String(normalized.salutation || '').trim(),
          String(normalized.first_name || '').trim(),
          String(normalized.middle_name || '').trim(),
          String(normalized.last_name || '').trim(),
        ].filter(Boolean);
        if (parts.length > 0) nameVal = parts.join(' ');
      } else if (normalized.last_name) {
        nameVal = `${nameVal} ${normalized.last_name}`.trim();
      }
      normalized.name = nameVal;

      const resolvedEmail = email || (prn ? `${prn.replace(/\s+/g, '').toLowerCase()}@ltc.edu` : null);

      normalized._isFaculty = isFaculty;
      normalized._prn = prn || null;
      normalized._email = resolvedEmail || null;
      normalized._facultyId = facultyId || null;
      normalized._role = role === 'ltc_member' ? 'ltc_member' : (isFaculty ? 'faculty' : 'student');
      rowsToValidate.push(normalized);

      if (normalized._email) emails.push(normalized._email);
      if (normalized._prn) prns.push(normalized._prn);
      if (normalized._facultyId) facultyIds.push(normalized._facultyId);
    }

    let existingUsers = [];
    if (emails.length > 0 || prns.length > 0 || facultyIds.length > 0) {
      const dbRes = await pool.query(
        `SELECT id, email, prn, faculty_id, role, name FROM users
         WHERE (email IS NOT NULL AND email = ANY($1)) 
            OR (prn IS NOT NULL AND prn = ANY($2)) 
            OR (faculty_id IS NOT NULL AND faculty_id = ANY($3))`,
        [emails, prns, facultyIds]
      );
      existingUsers = dbRes.rows;
    }

    const duplicates = [];
    for (const normalized of rowsToValidate) {
      const prn = normalized._prn;
      const email = normalized._email;
      const facultyId = normalized._facultyId;

      let matched = existingUsers.find(u =>
        (email && u.email && u.email.toLowerCase() === email.toLowerCase()) ||
        (prn && u.prn && u.prn === prn) ||
        (facultyId && u.faculty_id && u.faculty_id === facultyId)
      );

      if (matched) {
        duplicates.push({
          uploadRecord: {
            name: normalized.name || normalized.full_name || normalized.student_name || 'Unknown',
            email: email || null,
            prn: prn || null,
            faculty_id: facultyId || null,
            role: normalized._role
          },
          existingRecord: {
            name: matched.name,
            email: matched.email,
            prn: matched.prn,
            faculty_id: matched.faculty_id,
            role: matched.role
          }
        });
      }
    }

    res.json({ duplicates });
  } catch (err) {
    res.status(500).json({ message: 'Server error during validation', error: err.message });
  } finally {
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error("Failed to delete temp validation file:", unlinkErr);
      }
    }
  }
};

const globalBulkUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const { duplicateAction } = req.body;
  const isLtc = req.query.isLtc === 'true' || req.body.isLtc === 'true';
  const rawBatchId = req.body.batchId || req.query.batchId || null;

  let parsedBatchId = null;
  if (rawBatchId) {
    const str = typeof rawBatchId === 'object' ? (rawBatchId.id || '') : String(rawBatchId).trim();
    if (str && str !== '[object Object]') {
      const num = parseInt(str, 10);
      if (!isNaN(num) && num > 0) {
        parsedBatchId = num;
      }
    }
  }

  // Require target batch selection before uploading school students
  if (!isLtc && !parsedBatchId) {
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) { }
    }
    return res.status(400).json({ 
      message: (rawBatchId && (String(rawBatchId) === '[object Object]' || isNaN(parseInt(rawBatchId, 10))))
        ? 'Invalid target batch ID provided.' 
        : 'Please select a target batch before uploading school students.' 
    });
  }

  let targetBatchId = null;
  try {
    if (parsedBatchId) {
      const bCheck = await pool.query("SELECT id, name, capacity FROM batches WHERE id = $1 AND is_deleted IS NOT TRUE", [parsedBatchId]);
      if (bCheck.rowCount === 0) {
        if (req.file && req.file.path) {
          try { fs.unlinkSync(req.file.path); } catch (_) { }
        }
        return res.status(404).json({ message: 'Selected target batch does not exist.' });
      }
      targetBatchId = bCheck.rows[0].id;
    }

    const jobRes = await pool.query(
      `INSERT INTO upload_jobs (batch_id, filename, status, total_records)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [targetBatchId, req.file.originalname || 'Global Master Ingestion', 'pending', 0]
    );
    const jobId = jobRes.rows[0].id;

    setImmediate(() => {
      processUploadJobInBackground(jobId, req.file.path, targetBatchId, false, req.user.id, req.user.name || 'Admin', duplicateAction || 'replace', isLtc);
    });

    res.json({ jobId, batchId: targetBatchId, message: 'Bulk upload started in the background.' });
  } catch (err) {
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) { }
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── User Profile (all extended fields) ─────────────────────────────────────
const getUserProfile = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, department, semester, division, school, panel, faculty,
              is_primary, prn, faculty_id, phone, dob, gender, program, year,
              designation, status, nri, red_flag,
              undertaking_submitted, undertaking_signed_name, undertaking_signed_date,
              salutation, first_name, middle_name, last_name, age, nationality,
              aadhar_no, nominee_name, nominee_relationship, nominee_email,
              address, roll_number, lateral_entry, parent_mobile, parent_email, personal_email,
              school_branch, class_grade, has_medical_condition, payment_screenshot_url,
              payment_status, payment_verified_at, payment_verified_by, digital_signature_url,
              parent_consent_text, parent_consent_confirmed, blood_group, known_allergies,
              medical_conditions, emergency_contact_alt_mobile
       FROM users WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
    const user = result.rows[0];
    if (user.role === 'student') {
      user.internal_email = user.email;
      if (user.email && user.email.toLowerCase().endsWith('@lifeawakening.internal')) {
        user.email = (user.personal_email && !user.personal_email.toLowerCase().endsWith('@lifeawakening.internal')) ? user.personal_email : null;
      }
      // Linked parent / guardian accounts (Life Awakening). Safe columns only — never password hashes.
      const parentsRes = await pool.query(
        `SELECT p.id, p.name, p.email, p.phone, ps.relationship, ps.is_primary
         FROM parent_students ps
         JOIN users p ON p.id = ps.parent_id
         WHERE ps.student_id = $1
         ORDER BY ps.is_primary DESC NULLS LAST, ps.created_at ASC NULLS LAST, p.id ASC`,
        [id]
      );
      user.parents = parentsRes.rows;
      user.parent1_email = parentsRes.rows[0]?.email || user.parent_email || '';
      user.parent2_email = parentsRes.rows[1]?.email || '';
      user.student_display_id = `LA-${String(user.id).padStart(5, '0')}`;
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateUserProfile = async (req, res) => {
  const { id } = req.params;
  const {
    password, is_primary, nri, red_flag, lateral_entry, age, aadhar_no
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query("SELECT id, email, role, phone, name FROM users WHERE id = $1 FOR UPDATE", [id]);
    if (userRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found' });
    }

    const studentRecord = userRes.rows[0];

    // If email is updated, validate and check for duplicate
    let cleanEmail = undefined;
    if (req.body.email !== undefined) {
      if (req.body.email === null || String(req.body.email).trim() === '') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Email address cannot be empty.' });
      }
      cleanEmail = String(req.body.email).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Invalid email format: "${cleanEmail}"` });
      }
      const dupCheck = await client.query("SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2", [cleanEmail, id]);
      if (dupCheck.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Email is already in use by another user.' });
      }
    }

    // ── Dedicated Life Awakening Parent Email Updates ──
    if (studentRecord.role === 'student' && (req.body.parent1_email !== undefined || req.body.parent2_email !== undefined || req.body.parent_email !== undefined)) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const defaultParentHash = await bcrypt.hash('student123', 10);
      const studentPhone = studentRecord.phone || req.body.phone || req.body.parent_mobile || null;
      const studentEmail = (cleanEmail !== undefined ? cleanEmail : studentRecord.email || '').toLowerCase().trim();

      let p1Input = req.body.parent1_email !== undefined ? req.body.parent1_email : req.body.parent_email;
      let p2Input = req.body.parent2_email;

      let p1Clean = (p1Input !== undefined && p1Input !== null) ? String(p1Input).trim().toLowerCase() : undefined;
      let p2Clean = (p2Input !== undefined && p2Input !== null) ? String(p2Input).trim().toLowerCase() : undefined;

      if (p1Clean !== undefined && p1Clean !== '' && !emailRegex.test(p1Clean)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Invalid Parent 1 email format: "${p1Clean}"` });
      }
      if (p2Clean !== undefined && p2Clean !== '' && !emailRegex.test(p2Clean)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Invalid Parent 2 email format: "${p2Clean}"` });
      }

      if (p1Clean && p2Clean && p1Clean === p2Clean) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Parent 1 and Parent 2 cannot have the same email address.' });
      }

      if ((p1Clean && p1Clean === studentEmail) || (p2Clean && p2Clean === studentEmail)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Parent email cannot be the same as the student email address.' });
      }

      // Fetch current linked parents for this student
      const currParentsRes = await client.query(
        `SELECT ps.parent_id, ps.is_primary, ps.relationship, p.email
         FROM parent_students ps
         JOIN users p ON p.id = ps.parent_id
         WHERE ps.student_id = $1
         ORDER BY ps.is_primary DESC NULLS LAST, ps.created_at ASC NULLS LAST, p.id ASC`,
        [id]
      );

      // Distinguish current Parent 1 (primary or first) and Parent 2 (secondary or second)
      let currP1 = null;
      let currP2 = null;
      if (currParentsRes.rows.length === 1) {
        currP1 = currParentsRes.rows[0];
      } else if (currParentsRes.rows.length >= 2) {
        const prim = currParentsRes.rows.find(r => r.is_primary);
        if (prim) {
          currP1 = prim;
          currP2 = currParentsRes.rows.find(r => r.parent_id !== prim.parent_id) || currParentsRes.rows[1];
        } else {
          currP1 = currParentsRes.rows[0];
          currP2 = currParentsRes.rows[1];
        }
      }

      let targetP1Id = currP1 ? currP1.parent_id : null;

      // ── Process Parent 1 ──
      if (p1Clean !== undefined) {
        if (!p1Clean) {
          if (currP1) {
            await client.query('DELETE FROM parent_students WHERE student_id = $1 AND parent_id = $2', [id, currP1.parent_id]);
            targetP1Id = null;
          }
        } else if (!currP1 || currP1.email.toLowerCase() !== p1Clean) {
          const existingUserRes = await client.query('SELECT id, role FROM users WHERE LOWER(TRIM(email)) = $1', [p1Clean]);
          if (existingUserRes.rowCount > 0) {
            targetP1Id = existingUserRes.rows[0].id;
            if (currP1 && currP1.parent_id !== targetP1Id) {
              await client.query('DELETE FROM parent_students WHERE student_id = $1 AND parent_id = $2', [id, currP1.parent_id]);
            }
          } else {
            // No user exists with this email
            if (currP1) {
              // Check if currP1 is shared with other children
              const sharedCheck = await client.query(
                'SELECT count(*) FROM parent_students WHERE parent_id = $1 AND student_id != $2',
                [currP1.parent_id, id]
              );
              const isShared = parseInt(sharedCheck.rows[0].count, 10) > 0;
              if (isShared) {
                // Do not modify the shared user record! Unlink and create a separate parent user
                await client.query('DELETE FROM parent_students WHERE student_id = $1 AND parent_id = $2', [id, currP1.parent_id]);
                const newPRes = await client.query(
                  `INSERT INTO users (name, email, password, role, phone, status)
                   VALUES ($1, $2, $3, 'parent', $4, 'active')
                   RETURNING id`,
                  ['Parent / Guardian', p1Clean, defaultParentHash, studentPhone]
                );
                targetP1Id = newPRes.rows[0].id;
              } else {
                // Sole parent account: safe to update email in place, preserving password and ID
                await client.query('UPDATE users SET email = $1 WHERE id = $2', [p1Clean, currP1.parent_id]);
                targetP1Id = currP1.parent_id;
              }
            } else {
              const newPRes = await client.query(
                `INSERT INTO users (name, email, password, role, phone, status)
                 VALUES ($1, $2, $3, 'parent', $4, 'active')
                 RETURNING id`,
                ['Parent / Guardian', p1Clean, defaultParentHash, studentPhone]
              );
              targetP1Id = newPRes.rows[0].id;
            }
          }

          if (targetP1Id) {
            await client.query(
              `INSERT INTO parent_students (parent_id, student_id, relationship, is_primary)
               VALUES ($1, $2, 'Parent', true)
               ON CONFLICT (parent_id, student_id) DO UPDATE SET is_primary = true, relationship = 'Parent'`,
              [targetP1Id, id]
            );
          }
        } else {
          // Email unchanged, ensure is_primary = true
          await client.query(
            `UPDATE parent_students SET is_primary = true WHERE parent_id = $1 AND student_id = $2`,
            [currP1.parent_id, id]
          );
        }

        req.body.parent_email = p1Clean || null;
      }

      // ── Process Parent 2 ──
      if (p2Clean !== undefined) {
        // Find remaining parent linked to this student that is not targetP1Id
        const remainingP2Res = await client.query(
          `SELECT ps.parent_id, ps.relationship, p.email
           FROM parent_students ps
           JOIN users p ON p.id = ps.parent_id
           WHERE ps.student_id = $1 AND ps.parent_id != $2`,
          [id, targetP1Id || 0]
        );
        currP2 = remainingP2Res.rows[0] || null;

        if (!p2Clean) {
          if (currP2) {
            await client.query('DELETE FROM parent_students WHERE student_id = $1 AND parent_id = $2', [id, currP2.parent_id]);
          }
        } else if (!currP2 || currP2.email.toLowerCase() !== p2Clean) {
          const existingUserRes = await client.query('SELECT id, role FROM users WHERE LOWER(TRIM(email)) = $1', [p2Clean]);
          let targetP2Id;
          if (existingUserRes.rowCount > 0) {
            targetP2Id = existingUserRes.rows[0].id;
            if (currP2 && currP2.parent_id !== targetP2Id) {
              await client.query('DELETE FROM parent_students WHERE student_id = $1 AND parent_id = $2', [id, currP2.parent_id]);
            }
          } else {
            // No user exists with this email
            if (currP2) {
              // Check if currP2 is shared with other children
              const sharedCheck = await client.query(
                'SELECT count(*) FROM parent_students WHERE parent_id = $1 AND student_id != $2',
                [currP2.parent_id, id]
              );
              const isShared = parseInt(sharedCheck.rows[0].count, 10) > 0;
              if (isShared) {
                // Do not modify the shared user record! Unlink and create a separate parent user
                await client.query('DELETE FROM parent_students WHERE student_id = $1 AND parent_id = $2', [id, currP2.parent_id]);
                const newPRes = await client.query(
                  `INSERT INTO users (name, email, password, role, phone, status)
                   VALUES ($1, $2, $3, 'parent', $4, 'active')
                   RETURNING id`,
                  ['Secondary Parent', p2Clean, defaultParentHash, studentPhone]
                );
                targetP2Id = newPRes.rows[0].id;
              } else {
                // Sole parent account: safe to update email in place
                await client.query('UPDATE users SET email = $1 WHERE id = $2', [p2Clean, currP2.parent_id]);
                targetP2Id = currP2.parent_id;
              }
            } else {
              const newPRes = await client.query(
                `INSERT INTO users (name, email, password, role, phone, status)
                 VALUES ($1, $2, $3, 'parent', $4, 'active')
                 RETURNING id`,
                ['Secondary Parent', p2Clean, defaultParentHash, studentPhone]
              );
              targetP2Id = newPRes.rows[0].id;
            }
          }

          if (targetP2Id) {
            await client.query(
              `INSERT INTO parent_students (parent_id, student_id, relationship, is_primary)
               VALUES ($1, $2, 'Secondary Parent', false)
               ON CONFLICT (parent_id, student_id) DO UPDATE SET is_primary = false, relationship = 'Secondary Parent'`,
              [targetP2Id, id]
            );
          }
        } else {
          // Email unchanged, ensure is_primary = false
          await client.query(
            `UPDATE parent_students SET is_primary = false WHERE parent_id = $1 AND student_id = $2`,
            [currP2.parent_id, id]
          );
        }
      }
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (password && String(password).trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push(`password = $${idx++}`);
      params.push(hashedPassword);
    }

    const textFields = [
      'status', 'name', 'personal_email', 'faculty_id', 'phone', 'gender', 'designation',
      'department', 'division', 'school', 'panel', 'prn', 'dob', 'semester', 'program', 'year', 'faculty',
      'salutation', 'first_name', 'middle_name', 'last_name', 'nationality',
      'nominee_name', 'nominee_relationship', 'nominee_email', 'address', 'roll_number',
      'parent_mobile', 'parent_email', 'squad', 'room', 'barcode', 'tshirt_size',
      'jain_food', 'monday_fast',
      'emergency_contact_name', 'emergency_contact_mobile', 'emergency_contact_relation',
      'emergency_contact_alt_mobile', 'blood_group', 'medical_conditions', 'known_allergies',
      'school_branch', 'class_grade', 'has_medical_condition', 'payment_screenshot_url',
      'payment_status', 'digital_signature_url', 'parent_consent_text'
    ];

    if (cleanEmail !== undefined) {
      updates.push(`email = $${idx++}`);
      params.push(cleanEmail);
    }

    for (const f of textFields) {
      if (req.body[f] !== undefined) {
        let val = req.body[f];
        if (typeof val === 'string') {
          val = val.trim();
          if (f === 'personal_email' || f === 'nominee_email' || f === 'parent_email') {
            val = val.toLowerCase();
          }
        }
        updates.push(`${f} = $${idx++}`);
        params.push(val === '' ? null : val);
      }
    }

    if (req.body.parent_consent_confirmed !== undefined) {
      updates.push(`parent_consent_confirmed = $${idx++}`);
      params.push(req.body.parent_consent_confirmed === 'true' || req.body.parent_consent_confirmed === true);
    }

    if (req.body.payment_status === 'verified') {
      updates.push(`payment_verified_at = NOW()`);
      updates.push(`payment_verified_by = $${idx++}`);
      params.push(req.user.id);
    }

    if (is_primary !== undefined) {
      updates.push(`is_primary = $${idx++}`);
      params.push(is_primary === 'true' || is_primary === true);
    }
    if (nri !== undefined) {
      updates.push(`nri = $${idx++}`);
      params.push(nri === 'true' || nri === true);
    }
    if (red_flag !== undefined) {
      updates.push(`red_flag = $${idx++}`);
      params.push(red_flag === 'true' || red_flag === true);
    }
    if (lateral_entry !== undefined) {
      updates.push(`lateral_entry = $${idx++}`);
      params.push(lateral_entry === 'true' || lateral_entry === true);
    }
    if (age !== undefined) {
      updates.push(`age = $${idx++}`);
      params.push(age === '' ? null : parseInt(age, 10));
    }
    if (aadhar_no !== undefined) {
      updates.push(`aadhar_no = $${idx++}`);
      params.push(aadhar_no === '' ? null : aadhar_no);
    }

    let updatedFieldsList = [];
    if (updates.length > 0) {
      params.push(id);
      await client.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`,
        params
      );

      if (password && String(password).trim() !== '') updatedFieldsList.push('Password');
      if (req.body.status !== undefined) updatedFieldsList.push('Status');
      if (req.body.name !== undefined) updatedFieldsList.push('Name');
      if (cleanEmail !== undefined) updatedFieldsList.push('Email');
      if (req.body.personal_email !== undefined) updatedFieldsList.push('Personal Email');
      if (req.body.phone !== undefined) updatedFieldsList.push('Phone');
      if (req.body.gender !== undefined) updatedFieldsList.push('Gender');
      if (req.body.tshirt_size !== undefined) updatedFieldsList.push('T-Shirt Size');
      if (req.body.jain_food !== undefined) updatedFieldsList.push('Jain Food Required');
      if (req.body.monday_fast !== undefined) updatedFieldsList.push('Monday Fast');
      if (req.body.emergency_contact_name !== undefined) updatedFieldsList.push('Emergency Contact Name');
      if (req.body.emergency_contact_mobile !== undefined) updatedFieldsList.push('Emergency Contact Mobile');
      if (req.body.emergency_contact_relation !== undefined) updatedFieldsList.push('Emergency Contact Relation');
      if (req.body.blood_group !== undefined) updatedFieldsList.push('Blood Group');
      if (req.body.medical_conditions !== undefined) updatedFieldsList.push('Medical Conditions');
    }

    await client.query('COMMIT');

    if (updatedFieldsList.length > 0) {
      await createSystemNotification(
        id,
        'Profile Updated by Administrator',
        `Your profile details (${updatedFieldsList.join(', ')}) have been updated by an administrator.`,
        'info',
        req.user.id
      ).catch(err => console.error('[createSystemNotification Error in updateUserProfile]', err.message));
    }

    res.json({ message: 'User profile updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      if (err.detail && err.detail.includes('email')) {
        return res.status(400).json({ message: 'Email is already in use by another user.' });
      }
      if (err.detail && err.detail.includes('faculty_id')) {
        return res.status(400).json({ message: 'Employee ID is already in use by another user.' });
      }
    }
    res.status(500).json({ message: 'Server error during profile update', error: err.message });
  } finally {
    client.release();
  }
};

const getUploadJobStatus = async (req, res) => {
  const { jobId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, batch_id, filename, status, total_records, processed_records, success_count, failed_count, errors, created_at, updated_at
       FROM upload_jobs WHERE id = $1`,
      [jobId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Job not found' });
    res.json({ job: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const autoAllocateRoomsSquads = async (req, res) => {
  try {
    const studentsRes = await pool.query("SELECT id, gender FROM users WHERE role = 'student'");
    let students = studentsRes.rows.sort(() => Math.random() - 0.5);
    let currentRoomMale = 1, roomMaleCount = 0;
    let currentRoomFemale = 1, roomFemaleCount = 0;
    let currentRoomUnans = 1, roomUnansCount = 0;
    let currentSquad = 1, squadCount = 0;
    const updatePromises = [];
    for (const s of students) {
      if (squadCount >= 60) { currentSquad++; squadCount = 0; }
      const squadName = SQUAD_NAMES[(currentSquad - 1) % 10];
      squadCount++;
      let roomName = '';
      if (s.gender && s.gender.toLowerCase() === 'male') {
        if (roomMaleCount >= 40) { currentRoomMale++; roomMaleCount = 0; }
        roomName = `M-${currentRoomMale}`; roomMaleCount++;
      } else if (s.gender && s.gender.toLowerCase() === 'female') {
        if (roomFemaleCount >= 40) { currentRoomFemale++; roomFemaleCount = 0; }
        roomName = `F-${currentRoomFemale}`; roomFemaleCount++;
      } else {
        if (roomUnansCount >= 40) { currentRoomUnans++; roomUnansCount = 0; }
        roomName = `U-${currentRoomUnans}`; roomUnansCount++;
      }
      const barcode = `LTC-${s.id}-${Math.floor(Math.random() * 10000)}`;
      updatePromises.push(
        pool.query("UPDATE users SET squad = $1, room = $2, barcode = $3 WHERE id = $4", [squadName, roomName, barcode, s.id])
      );
    }
    await Promise.all(updatePromises);
    res.json({ message: `Allocated ${students.length} students.` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const bulkInsurance = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const filePath = req.file.path;
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    const results = [];
    const errors = [];

    // Process in batches of 250 in transactions
    const CHUNK_SIZE = 250;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const rawRow of chunk) {
          const item = {};
          // Normalize keys
          for (const key in rawRow) {
            item[key.replace(/^\uFEFF/, '').toLowerCase().trim().replace(/['"`]+/g, '')] = rawRow[key];
          }

          const prn = String(item.prn || item.prn_no || item.prn_number || '').trim();
          const policyNumber = String(item.policy_number || item.policy || '').trim();
          const provider = String(item.provider || '').trim();

          if (!prn) {
            errors.push({ prn: 'Row ' + (i + chunk.indexOf(rawRow) + 2), error: 'Missing PRN' });
            continue;
          }

          await client.query(
            "INSERT INTO insurance (prn, policy_number, provider) VALUES ($1, $2, $3) ON CONFLICT (prn) DO UPDATE SET policy_number = EXCLUDED.policy_number, provider = EXCLUDED.provider",
            [prn, policyNumber || 'POLICY-BULK', provider || 'LTC Provider']
          );
          results.push(prn);
        }
        await client.query('COMMIT');
      } catch (chunkErr) {
        await client.query('ROLLBACK');
        console.error(`Error processing insurance chunk at index ${i}:`, chunkErr);
        for (const rawRow of chunk) {
          errors.push({ prn: rawRow.prn || rawRow.PRN || 'Chunk', error: `Batch insert rollback: ${chunkErr.message}` });
        }
      } finally {
        client.release();
      }
    }

    res.status(201).json({ message: `Processed ${results.length} insurance records.`, results, errors });
  } catch (err) {
    res.status(500).json({ message: 'Server error during insurance upload', error: err.message });
  } finally {
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) { }
    }
  }
};

const getUserByBarcode = async (req, res) => {
  const { barcode } = req.query;
  try {
    const user = await pool.query(
      "SELECT id, name, email, role, department, division, school, panel, squad, room, barcode FROM users WHERE barcode = $1",
      [barcode]
    );
    if (user.rowCount === 0) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: user.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getFeedback = async (req, res) => {
  const { user_id, id, category, role, include_text, all } = req.query;
  try {
    // 1. Single-user detail view (e.g. from AdminDashboard modal) or single record by ID:
    // Return complete records including full survey/feedback text.
    if (user_id || id) {
      let query = `SELECT f.*, u.name, u.email FROM feedback f JOIN users u ON f.user_id = u.id`;
      const params = [];
      if (id) {
        query += ` WHERE f.id = $1`;
        params.push(id);
      } else {
        query += ` WHERE f.user_id = $1`;
        params.push(user_id);
      }
      if (category) {
        query += ` AND f.category = $${params.length + 1}`;
        params.push(category);
      }
      query += ` ORDER BY f.created_at DESC`;
      const feedback = await pool.query(query, params);
      return res.json({ feedback: feedback.rows, total: feedback.rowCount });
    }

    // 2. Unbounded export request if explicitly flagged
    if (all === 'true') {
      let query = `
        SELECT f.id, f.user_id, f.role, f.category, f.additional_notes, f.created_at,
               u.name, u.email
               ${include_text === 'true' ? ', f.feedback_text' : ''}
        FROM feedback f
        JOIN users u ON f.user_id = u.id
      `;
      const params = [];
      const whereClauses = [];
      if (category) {
        whereClauses.push(`f.category = $${params.length + 1}`);
        params.push(category);
      }
      if (role) {
        whereClauses.push(`f.role = $${params.length + 1}`);
        params.push(role);
      }
      if (whereClauses.length > 0) {
        query += ` WHERE ` + whereClauses.join(' AND ');
      }
      query += ` ORDER BY f.created_at DESC`;
      const feedback = await pool.query(query, params);
      return res.json({ feedback: feedback.rows, total: feedback.rowCount });
    }

    // 3. Paginated list view (default page size 50)
    // Avoid transmitting ~14 MB unparsed JSON text unless specifically requested
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const params = [];
    const whereClauses = [];
    if (category) {
      whereClauses.push(`f.category = $${params.length + 1}`);
      params.push(category);
    }
    if (role) {
      whereClauses.push(`f.role = $${params.length + 1}`);
      params.push(role);
    }
    const whereSql = whereClauses.length > 0 ? ` WHERE ` + whereClauses.join(' AND ') : '';

    const countRes = await pool.query(`SELECT COUNT(*) as total FROM feedback f ${whereSql}`, params);
    const total = parseInt(countRes.rows[0]?.total || 0, 10);

    const dataParams = [...params, limit, offset];
    const dataSql = `
      SELECT f.id, f.user_id, f.role, f.category, f.additional_notes, f.created_at,
             u.name, u.email,
             (f.feedback_text IS NOT NULL AND length(f.feedback_text) > 0) as has_feedback_text
             ${include_text === 'true' ? ', f.feedback_text' : ''}
      FROM feedback f
      JOIN users u ON f.user_id = u.id
      ${whereSql}
      ORDER BY f.created_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const feedback = await pool.query(dataSql, dataParams);
    res.json({
      feedback: feedback.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getAuditLogs = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const action = req.query.action || '';
  const search = req.query.search || '';
  const division = req.query.division || '';
  const faculty = req.query.faculty || '';
  const school = req.query.school || '';
  const department = req.query.department || '';

  try {
    // Keep audit logs trimmed strictly to latest 100
    await pool.query(
      `DELETE FROM audit_logs 
       WHERE id NOT IN (
         SELECT id FROM audit_logs 
         ORDER BY created_at DESC, id DESC 
         LIMIT 100
       )`
    );
    let whereClause = `WHERE (a.entity_type IS NULL OR a.entity_type NOT IN ('ri_module', 'ri_superadmin_module', 'ri_faculty', 'ri_student'))
      AND (a.action NOT LIKE 'RI_%')
      AND (a.user_name NOT ILIKE '%RI Admin%' AND a.user_name NOT ILIKE '%RI Super Admin%')
      AND (u.role IS NULL OR (u.role NOT IN ('ri_admin', 'superadmin-ri', 'superadmin_ri_readonly', 'superadmin-ri-readonly', 'ri_faculty', 'ri_student', 'ri_nodal_officer') AND u.role NOT LIKE 'ri_%'))
      AND (a.details::text NOT ILIKE '%@ri.edu.in%' AND a.details::text NOT ILIKE '%@ri.edu%' AND a.details::text NOT ILIKE '%riadmin%' AND a.details::text NOT ILIKE '%RI Portal%' AND a.details::text NOT ILIKE '%RI Faculty%')`;
    const params = [];
    let paramIdx = 1;

    if (action) {
      whereClause += ` AND a.action = $${paramIdx}`;
      params.push(action);
      paramIdx++;
    }
    if (search) {
      whereClause += ` AND (a.user_name ILIKE $${paramIdx} OR a.details ILIKE $${paramIdx} OR a.entity_type ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (division) {
      if (division === 'UNASSIGNED') {
        whereClause += ` AND (u.division IS NULL OR u.division = '' OR LOWER(TRIM(u.division)) IN ('unassigned', 'n/a', 'none', '-'))`;
      } else {
        whereClause += ` AND u.division = $${paramIdx}`;
        params.push(division);
        paramIdx++;
      }
    }
    if (faculty) {
      whereClause += ` AND u.faculty = $${paramIdx}`;
      params.push(faculty);
      paramIdx++;
    }
    if (school) {
      whereClause += ` AND u.school = $${paramIdx}`;
      params.push(school);
      paramIdx++;
    }
    if (department) {
      whereClause += ` AND u.department = $${paramIdx}`;
      params.push(department);
      paramIdx++;
    }

    const countRes = await pool.query(`SELECT COUNT(*) FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await pool.query(
      `SELECT a.* FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id ${whereClause} ORDER BY a.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      logs: dataRes.rows,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const userRes = await pool.query("SELECT role FROM users WHERE id = $1", [id]);
    if (userRes.rowCount === 0) return res.status(404).json({ message: 'User not found' });
    if (userRes.rows[0].role === 'admin') return res.status(403).json({ message: 'Cannot delete admin' });
    await pool.query("DELETE FROM batch_students WHERE student_id = $1", [id]);
    await pool.query("DELETE FROM batch_faculty WHERE faculty_id = $1", [id]);
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    res.json({ message: 'User deleted from master database.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const resetDatabase = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Legacy direct database reset is permanently disabled. Please use the secure dual-OTP reset flow via Settings -> Danger Zone.'
  });
};

const getCurrentBatch = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.semester,
              u.division, u.school, u.panel, u.is_primary, u.prn,
              u.squad, u.room, u.barcode, u.in_current_batch,
              u.undertaking_submitted, u.undertaking_signed_name, u.undertaking_signed_date,
              (i.prn IS NOT NULL) as insured
       FROM users u
       LEFT JOIN insurance i ON u.prn = i.prn
       WHERE u.role = 'student' AND u.in_current_batch = true
       ORDER BY u.id ASC`
    );
    res.json({ students: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const setCurrentBatch = async (req, res) => {
  const { identifiers, matchType } = req.body;
  if (!Array.isArray(identifiers)) return res.status(400).json({ message: 'identifiers must be an array' });
  try {
    await pool.query("UPDATE users SET in_current_batch = false WHERE role = 'student'");
    const column = matchType === 'prn' ? 'prn' : 'email';
    const matches = await pool.query(
      `SELECT id, name, email FROM users WHERE role = 'student' AND ${column} = ANY($1)`,
      [identifiers]
    );
    if (matches.rowCount > 0) {
      const matchedIds = matches.rows.map(r => r.id);
      await pool.query("UPDATE users SET in_current_batch = true WHERE id = ANY($1)", [matchedIds]);
    }
    res.json({ message: `Set ${matches.rowCount} students in current batch.`, matchedCount: matches.rowCount });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const toggleStudentBatch = async (req, res) => {
  const { user_id, in_batch } = req.body;
  try {
    const userQuery = await pool.query("SELECT id, name, email, role, in_current_batch FROM users WHERE id = $1", [user_id]);
    if (userQuery.rowCount === 0) return res.status(404).json({ message: 'User not found.' });
    const user = userQuery.rows[0];
    if (in_batch && user.role === 'student' && !user.in_current_batch) {
      await pool.query("UPDATE users SET in_current_batch = true WHERE id = $1", [user_id]);
    } else {
      await pool.query("UPDATE users SET in_current_batch = $1 WHERE id = $2", [in_batch, user_id]);
    }

    await createSystemNotification(
      user_id,
      'Batch Enrollment Status Changed',
      `Your active batch enrollment status has been set to: ${in_batch ? 'Enrolled' : 'Not Enrolled'} by an administrator.`,
      'info',
      req.user.id
    );

    res.json({ message: 'Batch status updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const clearCurrentBatch = async (req, res) => {
  try {
    await pool.query("UPDATE users SET in_current_batch = false WHERE role = 'student'");
    res.json({ message: 'Current batch cleared.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getSquadAllocationState = async (req, res) => {
  try {
    const lockCheck = await pool.query("SELECT value FROM system_settings WHERE key = 'squads_locked'");
    const isLocked = lockCheck.rowCount > 0 && lockCheck.rows[0].value === 'true';
    const studentsRes = await pool.query(
      "SELECT id, name, email, gender, prn, squad, role, in_current_batch, is_squad_leader, phone FROM users WHERE role = 'student' AND in_current_batch = true ORDER BY name ASC"
    );
    const facultyRes = await pool.query(
      "SELECT id, name, email, department, squad, role, in_current_batch FROM users WHERE role = 'faculty' AND in_current_batch = true ORDER BY name ASC"
    );
    const squadLeadersRes = await pool.query("SELECT * FROM squad_leaders");
    res.json({ locked: isLocked, students: studentsRes.rows, faculties: facultyRes.rows, squadLeaders: squadLeadersRes.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const lockSquads = async (req, res) => {
  try {
    await pool.query("INSERT INTO system_settings (key, value) VALUES ('squads_locked', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'");
    res.json({ message: 'Squad allocation locked.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const unlockSquads = async (req, res) => {
  try {
    await pool.query("INSERT INTO system_settings (key, value) VALUES ('squads_locked', 'false') ON CONFLICT (key) DO UPDATE SET value = 'false'");
    res.json({ message: 'Squad allocation unlocked.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const shuffleSquads = async (req, res) => {
  try {
    const lockCheck = await pool.query("SELECT value FROM system_settings WHERE key = 'squads_locked'");
    if (lockCheck.rowCount > 0 && lockCheck.rows[0].value === 'true') {
      return res.status(400).json({ message: 'Squad allocation is locked.' });
    }
    const studentsRes = await pool.query("SELECT id, name, email, gender FROM users WHERE role = 'student' AND in_current_batch = true");
    const students = studentsRes.rows;
    const facultyRes = await pool.query("SELECT id FROM users WHERE role = 'faculty' AND in_current_batch = true");
    const faculties = facultyRes.rows;

    const shuffle = (array) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    };

    const girls = students.filter(s => {
      const g = s.gender ? s.gender.trim().toLowerCase() : '';
      return g === 'female' || g === 'f';
    });
    const boys = students.filter(s => {
      const g = s.gender ? s.gender.trim().toLowerCase() : '';
      return g === 'male' || g === 'm';
    });
    const others = students.filter(s => {
      const g = s.gender ? s.gender.trim().toLowerCase() : '';
      return g !== 'female' && g !== 'f' && g !== 'male' && g !== 'm';
    });
    shuffle(girls); shuffle(boys); shuffle(others);
    const allStudents = [...girls, ...boys, ...others];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE users SET squad = NULL WHERE in_current_batch = false OR in_current_batch IS NULL");

      for (let idx = 0; idx < allStudents.length; idx++) {
        await client.query("UPDATE users SET squad = $1 WHERE id = $2", [SQUAD_NAMES[idx % SQUAD_NAMES.length], allStudents[idx].id]);
      }

      await client.query("UPDATE users SET squad = NULL WHERE role = 'faculty'");
      shuffle(faculties);
      for (let idx = 0; idx < faculties.length; idx++) {
        if (idx < 20) {
          await client.query("UPDATE users SET squad = $1 WHERE id = $2", [SQUAD_NAMES[Math.floor(idx / 2)], faculties[idx].id]);
        }
      }
      await client.query('COMMIT');
      res.json({ message: 'Squad allocation completed.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error during shuffling', error: err.message });
  }
};

const assignHierarchyToBatch = async (req, res) => {
  const { id } = req.params;
  const { divisions, faculties, schools, departments, userType = 'both', studentIds, facultyIds } = req.body;
  const client = await pool.connect();
  try {
    // Verify batch exists
    const batchCheck = await client.query('SELECT id, capacity FROM batches WHERE id = $1 AND (is_deleted IS NOT TRUE)', [id]);
    if (batchCheck.rowCount === 0) return res.status(404).json({ message: 'Batch not found' });
    const batchCapacityLimit = batchCheck.rows[0].capacity || 350;

    await client.query('BEGIN');
    let enrolled = 0, alreadyInBatch = 0;

    // Assign students
    if (userType === 'student' || userType === 'both') {
      const countRes = await client.query(
        `SELECT COUNT(*)::int FROM batch_students WHERE batch_id = $1`,
        [id]
      );
      const currentStudentCount = countRes.rows[0].count;
      let remainingSlots = Math.max(0, batchCapacityLimit - currentStudentCount);

      let studentsToAssign = [];
      if (Array.isArray(studentIds)) {
        studentsToAssign = studentIds.map(sid => ({ id: sid }));
      } else {
        const { whereSql, params } = buildHierarchyWhereClause(divisions, faculties, schools, departments, 1);
        if (whereSql !== 'FALSE') {
          const studentsRes = await client.query(
            `SELECT id FROM users 
             WHERE ${whereSql} AND role = 'student'
             AND id NOT IN (SELECT student_id FROM batch_students)
             ORDER BY id ASC
             LIMIT ${batchCapacityLimit}`,
            params
          );
          studentsToAssign = studentsRes.rows;
        }
      }

      for (const s of studentsToAssign) {
        const exists = await client.query(
          'SELECT 1 FROM batch_students WHERE batch_id = $1 AND student_id = $2',
          [id, s.id]
        );
        if (exists.rowCount > 0) { alreadyInBatch++; continue; }

        const otherBatch = await client.query(
          `SELECT b.name FROM batch_students bs
           JOIN batches b ON bs.batch_id = b.id
           WHERE bs.student_id = $1 AND bs.batch_id <> $2 AND (b.is_deleted = false OR b.is_deleted IS NULL)
           LIMIT 1`,
          [s.id, id]
        );
        if (otherBatch.rowCount > 0) { continue; }

        if (remainingSlots <= 0) { continue; }

        await client.query(
          'INSERT INTO batch_students (batch_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, s.id]
        );
        enrolled++;
        remainingSlots--;
      }
    }

    // Assign faculty
    if (userType === 'faculty' || userType === 'both') {
      let facultyToAssign = [];
      if (Array.isArray(facultyIds)) {
        facultyToAssign = facultyIds.map(fid => ({ id: fid }));
      } else {
        const { whereSql, params } = buildHierarchyWhereClause(divisions, faculties, schools, departments, 1);
        if (whereSql !== 'FALSE') {
          const facultyRes = await client.query(
            `SELECT id FROM users WHERE ${whereSql} AND role = 'faculty'`,
            params
          );
          facultyToAssign = facultyRes.rows;
        }
      }

      for (const f of facultyToAssign) {
        const exists = await client.query(
          'SELECT 1 FROM batch_faculty WHERE batch_id = $1 AND faculty_id = $2',
          [id, f.id]
        );
        if (exists.rowCount > 0) { alreadyInBatch++; continue; }

        const otherBatch = await client.query(
          `SELECT b.name FROM batch_faculty bf
           JOIN batches b ON bf.batch_id = b.id
           WHERE bf.faculty_id = $1 AND bf.batch_id <> $2 AND (b.is_deleted = false OR b.is_deleted IS NULL)
           LIMIT 1`,
          [f.id, id]
        );
        if (otherBatch.rowCount > 0) { continue; }

        await client.query(
          'INSERT INTO batch_faculty (batch_id, faculty_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, f.id]
        );
        enrolled++;
      }
    }

    await client.query('COMMIT');

    try {
      const { syncLtcBatchToRiCore } = require('../services/riSyncService');
      await syncLtcBatchToRiCore(parseInt(id, 10));
    } catch (syncErr) {
      console.error(`[riSyncService] Error auto-syncing batch ${id} after assignHierarchyToBatch:`, syncErr);
    }

    writeAudit(req.user.id, req.user.name || 'Admin', 'HIERARCHY_BATCH_ASSIGN', 'batch', parseInt(id), { divisions, userType, enrolled });
    res.json({ message: `Assigned ${enrolled} members.`, enrolled, alreadyInBatch, total: enrolled + alreadyInBatch });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
};

const getRedFlags = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        rf.id, rf.category, rf.reason, rf.created_at,
        s.name AS student_name, s.prn AS student_prn, s.email AS student_email, s.department AS student_department,
        f.name AS faculty_name, f.email AS faculty_email
      FROM red_flags rf
      JOIN users s ON rf.student_id = s.id
      JOIN users f ON rf.faculty_id = f.id
      ORDER BY rf.created_at DESC
    `);
    res.json({ flags: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


// ─── NEW ADMIN ANALYTICS, RED FLAGS & FILE MANAGEMENT ───────────────

const getFeedbackAnalytics = async (req, res) => {
  try {
    const commentsQuery = await pool.query(`
      SELECT f.id, f.feedback_text, f.category, f.role, u.name, f.created_at
      FROM feedback f
      LEFT JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
      LIMIT 1000
    `);

    const analytics = computeAggregatedFeedbackAnalytics(commentsQuery.rows);

    res.json({
      summary: analytics.summary,
      categoryRatings: analytics.categoryRatings,
      comments: analytics.comments.slice(0, 100),
      wordCloud: analytics.wordCloud
    });
  } catch (err) {
    console.error('Error fetching admin feedback analytics:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const assignRedFlag = async (req, res) => {
  const { id } = req.params;
  const { assignedTo } = req.body;
  try {
    await pool.query("UPDATE red_flags SET assigned_to = $1 WHERE id = $2", [assignedTo || null, id]);

    // Get username of assignee
    let assigneeName = 'Unassigned';
    if (assignedTo) {
      const uRes = await pool.query("SELECT name FROM users WHERE id = $1", [assignedTo]);
      if (uRes.rowCount > 0) assigneeName = uRes.rows[0].name;
    }

    await pool.query(
      "INSERT INTO red_flag_history (red_flag_id, user_id, action_taken, details) VALUES ($1, $2, 'Assigned', $3)",
      [id, req.user.id, `Assigned to ${assigneeName}`]
    );

    res.json({ message: `Red flag assigned to ${assigneeName}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const resolveRedFlag = async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  try {
    await pool.query(
      "UPDATE red_flags SET status = 'Resolved', resolved_at = NOW(), resolved_by = $1, resolution_notes = $2 WHERE id = $3",
      [req.user.id, notes || '', id]
    );
    await pool.query(
      "INSERT INTO red_flag_history (red_flag_id, user_id, action_taken, details) VALUES ($1, $2, 'Resolved', $3)",
      [id, req.user.id, notes || 'Resolved without notes']
    );
    res.json({ message: 'Red flag resolved successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const reopenRedFlag = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      "UPDATE red_flags SET status = 'Open', resolved_at = NULL, resolved_by = NULL, resolution_notes = NULL WHERE id = $1",
      [id]
    );
    await pool.query(
      "INSERT INTO red_flag_history (red_flag_id, user_id, action_taken, details) VALUES ($1, $2, 'Reopened', 'Red flag reopened for review.')",
      [id, req.user.id]
    );
    res.json({ message: 'Red flag reopened successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getRedFlagDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const flagRes = await pool.query(`
      SELECT 
        rf.id, rf.category, rf.reason, rf.severity, rf.status, rf.created_at, rf.resolved_at, rf.resolution_notes,
        s.name AS student_name, s.prn AS student_prn, s.email AS student_email, s.department AS student_department,
        f.name AS faculty_name, f.email AS faculty_email,
        a.name AS assignee_name, rby.name AS resolver_name
      FROM red_flags rf
      JOIN users s ON rf.student_id = s.id
      JOIN users f ON rf.faculty_id = f.id
      LEFT JOIN users a ON rf.assigned_to = a.id
      LEFT JOIN users rby ON rf.resolved_by = rby.id
      WHERE rf.id = $1
    `, [id]);

    if (flagRes.rowCount === 0) return res.status(404).json({ message: 'Red flag not found' });

    const commentsRes = await pool.query(`
      SELECT rfc.*, u.name as user_name, u.role as user_role
      FROM red_flag_comments rfc
      JOIN users u ON rfc.user_id = u.id
      WHERE rfc.red_flag_id = $1
      ORDER BY rfc.created_at ASC
    `, [id]);

    const historyRes = await pool.query(`
      SELECT rfh.*, u.name as user_name
      FROM red_flag_history rfh
      JOIN users u ON rfh.user_id = u.id
      WHERE rfh.red_flag_id = $1
      ORDER BY rfh.created_at DESC
    `, [id]);

    res.json({
      flag: flagRes.rows[0],
      comments: commentsRes.rows,
      history: historyRes.rows
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const addRedFlagComment = async (req, res) => {
  const { id } = req.params;
  const { commentText } = req.body;
  if (!commentText) return res.status(400).json({ message: 'Comment text is required' });

  try {
    const commentRes = await pool.query(
      "INSERT INTO red_flag_comments (red_flag_id, user_id, comment_text) VALUES ($1, $2, $3) RETURNING *",
      [id, req.user.id, commentText]
    );
    await pool.query(
      "INSERT INTO red_flag_history (red_flag_id, user_id, action_taken, details) VALUES ($1, $2, 'Comment Added', $3)",
      [id, req.user.id, `Comment: "${commentText.substring(0, 30)}..."`]
    );
    res.json({ message: 'Comment added successfully', comment: commentRes.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getAttendanceAnalytics = async (req, res) => {
  try {
    let activeBatchId = null;
    const activeBatchRes = await pool.query(
      "SELECT id FROM batches WHERE status IN ('active', 'Immersion') AND (is_deleted = false OR is_deleted IS NULL) ORDER BY id DESC LIMIT 1"
    );
    if (activeBatchRes.rowCount > 0) activeBatchId = activeBatchRes.rows[0].id;

    if (!activeBatchId) {
      return res.json({
        overallAttendance: 0,
        byDay: [],
        bySquad: [],
        byFaculty: [],
        lateArrivals: [],
        missedSessions: [],
        topAttendance: [],
        lowestAttendance: []
      });
    }

    // Overall attendance %
    const overallRes = await pool.query(`
      SELECT 
        ROUND((COUNT(CASE WHEN status = 'present' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 1) as percentage
      FROM attendance_records_v2
      WHERE batch_id = $1
    `);

    // Attendance by Day
    const dayRes = await pool.query(`
      SELECT 
        s.session_date as date,
        ROUND((COUNT(CASE WHEN r.status = 'present' THEN 1 END)::float / NULLIF(COUNT(r.id), 0) * 100)::numeric, 1) as percentage
      FROM attendance_sessions s
      LEFT JOIN attendance_records_v2 r ON s.id = r.session_id
      WHERE s.batch_id = $1
      GROUP BY s.session_date
      ORDER BY s.session_date ASC
    `, [activeBatchId]);

    // Attendance by Squad
    const squadRes = await pool.query(`
      SELECT 
        COALESCE(NULLIF(bs.squad, ''), 'Unassigned') as squad,
        ROUND((COUNT(CASE WHEN r.status = 'present' THEN 1 END)::float / NULLIF(COUNT(r.id), 0) * 100)::numeric, 1) as percentage
      FROM batch_students bs
      LEFT JOIN attendance_records_v2 r ON bs.student_id = r.student_id AND bs.batch_id = r.batch_id
      WHERE bs.batch_id = $1
      GROUP BY bs.squad
      ORDER BY percentage DESC
    `, [activeBatchId]);

    // Attendance by Faculty
    const facultyRes = await pool.query(`
      SELECT 
        f.name as faculty,
        ROUND((COUNT(CASE WHEN r.status = 'present' THEN 1 END)::float / NULLIF(COUNT(r.id), 0) * 100)::numeric, 1) as percentage
      FROM batch_students bs
      LEFT JOIN users f ON bs.faculty_id = f.id
      LEFT JOIN attendance_records_v2 r ON bs.student_id = r.student_id AND bs.batch_id = r.batch_id
      WHERE bs.batch_id = $1 AND f.id IS NOT NULL
      GROUP BY f.name
      ORDER BY percentage DESC
    `, [activeBatchId]);

    // Late Arrivals
    const lateRes = await pool.query(`
      SELECT r.id, u.name, u.prn, s.title as session_title, s.session_date as date, r.updated_at as time
      FROM attendance_records_v2 r
      JOIN users u ON r.student_id = u.id
      JOIN attendance_sessions s ON r.session_id = s.id
      WHERE r.batch_id = $1 AND r.status = 'late'
      ORDER BY r.updated_at DESC LIMIT 50
    `, [activeBatchId]);

    // Missed Sessions
    const missedRes = await pool.query(`
      SELECT r.id, u.name, u.prn, s.title as session_title, s.session_date as date
      FROM attendance_records_v2 r
      JOIN users u ON r.student_id = u.id
      JOIN attendance_sessions s ON r.session_id = s.id
      WHERE r.batch_id = $1 AND r.status = 'absent'
      ORDER BY s.session_date DESC LIMIT 50
    `, [activeBatchId]);

    // Top attendance students
    const topRes = await pool.query(`
      SELECT 
        u.name, u.prn,
        ROUND((COUNT(CASE WHEN r.status = 'present' THEN 1 END)::float / NULLIF(COUNT(r.id), 0) * 100)::numeric, 1) as percentage
      FROM batch_students bs
      JOIN users u ON bs.student_id = u.id
      LEFT JOIN attendance_records_v2 r ON bs.student_id = r.student_id AND bs.batch_id = r.batch_id
      WHERE bs.batch_id = $1
      GROUP BY u.id, u.name, u.prn
      HAVING COUNT(r.id) > 0
      ORDER BY percentage DESC LIMIT 10
    `, [activeBatchId]);

    // Lowest attendance students
    const lowRes = await pool.query(`
      SELECT 
        u.name, u.prn,
        ROUND((COUNT(CASE WHEN r.status = 'present' THEN 1 END)::float / NULLIF(COUNT(r.id), 0) * 100)::numeric, 1) as percentage
      FROM batch_students bs
      JOIN users u ON bs.student_id = u.id
      LEFT JOIN attendance_records_v2 r ON bs.student_id = r.student_id AND bs.batch_id = r.batch_id
      WHERE bs.batch_id = $1
      GROUP BY u.id, u.name, u.prn
      HAVING COUNT(r.id) > 0
      ORDER BY percentage ASC LIMIT 10
    `, [activeBatchId]);

    res.json({
      overallAttendance: overallRes.rows[0]?.percentage || 0,
      byDay: dayRes.rows,
      bySquad: squadRes.rows,
      byFaculty: facultyRes.rows,
      lateArrivals: lateRes.rows,
      missedSessions: missedRes.rows,
      topAttendance: topRes.rows,
      lowestAttendance: lowRes.rows
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getFiles = async (req, res) => {
  const { fileType } = req.query;
  try {
    let query = `
      SELECT d.*, u.name as uploaded_by_name, b.name as batch_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN batches b ON d.batch_id = b.id
    `;
    const params = [];
    if (fileType) {
      query += ` WHERE d.file_type = $1`;
      params.push(fileType);
    }
    query += ` ORDER BY d.created_at DESC`;
    const result = await pool.query(query, params);
    res.json({ files: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const uploadFileVersion = async (req, res) => {
  const { id } = req.params;
  const { url } = req.body;
  if (!url) return res.status(400).json({ message: 'File URL is required' });

  try {
    const docRes = await pool.query("SELECT current_version FROM documents WHERE id = $1", [id]);
    if (docRes.rowCount === 0) return res.status(404).json({ message: 'Document not found' });

    const newVer = docRes.rows[0].current_version + 1;
    await pool.query("UPDATE documents SET current_version = $1, url = $2 WHERE id = $3", [newVer, url, id]);

    const verRes = await pool.query(
      "INSERT INTO document_versions (document_id, version, url, uploaded_by) VALUES ($1, $2, $3, $4) RETURNING *",
      [id, newVer, url, req.user.id]
    );

    res.json({ message: `Version ${newVer} uploaded successfully`, version: verRes.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getFileVersions = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT dv.*, u.name as uploaded_by_name
      FROM document_versions dv
      LEFT JOIN users u ON dv.uploaded_by = u.id
      WHERE dv.document_id = $1
      ORDER BY dv.version DESC
    `, [id]);
    res.json({ versions: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const deleteFile = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM document_versions WHERE document_id = $1", [id]);
    await pool.query("DELETE FROM documents WHERE id = $1", [id]);
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getAdminRedFlags = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        rf.id, rf.category, rf.reason, rf.severity, rf.status, rf.created_at, rf.resolved_at,
        s.name AS student_name, s.prn AS student_prn, s.email AS student_email, s.department AS student_department,
        f.name AS faculty_name, f.email AS faculty_email,
        a.name AS assignee_name,
        (SELECT COUNT(*)::int FROM red_flag_comments WHERE red_flag_id = rf.id) as comments_count,
        (SELECT COUNT(*)::int FROM red_flag_history WHERE red_flag_id = rf.id) as history_count
      FROM red_flags rf
      JOIN users s ON rf.student_id = s.id
      JOIN users f ON rf.faculty_id = f.id
      LEFT JOIN users a ON rf.assigned_to = a.id
      ORDER BY rf.created_at DESC
    `);
    res.json({ flags: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getAllJourneyMedia = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT jm.*, u.name as uploader_name, u.role as uploader_role, b.name as batch_name
       FROM journey_media jm
       LEFT JOIN users u ON jm.uploaded_by = u.id
       LEFT JOIN batches b ON jm.batch_id = b.id
       ORDER BY jm.created_at DESC`
    );
    const mediaList = result.rows.map(row => ({
      ...row,
      batchName: row.batch_name || 'Unassigned Batch',
      batch_name: row.batch_name || 'Unassigned Batch',
      squadName: row.squad || row.squad_name || 'Unassigned Squad',
      squad_name: row.squad || row.squad_name || 'Unassigned Squad',
      squad: row.squad || 'Unassigned Squad',
      mediaType: row.media_type,
      isGroupPhoto: !!row.is_group_photo || row.squad === 'Batch Group',
      is_group_photo: !!row.is_group_photo || row.squad === 'Batch Group',
      media_url: storageService.getFileUrl(row.storage_key || row.media_url, row.storage_type),
      imageUrl: storageService.getFileUrl(row.storage_key || row.media_url, row.storage_type)
    }));
    res.json({ media: mediaList, data: mediaList });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const deleteJourneyMedia = async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Fetch the media first to get storage key
    const mediaRes = await pool.query("SELECT * FROM journey_media WHERE id = $1", [id]);
    if (mediaRes.rowCount === 0) {
      return res.status(404).json({ message: 'Media not found' });
    }
    const media = mediaRes.rows[0];

    // 2. Delete file from storage if storage key is set
    if (media.storage_key) {
      try {
        await storageService.deleteFile(media.storage_key);
      } catch (storageErr) {
        console.error("Failed to delete media file from storage:", storageErr);
      }
    }

    // 3. Delete from database
    await pool.query('DELETE FROM journey_media WHERE id = $1', [id]);

    res.json({ message: 'Media deleted successfully', deleted: media });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


const updateTranslation = async (req, res) => {
  const { key, hi, mr } = req.body;
  if (!key) {
    return res.status(400).json({ success: false, message: 'Translation key is required.' });
  }
  try {
    await pool.query(
      `INSERT INTO translations (key, hi, mr) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (key) 
       DO UPDATE SET hi = EXCLUDED.hi, mr = EXCLUDED.mr;`,
      [key, hi || '', mr || '']
    );
    res.status(200).json({ success: true, message: 'Translation saved successfully.' });
  } catch (err) {
    console.error('Error updating translation:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

const deleteTranslation = async (req, res) => {
  const { key } = req.params;
  if (!key) {
    return res.status(400).json({ success: false, message: 'Translation key is required.' });
  }
  try {
    const result = await pool.query("DELETE FROM translations WHERE key = $1;", [key]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Translation key not found.' });
    }
    res.status(200).json({ success: true, message: 'Translation deleted successfully.' });
  } catch (err) {
    console.error('Error deleting translation:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

const globalSearch = async (req, res) => {
  const { query } = req.query;
  if (!query || query.trim() === '') {
    return res.status(200).json({
      success: true,
      students: [],
      faculty: [],
      ltcMembers: [],
      batches: [],
      squadDetails: null
    });
  }

  const normalizeRoomQuery = (q) => {
    let clean = q.trim().toLowerCase().replace(/[\s-]/g, '');
    if (/^s\d+$/.test(clean)) {
      clean = 'sinhgad' + clean.substring(1);
    } else if (/^p\d+$/.test(clean)) {
      clean = 'pratapgad' + clean.substring(1);
    }
    return clean;
  };

  const searchPattern = `%${query.trim()}%`;
  const normalizedRoomPattern = `%${normalizeRoomQuery(query)}%`;
  const SQUAD_NAMES = ['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi'];
  const matchedSquad = SQUAD_NAMES.find(s => s.toLowerCase() === query.trim().toLowerCase());

  try {
    // 1. Search Students
    const studentQuery = `
      WITH student_ltc_ids AS (
        SELECT 
          u.id, 
          u.name, 
          CASE 
            WHEN u.email LIKE '%@lifeawakening.internal' THEN (
              CASE WHEN u.personal_email NOT LIKE '%@lifeawakening.internal' THEN u.personal_email ELSE NULL END
            )
            ELSE u.email 
          END AS email,
          (
            SELECT pu.email FROM parent_students ps2 
            JOIN users pu ON ps2.parent_id = pu.id 
            WHERE ps2.student_id = u.id 
            ORDER BY ps2.is_primary DESC NULLS LAST, ps2.created_at ASC NULLS LAST, pu.id ASC LIMIT 1
          ) AS parent1_email,
          (
            SELECT pu.email FROM parent_students ps2 
            JOIN users pu ON ps2.parent_id = pu.id 
            WHERE ps2.student_id = u.id 
            ORDER BY ps2.is_primary DESC NULLS LAST, ps2.created_at ASC NULLS LAST, pu.id ASC OFFSET 1 LIMIT 1
          ) AS parent2_email,
          (
            SELECT pu.name FROM parent_students ps2 
            JOIN users pu ON ps2.parent_id = pu.id 
            WHERE ps2.student_id = u.id 
            ORDER BY ps2.is_primary DESC NULLS LAST, ps2.created_at ASC NULLS LAST, pu.id ASC LIMIT 1
          ) AS parent1_name,
          u.phone, 
          u.prn, 
          u.school, 
          u.department, 
          u.division, 
          u.panel, 
          bs.squad, 
          bs.room,
          b.name as batch_name, 
          b.batch_code as batch_code,
          (
            SELECT LPAD(CAST(COUNT(*) AS VARCHAR), 2, '0')
            FROM batches b2
            WHERE (b2.is_deleted = false OR b2.is_deleted IS NULL) AND b2.id <= b.id
          ) || '-' || 
          COALESCE(TO_CHAR(b.start_date, 'MMYY'), '0726') || '-' ||
          LPAD(CAST(ROW_NUMBER() OVER (PARTITION BY bs.batch_id ORDER BY u.id) AS VARCHAR), 3, '0') AS ltc_id
        FROM users u 
        LEFT JOIN batch_students bs ON bs.student_id = u.id 
        LEFT JOIN batches b ON bs.batch_id = b.id 
        WHERE u.role = 'student'
          AND NOT (
            EXISTS (SELECT 1 FROM ri_batch_students rbs WHERE rbs.student_id = u.id AND rbs.source_program = 'RI_DIRECT')
            AND NOT EXISTS (SELECT 1 FROM batch_students bs2 WHERE bs2.student_id = u.id)
          )
      )
      SELECT * FROM student_ltc_ids
      WHERE (name ILIKE $1 OR (email IS NOT NULL AND email ILIKE $1) OR (parent1_email IS NOT NULL AND parent1_email ILIKE $1) OR (parent2_email IS NOT NULL AND parent2_email ILIKE $1) OR phone ILIKE $1 OR prn ILIKE $1 OR squad ILIKE $1 OR batch_name ILIKE $1 OR batch_code ILIKE $1 OR school ILIKE $1 OR department ILIKE $1 OR division ILIKE $1 OR panel ILIKE $1 OR ltc_id ILIKE $1 OR LOWER(REPLACE(REPLACE(room, ' ', ''), '-', '')) ILIKE $2)
      LIMIT 50;
    `;
    const studentRes = await pool.query(studentQuery, [searchPattern, normalizedRoomPattern]);

    // 2. Search Faculty
    const facultyQuery = `
      SELECT u.id, u.name, u.email, u.phone, u.faculty_id, u.school, u.department, u.division, bf.squad, b.name as batch_name, b.batch_code as batch_code 
      FROM users u 
      LEFT JOIN batch_faculty bf ON bf.faculty_id = u.id 
      LEFT JOIN batches b ON bf.batch_id = b.id 
      WHERE u.role = 'faculty' 
        AND (u.name ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1 OR u.faculty_id ILIKE $1 OR bf.squad ILIKE $1 OR b.name ILIKE $1 OR b.batch_code ILIKE $1 OR u.school ILIKE $1 OR u.department ILIKE $1 OR u.division ILIKE $1)
      LIMIT 50;
    `;
    const facultyRes = await pool.query(facultyQuery, [searchPattern]);

    // 3. Search LTC Members
    const ltcQuery = `
      SELECT u.id, u.name, u.email, u.phone, u.faculty_id, u.designation, u.gender, u.division, bf.squad, b.name as batch_name, b.batch_code as batch_code 
      FROM users u 
      LEFT JOIN batch_faculty bf ON bf.faculty_id = u.id 
      LEFT JOIN batches b ON bf.batch_id = b.id 
      WHERE u.role = 'ltc_member' 
        AND (u.name ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1 OR u.faculty_id ILIKE $1 OR u.designation ILIKE $1 OR bf.squad ILIKE $1 OR b.name ILIKE $1 OR b.batch_code ILIKE $1 OR u.division ILIKE $1)
      LIMIT 50;
    `;
    const ltcRes = await pool.query(ltcQuery, [searchPattern]);

    // 4. Search Batches
    const batchQuery = `
      SELECT id, name, batch_code, start_date, end_date, status 
      FROM batches 
      WHERE is_deleted = false 
        AND (name ILIKE $1 OR batch_code ILIKE $1 OR status ILIKE $1)
      LIMIT 50;
    `;
    const batchRes = await pool.query(batchQuery, [searchPattern]);

    // 5. Aggregate Squad Details if search matching a squad name
    let squadDetails = null;
    if (matchedSquad) {
      const activeBatchRes = await pool.query("SELECT id, name FROM batches WHERE status IN ('active', 'Immersion') ORDER BY id DESC LIMIT 1");
      const latestBatchRes = await pool.query("SELECT id, name FROM batches ORDER BY id DESC LIMIT 1");

      const batchId = activeBatchRes.rowCount > 0
        ? activeBatchRes.rows[0].id
        : (latestBatchRes.rowCount > 0 ? latestBatchRes.rows[0].id : null);
      const batchName = activeBatchRes.rowCount > 0
        ? activeBatchRes.rows[0].name
        : (latestBatchRes.rowCount > 0 ? latestBatchRes.rows[0].name : 'No Active Batch');

      if (batchId) {
        const squadStudents = await pool.query(
          `SELECT u.id, u.name, 
                  CASE WHEN u.email LIKE '%@lifeawakening.internal' THEN NULL ELSE u.email END AS email,
                  (
                    SELECT pu.email FROM parent_students ps2 
                    JOIN users pu ON ps2.parent_id = pu.id 
                    WHERE ps2.student_id = u.id 
                    ORDER BY ps2.is_primary DESC NULLS LAST, ps2.created_at ASC NULLS LAST, pu.id ASC LIMIT 1
                  ) AS parent1_email,
                  u.prn, u.department, u.division, u.panel 
           FROM batch_students bs 
           JOIN users u ON bs.student_id = u.id 
           WHERE bs.batch_id = $1 AND bs.squad = $2`,
          [batchId, matchedSquad]
        );

        const squadFaculty = await pool.query(
          `SELECT u.id, u.name, u.email, u.role, u.faculty_id, u.designation 
           FROM batch_faculty bf 
           JOIN users u ON bf.faculty_id = u.id 
           WHERE bf.batch_id = $1 AND bf.squad = $2`,
          [batchId, matchedSquad]
        );

        squadDetails = {
          squadName: matchedSquad,
          batchName: batchName,
          students: squadStudents.rows,
          faculty: squadFaculty.rows.filter(f => f.role === 'faculty'),
          ltcMembers: squadFaculty.rows.filter(f => f.role === 'ltc_member')
        };
      }
    }

    res.status(200).json({
      success: true,
      students: studentRes.rows,
      faculty: facultyRes.rows,
      ltcMembers: ltcRes.rows,
      batches: batchRes.rows,
      squadDetails
    });
  } catch (err) {
    console.error('Error in global search:', err);
    res.status(500).json({ success: false, message: 'Server error during search', error: err.message });
  }
};

const getEmailLogs = async (req, res) => {
  try {
    try {
      const { syncPendingResendStatuses } = require('../config/mailer');
      if (typeof syncPendingResendStatuses === 'function') {
        await syncPendingResendStatuses(10);
      }
    } catch (sErr) {
      console.warn('[getEmailLogs] Inline Resend sync warning:', sErr.message);
    }

    const [auditRes, statsRes, queueRes] = await Promise.all([
      pool.query(
        `SELECT a.id, a.user_id, a.user_name, a.action, a.entity_id as batch_id, a.details, a.created_at,
                b.name as batch_name, b.batch_code
         FROM audit_logs a
         LEFT JOIN batches b ON a.entity_id = b.id AND a.entity_type = 'batch'
         WHERE a.action IN ('WELCOME_EMAILS_SENT', 'ORIENTATION_EMAIL_SENT', 'EMAIL_DISPATCH_MANUAL', 'EMAIL_SCHEDULED')
         ORDER BY a.created_at DESC
         LIMIT 1000`
      ),
      pool.query(
        `SELECT 
           COUNT(*)::int as total_all,
           SUM(CASE WHEN status='delivered' OR provider_status='DELIVERED' THEN 1 ELSE 0 END)::int as total_delivered,
           SUM(CASE 
                 WHEN status IN ('sent', 'processing')
                  AND status NOT IN ('delivered', 'failed', 'permanent_fail', 'bounced', 'rejected', 'undeliverable', 'suppressed')
                  AND COALESCE(provider_status, '') NOT IN ('DELIVERED', 'SUPPRESSED', 'BOUNCED', 'REJECTED', 'FAILED', 'UNDELIVERABLE', 'COMPLAINED')
                 THEN 1 ELSE 0 
               END)::int as total_sent,
           SUM(CASE WHEN status='bounced' OR provider_status IN ('BOUNCED', 'COMPLAINED') THEN 1 ELSE 0 END)::int as total_bounced,
           SUM(CASE WHEN status IN ('failed', 'permanent_fail', 'bounced', 'rejected', 'undeliverable', 'suppressed') OR provider_status IN ('SUPPRESSED', 'BOUNCED', 'REJECTED', 'FAILED', 'UNDELIVERABLE', 'COMPLAINED') THEN 1 ELSE 0 END)::int as total_failed,
           SUM(CASE WHEN status IN ('pending', 'queued') AND (provider_status IS NULL OR provider_status = '') THEN 1 ELSE 0 END)::int as total_pending,
           SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END)::int as total_processing,
           SUM(CASE WHEN status='paused' THEN 1 ELSE 0 END)::int as total_paused,
           SUM(CASE WHEN status='stopped' THEN 1 ELSE 0 END)::int as total_stopped
         FROM email_queue`
      ),
      pool.query(
        `SELECT eq.id, eq.to_email, eq.subject, eq.body, eq.status, eq.delivery_status, eq.provider_status, eq.resend_id,
                eq.bounce_reason, eq.error_message, eq.attempts, eq.max_attempts, eq.created_at, eq.updated_at, eq.last_status_update,
                u.name as recipient_name, u.role as recipient_role,
                u.prn as recipient_prn, u.department as recipient_department, u.panel as recipient_panel, u.phone as recipient_phone,
                (SELECT b2.name FROM batch_students bs2 JOIN batches b2 ON bs2.batch_id = b2.id WHERE bs2.student_id = u.id LIMIT 1) as batch_name
         FROM email_queue eq
         LEFT JOIN users u ON LOWER(eq.to_email) = LOWER(u.email)
         ORDER BY eq.created_at DESC
         LIMIT 5000`
      )
    ]);

    const logs = auditRes.rows.map(row => {
      let parsedDetails = {};
      try {
        parsedDetails = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
      } catch (e) {
        parsedDetails = { raw: row.details };
      }
      return {
        id: row.id,
        user_name: row.user_name || 'Admin',
        action: row.action,
        batch_id: row.batch_id,
        batch_name: row.batch_name || parsedDetails.batch_name || (row.batch_id ? `Batch #${row.batch_id}` : 'Global / Selected Batches'),
        batch_code: row.batch_code || '',
        subject: parsedDetails.subject || (row.action === 'WELCOME_EMAILS_SENT' ? 'Welcome to Life Transformation Program' : 'Batch Email Notification'),
        template: parsedDetails.template || (row.action === 'WELCOME_EMAILS_SENT' ? 'Welcome Mail' : 'Orientation / Briefing'),
        recipient_count: parsedDetails.recipient_count || parsedDetails.notifiedCount || parsedDetails.recipientCount || 0,
        roles: parsedDetails.roles || ['student', 'faculty'],
        created_at: row.created_at,
        triggerSource: parsedDetails.triggerSource || 'MANUAL_ADMIN_ACTION'
      };
    });

    res.json({
      logs,
      queueEntries: queueRes.rows || [],
      stats: statsRes.rows[0] || {
        total_all: 0,
        total_delivered: 0,
        total_sent: 0,
        total_bounced: 0,
        total_failed: 0,
        total_pending: 0,
        total_processing: 0,
        total_paused: 0,
        total_stopped: 0
      }
    });
  } catch (err) {
    console.error('Error in getEmailLogs:', err);
    res.status(500).json({ message: 'Server error fetching email logs', error: err.message });
  }
};

const retryFailedEmails = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE email_queue 
       SET status='pending', attempts=0, error_message=NULL, bounce_reason=NULL, provider_status=NULL, next_run_at=NOW(), updated_at=NOW()
       WHERE status IN ('failed', 'permanent_fail', 'bounced', 'rejected', 'undeliverable', 'suppressed')
          OR provider_status IN ('SUPPRESSED', 'BOUNCED', 'REJECTED', 'FAILED', 'UNDELIVERABLE', 'COMPLAINED')
       RETURNING id`
    );
    res.json({ message: `Successfully re-queued ${result.rowCount} failed/bounced/suppressed emails for delivery.`, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retry queue', error: err.message });
  }
};

const retrySingleEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE email_queue 
       SET status='pending', attempts=0, error_message=NULL, bounce_reason=NULL, provider_status=NULL, next_run_at=NOW(), updated_at=NOW()
       WHERE id = $1 AND (status IN ('failed', 'permanent_fail', 'bounced', 'rejected', 'undeliverable', 'suppressed') OR provider_status IN ('SUPPRESSED', 'BOUNCED', 'REJECTED', 'FAILED', 'UNDELIVERABLE', 'COMPLAINED'))
       RETURNING id, to_email`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(400).json({ message: 'Email not found or is not in a failed/bounced state.' });
    }
    res.json({ message: `Successfully re-queued email for ${result.rows[0].to_email} for retry.`, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retry email', error: err.message });
  }
};

const pauseEmailQueue = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE email_queue 
       SET status='paused', updated_at=NOW()
       WHERE status='pending'
       RETURNING id`
    );
    res.json({ message: `Queue paused. ${result.rowCount} pending emails paused.`, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to pause queue', error: err.message });
  }
};

const resumeEmailQueue = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE email_queue 
       SET status='pending', next_run_at=NOW(), updated_at=NOW()
       WHERE status IN ('paused', 'stopped')
       RETURNING id`
    );
    res.json({ message: `Queue resumed. ${result.rowCount} emails resumed for delivery.`, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to resume queue', error: err.message });
  }
};

const stopEmailQueue = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE email_queue 
       SET status='stopped', updated_at=NOW()
       WHERE status IN ('pending', 'paused', 'processing')
       RETURNING id`
    );
    res.json({ message: `Queue stopped. ${result.rowCount} active emails stopped.`, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to stop queue', error: err.message });
  }
};

const clearEmailQueue = async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM email_queue RETURNING id`);
    res.json({ message: `Email queue and statistics reset. Cleared ${result.rowCount} entries.`, count: result.rowCount });
  } catch (err) {
    console.error('Error clearing email queue:', err);
    res.status(500).json({ message: 'Failed to reset email queue', error: err.message });
  }
};

// WhatsApp Controllers
const sendOrientationWhatsapp = async (req, res) => {
  const { id } = req.params;
  const { body, targetRoles } = req.body;

  if (!body) {
    return res.status(400).json({ message: 'Message body is required.' });
  }
  if (!targetRoles || !Array.isArray(targetRoles) || targetRoles.length === 0) {
    return res.status(400).json({ message: 'At least one role must be selected.' });
  }

  try {
    const queries = [];
    const params = [parseInt(id)];

    if (targetRoles.includes('student')) {
      queries.push(`
        SELECT u.id, u.name, u.phone, u.role, bs.squad, b.name as batch_name, b.start_date::text, b.end_date::text
        FROM batch_students bs
        JOIN users u ON bs.student_id = u.id
        JOIN batches b ON bs.batch_id = b.id
        WHERE bs.batch_id = $1 AND u.phone IS NOT NULL AND TRIM(u.phone) != ''
      `);
    }

    if (targetRoles.includes('faculty')) {
      queries.push(`
        SELECT u.id, u.name, u.phone, u.role, bf.squad, b.name as batch_name, b.start_date::text, b.end_date::text
        FROM batch_faculty bf
        JOIN users u ON bf.faculty_id = u.id
        JOIN batches b ON bf.batch_id = b.id
        WHERE bf.batch_id = $1 AND (u.role IS NULL OR u.role != 'ltc_member') AND u.phone IS NOT NULL AND TRIM(u.phone) != ''
      `);
    }

    if (targetRoles.includes('ltc_member')) {
      queries.push(`
        SELECT u.id, u.name, u.phone, u.role, bf.squad, b.name as batch_name, b.start_date::text, b.end_date::text
        FROM batch_faculty bf
        JOIN users u ON bf.faculty_id = u.id
        JOIN batches b ON bf.batch_id = b.id
        WHERE bf.batch_id = $1 
          AND u.role = 'ltc_member' 
          AND bf.squad IS NOT NULL AND TRIM(bf.squad) != ''
          AND u.designation ILIKE '%Squad Coordinator%'
          AND u.phone IS NOT NULL AND TRIM(u.phone) != ''
      `);
    }

    if (targetRoles.includes('parent')) {
      queries.push(`
        SELECT u.id, CONCAT('Parent of ', u.name) as name, u.parent_mobile as phone, 'parent' as role, bs.squad, b.name as batch_name, b.start_date::text, b.end_date::text
        FROM batch_students bs
        JOIN users u ON bs.student_id = u.id
        JOIN batches b ON bs.batch_id = b.id
        WHERE bs.batch_id = $1 AND u.parent_mobile IS NOT NULL AND TRIM(u.parent_mobile) != ''
      `);
    }

    if (queries.length === 0) {
      return res.status(400).json({ message: 'Please select at least one recipient group.' });
    }

    const unifiedQuery = queries.join(' UNION ALL ');
    const usersRes = await pool.query(unifiedQuery, params);

    if (usersRes.rowCount === 0) {
      return res.status(400).json({ message: 'No recipients with phone numbers found for the selected roles in this batch.' });
    }

    // Deduplicate recipients by phone to guarantee single dispatch per recipient
    const seenPhones = new Set();
    const uniqueUsers = [];
    for (const u of usersRes.rows) {
      if (u.phone && !seenPhones.has(u.phone)) {
        seenPhones.add(u.phone);
        uniqueUsers.push(u);
      }
    }

    const { queueWhatsapp } = require('../config/whatsappQueue');
    const portalLoginUrl = process.env.PORTAL_LOGIN_URL || (req.get('host') ? `${req.protocol}://${req.get('host')}/login` : 'http://13.207.119.57/login');

    for (const u of uniqueUsers) {
      const startDateStr = u.start_date ? new Date(u.start_date).toLocaleDateString() : 'N/A';
      const endDateStr = u.end_date ? new Date(u.end_date).toLocaleDateString() : 'N/A';
      const defaultPassword = u.role === 'student' ? 'student123' : (u.role === 'ltc_member' ? 'ltc123' : 'faculty123');
      const roleName = u.role === 'student' ? 'Student' : (u.role === 'ltc_member' ? 'LTC Member' : (u.role === 'parent' ? 'Parent' : 'Faculty'));

      // Conditionally filter role-based content
      let recipientBody = body;
      if (u.role !== 'faculty') {
        recipientBody = recipientBody.replace(/Faculty Instructions:\s*(\n\s*•[^\n]*)+/gi, '');
        recipientBody = recipientBody.replace(/\n{3,}/g, '\n\n').trim();
      }

      // Function to replace placeholders
      const replaceVars = (str) => {
        const squadDisplay = (u.squad && u.squad !== 'LTC Admin') ? u.squad : 'Surya';
        const deadlineVal = req.body.deadline || (req.body.extraFieldValues && req.body.extraFieldValues.deadline) || '';
        let resStr = str
          .replace(/{{name}}/g, u.name || '')
          .replace(/{{role}}/g, roleName)
          .replace(/{{batch_name}}/g, u.batch_name || '')
          .replace(/{{squad}}/g, squadDisplay)
          .replace(/{{phone}}/g, u.phone || '')
          .replace(/{{password}}/g, defaultPassword)
          .replace(/{{start_date}}/g, startDateStr)
          .replace(/{{end_date}}/g, endDateStr)
          .replace(/{{login_url}}/g, portalLoginUrl);
        if (deadlineVal) {
          resStr = resStr.replace(/{{deadline}}/g, deadlineVal);
        }
        return resStr;
      };

      const personalizedBody = replaceVars(recipientBody);

      await queueWhatsapp(u.phone, personalizedBody);
    }

    writeAudit(req.user.id, req.user.name || 'Admin', 'ORIENTATION_WHATSAPP_SENT', 'batch', parseInt(id), { body: body.substring(0, 100) + '...', recipient_count: uniqueUsers.length, targetRoles });

    res.json({ message: `WhatsApp messages queued successfully for ${uniqueUsers.length} recipients.` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getWhatsappLogs = async (req, res) => {
  try {
    const auditRes = await pool.query(
      `SELECT a.id, a.user_id, a.user_name, a.action, a.entity_id as batch_id, a.details, a.created_at,
              b.name as batch_name, b.batch_code
       FROM audit_logs a
       LEFT JOIN batches b ON a.entity_id = b.id AND a.entity_type = 'batch'
       WHERE a.action IN ('ORIENTATION_WHATSAPP_SENT', 'WHATSAPP_DISPATCH_MANUAL', 'WHATSAPP_SCHEDULED')
       ORDER BY a.created_at DESC
       LIMIT 1000`
    );

    const statsRes = await pool.query(
      `SELECT 
         (COALESCE((SELECT COUNT(*) FROM whatsapp_campaign_logs), 0) + COALESCE((SELECT COUNT(*) FROM whatsapp_queue WHERE status NOT IN ('sent', 'failed', 'permanent_fail')), 0))::int as total_all,
         (COALESCE((SELECT COUNT(*) FROM whatsapp_campaign_logs WHERE status='sent'), 0) + COALESCE((SELECT COUNT(*) FROM whatsapp_queue WHERE status='sent'), 0))::int as total_sent,
         (COALESCE((SELECT COUNT(*) FROM whatsapp_queue WHERE status='pending'), 0))::int as total_pending,
         (COALESCE((SELECT COUNT(*) FROM whatsapp_campaign_logs WHERE status='failed'), 0) + COALESCE((SELECT COUNT(*) FROM whatsapp_queue WHERE status IN ('failed', 'permanent_fail')), 0))::int as total_failed,
         (COALESCE((SELECT COUNT(*) FROM whatsapp_queue WHERE status='paused'), 0))::int as total_paused,
         (COALESCE((SELECT COUNT(*) FROM whatsapp_queue WHERE status='stopped'), 0))::int as total_stopped`
    );

    const logs = auditRes.rows.map(row => {
      let parsedDetails = {};
      try {
        parsedDetails = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
      } catch (e) {
        parsedDetails = { raw: row.details };
      }
      return {
        id: row.id,
        user_name: row.user_name || 'Admin',
        action: row.action,
        batch_id: row.batch_id,
        batch_name: row.batch_name || parsedDetails.batch_name || (row.batch_id ? `Batch #${row.batch_id}` : 'Global / Selected Batches'),
        batch_code: row.batch_code || '',
        subject: 'WhatsApp Dispatch',
        body: parsedDetails.body || 'WhatsApp Notification',
        template: parsedDetails.template || 'Orientation / Briefing',
        recipient_count: parsedDetails.recipient_count || parsedDetails.notifiedCount || parsedDetails.recipientCount || 0,
        roles: parsedDetails.targetRoles || ['student', 'faculty'],
        created_at: row.created_at,
        triggerSource: parsedDetails.triggerSource || 'MANUAL_ADMIN_ACTION'
      };
    });

    res.json({
      logs,
      stats: statsRes.rows[0] || { total_all: 0, total_sent: 0, total_pending: 0, total_failed: 0, total_paused: 0, total_stopped: 0 }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const retryFailedWhatsapp = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE whatsapp_queue 
       SET status='pending', attempts=0, error_message=NULL, next_run_at=NOW(), updated_at=NOW()
       WHERE status IN ('failed', 'permanent_fail')
       RETURNING id`
    );
    res.json({ message: `Successfully re-queued ${result.rowCount} failed WhatsApp messages for delivery.`, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retry queue', error: err.message });
  }
};

const retrySingleWhatsapp = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE whatsapp_queue 
       SET status='pending', attempts=0, error_message=NULL, next_run_at=NOW(), updated_at=NOW()
       WHERE id = $1 AND status IN ('failed', 'permanent_fail')
       RETURNING id, to_phone`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(400).json({ message: 'WhatsApp message not found or is not in a failed state.' });
    }
    res.json({ message: `Successfully re-queued WhatsApp message for ${result.rows[0].to_phone} for retry.`, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retry WhatsApp message', error: err.message });
  }
};

const pauseWhatsappQueue = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE whatsapp_queue 
       SET status='paused', updated_at=NOW()
       WHERE status='pending'
       RETURNING id`
    );
    res.json({ message: `Queue paused. ${result.rowCount} pending messages paused.`, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to pause queue', error: err.message });
  }
};

const resumeWhatsappQueue = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE whatsapp_queue 
       SET status='pending', next_run_at=NOW(), updated_at=NOW()
       WHERE status IN ('paused', 'stopped')
       RETURNING id`
    );
    res.json({ message: `Queue resumed. ${result.rowCount} messages resumed for delivery.`, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to resume queue', error: err.message });
  }
};

const stopWhatsappQueue = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE whatsapp_queue 
       SET status='stopped', updated_at=NOW()
       WHERE status IN ('pending', 'paused', 'processing')
       RETURNING id`
    );
    res.json({ message: `Queue stopped. ${result.rowCount} active messages stopped.`, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to stop queue', error: err.message });
  }
};

const getBatchAbsenteesSnapshot = async (req, res) => {
  const { id } = req.params;
  try {
    const batchId = parseInt(id, 10);
    const result = await pool.query(
      "SELECT * FROM batch_absentees_snapshots WHERE batch_id = $1",
      [batchId]
    );

    // Check if Day 5 attendance has been recorded, or batch is completed / ended
    const day5Check = await pool.query(
      `SELECT (
        EXISTS (SELECT 1 FROM attendance WHERE batch_id = $1 AND day = 5)
        OR EXISTS (SELECT 1 FROM batches WHERE id = $1 AND (status = 'completed' OR (end_date IS NOT NULL AND CURRENT_DATE >= end_date)))
      ) as is_day5_ended`,
      [batchId]
    );
    const isDay5Ended = Boolean(day5Check.rows[0]?.is_day5_ended);

    if (result.rowCount === 0) {
      // Dynamic Absentee Rule:
      // Criteria 1: Marked as DNR (Did Not Report) by Squad Coordinator (Permanent absentee from Day 1)
      // Criteria 2: Went to LTC, but at the end of Day 5, attendance < 30%
      const liveAbsentRes = await pool.query(
        `SELECT 
           u.id, u.prn, u.name, u.email, u.phone, u.gender, u.school, u.faculty, u.department, u.division, u.panel, bs.squad,
           bs.is_dnr, bs.dnr_marked_at, bs.dnr_marked_by_name, bs.dnr_reason,
           u.is_locked,
           COALESCE(att.present_count, 0) as present_count,
           COALESCE(att.total_count, 0) as total_count,
           ROUND((COALESCE(att.present_count, 0)::float / NULLIF(att.total_count, 0)::float * 100)::numeric, 1) as attendance_percentage
         FROM batch_students bs
         JOIN users u ON bs.student_id = u.id
         LEFT JOIN (
           SELECT 
             student_id,
             COUNT(CASE WHEN LOWER(status) IN ('present', 'late') THEN 1 END) as present_count,
             COUNT(*) as total_count
           FROM (
             SELECT student_id, status, pillar, day
             FROM attendance
             WHERE batch_id = $1
             UNION ALL
             SELECT student_id, status, 'session_' || session_id as pillar, 1 as day
             FROM attendance_records_v2
             WHERE batch_id = $1
           ) combined
           GROUP BY student_id
         ) att ON att.student_id = u.id
         WHERE bs.batch_id = $1
           AND (
             -- Criteria 1: Marked as DNR by squad coordinator (Always included from Day 1)
             bs.is_dnr = true
             -- Criteria 2: Went to LTC, but attendance < 30% at the end of Day 5
             OR (
               $2 = true 
               AND (
                 att.total_count > 0 
                 AND (COALESCE(att.present_count, 0)::float / att.total_count::float * 100) < 30.0
               )
             )
           )
         ORDER BY bs.is_dnr DESC, u.name ASC`,
        [batchId, isDay5Ended]
      );

      // Also get attendance metrics for all students in this batch who have tracked attendance
      const allBatchAttRes = await pool.query(
        `SELECT 
           u.id,
           u.is_locked,
           bs.is_dnr,
           COALESCE(att.present_count, 0) as present_count,
           COALESCE(att.total_count, 0) as total_count,
           ROUND((COALESCE(att.present_count, 0)::float / NULLIF(att.total_count, 0)::float * 100)::numeric, 1) as attendance_percentage
         FROM batch_students bs
         JOIN users u ON bs.student_id = u.id
         LEFT JOIN (
           SELECT 
             student_id,
             COUNT(CASE WHEN LOWER(status) IN ('present', 'late') THEN 1 END) as present_count,
             COUNT(*) as total_count
           FROM (
             SELECT student_id, status, pillar, day
             FROM attendance
             WHERE batch_id = $1
             UNION ALL
             SELECT student_id, status, 'session_' || session_id as pillar, 1 as day
             FROM attendance_records_v2
             WHERE batch_id = $1
           ) combined
           GROUP BY student_id
         ) att ON att.student_id = u.id
         WHERE bs.batch_id = $1`,
        [batchId]
      );

      const attendanceMap = {};
      allBatchAttRes.rows.forEach(r => {
        attendanceMap[r.id] = {
          attendance_percentage: Number(r.attendance_percentage || 0),
          present_count: parseInt(r.present_count || 0, 10),
          total_count: parseInt(r.total_count || 0, 10),
          is_locked: !!r.is_locked,
          is_dnr: !!r.is_dnr
        };
      });

      const liveAbsentees = liveAbsentRes.rows.map(s => ({
        student_id: s.id,
        id: s.id,
        prn: s.prn || '',
        name: s.name || '',
        email: s.email || '',
        gender: s.gender || '—',
        division: s.division || '—',
        school: s.school || '—',
        faculty: s.faculty || s.department || '—',
        department: s.department || '—',
        panel: s.panel || '—',
        squad: s.squad || '—',
        phone: s.phone || '—',
        is_absent: true,
        is_dnr: !!s.is_dnr,
        dnr_marked_at: s.dnr_marked_at,
        dnr_marked_by_name: s.dnr_marked_by_name,
        dnr_reason: s.dnr_reason,
        absentee_type: s.is_dnr ? 'DNR (Did Not Report)' : 'Low Attendance (<30%)',
        is_locked: !!s.is_locked,
        attendance_percentage: Number(s.attendance_percentage || 0),
        present_count: parseInt(s.present_count || 0, 10),
        total_count: parseInt(s.total_count || 0, 10)
      }));

      return res.json({ exists: false, snapshot: null, liveAbsentees, attendanceMap, isDay5Ended });
    }

    // For existing saved snapshots, look up current is_locked and is_dnr from batch_students/users
    const snapshot = result.rows[0];
    const studentIds = (snapshot.students || []).map(s => s.id || s.student_id).filter(Boolean);
    if (studentIds.length > 0) {
      const lockedRes = await pool.query(
        "SELECT id, is_locked, gender FROM users WHERE id = ANY($1)",
        [studentIds]
      );
      const userMap = {};
      lockedRes.rows.forEach(r => { userMap[r.id] = r; });

      const dnrRes = await pool.query(
        "SELECT student_id, is_dnr, dnr_marked_at, dnr_marked_by_name, dnr_reason FROM batch_students WHERE batch_id = $1 AND student_id = ANY($2)",
        [batchId, studentIds]
      );
      const dnrMap = {};
      dnrRes.rows.forEach(r => { dnrMap[r.student_id] = r; });

      snapshot.students = snapshot.students.map(s => {
        const sid = s.id || s.student_id;
        const dnrInfo = dnrMap[sid];
        const userInfo = userMap[sid];
        const isDnr = dnrInfo ? !!dnrInfo.is_dnr : !!s.is_dnr;
        return {
          ...s,
          gender: s.gender || userInfo?.gender || '—',
          is_dnr: isDnr,
          dnr_marked_at: dnrInfo?.dnr_marked_at || s.dnr_marked_at,
          dnr_marked_by_name: dnrInfo?.dnr_marked_by_name || s.dnr_marked_by_name,
          dnr_reason: dnrInfo?.dnr_reason || s.dnr_reason,
          absentee_type: isDnr ? 'DNR (Did Not Report)' : (s.absentee_type || (s.attendance_percentage < 30 ? 'Low Attendance (<30%)' : 'Absentee')),
          is_locked: userInfo?.is_locked !== undefined ? !!userInfo.is_locked : !!s.is_locked
        };
      });
    }
    return res.json({ exists: true, snapshot, isDay5Ended });
  } catch (err) {
    console.error("Error fetching absentees snapshot:", err);
    res.status(500).json({ message: "Server error fetching absentees snapshot", error: err.message });
  }
};

const saveBatchAbsenteesSnapshot = async (req, res) => {
  const { id } = req.params;
  const { students, allow_overwrite } = req.body;
  const batchId = parseInt(id, 10);

  if (!Array.isArray(students)) {
    return res.status(400).json({ message: "students payload must be an array" });
  }

  try {
    const batchRes = await pool.query("SELECT id, name FROM batches WHERE id = $1", [batchId]);
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: "Batch not found" });
    }
    const batchName = batchRes.rows[0].name;

    const existingRes = await pool.query("SELECT id FROM batch_absentees_snapshots WHERE batch_id = $1", [batchId]);
    if (existingRes.rowCount > 0 && !allow_overwrite) {
      return res.status(400).json({
        message: "Absentees Snapshot already saved and is immutable for this batch.",
        exists: true
      });
    }

    const totalStudents = students.length;
    const totalAbsentees = students.filter(s => s.is_absent).length;
    const adminId = req.user ? req.user.id : null;
    const adminName = req.user ? (req.user.name || req.user.email) : 'Admin';

    const sanitizedStudents = students.map(s => ({
      student_id: s.id || s.student_id || null,
      prn: String(s.prn || '').trim(),
      name: String(s.name || '').trim(),
      email: String(s.email || '').trim(),
      squad: s.squad || '—',
      panel: s.panel || '—',
      division: s.division || '—',
      school: s.school || '—',
      faculty: s.faculty || s.department || '—',
      department: s.department || '—',
      phone: s.phone || s.emergency_contact_mobile || s.parent_mobile || '—',
      semester: s.semester || '—',
      program: s.program || '—',
      gender: s.gender || '—',
      roll_number: s.roll_number || '—',
      is_absent: !!s.is_absent,
      is_dnr: !!s.is_dnr,
      dnr_marked_at: s.dnr_marked_at || null,
      dnr_marked_by_name: s.dnr_marked_by_name || null,
      dnr_reason: s.dnr_reason || null,
      absentee_type: s.is_dnr ? 'DNR (Did Not Report)' : (s.absentee_type || (s.attendance_percentage < 30 ? 'Low Attendance (<30%)' : 'Absentee')),
      attendance_percentage: s.attendance_percentage !== undefined ? s.attendance_percentage : null,
      marked_at: s.marked_at || new Date().toISOString()
    }));

    let savedSnapshot;
    if (existingRes.rowCount > 0 && allow_overwrite) {
      const updateRes = await pool.query(
        `UPDATE batch_absentees_snapshots
         SET batch_name = $1, created_by = $2, created_by_name = $3,
             total_students = $4, total_absentees = $5, students = $6::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE batch_id = $7
         RETURNING *`,
        [batchName, adminId, adminName, totalStudents, totalAbsentees, JSON.stringify(sanitizedStudents), batchId]
      );
      savedSnapshot = updateRes.rows[0];
    } else {
      const insertRes = await pool.query(
        `INSERT INTO batch_absentees_snapshots
         (batch_id, batch_name, created_by, created_by_name, total_students, total_absentees, students)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING *`,
        [batchId, batchName, adminId, adminName, totalStudents, totalAbsentees, JSON.stringify(sanitizedStudents)]
      );
      savedSnapshot = insertRes.rows[0];
    }

    res.json({
      message: "Absentees Snapshot saved successfully.",
      snapshot: savedSnapshot
    });
  } catch (err) {
    console.error("Error saving absentees snapshot:", err);
    res.status(500).json({ message: "Server error saving absentees snapshot", error: err.message });
  }
};

const lockStudentAccount = async (req, res) => {
  const { id } = req.params;
  try {
    const studentId = parseInt(id, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    if (studentId === req.user.id) {
      return res.status(400).json({ message: "You cannot lock your own account" });
    }

    const userRes = await pool.query(
      "SELECT id, name, email, prn, role, is_locked FROM users WHERE id = $1",
      [studentId]
    );
    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: "Student account not found" });
    }

    const targetUser = userRes.rows[0];
    if (targetUser.role !== 'student') {
      return res.status(400).json({ message: "Only student accounts can be locked from this action" });
    }

    // Idempotent check: if already locked, return safely without modifying database
    if (targetUser.is_locked) {
      return res.json({
        message: `Account for ${targetUser.name} is already locked.`,
        alreadyLocked: true,
        studentId: targetUser.id,
        is_locked: true
      });
    }

    await pool.query("UPDATE users SET is_locked = true WHERE id = $1", [studentId]);

    writeAudit(
      req.user.id,
      req.user.name || "Admin",
      "USER_LOCK",
      "users",
      studentId,
      { name: targetUser.name, email: targetUser.email, prn: targetUser.prn, source: "ABSENTEES_MANAGEMENT" }
    );

    return res.json({
      message: `Account for ${targetUser.name} (${targetUser.prn || targetUser.email}) has been locked successfully.`,
      studentId: targetUser.id,
      is_locked: true
    });
  } catch (err) {
    console.error("Error locking student account:", err);
    return res.status(500).json({ message: "Server error locking student account", error: err.message });
  }
};

const getSenderConsoleDocuments = async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');

    const systemDocs = [
      {
        id: 'participants_pdf',
        name: 'Participant Undertaking & Guidelines',
        filename: 'Participants.pdf',
        file_type: 'PDF Document',
        mime_type: 'application/pdf',
        relative_path: 'frontend/public/documents/Participants.pdf',
        url: '/documents/Participants.pdf'
      },
      {
        id: 'faculty_pdf',
        name: 'Faculty Guide & Instructions',
        filename: 'Faculty.pdf',
        file_type: 'PDF Document',
        mime_type: 'application/pdf',
        relative_path: 'frontend/public/documents/Faculty.pdf',
        url: '/documents/Faculty.pdf'
      },
      {
        id: 'kho_pdf',
        name: 'LTC Schedule & Activity Rules',
        filename: 'kho.pdf',
        file_type: 'PDF Document',
        mime_type: 'application/pdf',
        relative_path: 'frontend/public/documents/kho.pdf',
        url: '/documents/kho.pdf'
      },
      {
        id: 'items_to_carry_docx',
        name: 'Items to Carry for Life Awakening Program',
        filename: 'Items to Carry for the Life Realisation Program.docx',
        file_type: 'Word Document',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        relative_path: 'frontend/public/documents/Items to Carry for the Life Realisation Program.docx',
        url: '/documents/Items to Carry for the Life Realisation Program.docx'
      },
      {
        id: 'dos_and_donts_docx',
        name: "Student Do's and Don'ts",
        filename: "Student-Do's and Don'ts.docx",
        file_type: 'Word Document',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        relative_path: "frontend/public/documents/Student-Do's and Don'ts.docx",
        url: "/documents/Student-Do's and Don'ts.docx"
      },
      {
        id: 'undertaking_form_docx',
        name: 'Student Undertaking Form (Updated LAP)',
        filename: 'STUDENT UNDERTAKING FORM Updated LRP.docx',
        file_type: 'Word Document',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        relative_path: 'frontend/public/documents/STUDENT UNDERTAKING FORM Updated LRP.docx',
        url: '/documents/STUDENT UNDERTAKING FORM Updated LRP.docx'
      }
    ];

    const catalog = systemDocs.map(doc => {
      let size = 0;
      try {
        const fullPath = path.resolve(__dirname, '../../', doc.relative_path);
        if (fs.existsSync(fullPath)) {
          size = fs.statSync(fullPath).size;
        }
      } catch (e) { }
      return {
        ...doc,
        size
      };
    });

    let dbDocs = [];
    try {
      const resDb = await pool.query("SELECT id, name, url, file_type, description FROM documents ORDER BY id DESC LIMIT 50");
      dbDocs = resDb.rows.map(r => ({
        id: `db_${r.id}`,
        name: r.name,
        filename: path.basename(r.url || r.name),
        file_type: r.file_type || 'Document',
        url: r.url,
        source: 'database'
      }));
    } catch (e) { }

    res.json({
      systemDocuments: catalog,
      customDocuments: dbDocs
    });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving documents', error: err.message });
  }
};

const getSenderConsoleDocumentContent = async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { docId } = req.params;

    const fileMap = {
      participants_pdf: 'frontend/public/documents/Participants.pdf',
      faculty_pdf: 'frontend/public/documents/Faculty.pdf',
      kho_pdf: 'frontend/public/documents/kho.pdf',
      items_to_carry_docx: 'frontend/public/documents/Items to Carry for the Life Realisation Program.docx',
      dos_and_donts_docx: "frontend/public/documents/Student-Do's and Don'ts.docx",
      undertaking_form_docx: 'frontend/public/documents/STUDENT UNDERTAKING FORM Updated LRP.docx'
    };

    const relPath = fileMap[docId];
    if (!relPath) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const fullPath = path.resolve(__dirname, '../../', relPath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'File does not exist on server disk' });
    }

    const fileBuffer = fs.readFileSync(fullPath);
    const base64Content = fileBuffer.toString('base64');
    const filename = path.basename(fullPath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    res.json({
      filename,
      content: base64Content,
      mimeType,
      size: fileBuffer.length
    });
  } catch (err) {
    res.status(500).json({ message: 'Error loading document content', error: err.message });
  }
};

const getCommunicationTemplates = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, template_key, name, category, subject, body_html as body, variables, updated_at 
       FROM email_templates 
       WHERE template_key IS NOT NULL AND is_active = true 
       ORDER BY id ASC`
    );
    res.json({ templates: result.rows });
  } catch (err) {
    console.error('Error fetching communication templates:', err);
    res.status(500).json({ message: 'Error fetching communication templates', error: err.message });
  }
};

const saveCommunicationTemplate = async (req, res) => {
  try {
    const { templateKey } = req.params;
    const { name, subject, body, variables } = req.body;

    if (!templateKey || !templateKey.trim()) {
      return res.status(400).json({ message: 'Template key is required.' });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: 'Template subject is required.' });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ message: 'Template email body is required.' });
    }

    const templateName = (name && name.trim()) || templateKey;
    const varsJson = JSON.stringify(Array.isArray(variables) ? variables : []);

    const query = `
      INSERT INTO email_templates (template_key, name, category, subject, body_html, variables, is_active, created_by, updated_at)
      VALUES ($1, $2, 'communication', $3, $4, $5::jsonb, true, $6, NOW())
      ON CONFLICT (template_key) DO UPDATE SET
        name = EXCLUDED.name,
        subject = EXCLUDED.subject,
        body_html = EXCLUDED.body_html,
        variables = EXCLUDED.variables,
        is_active = true,
        updated_at = NOW()
      RETURNING id, template_key, name, category, subject, body_html as body, variables, updated_at;
    `;

    const result = await pool.query(query, [
      templateKey.trim(),
      templateName,
      subject.trim(),
      body.trim(),
      varsJson,
      req.user?.id || null
    ]);

    const savedTemplate = result.rows[0];

    try {
      writeAudit(req.user?.id || 0, req.user?.name || 'Admin', 'EMAIL_TEMPLATE_SAVE', 'email_templates', savedTemplate.id, {
        template_key: templateKey,
        name: templateName,
        subject: subject.trim()
      });
    } catch (auditErr) {
      console.warn('Audit log write failed for email template save:', auditErr.message);
    }

    res.json({
      message: 'Template saved successfully',
      template: savedTemplate
    });
  } catch (err) {
    console.error('Error saving communication template:', err);
    res.status(500).json({ message: 'Error saving communication template', error: err.message });
  }
};

const restoreCommunicationTemplateDefault = async (req, res) => {
  try {
    const { templateKey } = req.params;
    if (!templateKey || !templateKey.trim()) {
      return res.status(400).json({ message: 'Template key is required.' });
    }

    const result = await pool.query(
      'DELETE FROM email_templates WHERE template_key = $1 RETURNING id, name',
      [templateKey.trim()]
    );

    try {
      writeAudit(req.user?.id || 0, req.user?.name || 'Admin', 'EMAIL_TEMPLATE_RESTORE_DEFAULT', 'email_templates', result.rows[0]?.id || 0, {
        template_key: templateKey
      });
    } catch (auditErr) {
      console.warn('Audit log write failed for restore default:', auditErr.message);
    }

    res.json({
      message: 'Template restored to default successfully',
      deletedCount: result.rowCount
    });
  } catch (err) {
    console.error('Error restoring communication template default:', err);
    res.status(500).json({ message: 'Error restoring communication template default', error: err.message });
  }
};

module.exports = {
  getBatchAbsenteesSnapshot,
  saveBatchAbsenteesSnapshot,
  lockStudentAccount,
  getFeedbackAnalytics,
  assignRedFlag,
  resolveRedFlag,
  reopenRedFlag,
  getRedFlagDetails,
  addRedFlagComment,
  getAttendanceAnalytics,
  getFiles,
  uploadFileVersion,
  getFileVersions,
  deleteFile,
  getAdminRedFlags,
  createFaculty,
  createStudent,
  getStudents,
  getFacultyList,
  getFilterOptions,
  getBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  requestBatchDeleteOtp,
  restoreBatch,
  sendOrientationEmail,
  sendManualEmail,
  getOrientationRecipients,
  getBatchDetails,
  getBatchStudents,
  getBatchStudentsExport,
  getBatchStudentsBreakdown,
  getBatchHardCopyPdf,
  getBatchAttendanceErpExcel,
  addBatchStudents,
  removeBatchStudent,
  addOneBatchStudent,
  getBatchFaculty,
  addBatchFaculty,
  removeBatchFaculty,
  batchBulkUpload,
  enrollExistingBatchUsers,
  getBatchSquads,
  getBatchUnavailableRooms,
  updateBatchUnavailableRooms,
  autoAllocateBatchSquads,
  autoAllocateBatchRooms,
  updateBatchStudentSquad,
  updateBatchFacultySquad,
  lockBatchSquads,
  notifyBatchSquads,
  getDashboard,
  getUsers,
  updatePanel,
  updateDivision,
  updateInsurance,
  validateBulkUpload,
  globalBulkUpload,
  getUploadJobStatus,
  getUserProfile,
  updateUserProfile,
  autoAllocateRoomsSquads,
  bulkInsurance,
  getUserByBarcode,
  getFeedback,
  getAuditLogs,
  getEmailLogs,
  retryFailedEmails,
  retrySingleEmail,
  pauseEmailQueue,
  resumeEmailQueue,
  stopEmailQueue,
  clearEmailQueue,
  sendOrientationWhatsapp,
  getWhatsappLogs,
  retryFailedWhatsapp,
  retrySingleWhatsapp,
  pauseWhatsappQueue,
  resumeWhatsappQueue,
  stopWhatsappQueue,
  getAvailableBatchRooms,
  updateStudentRoom,
  deleteUser,
  resetDatabase,
  getCurrentBatch,
  setCurrentBatch,
  toggleStudentBatch,
  clearCurrentBatch,
  getSquadAllocationState,
  lockSquads,
  unlockSquads,
  shuffleSquads,
  previewHierarchy,
  assignHierarchyToBatch,
  getRedFlags,
  bulkVerifyBatchFaculty,
  getAllJourneyMedia,
  deleteJourneyMedia,
  updateTranslation,
  deleteTranslation,
  globalSearch,
  parseExcelDate,
  mapOfficialHeaders,
  OFFICIAL_HEADER_MAP,
  parseExcelSheetSmart,
  getSenderConsoleDocuments,
  getSenderConsoleDocumentContent,
  getCommunicationTemplates,
  saveCommunicationTemplate,
  restoreCommunicationTemplateDefault,
  processLifeAwakeningStudentUploadJob,
  detectTemplateType
};
