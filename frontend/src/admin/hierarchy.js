export const OFFICIAL_HIERARCHY = {
  "Division I": {
    "Faculty of Engineering and Technology": {
      "School of Computer Science and Engineering": [
        "Department of Computer Engineering and Technology",
        "Department of Computer Science and Applications"
      ],
      "School of Computer Engineering & Technology": [
        "Department of Computer Engineering and Technology",
        "Department of Computer Science and Applications"
      ],
      "School of Engineering & Technology": [
        "Department of Chemical Engineering",
        "Department of Bioengineering",
        "Department of Civil Engineering",
        "Department of Electrical and Electronics Engineering",
        "Department of Mechanical Engineering",
        "Department of Petroleum Engineering",
        "Department of Polytechnic"
      ]
    }
  },
  "Division II": {
    "Faculty of Business and Leadership": {
      "School of Leadership": [],
      "School of Business": [
        "Department of Business",
        "Department of Hospitality Management"
      ],
      "School of Economics and Commerce": [
        "Department of Commerce and Accounting",
        "Department of Economics and Public Policy",
        "Department of Sustainability Studies"
      ],
      "School of Government": []
    }
  },
  "Division III": {
    "Faculty of Science & Health Science": {
      "School of Health Sciences and Technology": [
        "Department of Clinical Sciences",
        "Department of Pharmaceutical Sciences",
        "Department of Public Health",
        "Department of Wellness and Yogic Science"
      ],
      "School of Science and Environmental Studies": [
        "Department of Environmental Studies",
        "Department of Biosciences and Technology",
        "Department of Chemistry",
        "Department of Mathematics and Statistics",
        "Department of Physics"
      ]
    }
  },
  "Division IV": {
    "Faculty of Arts, Design and Humanities": {
      "School of Design": [
        "Department of Design",
        "Department of Visual Arts"
      ],
      "School of Law": [],
      "School of Liberal Arts": [
        "Dadasaheb Phalke International Film School",
        "Department of Education",
        "Department of Liberal Arts",
        "Department of Peace Studies",
        "Department of Media and Communication",
        "Department of Photography"
      ],
      "School of Consciousness": []
    }
  }
};

export const CANONICAL_SCHOOLS = [
  "School of Computer Science and Engineering",
  "School of Engineering & Technology",
  "School of Leadership",
  "School of Business",
  "School of Economics and Commerce",
  "School of Government",
  "School of Health Sciences and Technology",
  "School of Science and Environmental Studies",
  "School of Design",
  "School of Law",
  "School of Liberal Arts",
  "School of Consciousness"
];

export const CANONICAL_DEPARTMENTS = [
  "Department of Computer Engineering and Technology",
  "Department of Computer Science and Applications",
  "Department of Chemical Engineering",
  "Department of Bioengineering",
  "Department of Civil Engineering",
  "Department of Electrical and Electronics Engineering",
  "Department of Mechanical Engineering",
  "Department of Petroleum Engineering",
  "Department of Polytechnic",
  "Department of Business",
  "Department of Hospitality Management",
  "Department of Commerce and Accounting",
  "Department of Economics and Public Policy",
  "Department of Sustainability Studies",
  "Department of Clinical Sciences",
  "Department of Pharmaceutical Sciences",
  "Department of Public Health",
  "Department of Wellness and Yogic Science",
  "Department of Environmental Studies",
  "Department of Biosciences and Technology",
  "Department of Chemistry",
  "Department of Mathematics and Statistics",
  "Department of Physics",
  "Department of Design",
  "Department of Visual Arts",
  "Dadasaheb Phalke International Film School",
  "Department of Education",
  "Department of Liberal Arts",
  "Department of Peace Studies",
  "Department of Media and Communication",
  "Department of Photography"
];

export function normFlex(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getCanonicalSchool(rawSchool) {
  if (!rawSchool) return '';
  const n = normFlex(rawSchool);
  if (!n) return '';

  for (const cSchool of CANONICAL_SCHOOLS) {
    const cn = normFlex(cSchool);
    if (n === cn) return cSchool;
    if (n.includes(cn) || cn.includes(n)) return cSchool;
  }

  if (n.includes('computer') && (n.includes('science') || n.includes('engineering') || n.includes('technology'))) {
    return "School of Computer Science and Engineering";
  }

  return rawSchool
    .replace(/\s+/g, ' ')
    .trim();
}

export function getCanonicalDepartment(rawDepartment) {
  if (!rawDepartment) return '';
  const n = normFlex(rawDepartment);
  if (!n) return '';

  for (const cDept of CANONICAL_DEPARTMENTS) {
    const cn = normFlex(cDept);
    if (n === cn) return cDept;
    if (n.includes(cn) || cn.includes(n)) return cDept;
  }

  if (n.includes('computer') && (n.includes('engineering') || n.includes('technology'))) {
    return "Department of Computer Engineering and Technology";
  }
  if (n.includes('computer') && (n.includes('science') || n.includes('application'))) {
    return "Department of Computer Science and Applications";
  }

  return rawDepartment
    .replace(/\s+/g, ' ')
    .trim();
}
