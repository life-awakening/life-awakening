import React, { useState, useEffect } from 'react'
import { Clock, MapPin, Calendar, Sparkles, Shirt, Timer, CheckCircle, Info } from 'lucide-react'
import { useLanguage } from './context/LanguageContext'
import API_BASE_URL from '@/config/apiConfig';

export function calculateLrpDay(startDateStr, currentDateObj = new Date()) {
  if (!startDateStr) return 1;
  try {
    const datePart = String(startDateStr).split('T')[0];
    const parts = datePart.split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      return 1;
    }
    const [year, month, day] = parts;
    // LAP Day 1 starts 2 days after batch start date (e.g. 12 Aug -> 14 Aug)
    const lrpDay1Start = new Date(year, month - 1, day + 2);

    const today = new Date(
      currentDateObj.getFullYear(),
      currentDateObj.getMonth(),
      currentDateObj.getDate()
    );

    const diffTime = today.getTime() - lrpDay1Start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    let currentLrpDay = diffDays + 1;

    if (currentLrpDay < 1) currentLrpDay = 1;
    if (currentLrpDay > 3) currentLrpDay = 3;

    return currentLrpDay;
  } catch (err) {
    return 1;
  }
}

export default function TimetablePanel({ compact = false, onViewDetail, style, activeBatch }) {
  const { t } = useLanguage()
  const [selectedDay, setSelectedDay] = useState(1)
  const [compactSelectedDay, setCompactSelectedDay] = useState(1)
  const [activeSubTab, setActiveSubTab] = useState('schedule') // 'schedule' or 'dresscode'
  const [activeBatchInfo, setActiveBatchInfo] = useState(null)
  const [loadingActiveBatch, setLoadingActiveBatch] = useState(true)

  useEffect(() => {
    const fetchActiveBatch = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          setLoadingActiveBatch(false)
          return
        }
        const clientDateStr = new Date().toISOString();
        const res = await fetch(`${API_BASE_URL}/api/active-batch?clientDate=${encodeURIComponent(clientDateStr)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setActiveBatchInfo(data)
          const b = activeBatch || data.activeBatch;
          if (b && (b.start_date_str || b.start_date)) {
            const calculatedDay = calculateLrpDay(b.start_date_str || b.start_date);
            setSelectedDay(calculatedDay);
            setCompactSelectedDay(calculatedDay);
          } else if (data && data.currentDay >= 1 && data.currentDay <= 3) {
            setSelectedDay(data.currentDay);
            setCompactSelectedDay(data.currentDay);
          }
        }
      } catch (err) {
        console.error('Error fetching active batch info:', err)
      } finally {
        setLoadingActiveBatch(false)
      }
    }
    fetchActiveBatch()
  }, [activeBatch])

  useEffect(() => {
    const b = activeBatch || activeBatchInfo?.activeBatch;
    if (b && (b.start_date_str || b.start_date)) {
      const calculatedDay = calculateLrpDay(b.start_date_str || b.start_date);
      setSelectedDay(calculatedDay);
      setCompactSelectedDay(calculatedDay);
    }
  }, [activeBatch, activeBatchInfo]);

  // Summary data for compact view (Day 1 to 3)
  const compactTimetableData = [
    {
      day: 1,
      name: "Day 1",
      activity1: {
        time: "11:15 AM - 12:00 PM",
        duration: "45 Min",
        title: "Allotment of room and accommodation",
        location: "Hostels / Accommodation"
      },
      activity2: {
        time: "02:15 PM - 03:00 PM",
        duration: "45 Min",
        title: "Orientation for students for Life Awakening Program",
        location: "Orientation Hall / Gazebo"
      }
    },
    {
      day: 2,
      name: "Day 2",
      activity1: {
        time: "06:00 AM - 07:30 AM",
        duration: "90 Min",
        title: "National Song, Drills & Sports",
        location: "Sports Ground & Drill Course"
      },
      activity2: {
        time: "10:00 AM - 11:30 AM",
        duration: "90 Min",
        title: "Team Building & Agriculture (Five Pillars)",
        location: "Farm & Activity Area"
      }
    },
    {
      day: 3,
      name: "Day 3",
      activity1: {
        time: "07:15 AM - 08:15 AM",
        duration: "60 Min",
        title: "Feedback Form",
        location: "Computer Lab / Hall"
      },
      activity2: {
        time: "09:30 AM - 11:30 AM",
        duration: "120 Min",
        title: "Valedictory Function & Awards",
        location: "Sanskruti Hall / Amphitheatre"
      }
    }
  ]

  // Detailed 3-Day LAP Schedule matching reference chart
  const detailedSchedule = {
    1: [
      {
        time: "11:00 AM - 11:15 AM",
        duration: "15 Min",
        title: "Arrival at Life Transformation Centre",
        location: "Reception / Main Gate",
        dress: "Casual Dress",
        description: "Arrival of students at Life Transformation Centre (LTC), Boribel.",
        type: "registration"
      },
      {
        time: "11:15 AM - 12:00 PM",
        duration: "45 Min",
        title: "Allotment of room and accommodation",
        location: "Hostels / Accommodation",
        dress: "Casual Dress",
        description: "Allotment of room and accommodation, settling in, and standard bag checking.",
        type: "registration"
      },
      {
        time: "12:00 PM - 01:00 PM",
        duration: "60 Min",
        title: "Lunch",
        location: "Dining Hall",
        dress: "Casual Dress",
        description: "Wholesome lunch served to students.",
        type: "meals"
      },
      {
        time: "01:00 PM - 02:00 PM",
        duration: "60 Min",
        title: "Getting Fresh and Rest",
        location: "Hostel Rooms",
        dress: "Casual Dress",
        description: "Rest period and freshening up in assigned rooms.",
        type: "rest"
      },
      {
        time: "02:00 PM - 02:15 PM",
        duration: "15 Min",
        title: "Transition",
        location: "Campus",
        dress: "Casual Dress",
        description: "Transition to orientation venue.",
        type: "rest"
      },
      {
        time: "02:15 PM - 03:00 PM",
        duration: "45 Min",
        title: "Orientation for students for Life Awakening Program",
        location: "Orientation Hall / Gazebo",
        dress: "Casual Dress",
        description: "Orientation briefing on Life Awakening Program guidelines, code of conduct, and schedule.",
        type: "academic"
      },
      {
        time: "03:00 PM - 04:30 PM",
        duration: "90 Min",
        title: "Team Building & Leadership / Agriculture and Nature",
        location: "Gazebo & Farm Area",
        dress: "Sports T-Shirt & Track Pants",
        description: "Parallel groups: Team Building & Leadership (Icebreaker, Untangle Yourself) and Agriculture & Nature (Agri Tour, Seed Ball Making).",
        type: "academic",
        groupTrack: "Team Building & Leadership | Agriculture and Nature"
      },
      {
        time: "04:30 PM - 05:00 PM",
        duration: "30 Min",
        title: "Snacks",
        location: "Dining Area",
        dress: "Sports Attire",
        description: "Healthy evening refreshments and snacks.",
        type: "meals"
      },
      {
        time: "05:00 PM - 05:15 PM",
        duration: "15 Min",
        title: "Transition",
        location: "Grounds",
        dress: "Sports Attire",
        description: "Move to grounds for patriotism drills and physical fitness.",
        type: "rest"
      },
      {
        time: "05:15 PM - 06:30 PM",
        duration: "75 Min",
        title: "Patriotism & Nation Building / Physical Fitness Sports",
        location: "Grounds & Drill Course",
        dress: "Sports Attire & Shoes",
        description: "Living a Soldier's Experience (Army Drill, Zig Zag Balance, Commando Crawl) & Traditional Indian Sports (Rumal Pani, Andhali Koshimbir).",
        type: "fitness",
        groupTrack: "Patriotism & Nation Building | Physical Fitness Sports"
      },
      {
        time: "06:30 PM - 06:45 PM",
        duration: "15 Min",
        title: "Getting Fresh and Rest",
        location: "Hostel Rooms",
        dress: "Casual Dress",
        description: "Freshen up and wash up after outdoor activities.",
        type: "rest"
      },
      {
        time: "06:45 PM - 07:15 PM",
        duration: "60 Min",
        title: "Spirituality & Peace",
        location: "Gazebo / Meditation Hall",
        dress: "Comfortable Attire",
        description: "Nature Screen Mirroring, Soham Chanting, and Guided Breathing exercises.",
        type: "academic"
      },
      {
        time: "07:15 PM - 07:30 PM",
        duration: "15 Min",
        title: "Transition",
        location: "Campus",
        dress: "Casual Dress",
        description: "Move to dining hall.",
        type: "rest"
      },
      {
        time: "07:30 PM - 08:30 PM",
        duration: "30 Min",
        title: "Dinner",
        location: "Dining Hall",
        dress: "Casual Dress",
        description: "Hot nutritious dinner served.",
        type: "meals"
      },
      {
        time: "08:30 PM - 09:00 PM",
        duration: "30 Min",
        title: "Prepare for Bedtime",
        location: "Hostel Rooms",
        dress: "Night Dress",
        description: "Wind down, reflect on the day, and prepare for rest.",
        type: "rest"
      }
    ],
    2: [
      {
        time: "05:00 AM - 06:00 AM",
        duration: "60 Min",
        title: "Getting Ready for the Day",
        location: "Hostel",
        dress: "Sports Attire",
        description: "Morning wakeup, personal hygiene, and getting dressed for morning drills.",
        type: "rest"
      },
      {
        time: "06:00 AM - 07:30 AM",
        duration: "90 Min",
        title: "National Song, Warm Up Exercises, Patriotism & Nation Building, Physical Fitness and Sports",
        location: "Sports Ground & Drill Course",
        dress: "Sports Attire & Shoes",
        description: "National Song, Warm Up Exercises, Patriotism Drills (Commando Crawl, Mission Rescue, Tarzan Swing), and Physical Fitness & Sports.",
        type: "fitness"
      },
      {
        time: "07:30 AM - 07:50 AM",
        duration: "20 Min",
        title: "Transition and Dress change",
        location: "Hostel",
        dress: "Change to Yoga Dress",
        description: "Transition to hostel rooms and change into comfortable yoga dress.",
        type: "rest"
      },
      {
        time: "07:50 AM - 08:50 AM",
        duration: "60 Min",
        title: "Spirituality and Peace",
        location: "Gazebo / Sanskruti Hall",
        dress: "Yoga Dress",
        description: "Warm Up, Balance & Animal Postures, Surya Namaskar, and Guided Meditation.",
        type: "academic"
      },
      {
        time: "08:50 AM - 09:00 AM",
        duration: "10 Min",
        title: "Transition",
        location: "Campus",
        dress: "Yoga Dress",
        description: "Move to breakfast hall.",
        type: "rest"
      },
      {
        time: "09:00 AM - 09:45 AM",
        duration: "45 Min",
        title: "Breakfast",
        location: "Dining Hall",
        dress: "Yoga Dress",
        description: "Wholesome morning breakfast.",
        type: "meals"
      },
      {
        time: "09:45 AM - 10:00 AM",
        duration: "15 Min",
        title: "Transition",
        location: "Campus",
        dress: "Collar T-Shirt & Track Pants",
        description: "Transition to morning activity zones.",
        type: "rest"
      },
      {
        time: "10:00 AM - 11:30 AM",
        duration: "90 Min",
        title: "Team Building & Leadership / Agriculture and Nature",
        location: "Farm & Activity Area",
        dress: "Collar T-Shirt & Track Pants",
        description: "Team Building (Bridge, Longest Shadow) and Agriculture and Nature (Farm Visit, Crops & Soil Experience Zone).",
        type: "academic",
        groupTrack: "Team Building & Leadership | Agriculture and Nature"
      },
      {
        time: "11:30 AM - 12:30 PM",
        duration: "60 Min",
        title: "Personal Hygiene – Bath and Freshening Up",
        location: "Hostel Rooms",
        dress: "Casual Dress",
        description: "Bath, personal hygiene, and rest.",
        type: "rest"
      },
      {
        time: "12:30 PM - 01:30 PM",
        duration: "60 Min",
        title: "Lunch",
        location: "Dining Hall",
        dress: "Casual Dress",
        description: "Wholesome midday meal.",
        type: "meals"
      },
      {
        time: "01:30 PM - 02:00 PM",
        duration: "30 Min",
        title: "Keep your Living Space Clean",
        location: "Hostel Rooms",
        dress: "Casual Dress",
        description: "Room organization, cleaning living space, and fostering discipline.",
        type: "academic"
      },
      {
        time: "02:00 PM - 03:00 PM",
        duration: "60 Min",
        title: "Book Reading, Diary Writing, Resting (Mauna)",
        location: "Hostel / Reading Area",
        dress: "Casual Dress",
        description: "Quiet Mauna (silence), reflective diary writing, book reading, and rest.",
        type: "rest"
      },
      {
        time: "03:00 PM - 03:15 PM",
        duration: "15 Min",
        title: "Transition",
        location: "Campus",
        dress: "Casual Dress",
        description: "Transition to storytelling venue.",
        type: "rest"
      },
      {
        time: "03:15 PM - 04:00 PM",
        duration: "45 Min",
        title: "Story Telling",
        location: "Gazebo / Amphitheatre",
        dress: "Casual Dress",
        description: "Inspiring moral and values-based storytelling session.",
        type: "academic"
      },
      {
        time: "04:00 PM - 04:30 PM",
        duration: "30 Min",
        title: "Snack Break",
        location: "Dining Hall",
        dress: "Sports Attire",
        description: "Evening snack break and healthy refreshments.",
        type: "meals"
      },
      {
        time: "04:30 PM - 06:00 PM",
        duration: "90 Min",
        title: "Agriculture and Nature / Team Building & Leadership",
        location: "Farm & Activity Area",
        dress: "Sports Attire & Shoes",
        description: "Swap the Group: Swapped groups participate in Agriculture & Nature and Team Building & Leadership.",
        type: "academic",
        groupTrack: "Swap the Group: Agriculture and Nature <-> Team Building & Leadership"
      },
      {
        time: "06:00 PM - 06:15 PM",
        duration: "15 Min",
        title: "Transition",
        location: "Grounds",
        dress: "Sports Attire",
        description: "Move to evening sports grounds.",
        type: "rest"
      },
      {
        time: "06:15 PM - 07:15 PM",
        duration: "60 Min",
        title: "Physical Fitness Sports Activities / Patriotism & Nation Building",
        location: "Sports Grounds",
        dress: "Sports Attire & Shoes",
        description: "Swap Group: Swapped groups participate in Physical Fitness Sports Activities and Patriotism Drills.",
        type: "fitness",
        groupTrack: "Swap Group: Physical Fitness Sports Activities <-> Patriotism & Nation Building"
      },
      {
        time: "07:15 PM - 07:30 PM",
        duration: "15 Min",
        title: "Transition",
        location: "Campus",
        dress: "Casual Dress",
        description: "Wash up and transition to dinner.",
        type: "rest"
      },
      {
        time: "07:30 PM - 08:30 PM",
        duration: "60 Min",
        title: "Dinner",
        location: "Dining Hall",
        dress: "Casual Dress",
        description: "Nutritious dinner served in dining hall.",
        type: "meals"
      },
      {
        time: "08:30 PM - 09:00 PM",
        duration: "30 Min",
        title: "Prepare for Bedtime",
        location: "Hostel Rooms",
        dress: "Night Dress",
        description: "Prepare for bedtime and personal reflection.",
        type: "rest"
      },
      {
        time: "09:00 PM",
        duration: "—",
        title: "Lights Off",
        location: "Hostel",
        dress: "Night Dress",
        description: "Curfew and lights out.",
        type: "rest"
      }
    ],
    3: [
      {
        time: "05:00 AM - 06:00 AM",
        duration: "60 Min",
        title: "Getting Ready for the Day",
        location: "Hostel",
        dress: "Formal / Clean Attire",
        description: "Morning wakeup, packing personal belongings, and preparing for the final day.",
        type: "rest"
      },
      {
        time: "06:00 AM - 07:00 AM",
        duration: "60 Min",
        title: "Spirituality and Peace",
        location: "Gazebo / Amphitheatre",
        dress: "Formal / Clean Attire",
        description: "Morning Spirituality and Peace session: meditation, mindfulness, and reflections.",
        type: "academic"
      },
      {
        time: "07:00 AM - 07:15 AM",
        duration: "15 Min",
        title: "Transition",
        location: "Campus",
        dress: "Formal / Clean Attire",
        description: "Transition to feedback session.",
        type: "rest"
      },
      {
        time: "07:15 AM - 08:15 AM",
        duration: "60 Min",
        title: "Feedback Form",
        location: "Computer Lab / Hall / Mobile Panel",
        dress: "Formal / Clean Attire",
        description: "Submission of Student Service & Trainer Feedback Form.",
        type: "academic"
      },
      {
        time: "08:15 AM - 09:15 AM",
        duration: "60 Min",
        title: "Breakfast",
        location: "Dining Hall",
        dress: "Formal / Clean Attire",
        description: "Farewell breakfast with teachers and peers.",
        type: "meals"
      },
      {
        time: "09:15 AM - 09:30 AM",
        duration: "15 Min",
        title: "Transition",
        location: "Campus",
        dress: "Formal / Clean Attire",
        description: "Transition to Valedictory Hall.",
        type: "rest"
      },
      {
        time: "09:30 AM - 11:30 AM",
        duration: "120 Min",
        title: "Valedictory Function & Awards",
        location: "Sanskruti Hall / Amphitheatre",
        dress: "Formal / Clean Attire",
        description: "Valedictory address, student reflections, awards ceremony, and certificate distribution.",
        type: "academic"
      },
      {
        time: "11:30 AM - 12:00 PM",
        duration: "30 Min",
        title: "Packing and Check Out",
        location: "Hostels & Admin Area",
        dress: "Travel Attire",
        description: "Packing, room clearance, handing over room keys, and checkout procedures.",
        type: "registration"
      },
      {
        time: "12:00 PM - 01:00 PM",
        duration: "60 Min",
        title: "Lunch",
        location: "Dining Hall",
        dress: "Travel Attire",
        description: "Nutritious farewell lunch.",
        type: "meals"
      },
      {
        time: "01:00 PM - 04:00 PM",
        duration: "90 Min",
        title: "Departure to Dome and Visit, Museum etc (Optional)",
        location: "World Peace Dome & Museum",
        dress: "Travel Attire",
        description: "Departure to World Peace Dome and Visit, Museum etc (Optional educational tour).",
        type: "academic"
      },
      {
        time: "04:00 PM - 04:15 PM",
        duration: "15 Min",
        title: "Transition",
        location: "Transport Bay",
        dress: "Travel Attire",
        description: "Boarding school transport and final headcount.",
        type: "rest"
      },
      {
        time: "03:15 PM - 04:15 PM",
        duration: "60 Min",
        title: "Departure to Pune",
        location: "Transport Bay / En Route",
        dress: "Travel Attire",
        description: "Departure from LTC Boribel towards Pune campus.",
        type: "registration"
      },
      {
        time: "06:15 PM - 06:45 PM",
        duration: "30 Min",
        title: "Arrival in Pune",
        location: "MIT-WPU Campus, Pune",
        dress: "Travel Attire",
        description: "Arrival at MIT-WPU Pune campus and dispersal.",
        type: "registration"
      }
    ]
  }

  // Venue and dress code guidelines matching the 3-Day schedule
  const dressCodeRules = [
    { activity: "Arrival & Room Allotment", venue: "Hostels / Reception", dress: "Casual Dress", note: "Day 1 Arrival & room check-in" },
    { activity: "Orientation for LAP", venue: "Orientation Hall / Gazebo", dress: "Casual Dress", note: "Day 1 Program overview" },
    { activity: "Team Building & Leadership", venue: "Gazebo & Activity Area", dress: "Sports T-Shirt & Track Pants", note: "Five Pillars outdoor activities" },
    { activity: "Agriculture and Nature", venue: "LTC Farm & Activity Area", dress: "Collar T-Shirt & Track Pants", note: "Fieldwork & farming exercises" },
    { activity: "Patriotism & Nation Building", venue: "Grounds & Drill Course", dress: "Sports Attire & Shoes", note: "Military drills & obstacle training" },
    { activity: "Physical Fitness Sports", venue: "Sports Grounds", dress: "Sports Attire & Shoes", note: "Traditional Indian sports & conditioning" },
    { activity: "Spirituality and Peace (Yoga / Meditation)", venue: "Gazebo / Sanskruti Hall", dress: "Comfortable Yoga Dress", note: "Morning & evening reflection" },
    { activity: "Story Telling & Book Reading (Mauna)", venue: "Gazebo / Hostel Reading Area", dress: "Casual Dress", note: "Mindfulness and character building" },
    { activity: "Feedback Form & Valedictory Ceremony", venue: "Sanskruti Hall / Amphitheatre", dress: "Formal / Clean Attire", note: "Day 3 Awards & certificate ceremony" },
    { activity: "Dome Visit & Departure to Pune", venue: "World Peace Dome & Transport Bay", dress: "Travel Attire", note: "Day 3 Return journey" }
  ]

  // Day theme accents matching the reference image colors
  const dayMeta = {
    1: {
      badgeBg: '#ea580c',
      badgeText: '#ffffff',
      tag: 'Day 1 — Arrival & Orientation',
      accentColor: '#ea580c',
      bgLight: '#fff7ed',
      borderColor: '#fed7aa'
    },
    2: {
      badgeBg: '#047857',
      badgeText: '#ffffff',
      tag: 'Day 2 — Immersion & Swap Groups',
      accentColor: '#047857',
      bgLight: '#f0fdf4',
      borderColor: '#bbf7d0'
    },
    3: {
      badgeBg: '#4338ca',
      badgeText: '#ffffff',
      tag: 'Day 3 — Valedictory & Departure',
      accentColor: '#4338ca',
      bgLight: '#f5f3ff',
      borderColor: '#ddd6fe'
    }
  }

  // Color coding tags based on activity type
  const getActivityStyles = (type) => {
    const labelMap = {
      fitness:      'Fitness & Sports',
      academic:     'Leadership & Academic',
      meals:        'Meals & Refreshment',
      rest:         'Rest & Transition',
      registration: 'Registration & Admin'
    }
    const colorMap = {
      fitness:      { bg: '#1d4ed8', text: '#ffffff' },
      academic:     { bg: '#7c3aed', text: '#ffffff' },
      meals:        { bg: '#15803d', text: '#ffffff' },
      rest:         { bg: '#475569', text: '#ffffff' },
      registration: { bg: '#0369a1', text: '#ffffff' }
    }
    const styles = colorMap[type] || { bg: '#475569', text: '#ffffff' }
    return { 
      ...styles, 
      label: labelMap[type] || 'Activity' 
    }
  }

  // COMPACT VIEW FOR DASHBOARD CARDS
  if (compact) {
    const batchObj = activeBatch || activeBatchInfo?.activeBatch;
    const activeDay = batchObj && (batchObj.start_date_str || batchObj.start_date)
      ? calculateLrpDay(batchObj.start_date_str || batchObj.start_date)
      : (activeBatchInfo?.currentDay || 1);

    const dayNum = parseInt(compactSelectedDay);
    const activitiesToRender = detailedSchedule[dayNum] || [];
    const currentMeta = dayMeta[dayNum] || dayMeta[1];

    return (
      <div 
        className="animate-fade-in"
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          ...style
        }}
      >
        {/* Header Section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '16.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Calendar size={18} style={{ color: '#154388' }} />
              {t("LAP Schedule")}
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0', fontWeight: '500' }}>
              {t("3-Day residential schedule & activity agenda")}
            </p>
          </div>

          <button 
            onClick={onViewDetail} 
            style={{
              padding: '6px 14px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              background: '#ffffff',
              fontSize: '12.5px',
              fontWeight: '700',
              color: '#154388',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'background-color 0.15s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
          >
            {t("View Full Schedule")} →
          </button>
        </div>

        {/* Day Segmented Selector (Day 1 to 3) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          background: '#f8fafc',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2, 3].map((val) => {
              const isSel = parseInt(compactSelectedDay) === val;
              const meta = dayMeta[val];
              return (
                <button
                  key={val}
                  onClick={() => setCompactSelectedDay(val)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    background: isSel ? meta.accentColor : 'transparent',
                    color: isSel ? '#ffffff' : '#64748b',
                    boxShadow: isSel ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {t(`Day ${val}`)}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600', paddingRight: '6px' }}>
            {currentMeta.tag} · {activitiesToRender.length} {t("activities")}
          </div>
        </div>

        {/* Activity Cards List */}
        <div className="lrp-schedule-container">
          <div className="lrp-schedule-header">
            <div>{t("Time & Duration")}</div>
            <div>{t("Activity Name")}</div>
            <div>{t("Venue & Dress Code")}</div>
            <div style={{ textAlign: 'right' }}>{t("Category")}</div>
          </div>
          {activitiesToRender.slice(0, 6).map((activity, idx) => {
            const styles = getActivityStyles(activity.type);
            return (
              <div key={idx} className="lrp-schedule-row">
                {/* Column 1: Time & Duration */}
                <div className="lrp-time-column">
                  <span className="lrp-time-pill">
                    <Clock size={13} style={{ color: '#475569', flexShrink: 0 }} />
                    {activity.time}
                  </span>
                  {activity.duration && (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: '5px', width: 'fit-content' }}>
                      {activity.duration}
                    </span>
                  )}
                </div>

                {/* Column 2: Activity Name */}
                <div className="lrp-activity-column">
                  <span className="lrp-activity-name">{t(activity.title)}</span>
                  {activity.description && (
                    <p className="lrp-activity-description">{t(activity.description)}</p>
                  )}
                  {activity.groupTrack && (
                    <span className="lrp-activity-squad">
                      <Sparkles size={11} style={{ color: '#4338ca' }} />
                      {t("Track")}: {t(activity.groupTrack)}
                    </span>
                  )}
                </div>

                {/* Column 3: Venue + Dress Code */}
                <div className="lrp-venue-dress-column">
                  <div className="lrp-venue-info">
                    <MapPin size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                    <span>{activity.location ? t(activity.location) : t("No venue set")}</span>
                  </div>
                  {activity.dress && (
                    <div className="lrp-dress-info">
                      <Shirt size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                      <span>{t(activity.dress)}</span>
                    </div>
                  )}
                </div>

                {/* Column 4: Category Badge */}
                <div className="lrp-badge-column">
                  <span className="lrp-category-pill" style={{
                    color: styles.text,
                    background: styles.bg
                  }}>
                    {t(styles.label)}
                  </span>
                </div>
              </div>
            );
          })}
          {activitiesToRender.length > 6 && (
            <div style={{ textAlign: 'center', fontSize: '12px', color: '#64748b', padding: '6px 0', fontWeight: '600' }}>
              +{activitiesToRender.length - 6} {t("more activities")} · <span style={{ color: '#154388', cursor: 'pointer', fontWeight: '700' }} onClick={onViewDetail}>{t("View all")}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // DETAILED VIEW (WITH CLEAN DAY TABS AND SCHEDULE TABLE)
  const currentMeta = dayMeta[selectedDay] || dayMeta[1];

  return (
    <div 
      className="animate-fade-in"
      style={{ 
        background: '#ffffff',
        border: '1px solid #e2e8f0', 
        borderRadius: '16px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', 
        padding: '24px',
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px',
        ...style
      }} 
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h3 style={{ fontSize: '21px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '9px' }}>
            <Calendar size={22} style={{ color: '#154388' }} />
            {t("LAP Schedule")}
          </h3>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '500' }}>
            {t("Official 3-Day residential schedule, timings, venues, and dress codes")}
          </p>
        </div>
        
        {/* Navigation Tabs between Timeline & DressCode (Clean Segmented Controller) */}
        <div 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center',
            background: '#f1f5f9', 
            padding: '4px', 
            borderRadius: '10px', 
            border: '1px solid #e2e8f0',
            maxWidth: '100%'
          }}
        >
          <button
            onClick={() => setActiveSubTab('schedule')}
            style={{
              padding: '7px 18px',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: activeSubTab === 'schedule' ? '700' : '550',
              border: 'none',
              cursor: 'pointer',
              background: activeSubTab === 'schedule' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'schedule' ? '#0f172a' : '#64748b',
              boxShadow: activeSubTab === 'schedule' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
              outline: 'none'
            }}
          >
            {t("Daywise Timeline")}
          </button>
          
          <button
            onClick={() => setActiveSubTab('dresscode')}
            style={{
              padding: '7px 18px',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: activeSubTab === 'dresscode' ? '700' : '550',
              border: 'none',
              cursor: 'pointer',
              background: activeSubTab === 'dresscode' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'dresscode' ? '#0f172a' : '#64748b',
              boxShadow: activeSubTab === 'dresscode' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
              outline: 'none'
            }}
          >
            {t("Dress Codes & Venues")}
          </button>
        </div>
      </div>

      {activeSubTab === 'schedule' && (
        <>
          {/* Day selection tabs (Clean Day 1, 2, 3 Layout) */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
            {[
              { day: 1, label: 'Day 1' },
              { day: 2, label: 'Day 2' },
              { day: 3, label: 'Day 3' }
            ].map(({ day, label }) => {
              const isSel = selectedDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    border: `1px solid ${isSel ? '#ea580c' : '#e2e8f0'}`,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    background: isSel ? '#ea580c' : '#ffffff',
                    color: isSel ? '#ffffff' : '#475569',
                    boxShadow: 'none'
                  }}
                >
                  {t(label)}
                </button>
              );
            })}
          </div>

          {/* Active Day Banner (Clean, Flat, Non-Glassmorphic) */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#ea580c',
                color: '#ffffff',
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '800',
                letterSpacing: '0.4px',
                textTransform: 'uppercase'
              }}>
                Day {selectedDay}
              </span>
            </div>
            <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '600' }}>
              {detailedSchedule[selectedDay]?.length || 0} {t("scheduled sessions")}
            </span>
          </div>

          {/* Activity Grid List */}
          <div className="lrp-schedule-container" style={{ marginTop: '6px' }}>
            <div className="lrp-schedule-header">
              <div>{t("Time & Duration")}</div>
              <div>{t("Activity Name")}</div>
              <div>{t("Venue & Dress Code")}</div>
              <div style={{ textAlign: 'right' }}>{t("Category")}</div>
            </div>
            {detailedSchedule[selectedDay]?.map((activity, idx) => {
              const styles = getActivityStyles(activity.type);
              return (
                <div key={idx} className="lrp-schedule-row">
                  {/* Column 1: Time & Duration */}
                  <div className="lrp-time-column">
                    <span className="lrp-time-pill">
                      <Clock size={13} style={{ color: '#475569', flexShrink: 0 }} />
                      {activity.time}
                    </span>
                    {activity.duration && (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: '5px', width: 'fit-content' }}>
                        {activity.duration}
                      </span>
                    )}
                  </div>

                  {/* Column 2: Activity Name */}
                  <div className="lrp-activity-column">
                    <span className="lrp-activity-name">{t(activity.title)}</span>
                    {activity.description && (
                      <p className="lrp-activity-description">{t(activity.description)}</p>
                    )}
                    {activity.groupTrack && (
                      <span className="lrp-activity-squad">
                        <Sparkles size={11} style={{ color: '#4338ca' }} />
                        {t("Track")}: {t(activity.groupTrack)}
                      </span>
                    )}
                  </div>

                  {/* Column 3: Venue + Dress Code */}
                  <div className="lrp-venue-dress-column">
                    <div className="lrp-venue-info">
                      <MapPin size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                      <span>{activity.location ? t(activity.location) : t("No venue set")}</span>
                    </div>
                    {activity.dress && (
                      <div className="lrp-dress-info">
                        <Shirt size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                        <span>{t(activity.dress)}</span>
                      </div>
                    )}
                  </div>

                  {/* Column 4: Category Badge */}
                  <div className="lrp-badge-column">
                    <span className="lrp-category-pill" style={{
                      color: styles.text,
                      background: styles.bg
                    }}>
                      {t(styles.label)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Official Footnote matching reference image */}
          <div style={{
            marginTop: '12px',
            padding: '12px 16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            fontSize: '12.5px',
            color: '#475569',
            lineHeight: '1.6'
          }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1e293b' }}>
              <strong>{t("Note")}:</strong> {t("The activities under the five pillars will be different every day.")}
            </p>
            <p style={{ margin: 0, fontStyle: 'italic', color: '#64748b', fontSize: '11.5px' }}>
              * {t("The LTC reserves the rights to change or modify any of the activities.")}
            </p>
          </div>
        </>
      )}

      {activeSubTab === 'dresscode' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
          <div style={{
            padding: '14px 18px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#1e40af',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Info size={18} style={{ flexShrink: 0 }} />
            <span>
              {t("All participants must wear the specified uniform for each session. Changing times are allocated in the schedule. Failure to wear the designated dress order is a violation of the LTC discipline policies.")}
            </span>
          </div>

          {/* Table of dress code guidelines */}
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '750', color: '#334155' }}>{t("Activity / Event")}</th>
                  <th style={{ padding: '12px 16px', fontWeight: '750', color: '#334155' }}>{t("Location / Venue")}</th>
                  <th style={{ padding: '12px 16px', fontWeight: '750', color: '#334155' }}>{t("Dress Order")}</th>
                  <th style={{ padding: '12px 16px', fontWeight: '750', color: '#334155' }}>{t("Reference")}</th>
                </tr>
              </thead>
              <tbody>
                {dressCodeRules.map((rule, index) => (
                  <tr 
                    key={index} 
                    style={{ 
                      borderBottom: index < dressCodeRules.length - 1 ? '1px solid #f1f5f9' : 'none', 
                      transition: 'background-color 0.15s ease' 
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} 
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0f172a' }}>{t(rule.activity)}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{t(rule.venue)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e293b' }}>{t(rule.dress)}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontStyle: 'italic', fontSize: '12px' }}>{t(rule.note)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
