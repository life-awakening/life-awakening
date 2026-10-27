import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Users, BarChart3, Globe, Leaf, Dumbbell, Flag, Sparkles, Heart, Compass, Sun } from 'lucide-react'
import ScrollToTop from './ScrollToTop'

export default function About() {
  const [activeCard, setActiveCard] = useState(1);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const whyLtcData = [
    {
      id: 1,
      title: "Holistic Integration of Five Core Pillars",
      desc: "Unlike conventional programs that often focus on isolated skill sets, LTC seamlessly integrates its five pillars. This interconnected approach fosters well-rounded individuals who understand the synergy between physical well-being, civic responsibility, collaborative spirit, inner peace, and a connection to the land."
    },
    {
      id: 2,
      title: "Immersive and Experiential Learning",
      desc: "LTC goes beyond theoretical knowledge. Participants actively engage in hands-on experiences across all five pillars, leading to deeper understanding, practical skill development, and lasting impact. This 'learning by doing' approach fosters a more profound and internalized transformation."
    },
    {
      id: 3,
      title: "Focus on Personal Transformation",
      desc: "The core objective at LTC is not just education, but genuine personal transformation. The meticulously crafted environment and activities encourage self-reflection, inner growth, and the development of a purpose-driven life."
    },
    {
      id: 4,
      title: "Emphasis on Foundational Indian Values",
      desc: "Rooted in the rich cultural heritage of Bharat, LTC instils values of patriotism, community service, ethical leadership, and spiritual awareness. This grounding in traditional wisdom provides a strong moral compass for navigating the complexities of modern life."
    },
    {
      id: 5,
      title: "Cultivating Real-World Skills and a Grounded Lifestyle",
      desc: "LTC equips youth with practical skills, particularly in agriculture and physical fitness, alongside leadership and teamwork abilities. This focus on tangible skills and a connection to the land fosters a sense of self-reliance and a lifestyle rooted in the realities of Bharat."
    },
    {
      id: 6,
      title: "Nurturing Responsible and Empathetic Leaders",
      desc: "LTC aims to cultivate leaders who are not only competent but also deeply empathetic, responsible, and committed to the well-being of their communities and the nation. The emphasis on seva (selfless service) distinguishes its leadership development approach."
    }
  ];

  return (
    <>
      <div className="animate-fade-in" style={{ fontFamily: '"Inter", sans-serif', background: '#f8fafc' }}>
        
        {/* INJECTED CSS */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          
          .premium-card {
            position: relative;
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .premium-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1) !important;
          }
          .gradient-text-gold {
            background: linear-gradient(135deg, #e59a2a 0%, #3b82f6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .gradient-text-blue {
            background: linear-gradient(135deg, #2b76b9 0%, #34a8f3 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .animated-pill {
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
          }
          .animated-pill:hover {
            transform: translateY(-3px);
          }
          
          .why-card {
            background: white;
            border-radius: 16px;
            padding: 24px;
            border: 1px solid #e2e8f0;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .why-card.active {
            background: #0f172a;
            color: white;
            border-color: #0f172a;
          }
          .why-card.active h4 {
            color: #3b82f6;
          }
          
          @media (max-width: 768px) {
            .responsive-grid {
              grid-template-columns: 1fr !important;
              gap: 30px !important;
            }
            .reverse-mobile {
              flex-direction: column-reverse !important;
            }
          }
        `}</style>

        {/* Hero Section (Carousel or Banner) */}
        <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
          <img src="/newimages/banner-slide1.jpeg" alt="Hero Background" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/1920x800?text=About+Us'; }} />
        </div>

        {/* Quote Section */}
        <div style={{ background: 'white', padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
            <p style={{ color: '#1d4ed8', fontSize: '24px', fontWeight: '700', fontStyle: 'italic', lineHeight: '1.6', marginBottom: '15px' }}>
              “You know but little of that which is within you. For behind you, are the oceans of infinite power and blessedness.”
            </p>
            <p style={{ color: '#64748b', fontSize: '16px', fontWeight: '600' }}>— Swami Vivekananda</p>
          </div>
        </div>

        {/* What is LTC */}
        <div id="What-is-LTC" style={{ padding: '100px 20px', background: '#f8fafc' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Overview</span>
                <h2 style={{ fontSize: '36px', fontWeight: '800', color: '#0f172a', margin: '10px 0 20px' }}>What is LTC?</h2>
                <div style={{ width: '40px', height: '3px', background: '#3b82f6', marginBottom: '30px' }}></div>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  The Life Awakening Program (LTC) is a 5-day immersive, residential program rooted in self-discovery, inner awakening, and holistic growth. Set within a 500-acre natural sanctuary, it offers a rare opportunity to disconnect from daily distractions and reconnect with the essence of who you are mind, body, and spirit.
                </p>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  Blending ancient wisdom with modern insights, LTC inspires transformation through nature, community, and experiential learning.
                </p>
                <p style={{ color: '#1d4ed8', fontSize: '16px', fontWeight: '600', lineHeight: '1.8', textAlign: 'justify' }}>
                  Guided by the mantra “Connecting the Soil to the Soul”, LTC is where youth meets wisdom, and life is not just lived but truly met.
                </p>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ width: '100%' }}>
                  <img src="/newimages/campus-about-new.jpg" alt="What is LTC" style={{ width: '100%', height: 'auto', display: 'block' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400?text=What+is+LTC'; }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Why LTC */}
        <div id="Why-LTC" style={{ padding: '100px 20px', background: '#0a0f1d', color: 'white' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Purpose</span>
              <h2 style={{ fontSize: '36px', fontWeight: '800', color: 'white', margin: '10px 0' }}>Why LTC?</h2>
              <p style={{ color: '#94a3b8', fontSize: '16px' }}>Click on a card to read more about each point.</p>
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 2.5fr', gap: '40px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {whyLtcData.map(item => (
                  <div 
                    key={item.id} 
                    className={`why-card ${activeCard === item.id ? 'active' : ''}`}
                    onClick={() => setActiveCard(item.id)}
                    style={{ 
                      background: activeCard === item.id ? '#2563eb' : 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white'
                    }}
                  >
                    <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'white', marginBottom: 0 }}>{item.title}</h4>
                  </div>
                ))}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '24px', padding: '40px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#3b82f6', marginBottom: '20px' }}>{whyLtcData.find(i => i.id === activeCard)?.title}</h3>
                <p style={{ color: '#cbd5e1', fontSize: '16px', lineHeight: '1.8', textAlign: 'justify' }}>{whyLtcData.find(i => i.id === activeCard)?.desc}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Root at MIT-WPU */}
        <div id="Root-at-MIT-WPU" style={{ padding: '100px 20px', background: 'white' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
              <div className="reverse-mobile" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '100%' }}>
                  <img src="/newimages/Root-At-MIT-WPU.png" alt="Root at MIT-WPU" style={{ width: '100%', height: 'auto', display: 'block' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400?text=MIT-WPU'; }} />
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Legacy</span>
                <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '10px 0 20px' }}>The Vision that took Root at MIT-WPU</h2>
                <div style={{ width: '40px', height: '3px', background: '#3b82f6', marginBottom: '30px' }}></div>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  The idea of LTC was born at MIT World Peace University, shaped by the compassion of Late Smt. Urmilatai Karad and brought to life by Dr. Rahul V. Karad. What started as a vision has become a living, breathing sanctuary where today’s youth reconnect with timeless Indian values and discover a deeper sense of purpose.
                </p>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', textAlign: 'justify' }}>
                  More than just a program, LTC is now a growing movement nurturing grounded, awakened, and inspired young changemakers.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Philosophy */}
        <div id="Philosophy-Soil-to-Soul" style={{ padding: '100px 20px', background: '#f8fafc' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Mantra</span>
                <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '10px 0 20px' }}>Our Guiding Philosophy</h2>
                <div style={{ width: '40px', height: '3px', background: '#3b82f6', marginBottom: '30px' }}></div>
                <p style={{ color: '#1d4ed8', fontSize: '18px', fontWeight: '700', marginBottom: '15px' }}>“Connecting the Soil to the Soul”</p>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  At LTC, this philosophy reflects the sacred bond between body, land, and spirit. By engaging with nature, tradition, and community, participants return to simplicity, cultivate stillness, and rediscover what truly matters. The soil becomes a teacher, silence a guide, and service a scripture shaping a way of learning that is lived, not just studied.
                </p>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', textAlign: 'justify' }}>
                  Blending ancient Bharatiya wisdom with modern aspirations, LTC nurtures resilience, empathy, and purpose in young minds. It is a journey where ambition balances with inner peace, leadership is rooted in service, and the self awakens to its dharma connecting the soil to the soul in its truest sense.
                </p>
              </div>
              <div>
                <div style={{ width: '100%' }}>
                  <img src="/newimages/Our-Guiding-Philosophy.png" alt="Philosophy" style={{ width: '100%', height: 'auto', display: 'block' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400?text=Philosophy'; }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sacred Yajna */}
        <div id="The-Sacred-Yajna" style={{ padding: '100px 20px', background: 'white' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
              <div className="reverse-mobile" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '100%' }}>
                  <img src="/newimages/Sacred-Yajna.png" alt="Sacred Yajna" style={{ width: '100%', height: 'auto', display: 'block' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400?text=Sacred+Yajna'; }} />
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Tradition</span>
                <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '10px 0 20px' }}>A Sacred Yajña of Inner Growth</h2>
                <div style={{ width: '40px', height: '3px', background: '#3b82f6', marginBottom: '30px' }}></div>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  Rooted in India’s spiritual traditions, LTC brings together the wisdom of the Gītā and Gandhi, the practice of Yoga with the energy of Youth, and the values of Dharma with the strength of Discipline. It creates a living ecosystem that helps ignite samyak dīpah, the inner light of consciousness.
                </p>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  Every experience at LTC cultivates:
                </p>
                <ul style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', paddingLeft: '20px' }}>
                  <li>Self-awareness and emotional balance</li>
                  <li>Discipline and resilience</li>
                  <li>Purposeful leadership and national pride</li>
                  <li>Spiritual clarity and ecological sensitivity</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Anubhavamrta Sevita */}
        <div id="Anubhavamrta-Sevita" style={{ padding: '100px 20px', background: '#f8fafc' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Experience</span>
                <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '10px 0 20px' }}>Anubhavāmṛta Sevita</h2>
                <div style={{ width: '40px', height: '3px', background: '#3b82f6', marginBottom: '30px' }}></div>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  LTC is a sacred ecosystem where the soil teaches, silence guides, and service becomes scripture. Inspired by Sant Dnyaneshwar’s Amrutanubhav, LTC is not an institution it is a living space of awakening.
                </p>
                <ul style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', paddingLeft: '20px' }}>
                  <li>Nature as Teacher: the sky, the soil, the stillness</li>
                  <li>Wisdom in Action: seva, rituals, and karma yoga</li>
                  <li>Living Mindfully: education that transforms being, not just knowing</li>
                  <li>Rooted Modernity: blending ancient values with contemporary life</li>
                  <li>Cultural Reconnection: rediscovering Bharat’s timeless soul</li>
                </ul>
              </div>
              <div>
                <div style={{ width: '100%' }}>
                  <img src="/newimages/Anubhavamrta-Sevita.png" alt="Anubhavamrta Sevita" style={{ width: '100%', height: 'auto', display: 'block' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400?text=Anubhavamrta+Sevita'; }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rooted in Bharat */}
        <div id="Rooted-in-Bharat" style={{ padding: '100px 20px', background: 'white' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
              <div className="reverse-mobile" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '100%' }}>
                  <img src="/newimages/Bharat-Timeless-Spirit.png" alt="Rooted in Bharat" style={{ width: '100%', height: 'auto', display: 'block' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400?text=Bharat'; }} />
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Identity</span>
                <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '10px 0 20px' }}>Rooted in Bharat's Timeless Spirit</h2>
                <div style={{ width: '40px', height: '3px', background: '#3b82f6', marginBottom: '30px' }}></div>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  LTC isn’t just built on land it’s built on the legacy of Bhartiya values and Vedic wisdom. Inspired by India’s ancient vision of holistic living, it weaves together agriculture, fitness, patriotism, leadership, and spirituality into a transformative journey for today’s youth.
                </p>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', textAlign: 'justify' }}>
                  Here, young minds rediscover their Dharma, reclaim their identity, and rise not as passive learners but as conscious citizens of Bharat.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Birth of a Movement */}
        <div id="The-Birth-of-Movement" style={{ padding: '80px 20px', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)', color: 'white', textAlign: 'center' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Origin</span>
            <h2 style={{ fontSize: '32px', fontWeight: '800', color: 'white', margin: '10px 0 20px' }}>The Birth of a Movement</h2>
            <p style={{ color: '#cbd5e1', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
              The Life Awakening Program (LTC) is the vision of Dr. Rahul V. Karad, born from his belief that true nation-building begins with the youth. Drawing from his father Prof. Dr. Vishwanath D. Karad’s sanskar and his own pioneering initiatives like the MIT School of Government and Bharatiya Chhatra Sansad, Dr. Karad recognized the need for education that goes beyond careers to nurture self-realization, resilience, and holistic growth.
            </p>
            <p style={{ color: '#cbd5e1', fontSize: '16px', lineHeight: '1.8', textAlign: 'justify' }}>
              The Life Awakening Program (LAP) at LTC embodies this mission, a first-of-its-kind immersive experience where young minds reconnect with nature, discipline, and purpose. More than an educational initiative, it is a living movement to shape conscious, compassionate, and responsible citizens of Bharat.
            </p>
          </div>
        </div>

        {/* Logo Journey */}
        <div id="Logo-Design-Journey" style={{ padding: '100px 20px', background: 'white' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Symbolism</span>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '10px 0' }}>Logo Design Journey</h2>
            </div>
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '60px', alignItems: 'center' }}>
              <div>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  The LTC logo was envisioned as a symbol of connection, unity, strength, and evolution, reflecting a journey guided by purpose and light. Rooted in strength and uplifted by guidance, the coming together of hands represents collective growth, mutual support, and the power of togetherness.
                </p>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  The color palette reinforces this philosophy. Shades of blue symbolize trust, discipline, stability, and guidance. Orange represents energy, courage, patriotism, and spiritual awakening, echoing Bharat’s spirit and the inner fire that drives transformation.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                <img src="/newimages/ltc-logo-big.png" alt="LTC Logo" style={{ maxWidth: '200px' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/200?text=Logo'; }} />
                <img src="/newimages/ltc-logo-design-journey.png" alt="Logo Journey" style={{ width: '100%', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/400x200?text=Journey'; }} />
              </div>
            </div>
          </div>
        </div>

        {/* NEP 2020 */}
        <div id="NEP-2020" style={{ padding: '100px 20px', background: '#f8fafc' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Alignment</span>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '10px 0' }}>Bringing NEP 2020 to Life</h2>
              <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '800px', margin: '0 auto' }}>The National Education Policy 2020 calls for education that’s holistic, experiential, value-based, and rooted in real-world skills and LTC answers that call with clarity and conviction.</p>
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
              <div>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '15px' }}>At LTC, learning transcends classrooms. Students grow through soil on their hands, sweat on their brows, and reflection in silence.</p>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '15px' }}>From sustainable agriculture and traditional sports to ethical leadership, team-building, and spiritual balance, every experience aligns with NEP's vision of building not just professionals but purpose driven citizens.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  "Multidisciplinary, hands-on learning",
                  "Environmental responsibility through real farming",
                  "Critical thinking and problem-solving",
                  "Citizenship, leadership & national pride",
                  "Mindfulness through yoga, silence, and spirituality"
                ].map((text, idx) => (
                  <div key={idx} style={{ background: 'white', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', fontWeight: '600', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%' }}></div>
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Infrastructure Image */}
        <div style={{ width: '100%', height: 'auto', overflow: 'hidden' }}>
          <img src="/newimages/life-transformation-centre.png" alt="LTC Infrastructure" style={{ width: '100%', height: 'auto' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/1920x600?text=Infrastructure'; }} />
        </div>

        {/* Footer */}
        <footer className="premium-footer" style={{ background: '#000', color: 'white', padding: '60px 40px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '30px 30px', opacity: 0.5 }}></div>
          <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
              <div>
                <img src="/ltc.png" alt="LTC Logo" style={{ height: '50px', objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', gap: '20px', color: '#94a3b8' }}>
                <Globe size={20} style={{ cursor: 'pointer' }} />
                <span style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>FB</span>
                <span style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>IG</span>
                <span style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>X</span>
                <span style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>YT</span>
                <span style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>IN</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '40px' }}>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>About Us</h4>
                <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '2' }}>
                  <li style={{ cursor: 'pointer' }}>What is LTC</li>
                  <li style={{ cursor: 'pointer' }}>Roots at MIT-WPU</li>
                  <li style={{ cursor: 'pointer' }}>Philosophy: Soil to Soul</li>
                  <li style={{ cursor: 'pointer' }}>The Sacred Yajña</li>
                  <li style={{ cursor: 'pointer' }}>What Makes LTC Unique</li>
                  <li style={{ cursor: 'pointer' }}>Anubhavāmṛta Sevita</li>
                  <li style={{ cursor: 'pointer' }}>Rooted in Bharat</li>
                  <li style={{ cursor: 'pointer' }}>The Birth of a Movement</li>
                  <li style={{ cursor: 'pointer' }}>NEP 2020</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>Program</h4>
                <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '2' }}>
                  <li style={{ cursor: 'pointer' }}><Link to="/programs#What-is-LAP">What is LAP</Link></li>
                  <li style={{ cursor: 'pointer' }}>Program Pedagogy</li>
                  <li style={{ cursor: 'pointer' }}>Experiential Learning</li>
                  <li style={{ cursor: 'pointer' }}>Code of Conduct</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>Five Pillars</h4>
                <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '2' }}>
                  <li style={{ cursor: 'pointer' }}>Agriculture & Nature</li>
                  <li style={{ cursor: 'pointer' }}>Physical Fitness & Sports</li>
                  <li style={{ cursor: 'pointer' }}>Team Building & Leadership</li>
                  <li style={{ cursor: 'pointer' }}>Patriotism & Nation Building</li>
                  <li style={{ cursor: 'pointer' }}>Spirituality & Peace</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>Campus</h4>
                <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '2' }}>
                  <li style={{ cursor: 'pointer' }}>Learning & Reflection Spaces</li>
                  <li style={{ cursor: 'pointer' }}>Spaces for Inner & Outer Growth</li>
                  <li style={{ cursor: 'pointer' }}>Living & Wellness Facilities</li>
                  <li style={{ cursor: 'pointer' }}>Map Zone 2</li>
                </ul>
              </div>
              <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>Newsletter Signup</h4>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '15px', lineHeight: '1.6' }}>By subscribing to our mailing list you will always be updated with the latest news from us.</p>
                <div style={{ display: 'flex', background: 'white', borderRadius: '4px', overflow: 'hidden' }}>
                  <input type="email" placeholder="Enter your Email" style={{ flex: 1, padding: '10px 15px', border: 'none', outline: 'none', color: '#000', fontSize: '14px' }} />
                  <button style={{ background: '#000', border: 'none', padding: '0 15px', cursor: 'pointer', color: '#fff' }}>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '40px', paddingTop: '20px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
              &copy; {new Date().getFullYear()} Life Awakening Program. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
      <ScrollToTop />
    </>
  )
}
