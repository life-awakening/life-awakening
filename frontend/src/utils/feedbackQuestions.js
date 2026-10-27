/**
 * Source of Truth for Pre-LTC and Post-LTC Questionnaires
 * Directly extracted from official Google Forms PDF specifications:
 * - 25 July 2026 Pre - Participation Form_Life Awakening Program (LAP)
 * - 25 July 2026 Post - Participation Form_Life Awakening Program (LAP)
 */
import * as XLSX from 'xlsx';

// ─── PART 2: SELF ASSESSMENT SECTIONS (Q8 to Q21, Shared between Pre & Post) ───
export const SELF_ASSESSMENT_SECTIONS = [
  {
    id: "q8_metacognitive",
    qNum: 8,
    title: "Problem-Solving & Goal Management",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "1 = Not at all typical of me",
      "2 = Not very typical of me",
      "3 = Somewhat typical of me",
      "4 = Fairly typical of me",
      "5 = Very typical of me"
    ],
    statements: [
      "I ask myself periodically if I am meeting my goals",
      "I think of several ways to solve a problem and choose the best one.",
      "I organize my time to best accomplish my goals.",
      "I stop and go back over new information that is not clear.",
      "I change strategies when I fail to understand."
    ]
  },
  {
    id: "q9_creative",
    qNum: 9,
    title: "Creative Thinking & Innovation",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "(5) I completely agree",
      "(4) I usually agree",
      "(3) I partly agree",
      "(2) I usually do not agree",
      "(1) I never agree"
    ],
    statements: [
      "I create alternative solutions against a problem.",
      "I don't follow only one way when thinking about a subject, I create new aspects",
      "I can be interested in improbable approaches while thinking.",
      "I am clever at innovation",
      "I tell different things to change one's mind",
      "I can brainstorm about all aspects of a subject"
    ]
  },
  {
    id: "q10_initiating_relationships",
    qNum: 10,
    title: "Initiating Relationships",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "1 = I'm poor at this; I'd feel so uncomfortable and unable to handle this situation, I'd avoid it if possible",
      "2 = I'm only fair at this; I'd feel uncomfortable and would have lots of difficulty handling this situation",
      "3 = I'm OK at this; I'd feel somewhat uncomfortable and have some difficulty handling this situation",
      "4 = I'm good at this; I'd feel quite comfortable and able to handle this situation",
      "5 = I'm EXTREMELY good at this; I'd feel very comfortable and could handle this situation very well"
    ],
    statements: [
      "Finding and suggesting things to do with new people whom you find interesting and attractive.",
      "Introducing yourself to someone you might like to get to know",
      "Carrying on conversations with someone new whom you think you might like to get to know.",
      "Asking or suggesting to someone new that you get together and do something, e.g., share a room"
    ]
  },
  {
    id: "q11_communication",
    qNum: 11,
    title: "Communication & Openness",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "1 = never",
      "2 = rarely",
      "3 = sometimes",
      "4 = often",
      "5 = always"
    ],
    statements: [
      "I express my thoughts sincerely",
      "I do not want to communicate whom I do not know (R)",
      "Asking someone for help is difficult for me (R)",
      "I get upset when I'm criticized (R)",
      "I allow others to express themselves freely."
    ]
  },
  {
    id: "q12_empathy_support",
    qNum: 12,
    title: "Emotional Support & Empathy",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "1 = I'm poor at this; I'd feel so uncomfortable and unable to handle this situation, I'd avoid it if possible",
      "2 = I'm only fair at this; I'd feel uncomfortable and would have lots of difficulty handling this situation",
      "3 = I'm OK at this; I'd feel somewhat uncomfortable and have some difficulty handling this situation",
      "4 = I'm good at this; I'd feel quite comfortable and able to handle this situation",
      "5 = I'm EXTREMELY good at this; I'd feel very comfortable and could handle this situation very well"
    ],
    statements: [
      "I am able to patiently and sensitively listen to a companion \"let off steam\" about outside problems s/he is having",
      "I am a good and sensitive listener for a companion who is upset",
      "I am able to show genuine empathetic concern even when a companion's problem is uninteresting to me.",
      "When a close companion needs help and support, I am able to give advice in ways that are well received."
    ]
  },
  {
    id: "q13_conflict_management",
    qNum: 13,
    title: "Conflict Management",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "1 = I'm poor at this; I'd feel so uncomfortable and unable to handle this situation, I'd avoid it if possible",
      "2 = I'm only fair at this; I'd feel uncomfortable and would have lots of difficulty handling this situation",
      "3 = I'm OK at this; I'd feel somewhat uncomfortable and have some difficulty handling this situation",
      "4 = I'm good at this; I'd feel quite comfortable and able to handle this situation",
      "5 = I'm EXTREMELY good at this; I'd feel very comfortable and could handle this situation very well"
    ],
    statements: [
      "I am able to admit that I might be wrong when a disagreement with a close companion begins to build into a serious fight",
      "When angry with a companion, I am able to accept that s/he has a valid point of view even if you don't agree with that view",
      "I am able to work through a specific problem with a companion without resorting to global accusations (\"you always do that\").",
      "I refrain from saying things that might cause a disagreement to build into a big fight"
    ]
  },
  {
    id: "q14_leadership_eq",
    qNum: 14,
    title: "Leadership & Self-Awareness",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "5 = Describes me very well",
      "4 = Describes me well",
      "3 = Describes me moderately well",
      "2 = Describes me a little",
      "1 = Not at all describes me"
    ],
    statements: [
      "I don't easily give up even if I received setbacks.",
      "I am able to identify my feelings.",
      "I am aware of my strengths and weaknesses",
      "If I am convinced that my position is right, I prefer to maintain my position, even if it means becoming unpopular",
      "My values and goals are very clear in my mind.",
      "When I have a problem that creates undue tension, I try to relax and gain a feeling of tranquillity so that I can re-evaluate things.",
      "I can adjust very quickly to new challenges, problem and information.",
      "I emerge as a natural leader during unstructured situation.",
      "I recognise the need for change and work for removing the barriers.",
      "I am able to read the needs of the hour and influence people through my initiative.",
      "People don't have to tell me what they feel; I can sense it",
      "I take initiative in talking to people in order to serve them better.",
      "I am very comfortable in working with people of different background."
    ]
  },
  {
    id: "q15_resilience",
    qNum: 15,
    title: "Resilience & Coping Ability",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "1 = not true at all",
      "2 = not true",
      "3 = nearly true",
      "4 = true many times",
      "5 = true nearly all the time"
    ],
    statements: [
      "I am able to adapt to change",
      "I can deal with whatever comes",
      "I try to see humorous side of problems",
      "Coping with stress can strengthen me",
      "I tend to bounce back after illness or hardship",
      "I can achieve goals despite obstacles",
      "I can stay focused under pressure",
      "I am not easily discouraged by failure",
      "I think of self as a strong person",
      "I can handle unpleasant feelings"
    ]
  },
  {
    id: "q16_optimism_self_esteem",
    qNum: 16,
    title: "Optimism & Self-Satisfaction",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "5 = strongly agree",
      "4 = Agree",
      "3 = somewhat agree",
      "2 = disagree",
      "1 = strongly disagree"
    ],
    statements: [
      "I feel optimistic about the future, feel good about myself and confident in my abilities",
      "I feel able to relax when I want to",
      "I feel energetic and interested when I need to be",
      "I don't really get on well with people (R)",
      "In general, I feel optimistic about the future",
      "I am confident in my ability to solve problems that I might face in life",
      "On the whole I am satisfied with myself"
    ]
  },
  {
    id: "q17_stress_response",
    qNum: 17,
    title: "Stress Response & Support-Seeking",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "5 = strongly agree",
      "4 = Agree",
      "3 = somewhat agree",
      "2 = disagree",
      "1 = strongly disagree"
    ],
    statements: [
      "When I find myself in stressful situations, I take a problem-focused approach",
      "When I find myself in stressful situations, I look for social support",
      "When I find myself in stressful situations, I wish for things to improve",
      "When I find myself in stressful situations, I try to avoid the problem (R)"
    ]
  },
  {
    id: "q18_physical_activity",
    qNum: 18,
    title: "Physical Fitness & Health Habits",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "5 = strongly agree",
      "4 = Agree",
      "3 = somewhat agree",
      "2 = disagree",
      "1 = strongly disagree"
    ],
    statements: [
      "I try to keep my body healthy and fit",
      "I spend much of my leisure time involved in physical activities like bicycling, hiking, swimming, gardening, or playing competitive sports",
      "I get at least 7- 8 hours of sleep at night and wake up feeling rested and refreshed",
      "I have good physical endurance",
      "I participate in vigorous exercise like running, swimming, speed walking, or aerobics dance classes for at least 20 to 30 minutes a day and at least three times a week"
    ]
  },
  {
    id: "q19_exercise_progression",
    qNum: 19,
    title: "Exercise Discipline & Growth",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "1 = never",
      "2 = rarely",
      "3 = sometimes",
      "4 = often",
      "5 = always"
    ],
    statements: [
      "I continually increase my exercise intensity to achieve the desired effects / benefits",
      "I continually increase my exercise frequency to achieve the desired effects / benefits",
      "I continually increase my exercise duration to achieve the desired effects / benefits"
    ]
  },
  {
    id: "q20_ethics_morals",
    "qNum": 20,
    title: "Honesty & Moral Principles",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "5 = strongly agree",
      "4 = Agree",
      "3 = somewhat agree",
      "2 = disagree",
      "1 = strongly disagree"
    ],
    statements: [
      "I try hard to act honestly in most things I do.",
      "Not hurting other people is one of the rules I live by",
      "It is important for me to treat other people fairly.",
      "I want other people to know they can rely on me",
      "I always act in ways that do the most good and least harm to other people"
    ]
  },
  {
    id: "q21_spirituality_purpose",
    qNum: 21,
    title: "Spiritual Beliefs & Purpose in Life",
    prompt: "Please indicate how accurately each statement describes you.",
    scale: [
      "5 = strongly agree",
      "4 = Agree",
      "3 = somewhat agree",
      "2 = disagree",
      "1 = strongly disagree"
    ],
    statements: [
      "My spiritual beliefs help me to be a better person",
      "My spirituality is my inner voice speaking to me",
      "My spiritual beliefs make my life more meaningful",
      "I feel as if my life has a higher purpose",
      "My spiritual beliefs positively impact my health and well-being",
      "My spiritual beliefs guide my relationships with other people"
    ]
  }
];

