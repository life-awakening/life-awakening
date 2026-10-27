export const DEFAULT_SCHEDULE = [
  {
    day: 'Day 1',
    day_number: 1,
    title: 'Departure, Village Entry & Institutional Immersion',
    short_description: 'Journey from MIT-WPU Pune to allocated village, formal Sarpanch & Gram Panchayat reception, visits to local institutions (GP, PHC, schools, banks) and transit to LTC Daund.',
    location: 'MIT-WPU Pune → Allocated Village → LTC Daund Base Camp',
    status: 'upcoming',
    date_label: 'Day 1',
    important_tasks: [
      'Assembly at MIT-WPU Main Gate (06:00 AM) and departure to village',
      'Introduction with Sarpanch, Gram Sevak, and village community leaders (09:30 AM – 11:00 AM)',
      'Institutional Visits: Gram Panchayat, Primary School, Health Centre, Bank/Society (11:00 AM – 01:00 PM)',
      'Record observations on Form IV (Institutional Visit Observations Form)',
      'Meeting village entrepreneurs and small business owners / School activity (02:00 PM – 05:30 PM)',
      'Departure to LTC Daund Base Camp and evening mentor debrief (06:00 PM – 07:30 PM)'
    ],
    student_instructions: 'Arrive at MIT-WPU Pune by 06:00 AM in proper university attire with ID cards. Maintain cultural etiquette and obtain formal permissions during institutional visits.',
    faculty_instructions: 'Coordinate bus transit, introduce students to Sarpanch and Gram Panchayat officials, verify attendance on portal, and lead evening reflection debrief at LTC Daund.',
    forms_deliverables: ['Form IV: Institutional Observations Sheet', 'Day 1 Field Log Entry (Form IIIB)'],
    activities: [
      {
        time: '06:00 AM – 09:30 AM',
        title: 'Assembly at MIT-WPU & Journey to Allocated Village',
        description: 'Assembly at MIT-WPU Pune Main Gate, reporting to faculty mentors, ID verification, boarding designated university buses, and breakfast en route to the village.',
        location: 'MIT-WPU Main Gate → Village Bus',
        dress: 'Decent Casual / Travel Wear',
        category: 'Registration & Travel',
        type: 'travel',
        deliverable: 'Attendance & Bus Verification'
      },
      {
        time: '09:30 AM – 11:00 AM',
        title: 'Formal Village Entry & Sarpanch / Community Reception',
        description: 'Welcome ceremony and initial orientation with Sarpanch, Gram Sevak, Gram Panchayat members, and community elders. Orientation on local customs and village walkthrough.',
        location: 'Gram Panchayat Office / Village Chawadi',
        dress: 'Formal / Dignified Attire',
        category: 'Field Immersion',
        type: 'field',
        deliverable: 'Community Interaction Notes'
      },
      {
        time: '11:00 AM – 01:00 PM',
        title: 'Rotational Visits to Village Organizations & Institutions (Form IV)',
        description: 'Visits in student groups (5 members each) to primary rural institutions: Gram Panchayat, Primary Health Centre (PHC), ZP Primary School, Anganwadi, and Cooperative Society/Bank. Record observations in Form IV.',
        location: 'GP Office, PHC, Primary School, Anganwadi, Bank',
        dress: 'Formal Attire & Student ID Card',
        category: 'Institutional Survey',
        type: 'academic',
        deliverable: 'Form IV: Institutional Observations Sheet'
      },
      {
        time: '01:00 PM – 02:00 PM',
        title: 'Village Community Lunch & Informal Discussions',
        description: 'Traditional lunch arranged locally in the village with fellow students, faculty mentors, and village community members.',
        location: 'Village Community Hall / Allocated Space',
        dress: 'Comfortable Attire',
        category: 'Meals & Break',
        type: 'meals'
      },
      {
        time: '02:00 PM – 05:30 PM',
        title: 'Rural Commerce, SHGs & Micro-Enterprise Interactions',
        description: 'Interactions with village micro-enterprises, Bachat Gat (Women Self-Help Groups), rural artisans, farming setups, and interactive engagement with school students.',
        location: 'Village Workshops, Farms & ZP Primary School',
        dress: 'Field Attire & Student ID Card',
        category: 'Community Outreach',
        type: 'outreach',
        deliverable: 'SHG & Enterprise Notes'
      },
      {
        time: '05:30 PM – 07:30 PM',
        title: 'Transit to Base Camp & Evening Faculty Debriefing',
        description: 'Buses depart village for LTC Daund Base Camp. Evening reflection debrief with faculty mentors, verification of Form IV notes, and Day 1 Daily Log (Form IIIB) submission.',
        location: 'Transit to LTC Daund Base Camp',
        dress: 'Formal / Casual Dress',
        category: 'Review & Evaluation',
        type: 'review',
        deliverable: 'Form IIIB: Day 1 Daily Log Entry'
      }
    ]
  },
  {
    day: 'Day 2',
    day_number: 2,
    title: 'Household Socio-Economic Surveys, Community Project & Village Debrief',
    short_description: 'Intensive household surveys (Form V), community problem-solving project / Shramdaan, formal debrief with Sarpanch and Panchayat, and daily log submission.',
    location: 'LTC Daund → Assigned Village → LTC Daund Base Camp',
    status: 'upcoming',
    date_label: 'Day 2',
    important_tasks: [
      'Early departure from LTC Daund to allocated village (06:00 AM)',
      'Conduct Family Visits (min 3-4 families per pair) across assigned village wards (09:30 AM – 01:00 PM)',
      'Record demographic, housing, energy, health, and agricultural data on Form V',
      'Execute Community Project / Shramdaan: Tree plantation, Swachhata drive, or skill workshops (01:00 PM – 04:00 PM)',
      'Formal Debriefing Meeting with Sarpanch, Gram Sevak, and villagers (04:00 PM – 05:30 PM)',
      'Finalize village problem identification log & record Form IIIB Daily Report'
    ],
    student_instructions: 'Conduct family visits with empathy and humility. Record quantitative and qualitative data accurately. Participate fully in Shramdaan activity.',
    faculty_instructions: 'Monitor student field safety across clusters, guide interview technique, facilitate Panchayat debrief meeting, and sign off on survey sheets.',
    forms_deliverables: ['Form V: Household Survey Questionnaires', 'Community Project (Shramdaan) Log', 'Form IIIB: Day 2 Log Entry'],
    activities: [
      {
        time: '06:00 AM – 08:30 AM',
        title: 'Morning Assembly & Transit to Assigned Village',
        description: 'Morning fall-in at LTC Daund base camp, attendance roll call, breakfast, and departure in assigned buses to the allocated immersion village.',
        location: 'LTC Daund Base Camp → Allocated Village',
        dress: 'Field Wear & Comfortable Shoes',
        category: 'Travel & Admin',
        type: 'travel',
        deliverable: 'Morning Attendance Check'
      },
      {
        time: '08:30 AM – 01:00 PM',
        title: 'Household Socio-Economic Surveys (Form V Execution)',
        description: 'Conduct detailed family socio-economic visits in student pairs across designated village lanes/wards (min 3-4 families per pair). Record demographic, housing, energy, health, and agricultural data on Form V.',
        location: 'Assigned Village Streets / Wards (Gali/Ward)',
        dress: 'Field Attire & Student ID Card',
        category: 'Socio-Economic Survey',
        type: 'survey',
        deliverable: 'Form V: Household Survey Questionnaires (3-4 Families/Pair)'
      },
      {
        time: '01:00 PM – 02:00 PM',
        title: 'Village Community Lunch & Midday Rest',
        description: 'Community lunch break arranged at the village center with panel teammates and local hosts.',
        location: 'Village Community Center / Panchayat Hall',
        dress: 'Comfortable Attire',
        category: 'Meals & Break',
        type: 'meals'
      },
      {
        time: '02:00 PM – 04:30 PM',
        title: 'Student-Led Shramdaan & Community Action Project',
        description: 'Execution of community problem-solving projects: Swachhata cleanliness drive, tree plantation, school awareness session, water conservation drive, and village area beautification.',
        location: 'Village Commons, Primary School & Water Bodies',
        dress: 'Field Work Attire / Sports Shoes',
        category: 'Community Action',
        type: 'action',
        deliverable: 'Shramdaan & Community Project Report'
      },
      {
        time: '04:30 PM – 06:00 PM',
        title: 'Formal Debriefing Session with Sarpanch & Gram Panchayat',
        description: 'Formal presentation to Sarpanch, Gram Sevak, and Panchayat members. Students share identified village issues, actionable suggestions, survey findings, and express community gratitude.',
        location: 'Gram Panchayat Hall',
        dress: 'Formal Attire',
        category: 'Gram Sabha Presentation',
        type: 'review',
        deliverable: 'Panchayat Debrief Presentation & Problem Identification Log'
      },
      {
        time: '06:00 PM – 07:30 PM',
        title: 'Return Transit to Base Camp & Final Immersion Sign-Off',
        description: 'Return transit to LTC Daund Base Camp. Collation and submission of survey sheets (Form IV & Form V), faculty evaluation grading, and final Form IIIB sign-off.',
        location: 'Transit to LTC Daund Base Camp',
        dress: 'Formal / Casual Dress',
        category: 'Review & Evaluation',
        type: 'review',
        deliverable: 'Final Form IIIB Sign-Off & Dossier Submission'
      }
    ]
  },
  {
    day: 'Day 3',
    day_number: 3,
    title: 'Deep Briefing, NGO Visits & Concluding Immersion',
    short_description: 'Mentor deep briefing session, visits to local rural NGOs and grassroots social development organizations (09:00 AM – 12:00 PM), followed by Journey to Life transformation center.',
    location: 'Allocated Immersion Village → Local NGO Centres → Life Transformation Centre',
    status: 'upcoming',
    date_label: 'Day 3',
    important_tasks: [
      'Morning Assembly & Deep Briefing with mentors and village coordinators (09:00 AM – 10:30 AM)',
      'Field visit to local rural NGOs and grassroots development organizations (10:30 AM – 12:00 PM)',
      'Document NGO intervention strategies, community impact, and welfare programs',
      'Final consolidation of immersion findings, Form IIIB and survey deliverables',
      'Journey to Life transformation center, farewell to village stakeholders, and transit (12:00 PM onwards)'
    ],
    student_instructions: 'Actively engage in the deep briefing review. During NGO visits, study the organization structure, community impact, and village development models. Ensure final sign-offs on all submission forms before return transit.',
    faculty_instructions: 'Lead the deep briefing reflection session, coordinate student groups during NGO visits, verify final attendance, and supervise safe return transit to Life Transformation Centre.',
    forms_deliverables: ['NGO Visit Case Study Notes', 'Final Form IIIB Sign-off', 'Rural Immersion Dossier'],
    activities: [
      {
        time: '09:00 AM – 10:30 AM',
        title: 'Deep Briefing & Immersion Reflection Session',
        description: 'Comprehensive deep briefing session with faculty mentors and village coordinators. Review of survey findings, team deliverables, problem logs, and operational guidelines for NGO visits.',
        location: 'Village Community Hall / Base Camp',
        dress: 'Formal / Dignified Attire & Student ID Card',
        category: 'Review & Debrief',
        type: 'review',
        deliverable: 'Deep Briefing Notes & Field Summary'
      },
      {
        time: '10:30 AM – 12:00 PM',
        title: 'Visit to NGOs & Grassroots Organizations',
        description: 'Field visit to local rural NGOs, grassroots development organizations, and rural welfare centers. Study NGO intervention models, social impact initiatives, and community programs.',
        location: 'Local NGO Centers & Village Social Units',
        dress: 'Field Attire & Student ID Card',
        category: 'Institutional Survey',
        type: 'academic',
        deliverable: 'NGO Case Study & Social Impact Observations'
      },
      {
        time: '12:00 PM – 02:30 PM',
        title: 'Journey to Life transformation center',
        description: 'Concluding reflection debrief, formal farewell to village stakeholders and NGO leaders, lunch, and transit journey to Life Transformation Centre.',
        location: 'Village Base Camp → Life Transformation Centre',
        dress: 'Travel Attire',
        category: 'Registration & Travel',
        type: 'travel',
        deliverable: 'Final Immersion Sign-off & Attendance'
      }
    ]
  }
];

