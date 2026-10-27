/**
 * Canonical Class Hierarchy Utility for Life Awakening School Children Workflow
 * Canonical supported classes: '6th', '7th', '8th', '9th', '10th'
 */

const CANONICAL_CLASSES = ['6th', '7th', '8th', '9th', '10th'];

/**
 * Normalizes input class/standard string into canonical value:
 * e.g., '6', '6th', 'Class 6', 'Class 6th', 'Grade 6', 'Std 6' -> '6th'
 * Returns canonical string or null if unknown/unsupported.
 */
function normalizeClassGrade(val) {
  if (val === undefined || val === null) return null;
  const str = String(val).trim().toLowerCase();
  if (!str) return null;

  // Exact matching for canonical strings
  if (CANONICAL_CLASSES.includes(str)) {
    return str;
  }

  // Common prefix / suffix patterns
  // Examples: "class 6", "class 6th", "std 6", "grade 6", "6", "6 th", "class 10th"
  const clean = str.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  
  const match = clean.match(/^(?:class|std|standard|grade)?\s*(6|7|8|9|10)(?:\s*th)?$/);
  if (match) {
    return `${match[1]}th`;
  }

  // Also support "6th class", "10 standard", etc.
  const reverseMatch = clean.match(/^(6|7|8|9|10)(?:\s*th)?\s*(?:class|std|standard|grade)?$/);
  if (reverseMatch) {
    return `${reverseMatch[1]}th`;
  }

  return null;
}

/**
 * Validates if the given class is supported.
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
