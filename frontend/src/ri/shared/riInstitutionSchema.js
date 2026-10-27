/**
 * RI Institutional Visit Observations (ANNEX G-6, FORM IV) Schema & Definitions
 * Based directly on "Operational Guidlines RUIP 4.docx", pages 25–27 (ANNEX G-6, FORM IV)
 */

export const INSTITUTION_FORM_SECTIONS = [
  {
    key: 'section_1_village_info',
    sr: '1',
    title: 'Village Information',
    subtitle: 'Basic demographic and administrative identification of the village',
    questions: [
      {
        id: 'v_1_1_village_name',
        sr: '1.1',
        label: 'Name of village',
        type: 'text',
        placeholder: 'Write name of village in text',
        instruction: 'Write name of village in text',
        required: true
      },
      {
        id: 'v_1_2_taluka',
        sr: '1.2',
        label: 'Taluka',
        type: 'text',
        placeholder: 'Write name of taluka in text',
        instruction: 'Write name of taluka in text',
        required: true
      },
      {
        id: 'v_1_3_district',
        sr: '1.3',
        label: 'District',
        type: 'text',
        placeholder: 'Write name of district in text',
        instruction: 'Write name of district in text',
        required: true
      },
      {
        id: 'v_1_4_tribal',
        sr: '1.4',
        label: 'Whether village is tribal or non-tribal',
        type: 'select',
        options: ['1) Tribal', '2) Non tribal'],
        instruction: 'Faculty to get information from Sarpanch or Gram Sevak whether the village is tribal or non-tribal and inform all students',
        required: true
      },
      {
        id: 'v_1_5_population',
        sr: '1.5',
        label: 'Population',
        type: 'select',
        options: ['1) Less than 1000', '2) 1000-2499', '3) 2500 - 4999', '4) 5000 +'],
        instruction: 'Faculty to get information from Sarpanch or Gram Sevak about current population of village and enter option',
        required: true
      }
    ]
  },
  {
    key: 'section_2_gram_panchayat',
    sr: '2',
    title: 'Gram Panchayat',
    subtitle: 'Water supply, sanitation, disinfection, lighting & solid waste management',
    questions: [
      {
        id: 'gp_2_2_water_supply',
        sr: '2.2',
        label: 'Type of water supply',
        type: 'select',
        options: [
          '1) Tap water - public',
          '2) Tap water - individual houses',
          '3) Well',
          '4) Hand Pump',
          '5) River',
          '6) Tanker'
        ],
        instruction: 'There are various sources of water from where water is supplied to village. Most of the villages have their own water supply scheme and supply water through tap. There can be multiple sources especially when water supply from one source is not adequate. If multiple sources, enter option of most commonly used source',
        required: true
      },
      {
        id: 'gp_2_3_water_adequate',
        sr: '2.3',
        label: 'Do you get adequate quantity of water',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Adequate quantity of water received by households across the village',
        required: true
      },
      {
        id: 'gp_2_4_disinfection_frequency',
        sr: '2.4',
        label: 'What is frequency of disinfection of water',
        type: 'select',
        options: ['1) Daily', '2) Occasionally', '3) Disinfection not done'],
        instruction: 'Regular disinfection of water is necessary so that community gets safe water for drinking which prevents diseases like diarrheal, dysentery. At village level disinfection of water is the responsibility of gram panchayat. Peon of Gram panchayat or one person who is volunteer from village is identified and assigned specific responsibility for daily disinfection of water.',
        required: true
      },
      {
        id: 'gp_2_5_bleaching_powder',
        sr: '2.5',
        label: 'Whether bleaching powder was available on the day of visit',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'For disinfection of water in rural areas Bleaching powder is used. Stock of Bleaching powder has to be adequate in Gram panchayat so that daily disinfection can be done.',
        required: true
      },
      {
        id: 'gp_2_6_chemical_analysis',
        sr: '2.6',
        label: 'Chemical analysis of water supply done in last one year',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Water is tested for chemical analysis in order to check if there are any harmful chemicals in drinking water. It is done once in a year.',
        required: true
      },
      {
        id: 'gp_2_7_bacterial_analysis',
        sr: '2.7',
        label: 'Bacterial analysis of water sample done in last one year',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Disease producing microorganisms if present in drinking water are responsible for diseases like diarrheal, dysentery, typhoid, hepatitis etc. In order to check whether water is contaminated by such microorganisms, regular at least once a month water samples are sent for laboratory examination. Sarpanch / Gram Sewak can give this information. In addition to this it can be confirmed from Gram panchayat record.',
        required: true
      },
      {
        id: 'gp_2_8_street_lights',
        sr: '2.8',
        label: 'Street lights available on all roads in village',
        type: 'select',
        options: ['1) Yes', '2) Only on few roads', '3) No'],
        instruction: 'Provision of street lights, drainage facility, solid waste disposal these are the basic responsibilities of Gram panchayat. Students can get details about these. Information received from Gram panchayat can be cross checked when they walk through the village.',
        required: true
      },
      {
        id: 'gp_2_9_drainage',
        sr: '2.9',
        label: 'Drainage facility',
        type: 'select',
        options: [
          '1) Closed gutters',
          '2) Closed and open gutters',
          '3) Open gutters',
          '4) No gutters'
        ],
        instruction: 'Drainage facility available in the village',
        required: true
      },
      {
        id: 'gp_2_1_solid_waste',
        sr: '2.1',
        label: 'Solid waste collected by Gram Panchayat',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Solid waste is any discarded material including trash, garbage or refuse',
        required: true
      }
    ]
  },
  {
    key: 'section_3_legal_cases',
    sr: '3',
    title: 'Resolution of Legal Cases',
    subtitle: 'Police Patil, dispute resolution & Tanta Mukta Gao Abhiyan',
    questions: [
      {
        id: 'lc_3_1_police_patil',
        sr: '3.1',
        label: 'Does the village have Police Patil',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Police Patil is a village level law enforcement person and helps police to maintain law and order in the village. He is responsible for maintaining peace and order in the village',
        required: true
      },
      {
        id: 'lc_3_2_tanta_mukta',
        sr: '3.2',
        label: 'Tanta Mukta samiti functional',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'To reduce the burden on judiciary and resolve minor problems in the village at local level, Mahatma Gandhi Tanta Mukta Gao Abhiyan is started by Government of Maharashtra. A committee is formed under chairmanship of reputed person from that village along with other members. It is a traditional dispute redressal system at village level.',
        required: true
      },
      {
        id: 'lc_3_3_cases_resolved',
        sr: '3.3',
        label: 'Number of cases resolved by committee during last 6 months',
        type: 'select',
        options: ['1) 0 cases', '2) 1-5 cases', '3) 6-10 cases', '4) 11+ cases'],
        instruction: 'Request police Patil to inform about this question',
        required: true
      }
    ]
  },
  {
    key: 'section_4_school',
    sr: '4',
    title: 'Visit to School',
    subtitle: 'School demographics, medium of instruction, infrastructure & sanitation',
    note: 'Village may have one or multiple schools. If there are multiple schools, faculty to make groups of students and distribute groups amongst all the schools.',
    questions: [
      {
        id: 'sc_4_1_students_count',
        sr: '4.1',
        label: 'Number of students in the school',
        type: 'select',
        options: ['1) Up to 100 students', '2) 100-199 students', '3) 200-499 students', '4) 500+ students'],
        instruction: 'Choose correct option based upon number of students in the school',
        required: true
      },
      {
        id: 'sc_4_2_medium',
        sr: '4.2',
        label: 'Medium of school',
        type: 'select',
        options: ['1) Marathi', '2) English', '3) Semi English', '4) Other'],
        instruction: 'Get information about medium of school from principal / Headmaster and enter appropriate option',
        required: true
      },
      {
        id: 'sc_4_3_building_condition',
        sr: '4.3',
        label: 'Condition of school building',
        type: 'select',
        options: ['1) Good Condition', '2) Bad condition', '3) Dangerous to use as a school'],
        instruction: 'Physical safety and structural condition of school building',
        required: true
      },
      {
        id: 'sc_4_4_toilets',
        sr: '4.4',
        label: 'Toilets available for students',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Functional toilets available for boys and girls in the school',
        required: true
      },
      {
        id: 'sc_4_5_drinking_water',
        sr: '4.5',
        label: 'Drinking water available',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Safe and potable drinking water accessible to students on premises',
        required: true
      }
    ]
  },
  {
    key: 'section_5_health_facility',
    sr: '5',
    title: 'Public Health Facility in Village',
    subtitle: 'Primary health care delivery, institutional deliveries, emergency services & ambulance',
    questions: [
      {
        id: 'hf_5_1_facility_type',
        sr: '5.1',
        label: 'Type of government health facility available in the village',
        type: 'select',
        options: ['1) No', '2) Sub Centre', '3) Primary Health Centre'],
        instruction: 'Government Health facility at the village can be Subcentre or Primary Health Centre or Rural Hospital / Sub District Hospital. Sub centre provides basic health services where one female and one male health worker are posted. Female worker is known as Auxiliary Nurse Midwife (ANM) and male worker is known as Multi-Purpose Worker Male (MPW-M). In addition to this there is one community health officer under Ayushman Bharat scheme. At Primary health Centre MBBS/BAMS doctor along with other staff is available. At Rural Hospital / Sub District Hospital specialist doctors are expected to provide OPD as well as indoor services and emergency care.',
        required: true
      },
      {
        id: 'hf_5_5_deliveries_conducted',
        sr: '5.5',
        label: 'Whether delivery take place in health facility',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Delivery of pregnant women should take place in health institution. Get the information from staff regarding whether pregnant women come for their delivery and whether regularly deliveries are conducted in the health institution.',
        required: true
      },
      {
        id: 'hf_5_6_emergency_services',
        sr: '5.6',
        label: 'Whether Emergency Medical Services available',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'When any emergency patient like accident, poisoning, snakebite etc comes to health facility medical treatment should be provided by the doctors / staff within the available resources and as per speciality of doctors. At least basic care has to be provided and then patient can be referred to higher centre after stabilising. Enquire about whether such services are provided in case of emergency.',
        required: true
      },
      {
        id: 'hf_5_7_ambulance_available',
        sr: '5.7',
        label: 'Whether village get ambulance for health emergency',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Public health department is making available Emergency Medical Services. Accordingly, when there is emergency patient who needs to be transported from home to hospital or patient has to be referred from any health facility to higher centre, ambulance is available through dialling Toll-free number 108. Get the information whether government Ambulance is available for transport of emergency cases to health facility. Ask Sarpanch or villagers about ambulance availability',
        required: true
      },
      {
        id: 'hf_5_9_asha_referral',
        sr: '5.9',
        label: 'Whether ASHA is helping in referral of delivery cases',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'ASHA helps pregnant women to deliver in health facility. She accompanies pregnant woman at the time of delivery to health centre.',
        required: true
      }
    ]
  },
  {
    key: 'section_6_anganwadi',
    sr: '6',
    title: 'Anganwadi Services',
    subtitle: 'Child nutrition, supplementary food availability & maternal monitoring',
    questions: [
      {
        id: 'aw_6_1_anganwadi_present',
        sr: '6.1',
        label: 'Is there Anganwadi in the village',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'In rural area there is one Anganwadi for about 1000 population. Anganwadi has one Anganwadi worker and one helper to assist her. Anganwadi worker and ANM work in co-ordination. Supplementary nutrition is provided through Anganwadi to children below 6 years, pregnant women and mothers who are delivered. Monitoring of malnourished children is done by Anganwadi worker. In addition to these other services are also provided through Anganwadi.',
        required: true
      },
      {
        id: 'aw_6_2_supplementary_nutrition',
        sr: '6.2',
        label: 'Whether supplementary nutrition provided to children and pregnant mothers daily',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Special diet is provided to malnourished children by Anganwadi.',
        required: true
      },
      {
        id: 'aw_6_3_food_not_available_days',
        sr: '6.3',
        label: 'How many days in last one-month supplementary food was not available in Anganwadi',
        type: 'select',
        options: [
          '1) All functioning days available',
          '2) 1 to 5 days not available',
          '3) 6-15 days not available',
          '4) 16-30 days not available'
        ],
        instruction: 'Number of functioning days supplementary food was unavailable in Anganwadi',
        required: true
      }
    ]
  },
  {
    key: 'section_7_ration_shop',
    sr: '7',
    title: 'Visit to Ration Shop',
    subtitle: 'Public Distribution System (PDS), food grain supply & BPL subsidies',
    questions: [
      {
        id: 'rs_7_1_ration_shop_available',
        sr: '7.1',
        label: 'Whether Ration shop available in the village',
        type: 'select',
        options: [
          '1) Yes',
          '2) Not in village but available in nearby village',
          '3) No'
        ],
        instruction: 'Under Public Distribution System food items are provided to families through Ration shop.',
        required: true
      },
      {
        id: 'rs_7_2_food_items_regular',
        sr: '7.2',
        label: 'Is supply of all food items regularly available',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Regular monthly supply of sanctioned ration items (wheat, rice, sugar, oil)',
        required: true
      },
      {
        id: 'rs_7_3_bpl_ration_subsidised',
        sr: '7.3',
        label: 'Do the below poverty line families get ration at subsidised rates or free',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Enquire whether yellow/orange ration card holders get free/subsidised grains under PMGKAY or state schemes',
        required: true
      }
    ]
  },
  {
    key: 'section_8_talathi_sajja',
    sr: '8',
    title: 'Talathi Sajja',
    subtitle: 'Revenue administration, land records & online Satbara (7/12) access',
    questions: [
      {
        id: 'ts_8_1_talathi_available',
        sr: '8.1',
        label: 'Is Talathi available in village',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Presence and weekly schedule of Talathi for village revenue issues and mutation entries',
        required: true
      },
      {
        id: 'ts_8_3_satbara_online',
        sr: '8.3',
        label: 'Whether you get Satbara (7/12) online or not',
        type: 'select',
        options: ['1) Yes', '2) No'],
        instruction: 'Availability and access of digitally signed 7/12 extract online (MahaBhulekh / Aaple Sarkar)',
        required: true
      }
    ]
  },
  {
    key: 'section_9_special_scheme',
    sr: '9',
    title: 'Special Scheme Implemented by Village',
    subtitle: 'Special government or local schemes, community beneficiaries & village awards',
    questions: [
      {
        id: 'ss_9_special_scheme_details',
        sr: '9',
        label: 'Any special scheme implemented by village - Purpose, beneficiary, progress',
        type: 'textarea',
        placeholder: 'Mention the name of scheme, purpose, beneficiary, progress, and award if received...',
        instruction: 'Mention the name of scheme and award if received (e.g. Sant Gadge Baba Gram Swachhata, Jalyukt Shivar, Nirmal Gram, Adarsh Gaon, Solar micro-grid, etc.)',
        required: true
      }
    ]
  }
];

