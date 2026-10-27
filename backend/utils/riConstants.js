/**
 * Official Rural Immersion (RI) System Constants
 */

const RI_ACTIVITIES = [
  {
    key: 'SCHOOL_ACTIVITY',
    label: 'School Activity',
    shortLabel: 'School',
    description: 'Classroom teaching, awareness workshops, and interactive school engagement.'
  },
  {
    key: 'INSTITUTIONAL_VISIT',
    label: 'Institutional Visit',
    shortLabel: 'Institutions',
    description: 'Field visits and interviews at Gram Panchayat, PHC, Anganwadi, and cooperatives.'
  },
  {
    key: 'FAMILY_SURVEY',
    label: 'Family Visit',
    shortLabel: 'Family Visit',
    description: 'Household demographic, livelihood, healthcare, and socio-economic visit.'
  },
  {
    key: 'COMMUNITY_PROJECT',
    label: 'Community Project',
    shortLabel: 'Community Project',
    description: 'Hands-on village improvement interventions, cleanliness, or awareness drives.'
  }
];

const RI_ACTIVITY_KEYS = RI_ACTIVITIES.map(a => a.key);

const RI_ACTIVITY_KEY_MAP = {
  'SCHOOL_ACTIVITY': 'SCHOOL_ACTIVITY',
  'INSTITUTIONAL_VISIT': 'INSTITUTIONAL_VISIT',
  'FAMILY_SURVEY': 'FAMILY_SURVEY',
  'FAMILY_VISIT': 'FAMILY_SURVEY',
  'COMMUNITY_PROJECT': 'COMMUNITY_PROJECT',
  'school_activity': 'SCHOOL_ACTIVITY',
  'institutional_visit': 'INSTITUTIONAL_VISIT',
  'family_survey': 'FAMILY_SURVEY',
  'family_visit': 'FAMILY_SURVEY',
  'community_project': 'COMMUNITY_PROJECT',
  'day1': 'SCHOOL_ACTIVITY',
  'day2': 'INSTITUTIONAL_VISIT',
  'day3': 'FAMILY_SURVEY',
  'day4': 'COMMUNITY_PROJECT',
  'Day 1': 'SCHOOL_ACTIVITY',
  'Day 2': 'INSTITUTIONAL_VISIT',
  'Day 3': 'FAMILY_SURVEY',
  'Day 4': 'COMMUNITY_PROJECT',
  'School Activity': 'SCHOOL_ACTIVITY',
  'Institutional Visit': 'INSTITUTIONAL_VISIT',
  'Family Survey': 'FAMILY_SURVEY',
  'Family Visit': 'FAMILY_SURVEY',
  'Community Project': 'COMMUNITY_PROJECT',
};

const normalizeRiActivityKey = (raw) => {
  if (!raw) return 'SCHOOL_ACTIVITY';
  if (typeof raw === 'object') {
    if (raw.key) return raw.key;
    if (raw.activity) return normalizeRiActivityKey(raw.activity);
  }
  const str = String(raw).trim();
  return RI_ACTIVITY_KEY_MAP[str] || RI_ACTIVITY_KEY_MAP[str.toUpperCase()] || str;
};

const RI_ACTIVITY_MAP = RI_ACTIVITIES.reduce((acc, a) => {
  acc[a.key] = a;
  return acc;
}, {});

const RI_ACTIVITY_LABEL_MAP = RI_ACTIVITIES.reduce((acc, a) => {
  acc[a.key] = a.label;
  return acc;
}, {});

module.exports = {
  RI_ACTIVITIES,
  RI_ACTIVITY_KEYS,
  RI_ACTIVITY_KEY_MAP,
  RI_ACTIVITY_MAP,
  RI_ACTIVITY_LABEL_MAP,
  normalizeRiActivityKey
};