// ─── PRE SPECIFIC QUESTIONS ───
export const PRE_ORIENTATION_Q22 = {
  id: "q22_orientation",
  qNum: 22,
  title: "Orientation Experience Rating",
  prompt: "Rate the experience of Orientation for LTC. Keep in mind you have to rate only for LTC related Orientation, not for Rural Immersion.",
  scale: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
  items: ["Organisation of Orientation", "Information Shared"]
};

export const PRE_PILLARS_Q23 = {
  id: "q23_pillars_excitement",
  qNum: 23,
  title: "5 Pillars of LTC Excitement",
  prompt: "From what you have heard about LTC and its 5 Pillars of LTC which excites you most?",
  scale: ["Not Excited", "Less Excited", "Moderately Excited", "Very Excited", "Extremely Excited"],
  items: [
    "Agriculture & Nature",
    "Physical Fitness & Sports",
    "Team Building & Leadership",
    "Patriotism & Nation Building",
    "Spirituality & Peace"
  ]
};

export const PRE_ADDITIONAL_Q24 = {
  id: "q24_additional_feedback",
  qNum: 24,
  title: "Additional Comments",
  prompt: "Any additional feedback/comment."
};

// ─── POST SPECIFIC QUESTIONS ───
export const POST_PILLARS_Q22 = {
  id: "q22_pillars_liked",
  qNum: 22,
  title: "Pillar Activities Experience",
  prompt: "Rate Pillars on the scale you liked the activities",
  scale: ["Poor", "Average (Fair)", "Good", "Very Good", "Excellent"],
  items: [
    "Agriculture & Nature",
    "Physical Fitness & Sports",
    "Team Building & Leadership",
    "Patriotism & Nation Building",
    "Spirituality & Peace"
  ]
};