export const INSTITUTION_TYPES_OPTIONS = [
  'Gram Panchayat Office',
  'Zilla Parishad Primary / High School',
  'Primary Health Centre (PHC) / Sub-Centre',
  'Anganwadi Centre',
  'Fair Price / Ration Shop',
  'Talathi Office / Sajja',
  'Village Cooperative Society / Bank',
  'Veterinary Clinic / Centre',
  'Post Office / Community Hall',
  'Other Village Institution'
];

/**
 * Returns default empty form sections object
 */
export function getInitialInstitutionSections() {
  const sections = {};
  INSTITUTION_FORM_SECTIONS.forEach(sec => {
    sections[sec.key] = {};
    sec.questions.forEach(q => {
      sections[sec.key][q.id] = '';
    });
  });
  return sections;
}

/**
 * Validates a single institution visit entry
 */
export function validateInstitutionVisit(v, idx = 0) {
  if (!v) return `Institution #${idx + 1} has no data.`;
  if (!v.institution_type?.trim()) return `Please select Institution Type for Institution #${idx + 1}`;
  if (!v.institution_name?.trim()) return `Please enter Institution Name & Village for Institution #${idx + 1}`;
  if (!v.official_contact_person?.trim()) return `Please enter Official Met / Contact Person for Institution #${idx + 1}`;
  if (!v.visit_date) return `Please select Date of Visit for Institution #${idx + 1}`;
  if (!v.services_provided?.trim()) return `Please enter Key Functions & Services Provided for Institution #${idx + 1}`;
  if (!v.observations?.trim() && !v.key_observations?.trim()) return `Please enter Key Field Observations for Institution #${idx + 1}`;
  if (!v.challenges_identified?.trim()) return `Please enter Identified Challenges / Service Gaps for Institution #${idx + 1}`;
  if (!v.recommendations?.trim()) return `Please enter Student Recommendations for Institution #${idx + 1}`;
  return null;
}

