/**
 * Official Form IIIB Schema - ANNEX G-5
 * DAILY ACTIVITY REPORT - STUDENTS
 * Source of Truth: Operational Guidelines RUIP 4.docx (Annex G-5, Form IIIB, Table 135)
 */

export const FORM_IIIB_META = {
  annexure: 'ANNEX – G-5',
  formCode: 'FORM – IIIB',
  title: 'DAILY ACTIVITY REPORT - STUDENTS',
  purpose: 'To record all the activities implemented by students during five day visit. This table will also help to plan activities.',
  howToFill: 'Students will record observations / findings, etc. under observations column of the table. Instructions about how to record each activity is mentioned in last column of table.',
  whoWillFill: 'All the students undergoing visit to village under RI Program.',
  whoWillCheck: 'Faculty accompanying the students',
  whenToFill: 'Daily from Day-1 to Day – 7 evening after completing that day’s activities.',
  submission: 'Student will submit form to Faculty / Nodal Officer after completion of visit'
};

export const COMMUNITY_PROJECT_OPTIONS = [
  'Shramadan – cleaning',
  'Tree plantation',
  'Health Camp',
  'Skill based training',
  'Other'
];

export const YES_NO_OPTIONS = ['Yes', 'No'];

export const FORM_IIIB_DEFAULT_VALUES = {
  // Student & Village Details
  student_name: '',
  school_name: '',
  degree_program: '',
  village_visited: '',
  total_days_in_village: '5 Days',

  // 5. Visit information
  // 5.1 Seven-day visit plan
  seven_day_plan_completed: 'Yes',
  seven_day_plan_improvements: '',

  // 5.2 Community project
  community_project_types: [],
  community_project_other_text: '',
  community_project_work_done: '',
  community_project_suggestions: '',

  // 5.3 In depth study of one problem
  study_group_included: 'Yes',
  study_problem_title: '',
  study_solution_submitted: 'Yes',
  study_presented_to_committee: 'Yes',
  study_suggestions: '',

  // 5.4 Institutional visits
  institutions_visited_count: 2,
  institutional_visits_suggestions: '',

  // 5.5 Home visits
  homes_visited_count: 5,
  home_visits_suggestions: '',

  // 6. Best practices of village observed during visit
  best_practices_observed: '',

  // 7. Any other important activity implemented
  other_activities_implemented: '',

  // 8. Other issues / suggestions
  issues_affecting_implementation: '',
  suggestions_to_improve_program: '',

  // 9. Remarks
  remarks: '',

  // Activity Photos
  activity_photo_1: '',
  activity_photo_2: ''
};
