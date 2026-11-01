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
    if (currentLrpDay > 4) currentLrpDay = 4;

    return currentLrpDay;
  } catch (err) {
    return 1;
  }
}

export default function TimetablePanel({ compact = false, onViewDetail, style, activeBatch }) {
  const { t } = useLanguage()
  const [activeProgram, setActiveProgram] = useState('wellness') // 'wellness' (default) or 'lap'
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
          } else if (data && data.currentDay >= 1 && data.currentDay <= 4) {
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

  // Summary data for compact view (Day 1 to 4)
  const compactTimetableData = [
    {
      day: 1,
      name: "Day 1",
      activity1: {
        time: "05:45 PM - 06:30 PM",
        duration: "45 Min",
        title: "Allotment of room and accommodation and bag checking",
        location: "Hostels / Accommodation"
      },
      activity2: {
        time: "06:30 PM - 07:15 PM",
        duration: "45 Min",
        title: "Orientation for students for Life Awakening Program",
        location: "Orientation Hall / Gazebo"
      }
    },
    {
      day: 2,
      name: "Day 2",
      activity1: {
        time: "07:00 AM - 08:00 AM",
        duration: "60 Min",
        title: "Patriotism & Nation Building",
        location: "Sports Ground & Drill Course"
      },
      activity2: {
        time: "10:15 AM - 11:30 AM",
        duration: "75 Min",
        title: "Team Building & Leadership Activity",
        location: "Gazebo & Activity Grounds"
      }
    },
    {
      day: 3,
      name: "Day 3",
      activity1: {
        time: "07:00 AM - 08:00 AM",
        duration: "60 Min",
        title: "Patriotism & Nation Building",
        location: "Sports Ground & Drill Course"
      },
      activity2: {
        time: "04:00 PM - 05:00 PM",
        duration: "60 Min",
        title: "Agriculture and Nature Activity (Polyhouse)",
        location: "LTC Polyhouse & Farm Area"
      }
    },
    {
      day: 4,
      name: "Day 4",
      activity1: {
        time: "08:15 AM - 08:35 AM",
        duration: "20 Min",
        title: "Group Photograph",
        location: "Main Campus Grounds / Monument"
      },
      activity2: {
        time: "10:25 AM - 11:00 AM",
        duration: "35 Min",
        title: "Award and Certificate Distribution",
        location: "Sanskruti Hall / Amphitheatre"
      }
    }
  ]

  // Official LAP Schedule matching LAP-Program-Schedule.pdf
  const detailedSchedule = {
    1: [
      {
        time: "05:00 PM - 05:45 PM",
        duration: "45 Min",
        title: "Arrival at Life Transformation Centre",
        location: "Reception / Main Gate",
        dress: "Casual Dress",
        description: "Arrival of students at Life Transformation Centre (LTC), Boribel.",
        type: "registration"
      },
      {
        time: "05:45 PM - 06:30 PM",
        duration: "45 Min",
        title: "Allotment of room and accommodation and bag checking",
        location: "Hostels / Accommodation",
        dress: "Casual Dress",
        description: "Allotment of room and accommodation, settling in, and bag checking.",
        type: "registration"
      },
      {
        time: "06:30 PM - 07:15 PM",
        duration: "45 Min",
        title: "Orientation for students for Life Awakening Program",
        location: "Orientation Hall / Gazebo",
        dress: "Casual Dress",
        description: "Orientation briefing for students on Life Awakening Program guidelines, code of conduct, and schedule.",
        type: "academic"
      },
      {
        time: "07:15 PM - 07:30 PM",
        duration: "15 Min",
        title: "Transition",
        location: "Campus",
        dress: "Casual Dress",
        description: "Transition to dining hall.",
        type: "rest"
      },
      {
        time: "07:30 PM - 08:30 PM",
        duration: "60 Min",
        title: "Dinner",
        location: "Dining Hall",
        dress: "Casual Dress",
        description: "Wholesome and nutritious dinner served to students.",
        type: "meals"
      },
      {
        time: "08:30 PM - 09:00 PM",
        duration: "30 Min",
        title: "Mobile Collection",
        location: "Hostels / Admin Bay",
        dress: "Casual Dress",
        description: "Safe collection and secure custody of student mobile devices.",
        type: "registration"
      },
      {
        time: "09:00 PM - 09:30 PM",
        duration: "30 Min",
        title: "Prepare for Bedtime",
        location: "Hostel Rooms",
        dress: "Night Dress",
        description: "Prepare for bedtime, personal hygiene, and daily reflection.",
        type: "rest"
      },
      {
        time: "09:30 PM",
        duration: "—",
        title: "Lights Off",
        location: "Hostels",
        dress: "Night Dress",
        description: "Curfew and lights out.",
        type: "rest"
      }
    ],
    2: [
      {
        time: "06:00 AM - 07:00 AM",
        duration: "60 Min",
        title: "Getting Ready for the Day",
        location: "Hostel Rooms",
        dress: "Sports Attire",
        description: "Morning wakeup, personal hygiene, and getting dressed for morning drills.",
        type: "rest"
      },
      {
        time: "07:00 AM - 08:00 AM",
        duration: "60 Min",
        title: "Patriotism & Nation Building",
        location: "Sports Ground & Drill Course",
        dress: "Sports Attire & Shoes",
        description: "1. Assembly & Reporting by Squad Captains, 2. National Song, 3. Light Stretching Exercise, 4. Aerobic Exercise (1 to 3), 5. Jogging & Running (1 Km), 6. Obstacle Training (Group 2 Briefing, Demonstration & Practice), 7. Cooling Down.",
        groupTrack: "Group 2 Obstacle Training | Briefing & Practice",
        type: "fitness"
      },
      {
        time: "08:00 AM - 08:20 AM",
        duration: "20 Min",
        title: "Transition and Dress change",
        location: "Hostel Rooms",
        dress: "Change to Yoga Dress",
        description: "Transition to hostel rooms and change into comfortable yoga dress.",
        type: "rest"
      },
      {
        time: "08:20 AM - 09:20 AM",
        duration: "60 Min",
        title: "Spirituality and Peace",
        location: "Gazebo / Sanskruti Hall",
        dress: "Yoga Dress",
        description: "Standing prayer & Om Chanting. A. Joint movement with props, B. Surya Namaskar with Mantra, C. Animal Flow (Tree pose, Plum tree pose, Kite pose, Triangle with wheel, Elephant forward movement, Kangaroo jump, Rabbit pose, Butterfly, Half fish, Child pose, Wind release, Shavasana - Yog Nidra, Anulom Vilom, Bhramari Pranayam, Shanti Path).",
        type: "academic"
      },
      {
        time: "09:20 AM - 09:30 AM",
        duration: "10 Min",
        title: "Transition",
        location: "Campus",
        dress: "Yoga Dress",
        description: "Move to dining hall.",
        type: "rest"
      },
      {
        time: "09:30 AM - 10:00 AM",
        duration: "30 Min",
        title: "Breakfast",
        location: "Dining Hall",
        dress: "Yoga Dress",
        description: "Wholesome and energizing breakfast.",
        type: "meals"
      },
      {
        time: "10:00 AM - 10:15 AM",
        duration: "15 Min",
        title: "Transition",
        location: "Campus",
        dress: "Sports T-Shirt & Track Pants",
        description: "Transition to team building and leadership zones.",
        type: "rest"
      },
      {
        time: "10:15 AM - 11:30 AM",
        duration: "75 Min",
        title: "Team Building & Leadership Activity",
        location: "Gazebo & Activity Grounds",
        dress: "Sports T-Shirt & Track Pants",
        description: "Interactive team building sessions: 1. Human Knot, 2. Queen Demand, 3. Bridge.",
        groupTrack: "1. Human Knot | 2. Queen Demand | 3. Bridge",
        type: "academic"
      },
      {
        time: "11:30 AM - 12:30 PM",
        duration: "60 Min",
        title: "Personal Hygiene – Bath and Freshening Up",
        location: "Hostel Rooms",
        dress: "Casual Dress",
        description: "Bath, personal hygiene, freshening up, and rest.",
        type: "rest"
      },
      {
        time: "12:30 PM - 01:30 PM",
        duration: "60 Min",
        title: "Lunch",
        location: "Dining Hall",
        dress: "Casual Dress",
        description: "Wholesome and nutritious lunch.",
        type: "meals"
      },
      {
        time: "01:30 PM - 02:00 PM",
        duration: "30 Min",
        title: "Keep your Living Space Clean",
        location: "Hostel Rooms",
        dress: "Casual Dress",
        description: "Room organization, tidying living spaces, and discipline fostering.",
        type: "academic"
      },
      {
        time: "02:00 PM - 02:50 PM",
        duration: "50 Min",
        title: "Book Reading, Diary Writing, Resting (Mauna)",
        location: "Hostel / Reading Area",
        dress: "Casual Dress",
        description: "Quiet Mauna (reflective silence), personal diary reflection, reading, and rest.",
        type: "rest"
      },
      {
        time: "02:50 PM - 03:30 PM",
        duration: "40 Min",
        title: "Expression Activity (Drawing Sheet)",
        location: "Activity Hall / Gazebo",
        dress: "Casual Dress",
        description: "Creative expression activity on drawing sheets sharing reflections and emotions.",
        type: "academic"
      },
      {
        time: "03:30 PM - 04:00 PM",
        duration: "30 Min",
        title: "Snack Break",
        location: "Dining Hall",
        dress: "Sports Attire",
        description: "Healthy evening refreshments and snack break.",
        type: "meals"
      },
      {
        time: "04:00 PM - 05:00 PM",
        duration: "60 Min",
        title: "Agriculture and Nature Activity",
        location: "LTC Farm & Experience Zone",
        dress: "Sports Attire & Shoes",
        description: "1) Farm Visit, 2) Veterinary & Livestock experience, 3) Experience Zone Visit, 4) Tractor and Agricultural Implements Tour.",
        groupTrack: "Farm Visit | Veterinary & Livestock | Tractor Tour",
        type: "academic"
      },
      {
        time: "05:00 PM - 05:15 PM",
        duration: "15 Min",
        title: "Transition",
        location: "Sports Grounds",
        dress: "Sports Attire & Shoes",
        description: "Transition to sports ground.",
        type: "rest"
      },
      {
        time: "05:15 PM - 06:30 PM",
        duration: "75 Min",
        title: "Physical Fitness Sports Activities",
        location: "Sports Grounds",
        dress: "Sports Attire & Shoes",
        description: "Traditional Indian physical fitness sports: 1. Kho-Kho, 2. Dodgeball, 3. Rumal Pani.",
        groupTrack: "1. Kho-Kho | 2. Dodgeball | 3. Rumal Pani",
        type: "fitness"
      },
      {
        time: "06:30 PM - 07:00 PM",
        duration: "30 Min",
        title: "Transition and Fresh",
        location: "Hostel Rooms",
        dress: "Casual Dress",
        description: "Freshen up, wash up, and transition to dinner hall.",
        type: "rest"
      },
      {
        time: "07:00 PM - 08:00 PM",
        duration: "60 Min",
        title: "Dinner",
        location: "Dining Hall",
        dress: "Casual Dress",
        description: "Nutritious dinner served in dining hall.",
        type: "meals"
      },
      {
        time: "08:00 PM - 08:15 PM",
        duration: "15 Min",
        title: "Transition",
        location: "Amphitheatre",
        dress: "Casual Dress",
        description: "Transition to amphitheatre for evening movie time.",
        type: "rest"
      },
      {
        time: "08:15 PM - 09:30 PM",
        duration: "75 Min",
        title: "Movie Time at Amphitheatre",
        location: "Amphitheatre",
        dress: "Casual Dress",
        description: "Inspirational movie screening and community gathering at the Open Amphitheatre.",
        type: "academic"
      },
      {
        time: "09:40 PM",
        duration: "—",
        title: "Lights Off",
        location: "Hostels",
        dress: "Night Dress",
        description: "Curfew and lights out.",
        type: "rest"
      }
    ],
    3: [
      {
        time: "06:00 AM - 07:00 AM",
        duration: "60 Min",
        title: "Getting Ready for the Day",
        location: "Hostel Rooms",
        dress: "Sports Attire",
        description: "Morning wakeup, personal hygiene, and getting ready for the day.",
        type: "rest"
      },
      {
        time: "07:00 AM - 08:00 AM",
        duration: "60 Min",
        title: "Patriotism & Nation Building",
        location: "Sports Ground & Drill Course",
        dress: "Sports Attire & Shoes",
        description: "1. Assembly & Reporting by Squad Captains, 2. National Song, 3. Light Stretching Exercise, 4. Aerobic Exercise (1 to 4), 5. Jogging & Running (1.2 Km), 6. Obstacle Training (Group 1 Briefing, Demonstration & Practice), 7. Cooling Down.",
        groupTrack: "Group 1 Obstacle Training | Briefing & Practice",
        type: "fitness"
      },
      {
        time: "08:00 AM - 08:20 AM",
        duration: "20 Min",
        title: "Transition and Dress change",
        location: "Hostel Rooms",
        dress: "Change to Yoga Dress",
        description: "Transition to hostel rooms and change into comfortable yoga dress.",
        type: "rest"
      },
      {
        time: "08:20 AM - 09:20 AM",
        duration: "60 Min",
        title: "Spirituality and Peace",
        location: "Gazebo / Sanskruti Hall",
        dress: "Yoga Dress",
        description: "Prayer & Om Chanting. Joint movement with props, A. Surya Namaskar with Mantra, B. Animal Flow and Adventure (Tree pose, Goddess asana, Flying bird jump, Duck walk, Forward-side bend with wheel, Cat & Cow variation, Half fish, Camel pose, Rabbit pose, Puppy pose, Child pose, Wind release, Crocodile pose, Shavasana - Yog Nidra, Anulom Vilom, Balloon breath, Om Chanting, Shanti Path).",
        type: "academic"
      },
      {
        time: "09:20 AM - 09:30 AM",
        duration: "10 Min",
        title: "Transition",
        location: "Campus",
        dress: "Yoga Dress",
        description: "Move to breakfast hall.",
        type: "rest"
      },
      {
        time: "09:30 AM - 10:00 AM",
        duration: "30 Min",
        title: "Breakfast",
        location: "Dining Hall",
        dress: "Yoga Dress",
        description: "Wholesome morning breakfast.",
        type: "meals"
      },
      {
        time: "10:00 AM - 10:15 AM",
        duration: "15 Min",
        title: "Transition",
        location: "Campus",
        dress: "Sports T-Shirt & Track Pants",
        description: "Transition to morning team building activity area.",
        type: "rest"
      },
      {
        time: "10:15 AM - 11:30 AM",
        duration: "75 Min",
        title: "Team Building & Leadership Activity",
        location: "Gazebo & Activity Grounds",
        dress: "Sports T-Shirt & Track Pants",
        description: "Interactive leadership activities: 1. Ball and Cup, 2. Dolphin, 3. Stacking Relay.",
        groupTrack: "1. Ball and Cup | 2. Dolphin | 3. Stacking Relay",
        type: "academic"
      },
      {
        time: "11:30 AM - 12:30 PM",
        duration: "60 Min",
        title: "Personal Hygiene – Bath and Freshening Up",
        location: "Hostel Rooms",
        dress: "Casual Dress",
        description: "Bath, personal hygiene, and freshening up in rooms.",
        type: "rest"
      },
      {
        time: "12:30 PM - 01:30 PM",
        duration: "60 Min",
        title: "Lunch",
        location: "Dining Hall",
        dress: "Casual Dress",
        description: "Wholesome midday meal served in dining hall.",
        type: "meals"
      },
      {
        time: "01:30 PM - 02:00 PM",
        duration: "30 Min",
        title: "Keep your Living Space Clean",
        location: "Hostel Rooms",
        dress: "Casual Dress",
        description: "Discipline, tidy living spaces, bed making, and room care.",
        type: "academic"
      },
      {
        time: "02:00 PM - 02:50 PM",
        duration: "50 Min",
        title: "Book Reading, Diary Writing, Resting (Mauna)",
        location: "Hostel / Reading Area",
        dress: "Casual Dress",
        description: "Quiet Mauna (reflective silence), personal diary writing, book reading, and rest.",
        type: "rest"
      },
      {
        time: "02:50 PM - 03:30 PM",
        duration: "40 Min",
        title: "Expression Activity (Drawing Sheet)",
        location: "Activity Hall / Gazebo",
        dress: "Casual Dress",
        description: "Creative student expression on drawing sheets sharing reflections, insights, and emotions.",
        type: "academic"
      },
      {
        time: "03:30 PM - 04:00 PM",
        duration: "30 Min",
        title: "Snack Break",
        location: "Dining Hall",
        dress: "Sports Attire",
        description: "Evening snack break and healthy refreshments.",
        type: "meals"
      },
      {
        time: "04:00 PM - 05:00 PM",
        duration: "60 Min",
        title: "Agriculture and Nature Activity",
        location: "LTC Polyhouse & Farm Area",
        dress: "Sports Attire & Shoes",
        description: "1) Visit to LTC Polyhouse, 2) To know the Irrigation System in Polyhouse, 3) Filling of Seedling Pro-Trays with Cocopeat in Polyhouse and sowing the seeds.",
        groupTrack: "Polyhouse Visit | Irrigation System | Seedling Sowing",
        type: "academic"
      },
      {
        time: "05:00 PM - 05:15 PM",
        duration: "15 Min",
        title: "Transition",
        location: "Sports Grounds",
        dress: "Sports Attire",
        description: "Move to grounds for sports activities.",
        type: "rest"
      },
      {
        time: "05:15 PM - 06:30 PM",
        duration: "75 Min",
        title: "Physical Fitness Sports Activities",
        location: "Sports Grounds",
        dress: "Sports Attire & Shoes",
        description: "Traditional Indian physical fitness sports: 1. Aatya Pattya, 2. Langadi, 3. Andhali Koshimbir.",
        groupTrack: "1. Aatya Pattya | 2. Langadi | 3. Andhali Koshimbir",
        type: "fitness"
      },
      {
        time: "06:30 PM - 07:00 PM",
        duration: "30 Min",
        title: "Transition and Fresh",
        location: "Hostel Rooms",
        dress: "Casual Dress",
        description: "Wash up and freshen up before dinner.",
        type: "rest"
      },
      {
        time: "07:00 PM - 08:00 PM",
        duration: "60 Min",
        title: "Dinner",
        location: "Dining Hall",
        dress: "Casual Dress",
        description: "Nutritious dinner served in dining hall.",
        type: "meals"
      },
      {
        time: "08:00 PM - 08:15 PM",
        duration: "15 Min",
        title: "Transition",
        location: "Amphitheatre",
        dress: "Casual Dress",
        description: "Transition to amphitheatre for cultural celebration.",
        type: "rest"
      },
      {
        time: "08:15 PM - 09:30 PM",
        duration: "75 Min",
        title: "Cultural Activity at Amphitheatre",
        location: "Amphitheatre",
        dress: "Casual Dress",
        description: "Vibrant cultural evening: student performances, musical talent, storytelling, and celebration.",
        type: "academic"
      },
      {
        time: "09:40 PM",
        duration: "—",
        title: "Lights Off",
        location: "Hostels",
        dress: "Night Dress",
        description: "Curfew and lights out.",
        type: "rest"
      }
    ],
    4: [
      {
        time: "06:00 AM - 07:00 AM",
        duration: "60 Min",
        title: "Getting Ready for the Day",
        location: "Hostel Rooms",
        dress: "Sports / Clean Attire",
        description: "Morning wakeup, personal hygiene, and getting ready for the final day.",
        type: "rest"
      },
      {
        time: "07:00 AM - 08:00 AM",
        duration: "60 Min",
        title: "Spirituality and Peace Session",
        location: "Gazebo / Amphitheatre",
        dress: "Clean Attire",
        description: "Prayer, Om Chanting, Wish - gratitude Tree activity, Sound healing session, Om Chanting, Shanti Path.",
        type: "academic"
      },
      {
        time: "08:00 AM - 08:15 AM",
        duration: "15 Min",
        title: "Transition",
        location: "Campus",
        dress: "Program / Formal Attire",
        description: "Transition to group photograph venue.",
        type: "rest"
      },
      {
        time: "08:15 AM - 08:35 AM",
        duration: "20 Min",
        title: "Group Photograph",
        location: "Main Campus Grounds / Monument",
        dress: "Program Attire",
        description: "Official commemorative batch group photograph with faculty, trainers, and coordinators.",
        type: "academic"
      },
      {
        time: "08:35 AM - 08:45 AM",
        duration: "10 Min",
        title: "Transition to Ground",
        location: "Sports Ground",
        dress: "Sports Attire & Shoes",
        description: "Transition to activity ground.",
        type: "rest"
      },
      {
        time: "08:45 AM - 09:30 AM",
        duration: "45 Min",
        title: "Exercise and Competition",
        location: "Sports Ground",
        dress: "Sports Attire & Shoes",
        description: "Concluding squad exercise drills, friendly challenge, and sports wrap-up.",
        type: "fitness"
      },
      {
        time: "09:30 AM - 09:40 AM",
        duration: "10 Min",
        title: "Transition",
        location: "Campus",
        dress: "Clean Attire",
        description: "Transition to breakfast hall.",
        type: "rest"
      },
      {
        time: "09:40 AM - 10:15 AM",
        duration: "35 Min",
        title: "Breakfast",
        location: "Dining Hall",
        dress: "Clean Attire",
        description: "Wholesome farewell breakfast with peers and teachers.",
        type: "meals"
      },
      {
        time: "10:15 AM - 10:25 AM",
        duration: "10 Min",
        title: "Transition",
        location: "Sanskruti Hall / Amphitheatre",
        dress: "Formal / Clean Attire",
        description: "Transition to Valedictory and Award ceremony hall.",
        type: "rest"
      },
      {
        time: "10:25 AM - 11:00 AM",
        duration: "35 Min",
        title: "Award and Certificate Distribution",
        location: "Sanskruti Hall / Amphitheatre",
        dress: "Formal / Clean Attire",
        description: "Official felicitation ceremony, squad awards, and completion certificate distribution.",
        type: "academic"
      },
      {
        time: "11:00 AM - 12:00 PM",
        duration: "60 Min",
        title: "Bath Break, Packing the Bags, and Vacate the Rooms",
        location: "Hostel Rooms",
        dress: "Travel Attire",
        description: "Bath break, packing personal belongings, room inspection, and vacating rooms.",
        type: "registration"
      },
      {
        time: "12:00 PM - 12:30 PM",
        duration: "30 Min",
        title: "Lunch",
        location: "Dining Hall",
        dress: "Travel Attire",
        description: "Nutritious farewell lunch.",
        type: "meals"
      },
      {
        time: "12:30 PM - 12:45 PM",
        duration: "15 Min",
        title: "Mobile Return",
        location: "Admin Bay / Hostels",
        dress: "Travel Attire",
        description: "Safe return and verification of student mobile phones before departure.",
        type: "registration"
      }
    ]
  }

  // Venue and dress code guidelines matching the LAP schedule
  const dressCodeRules = [
    { activity: "Arrival at LTC & Room Allotment", venue: "Reception / Hostels", dress: "Casual Dress", note: "Day 1 Arrival, bag checking & accommodation" },
    { activity: "Orientation for LAP", venue: "Orientation Hall / Gazebo", dress: "Casual Dress", note: "Day 1 Program overview and code of conduct" },
    { activity: "Patriotism & Nation Building", venue: "Sports Ground & Drill Course", dress: "Sports Attire & Shoes", note: "Morning drills, national song & obstacle course" },
    { activity: "Spirituality and Peace (Yoga & Meditation)", venue: "Gazebo / Sanskruti Hall", dress: "Yoga Dress", note: "Joint movement, Surya Namaskar, Animal Flow & Pranayam" },
    { activity: "Team Building & Leadership Activities", venue: "Gazebo & Activity Grounds", dress: "Sports T-Shirt & Track Pants", note: "Human Knot, Bridge, Dolphin & Stacking Relay" },
    { activity: "Agriculture and Nature Activities", venue: "LTC Farm & Polyhouse", dress: "Sports Attire & Shoes", note: "Farm tour, livestock, polyhouse irrigation & seedling sowing" },
    { activity: "Physical Fitness Sports Activities", venue: "Sports Grounds", dress: "Sports Attire & Shoes", note: "Traditional Indian sports: Kho-Kho, Dodgeball, Rumal Pani, Langadi & Aatya Pattya" },
    { activity: "Book Reading & Mauna (Silence)", venue: "Hostel / Reading Area", dress: "Casual Dress", note: "Quiet self-reflection, diary writing & resting" },
    { activity: "Expression Activity (Drawing Sheet)", venue: "Activity Hall / Gazebo", dress: "Casual Dress", note: "Reflective drawing and creative self-expression" },
    { activity: "Movie Time & Cultural Celebration", venue: "Amphitheatre", dress: "Casual Dress", note: "Evening community movie and cultural showcase" },
    { activity: "Award & Certificate Distribution", venue: "Sanskruti Hall / Amphitheatre", dress: "Formal / Clean Attire", note: "Day 4 Valedictory, awards & certificates" },
    { activity: "Packing, Room Clearance & Mobile Return", venue: "Hostel Rooms & Admin Bay", dress: "Travel Attire", note: "Day 4 Room handover, mobile return & return journey" }
  ]

  // Day theme accents matching the schedule days
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
      tag: 'Day 2 — Patriotism, Yoga & Team Building',
      accentColor: '#047857',
      bgLight: '#f0fdf4',
      borderColor: '#bbf7d0'
    },
    3: {
      badgeBg: '#4338ca',
      badgeText: '#ffffff',
      tag: 'Day 3 — Sports, Polyhouse & Cultural Night',
      accentColor: '#4338ca',
      bgLight: '#f5f3ff',
      borderColor: '#ddd6fe'
    },
    4: {
      badgeBg: '#0284c7',
      badgeText: '#ffffff',
      tag: 'Day 4 — Awards, Certificates & Departure',
      accentColor: '#0284c7',
      bgLight: '#f0f9ff',
      borderColor: '#bae6fd'
    }
  }

  // Official Wellness Retreat Schedule matching MSc_Yoga_LTC_Visit_Tentative_Plan_Nov_2026-5.pdf
  // (Yoga Academic and Wellness Retreat at LTC, 2–3 November 2026)
  const wellnessDetailedSchedule = {
    1: [
      {
        time: "02:00 PM - 05:00 PM",
        duration: "180 Min",
        title: "Depart from MIT-WPU Campus and Travel to LTC",
        location: "MIT-WPU Campus to LTC Boribel",
        dress: "Travel / Casual Dress",
        description: "Departure for 19 participants (15 M.Sc. Yoga students & 4 faculty members) from MIT-WPU campus to LTC Boribel via Tempo Traveller / bus.",
        groupTrack: "19 Participants (15 M.Sc. Yoga + 4 Faculty) | Tempo Traveller / Bus",
        type: "registration"
      },
      {
        time: "05:00 PM - 07:00 PM",
        duration: "120 Min",
        title: "Arrival, Check-in & Rest; Visit to LTC Gazebos",
        location: "LTC Reception / Hostels / Gazebos",
        dress: "Casual Dress",
        description: "Arrival at Life Transformation Centre (LTC), room allotment and accommodation, settling in, and a brief visit to LTC gazebos.",
        groupTrack: "Accommodation & Room Allotment",
        type: "registration"
      },
      {
        time: "07:00 PM - 08:30 PM",
        duration: "90 Min",
        title: "Light Digestible Dinner & Rest",
        location: "Dining Hall",
        dress: "Casual Dress",
        description: "Light, easily digestible dinner with limited chilli and spices (dalia suitable for Shatkarma digestive preparation) followed by rest.",
        groupTrack: "Satvik Dalia (Limited chilli & spices)",
        type: "meals"
      },
      {
        time: "08:30 PM - 09:30 PM",
        duration: "60 Min",
        title: "Trataka Practice & Mantra Yoga Chanting",
        location: "Gazebo / Sanskruti Hall",
        dress: "Yoga Dress",
        description: "Trataka practice (8:30–9:00 p.m.) Shatkarma cleansing practice that develops concentration and prepares the mind for meditation, followed by Mantra Yoga / mantra chanting (9:00–9:30 p.m.). Led by Dr. Ganesh Prasad.",
        groupTrack: "Led by Dr. Ganesh Prasad | Candles & ~10 Yoga blocks",
        type: "academic"
      },
      {
        time: "10:00 PM",
        duration: "—",
        title: "Rest & Lights Off",
        location: "Hostels",
        dress: "Night Dress",
        description: "Night rest and lights off to prepare for early morning Shankhaprakshalana.",
        type: "rest"
      }
    ],
    2: [
      {
        time: "06:00 AM - 10:00 AM",
        duration: "240 Min",
        title: "Shankhaprakshalana (Yoga Cleansing of Digestive System)",
        location: "Practice Area & Lawns",
        dress: "Comfortable Yoga Dress",
        description: "Shankhaprakshalana (Master Yoga Cleansing of the Digestive System). Guided Shatkarma detox session under expert supervision.",
        groupTrack: "Led by Dr. Ganesh Prasad | 40–50 L lukewarm water, 1 kg lemons & 1 kg white salt",
        type: "academic"
      },
      {
        time: "10:00 AM - 11:00 AM",
        duration: "60 Min",
        title: "Post-Practice Breakfast & Rest",
        location: "Dining Hall",
        dress: "Casual Dress",
        description: "Post-cleansing nutritious breakfast: Soft khichdi with a little ghee and two bananas per participant; green tea and a little jaggery, followed by rest.",
        groupTrack: "Soft khichdi with ghee, 2 bananas, green tea & jaggery",
        type: "meals"
      },
      {
        time: "11:00 AM - 12:00 PM",
        duration: "60 Min",
        title: "Introduction to Sound Healing with Singing Bowls",
        location: "Sanskruti Hall",
        dress: "Yoga / Clean Attire",
        description: "Foundational theory, acoustic frequencies, vibrational healing, and introduction to Sound Healing using singing bowls.",
        groupTrack: "Led by Divya Ma'am | Tibetan Singing Bowls",
        type: "academic"
      },
      {
        time: "12:00 PM - 01:00 PM",
        duration: "60 Min",
        title: "Sound Bowl Meditation: Learning, Practice and Teaching",
        location: "Sanskruti Hall",
        dress: "Yoga / Clean Attire",
        description: "Immersive Sound Bowl Meditation: experiential learning, deep meditation practice, resonance, and teaching methodology.",
        groupTrack: "Led by Divya Ma'am | Sound Bowl Meditation",
        type: "academic"
      },
      {
        time: "01:00 PM - 02:00 PM",
        duration: "60 Min",
        title: "Light Satvik Lunch & Rest",
        location: "Dining Hall",
        dress: "Casual Dress",
        description: "Light digestible satvik lunch: Dal, one vegetable, roti, rice and fresh salad, with a little ghee, followed by rest.",
        groupTrack: "Satvik Diet: Dal, vegetable, roti, rice, salad & ghee",
        type: "meals"
      },
      {
        time: "02:00 PM - 03:00 PM",
        duration: "60 Min",
        title: "Further Sound Bowl Meditation: Training & Pedagogy",
        location: "Sanskruti Hall",
        dress: "Yoga / Clean Attire",
        description: "Further Sound Bowl Meditation: advanced clinical techniques, practical demonstration, student teacher training, and pedagogy.",
        groupTrack: "Led by Divya Ma'am | Sound Bowl Training & Pedagogy",
        type: "academic"
      },
      {
        time: "03:00 PM - 03:30 PM",
        duration: "30 Min",
        title: "Green Tea, Light Refreshments & Prepare for Departure",
        location: "Dining Hall / Hostels",
        dress: "Travel Attire",
        description: "Green tea and light refreshments, gathering personal belongings, and preparing for departure.",
        groupTrack: "Light Refreshments & Green Tea",
        type: "meals"
      },
      {
        time: "03:30 PM",
        duration: "—",
        title: "Depart from LTC for MIT-WPU Campus",
        location: "LTC Transport Bay",
        dress: "Travel Attire",
        description: "Concluding group departure from LTC Boribel back to MIT-WPU campus.",
        groupTrack: "Return Transport to MIT-WPU Campus",
        type: "registration"
      }
    ]
  }

  // Venue and dress code guidelines matching the Wellness Retreat schedule
  const wellnessDressCodeRules = [
    { activity: "Depart from MIT-WPU & Travel to LTC", venue: "Transit / Tempo Traveller", dress: "Travel / Casual Dress", note: "Day 1 Transport for 19 participants (15 M.Sc. Yoga + 4 faculty)" },
    { activity: "Arrival, Check-in & Gazebos Visit", venue: "Reception / Hostels / Gazebos", dress: "Casual Dress", note: "Accommodation allotment & orientation walk" },
    { activity: "Light Digestible Dinner & Rest", venue: "Dining Hall", dress: "Casual Dress", note: "Satvik dalia without heavy chilli or spices" },
    { activity: "Trataka Practice & Mantra Yoga Chanting", venue: "Gazebo / Sanskruti Hall", dress: "Yoga Dress", note: "Led by Dr. Ganesh Prasad (Candles & ~10 Yoga blocks)" },
    { activity: "Shankhaprakshalana (Digestive Cleansing)", venue: "Practice Area & Lawns", dress: "Comfortable Yoga Dress", note: "Shatkarma detox with lukewarm salt & lemon water" },
    { activity: "Post-Practice Breakfast & Satvik Meals", venue: "Dining Hall", dress: "Casual Dress", note: "Soft khichdi with ghee, bananas, green tea & light lunch" },
    { activity: "Sound Healing & Sound Bowl Meditation", venue: "Sanskruti Hall", dress: "Yoga / Clean Attire", note: "Led by Divya Ma'am (Singing bowls practice & pedagogy)" },
    { activity: "Departure Preparation & Return Journey", venue: "Transport Bay & Hostels", dress: "Travel Attire", note: "Return journey from LTC Boribel to MIT-WPU" }
  ]

  // Day theme accents for Wellness Retreat
  const wellnessDayMeta = {
    1: {
      badgeBg: '#047857',
      badgeText: '#ffffff',
      tag: 'Day 1 (2 Nov 2026) — Arrival, Dalia Dinner, Trataka & Mantra Yoga',
      accentColor: '#047857',
      bgLight: '#f0fdf4',
      borderColor: '#bbf7d0',
      dateLabel: '2 Nov 2026'
    },
    2: {
      badgeBg: '#0284c7',
      badgeText: '#ffffff',
      tag: 'Day 2 (3 Nov 2026) — Shankhaprakshalana, Sound Bowl Meditation & Departure',
      accentColor: '#0284c7',
      bgLight: '#f0f9ff',
      borderColor: '#bae6fd',
      dateLabel: '3 Nov 2026'
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
    const isWellness = activeProgram === 'wellness';
    const activeDetailedSchedule = isWellness ? wellnessDetailedSchedule : detailedSchedule;
    const activeDayMeta = isWellness ? wellnessDayMeta : dayMeta;
    const availableDays = isWellness ? [1, 2] : [1, 2, 3, 4];

    const rawDayNum = parseInt(compactSelectedDay) || 1;
    const dayNum = (isWellness && rawDayNum > 2) ? 1 : rawDayNum;
    const activitiesToRender = activeDetailedSchedule[dayNum] || [];
    const currentMeta = activeDayMeta[dayNum] || activeDayMeta[1];

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
              {isWellness
                ? t("Yoga Academic & Wellness Retreat (2–3 Nov 2026)")
                : t("Residential schedule & activity agenda")}
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

        {/* Schedule Selector: Wellness Retreat Programme (Default First) | Life Awakening Schedule */}
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            onClick={() => {
              setActiveProgram('wellness');
              if (compactSelectedDay > 2) setCompactSelectedDay(1);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: activeProgram === 'wellness' ? '700' : '600',
              border: activeProgram === 'wellness' ? '1px solid #047857' : '1px solid #cbd5e1',
              cursor: 'pointer',
              background: activeProgram === 'wellness' ? '#047857' : '#ffffff',
              color: activeProgram === 'wellness' ? '#ffffff' : '#475569',
              boxShadow: activeProgram === 'wellness' ? '0 1px 3px rgba(4, 120, 87, 0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {t("Wellness Retreat Programme")}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveProgram('lap');
              if (compactSelectedDay > 4) setCompactSelectedDay(1);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: activeProgram === 'lap' ? '700' : '600',
              border: activeProgram === 'lap' ? '1px solid #154388' : '1px solid #cbd5e1',
              cursor: 'pointer',
              background: activeProgram === 'lap' ? '#154388' : '#ffffff',
              color: activeProgram === 'lap' ? '#ffffff' : '#475569',
              boxShadow: activeProgram === 'lap' ? '0 1px 3px rgba(21, 67, 136, 0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {t("Life Awakening Schedule")}
          </button>
        </div>

        {/* Day Segmented Selector */}
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
            {availableDays.map((val) => {
              const isSel = dayNum === val;
              const meta = activeDayMeta[val] || activeDayMeta[1];
              const label = isWellness ? (val === 1 ? 'Day 1 (2 Nov)' : 'Day 2 (3 Nov)') : t(`Day ${val}`);
              return (
                <button
                  key={val}
                  type="button"
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
                  {label}
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
  const isWellness = activeProgram === 'wellness';
  const activeDetailedSchedule = isWellness ? wellnessDetailedSchedule : detailedSchedule;
  const activeDayMeta = isWellness ? wellnessDayMeta : dayMeta;
  const activeDressCodeRules = isWellness ? wellnessDressCodeRules : dressCodeRules;
  const effectiveSelectedDay = (isWellness && selectedDay > 2) ? 1 : selectedDay;
  const currentMeta = activeDayMeta[effectiveSelectedDay] || activeDayMeta[1];

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
            {isWellness
              ? t("Yoga Academic and Wellness Retreat at LTC (2–3 November 2026)")
              : t("Official residential schedule, timings, venues, and dress codes")}
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

      {/* Program Switcher Tabs: Life Awakening Schedule | Wellness Retreat Programme */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: '#f8fafc',
        padding: '10px 14px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setActiveProgram('wellness');
              if (selectedDay > 2) setSelectedDay(1);
            }}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: activeProgram === 'wellness' ? '700' : '600',
              border: activeProgram === 'wellness' ? '1px solid #047857' : '1px solid #cbd5e1',
              cursor: 'pointer',
              background: activeProgram === 'wellness' ? '#047857' : '#ffffff',
              color: activeProgram === 'wellness' ? '#ffffff' : '#334155',
              boxShadow: activeProgram === 'wellness' ? '0 1px 3px rgba(4, 120, 87, 0.25)' : 'none',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px'
            }}
          >
            <span>{t("Wellness Retreat Programme")}</span>
            <span style={{
              fontSize: '11px',
              padding: '2px 7px',
              borderRadius: '10px',
              background: activeProgram === 'wellness' ? 'rgba(255,255,255,0.2)' : '#dcfce7',
              color: activeProgram === 'wellness' ? '#ffffff' : '#047857',
              fontWeight: '700'
            }}>
              2–3 Nov 2026
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveProgram('lap');
              if (selectedDay > 4) setSelectedDay(1);
            }}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: activeProgram === 'lap' ? '700' : '600',
              border: activeProgram === 'lap' ? '1px solid #154388' : '1px solid #cbd5e1',
              cursor: 'pointer',
              background: activeProgram === 'lap' ? '#154388' : '#ffffff',
              color: activeProgram === 'lap' ? '#ffffff' : '#334155',
              boxShadow: activeProgram === 'lap' ? '0 1px 3px rgba(21, 67, 136, 0.25)' : 'none',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px'
            }}
          >
            <span>{t("Life Awakening Schedule")}</span>
            <span style={{
              fontSize: '11px',
              padding: '2px 7px',
              borderRadius: '10px',
              background: activeProgram === 'lap' ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
              color: activeProgram === 'lap' ? '#ffffff' : '#475569',
              fontWeight: '700'
            }}>
              4 Days
            </span>
          </button>
        </div>

        {activeProgram === 'wellness' ? (
          <div style={{ fontSize: '12px', color: '#047857', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>15 M.Sc. Yoga Students & 4 Faculty Members · LTC Boribel</span>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
            <span>Standard 4-Day Immersion Plan</span>
          </div>
        )}
      </div>

      {activeSubTab === 'schedule' && (
        <>
          {/* Day selection tabs */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
            {(isWellness
              ? [
                  { day: 1, label: 'Day 1 — 2 Nov 2026' },
                  { day: 2, label: 'Day 2 — 3 Nov 2026' }
                ]
              : [
                  { day: 1, label: 'Day 1' },
                  { day: 2, label: 'Day 2' },
                  { day: 3, label: 'Day 3' },
                  { day: 4, label: 'Day 4' }
                ]
            ).map(({ day, label }) => {
              const isSel = effectiveSelectedDay === day;
              const meta = activeDayMeta[day] || activeDayMeta[1];
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    border: `1px solid ${isSel ? meta.accentColor : '#e2e8f0'}`,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    background: isSel ? meta.accentColor : '#ffffff',
                    color: isSel ? '#ffffff' : '#475569',
                    boxShadow: 'none'
                  }}
                >
                  {t(label)}
                </button>
              );
            })}
          </div>

          {/* Active Day Banner */}
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
                background: currentMeta.accentColor,
                color: '#ffffff',
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '800',
                letterSpacing: '0.4px',
                textTransform: 'uppercase'
              }}>
                Day {effectiveSelectedDay} {isWellness && (effectiveSelectedDay === 1 ? '· 2 Nov' : '· 3 Nov')}
              </span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                {currentMeta.tag}
              </span>
            </div>
            <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '600' }}>
              {activeDetailedSchedule[effectiveSelectedDay]?.length || 0} {t("scheduled sessions")}
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
            {activeDetailedSchedule[effectiveSelectedDay]?.map((activity, idx) => {
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

          {/* Footnote */}
          {!isWellness && (
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
          )}
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
                {activeDressCodeRules.map((rule, index) => (
                  <tr 
                    key={index} 
                    style={{ 
                      borderBottom: index < activeDressCodeRules.length - 1 ? '1px solid #f1f5f9' : 'none', 
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
