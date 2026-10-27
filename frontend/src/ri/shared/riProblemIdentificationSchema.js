/**
 * Official Form VI Schema - ANNEX G-8
 * PROBLEM / ISSUE IDENTIFICATION AND DEVELOPING SOLUTION
 * Source of Truth: Operational Guidelines RUIP 4.docx (Annex G-8, Form VI)
 */

export const FORM_VI_META = {
  annexure: 'ANNEX – G-8',
  formCode: 'FORM – VI',
  title: 'PROBLEM / ISSUE IDENTIFICATION AND DEVELOPING SOLUTION',
  purpose: 'To record problems issues identified by students and development of solution to the identified problem.',
  howToFill: 'Information related to problem identification and solution has to be entered as per instructions given in last column of the table.',
  whoWillFill: 'Students',
  whoWillCheck: 'Faculty accompanying the students',
  whenToFill: 'Immediately after presentation to expert committee.',
  submission: 'Soft copy of completed form along with all presentations to be submitted to RI Cell.'
};

export const SDG_OPTIONS = ['Yes', 'No'];
export const DEGREE_PROGRAM_OPTIONS = ['Yes', 'No'];
export const SOLUTION_OFFERED_OPTIONS = ['Yes', 'No'];
export const SOLUTION_PRACTICAL_OPTIONS = ['Yes', 'No'];
export const COMMITTEE_REMARKS_OPTIONS = ['Excellent', 'Good', 'Satisfactory', 'Un-satisfactory'];

export const FORM_VI_DEFAULT_VALUES = {
  // 1 to 5
  school_name: '',
  department_name: '',
  degree_program: '',
  village_visited: '',
  students_participated: '',

  // 6. Team information
  team_leader_name: '',
  total_team_members: 5,

  // 7. Problem / Issue identified
  problem_title: '',
  is_aligned_with_sdg: '',
  is_related_to_degree: '',

  // 8. Solution to problem / issue
  solution_offered: '',
  helping_faculty_name: '',
  helping_faculty_dept: '',
  solution_is_practical_implementable: '',

  // 9. Presentation to committee
  committee_chairperson: '',
  presentation_date: '',
  committee_remarks: '',

  // 10 & 11
  sarpanch_informed_details: '',
  ri_cell_submission_details: '',

  // Deliverable (Optional for team members — uploaded by group leader)
  assignment_link: '',
  assignment_file_name: '',

  // Optional presentation link
  presentation_link: ''
};