/**
 * Validates Form IV sections
 */
export function validateFormIVSections(sections = {}) {
  for (const sec of INSTITUTION_FORM_SECTIONS) {
    const secData = sections[sec.key] || {};
    for (const q of sec.questions) {
      if (q.required) {
        const val = secData[q.id];
        if (!val || (typeof val === 'string' && !val.trim())) {
          return `Please complete Question ${q.sr} (${q.label}) in "${sec.title}".`;
        }
      }
    }
  }
  return null;
}

/**
 * Calculates progress percentage for Form IV
 */
export function calculateFormIVProgress(visits = [], sections = {}) {
  let visitScore = 0;
  const validVisits = visits.filter(v => v.institution_name?.trim() && (v.observations?.trim() || v.key_observations?.trim() || v.services_provided?.trim()));
  if (validVisits.length >= 2) {
    visitScore = 40;
  } else if (validVisits.length === 1) {
    visitScore = 20;
  }

  let totalQuestions = 0;
  let answeredQuestions = 0;
  INSTITUTION_FORM_SECTIONS.forEach(sec => {
    const secData = sections[sec.key] || {};
    sec.questions.forEach(q => {
      totalQuestions += 1;
      const val = secData[q.id];
      if (val && typeof val === 'string' && val.trim().length > 0) {
        answeredQuestions += 1;
      }
    });
  });

  const sectionScore = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 60) : 0;
  return Math.min(95, Math.max(0, visitScore + sectionScore));
}
