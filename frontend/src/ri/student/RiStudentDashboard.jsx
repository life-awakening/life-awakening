import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Calendar,
  MapPin,
  Phone,
  Mail,
  User,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Briefcase,
  Award,
  BookOpen,
  Compass,
  FileText,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Edit2,
  Printer,
  Check,
  Heart,
  Activity,
  Home,
  Sparkles,
  Info,
  Layers,
  FileCheck,
  RefreshCw,
  Building,
  HeartHandshake,
  CheckSquare,
  ListCheck,
  Settings,
  ExternalLink,
  LifeBuoy,
  MessageSquare,
  Camera
} from 'lucide-react';
import RiFormsHub from './RiFormsHub';
import RiPreparatoryChecklistTab from './RiPreparatoryChecklistTab';
import RiStudentSupportTab from './RiStudentSupportTab';
import RiAnnexuresTab from './RiAnnexuresTab';
import RiThingsToCarryTab from './RiThingsToCarryTab';
import RiVillageTab from './RiVillageTab';
import RiOnboarding from './RiOnboarding';
import RiPanelMediaViewer from '../shared/RiPanelMediaViewer';
import { cleanPanelName, RI_ACTIVITIES, RI_ACTIVITIES_LIST } from '../shared/riUtils';
import { RI_DOS_DONTS_CATEGORIES } from '../shared/riDosDontsData';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Instagram Brand Icon
const InstagramIcon = ({ size = 16, color = "currentColor", style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

// Authoritative 2-Day RUIP Schedule Defaults (from Operational Guidelines RUIP)
const DEFAULT_SCHEDULE = [
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

// Helper to color code tags based on activity type matching LTC schedule solid-fill pill design
const getRiCategoryStyles = (category, type) => {
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

const DEFAULT_MODULES = [
  {
    id: 'survey',
    title: '1. Socio-Economic & Village Resource Survey',
    pillar: 'Field Immersion & Assessment',
    description: 'Survey households and village infrastructure (drinking water, electricity, sanitation, PHC, school, agriculture). Complete Form IV and Form V.',
    learning_outcome: 'Understand rural demographic realities, resource gaps, and community dynamics.',
    deliverables: ['Completed Form IV (Institutional Visits)', 'Completed Form V (Family Visit - min 3-4 families/pair)'],
    max_marks: 50
  },
  {
    id: 'outreach_debrief',
    title: '2. Community Outreach, Shramdaan & Village Debrief',
    pillar: 'Community Action & Gram Sabha Debrief',
    description: 'Student-led Shramdaan community project, primary school interactive sessions, and formal village debrief presentation with Sarpanch & Panchayat.',
    learning_outcome: 'Develop empathy, civic responsibility, and present actionable rural insights.',
    deliverables: ['Community Project (Shramdaan) Report', 'Sarpanch & Panchayat Debrief Presentation', 'Form IIIB Daily Activity Log'],
    max_marks: 50
  }
];

// Reusable clean section component inspired by LTC Student Portal
const DashboardCard = ({ title, icon: Icon, action, children }) => (
  <div style={{
    background: '#ffffff',
    border: '1.5px solid #e2e8f0',
    borderRadius: '16px',
    padding: '22px',
    marginBottom: '20px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)'
  }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '18px',
      borderBottom: '1px solid #f1f5f9',
      paddingBottom: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {Icon && (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #065f46, #059669)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 8px rgba(6, 95, 70, 0.2)'
          }}>
            <Icon size={16} strokeWidth={2.2} />
          </div>
        )}
        <h3 style={{
          fontSize: '15px',
          fontWeight: 800,
          color: '#0f172a',
          margin: 0,
          letterSpacing: '-0.3px'
        }}>
          {title}
        </h3>
      </div>
      {action && <div>{action}</div>}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
      {children}
    </div>
  </div>
);

// Reusable clean field component
const InfoField = ({ label, value, highlight = false, isPhone = false, isEmail = false }) => {
  let displayValue = value || '—';
  if (isPhone && value && value !== '—') {
    displayValue = (
      <a href={`tel:${value}`} style={{ color: '#047857', textDecoration: 'none', fontWeight: 700 }}>
        📞 {value}
      </a>
    );
  } else if (isEmail && value && value !== '—') {
    displayValue = (
      <a href={`mailto:${value}`} style={{ color: '#047857', textDecoration: 'none', fontWeight: 600 }}>
        ✉️ {value}
      </a>
    );
  }

  return (
    <div style={{
      padding: '10px 14px',
      background: highlight ? '#ecfdf5' : '#f8fafc',
      borderRadius: '10px',
      border: `1px solid ${highlight ? '#a7f3d0' : '#e2e8f0'}`,
      transition: 'all 0.15s ease'
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 800,
        color: highlight ? '#065f46' : '#64748b',
        textTransform: 'uppercase',
        marginBottom: '4px',
        letterSpacing: '0.5px'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '13.5px',
        fontWeight: 700,
        color: highlight ? '#047857' : (value ? '#0f172a' : '#94a3b8')
      }}>
        {displayValue}
      </div>
    </div>
  );
};

export default function RiStudentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation state
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(localStorage.getItem('ri_sidebar_collapsed') === 'true');
  const [toast, setToast] = useState(null);

  // RI Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userKey = user.id || user.email || user.prn || 'student';
      const completed = localStorage.getItem(`ri_onboarding_completed_${userKey}`);
      return completed !== 'true';
    } catch {
      return false;
    }
  });

  const handleCompleteOnboarding = useCallback(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userKey = user.id || user.email || user.prn || 'student';
      localStorage.setItem(`ri_onboarding_completed_${userKey}`, 'true');
    } catch {}
    setShowOnboarding(false);
  }, []);

  const addToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const toggleSidebarCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('ri_sidebar_collapsed', String(newState));
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) setIsMobileNavOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileNavOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileNavOpen, isMobile]);

  // Data state
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [activitiesData, setActivitiesData] = useState(null);
  const [programsData, setProgramsData] = useState(null);
  const [panelMedia, setPanelMedia] = useState([]);
  const [isPanelMediaLoading, setIsPanelMediaLoading] = useState(false);

  // Schedule interactive state
  const [selectedScheduleDay, setSelectedScheduleDay] = useState(1);
  const [overviewScheduleDay, setOverviewScheduleDay] = useState(1);

  // Do's & Don'ts interactive state
  const [dosDontsActiveCategory, setDosDontsActiveCategory] = useState('all');
  const [dosDontsSearchQuery, setDosDontsSearchQuery] = useState('');

  const toggleDay = useCallback((dayNum) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayNum]: !prev[dayNum]
    }));
  }, []);

  const expandAllDays = useCallback(() => {
    setExpandedDays({ 1: true, 2: true });
  }, []);

  const collapseAllDays = useCallback(() => {
    setExpandedDays({});
  }, []);

  // Compute active schedule data
  const activeScheduleList = useMemo(() => {
    if (activitiesData?.schedule && activitiesData.schedule.length > 0) {
      return activitiesData.schedule;
    }
    return DEFAULT_SCHEDULE;
  }, [activitiesData]);

  // Compute evaluation modules
  const activeEvaluationModules = useMemo(() => {
    if (activitiesData?.evaluation?.modules && activitiesData.evaluation.modules.length > 0) {
      return activitiesData.evaluation.modules;
    }
    return DEFAULT_MODULES;
  }, [activitiesData]);

  // Search in panel teammates list
  const [teamSearch, setTeamSearch] = useState('');

  // Undertaking state
  const [undertakingData, setUndertakingData] = useState(null);
  const [undertakingLoading, setUndertakingLoading] = useState(false);
  const [isEditingUndertaking, setIsEditingUndertaking] = useState(false);
  const [submittingUndertaking, setSubmittingUndertaking] = useState(false);
  const [undertakingSuccessMsg, setUndertakingSuccessMsg] = useState('');
  const [undertakingErrorMsg, setUndertakingErrorMsg] = useState('');

  const [undertakingForm, setUndertakingForm] = useState({
    emergencyContactName: '',
    emergencyContactRelation: 'Parent',
    emergencyContactMobile: '',
    emergencyContactAltMobile: '',
    emergencyContactEmail: '',
    bloodGroup: '',
    medicalConditions: '',
    knownAllergies: '',
    currentMedication: '',
    dietaryRestrictions: '',
    medicalOther: '',
    consentFieldWork: true,
    consentCodeOfConduct: true,
    consentMedicalEmergency: true,
    consentPhotoVideo: true,
    signedName: '',
    signedDate: new Date().toISOString().split('T')[0]
  });

  // Auth headers
  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }, []);

  const hasLtc = profileData !== null
    ? Boolean(profileData.has_ltc)
    : (programsData !== null
        ? Boolean(programsData.has_ltc)
        : Boolean(JSON.parse(localStorage.getItem('user') || '{}')?.programs?.has_ltc));

  const isUndertakingSubmitted = Boolean(
    profileData?.student?.undertaking_submitted ||
    profileData?.undertaking_status?.submitted ||
    undertakingData?.submitted ||
    JSON.parse(localStorage.getItem('user') || '{}')?.undertaking_submitted
  );

  const [isUndertakingModalOpen, setIsUndertakingModalOpen] = useState(false);
  const [showGatePopup, setShowGatePopup] = useState(true);

  // ─── RI Forms Reminder & Deadline Calculation ───────────────────────────
  const SIX_RI_FORMS = useMemo(() => [
    { type: 'UNDERTAKING',           label: 'Student Undertaking',                      tab: 'undertaking' },
    { type: 'DAILY_ACTIVITY_REPORT', label: 'Daily Activity Report',                    tab: 'forms' },
    { type: 'INSTITUTIONAL_VISIT',   label: 'Institutional Visits',                     tab: 'forms' },
    { type: 'FAMILY_SURVEY',         label: 'Family Visits',                            tab: 'forms' },
    { type: 'PROBLEM_IDENTIFICATION',label: 'Problem / Issue Identification & Solution',tab: 'forms' },
    { type: 'STUDENT_FEEDBACK',      label: 'RI Feedback Form',                         tab: 'forms' }
  ], []);

  const [showFormsReminder, setShowFormsReminder] = useState(false);
  const [formsReminderPending, setFormsReminderPending] = useState([]);

  // Calculate submission deadline as 7 days after the student's actual batch end date
  const getFormsSubmissionDeadline = (endDateVal) => {
    if (!endDateVal) return null;
    try {
      const str = String(endDateVal).split('T')[0];
      const parts = str.split('-');
      let baseDate;
      if (parts.length === 3) {
        baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999);
      } else {
        baseDate = new Date(endDateVal);
      }
      if (isNaN(baseDate.getTime())) return null;
      const deadline = new Date(baseDate);
      deadline.setDate(deadline.getDate() + 7);
      deadline.setHours(23, 59, 59, 999);
      return deadline;
    } catch (e) {
      return null;
    }
  };

  const batchEndDate = profileData?.batch?.end_date;
  const formsDeadlineDate = useMemo(() => getFormsSubmissionDeadline(batchEndDate), [batchEndDate]);
  const isFormsDeadlineOverdue = useMemo(() => {
    if (!formsDeadlineDate) return false;
    return new Date() > formsDeadlineDate;
  }, [formsDeadlineDate]);

  const formattedFormsDeadline = useMemo(() => {
    if (!formsDeadlineDate) return '7 days after batch end date';
    return formsDeadlineDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, [formsDeadlineDate]);

  const formattedBatchEndDate = useMemo(() => {
    if (!batchEndDate) return null;
    try {
      const str = String(batchEndDate).split('T')[0];
      const parts = str.split('-');
      let d;
      if (parts.length === 3) {
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        d = new Date(batchEndDate);
      }
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return null;
    }
  }, [batchEndDate]);

  const handleOpenUndertaking = useCallback(() => {
    if (!hasLtc) {
      setActiveTab('undertaking');
    } else {
      if (!isUndertakingSubmitted) {
        setIsUndertakingModalOpen(true);
      } else {
        setActiveTab('undertaking');
      }
    }
    if (isMobile) setIsMobileNavOpen(false);
  }, [hasLtc, isUndertakingSubmitted, isMobile]);

  const handleConfirmMoveToLtcPortal = useCallback(() => {
    setIsUndertakingModalOpen(false);
    navigate('/student?tab=undertaking');
  }, [navigate]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const tabParam = params.get('tab');
      if (tabParam && tabParam !== activeTab) {
        if (profileData && !isUndertakingSubmitted) {
          setActiveTab('undertaking');
          if (hasLtc) setIsUndertakingModalOpen(true);
        } else {
          setActiveTab(tabParam);
        }
      }
    } catch {}
  }, [location.search, hasLtc, isUndertakingSubmitted, activeTab, profileData]);

  // Undertaking Gate: ONLY gate after profileData has loaded from backend
  useEffect(() => {
    if (profileData && !isUndertakingSubmitted && activeTab !== 'undertaking') {
      setActiveTab('undertaking');
      if (hasLtc) {
        setIsUndertakingModalOpen(true);
      }
    }
  }, [profileData, isUndertakingSubmitted, activeTab, hasLtc]);

  // Automatically close undertaking move modal if undertaking is submitted
  useEffect(() => {
    if (isUndertakingSubmitted && isUndertakingModalOpen) {
      setIsUndertakingModalOpen(false);
    }
  }, [isUndertakingSubmitted, isUndertakingModalOpen]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  // ─── Fetch All Student Portal Data ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      // 1. Fetch Profile & Assignment
      const profRes = await fetch(`${API}/api/ri/student/profile`, { headers: authHeaders });
      if (profRes.status === 401) {
        handleLogout();
        return;
      }
      const profJson = await profRes.json();
      setProfileData(profJson);

      // Keep cached user programs and undertaking status synchronized with trusted backend profile
      try {
        const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (cachedUser && cachedUser.id) {
          cachedUser.undertaking_submitted = Boolean(profJson?.student?.undertaking_submitted || profJson?.undertaking_status?.submitted);
          cachedUser.programs = {
            ...(cachedUser.programs || {}),
            has_ltc: Boolean(profJson.has_ltc),
            has_ri: true
          };
          localStorage.setItem('user', JSON.stringify(cachedUser));
        }
      } catch (e) {}

      // Pre-fill signature name if empty
      if (profJson?.student?.name) {
        setUndertakingForm(prev => ({
          ...prev,
          signedName: prev.signedName || profJson.student.name
        }));
      }

      // 2. Fetch Attendance Records
      const attRes = await fetch(`${API}/api/ri/student/attendance`, { headers: authHeaders });
      if (attRes.ok) {
        const attJson = await attRes.json();
        setAttendanceData(attJson);
      }

      // 3. Fetch Schedule & Activities
      const actRes = await fetch(`${API}/api/ri/student/activities`, { headers: authHeaders });
      if (actRes.ok) {
        const actJson = await actRes.json();
        setActivitiesData(actJson);
      }

      // 4. Check Programs
      const progRes = await fetch(`${API}/api/ri/student/programs`, { headers: authHeaders });
      if (progRes.ok) {
        const progJson = await progRes.json();
        setProgramsData(progJson);
      }

      // 5. Fetch Undertaking Record
      const underRes = await fetch(`${API}/api/ri/student/undertaking`, { headers: authHeaders });
      if (underRes.ok) {
        const underJson = await underRes.json();
        setUndertakingData(underJson);
        if (underJson.submitted && underJson.undertaking) {
          const u = underJson.undertaking;
          setUndertakingForm({
            emergencyContactName: u.emergency_contact_name || '',
            emergencyContactRelation: u.emergency_contact_relation || 'Parent',
            emergencyContactMobile: u.emergency_contact_mobile || '',
            emergencyContactAltMobile: u.emergency_contact_alt_mobile || '',
            emergencyContactEmail: u.emergency_contact_email || '',
            bloodGroup: u.blood_group || '',
            medicalConditions: u.medical_conditions || '',
            knownAllergies: u.known_allergies || '',
            currentMedication: u.current_medication || '',
            dietaryRestrictions: u.dietary_restrictions || '',
            medicalOther: u.medical_other || '',
            consentFieldWork: u.consent_field_work !== false,
            consentCodeOfConduct: u.consent_code_of_conduct !== false,
            consentMedicalEmergency: u.consent_medical_emergency !== false,
            consentPhotoVideo: u.consent_photo_video !== false,
            signedName: u.signed_name || profJson?.student?.name || '',
            signedDate: u.signed_date || new Date().toISOString().split('T')[0]
          });
        }
      }

      // 6. Fetch Faculty Uploaded Panel Visit Media
      try {
        setIsPanelMediaLoading(true);
        const mediaRes = await fetch(`${API}/api/ri/student/panel-media`, { headers: authHeaders });
        if (mediaRes.ok) {
          const mediaJson = await mediaRes.json();
          if (mediaJson.success) {
            setPanelMedia(mediaJson.media || []);
          }
        }
      } catch (mErr) {
        console.error('Error fetching student panel media:', mErr);
      } finally {
        setIsPanelMediaLoading(false);
      }

      // 7. Fetch RI Forms status to drive the reminder popup
      try {
        const formsRes = await fetch(`${API}/api/ri/student/forms`, { headers: authHeaders });
        if (formsRes.ok) {
          const formsJson = await formsRes.json();
          const formsMap = {};
          (formsJson.forms || []).forEach(f => {
            formsMap[f.form_type] = f;
          });

          // Check undertaking status from profile or forms
          const isUndertakingDone = Boolean(
            formsMap['UNDERTAKING']?.status === 'Submitted' ||
            formsMap['UNDERTAKING']?.status === 'Reviewed' ||
            profJson?.student?.undertaking_submitted ||
            profJson?.undertaking_status?.submitted ||
            JSON.parse(localStorage.getItem('user') || '{}')?.undertaking_submitted
          );

          const pending = SIX_RI_FORMS.filter(spec => {
            if (spec.type === 'UNDERTAKING' && isUndertakingDone) return false;
            const formObj = formsMap[spec.type];
            return !formObj || (formObj.status !== 'Submitted' && formObj.status !== 'Reviewed');
          });

          setFormsReminderPending(pending);
          setShowFormsReminder(pending.length > 0);
        }
      } catch (formsErr) {
        console.warn('[FormsReminder] Could not fetch forms status:', formsErr);
      }
    } catch (err) {
      console.error('Failed to load RI student portal data:', err);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Undertaking Submission
  const handleSubmitUndertaking = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSubmittingUndertaking(true);
    setUndertakingSuccessMsg('');
    setUndertakingErrorMsg('');

    if (!undertakingForm.emergencyContactName.trim()) {
      setUndertakingErrorMsg('Please enter an Emergency Contact Name.');
      setSubmittingUndertaking(false);
      return;
    }
    if (!undertakingForm.emergencyContactMobile.trim()) {
      setUndertakingErrorMsg('Please enter an Emergency Contact Mobile number.');
      setSubmittingUndertaking(false);
      return;
    }
    if (!undertakingForm.signedName.trim()) {
      setUndertakingErrorMsg('Please provide your digital signature (full name).');
      setSubmittingUndertaking(false);
      return;
    }

    try {
      const res = await fetch(`${API}/api/ri/student/undertaking`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...undertakingForm, isEditing: isEditingUndertaking })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUndertakingSuccessMsg('Rural Immersion Undertaking submitted successfully!');
        setUndertakingData({
          submitted: true,
          undertaking: data.undertaking,
          student_info: undertakingData?.student_info
        });
        setIsEditingUndertaking(false);
        // Refresh profile to reflect undertaking status
        const profRes = await fetch(`${API}/api/ri/student/profile`, { headers: authHeaders });
        if (profRes.ok) {
          setProfileData(await profRes.json());
        }
        // Refresh forms reminder pending list
        setFormsReminderPending(prev => {
          const updated = prev.filter(f => f.type !== 'UNDERTAKING');
          if (updated.length === 0) setShowFormsReminder(false);
          return updated;
        });
      } else {
        setUndertakingErrorMsg(data.message || 'Failed to submit undertaking.');
      }
    } catch (err) {
      console.error('Error submitting undertaking:', err);
      setUndertakingErrorMsg('Network error while submitting undertaking.');
    } finally {
      setSubmittingUndertaking(false);
    }
  };

  const handlePrintUndertaking = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>RURAL IMMERSION PARTICIPANT UNDERTAKING</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #000000; background: #ffffff; }
            .document { border: 2px solid #000000; border-radius: 16px; padding: 40px; max-width: 750px; margin: 0 auto; background: #ffffff; }
            .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #000000; padding-bottom: 20px; }
            h2 { font-size: 20px; margin: 0; text-transform: uppercase; letter-spacing: 1px; color: #064e3b; }
            .subtitle { font-size: 13px; color: #475569; margin-top: 6px; font-weight: 600; }
            .receipt { display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; padding: 10px 0; }
            .checkmark { font-size: 15px; color: #047857; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; text-align: left; width: 100%; margin-top: 16px; border: 1px dashed #94a3b8; padding: 18px; border-radius: 12px; background: #f8fafc; }
            .label { font-size: 10.5px; color: #64748b; text-transform: uppercase; font-weight: 700; }
            .value { font-size: 13.5px; font-weight: 800; color: #0f172a; margin: 4px 0 0 0; }
            .sig { font-family: Georgia, serif; font-style: italic; font-size: 16px; color: #047857; }
            .code-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; font-size: 13px; color: #334155; line-height: 1.6; text-align: left; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="document">
            <div class="header">
              <h2>RURAL IMMERSION PARTICIPANT UNDERTAKING</h2>
              <div class="subtitle">Rural Immersion Program (RIP) • MIT World Peace University</div>
            </div>
            
            <div class="code-box">
              <p style="margin: 0 0 8px 0; font-weight: bold; color: #000000; text-transform: uppercase;">OFFICIAL DECLARATION</p>
              <p>I, <strong>${profileData?.student?.name || undertakingForm.signedName}</strong> (PRN: <strong>${profileData?.student?.prn || '—'}</strong>), student of <strong>${profileData?.student?.department || '—'}</strong>, MIT World Peace University, hereby confirm my participation in the Rural Immersion Program allocated to <strong>${profileData?.village?.name || 'Assigned Village'}</strong>, Panel <strong>${cleanPanelName(profileData?.panel?.name || '—')}</strong>.</p>
              <p>I agree to participate responsibly, respect local community protocols, cooperate with faculty mentors and village authorities, and abide by all program guidelines.</p>
            </div>

            <div class="receipt">
              <div class="checkmark">SIGNED UNDERTAKING & IMMERSION RECORD</div>
              <div class="details-grid">
                <div>
                  <div class="label">Signed Signature</div>
                  <div class="value sig">${undertakingForm.signedName}</div>
                </div>
                <div>
                  <div class="label">PRN</div>
                  <div class="value">${profileData?.student?.prn || '—'}</div>
                </div>
                <div>
                  <div class="label">Submission Date</div>
                  <div class="value">${undertakingForm.signedDate}</div>
                </div>
                <div>
                  <div class="label">Allocated Village</div>
                  <div class="value">${profileData?.village?.name || '—'}</div>
                </div>
                <div>
                  <div class="label">Panel</div>
                  <div class="value">${cleanPanelName(profileData?.panel?.name || '—')}</div>
                </div>
                <div>
                  <div class="label">Blood Group</div>
                  <div class="value">${undertakingForm.bloodGroup || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div class="details-grid" style="margin-top: 16px;">
              <div style="grid-column: span 2;">
                <div class="label" style="border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px; font-weight: bold;">Emergency Contact Details</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <div><span class="label">Name:</span> <span class="value">${undertakingForm.emergencyContactName || 'N/A'}</span></div>
                  <div><span class="label">Relation:</span> <span class="value">${undertakingForm.emergencyContactRelation || 'N/A'}</span></div>
                  <div><span class="label">Mobile:</span> <span class="value">${undertakingForm.emergencyContactMobile || 'N/A'}</span></div>
                  <div><span class="label">Email:</span> <span class="value">${undertakingForm.emergencyContactEmail || 'N/A'}</span></div>
                </div>
              </div>
            </div>

            <div class="details-grid" style="margin-top: 16px;">
              <div style="grid-column: span 2;">
                <div class="label" style="border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px; font-weight: bold;">Medical & Health Information</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <div><span class="label">Allergies:</span> <span class="value">${undertakingForm.knownAllergies || 'None'}</span></div>
                  <div><span class="label">Medical Conditions:</span> <span class="value">${undertakingForm.medicalConditions || 'None'}</span></div>
                  <div><span class="label">Current Medications:</span> <span class="value">${undertakingForm.currentMedication || 'None'}</span></div>
                  <div><span class="label">Dietary Notes:</span> <span class="value">${undertakingForm.dietaryRestrictions || 'None'}</span></div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Render Cinematic RI Student Onboarding Experience on initial visit
  if (showOnboarding) {
    return <RiOnboarding onComplete={handleCompleteOnboarding} />;
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: "'Inter', system-ui, sans-serif"
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid #e2e8f0',
          borderTopColor: '#059669',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ marginTop: '16px', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
          Loading Rural Immersion Portal...
        </p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Handle Unassigned Student
  if (!profileData?.has_ri_assignment) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: "'Inter', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column'
      }}>
        <header style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/mitwpu-logo.png" alt="MIT-WPU" style={{ height: '32px' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#065f46' }}>
                Rural Immersion Student Portal
              </h1>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#ef4444',
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </header>

        <main style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '36px 28px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#fef3c7',
              color: '#d97706',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <AlertCircle size={26} />
            </div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
              No Active Panel Assignment
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
              Your student account (<strong>{profileData?.student?.prn || 'PRN'}</strong>) is not yet assigned to an active Rural Immersion batch or panel.
            </p>

            {profileData?.has_ltc && (
              <button
                onClick={() => navigate('/student')}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>Go to LTC Student Portal</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  const { student, batch, panel, village, mentors, teammates, attendance_summary } = profileData;

  // Filtered teammates
  const filteredTeammates = (teammates || []).filter(t => {
    if (!teamSearch.trim()) return true;
    const q = teamSearch.toLowerCase();
    return (
      (t.student_name && t.student_name.toLowerCase().includes(q)) ||
      (t.prn && t.prn.toLowerCase().includes(q)) ||
      (t.ri_id && t.ri_id.toLowerCase().includes(q)) ||
      (t.department && t.department.toLowerCase().includes(q))
    );
  });

  // ── RI Navigation items ────────────────────────────────────────────────────
  const RI_NAV_ITEMS = [
    { id: 'dashboard',             label: 'Overview',              icon: <LayoutDashboard /> },
    { id: 'preparatory_checklist', label: 'Preparatory Checklist', icon: <CheckCircle2 /> },
    { id: 'forms',                 label: 'RI Forms',              icon: <FileCheck /> },
    { id: 'village',               label: 'My Village',             icon: <MapPin /> },
    { id: 'panel',                 label: 'My Panel & Team',        icon: <Users /> },
    { id: 'media',                 label: 'Visit Media',           icon: <Camera />, badge: panelMedia.length > 0 ? { text: `${panelMedia.length}/5`, bg: '#dcfce7', color: '#15803d' } : null },
    { id: 'attendance',            label: 'My Attendance',          icon: <ClipboardCheck /> },
    { id: 'schedule',              label: 'RI Schedule',            icon: <Calendar /> },
    { id: 'undertaking',           label: 'Undertaking Form',       icon: <FileText />, badge: isUndertakingSubmitted ? { text: 'Signed', bg: '#dcfce7', color: '#15803d' } : { text: 'Pending', bg: '#fef3c7', color: '#b45309' } },
    { id: 'things_to_carry',       label: 'Things to Carry',        icon: <Briefcase /> },
    { id: 'dos_donts',             label: "Do's & Don'ts",          icon: <CheckSquare /> },
    { id: 'annexures',             label: 'Annexures',              icon: <BookOpen /> },
    { id: 'support',               label: 'Support Tickets',        icon: <LifeBuoy /> },
    { id: 'settings',              label: 'Settings',               icon: <Settings /> },
  ];

  // Undertaking gate: show ONLY the Undertaking button until undertaking is submitted
  const displayedNavItems = isUndertakingSubmitted
    ? RI_NAV_ITEMS
    : RI_NAV_ITEMS.filter(item => item.id === 'undertaking');

  // Items that receive a slim orange vertical indicator (not active, but visually highlighted)
  const ORANGE_SIDEBAR_IDS = new Set(['preparatory_checklist', 'things_to_carry', 'dos_donts', 'annexures']);

  // RI_GREEN sidebar item renderer — mirrors LTC renderSidebarItem exactly
  const renderRiSidebarItem = (id, iconElement, label, badge, customOnClick) => {
    const isActive = activeTab === id;
    const isOrangeSidebar = !isActive && ORANGE_SIDEBAR_IDS.has(id);
    return (
      <button
        key={id}
        onClick={customOnClick || (() => { setActiveTab(id); if (isMobile) setIsMobileNavOpen(false); })}
        title={label}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: (isCollapsed && !isMobile) ? 'center' : 'space-between',
          padding: (isCollapsed && !isMobile) ? '9px 12px' : (isOrangeSidebar ? '9px 12px 9px 14px' : '9px 12px'),
          borderRadius: '8px',
          fontSize: '13.5px',
          fontWeight: isActive ? '600' : isOrangeSidebar ? '550' : '500',
          color: isActive ? '#ffffff' : '#334155',
          background: isActive ? '#047857' : isOrangeSidebar ? '#FFF7ED' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease-in-out',
          textAlign: 'left',
          width: '100%',
          outline: 'none',
          marginBottom: '2px',
          boxShadow: 'none',
          overflow: 'hidden'
        }}
        className={isActive ? '' : isOrangeSidebar ? 'hover:bg-[#ffedd5]' : 'hover:bg-slate-50 hover:text-slate-900'}
      >
        {isOrangeSidebar && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '3px',
              top: '6px',
              bottom: '6px',
              width: '3.5px',
              backgroundColor: '#F97316',
              borderRadius: '3px',
              pointerEvents: 'none'
            }}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, marginRight: badge ? '6px' : '0px' }}>
          <div style={{ color: isActive ? '#ffffff' : '#047857', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {React.cloneElement(iconElement, { size: 16, strokeWidth: isActive ? 2.2 : 2 })}
          </div>
          <span style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            opacity: (isCollapsed && !isMobile) ? 0 : 1,
            maxWidth: (isCollapsed && !isMobile) ? '0px' : '200px',
            marginLeft: (isCollapsed && !isMobile) ? '0px' : '10px',
            visibility: (isCollapsed && !isMobile) ? 'hidden' : 'visible',
            transition: 'max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease-in-out, margin 0.3s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.3s'
          }}>
            {label}
          </span>
        </div>
        {badge && (
          <span style={{
            fontSize: '10px',
            fontWeight: '700',
            padding: (isCollapsed && !isMobile) ? '0px' : '2px 6px',
            borderRadius: '4px',
            background: badge.bg || (isActive ? 'rgba(255,255,255,0.2)' : '#f1f5f9'),
            color: badge.color || (isActive ? '#ffffff' : '#0f172a'),
            lineHeight: 1,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            opacity: (isCollapsed && !isMobile) ? 0 : 1,
            maxWidth: (isCollapsed && !isMobile) ? '0px' : '80px',
            visibility: (isCollapsed && !isMobile) ? 'hidden' : 'visible',
            transition: 'max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-in-out, padding 0.3s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.3s'
          }}>
            {badge.text}
          </span>
        )}
      </button>
    );
  };

  // ── Desktop Sidebar (White background, matches LTC structure exactly) ──────
  const renderDesktopSidebar = () => (
    <aside
      className={`relative flex-shrink-0 bg-white flex flex-col transition-[width] duration-300 ease-in-out z-20 ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}`}
      style={{
        height: '100%',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        boxShadow: '1px 0 10px rgba(0, 0, 0, 0.01)',
        overflow: 'visible'
      }}
    >
      {/* Sleek circular floating Toggle Button (Top) */}
      <button
        style={{
          position: 'absolute',
          top: '24px',
          right: '-12px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          cursor: 'pointer',
          zIndex: 30,
          color: '#64748b',
          outline: 'none',
          padding: 0
        }}
        onClick={toggleSidebarCollapse}
        aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {isCollapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
      </button>

      {/* Sleek circular floating Toggle Button (Middle) */}
      <button
        style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          right: '-24px',
          width: '24px',
          height: '48px',
          borderTopRightRadius: '24px',
          borderBottomRightRadius: '24px',
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          backgroundColor: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderLeft: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '2px 2px 6px rgba(0,0,0,0.05)',
          cursor: 'pointer',
          zIndex: 30,
          outline: 'none',
          padding: 0
        }}
        onClick={toggleSidebarCollapse}
        aria-label={isCollapsed ? 'Expand/Collapse Sidebar' : 'Collapse/Expand Sidebar'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#047857' }}></span>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#047857' }}></span>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#047857' }}></span>
        </div>
      </button>

      {/* Logo / Brand Header — clean RI logo header */}
      <div style={{ height: '80px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', flexShrink: 0, transition: 'padding 0.35s cubic-bezier(0.4,0,0.2,1)', padding: isCollapsed ? '0' : '0 20px' }}>
        <img src="/ri11.png" alt="Rural Immersion Logo" onError={e => { e.currentTarget.src = '/ri-logo.png'; }} style={{ height: '42px', maxWidth: '185px', objectFit: 'contain', position: 'absolute', left: isCollapsed ? '50%' : '20px', transform: isCollapsed ? 'translateX(-50%) scale(0.8)' : 'none', opacity: isCollapsed ? 0 : 1, transition: 'opacity 0.3s ease, left 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)', pointerEvents: 'none' }} />
        <img src="/ri-logo-mob.png" alt="Rural Immersion Logo" style={{ height: '38px', width: '38px', objectFit: 'contain', opacity: isCollapsed ? 1 : 0, transform: isCollapsed ? 'scale(1)' : 'scale(0.7)', transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)', pointerEvents: 'none' }} />
      </div>

      {/* Navigation Area */}
      <div className="flex-1 overflow-y-auto py-4 px-3" style={{ display: 'flex', flexDirection: 'column', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: isCollapsed ? '0px' : '32px', opacity: isCollapsed ? 0 : 1, padding: isCollapsed ? '0 12px' : '12px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
            Navigation
          </span>
          {displayedNavItems.map(item => renderRiSidebarItem(item.id, item.icon, item.label, item.badge, item.id === 'undertaking' ? handleOpenUndertaking : undefined))}
        </nav>
      </div>

      {/* Bottom Profile Section - matching LTC sidebar footer */}
      <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, backgroundColor: '#ffffff' }}>
        {hasLtc && isUndertakingSubmitted && (
          <button
            onClick={() => navigate('/student')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: '8px',
              padding: isCollapsed ? '9px' : '9px 12px',
              borderRadius: '8px',
              border: '1.5px solid #065f46',
              backgroundColor: '#047857',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '11.5px',
              fontWeight: '700',
              transition: 'all 0.2s ease',
              width: '100%',
              overflow: 'hidden'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#065f46'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#047857'; }}
            title="Switch to LTC Student Portal"
          >
            <Compass size={14} color="#ffffff" style={{ flexShrink: 0 }} />
            <span style={{
              maxWidth: isCollapsed ? '0px' : '180px',
              overflow: 'hidden',
              opacity: isCollapsed ? 0 : 1,
              visibility: isCollapsed ? 'hidden' : 'visible',
              whiteSpace: 'nowrap',
              transition: 'max-width 0.3s ease, opacity 0.2s ease'
            }}>
              Switch to LTC →
            </span>
          </button>
        )}

        {/* Instagram Follow Link */}
        <a
          href="https://www.instagram.com/lifetransformationcentre/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '8px',
            padding: isCollapsed ? '8px' : '8px 12px',
            borderRadius: '8px',
            border: '1px solid #fbcfe8',
            background: 'linear-gradient(135deg, #fdf2f8 0%, #fff1f2 100%)',
            color: '#be185d',
            textDecoration: 'none',
            fontSize: '11.5px',
            fontWeight: '700',
            transition: 'all 0.2s ease',
            width: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#f472b6';
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(225, 48, 108, 0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#fbcfe8';
            e.currentTarget.style.boxShadow = 'none';
          }}
          title="Follow for updates on Instagram"
        >
          <InstagramIcon size={15} color="#e1306c" />
          <span style={{
            maxWidth: isCollapsed ? '0px' : '180px',
            overflow: 'hidden',
            opacity: isCollapsed ? 0 : 1,
            visibility: isCollapsed ? 'hidden' : 'visible',
            whiteSpace: 'nowrap',
            transition: 'max-width 0.3s ease, opacity 0.2s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            Follow for updates
          </span>
        </a>

        {/* Profile row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? '0px' : '12px', padding: '4px 8px', overflow: 'hidden', transition: 'gap 0.35s cubic-bezier(0.4,0,0.2,1)', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
          <div 
            className="rounded-full text-white flex items-center justify-center font-bold text-xs flex-shrink-0"
            style={{ background: '#047857', width: '32px', height: '32px', fontSize: '11px', transition: 'all 0.3s ease' }}
            title={student?.name || 'Student'}
          >
            {student?.name ? student.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'ST'}
          </div>
          <div style={{ overflow: 'hidden', maxWidth: isCollapsed ? '0px' : '180px', opacity: isCollapsed ? 0 : 1, visibility: isCollapsed ? 'hidden' : 'visible', transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, visibility 0.35s', whiteSpace: 'nowrap' }}>
            <p style={{ fontWeight: '600', fontSize: '12px', color: '#0f172a', lineHeight: '1.2', fontFamily: 'system-ui, -apple-system, sans-serif', margin: 0 }}>{student?.name || 'Student'}</p>
            <p style={{ fontSize: '10px', color: '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif', margin: 0 }}>RI Student</p>
          </div>
        </div>

        {/* Action button: Sign Out */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: isCollapsed ? 'center' : 'stretch' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isCollapsed ? '0px' : '6px',
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              fontSize: '11.5px',
              fontWeight: '600',
              transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
              width: isCollapsed ? '36px' : '100%',
              height: '36px',
              overflow: 'hidden'
            }}
            className="hover:bg-slate-50"
            title="Sign Out"
          >
            <LogOut size={13} style={{ flexShrink: 0 }} />
            <span style={{ maxWidth: isCollapsed ? '0px' : '80px', overflow: 'hidden', opacity: isCollapsed ? 0 : 1, visibility: isCollapsed ? 'hidden' : 'visible', whiteSpace: 'nowrap', transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, visibility 0.35s' }}>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );

  // ── Desktop Topbar (Solid normal green, matches LTC topbar structure) ──────
  const renderDesktopTopbar = () => (
    <header 
      className="h-12 flex items-center justify-between px-8 sticky top-0 z-10 flex-shrink-0"
      style={{ backgroundColor: '#047857', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
    >
      {/* Breadcrumbs / Page Title */}
      <div 
        className="flex items-center"
        style={{ fontFamily: '"Poppins", sans-serif', fontSize: '18px', fontWeight: 600, lineHeight: 1.2, color: '#ffffff' }}
      >
        <span>Student Portal</span>
        <span className="mx-2" style={{ color: 'rgba(216,217,229,0.4)' }}>/</span>
        <span style={{ fontWeight: 400 }}>
          {activeTab === 'dashboard' && 'Overview'}
          {activeTab === 'preparatory_checklist' && 'Preparatory Checklist'}
          {activeTab === 'forms' && 'RI Forms'}
          {activeTab === 'village' && 'My Village'}
          {activeTab === 'panel' && 'My Panel & Team'}
          {activeTab === 'media' && 'Visit Media Photos'}
          {activeTab === 'attendance' && 'My Attendance'}
          {activeTab === 'schedule' && 'RI Schedule'}
          {activeTab === 'undertaking' && 'Undertaking Form'}
          {activeTab === 'things_to_carry' && 'Things to Carry'}
          {activeTab === 'dos_donts' && "Do's & Don'ts"}
          {activeTab === 'annexures' && 'Annexures'}
          {activeTab === 'support' && 'Support Tickets'}
          {activeTab === 'settings' && 'Settings'}
        </span>
      </div>

      {/* Right Actions — Replay Story & Refresh in topbar */}
      <div className="flex items-center gap-3">
        <button 
          className="flex items-center px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors border border-white/10 cursor-pointer" 
          onClick={() => setShowOnboarding(true)}
          title="Replay Rural Immersion Story"
        >
          <span>Immersion Story</span>
        </button>
        <button 
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors border border-white/10 cursor-pointer" 
          onClick={fetchData}
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );

  // ── Mobile Sidebar (Drawer with white background, matches LTC exactly) ────
  const renderMobileSidebar = () => (
    <>
      {/* Smooth Overlay */}
      <div 
        style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0, 0, 0, 0.4)', 
          zIndex: 999998,
          opacity: isMobileNavOpen ? 1 : 0,
          visibility: isMobileNavOpen ? 'visible' : 'hidden',
          backdropFilter: isMobileNavOpen ? 'blur(4px)' : 'blur(0px)',
          WebkitBackdropFilter: isMobileNavOpen ? 'blur(4px)' : 'blur(0px)',
          transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }} 
        onClick={() => setIsMobileNavOpen(false)} 
      />

      {/* ── Sidebar Drawer ── */}
      <div className="sidebar mobile-sidebar" style={{
        position: 'fixed',
        top: 0, left: 0, bottom: 0, zIndex: 999999, height: '100vh',
        transform: !isMobileNavOpen ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        paddingTop: 'env(safe-area-inset-top)',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        width: '270px',
        borderRight: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '10px 0 40px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Logo Header */}
        <div style={{ height: '80px', borderBottom: '1px solid #e2e8f0', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <img src="/ri11.png" alt="Rural Immersion Logo" onError={e => { e.currentTarget.src = '/ri-logo.png'; }} style={{ height: '42px', maxWidth: '180px', objectFit: 'contain' }} />
          <button 
            className="sidebar-close-btn" 
            onClick={() => setIsMobileNavOpen(false)} 
            aria-label="Close Sidebar" 
            style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', padding: 0, boxShadow: 'none' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <nav style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '12px 12px 6px 12px', display: 'block', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Navigation</span>
            {displayedNavItems.map(item => renderRiSidebarItem(item.id, item.icon, item.label, item.badge, item.id === 'undertaking' ? handleOpenUndertaking : undefined))}
          </nav>
        </div>

        {/* Bottom Profile Section */}
        <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, backgroundColor: '#ffffff' }}>
          {hasLtc && isUndertakingSubmitted && (
            <button
              onClick={() => { navigate('/student'); setIsMobileNavOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '9px 12px', borderRadius: '8px',
                border: '1.5px solid #065f46', backgroundColor: '#047857',
                color: '#ffffff', cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#065f46'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#047857'; }}
            >
              <Compass size={14} color="#ffffff" />
              <span>Switch to LTC →</span>
            </button>
          )}

          {/* Instagram Follow Link */}
          <a
            href="https://www.instagram.com/lifetransformationcentre/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid #fbcfe8',
              background: 'linear-gradient(135deg, #fdf2f8 0%, #fff1f2 100%)',
              color: '#be185d',
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: '700',
              transition: 'all 0.2s ease',
              width: '100%',
              boxSizing: 'border-box'
            }}
            title="Follow for updates on Instagram"
          >
            <InstagramIcon size={16} color="#e1306c" />
            <span>Follow for updates</span>
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 8px' }}>
            <div 
              style={{ background: '#047857', width: '32px', height: '32px', borderRadius: '50%', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '11px', flexShrink: 0 }}
            >
              {student?.name ? student.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'ST'}
            </div>
            <div>
              <p style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: '600', fontSize: '12px', color: '#0f172a', lineHeight: '1.2' }}>{student?.name || 'Student'}</p>
              <p style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '10px', color: '#64748b' }}>RI Student</p>
            </div>
          </div>

          <button
            onClick={() => { setShowOnboarding(true); setIsMobileNavOpen(false); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '8px', borderRadius: '8px', border: '1px solid #d1fae5',
              backgroundColor: '#ecfdf5', color: '#047857', cursor: 'pointer',
              fontSize: '11.5px', fontWeight: '600'
            }}
          >
            <span>Replay Immersion Story</span>
          </button>

          <button
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#475569', cursor: 'pointer', fontSize: '11.5px', fontWeight: '600' }}
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );

  // ── Main content (shared between desktop and mobile) ───────────────────────
  const renderMainContent = () => (
    <>
          {/* ── TAB 1: REDESIGNED DASHBOARD OVERVIEW ─────────────────────────── */}
          {activeTab === 'dashboard' && (
            <div>
              {/* Undertaking Action Banner (if pending) */}
              {!isUndertakingSubmitted && (
                <div style={{
                  background: '#ffffff',
                  border: '1.5px solid #86efac',
                  borderRadius: isMobile ? '12px' : '14px',
                  padding: isMobile ? '14px 16px' : '16px 20px',
                  marginBottom: isMobile ? '16px' : '20px',
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  gap: isMobile ? '12px' : '16px',
                  boxShadow: '0 2px 8px rgba(4, 120, 87, 0.06)',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '14px', minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: isMobile ? '38px' : '42px',
                      height: isMobile ? '38px' : '42px',
                      borderRadius: '10px',
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      color: '#047857',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <AlertCircle size={isMobile ? 18 : 20} strokeWidth={2.3} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: isMobile ? '13.5px' : '15px', fontWeight: 800, color: '#064e3b', letterSpacing: '-0.2px', lineHeight: 1.3 }}>
                        Rural Immersion Participant Undertaking Pending
                      </div>
                      <div style={{ fontSize: isMobile ? '12px' : '13px', color: '#475569', marginTop: '2px', lineHeight: 1.4 }}>
                        Please complete and digitally sign your RI safety undertaking before field departure.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleOpenUndertaking}
                    style={{
                      background: '#047857',
                      color: '#ffffff',
                      border: 'none',
                      padding: isMobile ? '9px 16px' : '9px 18px',
                      borderRadius: '8px',
                      fontSize: isMobile ? '12.5px' : '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(4, 120, 87, 0.2)',
                      width: isMobile ? '100%' : 'auto',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#065f46'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#047857'; }}
                  >
                    <span>Complete Form</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* 4 Top Overview Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: isMobile ? '12px' : '16px',
                marginBottom: '24px'
              }}>
                {/* 1. Your Profile Card */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.03), 0 4px 12px -2px rgba(15,23,42,0.02)',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '150px',
                    transition: 'all 0.25s ease',
                    cursor: 'default'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px -4px rgba(15,23,42,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.03), 0 4px 12px -2px rgba(15,23,42,0.02)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Your Profile
                    </span>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#047857'
                    }}>
                      <User size={18} strokeWidth={2.2} />
                    </div>
                  </div>

                  <div style={{ margin: '10px 0 8px 0' }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '800',
                      color: '#0f172a',
                      margin: 0,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.25
                    }}>
                      {student?.name || 'Student Name'}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', fontWeight: '500' }}>
                      PRN: <strong style={{ color: '#0f172a' }}>{student?.prn || '—'}</strong>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    {student?.ri_id ? (
                      <span style={{ fontSize: '10.5px', fontWeight: '750', color: '#047857', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                        ID: {student.ri_id}
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Participant</span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowOnboarding(true);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#475569',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        outline: 'none'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#ecfdf5'; e.currentTarget.style.color = '#047857'; e.currentTarget.style.borderColor = '#a7f3d0'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                      title="Replay Rural Immersion Onboarding Story"
                    >
                      <span>Replay RI</span>
                    </button>
                  </div>
                </div>

                {/* 2. Assigned Village Card */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.03), 0 4px 12px -2px rgba(15,23,42,0.02)',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '150px',
                    transition: 'all 0.25s ease',
                    cursor: 'default'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px -4px rgba(15,23,42,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.03), 0 4px 12px -2px rgba(15,23,42,0.02)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Assigned Village
                    </span>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#15803d'
                    }}>
                      <MapPin size={18} strokeWidth={2.2} />
                    </div>
                  </div>

                  <div style={{ margin: '10px 0 8px 0' }}>
                    <h3 style={{
                      fontSize: '19px',
                      fontWeight: '800',
                      color: village?.name ? '#064e3b' : '#94a3b8',
                      margin: 0,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.25
                    }}>
                      {village?.name || 'Pending Allocation'}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', fontWeight: '500' }}>
                      {village?.district ? `Dist. ${village.district}` : (village?.panchayat || 'Immersion Location')}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                      {village?.taluka || 'Field Visit'}
                    </span>
                    <button
                      onClick={() => setActiveTab('village')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#047857',
                        fontSize: '11.5px',
                        fontWeight: '750',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <span>Village Hub &rarr;</span>
                    </button>
                  </div>
                </div>

                {/* 3. Faculty Mentor Card */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.03), 0 4px 12px -2px rgba(15,23,42,0.02)',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '150px',
                    transition: 'all 0.25s ease',
                    cursor: 'default'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px -4px rgba(15,23,42,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.03), 0 4px 12px -2px rgba(15,23,42,0.02)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Faculty Mentor
                    </span>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#2563eb'
                    }}>
                      <Briefcase size={18} strokeWidth={2.2} />
                    </div>
                  </div>

                  <div style={{ margin: '10px 0 8px 0' }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '800',
                      color: '#0f172a',
                      margin: 0,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.25
                    }}>
                      {mentors?.[0]?.name || 'Mentor Assigned'}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', fontWeight: '500' }}>
                      {mentors?.[0]?.department || 'Lead Faculty Mentor'}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: '750', color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                      {mentors?.[0]?.role || 'Mentor'}
                    </span>
                    {mentors?.[0]?.phone ? (
                      <a href={`tel:${mentors[0].phone}`} style={{ fontSize: '11.5px', color: '#047857', fontWeight: '750', textDecoration: 'none' }}>
                        📞 Call
                      </a>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Assigned</span>
                    )}
                  </div>
                </div>

                {/* 4. Your Panel Card */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.03), 0 4px 12px -2px rgba(15,23,42,0.02)',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '150px',
                    transition: 'all 0.25s ease',
                    cursor: 'default'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px -4px rgba(15,23,42,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.03), 0 4px 12px -2px rgba(15,23,42,0.02)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Your Panel
                    </span>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#f5f3ff',
                      border: '1px solid #ddd6fe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#7c3aed'
                    }}>
                      <Users size={18} strokeWidth={2.2} />
                    </div>
                  </div>

                  <div style={{ margin: '10px 0 8px 0' }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '800',
                      color: '#0f172a',
                      margin: 0,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.25
                    }}>
                      {cleanPanelName(panel?.name || 'Unassigned')}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', fontWeight: '500' }}>
                      {panel?.total_members || teammates?.length || 0} Student Members
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                      Batch Immersion
                    </span>
                    <button
                      onClick={() => setActiveTab('panel')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#7c3aed',
                        fontSize: '11.5px',
                        fontWeight: '750',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <span>My Team &rarr;</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* RI Immersion 2-Day Schedule Section — 4-column table same as Schedule tab */}
              {(() => {
                const ovDay = overviewScheduleDay;
                const setOvDay = setOverviewScheduleDay;
                const ovDayPlan = activeScheduleList.find(d => (d.day_number || parseInt(d.day.replace(/\D/g, '')) || 1) === ovDay) || activeScheduleList[0] || DEFAULT_SCHEDULE[0];
                const ovActivities = ovDayPlan?.activities || [];
                return (
                  <div style={{
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '20px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    padding: '24px',
                    marginBottom: '24px'
                  }}>
                    {/* Section Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #f1f5f9',
                      paddingBottom: '16px',
                      marginBottom: '16px',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #065f46, #059669)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 10px rgba(6,95,70,0.2)'
                        }}>
                          <Calendar size={18} strokeWidth={2.2} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                            RI Schedule
                          </h3>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                            Daily agenda, activities, venues &amp; details
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setSelectedScheduleDay(ovDay); setActiveTab('schedule'); }}
                        style={{
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#047857',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          padding: '8px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#d1fae5'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#ecfdf5'; }}
                      >
                        <span>Full Schedule &rarr;</span>
                      </button>
                    </div>

                    {/* Day Tabs + Activity Count */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                        {(activeScheduleList?.length ? activeScheduleList.map((dObj, idx) => dObj.day_number || idx + 1) : [1, 2, 3]).map(d => (
                          <button
                            key={d}
                            onClick={() => setOvDay(d)}
                            style={{
                              padding: '8px 20px',
                              borderRadius: '10px',
                              fontSize: '13px',
                              fontWeight: 750,
                              border: '1px solid',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.2s',
                              background: ovDay === d ? '#154388' : '#ffffff',
                              color: ovDay === d ? '#ffffff' : '#475569',
                              borderColor: ovDay === d ? '#154388' : '#e2e8f0',
                              boxShadow: ovDay === d ? '0 2px 6px rgba(21,67,136,0.15)' : 'none'
                            }}
                          >
                            Day {d}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>
                        Day {ovDay} &middot; {ovActivities.length} activities
                      </div>
                    </div>

                    {/* 4-Column Schedule Table */}
                    <div className="lrp-schedule-container" style={{ marginTop: '4px' }}>
                      <div className="lrp-schedule-header">
                        <div>TIME</div>
                        <div>ACTIVITY NAME</div>
                        <div>VENUE &amp; DETAILS</div>
                        <div style={{ textAlign: 'right' }}>CATEGORY</div>
                      </div>
                      {ovActivities.map((activity, idx) => {
                        const styles = getRiCategoryStyles(activity.category, activity.type);
                        return (
                          <div key={idx} className="lrp-schedule-row">
                            <div className="lrp-time-column">
                              <span className="lrp-time-pill">
                                <Clock size={13} style={{ color: '#047857', flexShrink: 0 }} />
                                {activity.time}
                              </span>
                            </div>
                            <div className="lrp-activity-column">
                              <span className="lrp-activity-name">{activity.title}</span>
                              {(activity.description || activity.desc) && (
                                <p className="lrp-activity-description">{activity.description || activity.desc}</p>
                              )}
                            </div>
                            <div className="lrp-venue-dress-column">
                              <div className="lrp-venue-info">
                                <MapPin size={13} style={{ color: '#047857', flexShrink: 0 }} />
                                <span>{activity.location || profileData?.village?.name || 'Allocated Village'}</span>
                              </div>
                              {(activity.dress || activity.notes || activity.instructions) && (
                                <div className="lrp-dress-info">
                                  <Info size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                                  <span>{activity.dress || activity.notes || activity.instructions}</span>
                                </div>
                              )}
                            </div>
                            <div className="lrp-badge-column">
                              <span
                                className="lrp-category-pill"
                                style={{ color: styles.text, background: styles.bg }}
                              >
                                {styles.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── TAB: PREPARATORY CHECKLIST (FORM IB) ─────────────────────────── */}
          {activeTab === 'preparatory_checklist' && (
            <RiPreparatoryChecklistTab
              authHeaders={authHeaders}
              addToast={addToast}
              student={student}
              isMobile={isMobile}
            />
          )}

          {/* ── TAB 2: MY VILLAGE PAGE ───────────────────────────────────────── */}
          {activeTab === 'village' && (
            <RiVillageTab profileData={profileData} isMobile={isMobile} />
          )}

          {/* ── TAB: RI FORMS HUB ───────────────────────────────────────────── */}
          {activeTab === 'forms' && (
            <RiFormsHub
              profileData={profileData}
              onNavigateToUndertaking={handleOpenUndertaking}
              onNavigateToAnnexures={() => setActiveTab('annexures')}
              addToast={addToast}
            />
          )}

          {/* ── TAB 3: RI UNDERTAKING FORM (RI-only students) ──────────────── */}
          {activeTab === 'undertaking' && !hasLtc && (
            <div style={{ maxWidth: '820px', margin: '0 auto 40px auto' }}>
              <div style={{ marginBottom: '14px' }}>
                <button
                  onClick={() => setActiveTab('forms')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <ArrowLeft size={16} /> Return to RI Forms Hub
                </button>
              </div>
              <div style={{
                background: '#ffffff',
                borderRadius: isMobile ? '12px' : '16px',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 8px 24px -4px rgba(15, 23, 42, 0.06)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
              }}>
              {/* Form Header */}
              <div style={{
                padding: isMobile ? '20px 16px' : '28px 36px',
                borderBottom: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: isUndertakingSubmitted ? 'flex-end' : 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  {isUndertakingSubmitted && !isEditingUndertaking && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 9px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: '#dcfce7',
                      color: '#166534',
                      border: '1px solid #86efac'
                    }}>
                      <Check size={12} />
                      Verified on Record
                    </span>
                  )}
                </div>
                <h2 style={{
                  fontSize: isMobile ? '18px' : '22px',
                  fontWeight: '800',
                  color: '#0f172a',
                  margin: '4px 0 0 0',
                  letterSpacing: '-0.02em',
                  lineHeight: '1.25'
                }}>
                  Rural Immersion Participant Undertaking &amp; Code of Conduct
                </h2>
                <p style={{
                  fontSize: '13px',
                  color: '#64748b',
                  margin: 0,
                  fontWeight: '500'
                }}>
                  Rural Immersion Program (RIP) &bull; MIT World Peace University
                </p>
              </div>

              {/* Form Content / View Container */}
              <div
                id="undertaking-form-scrollable"
                onScroll={(e) => {
                  if (isUndertakingSubmitted && !isEditingUndertaking) return;
                  const target = e.target;
                  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 80) {
                    setIsScrolledToBottom(true);
                  }
                }}
                style={{
                  padding: isMobile ? '20px 16px' : '32px 36px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '32px'
                }}
              >
                {undertakingSuccessMsg && (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    color: '#166534',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <CheckCircle size={16} />
                    <span>{undertakingSuccessMsg}</span>
                  </div>
                )}

                {undertakingErrorMsg && (
                  <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertCircle size={16} />
                    <span>{undertakingErrorMsg}</span>
                  </div>
                )}

                {isUndertakingSubmitted && !isEditingUndertaking ? (
                  /* ── SUBMITTED STATE / RECEIPT VIEW ────────────────────────── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Status Banner */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: isMobile ? '12px' : '16px',
                      padding: isMobile ? '16px' : '18px 22px',
                      background: '#ffffff',
                      border: '1.5px solid #e2e8f0',
                      borderLeft: '5px solid #047857',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                      boxSizing: 'border-box',
                      width: '100%'
                    }}>
                      <div style={{
                        width: isMobile ? '38px' : '42px',
                        height: isMobile ? '38px' : '42px',
                        borderRadius: '50%',
                        background: '#047857',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(4, 120, 87, 0.25)',
                        marginTop: '2px'
                      }}>
                        <Check size={isMobile ? 18 : 20} strokeWidth={2.8} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <h3 style={{ fontSize: isMobile ? '15.5px' : '17px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.2px' }}>
                            Undertaking Submitted &amp; Verified
                          </h3>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: '#ecfdf5',
                            color: '#047857',
                            border: '1px solid #a7f3d0',
                            padding: '2px 8px',
                            borderRadius: '20px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Check size={11} strokeWidth={3} /> Verified
                          </span>
                        </div>
                        <p style={{ fontSize: isMobile ? '12.5px' : '13.5px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                          You have digitally signed and recorded this undertaking on the Rural Immersion portal. A certified copy is on record with your Allocated Faculty Mentor.
                        </p>
                      </div>
                    </div>

                    {/* Submission Summary Card */}
                    <div style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: '#ffffff'
                    }}>
                      <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569' }}>
                          Official Submission Record
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#047857' }}>
                          Rural Immersion Batch {batch?.name || ''}
                        </span>
                      </div>

                      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Sign & PRN Details */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Signed Signature</span>
                            <p style={{ fontSize: '15px', fontWeight: '800', color: '#047857', margin: '4px 0 0 0', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                              {undertakingForm.signedName || student?.name}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Permanent Register Number (PRN)</span>
                            <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '4px 0 0 0', fontFamily: 'monospace' }}>
                              {student?.prn || '—'}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Submission Date</span>
                            <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '4px 0 0 0' }}>
                              {undertakingForm.signedDate || 'Recorded'}
                            </p>
                          </div>
                        </div>

                        {/* Student & Allocation Details */}
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                          <h4 style={{ fontSize: '12px', fontWeight: '800', color: '#475569', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Immersion &amp; Academic Allocation
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
                            <div><span style={{ color: '#64748b' }}>Student Name:</span> <strong style={{ color: '#0f172a' }}>{student?.name}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Department:</span> <strong style={{ color: '#0f172a' }}>{student?.department || '—'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Panel:</span> <strong style={{ color: '#0f172a' }}>{cleanPanelName(panel?.name || '—')}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Allocated Village:</span> <strong style={{ color: '#047857' }}>{village?.name || 'Assigned Village'}</strong></div>
                          </div>
                        </div>

                        {/* Emergency Contact */}
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                          <h4 style={{ fontSize: '12px', fontWeight: '800', color: '#475569', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Emergency Contact Details
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
                            <div><span style={{ color: '#64748b' }}>Name:</span> <strong style={{ color: '#0f172a' }}>{undertakingForm.emergencyContactName || 'N/A'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Relation:</span> <strong style={{ color: '#0f172a' }}>{undertakingForm.emergencyContactRelation || 'N/A'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Mobile:</span> <strong style={{ color: '#0f172a' }}>{undertakingForm.emergencyContactMobile || 'N/A'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Alt Mobile:</span> <strong style={{ color: '#0f172a' }}>{undertakingForm.emergencyContactAltMobile || 'N/A'}</strong></div>
                            <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}><span style={{ color: '#64748b' }}>Email:</span> <strong style={{ color: '#0f172a' }}>{undertakingForm.emergencyContactEmail || 'N/A'}</strong></div>
                          </div>
                        </div>

                        {/* Medical & Health */}
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                          <h4 style={{ fontSize: '12px', fontWeight: '800', color: '#475569', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Medical &amp; Health Information
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
                            <div><span style={{ color: '#64748b' }}>Blood Group:</span> <strong style={{ color: '#0f172a' }}>{undertakingForm.bloodGroup || 'N/A'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Known Allergies:</span> <strong style={{ color: '#0f172a' }}>{undertakingForm.knownAllergies || 'None declared'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Medical Conditions:</span> <strong style={{ color: '#0f172a' }}>{undertakingForm.medicalConditions || 'None declared'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Current Medications:</span> <strong style={{ color: '#0f172a' }}>{undertakingForm.currentMedication || 'None'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Dietary Restrictions:</span> <strong style={{ color: '#0f172a' }}>{undertakingForm.dietaryRestrictions || 'Standard'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Additional Info:</span> <strong style={{ color: '#0f172a' }}>{undertakingForm.medicalOther || 'None'}</strong></div>
                          </div>
                        </div>

                        {/* Consents */}
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                          <h4 style={{ fontSize: '12px', fontWeight: '800', color: '#475569', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Consents Provided
                          </h4>
                          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <li>Fieldwork &amp; village immersion engagement: <strong>{undertakingForm.consentFieldWork ? 'Consented' : 'Not Consented'}</strong></li>
                            <li>Photograph &amp; video utilization for academic documentation: <strong>{undertakingForm.consentPhotoVideo ? 'Consented' : 'Not Consented'}</strong></li>
                            <li>Code of conduct &amp; village cultural protocol adherence: <strong>{undertakingForm.consentCodeOfConduct ? 'Consented' : 'Not Consented'}</strong></li>
                            <li>Emergency medical arrangement authorization: <strong>{undertakingForm.consentMedicalEmergency ? 'Consented' : 'Not Consented'}</strong></li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <button
                        onClick={handlePrintUndertaking}
                        style={{
                          background: '#064e3b',
                          color: '#ffffff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '11px 22px',
                          fontWeight: '600',
                          fontSize: '13.5px',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(6,78,59,0.2)'
                        }}
                      >
                        <Printer size={15} />
                        Print Official Receipt
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── EDITABLE FORM STATE ───────────────────────────────────── */
                  <form onSubmit={handleSubmitUndertaking} style={{ display: 'flex', flexDirection: 'column', gap: '28px', margin: 0 }}>
                    
                    {/* Section 1: Participant Undertaking Agreement */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: '#047857',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          1
                        </span>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                          Participant Undertaking Agreement
                        </h3>
                      </div>

                      <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: isMobile ? '14px 16px' : '18px 22px',
                        fontSize: '13.5px',
                        lineHeight: '1.65',
                        color: '#334155',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <p style={{ margin: 0 }}>
                          I, <strong>{student?.name || undertakingForm.signedName || '____________________'}</strong> (PRN: <strong>{student?.prn || '____________________'}</strong>), student of <strong>{student?.department || '____________________'}</strong> Department/School, MIT World Peace University, hereby confirm that I will participate in the <strong>Rural Immersion Program</strong> allocated to <strong>{village?.name || 'Assigned Village'}</strong>, as part of the academic curriculum of MIT World Peace University.
                        </p>
                        <p style={{ margin: 0 }}>
                          I understand that the program includes travel, shared base lodging, group movement, rural field surveys, Gram Panchayat and community interactions, grassroots problem identification, and supervised rural engagement sessions.
                        </p>
                        <p style={{ margin: 0 }}>
                          I understand that MIT-WPU, faculty mentors, and the organizers shall take all reasonable precautions to ensure participant safety and provide appropriate supervision. However, I also understand that rural field immersion and outdoor activities involve inherent environmental and practical conditions.
                        </p>
                      </div>

                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: isMobile ? '14px 16px' : '18px 22px'
                      }}>
                        <p style={{ margin: '0 0 12px 0', fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                          I hereby undertake that I will:
                        </p>
                        <ol style={{
                          margin: 0,
                          paddingLeft: '18px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          fontSize: '13px',
                          color: '#475569',
                          lineHeight: '1.6'
                        }}>
                          <li>Follow all instructions given by Faculty Mentors, Village Coordinators, Gram Panchayat representatives, and authorized organizers.</li>
                          <li>Follow all venue rules, safety protocols, attendance procedures, reporting timings, and group movement instructions.</li>
                          <li>Stay with the assigned panel/group and not leave the village boundaries, activity venue, or designated movement route without prior written faculty permission.</li>
                          <li>Use only transport approved by the organisers for program-related travel and field movement.</li>
                          <li>Behave respectfully with fellow students, faculty mentors, village residents, Sarpanch, local volunteers, and all community members.</li>
                          <li>Not engage in bullying, harassment, abuse, discrimination, violence, intimidation, inappropriate conduct, or any behaviour that affects the dignity, safety, or comfort of villagers or peers.</li>
                          <li>Take proper care of university equipment, survey devices, community facilities, and rural surroundings.</li>
                          <li>Not possess, consume, distribute, or use alcohol, tobacco, cigarettes, vapes, narcotics, intoxicants, weapons, fireworks, hazardous items, or any prohibited substance.</li>
                          <li>Truthfully disclose all relevant medical conditions, allergies, medications, injuries, dietary restrictions, or health-related concerns before or during the program.</li>
                          <li>Inform faculty mentors immediately if I feel unwell, injured, unsafe, emotionally distressed, or unable to participate in any field activity.</li>
                          <li>Accept that I may be restricted from participating in an activity if faculty consider it necessary for my safety or the safety of others.</li>
                          <li>Maintain cleanliness, environmental responsibility, punctuality, and exemplary conduct throughout the immersion.</li>
                        </ol>
                      </div>
                    </div>

                    {/* Section 2: Village Ethics, ID & Cultural Protocol */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: '#047857',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          2
                        </span>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                          Village Ethics &amp; Cultural Protocol
                        </h3>
                      </div>

                      <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: isMobile ? '14px 16px' : '18px 22px',
                        fontSize: '13.5px',
                        color: '#334155',
                        lineHeight: '1.65',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <p style={{ margin: 0 }}>
                          Rural Immersion takes place within living rural communities. Students are expected to maintain the highest standards of cultural empathy, modesty, and mutual respect.
                        </p>
                        <p style={{ margin: 0 }}>
                          <strong>Dress Code &amp; Conduct:</strong> Wear modest, comfortable attire suitable for field walking and rural community interactions. Avoid flashy accessories or behavior contrary to local customs.
                        </p>
                        <p style={{ margin: 0 }}>
                          <strong>Photography &amp; Social Media:</strong> Always seek polite verbal consent before photographing village households, children, or sacred community sites. Do not publish sensitive personal information or disparaging content on social media.
                        </p>
                        <p style={{ margin: 0 }}>
                          <strong>Punctuality &amp; Group Safety:</strong> Attend all morning briefings and evening debriefs on time. No individual may wander away from their allocated panel during household survey periods.
                        </p>
                      </div>
                    </div>

                    {/* Section 3: Emergency Contact Information */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: '#047857',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          3
                        </span>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                          Emergency Contact Details <span style={{ fontSize: '12px', fontWeight: '400', color: '#64748b' }}>(Person not traveling with student)</span>
                        </h3>
                      </div>

                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: isMobile ? '16px' : '20px'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Contact Person Name *
                            </label>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="Full Name (Parent / Guardian)"
                              required
                              value={undertakingForm.emergencyContactName}
                              onChange={(e) => setUndertakingForm({ ...undertakingForm, emergencyContactName: e.target.value })}
                              style={{ margin: 0 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Relationship to Student *
                            </label>
                            <select
                              required
                              className="input-field"
                              value={undertakingForm.emergencyContactRelation}
                              onChange={(e) => setUndertakingForm({ ...undertakingForm, emergencyContactRelation: e.target.value })}
                              style={{ margin: 0, cursor: 'pointer' }}
                            >
                              <option value="Father">Father</option>
                              <option value="Mother">Mother</option>
                              <option value="Guardian">Guardian</option>
                              <option value="Sibling">Sibling</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Mobile Number *
                            </label>
                            <input
                              type="tel"
                              className="input-field"
                              placeholder="10-digit Mobile Number"
                              required
                              value={undertakingForm.emergencyContactMobile}
                              onChange={(e) => setUndertakingForm({ ...undertakingForm, emergencyContactMobile: e.target.value.replace(/\D/g, '') })}
                              style={{ margin: 0 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Alternate Mobile Number
                            </label>
                            <input
                              type="tel"
                              className="input-field"
                              placeholder="Alternate Number (Optional)"
                              value={undertakingForm.emergencyContactAltMobile}
                              onChange={(e) => setUndertakingForm({ ...undertakingForm, emergencyContactAltMobile: e.target.value.replace(/\D/g, '') })}
                              style={{ margin: 0 }}
                            />
                          </div>
                          <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Email ID *
                            </label>
                            <input
                              type="email"
                              className="input-field"
                              placeholder="guardian@example.com"
                              required
                              value={undertakingForm.emergencyContactEmail}
                              onChange={(e) => setUndertakingForm({ ...undertakingForm, emergencyContactEmail: e.target.value })}
                              style={{ margin: 0 }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Medical Information */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: '#047857',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          4
                        </span>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                          Medical &amp; Health Information
                        </h3>
                      </div>

                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: isMobile ? '16px' : '20px'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Blood Group *
                            </label>
                            <select
                              required
                              className="input-field"
                              value={undertakingForm.bloodGroup}
                              onChange={(e) => setUndertakingForm({ ...undertakingForm, bloodGroup: e.target.value })}
                              style={{ margin: 0, cursor: 'pointer' }}
                            >
                              <option value="">-- Select Blood Group --</option>
                              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                                <option key={bg} value={bg}>{bg}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Known Allergies
                            </label>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="Food, medicine, dust, etc. (Or 'None')"
                              value={undertakingForm.knownAllergies}
                              onChange={(e) => setUndertakingForm({ ...undertakingForm, knownAllergies: e.target.value })}
                              style={{ margin: 0 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Medical Conditions (if any)
                            </label>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="e.g. Asthma, Diabetes, Migraine (Or 'None')"
                              value={undertakingForm.medicalConditions}
                              onChange={(e) => setUndertakingForm({ ...undertakingForm, medicalConditions: e.target.value })}
                              style={{ margin: 0 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Current Medications (if any)
                            </label>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="Prescribed medicines currently taking"
                              value={undertakingForm.currentMedication}
                              onChange={(e) => setUndertakingForm({ ...undertakingForm, currentMedication: e.target.value })}
                              style={{ margin: 0 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Dietary Restrictions (if any)
                            </label>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="Specific dietary needs or restrictions"
                              value={undertakingForm.dietaryRestrictions}
                              onChange={(e) => setUndertakingForm({ ...undertakingForm, dietaryRestrictions: e.target.value })}
                              style={{ margin: 0 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Any other important info
                            </label>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="Any other details organisers should know"
                              value={undertakingForm.medicalOther}
                              onChange={(e) => setUndertakingForm({ ...undertakingForm, medicalOther: e.target.value })}
                              style={{ margin: 0 }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 5: Consents and Acknowledgment */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: '#047857',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          5
                        </span>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                          Consents &amp; Acknowledgement
                        </h3>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#334155',
                          lineHeight: '1.55',
                          padding: '14px 16px',
                          borderRadius: '10px',
                          background: undertakingForm.consentFieldWork ? '#f0fdf4' : '#ffffff',
                          border: undertakingForm.consentFieldWork ? '1.5px solid #86efac' : '1.5px solid #e2e8f0',
                          transition: 'all 0.15s ease'
                        }}>
                          <input
                            type="checkbox"
                            checked={undertakingForm.consentFieldWork}
                            onChange={(e) => setUndertakingForm({ ...undertakingForm, consentFieldWork: e.target.checked })}
                            style={{ marginTop: '2px', accentColor: '#047857', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }}
                          />
                          <span>I consent to active participation in both scheduled days (Day 1 & Day 2) of Rural Immersion field surveys, community projects, and sessions under faculty supervision.</span>
                        </label>

                        <label style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#334155',
                          lineHeight: '1.55',
                          padding: '14px 16px',
                          borderRadius: '10px',
                          background: undertakingForm.consentPhotoVideo ? '#f0fdf4' : '#ffffff',
                          border: undertakingForm.consentPhotoVideo ? '1.5px solid #86efac' : '1.5px solid #e2e8f0',
                          transition: 'all 0.15s ease'
                        }}>
                          <input
                            type="checkbox"
                            checked={undertakingForm.consentPhotoVideo}
                            onChange={(e) => setUndertakingForm({ ...undertakingForm, consentPhotoVideo: e.target.checked })}
                            style={{ marginTop: '2px', accentColor: '#047857', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }}
                          />
                          <span>I consent to the organisers using my photographs and videos taken during the program for internal documentation, reports, academic communication, promotional material, website, and social media purposes. I understand that my personal contact details will not be shared publicly.</span>
                        </label>

                        <label style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#334155',
                          lineHeight: '1.55',
                          padding: '14px 16px',
                          borderRadius: '10px',
                          background: undertakingForm.consentCodeOfConduct ? '#f0fdf4' : '#ffffff',
                          border: undertakingForm.consentCodeOfConduct ? '1.5px solid #86efac' : '1.5px solid #e2e8f0',
                          transition: 'all 0.15s ease'
                        }}>
                          <input
                            type="checkbox"
                            checked={undertakingForm.consentCodeOfConduct}
                            onChange={(e) => setUndertakingForm({ ...undertakingForm, consentCodeOfConduct: e.target.checked })}
                            style={{ marginTop: '2px', accentColor: '#047857', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }}
                          />
                          <span>I confirm that I have read the Rural Immersion Code of Conduct and Village Ethics Protocols and agree to strictly abide by them throughout the duration of the program.</span>
                        </label>

                        <label style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#334155',
                          lineHeight: '1.55',
                          padding: '14px 16px',
                          borderRadius: '10px',
                          background: undertakingForm.consentMedicalEmergency ? '#f0fdf4' : '#ffffff',
                          border: undertakingForm.consentMedicalEmergency ? '1.5px solid #86efac' : '1.5px solid #e2e8f0',
                          transition: 'all 0.15s ease'
                        }}>
                          <input
                            type="checkbox"
                            checked={undertakingForm.consentMedicalEmergency}
                            onChange={(e) => setUndertakingForm({ ...undertakingForm, consentMedicalEmergency: e.target.checked })}
                            style={{ marginTop: '2px', accentColor: '#047857', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }}
                          />
                          <span>I authorise MIT-WPU representatives, faculty mentors, and designated organisers to arrange appropriate medical treatment, transportation, emergency care, or hospital assistance if required during the program.</span>
                        </label>
                      </div>
                    </div>

                    {/* Section 6: Digital Signature & Final Declaration */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: '#047857',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          6
                        </span>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                          Digital Signature &amp; Final Declaration
                        </h3>
                      </div>

                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: isMobile ? '16px' : '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Full Name (Digital Signature) *
                            </label>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="Digital signature..."
                              style={{ margin: 0, backgroundColor: '#f8fafc', color: '#047857', fontWeight: '700', cursor: 'not-allowed' }}
                              value={undertakingForm.signedName || student?.name || ''}
                              readOnly={true}
                              required
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Date of Signature *
                            </label>
                            <input
                              type="date"
                              className="input-field"
                              style={{ margin: 0 }}
                              value={undertakingForm.signedDate}
                              onChange={(e) => setUndertakingForm({ ...undertakingForm, signedDate: e.target.value })}
                              required
                            />
                          </div>
                        </div>

                        <div style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '12px 14px'
                        }}>
                          <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '13px', color: '#334155', fontWeight: '600', lineHeight: '1.5' }}>
                            <input type="checkbox" required style={{ marginTop: '3px', accentColor: '#047857', width: '16px', height: '16px', flexShrink: 0 }} />
                            <span>I confirm that I have read and understood this Rural Immersion undertaking and agree to abide by all program rules, village protocols, safety instructions, and expected standards of conduct. *</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Submit Action */}
                    <div style={{ paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      {isUndertakingSubmitted && (
                        <button
                          type="button"
                          onClick={() => setIsEditingUndertaking(false)}
                          style={{
                            padding: '12px 22px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '13.5px',
                            fontWeight: '600',
                            color: '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      )}

                      <button
                        type="submit"
                        disabled={submittingUndertaking}
                        style={{
                          background: submittingUndertaking ? '#94a3b8' : '#047857',
                          color: '#ffffff',
                          padding: '13px 32px',
                          fontSize: '14px',
                          fontWeight: '700',
                          borderRadius: '8px',
                          alignSelf: isMobile ? 'stretch' : 'flex-start',
                          width: isMobile ? '100%' : 'auto',
                          border: 'none',
                          cursor: submittingUndertaking ? 'not-allowed' : 'pointer',
                          boxShadow: submittingUndertaking ? 'none' : '0 2px 8px rgba(4,120,87,0.25)',
                          transition: 'all 0.2s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <Check size={16} />
                        <span>{submittingUndertaking ? 'Submitting...' : 'Sign & Submit RI Undertaking'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
          )}

          {/* ── TAB 3 GATE CARD: LTC UNDERTAKING REQUIRED (Dual RI + LTC students) ── */}
          {activeTab === 'undertaking' && hasLtc && !isUndertakingSubmitted && (
            <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px' }}>
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1.5px solid #e2e8f0',
                padding: '36px 28px',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  backgroundColor: '#ecfdf5',
                  color: '#047857',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}>
                  <FileText size={28} />
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 10px 0' }}>
                  Undertaking Completion Required
                </h2>
                <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                  Please complete your undertaking first to access both the RI and LTC Student Portals.
                </p>
                <button
                  type="button"
                  onClick={handleConfirmMoveToLtcPortal}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    borderRadius: '10px',
                    backgroundColor: '#047857',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(4, 120, 87, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#065f46'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#047857'; }}
                >
                  <span>Go to LTC Undertaking Form</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 3 STATUS CARD: LTC UNDERTAKING COMPLETED (Dual RI + LTC students) ── */}
          {activeTab === 'undertaking' && hasLtc && isUndertakingSubmitted && (
            <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px' }}>
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1.5px solid #bbf7d0',
                padding: '36px 28px',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  backgroundColor: '#dcfce7',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}>
                  <Check size={28} />
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 10px 0' }}>
                  Undertaking Completed & Verified
                </h2>
                <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                  Your student undertaking form has been submitted and verified via the LTC Student Portal. You have full access to both the Rural Immersion and LTC Student Portals.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('forms')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 22px',
                      borderRadius: '10px',
                      backgroundColor: '#047857',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(4, 120, 87, 0.25)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#065f46'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#047857'; }}
                  >
                    <span>View RI Forms Hub</span>
                    <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/student?tab=undertaking')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 22px',
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                  >
                    <span>View LTC Undertaking</span>
                    <ExternalLink size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 4: MY PANEL & TEAM ───────────────────────────────────────── */}
          {activeTab === 'panel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px' }}>


              {/* Village Details Box */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: isMobile ? '12px' : '16px',
                padding: isMobile ? '16px' : '22px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: isMobile ? '28px' : '32px',
                      height: isMobile ? '28px' : '32px',
                      borderRadius: '8px',
                      background: '#047857',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <MapPin size={isMobile ? 14 : 16} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: isMobile ? '14px' : '15px', fontWeight: 800, color: '#0f172a' }}>
                        Allocated Village Details
                      </h3>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {village?.name || 'Assigned Village'} • Taluka: {village?.taluka || village?.panchayat || '—'}
                      </span>
                    </div>
                  </div>


                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '12.5px' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Village Name</span>
                    <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{village?.name || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Address / Detailed Location</span>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{village?.detailed_address || village?.address || village?.location || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>District &amp; Taluka</span>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{village?.district || '—'}{village?.taluka ? ` • ${village.taluka}` : ''}</div>
                  </div>
                  {village?.school_name && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Village School</span>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{village.school_name}{village?.principal_mobile ? ` (📞 ${village.principal_mobile})` : ''}</div>
                    </div>
                  )}
                  {village?.spoc_name && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>SPOC Coordinator</span>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{village.spoc_name}{village?.spoc_mobile ? ` (📞 ${village.spoc_mobile})` : ''}</div>
                    </div>
                  )}
                  {village?.sarpanch_name && village.sarpanch_name !== '—' && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Sarpanch Contact</span>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{village.sarpanch_name}{village?.sarpanch_mobile ? ` (📞 ${village.sarpanch_mobile})` : ''}</div>
                    </div>
                  )}
                  {village?.remark && (
                    <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
                      <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Remark</span>
                      <div style={{ fontWeight: 500, color: '#475569', marginTop: '2px' }}>{village.remark}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Assigned Mentors Box */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: isMobile ? '12px' : '16px',
                padding: isMobile ? '16px' : '22px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  <div style={{
                    width: isMobile ? '28px' : '32px',
                    height: isMobile ? '28px' : '32px',
                    borderRadius: '8px',
                    background: '#047857',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Briefcase size={isMobile ? 14 : 16} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: isMobile ? '14px' : '15px', fontWeight: 800, color: '#0f172a' }}>
                    Assigned Faculty Mentors
                  </h3>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '10px'
                }}>
                  {(mentors || []).map((m) => (
                    <div key={m.id || m.email} style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: isMobile ? '12px' : '14px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <strong style={{ fontSize: isMobile ? '13.5px' : '14px', color: '#0f172a' }}>{m.name}</strong>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: m.role === 'Lead Mentor' ? '#047857' : '#475569',
                          background: m.role === 'Lead Mentor' ? '#ecfdf5' : '#e2e8f0',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {m.role || 'Mentor'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {m.designation || 'Faculty'} • {m.department}
                      </div>
                      <div style={{ fontSize: '12px', color: '#334155', marginTop: '6px', wordBreak: 'break-word' }}>
                        ✉️ {m.email} {m.phone && `• 📞 ${m.phone}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Panel Teammates List */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: isMobile ? '12px' : '16px',
                padding: isMobile ? '16px' : '22px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  justifyContent: 'space-between',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? '10px' : '12px',
                  marginBottom: '16px'
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: isMobile ? '14px' : '15px', fontWeight: 800, color: '#0f172a' }}>
                      Co-students in this Panel ({teammates?.length || 0})
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      Directory of students assigned to your panel.
                    </p>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    width: isMobile ? '100%' : 'auto'
                  }}>
                    <input
                      type="text"
                      placeholder="Search name, PRN, roll..."
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '13px',
                        width: isMobile ? '100%' : '240px'
                      }}
                    />
                  </div>
                </div>

                {/* Responsive Horizontally Scrollable Team Members Table (Mobile & Desktop) */}
                <div style={{
                  width: '100%',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
                }}>

                  <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1 }}>
                        <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', width: '50px' }}>Sr.</th>
                        <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Student Name</th>
                        <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', width: '130px' }}>PRN</th>
                        <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Dept &amp; Div</th>
                        <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', width: '80px' }}>Gender</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTeammates.map((t, idx) => (
                        <tr
                          key={t.student_id || idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: t.is_current_user ? '#f0fdf4' : (idx % 2 === 0 ? '#ffffff' : '#fafafa')
                          }}
                        >
                          <td style={{ padding: '10px 12px', color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ padding: '10px 12px', fontWeight: t.is_current_user ? 800 : 600, color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{t.student_name}</span>
                              {t.is_current_user && (
                                <span style={{ fontSize: '10px', background: '#047857', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  YOU
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#334155', fontFamily: 'monospace', fontWeight: 600 }}>{t.prn}</td>
                          <td style={{ padding: '10px 12px', color: '#475569' }}>{t.department} ({t.division})</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{t.gender || '—'}</td>
                        </tr>
                      ))}
                      {filteredTeammates.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '28px', textAlign: 'center', color: '#94a3b8' }}>
                            No matching students found in this panel.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Field Visit Media Gallery (Uploaded by Faculty Mentor) */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: isMobile ? '12px' : '16px',
                padding: isMobile ? '16px' : '22px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
              }}>
                <RiPanelMediaViewer
                  media={panelMedia}
                  isLoading={isPanelMediaLoading}
                  title="Field Visit Photos (Max 5)"
                  subtitle={`Memories & field documentation uploaded by your faculty mentor for ${cleanPanelName(panel?.name) || 'your panel'}`}
                  emptyMessage="Your faculty mentor has not uploaded any visit photos yet."
                  isMobile={isMobile}
                />
              </div>
            </div>
          )}

          {/* ── TAB: VISIT MEDIA (FULL VIEW) ─────────────────────────── */}
          {activeTab === 'media' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px' }}>
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: isMobile ? '12px' : '16px',
                padding: isMobile ? '16px' : '24px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
              }}>
                <RiPanelMediaViewer
                  media={panelMedia}
                  isLoading={isPanelMediaLoading}
                  title=""
                  subtitle=""
                  emptyMessage="Your faculty mentor has not uploaded visit photos for your panel yet."
                  isMobile={isMobile}
                />
              </div>
            </div>
          )}

          {/* ── TAB 5: MY ATTENDANCE (4 ACTIVITIES) ─────────────────────────── */}
          {activeTab === 'attendance' && (() => {
            const rawActivities = attendanceData?.activities || [];
            const summary = attendanceData?.summary || {};

            // Resolve all 4 activities against RI_ACTIVITIES_LIST
            const activitiesList = RI_ACTIVITIES_LIST.map((actDef, idx) => {
              const rec = Array.isArray(rawActivities)
                ? rawActivities.find(a => (a.activity_key === actDef.key || a.activity === actDef.key || a.activity_name === actDef.label))
                : null;

              const fallbackRecord = (!rec && Array.isArray(attendance_summary?.records))
                ? attendance_summary.records.find(r => r.activity === actDef.key || r.activity_name === actDef.key)
                : null;

              const finalRec = rec || fallbackRecord;
              const isPresent = finalRec?.status === 'Present' || finalRec?.status === 'P' || finalRec?.is_present === true;
              const isAbsent = finalRec?.status === 'Absent' || finalRec?.status === 'A' || finalRec?.is_absent === true;
              const isUnmarked = !isPresent && !isAbsent;

              return {
                number: idx + 1,
                key: actDef.key,
                label: actDef.label,
                description: actDef.description || 'Rural Immersion curriculum activity',
                isPresent,
                isAbsent,
                isUnmarked,
                remarks: finalRec?.remarks || null
              };
            });

            const presentCount = summary.present_count ?? activitiesList.filter(a => a.isPresent).length;
            const absentCount = summary.absent_count ?? activitiesList.filter(a => a.isAbsent).length;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '18px' }}>
                {/* Simple 3-Stat Cards Strip (Mobile responsive) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: isMobile ? '8px' : '14px'
                }}>
                  {/* Card 1: Total Activities */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: isMobile ? '10px' : '12px',
                    padding: isMobile ? '12px 10px' : '16px 18px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: isMobile ? '10px' : '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Total Activities
                    </div>
                    <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                      4
                    </div>
                  </div>

                  {/* Card 2: Present */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #bbf7d0',
                    borderRadius: isMobile ? '10px' : '12px',
                    padding: isMobile ? '12px 10px' : '16px 18px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: isMobile ? '10px' : '11px', color: '#047857', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Present
                    </div>
                    <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: 800, color: '#047857', marginTop: '4px' }}>
                      {presentCount}
                    </div>
                  </div>

                  {/* Card 3: Absent */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: absentCount > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0',
                    borderRadius: isMobile ? '10px' : '12px',
                    padding: isMobile ? '12px 10px' : '16px 18px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: isMobile ? '10px' : '11px', color: absentCount > 0 ? '#dc2626' : '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Absent
                    </div>
                    <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: 800, color: absentCount > 0 ? '#dc2626' : '#64748b', marginTop: '4px' }}>
                      {absentCount}
                    </div>
                  </div>
                </div>

                {/* 4 Activity Cards Container */}
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: isMobile ? '12px' : '14px',
                  padding: isMobile ? '14px' : '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isMobile ? '10px' : '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <h3 style={{ margin: 0, fontSize: isMobile ? '14px' : '15px', fontWeight: 800, color: '#0f172a' }}>
                      Activity Attendance List
                    </h3>
                    <span style={{ fontSize: isMobile ? '11px' : '12px', color: '#64748b', fontWeight: 600 }}>
                      Panel {panel?.panel_number || panel?.name || 'Assigned'}
                    </span>
                  </div>

                  {activitiesList.map((act) => {
                    const isPresent = act.isPresent;
                    const isAbsent = act.isAbsent;
                    const isUnmarked = act.isUnmarked;

                    return (
                      <div
                        key={act.key}
                        style={{
                          padding: isMobile ? '12px 14px' : '14px 18px',
                          backgroundColor: isPresent ? '#f0fdf4' : (isAbsent ? '#fef2f2' : '#f8fafc'),
                          border: `1px solid ${isPresent ? '#bbf7d0' : (isAbsent ? '#fecaca' : '#e2e8f0')}`,
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          flexWrap: isMobile ? 'wrap' : 'nowrap'
                        }}
                      >
                        {/* Left: Number + Details */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px', minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: isMobile ? '30px' : '34px',
                            height: isMobile ? '30px' : '34px',
                            borderRadius: '8px',
                            backgroundColor: isPresent ? '#dcfce7' : (isAbsent ? '#fee2e2' : '#e2e8f0'),
                            color: isPresent ? '#15803d' : (isAbsent ? '#b91c1c' : '#475569'),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: isMobile ? '12px' : '13px',
                            flexShrink: 0
                          }}>
                            {act.number}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: isMobile ? '13.5px' : '14.5px', fontWeight: 750, color: '#0f172a' }}>
                              {act.label}
                            </div>
                            <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#64748b', marginTop: '2px' }}>
                              {act.description}
                            </div>
                            {act.remarks && (
                              <div style={{ fontSize: '11px', color: '#047857', marginTop: '3px', fontWeight: 500 }}>
                                Remark: {act.remarks}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Clean Status Badge */}
                        <div style={{ flexShrink: 0 }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: isMobile ? '4px 10px' : '5px 12px',
                            borderRadius: '999px',
                            fontSize: isMobile ? '11px' : '12px',
                            fontWeight: 700,
                            backgroundColor: isPresent ? '#047857' : (isAbsent ? '#dc2626' : '#64748b'),
                            color: '#ffffff'
                          }}>
                            {isPresent && <CheckCircle size={12} />}
                            {isAbsent && <AlertCircle size={12} />}
                            {isUnmarked && <Clock size={12} />}
                            <span>{isPresent ? 'Present' : (isAbsent ? 'Absent' : 'Pending')}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── TAB 6: RI SCHEDULE & ACTIVITIES (4-COLUMN LTC LRP SCHEDULE DESIGN) ─────── */}
          {activeTab === 'schedule' && (() => {
            const currentDayNum = selectedScheduleDay;
            const currentDayPlan = activeScheduleList.find(d => (d.day_number || parseInt(d.day.replace(/\D/g, '')) || 1) === currentDayNum) || activeScheduleList[0] || DEFAULT_SCHEDULE[0];
            const currentActivities = currentDayPlan?.activities || [];

            return (
              <div 
                className="glass-card animate-fade-in"
                style={{ 
                  background: '#ffffff',
                  border: '1px solid #e2e8f0', 
                  borderRadius: '16px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '20px', 
                  padding: '24px'
                }} 
              >
                {/* Header Section matching LTC LRP Schedule */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '22px', fontWeight: '850', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.5px' }}>
                      <Calendar size={20} style={{ color: '#047857' }} />
                      RI Schedule
                    </h3>
                    <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '500' }}>
                      Daily agenda, activities, venues & details
                    </p>
                  </div>
                </div>

                {/* Day Selection Tabs & Activity Counter */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                    {(activeScheduleList?.length ? activeScheduleList.map((dObj, idx) => dObj.day_number || idx + 1) : [1, 2, 3]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setSelectedScheduleDay(d)}
                        style={{
                          padding: '8px 20px',
                          borderRadius: '10px',
                          fontSize: '13.5px',
                          fontWeight: '750',
                          border: '1px solid',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s',
                          background: currentDayNum === d ? '#154388' : '#ffffff',
                          color: currentDayNum === d ? '#ffffff' : '#475569',
                          borderColor: currentDayNum === d ? '#154388' : '#e2e8f0',
                          boxShadow: currentDayNum === d ? '0 2px 6px rgba(21, 67, 136, 0.15)' : 'none'
                        }}
                      >
                        Day {d}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b' }}>
                    Day {currentDayNum} · {currentActivities.length} activities
                  </div>
                </div>

                {/* Activity Grid List: 4-Column Layout (TIME | ACTIVITY NAME | VENUE & DETAILS | CATEGORY) */}
                <div className="lrp-schedule-container" style={{ marginTop: '4px' }}>
                  {/* Column Headers */}
                  <div className="lrp-schedule-header">
                    <div>TIME</div>
                    <div>ACTIVITY NAME</div>
                    <div>VENUE & DETAILS</div>
                    <div style={{ textAlign: 'right' }}>CATEGORY</div>
                  </div>

                  {/* Activity Rows */}
                  {currentActivities.map((activity, idx) => {
                    const styles = getRiCategoryStyles(activity.category, activity.type);
                    return (
                      <div key={idx} className="lrp-schedule-row">
                        {/* Column 1: Time Badge */}
                        <div className="lrp-time-column">
                          <span className="lrp-time-pill">
                            <Clock size={13} style={{ color: '#047857', flexShrink: 0 }} />
                            {activity.time}
                          </span>
                        </div>

                        {/* Column 2: Activity Name & Description */}
                        <div className="lrp-activity-column">
                          <span className="lrp-activity-name">{activity.title}</span>
                          {(activity.description || activity.desc) && (
                            <p className="lrp-activity-description">{activity.description || activity.desc}</p>
                          )}
                        </div>

                        {/* Column 3: Venue & Dress/Details */}
                        <div className="lrp-venue-dress-column">
                          <div className="lrp-venue-info">
                            <MapPin size={13} style={{ color: '#047857', flexShrink: 0 }} />
                            <span>{activity.location || profileData?.village?.name || 'Allocated Village'}</span>
                          </div>
                          {(activity.dress || activity.notes || activity.instructions) && (
                            <div className="lrp-dress-info">
                              <Info size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                              <span>{activity.dress || activity.notes || activity.instructions}</span>
                            </div>
                          )}
                        </div>

                        {/* Column 4: Category Badge */}
                        <div className="lrp-badge-column">
                          <span
                            className="lrp-category-pill"
                            style={{
                              color: styles.text,
                              background: styles.bg
                            }}
                          >
                            {styles.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── TAB 8: DO'S & DON'TS (OFFICIAL RUIP GUIDELINES) ────────────────── */}
          {activeTab === 'dos_donts' && (() => {
            const query = dosDontsSearchQuery.trim().toLowerCase();

            // Filter categories and items based on active phase and search
            const filteredCategories = RI_DOS_DONTS_CATEGORIES
              .filter(cat => dosDontsActiveCategory === 'all' || cat.id === dosDontsActiveCategory)
              .map(cat => {
                if (!query) return cat;
                const filteredDos = cat.dos.filter(d => d.toLowerCase().includes(query) || cat.title.toLowerCase().includes(query));
                const filteredDonts = cat.donts.filter(d => d.toLowerCase().includes(query) || cat.title.toLowerCase().includes(query));
                return {
                  ...cat,
                  dos: filteredDos,
                  donts: filteredDonts,
                  hasMatches: filteredDos.length > 0 || filteredDonts.length > 0
                };
              })
              .filter(cat => !query || cat.hasMatches);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* ── Sub-Tab Filter Pills & Search Bar ── */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  flexWrap: 'wrap',
                  gap: isMobile ? '8px' : '10px'
                }}>
                  {/* Phase Filter Pills */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '4px',
                    gap: '4px',
                    overflowX: 'auto',
                    maxWidth: '100%',
                    scrollbarWidth: 'none'
                  }}>
                    <button
                      type="button"
                      onClick={() => setDosDontsActiveCategory('all')}
                      style={{
                        padding: isMobile ? '6px 10px' : '8px 14px',
                        border: 'none',
                        borderRadius: '8px',
                        background: dosDontsActiveCategory === 'all' ? '#047857' : 'transparent',
                        color: dosDontsActiveCategory === 'all' ? '#ffffff' : '#64748b',
                        fontWeight: '700',
                        fontSize: isMobile ? '11.5px' : '12.5px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      All Phases
                    </button>
                    {RI_DOS_DONTS_CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setDosDontsActiveCategory(cat.id)}
                        style={{
                          padding: isMobile ? '6px 10px' : '8px 14px',
                          border: 'none',
                          borderRadius: '8px',
                          background: dosDontsActiveCategory === cat.id ? '#047857' : 'transparent',
                          color: dosDontsActiveCategory === cat.id ? '#ffffff' : '#64748b',
                          fontWeight: '700',
                          fontSize: isMobile ? '11.5px' : '12.5px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {cat.title}
                      </button>
                    ))}
                  </div>

                  {/* Search Filter Input (beside Health & Safety) */}
                  <div style={{ position: 'relative', width: isMobile ? '100%' : '260px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search guidelines..."
                      value={dosDontsSearchQuery}
                      onChange={e => setDosDontsSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: isMobile ? '8px 12px 8px 34px' : '8.5px 12px 8.5px 34px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: isMobile ? '12.5px' : '13px',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                        backgroundColor: '#ffffff'
                      }}
                    />
                    {dosDontsSearchQuery && (
                      <button
                        onClick={() => setDosDontsSearchQuery('')}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Empty State if no search matches ── */}
                {filteredCategories.length === 0 && (
                  <div style={{
                    background: '#ffffff',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '16px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: '#64748b'
                  }}>
                    <AlertCircle size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: '0 0 6px 0' }}>
                      No matching guidelines found
                    </h3>
                    <p style={{ fontSize: '13px', margin: '0 0 16px 0' }}>
                      No Do's or Don'ts match "{dosDontsSearchQuery}". Try a different keyword or reset filters.
                    </p>
                    <button
                      onClick={() => { setDosDontsSearchQuery(''); setDosDontsActiveCategory('all'); }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Reset Filters
                    </button>
                  </div>
                )}

                {/* ── Category Modules (Each with Side-by-Side Do's & Don'ts Panels) ── */}
                {filteredCategories.map((cat) => {
                  return (
                    <div
                      key={cat.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: isMobile ? '12px' : '16px',
                        padding: isMobile ? '14px 12px' : '22px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      {/* Section Header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobile ? '10px' : '12px',
                        marginBottom: isMobile ? '12px' : '18px',
                        borderBottom: '1px solid #f1f5f9',
                        paddingBottom: isMobile ? '10px' : '14px'
                      }}>
                        <div style={{
                          width: isMobile ? '32px' : '36px',
                          height: isMobile ? '32px' : '36px',
                          borderRadius: '10px',
                          background: '#ecfdf5',
                          color: '#047857',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {cat.iconName === 'Compass' && <Compass size={isMobile ? 16 : 18} strokeWidth={2.2} />}
                          {cat.iconName === 'MapPin' && <MapPin size={isMobile ? 16 : 18} strokeWidth={2.2} />}
                          {cat.iconName === 'Users' && <Users size={isMobile ? 16 : 18} strokeWidth={2.2} />}
                          {cat.iconName === 'FileText' && <FileText size={isMobile ? 16 : 18} strokeWidth={2.2} />}
                          {cat.iconName === 'HeartHandshake' && <HeartHandshake size={isMobile ? 16 : 18} strokeWidth={2.2} />}
                          {cat.iconName === 'ShieldAlert' && <ShieldAlert size={isMobile ? 16 : 18} strokeWidth={2.2} />}
                        </div>
                        <div>
                          <h3 style={{ fontSize: isMobile ? '14.5px' : '16px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.2px' }}>
                            {cat.title}
                          </h3>
                          <p style={{ fontSize: isMobile ? '11.5px' : '12.5px', color: '#64748b', margin: '2px 0 0 0' }}>
                            {cat.subtitle}
                          </p>
                        </div>
                      </div>

                      {/* Side-by-Side Comparison Grid (Stacks cleanly to 1 column on mobile) */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: isMobile ? '12px' : '16px'
                      }}>
                        {/* ── Do's Card (Left) ── */}
                        <div style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: isMobile ? '10px' : '14px',
                          padding: isMobile ? '12px 10px' : '16px',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: isMobile ? '10px' : '14px',
                            borderBottom: '1px solid #e2e8f0',
                            paddingBottom: isMobile ? '8px' : '10px'
                          }}>
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#dcfce7',
                              color: '#15803d',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <CheckCircle2 size={15} />
                            </div>
                            <h4 style={{ fontSize: isMobile ? '13.5px' : '14.5px', fontWeight: '800', color: '#15803d', margin: 0 }}>
                              Do's
                            </h4>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {cat.dos.map((doItem, itemIdx) => (
                              <div
                                key={itemIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: isMobile ? '8px' : '12px',
                                  padding: isMobile ? '10px 12px' : '12px 14px',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderLeft: '4px solid #10b981',
                                  borderRadius: '10px',
                                  textAlign: 'left'
                                }}
                              >
                                <span style={{
                                  color: '#10b981',
                                  fontWeight: '900',
                                  fontSize: '11px',
                                  marginTop: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '18px',
                                  height: '18px',
                                  background: '#dcfce7',
                                  borderRadius: '50%',
                                  flexShrink: 0
                                }}>
                                  ✓
                                </span>
                                <span style={{ fontSize: isMobile ? '12.5px' : '13px', color: '#334155', fontWeight: '500', lineHeight: '1.5' }}>
                                  {doItem}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* ── Don'ts Card (Right) ── */}
                        <div style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: isMobile ? '10px' : '14px',
                          padding: isMobile ? '12px 10px' : '16px',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: isMobile ? '10px' : '14px',
                            borderBottom: '1px solid #e2e8f0',
                            paddingBottom: isMobile ? '8px' : '10px'
                          }}>
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#fee2e2',
                              color: '#dc2626',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <AlertCircle size={15} />
                            </div>
                            <h4 style={{ fontSize: isMobile ? '13.5px' : '14.5px', fontWeight: '800', color: '#dc2626', margin: 0 }}>
                              Don'ts
                            </h4>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {cat.donts.map((dontItem, itemIdx) => (
                              <div
                                key={itemIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: isMobile ? '8px' : '12px',
                                  padding: isMobile ? '10px 12px' : '12px 14px',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderLeft: '4px solid #ef4444',
                                  borderRadius: '10px',
                                  textAlign: 'left'
                                }}
                              >
                                <span style={{
                                  color: '#ef4444',
                                  fontWeight: '900',
                                  fontSize: '11px',
                                  marginTop: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '18px',
                                  height: '18px',
                                  background: '#fee2e2',
                                  borderRadius: '50%',
                                  flexShrink: 0
                                }}>
                                  ✕
                                </span>
                                <span style={{ fontSize: isMobile ? '12.5px' : '13px', color: '#334155', fontWeight: '500', lineHeight: '1.5' }}>
                                  {dontItem}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── TAB: THINGS TO CARRY (ANNEX F) ─────────────────── */}
          {activeTab === 'things_to_carry' && (
            <RiThingsToCarryTab
              isMobile={isMobile}
              studentId={profileData?.student?.id || JSON.parse(localStorage.getItem('user') || '{}')?.id}
              token={localStorage.getItem('token')}
            />
          )}

          {/* ── TAB: OFFICIAL ANNEXURES (RUIP GUIDELINES) ────────── */}
          {activeTab === 'annexures' && (
            <RiAnnexuresTab isMobile={isMobile} />
          )}

          {/* ── TAB: SUPPORT TICKETS ────────────────────────────── */}
          {activeTab === 'support' && (
            <RiStudentSupportTab token={localStorage.getItem('token')} />
          )}

          {/* ── TAB: SETTINGS & PROFILE ─────────────────────────── */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
              {/* Header Profile Card */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: isMobile ? '12px' : '16px',
                padding: isMobile ? '16px' : '24px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #065f46, #047857)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '18px',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(4, 120, 87, 0.25)'
                }}>
                  {student?.name ? student.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'ST'}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: isMobile ? '17px' : '20px', fontWeight: 800, color: '#0f172a' }}>
                    {student?.name || 'Student Profile'}
                  </h2>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    PRN: <span style={{ fontWeight: 700, color: '#0f172a' }}>{student?.prn || '—'}</span> {student?.roll_no ? `• Roll: ${student.roll_no}` : ''}
                  </p>
                </div>
              </div>

              {/* Academic & RI Allocation Details */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: isMobile ? '12px' : '16px',
                padding: isMobile ? '16px' : '22px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
              }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                  Immersion & Program Allocation
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Department / School</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{student?.department || '—'}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Academic Batch</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{batch?.name || '—'}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Assigned Village</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#047857', marginTop: '2px' }}>{village?.name || 'Assigned Village'}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Assigned Panel / Team</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#047857', marginTop: '2px' }}>{cleanPanelName(panel?.name || '—')}</div>
                  </div>
                </div>
              </div>

              {/* Preferences & Quick Navigation */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: isMobile ? '12px' : '16px',
                padding: isMobile ? '16px' : '22px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
              }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                  Quick Portals & Guidelines
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {hasLtc && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      background: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      borderLeft: '4px solid #047857',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: '#ecfdf5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Compass size={20} color="#047857" />
                        </div>
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 750, color: '#0f172a' }}>Life Transformation Center</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>Switch to your LTC Student Portal</div>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate('/student')}
                        style={{
                          background: '#047857',
                          color: '#ffffff',
                          border: 'none',
                          padding: '8px 15px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>Switch to LTC</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setActiveTab('dos_donts')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      background: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <CheckSquare size={18} color="#047857" />
                      </div>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>Fieldwork Do's & Don'ts</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>Mandatory behavioral guidelines in rural communities</div>
                      </div>
                    </div>
                    <ChevronRight size={16} color="#94a3b8" />
                  </button>

                  <button
                    onClick={() => setActiveTab('annexures')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      background: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <BookOpen size={18} color="#047857" />
                      </div>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>Official Guidelines & Annexures</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>Annexures H, I, K, and L (Processes, Credits & SDGs)</div>
                      </div>
                    </div>
                    <ChevronRight size={16} color="#94a3b8" />
                  </button>
                </div>
              </div>

              {/* Logout button */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: isMobile ? '12px' : '16px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
              }}>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '10px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: '13px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <LogOut size={16} />
                  <span>Log Out of Portal</span>
                </button>
              </div>
            </div>
          )}
    </>
  );

  return (
    <>
      {!isMobile ? (
        <div className="desktop-layout" style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: '#eff6f1' }}>
          {renderDesktopSidebar()}
          <div className="desktop-main-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            {renderDesktopTopbar()}
            <div className="desktop-content" style={{ flex: 1, padding: activeTab === 'dashboard' ? '32px 30px' : '28px', overflowY: 'auto', backgroundColor: '#eff6f1' }}>
              {renderMainContent()}
            </div>
          </div>
        </div>
      ) : (
        <div className="dashboard-layout mobile-layout" style={{ backgroundColor: '#eff6f1', minHeight: '100vh' }}>
          {renderMobileSidebar()}

          {/* ── Fixed Solid Normal Green Topbar (exact LTC mobile style) ── */}
          {!isMobileNavOpen && (
            <header 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: 'calc(44px + env(safe-area-inset-top))',
                zIndex: 999,
                background: '#047857',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 'env(safe-area-inset-top)',
                paddingLeft: '12px',
                paddingRight: '12px',
                boxSizing: 'border-box',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)'
              }}
            >
              {/* Left: hamburger + current tab title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  onClick={() => setIsMobileNavOpen(true)}
                  aria-label="Open Sidebar"
                  style={{ background: 'transparent', color: '#ffffff', border: 'none', padding: 0, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: '50%' }}
                >
                  <Menu size={20} />
                </button>
                <span style={{ color: '#ffffff', fontWeight: '700', fontSize: '13.5px', fontFamily: 'system-ui, -apple-system, sans-serif', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                  {activeTab === 'dashboard' ? 'Overview' :
                   activeTab === 'preparatory_checklist' ? 'Preparatory Checklist' :
                   activeTab === 'forms' ? 'RI Forms' :
                   activeTab === 'village' ? 'My Village' :
                   activeTab === 'panel' ? 'My Panel & Team' :
                   activeTab === 'media' ? 'Visit Media' :
                   activeTab === 'attendance' ? 'My Attendance' :
                   activeTab === 'schedule' ? 'RI Schedule' :
                   activeTab === 'undertaking' ? 'Undertaking Form' :
                   activeTab === 'things_to_carry' ? 'Things to Carry' :
                   activeTab === 'dos_donts' ? "Do's & Don'ts" :
                   activeTab === 'annexures' ? 'Official Annexures' :
                   activeTab === 'support' ? 'Support Tickets' :
                   activeTab === 'settings' ? 'Settings' : activeTab}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {hasLtc && (
                  <button
                    onClick={() => navigate('/student')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      background: '#047857',
                      border: '1px solid #065f46',
                      borderRadius: '8px',
                      padding: '5px 12px',
                      color: '#ffffff',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    title="Switch to LTC Student Portal"
                  >
                    <Compass size={12} color="#ffffff" />
                    <span>Switch to LTC →</span>
                  </button>
                )}
                <button 
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: 'rgba(239,68,68,0.2)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                  title="Logout"
                >
                  <LogOut size={12} />
                </button>
              </div>
            </header>
          )}

          <div style={{
            paddingTop: 'calc(54px + env(safe-area-inset-top))',
            paddingLeft: activeTab === 'forms' ? '8px' : '12px',
            paddingRight: activeTab === 'forms' ? '8px' : '12px',
            paddingBottom: 'calc(74px + env(safe-area-inset-bottom, 0px))',
            minHeight: '100vh',
            boxSizing: 'border-box'
          }}>
            {renderMainContent()}
          </div>

          {/* ── Sticky Mobile Bottom Navigation Bar ── */}
          {!isMobileNavOpen && (
            <nav style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: '60px',
              backgroundColor: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              zIndex: 1000,
              boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              boxSizing: 'border-box'
            }}>
              <button
                onClick={() => { setActiveTab('dashboard'); setIsMobileNavOpen(false); }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  height: '100%',
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'dashboard' ? '#047857' : '#64748b',
                  fontWeight: activeTab === 'dashboard' ? 750 : 500,
                  fontSize: '11px',
                  cursor: 'pointer',
                  gap: '3px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Home size={19} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
                <span>Overview</span>
              </button>

              <button
                onClick={() => { setActiveTab('forms'); setIsMobileNavOpen(false); }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  height: '100%',
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'forms' ? '#047857' : '#64748b',
                  fontWeight: activeTab === 'forms' ? 750 : 500,
                  fontSize: '11px',
                  cursor: 'pointer',
                  gap: '3px',
                  transition: 'all 0.15s ease'
                }}
              >
                <FileCheck size={19} strokeWidth={activeTab === 'forms' ? 2.5 : 2} />
                <span>Forms</span>
              </button>

              <button
                onClick={() => { setActiveTab('panel'); setIsMobileNavOpen(false); }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  height: '100%',
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'panel' ? '#047857' : '#64748b',
                  fontWeight: activeTab === 'panel' ? 750 : 500,
                  fontSize: '11px',
                  cursor: 'pointer',
                  gap: '3px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Users size={19} strokeWidth={activeTab === 'panel' ? 2.5 : 2} />
                <span>Team</span>
              </button>

              <button
                onClick={() => { setActiveTab('annexures'); setIsMobileNavOpen(false); }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  height: '100%',
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'annexures' ? '#047857' : '#64748b',
                  fontWeight: activeTab === 'annexures' ? 750 : 500,
                  fontSize: '11px',
                  cursor: 'pointer',
                  gap: '3px',
                  transition: 'all 0.15s ease'
                }}
              >
                <BookOpen size={19} strokeWidth={activeTab === 'annexures' ? 2.5 : 2} />
                <span>Annexures</span>
              </button>
            </nav>
          )}
        </div>
      )}

      {/* ── Undertaking Move to LTC Portal Modal ── */}
      {Boolean(profileData?.student?.id) && !isUndertakingSubmitted && isUndertakingModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: isMobile ? '14px' : '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsUndertakingModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: isMobile ? '16px' : '18px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              overflow: 'hidden',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            {/* Modal Header matching user's screenshot - seamlessly curves into outer card */}
            <div
              style={{
                backgroundColor: '#047857',
                padding: isMobile ? '14px 16px' : '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px' }}>
                <FileText size={isMobile ? 18 : 20} color="#ffffff" style={{ flexShrink: 0 }} />
                <h3
                  style={{
                    margin: 0,
                    fontSize: isMobile ? '15px' : '16.5px',
                    fontWeight: '700',
                    color: '#ffffff',
                    letterSpacing: '-0.2px',
                    lineHeight: 1.2
                  }}
                >
                  Student Undertaking Form
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUndertakingModalOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: isMobile ? '28px' : '30px',
                  height: isMobile ? '28px' : '30px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; }}
                aria-label="Close"
              >
                <X size={isMobile ? 14 : 16} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: isMobile ? '16px' : '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}>
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: isMobile ? '14px' : '16px 18px',
                  marginBottom: isMobile ? '16px' : '20px',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? '10px' : '12px' }}>
                  <div
                    style={{
                      width: isMobile ? '32px' : '36px',
                      height: isMobile ? '32px' : '36px',
                      borderRadius: '8px',
                      backgroundColor: '#ecfdf5',
                      color: '#047857',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}
                  >
                    <AlertCircle size={isMobile ? 18 : 20} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: isMobile ? '13.5px' : '14.5px',
                        fontWeight: '700',
                        color: '#0f172a',
                        lineHeight: 1.3
                      }}
                    >
                      LTC Portal Submission Required
                    </h4>
                    <p
                      style={{
                        margin: '6px 0 0 0',
                        fontSize: isMobile ? '12.5px' : '13px',
                        color: '#475569',
                        lineHeight: 1.5
                      }}
                    >
                      For submitting your <strong>Undertaking Form</strong>, please move to the <strong>LTC Portal</strong>.
                    </p>
                    <p
                      style={{
                        margin: '6px 0 0 0',
                        fontSize: isMobile ? '11.5px' : '12px',
                        color: '#64748b',
                        lineHeight: 1.45
                      }}
                    >
                      Your digital safety undertaking and emergency declarations are officially managed and verified through the LTC Student Portal.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: isMobile ? '8px' : '10px',
                  paddingTop: isMobile ? '12px' : '16px',
                  borderTop: '1px solid #f1f5f9',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsUndertakingModalOpen(false)}
                  style={{
                    padding: isMobile ? '9px 14px' : '9px 18px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: isMobile ? '12.5px' : '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    flex: isMobile ? '1' : 'none',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMoveToLtcPortal}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: isMobile ? '9px 14px' : '9px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#047857',
                    color: '#ffffff',
                    fontSize: isMobile ? '12.5px' : '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(4, 120, 87, 0.25)',
                    transition: 'all 0.15s ease',
                    flex: isMobile ? '1.4' : 'none',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#065f46'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#047857'; }}
                >
                  <span>Move to LTC Portal</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 99999,
            backgroundColor: toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#f59e0b' : '#15803d',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
      {/* ── Undertaking Completion Gate Explanatory Popup ── */}
      {Boolean(profileData?.student?.id) && !isUndertakingSubmitted && showGatePopup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99998,
            padding: isMobile ? '14px' : '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGatePopup(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: isMobile ? '16px' : '18px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              overflow: 'hidden',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            <div
              style={{
                backgroundColor: '#047857',
                padding: isMobile ? '14px 16px' : '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px' }}>
                <FileText size={isMobile ? 18 : 20} color="#ffffff" style={{ flexShrink: 0 }} />
                <h3
                  style={{
                    margin: 0,
                    fontSize: isMobile ? '15px' : '16.5px',
                    fontWeight: '700',
                    color: '#ffffff',
                    letterSpacing: '-0.2px',
                    lineHeight: 1.2
                  }}
                >
                  Undertaking Required
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGatePopup(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: isMobile ? '28px' : '30px',
                  height: isMobile ? '28px' : '30px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                aria-label="Close"
              >
                <X size={isMobile ? 14 : 16} />
              </button>
            </div>

            <div style={{ padding: isMobile ? '18px 16px' : '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#ecfdf5',
                  color: '#047857',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  <AlertCircle size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '13.5px', color: '#334155', lineHeight: 1.55, fontWeight: '500' }}>
                    {hasLtc
                      ? "Please complete your undertaking first to access both the RI and LTC Student Portals."
                      : "Please complete your undertaking first to access the Rural Immersion Student Portal."}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setShowGatePopup(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowGatePopup(false);
                    if (hasLtc) {
                      handleConfirmMoveToLtcPortal();
                    } else {
                      setActiveTab('undertaking');
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#047857',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(4, 120, 87, 0.25)'
                  }}
                >
                  <span>{hasLtc ? 'Complete LTC Undertaking' : 'Open Undertaking Form'}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── RI Forms Reminder Popup ── */}
      {showFormsReminder && formsReminderPending.length > 0 && (!showGatePopup || isUndertakingSubmitted) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: isMobile ? '14px' : '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFormsReminder(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: isMobile ? '16px' : '18px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              overflow: 'hidden',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                backgroundColor: isFormsDeadlineOverdue ? '#dc2626' : '#ea580c',
                padding: isMobile ? '14px 16px' : '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px' }}>
                {isFormsDeadlineOverdue ? (
                  <AlertCircle size={isMobile ? 18 : 20} color="#ffffff" style={{ flexShrink: 0 }} />
                ) : (
                  <Clock size={isMobile ? 18 : 20} color="#ffffff" style={{ flexShrink: 0 }} />
                )}
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: isMobile ? '15px' : '16.5px',
                      fontWeight: '700',
                      color: '#ffffff',
                      letterSpacing: '-0.2px',
                      lineHeight: 1.2
                    }}
                  >
                    {isFormsDeadlineOverdue ? 'RI Forms Submission Overdue' : 'RI Forms Submission Reminder'}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.9)', marginTop: '2px' }}>
                    {formsReminderPending.length} of 6 mandatory {formsReminderPending.length === 1 ? 'form' : 'forms'} incomplete
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormsReminder(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: isMobile ? '28px' : '30px',
                  height: isMobile ? '28px' : '30px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                aria-label="Close"
              >
                <X size={isMobile ? 14 : 16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              
              {/* Deadline & Warning Banner */}
              {isFormsDeadlineOverdue ? (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}
                >
                  <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#991b1b', lineHeight: 1.4 }}>
                      Your deadline has passed. Please complete your pending forms as soon as possible.
                    </div>
                    <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '4px', lineHeight: 1.4 }}>
                      The submission deadline was <strong>{formattedFormsDeadline}</strong>. Forms remain fully accessible for submission.
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <Clock size={18} color="#ea580c" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#9a3412', lineHeight: 1.4 }}>
                      Please complete all pending RI forms by <strong>{formattedFormsDeadline}</strong>.
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Forms List */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Pending Forms ({formsReminderPending.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {formsReminderPending.map((item, idx) => (
                    <div
                      key={item.type || idx}
                      onClick={() => {
                        setShowFormsReminder(false);
                        if (item.type === 'UNDERTAKING') {
                          handleOpenUndertaking();
                        } else {
                          setActiveTab('forms');
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      className="hover:bg-slate-100"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isFormsDeadlineOverdue ? '#ef4444' : '#f97316' }} />
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                          {item.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: isFormsDeadlineOverdue ? '#991b1b' : '#9a3412',
                          backgroundColor: isFormsDeadlineOverdue ? '#fee2e2' : '#ffedd5',
                          padding: '2px 8px',
                          borderRadius: '12px'
                        }}>
                          Incomplete
                        </span>
                        <ChevronRight size={14} color="#94a3b8" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setShowFormsReminder(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFormsReminder(false);
                    if (formsReminderPending.length === 1 && formsReminderPending[0].type === 'UNDERTAKING') {
                      handleOpenUndertaking();
                    } else {
                      setActiveTab('forms');
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isFormsDeadlineOverdue ? '#dc2626' : '#ea580c',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: isFormsDeadlineOverdue ? '0 2px 6px rgba(220, 38, 38, 0.25)' : '0 2px 6px rgba(234, 88, 12, 0.25)'
                  }}
                >
                  <span>Go to RI Forms</span>
                  <ArrowRight size={14} />
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
