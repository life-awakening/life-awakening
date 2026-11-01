/**
 * Flexible Class / Standard Normalizer Utility for Life Awakening & Higher Ed Workflows
 * Supports school classes ('1st' through '12th'), college/university degrees (e.g., 'MSC', 'BSC', 'B.Tech', 'MBA', etc.),
 * and custom educational streams.
 */

const CANONICAL_CLASSES = [
  '6th', '7th', '8th', '9th', '10th', '11th', '12th',
  'MSC', 'BSC', 'B.Tech', 'M.Tech', 'MBA', 'MCA', 'BBA', 'B.Com', 'BA', 'MA', 'PhD', 'Other'
];

function getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Normalizes input class/standard string into canonical value:
 * e.g., '6', '6th', 'Class 6', 'Class 6th', 'Grade 6', 'Std 6' -> '6th'
 * e.g., 'msc', 'MSC', 'M.Sc.', 'M.Sc' -> 'MSC'
 * Flexible: normalizes school and higher-ed degrees, and accepts custom classes while rejecting empty/placeholder values.
 */
function normalizeClassGrade(val) {
  if (val === undefined || val === null) return null;
  const rawStr = String(val).trim();
  if (!rawStr) return null;

  const lower = rawStr.toLowerCase();

  // Disallow placeholders that mean no data
  if (['na', 'n/a', 'none', 'null', '-', '--', 'undefined', 'not specified'].includes(lower)) {
    return null;
  }

  // 1. Check numeric / ordinal school standards (e.g. 1 through 12)
  const clean = lower.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const numMatch = clean.match(/^(?:class|std|standard|grade)?\s*(\d{1,2})(?:\s*(?:th|st|nd|rd))?$/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (num >= 1 && num <= 12) {
      return getOrdinalSuffix(num);
    }
  }

  const reverseNumMatch = clean.match(/^(\d{1,2})(?:\s*(?:th|st|nd|rd))?\s*(?:class|std|standard|grade)?$/);
  if (reverseNumMatch) {
    const num = parseInt(reverseNumMatch[1], 10);
    if (num >= 1 && num <= 12) {
      return getOrdinalSuffix(num);
    }
  }

  // 2. Common degree aliases / normalization
  const degreeMap = {
    'msc': 'MSC',
    'm.sc': 'MSC',
    'm.sc.': 'MSC',
    'm sc': 'MSC',
    'bsc': 'BSC',
    'b.sc': 'BSC',
    'b.sc.': 'BSC',
    'b sc': 'BSC',
    'btech': 'B.Tech',
    'b.tech': 'B.Tech',
    'b tech': 'B.Tech',
    'mtech': 'M.Tech',
    'm.tech': 'M.Tech',
    'm tech': 'M.Tech',
    'mba': 'MBA',
    'mca': 'MCA',
    'bba': 'BBA',
    'bcom': 'B.Com',
    'b.com': 'B.Com',
    'ba': 'BA',
    'b.a': 'BA',
    'ma': 'MA',
    'm.a': 'MA',
    'phd': 'PhD',
    'ph.d': 'PhD',
    'undergraduate': 'Undergraduate',
    'postgraduate': 'Postgraduate'
  };

  if (degreeMap[clean] || degreeMap[lower]) {
    return degreeMap[clean] || degreeMap[lower];
  }

  // 3. Match canonical list
  const canonMatch = CANONICAL_CLASSES.find(c => c.toLowerCase() === lower);
  if (canonMatch) {
    return canonMatch;
  }

  // 4. Flexible fallback for any valid educational grade/degree string
  if (rawStr.length <= 5 && !rawStr.includes(' ')) {
    return rawStr.toUpperCase();
  }

  return rawStr.length > 50 ? rawStr.substring(0, 50).trim() : rawStr;
}

/**
 * Validates if the given class is supported / valid.
 */
function isValidClassGrade(val) {
  return normalizeClassGrade(val) !== null;
}

module.exports = {
  CANONICAL_CLASSES,
  normalizeClassGrade,
  isValidClassGrade,
  isValidCanonicalClass: isValidClassGrade
};
