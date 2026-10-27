import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ScrollToTop from './ScrollToTop'
import { Globe, ArrowRight } from 'lucide-react'

export default function FivePillars() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <div className="animate-fade-in" style={{ fontFamily: '"Inter", sans-serif', background: '#f8fafc' }}>
        
        {/* INJECTED CSS FROM style.css */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@100;200;300;400;500;600;700&family=Anek+Latin:wght@400;500;600;700&display=swap');

          .white-banner {
            min-height: 60vh;
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            text-align: center;
            background: white;
          }
          .white-banner.adj-vh {
            min-height: 100vh;
          }
          .white-banner .banner-container {
            width: min(1100px, 92%);
            margin: 0 auto;
            text-align: center;  
          }
          .hero-title {
            font-family: "Anek Latin", sans-serif;
            font-weight: 800;
            font-size: 58px;
            margin: 16px 0;
          }
          .hero-pg {
            font-size: 18px;
            font-weight: 200;
            line-height: 32px;
            text-align: center;
            max-width: 80%;
          }

          .less-spacing {
            padding: 40px 0;
            background: white;
          }
          .pillars {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-wrap: nowrap;
            overflow-x: auto;
            padding: 20px 0;
            gap: 10px;
          }
          .pillar-single {
            position: relative;
            width: 240px;
            height: 350px;
            overflow: hidden;
            border-radius: 16px;
            cursor: pointer;
            flex: 0 0 auto;
            transition: transform 0.5s ease-in-out; /* More smooth */
            backface-visibility: hidden;
          }
          .pillar-single img.img-fluid {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease-in-out;
          }
          .pillar-single::before {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(0, 0, 0, 0) 44%, #000000 100%);
            opacity: 0.5;
            transition: all 0.5s ease-in-out;
            z-index: 1;
          }
          .pillar-single:hover .pillar-icon {
            position: absolute;
            bottom: -45%;
            right: 5%;
            transform: scale(1.2);
            opacity: 0.6;
          }
          .pillar-single:nth-child(1):hover::before {
            background: #66b03a; /* Agriculture */
            opacity: 1;
            box-shadow: 4px 25px 50px 0px rgba(0, 0, 0, 0.25);
          }
          .pillar-single:nth-child(2):hover::before {
            background: #d85933 !important; /* Physical Fitness */
            opacity: 1;
            box-shadow: 4px 25px 50px 0px rgba(0, 0, 0, 0.25);
          }
          .pillar-single:nth-child(3):hover::before {
            background: #3cadff; /* Team Building */
            opacity: 1;
            box-shadow: 4px 25px 50px 0px rgba(0, 0, 0, 0.25);
          }
          .pillar-single:nth-child(4):hover::before {
            background: #f19817; /* Patriotism */
            opacity: 1;
            box-shadow: 4px 25px 50px 0px rgba(0, 0, 0, 0.25);
          }
          .pillar-single:nth-child(5):hover::before {
            background: #a576ff; /* Spirituality */
            opacity: 1;
            box-shadow: 4px 25px 50px 0px rgba(0, 0, 0, 0.25);
          }
          .pillar-content {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            color: #fff;
            z-index: 2;
            width: 90%;
            transition: all 0.5s ease-in-out;
          }
          .pillar-icon {
            width: 50px;
            height: 50px;
            object-fit: contain;
            margin: 0 auto 10px;
            transition: all 0.5s ease-in-out;
          }
          .pillar-title {
            font-size: 1.5rem;
            font-weight: 700;
            margin: 0;
            color: white;
          }
          .pillar-content p {
            font-size: 0.9rem;
            margin-top: 8px;
            display: none;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.5s ease-in-out;
          }
          .pillar-single:hover::before {
            opacity: 0.85;
          }
          .pillar-single:hover img.img-fluid {
            transform: scale(1.1);
          }
          .pillar-content,
          .pillar-single:hover .pillar-content {
            text-align: center !important;
          }
          .pillar-single:hover .pillar-content {
            left: 50%;
            transform: translate(-50%, 0%) !important;
            padding: 0 10px;
          }
          .pillar-single:hover .pillar-title {
            font-size: 1.4rem;
          }
          .pillar-single:hover .pillar-content p {
            display: block;
            opacity: 1;
            transform: translateY(0);
            margin-bottom: 0;
          }

          .spacing {
            padding: 100px 0;
          }
          .quote-section {
            background: #f8fafc;
          }
          .devnagri {
            color: #006fe5;
            font-weight: 700;
            font-size: 24px;
            line-height: 36px;
            text-align: center !important; /* Force center */
          }
          
          @media (max-width: 768px) {
            .hero-title {
              font-size: 36px;
            }
            .hero-pg {
              font-size: 16px;
              max-width: 100%;
            }
            .pillars {
              flex-wrap: wrap;
              justify-content: center;
            }
          }

          /* Footer Styles */
          .footer {
            position: relative;
            background-color: #040404 !important;
            padding: 60px 0 80px 0;
            color: white;
          }
          .flogo {
            margin-bottom: 50px;
          }
          .fmenu-title,
          .fmenu-title a {
            font-family: "Anek Latin";
            font-weight: 600;
            color: #ffffff;
            font-size: 24px;
            margin-bottom: 20px;
            text-decoration: none;
          }
          .fmenu-ul {
            list-style: none;
            padding-left: 0;
          }
          .fmenu-ul li a,
          .fmenu-ul li {
            color: #d5d5d5;
            font-size: 14px;
            line-height: 20px;
            font-weight: 300;
            margin-bottom: 10px;
            text-decoration: none;
          }
          .social-div {
            margin: 20px 0 60px 0;
          }
          .newsletter {
            color: #fff;
            font-weight: 300;
          }
          .newsletter-form {
            display: flex;
            background: white;
            border-radius: 4px;
            overflow: hidden;
          }
          .newsletter-form input {
            flex: 1;
            padding: 10px 15px;
            border: none;
            outline: none;
            color: #000;
          }
          .newsletter-form button {
            background: #000;
            border: none;
            padding: 0 15px;
            cursor: pointer;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        `}</style>

        {/* Hero Section */}
        <section className="white-banner five-piller-banner position-relative adj-vh" style={{ background: 'transparent' }}>
          <img src="/newimages/Pillar-Flag-new-1.jpg" alt="Hero Background" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} onError={(e) => { e.target.src = 'https://via.placeholder.com/1920x1080?text=Pillars+Hero'; }} />
          
          {/* Reduced text at the bottom left */}
          <div style={{ position: 'absolute', bottom: '60px', left: '60px', textAlign: 'left', color: 'white', maxWidth: '600px', zIndex: 2 }}>
            <h1 className="text-white" style={{ fontFamily: '"Anek Latin", sans-serif', fontWeight: 800, fontSize: '42px', marginBottom: '15px' }}>The Five Pillars of Transformation</h1>
            <p className="text-white" style={{ fontSize: '18px', lineHeight: '1.6', fontWeight: 300 }}>
              At the heart of the Life Awakening Program lie five foundational pillars. Living experiences chosen to nurture the body, awaken the mind, and elevate the spirit.
            </p>
          </div>
        </section>

        {/* Pillars Section */}
        <section className="less-spacing">
          <div className="container">
            <div className="five-pillars">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pillars">
                
                {/* Pillar 1 */}
                <div id="Agriculture-Nature" className="pillar-single position-relative">
                  <Link to="/five-pillars">
                    <img src="/newimages/Agriculture.jpeg" alt="Agriculture" className="img-fluid" onError={(e) => { e.target.src = 'https://via.placeholder.com/240x350?text=Agriculture'; }} />
                    <div className="pillar-content">
                      <img src="/newimages/plant.png" alt="Agriculture Icon" className="pillar-icon" onError={(e) => { e.target.src = 'https://via.placeholder.com/50?text=Icon'; }} />
                      <h3 className="pillar-title">Agriculture & Nature</h3>
                      <p>Experience the sacred bond between soil, food, and self, cultivating gratitude, ecological awareness, and the joy of mindful living.</p>
                    </div>
                  </Link>
                </div>

                {/* Pillar 2 */}
                <div id="Physical-Fitness-Sports" className="pillar-single position-relative">
                  <Link to="/five-pillars">
                    <img src="/newimages/physical-fitness-sports.jpeg" alt="Physical Fitness & Sports" className="img-fluid" onError={(e) => { e.target.src = 'https://via.placeholder.com/240x350?text=Fitness'; }} />
                    <div className="pillar-content">
                      <img src="/newimages/Fitness.png" alt="Fitness Icon" className="pillar-icon" onError={(e) => { e.target.src = 'https://via.placeholder.com/50?text=Icon'; }} />
                      <h3 className="pillar-title">Physical Fitness & Sports</h3>
                      <p>Rediscover your body through indigenous games, yoga, and mindful movement building strength, stamina, and resilience to awaken presence and purpose.</p>
                    </div>
                  </Link>
                </div>

                {/* Pillar 3 */}
                <div id="Team-Building-Leadership" className="pillar-single position-relative">
                  <Link to="/five-pillars">
                    <img src="/newimages/Leadership-Team-Building.jpeg" alt="Team Building & Leadership" className="img-fluid" onError={(e) => { e.target.src = 'https://via.placeholder.com/240x350?text=Leadership'; }} />
                    <div className="pillar-content">
                      <img src="/newimages/Leadership.png" alt="Leadership Icon" className="pillar-icon" onError={(e) => { e.target.src = 'https://via.placeholder.com/50?text=Icon'; }} />
                      <h3 className="pillar-title">Team Building & Leadership</h3>
                      <p>Step beyond personal ambition into collective growth lead with empathy, serve with purpose, and draw strength from shared responsibility and unity.</p>
                    </div>
                  </Link>
                </div>

                {/* Pillar 4 */}
                <div id="Patriotism-Nation-Building" className="pillar-single position-relative p-hover">
                  <Link to="/five-pillars">
                    <img src="/newimages/Patriotism-Nation-Building.jpeg" alt="Patriotism & Nation Building" className="img-fluid" onError={(e) => { e.target.src = 'https://via.placeholder.com/240x350?text=Patriotism'; }} />
                    <div className="pillar-content">
                      <img src="/newimages/Patriotism.png" alt="Patriotism Icon" className="pillar-icon" onError={(e) => { e.target.src = 'https://via.placeholder.com/50?text=Icon'; }} />
                      <h3 className="pillar-title">Patriotism & Nation Building</h3>
                      <p>Deepen your love for the nation through seva, culture, & purposeful action reigniting pride in your identity & showing that true nation-building begins within.</p>
                    </div>
                  </Link>
                </div>

                {/* Pillar 5 */}
                <div id="Spirituality-Peace" className="pillar-single position-relative">
                  <Link to="/five-pillars">
                    <img src="/newimages/spirituality_pillar.jpeg" alt="Spirituality & Peace" className="img-fluid" onError={(e) => { e.target.src = 'https://via.placeholder.com/240x350?text=Spirituality'; }} />
                    <div className="pillar-content">
                      <img src="/newimages/Peace.png" alt="Spirituality Icon" className="pillar-icon" onError={(e) => { e.target.src = 'https://via.placeholder.com/50?text=Icon'; }} />
                      <h3 className="pillar-title">Spirituality & Peace</h3>
                      <p>Find strength in stillness through yoga, reflection, and sacred silence, discover clarity, inner calm, and the joy of simply being.</p>
                    </div>
                  </Link>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* Quote Section */}
        <section className="spacing quote-section position-relative" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px 0' }}>
          <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <blockquote className="devnagri italic" style={{ textAlign: 'center', margin: '0 auto', maxWidth: '800px' }}>
              “Each path whether through movement, stillness, or service reveals a new facet of your inner world”
            </blockquote>
          </div>
        </section>

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