export const FORM_VI_SECTIONS = [
  {
    sr: '1',
    key: 'school_name',
    label: 'Name of School',
    instruction: 'Self-explanatory',
    type: 'text',
    placeholder: 'Enter school name',
    required: true
  },
  {
    sr: '2',
    key: 'department_name',
    label: 'Department',
    instruction: 'Self-explanatory',
    type: 'text',
    placeholder: 'Enter department name',
    required: true
  },
  {
    sr: '3',
    key: 'degree_program',
    label: 'Degree Program',
    instruction: 'Self-explanatory',
    type: 'text',
    placeholder: 'Enter degree program name',
    required: true
  },
  {
    sr: '4',
    key: 'village_visited',
    label: 'Name of the village visited',
    instruction: 'Self-explanatory',
    type: 'text',
    placeholder: 'Enter village visited',
    required: true
  },
  {
    sr: '5',
    key: 'students_participated',
    label: 'Number of students participated',
    instruction: 'Self-explanatory',
    type: 'number',
    placeholder: 'Enter total number of students participated',
    required: true
  },
  {
    sr: '6',
    header: '6. Team information (5-member team)',
    subfields: [
      {
        sr: '6.1',
        key: 'team_leader_name',
        label: 'Name of the team leader',
        instruction: 'As per guidelines, teams of 5 students each are to be formed at the time of Orientation Workshop to identify problem and suggest solution. Write name of the team leader',
        type: 'text',
        placeholder: 'Enter team leader name',
        required: true
      },
      {
        sr: '6.2',
        key: 'total_team_members',
        label: 'Total members in team',
        instruction: 'Write total members in the team. Normally there should be 5 members.',
        type: 'number',
        placeholder: '5',
        required: true
      }
    ]
  },
  {
    sr: '7',
    header: '7. Problem / Issue identified',
    subfields: [
      {
        sr: '7.1',
        key: 'problem_title',
        label: 'Title of problem / Issue identified',
        instruction: 'Each team is expected to identify one problem / issue from village in line with SDGs and degree program. Team leader is expected to record title of the problem identified.',
        type: 'textarea',
        placeholder: 'Enter title and details of the identified problem / issue',
        required: true
      },
      {
        sr: '7.2',
        key: 'is_aligned_with_sdg',
        label: 'Is it in line with SDGs',
        instruction: 'Write appropriate option',
        type: 'select',
        options: SDG_OPTIONS,
        required: true
      },
      {
        sr: '7.3',
        key: 'is_related_to_degree',
        label: 'Is it related to your degree program',
        instruction: 'Write appropriate option',
        type: 'select',
        options: DEGREE_PROGRAM_OPTIONS,
        required: true
      }
    ]
  },
  {
    sr: '8',
    header: '8. Solution to problem / issue',
    subfields: [
      {
        sr: '8.1',
        key: 'solution_offered',
        label: 'Solution offered',
        instruction: 'Solution should be practical and doable considering the expertise and resources available at village level. If the solution is doable then select option ‘Yes’ otherwise ‘No’ option is to be selected.',
        type: 'select',
        options: SOLUTION_OFFERED_OPTIONS,
        required: true
      },
      {
        sr: '8.2',
        subHeader: 'Which faculty helped students to prepare solution',
        nestedFields: [
          {
            sr: '8.1.1',
            key: 'helping_faculty_name',
            label: 'Name',
            instruction: 'Write name of faculty',
            type: 'text',
            placeholder: 'Enter faculty name',
            required: true
          },
          {
            sr: '8.1.2',
            key: 'helping_faculty_dept',
            label: 'Department',
            instruction: 'Write department of faculty',
            type: 'text',
            placeholder: 'Enter faculty department',
            required: true
          }
        ]
      },
      {
        sr: '8.2 (8.3)',
        key: 'solution_is_practical_implementable',
        label: 'Is solution offered practical and implementable',
        instruction: 'Write appropriate option',
        type: 'select',
        options: SOLUTION_PRACTICAL_OPTIONS,
        required: true
      }
    ]
  },
  {
    sr: '9',
    header: '9. Presentation to committee',
    subfields: [
      {
        sr: '9.1',
        key: 'committee_chairperson',
        label: 'Name and designation of chairperson of committee',
        instruction: 'Write name and designation of Chairperson',
        type: 'text',
        placeholder: 'Enter name and designation of Chairperson',
        required: true
      },
      {
        sr: '9.2',
        key: 'presentation_date',
        label: 'Date of presentation',
        instruction: 'Self-explanatory',
        type: 'date',
        required: true
      },
      {
        sr: '9.3',
        key: 'committee_remarks',
        label: 'Remarks by committee',
        instruction: 'Record appropriate option',
        type: 'select',
        options: COMMITTEE_REMARKS_OPTIONS,
        required: true
      }
    ]
  },
  {
    sr: '10',
    key: 'sarpanch_informed_details',
    label: 'Problem / issue and solution informed to Sarpanch and Gram Panchayat',
    instruction: 'Write date and name of the person to whom problem / issue is informed',
    type: 'textarea',
    placeholder: 'Enter date and name of the person to whom problem / issue is informed',
    required: true
  },
  {
    sr: '11',
    key: 'ri_cell_submission_details',
    label: 'Presentation submitted to RI Cell',
    instruction: 'Write date and name of the person to whom the presentation is submitted',
    type: 'textarea',
    placeholder: 'Enter date and name of the person to whom the presentation is submitted',
    required: true
  }
];
