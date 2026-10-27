import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from './context/LanguageContext'
import {
  Plus, Users, UploadCloud, GraduationCap, BookOpen, CheckCircle, CheckCircle2, Folder,
  AlertCircle, FileText, Search, LogOut, Menu, Trash2, ClipboardList,
  Lock, Unlock, Clock, X, Shield, RefreshCw, ChevronLeft, ChevronRight,
  Layers, BarChart2, Bell, User, Home, Activity, MapPin, Grid, Calendar,
  Compass, Award, Mail, ChevronDown, ChevronUp, HelpCircle, UserPlus, Landmark, Network, UserCheck,
  CheckSquare, MessageSquare, Flag, Film, Image, Video, Phone, Download, Eye,
  Globe, Check, History, Send, RotateCcw, AlertTriangle, Link as LinkIcon,
  Pause, Play, Square, PauseCircle, StopCircle, ExternalLink, Smartphone, Sparkles, Paperclip,
  Edit3, Save
} from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import html2pdf from 'html2pdf.js'
import { QRCodeSVG } from 'qrcode.react'
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode'
import ScrollToTop from './ScrollToTop'
import TimetablePanel from './TimetablePanel'
import { OFFICIAL_HIERARCHY, getCanonicalSchool, getCanonicalDepartment } from './admin/hierarchy'

import FacultyModule from './admin/FacultyModule'
import LtcMembersModule from './admin/LtcMembersModule'
import StudentsModule from './admin/StudentsModule'
import BatchManagementModule from './admin/BatchManagementModule'
import DocumentsModule from './admin/DocumentsModule'
import ReportsModule from './admin/ReportsModule'
import MiscellaneousModule from './admin/MiscellaneousModule'
import GlobalSearchModule from './admin/GlobalSearchModule'
import FeedbackTab from './admin/FeedbackTab'
import AiFormAnalysisTab from './admin/AiFormAnalysisTab'
import TicketsModule from './admin/TicketsModule'
import BulkUploadModule from './admin/BulkUploadModule'
import FacultyJourneyTab from './FacultyJourneyTab'
import WhatsappCampaignModule from './admin/WhatsappCampaignModule'
import { parseFeedbackForDisplay } from './utils/feedbackQuestions'
import { generateFailedEmailsPdf } from './utils/generateFailedEmailsPdf'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001'
const SQUAD_NAMES = ['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi']

// ─── Utility hooks ────────────────────────────────────────────────────────────
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((arg1, arg2 = 'info') => {
    let msg = arg1;
    let type = arg2;
    if (['error', 'success', 'warning', 'info'].includes(arg1) && typeof arg2 === 'string') {
      type = arg1;
      msg = arg2;
    }
    const id = `${Date.now()}_${Math.random()}`
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])
  return { toasts, toast }
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && <CheckCircle size={18} className="toast-icon" />}
          {t.type === 'error' && <AlertCircle size={18} className="toast-icon" />}
          {t.type === 'warning' && <AlertCircle size={18} className="toast-icon" />}
          <span style={{ fontSize: 14, fontWeight: 500 }}>{t.msg}</span>
        </div>
      ))}
    </div>
  )
}

const LTC_DESIGNATION_OPTIONS = [
  "Senior Director",
  "Director",
  "Senior Manager (Agri)",
  "Associate Director Academics",
  "Manager -Academics",
  "Manager -Operations",
  "Assit. Manager Agri.",
  "Senior Instructor Patriotism",
  "Back Office Executive",
  "Instructor Patriotism",
  "Security Supervisor",
  "Nursing staff",
  "Senior Instructor Yoga",
  "Instructor Yoga",
  "Senior Instructor Sports",
  "Squad Coordinator",
  "IT Engineer",
  "Agri-Supervisor",
  "Doctor",
  "Head Golf & Adventure",
  "Stores Executive"
];

// ─── Pagination ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 50
function usePagination(items) {
  const [page, setPage] = useState(1)

  const prevItemsRef = useRef(items)
  useEffect(() => {
    if (prevItemsRef.current !== items) {
      setPage(1)
      prevItemsRef.current = items
    }
  }, [items])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const paginated = useMemo(() => items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [items, safePage])
  const reset = useCallback(() => setPage(1), [])
  return { page: safePage, setPage, totalPages, paginated, total: items.length, reset }
}

function PaginationBar({ page, totalPages, total, setPage }) {
  if (totalPages <= 1) return null
  const start = (page - 1) * PAGE_SIZE + 1, end = Math.min(page * PAGE_SIZE, total)
  const nums = []; let lo = Math.max(1, page - 2), hi = Math.min(totalPages, page + 2)
  for (let i = lo; i <= hi; i++) nums.push(i)
  return (
    <div className="pagination">
      <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={13} /></button>
      {lo > 1 && <><button className="pagination-btn" onClick={() => setPage(1)}>1</button>{lo > 2 && <span style={{ color: 'var(--text-4)', padding: '0 4px' }}>…</span>}</>}
      {nums.map(n => <button key={n} className={`pagination-btn ${n === page ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>)}
      {hi < totalPages && <><span style={{ color: 'var(--text-4)', padding: '0 4px' }}>…</span><button className="pagination-btn" onClick={() => setPage(totalPages)}>{totalPages}</button></>}
      <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={13} /></button>
      <span className="pagination-info">Showing {start}–{end} of {total}</span>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, size = '', hideHeader = false, noPadding = false }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ? 'modal-' + size : ''}`} style={{ overflow: 'hidden' }}>
        {!hideHeader && (
          <div className="modal-header">
            <h3 className="modal-title">{title}</h3>
            <button className="btn-icon" onClick={onClose} style={{ border: 'none', padding: 4 }}><X size={18} /></button>
          </div>
        )}
        <div 
          className="modal-body" 
          style={{ 
            padding: noPadding ? '0' : (hideHeader ? '28px' : '20px 28px 28px')
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Label helper ─────────────────────────────────────────────────────────────
const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
    {children}
  </label>
)

const FormLabel = ({ label, required = false }) => (
  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>
    {label} {required && <span style={{ color: '#0f172a' }}>*</span>}
  </label>
)

// ─── LAP Journey Media Gallery Component ──────────────────────────────────────
function AdminJourneyTab({ token, API, toast, apiFetch }) {
  return <FacultyJourneyTab token={token} isAdmin={true} />
}




// ─── Admin FAQ Tab Component ────────────────────────────────────────
function AdminFaqTab() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const faqs = [
    {
      q: "Who will take care of my child during the program?",
      a: [
        t("Your child's safety, well-being, and overall development are our highest priorities."),
        t("Throughout the program, students will be under the continuous supervision of trained faculty members, instructors, wardens, coordinators, and support staff from the Life Transformation Centre (LTC)."),
        t("Every activity, meal, and residential arrangement is closely monitored. Separate accommodation is provided for boys and girls, and the campus has round-the-clock supervision and medical support, ensuring a safe, caring, and nurturing environment for every child.")
      ]
    },
    {
      q: "What is the student-to-faculty ratio?",
      a: [
        t("LTC maintains a 15:1 student-to-faculty ratio, ensuring that every group of 15 students is guided by a dedicated faculty member or warden."),
        t("This allows every child to receive individual attention, close supervision, and continuous guidance throughout the program.")
      ]
    },
    {
      q: "What should I do if my child has a medical condition, allergies, or requires regular medication?",
      a: [
        t("Parents are requested to provide complete medical information, including allergies, existing health conditions, dietary restrictions, and regular medications, during the registration process."),
        t("The LTC team will take the necessary precautions to ensure your child's health and comfort. Any prescribed medication should be handed over to the designated LTC staff with clear written instructions.")
      ]
    },
    {
      q: "What happens if my child falls ill or gets injured during the program?",
      a: [
        t("If a child becomes unwell or sustains an injury, immediate first aid will be provided by the LTC medical team."),
        t("The campus has a 24×7 First Aid Medical Clinic supported by a dedicated doctor and nurse. If additional medical care is required, the child will be taken to the nearest healthcare facility, and parents or guardians will be informed immediately."),
        t("A faculty member will remain with the child until the situation is fully resolved.")
      ]
    },
    {
      q: "How will parents be informed in case of an emergency?",
      a: [
        t("In any medical or other emergency, parents or guardians will be contacted immediately via telephone and WhatsApp using the emergency contact details provided during registration."),
        t("The LTC team will keep parents informed about the child's condition, the care being provided, and any further action required.")
      ]
    },
    {
      q: "Can I speak with my child during the program?",
      a: [
        t("Yes. Before the program begins, parents will receive the emergency contact numbers of the LTC team."),
        t("To help children fully engage in the program and develop confidence and independence, mobile phones are generally not permitted during program activities."),
        t("However, if there is an emergency or an important need, parents may contact the LTC team, who will promptly facilitate communication with their child.")
      ]
    },
    {
      q: "Are mobile phones allowed?",
      a: [
        t("Students are generally not permitted to use mobile phones during the residential program."),
        t("This encourages meaningful participation, stronger peer interaction, self-discipline, and a distraction-free learning environment. Mobile phones, if carried, will be safely collected and returned at the end of the program, as per LTC guidelines.")
      ]
    },
    {
      q: "What safety measures are in place?",
      a: [
        t("The safety of every participant is ensured through:"),
        {
          type: "list",
          items: [
            t("Dedicated faculty supervision (15:1 ratio)"),
            t("Trained instructors for all activities"),
            t("Safety briefing before every activity"),
            t("Separate accommodation for boys and girls"),
            t("24×7 residential supervision"),
            t("Safe transportation with faculty escorts"),
            t("Travel insurance for all participants"),
            t("24×7 First Aid Medical Clinic with a doctor and nurse"),
            t("Immediate emergency response and parent communication")
          ]
        },
        t("These measures ensure that every child enjoys a safe and secure residential experience.")
      ]
    },
    {
      q: "What should my child bring to the program?",
      a: [
        t("Parents will receive a detailed list of recommended items before the program begins."),
        t("Children are advised to carry comfortable clothing, sports shoes, personal toiletries, prescribed medicines (if any), a water bottle, and other essential personal items."),
        t("Expensive jewellery, electronic gadgets, valuables, and unnecessary cash should not be brought to the campus.")
      ]
    },
    {
      q: "What kind of food will be provided?",
      a: [
        t("Children will be served fresh, nutritious, and hygienically prepared vegetarian meals along with healthy snacks and drinking water throughout the program."),
        t("Parents should inform the LTC team in advance about any food allergies or medical dietary requirements.")
      ]
    },
    {
      q: "Where will the children stay?",
      a: [
        t("Students will stay in safe, clean, and comfortable residential accommodation within the LTC campus."),
        t("Separate accommodation is provided for boys and girls, with dedicated wardens and faculty members available round the clock to ensure their comfort and safety.")
      ]
    },
    {
      q: "Can a parent accompany their child?",
      a: [
        t("Yes. One parent may accompany the child by enrolling in the Parent Program, which runs separately alongside the children's program."),
        t("Parents will participate in dedicated sessions designed specifically for them while children attend the Life Awakening Program independently. Separate accommodation will be provided, and parents will not participate in or interfere with their child's daily activities, allowing every child to experience the full benefits of the residential program.")
      ]
    },
    {
      q: "Will my child be safe throughout the program?",
      a: [
        t("Absolutely. Every aspect of the program has been carefully designed with children's safety as the highest priority. From trained faculty and instructors to medical support, secure accommodation, supervised activities, emergency response systems, and regular communication with parents, every measure is in place to provide a safe, secure, and enriching experience."),
        t("Our goal is to ensure that every child returns home healthier, happier, more confident, and inspired.")
      ]
    }
  ];

  const matchesAnswer = (part, query) => {
    if (!part) return false;
    if (typeof part === 'string') {
      return part.toLowerCase().includes(query);
    }
    if (part.type === 'list' && Array.isArray(part.items)) {
      return part.items.some(item => typeof item === 'string' && item.toLowerCase().includes(query));
    }
    return false;
  };

  const filteredFaqs = searchQuery.trim() === ""
    ? faqs
    : faqs.filter(faq => {
        const qMatch = faq.q.toLowerCase().includes(searchQuery.toLowerCase());
        const aMatch = faq.a.some(part => matchesAnswer(part, searchQuery.toLowerCase()));
        return qMatch || aMatch;
      });

  const renderAnswer = (answerData) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {answerData.map((part, index) => {
          if (typeof part === 'string') {
            return <p key={index} style={{ margin: 0, lineHeight: '1.6' }}>{part}</p>;
          }
          if (part && part.type === 'list') {
            return (
              <ul key={index} style={{ 
                margin: '4px 0', 
                paddingLeft: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px',
                listStyleType: 'disc'
              }}>
                {part.items.map((item, itemIdx) => (
                  <li key={itemIdx} style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>{item}</li>
                ))}
              </ul>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div 
      style={{ 
        padding: '24px', 
        background: '#ffffff', 
        border: '1.5px solid #e2e8f0', 
        borderRadius: '20px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }} 
      className="animate-fade-in faq-tab-container"
    >
      <style>{`
        .faq-search-input:focus {
          border-color: #ea580c !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.12) !important;
        }
        @media (max-width: 640px) {
          .faq-tab-container {
            padding: 16px !important;
            border-radius: 16px !important;
          }
          .faq-item-button {
            padding: 14px 16px !important;
            font-size: 13.5px !important;
          }
          .faq-item-answer {
            padding: 12px 16px 16px 16px !important;
            font-size: 12.5px !important;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #ea580c, #c2410c)', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(234, 88, 12, 0.15)'
            }}>
              <HelpCircle size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '850', color: '#0f172a', margin: 0, letterSpacing: '-0.4px' }}>
                {t("FAQs Commonly Asked by Parents")}
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '3px 0 0 0' }}>
                {t("Life Awakening Program (School Education) — Supervision, Safety, Health, Meals & Stay Policies")}
              </p>
            </div>
          </div>
          <span style={{ padding: '4px 12px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '20px', fontSize: '12px', fontWeight: '750' }}>
            {faqs.length} {t("Questions")}
          </span>
        </div>
      </div>

      {/* Search Input Bar */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          type="text"
          placeholder={t("Search questions (e.g. safety, medical, food, mobile phones, accommodation)...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="faq-search-input"
          style={{
            width: '100%',
            padding: '12px 14px 12px 40px',
            borderRadius: '12px',
            border: '1.5px solid #e2e8f0',
            background: '#f8fafc',
            fontSize: '13.5px',
            color: '#0f172a',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'all 0.2s ease'
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>



      {/* Accordion List */}
      {filteredFaqs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', border: '1.5px dashed #e2e8f0', borderRadius: '16px' }}>
          <HelpCircle size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
          <p style={{ fontSize: '14px', margin: 0, fontWeight: 600 }}>{t("No matching questions found")}</p>
          <p style={{ fontSize: '12px', margin: '4px 0 0 0', color: '#94a3b8' }}>{t("Try typing different keywords or clear the search.")}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div 
                key={idx}
                style={{ 
                  border: '1.5px solid #e2e8f0', 
                  borderRadius: '16px', 
                  overflow: 'hidden', 
                  background: isOpen ? '#f8fafc' : '#ffffff', 
                  transition: 'all 0.15s ease-in-out' 
                }}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  style={{ 
                    width: '100%', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '16px 20px', 
                    background: 'none', 
                    border: 'none', 
                    textAlign: 'left', 
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: '14.5px',
                    color: '#0f172a',
                    outline: 'none',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}
                  className="faq-item-button"
                >
                  <span style={{ paddingRight: '12px' }}>{t(faq.q)}</span>
                  <ChevronDown size={18} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease', color: isOpen ? '#ea580c' : '#64748b', flexShrink: 0 }} />
                </button>
                
                <div 
                  style={{ 
                    maxHeight: isOpen ? '1000px' : '0', 
                    overflow: 'hidden', 
                    transition: 'max-height 0.25s ease-in-out', 
                    borderTop: isOpen ? '1px solid #e2e8f0' : 'none' 
                  }}
                >
                  <div style={{ padding: '16px 20px', fontSize: '13.5px', color: '#475569', lineHeight: '1.6' }} className="faq-item-answer">
                    {renderAnswer(faq.a)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Reusable Multi-Email Chip Input Component (for CC, BCC, etc.) ────────────
function EmailMultiInput({
  label,
  sublabel,
  value,
  onChange,
  placeholder = "Type email and press Enter, Comma, or Semicolon..."
}) {
  const [inputValue, setInputValue] = useState('');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const parseEmails = (str) => {
    if (!str || !str.trim()) return { valid: [], invalid: [] };
    const tokens = str.split(/[\s,;\t\r\n]+/).map(s => s.trim()).filter(Boolean);
    const validMap = new Map();
    const invalidSet = new Set();
    tokens.forEach(token => {
      if (emailRegex.test(token)) {
        const lower = token.toLowerCase();
        if (!validMap.has(lower)) {
          validMap.set(lower, token);
        }
      } else {
        invalidSet.add(token);
      }
    });
    return {
      valid: Array.from(validMap.values()),
      invalid: Array.from(invalidSet)
    };
  };

  const { valid, invalid } = parseEmails(value);

  const addEmailsFromText = (text) => {
    if (!text || !text.trim()) return;
    const tokens = text.split(/[\s,;\t\r\n]+/).map(s => s.trim()).filter(Boolean);
    if (tokens.length === 0) return;

    const currentValidMap = new Map();
    valid.forEach(e => currentValidMap.set(e.toLowerCase(), e));
    const currentInvalid = new Set(invalid);

    tokens.forEach(token => {
      if (emailRegex.test(token)) {
        const lower = token.toLowerCase();
        if (!currentValidMap.has(lower)) {
          currentValidMap.set(lower, token);
        }
        currentInvalid.delete(token);
      } else {
        currentInvalid.add(token);
      }
    });

    const newTokens = [...Array.from(currentValidMap.values()), ...Array.from(currentInvalid)];
    onChange(newTokens.join(', '));
    setInputValue('');
  };

  const removeEmail = (emailToRemove) => {
    const remainingValid = valid.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase());
    const remainingAll = [...remainingValid, ...invalid];
    onChange(remainingAll.join(', '));
  };

  const removeInvalid = (tokenToRemove) => {
    const remainingInvalid = invalid.filter(e => e !== tokenToRemove);
    const remainingAll = [...valid, ...remainingInvalid];
    onChange(remainingAll.join(', '));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault();
      addEmailsFromText(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && (valid.length > 0 || invalid.length > 0)) {
      if (invalid.length > 0) {
        removeInvalid(invalid[invalid.length - 1]);
      } else if (valid.length > 0) {
        removeEmail(valid[valid.length - 1]);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    if (pasted) {
      addEmailsFromText(pasted);
    }
  };

  const hasInvalid = invalid.length > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '4px' }}>
        <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0 }}>
          {label}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {sublabel && <span style={{ fontSize: '10.5px', color: '#64748b' }}>{sublabel}</span>}
          {valid.length > 0 && (
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px' }}>
              {valid.length} {valid.length === 1 ? 'Email' : 'Emails'}
            </span>
          )}
          {hasInvalid && (
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: '1px 6px', borderRadius: '4px' }}>
              {invalid.length} Invalid
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '6px 10px',
          borderRadius: '8px',
          border: hasInvalid ? '1px solid #ef4444' : '1px solid #cbd5e1',
          background: '#ffffff',
          minHeight: '42px',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}
      >
        {valid.map((email, idx) => (
          <span
            key={`val-${idx}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              padding: '2px 8px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            {email}
            <button
              type="button"
              onClick={() => removeEmail(email)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#3b82f6',
                cursor: 'pointer',
                fontSize: '13px',
                lineHeight: 1,
                padding: '0 2px',
                display: 'inline-flex',
                alignItems: 'center'
              }}
              className="hover:text-red-600"
            >
              &times;
            </button>
          </span>
        ))}

        {invalid.map((token, idx) => (
          <span
            key={`inv-${idx}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#fef2f2',
              border: '1px solid #f87171',
              color: '#991b1b',
              padding: '2px 8px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            {token}
            <button
              type="button"
              onClick={() => removeInvalid(token)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '13px',
                lineHeight: 1,
                padding: '0 2px',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              &times;
            </button>
          </span>
        ))}

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            if (inputValue.trim()) {
              addEmailsFromText(inputValue);
            }
          }}
          placeholder={valid.length === 0 && invalid.length === 0 ? placeholder : "Add another..."}
          style={{
            flex: '1',
            minWidth: '160px',
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: '12.5px',
            color: '#0f172a',
            padding: '4px 2px'
          }}
        />
      </div>

      {hasInvalid ? (
        <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600', marginTop: '4px', display: 'block' }}>
          Invalid email address format: {invalid.join(', ')}
        </span>
      ) : (
        <span style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px', display: 'block' }}>
          Separate multiple email addresses with commas, semicolons, Enter, or newlines.
        </span>
      )}
    </div>
  );
}

// ─── Admin Ticket Management Component ────────────────────────────────────────
function AdminTicketsTab({ token, API }) {
  return <TicketsModule token={token} API={API} />
}

// ─── Main AdminDashboard ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { t, currentLanguage, changeLanguage } = useLanguage()
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const currentUser = JSON.parse(localStorage.getItem('user') || 'null')
  const { toasts, toast } = useToast()

  const mainContentRef = useRef(null)
  const sidebarNavRef = useRef(null)

  // UI state
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024)
  const [isCollapsed, setIsCollapsed] = useState(localStorage.getItem('sidebar_collapsed') !== 'false')
  const [mobileSubTool, setMobileSubTool] = useState(null)
  const [mobilePeopleTab, setMobilePeopleTab] = useState('faculty')
  const [openBatchOnLoad, setOpenBatchOnLoad] = useState(null)
  const [isDashboardDropdownOpen, setIsDashboardDropdownOpen] = useState(true)
  const [isCommunicationDropdownOpen, setIsCommunicationDropdownOpen] = useState(true)
  const [isMobileLangOpen, setIsMobileLangOpen] = useState(false)

  // Auto-scroll dashboard container to top smoothly on tab switch
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [activeTab])

  const handleTabClick = (tab) => {
    const currentScroll = sidebarNavRef.current ? sidebarNavRef.current.scrollTop : 0;
    setActiveTab(tab);
    if (sidebarNavRef.current) {
      requestAnimationFrame(() => {
        if (sidebarNavRef.current) {
          sidebarNavRef.current.scrollTop = currentScroll;
        }
      });
    }
  };

  const handleDashboardParentClick = () => {
    const currentScroll = sidebarNavRef.current ? sidebarNavRef.current.scrollTop : 0;
    setIsDashboardDropdownOpen(prev => !prev);
    setActiveTab('dashboard');
    if (sidebarNavRef.current) {
      requestAnimationFrame(() => {
        if (sidebarNavRef.current) {
          sidebarNavRef.current.scrollTop = currentScroll;
        }
      });
    }
  };

  const handleCommunicationParentClick = () => {
    const currentScroll = sidebarNavRef.current ? sidebarNavRef.current.scrollTop : 0;
    setIsCommunicationDropdownOpen(prev => !prev);
    setActiveTab('orientation');
    if (sidebarNavRef.current) {
      requestAnimationFrame(() => {
        if (sidebarNavRef.current) {
          sidebarNavRef.current.scrollTop = currentScroll;
        }
      });
    }
  };

  const toggleSidebarCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sidebar_collapsed', String(newState))
  }

  // Data
  const [users, setUsers] = useState([])
  const [documents, setDocuments] = useState([])
  const [batches, setBatches] = useState([])
  const [recentActivities, setRecentActivities] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [evaluationRecords, setEvaluationRecords] = useState([])
  const [allFeedbacks, setAllFeedbacks] = useState([])
  const [dashboardStats, setDashboardStats] = useState(null)

  // Notification state
  const [dbNotifications, setDbNotifications] = useState([])
  const [dbUnreadCount, setDbUnreadCount] = useState(0)
  const [isNotifOpen, setIsNotifOpen] = useState(false)

  // Orientation Mailer state
  const ORIENTATION_TEMPLATES = {
    welcome: {
      name: 'Welcome Mail',
      useDefaultHeader: true,
      subject: 'Welcome to LAP - Batch {{batch_name}}',
      body: `Dear {{name}},

Welcome to the Life Awakening Program (LAP) as a {{role}}!

We are excited to welcome you to {{batch_name}} and be a part of your transformative journey towards personal growth, awareness, and excellence.

Program Details

* Batch Name: {{batch_name}}
* Squad: {{squad}}
* Start Date: {{start_date}}
* End Date: {{end_date}}

Portal Installation Guide

Please watch the installation video for your device before accessing the portal:

* Android Users: https://youtube.com/shorts/E1JWTgeaidA?si=NotUiH9RHAn0_x6r
* iPhone (iOS) Users: https://youtube.com/shorts/d4ou4uwonho?si=lM3RZIayS0-k42r5

Portal Credentials

* Login URL: {{login_url}}
* Email: {{email}}
* Password: {{password}}

Please log in to your dashboard to complete your profile, submit your undertaking form, and review the initial program guidelines.

Need Assistance?
For any login-related issues, kindly contact our support team at ltcmitwpu@gmail.com.

For personal information or profile-related queries, please raise a ticket through your dashboard for appropriate assistance.

Thank you for your cooperation.

Best regards,

LAP Administration`,
      defaultRoles: { student: true, faculty: true, ltc_member: false, parent: false },
      extraFields: [
        { key: 'start_date', label: 'Program Start Date', type: 'date', placeholder: 'Select start date', default: '' },
        { key: 'end_date', label: 'Program End Date', type: 'date', placeholder: 'Select end date', default: '' }
      ]
    },
    parent_welcome: {
      name: 'Parent Communication',
      useDefaultHeader: true,
      subject: 'Life Awakening Program (LAP) – Parent Communication – {{batch_name}}',
      body: `Dear Parents/Guardians,

Greetings from MIT World Peace University!

It gives us immense pleasure to welcome you and your ward to the Life Awakening Program (LAP) – {{batch_name}}, to be held from {{start_date}} to {{end_date}}, Academic Year 2026–27.

The Life Awakening Program is a unique experiential learning initiative designed to provide students with meaningful opportunities for self-discovery, personal growth, leadership, teamwork, discipline, social responsibility, and connection with nature and community life.

The Life Awakening Program follows the philosophy of "Connecting the Soul to the Soil" and integrates five important dimensions of holistic development:

• Agriculture & Nature
• Physical Fitness & Sports
• Team Building & Leadership
• Patriotism & Nation Building
• Spirituality & Peace

The programme is intended to take students beyond conventional classroom learning and provide them with experiences that encourage confidence, responsibility, resilience, empathy, and a deeper understanding of life and society.

Student Experiences – LAP Batch 1

Parents are encouraged to watch the following video to understand the experiences and reflections of students who participated in the Life Awakening Program:

LAP Batch No. 1 | Academic Year 2026–27 | Life Awakening Program | Student's Experiences & Reviews
https://www.youtube.com/watch?v=5bXD_Y22UJE

{{batch_name}} Parent Communication – WhatsApp Channel

For regular updates and important communication related to LAP {{batch_name}}, parents are requested to join the official WhatsApp Channel through the link below:

https://whatsapp.com/channel/0029Vb8MNBmFsn0p4z2Asd08

The channel will be used to share important programme-related updates, announcements, photographs, and other relevant information during the programme.

Emergency & Important Contact Numbers

For any urgent assistance during the programme, parents may contact the following LAP officials:

<table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; font-family:Arial, sans-serif; font-size:14px; border:1px solid #e2e8f0;">
  <tr style="background-color:#fff7ed; color:#c2410c;">
    <th>Sr. No.</th>
    <th>Name</th>
    <th>Designation</th>
    <th>Contact Number</th>
  </tr>
  <tr>
    <td>1</td>
    <td>Gaurav Karandikar</td>
    <td>Director</td>
    <td>9100735408</td>
  </tr>
  <tr>
    <td>2</td>
    <td>Kamal Dubey</td>
    <td>Operation Head</td>
    <td>9922891243</td>
  </tr>
  <tr>
    <td>3</td>
    <td>Nitin Sangale</td>
    <td>Academics Manager</td>
    <td>9309177426</td>
  </tr>
  <tr>
    <td>4</td>
    <td>Shardool Shirolkor</td>
    <td>Associate Director</td>
    <td>9879616220</td>
  </tr>
</table>

A Note to Parents

We understand that sending your ward for a residential experiential programme may naturally bring questions and concerns. Please be assured that the programme is planned and coordinated with due attention to student safety, discipline, wellbeing, accommodation, food, transportation, and overall supervision.

We request parents to encourage their wards to participate in all activities with an open mind, positive attitude, discipline, and enthusiasm. This programme is an opportunity for students to step outside their comfort zones, build meaningful relationships, discover their strengths, and create memories that will remain with them for years to come.

We sincerely appreciate your trust, cooperation, and support in making this transformative journey meaningful for your ward.

We look forward to welcoming LAP {{batch_name}} and wish all our students a safe, enriching, joyful, and transformative experience.

Warm Regards,
LAP Team
MIT World Peace University, Pune`,
      defaultRoles: { student: false, faculty: false, ltc_member: false, parent: true },
      extraFields: [
        { key: 'start_date', label: 'Program Start Date', type: 'date', placeholder: 'Select start date', default: '' },
        { key: 'end_date', label: 'Program End Date', type: 'date', placeholder: 'Select end date', default: '' }
      ]
    },
    orientation: {
      name: 'Orientation Details',
      subject: 'LAP Orientation Session Details – {{batch_name}}',
      body: `Dear {{name}},

Please note the schedule for the upcoming LAP Orientation Session for {{batch_name}}:

Date: {{orientation_date}}
⏰ Time: {{orientation_time}}
Venue: {{venue}}

Physical attendance is mandatory for all students and faculty members.

This orientation session will cover:
• Complete LAP schedule
• Program expectations
• Code of Conduct
• Important instructions
• Question & Answer session

We request you to arrive at the venue at least 5 minutes before the scheduled start time to ensure a smooth check-in process.

We look forward to welcoming you.

Best regards,

LAP Administration
Life Awakening Program`,
      defaultRoles: { student: true, faculty: true, ltc_member: false },
      extraFields: [
        { key: 'orientation_date', label: 'Orientation Date', type: 'date', placeholder: 'Select date', default: '' },
        { key: 'orientation_time', label: 'Orientation Time', type: 'time', placeholder: 'Select time', default: '' },
        { key: 'venue', label: 'Venue', type: 'text', placeholder: 'e.g. Swami Vivekanand Auditorium', default: 'Swami Vivekanand Auditorium' }
      ]
    },
    travel: {
      name: 'Travel Arrangements',
      subject: 'Travel Arrangements & LAP Schedule Details',
      body: `Dear {{name}},

Here are the travel arrangements and schedule details for your journey to the Life Awakening Program (LAP):

<strong>Departure Point:</strong> MIT WPU CAMPUS NEAR GLOBE<br/>
⏰ <strong>Departure Time:</strong> {{departure_time}}

<strong>Breakfast & Water Guidelines:</strong>

<strong>Breakfast Arrangement:</strong><br/>
Breakfast will be served at the departure venue before the journey begins. Kindly ensure that you arrive on time.

<strong>Water Bottle:</strong><br/>
Please carry your own water bottle with you for the journey.

<strong>Guidelines:</strong><br/>
Please visit the “Things to Carry & Guidelines” section on your dashboard and carefully read all the instructions provided before your journey.

<strong>Important Instruction:</strong>

• Please make sure that you sign both attendance sheets provided by your assigned faculty within the first 30 minutes of arrival. Your signature on both sheets is mandatory for attendance confirmation.

<strong>Panel-wise Faculty & Student Allocation Details:</strong>

<div style="overflow-x:auto; -webkit-overflow-scrolling:touch; margin:16px 0; border:1px solid #e2e8f0; border-radius:6px;">
<table role="presentation" border="1" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; font-size:11px; color:#000000; background-color:#ffffff; text-align:center; border:1px solid #cbd5e1; min-width:1050px; font-family:Arial,sans-serif;">

<thead>
<tr style="background-color:#fff7ed; color:#c2410c; font-weight:700;">
<th style="padding:10px 6px; border:1px solid #fed7aa;">PANEL</th>
<th style="padding:10px 6px; border:1px solid #fed7aa;">Faculty<br/>Coordinators</th>
<th style="padding:10px 6px; border:1px solid #fed7aa;">Class Teachers<br/>(Advance taken<br/>Faculty Name)</th>
<th style="padding:10px 6px; border:1px solid #fed7aa;">Name of Faculty 1</th>
<th style="padding:10px 6px; border:1px solid #fed7aa;">Name of Faculty<br/>2/Staff</th>
<th style="padding:10px 6px; border:1px solid #fed7aa;">Staff</th>
<th style="padding:10px 6px; border:1px solid #fed7aa;">Panel Wise<br/>Student Count</th>
<th style="padding:10px 6px; border:1px solid #fed7aa;">Boys<br/>Count</th>
<th style="padding:10px 6px; border:1px solid #fed7aa;">Girls<br/>Count</th>
<th style="padding:10px 6px; border:1px solid #fed7aa;">Village Name<br/>Address</th>
<th style="padding:10px 6px; border:1px solid #fed7aa;">Village Contact<br/>No</th>
</tr>

<tr style="background-color:#ea580c; color:#ffffff; font-weight:800;">
<td style="border:1px solid #c2410c;"></td>
<td style="border:1px solid #c2410c;"></td>
<td style="border:1px solid #c2410c; font-weight:800;">Batch 2</td>
<td style="border:1px solid #c2410c; font-weight:800;">12 August - 18 August</td>
<td style="border:1px solid #c2410c;"></td>
<td style="border:1px solid #c2410c;"></td>
<td style="border:1px solid #c2410c;"></td>
<td style="border:1px solid #c2410c;"></td>
<td style="border:1px solid #c2410c;"></td>
<td style="border:1px solid #c2410c;"></td>
<td style="border:1px solid #c2410c;"></td>
</tr>
</thead>

<tbody>

<tr>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">SY CSE<br/>Panel-A</td>
<td rowspan="6" style="padding:12px 8px;border:1px solid #e2e8f0;font-weight:700;text-align:center;vertical-align:middle;">Rashmi<br/>Warke,<br/>Nikhil<br/>Soniminde</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Reshma Sonar</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Sujata Jagdale</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Shounak Sugave</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Balasaheb Tekale</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">60</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">36</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">24</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Anjangaon</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;"></td>
</tr>

<tr>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">SY CSE<br/>Panel-B</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Shamla Mantri</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Praniti<br/>Waghodekar</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Shiv Sutar</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Madhura Khatale</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">58</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">42</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">16</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Barhanpur</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;"></td>
</tr>

<tr>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">SY CSE<br/>Panel-C</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Vidya Patil</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Santushti Betegeri</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Prashant Lahane</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Smita Sonkule</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">59</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">34</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">25</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Murti</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;"></td>
</tr>

<tr>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">SY CSE<br/>Panel-D</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Himangi Pande</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Yogini Mukherjee</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">K Susheel Kumar</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Amol Saraf</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">59</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">40</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">19</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Hanmantwadi</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;"></td>
</tr>

<tr>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">SY CSE<br/>Panel-E</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Seema Idhate</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Seema Idhate</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Pramod Mali</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Arundhati Patil</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">59</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">37</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">22</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Mudhale</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;"></td>
</tr>

<tr>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">SY CSF<br/>Panel-A</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Anushri Kulkarni</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Anuradha Nagare</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Vinayak Musale,<br/>Anushri Kulkarni</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Balaji Gutte</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">83</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">51</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">32</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;font-weight:700;">Karanje</td>
<td style="padding:8px 6px;border:1px solid #e2e8f0;"></td>
</tr>

</tbody>
</table>
</div>

Please ensure that you follow all the instructions and guidelines provided to make your journey smooth and organized.

Best regards,<br/>
<strong>LAP Administration</strong>`,
      defaultRoles: { student: true, faculty: true, ltc_member: false },
      extraFields: [
        { key: 'departure_time', label: 'Departure Time', type: 'time', placeholder: 'Select time', default: '' }
      ]
    },
    return_travel: {
      name: 'Return Travel & Dome Visit',
      subject: 'Return Travel Schedule & Dome Visit - Batch {{batch_name}}',
      body: 'Dear {{name}},\n\nAs we wrap up our LAP immersion, here is the schedule for our return journey and planned Dome visit:\n\nDate: {{return_date}}\nDeparture from LAP Campus: {{departure_from_ltc}}\nStopover: MIT Dome & Library Visit ({{dome_visit_time}})\nArrival back at MIT College: {{arrival_back_time}}\n\nPlease ensure your luggage is packed and labeled by 11:00 AM.\n\nBest regards,\nLAP Administration',
      defaultRoles: { student: true, faculty: true, ltc_member: false },
      extraFields: [
        { key: 'return_date', label: 'Return Date', placeholder: 'e.g. July 10th, 2026', default: 'July 10th, 2026' },
        { key: 'departure_from_ltc', label: 'Departure from LAP Campus', placeholder: 'e.g. 02:00 PM', default: '02:00 PM' },
        { key: 'dome_visit_time', label: 'Dome Visit Time', placeholder: 'e.g. 03:30 PM - 05:00 PM', default: '03:30 PM - 05:00 PM' },
        { key: 'arrival_back_time', label: 'Arrival Back Time', placeholder: 'e.g. 06:00 PM', default: '06:00 PM' }
      ]
    },
    completion: {
      name: 'Completion & Congratulations',
      subject: 'Congratulations on Completing the LAP Immersion! - Batch {{batch_name}}',
      body: 'Dear {{name}},\n\nCongratulations on successfully completing the Life Awakening Program (LAP) for Batch {{batch_name}}!\n\nYou have shown incredible dedication, active participation, and teamwork throughout this program. We hope the insights and practices you gained here will continue to guide your personal and professional growth.\n\nYour digital completion certificates are now available for download under the \'Documents\' tab on your dashboard.\n\nBest regards,\nLAP Administration',
      defaultRoles: { student: true, faculty: false, ltc_member: false },
      extraFields: []
    },
    pre_feedback_undertaking: {
      name: 'Pre Feedback & Undertaking Reminder',
      subject: 'Action Required: Complete Your Pre-Feedback Form & Undertaking',
      body: `Dear {{name}},

Please complete your Pre-Feedback Form and Undertaking from your Student Dashboard.

Deadline: {{deadline}}

Kindly ensure both are submitted before the deadline. These are mandatory requirements for participating in the Life Awakening Program (LAP). Students who have not completed both submissions will not be permitted to board the bus or participate in the Life Awakening Program.

Please complete them as early as possible to avoid any inconvenience.

Thank you.

Best Regards,
Life Awakening Program (LAP)
MIT World Peace University`,
      defaultRoles: { student: true, faculty: false, ltc_member: false },
      extraFields: [
        { key: 'deadline', label: 'Deadline', type: 'text', placeholder: 'e.g. 26 July, 11:55 PM', default: '26 July, 11:55 PM' }
      ]
    },
    ltc_day_welcome: {
      name: 'LAP Day Welcome',
      category: 'Student Communication',
      status: 'Active',
      useDefaultHeader: false,
      hideHeader: true,
      subject: 'Welcome to the Life Awakening Program (LAP)',
      body: `<div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid #ea580c; border-radius: 20px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.03); overflow: hidden; max-width: 600px; width: 100%; margin: 0 auto; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-sizing: border-box;">
  
  <div style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); background-color: #ea580c; padding: 36px 24px; text-align: center; color: #ffffff; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.2);">
    <div style="font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #ffedd5; margin-bottom: 6px;">
      MIT WORLD PEACE UNIVERSITY, PUNE
    </div>
    <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; text-transform: uppercase; line-height: 1.3;">
      LIFE AWAKENING PROGRAM (LAP)
    </h1>
    <div style="font-size: 13.5px; font-weight: 600; color: #fed7aa; letter-spacing: 0.3px;">
      Experiential Learning &amp; Transformation
    </div>
  </div>

  <div style="padding: 36px 32px 32px 32px; box-sizing: border-box;">
    
    <p style="font-size: 15.5px; font-weight: 700; color: #0f172a; margin: 0 0 18px 0; line-height: 1.5;">
      Dear {{name}},
    </p>

    <p style="font-size: 14.5px; color: #1e293b; margin: 0 0 18px 0; line-height: 1.75; font-weight: 400;">
      Congratulations on successfully completing the initial phase of your learning journey.
    </p>

    <p style="font-size: 14.5px; color: #1e293b; margin: 0 0 28px 0; line-height: 1.75; font-weight: 400;">
      As you begin the next phase of your journey at the Life Awakening Program (LAP), you are stepping into an experience that will inspire personal growth, strengthen your character, and broaden your perspective towards life.
    </p>

    <div style="margin: 28px 0; padding: 24px 20px; background-color: #ffffff; border: 1.5px solid #fed7aa; border-radius: 18px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03); text-align: left; box-sizing: border-box;">
      <h3 style="margin: 0 0 18px 0; font-size: 16px; font-weight: 800; color: #c2410c; letter-spacing: -0.2px;">
        Five Core Pillars
      </h3>
      
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 12px;">
        <tr>
          <td style="background-color: #F0FDF4; border: 2px solid #22C55E; border-radius: 14px; padding: 13px 18px; box-shadow: 0 2px 6px rgba(34, 197, 94, 0.06);">
            <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="width: 100%;">
              <tr>
                <td width="30" style="font-size: 17px; line-height: 1; vertical-align: middle;"></td>
                <td style="font-size: 14px; font-weight: 700; color: #15803D; vertical-align: middle;">Agriculture &amp; Nature</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 12px;">
        <tr>
          <td style="background-color: #FFFBEB; border: 2px solid #F59E0B; border-radius: 14px; padding: 13px 18px; box-shadow: 0 2px 6px rgba(245, 158, 11, 0.06);">
            <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="width: 100%;">
              <tr>
                <td width="30" style="font-size: 17px; line-height: 1; vertical-align: middle;"></td>
                <td style="font-size: 14px; font-weight: 700; color: #B45309; vertical-align: middle;">Physical Fitness &amp; Sports</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 12px;">
        <tr>
          <td style="background-color: #FFF7ED; border: 2px solid #EA580C; border-radius: 14px; padding: 13px 18px; box-shadow: 0 2px 6px rgba(234, 88, 12, 0.08);">
            <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="width: 100%;">
              <tr>
                <td width="30" style="font-size: 17px; line-height: 1; vertical-align: middle;"></td>
                <td style="font-size: 14px; font-weight: 700; color: #C2410C; vertical-align: middle;">Team Building &amp; Leadership</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 12px;">
        <tr>
          <td style="background-color: #FFF7ED; border: 2px solid #EA580C; border-radius: 14px; padding: 13px 18px; box-shadow: 0 2px 6px rgba(234, 88, 12, 0.06);">
            <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="width: 100%;">
              <tr>
                <td width="30" style="font-size: 17px; line-height: 1; vertical-align: middle;"></td>
                <td style="font-size: 14px; font-weight: 700; color: #C2410C; vertical-align: middle;">Patriotism &amp; Nation Building</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%;">
        <tr>
          <td style="background-color: #F5F3FF; border: 2px solid #7C3AED; border-radius: 14px; padding: 13px 18px; box-shadow: 0 2px 6px rgba(124, 58, 237, 0.06);">
            <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="width: 100%;">
              <tr>
                <td width="30" style="font-size: 17px; line-height: 1; vertical-align: middle;"></td>
                <td style="font-size: 14px; font-weight: 700; color: #6D28D9; vertical-align: middle;">Spirituality &amp; Inner Peace</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

    </div>

    <p style="font-size: 14.5px; color: #1e293b; margin: 28px 0 18px 0; line-height: 1.75; font-weight: 400;">
      These pillars are designed to help you discover your strengths, develop leadership qualities, build meaningful relationships, and cultivate values that will guide you throughout your life.
    </p>

    <p style="font-size: 14.5px; color: #1e293b; margin: 0 0 18px 0; line-height: 1.75; font-weight: 400;">
      We encourage you to participate wholeheartedly in every activity with enthusiasm, curiosity, and an open mind. Embrace every challenge, learn from every experience, and make the most of this unique opportunity. The memories you create and the lessons you learn here will stay with you long after this journey ends.
    </p>

    <p style="font-size: 14.5px; color: #1e293b; margin: 0 0 28px 0; line-height: 1.75; font-weight: 400;">
      On behalf of the entire Life Awakening Program Team, we warmly welcome you and wish you a meaningful, enriching, and truly transformative experience.
    </p>

    <div style="margin: 32px 0 28px 0; padding: 22px 28px; background-color: #FFF7ED; border: 1.5px solid #FED7AA; border-radius: 16px; text-align: center; box-sizing: border-box;">
      <div style="font-size: 36px; line-height: 1; color: #EA580C; font-family: Georgia, serif; font-weight: bold; margin-bottom: -10px;">“</div>
      <p style="margin: 0; font-size: 14.5px; font-weight: 700; color: #C2410C; line-height: 1.65; font-style: italic;">
        Welcome to the Life Awakening Program—where transformation begins within and leadership is nurtured through action.
      </p>
      <div style="font-size: 36px; line-height: 1; color: #EA580C; font-family: Georgia, serif; font-weight: bold; margin-top: -6px;">”</div>
    </div>

    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 14.5px; color: #1e293b; line-height: 1.6;">
      <p style="margin: 0 0 4px 0; font-weight: 500; color: #64748b;">Regards,</p>
      <p style="margin: 0; font-weight: 800; color: #0f172a; font-size: 15px;">Team LAP</p>
    </div>

  </div>
</div>`,
      defaultRoles: { student: true, faculty: false, ltc_member: false },
      extraFields: []
    },
    div1_coordinator: {
      name: 'Div-1 Coordinators',
      useDefaultHeader: true,
      subject: 'Schedule for Upcoming LTC + RI Batches – Academic Year 2026-2027',
      body: `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #000000;">

  <p>Dear Div. I Coordinators,</p>
  <p>Please find below the schedule for the upcoming LTC + RI batches for the Academic Year 2026-2027, commencing on 29th July 2026.</p>
  <p>Kindly note that your respective Deans have already received this notification from Dean Academics Sir.</p>
  <p>You are requested to verify the student count for your respective department against the figures below. If there is any discrepancy or change in the count, kindly inform us at the earliest.</p>
  <p>In the same regard, please note that the data collection format for both students and faculty members will be shared with you shortly. Once received, we request you to submit the data strictly in the given format. Kindly do not alter or rename any of the column headers under any circumstances, as this will cause errors when the data is upload to the LTC Management System Portal.</p>
  <p>Your cooperation in ensuring timely and accurate submission is appreciated.</p>
  <p>Regards,</p>

  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #000000;">
    <tr>
      <td colspan="3" align="center" style="border: 1px solid #000000; font-weight: bold; font-size: 15px;">Schedule &nbsp;- &nbsp;July 2026 - March 2027</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 1- 29 July 26 To 04 Aug 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 2 - 12 Aug 26 To 18 Aug 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 3 - 19 Aug 26 To 25 Aug 26</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">SOCSE-350</td>
      <td style="border: 1px solid #000000;">SOCSE-350</td>
      <td style="border: 1px solid #000000;">SOCSE-350</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 4 - 26 Aug 26 To 01 Sep 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 5-16 Sep26 To 22 Sep 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 6-23 Sep To 29 Sep 26</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">SOET -350</td>
      <td style="border: 1px solid #000000;">SOET -350</td>
      <td style="border: 1px solid #000000;">SOET -350</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">&nbsp;</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 7- 30 Sep 26 To 06 Oct 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 8- 07 Oct 26 To 13 Oct 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 9- 14 Oct 26 To 20 Oct 26</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">SOET+Pharmacy+SOLA</td>
      <td style="border: 1px solid #000000;">Law + SOEC</td>
      <td style="border: 1px solid #000000;">SOD - 294</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">62+46+117 =225</td>
      <td style="border: 1px solid #000000;">168+71 =239</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 10-21 Oct 26 To 27 Oct 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 11- 13 Jan 27 To 19 Jan 27</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 12- 20 Jan 27 To 26 Jan 27</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">SOB = 350</td>
      <td style="border: 1px solid #000000;">SOB = 350</td>
      <td style="border: 1px solid #000000;">SOB = 350</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">&nbsp;</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 13- 17 Feb 27 To 23 Feb 27</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 14- 24 Feb 27 To 02 Mar 27</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 15- 17 Mar 27 To 23 Mar 27</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">SOB + RSOL(UG)</td>
      <td style="border: 1px solid #000000;">RSOL - 240 (PG)</td>
      <td style="border: 1px solid #000000;">Reserved</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">140+205 = 345</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
    </tr>
  </table>

</div>`,
      defaultRoles: { student: false, faculty: true, ltc_member: false },
      recipients: 'ajit.deore@mitwpu.edu.in, himangi.neve@mitwpu.edu.in, vilas.kanthale@mitwpu.edu.in, mangesh.shendkar@mitwpu.edu.in, mrunal.salwadkar@mitwpu.edu.in, parul.jadhav@mitwpu.edu.in, rashmi.warke@mitwpu.edu.in, rasika.beohar@mitwpu.edu.in, pratiksha.khurpadekale@mitwpu.edu.in',
      extraFields: []
    },
    nodal_officer: {
      name: 'Nodal Officers',
      useDefaultHeader: true,
      subject: 'Schedule for Upcoming LTC + RI Batches – Academic Year 2026-2027',
      body: `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #000000;">

  <p>Dear Div. I Coordinators,</p>
  <p>Please find below the schedule for the upcoming LTC + RI batches for the Academic Year 2026-2027, commencing on 29th July 2026.</p>
  <p>Kindly note that your respective Deans have already received this notification from Dean Academics Sir.</p>
  <p>You are requested to verify the student count for your respective department against the figures below. If there is any discrepancy or change in the count, kindly inform us at the earliest.</p>
  <p>In the same regard, please note that the data collection format for both students and faculty members will be shared with you shortly. Once received, we request you to submit the data strictly in the given format. Kindly do not alter or rename any of the column headers under any circumstances, as this will cause errors when the data is upload to the LTC Management System Portal.</p>
  <p>Your cooperation in ensuring timely and accurate submission is appreciated.</p>
  <p>Regards,</p>

  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #000000;">
    <tr>
      <td colspan="3" align="center" style="border: 1px solid #000000; font-weight: bold; font-size: 15px;">Schedule &nbsp;- &nbsp;July 2026 - March 2027</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 1- 29 July 26 To 04 Aug 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 2 - 12 Aug 26 To 18 Aug 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 3 - 19 Aug 26 To 25 Aug 26</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">SOCSE-350</td>
      <td style="border: 1px solid #000000;">SOCSE-350</td>
      <td style="border: 1px solid #000000;">SOCSE-350</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 4 - 26 Aug 26 To 01 Sep 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 5-16 Sep26 To 22 Sep 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 6-23 Sep To 29 Sep 26</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">SOET -350</td>
      <td style="border: 1px solid #000000;">SOET -350</td>
      <td style="border: 1px solid #000000;">SOET -350</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">&nbsp;</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 7- 30 Sep 26 To 06 Oct 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 8- 07 Oct 26 To 13 Oct 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 9- 14 Oct 26 To 20 Oct 26</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">SOET+Pharmacy+SOLA</td>
      <td style="border: 1px solid #000000;">Law + SOEC</td>
      <td style="border: 1px solid #000000;">SOD - 294</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">62+46+117 =225</td>
      <td style="border: 1px solid #000000;">168+71 =239</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 10-21 Oct 26 To 27 Oct 26</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 11- 13 Jan 27 To 19 Jan 27</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 12- 20 Jan 27 To 26 Jan 27</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">SOB = 350</td>
      <td style="border: 1px solid #000000;">SOB = 350</td>
      <td style="border: 1px solid #000000;">SOB = 350</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">&nbsp;</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 13- 17 Feb 27 To 23 Feb 27</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 14- 24 Feb 27 To 02 Mar 27</td>
      <td style="border: 1px solid #000000; font-weight: bold;">Batch 15- 17 Mar 27 To 23 Mar 27</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">SOB + RSOL(UG)</td>
      <td style="border: 1px solid #000000;">RSOL - 240 (PG)</td>
      <td style="border: 1px solid #000000;">Reserved</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000;">140+205 = 345</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
      <td style="border: 1px solid #000000;">&nbsp;</td>
    </tr>
  </table>

</div>`,
      defaultRoles: { student: false, faculty: true, ltc_member: false },
      recipients: 'nodal.officer1@mitwpu.edu.in, nodal.officer2@mitwpu.edu.in',
      extraFields: []
    },
    faculty_data_collection: {
      name: 'Faculty Data Collection',
      category: 'Faculty Communication',
      useDefaultHeader: true,
      subject: 'Minutes of the Meeting (MoM) & Student Data Collection Instructions – LTC',
      body: `Dear Faculty Members,

Please find attached the Minutes of the Meeting (MoM) for your reference, along with the Google Form link for student data collection and the necessary instructions.

<div style="margin: 16px 0; padding: 14px 18px; background-color: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px;">
  <strong style="color: #166534; font-size: 13px;">Google Form Link:</strong><br/>
  <a href="{{google_form_link}}" target="_blank" rel="noopener noreferrer" style="color: #0f766e; font-weight: 700; text-decoration: underline; word-break: break-all; font-size: 13px;">{{google_form_link}}</a>
</div>

You are requested to kindly go through the MoM and the instructions carefully and complete the assigned data collection within the stipulated timeline.

IMPORTANT INSTRUCTIONS FOR DATA COLLECTION AND CONSOLIDATION

Kindly follow the below-mentioned process carefully:

1. Create a Copy of the Google Form
Please create a copy of the shared Google Form and clearly mention your respective Panel Name in the title of the copied form.

2. Publish and Share the Form
After creating the copy, kindly publish the form and share the generated link with all concerned students of your respective class/panel. Please ensure that the form link is circulated promptly and that all students submit their responses within the stipulated timeline.

3. Verify the Response Count
Once the responses are received, kindly verify the total response count against the expected student strength of your respective class/panel. Please ensure that all expected students have submitted their responses before downloading the response sheet.

4. Download and Update the Master Sheet
After verifying the response count, download the response sheet and update the complete and verified data in the Master Sheet shared by the LTC Management System Portal Team.

The consolidated data will subsequently be used for uploading the required student information into the LTC Management System Portal.

5. Data Verification – Mandatory Checks
Before submitting the final data, kindly ensure that:
• The response count is verified against the actual/expected student strength.
• All expected students have submitted the Google Form.
• The data is complete, accurate, and properly verified.
• The prescribed format and column names of the Master Sheet are not altered.
• Any missing, incomplete, duplicate, or incorrect information is identified and rectified promptly.
• The final data is thoroughly checked before submission to avoid errors during portal uploading.

Timeline for Completion

<div style="margin: 14px 0 16px 0; padding: 12px 16px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; font-weight: 600; color: #92400e;">
  All concerned faculty members are requested to complete the required data collection and update the Master Sheet by {{date}}
</div>

The Master Sheet will be shared with the Nodal Officers or Department Coordinators only for the consolidation of the final data. Kindly ensure that the assigned task is completed by the Nodal Officers accurately and within the stipulated timeline.

<div style="margin: 20px 0; padding: 16px 18px; background-color: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 10px; color: #9f1239; line-height: 1.6;">
  <p style="margin: 0 0 10px 0; font-weight: 800;">Important: Separate Google Forms must be created for each individual panel. Although this document/template contains details of multiple panels, each Google Form should contain data for only one panel.</p>
  <p style="margin: 0 0 10px 0;">For example, SYBBA-A should have one dedicated Google Form with a unique link, and the same process should be followed for every other panel. Separate links must be created for each panel to avoid the merging or mixing of data between different panels and to ensure accurate data consolidation.</p>
  <p style="margin: 0 0 10px 0;">The Nodal Officers are requested to use this document as a template/reference and create separate Google Forms and links for their respective panels.</p>
  <p style="margin: 0; font-weight: 700;">Your cooperation and timely completion of the above process are essential to ensure accurate data consolidation and smooth, error-free uploading of student information into the LTC Management System Portal.</p>
</div>

Thank you for your continued support and cooperation.

Regards,
LTC TEAM
MIT World Peace University, Pune`,
      defaultRoles: { student: false, faculty: true, ltc_member: false, parent: false },
      extraFields: [
        { key: 'date', label: 'Completion Date / Timeline', type: 'text', placeholder: 'e.g. 15 August 2026, 5:00 PM', default: '15 August 2026, 5:00 PM' },
        { key: 'google_form_link', label: 'Google Form Link', type: 'text', placeholder: 'Google Form URL', default: 'https://docs.google.com/forms/d/1bKFvzf-sAROZJYV73c0FLGIRd3P6R3jjTsRMx6G4x-c/preview' }
      ]
    }
  }

  const [orientationBatchId, setOrientationBatchId] = useState('')
  const [orientationSubject, setOrientationSubject] = useState('')
  const [orientationBody, setOrientationBody] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('welcome')
  const [facultyDataCollectionEmails, setFacultyDataCollectionEmails] = useState('')
  const [recipientRoles, setRecipientRoles] = useState({ student: true, faculty: true, ltc_member: false, parent: false })
  const [extraFieldValues, setExtraFieldValues] = useState({})
  const [isTemplateDirty, setIsTemplateDirty] = useState(false)
  const [isSendingOrientation, setIsSendingOrientation] = useState(false)
  const [customTemplates, setCustomTemplates] = useState({})
  const [isCustomizingTemplate, setIsCustomizingTemplate] = useState(false)
  const [isSavingCustomTemplate, setIsSavingCustomTemplate] = useState(false)
  const [isRestoringDefault, setIsRestoringDefault] = useState(false)
  const [orientationBodyCursor, setOrientationBodyCursor] = useState(null)
  const [orientationRecipients, setOrientationRecipients] = useState([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [previewRecipientRole, setPreviewRecipientRole] = useState('student')
  const [missingParentPanelFilter, setMissingParentPanelFilter] = useState('ALL')
  const [previewSearchText, setPreviewSearchText] = useState('')
  const [previewParentFilter, setPreviewParentFilter] = useState('ALL')
  const [previewCurrentPage, setPreviewCurrentPage] = useState(1)
  const [previewPageSize, setPreviewPageSize] = useState(20)

  useEffect(() => {
    setPreviewCurrentPage(1);
  }, [orientationBatchId, recipientRoles, previewSearchText, previewParentFilter, missingParentPanelFilter, previewPageSize]);

  // Mailbox Channel State (email / whatsapp)
  const [mailboxChannel, setMailboxChannel] = useState('email')

  // Manual Email Sender State
  const [manualTemplateKey, setManualTemplateKey] = useState('welcome')
  const [manualRecipientEmail, setManualRecipientEmail] = useState('')
  const [manualPreviewRole, setManualPreviewRole] = useState('student')
  const [manualSubject, setManualSubject] = useState('')
  const [manualBody, setManualBody] = useState('')
  const [manualExtraFieldValues, setManualExtraFieldValues] = useState({})
  const [isSendingManualEmail, setIsSendingManualEmail] = useState(false)

  // CC, BCC, and Attachments for Bulk Email Sender
  const [orientationCc, setOrientationCc] = useState('')
  const [orientationBcc, setOrientationBcc] = useState('')
  const [showOrientationCcBcc, setShowOrientationCcBcc] = useState(false)
  const [orientationAttachments, setOrientationAttachments] = useState([])

  // CC, BCC, and Attachments for Manual Email Sender
  const [manualCc, setManualCc] = useState('')
  const [manualBcc, setManualBcc] = useState('')
  const [showManualCcBcc, setShowManualCcBcc] = useState(false)
  const [manualAttachments, setManualAttachments] = useState([])

  const formatAttachmentSize = (bytes) => {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleAttachmentUpload = (e, target = 'manual') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit per file
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xlsx', '.xls', '.xlsl', '.csv', '.png', '.jpg', '.jpeg', '.webp'];

    files.forEach((file) => {
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        toast(`File format "${ext}" is not supported. Please upload PDF, Word (DOC, DOCX), Excel (XLSX, XLS), CSV, or images.`, 'error');
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast(`"${file.name}" exceeds the maximum allowed size of 15MB.`, 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const base64Data = loadEvt.target.result;
        let detectedType = file.type;
        if (!detectedType || detectedType === 'application/octet-stream') {
          if (ext === '.csv') detectedType = 'text/csv';
          else if (ext === '.xlsx' || ext === '.xlsl') detectedType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          else if (ext === '.xls') detectedType = 'application/vnd.ms-excel';
          else if (ext === '.pdf') detectedType = 'application/pdf';
          else if (ext === '.doc') detectedType = 'application/msword';
          else if (ext === '.docx') detectedType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else detectedType = 'application/octet-stream';
        }

        const newAttachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          filename: file.name,
          name: file.name,
          size: file.size,
          type: detectedType,
          source: 'Uploaded File',
          content: base64Data
        };

        if (target === 'bulk') {
          setOrientationAttachments((prev) => [...prev, newAttachment]);
        } else {
          setManualAttachments((prev) => [...prev, newAttachment]);
        }
      };

      reader.onerror = () => {
        toast(`Failed to read file "${file.name}".`, 'error');
      };

      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemoveAttachment = (attId, target = 'manual') => {
    if (target === 'bulk') {
      setOrientationAttachments((prev) => prev.filter((a) => a.id !== attId));
    } else {
      setManualAttachments((prev) => prev.filter((a) => a.id !== attId));
    }
  };

  const parseEmailList = useCallback((str) => {
    if (!str || !str.trim()) return { valid: [], invalid: [], totalCount: 0, duplicateCount: 0 };
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const tokens = str.split(/[\s,;\t\r\n]+/).map(s => s.trim()).filter(Boolean);
    
    const validMap = new Map();
    const invalidSet = new Set();
    let totalTokens = 0;
    
    tokens.forEach(token => {
      totalTokens++;
      if (emailRegex.test(token)) {
        const lower = token.toLowerCase();
        if (!validMap.has(lower)) {
          validMap.set(lower, token);
        }
      } else {
        invalidSet.add(token);
      }
    });

    const valid = Array.from(validMap.values());
    const invalid = Array.from(invalidSet);
    const duplicateCount = Math.max(0, totalTokens - valid.length - invalid.length);

    return {
      valid,
      invalid,
      totalCount: totalTokens,
      duplicateCount
    };
  }, []);

  const parseManualEmails = parseEmailList;

  const parsedManualEmails = useMemo(() => {
    return parseManualEmails(manualRecipientEmail);
  }, [manualRecipientEmail, parseManualEmails]);

  // Email Logs State
  const [emailLogs, setEmailLogs] = useState([])
  const [emailQueueEntries, setEmailQueueEntries] = useState([])
  const [emailLogsViewTab, setEmailLogsViewTab] = useState('queue') // 'queue' or 'audit'
  const [emailLogsStats, setEmailLogsStats] = useState({ total_all: 0, total_delivered: 0, total_sent: 0, total_bounced: 0, total_failed: 0, total_pending: 0, total_processing: 0, total_paused: 0, total_stopped: 0 })
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false)
  const [emailLogsSearch, setEmailLogsSearch] = useState('')
  const [emailLogsFilterAction, setEmailLogsFilterAction] = useState('all')
  const [emailLogsStatusFilter, setEmailLogsStatusFilter] = useState('all')
  const [emailLogsDateFilter, setEmailLogsDateFilter] = useState('all')
  const [emailLogsPage, setEmailLogsPage] = useState(1)
  const [emailLogsPageSize, setEmailLogsPageSize] = useState(10)
  const [isQueueActionLoading, setIsQueueActionLoading] = useState(false)
  const [queueActionType, setQueueActionType] = useState(null)
  const [retryingEmailId, setRetryingEmailId] = useState(null)

  const [isLiveSyncActive, setIsLiveSyncActive] = useState(true)
  const [lastEmailLogsUpdated, setLastEmailLogsUpdated] = useState(null)
  const [liveConnectionStatus, setLiveConnectionStatus] = useState('online')
  const [consecutiveSyncFailures, setConsecutiveSyncFailures] = useState(0)

  // WhatsApp Logs State
  const [whatsappLogs, setWhatsappLogs] = useState([])
  const [whatsappLogsStats, setWhatsappLogsStats] = useState({ total_all: 0, total_sent: 0, total_pending: 0, total_failed: 0, total_paused: 0, total_stopped: 0 })
  const [loadingWhatsappLogs, setLoadingWhatsappLogs] = useState(false)
  const [whatsappLogsSearch, setWhatsappLogsSearch] = useState('')
  const [whatsappLogsFilterAction, setWhatsappLogsFilterAction] = useState('all')
  const [whatsappLogsStatusFilter, setWhatsappLogsStatusFilter] = useState('all')
  const [whatsappLogsDateFilter, setWhatsappLogsDateFilter] = useState('all')
  const [whatsappLogsPage, setWhatsappLogsPage] = useState(1)
  const [whatsappLogsPageSize, setWhatsappLogsPageSize] = useState(10)
  const [isWhatsappQueueActionLoading, setIsWhatsappQueueActionLoading] = useState(false)
  const [whatsappQueueActionType, setWhatsappQueueActionType] = useState(null)
  const [retryingWhatsappLogId, setRetryingWhatsappLogId] = useState(null)

  useEffect(() => {
    setEmailLogsPage(1);
  }, [emailLogsSearch, emailLogsFilterAction, emailLogsStatusFilter, emailLogsDateFilter, emailLogsPageSize, emailLogsViewTab]);

  useEffect(() => {
    setWhatsappLogsPage(1);
  }, [whatsappLogsSearch, whatsappLogsFilterAction, whatsappLogsStatusFilter, whatsappLogsDateFilter, whatsappLogsPageSize]);

  const fetchEmailLogs = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoadingEmailLogs(true)
    }
    try {
      const res = await fetch(`${API}/api/admin/email-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setEmailLogs(data.logs || [])
        setEmailQueueEntries(data.queueEntries || [])
        setEmailLogsStats(data.stats || { total_all: 0, total_delivered: 0, total_sent: 0, total_bounced: 0, total_failed: 0, total_pending: 0, total_processing: 0, total_paused: 0, total_stopped: 0 })
        setLastEmailLogsUpdated(new Date())
        setConsecutiveSyncFailures(0)
        setLiveConnectionStatus('online')
      } else {
        setConsecutiveSyncFailures(prev => {
          const next = prev + 1;
          setLiveConnectionStatus(next >= 2 ? 'offline' : 'reconnecting');
          return next;
        });
      }
    } catch (err) {
      console.error('Error fetching email logs:', err)
      setConsecutiveSyncFailures(prev => {
        const next = prev + 1;
        setLiveConnectionStatus(next >= 2 ? 'offline' : 'reconnecting');
        return next;
      });
    } finally {
      if (!isBackground) {
        setLoadingEmailLogs(false)
      }
    }
  }, [token])

  const fetchWhatsappLogs = useCallback(async () => {
    setLoadingWhatsappLogs(true)
    try {
      const res = await fetch(`${API}/api/admin/whatsapp-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setWhatsappLogs(data.logs || [])
        setWhatsappLogsStats(data.stats || { total_all: 0, total_sent: 0, total_pending: 0, total_failed: 0, total_paused: 0, total_stopped: 0 })
      }
    } catch (err) {
      console.error('Error fetching WhatsApp logs:', err)
    } finally {
      setLoadingWhatsappLogs(false)
    }
  }, [token])

  const [retryingLogId, setRetryingLogId] = useState(null)
  const [generatingFailedEmailsPdf, setGeneratingFailedEmailsPdf] = useState(false)

  const getFailedEmailRecords = useCallback(() => {
    const isFailedOrSuppressed = (entry) => {
      const status = (entry.status || 'pending').toLowerCase();
      const providerStatus = (entry.provider_status || '').toUpperCase();
      return ['failed', 'permanent_fail', 'bounced', 'rejected', 'undeliverable', 'suppressed'].includes(status) ||
             ['SUPPRESSED', 'BOUNCED', 'REJECTED', 'FAILED', 'UNDELIVERABLE', 'COMPLAINED'].includes(providerStatus);
    };

    return emailQueueEntries.filter(entry => {
      if (!isFailedOrSuppressed(entry)) return false;

      if (emailLogsDateFilter !== 'all') {
        const logDate = new Date(entry.created_at || entry.updated_at);
        const now = new Date();
        if (emailLogsDateFilter === 'today') {
          if (logDate.toDateString() !== now.toDateString()) return false;
        } else if (emailLogsDateFilter === '7days') {
          const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (logDate < past7) return false;
        } else if (emailLogsDateFilter === '30days') {
          const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (logDate < past30) return false;
        }
      }

      if (emailLogsSearch.trim()) {
        const q = emailLogsSearch.toLowerCase();
        const match = (
          (entry.to_email || '').toLowerCase().includes(q) ||
          (entry.recipient_name || '').toLowerCase().includes(q) ||
          (entry.recipient_prn || '').toLowerCase().includes(q) ||
          (entry.recipient_department || '').toLowerCase().includes(q) ||
          (entry.recipient_panel || '').toLowerCase().includes(q) ||
          (entry.recipient_phone || '').toLowerCase().includes(q) ||
          (entry.subject || '').toLowerCase().includes(q) ||
          (entry.batch_name || '').toLowerCase().includes(q) ||
          (entry.resend_id || '').toLowerCase().includes(q) ||
          (entry.provider_status || '').toLowerCase().includes(q) ||
          (entry.bounce_reason || entry.error_message || '').toLowerCase().includes(q)
        );
        if (!match) return false;
      }

      return true;
    });
  }, [emailQueueEntries, emailLogsDateFilter, emailLogsSearch]);

  const handleExportFailedEmailsExcel = () => {
    const failedList = getFailedEmailRecords();

    if (failedList.length === 0) {
      toast('No failed or suppressed emails found to export.', 'info');
      return;
    }

    const columns = ['Sr. No.', 'Name', 'PRN', 'Email', 'Department', 'Panel', 'Mobile Number'];
    const wsData = [
      ['FAILED & SUPPRESSED EMAILS AUDIT REPORT'],
      [`• Generated Date: ${new Date().toLocaleString()}`],
      [`• Total Failed/Suppressed Records: ${failedList.length}`],
      [],
      columns
    ];

    failedList.forEach((entry, idx) => {
      wsData.push([
        idx + 1,
        entry.recipient_name || '—',
        entry.recipient_prn || '—',
        entry.to_email || '—',
        entry.recipient_department || '—',
        entry.recipient_panel || '—',
        entry.recipient_phone || '—'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 8 },  // Sr. No.
      { wch: 28 }, // Name
      { wch: 18 }, // PRN
      { wch: 32 }, // Email
      { wch: 24 }, // Department
      { wch: 14 }, // Panel
      { wch: 18 }  // Mobile Number
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Failed_Emails');
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Failed_Emails_Report_${timestamp}.xlsx`);
    toast(`Failed emails Excel exported successfully! (${failedList.length} records)`, 'success');
  };

  const handleExportFailedEmailsPdf = async () => {
    const failedList = getFailedEmailRecords();

    if (failedList.length === 0) {
      toast('No failed or suppressed emails found to export.', 'info');
      return;
    }

    try {
      setGeneratingFailedEmailsPdf(true);
      const pdfBytes = await generateFailedEmailsPdf({ failedList });
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Failed_Emails_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast(`Failed emails PDF downloaded successfully! (${failedList.length} records)`, 'success');
    } catch (err) {
      console.error('Failed emails PDF generation error:', err);
      toast('Failed to generate PDF report', 'error');
    } finally {
      setGeneratingFailedEmailsPdf(false);
    }
  };

  const handleQueueAction = async (actionType) => {
    const actionLabels = {
      retry: 'Retry All Failed Emails',
      pause: 'Pause Pending Email Queue',
      resume: 'Resume Paused Email Queue',
      stop: 'Stop Active Email Queue',
      clear: 'Reset Email Statistics & Clear Queue'
    };

    if (actionType !== 'retry') {
      const confirmMsg = actionType === 'clear'
        ? `Are you sure you want to reset all email statistics and clear the queue?\n\nThis will zero out all counters so you can perform a new bulk email upload without confusion.`
        : `Are you sure you want to ${actionLabels[actionType].toLowerCase()}?\n\nThis will update the email dispatch queue status immediately.`;
      if (!window.confirm(confirmMsg)) return;
    }

    setIsQueueActionLoading(true);
    setQueueActionType(actionType);
    try {
      const res = await fetch(`${API}/api/admin/email-queue/${actionType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        toast('success', data.message || `Queue action executed successfully.`);
        await fetchEmailLogs();
      } else {
        toast('error', data.message || `Failed to execute queue action.`);
      }
    } catch (err) {
      toast('error', `Server communication error.`);
    } finally {
      setIsQueueActionLoading(false);
      setQueueActionType(null);
    }
  };

  const handleRetrySingleEmail = async (logId, recipientEmail) => {
    setRetryingLogId(logId);
    setRetryingEmailId(logId);
    try {
      const res = await fetch(`${API}/api/admin/email-queue/retry/${logId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        toast('success', data.message || `Re-queued email for ${recipientEmail || 'recipient'} for retry.`);
        await fetchEmailLogs();
      } else {
        toast('error', data.message || `Failed to retry email.`);
      }
    } catch (err) {
      toast('error', `Server communication error while retrying email.`);
    } finally {
      setRetryingLogId(null);
      setRetryingEmailId(null);
    }
  };

  const handleWhatsappQueueAction = async (actionType) => {
    const actionLabels = {
      retry: 'Retry All Failed WhatsApp Messages',
      pause: 'Pause Pending WhatsApp Queue',
      resume: 'Resume Paused WhatsApp Queue',
      stop: 'Stop Active WhatsApp Queue'
    };

    if (actionType !== 'retry') {
      const confirmMsg = `Are you sure you want to ${actionLabels[actionType].toLowerCase()}?\n\nThis will update the WhatsApp dispatch queue status immediately.`;
      if (!window.confirm(confirmMsg)) return;
    }

    setIsWhatsappQueueActionLoading(true);
    setWhatsappQueueActionType(actionType);
    try {
      const res = await fetch(`${API}/api/admin/whatsapp-queue/${actionType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        toast('success', data.message || `Queue action executed successfully.`);
        await fetchWhatsappLogs();
      } else {
        toast('error', data.message || `Failed to execute queue action.`);
      }
    } catch (err) {
      toast('error', `Server communication error.`);
    } finally {
      setIsWhatsappQueueActionLoading(false);
      setWhatsappQueueActionType(null);
    }
  };

  const handleRetrySingleWhatsapp = async (logId, recipientPhone) => {
    setRetryingWhatsappLogId(logId);
    try {
      const res = await fetch(`${API}/api/admin/whatsapp-queue/retry/${logId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        toast('success', data.message || `Re-queued WhatsApp message for ${recipientPhone || 'recipient'} for retry.`);
        await fetchWhatsappLogs();
      } else {
        toast('error', data.message || `Failed to retry WhatsApp message.`);
      }
    } catch (err) {
      toast('error', `Server communication error while retrying WhatsApp message.`);
    } finally {
      setRetryingWhatsappLogId(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'email_logs' || activeTab === 'orientation') {
      fetchEmailLogs(false)
    }
    if (activeTab === 'whatsapp_logs' || activeTab === 'orientation') {
      fetchWhatsappLogs()
    }
  }, [activeTab, fetchEmailLogs, fetchWhatsappLogs])

  // Real-time background sync polling (3s when emails are actively sending/pending, 10s when idle)
  useEffect(() => {
    if (activeTab !== 'email_logs' && activeTab !== 'orientation') {
      return;
    }
    const hasActiveQueue = (emailLogsStats.total_pending || 0) > 0 || (emailLogsStats.total_sent || 0) > 0;
    const pollRateMs = hasActiveQueue ? 3000 : 10000;

    const intervalId = setInterval(() => {
      fetchEmailLogs(true);
    }, pollRateMs);

    return () => clearInterval(intervalId);
  }, [activeTab, fetchEmailLogs, emailLogsStats.total_pending, emailLogsStats.total_sent]);

  // Search
  const [facultySearch, setFacultySearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedDivision, setSelectedDivision] = useState('')
  const [selectedFaculty, setSelectedFaculty] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedPanel, setSelectedPanel] = useState('')
  const [facultyDivFilter, setFacultyDivFilter] = useState('')
  const [facultyFacFilter, setFacultyFacFilter] = useState('')
  const [facultySchoolFilter, setFacultySchoolFilter] = useState('')
  const [facultyDeptFilter, setFacultyDeptFilter] = useState('')
  const [facultyTypeFilter, setFacultyTypeFilter] = useState('')

  const [ltcMemberSearch, setLtcMemberSearch] = useState('')

  const debouncedFacultySearch = useDebounce(facultySearch)
  const debouncedStudentSearch = useDebounce(studentSearch)
  const debouncedLtcMemberSearch = useDebounce(ltcMemberSearch)

  // Forms / Modals
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false)
  const [facultyForm, setFacultyForm] = useState({ name: '', email: '', department: '', division: '', school: '', panel: '', is_primary: false, gender: '', faculty: '', faculty_id: '', phone: '', designation: '', personal_email: '' })
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false)
  const [studentForm, setStudentForm] = useState({
    name: '', email: '', prn: '', department: '', semester: '', division: '', school: '', panel: '', gender: '', faculty: '',
    phone: '', dob: '', roll_number: '', program: '', year: '', lateral_entry: false, personal_email: '', parent_email: '',
    parent_mobile: '', address: '', age: '', nationality: '', aadhar_no: '', nominee_name: '', nominee_relationship: '', nominee_email: ''
  })
  const [isLtcModalOpen, setIsLtcModalOpen] = useState(false)
  const [ltcForm, setLtcForm] = useState({ name: '', email: '', personal_email: '', faculty_id: '', phone: '', gender: '', designation: '', division: '', faculty: '', school: '', department: '', panel: '' })
  const [isLtcUpload, setIsLtcUpload] = useState(false)
  const [selectedUploadBatchId, setSelectedUploadBatchId] = useState('')


  // Custom Selector Dropdown Overrides
  const [isCustomStudentSchool, setIsCustomStudentSchool] = useState(false)
  const [isCustomStudentDept, setIsCustomStudentDept] = useState(false)
  const [isCustomStudentDiv, setIsCustomStudentDiv] = useState(false)
  const [isCustomFacultyDiv, setIsCustomFacultyDiv] = useState(false)
  const [isCustomFacultySchool, setIsCustomFacultySchool] = useState(false)
  const [isCustomFacultyDept, setIsCustomFacultyDept] = useState(false)
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
  const [feedbackList, setFeedbackList] = useState([])
  const [selectedUserForFeedback, setSelectedUserForFeedback] = useState(null)

  // Bulk upload
  const [bulkData, setBulkData] = useState({ faculty: [], students: [], errors: [] })
  const [bulkUploadFile, setBulkUploadFile] = useState(null)
  const [bulkInsuranceData, setBulkInsuranceData] = useState([])
  const [bulkInsuranceFile, setBulkInsuranceFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingInsurance, setIsUploadingInsurance] = useState(false)
  const [jobProgress, setJobProgress] = useState(null)
  const [showProgressModal, setShowProgressModal] = useState(false)

  // Bulk upload conflict resolution
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateRecords, setDuplicateRecords] = useState([])
  const [pendingBulkUsers, setPendingBulkUsers] = useState([])


  // Doc form
  const [docForm, setDocForm] = useState({ name: '', url: '', target_role: 'all' })

  // Squad
  const [isShuffling, setIsShuffling] = useState(false)
  const [selectedSquad, setSelectedSquad] = useState('Aditya')
  const [squadViewTab, setSquadViewTab] = useState('master')

  // QR Scanner
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scannedUser, setScannedUser] = useState(null)
  const [scanMode, setScanMode] = useState('camera')
  const [scanFileImage, setScanFileImage] = useState(null)
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false)
  const [slipStudent, setSlipStudent] = useState(null)


  useEffect(() => {
    const h = () => {
      setIsMobile(window.innerWidth <= 768)
      setIsDesktop(window.innerWidth >= 1024)
      if (window.innerWidth > 768) setIsSidebarOpen(false)
    }
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    if (isSidebarOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen, isMobile])

  const apiFetch = useCallback(async (url, opts = {}) => {
    try {
      const res = await fetch(`${API}${url}`, {
        ...opts,
        headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) }
      })
      if (res.status === 401) { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); return null }
      return res
    } catch (err) {
      console.error(`apiFetch error for ${url}:`, err)
      return null
    }
  }, [token, navigate])

  const fetchUsers = useCallback(async () => {
    const res = await apiFetch('/api/admin/users')
    if (!res) return
    const data = await res.json()
    if (res.ok) { setUsers(data.users || []) }
  }, [apiFetch])

  const fetchDocuments = useCallback(async () => {
    const res = await apiFetch('/api/documents')
    if (!res) return
    const data = await res.json()
    if (res.ok) setDocuments(data.documents || [])
  }, [apiFetch])

  const fetchBatches = useCallback(async () => {
    const res = await apiFetch('/api/admin/batches')
    if (!res) return
    const data = await res.json()
    if (res.ok) setBatches(data.batches || [])
  }, [apiFetch])

  const fetchRecentActivities = useCallback(async () => {
    const res = await apiFetch('/api/admin/audit-logs?page=1&limit=5')
    if (!res) return
    const data = await res.json()
    if (res.ok) setRecentActivities(data.logs || [])
  }, [apiFetch])

  const fetchAttendanceRecords = useCallback(async () => {
    const res = await apiFetch('/api/faculty/attendance_records')
    if (!res) return
    const data = await res.json()
    if (res.ok) setAttendanceRecords(data.records || [])
  }, [apiFetch])

  const fetchEvaluationRecords = useCallback(async () => {
    const res = await apiFetch('/api/faculty/evaluations')
    if (!res) return
    const data = await res.json()
    if (res.ok) setEvaluationRecords(data.evaluations || [])
  }, [apiFetch])

  const fetchAllFeedbacks = useCallback(async () => {
    const res = await apiFetch('/api/admin/feedback')
    if (!res) return
    const data = await res.json()
    if (res.ok) setAllFeedbacks(data.feedback || [])
  }, [apiFetch])

  const fetchDashboardStats = useCallback(async () => {
    const res = await apiFetch('/api/dashboard-stats')
    if (!res) return
    const data = await res.json()
    if (res.ok) setDashboardStats(data)
  }, [apiFetch])

  const refreshAllData = useCallback(async () => {
    try {
      await Promise.all([
        fetchUsers(),
        fetchBatches(),
        fetchRecentActivities(),
        fetchDashboardStats()
      ])
    } catch (err) {
      console.error('Error refreshing dashboard data:', err)
    }
  }, [fetchUsers, fetchBatches, fetchRecentActivities, fetchDashboardStats])

  const fetchAdminNotifications = useCallback(async () => {
    try {
      const res = await apiFetch('/api/superadmin/notifications/me')
      if (res && res.ok) {
        const data = await res.json()
        setDbNotifications(data.notifications || [])
        setDbUnreadCount(data.unread || 0)
      }
    } catch (err) {
      console.error('Failed to fetch admin notifications', err)
    }
  }, [apiFetch])

  const fetchCustomTemplates = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/communication/templates')
      if (res && res.ok) {
        const data = await res.json()
        const map = {}
        ;(data.templates || []).forEach(t => {
          if (t.template_key) {
            map[t.template_key] = t
          }
        })
        setCustomTemplates(map)
      }
    } catch (err) {
      console.error('Failed to fetch communication templates', err)
    }
  }, [apiFetch])

  useEffect(() => {
    if (activeTab === 'orientation') {
      fetchCustomTemplates()
    }
  }, [activeTab, fetchCustomTemplates])

  const handleNotificationClick = useCallback(async (n) => {
    const title = (n.title || '').toLowerCase();
    const msg = (n.message || '').toLowerCase();
    
    // Close notifications dropdown
    setIsNotifOpen(false);

    // Click to mark read
    if (!n.read_at) {
      try {
        await apiFetch('/api/superadmin/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [n.id] })
        });
        fetchAdminNotifications();
      } catch (err) { console.error(err); }
    }

    if (title.includes('ticket') || msg.includes('ticket')) {
      setActiveTab('tickets');
    } else if (title.includes('schedule') || msg.includes('schedule') || title.includes('timetable') || msg.includes('timetable')) {
      setActiveTab('timetable');
    } else if (title.includes('document') || msg.includes('document') || title.includes('sop') || msg.includes('sop')) {
      setActiveTab('documents');
    } else if (title.includes('submission') || msg.includes('submission') || title.includes('undertaking') || msg.includes('undertaking')) {
      setActiveTab('submissions');
    } else if (title.includes('faculty') || msg.includes('faculty')) {
      setActiveTab('faculty');
    } else if (title.includes('ltc member') || msg.includes('ltc member') || title.includes('ltc_member') || msg.includes('ltc_member')) {
      setActiveTab('ltcmembers');
    } else if (title.includes('student') || msg.includes('student')) {
      setActiveTab('students');
    } else if (title.includes('batch') || msg.includes('batch')) {
      setActiveTab('batches');
    } else {
      setActiveTab('dashboard');
    }
  }, [apiFetch, fetchAdminNotifications]);

  // ── Auth guard + initial fetch ──
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') { navigate('/login'); return }
    fetchUsers()
    fetchDocuments()
    fetchBatches()
    fetchRecentActivities()
    fetchDashboardStats()
    fetchAdminNotifications()
    fetchCustomTemplates()
    // Lightweight notification badge polling only (30 seconds)
    const notifInterval = setInterval(fetchAdminNotifications, 30000)
    return () => clearInterval(notifInterval)
  }, [fetchCustomTemplates])

  // Close notification / language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (e.target.closest('[data-notif-trigger]') || e.target.closest('[data-notif-trigger-mobile]')) {
        return;
      }
      if (isNotifOpen && !e.target.closest('[data-notif-dropdown]') && !e.target.closest('[data-notif-dropdown-mobile]')) {
        setIsNotifOpen(false);
      }
      if (isMobileLangOpen && !e.target.closest('[data-mobile-lang-dropdown]')) {
        setIsMobileLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotifOpen, isMobileLangOpen])

  // ── Browser back button logic ──
  useEffect(() => {
    window.history.pushState({ type: 'dashboard_state' }, '')

    const handlePopState = (event) => {
      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard')
        window.history.pushState({ type: 'dashboard_state' }, '')
      } else {
        handleLogout()
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'bulk') {
      setIsLtcUpload(false)
    }
  }, [activeTab])

  // Refresh dashboard stats on window focus to keep counts fresh when returning to tab
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return
    const onFocus = () => {
      fetchDashboardStats()
      fetchAdminNotifications()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [currentUser, fetchDashboardStats, fetchAdminNotifications])


  const normFlex = useCallback((str) => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const matchesFlexible = useCallback((val1, val2) => {
    if (!val1 || !val2) return false;
    const n1 = normFlex(val1);
    const n2 = normFlex(val2);
    if (!n1 || !n2) return false;
    return n1 === n2;
  }, [normFlex]);

  const faculties = useMemo(() => users.filter(u => {
    if (u.role !== 'faculty') return false
    const q = debouncedFacultySearch.toLowerCase()
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.department || '').toLowerCase().includes(q)) return false
    if (facultyDivFilter) {
      if (facultyDivFilter === 'UNASSIGNED') {
        const div = (u.division || '').trim().toLowerCase()
        if (div && !['unassigned', 'n/a', 'none', '-'].includes(div)) return false
      } else {
        if (u.division !== facultyDivFilter && !matchesFlexible(u.division, facultyDivFilter)) return false
      }
    }
    if (facultyFacFilter && u.faculty !== facultyFacFilter) return false
    if (facultySchoolFilter && u.school !== facultySchoolFilter) return false
    if (facultyDeptFilter && u.department !== facultyDeptFilter) return false
    if (facultyTypeFilter) {
      const isPrimary = u.is_primary ? 'primary' : 'secondary'
      if (isPrimary !== facultyTypeFilter) return false
    }
    return true
  }), [users, debouncedFacultySearch, facultyDivFilter, facultyFacFilter, facultySchoolFilter, facultyDeptFilter, facultyTypeFilter, matchesFlexible])

  // Memos for Cascading Lookups from Hierarchy constants
  const availableFacultyDivisions = useMemo(() => Object.keys(OFFICIAL_HIERARCHY), [])
  const availableFacultyFaculties = useMemo(() => {
    if (!facultyDivFilter) return []
    return Object.keys(OFFICIAL_HIERARCHY[facultyDivFilter] || {})
  }, [facultyDivFilter])
  const availableFacultySchools = useMemo(() => {
    if (!facultyDivFilter || !facultyFacFilter) return []
    return Object.keys(OFFICIAL_HIERARCHY[facultyDivFilter]?.[facultyFacFilter] || {})
  }, [facultyDivFilter, facultyFacFilter])
  const availableFacultyDepartments = useMemo(() => {
    if (!facultyDivFilter || !facultyFacFilter || !facultySchoolFilter) return []
    return OFFICIAL_HIERARCHY[facultyDivFilter]?.[facultyFacFilter]?.[facultySchoolFilter] || []
  }, [facultyDivFilter, facultyFacFilter, facultySchoolFilter])

  const availableDivisions = useMemo(() => Object.keys(OFFICIAL_HIERARCHY), [])

  const availableFaculties = useMemo(() => {
    const set = new Set()
    if (selectedDivision) {
      if (selectedDivision === 'UNASSIGNED') {
        users.filter(u => {
          const div = (u.division || '').trim().toLowerCase()
          return (!div || ['unassigned', 'n/a', 'none', '-'].includes(div)) && u.faculty
        }).forEach(u => set.add(u.faculty))
      } else {
        const matchKey = Object.keys(OFFICIAL_HIERARCHY).find(divKey => matchesFlexible(divKey, selectedDivision))
        if (matchKey) {
          Object.keys(OFFICIAL_HIERARCHY[matchKey] || {}).forEach(fac => set.add(fac))
        }
        users.filter(u => matchesFlexible(u.division, selectedDivision) && u.faculty).forEach(u => set.add(u.faculty))
      }
    } else {
      Object.values(OFFICIAL_HIERARCHY).forEach(divObj => {
        if (divObj && typeof divObj === 'object') {
          Object.keys(divObj).forEach(fac => set.add(fac))
        }
      })
      users.filter(u => u.faculty).forEach(u => set.add(u.faculty))
    }
    return [...set].sort()
  }, [selectedDivision, users, matchesFlexible])

  const availableSchools = useMemo(() => {
    const set = new Set()
    if (selectedFaculty) {
      Object.values(OFFICIAL_HIERARCHY).forEach(divObj => {
        Object.entries(divObj || {}).forEach(([facKey, schObj]) => {
          if (matchesFlexible(facKey, selectedFaculty)) {
            Object.keys(schObj || {}).forEach(sch => {
              const c = getCanonicalSchool(sch)
              if (c) set.add(c)
            })
          }
        })
      })
      users.filter(u => matchesFlexible(u.faculty, selectedFaculty) && u.school).forEach(u => {
        const c = getCanonicalSchool(u.school)
        if (c) set.add(c)
      })
    } else {
      Object.values(OFFICIAL_HIERARCHY).forEach(divObj => {
        Object.values(divObj || {}).forEach(facObj => {
          Object.keys(facObj || {}).forEach(sch => {
            const c = getCanonicalSchool(sch)
            if (c) set.add(c)
          })
        })
      })
      users.filter(u => u.school).forEach(u => {
        const c = getCanonicalSchool(u.school)
        if (c) set.add(c)
      })
    }
    return [...set].sort()
  }, [selectedFaculty, users, matchesFlexible])

  const availableDepartments = useMemo(() => {
    const set = new Set()
    if (selectedSchool) {
      Object.values(OFFICIAL_HIERARCHY).forEach(divObj => {
        Object.values(divObj || {}).forEach(facObj => {
          Object.entries(facObj || {}).forEach(([schKey, deptList]) => {
            if (getCanonicalSchool(schKey) === getCanonicalSchool(selectedSchool) || matchesFlexible(schKey, selectedSchool)) {
              (deptList || []).forEach(dept => {
                const c = getCanonicalDepartment(dept)
                if (c) set.add(c)
              })
            }
          })
        })
      })
      users.filter(u => (getCanonicalSchool(u.school) === getCanonicalSchool(selectedSchool) || matchesFlexible(u.school, selectedSchool)) && u.department).forEach(u => {
        const c = getCanonicalDepartment(u.department)
        if (c) set.add(c)
      })
    } else {
      users.filter(u => u.department).forEach(u => {
        const c = getCanonicalDepartment(u.department)
        if (c) set.add(c)
      })
    }
    return [...set].sort()
  }, [selectedSchool, users, matchesFlexible])

  const availablePanels = useMemo(() => {
    const set = new Set();
    (users || []).forEach(u => {
      if (u.panel && String(u.panel).trim() && String(u.panel).trim() !== '—' && String(u.panel).trim() !== 'null') {
        set.add(String(u.panel).trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [users])

  const students = useMemo(() => users.filter(u => {
    if (u.role !== 'student') return false
    if (u.source_program === 'RI_DIRECT' || u.batch_source === 'RI_DIRECT' || u.is_ri_direct) return false
    const q = debouncedStudentSearch.toLowerCase()
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.department || '').toLowerCase().includes(q) && !(u.prn || '').toLowerCase().includes(q)) return false
    
    if (selectedDivision) {
      if (selectedDivision === 'UNASSIGNED') {
        const div = (u.division || '').trim().toLowerCase()
        if (div && !['unassigned', 'n/a', 'none', '-'].includes(div)) return false
      } else {
        if (!matchesFlexible(u.division, selectedDivision)) return false
      }
    }
    if (selectedFaculty && !matchesFlexible(u.faculty, selectedFaculty)) return false
    if (selectedSchool) {
      const uSchoolCanon = getCanonicalSchool(u.school)
      const selSchoolCanon = getCanonicalSchool(selectedSchool)
      if (uSchoolCanon !== selSchoolCanon && !matchesFlexible(u.school, selectedSchool)) return false
    }
    if (selectedDepartment) {
      const uDeptCanon = getCanonicalDepartment(u.department)
      const selDeptCanon = getCanonicalDepartment(selectedDepartment)
      if (uDeptCanon !== selDeptCanon && !matchesFlexible(u.department, selectedDepartment)) return false
    }
    if (selectedPanel && !matchesFlexible(u.panel, selectedPanel)) return false
    return true
  }), [users, debouncedStudentSearch, selectedDivision, selectedFaculty, selectedSchool, selectedDepartment, selectedPanel, matchesFlexible])

  const ltcMembers = useMemo(() => users.filter(u => {
    // Include ltc_member users AND superadmin_readonly users whose original role was ltc_member
    const isLtcRole = u.role === 'ltc_member' || (u.role === 'superadmin_readonly' && u.base_role === 'ltc_member')
    if (!isLtcRole) return false
    const q = debouncedLtcMemberSearch.toLowerCase()
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.faculty_id || '').toLowerCase().includes(q) && !(u.designation || '').toLowerCase().includes(q)) return false
    return true
  }), [users, debouncedLtcMemberSearch])

  const counts = useMemo(() => {
    return {
      faculty: users.filter(u => u.role === 'faculty').length,
      students: users.filter(u => u.role === 'student' && !(u.source_program === 'RI_DIRECT' || u.batch_source === 'RI_DIRECT' || u.is_ri_direct)).length,
      ltc: users.filter(u => u.role === 'ltc_member' || (u.role === 'superadmin_readonly' && u.base_role === 'ltc_member')).length,
      documents: documents.length
    }
  }, [users, documents])

  const activeBatch = useMemo(() => batches.find(b => b.status === 'active'), [batches])
  const activeBatchStudents = useMemo(() => {
    if (!activeBatch) return []
    return users.filter(u => u.role === 'student' && u.active_batch_id === activeBatch.id && !(u.source_program === 'RI_DIRECT' || u.batch_source === 'RI_DIRECT' || u.is_ri_direct))
  }, [users, activeBatch])

  // Pagination instances
  const facultyPg = usePagination(faculties)
  const studentPg = usePagination(students)
  const ltcMemberPg = usePagination(ltcMembers)

  // Reset Student Directory pagination to Page 1 when any student filter or search changes
  useEffect(() => {
    studentPg.reset();
  }, [studentSearch, selectedDivision, selectedFaculty, selectedSchool, selectedDepartment, selectedPanel]);

  // Reset Faculty List pagination to Page 1 when any faculty filter or search changes
  useEffect(() => {
    facultyPg.reset();
  }, [facultySearch, facultyDivFilter, facultyFacFilter, facultySchoolFilter, facultyDeptFilter, facultyTypeFilter]);

  // Reset LTC Members pagination to Page 1 when search changes
  useEffect(() => {
    ltcMemberPg.reset();
  }, [ltcMemberSearch]);

  // ─── Auth / Nav ────────────────────────────────────────────────────────────
  const handleLogout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/') }

  // ─── Faculty handlers ──────────────────────────────────────────────────────
  const handleAddFaculty = async (e) => {
    e.preventDefault()
    const res = await apiFetch('/api/admin/faculty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facultyForm)
    })
    if (!res) return
    const data = await res.json()
    if (res.ok) {
      toast(data.message, 'success')
      setIsFacultyModalOpen(false)
      setFacultyForm({ name: '', email: '', department: '', division: '', school: '', panel: '', is_primary: false, gender: '', faculty: '', faculty_id: '', phone: '', designation: '', personal_email: '' })
      setIsCustomFacultyDiv(false)
      setIsCustomFacultySchool(false)
      setIsCustomFacultyDept(false)
      refreshAllData()
    } else { toast(data.message || 'Failed to add faculty', 'error') }
  }

  const handleDeleteUser = async (id, role) => {
    if (!window.confirm(`Permanently delete this ${role} from the master database?`)) return
    const res = await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (!res) return
    const data = await res.json()
    toast(data.message, res.ok ? 'success' : 'error')
    if (res.ok) refreshAllData()
  }

  // ─── Student handlers ──────────────────────────────────────────────────────
  const handleAddStudent = async (e) => {
    e.preventDefault()
    const res = await apiFetch('/api/users/student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentForm)
    })
    if (!res) return
    const data = await res.json()
    if (res.ok) {
      toast(data.message, 'success')
      setIsStudentModalOpen(false)
      setStudentForm({
        name: '', email: '', prn: '', department: '', semester: '', division: '', school: '', panel: '', gender: '', faculty: '',
        phone: '', dob: '', roll_number: '', program: '', year: '', lateral_entry: false, personal_email: '', parent_email: '',
        parent_mobile: '', address: '', age: '', nationality: '', aadhar_no: '', nominee_name: '', nominee_relationship: '', nominee_email: ''
      })
      setIsCustomStudentSchool(false)
      setIsCustomStudentDept(false)
      setIsCustomStudentDiv(false)
      refreshAllData()
    } else { toast(data.message || 'Failed to add student', 'error') }
  }

  const handleUpdatePanel = async (userId, panel) => {
    const res = await apiFetch('/api/admin/update-panel', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, panel })
    })
    if (res?.ok) { toast('Panel updated', 'success'); refreshAllData() } else toast('Failed to update panel', 'error')
  }

  const handleUpdateInsurance = async (userId, ins) => {
    const res = await apiFetch('/api/admin/insurance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, insurance: ins === 'true' })
    })
    if (res?.ok) { toast('Insurance updated', 'success'); refreshAllData() } else toast('Failed to update insurance', 'error')
  }

  const handleToggleStudentBatch = async (userId, inBatch) => {
    const res = await apiFetch('/api/admin/toggle-student-batch', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, in_batch: inBatch })
    })
    if (res?.ok) { toast(inBatch ? 'Added to batch' : 'Removed from batch', 'success'); refreshAllData() }
    else { const d = await res.json(); toast(d.message || 'Failed', 'error') }
  }

  // ─── LTC Member ────────────────────────────────────────────────────────────
  const handleAddLtcMember = async (e) => {
    e.preventDefault()
    const res = await apiFetch('/api/admin/ltc-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...ltcForm,
        role: 'ltc_member'
      })
    })
    if (!res) return
    const data = await res.json()
    if (res.ok) {
      toast('LTC Member added.', 'success')
      setIsLtcModalOpen(false)
      setLtcForm({ name: '', email: '', personal_email: '', faculty_id: '', phone: '', gender: '', designation: '', division: '', faculty: '', school: '', department: '', panel: '' })
      refreshAllData()
    } else {
      toast(data.message || 'Failed to add LTC Member', 'error')
    }
  }

  // ─── Documents ─────────────────────────────────────────────────────────────
  const handleUploadDocument = async (e) => {
    e.preventDefault()
    const res = await apiFetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docForm)
    })
    if (res?.ok) {
      toast('Document uploaded for ' + docForm.target_role, 'success')
      setDocForm({ name: '', url: '', target_role: 'all' })
      fetchDocuments()
    }
  }

  const handleDeleteDocument = async (id) => {
    if (!window.confirm('Delete this document?')) return
    const res = await apiFetch(`/api/documents/${id}`, { method: 'DELETE' })
    if (res?.ok) { toast('Document deleted.', 'success'); fetchDocuments() }
  }

  // ─── Bulk Upload ───────────────────────────────────────────────────────────
  const parseExcelSheetSmart = (worksheet) => {
    if (!worksheet) return [];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    if (!rawRows || rawRows.length === 0) return [];

    let headerIndex = -1;
    const headerKeywords = [
      'prn', 'first name', 'last name', 'salutation', 'mobile', 'date of birth',
      'sr.no', 'sr no', 's.no', 'email', 'name', 'employee id', 'emp id', 'full name',
      'student id', 'roll number', 'division', 'faculty', 'panel',
      'student full name', 'name of the school', 'school branch', 'upload payment screenshot',
      'does your child have any medical condition'
    ];

    for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
      const row = rawRows[i];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
      if (headerKeywords.some(kw => rowStr.includes(kw))) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      headerIndex = rawRows.findIndex(r => Array.isArray(r) && r.some(c => String(c || '').trim() !== ''));
      if (headerIndex === -1) headerIndex = 0;
    }

    const headerRow = rawRows[headerIndex].map(c => String(c || '').trim());
    const dataRows = rawRows.slice(headerIndex + 1);

    // Identify column indices for school registration format (Column 1 is student email, Column 15 is parent email)
    let studentEmailColIdx = -1;
    let parentEmailColIdx = -1;
    for (let c = 0; c < headerRow.length; c++) {
      const h = headerRow[c].toLowerCase();
      if (h === 'email address' || h === 'email' || h === 'email id') {
        if (studentEmailColIdx === -1) {
          studentEmailColIdx = c;
        } else if (parentEmailColIdx === -1) {
          parentEmailColIdx = c;
        }
      }
    }

    const result = [];
    for (const row of dataRows) {
      if (!Array.isArray(row) || !row.some(c => String(c || '').trim() !== '')) continue;
      const obj = {};
      for (let c = 0; c < headerRow.length; c++) {
        const header = headerRow[c];
        if (header) {
          if (c === parentEmailColIdx) {
            obj['parent_email_raw'] = row[c] !== undefined ? row[c] : "";
          } else if (c === studentEmailColIdx) {
            obj['student_email_raw'] = row[c] !== undefined ? row[c] : "";
            obj[header] = row[c] !== undefined ? row[c] : "";
          } else {
            obj[header] = row[c] !== undefined ? row[c] : "";
          }
        }
      }
      obj._rawRowArray = row;
      result.push(obj);
    }
    return result;
  };

  const parseData = useCallback((parsedData) => {
    const parsedFaculties = [], parsedStudents = [], parseErrors = [], parsedLtc = []

    if (!parsedData || parsedData.length === 0) {
      setBulkData({ faculty: [], students: [], errors: ['No data found in file.'] })
      return
    }

    // 1. Detect template type from the first non-empty row headers and values
    const firstKeys = Object.keys(parsedData[0]).map(k => k.replace(/^\uFEFF/, '').toLowerCase().replace(/\s+/g, ' ').trim());
    const firstRowRole = String(Object.values(parsedData[0])[firstKeys.indexOf('role')] || '').toLowerCase().trim();
    const isSchoolRegistration = firstKeys.some(k => k.includes('name of the school') || k.includes('student full name') || k.includes('school branch') || k.includes('class / standard') || k.includes('upload payment screenshot') || k.includes('medical condition'));
    const isLtcFormat = firstKeys.includes('full name') || firstKeys.includes('email (official)') || firstKeys.includes('email(official)')
      || firstRowRole === 'ltc member' || firstRowRole === 'ltc_member';
    let detectedTemplate = null;
    if (isSchoolRegistration) {
      detectedTemplate = 'student';
      setIsLtcUpload(false);
      toast('Life Awakening School Registration Template Detected', 'success');
    } else if (isLtcFormat) {
      detectedTemplate = 'ltc_member';
      setIsLtcUpload(true);
      toast('LTC Member Template Detected', 'success');
    } else if (firstKeys.includes('prn no') || firstKeys.includes('prn no.') || firstKeys.includes('prn number')) {
      detectedTemplate = 'student';
      toast('Student Template Detected', 'success');
    } else if (firstKeys.includes('employee id')) {
      detectedTemplate = 'faculty';
      toast('Faculty Template Detected', 'success');
    }

    parsedData.forEach((row, index) => {
      const norm = {}
      for (const key in row) {
        if (key === '_rawRowArray') continue;
        const cleanKey = key.replace(/^\uFEFF/, '').toLowerCase().replace(/\s+/g, ' ').trim();
        let val = row[key];
        if (typeof val === 'string') val = val.trim();
        norm[cleanKey] = val;
      }

      // ── LTC Member format ──
      if (isLtcFormat || detectedTemplate === 'ltc_member') {
        let name = norm['full name'] || norm.full_name || norm.student_name;
        if (!name) {
          if (norm.name) {
            name = norm.surname ? `${norm.name} ${norm.surname}`.trim() : norm.name;
          } else {
            const parts = [
              norm['salutation - mr / ms'] || norm.salutation,
              norm['first name ( as per aadhar card )'] || norm['first name (as per aadhar card)'] || norm['first name'],
              norm['middle name ( as per aadhar card )'] || norm['middle name (as per aadhar card)'] || norm['middle name'],
              norm['last name ( as per aadhar card )'] || norm['last name (as per aadhar card)'] || norm['last name']
            ].filter(Boolean);
            if (parts.length > 0) name = parts.join(' ');
          }
        }
        const email = norm['email (official)'] || norm['email(official)'] || norm['official email'] || norm.email || norm['email address'] || norm['email id']
        if (!name || !email) {
          parseErrors.push(`Row ${index + 1}: Missing Name or Email.`)
          return
        }
        norm.name = name
        norm.email = email
        norm['personal email'] = norm['email(personal)'] || norm['email (personal)'] || norm['personal email'] || norm.personal_email || ''
        norm.phone = norm['contact number'] || norm['contact no'] || norm['contact no.'] || norm['mobile no'] || norm['mobile no.'] || norm['mobile number'] || norm.phone || ''
        norm['employee id'] = norm['employee id'] || norm.faculty_id || norm['emp id'] || ''
        norm.role = 'ltc_member'
        parsedLtc.push(norm)
        return
      }

      // ── School Registration / Student / Faculty format ──
      let role = (norm.role || '').toLowerCase()
      if (!role && detectedTemplate) role = detectedTemplate;

      const prnRaw = norm['prn/ roll no.'] || norm['prn / roll no.'] || norm['prn/ roll no'] || norm['prn / roll no'] || norm['prn no'] || norm['prn no.'] || norm['prn number'] || norm.prn || norm['student id'] || norm.student_id;
      const facRaw = norm['employee id'] || norm.faculty_id || norm['faculty id'] || norm['emp id'];
      if (!role && isSchoolRegistration) role = 'student';
      if (!role && prnRaw) role = 'student';
      if (!role && facRaw) role = 'faculty';

      let name = norm['student full name'] || norm['student full name '] || norm.name || norm.full_name || norm.student_name;
      if (!name) {
        const parts = [
          norm['first name ( as per aadhar card )'] || norm['first name (as per aadhar card)'] || norm['first name'],
          norm['middle name ( as per aadhar card )'] || norm['middle name (as per aadhar card)'] || norm['middle name'],
          norm['last name ( as per aadhar card )'] || norm['last name (as per aadhar card)'] || norm['last name'] || norm.surname
        ].filter(Boolean);
        if (parts.length > 0) {
          const sal = norm['salutation - mr / ms'] || norm.salutation;
          name = sal ? `${sal} ${parts.join(' ')}` : parts.join(' ');
        }
      }

      const parentEmail1 = norm['parent_email_1'] || norm['email address1'] || norm['email address 1'] || norm['email address'] || norm['parent email 1'] || '';
      const parentEmail2 = norm['parent_email_2'] || norm['email address 2'] || norm['email address2'] || norm['parent email 2'] || '';
      const email = norm['student_email_raw'] || norm.email || '';
      const hasParentEmail = Boolean(parentEmail1 || parentEmail2);
      const validIdentifier = isSchoolRegistration ? hasParentEmail : (email || prnRaw || facRaw);

      // Silently skip completely empty / withdrawn placeholder rows
      if ((!name || String(name).trim() === '') && !validIdentifier) {
        return;
      }

      if (!name || !validIdentifier || !role) {
        if (isSchoolRegistration) {
          parseErrors.push(`Row ${index + 1}: Missing Student Name or Parent Email Address.`);
        } else {
          parseErrors.push(`Row ${index + 1}: Missing name, identifier (email/prn/emp_id), or role.`);
        }
        return;
      }

      norm.name = name;
      norm.email = email || parentEmail1 || parentEmail2 || '';
      norm.parent_email_1 = parentEmail1;
      norm.parent_email_2 = parentEmail2;
      norm.role = role;
      norm.school = norm['name of the school'] || norm['name of school'] || norm['school name'] || norm.school || '';
      norm.school_branch = norm['school branch'] || '';
      norm.class_grade = norm['class / standard'] || norm['class / standard '] || norm['class/standard'] || '';
      norm.division = norm.division || '';
      norm.prn = prnRaw || '';
      norm.phone = norm['contact number (valid what\'s app mobile number)'] || norm['contact number (valid whats app mobile number)'] || norm['contact number (valid whatsapp mobile number)'] || norm.phone || '';
      norm.payment_screenshot_url = norm['upload payment screenshot'] || norm.payment_screenshot_url || '';

      if (role === 'faculty') parsedFaculties.push(norm)
      else if (role === 'student') parsedStudents.push(norm)
      else if (role === 'ltc_member') parsedLtc.push(norm)
      else parseErrors.push(`Row ${index + 1}: Invalid role "${role}"`)
    })

    if (parsedLtc.length > 0) {
      setBulkData({ faculty: parsedLtc, students: [], errors: parseErrors })
    } else {
      setBulkData({ faculty: parsedFaculties, students: parsedStudents, errors: parseErrors })
    }
  }, [toast, setIsLtcUpload])

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return
    setIsLtcUpload(false)
    setBulkUploadFile(file)
    setBulkData({ faculty: [], students: [], errors: [] })
    const name = file.name.toLowerCase()
    if (name.endsWith('.csv')) { Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => parseData(r.data), error: () => toast('CSV parse error', 'error') }) }
    else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader()
      reader.onload = evt => { const wb = XLSX.read(evt.target.result, { type: 'binary' }); parseData(parseExcelSheetSmart(wb.Sheets[wb.SheetNames[0]])) }
      reader.readAsBinaryString(file)
    } else toast('Unsupported format. Upload CSV or XLSX.', 'error')
    e.target.value = null
  }

  const handleClearFile = () => {
    setBulkUploadFile(null)
    setBulkData({ faculty: [], students: [], errors: [] })
  }

  const handleLtcBulkUpload = (e) => {
    const file = e.target.files[0]; if (!file) return
    setIsLtcUpload(true)
    setBulkUploadFile(file)
    setBulkData({ faculty: [], students: [], errors: [] })
    const name = file.name.toLowerCase()

    const parseLtcData = (data) => {
      const parsedLtc = [], parseErrors = []
      data.forEach((row, index) => {
        const norm = {}
        for (const key in row) { norm[key.replace(/^\uFEFF/, '').toLowerCase().trim()] = row[key] }
        
        // Resolve name — supports "Full Name", separate Name & Surname, as well as legacy name parts
        let name = norm['full name'] || norm.full_name || norm.student_name;
        if (!name) {
          if (norm.name) {
            name = norm.surname ? `${norm.name} ${norm.surname}`.trim() : norm.name;
          } else {
            const parts = [
              norm['salutation - mr / ms'] || norm.salutation,
              norm['first name ( as per aadhar card )'] || norm['first name'],
              norm['middle name ( as per aadhar card )'] || norm['middle name'],
              norm['last name ( as per aadhar card )'] || norm['last name']
            ].filter(Boolean);
            if (parts.length > 0) name = parts.join(' ');
          }
        }

        // Resolve email — supports "Email (official)" as well as legacy keys
        const email = norm['email (official)'] || norm['email(official)'] || norm['official email'] || norm.email || norm['email address'] || norm['email id'];

        // Resolve employee ID
        const empId = norm['employee id'] || norm.faculty_id || norm['faculty id'] || norm['emp id'];

        if (!name || !email) {
          parseErrors.push(`Row ${index + 1}: Missing name or official email.`);
          return;
        }

        norm.name = name;
        norm.email = email; // normalise to plain "email" key for backend
        norm['personal email'] = norm['email(personal)'] || norm['email (personal)'] || norm['personal email'] || norm.personal_email || '';
        norm.phone = norm['contact number'] || norm['contact no'] || norm['contact no.'] || norm['mobile no'] || norm['mobile no.'] || norm.phone || '';
        norm['employee id'] = empId || '';
        norm.role = (norm.role || 'ltc_member').toLowerCase().trim() || 'ltc_member';
        parsedLtc.push(norm);
      });
      
      setBulkData({ faculty: parsedLtc, students: [], errors: parseErrors });
      setActiveTab('bulk');
    }

    if (name.endsWith('.csv')) { 
      Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => parseLtcData(r.data), error: () => toast('CSV parse error', 'error') }) 
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader()
      reader.onload = evt => { 
        const wb = XLSX.read(evt.target.result, { type: 'binary' }); 
        parseLtcData(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])) 
      }
      reader.readAsBinaryString(file)
    } else toast('Unsupported format. Upload CSV or XLSX.', 'error')
    e.target.value = null
  }

  const resolveUploadBatchId = (raw) => {
    if (!raw) return null
    if (typeof raw === 'number') return raw > 0 ? raw : null
    if (typeof raw === 'string') {
      if (raw === '[object Object]' || raw.trim() === '') return null
      const n = parseInt(raw, 10)
      return !isNaN(n) && n > 0 ? n : null
    }
    if (typeof raw === 'object') {
      if (raw.nativeEvent || raw.target || raw.preventDefault) return null // Click event object
      if (raw.id) return resolveUploadBatchId(raw.id)
    }
    return null
  }

  const submitBulkUpload = async (overrideBatchId) => {
    if (!bulkUploadFile) { toast('No file selected.', 'warning'); return }
    const targetBatchId = resolveUploadBatchId(overrideBatchId) || resolveUploadBatchId(selectedUploadBatchId)
    if (!isLtcUpload && !targetBatchId) {
      toast('Please select a target batch before uploading school students.', 'warning')
      return
    }
    setIsUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', bulkUploadFile)
      if (targetBatchId) formData.append('batchId', String(targetBatchId))

      const url = isLtcUpload 
        ? '/api/admin/bulk-upload/validate?isLtc=true' 
        : `/api/admin/bulk-upload/validate?batchId=${encodeURIComponent(targetBatchId)}`
      const checkRes = await apiFetch(url, {
        method: 'POST',
        body: formData
      })
      if (!checkRes) throw new Error('Validation failed.')
      
      if (!checkRes.ok) {
        const contentType = checkRes.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const errorData = await checkRes.json()
          throw new Error(errorData.message || 'Validation failed.')
        } else {
          const errorText = await checkRes.text()
          throw new Error(errorText || 'Validation failed.')
        }
      }
      const checkData = await checkRes.json()

      if (checkData.duplicates && checkData.duplicates.length > 0) {
        setDuplicateRecords(checkData.duplicates)
        setPendingBulkUsers(checkData.duplicates)
        setShowDuplicateModal(true)
        setIsUploading(false)
        return
      }

      await executeIngestion('replace', targetBatchId)
    } catch (err) {
      setIsUploading(false)
      toast(err.message || 'Validation error', 'error')
    }
  }

  const executeIngestion = async (duplicateAction, overrideBatchId) => {
    if (!bulkUploadFile) { toast('No file selected.', 'error'); return }
    const targetBatchId = resolveUploadBatchId(overrideBatchId) || resolveUploadBatchId(selectedUploadBatchId)
    if (!isLtcUpload && !targetBatchId) {
      toast('Please select a target batch before uploading school students.', 'warning')
      return
    }
    setIsUploading(true)
    setShowProgressModal(true)
    setJobProgress(null)

    try {
      const formData = new FormData()
      formData.append('file', bulkUploadFile)
      formData.append('duplicateAction', duplicateAction)
      if (targetBatchId) formData.append('batchId', String(targetBatchId))

      const url = isLtcUpload 
        ? '/api/admin/bulk-upload?isLtc=true' 
        : `/api/admin/bulk-upload?batchId=${encodeURIComponent(targetBatchId)}`
      const res = await apiFetch(url, {
        method: 'POST',
        body: formData
      })
      if (!res) throw new Error('Network error or session expired.')
      
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const errorData = await res.json()
          throw new Error(errorData.message || 'Failed to start bulk upload.')
        } else {
          const errorText = await res.text()
          throw new Error(errorText || 'Failed to start bulk upload.')
        }
      }
      const data = await res.json()
      const jobId = data.jobId

      const startTime = Date.now()

      const intervalId = setInterval(async () => {
        try {
          const pollRes = await apiFetch(`/api/admin/upload-jobs/${jobId}`)
          if (!pollRes) {
            clearInterval(intervalId)
            setIsUploading(false)
            setShowProgressModal(false)
            return
          }

          if (!pollRes.ok) {
            clearInterval(intervalId)
            setIsUploading(false)
            const errorText = await pollRes.text()
            toast('Error querying upload status: ' + errorText, 'error')
            setShowProgressModal(false)
            return
          }

          const pollData = await pollRes.json()
          
          if (pollData.job) {
            // Calculate eta
            const elapsedSec = (Date.now() - startTime) / 1000
            const processed = pollData.job.processed_records || 0
            const total = pollData.job.total_records || 0
            
            let eta = 'Estimating...'
            if (processed > 0 && total > processed) {
              const remaining = total - processed
              const timePerRecord = elapsedSec / processed
              const remainingSec = Math.round(remaining * timePerRecord)
              const mins = Math.floor(remainingSec / 60)
              const secs = remainingSec % 60
              eta = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
            } else if (processed >= total && total > 0) {
              eta = '0s'
            }
            
            pollData.job.eta = eta
            setJobProgress(pollData.job)
            
            if (pollData.job.status === 'completed' || pollData.job.status === 'failed') {
               clearInterval(intervalId)
               setIsUploading(false)
               if (pollData.job.status === 'completed') {
                 toast(`Bulk upload finished! Success: ${pollData.job.success_count}, Failed: ${pollData.job.failed_count}`, 'success')
                 setBulkData({ faculty: [], students: [], errors: [] })
                 setBulkUploadFile(null)
                 refreshAllData()
               } else {
                 toast('Bulk upload job failed.', 'error')
               }
            }
          } else {
            clearInterval(intervalId)
            setIsUploading(false)
            toast('Failed to query upload status.', 'error')
            setShowProgressModal(false)
          }
        } catch (err) {
          clearInterval(intervalId)
          setIsUploading(false)
          toast('Polling status error: ' + err.message, 'error')
          setShowProgressModal(false)
        }
      }, 750)

    } catch (err) {
      setIsUploading(false)
      setShowProgressModal(false)
      toast(err.message || 'Upload error', 'error')
    }
  }

  const downloadErrorReport = () => {
    if (!jobProgress || !jobProgress.errors || !jobProgress.errors.length) return;
    const headers = ['Row / Name', 'Error Description'];
    const csvRows = [headers.join(',')];
    for (const err of jobProgress.errors) {
      const row = [
        `"${String(err.row || '').replace(/"/g, '""')}"`,
        `"${String(err.error || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    }
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bulk_upload_errors_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processInsuranceData = (data) => {
    if (!data?.length) { toast('Empty insurance file.', 'warning'); return }
    const formatted = data.map(row => {
      const r = {}
      for (let k in row) { if (k) r[k.replace(/^\uFEFF/, '').toLowerCase().trim().replace(/['"`]+/g, '')] = row[k] }
      return r
    })
    setBulkInsuranceData(formatted)
  }

  const handleInsuranceFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return
    setBulkInsuranceFile(file)
    setBulkInsuranceData([])
    const name = file.name.toLowerCase()
    if (name.endsWith('.csv')) Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => processInsuranceData(r.data), error: () => toast('CSV parse error', 'error') })
    else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader()
      reader.onload = evt => { const wb = XLSX.read(evt.target.result, { type: 'binary' }); processInsuranceData(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])) }
      reader.readAsBinaryString(file)
    }
    e.target.value = null
  }

  const submitBulkInsurance = async () => {
    if (!bulkInsuranceFile) { toast('No insurance file selected.', 'warning'); return }
    setIsUploadingInsurance(true)
    try {
      const formData = new FormData()
      formData.append('file', bulkInsuranceFile)

      const res = await apiFetch('/api/admin/bulk-insurance', {
        method: 'POST',
        body: formData
      })
      if (!res) return
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const errorData = await res.json()
          toast(errorData.message || 'Failed to upload insurance data.', 'error')
        } else {
          const errorText = await res.text()
          toast(errorText || 'Failed to upload insurance data.', 'error')
        }
        return
      }
      const data = await res.json()
      toast(data.message || 'Insurance uploaded successfully.', 'success')
      setBulkInsuranceData([]); setBulkInsuranceFile(null); refreshAllData()
    } catch (err) {
      toast(err.message || 'Insurance upload failed.', 'error')
    } finally { setIsUploadingInsurance(false) }
  }

  // ─── Feedback ──────────────────────────────────────────────────────────────
  const handleViewFeedback = async (userId, userName) => {
    setSelectedUserForFeedback({ id: userId, name: userName })
    setIsFeedbackModalOpen(true)
    const res = await apiFetch(`/api/admin/feedback?user_id=${userId}`)
    if (res?.ok) { const d = await res.json(); setFeedbackList(d.feedback || []) }
  }

  const handleDownloadStudentFeedbackPdf = async (studentId, category) => {
    try {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/student/feedback/pdf/${studentId}/${category}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `Failed to download ${category} feedback PDF.`);
      }
      const blob = await res.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      
      let filename = `Feedback_${category}_Student_${studentId}.pdf`;
      const disposition = res.headers.get('content-disposition');
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const parts = disposition.split('filename=');
        filename = parts[1].replace(/['"]/g, '');
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(fileUrl);
    } catch (err) {
      alert('Error downloading feedback: ' + err.message);
    }
  };

  // ─── QR Scanner ────────────────────────────────────────────────────────────
  const processCode = async (decodedText, scannerInstance) => {
    try {
      let barcode = decodedText
      try { const u = new URL(decodedText); if (u.searchParams.has('barcode')) barcode = u.searchParams.get('barcode') } catch (e) { }
      const res = await fetch(`${API}/api/admin/user-by-barcode?barcode=${barcode}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setScannedUser(data.user)
      else { toast(data.message || 'Invalid QR', 'error'); if (scannerInstance) scannerInstance.resume() }
    } catch (err) { toast('Scan error: ' + err.message, 'error'); if (scannerInstance) scannerInstance.resume() }
  }

  useEffect(() => {
    let scanner
    if (isScannerOpen && scanMode === 'camera' && !scannedUser) {
      scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: { width: 250, height: 250 }, supportedScanTypes: [0] }, false)
      scanner.render(async (text) => { scanner.pause(); await processCode(text, scanner) }, () => { })
    }
    return () => { if (scanner) scanner.clear().catch(() => { }) }
  }, [isScannerOpen, scanMode, scannedUser])

  const handleFileScan = async () => {
    if (!scanFileImage) return
    try {
      const h = new Html5Qrcode('qr-reader-file-dummy')
      const text = await h.scanFile(scanFileImage, true)
      processCode(text, null)
    } catch { toast('No valid QR Code found in image.', 'error') }
  }



  // ─── Sidebar nav item ──────────────────────────────────────────────────────
  const NavItem = ({ tab, icon, label, badgeCount }) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => { setActiveTab(tab); if (isMobile) setIsSidebarOpen(false); }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 12px',
          borderRadius: '8px',
          fontSize: '13.5px',
          fontWeight: isActive ? '600' : '500',
          color: isActive ? '#ffffff' : '#475569',
          background: isActive ? '#ea580c' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease-in-out',
          textAlign: 'left',
          width: '100%',
          outline: 'none',
          marginBottom: '2px',
          boxShadow: 'none'
        }}
        className={isActive ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{ color: isActive ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center' }}>
            {React.isValidElement(icon) ? React.cloneElement(icon, { size: 16, strokeWidth: isActive ? 2.2 : 2 }) : icon}
          </div>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t(label)}</span>
        </div>
        {badgeCount !== undefined && badgeCount > 0 && (
          <span style={{
            fontSize: '10px',
            fontWeight: '700',
            padding: '2px 6px',
            borderRadius: '4px',
            background: isActive ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
            color: isActive ? '#ffffff' : '#0f172a',
            lineHeight: 1
          }}>
            {badgeCount}
          </span>
        )}
      </button>
    );
  }

  // ─── Mobile Redesign Render Helpers ─────────────────────────────────────────
  const renderMobileDashboard = () => {
    const studCount = users.filter(u => u.role === 'student').length
    const facCount = users.filter(u => u.role === 'faculty').length
    const ltcCount = users.filter(u => u.role === 'ltc_member').length
    const batchCount = batches.length

    const studentUndertakingPct = dashboardStats?.studentUndertaking?.pct ?? 0
    const facultyUndertakingPct = dashboardStats?.facultyUndertaking?.pct ?? 0
    const studentPreFeedbackPct = dashboardStats?.studentPreFeedback?.pct ?? dashboardStats?.studentFeedback?.pct ?? 0
    const studentPostFeedbackPct = dashboardStats?.studentPostFeedback?.pct ?? 0

    return (
      <div className="mobile-dashboard animate-fade-in" style={{ padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* SECTION 1: Statistics Cards (2x2 Grid) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: 0 }}>
          {/* Faculty Card */}
          <div 
            onClick={() => setActiveTab('faculty')} 
            style={{ 
              background: '#ffffff', 
              borderRadius: '16px', 
              border: '1px solid #e2e8f0', 
              padding: '12px 14px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              position: 'relative', 
              overflow: 'hidden', 
              minHeight: '105px', 
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            className="hover:shadow-lg transition-all duration-300"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
              <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {t("Assigned Faculty")}
              </span>
              <div style={{ 
                width: '34px', 
                height: '34px', 
                background: '#ffffff', 
                borderRadius: '10px', 
                boxShadow: '0 6px 15px -3px rgba(59, 130, 246, 0.15)', 
                border: '1px solid rgba(59, 130, 246, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <BookOpen size={18} color="#1d4ed8" strokeWidth={2.4} />
              </div>
            </div>
            <div style={{ zIndex: 2, marginTop: '4px' }}>
              <h3 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {facCount.toLocaleString()}
              </h3>
            </div>
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '90px', 
              height: '70px', 
              background: 'radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.07), transparent 70%)',
              pointerEvents: 'none',
              zIndex: 1
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                backgroundImage: 'radial-gradient(rgba(37, 99, 235, 0.16) 1.5px, transparent 1.5px)',
                backgroundSize: '8px 8px',
                WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
              }} />
            </div>
          </div>

          {/* Students Card */}
          <div 
            onClick={() => setActiveTab('students')} 
            style={{ 
              background: '#ffffff', 
              borderRadius: '16px', 
              border: '1px solid #e2e8f0', 
              padding: '12px 14px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              position: 'relative', 
              overflow: 'hidden', 
              minHeight: '105px', 
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            className="hover:shadow-lg transition-all duration-300"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
              <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {t("Students Eligible")}
              </span>
              <div style={{ 
                width: '34px', 
                height: '34px', 
                background: '#ffffff', 
                borderRadius: '10px', 
                boxShadow: '0 6px 15px -3px rgba(30, 58, 138, 0.15)', 
                border: '1px solid rgba(30, 58, 138, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <GraduationCap size={18} color="#1e3a8a" strokeWidth={2.4} />
              </div>
            </div>
            <div style={{ zIndex: 2, marginTop: '4px' }}>
              <h3 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {studCount.toLocaleString()}
              </h3>
            </div>
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '90px', 
              height: '70px', 
              background: 'radial-gradient(circle at bottom right, rgba(30, 58, 138, 0.07), transparent 70%)',
              pointerEvents: 'none',
              zIndex: 1
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                backgroundImage: 'radial-gradient(rgba(30, 58, 138, 0.16) 1.5px, transparent 1.5px)',
                backgroundSize: '8px 8px',
                WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
              }} />
            </div>
          </div>

          {/* Batches Card */}
          <div 
            onClick={() => setActiveTab('batches')} 
            style={{ 
              background: '#ffffff', 
              borderRadius: '16px', 
              border: '1px solid #e2e8f0', 
              padding: '12px 14px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              position: 'relative', 
              overflow: 'hidden', 
              minHeight: '105px', 
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            className="hover:shadow-lg transition-all duration-300"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
              <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {t("Planned Batches")}
              </span>
              <div style={{ 
                width: '34px', 
                height: '34px', 
                background: '#ffffff', 
                borderRadius: '10px', 
                boxShadow: '0 6px 15px -3px rgba(249, 115, 22, 0.15)', 
                border: '1px solid rgba(249, 115, 22, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Layers size={18} color="#ea580c" strokeWidth={2.4} />
              </div>
            </div>
            <div style={{ zIndex: 2, marginTop: '4px' }}>
              <h3 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {batchCount}
              </h3>
            </div>
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '90px', 
              height: '70px', 
              background: 'radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.07), transparent 70%)',
              pointerEvents: 'none',
              zIndex: 1
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                backgroundImage: 'radial-gradient(rgba(249, 115, 22, 0.16) 1.5px, transparent 1.5px)',
                backgroundSize: '8px 8px',
                WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
              }} />
            </div>
          </div>

          {/* LTC Members Card */}
          <div 
            onClick={() => setActiveTab('ltcmembers')} 
            style={{ 
              background: '#ffffff', 
              borderRadius: '16px', 
              border: '1px solid #e2e8f0', 
              padding: '12px 14px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              position: 'relative', 
              overflow: 'hidden', 
              minHeight: '105px', 
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            className="hover:shadow-lg transition-all duration-300"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
              <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {t("LTC coordinator")}
              </span>
              <div style={{ 
                width: '34px', 
                height: '34px', 
                background: '#ffffff', 
                borderRadius: '10px', 
                boxShadow: '0 6px 15px -3px rgba(34, 197, 94, 0.15)', 
                border: '1px solid rgba(34, 197, 94, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Shield size={18} color="#16a34a" strokeWidth={2.4} />
              </div>
            </div>
            <div style={{ zIndex: 2, marginTop: '4px' }}>
              <h3 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {ltcCount}
              </h3>
            </div>
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '90px', 
              height: '70px', 
              background: 'radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.07), transparent 70%)',
              pointerEvents: 'none',
              zIndex: 1
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                backgroundImage: 'radial-gradient(rgba(34, 197, 94, 0.16) 1.5px, transparent 1.5px)',
                backgroundSize: '8px 8px',
                WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
              }} />
            </div>
          </div>
        </div>

        {/* SECTION 2: Active Batch Metrics */}
        <div className="dashboard-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', width: '100%' }}>
          
          {/* Card 1: Undertakings */}
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.01), 0 10px 30px rgba(0,0,0,0.02)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '210px',
              height: '210px'
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              borderBottom: '1px solid #f1f5f9',
              zIndex: 2
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ 
                  width: '38px', 
                  height: '38px', 
                  background: '#ffffff', 
                  borderRadius: '10px', 
                  boxShadow: '0 6px 15px -3px rgba(37, 99, 235, 0.15)', 
                  border: '1px solid rgba(37, 99, 235, 0.08)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center'
                }}>
                  <CheckSquare size={20} color="#2563eb" strokeWidth={2.4} />
                </div>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Undertakings Status")}
                </span>
              </div>
            </div>

            {/* Body */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              flex: 1,
              padding: '8px 16px',
              zIndex: 2
            }}>
              {!activeBatch ? (
                <div className="text-xs text-on-surface-variant font-semibold py-6">{t("No Active Batch")}</div>
              ) : (
                <>
                  {/* Students Progress */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ position: 'relative', width: '95px', height: '95px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path 
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                          fill="none" 
                          stroke="#eff6ff" 
                          strokeWidth="2.5"
                        />
                        {studentUndertakingPct > 0 ? (
                          <path 
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                            fill="none" 
                            stroke="url(#blueGradientMobile)" 
                            strokeDasharray={`${studentUndertakingPct}, 100`} 
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        ) : null}
                        {studentUndertakingPct === 0 && (
                          <circle cx="18" cy="2.0845" r="1.2" fill="#2563eb" />
                        )}
                        <defs>
                          <linearGradient id="blueGradientMobile" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#2563eb" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>{studentUndertakingPct}%</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t("Students")}
                    </span>
                  </div>

                  {/* Faculty Progress */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ position: 'relative', width: '95px', height: '95px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path 
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                          fill="none" 
                          stroke="#eff6ff" 
                          strokeWidth="2.5"
                        />
                        {facultyUndertakingPct > 0 ? (
                          <path 
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                            fill="none" 
                            stroke="url(#blueGradientMobile)" 
                            strokeDasharray={`${facultyUndertakingPct}, 100`} 
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        ) : null}
                        {facultyUndertakingPct === 0 && (
                          <circle cx="18" cy="2.0845" r="1.2" fill="#2563eb" />
                        )}
                      </svg>
                      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>{facultyUndertakingPct}%</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t("Faculty")}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Watermarks */}
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              left: 0, 
              width: '80px', 
              height: '90px', 
              backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px)', 
              backgroundSize: '8px 8px', 
              WebkitMaskImage: 'radial-gradient(circle at bottom left, black 20%, transparent 80%)',
              maskImage: 'radial-gradient(circle at bottom left, black 20%, transparent 80%)',
              pointerEvents: 'none',
              zIndex: 1
            }} />
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '80px', 
              height: '90px', 
              backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px)', 
              backgroundSize: '8px 8px', 
              WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
              maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
              pointerEvents: 'none',
              zIndex: 1
            }} />
          </div>

          {/* Card 2: Feedbacks */}
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.01), 0 10px 30px rgba(0,0,0,0.02)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '210px',
              height: '210px'
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              borderBottom: '1px solid #f1f5f9',
              zIndex: 2
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ 
                  width: '38px', 
                  height: '38px', 
                  background: '#ffffff', 
                  borderRadius: '10px', 
                  boxShadow: '0 6px 15px -3px rgba(37, 99, 235, 0.15)', 
                  border: '1px solid rgba(37, 99, 235, 0.08)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <MessageSquare size={20} color="#2563eb" strokeWidth={2.4} />
                </div>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Feedbacks Status")}
                </span>
              </div>
            </div>

            {/* Body */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              flex: 1,
              padding: '8px 16px',
              zIndex: 2
            }}>
              {!activeBatch ? (
                <div className="text-xs text-on-surface-variant font-semibold py-6">{t("No Active Batch")}</div>
              ) : (
                <>
                  {/* Pre-LTC Feedback Progress */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ position: 'relative', width: '95px', height: '95px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path 
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                          fill="none" 
                          stroke="#eff6ff" 
                          strokeWidth="2.5"
                        />
                        {studentPreFeedbackPct > 0 ? (
                          <path 
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                            fill="none" 
                            stroke="url(#blueFeedbackGradientMobile)" 
                            strokeDasharray={`${studentPreFeedbackPct}, 100`} 
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        ) : null}
                        {studentPreFeedbackPct === 0 && (
                          <circle cx="18" cy="2.0845" r="1.2" fill="#2563eb" />
                        )}
                        <defs>
                          <linearGradient id="blueFeedbackGradientMobile" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#2563eb" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>{studentPreFeedbackPct}%</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t("Pre-LTC Feedback")}
                    </span>
                  </div>

                  {/* Post-LTC Feedback Progress */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ position: 'relative', width: '95px', height: '95px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path 
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                          fill="none" 
                          stroke="#eff6ff" 
                          strokeWidth="2.5"
                        />
                        {studentPostFeedbackPct > 0 ? (
                          <path 
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                            fill="none" 
                            stroke="url(#blueFeedbackGradientMobile)" 
                            strokeDasharray={`${studentPostFeedbackPct}, 100`} 
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        ) : null}
                        {studentPostFeedbackPct === 0 && (
                          <circle cx="18" cy="2.0845" r="1.2" fill="#2563eb" />
                        )}
                      </svg>
                      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>{studentPostFeedbackPct}%</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t("Post-LTC Feedback")}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Watermarks */}
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              left: 0, 
              width: '80px', 
              height: '90px', 
              backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px)', 
              backgroundSize: '8px 8px', 
              WebkitMaskImage: 'radial-gradient(circle at bottom left, black 20%, transparent 80%)',
              maskImage: 'radial-gradient(circle at bottom left, black 20%, transparent 80%)',
              pointerEvents: 'none',
              zIndex: 1
            }} />
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '80px', 
              height: '90px', 
              backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px)', 
              backgroundSize: '8px 8px', 
              WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
              maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
              pointerEvents: 'none',
              zIndex: 1
            }} />
          </div>

        </div>

        <TimetablePanel compact={true} onViewDetail={() => { setActiveTab('mobile-tools'); setMobileSubTool('timetable'); }} />
      </div>
    )
  }

  const renderMobilePeople = () => {
    if (users.length === 0) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '20px',
          textAlign: 'center',
          boxSizing: 'border-box'
        }} className="animate-fade-in">
          <div style={{
            background: 'rgba(37, 99, 235, 0.05)',
            borderRadius: '50%',
            width: '80px',
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            color: '#0f172a'
          }}>
            <Users size={40} />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>No Data Available</h3>
          <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '280px', margin: '0 auto 24px', lineHeight: '1.5' }}>
            There is currently no people data registered in the portal.
          </p>
          <button 
            className="btn btn-outline" 
            onClick={fetchUsers}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={14} /> Refresh Data
          </button>
        </div>
      )
    }

    return (
      <div className="mobile-people-wrapper animate-fade-in" style={{ padding: '4px 8px 8px' }}>
        <div 
          className="mobile-subtabs" 
          style={{ 
            display: 'flex', 
            background: 'rgba(120, 120, 128, 0.08)', 
            padding: '3px', 
            borderRadius: '14px', 
            marginBottom: '14px',
            position: 'relative', 
            userSelect: 'none'
          }}
        >
          {/* iOS-Style Sliding Backdrop Indicator */}
          <div 
            style={{
              position: 'absolute',
              top: '3px',
              bottom: '3px',
              left: '3px',
              width: 'calc(33.333% - 4px)',
              background: '#ffffff',
              borderRadius: '11px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 3px 8px rgba(0,0,0,0.04)',
              transform: `translateX(${['faculty', 'students', 'ltcmembers'].indexOf(mobilePeopleTab) * 100}%)`,
              transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              zIndex: 1
            }} 
          />

          <button 
            className={`mobile-subtab-btn ${mobilePeopleTab === 'faculty' ? 'active' : ''}`} 
            style={{ 
              flex: 1, 
              background: 'none', 
              border: 'none', 
              padding: '8px 10px', 
              borderRadius: '11px', 
              fontSize: '13px', 
              fontWeight: '600', 
              color: mobilePeopleTab === 'faculty' ? '#0f172a' : '#64748b', 
              transition: 'color 0.25s ease',
              position: 'relative',
              zIndex: 2,
              cursor: 'pointer',
              outline: 'none',
              boxShadow: 'none'
            }} 
            onClick={() => setMobilePeopleTab('faculty')}
          >
            {t("Faculty")}
          </button>
          
          <button 
            className={`mobile-subtab-btn ${mobilePeopleTab === 'students' ? 'active' : ''}`} 
            style={{ 
              flex: 1, 
              background: 'none', 
              border: 'none', 
              padding: '8px 10px', 
              borderRadius: '11px', 
              fontSize: '13px', 
              fontWeight: '600', 
              color: mobilePeopleTab === 'students' ? '#0f172a' : '#64748b', 
              transition: 'color 0.25s ease',
              position: 'relative',
              zIndex: 2,
              cursor: 'pointer',
              outline: 'none',
              boxShadow: 'none'
            }} 
            onClick={() => setMobilePeopleTab('students')}
          >
            {t("Students")}
          </button>
          
          <button 
            className={`mobile-subtab-btn ${mobilePeopleTab === 'ltcmembers' ? 'active' : ''}`} 
            style={{ 
              flex: 1, 
              background: 'none', 
              border: 'none', 
              padding: '8px 10px', 
              borderRadius: '11px', 
              fontSize: '13px', 
              fontWeight: '600', 
              color: mobilePeopleTab === 'ltcmembers' ? '#0f172a' : '#64748b', 
              transition: 'color 0.25s ease',
              position: 'relative',
              zIndex: 2,
              cursor: 'pointer',
              outline: 'none',
              boxShadow: 'none'
            }} 
            onClick={() => setMobilePeopleTab('ltcmembers')}
          >
            {t("LTC Members")}
          </button>
        </div>

        <div className="mobile-people-content">
          {mobilePeopleTab === 'faculty' && (
            <Suspense fallback={<div style={{padding:24,textAlign:'center',color:'var(--text-3)'}}>Loading…</div>}>
              <FacultyModule
                faculties={faculties}
                facultyPg={facultyPg}
                facultySearch={facultySearch}
                setFacultySearch={setFacultySearch}
                setIsFacultyModalOpen={setIsFacultyModalOpen}
                handleUpdatePanel={handleUpdatePanel}
                handleViewFeedback={handleViewFeedback}
                handleDeleteUser={handleDeleteUser}
                fetchUsers={fetchUsers}
                PaginationBar={PaginationBar}
                hideTitle={true}
                apiFetch={apiFetch}
                toast={toast}
                facultyDivFilter={facultyDivFilter}
                setFacultyDivFilter={setFacultyDivFilter}
                facultyFacFilter={facultyFacFilter}
                setFacultyFacFilter={setFacultyFacFilter}
                facultySchoolFilter={facultySchoolFilter}
                setFacultySchoolFilter={setFacultySchoolFilter}
                facultyDeptFilter={facultyDeptFilter}
                setFacultyDeptFilter={setFacultyDeptFilter}
                facultyTypeFilter={facultyTypeFilter}
                setFacultyTypeFilter={setFacultyTypeFilter}
                availableFacultyDivisions={availableFacultyDivisions}
                availableFacultyFaculties={availableFacultyFaculties}
                availableFacultySchools={availableFacultySchools}
                availableFacultyDepartments={availableFacultyDepartments}
              />
            </Suspense>
          )}

          {mobilePeopleTab === 'students' && (
            <Suspense fallback={<div style={{padding:24,textAlign:'center',color:'var(--text-3)'}}>Loading…</div>}>
              <StudentsModule
                users={users}
                students={students}
                studentPg={studentPg}
                studentSearch={studentSearch}
                setStudentSearch={setStudentSearch}
                selectedSchool={selectedSchool}
                setSelectedSchool={setSelectedSchool}
                selectedDepartment={selectedDepartment}
                setSelectedDepartment={setSelectedDepartment}
                selectedDivision={selectedDivision}
                setSelectedDivision={setSelectedDivision}
                selectedPanel={selectedPanel}
                setSelectedPanel={setSelectedPanel}
                selectedFaculty={selectedFaculty}
                setSelectedFaculty={setSelectedFaculty}
                availableSchools={availableSchools}
                availableDepartments={availableDepartments}
                availableDivisions={availableDivisions}
                availablePanels={availablePanels}
                availableFaculties={availableFaculties}
                setIsStudentModalOpen={setIsStudentModalOpen}
                handleUpdatePanel={handleUpdatePanel}
                handleUpdateInsurance={handleUpdateInsurance}
                handleToggleStudentBatch={handleToggleStudentBatch}
                handleViewFeedback={handleViewFeedback}
                handleDeleteUser={handleDeleteUser}
                fetchUsers={fetchUsers}
                batches={batches}
                PaginationBar={PaginationBar}
                hideTitle={true}
                apiFetch={apiFetch}
                toast={toast}
              />
            </Suspense>
          )}

          {mobilePeopleTab === 'ltcmembers' && (
            <Suspense fallback={<div style={{padding:24,textAlign:'center',color:'var(--text-3)'}}>Loading…</div>}>
              <LtcMembersModule
                ltcMembers={ltcMembers}
                ltcMemberPg={ltcMemberPg}
                ltcMemberSearch={ltcMemberSearch}
                setLtcMemberSearch={setLtcMemberSearch}
                setIsLtcMemberModalOpen={setIsLtcModalOpen}
                handleDeleteUser={handleDeleteUser}
                fetchUsers={fetchUsers}
                PaginationBar={PaginationBar}
                apiFetch={apiFetch}
                toast={toast}
                hideTitle={true}
              />
            </Suspense>
          )}
        </div>
      </div>
    )
  }

  const renderMobileTools = () => {
    if (!mobileSubTool) {
      return (
        <div className="flex flex-col gap-4 animate-fade-in" style={{ padding: '4px 0px 8px 0px' }}>
          {/* Header section matching premium feel */}
          <div style={{ padding: '0px 8px 0 8px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {t("Administrative Tools")}
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0', fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: '1.4' }}>
              {t("Access management tools, documents, logs and updates")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" style={{ padding: '0 8px' }}>
            {/* Bulk Upload Card */}
            <div
              className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              onClick={() => setMobileSubTool('bulk')}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                minHeight: '145px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  background: '#ffffff',
                  borderRadius: '10px',
                  boxShadow: '0 6px 15px -3px rgba(37, 99, 235, 0.15)',
                  border: '1px solid rgba(37, 99, 235, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <UploadCloud size={20} color="#2563eb" strokeWidth={2.4} />
                </div>
                <ChevronRight size={18} color="#94a3b8" />
              </div>
              <div style={{ zIndex: 2, marginTop: '16px' }}>
                <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Bulk Upload")}
                </h4>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0', fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: '1.4' }}>
                  {t("Import students & faculty lists")}
                </p>
              </div>
              <div style={{ 
                position: 'absolute', 
                bottom: 0, 
                right: 0, 
                width: '120px', 
                height: '100px', 
                background: 'radial-gradient(circle at bottom right, rgba(37, 99, 235, 0.07), transparent 70%)',
                pointerEvents: 'none',
                zIndex: 1
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: 'radial-gradient(rgba(37, 99, 235, 0.16) 1.5px, transparent 1.5px)',
                  backgroundSize: '8px 8px',
                  WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                  maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                }} />
              </div>
            </div>

            {/* Timetable Card */}
            <div
              className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              onClick={() => setMobileSubTool('timetable')}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                minHeight: '145px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  background: '#ffffff',
                  borderRadius: '10px',
                  boxShadow: '0 6px 15px -3px rgba(124, 58, 237, 0.15)',
                  border: '1px solid rgba(124, 58, 237, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Clock size={20} color="#7c3aed" strokeWidth={2.4} />
                </div>
                <ChevronRight size={18} color="#94a3b8" />
              </div>
              <div style={{ zIndex: 2, marginTop: '16px' }}>
                <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Timetable")}
                </h4>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0', fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: '1.4' }}>
                  {t("Manage LAP schedules & events")}
                </p>
              </div>
              <div style={{ 
                position: 'absolute', 
                bottom: 0, 
                right: 0, 
                width: '120px', 
                height: '100px', 
                background: 'radial-gradient(circle at bottom right, rgba(124, 58, 237, 0.07), transparent 70%)',
                pointerEvents: 'none',
                zIndex: 1
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: 'radial-gradient(rgba(124, 58, 237, 0.16) 1.5px, transparent 1.5px)',
                  backgroundSize: '8px 8px',
                  WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                  maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                }} />
              </div>
            </div>

            {/* Documents Card */}
            <div
              className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              onClick={() => setMobileSubTool('documents')}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                minHeight: '145px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  background: '#ffffff',
                  borderRadius: '10px',
                  boxShadow: '0 6px 15px -3px rgba(13, 148, 136, 0.15)',
                  border: '1px solid rgba(13, 148, 136, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileText size={20} color="#0d9488" strokeWidth={2.4} />
                </div>
                <ChevronRight size={18} color="#94a3b8" />
              </div>
              <div style={{ zIndex: 2, marginTop: '16px' }}>
                <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Documents & SOPs")}
                </h4>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0', fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: '1.4' }}>
                  {t("Guidelines, forms & SOP manuals")}
                </p>
              </div>
              <div style={{ 
                position: 'absolute', 
                bottom: 0, 
                right: 0, 
                width: '120px', 
                height: '100px', 
                background: 'radial-gradient(circle at bottom right, rgba(13, 148, 136, 0.07), transparent 70%)',
                pointerEvents: 'none',
                zIndex: 1
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: 'radial-gradient(rgba(13, 148, 136, 0.16) 1.5px, transparent 1.5px)',
                  backgroundSize: '8px 8px',
                  WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                  maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                }} />
              </div>
            </div>

            {/* Reports Card */}
            <div
              className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              onClick={() => setMobileSubTool('reports')}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                minHeight: '145px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  background: '#ffffff',
                  borderRadius: '10px',
                  boxShadow: '0 6px 15px -3px rgba(225, 29, 72, 0.15)',
                  border: '1px solid rgba(225, 29, 72, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <BarChart2 size={20} color="#e11d48" strokeWidth={2.4} />
                </div>
                <ChevronRight size={18} color="#94a3b8" />
              </div>
              <div style={{ zIndex: 2, marginTop: '16px' }}>
                <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Reports & Logs")}
                </h4>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0', fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: '1.4' }}>
                  {t("View system audit logs & analytics")}
                </p>
              </div>
              <div style={{ 
                position: 'absolute', 
                bottom: 0, 
                right: 0, 
                width: '120px', 
                height: '100px', 
                background: 'radial-gradient(circle at bottom right, rgba(225, 29, 72, 0.07), transparent 70%)',
                pointerEvents: 'none',
                zIndex: 1
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: 'radial-gradient(rgba(225, 29, 72, 0.16) 1.5px, transparent 1.5px)',
                  backgroundSize: '8px 8px',
                  WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                  maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                }} />
              </div>
            </div>

            {/* Mailbox Card */}
            <div
              className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              onClick={() => setMobileSubTool('orientation')}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                minHeight: '145px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  background: '#ffffff',
                  borderRadius: '10px',
                  boxShadow: '0 6px 15px -3px rgba(234, 88, 12, 0.15)',
                  border: '1px solid rgba(234, 88, 12, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Mail size={20} color="#ea580c" strokeWidth={2.4} />
                </div>
                <ChevronRight size={18} color="#94a3b8" />
              </div>
              <div style={{ zIndex: 2, marginTop: '16px' }}>
                <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Mailbox")}
                </h4>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0', fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: '1.4' }}>
                  {t("Send welcome emails & batch updates")}
                </p>
              </div>
              <div style={{ 
                position: 'absolute', 
                bottom: 0, 
                right: 0, 
                width: '120px', 
                height: '100px', 
                background: 'radial-gradient(circle at bottom right, rgba(234, 88, 12, 0.07), transparent 70%)',
                pointerEvents: 'none',
                zIndex: 1
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: 'radial-gradient(rgba(234, 88, 12, 0.16) 1.5px, transparent 1.5px)',
                  backgroundSize: '8px 8px',
                  WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                  maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                }} />
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="mobile-tool-detail animate-fade-in" style={{ padding: '4px 8px 8px' }}>
        <button onClick={() => setMobileSubTool(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#0f172a', fontSize: '13px', fontWeight: '700', marginBottom: '16px', padding: 0, cursor: 'pointer' }}>
          &larr; Back to Tools
        </button>

        {mobileSubTool === 'timetable' && <TimetablePanel />}
        {mobileSubTool === 'documents' && (
          <Suspense fallback={<div style={{padding:24,textAlign:'center',color:'var(--text-3)'}}>Loading…</div>}>
            <DocumentsModule
              documents={documents}
              docForm={docForm}
              setDocForm={setDocForm}
              handleUploadDocument={handleUploadDocument}
              handleDeleteDocument={handleDeleteDocument}
              Label={Label}
            />
          </Suspense>
        )}
        {mobileSubTool === 'reports' && (
          <Suspense fallback={<div style={{padding:24,textAlign:'center',color:'var(--text-3)'}}>Loading…</div>}>
            <ReportsModule token={token} toast={toast} />
          </Suspense>
        )}
        {mobileSubTool === 'submissions' && (
          <FeedbackTab 
            token={token} 
            apiBase={API} 
            showToast={toast} 
            batches={batches} 
          />
        )}
        {mobileSubTool === 'ai-form-analysis' && (
          <AiFormAnalysisTab 
            token={token} 
            isReadOnly={false} 
            onToast={toast} 
          />
        )}
        {mobileSubTool === 'orientation' && renderOrientationView()}
        {mobileSubTool === 'bulk' && (
          <div className="animate-fade-in">
            <BulkUploadModule
              isLtcUpload={isLtcUpload}
              setIsLtcUpload={setIsLtcUpload}
              bulkData={bulkData}
              isUploading={isUploading}
              handleFileUpload={isLtcUpload ? handleLtcBulkUpload : handleFileUpload}
              handleLtcFileUpload={handleLtcBulkUpload}
              handleStudentFileUpload={handleFileUpload}
              submitBulkUpload={submitBulkUpload}
              batches={batches}
              selectedBatchId={selectedUploadBatchId}
              onSelectBatch={setSelectedUploadBatchId}
              t={t}
              uploadedFileName={bulkUploadFile?.name}
              onClearFile={handleClearFile}
            />
          </div>
        )}
      </div>
    )
  }

  const renderMobileProfile = () => {
    return (
      <div className="mobile-profile animate-fade-in" style={{ padding: '24px 16px' }}>
        <div className="mobile-profile-card" style={{ background: '#ffffff', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '32px', background: '#07111f', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800' }}>AD</div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Admin</h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>{currentUser?.email || 'admin@ltc.edu'}</p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '32px' }}>
          <button className="btn" style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', justifyContent: 'center', height: '48px', borderRadius: '12px', fontSize: '14px', fontWeight: '700' }} onClick={handleLogout}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    )
  }

  // ─── Desktop Redesign Render Helpers ─────────────────────────────────────────
  const getGreetingConfig = () => {
    const hours = new Date().getHours()
    if (hours < 12) {
      return {
        text: 'Good Morning, Admin! ',
        sub: 'Have a productive and wonderful morning'
      }
    }
    if (hours < 18) {
      return {
        text: 'Good Afternoon, Admin! ',
        sub: 'Hope your day is going smoothly'
      }
    }
    return {
      text: 'Good Evening, Admin! ',
      sub: 'Wrapping up the day — great work today'
    }
  }

  const getGreeting = () => {
    const hours = new Date().getHours()
    if (hours < 12) return 'Good Morning, Admin'
    if (hours < 18) return 'Good Afternoon, Admin'
    return 'Good Evening, Admin'
  }

  const renderDonutChart = () => {
    const studCount = users.filter(u => u.role === 'student').length
    const facCount = users.filter(u => u.role === 'faculty').length
    const ltcCount = users.filter(u => u.role === 'ltc_member').length
    const admCount = users.filter(u => u.role === 'admin').length
    const total = studCount + facCount + ltcCount + admCount
    
    if (total === 0) return null

    const r = 50
    const C = 2 * Math.PI * r
    let accumulatedPercent = 0

    const segments = [
      { val: studCount, color: '#0f172a', label: 'Students' },
      { val: facCount, color: '#0f172a', label: 'Faculty' },
      { val: ltcCount, color: '#0f172a', label: 'LTC Members' },
      { val: admCount, color: '#0f172a', label: 'Others' }
    ].filter(x => x.val > 0)

    return (
      <div className="desktop-overview-container">
        <svg width="150" height="150" viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
          <circle cx="80" cy="80" r={r} fill="transparent" stroke="#f1f5f9" strokeWidth="14" />
          {segments.map((seg, idx) => {
            const percent = seg.val / total
            const strokeDasharray = `${percent * C} ${C}`
            const strokeDashoffset = -accumulatedPercent * C
            accumulatedPercent += percent
            return (
              <circle
                key={idx}
                cx="80"
                cy="80"
                r={r}
                fill="transparent"
                stroke={seg.color}
                strokeWidth="14"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 80 80)"
              />
            )
          })}
          <text x="80" y="76" textAnchor="middle" fontSize="10" fontWeight="700" fill="#94a3b8" letterSpacing="0.5">TOTAL USERS</text>
          <text x="80" y="96" textAnchor="middle" fontSize="18" fontWeight="800" fill="#0f172a">{total.toLocaleString()}</text>
        </svg>
        <div className="desktop-overview-legend">
          {segments.map((seg, idx) => (
            <div key={idx} className="desktop-overview-legend-item">
              <span className="desktop-overview-legend-label">
                <span className="desktop-overview-dot" style={{ backgroundColor: seg.color }} />
                <span>{seg.label}</span>
              </span>
              <span className="desktop-overview-legend-value">{seg.val.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const getRecentActivities = () => {
    if (recentActivities.length > 0) {
      return recentActivities.map(log => {
        let actText = log.action
        const mapping = {
          BATCH_CREATED: 'Batch Created',
          BATCH_UPDATED: 'Batch Updated',
          BATCH_ARCHIVED: 'Batch Archived',
          BATCH_RESTORED: 'Batch Restored',
          STUDENT_AUTO_CREATED: 'Student Registered',
          SQUAD_LEADER_UPDATED: 'Squad Leader Appointed',
          FACULTY_ASSIGNED: 'Faculty Appointed',
          FACULTY_REMOVED: 'Faculty Removed',
          BULK_UPLOAD_COMPLETED: 'Bulk Ingestion Completed'
        }
        if (mapping[log.action]) actText = mapping[log.action]
        else actText = log.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

        let timeStr = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        
        return {
          action: `${actText} by ${log.user_name || 'System'}`,
          time: timeStr,
          icon: log.action.includes('FACULTY') ? 'faculty' : (log.action.includes('BATCH') ? 'batch' : 'system')
        }
      })
    }
    
    return [
      { action: 'Dr. Rahul Karad added as new faculty', time: '2 min ago', icon: 'faculty' },
      { action: 'Batch "Immersion 48" created', time: '1 hour ago', icon: 'batch' },
      { action: 'Timetable updated for tomorrow', time: '3 hours ago', icon: 'timetable' },
      { action: 'Document "SOP Guidelines" uploaded', time: '5 hours ago', icon: 'document' }
    ]
  }

  const getScheduleIcon = (iconName, color, size = 16) => {
    switch (iconName) {
      case 'compass':
        return <Compass size={size} />;
      case 'award':
        return <Award size={size} />;
      case 'users':
        return <Users size={size} />;
      case 'activity':
        return <Activity size={size} />;
      default:
        return <Clock size={size} />;
    }
  }

  const MOCK_SCHEDULE = [
    { time: '09:00 AM', event: 'Meditation Session', location: 'Hall 1', color: '#0f172a', iconName: 'compass' },
    { time: '11:00 AM', event: 'Immersion Program', location: 'Batch 12', color: '#0f172a', iconName: 'award' },
    { time: '02:00 PM', event: 'Faculty Meeting', location: 'Conference Room', color: '#0f172a', iconName: 'users' },
    { time: '04:00 PM', event: 'Review & Feedback', location: 'Admin Office', color: '#0f172a', iconName: 'activity' }
  ]

  // ── Orientation Mailer Effects & Handlers ──
  useEffect(() => {
    if (!orientationBatchId) {
      setOrientationRecipients([])
      return
    }
    let active = true
    const fetchRecipients = async () => {
      setLoadingRecipients(true)
      try {
        const res = await fetch(`${API}/api/admin/batches/${orientationBatchId}/orientation-recipients`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json()
        if (res.ok && active) {
          setOrientationRecipients(data.recipients || [])
        } else if (active) {
          toast('error', data.message || 'Failed to fetch recipients')
        }
      } catch (err) {
        if (active) toast('error', 'Error fetching batch recipients')
      } finally {
        if (active) setLoadingRecipients(false)
      }
    }
    fetchRecipients()
    return () => { active = false }
  }, [orientationBatchId, token])

  // Helper date & time formatters for live template variables
  const formatOrientationDate = (val) => {
    if (!val) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-');
      const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }
    }
    return val;
  };

  const formatOrientationTime = (val) => {
    if (!val) return '';
    if (/^\d{2}:\d{2}$/.test(val)) {
      const [hStr, mStr] = val.split(':');
      let h = parseInt(hStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return `${h}:${mStr} ${ampm}`;
    }
    return val;
  };

  // Auto-compilation effect for predefined email templates with live dynamic binding
  useEffect(() => {
    const customT = customTemplates[selectedTemplate];
    const defaultT = ORIENTATION_TEMPLATES[selectedTemplate];
    const t = customT || defaultT;
    if (!t) return;

    if (isTemplateDirty) return; // preserve active user edits

    const selectedBatch = batches.find(b => String(b.id) === String(orientationBatchId));
    const batchName = selectedBatch ? selectedBatch.name : '{{batch_name}}';

    let compiledSubject = (t.subject || '').replace(/{{batch_name}}/g, batchName);
    let compiledBody = (t.body || '').replace(/{{batch_name}}/g, batchName);

    const extraFields = defaultT?.extraFields || [];
    if (extraFields.length > 0) {
      extraFields.forEach(f => {
        const rawVal = extraFieldValues[f.key] !== undefined ? extraFieldValues[f.key] : f.default;
        let formattedVal = rawVal;
        if (f.type === 'date') formattedVal = formatOrientationDate(rawVal) || `{{${f.key}}}`;
        else if (f.type === 'time') formattedVal = formatOrientationTime(rawVal) || `{{${f.key}}}`;
        else if (!formattedVal) formattedVal = `{{${f.key}}}`;

        const regex = new RegExp(`{{${f.key}}}`, 'g');
        compiledBody = compiledBody.replace(regex, formattedVal);
        compiledSubject = compiledSubject.replace(regex, formattedVal);
      });
    }

    if (selectedTemplate === 'orientation') {
      const rawDate = extraFieldValues['orientation_date'] || extraFieldValues['date'] || '';
      const rawTime = extraFieldValues['orientation_time'] || extraFieldValues['time'] || '';
      const rawVenue = extraFieldValues['venue'] || '';

      const dateVal = formatOrientationDate(rawDate) || '{{orientation_date}}';
      const timeVal = formatOrientationTime(rawTime) || '{{orientation_time}}';
      const venueVal = rawVenue || '{{venue}}';

      compiledBody = compiledBody
        .replace(/{{date}}/g, dateVal)
        .replace(/{{time}}/g, timeVal)
        .replace(/{{orientation_date}}/g, dateVal)
        .replace(/{{orientation_time}}/g, timeVal)
        .replace(/{{venue}}/g, venueVal);

      compiledSubject = compiledSubject
        .replace(/{{date}}/g, dateVal)
        .replace(/{{time}}/g, timeVal)
        .replace(/{{orientation_date}}/g, dateVal)
        .replace(/{{orientation_time}}/g, timeVal)
        .replace(/{{venue}}/g, venueVal);
    }

    if (selectedTemplate === 'travel') {
      const rawDepPoint = extraFieldValues['departure_point'] || '';
      const rawDepTime = extraFieldValues['departure_time'] || '';

      const depPointVal = rawDepPoint || '{{departure_point}}';
      const depTimeVal = formatOrientationTime(rawDepTime) || '{{departure_time}}';

      compiledBody = compiledBody
        .replace(/{{departure_point}}/g, depPointVal)
        .replace(/{{departure_time}}/g, depTimeVal);

      compiledSubject = compiledSubject
        .replace(/{{departure_point}}/g, depPointVal)
        .replace(/{{departure_time}}/g, depTimeVal);
    }

    setOrientationSubject(compiledSubject);
    setOrientationBody(compiledBody);
  }, [selectedTemplate, orientationBatchId, extraFieldValues, batches, customTemplates, isTemplateDirty]);

  // Explicit Handler when changing manual email template
  const handleManualTemplateChange = (templateKey) => {
    setManualTemplateKey(templateKey);
    const t = ORIENTATION_TEMPLATES[templateKey];
    if (t) {
      const targetBatchObj = batches && batches.length > 0 ? batches[0] : { name: 'Batch 1' };
      let compiledSub = t.subject.replace(/{{batch_name}}/g, targetBatchObj.name || 'Batch 1');
      let compiledBdy = t.body.replace(/{{batch_name}}/g, targetBatchObj.name || 'Batch 1');
      setManualSubject(compiledSub);
      setManualBody(compiledBdy);
      setManualRecipientEmail(t.recipients || '');

      if (t.defaultRoles) {
        if (t.defaultRoles.faculty) setManualPreviewRole('faculty');
        else if (t.defaultRoles.ltc_member) setManualPreviewRole('ltc_member');
        else if (t.defaultRoles.student) setManualPreviewRole('student');
      }

      if (t.extraFields && t.extraFields.length > 0) {
        const defaults = {};
        t.extraFields.forEach(f => {
          defaults[f.key] = f.default || '';
        });
        setManualExtraFieldValues(defaults);
      } else {
        setManualExtraFieldValues({});
      }
    }
  };

  // Real-time live preview content calculator for Manual Email Sender
  const manualPreviewContent = useMemo(() => {
    const sampleUserByRole = {
      student: { name: 'Rahul Sharma', role: 'student', email: (parsedManualEmails.valid[0] || 'student@example.com'), squad: 'Surya' },
      faculty: { name: 'Dr. Anita Roy', role: 'faculty', email: (parsedManualEmails.valid[0] || 'faculty@example.com'), squad: 'Surya' },
      parent: { name: 'Parent of Rahul Sharma', role: 'parent', email: (parsedManualEmails.valid[0] || 'parent@example.com'), squad: 'Surya' },
      ltc_member: { name: 'Vikram Singh', role: 'ltc_member', email: (parsedManualEmails.valid[0] || 'ltc@example.com'), squad: 'Surya' }
    };

    const userObj = sampleUserByRole[manualPreviewRole] || sampleUserByRole.student;
    const targetBatchObj = batches && batches.length > 0 ? batches[0] : { name: 'Batch 1', start_date: '2026-08-01', end_date: '2026-08-15' };

    const startDateStr = manualExtraFieldValues['start_date'] ? formatOrientationDate(manualExtraFieldValues['start_date']) : (targetBatchObj.start_date ? new Date(targetBatchObj.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '01 Aug 2026');
    const endDateStr = manualExtraFieldValues['end_date'] ? formatOrientationDate(manualExtraFieldValues['end_date']) : (targetBatchObj.end_date ? new Date(targetBatchObj.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '15 Aug 2026');
    const roleName = userObj.role === 'student' ? 'Student' : (userObj.role === 'ltc_member' ? 'LTC Member' : (userObj.role === 'parent' ? 'Parent' : 'Faculty'));
    const defaultPassword = userObj.role === 'student' ? 'student123' : (userObj.role === 'ltc_member' ? 'ltc123' : 'faculty123');
    const portalLoginUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : 'http://13.207.119.57/login';
    const deadlineVal = manualExtraFieldValues['deadline'] || '26 July, 11:55 PM';

    let rawBody = manualBody || '';

    let parsedSubject = (manualSubject || '')
      .replace(/{{name}}/g, userObj.name || '')
      .replace(/{{role}}/g, roleName)
      .replace(/{{batch_name}}/g, targetBatchObj.name || 'Batch 1')
      .replace(/{{deadline}}/g, deadlineVal);

    let parsedBody = rawBody
      .replace(/{{name}}/g, userObj.name || '')
      .replace(/{{role}}/g, roleName)
      .replace(/{{batch_name}}/g, targetBatchObj.name || 'Batch 1')
      .replace(/{{squad}}/g, userObj.squad || 'Surya')
      .replace(/{{email}}/g, userObj.email)
      .replace(/{{password}}/g, defaultPassword)
      .replace(/{{start_date}}/g, startDateStr)
      .replace(/{{end_date}}/g, endDateStr)
      .replace(/{{deadline}}/g, deadlineVal)
      .replace(/{{login_url}}/g, portalLoginUrl);

    Object.keys(manualExtraFieldValues).forEach(key => {
      let val = manualExtraFieldValues[key] || '';
      if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        val = formatOrientationDate(val);
      }
      const reg = new RegExp(`{{${key}}}`, 'g');
      if (val) {
        parsedBody = parsedBody.replace(reg, val);
        parsedSubject = parsedSubject.replace(reg, val);
      }
    });

    return { parsedSubject, parsedBody, userObj };
  }, [manualSubject, manualBody, manualPreviewRole, manualExtraFieldValues, manualRecipientEmail, parsedManualEmails, batches]);

  // When changing templates, reset roles & extra fields
  const handleTemplateChange = (templateKey) => {
    setSelectedTemplate(templateKey);
    setIsTemplateDirty(false);
    const t = ORIENTATION_TEMPLATES[templateKey];
    if (t) {
      if (templateKey === 'faculty_data_collection') {
        setPreviewRecipientRole('faculty');
      }
      setRecipientRoles({
        student: false,
        faculty: false,
        ltc_member: false,
        parent: false,
        ...(t.defaultRoles || {})
      });
      const defaults = {};
      (t.extraFields || []).forEach(f => {
        defaults[f.key] = f.default ?? '';
      });
      setExtraFieldValues(defaults);
    }
    setIsCustomizingTemplate(false);
  };

  // Save customized communication template to database
  const handleSaveCommunicationTemplate = async () => {
    if (!orientationSubject || !orientationSubject.trim()) {
      toast('error', 'Email subject is required to save template.');
      return;
    }
    if (!orientationBody || !orientationBody.trim()) {
      toast('error', 'Message body is required to save template.');
      return;
    }

    setIsSavingCustomTemplate(true);
    try {
      const templateName = ORIENTATION_TEMPLATES[selectedTemplate]?.name || selectedTemplate;
      const res = await apiFetch(`/api/admin/communication/templates/${selectedTemplate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          subject: orientationSubject,
          body: orientationBody,
          variables: ['{{name}}', '{{role}}', '{{batch_name}}', '{{squad}}', '{{email}}', '{{start_date}}', '{{end_date}}', '{{login_url}}']
        })
      });
      const data = await res.json();
      if (res && res.ok) {
        setCustomTemplates(prev => ({
          ...prev,
          [selectedTemplate]: data.template
        }));
        setIsTemplateDirty(false);
        setIsCustomizingTemplate(false);
        toast('success', `"${templateName}" customized & saved permanently to database!`);
      } else {
        toast('error', data.message || 'Failed to save template customization.');
      }
    } catch (err) {
      console.error(err);
      toast('error', 'Error saving template customization.');
    } finally {
      setIsSavingCustomTemplate(false);
    }
  };

  // Restore communication template to system default
  const handleRestoreCommunicationTemplateDefault = async () => {
    const templateName = ORIENTATION_TEMPLATES[selectedTemplate]?.name || selectedTemplate;
    if (!window.confirm(`Are you sure you want to restore "${templateName}" to system default? Your customized subject and body will be removed from the database.`)) {
      return;
    }

    setIsRestoringDefault(true);
    try {
      const res = await apiFetch(`/api/admin/communication/templates/${selectedTemplate}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res && res.ok) {
        setCustomTemplates(prev => {
          const next = { ...prev };
          delete next[selectedTemplate];
          return next;
        });
        setIsTemplateDirty(false);
        setIsCustomizingTemplate(false);

        // Reset subject and body to default
        const defaultT = ORIENTATION_TEMPLATES[selectedTemplate];
        if (defaultT) {
          const selectedBatch = batches.find(b => String(b.id) === String(orientationBatchId));
          const batchName = selectedBatch ? selectedBatch.name : '{{batch_name}}';
          setOrientationSubject(defaultT.subject.replace(/{{batch_name}}/g, batchName));
          setOrientationBody(defaultT.body.replace(/{{batch_name}}/g, batchName));
        }
        toast('success', `"${templateName}" restored to system default.`);
      } else {
        toast('error', data.message || 'Failed to restore default template.');
      }
    } catch (err) {
      console.error(err);
      toast('error', 'Error restoring default template.');
    } finally {
      setIsRestoringDefault(false);
    }
  };

  // Cancel unsaved changes in template editor
  const handleCancelTemplateEdit = () => {
    setIsTemplateDirty(false);
    setIsCustomizingTemplate(false);
    const customT = customTemplates[selectedTemplate];
    const defaultT = ORIENTATION_TEMPLATES[selectedTemplate];
    const sourceT = customT || defaultT;
    if (sourceT) {
      const selectedBatch = batches.find(b => String(b.id) === String(orientationBatchId));
      const batchName = selectedBatch ? selectedBatch.name : '{{batch_name}}';
      setOrientationSubject((sourceT.subject || '').replace(/{{batch_name}}/g, batchName));
      setOrientationBody((sourceT.body || '').replace(/{{batch_name}}/g, batchName));
    }
  };

  // Insert a variable tag into orientation body editor at cursor position
  const insertVariableIntoTemplate = (varTag) => {
    const textarea = document.getElementById('orientation-body-editor');
    if (textarea) {
      const start = textarea.selectionStart ?? orientationBody.length;
      const end = textarea.selectionEnd ?? orientationBody.length;
      const current = orientationBody || '';
      const newBody = current.substring(0, start) + varTag + current.substring(end);
      setOrientationBody(newBody);
      setIsTemplateDirty(true);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + varTag.length, start + varTag.length);
      }, 30);
    } else {
      setOrientationBody(prev => (prev || '') + ' ' + varTag);
      setIsTemplateDirty(true);
    }
  };

  const filteredRecipients = useMemo(() => {
    const list = [];
    orientationRecipients.forEach(r => {
      if (r.role === 'student' && recipientRoles.student) {
        list.push(r);
      }
      if (r.role === 'faculty' && recipientRoles.faculty) {
        list.push(r);
      }
      if (r.role === 'ltc_member' && recipientRoles.ltc_member) {
        list.push(r);
      }
      if (recipientRoles.parent && r.role === 'student' && r.parent_email && r.parent_email.trim()) {
        list.push({
          id: `parent-${r.id}`,
          name: `Parent of ${r.name}`,
          email: r.parent_email.trim(),
          role: 'parent',
          squad: r.squad
        });
      }
    });
    return list;
  }, [orientationRecipients, recipientRoles]);

  const recipientSummaryMetrics = useMemo(() => {
    const studentRecipients = orientationRecipients.filter(r => r.role === 'student');
    const facultyRecipients = orientationRecipients.filter(r => r.role === 'faculty');
    const ltcRecipients = orientationRecipients.filter(r => r.role === 'ltc_member');

    const totalStudents = studentRecipients.length;
    const studentsWithParent = studentRecipients.filter(r => r.parent_email && r.parent_email.trim() !== '');
    const totalParents = studentsWithParent.length;
    const linkedPairs = studentsWithParent.length;
    const missingParentStudents = studentRecipients.filter(r => !r.parent_email || r.parent_email.trim() === '');
    const totalMissingParents = missingParentStudents.length;

    const panelsSet = new Set();
    studentRecipients.forEach(s => {
      if (s.panel && String(s.panel).trim() && String(s.panel).trim() !== '—') panelsSet.add(String(s.panel).trim());
    });
    const availablePanels = Array.from(panelsSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return {
      totalStudents,
      totalParents,
      linkedPairs,
      totalMissingParents,
      missingParentStudents,
      studentRecipients,
      facultyRecipients,
      ltcRecipients,
      availablePanels
    };
  }, [orientationRecipients]);

  const filteredStudentRecipients = useMemo(() => {
    let list = recipientSummaryMetrics.studentRecipients;

    if (missingParentPanelFilter !== 'ALL') {
      const pFilter = missingParentPanelFilter.toLowerCase();
      list = list.filter(s => {
        const sPanel = (s.panel || '').toLowerCase();
        const sSquad = (s.squad || '').toLowerCase();
        return sPanel === pFilter || sPanel.includes(pFilter) || sSquad.includes(pFilter);
      });
    }

    if (previewParentFilter === 'LINKED') {
      list = list.filter(s => s.parent_email && s.parent_email.trim() !== '');
    } else if (previewParentFilter === 'MISSING') {
      list = list.filter(s => !s.parent_email || s.parent_email.trim() === '');
    }

    if (previewSearchText.trim()) {
      const q = previewSearchText.toLowerCase();
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.prn || '').toLowerCase().includes(q) ||
        (s.parent_email || '').toLowerCase().includes(q) ||
        (s.squad || '').toLowerCase().includes(q) ||
        (s.panel || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [recipientSummaryMetrics.studentRecipients, missingParentPanelFilter, previewParentFilter, previewSearchText]);

  const totalStudentPages = Math.max(1, Math.ceil(filteredStudentRecipients.length / previewPageSize));

  const paginatedStudentRecipients = useMemo(() => {
    const startIdx = (previewCurrentPage - 1) * previewPageSize;
    return filteredStudentRecipients.slice(startIdx, startIdx + previewPageSize);
  }, [filteredStudentRecipients, previewCurrentPage, previewPageSize]);

  const handleDownloadMissingParentList = (panelFilter = 'ALL') => {
    if (!orientationBatchId) {
      toast('warning', 'Please select a batch first.');
      return;
    }

    const missingList = recipientSummaryMetrics.missingParentStudents.filter(s => {
      if (panelFilter === 'ALL') return true;
      const sPanel = (s.panel || '').toLowerCase();
      const sSquad = (s.squad || '').toLowerCase();
      const pFilter = panelFilter.toLowerCase();
      return sPanel === pFilter || sPanel.includes(pFilter) || sSquad.includes(pFilter);
    });

    if (missingList.length === 0) {
      toast('info', `No students with missing parent information found for ${panelFilter === 'ALL' ? 'all panels' : panelFilter}.`);
      return;
    }

    const selectedBatch = batches.find(b => String(b.id) === String(orientationBatchId));
    const batchName = selectedBatch ? selectedBatch.name : `Batch_${orientationBatchId}`;

    const exportData = missingList.map(s => ({
      'PRN': s.prn || 'N/A',
      'Student Name': s.name || '',
      'Panel': s.panel || 'N/A',
      'Division': s.division || 'N/A',
      'Batch': s.batch_name || batchName || 'N/A',
      'Squad': s.squad || 'N/A',
      'Student Email': s.email || '',
      'Parent Name': `Parent of ${s.name}`,
      'Parent Email': s.parent_email && s.parent_email.trim() ? s.parent_email.trim() : 'Missing',
      'Missing Reason': !s.parent_email || !s.parent_email.trim() ? 'Parent Email Not Provided' : 'Invalid Parent Email'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Missing Parent Info');

    ws['!cols'] = [
      { wch: 15 },
      { wch: 24 },
      { wch: 12 },
      { wch: 10 },
      { wch: 20 },
      { wch: 12 },
      { wch: 28 },
      { wch: 24 },
      { wch: 28 },
      { wch: 28 }
    ];

    const cleanFileName = `Missing_Parent_Info_${panelFilter.replace(/\s+/g, '_')}_${batchName.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, cleanFileName);
    toast('success', `Exported ${missingList.length} missing parent records.`);
  };

  const handleSendOrientationEmail = async (e) => {
    e.preventDefault()

    if (selectedTemplate === 'faculty_data_collection') {
      const parsed = parseEmailList(facultyDataCollectionEmails);
      if (parsed.invalid.length > 0) {
        toast(`Invalid email address format: ${parsed.invalid.slice(0, 3).join(', ')}${parsed.invalid.length > 3 ? '...' : ''}`, 'error');
        return;
      }
      if (parsed.valid.length === 0) {
        toast('Please enter at least one valid faculty recipient email address.', 'error');
        return;
      }

      if (orientationCc && orientationCc.trim()) {
        const ccParsed = parseEmailList(orientationCc);
        if (ccParsed.invalid.length > 0) {
          toast(`Invalid email format in CC: ${ccParsed.invalid.join(', ')}`, 'error');
          return;
        }
      }
      if (orientationBcc && orientationBcc.trim()) {
        const bccParsed = parseEmailList(orientationBcc);
        if (bccParsed.invalid.length > 0) {
          toast(`Invalid email format in BCC: ${bccParsed.invalid.join(', ')}`, 'error');
          return;
        }
      }

      if (!orientationSubject.trim() || !orientationBody.trim()) {
        toast('Email subject and body cannot be empty.', 'error');
        return;
      }

      const previewListStr = parsed.valid.length <= 10
        ? parsed.valid.join('\n')
        : `${parsed.valid.slice(0, 10).join('\n')}\n...and ${parsed.valid.length - 10} more`;

      const confirmMsg = parsed.valid.length === 1
        ? `Are you sure you want to send the "Faculty Data Collection" email to ${parsed.valid[0]}?`
        : `Are you sure you want to send the "Faculty Data Collection" email to ${parsed.valid.length} faculty recipient(s)?\n\nRecipients:\n${previewListStr}`;

      if (!window.confirm(confirmMsg)) return;

      setIsSendingOrientation(true);
      try {
        const res = await apiFetch('/api/admin/send-manual-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmails: parsed.valid,
            subject: orientationSubject,
            body: orientationBody,
            role: 'faculty',
            templateKey: 'faculty_data_collection',
            useDefaultHeader: ORIENTATION_TEMPLATES['faculty_data_collection']?.useDefaultHeader !== false,
            cc: parseEmailList(orientationCc).valid.join(', '),
            bcc: parseEmailList(orientationBcc).valid.join(', '),
            attachments: orientationAttachments.map(a => ({
              filename: a.filename,
              content: a.content,
              path: a.path,
              type: a.type,
              size: a.size
            }))
          })
        });

        if (!res) return;
        const data = await res.json();
        if (res.ok) {
          toast(data.message || `Faculty Data Collection email queued successfully for ${parsed.valid.length} recipient(s).`, 'success');
          setFacultyDataCollectionEmails('');
          setOrientationAttachments([]);
          setActiveTab('email_logs');
          setEmailLogsViewTab('queue');
          fetchEmailLogs(false);
        } else {
          toast(data.message || 'Failed to send faculty emails.', 'error');
        }
      } catch (err) {
        toast('Error sending faculty emails: ' + err.message, 'error');
      } finally {
        setIsSendingOrientation(false);
      }
      return;
    }

    if (!orientationBatchId) return alert('Please select a batch.')
    if (!orientationSubject.trim()) return alert('Subject is required.')
    if (!orientationBody.trim()) return alert('Body is required.')

    const activeRoles = Object.keys(recipientRoles).filter(k => recipientRoles[k]);
    if (activeRoles.length === 0) {
      return alert('Please select at least one recipient group (Students, Faculty, or LTC Members).')
    }

    // Proper validation for CC and BCC
    if (orientationCc && orientationCc.trim()) {
      const ccParsed = parseEmailList(orientationCc);
      if (ccParsed.invalid.length > 0) {
        toast('error', `Invalid email format in CC: ${ccParsed.invalid.join(', ')}`);
        return;
      }
    }
    if (orientationBcc && orientationBcc.trim()) {
      const bccParsed = parseEmailList(orientationBcc);
      if (bccParsed.invalid.length > 0) {
        toast('error', `Invalid email format in BCC: ${bccParsed.invalid.join(', ')}`);
        return;
      }
    }

    if (!window.confirm(`Are you sure you want to queue and dispatch this email to the selected recipient group(s)?\n\nBatch ID: ${orientationBatchId}\nSubject: "${orientationSubject}"`)) {
      return;
    }

    setIsSendingOrientation(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${orientationBatchId}/send-orientation-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: orientationSubject,
          body: orientationBody,
          targetRoles: activeRoles,
          templateKey: selectedTemplate,
          useDefaultHeader: ORIENTATION_TEMPLATES[selectedTemplate]?.useDefaultHeader !== false,
          cc: parseEmailList(orientationCc).valid.join(', '),
          bcc: parseEmailList(orientationBcc).valid.join(', '),
          attachments: orientationAttachments.map(a => ({
            filename: a.filename,
            content: a.content,
            path: a.path,
            type: a.type,
            size: a.size
          }))
        })
      })
      const data = await res.json()
      if (res.ok) {
        toast('success', data.message || 'Orientation email queued successfully!')
        setOrientationAttachments([])
        if (mailboxChannel === 'whatsapp') {
          setActiveTab('whatsapp_logs')
          fetchWhatsappLogs()
        } else {
          setActiveTab('email_logs')
          setEmailLogsViewTab('queue')
          fetchEmailLogs(false)
        }
      } else {
        toast('error', data.message || 'Failed to send emails.')
      }
    } catch (err) {
      toast('error', 'Error sending orientation emails.')
    } finally {
      setIsSendingOrientation(false)
    }
  }



  const handleSendManualEmail = async (e) => {
    if (e) e.preventDefault();

    if (!manualTemplateKey) {
      toast('Please select an email template.', 'error');
      return;
    }

    const { valid: cleanEmails, invalid: invalidEmails } = parsedManualEmails;

    if (invalidEmails.length > 0) {
      toast(`Invalid email address format: ${invalidEmails.slice(0, 3).join(', ')}${invalidEmails.length > 3 ? '...' : ''}`, 'error');
      return;
    }

    if (cleanEmails.length === 0) {
      toast('Please enter at least one valid recipient email address.', 'error');
      return;
    }

    // Proper validation for CC and BCC
    if (manualCc && manualCc.trim()) {
      const ccParsed = parseEmailList(manualCc);
      if (ccParsed.invalid.length > 0) {
        toast('error', `Invalid email format in CC: ${ccParsed.invalid.join(', ')}`);
        return;
      }
    }
    if (manualBcc && manualBcc.trim()) {
      const bccParsed = parseEmailList(manualBcc);
      if (bccParsed.invalid.length > 0) {
        toast('error', `Invalid email format in BCC: ${bccParsed.invalid.join(', ')}`);
        return;
      }
    }

    if (!manualSubject.trim() || !manualBody.trim()) {
      toast('Email subject and body cannot be empty.', 'error');
      return;
    }

    const templateName = ORIENTATION_TEMPLATES[manualTemplateKey]?.name || 'Template';
    const previewListStr = cleanEmails.length <= 10
      ? cleanEmails.join('\n')
      : `${cleanEmails.slice(0, 10).join('\n')}\n...and ${cleanEmails.length - 10} more`;

    const confirmText = cleanEmails.length === 1
      ? `Are you sure you want to send the "${templateName}" email to ${cleanEmails[0]}?`
      : `Are you sure you want to send the "${templateName}" email to ${cleanEmails.length} recipients?\n\nRecipients:\n${previewListStr}`;

    const confirmed = window.confirm(confirmText);
    if (!confirmed) return;

    setIsSendingManualEmail(true);

    try {
      const res = await apiFetch('/api/admin/send-manual-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmails: cleanEmails,
          subject: manualSubject,
          body: manualBody,
          role: manualPreviewRole,
          templateKey: manualTemplateKey,
          useDefaultHeader: ORIENTATION_TEMPLATES[manualTemplateKey]?.useDefaultHeader !== false,
          cc: parseEmailList(manualCc).valid.join(', '),
          bcc: parseEmailList(manualBcc).valid.join(', '),
          attachments: manualAttachments.map(a => ({
            filename: a.filename,
            content: a.content,
            path: a.path,
            type: a.type,
            size: a.size
          }))
        })
      });

      if (!res) return;
      const data = await res.json();

      if (res.ok) {
        toast(data.message || `Manual email queued successfully for ${cleanEmails.length} recipient(s).`, 'success');
        setManualRecipientEmail('');
        setManualAttachments([]);
        setActiveTab('email_logs');
        setEmailLogsViewTab('queue');
        fetchEmailLogs(false);
      } else {
        toast(data.message || 'Failed to send manual email.', 'error');
      }
    } catch (err) {
      toast('Error sending manual email: ' + err.message, 'error');
    } finally {
      setIsSendingManualEmail(false);
    }
  };

  const renderOrientationView = () => {
    const sampleUserByRole = {
      student: { name: 'Rahul Sharma', role: 'student', email: 'rahul.sharma@mitwpu.edu.in', squad: 'Surya' },
      faculty: { name: 'Dr. Anita Roy', role: 'faculty', email: 'anita.roy@mitwpu.edu.in', squad: 'Surya' },
      parent: { name: 'Parent of Rahul Sharma', role: 'parent', email: 'parent.rahul@gmail.com', squad: 'Surya' },
      ltc_member: { name: 'Vikram Singh', role: 'ltc_member', email: 'vikram.singh@mitwpu.edu.in', squad: 'Surya' }
    };

    const matchedRecipient = filteredRecipients.find(r => {
      if (previewRecipientRole === 'parent') return r.role === 'student' && r.parent_email && r.parent_email.trim();
      return r.role === previewRecipientRole;
    });

    const firstFacultyEmail = parseEmailList(facultyDataCollectionEmails).valid[0];
    const sampleUser = selectedTemplate === 'faculty_data_collection' ? {
      name: 'Faculty Member',
      role: 'faculty',
      email: firstFacultyEmail || 'faculty.member@mitwpu.edu.in',
      squad: 'Surya'
    } : (matchedRecipient ? (
      previewRecipientRole === 'parent' ? {
        name: `Parent of ${matchedRecipient.name}`,
        role: 'parent',
        email: matchedRecipient.parent_email || 'parent.rahul@gmail.com',
        squad: (matchedRecipient.squad && matchedRecipient.squad !== 'LTC Admin') ? matchedRecipient.squad : 'Surya'
      } : {
        ...matchedRecipient,
        squad: (matchedRecipient.squad && matchedRecipient.squad !== 'LTC Admin') ? matchedRecipient.squad : 'Surya'
      }
    ) : (sampleUserByRole[previewRecipientRole] || sampleUserByRole.student));

    const targetBatchObj = batches.find(b => String(b.id) === String(orientationBatchId)) || {
      name: orientationBatchId ? `Batch ${orientationBatchId}` : 'Batch 1',
      start_date: '2026-08-01',
      end_date: '2026-08-15'
    };

    const startDateStr = extraFieldValues['start_date'] ? formatOrientationDate(extraFieldValues['start_date']) : (targetBatchObj.start_date ? new Date(targetBatchObj.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '01 Aug 2026');
    const endDateStr = extraFieldValues['end_date'] ? formatOrientationDate(extraFieldValues['end_date']) : (targetBatchObj.end_date ? new Date(targetBatchObj.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '15 Aug 2026');
    const roleName = sampleUser.role === 'student' ? 'Student' : (sampleUser.role === 'ltc_member' ? 'LTC Member' : (sampleUser.role === 'parent' ? 'Parent' : 'Faculty'));
    const defaultPassword = sampleUser.role === 'student' ? 'student123' : (sampleUser.role === 'ltc_member' ? 'ltc123' : 'faculty123');
    const portalLoginUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : 'http://13.207.119.57/login';

    // Conditionally filter role-based content (Faculty Instructions visible only to faculty recipients)
    let rawBody = orientationBody || '';
    if (sampleUser.role !== 'faculty') {
      rawBody = rawBody.replace(/Faculty Instructions:\s*(\n\s*•[^\n]*)+/gi, '');
      rawBody = rawBody.replace(/\n{3,}/g, '\n\n').trim();
    }

    let parsedSubject = (orientationSubject || '')
      .replace(/{{name}}/g, sampleUser.name || '')
      .replace(/{{role}}/g, roleName)
      .replace(/{{batch_name}}/g, targetBatchObj.name || 'Batch 1');

    let parsedBody = rawBody
      .replace(/{{name}}/g, sampleUser.name || '')
      .replace(/{{role}}/g, roleName)
      .replace(/{{batch_name}}/g, targetBatchObj.name || 'Batch 1')
      .replace(/{{squad}}/g, sampleUser.squad || 'Surya')
      .replace(/{{email}}/g, sampleUser.email || '')
      .replace(/{{password}}/g, defaultPassword)
      .replace(/{{start_date}}/g, startDateStr)
      .replace(/{{end_date}}/g, endDateStr)
      .replace(/{{login_url}}/g, portalLoginUrl);

    Object.keys(extraFieldValues).forEach(key => {
      const val = extraFieldValues[key] || '';
      const reg = new RegExp(`{{${key}}}`, 'g');
      parsedBody = parsedBody.replace(reg, val);
      parsedSubject = parsedSubject.replace(reg, val);
    });

    const sanitizeAndFormatEmailHtml = (text) => {
      if (!text) return '';

      // Security sanitization: strip script, iframe, javascript: URLs, and inline on* event handlers
      let clean = text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
        .replace(/href\s*=\s*["']?\s*javascript:[^"'>]*["']?/gi, 'href="#"');

      // Separate block-level elements (<div...</div>, <table...</table>) from plain text blocks
      const blocks = clean.split(/(<(?:div|table)[\s\S]*?<\/(?:div|table)>)/gi);

      const formattedBlocks = blocks.map(block => {
        const trimmed = block.trim();
        if (!trimmed) return '';

        // If it's an HTML block tag (<div...</div> or <table...</table>), leave it intact as HTML
        if (/^<(?:div|table)[\s\S]*/i.test(trimmed)) {
          return trimmed;
        }

        // Process non-block text paragraph by paragraph (split by double newlines)
        const paragraphs = trimmed.split(/\n\s*\n/);
        return paragraphs.map(p => {
          const pTrimmed = p.trim();
          if (!pTrimmed) return '';

          // For lines within a paragraph, convert newlines to <br/> if line doesn't end with an HTML tag/break
          const lines = pTrimmed.split('\n');
          const formattedLines = lines.map((line, idx) => {
            if (idx === lines.length - 1) return line;
            const lTrim = line.trim();
            if (/<br\s*\/?>$/i.test(lTrim) || /<\/(?:p|div|h[1-6]|li|tr|table|ul|ol)>$/i.test(lTrim)) {
              return line;
            }
            return line + '<br/>';
          }).join('\n');

          // If the paragraph already starts with a block-level HTML tag, don't wrap in <p>
          if (/^<(?:p|h[1-6]|ul|ol|blockquote|div|table)/i.test(pTrimmed)) {
            return formattedLines;
          }

          return `<p style="margin: 0 0 12px 0; font-size: 14.5px; color: #334155; line-height: 1.6;">${formattedLines}</p>`;
        }).filter(Boolean).join('\n');
      });

      return formattedBlocks.filter(Boolean).join('\n');
    };

    const renderFormattedPreviewBody = (text) => {
      if (!text) return null;
      const htmlContent = sanitizeAndFormatEmailHtml(text);
      return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    };

    const renderTemplateFields = () => {
      const t = ORIENTATION_TEMPLATES[selectedTemplate];
      if (!t || !t.extraFields || t.extraFields.length === 0) return null;

      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', background: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '8px', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <h4 style={{ gridColumn: '1 / -1', margin: 0, fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Template Variables</h4>
          {t.extraFields.map(f => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', boxSizing: 'border-box' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569' }}>{f.label}</label>
              <input
                type={f.type || 'text'}
                className="input-field"
                style={{ marginBottom: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '12.5px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                placeholder={f.placeholder}
                value={extraFieldValues[f.key] ?? f.default ?? ''}
                onChange={(e) => {
                  setExtraFieldValues(prev => ({ ...prev, [f.key]: e.target.value }));
                }}
              />
            </div>
          ))}
        </div>
      );
    };

    return (
      <div style={{ background: '#ffffff', borderRadius: isMobile ? '14px' : '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', padding: isMobile ? '14px' : '24px', display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }} className="animate-fade-in">
        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            {mailboxChannel === 'whatsapp' ? <Phone className="text-success" size={isMobile ? 18 : 22} /> : <Mail className="text-primary" size={isMobile ? 18 : 22} />}
            {mailboxChannel === 'whatsapp' ? 'WhatsApp Sender' : 'Mailbox & Briefing'}
          </h2>

          {/* iOS-style Channel Toggle Selector */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px', border: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => setMailboxChannel('email')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                transition: 'all 0.2s'
              }}
            >
              Email Channel
            </button>
          </div>
        </div>

        {/* Template Selector (Mobile Oriented Grid) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Choose {mailboxChannel === 'whatsapp' ? 'WhatsApp' : 'Email'} Template</label>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? '8px' : '14px' }}>
            {Object.keys(ORIENTATION_TEMPLATES).filter(key => key !== 'div1_coordinator' && key !== 'nodal_officer').map(key => {
              const isSelected = selectedTemplate === key;
              const t = ORIENTATION_TEMPLATES[key];
              
              const cardConfig = {
                welcome: { icon: Mail, color: '#0d9488', bg: '#f0fdfa', border: 'rgba(13, 148, 136, 0.2)', shadow: 'rgba(13, 148, 136, 0.15)', desc: 'Welcome & Login' },
                parent_welcome: { icon: UserCheck, color: '#e11d48', bg: '#fff1f2', border: 'rgba(225, 29, 72, 0.15)', shadow: 'rgba(225, 29, 72, 0.15)', desc: 'Parent Communication' },
                ltc_day_welcome: { icon: Mail, color: '#0f766e', bg: '#f0fdfa', border: 'rgba(15, 118, 110, 0.2)', shadow: 'rgba(15, 118, 110, 0.15)', desc: 'LTC Day Welcome' },
                orientation: { icon: Calendar, color: '#ea580c', bg: '#fff7ed', border: 'rgba(234, 88, 12, 0.15)', shadow: 'rgba(234, 88, 12, 0.15)', desc: 'Schedule & Venue' },
                travel: { icon: MapPin, color: '#16a34a', bg: '#f0fdf4', border: 'rgba(22, 163, 74, 0.15)', shadow: 'rgba(22, 163, 74, 0.15)', desc: 'Departure Timings' },
                return_travel: { icon: Compass, color: '#9333ea', bg: '#f5f3ff', border: 'rgba(147, 51, 234, 0.15)', shadow: 'rgba(147, 51, 234, 0.15)', desc: 'Return Journey' },
                completion: { icon: Award, color: '#0891b2', bg: '#f0fdfa', border: 'rgba(8, 145, 178, 0.2)', shadow: 'rgba(8, 145, 178, 0.15)', desc: 'Certificates' },
                faculty_data_collection: { icon: ClipboardList, color: '#059669', bg: '#ecfdf5', border: 'rgba(5, 150, 105, 0.15)', shadow: 'rgba(5, 150, 105, 0.15)', desc: 'MoM & Student Form' }
              }[key] || { icon: Mail, color: '#0d9488', bg: '#f0fdfa', border: 'rgba(13, 148, 136, 0.2)', shadow: 'rgba(13, 148, 136, 0.15)', desc: 'Email Template' };

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTemplateChange(key)}
                  style={{
                    background: isSelected ? cardConfig.bg : '#ffffff',
                    borderRadius: '14px',
                    border: isSelected ? `2px solid ${cardConfig.color}` : '1px solid #e2e8f0',
                    padding: isMobile ? '10px 12px' : '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: isMobile ? '82px' : '102px',
                    boxShadow: isSelected ? `0 6px 18px ${cardConfig.shadow}` : '0 3px 8px rgba(0, 0, 0, 0.015)',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isSelected ? 'translateY(-2px)' : 'none',
                    textAlign: 'left'
                  }}
                  className="hover:shadow-lg transition-all duration-300"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2, width: '100%' }}>
                    <span style={{ fontSize: isMobile ? '12px' : '13.5px', fontWeight: '800', color: isSelected ? '#0f172a' : '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t.name}
                    </span>
                  </div>

                  <div style={{ zIndex: 2, marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                    <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '600', color: '#64748b' }}>
                      {cardConfig.desc}
                    </span>
                    {isSelected && (
                      <span style={{ fontSize: '9px', fontWeight: '800', background: cardConfig.bg, color: cardConfig.color, padding: '2px 5px', borderRadius: '4px', border: `1px solid ${cardConfig.border}`, textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>
                        Active
                      </span>
                    )}
                  </div>

                  {/* Decorative Radial Dot Matrix Pattern */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '60px',
                    height: '50px',
                    background: `radial-gradient(circle at bottom right, ${cardConfig.bg}, transparent 70%)`,
                    pointerEvents: 'none',
                    zIndex: 1
                  }}>
                    <div style={{
                      width: '100%',
                      height: '100%',
                      backgroundImage: `radial-gradient(${cardConfig.color}26 1.5px, transparent 1.5px)`,
                      backgroundSize: '7px 7px',
                      WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                      maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                    }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dedicated Direct Send Templates Selector */}
        {mailboxChannel === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Choose Direct Send Template (Coordinators & Nodal Officers)</label>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? '8px' : '14px' }}>
              {['div1_coordinator', 'nodal_officer'].map(key => {
                const isSelected = manualTemplateKey === key;
                const t = ORIENTATION_TEMPLATES[key];
                const cardConfig = {
                  div1_coordinator: { icon: Users, color: '#10b981', bg: '#ecfdf5', border: 'rgba(16, 185, 129, 0.15)', shadow: 'rgba(16, 185, 129, 0.15)', desc: '9 Fixed Coordinator Emails' },
                  nodal_officer: { icon: UserCheck, color: '#d97706', bg: '#fffbeb', border: 'rgba(217, 119, 6, 0.15)', shadow: 'rgba(217, 119, 6, 0.15)', desc: 'Preset Nodal Staff Emails' }
                }[key];

                const IconComponent = cardConfig.icon;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      handleManualTemplateChange(key);
                      const el = document.getElementById('manual-email-sender-section');
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    style={{
                      background: isSelected ? cardConfig.bg : '#ffffff',
                      borderRadius: '14px',
                      border: isSelected ? `2px solid ${cardConfig.color}` : '1px solid #e2e8f0',
                      padding: isMobile ? '10px 12px' : '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      overflow: 'hidden',
                      minHeight: isMobile ? '82px' : '102px',
                      boxShadow: isSelected ? `0 6px 18px ${cardConfig.shadow}` : '0 3px 8px rgba(0, 0, 0, 0.015)',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isSelected ? 'translateY(-2px)' : 'none',
                      textAlign: 'left'
                    }}
                    className="hover:shadow-lg transition-all duration-300"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2, width: '100%' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: isMobile ? '12px' : '13.5px', fontWeight: '800', color: isSelected ? '#0f172a' : '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        <IconComponent size={isMobile ? 14 : 16} style={{ color: cardConfig.color }} />
                        {t.name}
                      </span>
                    </div>

                    <div style={{ zIndex: 2, marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '600', color: '#64748b' }}>
                        {cardConfig.desc}
                      </span>
                      {isSelected && (
                        <span style={{ fontSize: '9px', fontWeight: '800', background: cardConfig.bg, color: cardConfig.color, padding: '2px 5px', borderRadius: '4px', border: `1px solid ${cardConfig.border}`, textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>
                          Active
                        </span>
                      )}
                    </div>

                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '60px',
                      height: '50px',
                      background: `radial-gradient(circle at bottom right, ${cardConfig.bg}, transparent 70%)`,
                      pointerEvents: 'none',
                      zIndex: 1
                    }}>
                      <div style={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: `radial-gradient(${cardConfig.color}26 1.5px, transparent 1.5px)`,
                        backgroundSize: '7px 7px',
                        WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                        maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                      }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Two-Column Grid: Form (Left) & Branded Preview + Table (Right) - Mobile Stacked */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: isMobile ? '16px' : '24px', alignItems: 'start' }}>
          {/* Left Column: Communication Configuration Form */}
          <form onSubmit={handleSendOrientationEmail} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '18px', background: '#ffffff', padding: isMobile ? '14px 12px' : '22px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  {mailboxChannel === 'whatsapp' ? 'WhatsApp' : 'Email'} Configuration
                </h3>
                {customTemplates[selectedTemplate] ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                    Customized Template
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
                    System Default
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setIsCustomizingTemplate(prev => !prev)}
                  style={{
                    fontSize: '11.5px',
                    fontWeight: '700',
                    padding: '5px 11px',
                    borderRadius: '8px',
                    border: isCustomizingTemplate ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                    background: isCustomizingTemplate ? '#fff7ed' : '#ffffff',
                    color: isCustomizingTemplate ? '#c2410c' : '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                  title={isCustomizingTemplate ? 'Hide template editor tools' : 'Customize template subject, body and dynamic variables'}
                >
                  <Edit3 size={12} color={isCustomizingTemplate ? '#ea580c' : '#64748b'} />
                  {isCustomizingTemplate ? 'Hide Editor' : 'Customize Template'}
                </button>

                {customTemplates[selectedTemplate] && (
                  <button
                    type="button"
                    onClick={handleRestoreCommunicationTemplateDefault}
                    disabled={isRestoringDefault}
                    style={{
                      fontSize: '11.5px',
                      fontWeight: '700',
                      padding: '5px 10px',
                      borderRadius: '8px',
                      border: '1px solid #fecdd3',
                      background: '#fff1f2',
                      color: '#e11d48',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: isRestoringDefault ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s'
                    }}
                    title="Restore this template to original system default"
                  >
                    <RotateCcw size={12} />
                    {isRestoringDefault ? 'Restoring...' : 'Restore Default'}
                  </button>
                )}

                {!isCustomizingTemplate && isTemplateDirty && (
                  <button
                    type="button"
                    className="hover:bg-slate-50"
                    style={{ fontSize: '11.5px', fontWeight: '700', padding: '5px 10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onClick={handleCancelTemplateEdit}
                    title="Discard unsaved edits"
                  >
                    <RotateCcw size={12} /> Discard Changes
                  </button>
                )}
              </div>
            </div>

            {selectedTemplate !== 'faculty_data_collection' ? (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Batch *</label>
                  <select
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#0f172a', background: '#f8fafc', outline: 'none', cursor: 'pointer' }}
                    value={orientationBatchId}
                    onChange={(e) => setOrientationBatchId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Target Batch --</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Recipient Groups *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '10px', background: recipientRoles.student ? '#eff6ff' : '#f8fafc', border: recipientRoles.student ? '1px solid #bfdbfe' : '1px solid #e2e8f0', fontSize: '11.5px', fontWeight: '700', color: recipientRoles.student ? '#1e40af' : '#475569', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!recipientRoles.student}
                        onChange={(e) => setRecipientRoles(prev => ({ ...prev, student: e.target.checked }))}
                        style={{ width: '14px', height: '14px', accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                      Students ({orientationRecipients.filter(r => r.role === 'student').length})
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '10px', background: recipientRoles.faculty ? '#eff6ff' : '#f8fafc', border: recipientRoles.faculty ? '1px solid #bfdbfe' : '1px solid #e2e8f0', fontSize: '11.5px', fontWeight: '700', color: recipientRoles.faculty ? '#1e40af' : '#475569', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!recipientRoles.faculty}
                        onChange={(e) => setRecipientRoles(prev => ({ ...prev, faculty: e.target.checked }))}
                        style={{ width: '14px', height: '14px', accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                      Faculty ({orientationRecipients.filter(r => r.role === 'faculty').length})
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '10px', background: recipientRoles.parent ? '#eff6ff' : '#f8fafc', border: recipientRoles.parent ? '1px solid #bfdbfe' : '1px solid #e2e8f0', fontSize: '11.5px', fontWeight: '700', color: recipientRoles.parent ? '#1e40af' : '#475569', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!recipientRoles.parent}
                        onChange={(e) => setRecipientRoles(prev => ({ ...prev, parent: e.target.checked }))}
                        style={{ width: '14px', height: '14px', accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                      Parents ({orientationRecipients.filter(r => r.role === 'student' && r.parent_email && r.parent_email.trim()).length})
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '10px', background: recipientRoles.ltc_member ? '#eff6ff' : '#f8fafc', border: recipientRoles.ltc_member ? '1px solid #bfdbfe' : '1px solid #e2e8f0', fontSize: '11.5px', fontWeight: '700', color: recipientRoles.ltc_member ? '#1e40af' : '#475569', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!recipientRoles.ltc_member}
                        onChange={(e) => setRecipientRoles(prev => ({ ...prev, ltc_member: e.target.checked }))}
                        style={{ width: '14px', height: '14px', accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                      LTC Members ({orientationRecipients.filter(r => r.role === 'ltc_member').length})
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <EmailMultiInput
                  label="Faculty Recipient Email Address(es) *"
                  sublabel="Manual Entry (Comma Separated)"
                  value={facultyDataCollectionEmails}
                  onChange={setFacultyDataCollectionEmails}
                  placeholder="Enter faculty email(s) separated by commas (e.g. faculty1@mitwpu.edu.in, faculty2@mitwpu.edu.in)..."
                />
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>
                  Emails entered above will receive the Faculty Data Collection instructions directly without dispatching to the entire batch.
                </span>
              </div>
            )}

            {renderTemplateFields()}

            {mailboxChannel === 'email' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                    Email Subject
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowOrientationCcBcc(prev => !prev)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    {showOrientationCcBcc ? 'Hide CC / BCC' : '+ Add CC / BCC'}
                  </button>
                </div>
                <input
                  type="text"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#0f172a', background: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                  placeholder="e.g. Important Orientation Briefing"
                  value={orientationSubject || ''}
                  onChange={(e) => {
                    setOrientationSubject(e.target.value);
                    setIsTemplateDirty(true);
                  }}
                  required={mailboxChannel === 'email'}
                />

                {(showOrientationCcBcc || orientationCc || orientationBcc) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                    <EmailMultiInput
                      label="CC"
                      sublabel="Carbon Copy"
                      value={orientationCc || ''}
                      onChange={setOrientationCc}
                      placeholder="Type email and press Enter, Comma, or Semicolon..."
                    />

                    <EmailMultiInput
                      label="BCC"
                      sublabel="Blind Carbon Copy (Hidden)"
                      value={orientationBcc || ''}
                      onChange={setOrientationBcc}
                      placeholder="Type email and press Enter, Comma, or Semicolon..."
                    />
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Variables & Customization Toolbar */}
            <div style={{
              background: isCustomizingTemplate ? '#fffaf5' : '#f8fafc',
              border: isCustomizingTemplate ? '1.5px solid #fed7aa' : '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {isCustomizingTemplate && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #fed7aa', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#ea580c" />
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#9a3412' }}>
                      Editing Persistent Template: {ORIENTATION_TEMPLATES[selectedTemplate]?.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={handleSaveCommunicationTemplate}
                      disabled={isSavingCustomTemplate}
                      style={{
                        background: '#ea580c',
                        color: '#ffffff',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: isSavingCustomTemplate ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 1px 3px rgba(234, 88, 12, 0.3)'
                      }}
                    >
                      <Save size={13} />
                      {isSavingCustomTemplate ? 'Saving...' : 'Save Template'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelTemplateEdit}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#475569',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '11.5px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    {customTemplates[selectedTemplate] && (
                      <button
                        type="button"
                        onClick={handleRestoreCommunicationTemplateDefault}
                        disabled={isRestoringDefault}
                        style={{
                          background: '#fff1f2',
                          border: '1px solid #fecdd3',
                          color: '#e11d48',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          cursor: isRestoringDefault ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <RotateCcw size={12} />
                        Restore Default
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Variable Chips */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: isCustomizingTemplate ? '#9a3412' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Click to Insert Dynamic Variable
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                    Inserts at cursor in message body
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(() => {
                    const rawList = [
                      { token: '{{name}}', label: 'Name' },
                      { token: '{{role}}', label: 'Role' },
                      { token: '{{batch_name}}', label: 'Batch' },
                      { token: '{{squad}}', label: 'Squad' },
                      { token: '{{email}}', label: 'Email' },
                      { token: '{{start_date}}', label: 'Start Date' },
                      { token: '{{end_date}}', label: 'End Date' },
                      { token: '{{login_url}}', label: 'Login URL' },
                      ...(ORIENTATION_TEMPLATES[selectedTemplate]?.extraFields || []).map(f => ({
                        token: `{{${f.key}}}`,
                        label: f.label || f.key
                      }))
                    ];
                    const seen = new Set();
                    const uniqueList = [];
                    rawList.forEach(item => {
                      if (!seen.has(item.token)) {
                        seen.add(item.token);
                        uniqueList.push(item);
                      }
                    });
                    return uniqueList.map(v => (
                      <button
                        key={v.token}
                        type="button"
                        onClick={() => insertVariableIntoTemplate(v.token)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #fed7aa',
                          color: '#c2410c',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        className="hover:bg-orange-100 hover:border-orange-400"
                        title={`Insert ${v.token} (${v.label})`}
                      >
                        <span style={{ color: '#ea580c', fontWeight: '900' }}>+</span>
                        {v.token}
                      </button>
                    ));
                  })()}
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{mailboxChannel === 'whatsapp' ? 'WhatsApp Message Body' : 'Email Message Body'}</label>
              <textarea
                id="orientation-body-editor"
                style={{ width: '100%', height: '240px', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', fontFamily: 'inherit', resize: 'vertical', lineHeight: '1.55', background: '#ffffff', outline: 'none' }}
                value={orientationBody || ''}
                onChange={(e) => {
                  setOrientationBody(e.target.value);
                  setIsTemplateDirty(true);
                }}
                required
              />
            </div>

            {/* Email Attachments Section */}
            {mailboxChannel === 'email' && (
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip size={14} color="#ea580c" />
                    <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Attachments {orientationAttachments.length > 0 && `(${orientationAttachments.length})`}
                    </span>
                  </div>

                  <label
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s'
                    }}
                    className="hover:bg-slate-50"
                  >
                    <UploadCloud size={13} color="#ea580c" />
                    <span>Upload Files</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xlsx,.xls,.xlsl,.csv,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => handleAttachmentUpload(e, 'bulk')}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                {orientationAttachments.length === 0 ? (
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                    No attachments added. Upload PDF, DOC, DOCX, Excel (XLSX, XLS), CSV, or images.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {orientationAttachments.map((att) => {
                      const lowerName = (att.filename || '').toLowerCase();
                      const isPdf = lowerName.endsWith('.pdf');
                      const isWord = lowerName.endsWith('.doc') || lowerName.endsWith('.docx');
                      const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.xlsl');
                      const isCsv = lowerName.endsWith('.csv');
                      const isImg = att.type?.startsWith('image/') || lowerName.match(/\.(png|jpe?g|webp)$/);
                      const badgeColor = isPdf ? '#ef4444' : (isWord ? '#2563eb' : (isExcel ? '#16a34a' : (isCsv ? '#059669' : (isImg ? '#8b5cf6' : '#64748b'))));
                      const badgeLabel = isPdf ? 'PDF' : (isWord ? 'DOC' : (isExcel ? 'XLS' : (isCsv ? 'CSV' : (isImg ? 'IMG' : 'FILE'))));

                      return (
                        <div
                          key={att.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 10px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                padding: '2px 5px',
                                borderRadius: '4px',
                                background: `${badgeColor}15`,
                                color: badgeColor,
                                fontSize: '10px',
                                fontWeight: '800',
                                textTransform: 'uppercase',
                                flexShrink: 0
                              }}
                            >
                              {badgeLabel}
                            </span>

                            <span
                              title={att.filename}
                              style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1
                              }}
                            >
                              {att.name || att.filename}
                            </span>

                            <span style={{ fontSize: '11px', color: '#64748b', flexShrink: 0 }}>
                              {formatAttachmentSize(att.size)}
                            </span>

                            <span
                              style={{
                                fontSize: '9.5px',
                                fontWeight: '700',
                                color: att.source === 'LTC Document' ? '#ea580c' : '#475569',
                                background: att.source === 'LTC Document' ? '#fff7ed' : '#f1f5f9',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                flexShrink: 0
                              }}
                            >
                              {att.source}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(att.id, 'bulk')}
                            title="Remove attachment"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '4px'
                            }}
                            className="hover:text-red-600"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSendingOrientation || (selectedTemplate !== 'faculty_data_collection' ? !orientationBatchId : !facultyDataCollectionEmails.trim())}
              className="hover:bg-slate-800"
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '12px',
                border: 'none',
                background: isSendingOrientation || (selectedTemplate !== 'faculty_data_collection' ? !orientationBatchId : !facultyDataCollectionEmails.trim()) ? '#94a3b8' : '#0f172a',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isSendingOrientation || (selectedTemplate !== 'faculty_data_collection' ? !orientationBatchId : !facultyDataCollectionEmails.trim()) ? 'not-allowed' : 'pointer',
                boxShadow: isSendingOrientation || (selectedTemplate !== 'faculty_data_collection' ? !orientationBatchId : !facultyDataCollectionEmails.trim()) ? 'none' : '0 4px 12px rgba(15, 23, 42, 0.15)',
                transition: 'all 0.2s'
              }}
            >
              {isSendingOrientation ? (
                <>
                  <div className="spinner spinner-sm" style={{ borderTopColor: '#ffffff' }} />
                  {selectedTemplate === 'faculty_data_collection'
                    ? 'Sending Faculty Emails...'
                    : (mailboxChannel === 'whatsapp' ? 'Queuing WhatsApp Messages...' : 'Queuing Bulk Emails...')}
                </>
              ) : (
                <>
                  <Send size={16} />
                  {selectedTemplate === 'faculty_data_collection'
                    ? `Send to Faculty Members (${parseEmailList(facultyDataCollectionEmails).valid.length || 0})`
                    : (mailboxChannel === 'whatsapp' ? `Queue Bulk WhatsApp Messages (${filteredRecipients.length})` : `Queue Bulk Emails (${filteredRecipients.length})`)}
                </>
              )}
            </button>
          </form>

          {/* Right Column: Live Branded Email Inbox Preview & Recipient List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%' }}>
            {/* Branded Live Email Preview Card */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden', width: '100%' }}>
              {/* Preview Card Header Toolbar & Mobile Responsive Recipient Preview Role Toggle */}
              <div style={{ padding: isMobile ? '10px 12px' : '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: isMobile ? '100%' : 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Eye size={17} style={{ color: mailboxChannel === 'whatsapp' ? '#16a34a' : '#2563eb' }} />
                    <span style={{ fontWeight: '800', fontSize: isMobile ? '13.5px' : '14.5px', color: '#0f172a' }}>Live {mailboxChannel === 'whatsapp' ? 'WhatsApp' : 'Email'} Preview</span>
                  </div>
                  {isMobile && (
                    <span style={{ fontSize: '10.5px', color: '#1e40af', fontWeight: '700', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                      {sampleUser.role.toUpperCase()}
                    </span>
                  )}
                </div>
                
                {selectedTemplate !== 'faculty_data_collection' && (
                  <div className="no-scrollbar" style={{ display: 'flex', alignItems: 'center', gap: '6px', width: isMobile ? '100%' : 'auto', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>Preview Role:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#e2e8f0', padding: '3px', borderRadius: '10px', flex: isMobile ? 1 : 'none', width: isMobile ? '100%' : 'auto' }}>
                      {[
                        { role: 'student', label: 'Student' },
                        { role: 'faculty', label: 'Faculty' },
                        { role: 'parent', label: 'Parent' },
                        { role: 'ltc_member', label: 'LTC' }
                      ].map(item => {
                        const isRoleActive = previewRecipientRole === item.role;
                        return (
                          <button
                            key={item.role}
                            type="button"
                            onClick={() => setPreviewRecipientRole(item.role)}
                            style={{
                              padding: isMobile ? '4px 6px' : '4px 10px',
                              borderRadius: '8px',
                              border: 'none',
                              background: isRoleActive ? '#ea580c' : 'transparent',
                              color: isRoleActive ? '#ffffff' : '#475569',
                              fontSize: isMobile ? '10.5px' : '11.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: isRoleActive ? '0 2px 6px rgba(234, 88, 12, 0.25)' : 'none',
                              flex: isMobile ? 1 : 'none',
                              textAlign: 'center',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Simulated Channel Preview View */}
              {mailboxChannel === 'whatsapp' ? (
                /* Simulated WhatsApp Phone Interface */
                <div style={{ padding: isMobile ? '12px' : '24px', background: '#eae6df', minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
                  {/* WhatsApp chat bubble */}
                  <div style={{ alignSelf: 'flex-start', background: '#ffffff', borderRadius: '10px', padding: '10px 14px', maxWidth: '85%', boxShadow: '0 1px 2px rgba(0,0,0,0.15)', position: 'relative' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ea580c', marginBottom: '4px' }}>
                      LIFE AWAKENING PROGRAM (LAP)
                    </div>
                    {/* Render message body text with line breaks preserved */}
                    <div style={{ fontSize: '13px', color: '#303030', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                      {parsedBody}
                    </div>
                    {/* Timestamp / double tick */}
                    <div style={{ fontSize: '9.5px', color: '#909090', float: 'right', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span style={{ color: '#4fc3f7' }}></span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Simulated Branded Email View */
                <div className="no-scrollbar" style={{ padding: isMobile ? '8px' : '16px', background: '#f1f5f9', maxHeight: '580px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <div style={{ maxWidth: '600px', margin: '0 auto', background: ORIENTATION_TEMPLATES[selectedTemplate]?.hideHeader ? 'transparent' : '#ffffff', borderRadius: '16px', overflow: 'hidden', border: ORIENTATION_TEMPLATES[selectedTemplate]?.hideHeader ? 'none' : '1px solid #e2e8f0', boxShadow: ORIENTATION_TEMPLATES[selectedTemplate]?.hideHeader ? 'none' : '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                    {/* Official Branded Banner Header */}
                    {!ORIENTATION_TEMPLATES[selectedTemplate]?.hideHeader && (
                      <div style={{ background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', backgroundColor: '#ea580c', padding: isMobile ? '20px 14px' : '28px 20px', textAlign: 'center', color: '#ffffff' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#ffedd5', marginBottom: '6px' }}>
                          MIT WORLD PEACE UNIVERSITY, PUNE
                        </div>
                        <h1 style={{ margin: '0 0 4px 0', fontSize: isMobile ? '15px' : '18px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.5px', lineHeight: '1.3', textTransform: 'uppercase' }}>
                          LIFE AWAKENING PROGRAM (LAP)
                        </h1>
                        <div style={{ fontSize: isMobile ? '12px' : '13.5px', fontWeight: '600', color: '#fed7aa', letterSpacing: '0.3px' }}>
                          Experiential Learning &amp; Transformation
                        </div>
                      </div>
                    )}

                    {/* Body Content */}
                    <div style={{ padding: ORIENTATION_TEMPLATES[selectedTemplate]?.hideHeader ? '0' : (isMobile ? '16px 12px 14px 12px' : '24px 20px 16px 20px') }}>
                      {renderFormattedPreviewBody(parsedBody)}
                    </div>

                    {/* Footer */}
                    {!ORIENTATION_TEMPLATES[selectedTemplate]?.hideHeader && (
                      <div style={{ backgroundColor: '#f8fafc', padding: '16px 20px', textAlign: 'center', fontSize: '11px', color: '#64748b', borderTop: '1px solid #e2e8f0', lineHeight: '1.5' }}>
                        This is an official communication from <strong>Life Awakening Program (LAP) Administration</strong>.<br />
                        MIT World Peace University, Pune.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Manual Email Sender Section */}
        {mailboxChannel === 'email' && (
          <div id="manual-email-sender-section" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', padding: isMobile ? '16px' : '22px', display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '8px' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Send className="text-primary" size={18} /> Manual Email Sender
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '500' }}>
                  Send a template email directly to an individual recipient without batch or bulk queue filters.
                </p>
              </div>
              <span style={{ fontSize: '10.5px', fontWeight: '800', background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Direct Send
              </span>
            </div>

            <form onSubmit={handleSendManualEmail} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                {/* Template Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Select Template *
                  </label>
                  <select
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#0f172a', background: '#f8fafc', outline: 'none', cursor: 'pointer' }}
                    value={manualTemplateKey}
                    onChange={(e) => handleManualTemplateChange(e.target.value)}
                  >
                    {Object.keys(ORIENTATION_TEMPLATES).map(key => (
                      <option key={key} value={key}>
                        {ORIENTATION_TEMPLATES[key].name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Recipient Email Input */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                      Recipient Email Address(es) *
                    </label>
                    {(() => {
                      const { valid, invalid } = parseManualEmails(manualRecipientEmail);
                      if (invalid.length > 0) {
                        return <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#ef4444' }}>{invalid.length} Invalid</span>;
                      }
                      if (valid.length > 0) {
                        return <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 7px', borderRadius: '5px' }}>{valid.length} Recipient{valid.length > 1 ? 's' : ''}</span>;
                      }
                      return null;
                    })()}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      padding: '6px',
                      borderRadius: '10px',
                      border: (() => {
                        const { invalid } = parseManualEmails(manualRecipientEmail);
                        return (manualRecipientEmail && invalid.length > 0) ? '1px solid #ef4444' : '1px solid #cbd5e1';
                      })(),
                      background: '#ffffff',
                      minHeight: '44px',
                      alignItems: 'center'
                    }}
                  >
                    {(() => {
                      const { valid } = parseManualEmails(manualRecipientEmail);
                      return valid.map((email, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1e40af',
                            padding: '3px 8px',
                            borderRadius: '50px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          {email}
                          <button
                            type="button"
                            onClick={() => {
                              const filtered = valid.filter(e => e.toLowerCase() !== email.toLowerCase());
                              setManualRecipientEmail(filtered.join(', '));
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#3b82f6',
                              cursor: 'pointer',
                              fontSize: '14px',
                              lineHeight: 1,
                              padding: '0 2px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            &times;
                          </button>
                        </span>
                      ));
                    })()}
                    <input
                      type="text"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
                          e.preventDefault();
                          const val = e.target.value.trim();
                          if (val) {
                            const { valid } = parseManualEmails(manualRecipientEmail);
                            if (!valid.some(item => item.toLowerCase() === val.toLowerCase())) {
                              setManualRecipientEmail([...valid, val].join(', '));
                            }
                            e.target.value = '';
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val) {
                          const { valid } = parseManualEmails(manualRecipientEmail);
                          if (!valid.some(item => item.toLowerCase() === val.toLowerCase())) {
                            setManualRecipientEmail([...valid, val].join(', '));
                          }
                          e.target.value = '';
                        }
                      }}
                      placeholder={(() => {
                        const { valid } = parseManualEmails(manualRecipientEmail);
                        return valid.length === 0 ? "Type email and press Enter/Comma..." : "Add email...";
                      })()}
                      style={{
                        flex: '1',
                        minWidth: '150px',
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#0f172a',
                        padding: '4px'
                      }}
                    />
                  </div>
                  {(() => {
                    const { invalid } = parseManualEmails(manualRecipientEmail);
                    if (manualRecipientEmail && invalid.length > 0) {
                      return (
                        <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600', marginTop: '4px', display: 'block' }}>
                          Invalid email address format: {invalid.join(', ')}
                        </span>
                      );
                    }
                    return (
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', marginTop: '4px', display: 'block' }}>
                        Separate multiple email addresses using commas, semicolons, or newlines.
                      </span>
                    );
                  })()}
                </div>

                {/* Optional Preview Role Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Preview Role (Placeholder Context)
                  </label>
                  <select
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#0f172a', background: '#f8fafc', outline: 'none', cursor: 'pointer' }}
                    value={manualPreviewRole}
                    onChange={(e) => setManualPreviewRole(e.target.value)}
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="parent">Parent</option>
                    <option value="ltc_member">LTC Coordinator</option>
                  </select>
                </div>
              </div>

              {/* Extra Fields for selected manual template if present */}
              {ORIENTATION_TEMPLATES[manualTemplateKey]?.extraFields?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                  {ORIENTATION_TEMPLATES[manualTemplateKey].extraFields.map(f => (
                    <div key={f.key} style={{ width: '100%', boxSizing: 'border-box' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        {f.label}
                      </label>
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', fontWeight: '600', color: '#0f172a', background: '#ffffff', outline: 'none' }}
                        value={manualExtraFieldValues[f.key] ?? f.default ?? ''}
                        onChange={(e) => {
                          setManualExtraFieldValues(prev => ({ ...prev, [f.key]: e.target.value }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Manual CC / BCC and Subject Input */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                    Email Subject Line *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowManualCcBcc(prev => !prev)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    {showManualCcBcc ? 'Hide CC / BCC' : '+ Add CC / BCC'}
                  </button>
                </div>
                <input
                  type="text"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#0f172a', background: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                  value={manualSubject}
                  onChange={(e) => setManualSubject(e.target.value)}
                  required
                />

                {(showManualCcBcc || manualCc || manualBcc) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                    <EmailMultiInput
                      label="CC"
                      sublabel="Carbon Copy"
                      value={manualCc}
                      onChange={setManualCc}
                      placeholder="Type email and press Enter, Comma, or Semicolon..."
                    />

                    <EmailMultiInput
                      label="BCC"
                      sublabel="Blind Carbon Copy (Hidden)"
                      value={manualBcc}
                      onChange={setManualBcc}
                      placeholder="Type email and press Enter, Comma, or Semicolon..."
                    />
                  </div>
                )}
              </div>

              {/* Manual Body Textarea */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Email Message Body *
                </label>
                <textarea
                  style={{ width: '100%', height: '180px', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', fontFamily: 'inherit', resize: 'vertical', lineHeight: '1.55', background: '#ffffff', outline: 'none' }}
                  value={manualBody}
                  onChange={(e) => setManualBody(e.target.value)}
                  required
                />
              </div>

              {/* Manual Email Attachments Section */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip size={14} color="#ea580c" />
                    <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Attachments {manualAttachments.length > 0 && `(${manualAttachments.length})`}
                    </span>
                  </div>

                  <label
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s'
                    }}
                    className="hover:bg-slate-50"
                  >
                    <UploadCloud size={13} color="#ea580c" />
                    <span>Upload Files</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xlsx,.xls,.xlsl,.csv,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => handleAttachmentUpload(e, 'manual')}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                {manualAttachments.length === 0 ? (
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                    No attachments added. Upload PDF, DOC, DOCX, Excel (XLSX, XLS), CSV, or images.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {manualAttachments.map((att) => {
                      const lowerName = (att.filename || '').toLowerCase();
                      const isPdf = lowerName.endsWith('.pdf');
                      const isWord = lowerName.endsWith('.doc') || lowerName.endsWith('.docx');
                      const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.xlsl');
                      const isCsv = lowerName.endsWith('.csv');
                      const isImg = att.type?.startsWith('image/') || lowerName.match(/\.(png|jpe?g|webp)$/);
                      const badgeColor = isPdf ? '#ef4444' : (isWord ? '#2563eb' : (isExcel ? '#16a34a' : (isCsv ? '#059669' : (isImg ? '#8b5cf6' : '#64748b'))));
                      const badgeLabel = isPdf ? 'PDF' : (isWord ? 'DOC' : (isExcel ? 'XLS' : (isCsv ? 'CSV' : (isImg ? 'IMG' : 'FILE'))));

                      return (
                        <div
                          key={att.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 10px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                padding: '2px 5px',
                                borderRadius: '4px',
                                background: `${badgeColor}15`,
                                color: badgeColor,
                                fontSize: '10px',
                                fontWeight: '800',
                                textTransform: 'uppercase',
                                flexShrink: 0
                              }}
                            >
                              {badgeLabel}
                            </span>

                            <span
                              title={att.filename}
                              style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1
                              }}
                            >
                              {att.name || att.filename}
                            </span>

                            <span style={{ fontSize: '11px', color: '#64748b', flexShrink: 0 }}>
                              {formatAttachmentSize(att.size)}
                            </span>

                            <span
                              style={{
                                fontSize: '9.5px',
                                fontWeight: '700',
                                color: att.source === 'LTC Document' ? '#ea580c' : '#475569',
                                background: att.source === 'LTC Document' ? '#fff7ed' : '#f1f5f9',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                flexShrink: 0
                              }}
                            >
                              {att.source}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(att.id, 'manual')}
                            title="Remove attachment"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '4px'
                            }}
                            className="hover:text-red-600"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Real-time Live Email Preview for Manual Email Sender */}
              <div style={{ marginTop: '4px', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', padding: isMobile ? '14px' : '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Eye size={16} className="text-primary" />
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                      Live Email Preview
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                      (Updates in real-time as you type)
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                    Previewing for: <strong style={{ color: '#0f172a' }}>{manualPreviewContent.userObj.name}</strong> ({manualPreviewContent.userObj.email})
                  </div>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 4px 14px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                  <div style={{ padding: ORIENTATION_TEMPLATES[manualTemplateKey]?.hideHeader ? '0' : '24px 20px', background: ORIENTATION_TEMPLATES[manualTemplateKey]?.hideHeader ? 'transparent' : '#ffffff' }}>
                    {!ORIENTATION_TEMPLATES[manualTemplateKey]?.hideHeader && (
                      <div style={{ background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', backgroundColor: '#ea580c', borderRadius: '10px', padding: '20px', textAlign: 'center', color: '#ffffff', marginBottom: '20px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#ffedd5', marginBottom: '6px' }}>
                          MIT WORLD PEACE UNIVERSITY, PUNE
                        </div>
                        <h1 style={{ margin: '0 0 4px 0', fontSize: isMobile ? '15px' : '18px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.5px', lineHeight: '1.3', textTransform: 'uppercase' }}>
                          LIFE AWAKENING PROGRAM (LAP)
                        </h1>
                        <div style={{ fontSize: isMobile ? '12px' : '13.5px', fontWeight: '600', color: '#fed7aa', letterSpacing: '0.3px' }}>
                          Experiential Learning &amp; Transformation
                        </div>
                      </div>
                    )}

                    {renderFormattedPreviewBody(manualPreviewContent.parsedBody)}

                    {!ORIENTATION_TEMPLATES[manualTemplateKey]?.hideHeader && (
                      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '11.5px', color: '#64748b', lineHeight: '1.5' }}>
                        This is an official communication from <strong>Life Awakening Program (LAP) Administration</strong>.<br />
                        MIT World Peace University, Pune.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                {(() => {
                  const { valid, invalid } = parseManualEmails(manualRecipientEmail);
                  const isFormDisabled = isSendingManualEmail || valid.length === 0 || invalid.length > 0;
                  return (
                    <button
                      type="submit"
                      disabled={isFormDisabled}
                      className="hover:opacity-90 active:scale-98"
                      style={{
                        padding: '11px 24px',
                        borderRadius: '10px',
                        border: 'none',
                        background: isFormDisabled ? '#94a3b8' : '#ea580c',
                        color: '#ffffff',
                        fontSize: '13.5px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                        boxShadow: isFormDisabled ? 'none' : '0 4px 12px rgba(234, 88, 12, 0.25)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isSendingManualEmail ? (
                        <>
                          <div className="spinner spinner-sm" style={{ borderTopColor: '#ffffff' }} />
                          Sending Email(s)...
                        </>
                      ) : (
                        <>
                          <Send size={15} />
                          Send Email{valid.length > 1 ? `s (${valid.length})` : ''}
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            </form>
          </div>
        )}

        {/* Recipient Verification Summary Bar */}
        {orientationBatchId && !loadingRecipients && orientationRecipients.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {/* Total Students Card Button */}
                <div 
                  onClick={() => setPreviewParentFilter('ALL')}
                  className="hover:shadow-sm transition-all duration-150"
                  style={{ 
                    cursor: 'pointer',
                    background: previewParentFilter === 'ALL' ? '#eff6ff' : '#ffffff', 
                    border: previewParentFilter === 'ALL' ? '1px solid #bfdbfe' : '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    padding: '6px 12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    boxShadow: previewParentFilter === 'ALL' ? '0 1px 3px rgba(37,99,235,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  title="Filter list to show all student recipients"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', background: '#ffffff', border: '1px solid #e2e8f0', color: previewParentFilter === 'ALL' ? '#2563eb' : '#64748b', flexShrink: 0 }}>
                    <Users size={13} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '9px', fontWeight: '800', color: previewParentFilter === 'ALL' ? '#1e40af' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1 }}>Total Students</div>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: previewParentFilter === 'ALL' ? '#1e3a8a' : '#0f172a', marginTop: '2px', lineHeight: 1 }}>{recipientSummaryMetrics.totalStudents}</div>
                  </div>
                </div>

                {/* Total Parents Card Button */}
                <div 
                  onClick={() => setPreviewParentFilter('LINKED')}
                  className="hover:shadow-sm transition-all duration-150"
                  style={{ 
                    cursor: 'pointer',
                    background: previewParentFilter === 'LINKED' ? '#eff6ff' : '#ffffff', 
                    border: previewParentFilter === 'LINKED' ? '1px solid #bfdbfe' : '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    padding: '6px 12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    boxShadow: previewParentFilter === 'LINKED' ? '0 1px 3px rgba(37,99,235,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  title="Filter list to show records with linked parents"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', background: '#ffffff', border: '1px solid #e2e8f0', color: previewParentFilter === 'LINKED' ? '#2563eb' : '#64748b', flexShrink: 0 }}>
                    <UserCheck size={13} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '9px', fontWeight: '800', color: previewParentFilter === 'LINKED' ? '#1e40af' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1 }}>Total Parents</div>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: previewParentFilter === 'LINKED' ? '#1e3a8a' : '#0f172a', marginTop: '2px', lineHeight: 1 }}>{recipientSummaryMetrics.totalParents}</div>
                  </div>
                </div>

                {/* Linked Pairs Card Button */}
                <div 
                  onClick={() => setPreviewParentFilter('LINKED')}
                  className="hover:shadow-sm transition-all duration-150"
                  style={{ 
                    cursor: 'pointer',
                    background: previewParentFilter === 'LINKED' ? '#eff6ff' : '#ffffff', 
                    border: previewParentFilter === 'LINKED' ? '1px solid #bfdbfe' : '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    padding: '6px 12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    boxShadow: previewParentFilter === 'LINKED' ? '0 1px 3px rgba(37,99,235,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  title="Filter list to show records with linked parents"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', background: '#ffffff', border: '1px solid #e2e8f0', color: previewParentFilter === 'LINKED' ? '#2563eb' : '#64748b', flexShrink: 0 }}>
                    <LinkIcon size={13} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '9px', fontWeight: '800', color: previewParentFilter === 'LINKED' ? '#1e40af' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1 }}>Linked Pairs</div>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: previewParentFilter === 'LINKED' ? '#1e3a8a' : '#0f172a', marginTop: '2px', lineHeight: 1 }}>{recipientSummaryMetrics.linkedPairs}</div>
                  </div>
                </div>

                {/* Missing Parent Info Card Button */}
                <div 
                  onClick={() => setPreviewParentFilter('MISSING')}
                  className="hover:shadow-sm transition-all duration-150"
                  style={{ 
                    cursor: 'pointer',
                    background: previewParentFilter === 'MISSING' ? '#eff6ff' : '#ffffff', 
                    border: previewParentFilter === 'MISSING' ? '1px solid #bfdbfe' : '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    padding: '6px 12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    boxShadow: previewParentFilter === 'MISSING' ? '0 1px 3px rgba(37,99,235,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  title="Filter list to show records missing parent details"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', background: '#ffffff', border: '1px solid #e2e8f0', color: previewParentFilter === 'MISSING' ? '#2563eb' : '#64748b', flexShrink: 0 }}>
                    <AlertTriangle size={13} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '9px', fontWeight: '800', color: previewParentFilter === 'MISSING' ? '#1e40af' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Missing Parent Info</span>
                      {recipientSummaryMetrics.totalMissingParents > 0 && (
                        <span style={{ fontSize: '8px', background: '#ea580c', color: '#ffffff', padding: '0px 4px', borderRadius: '6px', fontWeight: 800 }}>REQ</span>
                      )}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: previewParentFilter === 'MISSING' ? '#1e3a8a' : '#0f172a', marginTop: '2px', lineHeight: 1 }}>{recipientSummaryMetrics.totalMissingParents}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Recipient Preview List Card */}
            {selectedTemplate === 'faculty_data_collection' ? (
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users className="text-primary" size={18} />
                      <span>Faculty Recipients List</span>
                      <span className="badge badge-blue">{parseEmailList(facultyDataCollectionEmails).valid.length} recipient{parseEmailList(facultyDataCollectionEmails).valid.length === 1 ? '' : 's'}</span>
                    </h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      Direct manual dispatch list for Faculty Data Collection communication (will not send to the entire batch).
                    </p>
                  </div>
                </div>

                {parseEmailList(facultyDataCollectionEmails).valid.length === 0 ? (
                  <div style={{ padding: '30px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    <Mail size={32} style={{ opacity: 0.5, marginBottom: '8px', margin: '0 auto' }} />
                    <p style={{ margin: 0, fontSize: '13px' }}>Enter faculty email address(es) above to preview the recipients list.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
                    {parseEmailList(facultyDataCollectionEmails).valid.map((email, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12.5px' }}>
                        <span style={{ fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                        <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #a7f3d0', flexShrink: 0 }}>Faculty</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Recipient Verification & Grouped Preview</span>
                      <span className="badge badge-blue">{filteredRecipients.length} queued</span>
                    </h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      Every student is grouped together with their linked parent for visual verification before sending.
                    </p>
                  </div>

                {orientationBatchId && recipientSummaryMetrics.totalStudents > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Panel Filter Dropdown */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>Filter Panel:</span>
                      <select
                        value={missingParentPanelFilter}
                        onChange={(e) => setMissingParentPanelFilter(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '700', background: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                      >
                        <option value="ALL">All Panels</option>
                        {recipientSummaryMetrics.availablePanels.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    {/* Download Missing Parent List Button */}
                    <button
                      type="button"
                      onClick={() => handleDownloadMissingParentList(missingParentPanelFilter)}
                      className="hover:bg-slate-50"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 12px',
                        borderRadius: '8px',
                        background: recipientSummaryMetrics.totalMissingParents > 0 ? '#fff7ed' : '#ffffff',
                        color: recipientSummaryMetrics.totalMissingParents > 0 ? '#ea580c' : '#0f172a',
                        border: recipientSummaryMetrics.totalMissingParents > 0 ? '1.5px solid #fed7aa' : '1.5px solid #cbd5e1',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s ease'
                      }}
                      title="Download Excel file of students missing parent details"
                    >
                      <Download size={14} />
                      <span>Download Missing Parent List (.xlsx)</span>
                    </button>
                  </div>
                )}
              </div>

              {!orientationBatchId ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <Users size={32} style={{ opacity: 0.5, marginBottom: '8px', margin: '0 auto' }} />
                  <p style={{ margin: 0, fontSize: '13px' }}>Select a batch above to preview enrolled members who will receive this email.</p>
                </div>
              ) : loadingRecipients ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div className="spinner" />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Loading batch members...</span>
                </div>
              ) : orientationRecipients.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: '#ef4444' }}>
                  <AlertCircle size={32} style={{ opacity: 0.8, marginBottom: '8px', margin: '0 auto' }} />
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>No users enrolled or assigned to this batch.</p>
                </div>
              ) : filteredRecipients.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: '#64748b' }}>
                  <Users size={32} style={{ opacity: 0.5, marginBottom: '8px', margin: '0 auto' }} />
                  <p style={{ margin: 0, fontSize: '13px' }}>No recipients match the checked recipient groups above.</p>
                </div>
              ) : (
                <div>
                  {/* Interactive Search & Filter Toolbar for Grouped Preview */}
                  {(recipientRoles.student || recipientRoles.parent) && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                        {/* Search Input Box */}
                        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
                          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                          <input
                            type="text"
                            value={previewSearchText}
                            onChange={(e) => setPreviewSearchText(e.target.value)}
                            placeholder="Search by name, PRN, email, squad..."
                            style={{
                              width: '100%',
                              padding: '7px 30px 7px 32px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12px',
                              fontWeight: '500',
                              color: '#0f172a',
                              background: '#ffffff',
                              outline: 'none'
                            }}
                          />
                          {previewSearchText && (
                            <button
                              type="button"
                              onClick={() => setPreviewSearchText('')}
                              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: '2px' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Filter by Parent Status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Parent Status:</span>
                          <select
                            value={previewParentFilter}
                            onChange={(e) => setPreviewParentFilter(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '700', background: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                          >
                            <option value="ALL">All Students ({recipientSummaryMetrics.studentRecipients.length})</option>
                            <option value="LINKED">Linked Parents Only ({recipientSummaryMetrics.linkedPairs})</option>
                            <option value="MISSING">Missing Parents Only ({recipientSummaryMetrics.totalMissingParents})</option>
                          </select>
                        </div>
                      </div>

                      {/* Pagination Header Summary Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '11.5px', color: '#475569' }}>
                        <div>
                          Showing <strong style={{ color: '#0f172a' }}>{filteredStudentRecipients.length > 0 ? (previewCurrentPage - 1) * previewPageSize + 1 : 0}</strong>–<strong style={{ color: '#0f172a' }}>{Math.min(previewCurrentPage * previewPageSize, filteredStudentRecipients.length)}</strong> of <strong style={{ color: '#0f172a' }}>{filteredStudentRecipients.length}</strong> matching students
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          {/* Rows Per Page Dropdown */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontWeight: '600' }}>Per Page:</span>
                            <select
                              value={previewPageSize}
                              onChange={(e) => setPreviewPageSize(Number(e.target.value))}
                              style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px', fontWeight: '700', background: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                            >
                              <option value={10}>10</option>
                              <option value={20}>20</option>
                              <option value={50}>50</option>
                              <option value={100}>100</option>
                            </select>
                          </div>

                          {/* Pagination Controls */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setPreviewCurrentPage(p => Math.max(1, p - 1))}
                              disabled={previewCurrentPage <= 1}
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: previewCurrentPage <= 1 ? '#f1f5f9' : '#ffffff', color: previewCurrentPage <= 1 ? '#94a3b8' : '#0f172a', fontWeight: '700', cursor: previewCurrentPage <= 1 ? 'not-allowed' : 'pointer' }}
                            >
                              ◄ Prev
                            </button>
                            <span style={{ fontWeight: '700', color: '#0f172a' }}>
                              Page {previewCurrentPage} of {totalStudentPages}
                            </span>
                            <button
                              type="button"
                              onClick={() => setPreviewCurrentPage(p => Math.min(totalStudentPages, p + 1))}
                              disabled={previewCurrentPage >= totalStudentPages}
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: previewCurrentPage >= totalStudentPages ? '#f1f5f9' : '#ffffff', color: previewCurrentPage >= totalStudentPages ? '#94a3b8' : '#0f172a', fontWeight: '700', cursor: previewCurrentPage >= totalStudentPages ? 'not-allowed' : 'pointer' }}
                            >
                              Next ►
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Grouped Preview Tables Body */}
                  <div style={{ maxHeight: '520px', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {(recipientRoles.student || recipientRoles.parent) && (
                      filteredStudentRecipients.length === 0 ? (
                        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                          <Users size={24} style={{ opacity: 0.5, marginBottom: '6px', margin: '0 auto' }} />
                          <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600 }}>No student recipients match your search/filter criteria.</p>
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#ffffff', minWidth: '700px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                <th style={{ padding: '10px 12px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Student Info</th>
                                <th style={{ padding: '10px 12px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Panel/Squad</th>
                                <th style={{ padding: '10px 12px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Student Contact</th>
                                <th style={{ padding: '10px 12px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Parent Contact</th>
                                <th style={{ padding: '10px 12px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status Queued</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedStudentRecipients.map((s, idx) => {
                                const hasParentEmail = s.parent_email && s.parent_email.trim() !== '';
                                const isStudentQueued = recipientRoles.student;
                                const isParentQueued = recipientRoles.parent && hasParentEmail;

                                return (
                                  <tr key={`grouped-student-${s.id || idx}`} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover:bg-slate-50">
                                    <td style={{ padding: '10px 12px' }}>
                                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '12.5px' }}>{s.name}</div>
                                      {s.prn && <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '1px' }}>PRN: {s.prn}</div>}
                                    </td>
                                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#334155' }}>
                                      {s.panel || '-'} {s.squad ? ` / ${s.squad}` : ''}
                                    </td>
                                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                                      {mailboxChannel === 'whatsapp' ? (s.phone || <span style={{ color: '#ef4444', fontWeight: '600' }}>Missing</span>) : s.email}
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                      {hasParentEmail ? (
                                        <div style={{ color: '#475569' }}>
                                          {mailboxChannel === 'whatsapp' ? (s.parent_mobile || <span style={{ color: '#ef4444', fontWeight: '600' }}>Missing</span>) : s.parent_email}
                                        </div>
                                      ) : (
                                        <span style={{ color: '#ea580c', background: '#fff7ed', border: '1px solid #ffedd5', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>
                                          Missing Parent
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        {isStudentQueued && (
                                          <span className="badge badge-blue" style={{ fontSize: '10px', padding: '2px 6px' }}>Student</span>
                                        )}
                                        {isParentQueued ? (
                                          <span className="badge badge-purple" style={{ fontSize: '10px', padding: '2px 6px' }}>Parent</span>
                                        ) : (
                                          recipientRoles.parent && <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>No Parent</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}

                    {/* Faculty Section */}
                    {recipientRoles.faculty && recipientSummaryMetrics.facultyRecipients.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
                          Faculty Members ({recipientSummaryMetrics.facultyRecipients.length})
                        </div>
                        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#ffffff', minWidth: '500px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                <th style={{ padding: '10px 12px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Faculty Name</th>
                                <th style={{ padding: '10px 12px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Squad</th>
                                <th style={{ padding: '10px 12px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Info</th>
                                <th style={{ padding: '10px 12px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recipientSummaryMetrics.facultyRecipients.map((f, idx) => (
                                <tr key={`fac-${f.id || idx}`} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover:bg-slate-50">
                                  <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>{f.name}</td>
                                  <td style={{ padding: '10px 12px', fontWeight: '600', color: '#334155' }}>{f.squad || '-'}</td>
                                  <td style={{ padding: '10px 12px', color: '#475569' }}>
                                    {mailboxChannel === 'whatsapp' ? (f.phone || <span style={{ color: '#ef4444', fontWeight: '600' }}>Missing</span>) : f.email}
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>
                                    <span className="badge badge-black" style={{ fontSize: '10px', padding: '2px 6px' }}>Faculty</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* LTC Members Section */}
                    {recipientRoles.ltc_member && recipientSummaryMetrics.ltcRecipients.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
                          LTC Members ({recipientSummaryMetrics.ltcRecipients.length})
                        </div>
                        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#ffffff', minWidth: '500px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                <th style={{ padding: '10px 12px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>LTC Member Name</th>
                                <th style={{ padding: '10px 12px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Info</th>
                                <th style={{ padding: '10px 12px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recipientSummaryMetrics.ltcRecipients.map((l, idx) => (
                                <tr key={`ltc-${l.id || idx}`} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover:bg-slate-50">
                                  <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>{l.name}</td>
                                  <td style={{ padding: '10px 12px', color: '#475569' }}>
                                    {mailboxChannel === 'whatsapp' ? (l.phone || <span style={{ color: '#ef4444', fontWeight: '600' }}>Missing</span>) : l.email}
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>
                                    <span className="badge badge-purple" style={{ fontSize: '10px', padding: '2px 6px' }}>LTC Member</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Pagination Controls Bar */}
                  {(recipientRoles.student || recipientRoles.parent) && filteredStudentRecipients.length > previewPageSize && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', fontSize: '11.5px', color: '#475569' }}>
                      <div>
                        Page <strong style={{ color: '#0f172a' }}>{previewCurrentPage}</strong> of <strong style={{ color: '#0f172a' }}>{totalStudentPages}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setPreviewCurrentPage(p => Math.max(1, p - 1))}
                          disabled={previewCurrentPage <= 1}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: previewCurrentPage <= 1 ? '#f1f5f9' : '#ffffff', color: previewCurrentPage <= 1 ? '#94a3b8' : '#0f172a', fontWeight: '700', cursor: previewCurrentPage <= 1 ? 'not-allowed' : 'pointer' }}
                        >
                          ◄ Prev
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewCurrentPage(p => Math.min(totalStudentPages, p + 1))}
                          disabled={previewCurrentPage >= totalStudentPages}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: previewCurrentPage >= totalStudentPages ? '#f1f5f9' : '#ffffff', color: previewCurrentPage >= totalStudentPages ? '#94a3b8' : '#0f172a', fontWeight: '700', cursor: previewCurrentPage >= totalStudentPages ? 'not-allowed' : 'pointer' }}
                        >
                          Next ►
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
          </div>
        );
      };

   const renderEmailLogsView = () => {
    // Filter queue entries
    const filteredQueueEntries = emailQueueEntries.filter(entry => {
      const status = (entry.status || 'pending').toLowerCase();
      const providerStatus = (entry.provider_status || '').toUpperCase();
      
      if (emailLogsViewTab === 'failed') {
        if (!['failed', 'permanent_fail', 'bounced', 'rejected', 'undeliverable', 'suppressed'].includes(status) &&
            !['SUPPRESSED', 'BOUNCED', 'REJECTED', 'FAILED', 'UNDELIVERABLE', 'COMPLAINED'].includes(providerStatus)) return false;
      } else if (emailLogsStatusFilter !== 'all') {
        if (emailLogsStatusFilter === 'delivered' && status !== 'delivered' && providerStatus !== 'DELIVERED') return false;
        if (emailLogsStatusFilter === 'sent' && (status !== 'sent' || ['SUPPRESSED', 'BOUNCED', 'REJECTED', 'FAILED', 'UNDELIVERABLE'].includes(providerStatus))) return false;
        if (emailLogsStatusFilter === 'suppressed' && status !== 'suppressed' && providerStatus !== 'SUPPRESSED') return false;
        if (emailLogsStatusFilter === 'bounced' && status !== 'bounced' && providerStatus !== 'BOUNCED') return false;
        if (emailLogsStatusFilter === 'failed' && !['failed', 'permanent_fail', 'rejected', 'undeliverable', 'suppressed'].includes(status) && !['SUPPRESSED', 'FAILED', 'REJECTED', 'UNDELIVERABLE'].includes(providerStatus)) return false;
        if (emailLogsStatusFilter === 'pending' && !['pending', 'queued'].includes(status)) return false;
      }

      if (emailLogsDateFilter !== 'all') {
        const logDate = new Date(entry.created_at || entry.updated_at);
        const now = new Date();
        if (emailLogsDateFilter === 'today') {
          if (logDate.toDateString() !== now.toDateString()) return false;
        } else if (emailLogsDateFilter === '7days') {
          const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (logDate < past7) return false;
        } else if (emailLogsDateFilter === '30days') {
          const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (logDate < past30) return false;
        }
      }

      if (!emailLogsSearch.trim()) return true;
      const q = emailLogsSearch.toLowerCase();
      return (
        (entry.to_email || '').toLowerCase().includes(q) ||
        (entry.recipient_name || '').toLowerCase().includes(q) ||
        (entry.subject || '').toLowerCase().includes(q) ||
        (entry.batch_name || '').toLowerCase().includes(q) ||
        (entry.resend_id || '').toLowerCase().includes(q) ||
        (entry.provider_status || '').toLowerCase().includes(q) ||
        (entry.bounce_reason || entry.error_message || '').toLowerCase().includes(q)
      );
    });

    const filteredAuditLogs = emailLogs.filter(log => {
      if (emailLogsFilterAction !== 'all' && log.action !== emailLogsFilterAction) return false;
      if (!emailLogsSearch.trim()) return true;
      const q = emailLogsSearch.toLowerCase();
      return (
        (log.batch_name || '').toLowerCase().includes(q) ||
        (log.subject || '').toLowerCase().includes(q) ||
        (log.template || '').toLowerCase().includes(q) ||
        (log.user_name || '').toLowerCase().includes(q)
      );
    });

    const activeList = emailLogsViewTab === 'audit' ? filteredAuditLogs : filteredQueueEntries;
    const totalItems = activeList.length;
    const totalPages = Math.ceil(totalItems / emailLogsPageSize) || 1;
    const safePage = Math.min(Math.max(1, emailLogsPage), totalPages);
    const paginatedItems = activeList.slice(
      (safePage - 1) * emailLogsPageSize,
      safePage * emailLogsPageSize
    );

    const isQueueActive = (emailLogsStats.total_pending || 0) > 0 || (isQueueActionLoading && queueActionType === 'resume');

    const renderStatusBadge = (statusStr, bounceReason, providerStatusStr) => {
      const st = (statusStr || 'pending').toLowerCase();
      const ps = (providerStatusStr || '').toUpperCase();

      if (ps === 'SUPPRESSED' || st === 'suppressed') {
        return (
          <span style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '6px', padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }} title={bounceReason || "Email suppressed by provider (Resend)"}>
            Suppressed
          </span>
        );
      }
      if (ps === 'BOUNCED' || st === 'bounced') {
        return (
          <span style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '6px', padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }} title={bounceReason}>
            Bounced
          </span>
        );
      }
      if (ps === 'REJECTED' || st === 'rejected') {
        return (
          <span style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '6px', padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }}>
            Rejected
          </span>
        );
      }
      if (st === 'delivered' || ps === 'DELIVERED') {
        return (
          <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }}>
            Delivered
          </span>
        );
      }
      if (st === 'sent' || ps === 'SENT') {
        return (
          <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }}>
            Sending
          </span>
        );
      }
      if (['failed', 'permanent_fail', 'undeliverable'].includes(st) || ps === 'FAILED') {
        return (
          <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '6px', padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }}>
            Failed
          </span>
        );
      }
      if (st === 'processing') {
        return (
          <span style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5', borderRadius: '6px', padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }}>
            Processing
          </span>
        );
      }
      if (st === 'paused') {
        return (
          <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '6px', padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }}>
            Paused
          </span>
        );
      }
      return (
        <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }}>
          Pending
        </span>
      );
    };

    return (
      <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px' }} className="animate-fade-in">
        <style>{`
          .btn-action-animated {
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          .btn-action-animated:hover:not(:disabled) {
            transform: translateY(-2px) scale(1.03) !important;
          }
        `}</style>

        {/* Header & Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Email Audit & Delivery Dashboard
              </h2>
              {liveConnectionStatus === 'online' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '2px 10px', fontSize: '11.5px', fontWeight: '700' }}>
                  <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', display: 'inline-block' }} className="animate-pulse" /> Live
                </span>
              ) : liveConnectionStatus === 'reconnecting' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', borderRadius: '12px', padding: '2px 10px', fontSize: '11.5px', fontWeight: '700' }}>
                  Reconnecting…
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '12px', padding: '2px 10px', fontSize: '11.5px', fontWeight: '700' }}>
                  Offline
                </span>
              )}
            </div>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 0' }}>
              Real-time delivery status tracking from Resend with automated bounce & failure detection.
              {lastEmailLogsUpdated && (
                <span style={{ marginLeft: '8px', color: '#94a3b8', fontSize: '11.5px', fontWeight: '600' }}>
                  (Last Updated: {lastEmailLogsUpdated.toLocaleTimeString()})
                </span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

            <button
              type="button"
              onClick={() => fetchEmailLogs(false)}
              disabled={loadingEmailLogs || isQueueActionLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px',
                border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#334155', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
              }}
              className="hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loadingEmailLogs ? 'spin' : ''} />
              <span>{loadingEmailLogs ? 'Syncing...' : 'Sync Resend'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportFailedEmailsExcel}
              disabled={(emailLogsStats.total_failed || 0) === 0}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px',
                border: (emailLogsStats.total_failed || 0) === 0 ? '1.5px solid #e2e8f0' : '1.5px solid #16a34a',
                background: (emailLogsStats.total_failed || 0) === 0 ? '#f8fafc' : '#f0fdf4',
                color: (emailLogsStats.total_failed || 0) === 0 ? '#94a3b8' : '#166534',
                fontSize: '12px', fontWeight: '700', cursor: (emailLogsStats.total_failed || 0) === 0 ? 'not-allowed' : 'pointer'
              }}
              title="Download Excel file of all failed/suppressed email recipients"
              className="btn-action-animated hover:bg-emerald-100"
            >
              <Download size={13} />
              <span>Download Failed Emails Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportFailedEmailsPdf}
              disabled={generatingFailedEmailsPdf || (emailLogsStats.total_failed || 0) === 0}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px',
                border: (emailLogsStats.total_failed || 0) === 0 ? '1.5px solid #e2e8f0' : '1.5px solid #224283',
                background: (emailLogsStats.total_failed || 0) === 0 ? '#f8fafc' : '#eff6ff',
                color: (emailLogsStats.total_failed || 0) === 0 ? '#94a3b8' : '#1e40af',
                fontSize: '12px', fontWeight: '700', cursor: (emailLogsStats.total_failed || 0) === 0 || generatingFailedEmailsPdf ? 'not-allowed' : 'pointer'
              }}
              title="Download PDF report of all failed/suppressed email recipients"
              className="btn-action-animated hover:bg-blue-100"
            >
              {generatingFailedEmailsPdf ? (
                <div className="spinner spinner-sm" style={{ borderTopColor: '#1e40af' }} />
              ) : (
                <Download size={13} />
              )}
              <span>{generatingFailedEmailsPdf ? 'Generating PDF...' : 'Download Failed Emails PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleQueueAction('retry')}
              disabled={isQueueActionLoading || (emailLogsStats.total_failed || 0) === 0}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px',
                border: (emailLogsStats.total_failed || 0) === 0 ? '1.5px solid #e2e8f0' : '1.5px solid #ef4444',
                background: (emailLogsStats.total_failed || 0) === 0 ? '#f1f5f9' : '#fef2f2',
                color: (emailLogsStats.total_failed || 0) === 0 ? '#94a3b8' : '#b91c1c',
                fontSize: '12px', fontWeight: '700', cursor: (emailLogsStats.total_failed || 0) === 0 ? 'not-allowed' : 'pointer'
              }}
              title={(emailLogsStats.total_failed || 0) === 0 ? "No failed/bounced emails" : `Re-queue ${emailLogsStats.total_failed} failed/bounced email(s)`}
            >
              {isQueueActionLoading && queueActionType === 'retry' ? (
                <div className="spinner spinner-sm" style={{ borderTopColor: '#b91c1c' }} />
              ) : (
                <RotateCcw size={13} />
              )}
              <span>Retry All Failed ({emailLogsStats.total_failed || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => handleQueueAction('pause')}
              disabled={isQueueActionLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px',
                border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#334155', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              <Pause size={13} />
              <span>Pause Queue</span>
            </button>

            <button
              type="button"
              onClick={() => handleQueueAction('resume')}
              disabled={isQueueActionLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px',
                border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#334155', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              <Play size={13} />
              <span>Resume Queue</span>
            </button>

            <button
              type="button"
              onClick={() => handleQueueAction('stop')}
              disabled={isQueueActionLoading || ((emailLogsStats.total_pending || 0) === 0 && (emailLogsStats.total_processing || 0) === 0)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px',
                border: '1.5px solid #dc2626', background: '#fef2f2', color: '#b91c1c', fontSize: '12px', fontWeight: '700',
                cursor: ((emailLogsStats.total_pending || 0) === 0 && (emailLogsStats.total_processing || 0) === 0) ? 'not-allowed' : 'pointer',
                opacity: ((emailLogsStats.total_pending || 0) === 0 && (emailLogsStats.total_processing || 0) === 0) ? 0.6 : 1
              }}
              title="Completely stop active email dispatch and freeze remaining queue entries"
            >
              <StopCircle size={14} color="#b91c1c" />
              <span>Stop Shooting</span>
            </button>

            <button
              type="button"
              onClick={() => handleQueueAction('clear')}
              disabled={isQueueActionLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px',
                border: '1.5px solid #ef4444', background: '#ffffff', color: '#dc2626', fontSize: '12px', fontWeight: '700', cursor: 'pointer'
              }}
              className="hover:bg-red-50"
              title="Reset all email counters and clear queue entries for a new bulk upload"
            >
              <RotateCcw size={13} />
              <span>Reset Queue & Stats</span>
            </button>
          </div>
        </div>

        {/* 5 Status Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? 'repeat(5, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px'
        }}>
          {/* Card 1: Delivered */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '84px', boxShadow: '0 3px 8px rgba(0,0,0,0.015)' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Delivered</span>
            </div>
            <div style={{ marginTop: '6px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#15803d' }}>
                {(emailLogsStats.total_delivered || 0).toLocaleString()}
              </h3>
            </div>
          </div>

          {/* Card 2: Sending */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '84px', boxShadow: '0 3px 8px rgba(0,0,0,0.015)' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sending</span>
            </div>
            <div style={{ marginTop: '6px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#1d4ed8' }}>
                {(emailLogsStats.total_sent || 0).toLocaleString()}
              </h3>
            </div>
          </div>

          {/* Card 3: Failed */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #fee2e2', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '84px', boxShadow: '0 3px 8px rgba(0,0,0,0.015)' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Failed</span>
            </div>
            <div style={{ marginTop: '6px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#dc2626' }}>
                {(emailLogsStats.total_failed || 0).toLocaleString()}
              </h3>
            </div>
          </div>

          {/* Card 4: Pending */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '84px', boxShadow: '0 3px 8px rgba(0,0,0,0.015)' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending</span>
            </div>
            <div style={{ marginTop: '6px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#c2410c' }}>
                {(emailLogsStats.total_pending || 0).toLocaleString()}
              </h3>
            </div>
          </div>

          {/* Card 5: Total */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '84px', boxShadow: '0 3px 8px rgba(0,0,0,0.015)' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</span>
            </div>
            <div style={{ marginTop: '6px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#0f172a' }}>
                {(emailLogsStats.total_all || 0).toLocaleString()}
              </h3>
            </div>
          </div>
        </div>

        {/* View Switcher Sub-Header Navigation */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '12px', padding: '4px', border: '1px solid #e2e8f0', gap: '4px', width: 'fit-content' }}>
          <button
            type="button"
            onClick={() => { setEmailLogsViewTab('queue'); setEmailLogsStatusFilter('all'); }}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: emailLogsViewTab === 'queue' ? '#ffffff' : 'transparent',
              color: emailLogsViewTab === 'queue' ? '#0f172a' : '#64748b',
              fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
              boxShadow: emailLogsViewTab === 'queue' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Mail size={14} /> Live Email Deliveries & Queue ({emailQueueEntries.length})
          </button>
          <button
            type="button"
            onClick={() => { setEmailLogsViewTab('failed'); }}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: emailLogsViewTab === 'failed' ? '#ffffff' : 'transparent',
              color: emailLogsViewTab === 'failed' ? '#dc2626' : '#64748b',
              fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
              boxShadow: emailLogsViewTab === 'failed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <AlertCircle size={14} color="#dc2626" /> Failed View ({emailLogsStats.total_failed || 0})
          </button>
          <button
            type="button"
            onClick={() => { setEmailLogsViewTab('audit'); }}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: emailLogsViewTab === 'audit' ? '#ffffff' : 'transparent',
              color: emailLogsViewTab === 'audit' ? '#0f172a' : '#64748b',
              fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
              boxShadow: emailLogsViewTab === 'audit' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <History size={14} /> Batch Dispatch Audit Logs ({emailLogs.length})
          </button>
        </div>

        {/* Filter Controls & Live Search Bar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', padding: '14px 16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ flex: '1 1 240px', minWidth: '200px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder={emailLogsViewTab === 'audit' ? "Search by batch name, subject, template or admin..." : "Search recipient email, name or batch..."}
              value={emailLogsSearch}
              onChange={(e) => setEmailLogsSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 34px', borderRadius: '8px', border: '1px solid #cbd5e1',
                fontSize: '12.5px', background: '#ffffff', color: '#0f172a', outline: 'none'
              }}
            />
          </div>

          {emailLogsViewTab === 'queue' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Delivery Status:</span>
              <select
                value={emailLogsStatusFilter}
                onChange={(e) => setEmailLogsStatusFilter(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '700', background: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
              >
                <option value="all">All Delivery Statuses</option>
                <option value="delivered">Delivered Only</option>
                <option value="suppressed">Suppressed Only</option>
                <option value="bounced">Bounced Only</option>
                <option value="failed">Failed Only</option>
                <option value="sent">Sending Only</option>
                <option value="pending">Pending Only</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Date:</span>
            <select
              value={emailLogsDateFilter}
              onChange={(e) => setEmailLogsDateFilter(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '700', background: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>


        {/* Content Table Views */}
        {loadingEmailLogs ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 12px auto' }} />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Fetching real-time delivery status logs from Resend...</span>
          </div>
        ) : paginatedItems.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '2px dashed #e2e8f0', color: '#64748b' }}>
            <Mail size={40} style={{ opacity: 0.3, marginBottom: '12px', margin: '0 auto' }} />
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#334155' }}>
              {emailLogsViewTab === 'failed' ? 'No Bounced or Failed Emails' : 'No Email Entries Found'}
            </h4>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              {emailLogsViewTab === 'failed'
                ? 'Great news! There are currently no emails flagged as bounced or failed in the system.'
                : 'No delivery log entries match your active search and status filter criteria.'}
            </p>
          </div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            {/* Top Pagination Control Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
              <div>
                Showing <strong style={{ color: '#0f172a' }}>{totalItems > 0 ? (safePage - 1) * emailLogsPageSize + 1 : 0}</strong>–<strong style={{ color: '#0f172a' }}>{Math.min(safePage * emailLogsPageSize, totalItems)}</strong> of <strong style={{ color: '#0f172a' }}>{totalItems}</strong> entries
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontWeight: '600' }}>Per Page:</span>
                  <select
                    value={emailLogsPageSize}
                    onChange={(e) => setEmailLogsPageSize(Number(e.target.value))}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '700', background: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setEmailLogsPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: safePage <= 1 ? '#f1f5f9' : '#ffffff', color: safePage <= 1 ? '#94a3b8' : '#0f172a', fontWeight: '700', cursor: safePage <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ◄ Prev
                  </button>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEmailLogsPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: safePage >= totalPages ? '#f1f5f9' : '#ffffff', color: safePage >= totalPages ? '#94a3b8' : '#0f172a', fontWeight: '700', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    Next ►
                  </button>
                </div>
              </div>
            </div>

            {/* Render Queue Table (or Audit Table) */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {emailLogsViewTab === 'audit' ? (
                      <>
                        <th style={{ padding: '12px 16px', fontWeight: '800' }}>Admin User</th>
                        <th style={{ padding: '12px 16px', fontWeight: '800' }}>Action</th>
                        <th style={{ padding: '12px 16px', fontWeight: '800' }}>Batch Name</th>
                        <th style={{ padding: '12px 16px', fontWeight: '800' }}>Subject / Template</th>
                        <th style={{ padding: '12px 16px', fontWeight: '800' }}>Recipients</th>
                        <th style={{ padding: '12px 16px', fontWeight: '800' }}>Dispatched At</th>
                      </>
                    ) : (
                      <>
                        <th style={{ padding: '12px 16px', fontWeight: '800' }}>Recipient Details</th>
                        <th style={{ padding: '12px 16px', fontWeight: '800' }}>Batch</th>
                        <th style={{ padding: '12px 16px', fontWeight: '800' }}>Delivery Status</th>
                        <th style={{ padding: '12px 16px', fontWeight: '800' }}>Timestamp</th>
                        <th style={{ padding: '12px 16px', fontWeight: '800', textAlign: 'right' }}>Actions</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item, idx) => {
                    if (emailLogsViewTab === 'audit') {
                      return (
                        <tr key={`audit-${item.id || idx}`} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover:bg-slate-50">
                          <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a' }}>{item.user_name}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <span className="badge badge-purple" style={{ fontSize: '10.5px' }}>{item.action}</span>
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: '600', color: '#334155' }}>{item.batch_name}</td>
                          <td style={{ padding: '14px 16px', color: '#475569' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a' }}>{item.subject}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Template: {item.template}</div>
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: '700', color: '#2563eb' }}>{item.recipient_count} recipients</td>
                          <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '11.5px' }}>
                            {new Date(item.created_at).toLocaleString()}
                          </td>
                        </tr>
                      );
                    }

                    const st = (item.status || 'pending').toLowerCase();
                    const ps = (item.provider_status || '').toUpperCase();
                    const isFailed = ['failed', 'permanent_fail', 'bounced', 'rejected', 'undeliverable', 'suppressed'].includes(st) ||
                                     ['SUPPRESSED', 'BOUNCED', 'REJECTED', 'FAILED', 'UNDELIVERABLE', 'COMPLAINED'].includes(ps);

                    return (
                      <tr key={`queue-${item.id || idx}`} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover:bg-slate-50">
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '800', color: '#0f172a' }}>{item.recipient_name || item.to_email}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                            {item.to_email}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: '700', color: '#334155' }}>
                          {item.batch_name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Global</span>}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {renderStatusBadge(item.status, item.bounce_reason || item.error_message, item.provider_status)}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '11.5px' }}>
                          {new Date(item.created_at || item.updated_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          {isFailed ? (
                            <button
                              type="button"
                              onClick={() => handleRetrySingleEmail(item.id, item.to_email)}
                              disabled={retryingEmailId === item.id || isQueueActionLoading}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#0f172a',
                                fontSize: '11.5px',
                                fontWeight: '700',
                                cursor: (retryingEmailId === item.id || isQueueActionLoading) ? 'not-allowed' : 'pointer'
                              }}
                              className="hover:bg-slate-100"
                              title="Re-queue this email for retry"
                            >
                              {retryingEmailId === item.id ? 'Retrying...' : 'Retry'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Bottom Pagination Bar */}
            {totalItems > emailLogsPageSize && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                <div>
                  Page <strong style={{ color: '#0f172a' }}>{safePage}</strong> of <strong style={{ color: '#0f172a' }}>{totalPages}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setEmailLogsPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: safePage <= 1 ? '#f1f5f9' : '#ffffff', color: safePage <= 1 ? '#94a3b8' : '#0f172a', fontWeight: '700', cursor: safePage <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ◄ Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailLogsPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: safePage >= totalPages ? '#f1f5f9' : '#ffffff', color: safePage >= totalPages ? '#94a3b8' : '#0f172a', fontWeight: '700', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    Next ►
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderWhatsappLogsView = () => {
    const filteredLogs = whatsappLogs.filter(log => {
      if (whatsappLogsFilterAction !== 'all' && log.action !== whatsappLogsFilterAction) return false;

      if (whatsappLogsStatusFilter !== 'all') {
        const status = (log.status || 'sent').toLowerCase();
        if (whatsappLogsStatusFilter === 'sent' && status !== 'sent') return false;
        if (whatsappLogsStatusFilter === 'failed' && !['failed', 'permanent_fail'].includes(status)) return false;
        if (whatsappLogsStatusFilter === 'pending' && status !== 'pending') return false;
        if (whatsappLogsStatusFilter === 'paused' && status !== 'paused') return false;
        if (whatsappLogsStatusFilter === 'stopped' && status !== 'stopped') return false;
      }

      if (whatsappLogsDateFilter !== 'all') {
        const logDate = new Date(log.created_at);
        const now = new Date();
        if (whatsappLogsDateFilter === 'today') {
          if (logDate.toDateString() !== now.toDateString()) return false;
        } else if (whatsappLogsDateFilter === '7days') {
          const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (logDate < past7) return false;
        } else if (whatsappLogsDateFilter === '30days') {
          const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (logDate < past30) return false;
        }
      }

      if (!whatsappLogsSearch.trim()) return true;
      const q = whatsappLogsSearch.toLowerCase();
      return (
        (log.batch_name || '').toLowerCase().includes(q) ||
        (log.body || '').toLowerCase().includes(q) ||
        (log.template || '').toLowerCase().includes(q) ||
        (log.user_name || '').toLowerCase().includes(q)
      );
    });

    const totalLogs = filteredLogs.length;
    const totalWhatsappLogsPages = Math.ceil(totalLogs / whatsappLogsPageSize) || 1;
    const safeWhatsappLogsPage = Math.min(Math.max(1, whatsappLogsPage), totalWhatsappLogsPages);
    const paginatedLogs = filteredLogs.slice(
      (safeWhatsappLogsPage - 1) * whatsappLogsPageSize,
      safeWhatsappLogsPage * whatsappLogsPageSize
    );

    const isQueueActive = (whatsappLogsStats.total_pending || 0) > 0 || (isWhatsappQueueActionLoading && whatsappQueueActionType === 'resume');

    return (
      <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px' }} className="animate-fade-in">
        {/* Header & Production Queue Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <Phone size={22} style={{ color: '#2563eb' }} /> WhatsApp Audit & Queue Dashboard
            </h2>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 0' }}>
              Monitor real-time WhatsApp delivery status, audit logs, and manage message queue processing state.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Refresh Button - Outline */}
            <button
              type="button"
              onClick={fetchWhatsappLogs}
              disabled={loadingWhatsappLogs || isWhatsappQueueActionLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: (loadingWhatsappLogs || isWhatsappQueueActionLoading) ? '1.5px solid #e2e8f0' : '1.5px solid #cbd5e1',
                background: (loadingWhatsappLogs || isWhatsappQueueActionLoading) ? '#f1f5f9' : '#ffffff',
                color: (loadingWhatsappLogs || isWhatsappQueueActionLoading) ? '#94a3b8' : '#334155',
                fontSize: '12px',
                fontWeight: '600',
                cursor: (loadingWhatsappLogs || isWhatsappQueueActionLoading) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              className={(loadingWhatsappLogs || isWhatsappQueueActionLoading) ? '' : 'hover:bg-slate-50 hover:border-slate-400'}
              title="Refresh log entries and queue metrics"
            >
              <RefreshCw size={13} className={loadingWhatsappLogs ? 'spin' : ''} />
              <span>{loadingWhatsappLogs ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {/* Retry All Failed Button - Outline */}
            <button
              type="button"
              onClick={() => handleWhatsappQueueAction('retry')}
              disabled={isWhatsappQueueActionLoading || (whatsappLogsStats.total_failed || 0) === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: (isWhatsappQueueActionLoading || (whatsappLogsStats.total_failed || 0) === 0) ? '1.5px solid #e2e8f0' : '1.5px solid #cbd5e1',
                background: (isWhatsappQueueActionLoading || (whatsappLogsStats.total_failed || 0) === 0) ? '#f1f5f9' : '#ffffff',
                color: (isWhatsappQueueActionLoading || (whatsappLogsStats.total_failed || 0) === 0) ? '#94a3b8' : '#334155',
                fontSize: '12px',
                fontWeight: '600',
                cursor: (isWhatsappQueueActionLoading || (whatsappLogsStats.total_failed || 0) === 0) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              className={(isWhatsappQueueActionLoading || (whatsappLogsStats.total_failed || 0) === 0) ? '' : 'hover:bg-slate-50 hover:border-slate-400'}
              title={(whatsappLogsStats.total_failed || 0) === 0 ? "No failed WhatsApp messages in queue" : `Re-queue ${whatsappLogsStats.total_failed} failed message(s) for delivery`}
            >
              {isWhatsappQueueActionLoading && whatsappQueueActionType === 'retry' ? (
                <div className="spinner spinner-sm" style={{ borderTopColor: '#334155' }} />
              ) : (
                <RotateCcw size={13} />
              )}
              <span>Retry All Failed</span>
            </button>

            {/* Pause Queue Button - Outline */}
            <button
              type="button"
              onClick={() => handleWhatsappQueueAction('pause')}
              disabled={isWhatsappQueueActionLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: isWhatsappQueueActionLoading ? '1.5px solid #e2e8f0' : '1.5px solid #cbd5e1',
                background: isWhatsappQueueActionLoading ? '#f1f5f9' : '#ffffff',
                color: isWhatsappQueueActionLoading ? '#94a3b8' : '#334155',
                fontSize: '12px',
                fontWeight: '600',
                cursor: isWhatsappQueueActionLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              className={isWhatsappQueueActionLoading ? '' : 'hover:bg-slate-50 hover:border-slate-400'}
              title="Pause pending WhatsApp queue processing"
            >
              {isWhatsappQueueActionLoading && whatsappQueueActionType === 'pause' ? (
                <div className="spinner spinner-sm" style={{ borderTopColor: '#334155' }} />
              ) : (
                <Pause size={13} />
              )}
              <span>Pause Queue</span>
            </button>

            {/* Resume Queue Button - Outline */}
            <button
              type="button"
              onClick={() => handleWhatsappQueueAction('resume')}
              disabled={isWhatsappQueueActionLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: isWhatsappQueueActionLoading ? '1.5px solid #e2e8f0' : '1.5px solid #cbd5e1',
                background: isWhatsappQueueActionLoading ? '#f1f5f9' : '#ffffff',
                color: isWhatsappQueueActionLoading ? '#94a3b8' : '#334155',
                fontSize: '12px',
                fontWeight: '600',
                cursor: isWhatsappQueueActionLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              className={isWhatsappQueueActionLoading ? '' : 'hover:bg-slate-50 hover:border-slate-400'}
              title="Resume dispatching paused or stopped WhatsApp messages"
            >
              {isWhatsappQueueActionLoading && whatsappQueueActionType === 'resume' ? (
                <div className="spinner spinner-sm" style={{ borderTopColor: '#334155' }} />
              ) : (
                <Play size={13} />
              )}
              <span>Resume Queue</span>
            </button>

            {/* Stop Queue Button - Outline */}
            <button
              type="button"
              onClick={() => handleWhatsappQueueAction('stop')}
              disabled={isWhatsappQueueActionLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: isWhatsappQueueActionLoading ? '1.5px solid #e2e8f0' : '1.5px solid #cbd5e1',
                background: isWhatsappQueueActionLoading ? '#f1f5f9' : '#ffffff',
                color: isWhatsappQueueActionLoading ? '#94a3b8' : '#334155',
                fontSize: '12px',
                fontWeight: '600',
                cursor: isWhatsappQueueActionLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              className={isWhatsappQueueActionLoading ? '' : 'hover:bg-slate-50 hover:border-slate-400'}
              title="Stop active WhatsApp queue processing"
            >
              {isWhatsappQueueActionLoading && whatsappQueueActionType === 'stop' ? (
                <div className="spinner spinner-sm" style={{ borderTopColor: '#334155' }} />
              ) : (
                <Square size={13} />
              )}
              <span>Stop Queue</span>
              {isQueueActive && (
                <span 
                  style={{ 
                    display: 'inline-block', 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%', 
                    background: '#22c55e', 
                    boxShadow: '0 0 4px #22c55e'
                  }} 
                  title="Queue Active Running"
                />
              )}
            </button>
          </div>
        </div>

        {/* 5 Small Status Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? 'repeat(5, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px'
        }}>
          {/* Card 1: Messages Sent */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', minHeight: '88px', boxShadow: '0 3px 8px rgba(0, 0, 0, 0.015)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sent</span>
              <CheckCircle2 size={16} color="#16a34a" />
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{(whatsappLogsStats.total_sent || 0).toLocaleString()}</h3>
          </div>

          {/* Card 2: Failed */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', minHeight: '88px', boxShadow: '0 3px 8px rgba(0, 0, 0, 0.015)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Failed</span>
              <AlertCircle size={16} color="#dc2626" />
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{(whatsappLogsStats.total_failed || 0).toLocaleString()}</h3>
          </div>

          {/* Card 3: Pending */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', minHeight: '88px', boxShadow: '0 3px 8px rgba(0, 0, 0, 0.015)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending</span>
              <Clock size={16} color="#ea580c" />
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{(whatsappLogsStats.total_pending || 0).toLocaleString()}</h3>
          </div>

          {/* Card 4: Paused */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', minHeight: '88px', boxShadow: '0 3px 8px rgba(0, 0, 0, 0.015)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paused</span>
              <PauseCircle size={16} color="#d97706" />
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{(whatsappLogsStats.total_paused || 0).toLocaleString()}</h3>
          </div>

          {/* Card 5: Stopped */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', minHeight: '88px', boxShadow: '0 3px 8px rgba(0, 0, 0, 0.015)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stopped</span>
              <StopCircle size={16} color="#64748b" />
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{(whatsappLogsStats.total_stopped || 0).toLocaleString()}</h3>
          </div>
        </div>

        {/* Filter Controls & Live Search Bar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', padding: '14px 16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ flex: '1 1 240px', minWidth: '200px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by batch name, message text, template or admin..."
              value={whatsappLogsSearch}
              onChange={(e) => setWhatsappLogsSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#ffffff', color: '#0f172a', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Status:</span>
            <select
              value={whatsappLogsStatusFilter}
              onChange={(e) => setWhatsappLogsStatusFilter(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '700', background: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">All Queue Statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="paused">Paused</option>
              <option value="stopped">Stopped</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Date:</span>
            <select
              value={whatsappLogsDateFilter}
              onChange={(e) => setWhatsappLogsDateFilter(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '700', background: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Template:</span>
            <select
              value={whatsappLogsFilterAction}
              onChange={(e) => setWhatsappLogsFilterAction(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '700', background: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">All WhatsApp Templates</option>
              <option value="ORIENTATION_WHATSAPP_SENT">Orientation Briefings Only</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        {loadingWhatsappLogs ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 12px auto' }} />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Fetching WhatsApp dispatch activity logs...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '2px dashed #e2e8f0', color: '#64748b' }}>
            <Phone size={40} style={{ opacity: 0.3, marginBottom: '12px', margin: '0 auto' }} />
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#334155' }}>No WhatsApp Dispatches Found</h4>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              {whatsappLogsSearch.trim() || whatsappLogsFilterAction !== 'all' || whatsappLogsStatusFilter !== 'all'
                ? 'No WhatsApp dispatch logs match your current search and filter criteria.'
                : 'When an Admin dispatches WhatsApp messages, detailed audit records will appear here.'}
            </p>
          </div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
              <div>
                Showing <strong style={{ color: '#0f172a' }}>{totalLogs > 0 ? (safeWhatsappLogsPage - 1) * whatsappLogsPageSize + 1 : 0}</strong>–<strong style={{ color: '#0f172a' }}>{Math.min(safeWhatsappLogsPage * whatsappLogsPageSize, totalLogs)}</strong> of <strong style={{ color: '#0f172a' }}>{totalLogs}</strong> audit logs
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontWeight: '600' }}>Per Page:</span>
                  <select
                    value={whatsappLogsPageSize}
                    onChange={(e) => setWhatsappLogsPageSize(Number(e.target.value))}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '700', background: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setWhatsappLogsPage(p => Math.max(1, p - 1))}
                    disabled={safeWhatsappLogsPage <= 1}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: safeWhatsappLogsPage <= 1 ? '#f1f5f9' : '#ffffff', color: safeWhatsappLogsPage <= 1 ? '#94a3b8' : '#0f172a', fontWeight: '700', cursor: safeWhatsappLogsPage <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ◄ Prev
                  </button>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>
                    Page {safeWhatsappLogsPage} of {totalWhatsappLogsPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWhatsappLogsPage(p => Math.min(totalWhatsappLogsPages, p + 1))}
                    disabled={safeWhatsappLogsPage >= totalWhatsappLogsPages}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: safeWhatsappLogsPage >= totalWhatsappLogsPages ? '#f1f5f9' : '#ffffff', color: safeWhatsappLogsPage >= totalWhatsappLogsPages ? '#94a3b8' : '#0f172a', fontWeight: '700', cursor: safeWhatsappLogsPage >= totalWhatsappLogsPages ? 'not-allowed' : 'pointer' }}
                  >
                    Next ►
                  </button>
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ margin: 0, width: '100%', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Timestamp</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Batch</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Template & Content</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recipients</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dispatched By</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log, idx) => (
                    <tr key={log.id || `log-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ fontSize: '12.5px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap', padding: '14px 18px' }}>
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', hour12: true
                        })}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: '800', fontSize: '13.5px', color: '#0f172a' }}>{log.batch_name}</div>
                        {log.batch_code && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Code: {log.batch_code}</div>}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="badge badge-green" style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.4px', width: 'fit-content', background: '#e8f5e9', color: '#2e7d32' }}>
                            {log.template}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: '550', color: '#1e293b', lineHeight: '1.4' }}>
                            {log.body}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: '800', fontSize: '13.5px', color: '#0f172a' }}>{log.recipient_count} Recipient(s)</div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'capitalize', marginTop: '2px' }}>
                          {Array.isArray(log.roles) ? log.roles.join(', ') : 'Students, Parents'}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>{log.user_name}</div>
                        <div style={{ fontSize: '11px', color: '#475569', fontWeight: '600', marginTop: '2px' }}>Admin Triggered</div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '3px 8px', fontSize: '11.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> Sent
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalLogs > whatsappLogsPageSize && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                <div>Page <strong style={{ color: '#0f172a' }}>{safeWhatsappLogsPage}</strong> of <strong style={{ color: '#0f172a' }}>{totalWhatsappLogsPages}</strong></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setWhatsappLogsPage(p => Math.max(1, p - 1))}
                    disabled={safeWhatsappLogsPage <= 1}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: safeWhatsappLogsPage <= 1 ? '#f1f5f9' : '#ffffff', color: safeWhatsappLogsPage <= 1 ? '#94a3b8' : '#0f172a', fontWeight: '700', cursor: safeWhatsappLogsPage <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ◄ Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setWhatsappLogsPage(p => Math.min(totalWhatsappLogsPages, p + 1))}
                    disabled={safeWhatsappLogsPage >= totalWhatsappLogsPages}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: safeWhatsappLogsPage >= totalWhatsappLogsPages ? '#f1f5f9' : '#ffffff', color: safeWhatsappLogsPage >= totalWhatsappLogsPages ? '#94a3b8' : '#0f172a', fontWeight: '700', cursor: safeWhatsappLogsPage >= totalWhatsappLogsPages ? 'not-allowed' : 'pointer' }}
                  >
                    Next ►
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const quickAccessActions = [
    { label: 'Faculty', tab: 'faculty', icon: <BookOpen size={16} />, color: '#f1f5f9', textColor: '#0f172a' },
    { label: 'Students', tab: 'students', icon: <GraduationCap size={16} />, color: '#eff6ff', textColor: '#0f172a' },
    { label: 'Batch Management', tab: 'batches', icon: <Layers size={16} />, color: '#eff6ff', textColor: '#0f172a' },
    { label: 'LTC Members', tab: 'ltcmembers', icon: <Users size={16} />, color: '#eff6ff', textColor: '#0f172a' },
    { label: 'Bulk Upload', tab: 'bulk', icon: <UploadCloud size={16} />, color: '#eff6ff', textColor: '#0f172a' },
    { label: 'Mailbox', tab: 'orientation', icon: <Mail size={16} />, color: '#eff6ff', textColor: '#0f172a' },
    { label: 'Email Audit Logs', tab: 'email_logs', icon: <History size={16} />, color: '#eff6ff', textColor: '#0f172a' },
    { label: 'Reports & Logs', tab: 'reports', icon: <BarChart2 size={16} />, color: '#f1f5f9', textColor: '#000000' },
    { label: 'Documents & SOPs', tab: 'documents', icon: <FileText size={16} />, color: '#f1f5f9', textColor: '#475569' },
    { label: 'Timetable', tab: 'timetable', icon: <Clock size={16} />, color: '#f1f5f9', textColor: '#0f172a' }
  ]

  const renderDashboardHomepage = () => {
    const studCount = users.filter(u => u.role === 'student').length
    const facCount = users.filter(u => u.role === 'faculty').length
    const ltcCount = users.filter(u => u.role === 'ltc_member').length
    const batchCount = batches.length

    // Calculate Undertakings Status
    const studentUndertakingsSubmitted = dashboardStats?.studentUndertaking?.submitted ?? 0
    const studentUndertakingPct = dashboardStats?.studentUndertaking?.pct ?? 0

    const facultyUndertakingsSubmitted = dashboardStats?.facultyUndertaking?.submitted ?? 0
    const facultyUndertakingPct = dashboardStats?.facultyUndertaking?.pct ?? 0

    // Calculate Feedbacks Status (Pre-LTC & Post-LTC for Students)
    const studentPreFeedbackPct = dashboardStats?.studentPreFeedback?.pct ?? dashboardStats?.studentFeedback?.pct ?? 0
    const studentPostFeedbackPct = dashboardStats?.studentPostFeedback?.pct ?? 0

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Faculty Card */}
          <div 
            onClick={() => setActiveTab('faculty')} 
            style={{ 
              background: '#ffffff', 
              borderRadius: '16px', 
              border: '1px solid #e2e8f0', 
              padding: '12px 16px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              position: 'relative', 
              overflow: 'hidden', 
              minHeight: '110px', 
              maxHeight: '115px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            {/* Top Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
              {/* Left Part */}
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {t("Assigned Faculty")}
              </span>

              {/* Right Part: Compact Premium Icon Tile */}
              <div style={{ 
                width: '38px', 
                height: '38px', 
                background: '#ffffff', 
                borderRadius: '10px', 
                boxShadow: '0 6px 15px -3px rgba(59, 130, 246, 0.15)', 
                border: '1px solid rgba(59, 130, 246, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <BookOpen size={20} color="#1d4ed8" strokeWidth={2.4} />
              </div>
            </div>

            {/* Bottom Large Value */}
            <div style={{ zIndex: 2 }}>
              <h3 style={{ fontSize: '32px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {facCount.toLocaleString()}
              </h3>
            </div>

            {/* Dot Grid Watermark & Glow */}
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '120px', 
              height: '100px', 
              background: 'radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.07), transparent 70%)',
              pointerEvents: 'none',
              zIndex: 1
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                backgroundImage: 'radial-gradient(rgba(37, 99, 235, 0.16) 1.5px, transparent 1.5px)',
                backgroundSize: '8px 8px',
                WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
              }} />
            </div>
          </div>

          {/* Students Card */}
          <div 
            onClick={() => setActiveTab('students')} 
            style={{ 
              background: '#ffffff', 
              borderRadius: '16px', 
              border: '1px solid #e2e8f0', 
              padding: '12px 16px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              position: 'relative', 
              overflow: 'hidden', 
              minHeight: '110px', 
              maxHeight: '115px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            {/* Top Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
              {/* Left Part */}
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {t("Students Eligible")}
              </span>

              {/* Right Part: Compact Premium Icon Tile */}
              <div style={{ 
                width: '38px', 
                height: '38px', 
                background: '#ffffff', 
                borderRadius: '10px', 
                boxShadow: '0 6px 15px -3px rgba(30, 58, 138, 0.15)', 
                border: '1px solid rgba(30, 58, 138, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <GraduationCap size={20} color="#1e3a8a" strokeWidth={2.4} />
              </div>
            </div>

            {/* Bottom Large Value */}
            <div style={{ zIndex: 2 }}>
              <h3 style={{ fontSize: '32px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {studCount.toLocaleString()}
              </h3>
            </div>

            {/* Dot Grid Watermark & Glow */}
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '120px', 
              height: '100px', 
              background: 'radial-gradient(circle at bottom right, rgba(30, 58, 138, 0.07), transparent 70%)',
              pointerEvents: 'none',
              zIndex: 1
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                backgroundImage: 'radial-gradient(rgba(30, 58, 138, 0.16) 1.5px, transparent 1.5px)',
                backgroundSize: '8px 8px',
                WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
              }} />
            </div>
          </div>

          {/* Batches Card */}
          <div 
            onClick={() => setActiveTab('batches')} 
            style={{ 
              background: '#ffffff', 
              borderRadius: '16px', 
              border: '1px solid #e2e8f0', 
              padding: '12px 16px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              position: 'relative', 
              overflow: 'hidden', 
              minHeight: '110px', 
              maxHeight: '115px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            {/* Top Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
              {/* Left Part */}
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {t("Planned Batches")}
              </span>

              {/* Right Part: Compact Premium Icon Tile */}
              <div style={{ 
                width: '38px', 
                height: '38px', 
                background: '#ffffff', 
                borderRadius: '10px', 
                boxShadow: '0 6px 15px -3px rgba(249, 115, 22, 0.15)', 
                border: '1px solid rgba(249, 115, 22, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Layers size={20} color="#ea580c" strokeWidth={2.4} />
              </div>
            </div>

            {/* Bottom Large Value */}
            <div style={{ zIndex: 2 }}>
              <h3 style={{ fontSize: '32px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {batchCount}
              </h3>
            </div>

            {/* Dot Grid Watermark & Glow */}
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '120px', 
              height: '100px', 
              background: 'radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.07), transparent 70%)',
              pointerEvents: 'none',
              zIndex: 1
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                backgroundImage: 'radial-gradient(rgba(249, 115, 22, 0.16) 1.5px, transparent 1.5px)',
                backgroundSize: '8px 8px',
                WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
              }} />
            </div>
          </div>

          {/* LTC Members Card */}
          <div 
            onClick={() => setActiveTab('ltcmembers')} 
            style={{ 
              background: '#ffffff', 
              borderRadius: '16px', 
              border: '1px solid #e2e8f0', 
              padding: '12px 16px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              position: 'relative', 
              overflow: 'hidden', 
              minHeight: '110px', 
              maxHeight: '115px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            {/* Top Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
              {/* Left Part */}
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {t("LTC coordinator")}
              </span>

              {/* Right Part: Compact Premium Icon Tile */}
              <div style={{ 
                width: '38px', 
                height: '38px', 
                background: '#ffffff', 
                borderRadius: '10px', 
                boxShadow: '0 6px 15px -3px rgba(34, 197, 94, 0.15)', 
                border: '1px solid rgba(34, 197, 94, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Shield size={20} color="#16a34a" strokeWidth={2.4} />
              </div>
            </div>

            {/* Bottom Large Value */}
            <div style={{ zIndex: 2 }}>
              <h3 style={{ fontSize: '32px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {ltcCount}
              </h3>
            </div>

            {/* Dot Grid Watermark & Glow */}
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '120px', 
              height: '100px', 
              background: 'radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.07), transparent 70%)',
              pointerEvents: 'none',
              zIndex: 1
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                backgroundImage: 'radial-gradient(rgba(34, 197, 94, 0.16) 1.5px, transparent 1.5px)',
                backgroundSize: '8px 8px',
                WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
              }} />
            </div>
          </div>
        </div>

        {/* Middle Section Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Undertakings Status */}
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.01), 0 10px 30px rgba(0,0,0,0.02)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '210px',
              height: '210px'
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              borderBottom: '1px solid #f1f5f9',
              zIndex: 2
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ 
                  width: '38px', 
                  height: '38px', 
                  background: '#ffffff', 
                  borderRadius: '10px', 
                  boxShadow: '0 6px 15px -3px rgba(37, 99, 235, 0.15)', 
                  border: '1px solid rgba(37, 99, 235, 0.08)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center'
                }}>
                  <CheckSquare size={20} color="#2563eb" strokeWidth={2.4} />
                </div>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Undertakings Status")}
                </span>
              </div>
              <div style={{ cursor: 'pointer', color: '#94a3b8' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </div>
            </div>

            {/* Body */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              flex: 1,
              padding: '8px 16px',
              zIndex: 2
            }}>
              {!activeBatch ? (
                <div className="text-xs text-on-surface-variant font-semibold py-6">{t("No Active Batch")}</div>
              ) : (
                <>
                  {/* Students Progress */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ position: 'relative', width: '95px', height: '95px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        {/* Background track circle */}
                        <path 
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                          fill="none" 
                          stroke="#eff6ff" 
                          strokeWidth="2.5"
                        />
                        {/* Active progress track */}
                        {studentUndertakingPct > 0 ? (
                          <path 
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                            fill="none" 
                            stroke="url(#blueGradient)" 
                            strokeDasharray={`${studentUndertakingPct}, 100`} 
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        ) : null}
                        {/* Add a tiny blue dot at the top if completion is 0% */}
                        {studentUndertakingPct === 0 && (
                          <circle cx="18" cy="2.0845" r="1.2" fill="#2563eb" />
                        )}
                        <defs>
                          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#2563eb" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>{studentUndertakingPct}%</span>
                      </div>
                    </div>

                    {/* Legend Text */}
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t("Students")}
                    </span>
                  </div>

                  {/* Faculty Progress */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ position: 'relative', width: '95px', height: '95px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        {/* Background track circle */}
                        <path 
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                          fill="none" 
                          stroke="#eff6ff" 
                          strokeWidth="2.5"
                        />
                        {/* Active progress track */}
                        {facultyUndertakingPct > 0 ? (
                          <path 
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                            fill="none" 
                            stroke="url(#blueGradient)" 
                            strokeDasharray={`${facultyUndertakingPct}, 100`} 
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        ) : null}
                        {/* Add a tiny blue dot at the top if completion is 0% */}
                        {facultyUndertakingPct === 0 && (
                          <circle cx="18" cy="2.0845" r="1.2" fill="#2563eb" />
                        )}
                      </svg>
                      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>{facultyUndertakingPct}%</span>
                      </div>
                    </div>

                    {/* Legend Text */}
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t("Faculty")}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Dot Grids on Bottom-Left and Bottom-Right */}
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              left: 0, 
              width: '80px', 
              height: '90px', 
              backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px)', 
              backgroundSize: '8px 8px', 
              WebkitMaskImage: 'radial-gradient(circle at bottom left, black 20%, transparent 80%)',
              maskImage: 'radial-gradient(circle at bottom left, black 20%, transparent 80%)',
              pointerEvents: 'none',
              zIndex: 1
            }} />
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '80px', 
              height: '90px', 
              backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px)', 
              backgroundSize: '8px 8px', 
              WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
              maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
              pointerEvents: 'none',
              zIndex: 1
            }} />
          </div>

          {/* Feedbacks Status */}
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.01), 0 10px 30px rgba(0,0,0,0.02)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '210px',
              height: '210px'
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              borderBottom: '1px solid #f1f5f9',
              zIndex: 2
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ 
                  width: '38px', 
                  height: '38px', 
                  background: '#ffffff', 
                  borderRadius: '10px', 
                  boxShadow: '0 6px 15px -3px rgba(37, 99, 235, 0.15)', 
                  border: '1px solid rgba(37, 99, 235, 0.08)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <MessageSquare size={20} color="#2563eb" strokeWidth={2.4} />
                </div>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Feedbacks Status")}
                </span>
              </div>
              <div style={{ cursor: 'pointer', color: '#94a3b8' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </div>
            </div>

            {/* Body */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              flex: 1,
              padding: '8px 16px',
              zIndex: 2
            }}>
              {/* Pre-LTC Feedback Progress */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{ position: 'relative', width: '95px', height: '95px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    {/* Background track circle */}
                    <path 
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                      fill="none" 
                      stroke="#eff6ff" 
                      strokeWidth="2.5"
                    />
                    {/* Active progress track */}
                    {studentPreFeedbackPct > 0 ? (
                      <path 
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                        fill="none" 
                        stroke="url(#blueFeedbackGradient)" 
                        strokeDasharray={`${studentPreFeedbackPct}, 100`} 
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    ) : null}
                    {/* Add a tiny blue dot at the top if completion is 0% */}
                    {studentPreFeedbackPct === 0 && (
                      <circle cx="18" cy="2.0845" r="1.2" fill="#2563eb" />
                    )}
                    <defs>
                      <linearGradient id="blueFeedbackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#2563eb" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>{studentPreFeedbackPct}%</span>
                  </div>
                </div>

                {/* Legend Text */}
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Pre-LTC Feedback")}
                </span>
              </div>

              {/* Post-LTC Feedback Progress */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{ position: 'relative', width: '95px', height: '95px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    {/* Background track circle */}
                    <path 
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                      fill="none" 
                      stroke="#eff6ff" 
                      strokeWidth="2.5"
                    />
                    {/* Active progress track */}
                    {studentPostFeedbackPct > 0 ? (
                      <path 
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                        fill="none" 
                        stroke="url(#blueFeedbackGradient)" 
                        strokeDasharray={`${studentPostFeedbackPct}, 100`} 
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    ) : null}
                    {/* Add a tiny blue dot at the top if completion is 0% */}
                    {studentPostFeedbackPct === 0 && (
                      <circle cx="18" cy="2.0845" r="1.2" fill="#2563eb" />
                    )}
                  </svg>
                  <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>{studentPostFeedbackPct}%</span>
                  </div>
                </div>

                {/* Legend Text */}
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Post-LTC Feedback")}
                </span>
              </div>
            </div>

            {/* Dot Grids on Bottom-Left and Bottom-Right */}
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              left: 0, 
              width: '80px', 
              height: '90px', 
              backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px)', 
              backgroundSize: '8px 8px', 
              WebkitMaskImage: 'radial-gradient(circle at bottom left, black 20%, transparent 80%)',
              maskImage: 'radial-gradient(circle at bottom left, black 20%, transparent 80%)',
              pointerEvents: 'none',
              zIndex: 1
            }} />
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '80px', 
              height: '90px', 
              backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px)', 
              backgroundSize: '8px 8px', 
              WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
              maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
              pointerEvents: 'none',
              zIndex: 1
            }} />
          </div>

          {/* Active Batch Card */}
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.01), 0 10px 30px rgba(0,0,0,0.02)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '210px',
              height: '210px'
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              borderBottom: '1px solid #f1f5f9',
              zIndex: 2
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ 
                  width: '38px', 
                  height: '38px', 
                  background: '#ffffff', 
                  borderRadius: '10px', 
                  boxShadow: '0 6px 15px -3px rgba(79, 70, 229, 0.15)', 
                  border: '1px solid rgba(79, 70, 229, 0.08)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Layers size={20} color="#4f46e5" strokeWidth={2.4} />
                </div>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Active Batch")}
                </span>
              </div>
              {activeBatch && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-error-container/50 text-on-error-container text-[10px] font-bold tracking-wide uppercase border border-error-container">
                  <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse"></span>
                  {t("Live")}
                </span>
              )}
            </div>

            {/* Body */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              flex: 1,
              padding: '14px 20px',
              zIndex: 2
            }}>
              {activeBatch ? (
                <>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t(activeBatch.name)}
                    </h3>
                    {activeBatch.start_date && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        <span className="material-symbols-outlined text-[14px]">event</span>
                        {new Date(activeBatch.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(activeBatch.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    paddingTop: '10px', 
                    borderTop: '1px solid #f1f5f9' 
                  }}>
                    <button
                      onClick={() => {
                        setActiveTab('batches');
                        setOpenBatchOnLoad(activeBatch);
                      }}
                      style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#2563eb',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}
                    >
                      {t("Manage Batch")}
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                    {activeBatch.year && (
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        {t("Class of")} {activeBatch.year}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifycontent: 'center', flex: 1, color: '#94a3b8' }}>
                  <span className="material-symbols-outlined text-[30px] mb-1">layers</span>
                  <p style={{ fontSize: '13px', fontWeight: '500', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {t("No Active Batch Currently")}
                  </p>
                </div>
              )}
            </div>

            {/* Dot Grids on Bottom-Left and Bottom-Right */}
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              left: 0, 
              width: '80px', 
              height: '90px', 
              backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px)', 
              backgroundSize: '8px 8px', 
              WebkitMaskImage: 'radial-gradient(circle at bottom left, black 20%, transparent 80%)',
              maskImage: 'radial-gradient(circle at bottom left, black 20%, transparent 80%)',
              pointerEvents: 'none',
              zIndex: 1
            }} />
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '80px', 
              height: '90px', 
              backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px)', 
              backgroundSize: '8px 8px', 
              WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
              maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
              pointerEvents: 'none',
              zIndex: 1
            }} />
          </div>
        </div>
        {/* LAP Schedule */}
        <TimetablePanel compact={true} onViewDetail={() => setActiveTab('timetable')} />
      </div>
    )
  }

  const renderSidebarItem = (tab, iconElement, label, badge) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => handleTabClick(tab)}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          padding: '9px 12px',
          borderRadius: '8px',
          fontSize: '13.5px',
          fontWeight: isActive ? '600' : '500',
          color: isActive ? '#ffffff' : '#475569',
          background: isActive ? '#ea580c' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease-in-out',
          textAlign: 'left',
          width: '100%',
          outline: 'none',
          marginBottom: '2px',
          overflow: 'hidden'
        }}
        className={isActive ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
      >
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, width: '100%' }}>
          <div style={{ color: isActive ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {React.cloneElement(iconElement, { size: 16, strokeWidth: isActive ? 2.2 : 2 })}
          </div>
          <span style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            opacity: isCollapsed ? 0 : 1,
            maxWidth: isCollapsed ? '0px' : '200px',
            marginLeft: isCollapsed ? '0px' : '10px',
            visibility: isCollapsed ? 'hidden' : 'visible',
            transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, margin 0.3s cubic-bezier(0.4,0,0.2,1), visibility 0.3s'
          }}>{label}</span>
        </div>
        {badge && (
          <span style={{
            fontSize: '10px',
            fontWeight: '700',
            padding: isCollapsed ? '0px' : '2px 6px',
            borderRadius: '4px',
            background: badge.bg || (isActive ? 'rgba(255,255,255,0.2)' : '#f1f5f9'),
            color: badge.color || (isActive ? '#ffffff' : '#0f172a'),
            lineHeight: 1,
            opacity: isCollapsed ? 0 : 1,
            maxWidth: isCollapsed ? '0px' : '80px',
            overflow: 'hidden',
            visibility: isCollapsed ? 'hidden' : 'visible',
            transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease, padding 0.3s cubic-bezier(0.4,0,0.2,1), visibility 0.3s'
          }}>
            {badge.text}
          </span>
        )}
      </button>
    );
  };

  const renderDesktopSidebar = () => {
    return (
      <aside 
        className={`relative flex-shrink-0 bg-white flex flex-col transition-[width] duration-300 ease-in-out z-20 ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}`} 
        style={{
          height: '100%',
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
          aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {isCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
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
            backgroundColor: '#dbeafe',
            border: '1px solid #cbd5e1',
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
          aria-label={isCollapsed ? "Expand/Collapse Sidebar" : "Collapse/Expand Sidebar"}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#475569' }}></span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#475569' }}></span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#475569' }}></span>
          </div>
        </button>

        {/* Logo / Brand Header — cross-fade */}
        <div style={{ height: '80px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', flexShrink: 0, transition: 'padding 0.35s cubic-bezier(0.4,0,0.2,1)', padding: isCollapsed ? '0' : '0 24px' }}>
          <img src="/ltc.png" alt="LTC Logo" style={{ height: '40px', objectFit: 'contain', position: 'absolute', left: isCollapsed ? '50%' : '24px', transform: isCollapsed ? 'translateX(-50%)' : 'none', opacity: isCollapsed ? 0 : 1, transition: 'opacity 0.3s ease, left 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)', pointerEvents: 'none' }} />
          <img src="/lg.png" alt="LTC Logo" style={{ height: '36px', width: '36px', objectFit: 'contain', opacity: isCollapsed ? 1 : 0, transform: isCollapsed ? 'scale(1)' : 'scale(0.7)', transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)', pointerEvents: 'none' }} />
        </div>

        {/* Navigation Area */}
        <div ref={sidebarNavRef} className="flex-1 overflow-y-auto py-4 px-3 space-y-4 no-scrollbar" style={{ display: 'flex', flexDirection: 'column', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <nav style={{ display: 'flex', flexDirection: 'column' }}>
            
            {/* Section: MAIN */}
            <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: isCollapsed ? '0px' : '32px', opacity: isCollapsed ? 0 : 1, padding: isCollapsed ? '0 12px' : '12px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>Main</span>
            
            {/* Dashboard Nav Item with dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <button
                onClick={handleDashboardParentClick}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'dashboard' ? '600' : '500',
                  color: activeTab === 'dashboard' ? '#ffffff' : '#475569',
                  background: activeTab === 'dashboard' ? '#ea580c' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  width: '100%',
                  outline: 'none',
                  marginBottom: '2px'
                }}
                className={activeTab === 'dashboard' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
              >
                <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, width: '100%' }}>
                  <div style={{ color: activeTab === 'dashboard' ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <Home size={16} strokeWidth={activeTab === 'dashboard' ? 2.2 : 2} />
                  </div>
                  <span style={{ fontFamily: 'system-ui, -apple-system, sans-serif', whiteSpace: 'nowrap', opacity: isCollapsed ? 0 : 1, maxWidth: isCollapsed ? '0px' : '200px', marginLeft: isCollapsed ? '0px' : '10px', visibility: isCollapsed ? 'hidden' : 'visible', transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, margin 0.3s cubic-bezier(0.4,0,0.2,1), visibility 0.3s' }}>{t("Dashboard")}</span>
                </div>
                <span style={{ transition: 'transform 0.2s, opacity 0.25s ease', transform: isDashboardDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: activeTab === 'dashboard' ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center', opacity: isCollapsed ? 0 : 1, visibility: isCollapsed ? 'hidden' : 'visible' }}>
                  <ChevronDown size={13} />
                </span>
              </button>
              
              {isDashboardDropdownOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <button
                    onClick={() => handleTabClick('global-search')}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      paddingLeft: isCollapsed ? '12px' : '32px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: activeTab === 'global-search' ? '600' : '500',
                      color: activeTab === 'global-search' ? '#ffffff' : '#475569',
                      background: activeTab === 'global-search' ? '#ea580c' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      width: '100%',
                      outline: 'none',
                      marginBottom: '2px'
                    }}
                    className={activeTab === 'global-search' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{ color: activeTab === 'global-search' ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center' }}>
                        <Search size={14} strokeWidth={activeTab === 'global-search' ? 2.2 : 2} />
                      </div>
                      <span style={{ fontFamily: 'system-ui, -apple-system, sans-serif', whiteSpace: 'nowrap', opacity: isCollapsed ? 0 : 1, maxWidth: isCollapsed ? '0px' : '200px', marginLeft: isCollapsed ? '0px' : '10px', visibility: isCollapsed ? 'hidden' : 'visible', transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, margin 0.3s cubic-bezier(0.4,0,0.2,1), visibility 0.3s' }}>{t("Global Search")}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Section: PEOPLE */}
            <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: isCollapsed ? '0px' : '32px', opacity: isCollapsed ? 0 : 1, padding: isCollapsed ? '0 12px' : '16px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>People</span>
            {renderSidebarItem('faculty', <BookOpen />, t("Faculty"))}
            {renderSidebarItem('students', <GraduationCap />, t("Students"))}
            {renderSidebarItem('ltcmembers', <Shield />, t("LTC Members"))}

            {/* Section: MANAGEMENT */}
            <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: isCollapsed ? '0px' : '32px', opacity: isCollapsed ? 0 : 1, padding: isCollapsed ? '0 12px' : '16px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>Management</span>
            {renderSidebarItem('batches', <Layers />, t("Batch Management"))}
            {renderSidebarItem('timetable', <Clock />, t("LAP Timetable"))}
            {renderSidebarItem('bulk', <UploadCloud />, t("Bulk Upload"))}
            {renderSidebarItem('documents', <FileText />, t("Documents & SOPs"))}
            {renderSidebarItem('reports', <BarChart2 />, t("Reports & Logs"))}
            {renderSidebarItem('submissions', <ClipboardList />, t("Submissions"))}
            {renderSidebarItem('ai-form-analysis', <Sparkles />, t("AI Form Analysis"))}
            {renderSidebarItem('misc', <Flag />, t("Miscellaneous"))}

            {/* Section: COMMUNICATIONS */}
            <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: isCollapsed ? '0px' : '32px', opacity: isCollapsed ? 0 : 1, padding: isCollapsed ? '0 12px' : '16px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>Communication</span>
            
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <button
                onClick={handleCommunicationParentClick}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: ['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? '600' : '500',
                  color: ['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? '#ffffff' : '#475569',
                  background: ['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? '#ea580c' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  width: '100%',
                  outline: 'none',
                  marginBottom: '2px'
                }}
                className={['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
              >
                <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, width: '100%' }}>
                  <div style={{ color: ['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <MessageSquare size={16} strokeWidth={['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? 2.2 : 2} />
                  </div>
                  <span style={{ fontFamily: 'system-ui, -apple-system, sans-serif', whiteSpace: 'nowrap', opacity: isCollapsed ? 0 : 1, maxWidth: isCollapsed ? '0px' : '200px', marginLeft: isCollapsed ? '0px' : '10px', visibility: isCollapsed ? 'hidden' : 'visible', transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, margin 0.3s cubic-bezier(0.4,0,0.2,1), visibility 0.3s' }}>
                    {t("Communication")}
                  </span>
                </div>
                <span style={{ transition: 'transform 0.2s, opacity 0.25s ease', transform: isCommunicationDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: ['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center', opacity: isCollapsed ? 0 : 1, visibility: isCollapsed ? 'hidden' : 'visible' }}>
                  <ChevronDown size={13} />
                </span>
              </button>
              
              {isCommunicationDropdownOpen && !isCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '16px' }}>
                  <button
                    onClick={() => handleTabClick('orientation')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: activeTab === 'orientation' ? '600' : '500',
                      color: activeTab === 'orientation' ? '#ea580c' : '#475569',
                      background: activeTab === 'orientation' ? '#fff7ed' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      width: '100%',
                      outline: 'none',
                      marginBottom: '2px'
                    }}
                    className={activeTab === 'orientation' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                  >
                    <Send size={14} />
                    <span>{t("Sender Console")}</span>
                  </button>

                  <button
                    onClick={() => handleTabClick('email_logs')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: activeTab === 'email_logs' ? '600' : '500',
                      color: activeTab === 'email_logs' ? '#ea580c' : '#475569',
                      background: activeTab === 'email_logs' ? '#fff7ed' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      width: '100%',
                      outline: 'none',
                      marginBottom: '2px'
                    }}
                    className={activeTab === 'email_logs' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                  >
                    <Mail size={14} />
                    <span>{t("Email Audit Logs")}</span>
                  </button>

                  <button
                    onClick={() => handleTabClick('whatsapp_logs')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: activeTab === 'whatsapp_logs' ? '600' : '500',
                      color: activeTab === 'whatsapp_logs' ? '#ea580c' : '#475569',
                      background: activeTab === 'whatsapp_logs' ? '#fff7ed' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      width: '100%',
                      outline: 'none',
                      marginBottom: '2px'
                    }}
                    className={activeTab === 'whatsapp_logs' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                  >
                    <Phone size={14} />
                    <span>{t("WhatsApp Audit Logs")}</span>
                  </button>

                  <button
                    onClick={() => handleTabClick('whatsapp_campaign')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: activeTab === 'whatsapp_campaign' ? '600' : '500',
                      color: activeTab === 'whatsapp_campaign' ? '#ea580c' : '#475569',
                      background: activeTab === 'whatsapp_campaign' ? '#fff7ed' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      width: '100%',
                      outline: 'none',
                      marginBottom: '2px'
                    }}
                    className={activeTab === 'whatsapp_campaign' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                  >
                    <Smartphone size={14} />
                    <span>{t("WhatsApp Communication")}</span>
                  </button>
                </div>
              )}
            </div>
            {renderSidebarItem('tickets', <MessageSquare />, t("Support Tickets"))}
            {renderSidebarItem('journey', <Film />, t("LAP Journey Media"))}
            {renderSidebarItem('faq', <HelpCircle />, t("FAQs"))}
          </nav>
        </div>

        {/* Bottom Profile Section - unified with smooth transitions */}
        <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? '0px' : '12px', padding: '4px 8px', overflow: 'hidden', transition: 'gap 0.35s cubic-bezier(0.4,0,0.2,1)', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
            <div className="rounded-full text-white flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)', width: '32px', height: '32px', fontSize: '11px', transition: 'all 0.3s ease' }} title="Admin">AD</div>
            <div style={{ overflow: 'hidden', maxWidth: isCollapsed ? '0px' : '180px', opacity: isCollapsed ? 0 : 1, visibility: isCollapsed ? 'hidden' : 'visible', transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, visibility 0.35s', whiteSpace: 'nowrap' }}>
              <p style={{ fontWeight: '600', fontSize: '12px', color: '#0f172a', lineHeight: '1.2' }}>{t("Admin")}</p>
              <p style={{ fontSize: '10px', color: '#64748b' }}>admin@ltc.com</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: isCollapsed ? 'center' : 'stretch' }}>
            <button
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isCollapsed ? '0px' : '6px', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#475569', cursor: 'pointer', fontSize: '11.5px', fontWeight: '600', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', flex: isCollapsed ? 'none' : 1, width: isCollapsed ? '36px' : 'auto', height: isCollapsed ? '36px' : 'auto', overflow: 'hidden' }}
              className="hover:bg-slate-50"
              title={t("Sign Out")}
            >
              <LogOut size={13} style={{ flexShrink: 0 }} />
              <span style={{ maxWidth: isCollapsed ? '0px' : '80px', overflow: 'hidden', opacity: isCollapsed ? 0 : 1, visibility: isCollapsed ? 'hidden' : 'visible', whiteSpace: 'nowrap', transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, visibility 0.35s' }}>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    );
  };

  const renderDesktopTopbar = () => {
    return (
      <header 
        className="h-11 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10 flex-shrink-0"
        style={{ 
          backgroundColor: '#ea580c', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
          position: 'relative',
          overflow: 'visible'
        }}
      >
        {/* Breadcrumbs */}
        <div 
          className="flex items-center"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '14px', fontWeight: 700, lineHeight: 1.2, color: '#F8FAFC', zIndex: 1, position: 'relative', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          <span style={{ color: '#F8FAFC', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t(
              activeTab === 'dashboard' ? 'Dashboard' :
              activeTab === 'global-search' ? 'Global Search' :
              activeTab === 'faculty' ? 'Faculty' :
              activeTab === 'ltcmembers' ? 'LTC Members' :
              activeTab === 'students' ? 'Students' :
              activeTab === 'batches' ? 'Batch Management' :
              activeTab === 'timetable' ? 'LAP Timetable' :
              activeTab === 'bulk' ? 'Bulk Upload' :
              activeTab === 'documents' ? 'Documents & SOPs' :
              activeTab === 'reports' ? 'Reports & Logs' :
              activeTab === 'submissions' ? 'Submissions' :
              activeTab === 'misc' ? 'Miscellaneous' :
              activeTab === 'orientation' ? 'Sender Console' :
              activeTab === 'email_logs' ? 'Email Audit Logs' :
              activeTab === 'whatsapp_logs' ? 'WhatsApp Audit Logs' :
              activeTab === 'tickets' ? 'Support Tickets' :
              activeTab === 'journey' ? 'LAP Journey Media' :
              activeTab === 'faq' ? 'FAQs' : activeTab
            )}
          </span>
        </div>
        {/* Right Actions */}
        <div className="flex items-center gap-4" style={{ zIndex: 1, position: 'relative' }}>
          {/* Language Selector */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10">
            <button 
              onClick={() => changeLanguage('en')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${currentLanguage === 'en' ? 'bg-white text-[#ea580c] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
            >
              EN
            </button>
            <button 
              onClick={() => changeLanguage('hi')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${currentLanguage === 'hi' ? 'bg-white text-[#ea580c] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
            >
              हिंदी
            </button>
            <button 
              onClick={() => changeLanguage('mr')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${currentLanguage === 'mr' ? 'bg-white text-[#ea580c] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
            >
              मराठी
            </button>
          </div>

          <div style={{ position: 'relative' }} data-notif-dropdown>
            <button
              data-notif-trigger
              className="text-white/80 hover:text-white transition-all w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90"
              style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => setIsNotifOpen(o => !o)}
            >
              <Bell 
                size={18} 
                style={{ 
                  color: '#fbbf24', 
                  filter: 'drop-shadow(0 0 5px rgba(251, 191, 36, 0.6))',
                  transition: 'all 0.2s ease'
                }} 
              />
              {dbUnreadCount > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: 'white', borderRadius: '50%', padding: '2px 5px', fontSize: '10px', fontWeight: 700, lineHeight: 1 }}>
                  {dbUnreadCount}
                </span>
              )}
            </button>
            <div style={{ 
              position: 'absolute', 
              top: '40px', 
              right: '0', 
              background: 'rgba(255, 255, 255, 0.85)', 
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.08)', 
              borderRadius: '16px', 
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.02)', 
              width: '340px', 
              zIndex: 9999, 
              overflow: 'hidden',
              pointerEvents: isNotifOpen ? 'auto' : 'none',
              transform: isNotifOpen ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(-6px)',
              opacity: isNotifOpen ? 1 : 0,
              visibility: isNotifOpen ? 'visible' : 'hidden',
              transformOrigin: 'top right',
              transition: 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(248, 250, 252, 0.6)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Notifications</h3>
                {dbUnreadCount > 0 && (
                  <button
                    style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    onClick={async () => {
                      try {
                        await apiFetch('/api/superadmin/notifications/read', { method: 'POST' });
                        setDbUnreadCount(0);
                        fetchAdminNotifications();
                      } catch (err) { console.error(err); }
                    }}
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {dbNotifications.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No notifications.</div>
                ) : (
                  dbNotifications.map(n => {
                    const isRead = !!n.read_at;
                    return (
                      <div 
                        key={'admin-notif-' + n.id} 
                        style={{ 
                          padding: '12px 16px', 
                          borderBottom: '1px solid rgba(0, 0, 0, 0.05)', 
                          display: 'flex', 
                          gap: '10px', 
                          alignItems: 'flex-start', 
                          background: isRead ? 'transparent' : 'rgba(59, 130, 246, 0.06)',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onClick={(e) => {
                          if (e.target.tagName === 'BUTTON') return;
                          handleNotificationClick(n);
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = isRead ? '#f8fafc' : 'rgba(59, 130, 246, 0.09)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = isRead ? 'transparent' : 'rgba(59, 130, 246, 0.06)'}
                      >
                        {!isRead && <div style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%', marginTop: '5px', flexShrink: 0 }} />}
                        <div style={{ flex: 1, paddingLeft: isRead ? '18px' : '0' }}>
                          <p style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', margin: '0 0 3px 0' }}>{n.title || 'Notification'}</p>
                          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{n.message}</p>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{new Date(n.created_at).toLocaleDateString()}</p>
                        </div>
                        {!isRead && (
                          <button
                            style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '11px', cursor: 'pointer', fontWeight: '600', flexShrink: 0 }}
                            onClick={async () => {
                              try {
                                await apiFetch('/api/superadmin/notifications/read', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ ids: [n.id] })
                                });
                                fetchAdminNotifications();
                              } catch (err) { console.error(err); }
                            }}
                          >Read</button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
    )
  }

  const renderDesktopLayout = () => {
    return (
      <div className="flex h-screen w-screen overflow-hidden antialiased text-sm" style={{ backgroundColor: 'var(--bg)' }}>
        <ScrollToTop watchDeps={[activeTab, mobilePeopleTab, mobileSubTool]} />
        {renderDesktopSidebar()}
        <div className="flex-1 flex flex-col h-full relative overflow-hidden" style={{ backgroundColor: activeTab === 'journey' ? '#F5F6F8' : 'var(--bg)' }}>
          {renderDesktopTopbar()}
          <div className="flex-1 overflow-y-auto" style={{ padding: activeTab === 'journey' ? '20px 24px' : '2rem', backgroundColor: activeTab === 'journey' ? '#F5F6F8' : 'transparent' }} ref={mainContentRef}>
            <div className={activeTab === 'journey' ? 'w-full' : 'max-w-7xl mx-auto space-y-6'}>
              {activeTab === 'dashboard' && renderDashboardHomepage()}
              {activeTab === 'global-search' && <GlobalSearchModule token={token} toast={toast} />}
              {activeTab === 'timetable' && <TimetablePanel />}
              {activeTab === 'batches' && (
                <Suspense fallback={<div className="p-10 text-center text-on-surface-variant">Loading…</div>}>
                  <BatchManagementModule 
                    token={token} 
                    onBatchesChange={refreshAllData} 
                    initialSelectedBatch={openBatchOnLoad}
                    onClearInitialBatch={() => setOpenBatchOnLoad(null)}
                  />
                </Suspense>
              )}
              {activeTab === 'faculty' && (
                <Suspense fallback={<div className="p-10 text-center text-on-surface-variant">Loading…</div>}>
                  <FacultyModule
                    faculties={faculties}
                    facultyPg={facultyPg}
                    facultySearch={facultySearch}
                    setFacultySearch={setFacultySearch}
                    setIsFacultyModalOpen={setIsFacultyModalOpen}
                    handleUpdatePanel={handleUpdatePanel}
                    handleViewFeedback={handleViewFeedback}
                    handleDeleteUser={handleDeleteUser}
                    fetchUsers={fetchUsers}
                    PaginationBar={PaginationBar}
                    isDesktop={true}
                    facultyDivFilter={facultyDivFilter}
                    setFacultyDivFilter={setFacultyDivFilter}
                    facultyFacFilter={facultyFacFilter}
                    setFacultyFacFilter={setFacultyFacFilter}
                    facultySchoolFilter={facultySchoolFilter}
                    setFacultySchoolFilter={setFacultySchoolFilter}
                    facultyDeptFilter={facultyDeptFilter}
                    setFacultyDeptFilter={setFacultyDeptFilter}
                    facultyTypeFilter={facultyTypeFilter}
                    setFacultyTypeFilter={setFacultyTypeFilter}
                    availableFacultyDivisions={availableFacultyDivisions}
                    availableFacultyFaculties={availableFacultyFaculties}
                    availableFacultySchools={availableFacultySchools}
                    availableFacultyDepartments={availableFacultyDepartments}
                    apiFetch={apiFetch}
                    toast={toast}
                  />
                </Suspense>
              )}
              {activeTab === 'students' && (
                <Suspense fallback={<div className="p-10 text-center text-on-surface-variant">Loading…</div>}>
                  <StudentsModule
                    users={users}
                    students={students}
                    studentPg={studentPg}
                    studentSearch={studentSearch}
                    setStudentSearch={setStudentSearch}
                    selectedSchool={selectedSchool}
                    setSelectedSchool={setSelectedSchool}
                    selectedDepartment={selectedDepartment}
                    setSelectedDepartment={setSelectedDepartment}
                    selectedDivision={selectedDivision}
                    setSelectedDivision={setSelectedDivision}
                    selectedPanel={selectedPanel}
                    setSelectedPanel={setSelectedPanel}
                    selectedFaculty={selectedFaculty}
                    setSelectedFaculty={setSelectedFaculty}
                    availableSchools={availableSchools}
                    availableDepartments={availableDepartments}
                    availableDivisions={availableDivisions}
                    availableFaculties={availableFaculties}
                    availablePanels={availablePanels}
                    setIsStudentModalOpen={setIsStudentModalOpen}
                    handleUpdatePanel={handleUpdatePanel}
                    handleUpdateInsurance={handleUpdateInsurance}
                    handleToggleStudentBatch={handleToggleStudentBatch}
                    handleViewFeedback={handleViewFeedback}
                    handleDeleteUser={handleDeleteUser}
                    fetchUsers={fetchUsers}
                    batches={batches}
                    PaginationBar={PaginationBar}
                    apiFetch={apiFetch}
                    toast={toast}
                  />
                </Suspense>
              )}
              {activeTab === 'ltcmembers' && (
                <Suspense fallback={<div className="p-10 text-center text-on-surface-variant">Loading…</div>}>
                  <LtcMembersModule
                    ltcMembers={ltcMembers}
                    ltcMemberPg={ltcMemberPg}
                    ltcMemberSearch={ltcMemberSearch}
                    setLtcMemberSearch={setLtcMemberSearch}
                    setIsLtcMemberModalOpen={setIsLtcModalOpen}
                    handleDeleteUser={handleDeleteUser}
                    fetchUsers={fetchUsers}
                    PaginationBar={PaginationBar}
                    apiFetch={apiFetch}
                    toast={toast}
                  />
                </Suspense>
              )}
              {activeTab === 'bulk' && (
                <div className="space-y-6 animate-fade-in">
<div>
                    <h2 className="text-xl font-bold text-on-surface">{isLtcUpload ? t('LTC Members Bulk Ingestion') : t('Bulk Upload')}</h2>
                    <p className="text-sm text-on-surface-variant">
                      {isLtcUpload
                        ? t('Upload CSV/XLSX to add LTC Members to the master database')
                        : t('Import multiple students or faculty members using CSV or Excel spreadsheets')}
                    </p>
                  </div>
                  <BulkUploadModule
                    isLtcUpload={isLtcUpload}
                    setIsLtcUpload={setIsLtcUpload}
                    bulkData={bulkData}
                    isUploading={isUploading}
                    handleFileUpload={isLtcUpload ? handleLtcBulkUpload : handleFileUpload}
                    handleLtcFileUpload={handleLtcBulkUpload}
                    handleStudentFileUpload={handleFileUpload}
                    submitBulkUpload={submitBulkUpload}
                    batches={batches}
                    selectedBatchId={selectedUploadBatchId}
                    onSelectBatch={setSelectedUploadBatchId}
                    t={t}
                    uploadedFileName={bulkUploadFile?.name}
                    onClearFile={handleClearFile}
                  />
                </div>
              )}
              {activeTab === 'documents' && (
                <Suspense fallback={<div className="p-10 text-center text-on-surface-variant">Loading…</div>}>
                  <DocumentsModule
                    documents={documents}
                    docForm={docForm}
                    setDocForm={setDocForm}
                    handleUploadDocument={handleUploadDocument}
                    handleDeleteDocument={handleDeleteDocument}
                    Label={Label}
                  />
                </Suspense>
              )}
              {activeTab === 'reports' && (
                <Suspense fallback={<div className="p-10 text-center text-on-surface-variant">Loading…</div>}>
                  <ReportsModule token={token} toast={toast} />
                </Suspense>
              )}
              {activeTab === 'submissions' && (
                <FeedbackTab 
                  token={token} 
                  apiBase={API} 
                  showToast={toast} 
                  batches={batches} 
                />
              )}
              {activeTab === 'ai-form-analysis' && (
                <AiFormAnalysisTab 
                  token={token} 
                  isReadOnly={false} 
                  onToast={toast} 
                />
              )}
              {activeTab === 'misc' && (
                <Suspense fallback={<div className="p-10 text-center text-on-surface-variant">Loading…</div>}>
                  <MiscellaneousModule token={token} toast={toast} />
                </Suspense>
              )}
              {activeTab === 'orientation' && renderOrientationView()}
              {activeTab === 'email_logs' && renderEmailLogsView()}
              {activeTab === 'whatsapp_logs' && renderWhatsappLogsView()}
              {activeTab === 'whatsapp_campaign' && <WhatsappCampaignModule token={token} API={API} toast={toast} batches={batches} />}

              {activeTab === 'tickets' && <AdminTicketsTab token={token} API={API} />}
              {activeTab === 'journey' && <AdminJourneyTab token={token} API={API} toast={toast} apiFetch={apiFetch} />}
              {activeTab === 'faq' && <AdminFaqTab />}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {isDesktop ? renderDesktopLayout() : (
        <div className="dashboard-layout mobile-layout">
          <ScrollToTop watchDeps={[activeTab, mobilePeopleTab, mobileSubTool]} />

          {/* Smooth Overlay */}
          <div 
            style={{ 
              position: 'fixed', 
              inset: 0, 
              background: 'rgba(0, 0, 0, 0.4)', 
              zIndex: 999998,
              opacity: isSidebarOpen ? 1 : 0,
              visibility: isSidebarOpen ? 'visible' : 'hidden',
              backdropFilter: isSidebarOpen ? 'blur(4px)' : 'blur(0px)',
              WebkitBackdropFilter: isSidebarOpen ? 'blur(4px)' : 'blur(0px)',
              transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.4s cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 0.4s cubic-bezier(0.16, 1, 0.3, 1), -webkit-backdrop-filter 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }} 
            onClick={() => setIsSidebarOpen(false)} 
          />

          {/* ── Sidebar ── */}
          <div className="sidebar mobile-sidebar" style={{
            position: 'fixed',
            top: 0, left: 0, bottom: 0, zIndex: 999999, height: '100vh',
            transform: !isSidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
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
            <div style={{ height: '80px', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <img src="/ltc.png" alt="LTC Logo" style={{ height: '40px', objectFit: 'contain' }} />
              <button 
                className="sidebar-close-btn" 
                onClick={() => setIsSidebarOpen(false)} 
                aria-label="Close Sidebar" 
                style={{ 
                  border: 'none', 
                  background: '#f1f5f9', 
                  borderRadius: '50%', 
                  width: '28px', 
                  height: '28px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#64748b', 
                  cursor: 'pointer',
                  padding: 0,
                  boxShadow: 'none'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }} className="no-scrollbar">
              <nav style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Section: MAIN */}
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '12px 12px 6px 12px', display: 'block', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Main")}</span>
                
                {/* Dashboard Nav Item with dropdown */}
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <button
                    onClick={() => {
                      setIsDashboardDropdownOpen(!isDashboardDropdownOpen);
                      setActiveTab('dashboard');
                    }}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                      fontWeight: activeTab === 'dashboard' ? '600' : '500',
                      color: activeTab === 'dashboard' ? '#ffffff' : '#475569',
                      background: activeTab === 'dashboard' ? '#ea580c' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-in-out',
                      width: '100%',
                      outline: 'none',
                      marginBottom: '2px',
                      boxShadow: 'none'
                    }}
                    className={activeTab === 'dashboard' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ color: activeTab === 'dashboard' ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center' }}>
                        <Home size={16} strokeWidth={activeTab === 'dashboard' ? 2.2 : 2} />
                      </div>
                      <span style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Dashboard")}</span>
                    </div>
                    <span style={{ transition: 'transform 0.2s', transform: isDashboardDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: activeTab === 'dashboard' ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center' }}>
                      <ChevronDown size={13} />
                    </span>
                  </button>
                  
                  {isDashboardDropdownOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                      <button
                        onClick={() => {
                          setActiveTab('global-search');
                          if (isMobile) setIsSidebarOpen(false);
                        }}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          paddingLeft: '32px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: activeTab === 'global-search' ? '600' : '500',
                          color: activeTab === 'global-search' ? '#ffffff' : '#475569',
                          background: activeTab === 'global-search' ? '#ea580c' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          width: '100%',
                          outline: 'none',
                          marginBottom: '2px',
                          boxShadow: 'none'
                        }}
                        className={activeTab === 'global-search' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{ color: activeTab === 'global-search' ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center' }}>
                            <Search size={14} strokeWidth={activeTab === 'global-search' ? 2.2 : 2} />
                          </div>
                          <span style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Global Search")}</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Section: PEOPLE */}
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '16px 12px 6px 12px', display: 'block', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("People")}</span>
                <NavItem tab="faculty" icon={<BookOpen />} label="Faculty" />
                <NavItem tab="students" icon={<GraduationCap />} label="Students" />
                <NavItem tab="ltcmembers" icon={<Shield />} label="LTC Members" />

                {/* Section: MANAGEMENT */}
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '16px 12px 6px 12px', display: 'block', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Management")}</span>
                <NavItem tab="batches" icon={<Layers />} label="Batch Management" />
                <NavItem tab="timetable" icon={<Clock />} label="LAP Timetable" />
                <NavItem tab="bulk" icon={<UploadCloud />} label="Bulk Upload" />
                <NavItem tab="documents" icon={<FileText />} label="Documents & SOPs" />
                <NavItem tab="reports" icon={<BarChart2 />} label="Reports & Logs" />
                <NavItem tab="submissions" icon={<ClipboardList />} label="Submissions" />
                <NavItem tab="misc" icon={<Flag />} label="Miscellaneous" />

                {/* Section: COMMUNICATION */}
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '16px 12px 6px 12px', display: 'block', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Communication")}</span>
                
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <button
                    onClick={() => {
                      setIsCommunicationDropdownOpen(!isCommunicationDropdownOpen);
                      setActiveTab('orientation');
                    }}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                      fontWeight: ['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? '600' : '500',
                      color: ['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? '#ffffff' : '#475569',
                      background: ['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? '#ea580c' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-in-out',
                      width: '100%',
                      outline: 'none',
                      marginBottom: '2px',
                      boxShadow: 'none'
                    }}
                    className={['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ color: ['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center' }}>
                        <MessageSquare size={16} strokeWidth={['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? 2.2 : 2} />
                      </div>
                      <span style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Communication")}</span>
                    </div>
                    <span style={{ transition: 'transform 0.2s', transform: isCommunicationDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: ['orientation', 'email_logs', 'whatsapp_logs', 'whatsapp_campaign'].includes(activeTab) ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center' }}>
                      <ChevronDown size={13} />
                    </span>
                  </button>

                  {isCommunicationDropdownOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '16px' }}>
                      <button
                        onClick={() => { setActiveTab('orientation'); if (isMobile) setIsSidebarOpen(false); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: activeTab === 'orientation' ? '600' : '500',
                          color: activeTab === 'orientation' ? '#ea580c' : '#475569',
                          background: activeTab === 'orientation' ? '#fff7ed' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          width: '100%',
                          outline: 'none',
                          marginBottom: '2px',
                          boxShadow: 'none'
                        }}
                        className={activeTab === 'orientation' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                      >
                        <Send size={14} />
                        <span>{t("Sender Console")}</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('email_logs'); if (isMobile) setIsSidebarOpen(false); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: activeTab === 'email_logs' ? '600' : '500',
                          color: activeTab === 'email_logs' ? '#ea580c' : '#475569',
                          background: activeTab === 'email_logs' ? '#fff7ed' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          width: '100%',
                          outline: 'none',
                          marginBottom: '2px',
                          boxShadow: 'none'
                        }}
                        className={activeTab === 'email_logs' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                      >
                        <Mail size={14} />
                        <span>{t("Email Audit Logs")}</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('whatsapp_logs'); if (isMobile) setIsSidebarOpen(false); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: activeTab === 'whatsapp_logs' ? '600' : '500',
                          color: activeTab === 'whatsapp_logs' ? '#ea580c' : '#475569',
                          background: activeTab === 'whatsapp_logs' ? '#fff7ed' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          width: '100%',
                          outline: 'none',
                          marginBottom: '2px',
                          boxShadow: 'none'
                        }}
                        className={activeTab === 'whatsapp_logs' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                      >
                        <Phone size={14} />
                        <span>{t("WhatsApp Audit Logs")}</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('whatsapp_campaign'); if (isMobile) setIsSidebarOpen(false); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: activeTab === 'whatsapp_campaign' ? '600' : '500',
                          color: activeTab === 'whatsapp_campaign' ? '#ea580c' : '#475569',
                          background: activeTab === 'whatsapp_campaign' ? '#fff7ed' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          width: '100%',
                          outline: 'none',
                          marginBottom: '2px',
                          boxShadow: 'none'
                        }}
                        className={activeTab === 'whatsapp_campaign' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                      >
                        <Smartphone size={14} />
                        <span>{t("WhatsApp Communication")}</span>
                      </button>
                    </div>
                  )}
                </div>
                <NavItem tab="tickets" icon={<MessageSquare />} label="Support Tickets" />
                <NavItem tab="journey" icon={<Film />} label="LAP Journey Media" />
                <NavItem tab="faq" icon={<HelpCircle />} label="FAQs" />
              </nav>
            </div>

            {/* Bottom Profile Section */}
            <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
              <div className="flex items-center gap-3 px-2 py-1 mb-1">
                <div 
                  className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs"
                  style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)' }}
                >
                  AD
                </div>
                <div>
                  <p style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }} className="font-semibold text-xs text-[#0f172a] leading-tight">{t("Admin")}</p>
                  <p style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }} className="text-[10px] text-slate-500">admin@ltc.com</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleLogout}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    fontWeight: '600',
                    transition: 'all 0.15s',
                    boxShadow: 'none'
                  }}
                  className="hover:bg-slate-50"
                  title={t("Sign Out")}
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Main Content ── */}
          <div className="main-content">
            {/* Mobile topbar */}
             {!isSidebarOpen && (
              <div 
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 'calc(44px + env(safe-area-inset-top))',
                  zIndex: 999,
                  background: '#ea580c',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => setIsSidebarOpen(true)}
                    aria-label="Open Sidebar"
                    style={{
                      background: 'transparent',
                      color: '#ffffff',
                      border: 'none',
                      padding: 0,
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      borderRadius: '50%'
                    }}
                    className="hover:bg-white/10"
                  >
                    <Menu size={20} />
                  </button>
                  <span style={{ color: '#ffffff', fontWeight: '700', fontSize: '13.5px', fontFamily: 'system-ui, -apple-system, sans-serif', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                    {t(
                      activeTab === 'dashboard' ? 'Dashboard' :
                      activeTab === 'global-search' ? 'Global Search' :
                      activeTab === 'faculty' ? 'Faculty' :
                      activeTab === 'ltcmembers' ? 'LTC Members' :
                      activeTab === 'students' ? 'Students' :
                      activeTab === 'batches' ? 'Batches' :
                      activeTab === 'timetable' ? 'LAP Timetable' :
                      activeTab === 'bulk' ? 'Bulk Upload' :
                      activeTab === 'documents' ? 'Documents & SOPs' :
                      activeTab === 'reports' ? 'Reports & Logs' :
                      activeTab === 'misc' ? 'Miscellaneous' :
                      activeTab === 'orientation' ? 'Sender Console' :
                      activeTab === 'email_logs' ? 'Email Audit Logs' :
                      activeTab === 'whatsapp_logs' ? 'WhatsApp Audit Logs' :
                      activeTab === 'tickets' ? 'Support Tickets' :
                      activeTab === 'journey' ? 'LAP Journey Media' :
                      activeTab === 'faq' ? 'FAQs' : activeTab
                    )}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Language Selector Dropdown (Apple Style) */}
                  <div style={{ position: 'relative' }} data-mobile-lang-dropdown>
                    <button 
                      onClick={() => setIsMobileLangOpen(!isMobileLangOpen)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        background: 'rgba(255, 255, 255, 0.12)', 
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '30px', 
                        padding: '4px 8px',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: '700',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        outline: 'none',
                        userSelect: 'none'
                      }}
                      className="active:scale-95"
                    >
                      <Globe size={13} strokeWidth={2.4} style={{ opacity: 0.9 }} />
                      <span>
                        {currentLanguage === 'en' ? 'EN' : currentLanguage === 'hi' ? 'HI' : 'MR'}
                      </span>
                      <ChevronDown size={12} strokeWidth={2.4} style={{ 
                        opacity: 0.7, 
                        transform: isMobileLangOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' 
                      }} />
                    </button>

                    {/* Apple Style Springy Dropdown Menu */}
                    <div 
                      style={{
                        position: 'absolute',
                        top: '34px',
                        right: '0',
                        width: '110px',
                        background: 'rgba(255, 255, 255, 0.85)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(0, 0, 0, 0.08)',
                        borderRadius: '14px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.02)',
                        padding: '5px',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        pointerEvents: isMobileLangOpen ? 'auto' : 'none',
                        transform: isMobileLangOpen ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(-6px)',
                        opacity: isMobileLangOpen ? 1 : 0,
                        visibility: isMobileLangOpen ? 'visible' : 'hidden',
                        transformOrigin: 'top right',
                        transition: 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    >
                      {[
                        { code: 'en', label: 'EN' },
                        { code: 'hi', label: 'हिंदी' },
                        { code: 'mr', label: 'मराठी' }
                      ].map((item) => {
                        const isSelected = currentLanguage === item.code;
                        return (
                          <button
                            key={item.code}
                            onClick={() => {
                              changeLanguage(item.code);
                              setIsMobileLangOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%',
                              padding: '8px 10px',
                              border: 'none',
                              background: isSelected ? 'rgba(234, 88, 12, 0.1)' : 'transparent',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              color: isSelected ? '#ea580c' : '#334155',
                              fontSize: '12px',
                              fontWeight: isSelected ? '700' : '500',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              textAlign: 'left',
                              transition: 'all 0.15s ease'
                            }}
                            className="hover:bg-black/5 active:scale-98"
                          >
                            <span>{item.label}</span>
                            {isSelected && (
                              <Check size={12} strokeWidth={3} color="#ea580c" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notifications */}
                  <div style={{ position: 'relative' }} data-notif-dropdown-mobile>
                    <button 
                      data-notif-trigger-mobile
                      style={{ 
                        padding: 0,
                        position: 'relative',
                        height: '32px',
                        width: '32px',
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        cursor: 'pointer'
                      }} 
                      className="hover:bg-white/10 hover:text-white transition-all active:scale-90"
                      title="Notifications"
                      onClick={() => setIsNotifOpen(o => !o)}
                    >
                      <Bell 
                        size={18} 
                        style={{ 
                          color: '#fbbf24', 
                          filter: 'drop-shadow(0 0 5px rgba(251, 191, 36, 0.6))',
                          transition: 'all 0.2s ease'
                        }} 
                      />
                      {dbUnreadCount > 0 && (
                        <span style={{ position: 'absolute', top: '2px', right: '2px', background: '#ef4444', color: 'white', borderRadius: '50%', padding: '1px 4px', fontSize: '8px', fontWeight: 700, lineHeight: 1 }}>
                          {dbUnreadCount}
                        </span>
                      )}
                    </button>
                    
                      <div style={{ 
                        position: 'absolute', 
                        top: '38px', 
                        right: '-40px', 
                        background: 'rgba(255, 255, 255, 0.85)', 
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(0, 0, 0, 0.08)', 
                        borderRadius: '16px', 
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.02)', 
                        width: '280px', 
                        zIndex: 9999, 
                        overflow: 'hidden',
                        pointerEvents: isNotifOpen ? 'auto' : 'none',
                        transform: isNotifOpen ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(-6px)',
                        opacity: isNotifOpen ? 1 : 0,
                        visibility: isNotifOpen ? 'visible' : 'hidden',
                        transformOrigin: 'top right',
                        transition: 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}>
                        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(248, 250, 252, 0.6)' }}>
                          <h3 style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Notifications</h3>
                          {dbUnreadCount > 0 && (
                            <button
                              style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }}
                              onClick={async () => {
                                try {
                                  await apiFetch('/api/superadmin/notifications/read', { method: 'POST' });
                                  setDbUnreadCount(0);
                                  fetchAdminNotifications();
                                } catch (err) { console.error(err); }
                              }}
                            >
                              Mark all as read
                            </button>
                          )}
                        </div>
                        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                          {dbNotifications.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>No notifications.</div>
                          ) : (
                            dbNotifications.map(n => {
                              const isRead = !!n.read_at;
                              return (
                                <div key={'admin-notif-mobile-' + n.id} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', display: 'flex', gap: '8px', alignItems: 'flex-start', background: isRead ? 'transparent' : 'rgba(59, 130, 246, 0.06)' }}>
                                  {!isRead && <div style={{ width: '6px', height: '6px', background: '#3b82f6', borderRadius: '50%', marginTop: '4px', flexShrink: 0 }} />}
                                  <div style={{ flex: 1, paddingLeft: isRead ? '14px' : '0' }}>
                                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a', margin: '0 0 2px 0' }}>{n.title || 'Notification'}</p>
                                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{n.message}</p>
                                    <p style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>{new Date(n.created_at).toLocaleDateString()}</p>
                                  </div>
                                  {!isRead && (
                                    <button
                                      style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '10px', cursor: 'pointer', fontWeight: '600', flexShrink: 0 }}
                                      onClick={async () => {
                                        try {
                                          await apiFetch('/api/superadmin/notifications/read', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ ids: [n.id] })
                                          });
                                          fetchAdminNotifications();
                                        } catch (err) { console.error(err); }
                                      }}
                                    >Read</button>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                  </div>

                  {/* Refresh Button */}
                  <button 
                    style={{ 
                      padding: 0,
                      height: '32px',
                      width: '32px',
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      cursor: 'pointer'
                    }} 
                    className="hover:bg-white/10 hover:text-white transition-colors"
                    onClick={refreshAllData} 
                    title="Refresh Dashboard"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>
            )}


            {/* Content Switcher */}
            <div className="mobile-content-container" style={{ padding: activeTab === 'journey' ? 'calc(56px + env(safe-area-inset-top)) 10px calc(72px + env(safe-area-inset-bottom))' : 'calc(52px + env(safe-area-inset-top)) 0px calc(72px + env(safe-area-inset-bottom))', backgroundColor: activeTab === 'journey' ? '#F5F6F8' : 'transparent' }}>
              {activeTab === 'dashboard' && renderMobileDashboard()}
              {activeTab === 'global-search' && <GlobalSearchModule token={token} toast={toast} />}

              {/* ── Timetable ── */}
              {activeTab === 'timetable' && <TimetablePanel />}

              {/* ── Batch Management ── */}
              {activeTab === 'batches' && (
                <div className="mobile-batches-wrapper animate-fade-in" style={{ padding: '4px 8px 8px' }}>
                  <Suspense fallback={<div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>Loading…</div>}>
                    <BatchManagementModule 
                      token={token} 
                      onBatchesChange={refreshAllData} 
                      initialSelectedBatch={openBatchOnLoad}
                      onClearInitialBatch={() => setOpenBatchOnLoad(null)}
                    />
                  </Suspense>
                </div>
              )}

              {/* ── Master Faculty Tab ── */}
              {activeTab === 'faculty' && (
                <div className="animate-fade-in" style={{ padding: '4px 8px 8px' }}>
                  <Suspense fallback={<div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>Loading…</div>}>
                    <FacultyModule
                      faculties={faculties}
                      facultyPg={facultyPg}
                      facultySearch={facultySearch}
                      setFacultySearch={setFacultySearch}
                      setIsFacultyModalOpen={setIsFacultyModalOpen}
                      handleUpdatePanel={handleUpdatePanel}
                      handleViewFeedback={handleViewFeedback}
                      handleDeleteUser={handleDeleteUser}
                      fetchUsers={fetchUsers}
                      PaginationBar={PaginationBar}
                      apiFetch={apiFetch}
                      toast={toast}
                      facultyDivFilter={facultyDivFilter}
                      setFacultyDivFilter={setFacultyDivFilter}
                      facultyFacFilter={facultyFacFilter}
                      setFacultyFacFilter={setFacultyFacFilter}
                      facultySchoolFilter={facultySchoolFilter}
                      setFacultySchoolFilter={setFacultySchoolFilter}
                      facultyDeptFilter={facultyDeptFilter}
                      setFacultyDeptFilter={setFacultyDeptFilter}
                      facultyTypeFilter={facultyTypeFilter}
                      setFacultyTypeFilter={setFacultyTypeFilter}
                      availableFacultyDivisions={availableFacultyDivisions}
                      availableFacultyFaculties={availableFacultyFaculties}
                      availableFacultySchools={availableFacultySchools}
                      availableFacultyDepartments={availableFacultyDepartments}
                    />
                  </Suspense>
                </div>
              )}

              {/* ── Master Students Tab ── */}
              {activeTab === 'students' && (
                <div className="animate-fade-in" style={{ padding: '4px 8px 8px' }}>
                  <Suspense fallback={<div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>Loading…</div>}>
                    <StudentsModule
                      users={users}
                      students={students}
                      studentPg={studentPg}
                      studentSearch={studentSearch}
                      setStudentSearch={setStudentSearch}
                      selectedSchool={selectedSchool}
                      setSelectedSchool={setSelectedSchool}
                      selectedDepartment={selectedDepartment}
                      setSelectedDepartment={setSelectedDepartment}
                      selectedDivision={selectedDivision}
                      setSelectedDivision={setSelectedDivision}
                      selectedPanel={selectedPanel}
                      setSelectedPanel={setSelectedPanel}
                      selectedFaculty={selectedFaculty}
                      setSelectedFaculty={setSelectedFaculty}
                      availableSchools={availableSchools}
                      availableDepartments={availableDepartments}
                      availableDivisions={availableDivisions}
                      availableFaculties={availableFaculties}
                      availablePanels={availablePanels}
                      setIsStudentModalOpen={setIsStudentModalOpen}
                      handleUpdatePanel={handleUpdatePanel}
                      handleUpdateInsurance={handleUpdateInsurance}
                      handleToggleStudentBatch={handleToggleStudentBatch}
                      handleViewFeedback={handleViewFeedback}
                      handleDeleteUser={handleDeleteUser}
                      fetchUsers={fetchUsers}
                      batches={batches}
                      PaginationBar={PaginationBar}
                      apiFetch={apiFetch}
                      toast={toast}
                    />
                  </Suspense>
                </div>
              )}

              {/* ── LTC Members Tab ── */}
              {activeTab === 'ltcmembers' && (
                <div className="animate-fade-in" style={{ padding: '4px 8px 8px' }}>
                  <Suspense fallback={<div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>Loading…</div>}>
                    <LtcMembersModule
                      ltcMembers={ltcMembers}
                      ltcMemberPg={ltcMemberPg}
                      ltcMemberSearch={ltcMemberSearch}
                      setLtcMemberSearch={setLtcMemberSearch}
                      setIsLtcMemberModalOpen={setIsLtcModalOpen}
                      handleDeleteUser={handleDeleteUser}
                      fetchUsers={fetchUsers}
                      PaginationBar={PaginationBar}
                      apiFetch={apiFetch}
                      toast={toast}
                    />
                  </Suspense>
                </div>
              )}

              {/* ── Bulk Ingestion ── */}
              {activeTab === 'bulk' && (
                <div className="animate-fade-in" style={{ padding: '0 16px' }}>
                  <div className="page-header" style={{ marginBottom: '24px' }}>
                    <div className="page-header-left">
                      <h2 className="page-title">{isLtcUpload ? 'LTC Members Bulk Upload' : 'Bulk Upload'}</h2>
                      <p className="page-subtitle">
                        {isLtcUpload
                          ? 'Upload CSV/XLSX to add LTC Members to the master database'
                          : 'Upload CSV/XLSX to add students and faculty to the master database'}
                      </p>
                    </div>
                  </div>

                  <BulkUploadModule
                    isLtcUpload={isLtcUpload}
                    setIsLtcUpload={setIsLtcUpload}
                    bulkData={bulkData}
                    isUploading={isUploading}
                    handleFileUpload={isLtcUpload ? handleLtcBulkUpload : handleFileUpload}
                    handleLtcFileUpload={handleLtcBulkUpload}
                    handleStudentFileUpload={handleFileUpload}
                    submitBulkUpload={submitBulkUpload}
                    batches={batches}
                    selectedBatchId={selectedUploadBatchId}
                    onSelectBatch={setSelectedUploadBatchId}
                    t={t}
                    uploadedFileName={bulkUploadFile?.name}
                    onClearFile={handleClearFile}
                  />
                </div>
              )}

              {/* ── Documents Tab ── */}
              {activeTab === 'documents' && (
                <div className="animate-fade-in" style={{ padding: '0 16px' }}>
                  <DocumentsModule
                    documents={documents}
                    docForm={docForm}
                    setDocForm={setDocForm}
                    handleUploadDocument={handleUploadDocument}
                    handleDeleteDocument={handleDeleteDocument}
                    Label={Label}
                  />
                </div>
              )}

              {/* ── Reports Tab ── */}
              {activeTab === 'reports' && (
                <div className="animate-fade-in" style={{ padding: '0 16px' }}>
                  <ReportsModule token={token} toast={toast} isReadOnly={true} />
                </div>
              )}

              {activeTab === 'submissions' && (
                <div className="animate-fade-in" style={{ padding: '0 16px' }}>
                  <FeedbackTab 
                    token={token} 
                    apiBase={API} 
                    showToast={toast} 
                    batches={batches} 
                  />
                </div>
              )}

              {activeTab === 'ai-form-analysis' && (
                <div className="animate-fade-in" style={{ padding: '0 16px' }}>
                  <AiFormAnalysisTab 
                    token={token} 
                    isReadOnly={false} 
                    onToast={toast} 
                  />
                </div>
              )}

              {activeTab === 'misc' && (
                <div className="animate-fade-in" style={{ padding: '0 16px' }}>
                  <MiscellaneousModule token={token} toast={toast} />
                </div>
              )}

              {activeTab === 'tickets' && (
                <div className="animate-fade-in" style={{ padding: '0 16px' }}>
                  <AdminTicketsTab token={token} API={API} />
                </div>
              )}

              {activeTab === 'journey' && (
                <div className="animate-fade-in" style={{ padding: '0' }}>
                  <AdminJourneyTab token={token} API={API} toast={toast} apiFetch={apiFetch} />
                </div>
              )}

              {activeTab === 'faq' && (
                <div className="animate-fade-in" style={{ padding: '0 16px' }}>
                  <AdminFaqTab />
                </div>
              )}

              {activeTab === 'orientation' && (
                <div className="animate-fade-in" style={{ padding: '0 16px' }}>
                  {renderOrientationView()}
                </div>
              )}

              {activeTab === 'email_logs' && (
                <div className="animate-fade-in" style={{ padding: '0 16px' }}>
                  {renderEmailLogsView()}
                </div>
              )}

              {activeTab === 'whatsapp_logs' && (
                <div className="animate-fade-in" style={{ padding: '0 16px' }}>
                  {renderWhatsappLogsView()}
                </div>
              )}

              {activeTab === 'whatsapp_campaign' && (
                <div className="animate-fade-in" style={{ padding: '0 16px' }}>
                  <WhatsappCampaignModule token={token} API={API} toast={toast} batches={batches} />
                </div>
              )}

              {/* ── People Tab ── */}
              {activeTab === 'people' && renderMobilePeople()}

              {/* ── Tools Tab ── */}
              {['tools', 'mobile-tools'].includes(activeTab) && renderMobileTools()}

              {/* ── Profile Tab ── */}
              {['profile', 'mobile-profile'].includes(activeTab) && renderMobileProfile()}
            </div>
          </div>

          {/* ── Bottom Navigation ── */}
          <div className="mobile-bottom-nav" style={isSidebarOpen ? { display: 'none' } : {}}>
            <button 
              className={`mobile-bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <Home size={20} />
              <span>Home</span>
            </button>
            <button 
              className={`mobile-bottom-nav-item ${['people', 'faculty', 'students', 'ltcmembers'].includes(activeTab) ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('people');
                setMobilePeopleTab('faculty');
              }}
            >
              <Users size={20} />
              <span>People</span>
            </button>
            <button 
              className={`mobile-bottom-nav-item ${activeTab === 'batches' ? 'active' : ''}`}
              onClick={() => setActiveTab('batches')}
            >
              <Layers size={20} />
              <span>Batches</span>
            </button>
            <button 
              className={`mobile-bottom-nav-item ${['tools', 'mobile-tools', 'timetable', 'bulk', 'documents', 'reports', 'orientation'].includes(activeTab) ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('tools');
                setMobileSubTool(null);
              }}
            >
              <Grid size={20} />
              <span>Tools</span>
            </button>
            <button 
              className={`mobile-bottom-nav-item ${['profile', 'mobile-profile'].includes(activeTab) ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={20} />
              <span>Profile</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}

      {/* Add Faculty Modal */}
      <Modal open={isFacultyModalOpen} onClose={() => { setIsFacultyModalOpen(false); setIsCustomFacultyDiv(false); setIsCustomFacultySchool(false); setIsCustomFacultyDept(false); }} title="Add Faculty Member" hideHeader={true} noPadding={true}>
        <form onSubmit={handleAddFaculty} style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh', overflow: 'hidden' }}>
          {/* Solid Blue Header */}
          <div style={{ background: '#0057b8', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <UserPlus size={18} /> Add Faculty Member
            </h3>
            <button type="button" onClick={() => { setIsFacultyModalOpen(false); setIsCustomFacultyDiv(false); setIsCustomFacultySchool(false); setIsCustomFacultyDept(false); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Form Content */}
          <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <FormLabel label="Full Name" required />
              <div className="modal-input-wrapper">
                <input required placeholder="Dr. Jane Smith" value={facultyForm.name} onChange={e => setFacultyForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <FormLabel label="Official Email" required />
                <div className="modal-input-wrapper">
                  <input required type="email" placeholder="jane@university.edu" value={facultyForm.email} onChange={e => setFacultyForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <FormLabel label="Faculty ID (Employee ID)" required />
                <div className="modal-input-wrapper">
                  <input required placeholder="MIT1001" value={facultyForm.faculty_id} onChange={e => setFacultyForm(f => ({ ...f, faculty_id: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <FormLabel label="Designation" />
                <div className="modal-input-wrapper">
                  <input placeholder="Assistant Professor" value={facultyForm.designation} onChange={e => setFacultyForm(f => ({ ...f, designation: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <FormLabel label="Contact Number" />
                <div className="modal-input-wrapper">
                  <input placeholder="9876543210" value={facultyForm.phone} onChange={e => setFacultyForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <FormLabel label="Personal Email" />
              <div className="modal-input-wrapper">
                <input type="email" placeholder="jane@gmail.com" value={facultyForm.personal_email} onChange={e => setFacultyForm(f => ({ ...f, personal_email: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <FormLabel label="Gender" />
                <div className="modal-input-wrapper">
                  <select value={facultyForm.gender} onChange={e => setFacultyForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <ChevronDown size={14} style={{ color: '#64748b', pointerEvents: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <FormLabel label="Division" />
                <div className="modal-input-wrapper">
                  <select value={facultyForm.division} onChange={e => setFacultyForm(f => ({ ...f, division: e.target.value, faculty: '', school: '', department: '' }))}>
                    <option value="">Select Division</option>
                    {Object.keys(OFFICIAL_HIERARCHY).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ color: '#64748b', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <FormLabel label="Faculty Area" />
                <div className="modal-input-wrapper">
                  <select value={facultyForm.faculty} onChange={e => setFacultyForm(f => ({ ...f, faculty: e.target.value, school: '', department: '' }))} disabled={!facultyForm.division}>
                    <option value="">Select Faculty</option>
                    {(facultyForm.division ? Object.keys(OFFICIAL_HIERARCHY[facultyForm.division] || {}) : []).map(fac => <option key={fac} value={fac}>{fac}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ color: '#64748b', pointerEvents: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <FormLabel label="School" />
                <div className="modal-input-wrapper">
                  <select value={facultyForm.school} onChange={e => setFacultyForm(f => ({ ...f, school: e.target.value, department: '' }))} disabled={!facultyForm.faculty}>
                    <option value="">Select School</option>
                    {(facultyForm.division && facultyForm.faculty ? Object.keys(OFFICIAL_HIERARCHY[facultyForm.division]?.[facultyForm.faculty] || {}) : []).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ color: '#64748b', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <FormLabel label="Department" />
                <div className="modal-input-wrapper">
                  <select value={facultyForm.department} onChange={e => setFacultyForm(f => ({ ...f, department: e.target.value }))} disabled={!facultyForm.school}>
                    <option value="">Select Department</option>
                    {(facultyForm.division && facultyForm.faculty && facultyForm.school ? (OFFICIAL_HIERARCHY[facultyForm.division]?.[facultyForm.faculty]?.[facultyForm.school] || []) : []).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ color: '#64748b', pointerEvents: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <FormLabel label="Panel" />
                <div className="modal-input-wrapper">
                  <select value={facultyForm.panel} onChange={e => setFacultyForm(f => ({ ...f, panel: e.target.value }))}>
                    <option value="">None</option>
                    {['A','B','C','D','E','F','G','H','I','J','K'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ color: '#64748b', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>


          </div>

          <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#fff', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
            <button type="button" onClick={() => { setIsFacultyModalOpen(false); setIsCustomFacultyDiv(false); setIsCustomFacultySchool(false); setIsCustomFacultyDept(false); }} style={{ padding: '9px 20px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: '600', fontSize: '13px', cursor: 'pointer', color: '#374151' }}>Cancel</button>
            <button type="submit" style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#0057b8', color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} /> Add Faculty</button>
          </div>

        </form>
      </Modal>

      {/* Add Student Modal */}
      <Modal open={isStudentModalOpen} onClose={() => { setIsStudentModalOpen(false); setIsCustomStudentSchool(false); setIsCustomStudentDept(false); setIsCustomStudentDiv(false); }} title="Add Student" hideHeader={true} size="lg" noPadding={true}>
        <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh', overflow: 'hidden' }}>
          {/* Solid Blue Header */}
          <div style={{ background: '#0057b8', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <UserPlus size={18} /> Add Student Member
            </h3>
            <button type="button" onClick={() => { setIsStudentModalOpen(false); setIsCustomStudentSchool(false); setIsCustomStudentDept(false); setIsCustomStudentDiv(false); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Form Content */}
          <div style={{ overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            
            {/* Section 1: Basic Information */}
            <div style={{ borderBottom: '1px solid #f1f5f9', pb: '12px', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0057b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Basic Information</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Full Name" required />
                  <div className="modal-input-wrapper">
                    <input required placeholder="Rahul Sharma" value={studentForm.name} onChange={e => setStudentForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Official Email" required />
                  <div className="modal-input-wrapper">
                    <input required type="email" placeholder="rahul@mit.edu" value={studentForm.email} onChange={e => setStudentForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="PRN (LTC ID)" required />
                  <div className="modal-input-wrapper">
                    <input required placeholder="e.g. 2019CS001" value={studentForm.prn} onChange={e => setStudentForm(f => ({ ...f, prn: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Roll Number" />
                  <div className="modal-input-wrapper">
                    <input placeholder="e.g. 101" value={studentForm.roll_number} onChange={e => setStudentForm(f => ({ ...f, roll_number: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Gender" required />
                  <div className="modal-input-wrapper">
                    <select required value={studentForm.gender} onChange={e => setStudentForm(f => ({ ...f, gender: e.target.value }))}>
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Academic & Institutional Details */}
            <div style={{ borderBottom: '1px solid #f1f5f9', pb: '12px', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0057b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Academic & Hierarchy Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Division" />
                  <div className="modal-input-wrapper">
                    <select value={studentForm.division} onChange={e => setStudentForm(f => ({ ...f, division: e.target.value, faculty: '', school: '', department: '' }))}>
                      <option value="">Select Division</option>
                      {Object.keys(OFFICIAL_HIERARCHY).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Faculty" />
                  <div className="modal-input-wrapper">
                    <select value={studentForm.faculty} onChange={e => setStudentForm(f => ({ ...f, faculty: e.target.value, school: '', department: '' }))} disabled={!studentForm.division}>
                      <option value="">Select Faculty</option>
                      {(studentForm.division ? Object.keys(OFFICIAL_HIERARCHY[studentForm.division] || {}) : []).map(fac => <option key={fac} value={fac}>{fac}</option>)}
                    </select>
                    <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="School" />
                  <div className="modal-input-wrapper">
                    <select value={studentForm.school} onChange={e => setStudentForm(f => ({ ...f, school: e.target.value, department: '' }))} disabled={!studentForm.faculty}>
                      <option value="">Select School</option>
                      {(studentForm.division && studentForm.faculty ? Object.keys(OFFICIAL_HIERARCHY[studentForm.division]?.[studentForm.faculty] || {}) : []).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Department" />
                  <div className="modal-input-wrapper">
                    <select value={studentForm.department} onChange={e => setStudentForm(f => ({ ...f, department: e.target.value }))} disabled={!studentForm.school}>
                      <option value="">Select Department</option>
                      {(studentForm.division && studentForm.faculty && studentForm.school ? (OFFICIAL_HIERARCHY[studentForm.division]?.[studentForm.faculty]?.[studentForm.school] || []) : []).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Semester" required />
                  <div className="modal-input-wrapper">
                    <input required placeholder="e.g. 5" value={studentForm.semester} onChange={e => setStudentForm(f => ({ ...f, semester: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Program" />
                  <div className="modal-input-wrapper">
                    <input placeholder="e.g. B.Tech" value={studentForm.program} onChange={e => setStudentForm(f => ({ ...f, program: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Year" />
                  <div className="modal-input-wrapper">
                    <input placeholder="e.g. 3" value={studentForm.year} onChange={e => setStudentForm(f => ({ ...f, year: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Panel" />
                  <div className="modal-input-wrapper">
                    <select value={studentForm.panel} onChange={e => setStudentForm(f => ({ ...f, panel: e.target.value }))}>
                      <option value="">None</option>
                      {['A','B','C','D','E','F','G','H','I','J','K'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Contact & Personal details */}
            <div style={{ borderBottom: '1px solid #f1f5f9', pb: '12px', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0057b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Contact & Personal Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Contact Number" />
                  <div className="modal-input-wrapper">
                    <input placeholder="9876543210" value={studentForm.phone} onChange={e => setStudentForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Personal Email" />
                  <div className="modal-input-wrapper">
                    <input type="email" placeholder="rahul@gmail.com" value={studentForm.personal_email} onChange={e => setStudentForm(f => ({ ...f, personal_email: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Date of Birth" />
                  <div className="modal-input-wrapper">
                    <input type="date" value={studentForm.dob} onChange={e => setStudentForm(f => ({ ...f, dob: e.target.value }))} style={{ padding: '8px 12px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Age" />
                  <div className="modal-input-wrapper">
                    <input type="number" placeholder="20" value={studentForm.age} onChange={e => setStudentForm(f => ({ ...f, age: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Nationality" />
                  <div className="modal-input-wrapper">
                    <input placeholder="Indian" value={studentForm.nationality} onChange={e => setStudentForm(f => ({ ...f, nationality: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Aadhar Number" />
                  <div className="modal-input-wrapper">
                    <input placeholder="e.g. 123456789012" value={studentForm.aadhar_no} onChange={e => setStudentForm(f => ({ ...f, aadhar_no: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginTop: '30px' }}>
                  <input 
                    type="checkbox" 
                    id="stu_lateral_entry"
                    checked={studentForm.lateral_entry} 
                    onChange={e => setStudentForm(f => ({ ...f, lateral_entry: e.target.checked }))} 
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      border: '1.5px solid #d1d5db',
                      accentColor: '#0f172a',
                      cursor: 'pointer',
                      marginTop: '3px'
                    }} 
                  />
                  <label htmlFor="stu_lateral_entry" style={{ cursor: 'pointer', selectText: 'none' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Lateral Entry</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Student admitted via lateral entry</div>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 4: Parent & Guardian Details */}
            <div style={{ borderBottom: '1px solid #f1f5f9', pb: '12px', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0057b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Parent & Guardian Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Parent Mobile Number" />
                  <div className="modal-input-wrapper">
                    <input placeholder="9876543210" value={studentForm.parent_mobile} onChange={e => setStudentForm(f => ({ ...f, parent_mobile: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Parent Email Address" />
                  <div className="modal-input-wrapper">
                    <input type="email" placeholder="parent@gmail.com" value={studentForm.parent_email} onChange={e => setStudentForm(f => ({ ...f, parent_email: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Nominee Details */}
            <div style={{ borderBottom: '1px solid #f1f5f9', pb: '12px', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0057b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Nominee Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Nominee Name" />
                  <div className="modal-input-wrapper">
                    <input placeholder="Guardian / Nominee Name" value={studentForm.nominee_name} onChange={e => setStudentForm(f => ({ ...f, nominee_name: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Nominee Relationship" />
                  <div className="modal-input-wrapper">
                    <input placeholder="e.g. Father" value={studentForm.nominee_relationship} onChange={e => setStudentForm(f => ({ ...f, nominee_relationship: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Nominee Email" />
                  <div className="modal-input-wrapper">
                    <input type="email" placeholder="nominee@gmail.com" value={studentForm.nominee_email} onChange={e => setStudentForm(f => ({ ...f, nominee_email: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 6: Address */}
            <div>
              <FormLabel label="Residential Address" />
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '10px 14px',
                background: '#ffffff'
              }}>
                <textarea 
                  placeholder="Street, City, State, Zip Code..." 
                  value={studentForm.address} 
                  onChange={e => setStudentForm(f => ({ ...f, address: e.target.value }))}
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    minHeight: '60px',
                    fontSize: '14px',
                    color: '#0f172a',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

          </div>

          {/* Footer Action Buttons */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#fff', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', flexShrink: 0 }}>
            <button type="button" onClick={() => { setIsStudentModalOpen(false); setIsCustomStudentSchool(false); setIsCustomStudentDept(false); setIsCustomStudentDiv(false); }} style={{ padding: '9px 20px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: '600', fontSize: '13px', cursor: 'pointer', color: '#374151' }}>Cancel</button>
            <button type="submit" style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#0057b8', color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} /> Add Student</button>
          </div>
        </form>
      </Modal>

      {/* Add LTC Member Modal */}
      <Modal open={isLtcModalOpen} onClose={() => setIsLtcModalOpen(false)} title="Add LTC Member" hideHeader={true} size="lg" noPadding={true}>
        <form onSubmit={handleAddLtcMember} style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh', overflow: 'hidden' }}>
          {/* Solid Blue Header */}
          <div style={{ background: '#0057b8', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <UserPlus size={18} /> Add LTC Member
            </h3>
            <button type="button" onClick={() => setIsLtcModalOpen(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Form Content */}
          <div style={{ overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            
            {/* Section 1: Basic Information */}
            <div style={{ borderBottom: '1px solid #f1f5f9', pb: '12px', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0057b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Basic & Professional Information</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Full Name" required />
                  <div className="modal-input-wrapper">
                    <input required placeholder="Vijay Patil" value={ltcForm.name} onChange={e => setLtcForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Official Email" required />
                  <div className="modal-input-wrapper">
                    <input required type="email" placeholder="vijay@ltc.edu" value={ltcForm.email} onChange={e => setLtcForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Employee ID" required />
                  <div className="modal-input-wrapper">
                    <input required placeholder="LTC-M01" value={ltcForm.faculty_id} onChange={e => setLtcForm(f => ({ ...f, faculty_id: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Designation" />
                  {(() => {
                    const isCustom = ltcForm.isCustomDesignation || (ltcForm.designation && !LTC_DESIGNATION_OPTIONS.includes(ltcForm.designation));
                    const selectValue = isCustom ? "Other" : (ltcForm.designation || "");

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="modal-input-wrapper" style={{ position: 'relative' }}>
                          <select
                            value={selectValue}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === 'Other') {
                                setLtcForm(f => ({ ...f, designation: '', isCustomDesignation: true }));
                              } else {
                                setLtcForm(f => ({ ...f, designation: val, isCustomDesignation: false }));
                              }
                            }}
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', background: 'white', cursor: 'pointer' }}
                          >
                            <option value="">Select Designation</option>
                            {LTC_DESIGNATION_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                            <option value="Other">Other (Type custom designation...)</option>
                          </select>
                          <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none', position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        </div>

                        {isCustom && (
                          <input
                            type="text"
                            placeholder="Enter custom designation"
                            value={ltcForm.designation || ''}
                            onChange={e => setLtcForm(f => ({ ...f, designation: e.target.value, isCustomDesignation: true }))}
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '13px' }}
                          />
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Gender" />
                  <div className="modal-input-wrapper">
                    <select value={ltcForm.gender} onChange={e => setLtcForm(f => ({ ...f, gender: e.target.value }))}>
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Contact Details */}
            <div style={{ borderBottom: '1px solid #f1f5f9', pb: '12px', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0057b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Contact Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Contact Number" />
                  <div className="modal-input-wrapper">
                    <input placeholder="9876543210" value={ltcForm.phone} onChange={e => setLtcForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <FormLabel label="Personal Email" />
                  <div className="modal-input-wrapper">
                    <input type="email" placeholder="vijay@gmail.com" value={ltcForm.personal_email} onChange={e => setLtcForm(f => ({ ...f, personal_email: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Footer Action Buttons */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#fff', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', flexShrink: 0 }}>
            <button type="button" onClick={() => setIsLtcModalOpen(false)} style={{ padding: '9px 20px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: '600', fontSize: '13px', cursor: 'pointer', color: '#374151' }}>Cancel</button>
            <button type="submit" style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#0057b8', color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} /> Add Member</button>
          </div>
        </form>
      </Modal>


      {/* Feedback Modal */}
      <Modal open={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} title={`Feedback — ${selectedUserForFeedback?.name || ''}`} size="lg">
        {feedbackList.length === 0
          ? <div className="empty-state"><p>No feedback submitted yet.</p></div>
          : feedbackList.map((f, i) => (
            <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'center' }}>
                <span className="badge badge-blue">{f.category}</span>
                {['Pre-LTC', 'Post-LTC'].includes(f.category) && (
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ padding: '2px 6px', fontSize: '10px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '12px', border: '1px solid #16a34a', color: '#16a34a' }}
                    onClick={() => handleDownloadStudentFeedbackPdf(selectedUserForFeedback?.id, f.category)}
                  >
                    <Download size={10} /> Download PDF
                  </button>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-4)', marginLeft: 'auto' }}>{new Date(f.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 4px 0' }}>
                {(() => {
                  const text = f.feedback_text;
                  const pairs = parseFeedbackForDisplay(text, f.category);
                  if (pairs && pairs.length > 0) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 6 }}>
                        {pairs.map((pair, pIdx) => (
                          <div key={`pair-${pIdx}`} style={{ fontSize: 13, lineHeight: 1.4, background: '#ffffff', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{pair.question}</div>
                            <div style={{ color: '#0f172a', whiteSpace: 'pre-wrap' }}>{pair.answer || '—'}</div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return text;
                })()}
              </div>
              {f.additional_notes && <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Note: {f.additional_notes}</p>}
            </div>
          ))
        }
      </Modal>



      {/* Bulk Upload Progress Modal */}
      <Modal open={showProgressModal} onClose={() => {
        if (jobProgress && (jobProgress.status === 'completed' || jobProgress.status === 'failed')) {
          setShowProgressModal(false)
          setJobProgress(null)
        }
      }} title="Bulk Upload Progress" size="lg">
        {jobProgress ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                {jobProgress.status === 'pending' ? 'Queueing upload job...' :
                 jobProgress.status === 'parsing' ? 'Parsing Excel file server-side...' :
                 jobProgress.status === 'validating' ? 'Validating formats, emails & PRNs...' :
                 jobProgress.status === 'importing' ? 'Importing into database...' :
                 jobProgress.status === 'completed' ? 'Upload Completed!' :
                 jobProgress.status === 'failed' ? 'Upload Failed' : 'Initializing...'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>
                {jobProgress.processed_records} / {jobProgress.total_records} ({
                  jobProgress.total_records > 0 
                    ? Math.round((jobProgress.processed_records / jobProgress.total_records) * 100) 
                    : 0
                }%)
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${jobProgress.total_records > 0 ? (jobProgress.processed_records / jobProgress.total_records) * 100 : 0}%`,
                height: '100%',
                background: jobProgress.status === 'failed' ? 'var(--danger)' : 'var(--primary)',
                transition: 'width 0.4s ease'
              }} />
            </div>

            {/* ETA Info */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 12, color: 'var(--text-3)', marginTop: -8 }}>
              <span>Time Remaining (ETA): <strong style={{ color: 'var(--text)' }}>{jobProgress.eta || 'Estimating...'}</strong></span>
            </div>

            {/* Stats Counter */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#f1f5f9', border: '1px solid #bbf7d0', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>{jobProgress.success_count}</div>
                <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 600 }}>Success</div>
              </div>
              <div style={{ background: '#fef2f2', border: '1px solid #f1f5f9', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{jobProgress.failed_count}</div>
                <div style={{ fontSize: 12, color: '#000000', fontWeight: 600 }}>Failed</div>
              </div>
            </div>

            {/* Errors List */}
            {jobProgress.errors && jobProgress.errors.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', margin: 0 }}>Row-level Errors / Warnings ({jobProgress.errors.length})</h4>
                  <button className="btn btn-outline btn-sm" onClick={downloadErrorReport} style={{ padding: '4px 8px', fontSize: 11 }}>
                    Download Error CSV
                  </button>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: '#f8fafc' }}>
                  <table className="data-table data-table-compact" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Row Target</th>
                        <th>Error Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobProgress.errors.map((err, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, fontSize: 12 }}><code style={{ background: '#e2e8f0', padding: '2px 4px', borderRadius: 4 }}>{err.row}</code></td>
                          <td style={{ color: 'var(--danger)', fontSize: 12 }}>{err.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Controls */}
            {(jobProgress.status === 'completed' || jobProgress.status === 'failed') && (
              <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0, marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                {jobProgress.errors && jobProgress.errors.length > 0 && (
                  <button className="btn btn-outline" onClick={downloadErrorReport}>Download Error Report</button>
                )}
                <button className="btn btn-primary" onClick={() => {
                  setShowProgressModal(false)
                  setJobProgress(null)
                  refreshAllData()
                  setActiveTab('faculty')
                }}>Done</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 12 }}>
            <div className="spinner" />
            <span style={{ color: 'var(--text-3)', fontSize: 14, fontWeight: 600 }}>Uploading & parsing file...</span>
          </div>
        )}
      </Modal>

      {/* Duplicate Conflict Resolution Modal */}
      <Modal open={showDuplicateModal} onClose={() => { setShowDuplicateModal(false); setDuplicateRecords([]); setPendingBulkUsers([]); }} title="Duplicate Conflict Detection" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#f1f5f9', border: '1px solid #eff6ff', padding: 16, borderRadius: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <AlertCircle size={20} style={{ color: '#0f172a', marginTop: 2, flexShrink: 0 }} />
            <div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Duplicate Records Found</h4>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#0f172a', lineHeight: 1.5 }}>
                We detected <strong>{duplicateRecords.length}</strong> record(s) in your file whose email, student PRN, or faculty ID already exist in the database. Please select how you want to handle these conflicts:
              </p>
            </div>
          </div>

          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
            <table className="data-table data-table-compact" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Conflict Details</th>
                  <th>Existing Database User</th>
                </tr>
              </thead>
              <tbody>
                {duplicateRecords.map((dup, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 12.5 }}>{dup.uploadRecord.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        {dup.uploadRecord.email && <span>{dup.uploadRecord.email}</span>}
                        {dup.uploadRecord.prn && <span> · PRN: {dup.uploadRecord.prn}</span>}
                        {dup.uploadRecord.faculty_id && <span> · ID: {dup.uploadRecord.faculty_id}</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text-2)' }}>{dup.existingRecord.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        {dup.existingRecord.email && <span>{dup.existingRecord.email}</span>}
                        {dup.existingRecord.prn && <span> · PRN: {dup.existingRecord.prn}</span>}
                        {dup.existingRecord.faculty_id && <span> · ID: {dup.existingRecord.faculty_id}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0, marginTop: 12, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline"
              onClick={() => {
                setShowDuplicateModal(false)
                setDuplicateRecords([])
                setPendingBulkUsers([])
              }}
            >
              Cancel Upload
            </button>
            <button
              className="btn btn-outline"
              style={{ color: '#0f172a', borderColor: '#0f172a' }}
              onClick={() => {
                setShowDuplicateModal(false)
                executeIngestion('skip')
              }}
            >
              Skip Duplicates
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setShowDuplicateModal(false)
                executeIngestion('replace')
              }}
            >
              Replace & Overwrite
            </button>
          </div>
        </div>
      </Modal>

      <div id="qr-reader-file-dummy" style={{ display: 'none' }} />
      <ToastContainer toasts={toasts} />
    </>
  )
}