export const POST_FACULTY_PILLARS = [
  {
    id: "q23_faculty_agriculture",
    qNum: 23,
    pillarName: "Agriculture & Nature",
    prompt: "Rate the Faculty Members of the Agriculture & Nature Pillar",
    scale: ["Excellent", "Very Good", "Good", "Satisfactory", "Needs Improvement", "No Interaction"],
    members: [
      "Sangram Hande – Pillar Head",
      "Milind Shirsat – Assistant Manager",
      "Abhishek Kate – Instructor",
      "Pratik Chaudhari – Instructor",
      "Swapnil Gayakwad – Instructor",
      "Ganesh Khaladkar – Instructor"
    ]
  },
  {
    id: "q24_faculty_sports",
    qNum: 24,
    pillarName: "Physical Fitness & Sports",
    prompt: "Rate the Faculty Members of the Physical Fitness & Sports Pillar",
    scale: ["Excellent", "Very Good", "Good", "Satisfactory", "Needs Improvement", "No Interaction"],
    members: [
      "Sanjay Waghmode – Instructor",
      "Bhimashankar – Coordinator",
      "Nayan – Coordinator",
      "Dhanashree – Coordinator",
      "Smita – Coordinator"
    ]
  },
  {
    id: "q25_faculty_team",
    qNum: 25,
    pillarName: "Team Building & Leadership",
    prompt: "Rate the Faculty Members of the Team Building & Leadership Pillar",
    scale: ["Excellent", "Very Good", "Good", "Satisfactory", "Needs Improvement", "No Interaction"],
    members: [
      "Shardool Shirolkar, Pillar Head",
      "Anshuman Singh – Instructor",
      "Pravin – Coordinator",
      "Pratik Shah – Coordinator",
      "Dhiraj – Coordinator"
    ]
  },
  {
    id: "q26_faculty_patriotism",
    qNum: 26,
    pillarName: "Patriotism & Nation Building",
    prompt: "Rate the Faculty Members of the Patriotism & Nation Building Pillar",
    scale: ["Excellent", "Very Good", "Good", "Satisfactory", "Needs Improvement", "No Interaction"],
    members: [
      "Ravindra SIngh, Pillar Head",
      "Nana Sonwalkar – Instructor",
      "Shreya – Coordinator",
      "Praful – Coordinator",
      "Shailesh – Coordinator"
    ]
  },
  {
    id: "q27_faculty_spirituality",
    qNum: 27,
    pillarName: "Spirituality & Peace",
    prompt: "Rate the Faculty Members of the Spirituality & Peace Pillar",
    scale: ["Excellent", "Very Good", "Good", "Satisfactory", "Needs Improvement", "No Interaction"],
    members: [
      "Aniket Tekawade, Pillar Head",
      "Divya Thorat – Instructor",
      "Roopesh – Coordinator",
      "Kumar – Coordinator",
      "Sandeep – Coordinator"
    ]
  }
];