export const getRiCategoryStyles = (category, type) => {
  const cat = (category || '').toLowerCase();
  const t = (type || '').toLowerCase();

  if (cat.includes('travel') || cat.includes('admin') || cat.includes('registration') || t === 'registration' || t === 'travel') {
    return { bg: '#154388', text: '#ffffff', label: category || 'Registration & Travel' };
  }
  if (cat.includes('socio') || cat.includes('household') || t === 'survey') {
    return { bg: '#047857', text: '#ffffff', label: category || 'Socio-Economic Survey' };
  }
  if (cat.includes('institutional') || cat.includes('academic') || cat.includes('research') || t === 'academic') {
    return { bg: '#7c3aed', text: '#ffffff', label: category || 'Institutional Survey' };
  }
  if (cat.includes('field') || cat.includes('immersion') || t === 'field') {
    return { bg: '#065f46', text: '#ffffff', label: category || 'Field Immersion' };
  }
  if (cat.includes('meal') || cat.includes('lunch') || cat.includes('break') || t === 'meals') {
    return { bg: '#15803d', text: '#ffffff', label: category || 'Meals & Break' };
  }
  if (cat.includes('action') || cat.includes('shramdaan') || cat.includes('outreach') || cat.includes('community') || t === 'action' || t === 'outreach') {
    return { bg: '#b45309', text: '#ffffff', label: category || 'Community Action' };
  }
  if (cat.includes('review') || cat.includes('debrief') || cat.includes('presentation') || cat.includes('evaluation') || t === 'review') {
    return { bg: '#0284c7', text: '#ffffff', label: category || 'Review & Debrief' };
  }
  return { bg: '#475569', text: '#ffffff', label: category || 'Activity' };
};
