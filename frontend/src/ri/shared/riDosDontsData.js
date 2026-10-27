/**
 * Authoritative Rural Immersion (RI) Do's & Don'ts Data
 * Grounded directly in the RUIP (Rural Immersion Program) Operational Guidelines.
 * Categorized by immersion phase and topic.
 */

export const RI_DOS_DONTS_CATEGORIES = [
  {
    id: 'pre_immersion',
    title: 'Pre-Immersion',
    subtitle: 'Preparatory Phase & Academic Alignment',
    iconName: 'Compass',
    dos: [
      'Conduct preliminary research aligned with academic discipline.',
      'Inform parents and obtain their acknowledgment for the program.',
      'Coordinate with the team leader and faculty for updates and assignments.'
    ],
    donts: [
      'Ignore or skip studying the Sustainable Development Goals (SDGs) relevant to the project.',
      'Forget to communicate the details (faculty contacts, village information) to parents.',
      'Rely solely on faculty for planning; self-preparation is key.'
    ]
  },
  {
    id: 'during_immersion',
    title: 'During Immersion',
    subtitle: 'Field Engagement, Surveys & Daily Schedule',
    iconName: 'MapPin',
    dos: [
      'Respect local traditions, customs, and sensitivities during interactions.',
      'Ensure active participation in daily activities and surveys as per the schedule.',
      'Conduct field visits to institutions and households as instructed.',
      'Maintain cleanliness and follow community rules while staying in the village.',
      'Work collaboratively with teammates to identify specific, actionable problems.',
      'Follow safety protocols and maintain a record of emergency contacts.',
      'Use the provided software tools effectively to document survey and visit findings.'
    ],
    donts: [
      'Criticize or mock local lifestyles, beliefs, or practices.',
      'Be absent or unaccounted for during attendance marking.',
      'Wander or engage in activities unrelated to the program.',
      'Litter or engage in activities that disrespect the host families or community.',
      'Propose vague or irrelevant issues not grounded in observed realities or data.',
      'Ignore potential safety or health concerns during activities.',
      'Delay or fail to update the software with required information.'
    ]
  },
  {
    id: 'community_projects',
    title: 'Community Projects',
    subtitle: 'Grassroots Collaboration & Social Impact',
    iconName: 'Users',
    dos: [
      'Collaborate with villagers to implement meaningful community projects.',
      'Participate in group tasks like tree plantation, garbage removal, or workshops.'
    ],
    donts: [
      'Undertake activities without consulting the village Sarpanch or team leader.',
      'Avoid participating in physical or collaborative community tasks.'
    ]
  },
  {
    id: 'post_immersion',
    title: 'Post-Immersion',
    subtitle: 'Reporting, Synthesis & Presentation',
    iconName: 'FileText',
    dos: [
      'Prepare a comprehensive report and presentation aligned with program objectives.',
      'Align solutions with ongoing government schemes or SDGs for feasibility.',
      'Respect submission deadlines and feedback from faculty.'
    ],
    donts: [
      'Submit incomplete or poorly researched reports.',
      'Propose impractical or unaligned solutions.',
      'Delay submissions or neglect constructive criticism from supervisors.'
    ]
  },
  {
    id: 'behavior_conduct',
    title: 'Behavior & Conduct',
    subtitle: 'Cultural Empathy, Ethics & Discipline',
    iconName: 'HeartHandshake',
    dos: [
      'Show empathy, curiosity, and willingness to learn from the rural community.',
      'Adhere to instructions from team leaders and faculty members at all times.'
    ],
    donts: [
      'Display arrogance, disinterest, or superiority during interactions.',
      'Disregard instructions or act independently without approval.'
    ]
  },
  {
    id: 'health_safety',
    title: 'Health & Safety',
    subtitle: 'Hygiene, Medical Readiness & Emergency Care',
    iconName: 'ShieldAlert',
    dos: [
      'Carry adequate medication and the program-provided medical kit for emergencies.',
      'Use safe drinking water and follow hygiene practices.'
    ],
    donts: [
      'Ignore personal health needs or forget to carry required medications.',
      'Consume food or water from unreliable sources.'
    ]
  }
];

// Flat lists for overall summary counters
export const ALL_RI_DOS = RI_DOS_DONTS_CATEGORIES.flatMap(cat => cat.dos);
export const ALL_RI_DONTS = RI_DOS_DONTS_CATEGORIES.flatMap(cat => cat.donts);