export const POST_LEADERS_Q28 = {
  id: "q28_residential_leaders",
  qNum: 28,
  title: "LTC Residential Leaders",
  prompt: "Rate the experience with LTC Residential Leaders",
  scale: ["Outstanding", "Highly Effective", "Effective", "Developing", "Needs Improvement", "No Interaction"],
  members: [
    "Harshavardhan Patil - Senior Director",
    "Gaurav Karandikar, Director"
  ]
};

export const POST_FACILITIES_Q29 = {
  id: "q29_ltc_facilities",
  qNum: 29,
  title: "LTC Facilities & Arrangements",
  prompt: "Rate the Following at LTC",
  scale: ["Excellent", "Very Good", "Good", "Satisfactory", "Needs Improvement"],
  items: [
    "Transport",
    "Arrival and Check-In Process",
    "Orientation Session at LTC",
    "Accommodation",
    "Food and Dining",
    "Drinking Water",
    "Programme Schedule and Coordination",
    "Support Staff",
    "Safety and Security",
    "Overall Residential Experience"
  ]
};

export const POST_OPEN_ENDED = [
  {
    id: "q30_appreciated",
    qNum: 30,
    key: "appreciated_arrangements",
    prompt: "What did you appreciate most about the residential arrangements?"
  },
  {
    id: "q31_difficulties",
    qNum: 31,
    key: "stay_difficulties",
    prompt: "What difficulties did you experience during your stay?"
  },
  {
    id: "q32_improvements",
    qNum: 32,
    key: "recommended_improvements",
    prompt: "What improvements would you recommend for future programmes?"
  }
];

