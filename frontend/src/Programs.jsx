import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Users, BarChart3, Globe, Leaf, Dumbbell, Flag, Sparkles, Heart, Compass, Sun, Shield, Award } from 'lucide-react'
import ScrollToTop from './ScrollToTop'

export default function Programs() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const featureCards = [
    {
      title: "Cultivating Holistic Transformation",
      desc: "LTC integrates workshops, hands-on activities, reflection, and community engagement to build physical, mental, emotional, and spiritual well-being step by step."
    },
    {
      title: "Deep Immersion For Focused Engagement",
      desc: "Intensive programs minimize distractions and create space for deep absorption. Participants engage fully and achieve breakthroughs across health, skills, values, leadership, and spirituality."
    },
    {
      title: "Personalized Guidance For Individual Journeys",
      desc: "Each participant receives tailored support and progresses at their own pace. This guidance nurtures personal needs and unlocks individual potential."
    },
    {
      title: "Experiential Learning Through Active Participation",
      desc: "LTC emphasizes learning by doing, combining practical application with hands-on experiences. Participants gain tangible skills through direct engagement."
    },
    {
      title: "Community Building For Shared Growth And Support",
      desc: "Programs nurture a strong sense of community where participants collaborate, exchange ideas openly, and draw mutual motivation, strengthening both individual and collective growth."
    },
    {
      title: "Dedicated Reflection And Meaningful Integration",
      desc: "Ample time for reflection allows participants to process experiences, internalize learning, and consciously apply insights to their mindset and daily lives."
    },
    {
      title: "Continuous Feedback And Empowering Assessment",
      desc: "Regular feedback and thoughtful assessments give clarity on progress, highlight growth areas, and keep participants motivated through their journey."
    },
    {
      title: "Adaptive Teaching Methods For Diverse Learners",
      desc: "LTC employs diverse teaching methods to suit different learning styles. This inclusive approach ensures training stays engaging, effective, and resonates with all participants."
    }
  ];

  const masonryImages = [
    "/newimages/Agriculture.jpeg",
    "/newimages/Leadership-Team-Building.jpeg",
    "/newimages/Patriotism-Nation-Building.jpeg",
    "/newimages/physical-fitness.png",
    "/newimages/campus-about-new.jpg",
    "/newimages/nature.jpeg",
    "/newimages/sports_banner_2.JPG",
    "/newimages/Our-Guiding-Philosophy.png"
  ];

  return (
    <>
      <div className="animate-fade-in" style={{ fontFamily: '"Inter", sans-serif', background: '#f8fafc' }}>
        
        {/* INJECTED CSS */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          
          .feature-card {
            background: white;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
            transition: all 0.3s ease;
            height: 100%;
          }
          .feature-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.05);
            border-color: #3b82f6;
          }
          .feature-card-header {
            background: #0f172a;
            color: white;
            padding: 15px 20px;
            font-weight: 700;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .feature-card-body {
            padding: 20px;
            color: #475569;
            font-size: 14px;
            line-height: 1.6;
          }
          
          .masonry {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            grid-gap: 20px;
            grid-auto-flow: dense;
          }
          .masonry img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 12px;
            transition: all 0.3s ease;
          }
          .masonry img:hover {
            transform: scale(1.03);
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

        {/* Hero Section */}
        <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
          <video autoPlay muted loop playsInline poster="/newimages/banner-slide1.jpeg" style={{ width: '100%', height: '100%', objectFit: 'cover' }}>
            <source src="/flag-video-ltc.mp4" type="video/mp4" />
          </video>
          <div style={{ position: 'absolute', bottom: '50px', left: '50px', color: 'white', textAlign: 'left' }}>
            <h1 style={{ fontSize: isMobile ? '36px' : '56px', fontWeight: '900', marginBottom: '10px' }}>Life Awakening Program</h1>
            <h2 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: '500', color: '#cbd5e1' }}>Where the Journey Inward Begins</h2>
          </div>
        </div>

        {/* Quote Section */}
        <div style={{ background: 'white', padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
            <p style={{ color: '#1d4ed8', fontSize: '24px', fontWeight: '700', fontStyle: 'italic', lineHeight: '1.6', marginBottom: '15px' }}>
              “At LAP, Transformation isn't an idea, it's something you live, feel, and carry with you long after it ends.”
            </p>
            <p style={{ color: '#64748b', fontSize: '16px', fontWeight: '600' }}>— Life Awakening Program</p>
          </div>
        </div>

        {/* What is LAP */}
        <div id="What-is-LAP" style={{ padding: '60px 20px', background: 'white' }}>
          <div id="What-is-LRP"></div>
          <div style={{ maxWidth: '1200px', margin: '0 auto', background: '#0056b3', borderRadius: '40px', padding: '60px', color: 'white' }}>
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '36px', fontWeight: '800', color: '#3b82f6', margin: '0 0 20px' }}>What is the Life Awakening Program (LAP)?</h2>
                <p style={{ color: 'white', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  The Life Awakening Program (LAP) is a five day immersive, residential journey that invites students to pause, reflect, and realign with their deeper self, community, and purpose.
                </p>
                <p style={{ color: 'white', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  It’s not just a break from routine it’s a return to your centre.
                </p>
                <p style={{ color: 'white', fontSize: '16px', lineHeight: '1.8', textAlign: 'justify' }}>
                  Set in nature, students live simply, engage deeply, and awaken their inner clarity. Every moment from farming to meditation, from silence to play is designed to spark transformation that lasts a lifetime.
                </p>
              </div>
              <div>
                <div style={{ width: '100%', borderRadius: '24px', overflow: 'hidden' }}>
                  <img src="/newimages/programe/slide1.png" alt="What is LAP" style={{ width: '100%', height: 'auto', display: 'block' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400?text=LAP+Concept'; }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Why Choose It */}
        <div id="Why-to-choose-LAP" style={{ padding: '100px 20px', background: 'white' }}>
          <div id="Why-to-choose-LRP"></div>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
              <div className="reverse-mobile" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '100%' }}>
                  <img src="/newimages/LTC-Residential-Program.png" alt="Why Choose LAP" style={{ width: '100%', height: 'auto', display: 'block' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400?text=Why+Choose+LAP'; }} />
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Experience</span>
                <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '10px 0 20px' }}>The LTC Residential Program Why Choose It?</h2>
                <div style={{ width: '40px', height: '3px', background: '#3b82f6', marginBottom: '30px' }}></div>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  In the thought of Dr. Rahul V. Karad, simple living has a prominent place to think holistically and for the good of all. Such living is facilitated holistically through LAP. This immersive 5-day residential program provides a rare and powerful opportunity to reconnect with the essence of your being mind, body, and spirit.
                </p>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  True education is meant to draw out the latent potential within. Life Awakening Program (LTC) offers more than just a learning experience, it is a transformative journey where self discovery, adventure, and personal growth converge beyond boundaries.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pedagogy */}
        <div id="Program-Pedagogy" style={{ padding: '100px 20px', background: '#f8fafc' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '60px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Methodology</span>
                <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '10px 0 20px' }}>Program Journey & Pedagogy</h2>
                <div style={{ width: '40px', height: '3px', background: '#3b82f6', marginBottom: '30px' }}></div>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', marginBottom: '20px', textAlign: 'justify' }}>
                  At LTC, learning goes beyond classrooms it's a journey of growth and self discovery. The pedagogy blends immersive workshops, real world applications, and hands-on activities with reflection, collaboration, and spirituality. Students are encouraged to step out of their comfort zones, embrace challenges, and learn through experience.
                </p>
                <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', textAlign: 'justify' }}>
                  By integrating fitness, agriculture, teamwork, leadership, and mindfulness, LTC nurtures holistic development physically, mentally, and emotionally. This approach ensures that every challenge builds confidence, resilience, and clarity.
                </p>
              </div>
              <div>
                <div style={{ width: '100%' }}>
                  <img src="/newimages/programe/Asset-programe-page.png" alt="Pedagogy" style={{ width: '100%', height: 'auto', display: 'block' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/400x500?text=Pedagogy'; }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div style={{ padding: '100px 20px', background: 'white' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Features</span>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '10px 0' }}>What Makes LAP Unique</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px' }}>
              {featureCards.map((card, idx) => (
                <div key={idx} className="feature-card">
                  <div className="feature-card-header">{card.title}</div>
                  <div className="feature-card-body">{card.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Experiential Learning (Masonry) */}
        <div id="Experiential-Learning" style={{ padding: '100px 20px', background: '#0f172a', color: 'white' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px' }}>Gallery</span>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: 'white', margin: '10px 0' }}>Experiential Learning: Real-World Skills</h2>
              <p style={{ color: '#94a3b8', fontSize: '16px' }}>Direct experiences that shape understanding.</p>
            </div>
            <div className="masonry">
              {masonryImages.map((src, idx) => (
                <div key={idx} style={{ gridRow: idx % 3 === 0 ? 'span 2' : 'span 1' }}>
                  <img src={src} alt={`Gallery ${idx + 1}`} onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Gallery+Image'; }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Sections */}
        <div style={{ padding: '100px 20px', background: 'white', textAlign: 'center' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', marginBottom: '80px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', marginBottom: '20px' }}>Take the First Step Toward Transformation</h2>
            <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.6', marginBottom: '30px' }}>
              LAP is designed to help you pause, reflect, and unlock your full potential. Begin your journey of clarity, growth, and lasting change today.
            </p>
            <button style={{ background: '#2563eb', color: 'white', padding: '14px 32px', borderRadius: '50px', fontWeight: '600', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
              Join The Life Awakening Program <ArrowRight size={18} />
            </button>
          </div>

          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', marginBottom: '20px' }}>What We Expect from You</h2>
            <p style={{ color: '#475569', fontSize: '16px', lineHeight: '1.6', marginBottom: '30px' }}>
              We follow a value based <strong>code of conduct</strong> to ensure a safe and inspiring environment for all. We believe how we live is how we learn.
            </p>
            <button style={{ background: '#0f172a', color: 'white', padding: '14px 32px', borderRadius: '50px', fontWeight: '600', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
              Read The Full Code Of Conduct <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Footer Top Image */}
        <div style={{ width: '100%', height: 'auto', overflow: 'hidden' }}>
          <img src="/newimages/programe/programe-page-footer-top.png" alt="LTC Program Footer" style={{ width: '100%', height: 'auto' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/1920x300?text=Footer+Top'; }} />
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
                  <li style={{ cursor: 'pointer' }}><Link to="/about#What-is-LTC">What is LTC</Link></li>
                  <li style={{ cursor: 'pointer' }}><Link to="/about#Root-at-MIT-WPU">Roots at MIT-WPU</Link></li>
                  <li style={{ cursor: 'pointer' }}><Link to="/about#Philosophy-Soil-to-Soul">Philosophy: Soil to Soul</Link></li>
                  <li style={{ cursor: 'pointer' }}><Link to="/about#The-Sacred-Yajna">The Sacred Yajña</Link></li>
                  <li style={{ cursor: 'pointer' }}><Link to="/about#NEP-2020">NEP 2020</Link></li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>Program</h4>
                <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '2' }}>
                  <li style={{ cursor: 'pointer' }}><Link to="/programs#What-is-LAP">What is LAP</Link></li>
                  <li style={{ cursor: 'pointer' }}><Link to="/programs#Program-Pedagogy">Program Pedagogy</Link></li>
                  <li style={{ cursor: 'pointer' }}><Link to="/programs#Experiential-Learning">Experiential Learning</Link></li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>Five Pillars</h4>
                <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '2' }}>
                  <li style={{ cursor: 'pointer' }}><Link to="/five-pillars">Agriculture & Nature</Link></li>
                  <li style={{ cursor: 'pointer' }}><Link to="/five-pillars">Physical Fitness & Sports</Link></li>
                  <li style={{ cursor: 'pointer' }}><Link to="/five-pillars">Team Building & Leadership</Link></li>
                  <li style={{ cursor: 'pointer' }}><Link to="/five-pillars">Patriotism & Nation Building</Link></li>
                  <li style={{ cursor: 'pointer' }}><Link to="/five-pillars">Spirituality & Peace</Link></li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>Campus</h4>
                <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '2' }}>
                  <li style={{ cursor: 'pointer' }}><Link to="/campus#Learning-Reflection-Spaces">Learning & Reflection Spaces</Link></li>
                  <li style={{ cursor: 'pointer' }}><Link to="/campus#Spaces-Inner-Outer-Growth">Spaces for Inner & Outer Growth</Link></li>
                  <li style={{ cursor: 'pointer' }}><Link to="/campus#Living-Wellness-Facilities">Living & Wellness Facilities</Link></li>
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
