import React from 'react'
import { Link } from 'react-router-dom'
import ScrollToTop from './ScrollToTop'
import { Globe, ArrowRight } from 'lucide-react'

export default function Campus() {
  return (
    <>
      <div className="animate-fade-in" style={{ fontFamily: '"Inter", sans-serif', background: '#f8fafc', color: '#0f172a' }}>
        
        {/* INJECTED CSS FOR PREMIUM LIGHT THEME */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;700;800&display=swap');

          body {
            background-color: #f8fafc;
          }

          .font-outfit {
            font-family: 'Outfit', sans-serif;
          }

          /* Premium Cards */
          .premium-container {
            background: #ffffff;
            border-radius: 24px;
            padding: 60px 40px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            border: 1px solid #e2e8f0;
          }

          .premium-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            height: 100%;
            display: flex;
            flex-direction: column;
            position: relative;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }

          .premium-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
            border-color: #38bdf8;
          }

          .premium-card .card-img {
            height: 220px;
            width: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
          }

          .premium-card:hover .card-img {
            transform: scale(1.05);
          }

          .card-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(to top, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0) 100%);
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .card-title {
            font-family: 'Outfit', sans-serif;
            font-weight: 600;
            font-size: 16px;
            color: #fff;
            margin: 0;
          }

          .arrow-btn {
            width: 32px;
            height: 32px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            transition: all 0.3s ease;
          }

          .premium-card:hover .arrow-btn {
            background: #005bbb;
            color: #fff;
            transform: rotate(45deg);
          }

          .section-tag {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #005bbb;
            display: inline-block;
            margin-bottom: 10px;
          }

          /* Legend */
          .legend-list {
            list-style: none;
            padding-left: 0;
          }
          .legend-list li {
            font-size: 14px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            color: #475569;
          }
          .legend-list .num {
            background: #d6861a;
            color: #fff;
            font-size: 12px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            font-weight: 600;
            flex-shrink: 0;
          }

          /* Footer */
          .footer {
            background: #0f172a;
            padding: 80px 0 30px 0;
            color: #94a3b8;
          }
          .footer a {
            color: #cbd5e1;
            transition: color 0.3s ease;
          }
          .footer a:hover {
            color: #38bdf8;
          }

          @media (max-width: 768px) {
            .premium-container {
              padding: 30px 20px;
            }
          }
        `}</style>

        {/* Hero Section */}
        <section className="bg-white" style={{ padding: '140px 20px 80px 20px' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <h1 className="font-outfit" style={{ fontWeight: 700, fontSize: '48px', marginBottom: '20px', color: '#0f172a', textAlign: 'center' }}>A Campus Crafted for Transformation</h1>
            <p style={{ fontSize: '16px', lineHeight: '1.6', maxWidth: '800px', margin: '0 auto 50px auto', color: '#475569', textAlign: 'center' }}>
              Inspired by Vision. Rooted in compassion. At LTC, every space is built with purpose to inspire, engage, and transform. Spread across 150 acres of nature and learning zones, the campus blends tradition with experience, offering an environment where growth feels natural and meaningful.
            </p>
            <div style={{ maxWidth: '1200px', margin: '40px auto 0 auto' }}>
              <img src="/newimages/campus/campus-tree.png" alt="Campus Sketch" style={{ width: '100%', height: 'auto', display: 'block', mixBlendMode: 'multiply' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/1200x600?text=Campus+Sketch'; }} />
            </div>
          </div>
        </section>

        {/* Section 1: Learning & Reflection Spaces */}
        <section id="Learning-Reflection-Spaces" style={{ padding: '40px 20px' }}>
          <div className="container">
            <div className="premium-container">
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <span className="section-tag">Knowledge & Growth</span>
                <h2 className="font-outfit" style={{ fontWeight: 700, fontSize: '32px', color: '#0f172a', marginBottom: '10px' }}>Learning & Reflection Spaces</h2>
                <p style={{ fontSize: '16px', color: '#64748b', fontStyle: 'italic' }}>Where knowledge flows, voices rise, and reflection deepens.</p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '25px' }}>
                
                {/* Card 1 */}
                <div className="premium-card">
                  <img src="/newimages/campus/Multipurpose-Hall-new.JPG" alt="Multipurpose Hall" className="card-img" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Hall'; }} />
                  <div className="card-overlay">
                    <h3 className="card-title">Multipurpose Hall</h3>
                    <div className="arrow-btn">↗</div>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="premium-card">
                  <img src="/newimages/campus/Open-Air-Theater.jpeg" alt="Open-Air Theatre" className="card-img" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Theatre'; }} />
                  <div className="card-overlay">
                    <h3 className="card-title">Open-Air Theatre</h3>
                    <div className="arrow-btn">↗</div>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="premium-card">
                  <img src="/newimages/campus/Gazebo-new.JPG" alt="Gazebos" className="card-img" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Gazebos'; }} />
                  <div className="card-overlay">
                    <h3 className="card-title">Gazebos</h3>
                    <div className="arrow-btn">↗</div>
                  </div>
                </div>

                {/* Card 4 */}
                <div className="premium-card">
                  <img src="/newimages/campus/Observation-Point.png" alt="Observation Point" className="card-img" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Observation'; }} />
                  <div className="card-overlay">
                    <h3 className="card-title">Observation Point</h3>
                    <div className="arrow-btn">↗</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Spaces for Inner & Outer Growth */}
        <section id="Spaces-Inner-Outer-Growth" style={{ padding: '20px 20px' }}>
          <div className="container">
            <div className="premium-container">
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <span className="section-tag">Action & Connection</span>
                <h2 className="font-outfit" style={{ fontWeight: 700, fontSize: '32px', color: '#0f172a', marginBottom: '10px' }}>Spaces for Inner & Outer Growth</h2>
                <p style={{ fontSize: '16px', color: '#64748b', fontStyle: 'italic' }}>Where youth build courage, empathy, and connection through real-world action.</p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '25px' }}>
                
                {/* Card 1 */}
                <div className="premium-card">
                  <img src="/newimages/campus/farm-pond-new.jpeg" alt="Farm Pond" className="card-img" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Farm+Pond'; }} />
                  <div className="card-overlay">
                    <h3 className="card-title">Farm Pond</h3>
                    <div className="arrow-btn">↗</div>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="premium-card">
                  <img src="/newimages/campus/krishi-vanam-new.jpeg" alt="Krishi Vanam" className="card-img" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Farm'; }} />
                  <div className="card-overlay">
                    <h3 className="card-title">Krishi Vanam</h3>
                    <div className="arrow-btn">↗</div>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="premium-card">
                  <img src="/newimages/campus/flora-new.jpeg" alt="Flora" className="card-img" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Flora'; }} />
                  <div className="card-overlay">
                    <h3 className="card-title">Flora</h3>
                    <div className="arrow-btn">↗</div>
                  </div>
                </div>

                {/* Card 4 */}
                <div className="premium-card">
                  <img src="/newimages/campus/Fauna-2-new.JPG" alt="Fauna" className="card-img" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Fauna'; }} />
                  <div className="card-overlay">
                    <h3 className="card-title">Fauna</h3>
                    <div className="arrow-btn">↗</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* Large Campus Image (Moved Above Living & Wellness) */}
        <section style={{ padding: '40px 20px' }}>
          <div className="container">
            <div style={{ maxWidth: '1000px', margin: '0 auto', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
              <img src="/newimages/campus/ltc-campus.jpeg" alt="LTC Campus Aerial View" style={{ width: '100%', height: 'auto', display: 'block' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/1200x600?text=LTC+Campus+Aerial+View'; }} />
            </div>
          </div>
        </section>

        {/* Section 3: Living & Wellness Facilities */}
        <section id="Living-Wellness-Facilities" style={{ padding: '20px 20px' }}>
          <div className="container">
            <div className="premium-container">
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <span className="section-tag">Wellness & Life</span>
                <h2 className="font-outfit" style={{ fontWeight: 700, fontSize: '32px', color: '#0f172a', marginBottom: '10px' }}>Living & Wellness Facilities</h2>
                <p style={{ fontSize: '16px', color: '#64748b', fontStyle: 'italic' }}>Designed to support holistic wellbeing and mindful living</p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '25px' }}>
                
                {/* Card 1 */}
                <div className="premium-card">
                  <img src="/newimages/campus/Community-Kitchen-new.jpeg" alt="Community Kitchen" className="card-img" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Kitchen'; }} />
                  <div className="card-overlay">
                    <h3 className="card-title">Community Kitchen</h3>
                    <div className="arrow-btn">↗</div>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="premium-card">
                  <img src="/newimages/campus/Students-Housing-new.JPG" alt="Student Housing" className="card-img" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Housing'; }} />
                  <div className="card-overlay">
                    <h3 className="card-title">Student Housing</h3>
                    <div className="arrow-btn">↗</div>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="premium-card">
                  <img src="/newimages/campus/Faculty-Housing.png" alt="Faculty Housing" className="card-img" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Faculty+Housing'; }} />
                  <div className="card-overlay">
                    <h3 className="card-title">Faculty Housing</h3>
                    <div className="arrow-btn">↗</div>
                  </div>
                </div>

                {/* Card 4 */}
                <div className="premium-card">
                  <img src="/newimages/LTC-Medical-Centre-new.png" alt="Medical Facilities" className="card-img" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Medical'; }} />
                  <div className="card-overlay">
                    <h3 className="card-title">Medical Facilities</h3>
                    <div className="arrow-btn">↗</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* Legend Section (Map on Right, Legend on Left) */}
        <section id="Map-Zone-2" style={{ padding: '40px 20px 80px 20px' }}>
          <div className="container">
            <div className="premium-container">
              <div style={{ textAlign: 'center', marginBottom: '50px' }}>
                <span className="section-tag">Campus Layout</span>
                <h2 className="font-outfit" style={{ fontWeight: 700, fontSize: '32px', color: '#0f172a', marginBottom: '10px' }}>A Tapestry Of Balance : Map Zone 2</h2>
                <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '800px', margin: '0 auto' }}>
                  Map Zone 2 is a thoughtfully designed space focused on active and communal living.
                </p>
              </div>

              <div className="row align-items-start">
                
                {/* Left Side: Legend */}
                <div className="col-12 col-md-3 mb-4">
                  <h5 style={{ fontWeight: 700, color: '#d6861a', marginBottom: '20px', fontFamily: '"Outfit", sans-serif' }}>Legend</h5>
                  <ul className="legend-list">
                    <li><span className="num">1</span> ENTRANCE POINT</li>
                    <li><span className="num">2</span> DROP-OFF POINT</li>
                    <li><span className="num">3</span> ADMIN BLOCK</li>
                    <li><span className="num">4</span> STAFF QUARTERS</li>
                    <li><span className="num">5</span> MULTI-PURPOSE HALL</li>
                    <li><span className="num">6</span> DINING HALL</li>
                    <li><span className="num">7</span> STUDENT DORMITORIES</li>
                    <li><span className="num">8</span> SPORTS GROUND</li>
                    <li><span className="num">9</span> MULTI-PURPOSE SPORTS COURT</li>
                    <li><span className="num">10</span> PRIMARY ROADS</li>
                    <li><span className="num">11</span> SECONDARY PATHWAYS</li>
                    <li><span className="num">12</span> TERTIARY PATHWAYS</li>
                  </ul>
                </div>

                {/* Middle: Road Key */}
                <div className="col-12 col-md-3 mb-4">
                  <h5 style={{ fontWeight: 700, color: '#d6861a', marginBottom: '20px', fontFamily: '"Outfit", sans-serif' }}>Road Key</h5>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', marginBottom: '15px', gap: '10px', color: '#475569' }}>
                    <span style={{ width: '40px', height: '4px', borderRadius: '5px', background: 'linear-gradient(to right, #c13f00 40%, transparent 60%)' }}></span> PRIMARY ROADS
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', marginBottom: '15px', gap: '10px', color: '#475569' }}>
                    <span style={{ width: '40px', height: '4px', borderRadius: '5px', background: 'linear-gradient(to right, #004b9d 40%, transparent 60%)' }}></span> SECONDARY PATHWAYS
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', marginBottom: '15px', gap: '10px', color: '#475569' }}>
                    <span style={{ width: '40px', height: '4px', borderRadius: '5px', background: 'linear-gradient(to right, #1c9c22 40%, transparent 60%)' }}></span> TERTIARY PATHWAYS
                  </div>
                </div>

                {/* Right Side: Map Image */}
                <div className="col-12 col-md-6">
                  <div style={{ borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                    <img src="/newimages/campus/map.png" alt="Campus Map" style={{ width: '100%', height: 'auto', display: 'block' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/600x500?text=Campus+Map'; }} />
                  </div>
                </div>

              </div>
            </div>
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
              <div style={{ gridColumn: 'span 2' }}>
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