// ─── HELPER TO PARSE AND FORMAT ANY FEEDBACK FOR ADMIN/MODAL DISPLAY ───
export function parseFeedbackForDisplay(rawContent, category) {
  if (!rawContent || rawContent === "—" || String(rawContent).trim() === "") return [];
  let parsed = null;
  try {
    parsed = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;
  } catch {
    return [{ question: "Raw Response", answer: String(rawContent) }];
  }

  if (!parsed || typeof parsed !== "object") {
    return [{ question: "Response", answer: String(rawContent) }];
  }

  const data = parsed.answers || parsed.responses || parsed;
  const pairs = [];

  // Demographics
  if (data.firstName || data.prn || data.schoolName) {
    const demo = [
      data.firstName ? `Name: ${[data.firstName, data.middleName, data.surname].filter(Boolean).join(" ")}` : null,
      data.prn ? `PRN: ${data.prn}` : null,
      data.dob ? `DOB: ${data.dob}` : null,
      data.gender ? `Gender: ${data.gender}` : null,
      data.schoolName ? `School: ${data.schoolName}` : null,
      data.departmentName ? `Dept: ${data.departmentName}` : null,
      data.classYear ? `Year: ${data.classYear}` : null,
      data.cityState ? `City/State: ${data.cityState}` : null
    ].filter(Boolean).join(" | ");
    if (demo) pairs.push({ question: "Personal Details", answer: demo });
  }

  // Self Assessment Statements (Q8 - Q21)
  if (data.ratings && typeof data.ratings === "object") {
    SELF_ASSESSMENT_SECTIONS.forEach((sec) => {
      const secRatings = [];
      sec.statements.forEach((stmt) => {
        if (data.ratings[stmt] !== undefined) {
          secRatings.push(`• ${stmt}: ${data.ratings[stmt]}`);
        }
      });
      if (secRatings.length > 0) {
        pairs.push({
          question: `Q${sec.qNum}. ${sec.title}`,
          answer: secRatings.join("\n")
        });
      }
    });

    // Fallback for any ratings not caught in known sections
    const knownStatements = new Set(SELF_ASSESSMENT_SECTIONS.flatMap((s) => s.statements));
    const extraRatings = Object.entries(data.ratings).filter(([k]) => !knownStatements.has(k));
    if (extraRatings.length > 0) {
      pairs.push({
        question: "Other Self-Assessment Ratings",
        answer: extraRatings.map(([k, v]) => `• ${k}: ${v}`).join("\n")
      });
    }
  }

  // PRE-LTC Specific Questions
  if (category === "Pre-LTC" || (!category && data.orientationRatings)) {
    if (data.orientationRatings && typeof data.orientationRatings === "object") {
      pairs.push({
        question: `Q22. ${PRE_ORIENTATION_Q22.title}`,
        answer: Object.entries(data.orientationRatings).map(([k, v]) => `• ${k}: ${v}`).join("\n")
      });
    }

    if (data.excitedPillars && typeof data.excitedPillars === "object") {
      pairs.push({
        question: `Q23. ${PRE_PILLARS_Q23.title}`,
        answer: Object.entries(data.excitedPillars).map(([k, v]) => `• ${k}: ${v}`).join("\n")
      });
    }

    if (data.additionalFeedback || data.additionalComments) {
      pairs.push({
        question: `Q24. ${PRE_ADDITIONAL_Q24.title}`,
        answer: data.additionalFeedback || data.additionalComments
      });
    }
  }

  // POST-LTC Specific Questions
  if (category === "Post-LTC" || (!category && (data.facultyRatings || data.facilitiesRatings))) {
    if (data.pillarActivitiesLiked && typeof data.pillarActivitiesLiked === "object") {
      pairs.push({
        question: `Q22. ${POST_PILLARS_Q22.title}`,
        answer: Object.entries(data.pillarActivitiesLiked).map(([k, v]) => `• ${k}: ${v}`).join("\n")
      });
    } else if (data.excitedPillars && typeof data.excitedPillars === "object") {
      pairs.push({
        question: `Q22. ${POST_PILLARS_Q22.title}`,
        answer: Object.entries(data.excitedPillars).map(([k, v]) => `• ${k}: ${v}`).join("\n")
      });
    }

    // Faculty members rating per pillar (Q23 - Q27)
    if (data.facultyRatings && typeof data.facultyRatings === "object") {
      POST_FACULTY_PILLARS.forEach((fp) => {
        const pillarFac = data.facultyRatings[fp.id] || data.facultyRatings[fp.pillarName];
        if (pillarFac && typeof pillarFac === "object") {
          pairs.push({
            question: `Q${fp.qNum}. Faculty Members — ${fp.pillarName}`,
            answer: Object.entries(pillarFac).map(([m, r]) => `• ${m}: ${r}`).join("\n")
          });
        }
      });
    }

    // Leaders (Q28)
    if (data.leadersRatings && typeof data.leadersRatings === "object") {
      pairs.push({
        question: `Q28. ${POST_LEADERS_Q28.title}`,
        answer: Object.entries(data.leadersRatings).map(([m, r]) => `• ${m}: ${r}`).join("\n")
      });
    }

    // Facilities (Q29)
    if (data.facilitiesRatings && typeof data.facilitiesRatings === "object") {
      pairs.push({
        question: `Q29. ${POST_FACILITIES_Q29.title}`,
        answer: Object.entries(data.facilitiesRatings).map(([item, r]) => `• ${item}: ${r}`).join("\n")
      });
    }

    // Open ended reflections (Q30, Q31, Q32)
    POST_OPEN_ENDED.forEach((oe) => {
      const val = data[oe.key] || data[oe.id];
      if (val && String(val).trim()) {
        pairs.push({
          question: `Q${oe.qNum}. ${oe.prompt}`,
          answer: String(val).trim()
        });
      }
    });
  }

  // Support for legacy qualitative fields if present
  const legacyFields = [
    { key: "learnOrChange", label: "What you most wanted to learn or change" },
    { key: "whyExcited", label: "Why you were excited about LTC" },
    { key: "whyNotExcited", label: "Concerns or doubts" },
    { key: "habitToChange", label: "Personal habit to change" },
    { key: "lifeMeaning", label: "Meaning of life" },
    { key: "feelAboutYourself", label: "Feelings about self" },
    { key: "surprisedMost", label: "Most surprising experience" },
    { key: "pillarChangedMost", label: "Pillar that impacted you most" },
    { key: "changeInBehavior", label: "Behavioral change" },
    { key: "habitChanged", label: "Habit changed or initiated" },
    { key: "whyLiked", label: "Components liked" },
    { key: "whyNotLiked", label: "Components requiring improvement" }
  ];

  legacyFields.forEach((f) => {
    if (data[f.key] && String(data[f.key]).trim()) {
      pairs.push({ question: f.label, answer: String(data[f.key]).trim() });
    }
  });

  // Service & Trainers Specific Questions
  if (category === "Service-Trainers" || category === "Service & Trainers" || (!category && (data.trainers || data.services || data.trainer_feedback || data.overall_suggestions))) {
    if (data.trainers && typeof data.trainers === "object") {
      pairs.push({
        question: "Trainers & Instructors Evaluation",
        answer: Object.entries(data.trainers).map(([k, v]) => `• ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join("\n")
      });
    }
    if (data.services && typeof data.services === "object") {
      pairs.push({
        question: "Services & Logistics Evaluation",
        answer: Object.entries(data.services).map(([k, v]) => `• ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join("\n")
      });
    }
    if (data.trainer_feedback && String(data.trainer_feedback).trim()) {
      pairs.push({
        question: "Trainers Feedback & Remarks",
        answer: String(data.trainer_feedback).trim()
      });
    }
    if (data.overall_suggestions && String(data.overall_suggestions).trim()) {
      pairs.push({
        question: "Overall Suggestions & Feedback",
        answer: String(data.overall_suggestions).trim()
      });
    }
  }

  // Universal catch-all for any remaining unmapped key-value pairs (excluding demographics and processed keys)
  const processedKeys = new Set([
    "firstName", "middleName", "surname", "dob", "gender", "schoolName", "departmentName", "prn", "classYear", "cityState",
    "ratings", "orientationRatings", "excitedPillars", "additionalFeedback", "additionalComments",
    "pillarActivitiesLiked", "facultyRatings", "leadersRatings", "facilitiesRatings",
    "most_impactful_experience", "behavior_habit_change", "recommended_improvements",
    "appreciated_arrangements", "stay_difficulties",
    "trainers", "services", "trainer_feedback", "overall_suggestions",
    ...legacyFields.map(f => f.key)
  ]);

  Object.entries(data).forEach(([key, val]) => {
    if (!processedKeys.has(key) && val !== null && val !== undefined && String(val).trim() !== "") {
      const cleanKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const cleanVal = typeof val === 'object' ? Object.entries(val).map(([k, v]) => `• ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join("\n") : String(val).trim();
      pairs.push({ question: cleanKey, answer: cleanVal });
    }
  });

  return pairs;
}

/**
 * Format feedback into clean, structured human-readable text for Excel export cells.
 * Preserves all questions, ratings, multiple choices, and open-ended text with clean, readable structure.
 */
export function formatFeedbackForExcel(rawContent, category) {
  if (!rawContent || rawContent === "—" || String(rawContent).trim() === "" || String(rawContent).trim().toLowerCase() === "not submitted" || String(rawContent).trim().toLowerCase() === "null") {
    return "Not Submitted";
  }

  const pairs = parseFeedbackForDisplay(rawContent, category);
  if (!pairs || pairs.length === 0) {
    const str = String(rawContent).trim();
    if (str.includes(" | ")) {
      return str.split(" | ").map(item => `• ${item.trim()}`).join("\n");
    }
    return str;
  }

  const blocks = pairs.map(p => {
    const q = String(p.question || "").trim();
    const a = String(p.answer || "").trim();
    if (!a) return null;
    if (a.includes('\n')) {
      return `Q: ${q}\nA:\n${a}`;
    }
    return `Q: ${q}\nA: ${a}`;
  }).filter(Boolean);

  if (blocks.length === 0) {
    return String(rawContent).trim();
  }

  return blocks.join("\n\n");
}

/**
 * Exports the standard Submission Page's Pre + Post Feedback Excel workbook.
 * Produces the exact same structure: T-Shirt count summary header, student feedback table,
 * Question -> Answer formatting for Pre-LTC and Post-LTC, wrap text, top alignment, and capped row heights.
 */
export function exportSubmissionsFeedbackExcel({
  data = [],
  batchName = 'Batch',
  selectedSquad = 'All',
  selectedRole = 'student',
  showToast = () => {}
}) {
  if (!data || data.length === 0) {
    showToast('No data available to export.', 'error');
    return;
  }

  const columns = [
    selectedRole === 'faculty' ? 'Faculty Name' : 'Student Name',
    selectedRole === 'faculty' ? 'Faculty ID' : 'PRN',
    'Squad',
    'Pre-LTC Feedback',
    'Post-LTC Feedback'
  ];

  const mapRow = (r) => [r[0], r[1], r[3], r[26], r[27]];

  const rows = data.map((row) => {
    const mapped = mapRow(row);
    return mapped.map((cell, colIdx) => {
      const colHeader = columns[colIdx];
      if (colHeader === 'Pre-LTC Feedback') {
        const rawVal = row[34] || cell;
        return formatFeedbackForExcel(rawVal, 'Pre-LTC');
      }
      if (colHeader === 'Post-LTC Feedback') {
        const rawVal = row[35] || cell;
        return formatFeedbackForExcel(rawVal, 'Post-LTC');
      }
      return (cell === null || cell === undefined || String(cell).trim() === '' ? '—' : cell);
    });
  });

  const wsData = [columns, ...rows];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = columns.map((col, idx) => {
    const isFeedback = col === 'Pre-LTC Feedback' || col === 'Post-LTC Feedback';
    if (isFeedback) {
      return { wch: 72 };
    }
    let maxLen = String(col).length;
    rows.forEach(r => {
      const valLen = String(r[idx] || '').length;
      if (valLen > maxLen) maxLen = valLen;
    });
    return { wch: Math.min(Math.max(maxLen + 4, 14), 45) };
  });
  ws['!cols'] = colWidths;

  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    const rowHeights = [];

    for (let R = 0; R <= range.e.r; ++R) {
      let maxLinesInRow = 1;
      let hasSubmittedFeedback = false;

      for (let C = 0; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cellRef];
        if (!cell || cell.v === undefined) continue;

        if (typeof cell.v === 'string') {
          const lines = cell.v.split('\n').length;
          if (lines > maxLinesInRow) maxLinesInRow = lines;
          if (lines > 2 && cell.v !== 'Not Submitted') {
            hasSubmittedFeedback = true;
          }
        }

        if (!cell.s) cell.s = {};
        cell.s.alignment = {
          wrapText: true,
          vertical: 'top'
        };
      }

      if (R === 0 || !hasSubmittedFeedback || maxLinesInRow <= 2) {
        rowHeights.push({ hpt: 20 });
      } else {
        const computedHeight = Math.min(Math.max(maxLinesInRow * 11 + 10, 50), 165);
        rowHeights.push({ hpt: computedHeight });
      }
    }
    ws['!rows'] = rowHeights;
  }

  const wb = XLSX.utils.book_new();
  const safeSheet = `${selectedSquad || 'All'}_feedback`.substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeSheet);

  const cleanBatchName = (batchName || 'Batch').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanBatchName}_${selectedSquad || 'All'}_feedback_report.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast('Excel exported with clean, readable feedback formatting!', 'success');
}



