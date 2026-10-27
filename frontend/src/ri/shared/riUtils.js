/**
 * Utility helpers for Rural Immersion (RI) module
 */

/**
 * Ensures panel names display ONLY the clean panel name (e.g., "SY R&A Div 1"),
 * completely stripping out prefixes like "Panel 1 — ", "Panel 1: ", "Panel 1 - ", "P1: ", etc.
 * 
 * @param {string|null|undefined} name
 * @returns {string}
 */
export const cleanPanelName = (name) => {
  if (!name) return 'Unassigned';
  const str = String(name).trim();
  if (str === '—' || str === '-' || str.toLowerCase() === 'unassigned') return 'Unassigned';
  const cleaned = str.replace(/^(Panel\s+\d+\s*[-—:]\s*|P\d+\s*[-—:]\s*)/i, '').trim();
  return cleaned || str;
};

export const RI_ACTIVITIES_LIST = [
  { key: 'SCHOOL_ACTIVITY', label: 'School Activity', short: 'School', shortLabel: 'School', description: 'School engagement & educational outreach' },
  { key: 'INSTITUTIONAL_VISIT', label: 'Institutional Visit', short: 'Inst. Visit', shortLabel: 'Inst. Visit', description: 'Visits to GP, PHC, Anganwadi, Banks' },
  { key: 'FAMILY_SURVEY', label: 'Family Visit', short: 'Family Visit', shortLabel: 'Family Visit', description: 'Door-to-door household socio-economic visits' },
  { key: 'COMMUNITY_PROJECT', label: 'Community Project', short: 'Community', shortLabel: 'Community', description: 'Community problem solving & Shramdaan' }
];

export const RI_ACTIVITIES = RI_ACTIVITIES_LIST;

export const formatRiDate = (dateVal) => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(dateVal);
  }
};

export default {
  cleanPanelName,
  RI_ACTIVITIES_LIST,
  RI_ACTIVITIES,
  formatRiDate
};
